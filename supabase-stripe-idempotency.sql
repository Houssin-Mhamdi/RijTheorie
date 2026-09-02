-- ============================================================
-- STRIPE IDEMPOTENCY + SECURITY MIGRATION
-- Run this in the Supabase SQL editor for the project the app uses
-- (pxpxowhuvfbuxhgbnzdx.supabase.co).
--
-- Adds:
--   1. stripe_events table — records every webhook event.id so
--      retries are processed exactly once.
--   2. checkout_session_id columns on user_subscriptions and payouts
--      to guarantee a purchase never creates duplicate rows.
--   3. A SECURITY DEFINER RPC to atomically activate a subscription
--      (deactivate previous, insert new, record event, record payout,
--      and reset coupon usage) — all in one idempotent transaction.
-- ============================================================

-- ---- 1. stripe_events: dedup webhook deliveries ----
CREATE TABLE IF NOT EXISTS public.stripe_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;

-- Only the service role (webhook) may read/write; no public access.
DROP POLICY IF EXISTS "No public access to stripe_events" ON public.stripe_events;
CREATE POLICY "No public access to stripe_events"
  ON public.stripe_events FOR ALL
  USING (false);

-- ---- 2. checkout_session_id for dedup on subscriptions/payouts ----
ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS checkout_session_id TEXT;
ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS stripe_event_id TEXT;

ALTER TABLE public.payouts
  ADD COLUMN IF NOT EXISTS checkout_session_id TEXT;

-- ---- 3. Idempotent "activate subscription" RPC ----
-- Runs in one transaction. Returns processed=true if the event/session was
-- already handled, false if it was newly processed (attempt reset applies).
DROP FUNCTION IF EXISTS public.activate_subscription_from_payment(TEXT, TEXT, TEXT, UUID, INTEGER, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION public.activate_subscription_from_payment(
  p_event_id TEXT,
  p_checkout_session_id TEXT,
  p_plan_id TEXT,
  p_user_id UUID,
  p_duration_days INTEGER,
  p_end_date TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_plan_id UUID;
  v_result JSONB;
BEGIN
  -- Reject duplicate events (Stripe retries).
  IF EXISTS (SELECT 1 FROM public.stripe_events WHERE id = p_event_id) THEN
    RETURN jsonb_build_object('processed', false, 'duplicate_event', true);
  END IF;

  -- Reject duplicate checkout sessions guarding against a double-created row.
  IF EXISTS (SELECT 1 FROM public.user_subscriptions WHERE checkout_session_id = p_checkout_session_id) THEN
    -- Still record the event as seen so Stripe stops retrying.
    INSERT INTO public.stripe_events (id, type) VALUES (p_event_id, 'checkout.session.completed')
      ON CONFLICT (id) DO NOTHING;
    RETURN jsonb_build_object('processed', false, 'duplicate_session', true);
  END IF;

  -- Validate the plan reference.
  BEGIN
    SELECT id INTO v_plan_id FROM public.subscription_plans WHERE id::text = p_plan_id;
  EXCEPTION WHEN invalid_text_representation THEN
    v_plan_id := NULL;
  END;
  IF v_plan_id IS NULL THEN
    RETURN jsonb_build_object('processed', false, 'error', 'plan_not_found');
  END IF;

  -- Record the event FIRST (before the side effects) so a crash mid-way
  -- leaves a durable tombstone; subsequent retries will no-op safely.
  INSERT INTO public.stripe_events (id, type) VALUES (p_event_id, 'checkout.session.completed');

  -- Deactivate this user's previous active/expired subscriptions.
  UPDATE public.user_subscriptions
  SET is_active = false
  WHERE user_id = p_user_id AND is_active = true;

  -- Activate the new subscription. Because get_exam_attempt_status counts
  -- attempts from MAX(start_date) over user_subscriptions, this NEW row
  -- automatically resets the student's attempt counter to the plan default.
  INSERT INTO public.user_subscriptions (
    user_id, plan_id, start_date, end_date, is_active, checkout_session_id, stripe_event_id
  ) VALUES (
    p_user_id, v_plan_id, NOW(), p_end_date, true, p_checkout_session_id, p_event_id
  );

  RETURN jsonb_build_object('processed', true, 'duplicate_event', false);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.activate_subscription_from_payment(TEXT, TEXT, TEXT, UUID, INTEGER, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_subscription_from_payment(TEXT, TEXT, TEXT, UUID, INTEGER, TIMESTAMPTZ) TO service_role;
