-- ============================================================================
-- QawmiERP-V2.0 · Phase 2 Automation, Notifications, BI & Webhooks Migration
-- (Strictly Idempotent)
-- Features:
--   2.1 Scheduled Cron & Automation Engine:
--       automation_rules, job_execution_logs
--   2.2 Unified Multi-Channel Notification & Template Orchestrator:
--       notification_templates, notification_queue, notification_device_tokens
--   2.3 Executive BI & Digest Reports:
--       digest_schedules, 4 Materialized Views (mv_bi_*), 2 RPCs
--   2.4 Webhook & External Integration Hub:
--       webhook_endpoints, webhook_deliveries
--
-- Multi-tenant RLS: Every table references public.madrasas(id) ON DELETE CASCADE
-- and enforces madrasa_id = public.get_auth_madrasa_id().
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Feature 2.1: public.automation_rules
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  madrasa_id UUID NOT NULL REFERENCES public.madrasas(id) ON DELETE CASCADE,
  rule_key VARCHAR(80) NOT NULL,
  name TEXT NOT NULL,
  name_bn TEXT,
  description TEXT,
  cron_expression VARCHAR(80) NOT NULL DEFAULT '0 6 1 * *',
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (madrasa_id, rule_key)
);

CREATE INDEX IF NOT EXISTS idx_automation_rules_madrasa_enabled
  ON public.automation_rules (madrasa_id, is_enabled);

ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage automation_rules in same madrasa" ON public.automation_rules;
CREATE POLICY "Users can manage automation_rules in same madrasa"
  ON public.automation_rules
  FOR ALL
  USING (madrasa_id = public.get_auth_madrasa_id())
  WITH CHECK (madrasa_id = public.get_auth_madrasa_id());

-- ----------------------------------------------------------------------------
-- 2. Feature 2.1: public.job_execution_logs
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.job_execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  madrasa_id UUID NOT NULL REFERENCES public.madrasas(id) ON DELETE CASCADE,
  job_key VARCHAR(80) NOT NULL,
  trigger_source VARCHAR(30) NOT NULL DEFAULT 'cron',
  status VARCHAR(30) NOT NULL DEFAULT 'RUNNING',
  started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  finished_at TIMESTAMPTZ,
  duration_ms INT,
  processed_count INT NOT NULL DEFAULT 0,
  success_count INT NOT NULL DEFAULT 0,
  failed_count INT NOT NULL DEFAULT 0,
  summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_job_execution_logs_madrasa_job_created
  ON public.job_execution_logs (madrasa_id, job_key, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_job_execution_logs_madrasa_status
  ON public.job_execution_logs (madrasa_id, status, created_at DESC);

ALTER TABLE public.job_execution_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage job_execution_logs in same madrasa" ON public.job_execution_logs;
CREATE POLICY "Users can manage job_execution_logs in same madrasa"
  ON public.job_execution_logs
  FOR ALL
  USING (madrasa_id = public.get_auth_madrasa_id())
  WITH CHECK (madrasa_id = public.get_auth_madrasa_id());

-- ----------------------------------------------------------------------------
-- 3. Feature 2.2: public.notification_templates
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  madrasa_id UUID NOT NULL REFERENCES public.madrasas(id) ON DELETE CASCADE,
  template_key VARCHAR(80) NOT NULL,
  event_name VARCHAR(80) NOT NULL,
  title TEXT NOT NULL,
  title_bn TEXT,
  channel VARCHAR(30) NOT NULL DEFAULT 'sms',
  subject TEXT,
  body TEXT NOT NULL,
  variables JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (madrasa_id, template_key, channel)
);

CREATE INDEX IF NOT EXISTS idx_notification_templates_madrasa_event
  ON public.notification_templates (madrasa_id, event_name, is_active);

ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage notification_templates in same madrasa" ON public.notification_templates;
CREATE POLICY "Users can manage notification_templates in same madrasa"
  ON public.notification_templates
  FOR ALL
  USING (madrasa_id = public.get_auth_madrasa_id())
  WITH CHECK (madrasa_id = public.get_auth_madrasa_id());

