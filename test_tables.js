const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
  const [key, ...val] = line.split('=');
  if(key && key.trim()) acc[key.trim()] = val.join('=').trim().replace(/['"]/g, '');
  return acc;
}, {});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const candidateTables = [
  'madrasas', 'users', 'students', 'teachers', 'classes', 'subjects', 'sections',
  'attendance', 'hifz_logs', 'kitab_logs', 'qawmi_exams', 'exams', 'exam_routines',
  'exam_results', 'exam_marks', 'exam_papers', 'question_bank', 'fees', 'fee_payments',
  'notices', 'sms_logs', 'library_books', 'book_borrows', 'boarding_meals', 'bazar_records',
  'donations', 'funds', 'income_expenses', 'academic_sessions', 'student_enrollments'
];

async function checkTables() {
  for (const table of candidateTables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (!error) {
      const sample = data && data.length > 0 ? Object.keys(data[0]) : '(empty table)';
      console.log(`✓ ${table} exists. Columns:`, sample);
    } else {
      console.log(`✗ ${table}: ${error.message}`);
    }
  }
}

checkTables();
