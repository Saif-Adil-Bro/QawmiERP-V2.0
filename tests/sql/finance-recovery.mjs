import assert from "node:assert/strict";

// Keep only counts/digests in memory. Compare all rows (including IDs, amounts,
// dates, statuses, parent links and the legacy books), not just gross totals.
export async function recoveryEvidence(db) {
  const result = {};
  for (const table of [
    "madrasas",
    "students",
    "fee_types",
    "fee_structures",
    "fee_structure_items",
    "student_fees",
    "fee_payments",
    "fee_payment_allocations",
    "fees",
    "fee_audit_logs",
    "expenses",
    "donations",
    "donors",
    "bazar_expenses",
    "accounting_periods",
    "approval_requests",
    "portal_fee_checkouts",
  ]) {
    [result[table]] =
      await db`select count(*)::int n,md5(string_agg(to_jsonb(r)::text,'|' order by to_jsonb(r)::text)) digest from ${db(table)} r`;
  }
  assert.ok(
    result.fee_payment_allocations.n > 0 &&
      result.fee_structure_items.n > 0 &&
      result.madrasas.n >= 2,
  );
  result.raw = (
    await db`select has_table_privilege('authenticated','fee_payments','select') p,has_function_privilege('anon','finance_backup_children(uuid,text,text)','execute') c`
  )[0];
  assert.deepEqual(result.raw, { p: false, c: false });
  // Validate scoped financial child exports against raw fixture truth in every school.
  for (const { id } of await db`select id from madrasas`) {
    for (const [child, parent, fk] of [
      ["fee_payment_allocations", "fee_payments", "payment_id"],
      ["fee_structure_items", "fee_structures", "structure_id"],
    ]) {
      const expected =
        await db`select c.id from ${db(child)} c join ${db(parent)} p on p.id=c.${db(fk)} where p.madrasa_id=${id} order by c.id`;
      let after = null;
      const actual = [];
      for (;;) {
        const [{ r }] =
          await db`select finance_backup_children(${id},${child},${after}) r`;
        actual.push(...r.map((c) => c.id));
        if (r.length < 500) break;
        after = r.at(-1).id;
      }
      assert.deepEqual(
        actual,
        expected.map((r) => r.id),
      );
    }
  }
  return result;
}