-- ----------------------------------------------------------------------------
-- 4. Feature 2.2: public.notification_queue
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  madrasa_id UUID NOT NULL REFERENCES public.madrasas(id) ON DELETE CASCADE,
  event_name VARCHAR(80) NOT NULL,
  template_id UUID REFERENCES public.notification_templates(id) ON DELETE SET NULL,
  recipient_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient_phone VARCHAR(40),
  recipient_email TEXT,
  recipient_token TEXT,
  channel VARCHAR(30) NOT NULL,
  fallback_channels JSONB NOT NULL DEFAULT '[]'::jsonb,
  subject TEXT,
  body TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  last_error TEXT,
  provider_response JSONB,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_notification_queue_madrasa_status
  ON public.notification_queue (madrasa_id, status, next_retry_at);

CREATE INDEX IF NOT EXISTS idx_notification_queue_status_created
  ON public.notification_queue (status, created_at ASC);

ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage notification_queue in same madrasa" ON public.notification_queue;
CREATE POLICY "Users can manage notification_queue in same madrasa"
  ON public.notification_queue
  FOR ALL
  USING (madrasa_id = public.get_auth_madrasa_id())
  WITH CHECK (madrasa_id = public.get_auth_madrasa_id());

-- ----------------------------------------------------------------------------
-- 5. Feature 2.2: public.notification_device_tokens
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  madrasa_id UUID NOT NULL REFERENCES public.madrasas(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  platform VARCHAR(30) NOT NULL DEFAULT 'android',
  token TEXT NOT NULL,
  device_id TEXT,
  device_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (madrasa_id, token)
);

CREATE INDEX IF NOT EXISTS idx_notification_device_tokens_madrasa_user
  ON public.notification_device_tokens (madrasa_id, user_id, is_active);

ALTER TABLE public.notification_device_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage notification_device_tokens in same madrasa" ON public.notification_device_tokens;
CREATE POLICY "Users can manage notification_device_tokens in same madrasa"
  ON public.notification_device_tokens
  FOR ALL
  USING (madrasa_id = public.get_auth_madrasa_id())
  WITH CHECK (madrasa_id = public.get_auth_madrasa_id());

-- ----------------------------------------------------------------------------
-- 6. Feature 2.3 Prep: public.digest_schedules
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.digest_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  madrasa_id UUID NOT NULL REFERENCES public.madrasas(id) ON DELETE CASCADE,
  schedule_key VARCHAR(80) NOT NULL,
  name TEXT NOT NULL,
  frequency VARCHAR(30) NOT NULL DEFAULT 'weekly',
  day_of_week INT DEFAULT 5,
  day_of_month INT DEFAULT 1,
  recipients JSONB NOT NULL DEFAULT '[]'::jsonb,
  include_sections JSONB NOT NULL DEFAULT '["boarding","funds","dues","exams"]'::jsonb,
  format VARCHAR(20) NOT NULL DEFAULT 'html',
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  last_sent_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (madrasa_id, schedule_key)
);

CREATE INDEX IF NOT EXISTS idx_digest_schedules_madrasa_enabled
  ON public.digest_schedules (madrasa_id, is_enabled);

ALTER TABLE public.digest_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage digest_schedules in same madrasa" ON public.digest_schedules;
CREATE POLICY "Users can manage digest_schedules in same madrasa"
  ON public.digest_schedules
  FOR ALL
  USING (madrasa_id = public.get_auth_madrasa_id())
  WITH CHECK (madrasa_id = public.get_auth_madrasa_id());

