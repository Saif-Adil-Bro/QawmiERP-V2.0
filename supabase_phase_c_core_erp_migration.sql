-- ============================================================================
-- Phase C Migration: Core ERP Upgrades
--   1.1 Unified Immutable System-Wide Audit Log (system_audit_logs)
--   1.2 Structured Configuration & Relational Tables (staff_leave_requests,
--       exam_settings, madrasa_settings) migrated from madrasas.metadata
--   1.3 Granular Session Lock & Exam Marks Freeze (exams.is_locked,
--       academic_sessions.is_locked, accounting_periods)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1.1 UNIFIED SYSTEM-WIDE IMMUTABLE AUDIT LOGS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.system_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  madrasa_id UUID NOT NULL REFERENCES public.madrasas(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_name TEXT,
  actor_email TEXT,
  actor_role TEXT,
  module VARCHAR(60) NOT NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(80),
  entity_id TEXT,
  entity_label TEXT,
  summary TEXT,
  old_value JSONB,
  new_value JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  severity VARCHAR(20) NOT NULL DEFAULT 'INFO', -- INFO, WARNING, CRITICAL
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_system_audit_logs_madrasa_created
  ON public.system_audit_logs(madrasa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_audit_logs_madrasa_module
  ON public.system_audit_logs(madrasa_id, module, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_audit_logs_madrasa_action
  ON public.system_audit_logs(madrasa_id, action);
CREATE INDEX IF NOT EXISTS idx_system_audit_logs_entity
  ON public.system_audit_logs(madrasa_id, entity_id);
CREATE INDEX IF NOT EXISTS idx_system_audit_logs_actor
  ON public.system_audit_logs(madrasa_id, actor_id);
CREATE INDEX IF NOT EXISTS idx_system_audit_logs_severity
  ON public.system_audit_logs(madrasa_id, severity, created_at DESC);

ALTER TABLE public.system_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view system_audit_logs in same madrasa" ON public.system_audit_logs;
CREATE POLICY "Users can view system_audit_logs in same madrasa"
  ON public.system_audit_logs
  FOR SELECT
  USING (madrasa_id = public.get_auth_madrasa_id());

DROP POLICY IF EXISTS "Users can insert system_audit_logs in same madrasa" ON public.system_audit_logs;
CREATE POLICY "Users can insert system_audit_logs in same madrasa"
  ON public.system_audit_logs
  FOR INSERT
  WITH CHECK (madrasa_id = public.get_auth_madrasa_id());

-- Immutability Trigger: block UPDATE and DELETE at the database engine level
CREATE OR REPLACE FUNCTION public.prevent_system_audit_log_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'system_audit_logs is immutable: % operation is forbidden', TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_system_audit_log_update ON public.system_audit_logs;
CREATE TRIGGER trg_prevent_system_audit_log_update
  BEFORE UPDATE OR DELETE ON public.system_audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_system_audit_log_mutation();


-- ----------------------------------------------------------------------------
-- 1.2 STRUCTURED RELATIONAL TABLES (MIGRATION FROM madrasas.metadata JSON)
-- ----------------------------------------------------------------------------

-- A. Staff Leave Requests (স্টাফ ছুটির আবেদন)
CREATE TABLE IF NOT EXISTS public.staff_leave_requests (
  id TEXT PRIMARY KEY DEFAULT ('leave_' || replace(gen_random_uuid()::text, '-', '')),
  madrasa_id UUID NOT NULL REFERENCES public.madrasas(id) ON DELETE CASCADE,
  staff_id TEXT NOT NULL,
  staff_name TEXT NOT NULL,
  staff_id_code TEXT,
  leave_type VARCHAR(30) NOT NULL DEFAULT 'CASUAL', -- CASUAL, SICK, ANNUAL, UNPAID, EMERGENCY
  leave_type_name_bn TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days NUMERIC(5, 1) NOT NULL DEFAULT 1,
  reason TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED, CANCELLED
  reviewed_by TEXT,
  reviewed_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  review_reason TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_staff_leave_requests_madrasa
  ON public.staff_leave_requests(madrasa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_staff_leave_requests_staff
  ON public.staff_leave_requests(madrasa_id, staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_leave_requests_status
  ON public.staff_leave_requests(madrasa_id, status);

ALTER TABLE public.staff_leave_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage staff_leave_requests in same madrasa" ON public.staff_leave_requests;
CREATE POLICY "Users can manage staff_leave_requests in same madrasa"
  ON public.staff_leave_requests
  FOR ALL
  USING (madrasa_id = public.get_auth_madrasa_id())
  WITH CHECK (madrasa_id = public.get_auth_madrasa_id());

-- B. Exam Settings (গ্রেডিং কনফিগ, মূল্যায়ন নীতিমালা, বাধ্যতামূলক বিষয় ও প্রকাশনা তথ্য)
CREATE TABLE IF NOT EXISTS public.exam_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  madrasa_id UUID NOT NULL REFERENCES public.madrasas(id) ON DELETE CASCADE,
  exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE,
  scope_key TEXT NOT NULL DEFAULT '__global__', -- '__global__' when exam_id IS NULL, else exam_id::text
  setting_key VARCHAR(80) NOT NULL, -- 'grading_config', 'evaluation_rules', 'compulsory_subjects', 'publish_info'
  setting_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(madrasa_id, scope_key, setting_key)
);

CREATE INDEX IF NOT EXISTS idx_exam_settings_madrasa
  ON public.exam_settings(madrasa_id, setting_key);
CREATE INDEX IF NOT EXISTS idx_exam_settings_exam
  ON public.exam_settings(madrasa_id, exam_id);

ALTER TABLE public.exam_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage exam_settings in same madrasa" ON public.exam_settings;
CREATE POLICY "Users can manage exam_settings in same madrasa"
  ON public.exam_settings
  FOR ALL
  USING (madrasa_id = public.get_auth_madrasa_id())
  WITH CHECK (madrasa_id = public.get_auth_madrasa_id());

-- C. Madrasa Settings (কেন্দ্রীয় কনফিগারেশন — অডিট সেটিংস, এক্সাম এন্ড ডেট, ফিচার ফ্ল্যাগ ইত্যাদি)
CREATE TABLE IF NOT EXISTS public.madrasa_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  madrasa_id UUID NOT NULL REFERENCES public.madrasas(id) ON DELETE CASCADE,
  namespace VARCHAR(80) NOT NULL, -- 'general', 'audit_settings', 'exams', 'academic', 'security'
  setting_key VARCHAR(120) NOT NULL,
  setting_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(madrasa_id, namespace, setting_key)
);

CREATE INDEX IF NOT EXISTS idx_madrasa_settings_lookup
  ON public.madrasa_settings(madrasa_id, namespace, setting_key);

ALTER TABLE public.madrasa_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage madrasa_settings in same madrasa" ON public.madrasa_settings;
CREATE POLICY "Users can manage madrasa_settings in same madrasa"
  ON public.madrasa_settings
  FOR ALL
  USING (madrasa_id = public.get_auth_madrasa_id())
  WITH CHECK (madrasa_id = public.get_auth_madrasa_id());


-- ----------------------------------------------------------------------------
-- 1.3 GRANULAR SESSION LOCK & EXAM MARKS FREEZE SYSTEM
-- ----------------------------------------------------------------------------

-- A. Exam Marks Freeze columns on public.exams
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS locked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS locked_by_name TEXT;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS lock_reason TEXT;

-- B. Academic Session Lock columns on public.academic_sessions (if table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'academic_sessions'
  ) THEN
    ALTER TABLE public.academic_sessions ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE public.academic_sessions ADD COLUMN IF NOT EXISTS locked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
    ALTER TABLE public.academic_sessions ADD COLUMN IF NOT EXISTS locked_by_name TEXT;
    ALTER TABLE public.academic_sessions ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;
    ALTER TABLE public.academic_sessions ADD COLUMN IF NOT EXISTS lock_reason TEXT;
  END IF;
END $$;

-- C. Accounting Periods Lock Table (মাসিক / বার্ষিক হিসাব ক্লোজিং ও লক)
CREATE TABLE IF NOT EXISTS public.accounting_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  madrasa_id UUID NOT NULL REFERENCES public.madrasas(id) ON DELETE CASCADE,
  period_key VARCHAR(30) NOT NULL, -- e.g. '2026-11' (monthly) or 'YEAR-2026' (annual)
  period_type VARCHAR(20) NOT NULL DEFAULT 'MONTHLY', -- MONTHLY, ANNUAL, SESSION
  label TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  locked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  locked_by_name TEXT,
  locked_at TIMESTAMPTZ,
  lock_reason TEXT,
  unlocked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  unlocked_by_name TEXT,
  unlocked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(madrasa_id, period_key)
);

CREATE INDEX IF NOT EXISTS idx_accounting_periods_madrasa
  ON public.accounting_periods(madrasa_id, is_locked, start_date, end_date);

ALTER TABLE public.accounting_periods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage accounting_periods in same madrasa" ON public.accounting_periods;
CREATE POLICY "Users can manage accounting_periods in same madrasa"
  ON public.accounting_periods
  FOR ALL
  USING (madrasa_id = public.get_auth_madrasa_id())
  WITH CHECK (madrasa_id = public.get_auth_madrasa_id());
