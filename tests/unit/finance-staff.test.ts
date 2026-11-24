import { describe, expect, it, vi, beforeEach } from "vitest";
import { salaryAccess, staffForView } from "@/lib/finance/staff-access";
import { canReadApproval } from "@/lib/finance/approval-terms";
import {
  generateMonthlyPayroll,
  processSalaryPayment,
  promoteStaffMember,
  updateStaffMember,
} from "@/app/actions/staff";
import {
  financeApprovalError,
  publicApproval,
} from "@/lib/finance/approval-terms";
import { boardingCharge, boardingGross } from "@/lib/finance/boarding-charges";
let roles = ["admin"],
  permissions: string[] = [];
const { hook, post } = vi.hoisted(() => ({ hook: vi.fn(), post: vi.fn() }));
vi.mock("@/lib/approval-workflow", () => ({
  submitWorkflowHookApproval: hook,
}));
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: async () => ({ rpc: post }),
}));
vi.mock("@/lib/action-authorization", () => ({
  writeGuard: async () => ({
    allowed: true,
    roles,
    permissions,
    madrasaId: "A",
    userId: "actor",
  }),
}));
vi.mock("@/lib/sessions", () => ({
  getMadrasaMetadata: async () => ({
    staff_members: [
      {
        id: "worker",
        madrasa_id: "A",
        personal: {},
        employment: { designation: "Clerk", category_id: "office" },
        salary: {
          basic_salary: 10,
          allowances: { food: 1.25 },
          deductions: {},
          net_salary: 11.25,
        },
      },
    ],
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
beforeEach(() => {
  roles = ["admin"];
  permissions = [];
  hook
    .mockReset()
    .mockResolvedValue({ matched: true, approvalRequestId: "pending" });
  post.mockReset();
});
describe("contract approval boundary", () => {
  it("directory/finance view and payroll posting are distinct; salary viewer cannot pay, draft, edit or promote with a new salary", async () => {
    roles = ["office_staff"];
    permissions = ["finance.view"];
    expect(canReadApproval({ type: "SALARY_CHANGE" }, roles, permissions)).toBe(
      false,
    );
    permissions.push("staff.salary.view");
    expect(canReadApproval({ type: "SALARY_CHANGE" }, roles, permissions)).toBe(
      true,
    );
    expect(
      salaryAccess(
        { allowed: true, roles: [...roles, "guardian"], permissions },
        "read",
      ),
    ).toBe(false);
    for (const result of [
      await generateMonthlyPayroll("01", "2026"),
      await processSalaryPayment({ recordId: "p", paymentMethod: "CASH" }),
      await updateStaffMember("worker", {
        salary: { basic_salary: 99 },
      } as any),
      await promoteStaffMember({ staffId: "worker", newSalary: 100 } as any),
    ])
      expect(result.error).toBeTruthy();
    expect(post).not.toHaveBeenCalled();
    expect(hook).not.toHaveBeenCalled();
    const redacted = staffForView(
      {
        salary: { net_salary: 123, bank_account_no: "secret" },
        employment_history: [{ previous_salary: 45, new_salary: 123 }],
        audit_logs: [{ details: "salary: 123" }],
      } as any,
      false,
    );
    expect(redacted.salary_hidden).toBe(true);
    expect(JSON.stringify(redacted)).not.toMatch(/123|secret|previous_salary/);
  });
  it("the public edit always submits calculated terms and does not save a pending contract", async () => {
    const r = await updateStaffMember("worker", {
      _approvalBypass: true,
      salary: { basic_salary: 25.75, net_salary: 999 },
    } as any);
    expect(r).toMatchObject({ pendingApproval: true });
    expect(post).not.toHaveBeenCalled();
    const p = hook.mock.calls[0][0];
    expect(p.amount).toBe(27);
    expect(p.payload.staffPayload).not.toHaveProperty("_approvalBypass");
    const req = {
      madrasa_id: "A",
      target_id: "worker",
      request_type: "SALARY_CHANGE",
      amount: 27,
      payload: p.payload,
    };
    expect(financeApprovalError("A", req)).toBeNull();
    for (const change of [
      { request_type: "RESULT_PUBLISH" },
      { amount: 25.75 },
      { madrasa_id: "B" },
      { target_id: "other" },
    ])
      expect(financeApprovalError("A", { ...req, ...change })).toBeTruthy();
    expect(publicApproval(req).payload).not.toHaveProperty("staffPayload");
  });
  it("a zero basic salary in a promotion is not absence of a change", async () => {
    const r = await promoteStaffMember({
      staffId: "worker",
      newDesignation: "Volunteer",
      effectiveDate: "2026-11-01",
      reason: "Fixture",
      newSalary: 0,
      _approvalBypass: true,
    } as any);
    expect(r).toMatchObject({ pendingApproval: true });
    expect(post).not.toHaveBeenCalled();
    expect(hook.mock.calls[0][0]).toMatchObject({
      amount: 1.25,
      payload: { salaryTerms: { basic_salary: 0, net_salary: 1.25 } },
    });
  });
});
it("distributes the last poisha deterministically and concessions balance to gross", () => {
  const shares = boardingGross(
    11,
    new Map([
      ["C", 1],
      ["B", 1],
      ["A", 1],
    ]),
  );
  expect([...shares]).toEqual([
    ["A", 4],
    ["B", 4],
    ["C", 3],
  ]);
  expect(boardingCharge(3, "হাফ-ফ্রি")).toEqual({
    gross_amount: 0.03,
    discount_amount: 0.02,
    bill_amount: 0.01,
  });
});
