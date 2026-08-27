-- ============================================
-- BLOG SYSTEM
-- Public blog at /blog and /blog/[slug] (no auth required).
-- Admin manages posts from /dashboard/blog.
--
-- Multi-language: each post has per-language content stored in the
-- 'translations' JSONB column. Shape:
-- {
--   "nl": { title, subtitle, description, meta_title, meta_description, body, cover_alt },
--   "en": { ... },
--   "ar": { ... }
-- }
-- 'body' is pre-rendered HTML from the WYSIWYG editor (may contain tables,
-- images, videos, headings, bold/italic, etc).
-- ============================================

CREATE TABLE IF NOT EXISTS public.blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  cover_url TEXT,
  translations JSONB NOT NULL DEFAULT '{}'::jsonb,
  author TEXT,
  tags JSONB DEFAULT '[]'::jsonb,
  featured BOOLEAN NOT NULL DEFAULT false,
  published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

-- Anyone (even anonymous) can read published posts; admins read everything
DROP POLICY IF EXISTS "Anyone can read published blogs" ON public.blog_posts;
CREATE POLICY "Anyone can read published blogs"
  ON public.blog_posts FOR SELECT
  USING (published = true OR public.is_admin());

-- Only admins can insert/update/delete blog posts
DROP POLICY IF EXISTS "Admins insert blogs" ON public.blog_posts;
CREATE POLICY "Admins insert blogs"
  ON public.blog_posts FOR INSERT
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins update blogs" ON public.blog_posts;
CREATE POLICY "Admins update blogs"
  ON public.blog_posts FOR UPDATE
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins delete blogs" ON public.blog_posts;
CREATE POLICY "Admins delete blogs"
  ON public.blog_posts FOR DELETE
  USING (public.is_admin());

-- Public (anon) needs SELECT to browse published posts
GRANT SELECT ON public.blog_posts TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blog_posts TO service_role;
