import { NextResponse } from "next/server"
import Stripe from "stripe"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const platformSecretKey = process.env.STRIPE_SECRET_KEY!

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Reads a Stripe expandable field that may be an id string or an object. */
function expandId(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null
  return typeof value === "string" ? value : value.id
}

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

  // ---- Idempotency guard: skip events we've already fully settled ----
  // Safe because settle_paid_checkout_session DELETES its tombstone on every
  // error path. A row here therefore means the whole settlement (subscription +
  // coupon + status) is committed, so returning early can no longer skip
  // unfinished work.
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const { data: existing } = await sb
      .from("stripe_events")
      .select("id")
      .eq("id", event.id)
      .maybeSingle()
    if (existing) {
      return NextResponse.json({ received: true, duplicate: true })
    }
  }

  /**
   * Revoke access and refund a payment we cannot honour (amount mismatch, a
   * coupon that hit its cap after the student already paid, or metadata we
   * cannot read).
   *
   * Order is deliberate: the subscription is revoked BEFORE the money is
   * returned, so there is no window in which the student keeps access to a
   * purchase we are about to refund.
   *
   * Returns whether the revocation succeeded. When it did not, the caller must
   * answer 500 so Stripe retries — the refund is idempotent (fixed Stripe
   * idempotency key), so a retry re-issues nothing and only retries the revoke.
   */
  const refundAndRevoke = async (
    paymentIntentId: string | null,
    checkoutSessionId: string | null,
    reason: string,
  ): Promise<{ revoked: boolean }> => {
    console.error("Webhook: revoking access and refunding", { reason, paymentIntentId, checkoutSessionId })

    const { error: revokeErr } = await sb.rpc("revoke_subscription_from_refund", {
      p_payment_intent_id: paymentIntentId,
      p_checkout_session_id: checkoutSessionId,
    })
    if (revokeErr) {
      console.error("Webhook: revoke RPC failed — will retry", {
        checkoutSessionId,
        reason,
        error: revokeErr.message,
      })
    }

    if (paymentIntentId) {
      try {
        const refund = await stripe.refunds.create(
          { payment_intent: paymentIntentId, reason: "requested_by_customer", metadata: { revoke_reason: reason } },
          // Fixed per (payment intent, reason): a Stripe retry reuses the SAME
          // refund instead of paying the student back twice.
          { idempotencyKey: `auto_refund_${paymentIntentId}_${reason}` },
        )
        console.error("Webhook: auto-refund issued", refund.id, reason)
      } catch (refundErr) {
        // Loud, because a student paid and must be refunded MANUALLY.
        console.error("Webhook: AUTO-REFUND FAILED — manual action required", {
          paymentIntentId,
          reason,
          error: refundErr instanceof Error ? refundErr.message : refundErr,
        })
      }

      // Stripe only accepts `duplicate` / `fraudulent` as refund reasons from
      // the Dashboard, so the API call is tagged `requested_by_customer`.
      // That is misleading when you audit the Dashboard later, so annotate the
      // PaymentIntent with what actually happened. Stripe merges metadata
      // keys, so existing ones are preserved. Non-fatal: a failed annotation
      // must never block or undo the revocation.
      try {
        await stripe.paymentIntents.update(paymentIntentId, {
          metadata: {
            auto_refunded: "true",
            revoke_reason: reason,
            revoked_by: "system",
            revoked_at: new Date().toISOString(),
          },
        })
      } catch (metaErr) {
        console.error("Webhook: could not annotate PaymentIntent after refund", {
          paymentIntentId,
          reason,
          error: metaErr instanceof Error ? metaErr.message : metaErr,
        })
      }
    } else {
      console.error("Webhook: cannot auto-refund (no payment_intent) — manual action required", { reason, checkoutSessionId })
    }

    return { revoked: !revokeErr }
  }

  const activateSession = async (session: Stripe.Checkout.Session, eventId: string) => {
    const userId = session.client_reference_id
    const planId = session.metadata?.plan_id
    const paymentIntentId = expandId(session.payment_intent)

    // duration_days comes from session metadata we wrote ourselves, but never
    // let a malformed value slip through: the RPC rejects a non-positive value
    // and the end date is derived in SQL, not here.
    const parsedDuration = Number.parseInt(session.metadata?.duration_days ?? "", 10)
    const durationDays = Number.isFinite(parsedDuration) && parsedDuration > 0 ? parsedDuration : 30

    if (!userId || !planId) {
      // We cannot work out what was bought, so we cannot grant access — but the
      // money is real. Refund it automatically rather than leaving it for a
      // human to spot in the Dashboard. A retry will not fix missing metadata,
      // so the caller acknowledges afterwards.
      console.error("Webhook: FATAL missing metadata, auto-refunding", {
        eventId,
        userId,
        planId,
        sessionId: session.id,
        paymentIntentId,
      })
      const { revoked } = await refundAndRevoke(paymentIntentId, session.id, "missing_metadata")
      if (!revoked) return { ok: false as const, status: 500 as const, body: { error: "Revoke failed" } }
      return { ok: true as const, fatal: true as const }
    }

    // Only accept a real UUID for the coupon; anything else would make the
    // RPC fail with a cast error and retry forever.
    const rawCoupon = session.metadata?.coupon_id
    const couponId = rawCoupon && UUID_RE.test(rawCoupon) ? rawCoupon : null

    // One atomic call settles everything: event tombstone, coupon redemption,
    // subscription insert and the checkout_sessions status flip. It either
    // commits in full or not at all, so a crash can no longer leave a paid
    // student without access or with an unconsumed coupon.
    //
    // No connected account: the full payment amount lands in the platform's
    // own Stripe balance, so there is no platform-fee split to compute.
    const { data: settlement, error: settleErr } = await sb.rpc(
      "settle_paid_checkout_session",
      {
        p_event_id: eventId,
        p_checkout_session_id: session.id,
        p_plan_id: planId,
        p_user_id: userId,
        p_duration_days: durationDays,
        p_amount_cents: session.amount_total ?? null,
        p_coupon_id: couponId,
        p_payment_intent_id: paymentIntentId,
      },
    )

    if (settleErr) {
      // A transport/DB failure, not a data problem: nothing was written, so
      // returning 500 makes Stripe retry the whole settlement.
      console.error("Webhook: settle_paid_checkout_session RPC failed", settleErr.message)
      return { ok: false as const, status: 500 as const, body: { error: "Failed to settle checkout session" } }
    }

    const result = settlement as {
      processed?: boolean
      duplicate_event?: boolean
      duplicate_session?: boolean
      error?: string
      expected_cents?: number
      received_cents?: number
      refund?: boolean
    } | null

    if (result?.error) {
      console.error("Webhook: settlement rejected, refunding", {
        error: result.error,
        sessionId: session.id,
        expected_cents: result.expected_cents,
        received_cents: result.received_cents,
      })
      // Every code this RPC returns is a PERMANENT data problem: the amount
      // collected does not match the plan, the plan vanished or was retired, the
      // coupon record is gone/filled/disabled, or the duration is nonsense.
      // Retrying cannot fix any of them, so refund, acknowledge, and stop
      // Stripe's 3-day retry storm.
      const { revoked } = await refundAndRevoke(paymentIntentId, session.id, result.error)
      if (!revoked) return { ok: false as const, status: 500 as const, body: { error: "Revoke failed" } }
      return { ok: true as const, fatal: true as const }
    }

    if (!result?.processed) {
      // Duplicate event/session — already settled. Return success for Stripe.
      return { ok: true as const, duplicate: true as const }
    }

    return { ok: true as const, processed: true as const }
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session
    // For synchronous payment methods (cards) the payment is already paid
    // here. For async methods (iDEAL) Stripe fires checkout.session.completed
    // BEFORE the bank confirms — so we only activate when payment_status is
    // paid, and let checkout.session.async_payment_succeeded handle iDEAL.
    if (session.payment_status === "paid") {
      const result = await activateSession(session, event.id)
      if (!result.ok) return NextResponse.json(result.body, { status: result.status })
      if (result.duplicate) return NextResponse.json({ received: true, duplicate: true })
      return NextResponse.json({ received: true, processed: true, fatal: result.fatal === true })
    }
    return NextResponse.json({ received: true })
  }

  if (event.type === "checkout.session.async_payment_succeeded") {
    // iDEAL (or another async method) was confirmed by the bank.
    const session = event.data.object as Stripe.Checkout.Session
    const result = await activateSession(session, event.id)
    if (!result.ok) return NextResponse.json(result.body, { status: result.status })
    if (result.duplicate) return NextResponse.json({ received: true, duplicate: true })
    return NextResponse.json({ received: true, processed: true, fatal: result.fatal === true })
  }

  if (event.type === "checkout.session.async_payment_failed") {
    // iDEAL/async bank payment was rejected or failed. Mark the session so
    // the student sees a clear "payment failed" result.
    const session = event.data.object as Stripe.Checkout.Session
    console.error("Webhook: async payment FAILED", { sessionId: session.id, userId: session.client_reference_id })
    if (session.id) {
      const { error } = await sb
        .from("checkout_sessions")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", session.id)
      if (error) console.error("Webhook: could not mark checkout session failed", error.message)
    }
  }

  if (event.type === "checkout.session.expired") {
    // Session expired without being paid (customer abandoned checkout).
    const session = event.data.object as Stripe.Checkout.Session
    console.log("Webhook: checkout.session.expired", { sessionId: session.id })
    if (session.id) {
      const { error } = await sb
        .from("checkout_sessions")
        .update({ status: "expired", updated_at: new Date().toISOString() })
        .eq("id", session.id)
      if (error) console.error("Webhook: could not mark checkout session expired", error.message)
    }
  }

  if (event.type === "charge.refunded") {
    const charge = event.data.object as Stripe.Charge
    // Partial refunds are not a revocation event — only a full refund is.
    const fullyRefunded = charge.amount_refunded >= charge.amount
    console.error("Webhook: charge.refunded", {
      chargeId: charge.id,
      amount: charge.amount,
      amountRefunded: charge.amount_refunded,
      fullyRefunded,
    })
    if (fullyRefunded) {
      const paymentIntentId = expandId(charge.payment_intent)
      const { data, error } = await sb.rpc("revoke_subscription_from_refund", {
        p_payment_intent_id: paymentIntentId,
        p_checkout_session_id: null,
      })
      if (error) {
        // Returning 500 makes Stripe retry. The RPC is a pair of UPDATEs, so a
        // retry is safe and it is the only thing standing between a refunded
        // student and continued access.
        console.error("Webhook: revoke-after-refund failed, will retry", {
          chargeId: charge.id,
          error: error.message,
        })
        return NextResponse.json({ error: "Revoke after refund failed" }, { status: 500 })
      }
      console.error("Webhook: access revoked after full refund", { paymentIntentId, result: data })
    }
  }

  if (event.type === "charge.dispute.created") {
    // A dispute means the funds are being clawed back; cut access immediately.
    const dispute = event.data.object as Stripe.Dispute
    let paymentIntentId = expandId(dispute.payment_intent as string | { id: string } | null | undefined)

    // Older API versions only give us the charge id.
    if (!paymentIntentId && dispute.charge) {
      try {
        const charge = await stripe.charges.retrieve(
          typeof dispute.charge === "string" ? dispute.charge : dispute.charge.id,
        )
        paymentIntentId = expandId(charge.payment_intent)
      } catch (chargeErr) {
        console.error("Webhook: could not resolve dispute payment_intent", chargeErr)
      }
    }

    console.error("Webhook: DISPUTE created — revoking access", { disputeId: dispute.id, paymentIntentId })
    const { error } = await sb.rpc("revoke_subscription_from_refund", {
      p_payment_intent_id: paymentIntentId,
      p_checkout_session_id: null,
    })
    if (error) {
      // A dispute is funds being clawed back, so access must actually be cut.
      // 500 => Stripe retries until the revocation lands.
      console.error("Webhook: revoke-after-dispute failed, will retry", {
        disputeId: dispute.id,
        error: error.message,
      })
      return NextResponse.json({ error: "Revoke after dispute failed" }, { status: 500 })
    }
  }

  return NextResponse.json({ received: true })
}
