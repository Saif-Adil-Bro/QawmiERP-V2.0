const fs = require('fs');
const postgres = require('postgres');

const env = fs.readFileSync('.env.local', 'utf8').split('\n').reduce((acc, line) => {
  const [key, ...val] = line.split('=');
  if(key && key.trim()) acc[key.trim()] = val.join('=').trim().replace(/['"]/g, '');
  return acc;
}, {});

console.log("Keys in env:", Object.keys(env));

if (env.DATABASE_URL || env.POSTGRES_URL) {
  const sql = postgres(env.DATABASE_URL || env.POSTGRES_URL);
  async function test() {
    try {
      const res = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;`;
      console.log("Tables:", res.map(r => r.table_name));
      process.exit(0);
    } catch(e) {
      console.error("SQL Error:", e);
      process.exit(1);
    }
  }
  test();
} else {
  console.log("No direct Postgres URL, using Supabase REST queries.");
}
