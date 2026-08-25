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
