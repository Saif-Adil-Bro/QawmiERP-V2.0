// Opt-in wire test. No staging DB connection.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { withDisposablePostgres } from "./disposable-postgres.mjs";
const tenants = ["a0000000-0000-4000-8000-000000000001", "b0000000-0000-4000-8000-000000000001"];
await withDisposablePostgres(async ({ db, dsn, cert, password }) => {
  // The report reader has unfiltered SELECT on the fixture, but cannot settle fees or update tables.
  await db.unsafe(`CREATE ROLE fixture_reader LOGIN BYPASSRLS PASSWORD '${password}';
    GRANT SELECT ON public.madrasas,public.students,public.student_fees,public.fees,public.fee_payments,public.fee_payment_allocations,public.portal_fee_checkouts TO fixture_reader`);
  for (const id of tenants) {
    await db`INSERT INTO public.madrasas(id,name,contact_email) VALUES (${id},'Fixture','fixture@example.test')`;
    const [child] =
      await db`INSERT INTO public.students(madrasa_id,first_name,last_name) VALUES (${id},'Test','Student') RETURNING id`;
    const [type] =
      await db`INSERT INTO public.fee_types(madrasa_id,name,code) VALUES (${id},'Fee','F') RETURNING id`;
    await db`INSERT INTO public.student_fees(madrasa_id,student_id,session_id,fee_type_id,fee_type_name,billing_period,payable_amount,due_amount)
      VALUES (${id},${child.id},'term',${type.id},'Fee','M',10.25,10.25)`;
  }
  const cli = () =>
    spawnSync(process.execPath, ["scripts/portal-fee-preflight.mjs", ...tenants], {
      encoding: "utf8",
      timeout: 20_000,
      env: {
        ...process.env,
        NODE_EXTRA_CA_CERTS: cert,
        QAWMI_STAGING_DATABASE_URL: dsn("fixture_reader"),
      },
    });
  const clear = cli();
  assert.equal(clear.status, 0, clear.stderr);
  assert.equal(JSON.parse(clear.stdout).status, "CHECKS_CLEAR");
  await db`UPDATE public.madrasas SET metadata='{"online_transactions":[{"status":"PENDING"}]}' WHERE id=${tenants[0]}`;
  const hold = cli();
  assert.equal(hold.status, 1, hold.stderr);
  assert.deepEqual(
    JSON.parse(hold.stdout).institutions.map((r) => r.review),
    [{ pending_statement_check: 1 }, {}],
  );
  await db`UPDATE public.madrasas SET registration_no='{PRIVATE-BROKEN-JSON' WHERE id=${tenants[1]}`;
  const incomplete = cli();
  assert.equal(incomplete.status, 2);
  assert.equal(incomplete.stdout, ""); // not even the first tenant's partial report
  assert.match(incomplete.stderr, /INCOMPLETE: Institution B:.*22P02/);
  assert.doesNotMatch(incomplete.stderr, /PRIVATE-BROKEN|postgresql:|fixture_reader/);
  console.log(
    "OK disposable PostgreSQL/TLS: real CLI exits 0/1/2, SELECT-only report role, no partial report or sensitive error output",
  );
});
