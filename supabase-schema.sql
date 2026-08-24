-- ============================================
-- RijTheorie Pro - Supabase Schema
-- ============================================

-- 1. PROFILES TABLE (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('admin', 'student')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ,
  language TEXT DEFAULT 'nl',
  can_access_exams BOOLEAN DEFAULT true
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 0. HELPER FUNCTION (SECURITY DEFINER to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
$$;

-- RPC: get_profile_for_proxy — used by the proxy middleware to check user role
CREATE OR REPLACE FUNCTION public.get_profile_for_proxy(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT row_to_json(p) INTO result
  FROM (SELECT role, can_access_exams FROM public.profiles WHERE id = p_user_id) p;
  RETURN result;
END;
$$;

-- Everyone can read their own profile
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile (except role)
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Only admins can read all profiles (uses SECURITY DEFINER helper)
CREATE POLICY "Admins can read all profiles"
  ON profiles FOR SELECT
  USING (public.is_admin());

-- 2. AUTO-CREATE PROFILE ON SIGNUP
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)),
    'student'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. MAKE FIRST USER AN ADMIN (run AFTER registering yourself)
-- UPDATE profiles SET role = 'admin' WHERE email = 'your-email@example.com';

-- 4. LESSONS TABLE (theory topics)
CREATE TABLE lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  order_index INTEGER DEFAULT 0,
  published BOOLEAN DEFAULT false,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;

-- Anyone can read published lessons
CREATE POLICY "Anyone can read published lessons"
  ON lessons FOR SELECT
  USING (published = true);

-- Admins can read all lessons
CREATE POLICY "Admins can read all lessons"
  ON lessons FOR SELECT
  USING (public.is_admin());

-- Only admins can insert/update/delete lessons
CREATE POLICY "Admins can insert lessons"
  ON lessons FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update lessons"
  ON lessons FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "Admins can delete lessons"
  ON lessons FOR DELETE
  USING (public.is_admin());

-- 5. QUESTIONS TABLE (exam questions)
CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  question_text TEXT NOT NULL,
  pause_at FLOAT DEFAULT 3.0,
  media TEXT,
  answer_options JSONB NOT NULL DEFAULT '[]'::jsonb,
  explanation TEXT,
  translations JSONB DEFAULT '{}'::jsonb,
  audio_translations JSONB DEFAULT '{}'::jsonb,
  explanation_audio_translations JSONB DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

-- Only admins can read questions (students must use RPCs which strip isCorrect)
CREATE POLICY "Admins can read questions"
  ON questions FOR SELECT
  USING (public.is_admin());

-- Only admins can insert/update/delete questions
CREATE POLICY "Admins can insert questions"
  ON questions FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update questions"
  ON questions FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "Admins can delete questions"
  ON questions FOR DELETE
  USING (public.is_admin());

-- Add course_id to questions (run after creating courses table)
-- ALTER TABLE questions ADD COLUMN course_id UUID REFERENCES courses(id) ON DELETE SET NULL;

-- 6. COURSES TABLE (theorie cursussen)
CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  icon_name TEXT NOT NULL DEFAULT 'Car',
  student_count INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read courses"
  ON courses FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert courses"
  ON courses FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update courses"
  ON courses FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "Admins can delete courses"
  ON courses FOR DELETE
  USING (public.is_admin());

-- 7. QUESTION-COURSE ASSIGNMENTS (many-to-many)
CREATE TABLE question_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE NOT NULL,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(question_id, course_id)
);

ALTER TABLE question_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read question_courses"
  ON question_courses FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert question_courses"
  ON question_courses FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete question_courses"
  ON question_courses FOR DELETE
  USING (public.is_admin());

-- 8. EXAMS TABLE (an exam belongs to a course and contains questions)
CREATE TABLE exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  question_count INTEGER DEFAULT 0,
  is_free BOOLEAN DEFAULT false,
  duration_minutes INTEGER DEFAULT 45,
  pass_threshold INTEGER DEFAULT 80,
  pass_type TEXT DEFAULT 'percentage',
  pass_count INTEGER DEFAULT 0,
  max_attempts INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE exams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read exams"
  ON exams FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert exams"
  ON exams FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update exams"
  ON exams FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "Admins can delete exams"
  ON exams FOR DELETE
  USING (public.is_admin());

-- 9. EXAM QUESTIONS (many-to-many between exams and questions)
CREATE TABLE exam_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID REFERENCES exams(id) ON DELETE CASCADE NOT NULL,
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(exam_id, question_id)
);

ALTER TABLE exam_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read exam_questions"
  ON exam_questions FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert exam_questions"
  ON exam_questions FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete exam_questions"
  ON exam_questions FOR DELETE
  USING (public.is_admin());

-- 10. USER PROGRESS (tracks student progress)
CREATE TABLE user_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE NOT NULL,
  completed BOOLEAN DEFAULT false,
  score INTEGER,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, lesson_id)
);

ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;

