import { NextResponse } from "next/server"
import Stripe from "stripe"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const platformSecretKey = process.env.STRIPE_SECRET_KEY!

const APPLICATION_FEE_PERCENT = 50

export async function POST(req: Request) {
  try {
    const { planId, userId, couponCode } = await req.json()
    if (!planId || !userId) {
      return NextResponse.json({ error: "Missing planId or userId" }, { status: 400 })
    }

    if (!platformSecretKey) {
      return NextResponse.json({ error: "Platform Stripe not configured." }, { status: 500 })
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

      const planIds = Array.isArray(coupon.plan_ids) ? (coupon.plan_ids as string[]) : []
      if (!planIds.includes(planId)) throw new Error("Coupon not valid for this bundle")

      // One redemption per user — enforced by DB unique constraint, checked here for UX
      const { count } = await sb
        .from("coupon_redemptions")
        .select("id", { count: "exact", head: true })
        .eq("coupon_id", coupon.id as string)
        .eq("user_id", userId)
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
    const applicationFeeCents = Math.round(finalCents * APPLICATION_FEE_PERCENT / 100)

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: planData.name as string,
              description: planData.description as string | undefined,
            },
            unit_amount: finalCents,
          },
          quantity: 1,
        },
      ],
      client_reference_id: userId,
      metadata: {
        plan_id: planId,
        duration_days: String(durationDays),
        connected_account: connectedAccountId,
        ...(couponId ? { coupon_id: couponId, discount_percent: String(discountPercent) } : {}),
      },
      application_fee_amount: applicationFeeCents,
      transfer_data: {
        destination: connectedAccountId,
      },
      success_url: `${req.headers.get("origin") || "http://localhost:3000"}/exams?subscription=success`,
      cancel_url: `${req.headers.get("origin") || "http://localhost:3000"}/exams?subscription=cancelled`,
    } as Stripe.Checkout.SessionCreateParams)

    return NextResponse.json({ url: session.url })
  } catch (e) {
    console.error("Create checkout error:", e)
    const message = e instanceof Error && !e.message.includes("error") ? e.message : "Failed to create checkout session"
    return NextResponse.json({ error: message }, { status: e instanceof Error && e.message.includes("oupon") ? 400 : 500 })
  }
}
