  -- ============================================================
  -- ATTEMPT-GATE FIX
  -- Run this in the Supabase SQL editor for the project the app uses
  -- (pxpxowhuvfbuxhgbnzdx.supabase.co).
  --
  -- Fixes a bug in can_attempt_exam + get_exam_attempt_status:
  -- the "last purchase" timestamp was taken over ALL subscriptions
  -- (MAX(start_date) with no filter), so:
  --   1. Expired / cancelled subscriptions still reset the counter,
  --      leaving leftover attempts redeemable for free forever.
  --   2. A user who never subscribed fell back to '-infinity',
  --      counting every past attempt and locking them out of exams
  --      they had never paid for.
  --
  -- Now only a VALID subscription (is_active AND not yet expired)
  -- resets the counter. Everything else keeps the conservative
  -- '-infinity' fallback, so access is gated until a real, current
  -- purchase exists.
  -- ============================================================

  -- ---- can_attempt_exam ----
  CREATE OR REPLACE FUNCTION public.can_attempt_exam(p_exam_id UUID)
  RETURNS JSONB
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = ''
  AS $$
  DECLARE
    v_max_attempts INTEGER;
    v_last_purchase TIMESTAMPTZ;
    v_used INTEGER;
    v_remaining INTEGER;
  BEGIN
    SELECT max_attempts INTO v_max_attempts FROM public.exams WHERE id = p_exam_id;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'not_found');
    END IF;

    IF public.is_admin() THEN
      RETURN jsonb_build_object('allowed', true, 'remaining_attempts', NULL, 'max_attempts', v_max_attempts);
    END IF;

    IF v_max_attempts IS NULL THEN
      RETURN jsonb_build_object('allowed', true, 'remaining_attempts', NULL, 'max_attempts', NULL);
    END IF;

    SELECT COALESCE(MAX(start_date), '-infinity'::timestamptz)
    INTO v_last_purchase
    FROM public.user_subscriptions
    WHERE user_id = auth.uid()
      AND is_active
      AND end_date >= NOW();

    SELECT COUNT(*) INTO v_used
    FROM public.exam_attempts
    WHERE user_id = auth.uid()
      AND exam_id = p_exam_id
      AND started_at >= v_last_purchase;

    v_remaining := v_max_attempts - v_used;
    IF v_remaining <= 0 THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'limit_reached',
        'remaining_attempts', 0,
        'max_attempts', v_max_attempts
      );
    END IF;

    RETURN jsonb_build_object('allowed', true, 'remaining_attempts', v_remaining, 'max_attempts', v_max_attempts);
  END;
  $$;

  -- ---- get_exam_attempt_status ----
  CREATE OR REPLACE FUNCTION public.get_exam_attempt_status(p_exam_ids UUID[])
  RETURNS TABLE (
    exam_id UUID,
    max_attempts INTEGER,
    used_attempts INTEGER,
    remaining_attempts INTEGER,
    is_locked BOOLEAN
  )
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = ''
  AS $$
  DECLARE
    v_last_purchase TIMESTAMPTZ;
    v_exam_id UUID;
    v_max INTEGER;
    v_used INTEGER;
  BEGIN
    SELECT COALESCE(MAX(start_date), '-infinity'::timestamptz)
    INTO v_last_purchase
    FROM public.user_subscriptions
    WHERE user_id = auth.uid()
      AND is_active
      AND end_date >= NOW();

    FOREACH v_exam_id IN ARRAY p_exam_ids
    LOOP
      IF public.is_admin() THEN
        exam_id := v_exam_id;
        max_attempts := NULL;
        used_attempts := NULL;
        remaining_attempts := NULL;
        is_locked := false;
        RETURN NEXT;
        CONTINUE;
      END IF;

      SELECT public.exams.max_attempts INTO v_max FROM public.exams WHERE id = v_exam_id;

      IF v_max IS NULL THEN
        exam_id := v_exam_id;
        max_attempts := NULL;
        used_attempts := NULL;
        remaining_attempts := NULL;
        is_locked := false;
        RETURN NEXT;
        CONTINUE;
      END IF;

      SELECT COUNT(*) INTO v_used
      FROM public.exam_attempts
      WHERE user_id = auth.uid() AND public.exam_attempts.exam_id = v_exam_id AND started_at >= v_last_purchase;

      exam_id := v_exam_id;
      max_attempts := v_max;
      used_attempts := v_used;
      remaining_attempts := GREATEST(v_max - v_used, 0);
      is_locked := (v_max - v_used) <= 0;
      RETURN NEXT;
    END LOOP;
    RETURN;
  END;
  $$;

  -- ---- Grants (idempotent) ----
  REVOKE EXECUTE ON FUNCTION public.get_exam_attempt_status(UUID[]) FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION public.get_exam_attempt_status(UUID[]) TO authenticated;

  REVOKE EXECUTE ON FUNCTION public.can_attempt_exam(UUID) FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION public.can_attempt_exam(UUID) TO authenticated;