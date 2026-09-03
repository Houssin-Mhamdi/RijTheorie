import { NextResponse } from "next/server"
import Stripe from "stripe"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const platformSecretKey = process.env.STRIPE_SECRET_KEY!

const APPLICATION_FEE_PERCENT = 50

// Simple in-memory rate limiter (per user). In production on serverless,
// prefer an external store (e.g. Redis/Upstash); this guards against
// accidental double-clicks and casual abuse.
const rateLimit = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 10 // max requests
const RATE_WINDOW_MS = 60_000 // per minute

function checkRateLimit(key: string): boolean {
  const now = Date.now()
  const entry = rateLimit.get(key)
  if (!entry || entry.resetAt < now) {
    rateLimit.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return true
  }
  entry.count += 1
  return entry.count <= RATE_LIMIT
}

export async function POST(req: Request) {
  try {
    if (!platformSecretKey) {
      return NextResponse.json({ error: "Platform Stripe not configured." }, { status: 500 })
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
      return NextResponse.json({ error: "Missing planId or userId" }, { status: 400 })
    }

    // The authenticated user may only buy for themselves.
    if (userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (!checkRateLimit(`checkout:${user.id}`)) {
      return NextResponse.json({ error: "Too many requests, try again in a minute" }, { status: 429 })
    }

    const sb = createClient(supabaseUrl, supabaseKey)

    const { data: settings } = await sb.from("site_settings").select("payment_settings").eq("id", 1).single()
    const paymentSettings = (settings?.payment_settings as Record<string, unknown>) ?? {}
    const connectedAccountId = paymentSettings.stripe_account_id as string | undefined

    if (!connectedAccountId) {
      return NextResponse.json({ error: "Stripe Connect not set up. Please connect your Stripe account first." }, { status: 400 })
    }

    const { data: plan } = await sb.from("subscription_plans").select("*").eq("id", planId).single()
    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 })
    }

    // --- COUPON VALIDATION (server-side only; client never controls the price) ---
    let discountPercent = 0
    let couponId: string | null = null
    if (couponCode && typeof couponCode === "string") {
      const code = String(couponCode).trim().toUpperCase()
      const { data: c } = await sb.from("coupon_codes").select("*").eq("code", code).maybeSingle()
      const coupon = c as Record<string, unknown> | null

      if (!coupon || !coupon.is_active) throw new Error("Invalid coupon code")
      if (coupon.expires_at && new Date(coupon.expires_at as string) < new Date()) throw new Error("Coupon expired")
      if (coupon.max_uses != null && Number(coupon.used_count) >= Number(coupon.max_uses)) throw new Error("Coupon usage limit reached")

      const couponPlanIds = Array.isArray(coupon.plan_ids) ? (coupon.plan_ids as string[]) : []
      if (!couponPlanIds.includes(planId)) throw new Error("Coupon not valid for this bundle")

      const { count } = await sb
        .from("coupon_redemptions")
        .select("id", { count: "exact", head: true })
        .eq("coupon_id", coupon.id as string)
        .eq("user_id", user.id)
      if ((count ?? 0) > 0) throw new Error("You already used this coupon")

      discountPercent = Math.min(Math.max(Number(coupon.discount_percent), 0), 99)
      couponId = coupon.id as string
    }

    const planData = plan as Record<string, unknown>
    const stripe = new Stripe(platformSecretKey)
    const fullAmountCents = Math.round(Number(planData.price) * 100)
    // Final amount ALWAYS computed from DB price — never trusted from client
    const finalCents = Math.round((fullAmountCents * (100 - discountPercent)) / 100)
    const durationDays = Number(planData.duration_days ?? 30)
    const applicationFeeCents = Math.round((finalCents * APPLICATION_FEE_PERCENT) / 100)

    // Idempotency: one active checkout session per user. Creating a Stripe
    // Session for a second time in the same window is rejected so a double
    // click / refresh never creates a second purchase.
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
          connected_account: connectedAccountId,
          ...(couponId ? { coupon_id: couponId, discount_percent: String(discountPercent) } : {}),
        },
        // In this Stripe API version (payment mode), the connected-account
        // fee + destination transfer are nested under payment_intent_data.
        payment_intent_data: {
          application_fee_amount: applicationFeeCents,
          transfer_data: {
            destination: connectedAccountId,
          },
        },
        success_url: `${req.headers.get("origin") || "http://localhost:3000"}/exams?subscription=success`,
        cancel_url: `${req.headers.get("origin") || "http://localhost:3000"}/exams?subscription=cancelled`,
      } as Stripe.Checkout.SessionCreateParams,
      // Idempotency key: prevents a retry from creating a duplicate session.
      { idempotencyKey: `checkout_session_${user.id}_${planId}` },
    )

    return NextResponse.json({ url: session.url })
  } catch (e) {
    const err = e as { message?: string } | undefined
    console.error("Create checkout error:", err?.message ?? e)
    const message = e instanceof Error && !e.message.includes("error") ? e.message : "Failed to create checkout session"
    return NextResponse.json({ error: message }, { status: e instanceof Error && e.message.includes("oupon") ? 400 : 500 })
  }
}
