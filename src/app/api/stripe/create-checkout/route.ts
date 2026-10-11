import { NextResponse } from "next/server"
import Stripe from "stripe"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { SITE_URL } from "@/lib/site"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const platformSecretKey = process.env.STRIPE_SECRET_KEY!

// The redirect target must come from OUR configuration, never from a request
// header. Using `Origin` here would let anyone POST with a crafted Origin and
// have the buyer redirected to an attacker-controlled domain (open redirect /
// phishing). SITE_URL already strips any trailing slash.
const siteUrl = SITE_URL

// Simple in-memory rate limiter (per user). In production on serverless,
// prefer an external store (e.g. Redis/Upstash); this guards against
// accidental double-clicks and casual abuse.
const rateLimit = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 10 // max requests
const RATE_WINDOW_MS = 60_000 // per minute
// An abandoned session is reusable for this long, so a refresh or a double
// click returns the SAME Stripe session instead of creating a second one.
const SESSION_REUSE_WINDOW_MS = 15 * 60_000
// Stripe idempotency keys are stable per bucket: two submissions inside the
// same window collapse into one session, while a genuine retry later (after a
// failed/expired session) is still allowed to create a new one.
const IDEMPOTENCY_BUCKET_MS = 10 * 60_000

function checkRateLimit(key: string): boolean {
  const now = Date.now()
  // Prune expired entries so the Map cannot grow without bound.
  if (rateLimit.size > 200) {
    for (const [k, v] of rateLimit) {
      if (v.resetAt < now) rateLimit.delete(k)
    }
  }
  const entry = rateLimit.get(key)
  if (!entry || entry.resetAt < now) {
    rateLimit.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return true
  }
  entry.count += 1
  return entry.count <= RATE_LIMIT
}

/** Error whose message is safe to show to the student, with an HTTP status. */
class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = "HttpError"
  }
}

