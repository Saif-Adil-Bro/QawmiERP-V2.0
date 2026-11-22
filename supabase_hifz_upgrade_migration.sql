-- ============================================================================
-- QawmiERP V2.0 — Non-Destructive Hifz Tracking Upgrade Migration
-- Upgrades public.hifz_logs in place and adds hifz_student_profiles,
-- hifz_weekly_sabina, and hifz_special_sabina with strict tenant RLS.
-- ============================================================================

-- 1. Extend existing public.hifz_logs non-destructively
ALTER TABLE public.hifz_logs
  ADD COLUMN IF NOT EXISTS student_category TEXT DEFAULT 'sabqi',
  ADD COLUMN IF NOT EXISTS sabak_mistakes INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sat_sabak_mistakes INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amukhta_mistakes INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS morning_session_done BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS morning_para_from INTEGER,
  ADD COLUMN IF NOT EXISTS morning_para_to INTEGER,
  ADD COLUMN IF NOT EXISTS morning_pages INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS morning_mistakes INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS afternoon_session_done BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS afternoon_para_from INTEGER,
  ADD COLUMN IF NOT EXISTS afternoon_para_to INTEGER,
  ADD COLUMN IF NOT EXISTS afternoon_pages INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS afternoon_mistakes INTEGER DEFAULT 0;

-- 2. Student Hifz Profile (1-to-1 with public.students)
CREATE TABLE IF NOT EXISTS public.hifz_student_profiles (
  student_id UUID PRIMARY KEY REFERENCES public.students(id) ON DELETE CASCADE,
  madrasa_id UUID NOT NULL REFERENCES public.madrasas(id) ON DELETE CASCADE,
  hifz_category TEXT NOT NULL DEFAULT 'sabqi' CHECK (hifz_category IN ('sabqi', 'khatmi')),
  previously_memorized_paras INTEGER[] NOT NULL DEFAULT '{}',
  total_khatams_completed INTEGER NOT NULL DEFAULT 0,
  current_khatam_paras_done INTEGER[] NOT NULL DEFAULT '{}',
  default_sabina_partner_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX IF NOT EXISTS idx_hifz_student_profiles_madrasa
  ON public.hifz_student_profiles(madrasa_id, hifz_category);

ALTER TABLE public.hifz_student_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation for hifz_student_profiles" ON public.hifz_student_profiles;
CREATE POLICY "Tenant isolation for hifz_student_profiles" ON public.hifz_student_profiles
  FOR ALL USING (madrasa_id = public.get_auth_madrasa_id());

-- 3. Weekly Thursday Peer Sabina
CREATE TABLE IF NOT EXISTS public.hifz_weekly_sabina (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  madrasa_id UUID NOT NULL REFERENCES public.madrasas(id) ON DELETE CASCADE,
  sabina_date DATE NOT NULL DEFAULT CURRENT_DATE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  listener_student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  verified_by_teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  assigned_para_from INTEGER NOT NULL,
  assigned_para_to INTEGER NOT NULL,
  para_breakdown JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_paras_recited INTEGER NOT NULL DEFAULT 0,
  total_mistakes INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed',
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX IF NOT EXISTS idx_hifz_weekly_sabina_madrasa_date
  ON public.hifz_weekly_sabina(madrasa_id, sabina_date DESC);
CREATE INDEX IF NOT EXISTS idx_hifz_weekly_sabina_student
  ON public.hifz_weekly_sabina(student_id, sabina_date DESC);

ALTER TABLE public.hifz_weekly_sabina ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation for hifz_weekly_sabina" ON public.hifz_weekly_sabina;
CREATE POLICY "Tenant isolation for hifz_weekly_sabina" ON public.hifz_weekly_sabina
  FOR ALL USING (madrasa_id = public.get_auth_madrasa_id());

-- 4. Special Intensive Multi-Mode Sabina
CREATE TABLE IF NOT EXISTS public.hifz_special_sabina (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  madrasa_id UUID NOT NULL REFERENCES public.madrasas(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  duration_days INTEGER NOT NULL DEFAULT 3,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'ongoing' CHECK (status IN ('ongoing', 'completed')),
  listening_mode TEXT NOT NULL DEFAULT 'one_to_one' CHECK (listening_mode IN ('one_to_one', 'group_to_group', 'one_to_many')),
  participants JSONB NOT NULL DEFAULT '{}'::jsonb,
  session_logs JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX IF NOT EXISTS idx_hifz_special_sabina_madrasa
  ON public.hifz_special_sabina(madrasa_id, status, start_date DESC);

ALTER TABLE public.hifz_special_sabina ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation for hifz_special_sabina" ON public.hifz_special_sabina;
CREATE POLICY "Tenant isolation for hifz_special_sabina" ON public.hifz_special_sabina
  FOR ALL USING (madrasa_id = public.get_auth_madrasa_id());