-- ----------------------------------------------------------------------------
-- 7. Feature 2.4: public.webhook_endpoints
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  madrasa_id UUID NOT NULL REFERENCES public.madrasas(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  signing_secret TEXT NOT NULL,
  subscribed_events JSONB NOT NULL DEFAULT '[]'::jsonb,
  headers JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  max_retries INT NOT NULL DEFAULT 5,
  timeout_ms INT NOT NULL DEFAULT 10000,
  description TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_madrasa_active
  ON public.webhook_endpoints (madrasa_id, is_active);

ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage webhook_endpoints in same madrasa" ON public.webhook_endpoints;
CREATE POLICY "Users can manage webhook_endpoints in same madrasa"
  ON public.webhook_endpoints
  FOR ALL
  USING (madrasa_id = public.get_auth_madrasa_id())
  WITH CHECK (madrasa_id = public.get_auth_madrasa_id());

-- ----------------------------------------------------------------------------
-- 8. Feature 2.4: public.webhook_deliveries
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  madrasa_id UUID NOT NULL REFERENCES public.madrasas(id) ON DELETE CASCADE,
  endpoint_id UUID NOT NULL REFERENCES public.webhook_endpoints(id) ON DELETE CASCADE,
  event_type VARCHAR(80) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  signature_header TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  attempt_count INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 5,
  next_retry_at TIMESTAMPTZ,
  response_status INT,
  response_body TEXT,
  error_message TEXT,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_madrasa_status
  ON public.webhook_deliveries (madrasa_id, status, next_retry_at);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_endpoint_created
  ON public.webhook_deliveries (endpoint_id, created_at DESC);

ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage webhook_deliveries in same madrasa" ON public.webhook_deliveries;
CREATE POLICY "Users can manage webhook_deliveries in same madrasa"
  ON public.webhook_deliveries
  FOR ALL
  USING (madrasa_id = public.get_auth_madrasa_id())
  WITH CHECK (madrasa_id = public.get_auth_madrasa_id());

-- ----------------------------------------------------------------------------
-- 9. Feature 2.3: 4 Materialized Views (verified SQL columns)
-- ----------------------------------------------------------------------------

-- 9a. mv_bi_boarding_monthly: Boarding bazar expense vs active meal count & boarding fee income
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_bi_boarding_monthly AS
WITH bazar_monthly AS (
  SELECT
    madrasa_id,
    to_char(expense_date, 'YYYY-MM') AS month_key,
    COALESCE(SUM(amount), 0)::numeric(14,2) AS total_bazar_expense
  FROM public.bazar_expenses
  WHERE madrasa_id IS NOT NULL
  GROUP BY madrasa_id, to_char(expense_date, 'YYYY-MM')
),
meals_monthly AS (
  SELECT
    madrasa_id,
    to_char(entry_date, 'YYYY-MM') AS month_key,
    COUNT(*) FILTER (WHERE meal_status = 'On')::bigint AS active_meal_days,
    COUNT(DISTINCT student_id) FILTER (WHERE meal_status = 'On')::bigint AS active_boarders
  FROM public.meal_entries
  WHERE madrasa_id IS NOT NULL
  GROUP BY madrasa_id, to_char(entry_date, 'YYYY-MM')
),
boarding_fees_monthly AS (
  SELECT
    madrasa_id,
    to_char(created_at, 'YYYY-MM') AS month_key,
    COALESCE(SUM(paid_amount), 0)::numeric(14,2) AS boarding_fee_income
  FROM public.student_fees
  WHERE madrasa_id IS NOT NULL
    AND (
      fee_type_name ILIKE '%বোর্ডিং%'
      OR fee_type_name ILIKE '%খাবার%'
      OR fee_type_name ILIKE '%boarding%'
      OR fee_type_name ILIKE '%meal%'
    )
  GROUP BY madrasa_id, to_char(created_at, 'YYYY-MM')
),
all_keys AS (
  SELECT madrasa_id, month_key FROM bazar_monthly
  UNION
  SELECT madrasa_id, month_key FROM meals_monthly
  UNION
  SELECT madrasa_id, month_key FROM boarding_fees_monthly
)
SELECT
  k.madrasa_id,
  k.month_key,
  COALESCE(b.total_bazar_expense, 0)::numeric(14,2) AS total_bazar_expense,
  COALESCE(m.active_meal_days, 0)::bigint AS active_meal_days,
  COALESCE(m.active_boarders, 0)::bigint AS active_boarders,
  COALESCE(f.boarding_fee_income, 0)::numeric(14,2) AS boarding_fee_income,
  CASE
    WHEN COALESCE(m.active_boarders, 0) > 0
      THEN ROUND(COALESCE(b.total_bazar_expense, 0) / m.active_boarders, 2)
    ELSE 0::numeric(14,2)
  END AS per_capita_bazar_cost
FROM all_keys k
LEFT JOIN bazar_monthly b ON b.madrasa_id = k.madrasa_id AND b.month_key = k.month_key
LEFT JOIN meals_monthly m ON m.madrasa_id = k.madrasa_id AND m.month_key = k.month_key
LEFT JOIN boarding_fees_monthly f ON f.madrasa_id = k.madrasa_id AND f.month_key = k.month_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_bi_boarding_monthly_pk
  ON public.mv_bi_boarding_monthly (madrasa_id, month_key);

-- 9b. mv_bi_fund_health: Zakat & donation fund balances and progress
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_bi_fund_health AS
SELECT
  zf.madrasa_id,
  zf.id AS fund_id,
  zf.name AS fund_name,
  zf.code AS fund_code,
  zf.category,
  COALESCE(zf.target_amount, 0)::numeric(14,2) AS target_amount,
  COALESCE(zf.current_balance, 0)::numeric(14,2) AS current_balance,
  zf.is_active,
  CASE
    WHEN COALESCE(zf.target_amount, 0) > 0
      THEN ROUND((COALESCE(zf.current_balance, 0) / zf.target_amount) * 100, 2)
    ELSE 0::numeric(6,2)
  END AS target_attainment_pct
FROM public.zakat_funds zf
WHERE zf.madrasa_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_bi_fund_health_pk
  ON public.mv_bi_fund_health (madrasa_id, fund_id);

-- 9c. mv_bi_class_fee_dues: Class/Jamat-wise fee billing, collection, and due ratio
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_bi_class_fee_dues AS
SELECT
  sf.madrasa_id,
  sf.session_id,
  COALESCE(NULLIF(sf.class_id, ''), NULLIF(sf.class_name, ''), 'UNASSIGNED') AS class_key,
  COALESCE(MAX(sf.class_name), 'সাধারণ জামাত') AS class_name,
  COUNT(DISTINCT sf.student_id)::bigint AS student_count,
  COALESCE(SUM(sf.payable_amount), 0)::numeric(14,2) AS total_payable,
  COALESCE(SUM(sf.paid_amount), 0)::numeric(14,2) AS total_paid,
  COALESCE(SUM(sf.due_amount), 0)::numeric(14,2) AS total_due,
  CASE
    WHEN COALESCE(SUM(sf.payable_amount), 0) > 0
      THEN ROUND((COALESCE(SUM(sf.due_amount), 0) / SUM(sf.payable_amount)) * 100, 2)
    ELSE 0::numeric(6,2)
  END AS due_ratio_pct
FROM public.student_fees sf
WHERE sf.madrasa_id IS NOT NULL
GROUP BY sf.madrasa_id, sf.session_id, COALESCE(NULLIF(sf.class_id, ''), NULLIF(sf.class_name, ''), 'UNASSIGNED');

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_bi_class_fee_dues_pk
  ON public.mv_bi_class_fee_dues (madrasa_id, session_id, class_key);

-- 9d. mv_bi_session_exam_results: Session-to-session / exam-to-exam average score & pass rate
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_bi_session_exam_results AS
SELECT
  e.madrasa_id,
  e.id AS exam_id,
  e.title AS exam_title,
  e.year AS exam_year,
  e.status AS exam_status,
  COUNT(er.id)::bigint AS result_entries,
  COUNT(DISTINCT er.student_id)::bigint AS examined_students,
  CASE
    WHEN COUNT(er.id) > 0
      THEN ROUND(AVG(CASE WHEN er.total_marks > 0 THEN (er.marks_obtained / er.total_marks) * 100 ELSE 0 END), 2)
    ELSE 0::numeric(6,2)
  END AS avg_percentage,
  CASE
    WHEN COUNT(er.id) > 0
      THEN ROUND((COUNT(*) FILTER (WHERE er.total_marks > 0 AND (er.marks_obtained / er.total_marks) >= 0.33)::numeric / COUNT(er.id)::numeric) * 100, 2)
    ELSE 0::numeric(6,2)
  END AS pass_rate_pct
FROM public.exams e
LEFT JOIN public.exam_results er
  ON er.exam_id = e.id AND er.madrasa_id = e.madrasa_id
WHERE e.madrasa_id IS NOT NULL
GROUP BY e.madrasa_id, e.id, e.title, e.year, e.status;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_bi_session_exam_results_pk
  ON public.mv_bi_session_exam_results (madrasa_id, exam_id);

-- ----------------------------------------------------------------------------
-- 10. Feature 2.3: 2 RPC Functions
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refresh_bi_materialized_views()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_bi_boarding_monthly;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_bi_fund_health;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_bi_class_fee_dues;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_bi_session_exam_results;
EXCEPTION
  WHEN OTHERS THEN
    -- Fallback to non-concurrent refresh if MV has never been populated or lock prevents concurrent
    REFRESH MATERIALIZED VIEW public.mv_bi_boarding_monthly;
    REFRESH MATERIALIZED VIEW public.mv_bi_fund_health;
    REFRESH MATERIALIZED VIEW public.mv_bi_class_fee_dues;
    REFRESH MATERIALIZED VIEW public.mv_bi_session_exam_results;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_executive_bi_snapshot(
  p_madrasa_id UUID,
  p_months INT DEFAULT 6,
  p_session_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_boarding JSONB;
  v_funds JSONB;
  v_class_dues JSONB;
  v_exam_results JSONB;
  v_collections_total NUMERIC(14,2);
  v_limit_months INT := GREATEST(1, LEAST(COALESCE(p_months, 6), 36));
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.month_key DESC), '[]'::jsonb)
  INTO v_boarding
  FROM (
    SELECT month_key, total_bazar_expense, active_meal_days, active_boarders, boarding_fee_income, per_capita_bazar_cost
    FROM public.mv_bi_boarding_monthly
    WHERE madrasa_id = p_madrasa_id
    ORDER BY month_key DESC
    LIMIT v_limit_months
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO v_funds
  FROM (
    SELECT fund_id, fund_name, fund_code, category, target_amount, current_balance, is_active, target_attainment_pct
    FROM public.mv_bi_fund_health
    WHERE madrasa_id = p_madrasa_id
    ORDER BY current_balance DESC
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO v_class_dues
  FROM (
    SELECT session_id, class_key, class_name, student_count, total_payable, total_paid, total_due, due_ratio_pct
    FROM public.mv_bi_class_fee_dues
    WHERE madrasa_id = p_madrasa_id
      AND (p_session_id IS NULL OR session_id = p_session_id)
    ORDER BY total_due DESC
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  INTO v_exam_results
  FROM (
    SELECT exam_id, exam_title, exam_year, exam_status, result_entries, examined_students, avg_percentage, pass_rate_pct
    FROM public.mv_bi_session_exam_results
    WHERE madrasa_id = p_madrasa_id
    ORDER BY exam_year DESC, exam_title ASC
  ) t;

  SELECT COALESCE(SUM(total_amount_received), 0)::numeric(14,2)
  INTO v_collections_total
  FROM public.fee_payments
  WHERE madrasa_id = p_madrasa_id
    AND status = 'COMPLETED'
    AND (p_session_id IS NULL OR session_id = p_session_id);

  RETURN jsonb_build_object(
    'madrasa_id', p_madrasa_id,
    'months', v_limit_months,
    'session_id', p_session_id,
    'total_fee_collections', COALESCE(v_collections_total, 0),
    'boarding_monthly', v_boarding,
    'fund_health', v_funds,
    'class_fee_dues', v_class_dues,
    'session_exam_results', v_exam_results,
    'generated_at', timezone('utc'::text, now())
  );
END;
$$;
