// Uses only a throwaway database. Seed legacy postings BEFORE applying the migration.
import {staffChangeChecks} from "./finance-staff.mjs";
import {recoveryEvidence} from "./finance-recovery.mjs";
import {testCalendar} from "./finance-calendar.mjs";
import { scheduleScenarios } from "./finance-schedules.mjs";
import { readFeePreflight } from "../../scripts/portal-fee-preflight.mjs";
import { cashierScenarios } from "./finance-cashier.mjs";
import { financeScenarios } from "./finance-scenarios.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { withDisposablePostgres } from "./disposable-postgres.mjs";

let beforeRestore;
await withDisposablePostgres(async ({ db }) => {
  const [a, b] =
    await db`insert into madrasas(name,contact_email,registration_no) values ('A','a@example.invalid','REG-17'),('B','b@example.invalid','REG-19') returning id`;
  const [{ id: actor }] =
    await db`insert into auth.users(id) values(gen_random_uuid()) returning id`;
  await db`insert into users(id,madrasa_id,full_name,email) values(${actor},${a.id},'Accountant','a@example.invalid')`;
  await db.unsafe(
    "grant select,insert,update on donations,fees,donors,madrasas to authenticated; grant select on expenses to anon",
  );
  await db`insert into donations(madrasa_id,amount,receipt_no,donation_type) values (${a.id},55,'MHF-old','Zakat')`;
  await db`insert into expenses(madrasa_id,amount,category,description) values (${a.id},25,'Other','[FUND: old-id | old label] মাহফিল')`;
  await db`insert into zakat_funds(id,madrasa_id,name,code,category,is_active) values('z-custom',${a.id},'Goraba assistance','G01','Other',true),('inactive',${a.id},'old','OLD','General',false)`;
  const salaries = [
    "pay",
    "retry",
    "undo",
    "paid-legacy",
    "pending-orphan",
  ].map((id) => ({
    id,
    madrasa_id: a.id,
    net_salary: 105.25,
    staff_name: id === "pending-orphan" ? "Legacy employee" : "Rahim",
    staff_id: "staff1",
    month: {
      pay: "08",
      retry: "09",
      undo: "10",
      "paid-legacy": "07",
      "pending-orphan": "11",
    }[id],
    year: "2026",
    status: id === "paid-legacy" ? "PAID" : "PENDING",
  }));
  const metadata = {
    staff_salary_records: salaries,
    staff_members: [{ id: "staff1", audit_logs: [] }],
    preserved: { x: 1 },
    custom_funds: [
      { id: "meta-only", name: "Library", code: "BK", is_active: true },
    ],
  };
  await db`update madrasas set metadata=${db.json(metadata)} where id=${a.id}`;
  await db`insert into expenses(madrasa_id,amount,category,description) values (${a.id},105.25,'Salary','স্টাফ বেতন: Legacy employee () - 11/2026 [FUND: fund-general | সাধারণ ফান্ড]')`;
  const snapshot = async () =>
    await db`select id,amount,donation_type,fund_id,receipt_no from donations order by id`;
  const before = await snapshot();
  const migration = readFileSync(
    "supabase_finance_integrity_migration.sql",
    "utf8",
  );
  const conn = await db.reserve();
  try {
    await conn.unsafe(migration);
    await conn.unsafe(migration);
  } finally {
    conn.release();
  }
  assert.deepEqual(
    (
      await db`select has_column_privilege('authenticated','madrasas','name','select') name,has_column_privilege('authenticated','madrasas','registration_no','select') blob`
    )[0],
    { name: true, blob: false },
  );
  assert.deepEqual(await snapshot(), before);
  assert.equal((await db`select count(*) from expenses`)[0].count, "2");
  assert.equal(
    (await db`select count(*) from finance_fund_catalog(${a.id})`)[0].count,
    "9",
  );
  const reject = (fn, pattern) => assert.rejects(fn, pattern);
  const deposit = (tenant, id, amount = 1, label = null) =>
    db`insert into donations(madrasa_id,fund_id,amount,donation_type) values(${tenant},${id},${amount},${label}) returning fund_name`;
  for (const id of [null, "inactive", "z-custom-not-found"])
    await reject(() => deposit(a.id, id), /ফান্ড/);
  await reject(() => deposit(b.id, "z-custom"), /ফান্ড/);
  await reject(() => deposit(a.id, "fund-general", 1, "Zakat"), /ফান্ড/);
  await reject(() => deposit(a.id, "fund-zakat", -15), /অঙ্ক/);
  assert.equal((await deposit(a.id, "meta-only"))[0].fund_name, "Library");
  const spend = (id, category, who) =>
    db`insert into expenses(madrasa_id,fund_id,amount,category,restricted_beneficiary) values (${a.id},${id},5,${category},${who}) returning id`;
  for (const id of ["fund-zakat", "z-custom"]) {
    await reject(() => spend(id, "Salary", "person"), /যাকাত/);
    await reject(() => spend(id, "Food", "  "), /যাকাত/);
    await reject(
      () =>
        db`insert into bazar_expenses(madrasa_id,fund_id,amount) values(${a.id},${id},5)`,
      /যাকাত/,
    );
    await reject(
      () =>
        db`select finance_posting_fund(${a.id},${id},'mahfil_deficit',null,null)`,
      /যাকাত/,
    );
    const [ok] = await spend(id, "Food", "Eligible boarding group");
    await reject(
      () => db`update expenses set category='Utility' where id=${ok.id}`,
      /যাকাত/,
    );
    await reject(
      () => db`update expenses set fund_id='fund-general' where id=${ok.id}`,
      /বদলানো/,
    );
  }
  const pay = async (id) =>
    (
      await db`select finance_pay_salary(${a.id},${actor},${id},'BANK','bank-ref','') as r`
    )[0].r;
  const getMeta = async () =>
    (await db`select finance_metadata(m) m from madrasas m where id=${a.id}`)[0]
      .m;
  const [one, two] = await Promise.all([pay("pay"), pay("pay")]);
  assert.equal(one.expense_id, two.expense_id);
  assert.notEqual(one.already_paid, two.already_paid);
  const [voucher] =
    await db`select category,amount,fund_id from expenses where id=${one.expense_id}`;
  assert.deepEqual(
    [voucher.category, Number(voucher.amount), voucher.fund_id],
    ["Salary", 105.25, "fund-general"],
  );
  const read = await getMeta();
  assert.equal(read.reg_no, "REG-17");
  assert.deepEqual(read.preserved, { x: 1 });
  assert.equal(read.staff_salary_records[0].expense_id, one.expense_id);
  assert.equal(read.staff_members[0].audit_logs.length, 1);
  await reject(
    () => db`update expenses set status='VOID' where id=${one.expense_id}`,
    /পেরোল/,
  );
  await reject(
    () => db`delete from expenses where id=${one.expense_id}`,
    /পেরোল/,
  );
  await reject(
    () => db`update madrasas set registration_no='REG-17' where id=${a.id}`,
    /পেরোল/,
  );
  const lost = structuredClone(read);
  lost.staff_salary_records = lost.staff_salary_records.filter(
    (p) => p.id !== "paid-legacy",
  );
  await reject(
    () =>
      db`update madrasas set registration_no=${JSON.stringify(lost)} where id=${a.id}`,
    /পেরোল/,
  );
  const forged = structuredClone(read);
  forged.staff_salary_records[1].status = "PAID";
  await reject(
    () =>
      db`update madrasas set registration_no=${JSON.stringify(forged)} where id=${a.id}`,
    /পেরোল/,
  );
  await reject(() => pay("paid-legacy"), /সমন্বয়/);
  await reject(() => pay("pending-orphan"), /সমন্বয়/);
  await reject(
    () =>
      db`insert into expenses(madrasa_id,category,amount,fund_id,payroll_record_id) values(${a.id},'Salary',1,'fund-general','forged')`,
    /পেরোল/,
  );
  await reject(
    () =>
      db`update zakat_funds set category='General',name='Unrestricted' where id='z-custom'`,
    /সুরক্ষিত/,
  );
  await db.unsafe(`create function fail_pay() returns trigger language plpgsql as $$begin raise exception 'simulated failure'; end$$;
    create trigger injected_failure before insert on expenses for each row when(new.payroll_record_id='retry') execute function fail_pay()`);
  await reject(() => pay("retry"), /simulated failure/);
  assert.equal((await getMeta()).staff_salary_records[1].status, "PENDING");
  await db.unsafe("drop trigger injected_failure on expenses");
  await db.unsafe(
    "create trigger injected_failure before update on madrasas for each row execute function fail_pay()",
  );
  await reject(() => pay("retry"), /simulated failure/);
  assert.equal(
    (await db`select count(*) from expenses where payroll_record_id='retry'`)[0]
      .count,
    "0",
  );
  assert.equal((await getMeta()).staff_salary_records[1].expense_id, undefined);
  await db.unsafe("drop trigger injected_failure on madrasas");
  assert.equal((await pay("retry")).already_paid, false);
  assert.equal(
    (
      await db`select has_function_privilege('authenticated','finance_pay_salary(uuid,uuid,text,text,text,text)','execute') as ok`
    )[0].ok,
    false,
  );
  // Linked source + voucher is one tenant-locked compare-and-set, including deliberate voids.
  const [{ id: eid }] = await db`select gen_random_uuid() as id`;
  const event = [
    {
      id: "m1",
      transactions: [{ id: "txn", type: "EXPENSE", amount: 20 }],
      settlements: [
        {
          mahfil_txn_id: "txn",
          settlement_type: "SURPLUS_DEPOSIT",
          fund_id: "z-custom",
          amount: 20,
          accounting_record_id: eid,
          accounting_voucher_no: "MHF-S1",
        },
      ],
    },
  ];
  const v = {
    id: eid,
    fund_id: "z-custom",
    fund_name: "Goraba assistance",
    amount: 20,
    receipt_no: "MHF-S1",
    date: "2026-11-10",
    notes: "মাহফিল",
  };
  const post = (before, after, kind, row) =>
    db`select finance_post_collection(${a.id},${db.json({ mahfils: before })},${db.json({ mahfils: after })},${kind},${db.json(row)},false)`;
  await reject(() => post(null, event, "mahfil_deficit", v), /যাকাত/);
  assert.equal((await getMeta()).mahfils, undefined);
  await post(null, event, "donation", v);
  await reject(() => post(null, event, "donation", v), /রিফ্রেশ/);
  assert.equal(
    (await db`select count(*) from donations where receipt_no='MHF-S1'`)[0]
      .count,
    "1",
  );
  assert.equal(
    Number(
      (await db`select current_balance from zakat_funds where id='z-custom'`)[0]
        .current_balance,
    ),
    20,
  );
  await reject(
    () => db`update donations set amount=21 where id=${eid}`,
    /সমন্বয়/,
  );
  await reject(
    () =>
      db`select finance_replace_sources(${a.id},${db.json({ mahfils: event })},${db.json({ mahfils: [] })})`,
    /সমন্বয়/,
  );
  await reject(
    () => post(event, [], "void_surplus", { ...v, amount: 21 }),
    /ভাউচার/,
  );
  await post(event, [], "void_surplus", v);
  assert.equal(
    (await db`select status from donations where id=${eid}`)[0].status,
    "VOID",
  );
  assert.equal(
    Number(
      (await db`select current_balance from zakat_funds where id='z-custom'`)[0]
        .current_balance,
    ),
    0,
  );
  const pending = {
    id: "web-1",
    madrasa_id: a.id,
    trx_id: "DON-1",
    gateway_provider: "SSLCOMMERZ",
    status: "PENDING",
    receipt_no: "ON-1",
    fund_id: "meta-only",
    fund_category: "Library",
    amount: 12,
    donation_date: "2026-11-11",
  };
  await db`select replace_portal_gateway_key(${a.id},'online_donations',null,${db.json([pending])})`;
  const verify = () =>
    db`select confirm_portal_donation_return(${a.id},${db.json(pending)},'valid-ref')`;
  await verify();
  await verify();
  const [webVoucher] =
    await db`select count(*),min(fund_id) fund from donations where receipt_no='ON-1'`;
  assert.equal(webVoucher.count, "1");
  assert.equal(webVoucher.fund, "meta-only");
  assert.equal((await getMeta()).online_donations[0].status, "VERIFIED");
  // An ordinary mirrored collection and its audit change together, even if the second write fails.
  const sr = {
    id: "sub-1",
    receipt_no: "S-1",
    amount: 25,
    fund_id: "meta-only",
    fund_name: "Library",
  };
  const vr = {
    ...sr,
    id: undefined,
    date: "2026-11-07",
    notes: "subscription",
  };
  const source = { donor_subscription_payments: [sr] },
    empty = { donor_subscription_payments: null };
  await db`select finance_post_collection(${a.id},${db.json(empty)},${db.json(source)},'donation',${db.json(vr)},false)`;
  const [original] =
    await db`select to_jsonb(d) r from donations d where madrasa_id=${a.id} and receipt_no='S-1'`;
  const voidSource = {
    donor_subscription_payments: [{ ...sr, status: "VOID" }],
  };
  const setStatus = (row, before, after, voiding, tenant = a.id) =>
    db`select finance_change_voucher(${tenant},${actor},'donations',${db.json(row)},${db.json(before)},${db.json(after)},${voiding},'requested correction','sub-1')`;
  await reject(() => setStatus(original.r, empty, voidSource, true), /রিফ্রেশ/);
  assert.equal(
    (await db`select status from donations where id=${original.r.id}`)[0]
      .status,
    "COMPLETED",
  );
  await setStatus(original.r, source, voidSource, true);
  const [cancelled] =
    await db`select to_jsonb(d) r from donations d where id=${original.r.id}`;
  assert.equal(cancelled.r.status, "VOID");
  assert.deepEqual(
    (await getMeta()).donor_subscription_payments,
    voidSource.donor_subscription_payments,
  );
  await reject(() => setStatus(original.r, source, voidSource, true), /বদলেছে/);
  await setStatus(cancelled.r, voidSource, source, false);
  assert.equal((await getMeta()).audit_logs.length, 2);
  await reject(
    () => setStatus(original.r, source, voidSource, true, b.id),
    /no rows/,
  );
  await reject(
    () =>
      db`update donations set donation_type='General' where receipt_no='MHF-old'`,
    /সমন্বয়/,
  );
  await db`update donations set status='VOID' where receipt_no='MHF-old'`;
  assert.equal(
    (
      await db`select donation_type from donations where receipt_no='MHF-old'`
    )[0].donation_type,
    "Zakat",
  );
  await financeScenarios(db, a.id, actor);
  await staffChangeChecks(db,a.id,actor,b.id);
  await cashierScenarios(db);
  await scheduleScenarios(db);
  await testCalendar(db,actor);
  const report = await db.begin((tx) =>
    readFeePreflight((q, args = []) => tx.unsafe(q, args), [a.id, b.id], {
      finance: true,
    }),
  );
  assert.equal(report.status, "HOLD");
  assert.ok(report.institutions[0].inventory.central_vouchers > 0);
  assert.equal(report.institutions[1].inventory.central_vouchers, 0);
  for (const school of report.institutions) {
    assert.equal(school.blockers.finance_rpc_missing_or_grants, undefined);
    assert.equal(school.blockers.finance_raw_book_grants, undefined);
    assert.equal(school.blockers.raw_aggregate_grants, undefined);
  }
  assert.ok(!JSON.stringify(report).includes("MHF-old"));
  // Exercise both installation orders, including a pre-existing permissive BI grant.
  const bi=readFileSync('supabase_phase_2_automation_bi_migration.sql','utf8');
  await db.unsafe(bi);
  async function checkBiAccess() {
    const state=await db.begin(tx=>readFeePreflight((q,args=[])=>tx.unsafe(q,args),[a.id,b.id],{finance:true}));
    for(const school of state.institutions) {
      assert.equal(school.blockers.bi_raw_relation_grants,undefined);assert.equal(school.blockers.bi_raw_function_grants,undefined);
    }
    await db.begin(async tx=>{await tx`set local role service_role`;const [row]=await tx`select get_executive_bi_snapshot(${a.id},1,null) r`;assert.equal(row.r.madrasa_id,a.id);});
  }
  await checkBiAccess();
  await db.unsafe('grant select on mv_bi_fund_health to authenticated; grant execute on function get_executive_bi_snapshot(uuid,integer,text) to anon');
  const reinstall=await db.reserve();
  try{await reinstall.unsafe(migration);}finally{reinstall.release();}
  await checkBiAccess();
  console.log('PASS optional BI before/after finance migration: private views/RPC, service snapshot, two-tenant preflight');
  console.log(
    "PASS member identity, bazar lock, linked maintenance, fee posting/cancellation/restore and rollback;  populated migration + reapply; tenant and restricted-fund guards; concurrent payroll, rollback on either write, retry and stale-save protection; settlement/void and gateway replay",
  );
  beforeRestore=await recoveryEvidence(db);
}, {afterColdRestore:async restored=>{
  assert.deepEqual(await recoveryEvidence(restored),beforeRestore);
  console.log('PASS restored a separate cold PostgreSQL copy: financial rows/digests, child exports by owning tenant, linked payments, checkout, calendar and grants');
}});
