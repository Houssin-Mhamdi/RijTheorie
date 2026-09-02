import { NextResponse } from "next/server"
import Stripe from "stripe"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const platformSecretKey = process.env.STRIPE_SECRET_KEY!

export async function POST(req: Request) {
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

  if (!webhookSecret) {
    console.error("Webhook: webhook_secret not configured in site_settings.payment_settings")
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 })
  }

  const stripe = new Stripe(platformSecretKey)

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (sigErr) {
    console.error("Webhook signature verification failed:", sigErr)
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  // ---- Idempotency guard: skip events we've already processed ----
  if (event.type === "checkout.session.completed") {
    const { data: existing } = await sb
      .from("stripe_events")
      .select("id")
      .eq("id", event.id)
      .maybeSingle()
    if (existing) {
      return NextResponse.json({ received: true, duplicate: true })
    }
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session

    const userId = session.client_reference_id
    const planId = session.metadata?.plan_id
    const durationDays = parseInt(session.metadata?.duration_days || "30", 10)
    const platformFee = ((session as unknown as { application_fee_amount?: number }).application_fee_amount ?? 0) / 100
    const endDate = new Date(Date.now() + durationDays * 86400000).toISOString()

    if (!userId || !planId || !session.id) {
      console.error("Webhook: missing metadata", { userId, planId, sessionId: session.id })
      return NextResponse.json({ error: "Missing metadata" }, { status: 400 })
    }

    // Atomically activate the subscription (idempotent). Attempt reset is
    // automatic: get_exam_attempt_status counts attempts from the student's
    // most recent subscription start_date.
    const { data: activation, error: actErr } = await sb.rpc(
      "activate_subscription_from_payment",
      {
        p_event_id: event.id,
        p_checkout_session_id: session.id,
        p_plan_id: planId,
        p_user_id: userId,
        p_duration_days: durationDays,
        p_end_date: endDate,
      },
    )

    if (actErr) {
      console.error("Webhook: activate_subscription RPC failed", actErr.message)
      return NextResponse.json({ error: "Failed to activate subscription" }, { status: 500 })
    }

    const result = activation as { processed?: boolean; duplicate_event?: boolean; duplicate_session?: boolean; error?: string } | null

    if (result?.error) {
      console.error("Webhook: activate_subscription returned error", result.error)
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    if (!result?.processed) {
      // Duplicate event/session — already handled. Return success for Stripe.
      return NextResponse.json({ received: true, duplicate: true })
    }

    // ---- Coupon redemption (idempotent via unique(coupon_id, user_id)) ----
    const couponId = session.metadata?.coupon_id
    if (couponId) {
      const { data: inserted, error: redeemErr } = await sb
        .from("coupon_redemptions")
        .insert({ coupon_id: couponId, user_id: userId })
        .select("id")
      if (!redeemErr && inserted && inserted.length > 0) {
        await sb.rpc("increment_coupon_used_count", { p_coupon_id: couponId })
      }
    }

    // ---- Payout for the platform fee (dedup by checkout session) ----
    const { data: existingPayout } = await sb
      .from("payouts")
      .select("id")
      .eq("checkout_session_id", session.id)
      .maybeSingle()
    if (!existingPayout) {
      await sb.from("payouts").insert({
        amount: platformFee,
        description: `Platform fee - ${session.id}`,
        status: "pending",
        checkout_session_id: session.id,
      })
    }

    return NextResponse.json({ received: true, processed: true })
  }

  if (event.type === "charge.refunded") {
    // A refund was issued. Record it; entitlement reconciliation can be
    // handled by an admin or a scheduled job.
    const charge = event.data.object as Stripe.Charge
    const sessionId = typeof charge.payment_intent === "string" ? charge.payment_intent : undefined
    console.log("Webhook: charge.refunded", { charge: charge.id, sessionId })
  }

  if (event.type === "checkout.session.expired") {
    console.log("Webhook: checkout.session.expired (no charge)")
  }

  return NextResponse.json({ received: true })
}
