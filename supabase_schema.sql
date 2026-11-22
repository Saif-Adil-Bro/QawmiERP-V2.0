-- Create madrasas table
CREATE TABLE IF NOT EXISTS public.madrasas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  subscription_plan TEXT DEFAULT 'free',
  registration_no TEXT,
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

-- ============================================================================
-- Phase C: Core ERP Upgrades (Audit Logs, Structured Config, Granular Locks)
-- ============================================================================

-- 10. UNIFIED IMMUTABLE SYSTEM AUDIT LOGS
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
  severity VARCHAR(20) NOT NULL DEFAULT 'INFO',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_system_audit_logs_madrasa_created
  ON public.system_audit_logs(madrasa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_audit_logs_madrasa_module
  ON public.system_audit_logs(madrasa_id, module, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_audit_logs_entity
  ON public.system_audit_logs(madrasa_id, entity_id);

ALTER TABLE public.system_audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view system_audit_logs in same madrasa" ON public.system_audit_logs;
CREATE POLICY "Users can view system_audit_logs in same madrasa" ON public.system_audit_logs
  FOR SELECT USING (madrasa_id = public.get_auth_madrasa_id());
DROP POLICY IF EXISTS "Users can insert system_audit_logs in same madrasa" ON public.system_audit_logs;
CREATE POLICY "Users can insert system_audit_logs in same madrasa" ON public.system_audit_logs
  FOR INSERT WITH CHECK (madrasa_id = public.get_auth_madrasa_id());

CREATE OR REPLACE FUNCTION public.prevent_system_audit_log_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'system_audit_logs is immutable: % operation is forbidden', TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_system_audit_log_update ON public.system_audit_logs;
CREATE TRIGGER trg_prevent_system_audit_log_update
  BEFORE UPDATE OR DELETE ON public.system_audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_system_audit_log_mutation();

-- 11. STAFF LEAVE REQUESTS
CREATE TABLE IF NOT EXISTS public.staff_leave_requests (
  id TEXT PRIMARY KEY DEFAULT ('leave_' || replace(gen_random_uuid()::text, '-', '')),
  madrasa_id UUID NOT NULL REFERENCES public.madrasas(id) ON DELETE CASCADE,
  staff_id TEXT NOT NULL,
  staff_name TEXT NOT NULL,
  staff_id_code TEXT,
  leave_type VARCHAR(30) NOT NULL DEFAULT 'CASUAL',
  leave_type_name_bn TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days NUMERIC(5, 1) NOT NULL DEFAULT 1,
  reason TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  reviewed_by TEXT,
  reviewed_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  review_reason TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_staff_leave_requests_madrasa ON public.staff_leave_requests(madrasa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_staff_leave_requests_staff ON public.staff_leave_requests(madrasa_id, staff_id);

ALTER TABLE public.staff_leave_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage staff_leave_requests in same madrasa" ON public.staff_leave_requests;
CREATE POLICY "Users can manage staff_leave_requests in same madrasa" ON public.staff_leave_requests
  FOR ALL USING (madrasa_id = public.get_auth_madrasa_id());

-- 12. EXAM SETTINGS
CREATE TABLE IF NOT EXISTS public.exam_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  madrasa_id UUID NOT NULL REFERENCES public.madrasas(id) ON DELETE CASCADE,
  exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE,
  scope_key TEXT NOT NULL DEFAULT '__global__',
  setting_key VARCHAR(80) NOT NULL,
  setting_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(madrasa_id, scope_key, setting_key)
);

ALTER TABLE public.exam_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage exam_settings in same madrasa" ON public.exam_settings;
CREATE POLICY "Users can manage exam_settings in same madrasa" ON public.exam_settings
  FOR ALL USING (madrasa_id = public.get_auth_madrasa_id());

-- 13. MADRASA SETTINGS
CREATE TABLE IF NOT EXISTS public.madrasa_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  madrasa_id UUID NOT NULL REFERENCES public.madrasas(id) ON DELETE CASCADE,
  namespace VARCHAR(80) NOT NULL,
  setting_key VARCHAR(120) NOT NULL,
  setting_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(madrasa_id, namespace, setting_key)
);

ALTER TABLE public.madrasa_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage madrasa_settings in same madrasa" ON public.madrasa_settings;
CREATE POLICY "Users can manage madrasa_settings in same madrasa" ON public.madrasa_settings
  FOR ALL USING (madrasa_id = public.get_auth_madrasa_id());

-- 14. GRANULAR LOCKS (EXAMS, SESSIONS & ACCOUNTING PERIODS)
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS locked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS locked_by_name TEXT;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS lock_reason TEXT;

ALTER TABLE public.academic_sessions ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.academic_sessions ADD COLUMN IF NOT EXISTS locked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.academic_sessions ADD COLUMN IF NOT EXISTS locked_by_name TEXT;
ALTER TABLE public.academic_sessions ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;
ALTER TABLE public.academic_sessions ADD COLUMN IF NOT EXISTS lock_reason TEXT;

CREATE TABLE IF NOT EXISTS public.accounting_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  madrasa_id UUID NOT NULL REFERENCES public.madrasas(id) ON DELETE CASCADE,
  period_key VARCHAR(30) NOT NULL,
  period_type VARCHAR(20) NOT NULL DEFAULT 'MONTHLY',
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
CREATE POLICY "Users can manage accounting_periods in same madrasa" ON public.accounting_periods
  FOR ALL USING (madrasa_id = public.get_auth_madrasa_id());




-- ============================================================================
-- PHASE 1 ENTERPRISE MIGRATION (Approvals, Sessions, Step-Up 2FA, Masking)
-- ============================================================================
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


-- ============================================================================
-- PHASE 2 AUTOMATION & BI MIGRATION (Cron, Notifications, Webhooks, BI MVs)
-- ============================================================================
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


-- ============================================================================
-- PHASE 3 AI MIGRATION (Early Warning Risk Scores & Financial Anomalies)
-- ============================================================================
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
