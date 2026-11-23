import { canReadSchoolFinance } from "./access";
import { salaryAccess } from "./staff-access";
import { bdtPoisha } from "@/lib/payment-gateway-engine";

/** Recheck the amount and beneficiary shown to the approver against the saved payload. */
export function financeApprovalError(
  tenant: string,
  req: {
    madrasa_id: string;
    request_type: string;
    amount?: number;
    target_id: string;
    payload?: Record<string, any>;
  },
) {
  const payload = req.payload || {};
  const action = String(payload.action || "").toLowerCase();
  if (!hasFinanceAction(payload)) return null;
  const amount = bdtPoisha(req.amount);
  if (action === "update_staff_salary" || action === "promote_staff") {
    const salary = payload.salaryTerms,
      basic = bdtPoisha(salary?.basic_salary),
      net = bdtPoisha(salary?.net_salary);
    if (
      req.madrasa_id !== tenant ||
      req.request_type !== "SALARY_CHANGE" ||
      !req.target_id ||
      payload.staffId !== req.target_id ||
      !payload.priorSalary ||
      basic === null ||
      net === null ||
      Math.max(basic, net) !== amount ||
      (action === "promote_staff"
        ? payload.promotePayload?.staffId !== req.target_id ||
          bdtPoisha(payload.promotePayload?.newSalary) !== basic
        : bdtPoisha(payload.staffPayload?.salary?.basic_salary) !== basic)
    )
      return "অনুমোদিত কর্মী বা বেতনের শর্ত মেলেনি।";
    return null;
  }
  if (!amount || req.madrasa_id !== tenant)
    return "অনুমোদনের প্রতিষ্ঠান বা অঙ্ক মেলেনি।";
  if (action === "create_expense") {
    const x = payload.expenseData;
    if (
      req.request_type !== "LARGE_EXPENSE" ||
      !x?.fund_id ||
      x.fund_id !== req.target_id ||
      bdtPoisha(x.amount) !== amount
    )
      return "অনুমোদিত ব্যয়ের খাত বা অঙ্ক মেলেনি।";
  } else {
    const x = payload.paymentData,
      discount =
        x?.discount_amount ??
        (Array.isArray(x?.fee_allocations)
          ? x.fee_allocations.reduce(
              (sum: number, a: any) => sum + Number(a.discount_applied || 0),
              0,
            )
          : 0);
    if (
      !["FEE_DISCOUNT", "FEE_WAIVER"].includes(req.request_type) ||
      !x?.student_id ||
      x.student_id !== req.target_id ||
      bdtPoisha(discount) !== amount
    )
      return "অনুমোদিত ছাত্র বা ছাড়ের অঙ্ক মেলেনি।";
  }
  return null;
}

export const hasFinanceAction = (payload?: Record<string, any>) =>
  [
    "collect_fee_payment",
    "create_expense",
    "update_staff_salary",
    "promote_staff",
  ].includes(String(payload?.action || "").toLowerCase());
/** Manual/legacy requests can have only a type and no executable payload. They
 * still contain school financial data. Never infer visibility from the handler. */
export function isFinancialRequest(r: {
  request_type?: string;
  type?: string;
  payload?: Record<string, any>;
}) {
  return (
    hasFinanceAction(r.payload) ||
    ["LARGE_EXPENSE", "SALARY_CHANGE", "FEE_DISCOUNT", "FEE_WAIVER"].includes(
      String(r.request_type ?? r.type).toUpperCase(),
    )
  );
}
export function canReadApproval(
  r: Parameters<typeof isFinancialRequest>[0],
  roles: string[],
  permissions: string[],
) {
  if (
    String(r.request_type ?? r.type).toUpperCase() === "SALARY_CHANGE" ||
    ["promote_staff", "update_staff_salary"].includes(
      String(r.payload?.action).toLowerCase(),
    )
  ) {
    return salaryAccess({ allowed: true, roles, permissions }, "read");
  }
  return !isFinancialRequest(r) || canReadSchoolFinance(roles, permissions);
}
// JSONB does not retain object key order. Store ordered scalar terms, not a hash
// of an arbitrary request object. An old or edited workflow must be resubmitted.
export function financeWorkflowTerms(w: {
  id: string;
  require_two_person?: boolean;
  is_active?: boolean;
  min_amount?: number;
  max_amount?: number | null;
  steps: any[];
}) {
  return [
    w.id,
    w.require_two_person !== false,
    w.is_active !== false,
    w.min_amount ?? 0,
    w.max_amount ?? null,
    w.steps.map((s) => [
      s.id,
      s.step_order,
      s.approver_role ?? null,
      s.approver_user_id ?? null,
      s.required_permission ?? null,
      !!s.require_step_up,
      !!s.is_critical,
    ]),
  ];
}

// Overview clients never need HR bank details, private contact data, or the
// executable copy of a contract. The decision handler reloads it server-side.
export function publicApproval<
  T extends {
    request_type?: string;
    type?: string;
    payload?: Record<string, any>;
    execution_result?: Record<string, any> | null;
  },
>(r: T): T {
  if (!isFinancialRequest(r)) return r;
  const p = r.payload || {};
  return {
    ...r,
    payload: {
      action: p.action,
      ...(String(r.request_type ?? r.type) === "SALARY_CHANGE"
        ? {
            staffId: p.staffId,
            basic_salary: p.salaryTerms?.basic_salary,
            net_salary: p.salaryTerms?.net_salary,
          }
        : {}),
    },
    ...(r.execution_result
      ? { execution_result: { executed: r.execution_result.executed === true } }
      : {}),
  };
}
