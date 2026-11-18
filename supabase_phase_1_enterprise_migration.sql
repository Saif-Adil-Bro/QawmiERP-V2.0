-- ============================================================================
-- QawmiERP-V2.0 · Phase 1 Enterprise Migration (Idempotent)
-- Features:
--   1.1 Multi-Level Approval Workflow Engine:
--       approval_workflows, approval_workflow_steps,
--       approval_requests, approval_step_decisions
--   1.2 Active Session Management & Step-Up 2FA:
--       user_sessions, user_mfa_settings, step_up_verifications
--
-- Multi-tenant RLS: Every table references public.madrasas(id) ON DELETE CASCADE
-- and enforces madrasa_id = public.get_auth_madrasa_id().
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. public.approval_workflows
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.approval_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  madrasa_id UUID NOT NULL REFERENCES public.madrasas(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_bn TEXT,
  request_type VARCHAR(50) NOT NULL,
  description TEXT,
  min_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  max_amount NUMERIC(14, 2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  priority INT NOT NULL DEFAULT 0,
  require_two_person BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_approval_workflows_madrasa_type_active
  ON public.approval_workflows (madrasa_id, request_type, is_active);

CREATE INDEX IF NOT EXISTS idx_approval_workflows_madrasa_priority
  ON public.approval_workflows (madrasa_id, priority DESC);

ALTER TABLE public.approval_workflows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage approval_workflows in same madrasa" ON public.approval_workflows;
CREATE POLICY "Users can manage approval_workflows in same madrasa"
  ON public.approval_workflows
  FOR ALL
  USING (madrasa_id = public.get_auth_madrasa_id())
  WITH CHECK (madrasa_id = public.get_auth_madrasa_id());

-- ----------------------------------------------------------------------------
-- 2. public.approval_workflow_steps
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.approval_workflow_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  madrasa_id UUID NOT NULL REFERENCES public.madrasas(id) ON DELETE CASCADE,
  workflow_id UUID NOT NULL REFERENCES public.approval_workflows(id) ON DELETE CASCADE,
  step_order INT NOT NULL CHECK (step_order >= 1),
  step_name TEXT NOT NULL,
  approver_role VARCHAR(60),
  required_permission VARCHAR(80),
  approver_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sla_hours INT NOT NULL DEFAULT 24 CHECK (sla_hours >= 1),
  allow_delegation BOOLEAN NOT NULL DEFAULT false,
  require_step_up BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (workflow_id, step_order)
);

ALTER TABLE public.approval_workflow_steps
  ADD COLUMN IF NOT EXISTS require_step_up BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_approval_workflow_steps_workflow_order
  ON public.approval_workflow_steps (workflow_id, step_order);

CREATE INDEX IF NOT EXISTS idx_approval_workflow_steps_madrasa_workflow
  ON public.approval_workflow_steps (madrasa_id, workflow_id);

ALTER TABLE public.approval_workflow_steps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage approval_workflow_steps in same madrasa" ON public.approval_workflow_steps;
CREATE POLICY "Users can manage approval_workflow_steps in same madrasa"
  ON public.approval_workflow_steps
  FOR ALL
  USING (madrasa_id = public.get_auth_madrasa_id())
  WITH CHECK (madrasa_id = public.get_auth_madrasa_id());

-- ----------------------------------------------------------------------------
-- 3. public.approval_requests
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  madrasa_id UUID NOT NULL REFERENCES public.madrasas(id) ON DELETE CASCADE,
  workflow_id UUID REFERENCES public.approval_workflows(id) ON DELETE SET NULL,
  request_type VARCHAR(50) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  entity_type VARCHAR(60),
  target_id TEXT NOT NULL,
  target_name TEXT,
  amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  threshold_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  requested_by_name TEXT,
  requested_by_role TEXT,
  current_step_order INT NOT NULL DEFAULT 1,
  total_steps INT NOT NULL DEFAULT 1,
  status VARCHAR(25) NOT NULL DEFAULT 'PENDING',
  sla_due_at TIMESTAMPTZ,
  final_decision_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  final_decision_by_name TEXT,
  final_decision_at TIMESTAMPTZ,
  final_notes TEXT,
  executed_at TIMESTAMPTZ,
  execution_result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_approval_requests_madrasa_status_created
  ON public.approval_requests (madrasa_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_approval_requests_madrasa_type_status
  ON public.approval_requests (madrasa_id, request_type, status);

CREATE INDEX IF NOT EXISTS idx_approval_requests_madrasa_requested_by
  ON public.approval_requests (madrasa_id, requested_by);

CREATE INDEX IF NOT EXISTS idx_approval_requests_sla_pending
  ON public.approval_requests (madrasa_id, sla_due_at)
  WHERE status IN ('PENDING', 'IN_REVIEW');

ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage approval_requests in same madrasa" ON public.approval_requests;
CREATE POLICY "Users can manage approval_requests in same madrasa"
  ON public.approval_requests
  FOR ALL
  USING (madrasa_id = public.get_auth_madrasa_id())
  WITH CHECK (madrasa_id = public.get_auth_madrasa_id());

-- ----------------------------------------------------------------------------
-- 4. public.approval_step_decisions
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.approval_step_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  madrasa_id UUID NOT NULL REFERENCES public.madrasas(id) ON DELETE CASCADE,
  request_id UUID NOT NULL REFERENCES public.approval_requests(id) ON DELETE CASCADE,
  step_id UUID REFERENCES public.approval_workflow_steps(id) ON DELETE SET NULL,
  step_order INT NOT NULL,
  step_name TEXT,
  decided_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_by_name TEXT,
  decided_by_role TEXT,
  decision VARCHAR(25) NOT NULL,
  notes TEXT,
  sla_breached BOOLEAN NOT NULL DEFAULT false,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_approval_step_decisions_request_order
  ON public.approval_step_decisions (request_id, step_order);

CREATE INDEX IF NOT EXISTS idx_approval_step_decisions_madrasa_actor
  ON public.approval_step_decisions (madrasa_id, decided_by, decided_at DESC);

ALTER TABLE public.approval_step_decisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage approval_step_decisions in same madrasa" ON public.approval_step_decisions;
CREATE POLICY "Users can manage approval_step_decisions in same madrasa"
  ON public.approval_step_decisions
  FOR ALL
  USING (madrasa_id = public.get_auth_madrasa_id())
  WITH CHECK (madrasa_id = public.get_auth_madrasa_id());

-- ----------------------------------------------------------------------------
-- 5. public.user_sessions (Feature 1.2 — Active Sessions & Remote Revocation)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  madrasa_id UUID NOT NULL REFERENCES public.madrasas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_token_hash TEXT,
  channel VARCHAR(20) NOT NULL DEFAULT 'web',
  device_name TEXT,
  device_type VARCHAR(30) NOT NULL DEFAULT 'desktop',
  browser TEXT,
  os TEXT,
  ip_address TEXT,
  user_agent TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_madrasa_user_active
  ON public.user_sessions (madrasa_id, user_id, is_active, last_active_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_revoked
  ON public.user_sessions (user_id, revoked_at);

CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash
  ON public.user_sessions (session_token_hash)
  WHERE session_token_hash IS NOT NULL;

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Includes OR user_id = auth.uid() so Edge middleware can verify a user's own session cleanly
DROP POLICY IF EXISTS "Users can manage user_sessions in same madrasa" ON public.user_sessions;
CREATE POLICY "Users can manage user_sessions in same madrasa"
  ON public.user_sessions
  FOR ALL
  USING (madrasa_id = public.get_auth_madrasa_id() OR user_id = auth.uid())
  WITH CHECK (madrasa_id = public.get_auth_madrasa_id() OR user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 6. public.user_mfa_settings (Feature 1.2 — TOTP / SMS / Email 2FA Settings)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_mfa_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  madrasa_id UUID NOT NULL REFERENCES public.madrasas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  totp_enabled BOOLEAN NOT NULL DEFAULT false,
  totp_secret_encrypted TEXT,
  totp_verified_at TIMESTAMPTZ,
  sms_otp_enabled BOOLEAN NOT NULL DEFAULT false,
  email_otp_enabled BOOLEAN NOT NULL DEFAULT true,
  preferred_channel VARCHAR(20) NOT NULL DEFAULT 'email',
  sms_phone TEXT,
  email_address TEXT,
  recovery_codes_hashes JSONB NOT NULL DEFAULT '[]'::jsonb,
  totp_failed_attempts INTEGER NOT NULL DEFAULT 0,
  totp_locked_until TIMESTAMPTZ,
  enforce_step_up BOOLEAN NOT NULL DEFAULT true,
  enrolled_at TIMESTAMPTZ,
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (madrasa_id, user_id)
);

ALTER TABLE public.user_mfa_settings
  ADD COLUMN IF NOT EXISTS totp_failed_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.user_mfa_settings
  ADD COLUMN IF NOT EXISTS totp_locked_until TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_user_mfa_settings_madrasa_user
  ON public.user_mfa_settings (madrasa_id, user_id);

ALTER TABLE public.user_mfa_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage user_mfa_settings in same madrasa" ON public.user_mfa_settings;
CREATE POLICY "Users can manage user_mfa_settings in same madrasa"
  ON public.user_mfa_settings
  FOR ALL
  USING (madrasa_id = public.get_auth_madrasa_id() OR user_id = auth.uid())
  WITH CHECK (madrasa_id = public.get_auth_madrasa_id() OR user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 7. public.step_up_verifications (Feature 1.2 — Short-lived OTP & Step-Up Tokens)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.step_up_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  madrasa_id UUID NOT NULL REFERENCES public.madrasas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel VARCHAR(20) NOT NULL,
  action_scope VARCHAR(120) NOT NULL DEFAULT 'CRITICAL',
  otp_hash TEXT,
  verification_token_hash TEXT,
  attempt_count INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 5,
  status VARCHAR(25) NOT NULL DEFAULT 'PENDING',
  ip_address TEXT,
  user_agent TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_step_up_verifications_madrasa_user_status
  ON public.step_up_verifications (madrasa_id, user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_step_up_verifications_token_hash
  ON public.step_up_verifications (verification_token_hash)
  WHERE verification_token_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_step_up_verifications_expires_at
  ON public.step_up_verifications (expires_at);

ALTER TABLE public.step_up_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage step_up_verifications in same madrasa" ON public.step_up_verifications;
CREATE POLICY "Users can manage step_up_verifications in same madrasa"
  ON public.step_up_verifications
  FOR ALL
  USING (madrasa_id = public.get_auth_madrasa_id() OR user_id = auth.uid())
  WITH CHECK (madrasa_id = public.get_auth_madrasa_id() OR user_id = auth.uid());
