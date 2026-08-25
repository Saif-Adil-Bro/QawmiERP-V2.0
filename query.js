const postgres = require('postgres');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
  const [key, ...val] = line.split('=');
  if(key) acc[key.trim()] = val.join('=').trim().replace(/['"]/g, '');
  return acc;
}, {});

const sql = postgres(env.DATABASE_URL);

async function run() {
  try {
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    console.log('Tables in database:', tables.map(t => t.table_name));

    // Also check details of exam_papers if it exists
    const hasExamPapers = tables.some(t => t.table_name === 'exam_papers');
    if (hasExamPapers) {
      const columns = await sql`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'exam_papers'
      `;
      console.log('exam_papers columns:', columns);
    } else {
      console.log('exam_papers does NOT exist in tables!');
    }
  } catch (err) {
    console.error('Error running postgres query:', err);
  } finally {
    await sql.end();
  }
}
run();