export async function POST(req: Request) {
  try {
    if (!platformSecretKey) {
      throw new HttpError("Platform Stripe not configured.", 500)
    }

    // ---- Authenticate the caller; never trust userId from the body alone ----
    const cookieStore = await cookies()
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll() {},
        },
      },
    )
    const { data: { user } } = await supabaseAuth.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { planId, userId, couponCode } = await req.json()
    if (!planId || !userId) {
      throw new HttpError("Missing planId or userId", 400)
    }

    // The authenticated user may only buy for themselves.
    if (userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (!checkRateLimit(`checkout:${user.id}`)) {
      return NextResponse.json({ error: "Too many requests, try again in a minute" }, { status: 429 })
    }

    const sb = createClient(supabaseUrl, supabaseKey)

    // is_active is filtered HERE (fail closed) and again inside the
    // settle_paid_checkout_session RPC. A retired plan must not be purchasable
    // just because someone still holds a stale plan id in the browser.
    // `.eq("is_active", true)` also excludes NULL, which is intentional.
    const { data: plan } = await sb
      .from("subscription_plans")
      .select("*")
      .eq("id", planId)
      .eq("is_active", true)
      .single()
    if (!plan) {
      throw new HttpError("Plan not found", 404)
    }

    // --- COUPON VALIDATION (server-side only; client never controls the price) ---
    let discountPercent = 0
    let couponId: string | null = null
    if (couponCode && typeof couponCode === "string") {
      const code = String(couponCode).trim().toUpperCase()
      const { data: c } = await sb.from("coupon_codes").select("*").eq("code", code).maybeSingle()
      const coupon = c as Record<string, unknown> | null

      if (!coupon || !coupon.is_active) throw new HttpError("Invalid coupon code", 400)
      if (coupon.expires_at && new Date(coupon.expires_at as string) < new Date()) throw new HttpError("Coupon expired", 400)
      if (coupon.max_uses != null && Number(coupon.used_count) >= Number(coupon.max_uses)) throw new HttpError("Coupon usage limit reached", 400)

      const couponPlanIds = Array.isArray(coupon.plan_ids) ? (coupon.plan_ids as string[]) : []
      if (!couponPlanIds.includes(planId)) throw new HttpError("Coupon not valid for this bundle", 400)

      const { count } = await sb
        .from("coupon_redemptions")
        .select("id", { count: "exact", head: true })
        .eq("coupon_id", coupon.id as string)
        .eq("user_id", user.id)
      if ((count ?? 0) > 0) throw new HttpError("You already used this coupon", 400)

      const rawDiscount = Number(coupon.discount_percent)
      if (!Number.isFinite(rawDiscount)) throw new HttpError("Invalid coupon code", 400)
      discountPercent = Math.min(Math.max(rawDiscount, 0), 99)
      couponId = coupon.id as string
    }

    const planData = plan as Record<string, unknown>
    const stripe = new Stripe(platformSecretKey)
    const fullAmountCents = Math.round(Number(planData.price) * 100)
    if (!Number.isFinite(fullAmountCents) || fullAmountCents <= 0) {
      throw new HttpError("Plan price is not configured correctly", 500)
    }
    // Final amount ALWAYS computed from DB price — never trusted from client
    const finalCents = Math.round((fullAmountCents * (100 - discountPercent)) / 100)
    const durationDays = Number(planData.duration_days ?? 30)
    if (!Number.isFinite(durationDays) || durationDays <= 0) {
      throw new HttpError("Plan duration is not configured correctly", 500)
    }

    // ---- Reuse a still-open session for the same plan/price/coupon ----
    // Without this, a double click or a refresh created a second Checkout
    // Session; if both were paid the student was charged twice.
    const { data: recent } = await sb
      .from("checkout_sessions")
      .select("id, url, amount_cents, coupon_id")
      .eq("user_id", user.id)
      .eq("plan_id", planId)
      .eq("status", "pending")
      .gte("created_at", new Date(Date.now() - SESSION_REUSE_WINDOW_MS).toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    // Only reuse when the amount AND the coupon still match, so a changed plan
    // price, a different coupon, or a removed discount never resurrects a
    // session that was created under different terms.
    if (
      recent?.url &&
      recent.amount_cents === finalCents &&
      (recent.coupon_id ?? null) === couponId
    ) {
      try {
        const existing = await stripe.checkout.sessions.retrieve(recent.id)
        if (existing.status === "open" && existing.url) {
          return NextResponse.json({ url: existing.url, reused: true })
        }
      } catch {
        // Session no longer exists in Stripe — fall through and create a new one.
      }
    }

    const origin = siteUrl
    const bucket = Math.floor(Date.now() / IDEMPOTENCY_BUCKET_MS)

    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        payment_method_types: ["card", "ideal"],
        line_items: [
          {
            price_data: {
              currency: "eur",
              product_data: {
                name: planData.name as string,
                ...(typeof planData.description === "string" && planData.description.trim().length > 0
                  ? { description: planData.description }
                  : {}),
              },
              unit_amount: finalCents,
            },
            quantity: 1,
          },
        ],
        client_reference_id: user.id,
        metadata: {
          plan_id: planId,
          duration_days: String(durationDays),
          ...(couponId ? { coupon_id: couponId, discount_percent: String(discountPercent) } : {}),
        },
        // No connected account: all payment goes 100% to the platform's own
        // Stripe balance.
        // {CHECKOUT_SESSION_ID} lets Stripe inject cs_test_... into the redirect
        // so the client can track this session's payment status in checkouts.
        success_url: `${origin}/exams?subscription=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/exams?subscription=cancelled`,
      } as Stripe.Checkout.SessionCreateParams,
      // Stable per (user, plan, coupon, time bucket). A retry with identical
      // params inside the same bucket returns the SAME Stripe session instead
      // of creating a second one; a later retry gets a fresh bucket.
      { idempotencyKey: `checkout_session_${user.id}_${planId}_${couponId ?? "none"}_${bucket}` },
    )

    // Record the session so the student's client can watch for the final
    // payment result (esp. async methods like iDEAL). Status starts pending;
    // the webhook flips it to succeeded/failed/expired/refunded.
    //
    // The result MUST be checked: if this silently fails, the failed/expired
    // webhooks update zero rows and a declined payment is reported to the
    // student as "being activated".
    //
    // NOTE: insert, never upsert. When the idempotency key below collides,
    // Stripe returns the SAME (already-paid) session; an upsert would reset our
    // row back to 'pending' and hide a successful payment. A duplicate id is
    // therefore ignored — the existing row is the authoritative one.
    if (session.status === "open") {
      const { error: trackErr } = await sb.from("checkout_sessions").insert({
        id: session.id,
        user_id: user.id,
        plan_id: planId,
        url: session.url,
        amount_cents: finalCents,
        coupon_id: couponId,
        status: "pending",
        updated_at: new Date().toISOString(),
      })

      // 23505 = unique_violation: row already exists, nothing to do.
      if (trackErr && trackErr.code !== "23505") {
        // Roll the Stripe session back so the student is never sent to a
        // payment page we cannot track.
        try {
          await stripe.checkout.sessions.expire(session.id)
        } catch (expireErr) {
          console.error("Create checkout: could not expire untracked session", session.id, expireErr)
        }
        console.error("Create checkout: checkout_sessions insert failed", trackErr.message)
        throw new HttpError("Failed to create checkout session. Please try again.", 500)
      }
    }

    return NextResponse.json({ url: session.url })
  } catch (e) {
    const err = e as { message?: string } | undefined
    if (e instanceof HttpError) {
      if (e.status >= 500) console.error("Create checkout error:", err?.message ?? e)
      return NextResponse.json({ error: e.message }, { status: e.status })
    }
    // Never leak raw Stripe/Supabase messages (they can contain internal ids).
    console.error("Create checkout error:", err?.message ?? e)
    return NextResponse.json({ error: "Failed to create checkout session. Please try again." }, { status: 500 })
  }
}
