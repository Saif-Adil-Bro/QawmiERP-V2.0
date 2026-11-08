const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
  const [key, ...val] = line.split('=');
  if(key && key.trim()) acc[key.trim()] = val.join('=').trim().replace(/['"]/g, '');
  return acc;
}, {});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const sql = `
    CREATE TABLE IF NOT EXISTS public.exam_papers (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      madrasa_id UUID REFERENCES public.madrasas(id) ON DELETE CASCADE,
      exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE,
      class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
      subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      total_marks INTEGER NOT NULL DEFAULT 100,
      exam_time TEXT DEFAULT '',
      exam_name TEXT DEFAULT '',
      questions JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
      UNIQUE(exam_id, class_id, subject_id)
    );

    ALTER TABLE public.exam_papers ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Users can manage exam papers in same madrasa" ON public.exam_papers;
    CREATE POLICY "Users can manage exam papers in same madrasa" ON public.exam_papers
      FOR ALL USING (madrasa_id = public.get_auth_madrasa_id());
  `;

  console.log("Executing SQL to create exam_papers table...");
  const { data, error } = await supabase.rpc('execute_sql', { sql_query: sql });
  
  if (error) {
    console.error("Error creating table:", error.message);
  } else {
    console.log("Table exam_papers created/updated successfully!", data);
  }
}

run();
