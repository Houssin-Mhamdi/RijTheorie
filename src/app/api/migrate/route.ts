import { NextResponse } from "next/server"

export async function POST() {
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN
  const projectRef = "pxpxowhuvfbuxhgbnzdx"

  if (accessToken) {
    try {
      const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/sql`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
          body: JSON.stringify({
            query: `
-- Site settings table
CREATE TABLE IF NOT EXISTS public.site_settings (
  id bigint PRIMARY KEY DEFAULT 1,
  site_name text NOT NULL DEFAULT 'RijTheorie Pro',
  site_logo_url text,
  languages JSONB DEFAULT '["nl"]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read site_settings" ON site_settings;
CREATE POLICY "Anyone can read site_settings" ON public.site_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Only admins can update site_settings" ON site_settings;
CREATE POLICY "Only admins can update site_settings" ON public.site_settings FOR UPDATE USING (public.is_admin());
DROP POLICY IF EXISTS "Only admins can insert site_settings" ON site_settings;
CREATE POLICY "Only admins can insert site_settings" ON public.site_settings FOR INSERT WITH CHECK (public.is_admin());
INSERT INTO public.site_settings (id, site_name) VALUES (1, 'RijTheorie Pro') ON CONFLICT (id) DO NOTHING;

-- Add translations & pause_at to questions
ALTER TABLE questions ADD COLUMN IF NOT EXISTS translations JSONB DEFAULT '{}'::jsonb;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS pause_at FLOAT DEFAULT 3.0;

-- Add language to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'nl';

-- Add duration & pass threshold to exams
ALTER TABLE exams ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 45;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS pass_threshold INTEGER DEFAULT 80;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS pass_type TEXT DEFAULT 'percentage';
ALTER TABLE exams ADD COLUMN IF NOT EXISTS pass_count INTEGER DEFAULT 0;
          `,
        }),
      })
      if (!res.ok) {
        const err = await res.text()
        return NextResponse.json({ error: `Management API: ${res.status} ${err}` }, { status: 500 })
      }
      return NextResponse.json({ success: true })
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Management API call failed" }, { status: 500 })
    }
  }

  const sql = `-- 1. Site settings table
CREATE TABLE IF NOT EXISTS public.site_settings (
  id bigint PRIMARY KEY DEFAULT 1,
  site_name text NOT NULL DEFAULT 'RijTheorie Pro',
  site_logo_url text,
  languages JSONB DEFAULT '["nl"]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read site_settings" ON public.site_settings FOR SELECT USING (true);
CREATE POLICY "Only admins can update site_settings" ON public.site_settings FOR UPDATE USING (public.is_admin());
CREATE POLICY "Only admins can insert site_settings" ON public.site_settings FOR INSERT WITH CHECK (public.is_admin());
INSERT INTO public.site_settings (id, site_name) VALUES (1, 'RijTheorie Pro') ON CONFLICT (id) DO NOTHING;

-- 2. Add translations & pause_at columns to questions table
ALTER TABLE questions ADD COLUMN IF NOT EXISTS translations JSONB DEFAULT '{}'::jsonb;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS pause_at FLOAT DEFAULT 3.0;

-- 3. Add language column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'nl';

-- 4. Add duration & pass threshold to exams
ALTER TABLE exams ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 45;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS pass_threshold INTEGER DEFAULT 80;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS pass_type TEXT DEFAULT 'percentage';
ALTER TABLE exams ADD COLUMN IF NOT EXISTS pass_count INTEGER DEFAULT 0;`

  return NextResponse.json({
    error: "Geen SUPABASE_ACCESS_TOKEN ingesteld. Voer het SQL script handmatig uit in de Supabase SQL Editor.",
    sql,
  }, { status: 400 })
}
