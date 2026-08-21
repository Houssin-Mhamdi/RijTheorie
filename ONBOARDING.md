# RijTheorie — How to Add a New School

Every time a new driving school buys the app, follow these 10 steps.
Total time: ~15 minutes. No coding required.

---

## Step 1 — Create their Supabase database

1. Go to https://supabase.com → log in
2. Click **New project** → enter the school's name → set a database password → click **Create project**
3. Wait ~1 minute for it to be ready
4. Go to **Project Settings → API → Legacy API keys** (scroll down)
5. Copy these 3 values and save them somewhere safe:

```
Project URL:    https://YOUR_PROJECT.supabase.co
anon key:       eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  (role: anon)
service_role:   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  (role: service_role)
```

⚠️ Make sure the **anon** key has `"role":"anon"` inside the JWT.
The **service_role** key has `"role":"service_role"` inside.
They look very similar — don't mix them up.

---

## Step 2 — Create the database tables

In Supabase, go to **SQL Editor** (left sidebar) → click **New query** → paste this entire block → click **Run**:

```sql
-- ============================================
-- PROFILES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('admin', 'student')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ,
  language TEXT DEFAULT 'nl',
  can_access_exams BOOLEAN DEFAULT true,
  avatar_url TEXT
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- HELPER FUNCTION: is_admin() — used by all RLS policies
-- ============================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
$$;

-- ============================================
-- PROFILES POLICIES
-- ============================================
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
CREATE POLICY "Admins can read all profiles" ON public.profiles FOR SELECT USING (public.is_admin());

-- ============================================
-- AUTO-CREATE PROFILE WHEN SOMEONE SIGNS UP
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
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

-- ============================================
-- LESSONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  order_index INTEGER DEFAULT 0,
  published BOOLEAN DEFAULT false,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read published lessons" ON public.lessons;
CREATE POLICY "Anyone can read published lessons" ON public.lessons FOR SELECT USING (published = true);

DROP POLICY IF EXISTS "Admins can read all lessons" ON public.lessons;
CREATE POLICY "Admins can read all lessons" ON public.lessons FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can insert lessons" ON public.lessons;
CREATE POLICY "Admins can insert lessons" ON public.lessons FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update lessons" ON public.lessons;
CREATE POLICY "Admins can update lessons" ON public.lessons FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete lessons" ON public.lessons;
CREATE POLICY "Admins can delete lessons" ON public.lessons FOR DELETE USING (public.is_admin());

-- ============================================
-- QUESTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.questions (
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
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read questions" ON public.questions;
DROP POLICY IF EXISTS "Admins can read questions" ON public.questions;
CREATE POLICY "Admins can read questions" ON public.questions FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can insert questions" ON public.questions;
CREATE POLICY "Admins can insert questions" ON public.questions FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update questions" ON public.questions;
CREATE POLICY "Admins can update questions" ON public.questions FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete questions" ON public.questions;
CREATE POLICY "Admins can delete questions" ON public.questions FOR DELETE USING (public.is_admin());

-- ============================================
-- COURSES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  icon_name TEXT NOT NULL DEFAULT 'Car',
  student_count INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read courses" ON public.courses;
CREATE POLICY "Anyone can read courses" ON public.courses FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can insert courses" ON public.courses;
CREATE POLICY "Admins can insert courses" ON public.courses FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update courses" ON public.courses;
CREATE POLICY "Admins can update courses" ON public.courses FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete courses" ON public.courses;
CREATE POLICY "Admins can delete courses" ON public.courses FOR DELETE USING (public.is_admin());

-- ============================================
-- QUESTION-COURSE ASSIGNMENTS (many-to-many)
-- ============================================
CREATE TABLE IF NOT EXISTS public.question_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE NOT NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(question_id, course_id)
);

ALTER TABLE public.question_courses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read question_courses" ON public.question_courses;
CREATE POLICY "Anyone can read question_courses" ON public.question_courses FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can insert question_courses" ON public.question_courses;
CREATE POLICY "Admins can insert question_courses" ON public.question_courses FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete question_courses" ON public.question_courses;
CREATE POLICY "Admins can delete question_courses" ON public.question_courses FOR DELETE USING (public.is_admin());

-- ============================================
-- EXAMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
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

ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read exams" ON public.exams;
CREATE POLICY "Anyone can read exams" ON public.exams FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can insert exams" ON public.exams;
CREATE POLICY "Admins can insert exams" ON public.exams FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update exams" ON public.exams;
CREATE POLICY "Admins can update exams" ON public.exams FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete exams" ON public.exams;
CREATE POLICY "Admins can delete exams" ON public.exams FOR DELETE USING (public.is_admin());

-- ============================================
-- EXAM QUESTIONS (many-to-many)
-- ============================================
CREATE TABLE IF NOT EXISTS public.exam_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE NOT NULL,
  question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(exam_id, question_id)
);

ALTER TABLE public.exam_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read exam_questions" ON public.exam_questions;
CREATE POLICY "Anyone can read exam_questions" ON public.exam_questions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can insert exam_questions" ON public.exam_questions;
CREATE POLICY "Admins can insert exam_questions" ON public.exam_questions FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete exam_questions" ON public.exam_questions;
CREATE POLICY "Admins can delete exam_questions" ON public.exam_questions FOR DELETE USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update exam_questions" ON public.exam_questions;
CREATE POLICY "Admins can update exam_questions" ON public.exam_questions FOR UPDATE USING (public.is_admin());

-- ============================================
-- USER PROGRESS
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  lesson_id UUID REFERENCES public.lessons(id) ON DELETE CASCADE NOT NULL,
  completed BOOLEAN DEFAULT false,
  score INTEGER,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, lesson_id)
);

ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own progress" ON public.user_progress;
CREATE POLICY "Users can read own progress" ON public.user_progress FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can upsert own progress" ON public.user_progress;
CREATE POLICY "Users can upsert own progress" ON public.user_progress FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own progress" ON public.user_progress;
CREATE POLICY "Users can update own progress" ON public.user_progress FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can read all progress" ON public.user_progress;
CREATE POLICY "Admins can read all progress" ON public.user_progress FOR SELECT USING (public.is_admin());

-- ============================================
-- SITE SETTINGS
-- ============================================
CREATE TABLE IF NOT EXISTS public.site_settings (
  id BIGINT PRIMARY KEY DEFAULT 1,
  site_name TEXT NOT NULL DEFAULT 'RijTheorie Pro',
  site_logo_url TEXT,
  languages JSONB DEFAULT '["nl"]'::jsonb,
  payment_settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO public.site_settings (id, site_name) VALUES (1, 'RijTheorie Pro') ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read site_settings" ON public.site_settings;
CREATE POLICY "Anyone can read site_settings" ON public.site_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Only admins can update site_settings" ON public.site_settings;
CREATE POLICY "Only admins can update site_settings" ON public.site_settings FOR UPDATE USING (public.is_admin());

-- ============================================
-- EXAM ATTEMPTS
-- ============================================
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

ALTER TABLE public.exam_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own attempts" ON public.exam_attempts;
CREATE POLICY "Users can read own attempts" ON public.exam_attempts FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own attempts" ON public.exam_attempts;
CREATE POLICY "Users can insert own attempts" ON public.exam_attempts FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own attempts" ON public.exam_attempts;
CREATE POLICY "Users can update own attempts" ON public.exam_attempts FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can read all attempts" ON public.exam_attempts;
CREATE POLICY "Admins can read all attempts" ON public.exam_attempts FOR SELECT USING (public.is_admin());

-- ============================================
-- SUBSCRIPTION PLANS (default 3 plans)
-- ============================================
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

DROP POLICY IF EXISTS "Anyone can read active plans" ON public.subscription_plans;
CREATE POLICY "Anyone can read active plans" ON public.subscription_plans FOR SELECT USING (true);

DROP POLICY IF EXISTS "Only admins can insert plans" ON public.subscription_plans;
CREATE POLICY "Only admins can insert plans" ON public.subscription_plans FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Only admins can update plans" ON public.subscription_plans;
CREATE POLICY "Only admins can update plans" ON public.subscription_plans FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "Only admins can delete plans" ON public.subscription_plans;
CREATE POLICY "Only admins can delete plans" ON public.subscription_plans FOR DELETE USING (public.is_admin());

INSERT INTO public.subscription_plans (name, description, price, duration_days, features) VALUES
  ('1 maand', 'Toegang tot alle oefenexamens voor 1 maand', 9.99, 30, '["Alle examens", "Onbeperkt oefenen", "Resultaten bekijken"]'),
  ('3 maanden', 'Toegang tot alle oefenexamens voor 3 maanden', 19.99, 90, '["Alle examens", "Onbeperkt oefenen", "Resultaten bekijken", "Voortgangsstatistieken"]'),
  ('6 maanden', 'Toegang tot alle oefenexamens voor 6 maanden', 29.99, 180, '["Alle examens", "Onbeperkt oefenen", "Resultaten bekijken", "Voortgangsstatistieken", "Prioriteit ondersteuning"]')
ON CONFLICT DO NOTHING;

-- ============================================
-- USER SUBSCRIPTIONS
-- ============================================
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

DROP POLICY IF EXISTS "Users can read own subscriptions" ON public.user_subscriptions;
CREATE POLICY "Users can read own subscriptions" ON public.user_subscriptions FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can read all subscriptions" ON public.user_subscriptions;
CREATE POLICY "Admins can read all subscriptions" ON public.user_subscriptions FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can insert subscriptions" ON public.user_subscriptions;
CREATE POLICY "Admins can insert subscriptions" ON public.user_subscriptions FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update subscriptions" ON public.user_subscriptions;
CREATE POLICY "Admins can update subscriptions" ON public.user_subscriptions FOR UPDATE USING (public.is_admin());

-- ============================================
-- PAYOUTS
-- ============================================
CREATE TABLE IF NOT EXISTS public.payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read payouts" ON public.payouts;
CREATE POLICY "Admins can read payouts" ON public.payouts FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can insert payouts" ON public.payouts;
CREATE POLICY "Admins can insert payouts" ON public.payouts FOR INSERT WITH CHECK (public.is_admin());

-- ============================================
-- STORAGE POLICIES (question-media + avatars)
-- ============================================
DROP POLICY IF EXISTS "Anyone can read question-media" ON storage.objects;
CREATE POLICY "Anyone can read question-media" ON storage.objects FOR SELECT USING (bucket_id = 'question-media');

DROP POLICY IF EXISTS "Authenticated can upload question-media" ON storage.objects;
CREATE POLICY "Authenticated can upload question-media" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'question-media');

DROP POLICY IF EXISTS "Authenticated can delete question-media" ON storage.objects;
CREATE POLICY "Authenticated can delete question-media" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'question-media');

DROP POLICY IF EXISTS "Anyone can read avatars" ON storage.objects;
CREATE POLICY "Anyone can read avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Authenticated can upload avatars" ON storage.objects;
CREATE POLICY "Authenticated can upload avatars" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Authenticated can delete avatars" ON storage.objects;
CREATE POLICY "Authenticated can delete avatars" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'avatars');

-- ============================================
-- RPC FUNCTIONS
-- ============================================

-- get_profile_for_proxy: used by the proxy to check user role
CREATE OR REPLACE FUNCTION public.get_profile_for_proxy(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE result JSON;
BEGIN
  SELECT row_to_json(p) INTO result
  FROM (SELECT role, can_access_exams FROM public.profiles WHERE id = p_user_id) p;
  RETURN result;
END;
$$;

-- get_exam_questions: returns questions with isCorrect stripped
CREATE OR REPLACE FUNCTION public.get_exam_questions(p_exam_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE result JSONB;
BEGIN
  SELECT JSONB_AGG(
    JSONB_BUILD_OBJECT(
      'id', q.id, 'category', q.category, 'question_text', q.question_text,
      'media', q.media,
      'answer_options', (SELECT JSONB_AGG(ao - 'isCorrect') FROM JSONB_ARRAY_ELEMENTS(q.answer_options) AS ao),
      'explanation', NULL,
      'translations', q.translations,
      'audio_translations', q.audio_translations,
      'explanation_audio_translations', q.explanation_audio_translations,
      'pause_at', q.pause_at
    ) ORDER BY eq.sort_order
  )
  FROM public.questions q
  JOIN public.exam_questions eq ON eq.question_id = q.id
  WHERE eq.exam_id = p_exam_id
  INTO result;
  RETURN COALESCE(result, '[]'::JSONB);
END;
$$;

-- check_answer: returns correct_index + explanation for a multiple-choice question
CREATE OR REPLACE FUNCTION public.check_answer(p_question_id UUID, p_selected_index INT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE q_record RECORD; correct_idx INT := NULL; i INT;
BEGIN
  SELECT * INTO q_record FROM public.questions WHERE id = p_question_id;
  IF NOT FOUND THEN RETURN JSONB_BUILD_OBJECT('error', 'Question not found'); END IF;
  FOR i IN 0..JSONB_ARRAY_LENGTH(q_record.answer_options) - 1 LOOP
    IF (q_record.answer_options->i->>'isCorrect')::boolean THEN correct_idx := i; EXIT; END IF;
  END LOOP;
  RETURN JSONB_BUILD_OBJECT(
    'correct', (q_record.answer_options->p_selected_index->>'isCorrect')::boolean,
    'correct_index', correct_idx, 'explanation', q_record.explanation
  );
END;
$$;

-- check_hotspot: returns per-circle correctness + distance for hotspot questions
CREATE OR REPLACE FUNCTION public.check_hotspot(p_question_id UUID, p_positions JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  q_record RECORD; results_arr JSONB := '[]'::JSONB;
  correct_x NUMERIC; correct_y NUMERIC; submitted_x NUMERIC; submitted_y NUMERIC; dist NUMERIC; i INT;
BEGIN
  SELECT * INTO q_record FROM public.questions WHERE id = p_question_id;
  IF NOT FOUND THEN RETURN JSONB_BUILD_OBJECT('error', 'Question not found'); END IF;
  FOR i IN 0..JSONB_ARRAY_LENGTH(p_positions) - 1 LOOP
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
  RETURN JSONB_BUILD_OBJECT('results', results_arr, 'explanation', q_record.explanation);
END;
$$;

-- finish_exam_attempt: updates score + category_scores
CREATE OR REPLACE FUNCTION public.finish_exam_attempt(
  p_attempt_id UUID, p_score INTEGER, p_total_questions INTEGER, p_passed BOOLEAN, p_category_scores JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  UPDATE public.exam_attempts
  SET score = p_score, total_questions = p_total_questions, passed = p_passed, category_scores = p_category_scores, completed_at = NOW()
  WHERE id = p_attempt_id;
END;
$$;

-- get_exam_stats_full: returns all attempts for stats page
CREATE OR REPLACE FUNCTION public.get_exam_stats_full()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE result JSONB;
BEGIN
  SELECT JSONB_AGG(
    JSONB_BUILD_OBJECT(
      'id', ea.id, 'exam_id', ea.exam_id, 'score', ea.score, 'total_questions', ea.total_questions,
      'passed', ea.passed, 'started_at', ea.started_at, 'completed_at', ea.completed_at, 'category_scores', ea.category_scores
    ) ORDER BY ea.started_at DESC
  )
  FROM public.exam_attempts ea
  WHERE (public.is_admin() OR ea.user_id = auth.uid())
  INTO result;
  RETURN COALESCE(result, '[]'::JSONB);
END;
$$;

-- update_last_active_at: called by client every 5 min
CREATE OR REPLACE FUNCTION public.update_last_active_at()
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  UPDATE public.profiles SET last_active_at = NOW() WHERE id = auth.uid();
END;
$$;

-- can_access_exam: checks if student can access exam (free or has subscription)
CREATE OR REPLACE FUNCTION public.can_access_exam(p_exam_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_is_free BOOLEAN; v_has_sub BOOLEAN;
BEGIN
  SELECT is_free INTO v_is_free FROM public.exams WHERE id = p_exam_id;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_is_free THEN RETURN true; END IF;
  IF public.is_admin() THEN RETURN true; END IF;
  SELECT EXISTS (SELECT 1 FROM public.user_subscriptions WHERE user_id = auth.uid() AND is_active = true AND end_date > NOW()) INTO v_has_sub;
  RETURN v_has_sub;
END;
$$;

-- can_attempt_exam: enforces max attempts per exam (NULL = unlimited)
CREATE OR REPLACE FUNCTION public.can_attempt_exam(p_exam_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_max_attempts INTEGER; v_last_purchase TIMESTAMPTZ; v_used INTEGER; v_remaining INTEGER;
BEGIN
  SELECT max_attempts INTO v_max_attempts FROM public.exams WHERE id = p_exam_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('allowed', false, 'reason', 'not_found'); END IF;
  IF public.is_admin() THEN RETURN jsonb_build_object('allowed', true, 'remaining_attempts', NULL, 'max_attempts', v_max_attempts); END IF;
  IF v_max_attempts IS NULL THEN RETURN jsonb_build_object('allowed', true, 'remaining_attempts', NULL, 'max_attempts', NULL); END IF;
  SELECT COALESCE(MAX(start_date), '-infinity'::timestamptz) INTO v_last_purchase FROM public.user_subscriptions WHERE user_id = auth.uid();
  SELECT COUNT(*) INTO v_used FROM public.exam_attempts WHERE user_id = auth.uid() AND exam_id = p_exam_id AND started_at >= v_last_purchase;
  v_remaining := v_max_attempts - v_used;
  IF v_remaining <= 0 THEN RETURN jsonb_build_object('allowed', false, 'reason', 'limit_reached', 'remaining_attempts', 0, 'max_attempts', v_max_attempts); END IF;
  RETURN jsonb_build_object('allowed', true, 'remaining_attempts', v_remaining, 'max_attempts', v_max_attempts);
END;
$$;

-- get_exam_attempt_status: returns per-exam remaining attempts for student list view
CREATE OR REPLACE FUNCTION public.get_exam_attempt_status(p_exam_ids UUID[])
RETURNS TABLE (exam_id UUID, max_attempts INTEGER, used_attempts INTEGER, remaining_attempts INTEGER, is_locked BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_last_purchase TIMESTAMPTZ; v_exam_id UUID; v_max INTEGER; v_used INTEGER;
BEGIN
  SELECT COALESCE(MAX(start_date), '-infinity'::timestamptz) INTO v_last_purchase FROM public.user_subscriptions WHERE user_id = auth.uid();
  FOREACH v_exam_id IN ARRAY p_exam_ids LOOP
    IF public.is_admin() THEN exam_id := v_exam_id; max_attempts := NULL; used_attempts := NULL; remaining_attempts := NULL; is_locked := false; RETURN NEXT; CONTINUE; END IF;
    SELECT public.exams.max_attempts INTO v_max FROM public.exams WHERE id = v_exam_id;
    IF v_max IS NULL THEN exam_id := v_exam_id; max_attempts := NULL; used_attempts := NULL; remaining_attempts := NULL; is_locked := false; RETURN NEXT; CONTINUE; END IF;
    SELECT COUNT(*) INTO v_used FROM public.exam_attempts WHERE user_id = auth.uid() AND public.exam_attempts.exam_id = v_exam_id AND started_at >= v_last_purchase;
    exam_id := v_exam_id; max_attempts := v_max; used_attempts := v_used; remaining_attempts := GREATEST(v_max - v_used, 0); is_locked := (v_max - v_used) <= 0;
    RETURN NEXT;
  END LOOP;
  RETURN;
END;
$$;
```

