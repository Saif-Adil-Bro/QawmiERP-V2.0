import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_FUNDS,
  REVIEW_FUND,
  bazarFund,
  exactFundLabel,
  isRestrictedFund,
  storedFund,
  type FundItem,
} from "@/lib/fund-utils";
import { auditLines, periodLines } from "@/lib/finance/statement";

const tenant = "tenant-a",
  goraba: FundItem = {
    id: "custom-restricted",
    name: "গোরাবা ছাত্র তহবিল",
    code: "GOR",
    category: "Other",
    is_active: true,
  };
const funds = [...DEFAULT_FUNDS, goraba];
const dbFrom = vi.hoisted(() =>
  vi.fn(() => ({ select: () => ({ eq: async () => ({ data: [] }) }) })),
);
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: async () => ({ from: dbFrom }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: async () => ({ from: dbFrom }),
  createClient: async () => ({}),
  getAuthUser: async () => ({ id: "actor" }),
}));
// The two-account browser fixture covers real masking permissions; this test
// instruments the ledger, not the identity lookup used to choose its projection.
vi.mock("@/lib/data-access-guards", () => ({
  getCurrentUserMaskingContext: async () => ({ allowUnmasked: false }),
}));
vi.mock("@/lib/action-authorization", () => ({
  writeGuard: async () => ({ allowed: true, madrasaId: "tenant-a" }),
}));
vi.mock("@/app/actions/students", () => ({
  getAuthMadrasaId: async () => "tenant-a",
}));
vi.mock("@/app/actions/fee-management", () => ({
  getFeeMetadata: async () => ({ payments: [] }),
}));
vi.mock("@/lib/sessions", () => ({ getMadrasaMetadata: async () => meta }));
vi.mock("@/lib/finance/funds", () => ({
  fundCatalog: async () => funds,
  financeRows: async (_: unknown, t: string, key: keyof typeof rows) => {
    expect(t).toBe(tenant);
    return rows[key];
  },
}));
import { getFundOverview, getFundLedgerData, getFunds } from "@/app/actions/zakat";
import { getExpenses } from "@/app/actions/accounting";

const meta = {
  mahfils: [
    {
      transactions: [{ id: "mt", amount: 120, type: "EXPENSE" }],
      settlement: {
        mahfil_txn_id: "mt",
        settlement_type: "SURPLUS_DEPOSIT",
        amount: 120,
        fund_id: goraba.id,
        accounting_record_id: "d1",
        accounting_voucher_no: "MHF-1",
      },
    },
  ],
};
const rows = {
  fees: [],
  donations: [
    {
      id: "d1",
      donation_date: "2026-01-05",
      amount: 120,
      fund_id: goraba.id,
      donation_type: goraba.name,
      receipt_no: "MHF-1",
    },
    {
      id: "d2",
      donation_date: "2026-01-08",
      amount: 22,
      fund_id: goraba.id,
      donation_type: goraba.name,
      receipt_no: "MHF-orphan",
    },
    {
      id: "d3",
      donation_date: "2025-12-02",
      amount: 15,
      fund_id: "fund-general",
      donation_type: "Zakat",
    },
    { id: 'void-orphan', donation_date: '2026-01-08', receipt_no: 'MHF-OLD-VOID', fund_id: goraba.id, amount: 5, status: 'VOID' },
    { id: 'zero-orphan', donation_date: '2026-01-08', receipt_no: 'MHF-ZERO', fund_id: goraba.id, amount: 0 },
    { id: 'cancelled', donation_date: '2026-01-08', receipt_no: 'MHF-CANCEL', fund_id: goraba.id, amount: 5, status: 'VOID', void_reason: 'মাহফিল সমন্বয় বাতিল' },
  ],
  expenses: [
    {
      id: "e1",
      expense_date: "2026-01-06",
      amount: 8,
      fund_id: goraba.id,
      category: "Food",
    },
    {
      id: "e2",
      expense_date: "2026-01-06",
      amount: 4,
      fund_id: goraba.id,
      voucher_no: "EXP-MHF-orphan",
      category: "Food",
    },
    {
      id: "e3",
      expense_date: "2026-01-06",
      amount: 7,
      fund_id: goraba.id,
      status: "VOID",
      category: "Food",
    },
  ],
  bazar_expenses: [
    {
      id: "b1",
      expense_date: "2026-01-06",
      amount: 9,
      fund_id: "fund-dev",
      fund_name: "Development",
    },
  ],
};

