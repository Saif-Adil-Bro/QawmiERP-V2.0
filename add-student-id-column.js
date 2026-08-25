const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envLocal = fs.readFileSync('.env.local', 'utf8');
let url = '', key = '';
for (const line of envLocal.split('\n')) {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].replace(/"/g, '').trim();
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = line.split('=')[1].replace(/"/g, '').trim();
}

const supabase = createClient(url, key);

async function main() {
  console.log('Altering students table to add student_id column using exec_sql...');
  const { data, error } = await supabase.rpc('exec_sql', {
    sql_string: "ALTER TABLE public.students ADD COLUMN IF NOT EXISTS student_id TEXT UNIQUE;"
  });
  if (error) {
    console.error('Error altering table:', error);
  } else {
    console.log('Successfully altered table!', data);
  }
}

main();
