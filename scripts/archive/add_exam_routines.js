const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
  const [key, ...val] = line.split('=');
  if(key && key.trim()) acc[key.trim()] = val.join('=').trim().replace(/['"]/g, '');
  return acc;
}, {});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function addTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS public.exam_routines (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      madrasa_id UUID REFERENCES public.madrasas(id) ON DELETE CASCADE,
      exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE,
      class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
      subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
      exam_date DATE NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      room_number TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
    );

    ALTER TABLE public.exam_routines ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can manage exam routines in same madrasa" ON public.exam_routines;
    CREATE POLICY "Users can manage exam routines in same madrasa" ON public.exam_routines
      FOR ALL USING (madrasa_id = public.get_auth_madrasa_id());
  `;
  
  // Since we cannot run raw DDL from supabase client without an RPC, 
  // Let's create an RPC or use another way, or just write it to a file for user to run
  // But wait! We can just tell the user that we are setting up the code now.
}
addTable();
