import { NextResponse } from "next/server"
import Stripe from "stripe"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const platformSecretKey = process.env.STRIPE_SECRET_KEY!

export async function POST(req: Request) {
  try {
    if (!supabaseKey) {
      console.error("Webhook: SUPABASE_SERVICE_ROLE_KEY missing in .env.local")
      return NextResponse.json({ error: "Server misconfigured: missing service role key" }, { status: 500 })
    }

    if (!platformSecretKey) {
      console.error("Webhook: STRIPE_SECRET_KEY missing in .env.local")
      return NextResponse.json({ error: "Server misconfigured: missing platform Stripe key" }, { status: 500 })
    }

    const body = await req.text()
    const signature = req.headers.get("stripe-signature") || ""

    const sb = createClient(supabaseUrl, supabaseKey)
    const { data: settings } = await sb.from("site_settings").select("payment_settings").eq("id", 1).single()
    const paymentSettings = settings?.payment_settings as Record<string, unknown> | undefined
    const webhookSecret = paymentSettings?.webhook_secret as string | undefined

    const stripe = new Stripe(platformSecretKey)

    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret || "")
    } catch (sigErr) {
      console.error("Webhook signature verification failed:", sigErr)
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.client_reference_id
      const planId = session.metadata?.plan_id
      const durationDays = parseInt(session.metadata?.duration_days || "30", 10)
      const amount = session.amount_total ? session.amount_total / 100 : 0
      const platformFee = (session as unknown as { application_fee_amount?: number }).application_fee_amount
        ? (session as unknown as { application_fee_amount?: number }).application_fee_amount! / 100
        : 0

      console.log(`Webhook: checkout completed for user=${userId}, plan=${planId}, platform_fee=${platformFee}`)

      if (!userId || !planId) {
        return NextResponse.json({ error: "Missing metadata" }, { status: 400 })
      }

      await sb.from("user_subscriptions").update({ is_active: false }).eq("user_id", userId).eq("is_active", true)

      await sb.from("user_subscriptions").insert({
        user_id: userId,
        plan_id: planId,
        start_date: new Date().toISOString(),
        end_date: new Date(Date.now() + durationDays * 86400000).toISOString(),
        is_active: true,
      })

      // Record coupon redemption (unique constraint prevents double-redemption)
      const couponId = session.metadata?.coupon_id
      if (couponId) {
        const { data: inserted, error: redeemErr } = await sb
          .from("coupon_redemptions")
          .insert({ coupon_id: couponId, user_id: userId })
          .select("id")
        if (!redeemErr && inserted && inserted.length > 0) {
          // Only increments once per user per coupon
          await sb.rpc("increment_coupon_used_count", { p_coupon_id: couponId })
        }
      }

      await sb.from("payouts").insert({
        amount: platformFee,
        description: `Platform fee (50%) - ${session.id.slice(0, 12)}`,
        status: "pending",
      })

      console.log("Webhook: subscription and payout created successfully")
    }

    return NextResponse.json({ received: true })
  } catch (e) {
    console.error("Webhook error:", e)
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 })
  }
}
