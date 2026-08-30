-- Create madrasas table
CREATE TABLE IF NOT EXISTS public.madrasas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  subscription_plan TEXT DEFAULT 'free',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create users table
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  madrasa_id UUID REFERENCES public.madrasas(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'staff', -- e.g., super_admin, admin, teacher, staff
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create students table
CREATE TABLE IF NOT EXISTS public.students (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  madrasa_id UUID REFERENCES public.madrasas(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  roll_number TEXT,
  class_name TEXT,
  parent_phone TEXT,
  father_name TEXT,
  address TEXT,
  photo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create teachers table
CREATE TABLE IF NOT EXISTS public.teachers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  madrasa_id UUID REFERENCES public.madrasas(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  designation TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.madrasas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;

-- Create a function to get the current user's madrasa_id without triggering RLS
CREATE OR REPLACE FUNCTION public.get_auth_madrasa_id()
RETURNS UUID AS $$
  SELECT madrasa_id FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- Drop existing policies to prevent errors when recreating
DROP POLICY IF EXISTS "Users can view their own madrasa" ON public.madrasas;
DROP POLICY IF EXISTS "Users can view users in same madrasa" ON public.users;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can view students in same madrasa" ON public.students;
DROP POLICY IF EXISTS "Users can view teachers in same madrasa" ON public.teachers;
DROP POLICY IF EXISTS "Users can manage students in same madrasa" ON public.students;
DROP POLICY IF EXISTS "Users can manage teachers in same madrasa" ON public.teachers;

-- Create basic policies using the secure function
CREATE POLICY "Users can view their own madrasa" ON public.madrasas
  FOR SELECT USING (
    id = public.get_auth_madrasa_id()
  );

CREATE POLICY "Users can view their own profile" ON public.users
  FOR SELECT USING (
    id = auth.uid()
  );

CREATE POLICY "Users can manage students in same madrasa" ON public.students
  FOR ALL USING (
    madrasa_id = public.get_auth_madrasa_id()
  );

CREATE POLICY "Users can manage teachers in same madrasa" ON public.teachers
  FOR ALL USING (
    madrasa_id = public.get_auth_madrasa_id()
  );

-- Create attendance table
CREATE TABLE IF NOT EXISTS public.attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  madrasa_id UUID REFERENCES public.madrasas(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL, -- Present, Absent, Late, Leave
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(student_id, date)
);

-- Create hifz_logs table
CREATE TABLE IF NOT EXISTS public.hifz_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  madrasa_id UUID REFERENCES public.madrasas(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  sabak_para INTEGER, -- 1-30
  sabak_page INTEGER,
  saboki_para INTEGER,
  amukhta_para INTEGER,
  performance_rating TEXT, -- Excellent, Good, Average, Poor
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(student_id, log_date)
);

-- Enable RLS
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hifz_logs ENABLE ROW LEVEL SECURITY;

-- Policies for new tables
DROP POLICY IF EXISTS "Users can manage attendance in same madrasa" ON public.attendance;
DROP POLICY IF EXISTS "Users can manage hifz logs in same madrasa" ON public.hifz_logs;

CREATE POLICY "Users can manage attendance in same madrasa" ON public.attendance
  FOR ALL USING (
    madrasa_id = public.get_auth_madrasa_id()
  );

CREATE POLICY "Users can manage hifz logs in same madrasa" ON public.hifz_logs
  FOR ALL USING (
    madrasa_id = public.get_auth_madrasa_id()
  );

-- Create kitab_logs table
CREATE TABLE IF NOT EXISTS public.kitab_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  madrasa_id UUID REFERENCES public.madrasas(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  kitab_name TEXT NOT NULL,
  page_from TEXT,
  page_to TEXT,
  performance_rating TEXT, -- Excellent, Good, Average, Poor
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.kitab_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage kitab logs in same madrasa" ON public.kitab_logs;
CREATE POLICY "Users can manage kitab logs in same madrasa" ON public.kitab_logs
  FOR ALL USING (
    madrasa_id = public.get_auth_madrasa_id()
  );

-- Create teacher_attendance table
CREATE TABLE IF NOT EXISTS public.teacher_attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  madrasa_id UUID REFERENCES public.madrasas(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES public.teachers(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL, -- Present, Absent, Late, Leave
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(teacher_id, date)
);

ALTER TABLE public.teacher_attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage teacher attendance in same madrasa" ON public.teacher_attendance;
CREATE POLICY "Users can manage teacher attendance in same madrasa" ON public.teacher_attendance
  FOR ALL USING (
    madrasa_id = public.get_auth_madrasa_id()
  );

-- Create fees table
CREATE TABLE IF NOT EXISTS public.fees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  madrasa_id UUID REFERENCES public.madrasas(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  fee_type TEXT NOT NULL, -- Admission, Monthly, Exam, Other
  amount DECIMAL(10, 2) NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  fee_month TEXT,
  fee_year TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.fees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage fees in same madrasa" ON public.fees;
CREATE POLICY "Users can manage fees in same madrasa" ON public.fees
  FOR ALL USING (
    madrasa_id = public.get_auth_madrasa_id()
  );

-- Create expenses table
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  madrasa_id UUID REFERENCES public.madrasas(id) ON DELETE CASCADE,
  category TEXT NOT NULL, -- Salary, Utility, Food, Maintenance, Other
  amount DECIMAL(10, 2) NOT NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage expenses in same madrasa" ON public.expenses;
CREATE POLICY "Users can manage expenses in same madrasa" ON public.expenses
  FOR ALL USING (
    madrasa_id = public.get_auth_madrasa_id()
  );

-- Create exams table
CREATE TABLE IF NOT EXISTS public.exams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  madrasa_id UUID REFERENCES public.madrasas(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  year TEXT NOT NULL,
  start_date DATE,
  status TEXT DEFAULT 'Upcoming', -- Upcoming, Ongoing, Completed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage exams in same madrasa" ON public.exams;
CREATE POLICY "Users can manage exams in same madrasa" ON public.exams
  FOR ALL USING (
    madrasa_id = public.get_auth_madrasa_id()
  );

-- Create exam_results table
CREATE TABLE IF NOT EXISTS public.exam_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  madrasa_id UUID REFERENCES public.madrasas(id) ON DELETE CASCADE,
  exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  subject_name TEXT NOT NULL,
  marks_obtained DECIMAL(5, 2) NOT NULL,
  total_marks DECIMAL(5, 2) NOT NULL DEFAULT 100,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(exam_id, student_id, subject_name)
);

ALTER TABLE public.exam_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage exam results in same madrasa" ON public.exam_results;
CREATE POLICY "Users can manage exam results in same madrasa" ON public.exam_results
  FOR ALL USING (
    madrasa_id = public.get_auth_madrasa_id()
  );

-- Create classes table
CREATE TABLE IF NOT EXISTS public.classes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  madrasa_id UUID REFERENCES public.madrasas(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage classes in same madrasa" ON public.classes;
CREATE POLICY "Users can manage classes in same madrasa" ON public.classes
  FOR ALL USING (madrasa_id = public.get_auth_madrasa_id());

-- Create subjects table
CREATE TABLE IF NOT EXISTS public.subjects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  madrasa_id UUID REFERENCES public.madrasas(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage subjects in same madrasa" ON public.subjects;
CREATE POLICY "Users can manage subjects in same madrasa" ON public.subjects
  FOR ALL USING (madrasa_id = public.get_auth_madrasa_id());

-- Create class_subjects table
CREATE TABLE IF NOT EXISTS public.class_subjects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  madrasa_id UUID REFERENCES public.madrasas(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(class_id, subject_id)
);
ALTER TABLE public.class_subjects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage class_subjects in same madrasa" ON public.class_subjects;
CREATE POLICY "Users can manage class_subjects in same madrasa" ON public.class_subjects
  FOR ALL USING (madrasa_id = public.get_auth_madrasa_id());

-- Create teacher_subjects table
CREATE TABLE IF NOT EXISTS public.teacher_subjects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  madrasa_id UUID REFERENCES public.madrasas(id) ON DELETE CASCADE,
  teacher_id UUID REFERENCES public.teachers(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(teacher_id, class_id, subject_id)
);
ALTER TABLE public.teacher_subjects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage teacher_subjects in same madrasa" ON public.teacher_subjects;
CREATE POLICY "Users can manage teacher_subjects in same madrasa" ON public.teacher_subjects
  FOR ALL USING (madrasa_id = public.get_auth_madrasa_id());

-- ==========================================
-- ZAKAT & DONATION (যাকাত ও অনুদান)
-- ==========================================

CREATE TABLE IF NOT EXISTS public.donors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  madrasa_id UUID REFERENCES public.madrasas(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  donor_type TEXT DEFAULT 'General', -- General, Zakat, Lillah
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);
ALTER TABLE public.donors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage donors in same madrasa" ON public.donors;
CREATE POLICY "Users can manage donors in same madrasa" ON public.donors FOR ALL USING (madrasa_id = public.get_auth_madrasa_id());

CREATE TABLE IF NOT EXISTS public.donations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  madrasa_id UUID REFERENCES public.madrasas(id) ON DELETE CASCADE,
  donor_id UUID REFERENCES public.donors(id) ON DELETE SET NULL,
  amount DECIMAL(12, 2) NOT NULL,
  donation_type TEXT NOT NULL, -- Zakat, Lillah, Fitra, General
  donation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  receipt_no TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage donations in same madrasa" ON public.donations;
CREATE POLICY "Users can manage donations in same madrasa" ON public.donations FOR ALL USING (madrasa_id = public.get_auth_madrasa_id());

-- ==========================================
-- BOARDING & MEALS (বোর্ডিং ও মিল)
-- ==========================================

CREATE TABLE IF NOT EXISTS public.meal_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  madrasa_id UUID REFERENCES public.madrasas(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  meal_status TEXT NOT NULL DEFAULT 'On', -- On, Off
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(student_id, entry_date)
);
ALTER TABLE public.meal_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage meal_entries in same madrasa" ON public.meal_entries;
CREATE POLICY "Users can manage meal_entries in same madrasa" ON public.meal_entries FOR ALL USING (madrasa_id = public.get_auth_madrasa_id());

CREATE TABLE IF NOT EXISTS public.bazar_expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  madrasa_id UUID REFERENCES public.madrasas(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  items_details TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);
ALTER TABLE public.bazar_expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage bazar_expenses in same madrasa" ON public.bazar_expenses;
CREATE POLICY "Users can manage bazar_expenses in same madrasa" ON public.bazar_expenses FOR ALL USING (madrasa_id = public.get_auth_madrasa_id());

-- ==========================================
-- LIBRARY (কুতুবখানা)
-- ==========================================

CREATE TABLE IF NOT EXISTS public.books (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  madrasa_id UUID REFERENCES public.madrasas(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  author TEXT,
  category TEXT,
  total_copies INTEGER NOT NULL DEFAULT 1,
  available_copies INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage books in same madrasa" ON public.books;
CREATE POLICY "Users can manage books in same madrasa" ON public.books FOR ALL USING (madrasa_id = public.get_auth_madrasa_id());

CREATE TABLE IF NOT EXISTS public.book_issues (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  madrasa_id UUID REFERENCES public.madrasas(id) ON DELETE CASCADE,
  book_id UUID REFERENCES public.books(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  return_date DATE,
  status TEXT DEFAULT 'Issued', -- Issued, Returned
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);
ALTER TABLE public.book_issues ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage book_issues in same madrasa" ON public.book_issues;
CREATE POLICY "Users can manage book_issues in same madrasa" ON public.book_issues FOR ALL USING (madrasa_id = public.get_auth_madrasa_id());

-- ==========================================
-- COMMUNICATION & NOTICES (যোগাযোগ ও নোটিশ)
-- ==========================================

CREATE TABLE IF NOT EXISTS public.notices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  madrasa_id UUID REFERENCES public.madrasas(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  target_audience TEXT DEFAULT 'All', -- All, Teachers, Students
  class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage notices in same madrasa" ON public.notices;
CREATE POLICY "Users can manage notices in same madrasa" ON public.notices FOR ALL USING (madrasa_id = public.get_auth_madrasa_id());

CREATE TABLE IF NOT EXISTS public.sms_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  madrasa_id UUID REFERENCES public.madrasas(id) ON DELETE CASCADE,
  recipient_name TEXT,
  recipient_phone TEXT NOT NULL,
  message TEXT NOT NULL,
  message_type TEXT NOT NULL, -- Attendance, Result, Fee, Notice, Other
  status TEXT DEFAULT 'Sent', -- Sent, Failed
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage sms_logs in same madrasa" ON public.sms_logs;
CREATE POLICY "Users can manage sms_logs in same madrasa" ON public.sms_logs FOR ALL USING (madrasa_id = public.get_auth_madrasa_id());

-- ==========================================
-- ROUTINE MANAGEMENT (রুটিন ও সময়সূচি)
-- ==========================================

CREATE TABLE IF NOT EXISTS public.routines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  madrasa_id UUID REFERENCES public.madrasas(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  day_of_week TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  room_number TEXT,
  routine_type TEXT DEFAULT 'Class', -- Class, Exam
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);
ALTER TABLE public.routines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage routines in same madrasa" ON public.routines;
CREATE POLICY "Users can manage routines in same madrasa" ON public.routines FOR ALL USING (madrasa_id = public.get_auth_madrasa_id());

-- Alter students table to link to classes
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS father_name TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS photo_url TEXT;

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

