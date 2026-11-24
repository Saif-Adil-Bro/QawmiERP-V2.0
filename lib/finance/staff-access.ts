import type { StaffMember } from "@/lib/staff-management";
import { financeDeniedRoles } from "./access";

type Access = { allowed: boolean; roles?: string[]; permissions?: string[] };
export function salaryAccess(a: Access, mode: "read" | "write") {
  const roles = a.roles || [],
    grants = a.permissions || [];
  return (
    a.allowed &&
    !roles.some((r) => financeDeniedRoles.includes(r)) &&
    (roles.some((r) => ["super_admin", "admin", "muhtamim"].includes(r)) ||
      grants.includes("staff.salary.manage") ||
      (mode === "read" && grants.includes("staff.salary.view")))
  );
}
// The legacy form model expects numeric fields. A redacted shell is explicitly
// marked, never shown as a zero salary, and never accepted as a contract edit.
export function staffForView(member: StaffMember, read: boolean): StaffMember {
  if (read) return member;
  return {
    ...member,
    salary_hidden: true,
    salary: { basic_salary: 0, net_salary: 0, allowances: {}, deductions: {} },
    audit_logs: [],
    documents: (member.documents || []).filter(
      (d) =>
        d.document_type !== "CONTRACT" &&
        d.document_type !== "APPOINTMENT_LETTER",
    ),
    employment_history: (member.employment_history || []).map(
      ({ previous_salary, new_salary, ...other }) => other,
    ),
  };
}

export function isSalaryVoucher(
  row: { category?: string; payroll_record_id?: string | null } | undefined,
) {
  return row?.category === "Salary" || !!row?.payroll_record_id;
}

// Return only reconciliation fields, never payroll IDs, names, beneficiary or free text.
export function expenseForView(row: any, canReadPay: boolean) {
  if (canReadPay || !isSalaryVoucher(row)) return row;
  const {
    id,
    madrasa_id,
    category,
    amount,
    expense_date,
    voucher_no,
    fund_id,
    fund_name,
    status,
    payment_method,
  } = row;
  return {
    id,
    madrasa_id,
    category,
    amount,
    expense_date,
    voucher_no,
    fund_id,
    fund_name,
    status,
    payment_method,
    description: "বেতন ভাউচার",
    salary_hidden: true,
  };
}
