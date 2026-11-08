const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envLocal = fs.readFileSync('.env.local', 'utf8');
let url = '', key = '';
for (const line of envLocal.split('\n')) {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].replace(/"/g, '');
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = line.split('=')[1].replace(/"/g, '');
}

const supabase = createClient(url, key);

async function main() {
  const sql = `
    ALTER TABLE public.exam_results 
    ADD COLUMN IF NOT EXISTS written_marks DECIMAL(5, 2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS oral_marks DECIMAL(5, 2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS tutorial_marks DECIMAL(5, 2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS attendance_marks DECIMAL(5, 2) DEFAULT 0;
  `;
  // I cannot use execute_sql because it does not exist in schema cache as seen in previous turn.
}
main();