After clicking **Run**, you should see "Success. No rows returned".

---

## Step 3 — Create storage buckets

1. In Supabase → click **Storage** in the left sidebar
2. Click **"New bucket"** → enter:
   - Name: `question-media`
   - Public bucket: **ON**
   - Click **Create bucket**
3. Click **"New bucket"** again → enter:
   - Name: `avatars`
   - Public bucket: **ON**
   - Click **Create bucket**

Done. The storage policies were already created by the SQL in Step 2.

---

## Step 4 — Create a new Netlify site

1. Go to https://app.netlify.com → log in
2. Click **"Add new site"** → **Import from an existing project**
3. Choose **GitHub** → find and select `Houssin-Mhamdi/RijTheorie`
4. Build settings should already be correct:
   - Build command: `npm run build`
   - Publish directory: `.next`
5. **DO NOT click Deploy yet** — go to Step 5 first

---

## Step 5 — Add environment variables

1. In your new Netlify site → click **Site settings** (top menu)
2. Click **Environment variables** (left sidebar)
3. Click **Add a single variable** and add these 4:

| Key | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://YOUR_PROJECT.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Paste the **anon** legacy key (the one with `"role":"anon"`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Paste the **service_role** legacy key (the one with `"role":"service_role"`) |
| `STRIPE_SECRET_KEY` | Your **platform** Stripe secret key (starts with `sk_live_`) — same for all schools |
| `NEXT_PUBLIC_CLARITY_PROJECT_ID` | Leave empty (just put a space or any value) |

