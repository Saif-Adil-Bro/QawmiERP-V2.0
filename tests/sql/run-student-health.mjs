// Disposable SQL only. QAWMI_BROWSER_TOOLS is the same tools dir used for portal parity.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
const { PGlite } = createRequire(
  resolve(process.env.QAWMI_BROWSER_TOOLS || ".", "package.json"),
)("@electric-sql/pglite");
const db = new PGlite();
try {
  await db.exec(
    `CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;`,
  );
  for (const file of [
    "supabase_schema.sql",
    "supabase_student_health_migration.sql",
    "supabase_student_health_migration.sql",
  ])
    await db.exec(await readFile(file, "utf8"));
  const [tenant, other, student, actor, id] = Array.from({ length: 5 }, () =>
    randomUUID(),
  );
  await db.query(
    "INSERT INTO public.madrasas(id,name,contact_email) VALUES($1,'A','a@test.invalid'),($2,'B','b@test.invalid')",
    [tenant, other],
  );
  await db.query(
    "INSERT INTO public.students(id,madrasa_id,first_name,last_name) VALUES($1,$2,'Test','Student')",
    [student, tenant],
  );
  const time = new Date().toISOString(),
    r = {
      id,
      madrasa_id: tenant,
      student_id: student,
      illness_type: "জ্বর",
      severity: "mild",
      status: "observing",
      symptoms: "first symptoms",
      treatment_notes: "first care",
      reported_by: actor,
      reported_at: time,
      updated_at: time,
    },
    v = {
      id: randomUUID(),
      madrasa_id: tenant,
      record_id: id,
      status: r.status,
      severity: r.severity,
      note: "initial",
      treatment_notes: "first care",
      logged_by: actor,
      created_at: time,
    };
  const visit = (record, entry, expected = null) =>
    db.query(
      "SELECT public.write_student_health_visit($1::jsonb,$2::jsonb,$3::timestamptz)",
      [JSON.stringify(record), JSON.stringify(entry), expected],
    );
  await db.exec("SET ROLE service_role");
  await visit(r, v);
  await assert.rejects(
    visit(
      { ...r, id: randomUUID(), madrasa_id: other },
      { ...v, madrasa_id: other },
    ),
    /scope mismatch/,
  );
  const badId = randomUUID();
  await assert.rejects(
    visit(
      { ...r, id: badId, madrasa_id: other },
      { ...v, id: randomUUID(), record_id: badId, madrasa_id: other },
    ),
    /foreign key/,
  );
  const changed = {
    ...r,
    severity: "severe",
    updated_at: new Date(Date.parse(time) + 10_000).toISOString(),
  };
  await assert.rejects(
    visit(changed, { ...v, severity: "severe" }, time),
    /duplicate key/,
  ); // timeline failure rolls back header too
  assert.equal(
    (await db.query("SELECT severity FROM public.student_health_records"))
      .rows[0].severity,
    "mild",
  );
  await visit(changed, { ...v, id: randomUUID(), severity: "severe" }, time);
  await assert.rejects(
    visit(changed, { ...v, id: randomUUID(), severity: "severe" }, time),
    /stale health visit/,
  );
  assert.equal(
    (
      await db.query(
        "SELECT COUNT(*)::int AS n FROM public.student_health_timeline",
      )
    ).rows[0].n,
    2,
  );
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`RESET ROLE; SET ROLE ${role}`);
    await assert.rejects(
      db.query("SELECT * FROM public.student_health_records"),
      /permission denied/,
    );
    await assert.rejects(visit(r, v), /permission denied/);
  }

  console.log(
    "OK: rerunnable migration, atomic record + visit, rollback, stale update, cross-tenant FK and raw REST/RPC denied",
  );
} finally {
  await db.close();
}
