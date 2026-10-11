-- ============================================================
-- STRIPE PAYMENT HARDENING
-- Run this ONCE in the Supabase SQL editor (project
-- pxpxowhuvfbuxhgbnzdx.supabase.co).
--
-- Run order:
--   1. supabase-stripe-idempotency.sql
--   2. supabase-stripe-payment-status.sql
--   3. THIS FILE
--
-- Fixes implemented here:
--   1. checkout_sessions gains plan_id / url / amount_cents / coupon_id so a
--      failed payment is diagnosable and so an open session can be reused
--      instead of creating a second one.
--   2. 'refunded' added to the checkout_sessions status CHECK.
--   3. user_subscriptions.payment_intent_id so a refund or dispute can
--      be matched back to the subscription it paid for.
--   4. settle_paid_checkout_session() replaces
--      activate_subscription_from_payment with an ALL-IN-ONE settlement:
--      event tombstone + coupon redemption + subscription insert + status
--      flip in a single transaction, so a crash can no longer leave a paid
--      student without access or with an unconsumed coupon. It verifies the
--      amount Stripe actually collected (anti-tamper), requires the plan to
--      still be is_active, and never SHORTENS a student's existing access.
--   5. The coupon's max_uses / is_active / per-user checks moved INSIDE that
--      transaction, so concurrent sessions can no longer overshoot the cap.
--   6. user_subscriptions_checkout_session_uniq: a UNIQUE index so "one
--      purchase = one subscription" is enforced by the database, not by a
--      racy IF EXISTS test. Duplicates are de-duplicated before the index is
--      created.
--   7. revoke_subscription_from_refund() disables access on refund/dispute.
--   8. expire_stale_subscriptions() + optional pg_cron job so is_active
--      actually flips to false when end_date passes.
-- ============================================================

