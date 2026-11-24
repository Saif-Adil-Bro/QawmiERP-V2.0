import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Empty school, explicit fund mapping, integer-poisha splits, authorization boundaries and retries.
export async function cashierScenarios(db) {
  const [home, other] =
    await db`insert into madrasas(name,contact_email) values('Cashier','cashier@example.test'),('Foreign','foreign@example.test') returning id`;
  const t = home.id;
  const [u, v] =
    await db`insert into auth.users(id) values(gen_random_uuid()),(gen_random_uuid()) returning id`;
  await db`insert into users(id,madrasa_id,email,full_name) values(${u.id},${t},'cashier@example.test','Cashier'),(${v.id},${other.id},'other@example.test','Other')`;
  const [pupil, peer, foreign] =
    await db`insert into students(madrasa_id,first_name,last_name) values(${t},'A','B'),(${t},'C','D'),(${other.id},'E','F') returning id`;
  const acct = { fund_id: "lib-a", fund_name: "Library A" },
    dev = {
      fund_id: "fund-dev",
      fund_name: "মসজিদ ও উন্নয়ন ফান্ড (Development Fund)",
    };
  await db`insert into zakat_funds(id,madrasa_id,code,name,category) values('lib-a',${t},'BK','Library A','Other'),('lib-b',${other.id},'BK','Library B','Other')`;
  const p = {
    id: "new",
    madrasa_id: t,
    student_id: pupil.id,
    student_name: "A B",
    payment_date: "2026-11-10",
    payment_method: "Cash",
    total_amount_received: 2.05,
    ...acct,
    allocations: [{ ...acct, allocated_amount: 2.05, fee_type_name: "Fee" }],
  };
  const collect = (row, expected = {}, actor = u.id) =>
    db`select finance_collect_fee(${t},${actor},${db.json(row)},${db.json(expected)}) r`;
  const counts = async () =>
    Object.values(
      (
        await db`select (select count(*) from fee_payments where madrasa_id=${t}) payments,(select count(*) from fees where madrasa_id=${t}) mirrors,(select count(*) from fee_audit_logs where madrasa_id=${t}) audits`
      )[0],
    ).map(Number);
  await assert.rejects(() => collect(p, {}, v.id), /no rows/);
  await assert.rejects(
    () => collect({ ...p, student_id: foreign.id }),
    /শিক্ষার্থী/,
  );
  await assert.rejects(() => collect({ ...p, fund_id: "lib-b" }), /ফান্ড/);
  await assert.rejects(
    () => collect({ ...p, total_amount_received: 2.056 }),
    /অঙ্ক/,
  );
  await assert.rejects(
    () => collect({ ...p, total_amount_received: 2.04 }),
    /মোট অঙ্ক/,
  );
  await assert.rejects(
    () => collect({ ...p, total_amount_received: 0 }),
    /অঙ্ক/,
  );
  await assert.rejects(() => collect({ ...p, receipt_no: "bad]ref" }), /রসিদ/);
  assert.deepEqual(await counts(), [0, 0, 0]);
  const races = await Promise.all([
    collect({ ...p, idempotency_key: "one" }),
    collect({ ...p, id: "retry", idempotency_key: "one" }),
  ]);
  const winner = races[0][0].r;
  assert.equal(races[1][0].r.id, winner.id);
  assert.equal(winner.receipt_no, "MR-2026-00101");
  assert.deepEqual(await counts(), [1, 1, 1]);
  await assert.rejects(
    () =>
      collect({
        ...p,
        id: "other",
        idempotency_key: "one",
        allocations: [{ ...p.allocations[0], ...dev }],
      }),
    /অনুরোধ/,
  );
  await assert.rejects(
    () =>
      collect({
        ...p,
        id: "same-number",
        receipt_no: winner.receipt_no.toLowerCase(),
      }),
    /রসিদ/,
  );
  await db`insert into fees(madrasa_id,student_id,fee_type,amount,notes) values(${t},${peer.id},'Tuition',2,'[রিসিট: MR-2026-00999]')`;
  await assert.rejects(
    () =>
      collect({ ...p, id: "legacy-collision", receipt_no: "MR-2026-00999" }),
    /রসিদ/,
  );
  const independent = await Promise.all([
    collect({ ...p, id: "second" }),
    collect({ ...p, id: "third" }),
  ]);
  assert.deepEqual(independent.map(([x]) => x.r.receipt_no).sort(), [
    "MR-2026-01000",
    "MR-2026-01001",
  ]);
  await db`insert into accounting_periods(madrasa_id,period_key,label,start_date,end_date,is_locked) values(${t},'2026-11','lock','2026-11-01','2026-11-30',true)`;
  const status = (id, s) =>
    db`select finance_fee_status(${t},${u.id},${id},${s},'documented reason')`;
  await assert.rejects(() => collect({ ...p, id: "locked" }), /লক/);
  await assert.rejects(() => status(winner.id, "VOID"), /লক/);
  await db`update accounting_periods set is_locked=false,unlocked_at=now(),unlocked_by=${u.id} where madrasa_id=${t}`;
  const config = (key, id, old, after, base = []) =>
    db`select finance_fee_config(${t},${key},${db.json([{ id, before: old, after }])},${db.json(base)})`;
  const type = {
    id: "school-tuition",
    name: "Tuition",
    code: "T",
    category: "ACADEMIC",
    frequency: "MONTHLY",
    default_amount: 20,
    ...acct,
  };
  await config("fee_types", type.id, null, type);
  await db`update madrasas set registration_no=(finance_metadata(madrasas)||'{"sessions":[{"id":"S","is_current":true}]}')::text where id=${t}`;
  const bills = (...changes) =>
    db`select finance_edit_bills(${t},${db.json(changes)},null)`;
  const invoice = {
    madrasa_id: t,
    student_id: pupil.id,
    session_id: "S",
    fee_type_id: type.id,
    fee_type_name: "Tuition",
    billing_period: "11",
    base_amount: 20,
    discount_amount: 0,
    fine_amount: 0,
    due_amount: 20,
    payable_amount: 20,
    paid_amount: 0,
    status: "UNPAID",
    ...acct,
  };
  const addBill = (id, b) =>
    bills({ id, before: null, after: { ...invoice, ...b, id } });
  await addBill("bill1", {});
  await addBill("bill2", { billing_period: "12", ...dev });
  await addBill("peer", { student_id: peer.id });
  const bill = async (id) =>
      (await db`select to_jsonb(b) r from student_fees b where id=${id}`)[0].r,
    initial = await bill("bill1");
  const a = {
      student_fee_id: "bill1",
      ...acct,
      allocated_amount: 0,
      discount_applied: 20,
    },
    waiver = {
      ...p,
      id: "waiver",
      total_amount_received: 0,
      discount_total: 20,
      allocations: [a],
    };
  await assert.rejects(
    () =>
      collect(
        { ...waiver, allocations: [{ ...a, student_fee_id: "peer" }] },
        { peer: initial },
      ),
    /no rows/,
  );
  await assert.rejects(
    () => collect({ ...waiver, allocations: [a, a] }, { bill1: initial }),
    /একাধিক/,
  );
  const before = await counts();
  const [{ r: w }] = await collect(waiver, { bill1: initial });
  assert.equal(w.db_fee_id, null);
  assert.equal((await counts())[1], before[1]);
  assert.equal((await bill("bill1")).status, "WAIVED");
  await assert.rejects(
    () => bills({ id: "bill1", before: initial, after: null }),
    /বদলেছে/,
  );
  await status("waiver", "VOID");
  assert.equal((await bill("bill1")).due_amount, 20);
  const voidedBill = await bill("bill1");
  await assert.rejects(
    () => bills({ id: "bill1", before: voidedBill, after: null }),
    /রসিদযুক্ত/,
  );
  const split = {
    ...p,
    id: "split",
    total_amount_received: 17.25,
    advance_amount: 2.15,
    fine_total: 0.05,
    allocations: [
      { ...acct, student_fee_id: "bill1", allocated_amount: 4.05 },
      { ...dev, student_fee_id: "bill2", allocated_amount: 11 },
      { ...acct, allocated_amount: 2.15, fee_type_name: "Advance" },
      { ...dev, allocated_amount: 0.05, fee_type_name: "Fine" },
    ],
  };
  const orig = { bill1: await bill("bill1"), bill2: await bill("bill2") };
  await collect(split, orig);
  assert.equal((await bill("bill1")).due_amount, 15.95);
  assert.equal((await bill("bill2")).due_amount, 9);
  const snapshot = await counts();
  await db.unsafe(
    "create trigger injected_failure before insert on fee_audit_logs for each row execute function fail_pay()",
  );
  await assert.rejects(() => status("split", "VOID"), /simulated failure/);
  assert.deepEqual(await counts(), snapshot);
  assert.equal((await bill("bill1")).due_amount, 15.95);
  await db.unsafe("drop trigger injected_failure on fee_audit_logs");
  const transitions = await Promise.allSettled([
    status("split", "VOID"),
    status("split", "VOID"),
  ]);
  assert.equal(transitions.filter((r) => r.status === "fulfilled").length, 1);
  await db`update zakat_funds set is_active=false where madrasa_id=${t} and id='lib-a'`;
  await assert.rejects(() => status("split", "COMPLETED"), /ফান্ড/);
  assert.equal((await bill("bill1")).due_amount, 20);
  await db`update zakat_funds set is_active=true where madrasa_id=${t} and id='lib-a'`;
  await status("split", "COMPLETED");
  const [{ id: legacyId }] =
    await db`select id from fees where madrasa_id=${t} and notes='[রিসিট: MR-2026-00999]'`;
  await assert.rejects(() => status(legacyId, "VOID"), /রসিদ/);
  await db`insert into fee_payments(id,student_id,student_name,madrasa_id,session_id,receipt_no,total_amount_received,db_fee_id) values('duplicate-link',${pupil.id},'A',${t},'S','ambiguous',2.05,${winner.db_fee_id})`;
  await assert.rejects(() => status(winner.id, "VOID"), /পরিচয়/);
  assert.equal(
    (await db`select status from fees where id=${winner.db_fee_id}`)[0].status,
    "COMPLETED",
  );
  const scope = "SANDBOX:" + "1".repeat(64),
    txn = {
      transaction_id: "charge",
      madrasa_id: t,
      provider: "SSLCOMMERZ",
      status: "PENDING",
      sslcommerz_scope: scope,
      student_id: pupil.id,
      student_name: "A",
      amount: 1,
      total_payable: 1,
      payment_channel: "Card / Other",
      allocations: [{ student_fee_id: "bill1", allocated_amount: 1, ...acct }],
    };
  const reserve = (x) => db`select write_portal_fee_intent(${t},${db.json(x)})`;
  await assert.rejects(
    () => reserve({ ...txn, allocations: [{ ...txn.allocations[0], ...dev }] }),
    /fund changed/,
  );
  await reserve(txn);
  const settle = () =>
    db`select settle_portal_fee_intent(${t},${db.json(txn)},'validation','bank') r`;
  await db`update zakat_funds set is_active=false where id=${acct.fund_id}`;
  await assert.rejects(settle, /ফান্ড/);
  assert.equal((await bill("bill1")).due_amount, 15.95);
  await db`update zakat_funds set is_active=true where id=${acct.fund_id}`;
  await settle();
  assert.equal((await bill("bill1")).due_amount, 14.95);
  assert.equal((await settle())[0].r.already_paid, true);
  // Cross-table expense/bazar numbers are proposed by the UI; the database arbitrates.
  const serialRace = await Promise.allSettled([
    db`insert into expenses(madrasa_id,category,amount,fund_id,voucher_no) values(${t},'Other',8,${acct.fund_id},'SHARED-01')`,
    db`insert into bazar_expenses(madrasa_id,amount,fund_id,voucher_no) values(${t},8,${acct.fund_id},'shared-01')`,
  ]);
  assert.equal(serialRace.filter((r) => r.status === "fulfilled").length, 1);
  assert.match(
    serialRace.find((r) => r.status === "rejected").reason.message,
    /নম্বর/,
  );
  const walk = { name: "Walk-in", donor_type: "Monthly", pledge_amount: 0 },
    don = {
      ...acct,
      amount: 20,
      donation_date: "2026-11-09",
      receipt_no: "walk-1",
    };
  const receive = (r) =>
    db`select finance_receive_donation(${t},${db.json(walk)},${db.json(r)}) submission`;
  const [{ submission }] = await receive(don);
  assert.equal(submission.receipt.donor_id, submission.donor.id);
  await assert.rejects(() => receive({ ...don, receipt_no: "WALK-1" }), /রসিদ/);
  assert.equal(
    Number(
      (await db`select count(*) from donors where madrasa_id=${t}`)[0].count,
    ),
    1,
  );
  const m = {
    id: randomUUID(),
    madrasa_id: t,
    name: "Zero pledge",
    pledge_amount: 0,
  };
  const member = (tenant, id, b, a, mode) =>
    db`select finance_save_member(${tenant},${id},${db.json(b)},${db.json(a)},${mode})`;
  await member(t, m.id, [], m, "create");
  await assert.rejects(
    () => db`delete from donors where id=${m.id}`,
    /দাতার রসিদ/,
  );
  await assert.rejects(
    () => member(t, m.id, [m], { ...m, id: "unknown" }, "edit"),
    /পরিচয়/,
  );
  await assert.rejects(
    () => member(other.id, m.id, [], { ...m, madrasa_id: other.id }, "create"),
    /পরিচয়/,
  );
  await assert.rejects(() => member(t, m.id, [m], m, "invalid"), /সদস্য/);
  assert.equal(
    (
      await db`select notes::jsonb->>'pledge_amount' x from donors where id=${m.id}`
    )[0].x,
    "0",
  );
  const sid = randomUUID();
  await db`update users set role='accountant' where id=${u.id}`;
  await db`insert into user_sessions(user_id,madrasa_id,provider_session_id,expires_at) values(${u.id},${t},${sid},now()+interval '1 hour')`;
  await db.unsafe(
    "grant update,select on madrasas to authenticated; create policy test_only_update on madrasas for all to authenticated using(true) with check(true)",
  );
  await assert.rejects(
    () =>
      db.begin(async (sql) => {
        await sql`set local role authenticated`;
        await sql`select set_config('request.jwt.claim.sub',${u.id},true),set_config('request.jwt.claims',${JSON.stringify({ session_id: sid })},true)`;
        assert.equal(
          (await sql`select portal_may_use_raw_erp_tables() ok`)[0].ok,
          true,
        );
        await sql`update madrasas set finance_source_revision=finance_source_revision+1 where id=${t}`;
      }),
    /সংস্করণ/,
  );
  await db.unsafe(
    "drop policy test_only_update on madrasas; revoke update,select on madrasas from authenticated",
  );
  console.log(
    "PASS empty-book numbering, actor/tenant, concurrency/replay, bill CAS, split/advance/fine, noncash waiver, status rollback/ambiguity, locked/archive gates, funded checkout and donor history",
  );
}
