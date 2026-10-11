-- ============================================================
-- STRIPE PAYMENT STATUS MIGRATION
-- Run this in the Supabase SQL editor for the project the app uses
-- (pxpxowhuvfbuxhgbnzdx.supabase.co).
--
-- Adds:
--   1. checkout_sessions table — tracks each Stripe Checkout Session's
--      status (pending / succeeded / failed / expired) so students can
--      see a clear result for asynchronous payments (iDEAL) instead of
--      an endless "activation pending" state.
--   2. Creates the row as `pending` when create-checkout builds a session.
--   3. The Stripe webhook upserts the final status. Only the service role
--      (webhook) may write; authenticated users may read their own rows.
-- ============================================================

-- ---- 1. checkout_sessions ----
CREATE TABLE IF NOT EXISTS public.checkout_sessions (
  id TEXT PRIMARY KEY,          -- Stripe Checkout Session ID (cs_test_...)
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'succeeded', 'failed', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS checkout_sessions_user_id_idx
  ON public.checkout_sessions (user_id);

ALTER TABLE public.checkout_sessions ENABLE ROW LEVEL SECURITY;

-- Only the service role (webhook / create-checkout server route) may write.
DROP POLICY IF EXISTS "Service role manages checkout_sessions" ON public.checkout_sessions;
CREATE POLICY "Service role manages checkout_sessions"
  ON public.checkout_sessions FOR ALL
  USING (false);

-- Any authenticated user may read their OWN payment status (needed by the
-- exam page to distinguish "your iDEAL failed" from "still processing").
DROP POLICY IF EXISTS "Users read own checkout sessions" ON public.checkout_sessions;
CREATE POLICY "Users read own checkout sessions"
  ON public.checkout_sessions FOR SELECT
  USING (auth.uid() = user_id);