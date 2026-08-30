-- =====================================================================
-- Phase B Migration: Relational Schema for Academic, Fees, Zakat & Settings
-- =====================================================================

-- 1. MADRASA PROFILES & EXPANSION
ALTER TABLE public.madrasas ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE public.madrasas ADD COLUMN IF NOT EXISTS established_year TEXT;
ALTER TABLE public.madrasas ADD COLUMN IF NOT EXISTS principal_name TEXT;
ALTER TABLE public.madrasas ADD COLUMN IF NOT EXISTS signature_url TEXT;
ALTER TABLE public.madrasas ADD COLUMN IF NOT EXISTS eiin_code TEXT;
ALTER TABLE public.madrasas ADD COLUMN IF NOT EXISTS slogan TEXT;
ALTER TABLE public.madrasas ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE public.madrasas ADD COLUMN IF NOT EXISTS reg_no TEXT;
ALTER TABLE public.madrasas ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.madrasas ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.madrasas ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.madrasas ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'BDT';
ALTER TABLE public.madrasas ADD COLUMN IF NOT EXISTS weekend_days TEXT[] DEFAULT ARRAY['Friday'];

-- 2. ACADEMIC SESSIONS (শিক্ষাবর্ষ)
CREATE TABLE IF NOT EXISTS public.academic_sessions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  madrasa_id UUID NOT NULL REFERENCES public.madrasas(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code VARCHAR(50),
  hijri_year VARCHAR(50),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, ARCHIVED, UPCOMING
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_academic_sessions_madrasa ON public.academic_sessions(madrasa_id);
CREATE INDEX IF NOT EXISTS idx_academic_sessions_active ON public.academic_sessions(madrasa_id, is_active);

ALTER TABLE public.academic_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage academic_sessions in same madrasa" ON public.academic_sessions;
CREATE POLICY "Users can manage academic_sessions in same madrasa" ON public.academic_sessions
  FOR ALL USING (madrasa_id = public.get_auth_madrasa_id());

-- 3. STUDENT ENROLLMENTS (শিক্ষার্থী এনরোলমেন্ট)
CREATE TABLE IF NOT EXISTS public.student_enrollments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  madrasa_id UUID NOT NULL REFERENCES public.madrasas(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL REFERENCES public.academic_sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id TEXT NOT NULL,
  roll_number TEXT,
  section TEXT,
  enrollment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, PROMOTED, TRANSFERRED, DROPPED
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(session_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_student_enrollments_madrasa ON public.student_enrollments(madrasa_id);
CREATE INDEX IF NOT EXISTS idx_student_enrollments_session_class ON public.student_enrollments(session_id, class_id);
CREATE INDEX IF NOT EXISTS idx_student_enrollments_student ON public.student_enrollments(student_id);

ALTER TABLE public.student_enrollments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage student_enrollments in same madrasa" ON public.student_enrollments;
CREATE POLICY "Users can manage student_enrollments in same madrasa" ON public.student_enrollments
  FOR ALL USING (madrasa_id = public.get_auth_madrasa_id());

-- 4. FEE TYPES (ফি খাতসমূহ)
CREATE TABLE IF NOT EXISTS public.fee_types (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  madrasa_id UUID NOT NULL REFERENCES public.madrasas(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code VARCHAR(50) NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'ACADEMIC', -- ACADEMIC, BOARDING, ADMINISTRATIVE, OTHER
  frequency VARCHAR(50) NOT NULL DEFAULT 'MONTHLY', -- ONETIME, MONTHLY, TERM, YEARLY
  default_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_fee_types_madrasa ON public.fee_types(madrasa_id);
CREATE INDEX IF NOT EXISTS idx_fee_types_active ON public.fee_types(madrasa_id, is_active);

ALTER TABLE public.fee_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage fee_types in same madrasa" ON public.fee_types;
CREATE POLICY "Users can manage fee_types in same madrasa" ON public.fee_types
  FOR ALL USING (madrasa_id = public.get_auth_madrasa_id());

-- 5. FEE STRUCTURES & ITEMS (ফি কাঠামো)
CREATE TABLE IF NOT EXISTS public.fee_structures (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  madrasa_id UUID NOT NULL REFERENCES public.madrasas(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  class_id TEXT NOT NULL,
  class_name TEXT NOT NULL,
  student_category VARCHAR(50) NOT NULL DEFAULT 'ALL', -- ALL, RESIDENTIAL, NON_RESIDENTIAL, ORPHAN, DAY_CARE
  name TEXT NOT NULL,
  total_monthly_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_onetime_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_fee_structures_madrasa ON public.fee_structures(madrasa_id);
CREATE INDEX IF NOT EXISTS idx_fee_structures_session_class ON public.fee_structures(madrasa_id, session_id, class_id);

ALTER TABLE public.fee_structures ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage fee_structures in same madrasa" ON public.fee_structures;
CREATE POLICY "Users can manage fee_structures in same madrasa" ON public.fee_structures
  FOR ALL USING (madrasa_id = public.get_auth_madrasa_id());

CREATE TABLE IF NOT EXISTS public.fee_structure_items (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  structure_id TEXT NOT NULL REFERENCES public.fee_structures(id) ON DELETE CASCADE,
  fee_type_id TEXT REFERENCES public.fee_types(id) ON DELETE SET NULL,
  fee_type_name TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  frequency VARCHAR(50) NOT NULL DEFAULT 'MONTHLY',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_fee_structure_items_struct ON public.fee_structure_items(structure_id);

ALTER TABLE public.fee_structure_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage fee_structure_items in same madrasa" ON public.fee_structure_items;
CREATE POLICY "Users can manage fee_structure_items in same madrasa" ON public.fee_structure_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.fee_structures fs 
      WHERE fs.id = fee_structure_items.structure_id 
      AND fs.madrasa_id = public.get_auth_madrasa_id()
    )
  );

-- 6. STUDENT FEES (শিক্ষার্থীর ফি ইনভয়েস/বিল)
CREATE TABLE IF NOT EXISTS public.student_fees (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  madrasa_id UUID NOT NULL REFERENCES public.madrasas(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  student_name TEXT,
  student_roll TEXT,
  class_id TEXT,
  class_name TEXT,
  fee_type_id TEXT NOT NULL REFERENCES public.fee_types(id) ON DELETE RESTRICT,
  fee_type_name TEXT NOT NULL,
  billing_period TEXT NOT NULL, -- e.g. "মহররম ১৪৪৭" or "January 2026"
  month_name TEXT,
  year TEXT,
  due_date DATE,
  base_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  discount_reason TEXT,
  fine_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  fine_reason TEXT,
  payable_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  due_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'UNPAID', -- UNPAID, PARTIAL, PAID, OVERDUE, WAIVED
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(madrasa_id, session_id, student_id, fee_type_id, billing_period)
);

CREATE INDEX IF NOT EXISTS idx_student_fees_madrasa ON public.student_fees(madrasa_id);
CREATE INDEX IF NOT EXISTS idx_student_fees_student ON public.student_fees(madrasa_id, student_id);
CREATE INDEX IF NOT EXISTS idx_student_fees_period ON public.student_fees(madrasa_id, session_id, billing_period);
CREATE INDEX IF NOT EXISTS idx_student_fees_status ON public.student_fees(madrasa_id, status);

ALTER TABLE public.student_fees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage student_fees in same madrasa" ON public.student_fees;
CREATE POLICY "Users can manage student_fees in same madrasa" ON public.student_fees
  FOR ALL USING (madrasa_id = public.get_auth_madrasa_id());

-- 7. FEE PAYMENTS & ALLOCATIONS (কালেকশন ও রসিদ)
CREATE TABLE IF NOT EXISTS public.fee_payments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  receipt_no VARCHAR(100) NOT NULL,
  madrasa_id UUID NOT NULL REFERENCES public.madrasas(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  student_roll TEXT,
  class_name TEXT,
  total_amount_received NUMERIC(12, 2) NOT NULL DEFAULT 0,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method VARCHAR(50) NOT NULL DEFAULT 'Cash',
  transaction_ref TEXT,
  discount_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  fine_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
  advance_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  collector_name TEXT NOT NULL DEFAULT 'Admin',
  notes TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'COMPLETED', -- COMPLETED, REVERSED, VOID
  reversal_reason TEXT,
  reversed_at TIMESTAMPTZ,
  reversed_by TEXT,
  idempotency_key VARCHAR(150),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(madrasa_id, receipt_no)
);

CREATE INDEX IF NOT EXISTS idx_fee_payments_madrasa ON public.fee_payments(madrasa_id);
CREATE INDEX IF NOT EXISTS idx_fee_payments_student ON public.fee_payments(madrasa_id, student_id);
CREATE INDEX IF NOT EXISTS idx_fee_payments_date ON public.fee_payments(madrasa_id, payment_date DESC);

ALTER TABLE public.fee_payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage fee_payments in same madrasa" ON public.fee_payments;
CREATE POLICY "Users can manage fee_payments in same madrasa" ON public.fee_payments
  FOR ALL USING (madrasa_id = public.get_auth_madrasa_id());

CREATE TABLE IF NOT EXISTS public.fee_payment_allocations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  payment_id TEXT NOT NULL REFERENCES public.fee_payments(id) ON DELETE CASCADE,
  student_fee_id TEXT REFERENCES public.student_fees(id) ON DELETE SET NULL,
  fee_type_id TEXT REFERENCES public.fee_types(id) ON DELETE SET NULL,
  fee_type_name TEXT NOT NULL,
  billing_period TEXT,
  allocated_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  discount_applied NUMERIC(12, 2) NOT NULL DEFAULT 0,
  fine_applied NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_fee_payment_alloc_payment ON public.fee_payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_fee_payment_alloc_fee ON public.fee_payment_allocations(student_fee_id);

ALTER TABLE public.fee_payment_allocations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage fee_payment_allocations in same madrasa" ON public.fee_payment_allocations;
CREATE POLICY "Users can manage fee_payment_allocations in same madrasa" ON public.fee_payment_allocations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.fee_payments fp 
      WHERE fp.id = fee_payment_allocations.payment_id 
      AND fp.madrasa_id = public.get_auth_madrasa_id()
    )
  );

-- 8. FEE DISCOUNT WAIVERS & AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.fee_discount_waivers (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  madrasa_id UUID NOT NULL REFERENCES public.madrasas(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  discount_type VARCHAR(50) NOT NULL, -- FIXED, PERCENTAGE, SCHOLARSHIP, FULL_WAIVER
  value NUMERIC(12, 2) NOT NULL DEFAULT 0,
  fee_type_id TEXT REFERENCES public.fee_types(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'APPROVED', -- APPROVED, PENDING, REJECTED
  approved_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_fee_discounts_madrasa ON public.fee_discount_waivers(madrasa_id);
CREATE INDEX IF NOT EXISTS idx_fee_discounts_student ON public.fee_discount_waivers(madrasa_id, student_id);

ALTER TABLE public.fee_discount_waivers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage fee_discount_waivers in same madrasa" ON public.fee_discount_waivers;
CREATE POLICY "Users can manage fee_discount_waivers in same madrasa" ON public.fee_discount_waivers
  FOR ALL USING (madrasa_id = public.get_auth_madrasa_id());

CREATE TABLE IF NOT EXISTS public.fee_audit_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  madrasa_id UUID NOT NULL REFERENCES public.madrasas(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  user_name TEXT NOT NULL,
  user_role VARCHAR(50) NOT NULL,
  record_id TEXT,
  details TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_fee_audit_logs_madrasa_time ON public.fee_audit_logs(madrasa_id, created_at DESC);

ALTER TABLE public.fee_audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage fee_audit_logs in same madrasa" ON public.fee_audit_logs;
CREATE POLICY "Users can manage fee_audit_logs in same madrasa" ON public.fee_audit_logs
  FOR ALL USING (madrasa_id = public.get_auth_madrasa_id());

-- 9. ZAKAT FUNDS (জাকাত ও দান তহবিল)
CREATE TABLE IF NOT EXISTS public.zakat_funds (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  madrasa_id UUID NOT NULL REFERENCES public.madrasas(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code VARCHAR(50) NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'General',
  description TEXT,
  target_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  current_balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_zakat_funds_madrasa ON public.zakat_funds(madrasa_id);
CREATE INDEX IF NOT EXISTS idx_zakat_funds_active ON public.zakat_funds(madrasa_id, is_active);

ALTER TABLE public.zakat_funds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage zakat_funds in same madrasa" ON public.zakat_funds;
CREATE POLICY "Users can manage zakat_funds in same madrasa" ON public.zakat_funds
  FOR ALL USING (madrasa_id = public.get_auth_madrasa_id());
