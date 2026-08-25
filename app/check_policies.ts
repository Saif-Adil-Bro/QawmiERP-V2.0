import postgres from 'postgres';
import fs from 'fs';
import path from 'path';

// Parse .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  envConfig.split('\n').forEach(line => {
    const [key, ...values] = line.split('=');
    if (key && values.length) {
      process.env[key.trim()] = values.join('=').trim().replace(/^"/, '').replace(/"$/, '');
    }
  });
}

const sql = postgres(process.env.DATABASE_URL!);

async function checkPolicies() {
  try {
    const policies = await sql`SELECT tablename, policyname, roles, cmd, qual, with_check FROM pg_policies WHERE tablename = 'hifz_logs';`;
    console.log("Policies:", policies);
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}

checkPolicies();
