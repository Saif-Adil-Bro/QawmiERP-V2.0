import { rows } from "./queries";
import { toDhakaMonthString } from "../date-utils";

// Older imports can contain the same allocation twice. Preserve distinct funds and discounts.
export function receiptAllocations(p: any): any[] {
  const seen = new Set<string>();
  return (p.allocations ?? p.fee_payment_allocations ?? []).filter((a: any) => {
    const key = JSON.stringify([
      a.student_fee_id,
      a.fee_type_id,
      a.fee_type_name,
      a.billing_period,
      a.fund_id,
      Number(a.allocated_amount),
      Number(a.discount_applied || 0),
      Number(a.fine_applied || 0),
    ]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
export function mergeWaivers(legacy: any[] = [], sql: any[] = []) {
  // Admin writes the legacy store; values with the same ID there supersede backfilled copies.
  return Array.from(
    new Map([...sql, ...legacy].map((w) => [w.id, w])).values(),
  );
}
// A receipt is identified by its stable link/number, never by date + amount.
export function reconcilePayments(
  payments: any[],
  legacy: any[],
  includeCancelled = false,
) {
  const key = (v: any) =>
    String(v ?? "")
      .trim()
      .toUpperCase();
  const tracked = new Set(
    payments.flatMap((p) =>
      [p.id, p.db_fee_id, p.receipt_no].filter(Boolean).map(key),
    ),
  );
  const merged = payments
    .filter((p) => includeCancelled || p.status === "COMPLETED")
    .map((p) => ({ ...p, allocations: receiptAllocations(p) }));
  for (const f of legacy) {
    const number =
      f.receipt_no ||
      f.receipt_number ||
      f.notes
        ?.match(/\[(?:রিসিট|রসিদ|অনলাইন পেমেন্ট|Receipt):\s*([^|\]]+)/i)?.[1]
        ?.trim();
    if (
      ["VOID", "VOIDED", "REVERSED"].includes(f.status) ||
      tracked.has(key(f.id)) ||
      (number && tracked.has(key(number)))
    )
      continue;
    const amount = Number(f.amount_paid ?? f.amount ?? 0);
    merged.push({
      ...f,
      db_fee_id: f.id,
      receipt_no: number || "",
      status: "COMPLETED",
      total_amount_received: amount,
      discount_total: 0,
      fine_total: 0,
      advance_amount: 0,
      allocations: [{ fee_type_name: f.fee_type, allocated_amount: amount }],
    });
    if (number) tracked.add(key(number));
  }
  return merged.sort(
    (a, b) =>
      String(b.payment_date || "").localeCompare(
        String(a.payment_date || ""),
      ) || String(b.id).localeCompare(String(a.id)),
  );
}
export async function studentLedger(
  db: any,
  tenant: string,
  id: string,
  meta: any,
  sessionId?: string,
) {
  const scoped = (table: string, select = "*", optional = false) =>
    rows(
      () =>
        db
          .from(table)
          .select(select)
          .eq("madrasa_id", tenant)
          .eq("student_id", id),
      optional,
    );
  const [sqlBills, sqlPayments, legacy, waivers] = await Promise.all([
    scoped("student_fees", "*", true),
    scoped("fee_payments", "*,fee_payment_allocations(*)", true),
    scoped("fees"),
    scoped("fee_discount_waivers", "*", true),
  ]);
  // Follow Admin's relational-first cutover. An empty student ledger in a migrated tenant is authoritative.
  let relational = !!(sqlBills.length || sqlPayments.length);
  if (!relational && (meta.payments?.length || meta.student_fees?.length)) {
    const probes = await Promise.all(
      ["student_fees", "fee_payments", "fee_structures"].map((table) =>
        db.from(table).select("id").eq("madrasa_id", tenant).limit(1),
      ),
    );
    for (const p of probes)
      if (p.error && !["PGRST205", "42P01"].includes(p.error.code))
        throw new Error(p.error.message);
    relational = probes.some((p) => p.data?.length);
  }
  const own = (list: any[] = []) => list.filter((x) => x.student_id === id);
  const inPeriod = (x: any) =>
    !sessionId || sessionId === "ALL" || x.session_id === sessionId;
  const fees: any[] = (relational ? sqlBills : own(meta.student_fees)).filter(
    inPeriod,
  );
  const payments = reconcilePayments(
    relational ? sqlPayments : own(meta.payments),
    legacy,
  ).filter(inPeriod);
  const outstanding = fees.filter((f) => Number(f.due_amount) > 0);
  const month = toDhakaMonthString();
  const inMonth = (f: any) =>
    f.billing_period === month || String(f.due_date || "").startsWith(month);
  const sum = (items: any[], field: string) =>
    items.reduce((n, x) => n + Number(x[field] ?? 0), 0);
  return {
    student_id: id,
    fees,
    payments,
    discounts: mergeWaivers(own(meta.discounts), waivers).filter(inPeriod),
    total_paid: sum(payments, "total_amount_received"),
    total_payable: sum(fees, "payable_amount"),
    total_due: sum(fees, "due_amount"),
    current_month_due: sum(outstanding.filter(inMonth), "due_amount"),
  };
}
