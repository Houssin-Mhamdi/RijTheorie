-- Add SECURITY DEFINER helper (bypasses RLS recursion)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
$$;

-- Drop recursive policies on lessons
DROP POLICY IF EXISTS "Admins can read all lessons" ON lessons;
DROP POLICY IF EXISTS "Admins can insert lessons" ON lessons;
DROP POLICY IF EXISTS "Admins can update lessons" ON lessons;
DROP POLICY IF EXISTS "Admins can delete lessons" ON lessons;

-- Recreate using is_admin() helper
CREATE POLICY "Admins can read all lessons" ON lessons FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can insert lessons" ON lessons FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update lessons" ON lessons FOR UPDATE USING (public.is_admin());
CREATE POLICY "Admins can delete lessons" ON lessons FOR DELETE USING (public.is_admin());

-- Drop recursive policy on profiles
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;

-- Recreate using is_admin() helper
CREATE POLICY "Admins can read all profiles" ON profiles FOR SELECT USING (public.is_admin());

-- Add missing UPDATE policy for exam_questions (needed for drag-reorder upsert)
DROP POLICY IF EXISTS "Admins can update exam_questions" ON exam_questions;
CREATE POLICY "Admins can update exam_questions" ON exam_questions FOR UPDATE USING (public.is_admin());

-- Allow admins to read all user_progress (for student overview stats)
DROP POLICY IF EXISTS "Admins can read all progress" ON user_progress;
CREATE POLICY "Admins can read all progress" ON user_progress FOR SELECT USING (public.is_admin());

-- Add last_active_at column for tracking student activity
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;

-- Replace public read on questions with admin-only RLS (students use RPCs instead)
DROP POLICY IF EXISTS "Anyone can read questions" ON questions;
DROP POLICY IF EXISTS "Admins can read questions" ON questions;
CREATE POLICY "Admins can read questions" ON questions FOR SELECT USING (public.is_admin());

