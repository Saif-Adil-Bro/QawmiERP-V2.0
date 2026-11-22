// Disposable Postgres/WASM only; never accepts a hosted DSN.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
const { PGlite } = createRequire(
  resolve(process.env.QAWMI_BROWSER_TOOLS || ".", "package.json"),
)("@electric-sql/pglite");
const db = new PGlite();
const q = (text, args) => db.query(text, args);
try {
  await db.exec(
    `CREATE ROLE authenticated;CREATE ROLE anon;CREATE ROLE service_role BYPASSRLS;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE SQL AS $$SELECT NULL::uuid$$;`,
  );
  await db.exec(await readFile("supabase_schema.sql", "utf8"));
  const migration = await readFile(
    "supabase_hifz_upgrade_migration.sql",
    "utf8",
  );
  const [t, other, s, x, legacy] = Array.from({ length: 5 }, () =>
    randomUUID(),
  );
  await q(
    `insert into madrasas(id,name,contact_email) values ($1,'A','a'),($2,'B','b')`,
    [t, other],
  );
  await q(
    `insert into students(id,madrasa_id,first_name,last_name) values ($1,$2,'A','A'),($3,$4,'B','B')`,
    [s, t, x, other],
  );
  const v = {
    hifz_version: 1,
    student_category: "khatmi",
    sabak_mistakes: 0,
    sat_sabak_mistakes: 0,
    amukhta_mistakes: 0,
    morning_session_done: true,
    morning_para_from: 1,
    morning_para_to: 29,
    morning_pages: 15,
    morning_mistakes: 3,
    afternoon_session_done: false,
    afternoon_para_from: null,
    afternoon_para_to: null,
    afternoon_pages: 0,
    afternoon_mistakes: 0,
  };
  const tagged = `মন্তব্য [HIFZ_META:${JSON.stringify(v)}]`;
  await q(
    `insert into hifz_logs(id,madrasa_id,student_id,log_date,notes) values($1,$2,$3,'2026-04-16','আগের পাঠ')`,
    [legacy, t, s],
  );
  await q(
    `insert into hifz_logs(madrasa_id,student_id,log_date,notes) values($1,$2,'2026-04-17',$3)`,
    [t, s, tagged],
  );
  await db.exec(migration);
  await db.exec(migration);
  assert.deepEqual(
    (await q(`select notes from hifz_logs order by log_date`)).rows.map(
      (r) => r.notes,
    ),
    ["আগের পাঠ", tagged],
  );
  assert.equal(
    (await q(`select id from hifz_logs where student_category='sabqi'`)).rows[0]
      .id,
    legacy,
  );
  const cycle = async () =>
    (
      await q(
        "select total_khatams_completed as total,current_khatam_paras_done as done from hifz_student_profiles where student_id=$1",
        [s],
      )
    ).rows[0];
  assert.deepEqual(
    (await cycle()).done,
    Array.from({ length: 29 }, (_, i) => i + 1),
  );
  const add = `insert into hifz_logs(madrasa_id,student_id,log_date,student_category,morning_session_done,morning_para_from,morning_para_to,afternoon_session_done,afternoon_para_from,afternoon_para_to) values($1,$2,'2026-05-01','khatmi',true,29,30,true,1,2) on conflict(student_id,log_date) do update set morning_para_to=excluded.morning_para_to`;
  await q(add, [t, s]);
  await q(add, [t, s]);
  assert.deepEqual(await cycle(), { total: 1, done: [1, 2] });
  await q(
    "update hifz_logs set morning_para_to=29 where log_date='2026-05-01'",
  );
  assert.equal((await cycle()).total, 0);
  await q(add, [t, s]);
  await q("delete from hifz_logs where log_date='2026-05-01'");
  assert.equal((await cycle()).total, 0);
  await assert.rejects(
    q(
      "update hifz_student_profiles set default_sabina_partner_id=$1 where student_id=$2",
      [x, s],
    ),
    /foreign key/,
  );
  await assert.rejects(
    q(
      "insert into hifz_weekly_sabina(madrasa_id,student_id,sabina_date,assigned_para_from,assigned_para_to) values($1,$2,'2026-05-01',1,3)",
      [t, s],
    ),
    /check constraint/,
  );
  await db.exec("set role authenticated");
  for (const table of [
    "hifz_student_profiles",
    "hifz_weekly_sabina",
    "hifz_special_sabina",
  ])
    await assert.rejects(q(`select * from ${table}`), /permission denied/);
  await db.exec("reset role");
  await db.exec(migration);
  console.log(
    "OK: populated ledger preserved; versioned notes backfilled; overlap, replay, correction, deletion, indexed tenant FKs and RLS",
  );
} finally {
  await db.close();
}
