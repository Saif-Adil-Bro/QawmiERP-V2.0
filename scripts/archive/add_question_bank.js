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
    CREATE TABLE IF NOT EXISTS public.question_bank (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      madrasa_id UUID REFERENCES public.madrasas(id) ON DELETE CASCADE,
      class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
      subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
      question_type TEXT NOT NULL, -- 'MCQ', 'Short', 'Broad'
      question_text TEXT NOT NULL,
      options JSONB, -- For MCQ options
      marks INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
    );

    ALTER TABLE public.question_bank ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can manage question bank in same madrasa" ON public.question_bank;
    CREATE POLICY "Users can manage question bank in same madrasa" ON public.question_bank
      FOR ALL USING (madrasa_id = public.get_auth_madrasa_id());
  `;
  
  console.log("SQL generated for question_bank");
  // We can't execute raw DDL directly via supabase-js without an RPC, 
  // but we will create the RPC to execute it.
  
  const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });
  if (error) {
     console.log("Error running SQL:", error.message);
  } else {
     console.log("Table question_bank created successfully!");
  }
}
addTable();