-- RPC: Get exam questions with answer_options stripped of isCorrect (keeps hotspot x/y)
CREATE OR REPLACE FUNCTION public.get_exam_questions(p_exam_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT JSONB_AGG(
    JSONB_BUILD_OBJECT(
      'id', q.id,
      'category', q.category,
      'question_text', q.question_text,
      'media', q.media,
      'answer_options', (
        SELECT JSONB_AGG(ao - 'isCorrect')
        FROM JSONB_ARRAY_ELEMENTS(q.answer_options) AS ao
      ),
      'explanation', NULL,
      'translations', q.translations,
      'pause_at', q.pause_at
    )
    ORDER BY eq.sort_order
  )
  FROM public.questions q
  JOIN public.exam_questions eq ON eq.question_id = q.id
  WHERE eq.exam_id = p_exam_id
  INTO result;

  RETURN COALESCE(result, '[]'::JSONB);
END;
$$;

-- RPC: Check a multiple-choice / choose-images answer (returns correct_index and explanation)
CREATE OR REPLACE FUNCTION public.check_answer(
  p_question_id UUID,
  p_selected_index INT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  q_record RECORD;
  correct_idx INT := NULL;
  i INT;
BEGIN
  SELECT * INTO q_record FROM public.questions WHERE id = p_question_id;
  IF NOT FOUND THEN
    RETURN JSONB_BUILD_OBJECT('error', 'Question not found');
  END IF;

  FOR i IN 0..JSONB_ARRAY_LENGTH(q_record.answer_options) - 1
  LOOP
    IF (q_record.answer_options->i->>'isCorrect')::boolean THEN
      correct_idx := i;
      EXIT;
    END IF;
  END LOOP;

  RETURN JSONB_BUILD_OBJECT(
    'correct', (q_record.answer_options->p_selected_index->>'isCorrect')::boolean,
    'correct_index', correct_idx,
    'explanation', q_record.explanation
  );
END;
$$;

-- RPC: Check hotspot positions (returns per-circle correctness + distance)
CREATE OR REPLACE FUNCTION public.check_hotspot(
  p_question_id UUID,
  p_positions JSONB
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  q_record RECORD;
  results_arr JSONB := '[]'::JSONB;
  correct_x NUMERIC;
  correct_y NUMERIC;
  submitted_x NUMERIC;
  submitted_y NUMERIC;
  dist NUMERIC;
  i INT;
BEGIN
  SELECT * INTO q_record FROM public.questions WHERE id = p_question_id;
  IF NOT FOUND THEN
    RETURN JSONB_BUILD_OBJECT('error', 'Question not found');
  END IF;

  FOR i IN 0..JSONB_ARRAY_LENGTH(p_positions) - 1
  LOOP
    BEGIN
      correct_x := NULLIF((q_record.answer_options->i->>'x')::NUMERIC, NULL);
      correct_y := NULLIF((q_record.answer_options->i->>'y')::NUMERIC, NULL);
      submitted_x := (p_positions->i->>'x')::NUMERIC;
      submitted_y := (p_positions->i->>'y')::NUMERIC;

      IF correct_x IS NULL OR correct_y IS NULL THEN
        results_arr := results_arr || JSONB_BUILD_OBJECT('index', i, 'correct', false, 'distance', NULL);
      ELSE
        dist := SQRT((submitted_x - correct_x) * (submitted_x - correct_x) + (submitted_y - correct_y) * (submitted_y - correct_y));
        results_arr := results_arr || JSONB_BUILD_OBJECT('index', i, 'correct', dist <= 8, 'distance', ROUND(dist));
      END IF;
    EXCEPTION WHEN OTHERS THEN
      results_arr := results_arr || JSONB_BUILD_OBJECT('index', i, 'correct', false, 'distance', NULL);
    END;
  END LOOP;

  RETURN JSONB_BUILD_OBJECT(
    'results', results_arr,
    'explanation', q_record.explanation
  );
END;
$$;

-- 13. AVATAR & SITE SETTINGS

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url text;

CREATE TABLE IF NOT EXISTS public.site_settings (
  id bigint PRIMARY KEY DEFAULT 1,
  site_name text NOT NULL DEFAULT 'RijTheorie Pro',
  site_logo_url text,
  languages JSONB DEFAULT '["nl"]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO public.site_settings (id, site_name)
VALUES (1, 'RijTheorie Pro')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read site_settings" ON site_settings;
CREATE POLICY "Anyone can read site_settings"
  ON public.site_settings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Only admins can update site_settings" ON site_settings;
CREATE POLICY "Only admins can update site_settings"
  ON public.site_settings FOR UPDATE
  USING (public.is_admin());

-- 14. EXAM ATTEMPTS TABLE
CREATE TABLE IF NOT EXISTS public.exam_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE NOT NULL,
  attempt_number INTEGER NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  score INTEGER,
  total_questions INTEGER,
  passed BOOLEAN,
  category_scores JSONB
);

ALTER TABLE public.exam_attempts ADD COLUMN IF NOT EXISTS category_scores jsonb;

ALTER TABLE public.exam_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own attempts" ON exam_attempts;
CREATE POLICY "Users can read own attempts"
  ON public.exam_attempts FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own attempts" ON exam_attempts;
CREATE POLICY "Users can insert own attempts"
  ON public.exam_attempts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own attempts" ON exam_attempts;
CREATE POLICY "Users can update own attempts"
  ON public.exam_attempts FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can read all attempts" ON exam_attempts;
CREATE POLICY "Admins can read all attempts"
  ON public.exam_attempts FOR SELECT
  USING (public.is_admin());

-- RPC: Finish exam attempt (updates score + category_scores)
CREATE OR REPLACE FUNCTION public.finish_exam_attempt(
  p_attempt_id UUID,
  p_score INTEGER,
  p_total_questions INTEGER,
  p_passed BOOLEAN,
  p_category_scores JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.exam_attempts
  SET
    score = p_score,
    total_questions = p_total_questions,
    passed = p_passed,
    category_scores = p_category_scores,
    completed_at = NOW()
  WHERE id = p_attempt_id;
END;
$$;

-- RPC: Get all exam attempts with full data (for stats)
DROP FUNCTION IF EXISTS public.get_exam_stats_full();
CREATE OR REPLACE FUNCTION public.get_exam_stats_full()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT JSONB_AGG(
    JSONB_BUILD_OBJECT(
      'id', ea.id,
      'exam_id', ea.exam_id,
      'score', ea.score,
      'total_questions', ea.total_questions,
      'passed', ea.passed,
      'started_at', ea.started_at,
      'completed_at', ea.completed_at,
      'category_scores', ea.category_scores
    )
    ORDER BY ea.started_at DESC
  )
  FROM public.exam_attempts ea
  WHERE (public.is_admin() OR ea.user_id = auth.uid())
  INTO result;

  RETURN COALESCE(result, '[]'::JSONB);
END;
$$;

-- Run in Supabase SQL editor for avatars bucket:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);
--
-- CREATE POLICY "Anyone can read avatars"
--   ON storage.objects FOR SELECT
--   USING (bucket_id = 'avatars');
--
-- CREATE POLICY "Authenticated users can upload avatars"
--   ON storage.objects FOR INSERT
--   WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');
--
-- CREATE POLICY "Users can update own avatars"
--   ON storage.objects FOR UPDATE
--   USING (bucket_id = 'avatars' AND owner = auth.uid());
--
-- CREATE POLICY "Users can delete own avatars"
--   ON storage.objects FOR DELETE
--   USING (bucket_id = 'avatars' AND (owner = auth.uid() OR public.is_admin()));

-- RPC: Update last_active_at (SECURITY DEFINER — bypasses RLS)
CREATE OR REPLACE FUNCTION public.update_last_active_at()
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.profiles
  SET last_active_at = NOW()
  WHERE id = auth.uid();
END;
$$;

-- Add columns to questions table
ALTER TABLE questions ADD COLUMN IF NOT EXISTS translations JSONB DEFAULT '{}'::jsonb;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS pause_at FLOAT DEFAULT 3.0;

-- Add language column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'nl';

-- Add languages column to site_settings
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS languages JSONB DEFAULT '["nl"]'::jsonb;

-- 18. SUBSCRIPTION PLANS TABLE
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  duration_days INTEGER NOT NULL DEFAULT 30,
  features JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active plans"
  ON public.subscription_plans FOR SELECT
  USING (true);

CREATE POLICY "Only admins can insert plans"
  ON public.subscription_plans FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Only admins can update plans"
  ON public.subscription_plans FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "Only admins can delete plans"
  ON public.subscription_plans FOR DELETE
  USING (public.is_admin());

-- 19. USER SUBSCRIPTIONS TABLE
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  plan_id UUID REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
  start_date TIMESTAMPTZ DEFAULT NOW(),
  end_date TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own subscriptions"
  ON public.user_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all subscriptions"
  ON public.user_subscriptions FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins can insert subscriptions"
  ON public.user_subscriptions FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update subscriptions"
  ON public.user_subscriptions FOR UPDATE
  USING (public.is_admin());

-- RPC for students to subscribe themselves (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION public.subscribe_to_plan(p_plan_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_plan public.subscription_plans;
  v_subscription public.user_subscriptions;
BEGIN
  -- Get the plan
  SELECT * INTO v_plan FROM public.subscription_plans WHERE id = p_plan_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Plan not found or inactive');
  END IF;

  -- Deactivate any existing active subscriptions for this user
  UPDATE public.user_subscriptions
  SET is_active = false
  WHERE user_id = auth.uid() AND is_active = true;

  -- Insert new subscription
  INSERT INTO public.user_subscriptions (user_id, plan_id, start_date, end_date, is_active)
  VALUES (auth.uid(), p_plan_id, NOW(), NOW() + (v_plan.duration_days || ' days')::INTERVAL, true)
  RETURNING * INTO v_subscription;

  RETURN jsonb_build_object(
    'id', v_subscription.id,
    'plan_id', v_subscription.plan_id,
    'end_date', v_subscription.end_date,
    'is_active', v_subscription.is_active
  );
END;
$$;

-- Seed 3 default subscription plans
INSERT INTO public.subscription_plans (name, description, price, duration_days, features)
VALUES
  ('1 maand', 'Toegang tot alle oefenexamens voor 1 maand', 9.99, 30, '["Alle examens", "Onbeperkt oefenen", "Resultaten bekijken"]'),
  ('3 maanden', 'Toegang tot alle oefenexamens voor 3 maanden', 19.99, 90, '["Alle examens", "Onbeperkt oefenen", "Resultaten bekijken", "Voortgangsstatistieken"]'),
  ('6 maanden', 'Toegang tot alle oefenexamens voor 6 maanden', 29.99, 180, '["Alle examens", "Onbeperkt oefenen", "Resultaten bekijken", "Voortgangsstatistieken", "Prioriteit ondersteuning"]')
ON CONFLICT DO NOTHING;

-- Payment settings column on site_settings
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS payment_settings JSONB DEFAULT '{}'::jsonb;

-- Payouts table
CREATE TABLE IF NOT EXISTS public.payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read payouts"
  ON public.payouts FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins can insert payouts"
  ON public.payouts FOR INSERT
  WITH CHECK (public.is_admin());

-- 23. CAN ACCESS EXAM RPC (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.can_access_exam(p_exam_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_is_free BOOLEAN;
  v_has_sub BOOLEAN;
BEGIN
  SELECT is_free INTO v_is_free FROM public.exams WHERE id = p_exam_id;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_is_free THEN RETURN true; END IF;
  IF public.is_admin() THEN RETURN true; END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.user_subscriptions
    WHERE user_id = auth.uid() AND is_active = true AND end_date > NOW()
  ) INTO v_has_sub;
  RETURN v_has_sub;
END;
$$;
