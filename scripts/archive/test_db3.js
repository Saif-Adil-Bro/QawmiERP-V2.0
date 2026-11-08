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
    SELECT * FROM public.exam_results LIMIT 1;
  `;
  const { data, error } = await supabase.from('exam_results').select('*').limit(1);
  console.log('Error:', error);
  console.log('Data:', data);
}

main();