-- ------------------------------------------------------------
-- 1. checkout_sessions: self-sufficient definition + new columns
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.checkout_sessions (
  id TEXT PRIMARY KEY,          -- Stripe Checkout Session ID (cs_test_...)
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'succeeded', 'failed', 'expired', 'refunded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Added columns (no-ops if the payment-status migration already ran).
ALTER TABLE public.checkout_sessions ADD COLUMN IF NOT EXISTS plan_id TEXT;
ALTER TABLE public.checkout_sessions ADD COLUMN IF NOT EXISTS url TEXT;
ALTER TABLE public.checkout_sessions ADD COLUMN IF NOT EXISTS amount_cents INTEGER;
ALTER TABLE public.checkout_sessions ADD COLUMN IF NOT EXISTS coupon_id TEXT;

-- Widen the status CHECK to include 'refunded'.
ALTER TABLE public.checkout_sessions DROP CONSTRAINT IF EXISTS checkout_sessions_status_check;
ALTER TABLE public.checkout_sessions ADD CONSTRAINT checkout_sessions_status_check
  CHECK (status IN ('pending', 'succeeded', 'failed', 'expired', 'refunded'));

CREATE INDEX IF NOT EXISTS checkout_sessions_user_id_idx
  ON public.checkout_sessions (user_id);

-- Partial index for the "reuse a recent open session" lookup.
CREATE INDEX IF NOT EXISTS checkout_sessions_pending_idx
  ON public.checkout_sessions (user_id, plan_id, created_at DESC)
  WHERE status = 'pending';

ALTER TABLE public.checkout_sessions ENABLE ROW LEVEL SECURITY;

-- Deny-by-default: RLS with no permissive policy blocks anon/authenticated.
-- The service role bypasses RLS entirely, so it can still read/write.
-- (These two policies are kept only for documentation; the service role does
-- not rely on them.)
DROP POLICY IF EXISTS "Service role manages checkout_sessions" ON public.checkout_sessions;

DROP POLICY IF EXISTS "Users read own checkout sessions" ON public.checkout_sessions;
CREATE POLICY "Users read own checkout sessions"
  ON public.checkout_sessions FOR SELECT
  USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 2. user_subscriptions.payment_intent_id (refund/dispute matching)
-- ------------------------------------------------------------
ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS payment_intent_id TEXT;

CREATE INDEX IF NOT EXISTS user_subscriptions_payment_intent_idx
  ON public.user_subscriptions (payment_intent_id)
  WHERE payment_intent_id IS NOT NULL;

-- One purchase = one subscription, enforced by the DATABASE and not just by an
-- IF EXISTS check inside the RPC. The RPC's EXISTS test is racy on its own: two
-- concurrent deliveries with DIFFERENT event ids for the same Checkout Session
-- both pass it and both insert. This unique index makes the second one fail.
--
-- De-duplicate first so the index can be created on a database that already
-- contains a double activation. The survivor is chosen with
--   is_active DESC  -> never drop the row that still grants access
--   end_date  DESC  -> then prefer the longer entitlement
--   start_date ASC, ctid -> deterministic tie-break
-- On a healthy database this matches 0 rows and changes nothing.
DELETE FROM public.user_subscriptions a
USING public.user_subscriptions b
WHERE a.checkout_session_id IS NOT NULL
  AND a.checkout_session_id = b.checkout_session_id
  AND (NOT COALESCE(a.is_active, false), a.end_date, a.start_date, a.ctid)
    < (NOT COALESCE(b.is_active, false), b.end_date, b.start_date, b.ctid);

CREATE UNIQUE INDEX IF NOT EXISTS user_subscriptions_checkout_session_uniq
  ON public.user_subscriptions (checkout_session_id)
  WHERE checkout_session_id IS NOT NULL;

-- ------------------------------------------------------------
-- 3. settle_paid_checkout_session (hardened, ALL-IN-ONE)
--
--    This replaces activate_subscription_from_payment. It performs the WHOLE
--    settlement — event tombstone, coupon redemption, subscription insert and
--    the checkout_sessions status flip — inside ONE transaction.
--
--    Why that matters: the previous version activated the subscription in one
--    RPC call and then did the coupon redemption + status update as separate
--    calls from the webhook. A crash (or a transient DB error) between those
--    steps left the event marked as processed, so Stripe's retry was skipped
--    and the coupon was never consumed / the status never flipped. Anything
--    partial is now impossible: either all of it is committed or none of it.
--
--    The event tombstone is deliberately DELETED on every error path. That
--    makes a failed settlement retryable, which is what lets the webhook
--    return 500 and retry the revocation. A permanent error (bad amount,
--    missing plan) still settles on the first attempt because the webhook
--    refunds + revokes and then returns 200, so there is no retry storm.
--
--    Note: p_end_date was REMOVED. The end date is derived here from
--    p_duration_days so entitlement logic cannot be influenced by the client.
-- ------------------------------------------------------------
DROP FUNCTION IF EXISTS public.activate_subscription_from_payment(TEXT, TEXT, TEXT, UUID, INTEGER, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.activate_subscription_from_payment(TEXT, TEXT, TEXT, UUID, INTEGER, TIMESTAMPTZ, INTEGER, UUID, TEXT);
DROP FUNCTION IF EXISTS public.settle_paid_checkout_session(TEXT, TEXT, TEXT, UUID, INTEGER, INTEGER, UUID, TEXT);

CREATE OR REPLACE FUNCTION public.settle_paid_checkout_session(
  p_event_id TEXT,
  p_checkout_session_id TEXT,
  p_plan_id TEXT,
  p_user_id UUID,
  p_duration_days INTEGER,
  p_amount_cents INTEGER,
  p_coupon_id UUID,
  p_payment_intent_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_plan_id UUID;
  v_plan_active BOOLEAN;
  v_price NUMERIC;
  v_expected INTEGER;
  v_new_end TIMESTAMPTZ;
  v_end TIMESTAMPTZ;
  v_discount INTEGER;
  v_max_uses INTEGER;
  v_used_count INTEGER;
  v_coupon_active BOOLEAN;
BEGIN
  IF p_event_id IS NULL OR p_checkout_session_id IS NULL OR p_user_id IS NULL THEN
    RETURN jsonb_build_object('processed', false, 'error', 'missing_identifiers', 'refund', true);
  END IF;

  -- 1. Atomic event tombstone. ON CONFLICT is what makes deduplication safe
  --    under concurrency: two deliveries of the SAME event cannot both proceed.
  INSERT INTO public.stripe_events (id, type)
  VALUES (p_event_id, 'checkout.session.paid')
    ON CONFLICT (id) DO NOTHING;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('processed', false, 'duplicate_event', true);
  END IF;

  -- 2. The buyer must be a real auth user (user_subscriptions.user_id is an FK).
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    DELETE FROM public.stripe_events WHERE id = p_event_id;
    RETURN jsonb_build_object('processed', false, 'error', 'user_not_found', 'refund', true);
  END IF;

  -- 3. One purchase = one subscription.
  IF EXISTS (
    SELECT 1 FROM public.user_subscriptions
    WHERE checkout_session_id = p_checkout_session_id
  ) THEN
    -- Already settled (a retry, or a second event for the same session). Repair
    -- the status in case an older version crashed before writing it, then stop.
    UPDATE public.checkout_sessions
    SET status = 'succeeded', updated_at = NOW()
    WHERE id = p_checkout_session_id;
    RETURN jsonb_build_object('processed', false, 'duplicate_session', true);
  END IF;

  -- 4. The plan must exist AND still be purchasable.
  BEGIN
    SELECT id, price, is_active INTO v_plan_id, v_price, v_plan_active
    FROM public.subscription_plans
    WHERE id::text = p_plan_id;
  EXCEPTION WHEN invalid_text_representation THEN
    v_plan_id := NULL;
  END;
  IF v_plan_id IS NULL THEN
    DELETE FROM public.stripe_events WHERE id = p_event_id;
    RETURN jsonb_build_object('processed', false, 'error', 'plan_not_found', 'refund', true);
  END IF;
  IF NOT COALESCE(v_plan_active, false) THEN
    DELETE FROM public.stripe_events WHERE id = p_event_id;
    RETURN jsonb_build_object('processed', false, 'error', 'plan_inactive', 'refund', true);
  END IF;

  -- 5. Coupon validation AND redemption happen here, in the same transaction as
  --    the subscription insert. expires_at is intentionally NOT re-checked: a
  --    session created while the coupon was valid is honoured even if it settles
  --    minutes later.
  IF p_coupon_id IS NOT NULL THEN
    -- Row lock serialises concurrent redemptions of the same coupon, so two
    -- students racing for the last remaining use cannot both win.
    SELECT max_uses, used_count, is_active, discount_percent
    INTO v_max_uses, v_used_count, v_coupon_active, v_discount
    FROM public.coupon_codes
    WHERE id = p_coupon_id
    FOR UPDATE;

    IF NOT FOUND THEN
      DELETE FROM public.stripe_events WHERE id = p_event_id;
      RETURN jsonb_build_object('processed', false, 'error', 'coupon_not_found', 'refund', true);
    END IF;
    IF NOT COALESCE(v_coupon_active, false) THEN
      DELETE FROM public.stripe_events WHERE id = p_event_id;
      RETURN jsonb_build_object('processed', false, 'error', 'coupon_inactive', 'refund', true);
    END IF;
    IF v_max_uses IS NOT NULL AND COALESCE(v_used_count, 0) >= v_max_uses THEN
      DELETE FROM public.stripe_events WHERE id = p_event_id;
      RETURN jsonb_build_object('processed', false, 'error', 'coupon_limit_reached', 'refund', true);
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.coupon_redemptions
      WHERE coupon_id = p_coupon_id AND user_id = p_user_id
    ) THEN
      DELETE FROM public.stripe_events WHERE id = p_event_id;
      RETURN jsonb_build_object('processed', false, 'error', 'coupon_already_used', 'refund', true);
    END IF;
  END IF;

  -- 6. Anti-tamper: recompute the expected price from the DB and compare it with
  --    what Stripe actually collected.
  --    NOTE the ::numeric casts: without them `int * int / 100` is INTEGER
  --    division and truncates (999 * 50 / 100 -> 499) whereas the app uses
  --    Math.round(999 * 0.5) -> 500. ROUND(numeric) rounds half away from zero,
  --    matching Math.round. The <= 1 cent tolerance absorbs float noise.
  v_expected := ROUND(v_price::numeric * 100);
  IF v_expected IS NULL OR v_expected <= 0 THEN
    DELETE FROM public.stripe_events WHERE id = p_event_id;
    RETURN jsonb_build_object('processed', false, 'error', 'plan_price_invalid', 'refund', true);
  END IF;
  IF p_coupon_id IS NOT NULL THEN
    v_discount := LEAST(GREATEST(COALESCE(v_discount, 0), 0), 99);
    v_expected := ROUND(v_expected::numeric * (100 - v_discount) / 100);
  END IF;

  IF p_amount_cents IS NULL THEN
    DELETE FROM public.stripe_events WHERE id = p_event_id;
    RETURN jsonb_build_object('processed', false, 'error', 'amount_missing', 'refund', true);
  END IF;
  IF ABS(p_amount_cents - v_expected) > 1 THEN
    DELETE FROM public.stripe_events WHERE id = p_event_id;
    RETURN jsonb_build_object(
      'processed', false,
      'error', 'amount_mismatch',
      'expected_cents', v_expected,
      'received_cents', p_amount_cents,
      'refund', true
    );
  END IF;

  -- 7. Duration is validated here; p_end_date no longer exists, so the end date
  --    is always derived from the plan and cannot be influenced by the client.
  IF p_duration_days IS NULL OR p_duration_days <= 0 THEN
    DELETE FROM public.stripe_events WHERE id = p_event_id;
    RETURN jsonb_build_object('processed', false, 'error', 'invalid_duration', 'refund', true);
  END IF;
  v_new_end := NOW() + make_interval(days => p_duration_days);

  -- 8. Commit the coupon redemption (still the same transaction).
  IF p_coupon_id IS NOT NULL THEN
    INSERT INTO public.coupon_redemptions (coupon_id, user_id)
    VALUES (p_coupon_id, p_user_id)
    ON CONFLICT (coupon_id, user_id) DO NOTHING;
    IF NOT FOUND THEN
      DELETE FROM public.stripe_events WHERE id = p_event_id;
      RETURN jsonb_build_object('processed', false, 'error', 'coupon_already_used', 'refund', true);
    END IF;

    UPDATE public.coupon_codes
    SET used_count = COALESCE(used_count, 0) + 1
    WHERE id = p_coupon_id;
  END IF;

  -- 9. Deactivate previous subscriptions, but never remove access that already
  --    outlives the purchase being processed (e.g. someone holding a 6-month
  --    plan taps "1 month" by accident).
  UPDATE public.user_subscriptions
  SET is_active = false
  WHERE user_id = p_user_id
    AND is_active = true
    AND end_date <= v_new_end;

  -- Effective end = the later of the new purchase and any surviving sub.
  SELECT COALESCE(MAX(end_date), v_new_end) INTO v_end
  FROM public.user_subscriptions
  WHERE user_id = p_user_id AND is_active = true;

  -- 10. Insert the subscription. The unique index on checkout_session_id is the
  --     real guard; the handler turns a collision into a clean duplicate.
  BEGIN
    INSERT INTO public.user_subscriptions (
      user_id, plan_id, start_date, end_date, is_active,
      checkout_session_id, stripe_event_id, payment_intent_id
    ) VALUES (
      p_user_id, v_plan_id, NOW(), GREATEST(v_end, v_new_end), true,
      p_checkout_session_id, p_event_id, p_payment_intent_id
    );
  EXCEPTION WHEN unique_violation THEN
    DELETE FROM public.stripe_events WHERE id = p_event_id;
    RETURN jsonb_build_object('processed', false, 'duplicate_session', true);
  END;

  -- 11. Flip the tracked session to succeeded in the SAME transaction, so the
  --     student's client can never see "pending" for a paid purchase.
  UPDATE public.checkout_sessions
  SET status = 'succeeded', updated_at = NOW()
  WHERE id = p_checkout_session_id;

  RETURN jsonb_build_object('processed', true, 'refund', false);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.settle_paid_checkout_session(TEXT, TEXT, TEXT, UUID, INTEGER, INTEGER, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_paid_checkout_session(TEXT, TEXT, TEXT, UUID, INTEGER, INTEGER, UUID, TEXT) TO service_role;

-- ------------------------------------------------------------
-- 4. redeem_coupon: atomic max_uses enforcement
--    SUPERSEDED — kept only for backward compatibility.
--    Its logic now lives INSIDE settle_paid_checkout_session, so the coupon
--    redemption and the subscription insert commit together in one
--    transaction. The webhook no longer calls this function; do not call it
--    from new code, or a coupon can be consumed without a matching
--    subscription.
--
--    expires_at is intentionally NOT re-checked: a session created while
--    the coupon was valid is honoured even if it settles minutes later.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.redeem_coupon(
  p_coupon_id UUID,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_max_uses INTEGER;
  v_used_count INTEGER;
  v_is_active BOOLEAN;
BEGIN
  -- Row lock serialises concurrent redemptions of the same coupon.
  SELECT max_uses, used_count, is_active
  INTO v_max_uses, v_used_count, v_is_active
  FROM public.coupon_codes
  WHERE id = p_coupon_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF NOT COALESCE(v_is_active, false) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'inactive');
  END IF;
  IF v_max_uses IS NOT NULL AND COALESCE(v_used_count, 0) >= v_max_uses THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'limit_reached');
  END IF;

  INSERT INTO public.coupon_redemptions (coupon_id, user_id)
  VALUES (p_coupon_id, p_user_id)
  ON CONFLICT (coupon_id, user_id) DO NOTHING;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_used');
  END IF;

  UPDATE public.coupon_codes
  SET used_count = COALESCE(used_count, 0) + 1
  WHERE id = p_coupon_id;

  RETURN jsonb_build_object('ok', true, 'used_count', COALESCE(v_used_count, 0) + 1);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.redeem_coupon(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_coupon(UUID, UUID) TO service_role;

-- ------------------------------------------------------------
-- 5. revoke_subscription_from_refund
--    Disables the subscription paid for by a refunded / disputed charge.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.revoke_subscription_from_refund(
  p_payment_intent_id TEXT,
  p_checkout_session_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Mark the checkout session refunded FIRST, resolved through the
  -- subscription. A Dashboard refund only carries a payment_intent, so without
  -- this subquery the student's checkout_sessions row would stay 'succeeded'.
  UPDATE public.checkout_sessions
  SET status = 'refunded', updated_at = NOW()
  WHERE id IN (
    SELECT checkout_session_id
    FROM public.user_subscriptions
    WHERE checkout_session_id IS NOT NULL
      AND (
        (p_payment_intent_id IS NOT NULL AND payment_intent_id = p_payment_intent_id)
        OR (p_checkout_session_id IS NOT NULL AND checkout_session_id = p_checkout_session_id)
      )
  );

  IF p_checkout_session_id IS NOT NULL THEN
    UPDATE public.checkout_sessions
    SET status = 'refunded', updated_at = NOW()
    WHERE id = p_checkout_session_id;
  END IF;

  UPDATE public.user_subscriptions
  SET is_active = false
  WHERE (p_payment_intent_id IS NOT NULL AND payment_intent_id = p_payment_intent_id)
     OR (p_checkout_session_id IS NOT NULL AND checkout_session_id = p_checkout_session_id);

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN jsonb_build_object('ok', true, 'revoked', v_count);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.revoke_subscription_from_refund(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_subscription_from_refund(TEXT, TEXT) TO service_role;

-- ------------------------------------------------------------
-- 6. expire_stale_subscriptions: flip is_active once end_date passes.
--    Until now is_active stayed true forever, so admin dashboards and
--    stats reported expired students as active.
--    Call it from Supabase cron (see the block below) or any scheduler.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.expire_stale_subscriptions()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.user_subscriptions
  SET is_active = false
  WHERE is_active = true AND end_date <= NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.expire_stale_subscriptions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_stale_subscriptions() TO service_role;

-- Register the recurring job ONLY if pg_cron is enabled on the project
-- (enable it first in Database > Extensions if you want this).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- unschedule raises if the job does not exist yet, so swallow that.
    BEGIN
      PERFORM cron.unschedule('expire-stale-subscriptions');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    PERFORM cron.schedule(
      'expire-stale-subscriptions',
      '*/10 * * * *',
      'SELECT public.expire_stale_subscriptions()'
    );
  END IF;
END;
$$;
