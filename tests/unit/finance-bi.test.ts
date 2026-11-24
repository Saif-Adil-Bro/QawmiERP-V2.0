import { beforeEach, afterEach, expect, it, vi } from "vitest";
import {
  executeCustomReport,
  getExecutiveBiSnapshot,
} from "@/lib/bi/executive-bi-service";
const state = vi.hoisted(() => ({ mode: "rpc", fail: false }));
const funds = [{ id: "library", name: "Library", current_balance: 99999 }];
const src = { fund_id: "library", fund_name: "Library" };
vi.mock("@/lib/finance/read-books", () => ({
  readBooks: async () => {
    if (state.fail) throw Error("incomplete");
    return {
      funds,
      meta: {},
      feeTypes: [{ id: "food", code: "FOOD" }],
      donations: [],
      expenses: [],
      bazar: [],
      bills: [
        {
          id: "nov",
          class_id: "C",
          student_id: "s",
          fee_type_id: "food",
          session_id: "S",
          billing_period: "2026-11",
          payable_amount: 8,
          paid_amount: 5,
          due_amount: 3,
        },
        {
          id: "other",
          session_id: "other",
          payable_amount: 99,
          due_amount: 99,
        },
      ],
      payments: [
        {
          id: "r",
          status: "COMPLETED",
          total_amount_received: 5,
          payment_date: "2026-12-05",
          allocations: [{ allocated_amount: 5, student_fee_id: "nov", ...src }],
        },
        {
          id: "v",
          status: "VOID",
          total_amount_received: 1,
          session_id: "S",
          ...src,
        },
        {
          id: "historic",
          payment_date: "2026-11-03",
          total_amount_received: 2,
          fee_type: "Hostel",
          session_id: "other",
        },
      ],
    };
  },
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: async () => ({
    rpc: async () =>
      state.mode === "rpc"
        ? {
            data: {
              total_fee_collections: 999,
              boarding_monthly: [
                {
                  month_key: "2026-11",
                  active_meal_days: 1,
                  boarding_fee_income: 777,
                },
              ],
            },
          }
        : { error: { code: "42883" } },
    from: (table: string) => {
      const q: any = {};
      for (const k of ["select", "eq", "order", "limit", "range"])
        q[k] = () => q;
      q.then = (res: any) =>
        res(
          table.startsWith("mv_") && state.mode !== "mv"
            ? { error: { code: "42P01" } }
            : {
                data:
                  table === "mv_bi_boarding_monthly"
                    ? [
                        {
                          month_key: "2026-11",
                          active_meal_days: 1,
                          boarding_fee_income: 777,
                        },
                      ]
                    : [],
              },
        );
      return q;
    },
  }),
}));
// The example has a December payment for a November bill. Pin the reporting
// clock after the receipt; an earlier as-of date must not borrow December cash.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-12-10T06:00:00Z"));
  state.fail = false;
});
afterEach(() => {
  vi.useRealTimers();
});
it("keeps December receipt out of a November closing fund reserve", async () => {
  const nov = await executeCustomReport("school", {
    dataset: "funds",
    dateTo: "2026-11-30",
  });
  const dec = await executeCustomReport("school", {
    dataset: "funds",
    dateFrom: "2026-12-01",
    dateTo: "2026-12-10",
  });
  expect([nov.summary.totalAmount, dec.summary.totalAmount]).toEqual([2, 7]);
});
it.each(["rpc", "mv", "fallback"])(
  "uses actual receipt month and scoped class dues, not cached finance in %s mode",
  async (mode) => {
    state.mode = mode;
    state.fail = false;
    const out = await getExecutiveBiSnapshot("school", {
      sessionId: "S",
      months: 6,
    });
    expect(out.source).toBe(mode);
    expect(out.summary).toMatchObject({
      totalFeeCollections: 5,
      totalBoardingFeeIncome: 5,
      totalFeeDue: 3,
      totalFundBalance: 7,
    });
    expect(
      out.boarding.find((m) => m.month_key === "2026-12")?.boarding_fee_income,
    ).toBe(5);
    expect(
      out.boarding.find((m) => m.month_key === "2026-11")
        ?.boarding_fee_income || 0,
    ).toBe(0);
    expect(out.classFeeDues).toHaveLength(1);
    expect(
      out.funds.find((f) => f.fund_id === "__review__")?.current_balance,
    ).toBe(2);
  },
);
it("does not replace a failed ledger read with a successful cached BI balance", async () => {
  state.fail = true;
  state.mode = "rpc";
  await expect(getExecutiveBiSnapshot("school")).rejects.toThrow("incomplete");
});
