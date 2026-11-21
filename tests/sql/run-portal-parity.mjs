// Run from the repository root. This database is disposable and never connects to Supabase.
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { readFile } from "node:fs/promises";
import { assertFeePreflight } from "./portal-fee-preflight.mjs";
const require = createRequire(
  resolve(process.env.QAWMI_BROWSER_TOOLS || ".", "package.json"),
);
const { PGlite } = require("@electric-sql/pglite");
const db = new PGlite();
try {
  await db.exec(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE SQL STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated;`);
  for (const file of [
    "supabase_schema.sql",
    "supabase_fix_account_model_migration.sql",
    "supabase_portal_parity_migration.sql",
    "supabase_portal_parity_migration.sql",
    "tests/sql/portal-parity.sql",
  ]) {
    await db.exec(await readFile(file, "utf8"));
    console.log("OK", file);
  }
  await assertFeePreflight(db);
} finally {
  await db.close();
}
