import { beforeEach, describe, expect, it, vi } from "vitest";
import { planReceipt } from "@/lib/finance/fee-plan";
import { financeApprovalError } from "@/lib/finance/approval-terms";
import { collectFeePayment } from "@/app/actions/fee-management";
import { createExpense } from "@/app/actions/accounting";
import { addBoardingMealPayment } from "@/app/actions/boarding";
import { reconcilePayments } from "@/lib/portal/ledger";
import { cashierPayment } from "@/lib/finance/cashier";
const school = "A",
  fund = { fund_id: "library", fund_name: "Library" },
  bill = {
    id: "b",
    student_id: "p",
    session_id: "S",
    fee_type_id: "hostel",
    fee_type_name: "Meals",
    billing_period: "2026-11",
    paid_amount: 0,
    due_amount: 10.25,
    ...fund,
  };
const params = {
  student_id: "p",
  payment_date: "2026-11-18",
  payment_method: "Cash",
  total_amount: 5,
  discount_amount: 1,
  ...fund,
};
const mocks = vi.hoisted(() => ({
  guard: vi.fn(),
  approve: vi.fn(),
  rpc: vi.fn(),
  store: vi.fn(),
  period: vi.fn(),
  user: vi.fn(),
}));
const query: any = {
  select: () => query,
  eq: () => query,
  single: async () => ({ data: { id: "p", first_name: "Pupil" } }),
};
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: () => query }),
  getAuthUser: mocks.user,
  createAdminClient: async () => ({ rpc: mocks.rpc }),
}));
vi.mock("@/lib/fee-store", () => ({ getFeeMetadata: mocks.store }));
vi.mock("@/lib/finance/funds", () => ({
  postingFund: async () => ({ id: "library", name: "Library" }),
  postingError: (e: any) => e.message,
}));
vi.mock("@/app/actions/students", () => ({
  getAuthMadrasaId: async () => "A",
}));
vi.mock("@/lib/permissions-server", () => ({ requirePermission: mocks.guard }));
vi.mock("@/lib/approval-workflow", () => ({
  submitWorkflowHookApproval: mocks.approve,
}));
vi.mock("@/lib/lock-guards", () => ({
  assertAccountingPeriodUnlocked: mocks.period,
}));
vi.mock("@/lib/action-authorization", () => ({
  writeGuard: async () => ({
    allowed: true,
    madrasaId: "A",
    userId: "cashier",
  }),
}));
vi.mock("@/lib/audit-log", () => ({ logAuditEvent: async () => {} }));
vi.mock("@/lib/webhooks/dispatcher", () => ({
  dispatchWebhookEvent: async () => {},
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.mockResolvedValue({
    id: "cashier",
    email: "fixture@example.test",
  });
  mocks.guard.mockResolvedValue({ allowed: true });
  mocks.approve.mockResolvedValue({ matched: false });
  mocks.period.mockResolvedValue({ locked: false });
  mocks.store.mockResolvedValue({
    student_fees: [bill],
    fee_types: [{ id: "hostel", category: "BOARDING" }],
  });
  mocks.rpc.mockImplementation(async (_: string, args: any) => ({
    data: { ...args.p, receipt_no: "ACTUAL-42" },
  }));
});
describe("cashier and approval boundaries", () => {
  it("plans cents, discount, fine and advance exactly, with one expectation per invoice", () => {
    const plan = planReceipt(
      {
        ...params,
        total_amount: 12.7,
        discount_amount: 0.25,
        fine_amount: 0.2,
      },
      [bill as any],
    );
    expect(
      plan.allocations.map((a) => [a.allocated_amount, a.discount_applied]),
    ).toEqual([
      [10, 0.25],
      [0.2, 0],
      [2.5, 0],
    ]);
    expect(plan.expected.b).toMatchObject({
      paid_amount: 0,
      due_amount: 10.25,
    });
    expect(() =>
      planReceipt({ ...params, total_amount: 4.002 }, [bill as any]),
    ).toThrow();
    expect(() =>
      planReceipt(
        {
          ...params,
          fee_allocations: [
            {
              student_fee_id: "other",
              allocated_amount: 5,
              fee_type_name: "Fee",
            },
          ],
        },
        [bill as any],
      ),
    ).toThrow();
  });
  it("public fee action cannot skip approval; binds the real target, date, amount and planned split", async () => {
    mocks.approve.mockResolvedValue({
      matched: true,
      approvalRequestId: "req",
    });
    expect(
      await (collectFeePayment as any)(
        { ...params, _approvalBypass: true },
        true,
      ),
    ).toMatchObject({ pendingApproval: true });
    expect(mocks.rpc).not.toHaveBeenCalled();
    const hook = mocks.approve.mock.calls[0][0];
    expect(hook).toMatchObject({
      madrasaId: school,
      actorId: "cashier",
      targetId: "p",
      amount: 1,
      payload: { approvedPlan: { discount_total: 1 } },
    });
    const auth = {
      madrasa_id: school,
      target_id: "p",
      request_type: hook.requestType,
      amount: hook.amount,
      payload: hook.payload,
    };
    expect(financeApprovalError(school, auth)).toBeNull();
    for (const change of [
      { amount: 9 },
      { target_id: "someone" },
      { madrasa_id: "B" },
      { request_type: "OTHER" },
    ])
      expect(financeApprovalError(school, { ...auth, ...change })).toBeTruthy();
    expect(
      await cashierPayment(params, "B", hook.payload.approvedPlan),
    ).toHaveProperty("error");
    expect(
      await cashierPayment(
        { ...params, fund_id: "other" },
        school,
        hook.payload.approvedPlan,
      ),
    ).toHaveProperty("error");
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(
      await cashierPayment(params, school, hook.payload.approvedPlan),
    ).toMatchObject({ receipt_no: "ACTUAL-42" });
    expect(mocks.rpc).toHaveBeenCalledWith(
      "finance_collect_fee",
      expect.objectContaining({
        p_actor: "cashier",
        p_tenant: school,
        p_expected: hook.payload.approvedPlan.expected,
      }),
    );
  });
  it("public expense ignores form approval flags and does not post when approval is pending", async () => {
    mocks.approve.mockResolvedValue({
      matched: true,
      approvalRequestId: "req",
    });
    const f = new FormData();
    for (const [k, v] of Object.entries({
      ...fund,
      category: "Repairs",
      amount: "100.55",
      expense_date: "2026-11-18",
      _approvalBypass: "true",
    }))
      f.append(k, v);
    expect(
      await (createExpense as any)({}, f, {
        tenant: "A",
        requestId: "unknown",
      }),
    ).toMatchObject({ pendingApproval: true });
    expect(mocks.rpc).not.toHaveBeenCalled();
    const hook = mocks.approve.mock.calls[0][0],
      req = {
        madrasa_id: school,
        amount: 100.55,
        target_id: "library",
        request_type: "LARGE_EXPENSE",
        payload: hook.payload,
      };
    expect(financeApprovalError(school, req)).toBeNull();
    expect(financeApprovalError(school, { ...req, amount: 100 })).toBeTruthy();
    mocks.guard.mockResolvedValue({ allowed: false, error: "denied" });
    expect(await createExpense({}, f)).toMatchObject({ error: "denied" });
  });
  it("does not post on denied discount, locked period or unavailable pupil", async () => {
    mocks.guard
      .mockResolvedValueOnce({ allowed: true })
      .mockResolvedValueOnce({ allowed: false, error: "denied" });
    expect((await collectFeePayment(params)).error).toContain("denied");
    mocks.period.mockResolvedValueOnce({ locked: true, error: "closed" });
    expect(await collectFeePayment(params)).toMatchObject({ error: "closed" });
    mocks.user.mockResolvedValue(null);
    expect(await collectFeePayment(params)).toHaveProperty("error");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("boarding can only pay one existing bill for that student and period; never creates a bill during collection", async () => {
    const input = {
      student_id: "p",
      amount: 1.25,
      payment_date: "2026-11-02",
      idempotency_key: "boarding:1",
    };
    expect(
      await addBoardingMealPayment({ ...input, student_id: "unbilled" }),
    ).toHaveProperty("error");
    mocks.store.mockResolvedValueOnce({
      student_fees: [bill, { ...bill, id: "other" }],
      fee_types: [{ id: "hostel", code: "FOOD" }],
    });
    expect(await addBoardingMealPayment(input)).toHaveProperty("error");
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(await addBoardingMealPayment(input)).toMatchObject({
      success: true,
    });
    expect(mocks.rpc.mock.calls[0][1].p.allocations[0]).toMatchObject({
      student_fee_id: "b",
      allocated_amount: 1.25,
      ...fund,
    });
  });
  it("retains independent amounts; incompatible receipt numbers or broken mirror links go to review instead of a printable receipt", () => {
    const p = {
      id: "p",
      receipt_no: "R1",
      status: "COMPLETED",
      student_id: "one",
      total_amount_received: 5,
    };
    const legacy = {
      id: "l",
      amount: 5,
      student_id: "one",
      notes: "[রসিদ: R1]",
    };
    expect(reconcilePayments([p], [legacy], true).map((r) => r.id)).toEqual([
      "p",
    ]);
    expect(
      reconcilePayments([p], [{ ...legacy, notes: "" }], true),
    ).toHaveLength(2);
    const conflicts = reconcilePayments(
      [p],
      [{ ...legacy, student_id: "two" }],
      true,
    );
    expect(conflicts).toHaveLength(2);
    expect(conflicts.every((r) => r.finance_review_reason)).toBe(true);
    expect(
      reconcilePayments([{ ...p, db_fee_id: "missing" }], [], true)[0]
        .finance_review_reason,
    ).toBeTruthy();
  });
});
