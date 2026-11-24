import { bdtPoisha } from "@/lib/payment-gateway-engine";
import type { StaffSalaryStructure } from "@/lib/staff-management";

// Only the server calculates payable salary. Zero is a real change; never trust
// a submitted net_salary or round malformed input to a different contract.
export function salaryTerms(
  old: StaffSalaryStructure,
  patch: Partial<StaffSalaryStructure>,
): StaffSalaryStructure {
  function cents(x: unknown) {
    const v = bdtPoisha(x);
    if (v === null) throw Error("বেতনের অঙ্ক পয়সা পর্যন্ত যাচাই করুন।");
    return v;
  }
  function components(v: object) {
    if (!v || typeof v !== "object" || Array.isArray(v))
      throw Error("বেতনের উপাদান যাচাই করুন।");
    return Object.fromEntries(
      Object.entries(v).map(([k, n]) => [k, cents(n) / 100]),
    );
  }
  const basic = cents(patch.basic_salary ?? old.basic_salary),
    allowances = components(patch.allowances ?? old.allowances ?? {}),
    deductions = components(patch.deductions ?? old.deductions ?? {});
  const sum = (v: Record<string, number>) =>
    Object.values(v).reduce((n, x) => n + cents(x), 0);
  const net = basic + sum(allowances) - sum(deductions);
  if (net < 0 || net > 9999999999) throw Error("নিট বেতন যাচাই করুন।");
  return {
    ...old,
    ...patch,
    basic_salary: basic / 100,
    allowances,
    deductions,
    net_salary: net / 100,
  };
}
export function salaryApprovalAmount(s: StaffSalaryStructure) {
  return Math.max(s.basic_salary, s.net_salary);
}
