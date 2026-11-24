-- ============================================================================
-- QawmiERP V2.0 — Performance Composite Indexes Migration (Stage 1 / Phase 4)
-- Non-destructive additive composite indexes for hot multi-tenant queries
-- Safe to run multiple times (idempotent via CREATE INDEX IF NOT EXISTS)
-- ============================================================================

-- 1. Attendance composite indexes
CREATE INDEX IF NOT EXISTS idx_attendance_madrasa_date
  ON public.attendance (madrasa_id, date);

CREATE INDEX IF NOT EXISTS idx_attendance_madrasa_student_date_desc
  ON public.attendance (madrasa_id, student_id, date DESC);

-- 2. Hifz daily logs composite indexes
CREATE INDEX IF NOT EXISTS idx_hifz_logs_madrasa_student_log_date_desc
  ON public.hifz_logs (madrasa_id, student_id, log_date DESC);

CREATE INDEX IF NOT EXISTS idx_hifz_logs_madrasa_log_date_desc
  ON public.hifz_logs (madrasa_id, log_date DESC);

-- 3. Kitab daily logs composite index
CREATE INDEX IF NOT EXISTS idx_kitab_logs_madrasa_student_log_date_desc
  ON public.kitab_logs (madrasa_id, student_id, log_date DESC);

-- 4. Fee payments composite indexes (ensure idempotency_key column exists on older schemas)
ALTER TABLE public.fee_payments
  ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(150);

CREATE INDEX IF NOT EXISTS idx_fee_payments_madrasa_idempotency_key
  ON public.fee_payments (madrasa_id, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_fee_payments_madrasa_created_at_desc
  ON public.fee_payments (madrasa_id, created_at DESC);
