import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
export async function receiptTests(db, t, actor, json) {
  const day = "2019-02-01";
  const [p] =
    await db`insert into students(madrasa_id,first_name,last_name) values(${t},'Test','Pupil') returning id`;
  if (json)
    await db`update madrasas set registration_no=(finance_metadata(madrasas)||'{"fee_types":[{"id":"legacy"}]}')::text,finance_source_revision=finance_source_revision+1 where id=${t}`;
  const acct = {
    fund_id: "fund-general",
    fund_name: "সাধারণ ফান্ড (General Fund)",
  };
  const row = {
    id: randomUUID(),
    ...acct,
    student_id: p.id,
    student_name: "Test Pupil",
    madrasa_id: t,
    payment_date: day,
    total_amount_received: 2.05,
    payment_method: "Cash",
    idempotency_key: randomUUID(),
    allocations: [
      { ...acct, allocated_amount: 1.05 },
      { ...acct, allocated_amount: 1 },
    ],
  };
  const collect = (r) =>
    db`select finance_collect_fee(${t},${actor},${db.json(r)},'{}',${actor}) r`;
  const book = async () =>
    (await db`select treasury_cashbook(${t},${actor},${day}) b`)[0].b;
  const status = (s) =>
    db`select finance_fee_status(${t},${actor},${row.id},${s},'reconcile')`;
  await db`select treasury_cash_action(${t},${actor},${day},'OPEN',null,0,null,'',null)`;
  await collect(row);
  await collect({ ...row, id: randomUUID() });
  for (const method of ["Bank", "bKash", "Nagad", "Online", undefined])
    await collect({
      ...row,
      id: randomUUID(),
      idempotency_key: randomUUID(),
      payment_method: method,
    });
  assert.equal((await book()).collected, 2.05);
  assert.equal((await book()).rows.length, 1);
  assert.equal(
    (
      await db`select relational from treasury_fee_tenders where madrasa_id=${t} and payment_id=${row.id}`
    )[0].relational,
    !json,
  );
  await status("VOID");
  assert.equal((await book()).expected, 0);
  await status("COMPLETED");
  assert.equal((await book()).collected, 2.05);
  await db`select treasury_cash_action(${t},${actor},${day},'CLOSE',null,2.05,null,'',2.05)`;
  await assert.rejects(() => status("VOID"), /closed/);
  assert.equal(
    (
      await db`select count(*) from fees where madrasa_id=${t} and payment_date=${day} and status='VOID'`
    )[0].count,
    "0",
  );
}