describe("Phase 1 accounting integrity", () => {
  it("keeps the exact ID; no substring, first-fund, category, or old General-default rescue", () => {
    expect(
      storedFund(funds, {
        fund_id: "not-in-catalog",
        donation_type: "General",
      }),
    ).toBeUndefined();
    expect(
      storedFund(funds, { fund_id: "fund-general", donation_type: "Zakat" }),
    ).toBeUndefined();
    expect(
      storedFund(funds, {
        fund_id: "fund-general",
        description: `[FUND: ${goraba.id} | ${goraba.name}]`,
      }),
    ).toBeUndefined();
    expect(exactFundLabel(funds, "Zakat fundraiser 2026")).toBeUndefined();
    expect(storedFund(funds, { donation_type: "Zakat" })?.id).toBe(
      "fund-zakat",
    );
    expect(
      storedFund(funds, { description: "[FUND: fund-dev | Development] bill" })
        ?.id,
    ).toBe("fund-dev");
    expect(
      bazarFund(funds, {
        items_details:
          "[VOUCHER: B-1 | FUND: fund-dev | FUND_NAME: Development] rice",
      })?.id,
    ).toBe("fund-dev");
    expect(isRestrictedFund(goraba)).toBe(true);
    const duplicate = [...funds, { ...goraba, id: "another" }];
    expect(exactFundLabel(duplicate, goraba.name)).toBeUndefined();
    expect(
      storedFund(duplicate, { fund_id: goraba.id, fund_name: goraba.name })?.id,
    ).toBe(goraba.id);
  });
  it("repeated real balance and ledger actions flag both orphans; no writes or changes to amounts", async () => {
    const original = structuredClone(rows);
    dbFrom.mockClear();
    for (let i = 0; i < 2; i++) {
      const view = await getFundOverview();
      expect(view.error).toBeUndefined();
      expect(view.review.map((r) => r.id).sort()).toEqual(["d2", "d3", "e2", "void-orphan", "zero-orphan"]);
      expect((await getFunds(tenant)).find(f => f.id === goraba.id)?.current_balance).toBe(112);
      expect((await getExpenses({ fundId: REVIEW_FUND.id })).map(e => e.id)).toEqual(['e2']);
      expect(view.funds.find((f) => f.id === goraba.id)?.current_balance).toBe(
        112,
      );
      const ledger = await getFundLedgerData(goraba.id);
      expect(ledger.totalInflow).toBe(120);
      expect(ledger.totalOutflow).toBe(8);
      expect(ledger.transactions.map((t) => t.id).sort()).toEqual([
        "cancelled",
        "d1",
        "e1",
        "e3",
      ]);
    }
    // financeRows above is read-only. Any old .from('donations'/'expenses').delete()
    // call (even inside a swallowed try/catch) would also appear here.
    expect(dbFrom).not.toHaveBeenCalled();
    expect(rows).toEqual(original);
  });
  it("keeps ambiguous history in the statement, separate from both General and confirmed restricted balances", () => {
    const result = periodLines({
      funds,
      start: "2026-01-01",
      end: "2026-12-31",
      donations: rows.donations,
      expenses: rows.expenses,
      bazar: rows.bazar_expenses,
      meta,
      payments: [],
    });
    const selected = (id: string) => result.find((r) => r.fundId === id)!;
    expect(selected(REVIEW_FUND.id)).toMatchObject({
      openingBalance: 15,
      totalIncome: 22,
      totalExpense: 4,
      closingBalance: 33,
    });
    expect(selected("fund-general").closingBalance).toBe(0);
    expect(selected(goraba.id).closingBalance).toBe(112);
    expect(selected("fund-dev").totalExpense).toBe(9);
    const shura = auditLines(result, { general: 30 });
    expect(shura[0].closingBalance).toBe(30);
    expect(shura.find((f) => f.fundId === goraba.id)?.totalIncome).toBe(120);
    expect(shura.find((f) => f.fundId === REVIEW_FUND.id)?.totalIncome).toBe(
      22,
    );
  });
  it("does not count a mirrored subscription twice or route a same-name custom fund to General", () => {
    const result = periodLines({
      funds,
      start: "2026-01-01",
      end: "2026-01-31",
      donations: [rows.donations[0]],
      expenses: [],
      bazar: [],
      payments: [],
      meta: {
        ...meta,
        donor_subscription_payments: [
          {
            id: "other",
            accounting_record_id: "d1",
            receipt_no: "MHF-1",
            fund_id: goraba.id,
            amount: 120,
            payment_date: "2026-01-05",
          },
          {
            id: "unmirrored",
            fund_id: goraba.id,
            amount: 4,
            payment_date: "2025-12-31",
          },
        ],
      },
    });
    expect(result.find((f) => f.fundId === goraba.id)).toMatchObject({
      openingBalance: 4,
      totalIncome: 120,
      closingBalance: 124,
    });
  });
});
