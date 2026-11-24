import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

export async function financeScenarios(db, tenant, actor) {
  const meta = async () =>
    (
      await db`select finance_metadata(m) d from madrasas m where id=${tenant}`
    )[0].d;
  const save = (m) =>
    db`update madrasas set registration_no=${JSON.stringify(m)} where id=${tenant}`;
  const replace = (before, after) =>
    db`select finance_replace_sources(${tenant},${db.json(before)},${db.json(after)})`;
  const post = (before, after, kind, row) =>
    db`select finance_post_collection(${tenant},${db.json({ mahfils: before })},${db.json({ mahfils: after })},${kind},${db.json(row)})`;
  const stale = await meta();
  const vid = randomUUID(),
    v = {
      id: vid,
      fund_id: "meta-only",
      fund_name: "Library",
      amount: 9.55,
      receipt_no: "EXP-MHF-2",
      date: "2026-11-10",
      notes: "deficit",
    };
  const ref = {
    id: "s2",
    settlement_type: "DEFICIT_COVER",
    mahfil_txn_id: "income",
    accounting_record_id: vid,
    accounting_voucher_no: v.receipt_no,
    amount: v.amount,
    fund_id: v.fund_id,
  };
  const event = {
    id: "m2",
    transactions: [{ id: "income", type: "INCOME", amount: v.amount }],
    settlement: ref,
    settlements: [ref],
  };
  await post(stale.mahfils, [event], "mahfil_deficit", v);
  const lookup = async () =>
    (await db`select status,amount from expenses where id=${vid}`)[0];
  assert.equal(Number((await lookup()).amount), 9.55);
  await assert.rejects(() => save(stale), /খাতা/);
  const next = [{ ...event, title: "new title" }, { id: "another" }];
  delete next[0].settlements;
  await replace({ mahfils: [event] }, { mahfils: next });
  await assert.rejects(() => db`delete from expenses where id=${vid}`, /সমন্বয়/);
  await post(next, [next[1]], "void_deficit", v);
  assert.equal((await lookup()).status, "VOID");
  const [{ id: gateway }] =
    await db`select id from donations where madrasa_id=${tenant} and receipt_no='ON-1'`;
  assert.equal(
    (await meta()).online_donations[0].accounting_record_id,
    gateway,
  );
  const current = await meta();
  await assert.rejects(() => save({ ...current, staff_members: [] }), /পেরোল/);

  // A stale donor edit cannot update the SQL row and then fail only the legacy half.
  const id = randomUUID(),
    member = {
      id,
      madrasa_id: tenant,
      name: "First",
      member_type: "MONTHLY_DONOR",
    };
  const writeMember = (id, old, m, op) =>
    db`select finance_save_member(${tenant},${id},${db.json(old)},${db.json(m)},${op})`;
  await writeMember(id, [], member, "create");
  await assert.rejects(
    () => writeMember(id, [], { ...member, name: "stale" }, "edit"),
    /রিফ্রেশ/,
  );
  assert.equal(
    (await db`select name from donors where id=${id}`)[0].name,
    "First",
  );
  const legacy = { ...member, id: "legacy-donor-123", name: "Other" };
  await writeMember(legacy.id, [member], legacy, "create");
  await db`insert into donations(madrasa_id,member_id,fund_id,amount) values(${tenant},${legacy.id},'meta-only',4)`;
  await assert.rejects(
    () => writeMember(legacy.id, [legacy, member], null, "delete"),
    /রসিদ/,
  );
  await writeMember(id, [legacy, member], null, "delete");
  assert.equal((await meta()).life_member_donors[0].id, legacy.id);

  const [{ r: bazar }] =
    await db`insert into bazar_expenses as b(madrasa_id,fund_id,expense_date,amount) values(${tenant},'fund-lillah','2026-10-20',6) returning to_jsonb(b) r`;
  await db`insert into accounting_periods(madrasa_id,period_key,label,start_date,end_date,is_locked) values(${tenant},'2026-10','locked','2026-10-01','2026-10-31',true)`;
  const reverseBazar = () =>
    db`select finance_change_voucher(${tenant},${actor},'bazar_expenses',${db.json(bazar)},'{}','{}',true,'reason',${"bazar_" + bazar.id})`;
  await assert.rejects(reverseBazar, /লক/);
  await db`update accounting_periods set is_locked=false,unlocked_at=now(),unlocked_by=${actor} where madrasa_id=${tenant}`;
  await reverseBazar();
  assert.equal(
    (await db`select status from bazar_expenses where id=${bazar.id}`)[0]
      .status,
    "VOID",
  );

  await save({
    ...(await meta()),
    inventory: { items: [{ id: "asset", name: "Desk" }], maintenance: [] },
  });
  const r = {
    id: "maintenance",
    cost: 6,
    asset_id: "asset",
    auto_add_to_expense: true,
    maintenance_date: "2026-11-02",
    work_done: "repair",
    fund_id: "meta-only",
    fund_name: "Library",
  };
  const record = (x) =>
    db`select finance_record_maintenance(${tenant},${db.json(x)}) r`;
  await assert.rejects(() => record({ ...r, fund_id: "fund-zakat" }), /যাকাত/);
  const n = async () =>
    (
      await db`select count(*) n from expenses where madrasa_id=${tenant} and category='Maintenance'`
    )[0].n;
  await db.unsafe(
    "create trigger injected_failure before update on madrasas for each row execute function fail_pay()",
  );
  await assert.rejects(() => record(r), /simulated failure/);
  assert.equal(await n(), "0");
  await db.unsafe("drop trigger injected_failure on madrasas");
  const [{ r: recorded }] = await record(r);
  assert.equal(
    (await meta()).inventory.maintenance[0].expense_id,
    recorded.expense_id,
  );
  const withRepair = await meta();
  await assert.rejects(
    () =>
      save({
        ...withRepair,
        inventory: { items: [{ id: "asset" }], maintenance: [] },
      }),
    /মেরামত/,
  );

  const [{ id: pupil }] =
    await db`insert into students(madrasa_id,first_name,last_name) values(${tenant},'Fee','Pupil') returning id`;
  const bill = {
    id: "fee-invoice",
    student_id: pupil,
    fee_type_id: "ft",
    fee_type_name: "Fee",
    billing_period: "2026-11",
    base_amount: 50,
    payable_amount: 50,
    due_amount: 50,
    paid_amount: 0,
  };
  const alloc = {
    student_fee_id: bill.id,
    fee_type_id: "ft",
    fee_type_name: "Fee",
    allocated_amount: 12.75,
    discount_applied: 1.25,
    fund_id: "meta-only",
    fund_name: "Library",
  };
  const p = {
    id: "fee-payment",
    student_id: pupil,
    student_name: "Fee Pupil",
    madrasa_id: tenant,
    receipt_no: "F-12",
    payment_date: "2026-11-12",
    total_amount_received: 12.75,
    discount_total: 1.25,
    fund_id: "meta-only",
    fund_name: "Library",
    allocations: [alloc],
  };
  const collect = (payment, expected) =>
    db`select finance_collect_fee(${tenant},${actor},${db.json(payment)},${db.json(expected)}) r`;
  const status = (id, s) =>
    db`select finance_fee_status(${tenant},${actor},${id},${s},'correction')`;
  // An existing JSON-only tenant stays JSON-only. The unrelated legacy receipt shares a prefix.
  const ft = {
    id: "ft",
    name: "Fee",
    fund_id: "meta-only",
    fund_name: "Library",
  };
  await db`select finance_fee_config(${tenant},'fee_types',${db.json([{ id: ft.id, before: null, after: ft }])},'[]')`;
  await db`insert into academic_sessions(id,madrasa_id,name,start_date,end_date,is_active) values('session',${tenant},'Session','2026-01-01','2026-12-31',true)`;
  await db`select finance_edit_bills(${tenant},${db.json([{ id: bill.id, before: null, after: { ...bill, fund_id: ft.fund_id, fund_name: ft.fund_name, madrasa_id: tenant, status: "UNPAID", session_id: "session" } }])},null)`;
  const [{ id: unrelated }] =
    await db`insert into fees(madrasa_id,student_id,fee_type,amount,notes) values(${tenant},${pupil},'Fee',12.75,'[রিসিট: F-120]') returning id`;
  const expected = { [bill.id]: bill };
  const [{ r: mp }] = await collect(p, expected);
  assert.ok(mp.db_fee_id);
  assert.equal((await meta()).student_fees[0].due_amount, 36);
  await status(p.id, "VOID");
  assert.equal((await meta()).student_fees[0].due_amount, 50);
  await assert.rejects(() => status(p.id, "VOID"), /অবস্থা/);
  await status(p.id, "COMPLETED");
  assert.equal((await meta()).payments[0].status, "COMPLETED");
  assert.equal(
    (await db`select status from fees where id=${unrelated}`)[0].status,
    "COMPLETED",
  );
  // Separate relational example: receipt, mirror, bill, allocation, and audit roll back together.
  await db`insert into fee_types(id,madrasa_id,name,code) values('ft',${tenant},'Fee','F')`;
  await db`insert into student_fees(id,madrasa_id,session_id,student_id,fee_type_id,fee_type_name,billing_period,base_amount,payable_amount,due_amount) values(${bill.id},${tenant},'session',${pupil},'ft','Fee','2026-11',50,50,50)`;
  const rp = { ...p, id: "rel-payment", receipt_no: "F-24" };
  const feeCount = async () =>
    (await db`select count(*) from fees where madrasa_id=${tenant}`)[0].count;
  const before = await feeCount();
  await assert.rejects(
    () =>
      collect(
        { ...rp, allocations: [{ ...alloc, fund_id: "inactive" }] },
        expected,
      ),
    /ফান্ড/,
  );
  assert.equal(await feeCount(), before);
  await db.unsafe(
    "create trigger injected_failure before insert on fee_audit_logs for each row execute function fail_pay()",
  );
  await assert.rejects(() => collect(rp, expected), /simulated failure/);
  assert.equal(await feeCount(), before);
  await db.unsafe("drop trigger injected_failure on fee_audit_logs");
  await collect(rp, expected);
  await assert.rejects(
    () => collect({ ...rp, id: "stale", receipt_no: "F-25" }, expected),
    /বদলেছে/,
  );
  const amounts = async () =>
    (
      await db`select paid_amount,discount_amount,payable_amount,due_amount from student_fees where id=${bill.id}`
    ).map((r) => Object.values(r).map(Number))[0];
  assert.deepEqual(await amounts(), [12.75, 1.25, 48.75, 36]);
  await status(rp.id, "REVERSED");
  assert.deepEqual(await amounts(), [0, 0, 50, 50]);
  await status(rp.id, "COMPLETED");
  assert.deepEqual(await amounts(), [12.75, 1.25, 48.75, 36]);
  await assert.rejects(() => status(rp.receipt_no, "VOID"), /রসিদ/);
  assert.equal(
    (
      await db`select has_function_privilege('authenticated','finance_fee_status(uuid,uuid,text,text,text)','execute') ok`
    )[0].ok,
    false,
  );
}
