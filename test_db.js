const fs = require("fs");
if (fs.existsSync(".env.local")) {
  const env = fs.readFileSync(".env.local", "utf8");
  env.split("\n").forEach(line => {
    const idx = line.indexOf("=");
    if (idx > 0) {
      const k = line.substring(0, idx).trim();
      const v = line.substring(idx + 1).trim().replace(/^['"]|['"]$/g, "");
      process.env[k] = v;
    }
  });
}
const { createClient } = require("@supabase/supabase-js");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const client = createClient(url, key);

async function run() {
  const { data: users, error: uErr } = await client.from("users").select("id, email, full_name, role, madrasa_id, phone");
  console.log("=== USERS ===");
  console.log(users);
  const { data: students, error: sErr } = await client.from("students").select("id, first_name, last_name, madrasa_id, parent_phone, father_name, roll_number, student_id");
  console.log("=== STUDENTS ===");
  console.log(students);
}
run();
