const fs = require('fs');
const postgres = require('postgres');

const envLocal = fs.readFileSync('.env.local', 'utf8');
let dbUrl = '';
for (const line of envLocal.split('\n')) {
  if (line.startsWith('DATABASE_URL=')) dbUrl = line.split('=')[1].replace(/"/g, '').replace(/'/g, '');
}

const sql = postgres(dbUrl);

async function main() {
  try {
    await sql`ALTER TABLE public.madrasas ADD COLUMN IF NOT EXISTS logo_url TEXT;`;
    console.log('Column added successfully');
  } catch (error) {
    console.error(error);
  } finally {
    await sql.end();
  }
}
main();
