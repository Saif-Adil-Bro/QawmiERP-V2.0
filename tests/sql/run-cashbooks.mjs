import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readFeePreflight } from "../../scripts/portal-fee-preflight.mjs";
import { createHash, randomUUID } from "node:crypto";
import { receiptTests } from "./cashbook-receipts.mjs";
import { withDisposablePostgres } from "./disposable-postgres.mjs";
let expected;
async function snapshot(db) {
  const result = {};
  for (const name of [
    "treasury_heads",
    "treasury_journals",
    "treasury_movements",
    "treasury_days",
    "treasury_fee_tenders",
    "treasury_epochs",
    "treasury_memos",
    "madrasas",
    "expenses",
    "donations",
  ]) {
    [result[name]] =
      await db`select count(*)::int n,md5(string_agg(to_jsonb(r)::text,'|' order by to_jsonb(r)::text)) digest from ${db(name)} r`;
    assert.ok(result[name].n > 0);
  }
  return result;
}
await withDisposablePostgres(
  async ({ db }) => {
    const [t, b] =
      await db`insert into madrasas(name,contact_email) values ('School','a@example.invalid'),('Other','b@example.invalid') returning id`;
    const [a, c, x] =
      await db`insert into auth.users(id) values(gen_random_uuid()),(gen_random_uuid()),(gen_random_uuid()) returning id`;
    for (const [u, s] of [
      [a, t],
      [c, t],
      [x, b],
    ])
      await db`insert into users(id,madrasa_id,role,email,full_name) values (${u.id},${s.id},'accountant',${u.id + "@example.invalid"},'Operator')`;
    await db`insert into donations(madrasa_id,amount,donation_type) values(${t.id},77,'General')`;
    const conn = await db.reserve();
    try {
      for (const file of [
        "supabase_finance_integrity_migration.sql",
        "supabase_finance_cashbooks_migration.sql",
        "supabase_finance_cashbooks_migration.sql",
      ])
        await conn.unsafe(readFileSync(file, "utf8"));
    } finally {
      conn.release();
    }
    await receiptTests(db, t.id, c.id, false);
    await receiptTests(db, b.id, x.id, true);
    console.log(
      "PASS SQL and JSON fee custody: split + legacy mirror counted once; idempotent retry; no implicit Cash; void/restore and closed-day rollback",
    );
    const d = "2020-06-10";
    const op = (
      who,
      kind,
      n = null,
      { id = randomUUID(), recipient = null, ref = "memo", seen = null } = {},
    ) =>
      db`select treasury_cash_action(${t.id},${who},${d},${kind},${id},${n},${recipient},${ref},${seen})`;
    const book = async (who) =>
      (await db`select treasury_cashbook(${t.id},${who},${d}) b`)[0].b;
    const dep = (method, amount = 4) =>
      db`select finance_receive_donation(${t.id},null,${db.json({ amount, donation_date: d, receipt_no: randomUUID(), fund_id: "fund-general" })},${a.id},${method})`;
    await op(a.id, "OPEN", 10);
    await op(c.id, "OPEN", 0);
    for (const method of [
      "Bank",
      "bKash",
      "Nagad",
      "Online gateway",
      "Cheque",
      "Unknown",
    ])
      await dep(method, 100);
    await dep("Cash", 25.25);
    await db`insert into donations(madrasa_id,amount,fund_id,donation_date) values (${t.id},55,'fund-general',${d})`;
    await db`select treasury_head(${t.id},${a.id},null,'Rice','Food',true)`;
    const [h] = await db`select id from treasury_heads`;
    const items = db.json([
      { label: "Rice", amount: 3.15 },
      { label: "Oil", amount: 2.1 },
    ]);
    const [v] =
      await db`insert into expenses(madrasa_id,category,fund_id,restricted_beneficiary,amount,expense_date,operator_id,payment_method,head_id,line_items) values(${t.id},'Food','fund-zakat','Eligible pupil',5.25,${d},${a.id},'Cash',${h.id},${items}) returning id,head_name`;
    await db`select treasury_head(${t.id},${a.id},${h.id},'Meals','Food',false)`;
    assert.equal(
      (await db`select head_name from expenses where id=${v.id}`)[0].head_name,
      "Rice",
    );
    await assert.rejects(
      () =>
        db`insert into expenses(madrasa_id,category,fund_id,amount,line_items) values(${t.id},'Utility','fund-general',1,${items})`,
      /total/,
    );
    await assert.rejects(
      () =>
        db`insert into expenses(madrasa_id,category,fund_id,amount,head_id) values(${b.id},'Food','fund-general',5,${h.id})`,
    );
    await assert.rejects(
      () => db`update expenses set amount=3 where id=${v.id}`,
    );
    assert.deepEqual(
      [(await book(a.id)).expected, (await book(c.id)).expected],
      [30, 0],
    );
    const hand = randomUUID();
    const cancelled = randomUUID();
    await op(a.id, "HANDOVER", 29, { id: cancelled, recipient: c.id });
    await assert.rejects(() => op(a.id, "BANK", 2), /Insufficient/);
    await assert.rejects(() => op(c.id, "CANCEL", null, { id: cancelled }));
    await op(a.id, "CANCEL", null, { id: cancelled });
    await assert.rejects(() => op(c.id, "ACCEPT", null, { id: cancelled }));
    assert.ok(
      (await book(c.id)).moves.find((m) => m.id === cancelled).cancelled_at,
    );
    assert.equal((await book(a.id)).expected, 30);
    await op(a.id, "HANDOVER", 8, { id: hand, recipient: c.id });
    await assert.rejects(() => op(a.id, "ACCEPT", null, { id: hand }));
    await assert.rejects(() => op(a.id, "CLOSE", 30, { seen: 30 }));
    await op(c.id, "ACCEPT", null, { id: hand });
    await op(a.id, "BANK", 10);
    assert.equal((await book(c.id)).expected, 8);
    assert.equal((await book(a.id)).expected, 12);
    await assert.rejects(() => op(a.id, "CLOSE", 11, { seen: 12, ref: "" }));
    await assert.rejects(() => op(a.id, "CLOSE", 12, { seen: 13 }));
    await op(a.id, "CLOSE", 11.5, { seen: 12, ref: "Short 50 poisha" });
    assert.equal((await book(a.id)).variance, -0.5);
    await assert.rejects(() => dep("Cash", 1), /closed/);
    await assert.rejects(
      () => db`update expenses set status='VOID' where id=${v.id}`,
      /closed/,
    );
    await assert.rejects(() => book(x.id));
    const transportDay = "2018-02-02";
    const skin = {
      id: "skin",
      transport_operator_id: c.id,
      transport_method: "Cash",
      sale_date: transportDay,
      transport_labour_cost: 1.25,
    };
    const mirrors = (r) => ({
      qurbani_leather_records: [r],
      leather_batches: [r],
    });
    const both = mirrors(skin),
      voided = mirrors({ ...skin, expense_status: "VOID" });
    const update = (before, after) =>
      db`select finance_replace_sources(${t.id},${db.json(before)},${db.json(after)},${c.id})`;
    await update(
      { qurbani_leather_records: null, leather_batches: null },
      both,
    );
    const carriage = async () =>
      (await db`select treasury_cashbook(${t.id},${c.id},${transportDay}) b`)[0]
        .b.expenses;
    assert.equal(await carriage(), 1.25);
    assert.equal(
      (await book(c.id)).expenses,
      0,
      "Transport belongs only to its actual cash date",
    );
    await update(both, voided);
    assert.equal(await carriage(), 0);
    await update(voided, both);
    await db`select treasury_cash_action(${t.id},${c.id},${transportDay},'OPEN',null,2,null,'',null)`;
    await db`select treasury_cash_action(${t.id},${c.id},${transportDay},'CLOSE',null,0.75,null,'',0.75)`;
    await assert.rejects(() => update(both, voided), /closed/);
    await assert.rejects(
      () => update(both, { ...both, leather_batches: [] }),
      /copies/,
    );
    const bytes = "/9j/2Q==";
    await db`select treasury_attach_memo(${t.id},${c.id},${v.id},${bytes})`;
    assert.equal(
      (await db`select treasury_read_memo(${b.id},${v.id}) m`)[0].m,
      null,
    );
    assert.equal(
      (await db`select treasury_read_memo(${t.id},${v.id}) m`)[0].m,
      bytes,
    );
    await assert.rejects(
      () => db`select treasury_attach_memo(${t.id},${c.id},${v.id},${bytes})`,
      /duplicate/,
    );
    const index = async (t) =>
      (await db`select treasury_memo_index(${t},null) m`)[0].m;
    assert.deepEqual(await index(b.id), []);
    assert.equal((await index(t.id))[0].expense_id, v.id);
    assert.equal((await index(t.id))[0].bytes, 4);
    assert.equal(
      (await index(t.id))[0].sha256,
      createHash("sha256").update(Buffer.from(bytes, "base64")).digest("hex"),
    );
    // A memo alone binds an otherwise simple bank voucher. It may still be voided
    // in an open period, but the amount, date and description cannot be rewritten.
    const [simple] =
      await db`insert into expenses(madrasa_id,fund_id,category,expense_date,amount,description) values(${t.id},'fund-general','Other',${transportDay},2,'Original') returning id`;
    await db`select treasury_attach_memo(${t.id},${a.id},${simple.id},${bytes})`;
    await assert.rejects(
      () =>
        db`update expenses set description='Rewritten' where id=${simple.id}`,
      /মেমো/,
    );
    await db`update expenses set status='VOID',void_reason='Duplicate' where id=${simple.id}`;
    await db`update expenses set status='COMPLETED' where id=${simple.id}`;

    const rev = async () =>
      (
        await db`select revision from treasury_epochs where madrasa_id=${t.id}`
      )[0].revision;
    const j = (
      kind,
      from,
      to,
      n,
      ver = null,
      available = null,
      key = randomUUID(),
    ) =>
      db`select treasury_post_journal(${t.id},${a.id},${key},${d},${kind},${from},${to},${n},'verified',${ver},${available})`;
    await j("OPENING", null, "fund-dev", 30);
    await assert.rejects(() => j("OPENING", null, "fund-dev", 2));
    const r = await rev(),
      key = randomUUID();
    await j("TRANSFER", "fund-dev", "fund-zakat", 3, r, 30, key);
    await j("TRANSFER", "fund-dev", "fund-zakat", 3, r, 30, key);
    const current = await rev();
    for (const args of [
      ["TRANSFER", "fund-zakat", "fund-general", 1],
      ["ADJUST_OUT", "fund-zakat", null, 1],
      ["TRANSFER", "fund-dev", "fund-dev", 1],
      ["TRANSFER", "fund-dev", "foreign", 1],
    ])
      await assert.rejects(() => j(...args, current, 30));
    await assert.rejects(
      () => j("TRANSFER", "fund-dev", "fund-general", 1, r, 30),
      /changed/,
    );
    await assert.rejects(() =>
      j("TRANSFER", "fund-dev", "fund-general", 31, current, 30),
    );
    await j("ADJUST_IN", null, "fund-dev", 4);
    await j("ADJUST_OUT", "fund-dev", null, 1, await rev(), 31);
    const epoch = await rev(),
      race = await Promise.allSettled([
        j("TRANSFER", "fund-dev", "fund-general", 25, epoch, 30),
        j("TRANSFER", "fund-dev", "fund-general", 25, epoch, 30),
      ]);
    assert.equal(race.filter((r) => r.status === "fulfilled").length, 1);
    await assert.rejects(
      () => j("TRANSFER", "fund-dev", "fund-general", 10, epoch, 30),
      /changed/,
    );
    await db`insert into accounting_periods(madrasa_id,period_key,label,start_date,end_date,is_locked) values(${t.id},'2020-06','closed','2020-06-01','2020-06-30',true)`;
    await assert.rejects(() => j("ADJUST_IN", null, "fund-dev", 1), /closed/);
    assert.equal(
      (await db`select count(*) from treasury_journals`)[0].count,
      "5",
    );
    await assert.rejects(
      () =>
        db.begin(async (tx) => {
          await tx`set local role authenticated`;
          await tx`select * from treasury_memos`;
        }),
      /permission denied/,
    );
    console.log(
      "PASS Phase 2: no historical attribution; exact tender/actor, dual-control handover, locked close, discrepancy; item totals, immutable head; paired journal, replay, restricted/foreign/closed/stale guards",
    );
    const preflight = () =>
      db.begin((tx) =>
        readFeePreflight((q, args = []) => tx.unsafe(q, args), [t.id, b.id], {
          cashbooks: true,
        }),
      );
    const report = await preflight();
    for (const school of report.institutions)
      assert.deepEqual(
        Object.keys(school.blockers).filter((k) => k.startsWith("treasury_")),
        [],
      );
    const [first, second] = report.institutions;
    assert.equal(first.inventory.private_memos, 2);
    assert.equal(second.inventory.private_memos, 0);
    assert.equal(first.inventory.journal_vouchers, 5);
    assert.equal(first.review.treasury_explained_variances, 1);
    assert.ok(!JSON.stringify(report).includes(v.id));
    await db.unsafe(
      "revoke execute on function treasury_cashbook(uuid,uuid,date) from service_role",
    );
    assert.equal(
      (await preflight()).institutions[0].blockers
        .treasury_rpc_missing_or_grants,
      1,
    );
    await db.unsafe(
      "grant execute on function treasury_cashbook(uuid,uuid,date) to service_role",
    );
    console.log(
      "PASS cancelled handover remains auditable and releases reserved cash; memo-only edit refused; Phase 2 two-tenant read-only inventory, variance and grant gate",
    );
    expected = await snapshot(db);
  },
  {
    afterColdRestore: async (db) => {
      assert.deepEqual(await snapshot(db), expected);
      assert.deepEqual(
        (
          await db`select has_table_privilege('authenticated','treasury_days','select') d,has_table_privilege('service_role','treasury_memos','select') m,has_function_privilege('authenticated','treasury_read_memo(uuid,uuid)','execute') r`
        )[0],
        { d: false, m: false, r: false },
      );
      console.log(
        "PASS Phase 2 cold restore: original vouchers, byte-identical private memo, operator custody, tender evidence, journals, heads and grants",
      );
    },
  },
);
