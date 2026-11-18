-- ============================================================================
-- QawmiERP-V2.0 — Phase 3: AI Early Warning & Financial Anomaly Detection
-- Idempotent, Multi-Tenant (madrasa_id), RLS-Protected Migration
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 3.1 AI Early Warning System: public.student_risk_scores
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.student_risk_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  madrasa_id UUID NOT NULL REFERENCES public.madrasas(id) ON DELETE CASCADE,
  student_id UUID NOT NULL,
  class_id UUID,
  class_name TEXT,
  student_name TEXT,
  roll_number TEXT,
  parent_phone TEXT,
  composite_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  risk_level VARCHAR(20) NOT NULL DEFAULT 'LOW',
  attendance_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  academic_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  fee_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  factors JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  intervention_status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  intervention_notes TEXT,
  intervened_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  intervened_at TIMESTAMPTZ,
  last_calculated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (madrasa_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_student_risk_scores_madrasa
  ON public.student_risk_scores(madrasa_id);
CREATE INDEX IF NOT EXISTS idx_student_risk_scores_risk_level
  ON public.student_risk_scores(madrasa_id, risk_level, composite_score DESC);
CREATE INDEX IF NOT EXISTS idx_student_risk_scores_class
  ON public.student_risk_scores(madrasa_id, class_id);

ALTER TABLE public.student_risk_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage student_risk_scores in same madrasa" ON public.student_risk_scores;
CREATE POLICY "Users can manage student_risk_scores in same madrasa"
  ON public.student_risk_scores
  FOR ALL
  USING (madrasa_id = public.get_auth_madrasa_id())
  WITH CHECK (madrasa_id = public.get_auth_madrasa_id());

-- ----------------------------------------------------------------------------
-- 3.2 Financial & Boarding Anomaly Detection: public.financial_anomalies
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.financial_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  madrasa_id UUID NOT NULL REFERENCES public.madrasas(id) ON DELETE CASCADE,
  anomaly_type VARCHAR(60) NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'WARNING',
  status VARCHAR(30) NOT NULL DEFAULT 'OPEN',
  dedup_key TEXT,
  title TEXT NOT NULL,
  description TEXT,
  entity_type VARCHAR(60),
  entity_id TEXT,
  metric_value NUMERIC(14,2),
  baseline_value NUMERIC(14,2),
  z_score NUMERIC(8,3),
  detected_date DATE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_by_name TEXT,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_financial_anomalies_madrasa
  ON public.financial_anomalies(madrasa_id);
CREATE INDEX IF NOT EXISTS idx_financial_anomalies_status
  ON public.financial_anomalies(madrasa_id, status, severity);
CREATE INDEX IF NOT EXISTS idx_financial_anomalies_dedup
  ON public.financial_anomalies(madrasa_id, dedup_key)
  WHERE dedup_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_financial_anomalies_detected_date
  ON public.financial_anomalies(madrasa_id, detected_date DESC);

ALTER TABLE public.financial_anomalies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage financial_anomalies in same madrasa" ON public.financial_anomalies;
CREATE POLICY "Users can manage financial_anomalies in same madrasa"
  ON public.financial_anomalies
  FOR ALL
  USING (madrasa_id = public.get_auth_madrasa_id())
  WITH CHECK (madrasa_id = public.get_auth_madrasa_id());