-- Users can read/update their own progress
CREATE POLICY "Users can read own progress"
  ON user_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can upsert own progress"
  ON user_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own progress"
  ON user_progress FOR UPDATE
  USING (auth.uid() = user_id);

-- 11. STORAGE BUCKET FOR QUESTION MEDIA
-- Buckets must be created manually in the Supabase dashboard as Public.
-- SECURITY: only admins can upload/delete question media.

CREATE POLICY "Anyone can read question-media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'question-media');

CREATE POLICY "Admins can upload question-media"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'question-media' AND public.is_admin());

CREATE POLICY "Admins can delete question-media"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'question-media' AND public.is_admin());

-- 12. RPC FUNCTIONS (secure access to questions without exposing isCorrect)

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
      'audio_translations', q.audio_translations,
      'explanation_audio_translations', q.explanation_audio_translations,
      'pause_at', q.pause_at
    )
    ORDER BY eq.sort_order
  )
  FROM public.questions q
  JOIN exam_questions eq ON eq.question_id = q.id
  WHERE eq.exam_id = p_exam_id
  INTO result;

  RETURN COALESCE(result, '[]'::JSONB);
END;
$$;

-- RPC: Check a multiple-choice / choose-images answer
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

-- RPC: Check hotspot positions
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

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;

CREATE TABLE IF NOT EXISTS public.site_settings (
  id bigint PRIMARY KEY DEFAULT 1,
  site_name text NOT NULL DEFAULT 'RijTheorie Pro',
  site_logo_url text,
  languages JSONB DEFAULT '["nl"]'::jsonb,
  payment_settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO public.site_settings (id, site_name)
VALUES (1, 'RijTheorie Pro')
ON CONFLICT (id) DO NOTHING;

-- RLS for site_settings
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read site_settings"
  ON public.site_settings FOR SELECT
  USING (true);

CREATE POLICY "Only admins can update site_settings"
  ON public.site_settings FOR UPDATE
  USING (public.is_admin());

-- 14. EXAM ATTEMPTS TABLE (tracks how many times a student starts/completes an exam)
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

CREATE POLICY "Users can read own attempts"
  ON public.exam_attempts FOR SELECT
  USING (auth.uid() = user_id);

-- SECURITY: no INSERT/UPDATE policies for students on exam_attempts.
-- Attempts are created/updated server-side via API routes with the service role key,
-- preventing students from faking scores via direct table access.

CREATE POLICY "Admins can read all attempts"
  ON public.exam_attempts FOR SELECT
  USING (public.is_admin());

-- 15. RPC: Finish exam attempt (updates score + category_scores)
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

-- 16. RPC: Get all exam attempts with full data (for stats)
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

-- 17. RPC: Update last_active_at (SECURITY DEFINER — bypasses RLS)
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

-- SECURITY: subscribe_to_plan was REMOVED — it allowed students to self-subscribe
-- for free, bypassing Stripe payment. Subscriptions are ONLY created by the
-- Stripe webhook (server-side, using SUPABASE_SERVICE_ROLE_KEY).
DROP FUNCTION IF EXISTS public.subscribe_to_plan(UUID);

-- Seed 3 default subscription plans
INSERT INTO public.subscription_plans (name, description, price, duration_days, features)
VALUES
  ('1 maand', 'Toegang tot alle oefenexamens voor 1 maand', 9.99, 30, '["Alle examens", "Onbeperkt oefenen", "Resultaten bekijken"]'),
  ('3 maanden', 'Toegang tot alle oefenexamens voor 3 maanden', 19.99, 90, '["Alle examens", "Onbeperkt oefenen", "Resultaten bekijken", "Voortgangsstatistieken"]'),
  ('6 maanden', 'Toegang tot alle oefenexamens voor 6 maanden', 29.99, 180, '["Alle examens", "Onbeperkt oefenen", "Resultaten bekijken", "Voortgangsstatistieken", "Prioriteit ondersteuning"]')
ON CONFLICT DO NOTHING;

-- Payouts table for revenue payouts to admin
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

-- AVATARS BUCKET: create manually in dashboard as Public.
-- SECURITY: users can upload avatars; only the owner (folder = their uid) or an admin can delete.

CREATE POLICY "Anyone can read avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Authenticated can upload avatars"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Owner or admin can delete avatars"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (
      public.is_admin()
      OR auth.uid()::text = (storage.foldername(name))[1]
    )
  );

-- 24. CAN ACCESS EXAM RPC (SECURITY DEFINER)
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

-- 25. CAN ATTEMPT EXAM RPC — enforces max attempts per exam (NULL = unlimited)
-- Attempts are counted from the student's last subscription purchase.
-- Every entry into the exam (started_at) counts as an attempt. Buying a new
-- subscription resets the counter. An active subscription does NOT bypass the limit.
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
  WHERE user_id = auth.uid();

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

-- 26. GET EXAM ATTEMPT STATUS — per-exam remaining attempts for the student list view
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
  WHERE user_id = auth.uid();

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

-- ============================================
-- 27. EXAM ATTEMPT HELPER RPCs (ownership forced to caller)
-- ============================================

