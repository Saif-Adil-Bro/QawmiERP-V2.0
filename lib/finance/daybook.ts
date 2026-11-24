import { ledgerEntries, type Books } from "./entries";
import { isSalaryVoucher } from "./staff-access";
import { journalLegs } from "./journal";
import type { ExpenseLine } from "./expense-lines";
export interface DayFilters {
  start: string;
  end: string;
  flow?: string;
  fund?: string;
  student?: string;
  staff?: string;
  item?: string;
  q?: string;
}
export interface DayRow {
  key: string;
  date: string;
  voucher: string;
  fund: string;
  fundName: string;
  kind: "income" | "expense" | "journal";
  amount: number;
  delta: number;
  party: string;
  category: string;
  student?: string;
  staff?: string;
  staffName?: string;
  lines: ExpenseLine[];
  review?: string;
  void: boolean;
  expenseId?: string;
}
export function validDate(d: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(d) &&
    !Number.isNaN(Date.parse(d)) &&
    new Date(d).toISOString().slice(0, 10) === d
  );
}
export function daybook(books: Books, f: DayFilters, allowSalary: boolean) {
  if (
    !validDate(f.start) ||
    !validDate(f.end) ||
    f.end < f.start ||
    !["both", "income", "expense"].includes(f.flow || "both")
  )
    throw Error("তারিখ বা লেনদেনের ধরন সঠিক নয়।");
  const expenses = new Map(books.expenses.map((r) => [r.id, r]));
  const salaries = new Map<string, any>(
    (books.meta.staff_salary_records || [])
      .filter((r: any) => r.status === "PAID" && r.expense_id)
      .map((r: any) => [r.expense_id, r]),
  );
  const staffNames = new Map<string, string>(
    (books.meta.staff_members || []).map((r: any) => [
      r.id,
      r.personal?.full_name_bn ||
        [r.personal?.first_name, r.personal?.last_name]
          .filter(Boolean)
          .join(" ") ||
        r.staff_name ||
        r.id,
    ]),
  );
  const rows: DayRow[] = ledgerEntries(books).map((e) => {
    const v = !e.income && expenses.get(e.id),
      pay = v?.payroll_record_id && salaries.get(v.id);
    const hidePayroll = !allowSalary && isSalaryVoucher(v);
    const staff =
      (!hidePayroll &&
        (v?.staff_id ||
          (allowSalary && pay && pay.id === v.payroll_record_id
            ? pay.staff_id
            : undefined))) ||
      undefined;
    return {
      key: `${e.source}:${e.id}`,
      date: e.date,
      voucher: e.voucher_no,
      fund: e.fund_id,
      fundName: e.fund_name,
      kind: e.income ? "income" : "expense",
      amount: e.amount,
      delta: e.income ? e.amount : -e.amount,
      party: hidePayroll ? "বেতন ভাউচার" : e.source_or_recipient,
      category: hidePayroll ? "বেতন" : v?.head_name || e.category || "",
      student:
        e.source === "fee"
          ? e.donor_id
          : hidePayroll
            ? undefined
            : v?.student_id,
      staff,
      staffName: staff ? staffNames.get(staff) || staff : undefined,
      lines: hidePayroll ? [] : v?.line_items || [],
      review: e.reason,
      void: e.status === "VOID",
      expenseId: hidePayroll ? undefined : v?.id,
    };
  });
  for (const leg of journalLegs(books.journals, books.funds))
    rows.push({
      key: leg.id,
      date: leg.date,
      voucher: leg.voucher_no,
      fund: leg.fund_id,
      fundName: leg.fund_name,
      kind: "journal",
      amount: leg.amount,
      delta: leg.delta,
      party: leg.source_or_recipient,
      category: `${leg.category} · ${leg.delta > 0 ? "ডেবিট (+)" : "ক্রেডিট (−)"} · ${leg.notes}`,
      lines: [],
      void: false,
    });
  const term = (v?: string) => v?.trim().toLowerCase() || "";
  return rows
    .filter(
      (r) =>
        r.date >= f.start &&
        r.date <= f.end &&
        (!f.flow || f.flow === "both" || f.flow === r.kind) &&
        (!f.fund || r.fund === f.fund) &&
        (!f.student || r.student === f.student) &&
        (!f.staff || r.staff === f.staff) &&
        (!term(f.item) ||
          r.lines.some((l) => term(l.label).includes(term(f.item)))) &&
        [
          r.voucher,
          r.party,
          r.category,
          r.fundName,
          r.staffName,
          r.student,
          ...r.lines.map((l) => l.label),
        ].some((v) => term(v).includes(term(f.q))),
    )
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.voucher.localeCompare(b.voucher) ||
        a.key.localeCompare(b.key),
    );
}
// Minimum confirmed balance from the posting day forward. A backdated transfer must
// not spend the same balance again on a later day. Sum integral poisha per date.
export function spendable(books: Books, id: string, d: string) {
  const changes = new Map<string, number>();
  function add(day: string, n: number) {
    changes.set(day, (changes.get(day) || 0) + Math.round(n * 100));
  }
  for (const r of ledgerEntries(books))
    if (r.fund_id === id && !r.reason && r.status !== "VOID")
      add(r.date, (r.income ? 1 : -1) * r.amount);
  for (const r of journalLegs(books.journals, books.funds))
    if (r.fund_id === id) add(r.date, r.delta);
  let balance = 0;
  for (const [day, n] of changes) if (day <= d) balance += n;
  let min = balance;
  for (const [day, n] of [...changes].sort(([a], [b]) => a.localeCompare(b)))
    if (day > d) {
      balance += n;
      min = Math.min(min, balance);
    }
  return min / 100;
}
