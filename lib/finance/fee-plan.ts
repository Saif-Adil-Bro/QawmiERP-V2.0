import type { PaymentAllocation, StudentFee } from "@/lib/fee-management";

export interface CashierInput {
  student_id: string;
  session_id?: string;
  payment_date?: string;
  payment_method: string;
  transaction_ref?: string;
  total_amount: number;
  discount_amount?: number;
  discount_reason?: string;
  fine_amount?: number;
  fine_reason?: string;
  advance_amount?: number;
  fee_allocations?: PaymentAllocation[];
  notes?: string;
  billing_month?: string;
  billing_year?: string;
  fee_type?: string;
  fund_id?: string;
  fund_name?: string;
  idempotency_key?: string;
}
function cents(n: unknown): number {
  // Accept JS addition noise, not sub-poisha prices or partial numeric parses.
  if (
    typeof n !== "number" ||
    !Number.isFinite(n) ||
    n < 0 ||
    n > 99999999.99 ||
    Math.abs(n * 100 - Math.round(n * 100)) > 0.000001
  )
    throw new Error("টাকার অঙ্ক পয়সা পর্যন্ত দিতে হবে।");
  return Math.round(n * 100);
}
export function planReceipt(input: CashierInput, bills: StudentFee[]) {
  const out: PaymentAllocation[] = [];
  const mine = new Map(
    bills
      .filter((b) => b.student_id === input.student_id)
      .map((b) => [b.id, b]),
  );
  const expected: Record<string, { paid_amount: number; due_amount: number }> =
    {};
  const cash = cents(input.total_amount),
    fine = cents(input.fine_amount ?? 0);
  let advance = cents(input.advance_amount ?? 0);
  const requested = input.fee_allocations ?? [],
    explicitDiscount = requested.reduce(
      (n, a) => n + cents(a.discount_applied ?? 0),
      0,
    );
  const discount = cents(input.discount_amount ?? explicitDiscount / 100);
  if (
    discount < explicitDiscount ||
    fine + advance > cash ||
    !(discount || cash)
  )
    throw new Error("আদায়, ছাড় ও বণ্টনের অঙ্ক মেলেনি।");
  let remaining = cash - fine - advance,
    undistributed = discount - explicitDiscount;
  function line(
    a: Partial<PaymentAllocation>,
    b: StudentFee | undefined,
    paid: number,
    disc: number,
  ) {
    const fund = a.fund_id ? a : input.fund_id ? input : b;
    if (!fund?.fund_id || !fund.fund_name)
      throw new Error("প্রতিটি খাতের সক্রিয় ফান্ড নির্বাচন করুন।");
    if (b) {
      if (expected[b.id]) throw new Error("একই বিল একাধিকবার দেওয়া হয়েছে।");
      expected[b.id] = { paid_amount: b.paid_amount, due_amount: b.due_amount };
    }
    out.push({
      student_fee_id: b?.id,
      fee_type_id: b?.fee_type_id || a.fee_type_id,
      fee_type_name: b?.fee_type_name || a.fee_type_name || "ফি",
      billing_period: b?.billing_period || a.billing_period,
      allocated_amount: paid / 100,
      discount_applied: disc / 100,
      fund_id: fund.fund_id,
      fund_name: fund.fund_name,
    });
  }
  if (requested.length) {
    for (const a of requested) {
      const b = a.student_fee_id ? mine.get(a.student_fee_id) : undefined;
      if (a.student_fee_id && !b) throw new Error("শিক্ষার্থীর বিল মেলেনি।");
      const paid = cents(a.allocated_amount);
      let disc = cents(a.discount_applied ?? 0);
      if (undistributed && b) {
        const take = Math.min(
          undistributed,
          Math.max(0, cents(b.due_amount) - paid - disc),
        );
        disc += take;
        undistributed -= take;
      }
      if ((!paid && !disc) || (!b && disc))
        throw new Error("বণ্টন ও মূল বিল যাচাই করুন।");
      line(a, b, paid, disc);
      remaining -= paid;
    }
    if (remaining !== 0)
      throw new Error(
        "খাতভিত্তিক বণ্টন, অগ্রিম ও জরিমানার যোগফল মোট আদায়ের সমান হতে হবে।",
      );
  } else {
    for (const b of [...mine.values()]
      .filter((b) => b.due_amount > 0)
      .sort(
        (a, b) =>
          String(a.due_date).localeCompare(String(b.due_date)) ||
          a.id.localeCompare(b.id),
      )) {
      if (!remaining && !undistributed) break;
      const due = cents(b.due_amount),
        disc = Math.min(undistributed, due),
        paid = Math.min(remaining, due - disc);
      line({}, b, paid, disc);
      remaining -= paid;
      undistributed -= disc;
    }
    advance += remaining;
  }
  if (undistributed) throw new Error("বিলের বিপরীতে সম্পূর্ণ ছাড় বণ্টন করুন।");
  if (fine)
    line(
      { fee_type_name: "জরিমানা", billing_period: input.billing_month },
      undefined,
      fine,
      0,
    );
  if (advance)
    line(
      { fee_type_name: input.fee_type || "অগ্রিম জমা", billing_period: "অগ্রিম" },
      undefined,
      advance,
      0,
    );
  return {
    allocations: out,
    expected,
    discount_total: discount / 100,
    fine_total: fine / 100,
    advance_amount: advance / 100,
    total_amount_received: cash / 100,
  };
}