CREATE OR REPLACE FUNCTION public.count_user_exam_attempts(p_user_id UUID, p_exam_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.exam_attempts
  WHERE user_id = auth.uid() AND exam_id = p_exam_id;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.insert_exam_attempt(p_user_id UUID, p_exam_id UUID, p_attempt_number INTEGER)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_id UUID;
BEGIN
  IF public.is_admin() THEN RETURN NULL; END IF;
  INSERT INTO public.exam_attempts (user_id, exam_id, attempt_number)
  VALUES (auth.uid(), p_exam_id, GREATEST(p_attempt_number, 1))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_latest_attempt(p_user_id UUID, p_exam_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE result JSONB;
BEGIN
  SELECT row_to_json(a)::jsonb INTO result
  FROM public.exam_attempts a
  WHERE a.user_id = auth.uid() AND a.exam_id = p_exam_id
  ORDER BY a.started_at DESC
  LIMIT 1;
  RETURN result;
END;
$$;

-- ============================================
-- 28. FUNCTION PERMISSIONS (block anon access, lock server-only functions)
-- ============================================
REVOKE EXECUTE ON FUNCTION public.get_profile_for_proxy(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_profile_for_proxy(UUID) TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_exam_questions(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_exam_questions(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.check_answer(UUID, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_answer(UUID, INT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.check_hotspot(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_hotspot(UUID, JSONB) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_exam_stats_full() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_exam_stats_full() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_exam_attempt_status(UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_exam_attempt_status(UUID[]) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.can_attempt_exam(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_attempt_exam(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.can_access_exam(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_exam(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.finish_exam_attempt(UUID, INTEGER, INTEGER, BOOLEAN, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finish_exam_attempt(UUID, INTEGER, INTEGER, BOOLEAN, JSONB) TO service_role;

REVOKE EXECUTE ON FUNCTION public.count_user_exam_attempts(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.count_user_exam_attempts(UUID, UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.insert_exam_attempt(UUID, UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.insert_exam_attempt(UUID, UUID, INTEGER) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_latest_attempt(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_latest_attempt(UUID, UUID) TO authenticated;

-- ============================================
-- COUPON CODES SYSTEM
-- Admin creates codes (e.g. START20 = 20% off selected bundles).
-- Each user can redeem a code ONCE. Global max_uses optional.
-- Prices are ALWAYS computed server-side � client cannot inject amounts.
-- ============================================
CREATE TABLE IF NOT EXISTS public.coupon_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  discount_percent INTEGER NOT NULL CHECK (discount_percent BETWEEN 1 AND 99),
  max_uses INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  plan_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID REFERENCES public.coupon_codes(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  redeemed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(coupon_id, user_id)
);

ALTER TABLE public.coupon_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage coupon_codes" ON public.coupon_codes;
CREATE POLICY "Admins read coupon_codes" ON public.coupon_codes FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins insert coupon_codes" ON public.coupon_codes FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admins update coupon_codes" ON public.coupon_codes FOR UPDATE USING (public.is_admin());
CREATE POLICY "Admins delete coupon_codes" ON public.coupon_codes FOR DELETE USING (public.is_admin());

-- Students have NO direct access to redemptions; webhook writes via service role.
DROP POLICY IF EXISTS "Admins read redemptions" ON public.coupon_redemptions;
CREATE POLICY "Admins read redemptions" ON public.coupon_redemptions FOR SELECT USING (public.is_admin());

-- RPC: student preview � which plans does this code apply to and how much % off
CREATE OR REPLACE FUNCTION public.validate_coupon_preview(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  c RECORD;
  already_used BOOLEAN;
BEGIN
  SELECT * INTO c FROM public.coupon_codes
  WHERE code = UPPER(BTRIM(p_code));
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'invalid');
  END IF;
  IF NOT c.is_active THEN
    RETURN jsonb_build_object('valid', false, 'error', 'inactive');
  END IF;
  IF c.expires_at IS NOT NULL AND c.expires_at < NOW() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'expired');
  END IF;
  IF c.max_uses IS NOT NULL AND c.used_count >= c.max_uses THEN
    RETURN jsonb_build_object('valid', false, 'error', 'limit_reached');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.coupon_redemptions
    WHERE coupon_id = c.id AND user_id = auth.uid()
  ) INTO already_used;
  IF already_used THEN
    RETURN jsonb_build_object('valid', false, 'error', 'already_used');
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'discount_percent', c.discount_percent,
    'plan_ids', c.plan_ids
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.validate_coupon_preview(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_coupon_preview(TEXT) TO authenticated;

-- RPC: increment coupon usage counter (service role / webhook only)
CREATE OR REPLACE FUNCTION public.increment_coupon_used_count(p_coupon_id UUID)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.coupon_codes SET used_count = used_count + 1 WHERE id = p_coupon_id;
$$;

REVOKE EXECUTE ON FUNCTION public.increment_coupon_used_count(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_coupon_used_count(UUID) TO service_role;