4. Go to **Deploys** (top menu) → click **Trigger deploy** → **Deploy site**
5. Wait ~2 minutes until it says "Published"

---

## Step 6 — Create the admin account

1. Open an **incognito/private browser window**
2. Go to the school's Netlify URL (shown on their site overview, e.g. `https://brave-babka-12345.netlify.app`)
3. Go to `/signup` → sign up with the school owner's email and a password
4. Go back to Supabase → **Authentication** (left sidebar) → **Users** → find the user you just created → copy their **UUID** (it's shown in the user row)
5. Go to **SQL Editor** → click **New query** → paste this (replace the UUID and email):

```sql
INSERT INTO public.profiles (id, email, name, role)
VALUES ('PASTE_UUID_HERE', 'owner@schoolname.nl', 'Eigenaar', 'admin')
ON CONFLICT (id) DO UPDATE SET role = 'admin';
```

6. Click **Run**
7. Close the incognito window → open a new one → go to `/login` → log in with that email
8. You should see the admin dashboard

---

## Step 7 — Set the school name and languages

1. While logged in as admin → go to **Settings** (top right dropdown)
2. Change the **site name** to the school's name (e.g. "Rijschool De Vries")
3. Set the **languages** to: `["nl"]` (or `["nl", "en"]` for multi-language)
4. Click **Save**

---

## Step 8 — Test that students work

1. Log out
2. Go to `/signup` → create a student account with a different email
3. Log in → you should see the student exam list (NOT the admin dashboard)
4. Log back in as admin → go to **Students** → you should see the new student listed

---

## Step 9 — Copy questions from your main database

The new school starts with an empty database. You need to copy questions from your main project.

### Export from main project

1. Go to your **main Supabase** (the one with all the questions)
2. **Table Editor** → `questions` table
3. Click the **"..."** menu → **Download as CSV**
4. Save the file

### Import into new school

1. Go to the **new school's Supabase**
2. **Table Editor** → `questions` → click **Insert rows** → **Import from CSV**
3. Upload the CSV → map columns → confirm

### Then copy exams + exam_questions

1. Back in your **main Supabase** → **Table Editor** → `exams` → **Download as CSV**
2. In the **new Supabase** → `exams` → **Import from CSV** → upload
3. Repeat for `exam_questions` table (this links questions to exams)
4. Repeat for `question_courses` table (this links questions to courses)
5. Repeat for `courses` table

### Media files (images/videos/audio)

Media URLs in the CSV point to your main project's storage. They won't work on the new school. Two options:

**Option A — Copy the files:**
1. In main Supabase → **Storage** → `question-media` → download all files
2. In new Supabase → **Storage** → `question-media` → upload all files
3. The URLs will be different, so you may need to update them in the `questions` table

**Option B — Use one shared bucket (simpler):**
If all schools share the same media, you can point all schools to one Supabase storage bucket by using the same `SUPABASE_URL` for media only. Ask me to implement this if you want it.

### Then set school-specific settings

After importing, go to the new school's Supabase → **SQL Editor** and run:

```sql
-- Set the school name
UPDATE public.site_settings SET site_name = 'NAME OF THE SCHOOL' WHERE id = 1;

-- Set supported languages
UPDATE public.site_settings SET languages = '["nl"]'::jsonb WHERE id = 1;
```

---

## Step 10 — Set up Stripe (for payments)

The platform uses **Stripe Connect** with a 50/50 revenue split.
You (the platform owner) receive 50% of every subscription payment automatically.

### Your one-time setup (do this once, before onboarding any school)

1. Go to https://dashboard.stripe.com → create or log in to YOUR Stripe account
2. Go to **Settings → Connect settings** → enable **Express accounts**
3. Go to **Developers → API keys** → copy your **Secret key** (starts with `sk_live_`)
4. This key goes into EVERY Netlify site as `STRIPE_SECRET_KEY` (Step 5)

### Per-school setup

The school admin connects their own Stripe account from the Billing page:

1. Log in to the school's site as admin → go to **Settings → Billing**
2. Click **"Connect with Stripe"** → redirected to Stripe's hosted onboarding
3. The school owner fills in their bank details, ID verification, etc.
4. After completing → redirected back to the Billing page → status shows **CONNECTED**

That's it. No API keys to paste. Stripe handles everything.

### How it works

- Student pays €10 → Stripe automatically splits it:
  - **€5** goes to YOUR Stripe account (platform fee)
  - **€5** goes to the school's Stripe account (their share)
- The school sees their share deposited in their Stripe dashboard
- You see your 50% fee in your Stripe dashboard
- The webhook records the platform fee in the `payouts` table

### Webhook setup (one-time, per platform)

1. In your Stripe Dashboard → **Developers → Webhooks → Add endpoint**
2. URL: `https://ANY_SCHOOL_SITE.netlify.app/api/stripe/webhook`
   (all schools share the same webhook URL since they use the same platform key)
3. Events to send: `checkout.session.completed`
4. Copy the **Webhook signing secret** → store it in each school's `site_settings` via SQL:

```sql
UPDATE public.site_settings
SET payment_settings = payment_settings || '{"webhook_secret": "whsec_YOUR_SECRET_HERE"}'::jsonb
WHERE id = 1;
```

Without Stripe, students can't buy subscriptions. Free exams still work without Stripe.

---

## Step 11 — Hand over to the school

Send the school owner:

- **Login URL:** their Netlify URL (e.g. `https://brave-babka-12345.netlify.app/login`)
- **Admin email + password** (tell them to change password in Settings)
- **Simple instructions:**
  1. Log in → go to **Courses** → create a course
  2. Go to **Exams** → create exams inside the course
  3. Go to **Questions** → add questions → link them to exams
  4. Students sign up at the same URL → they see the exams

---

## When you update the code later

- **Code changes** (new features, UI fixes): just push to GitHub → all Netlify sites auto-rebuild → every school gets the update
- **Database changes** (new SQL): push code, then go to each school's Supabase → SQL Editor → run the new SQL. All SQL in this file uses `IF NOT EXISTS` and `CREATE OR REPLACE` so re-running is always safe.

---

## Quick reference — all Supabase URLs after setup

| School | Supabase URL | Netlify URL |
|---|---|---|
| Your main school | `https://pxpxowhuvfbuxhgbnzdx.supabase.co` | `https://rijtheorie.netlify.app` |
| School 2 (rij2) | `https://ctltwuhsplphrhuqpubr.supabase.co` | Check Netlify |
| School 3 | (create new project) | (create new site) |
