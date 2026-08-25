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
  const { data, error } = await supabase.from('students').select('*').limit(1);
  if (error) {
    console.error('Error fetching student:', error);
  } else {
    console.log('Sample student keys:', data[0] ? Object.keys(data[0]) : 'No students found');
    console.log('Sample student:', data[0]);
  }
}

main();
