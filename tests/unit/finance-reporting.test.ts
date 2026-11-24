import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_FUNDS, REVIEW_FUND } from "@/lib/fund-utils";
import { ledgerEntries } from "@/lib/finance/entries";
import { dashboardFinance } from "@/lib/finance/dashboard";
import { readBooks } from "@/lib/finance/read-books";
import { expensePeriod } from "@/lib/finance/period";
import {
  getFundOverview,
  getFundLedgerData,
  getDonations,
  getDonationById,
  getDonors,
  getFundChoices,
} from "@/app/actions/zakat";
import { getLifeMemberDonors } from "@/app/actions/fundraising";
import {
  getAccountingReport,
  getUnifiedIncomeHistory,
  getFeeWithReceiptNo,
} from "@/app/actions/accounting";
import { getAnnualAuditStatement } from "@/app/actions/audit";
import { getMonthlyExecutiveSummary } from "@/app/actions/executive-summary";

const tenant = "A",
  date = "2026-02-03",
  fund = {
    id: "library",
    name: "Library",
    category: "Other" as const,
    code: "LIB",
    is_active: false,
  };
const fields = { fund_id: fund.id, fund_name: fund.name },
  posted = { ...fields, madrasa_id: tenant, donation_date: date, amount: 15 };
const f = (id: string, amount: number) => ({
  id,
  amount,
  ...fields,
  payment_date: date,
});
const leather = {
  id: "skin",
  received_amount: 6,
  transport_labour_cost: 2,
  sale_date: date,
  ...fields,
};
const fixture = () => ({
  donations: [
    {
      ...posted,
      id: "s1",
      receipt_no: "S-1",
      donor_id: null,
      notes: "[মাসিক চাঁদা]",
    },
    {
      ...posted,
      id: "d2",
      receipt_no: "COLLISION",
      notes: "independent receipt",
    },
    {
      ...posted,
      id: "disagree",
      receipt_no: "VOID-MISMATCH",
      amount: 7,
      status: "COMPLETED",
    },
  ],
  expenses: [{ ...posted, id: "expense", amount: 3, expense_date: date }],
  bazar_expenses: [{ id: "b", expense_date: date, amount: 8, status: "VOID" }],
  fees: [{ id: "legacy", payment_date: date, amount: 3, fee_type: "Monthly" }],
  donors: [],
  meta: {
    mahfils: [
      {
        id: "unsettled",
        transactions: [
          { id: "event-local", type: "INCOME", date, amount: 500, ...fields },
        ],
      },
    ],
    life_member_donors: [
      { id: "old-member", name: "Member", member_no: "LM-1" },
    ],
    donor_subscription_payments: [
      { ...f("subscription", 15), receipt_no: "S-1", donor_id: "old-member" },
      { ...f("other", 15), receipt_no: "COLLISION" },
      {
        ...f("bad-void", 7),
        accounting_record_id: "disagree",
        receipt_no: "VOID-MISMATCH",
        status: "VOID",
      },
      { ...f("prior", 4), payment_date: "2026-01-31", donor_id: "old-member" },
    ],
    qurbani_leather_records: [leather],
    leather_batches: [
      { ...leather },
      {
        ...leather,
        id: "other-skin",
        received_amount: 2,
        transport_labour_cost: 0,
      },
    ],
  },
  payments: [
    {
      id: "fee",
      receipt_no: "MR",
      payment_date: date,
      status: "COMPLETED",
      total_amount_received: 10,
      fine_total: 2,
      advance_amount: 2,
      allocations: [{ allocated_amount: 6, ...fields }],
    },
    {
      id: "over",
      receipt_no: "OV",
      payment_date: date,
      status: "COMPLETED",
      total_amount_received: 5,
      allocations: [{ allocated_amount: 8, ...fields }],
    },
  ],
});
let data: any;
let failed = false;
const misc: any = {
  select: () => misc,
  eq: () => misc,
  gte: () => misc,
  lte: () => misc,
  single: async () => ({ data: {} }),
  then: (resolve: any) => resolve({ data: [] }),
};
const db = { from: () => misc };
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: async () => db }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => db,
  createAdminClient: async () => db,
  getAuthUser: async () => ({ id: "actor" }),
}));
vi.mock("@/app/actions/students", () => ({
  getAuthMadrasaId: async () => tenant,
  getStudents: async () => [],
  getClasses: async () => [],
}));
vi.mock("@/app/actions/staff", () => ({
  getStaffRoster: async () => [],
}));
vi.mock("@/app/actions/syllabus", () => ({
  getSyllabusDashboardData: async () => null,
}));
vi.mock("@/app/actions/fee-management", () => ({
  getFeeMetadata: async () => ({ payments: data.payments }),
}));
vi.mock("@/lib/sessions", () => ({
  getMadrasaMetadata: async () => structuredClone(data.meta),
}));
vi.mock("@/lib/getMadrasaInfo", () => ({
  getMadrasaInfo: async () => ({ name: "School" }),
}));
vi.mock("@/lib/data-access-guards", () => ({
  getCurrentUserMaskingContext: async () => ({ allowUnmasked: true }),
  maskDonorSensitiveFields: (d: any) => d,
}));
vi.mock("@/lib/action-authorization", () => ({
  writeGuard: async () => ({ allowed: true, madrasaId: tenant }),
}));
vi.mock("@/lib/structured-config", () => ({
  getStructuredMadrasaSetting: async () => ({ found: false }),
}));
vi.mock("@/lib/finance/funds", () => ({
  fundCatalog: async () => [...DEFAULT_FUNDS, fund],
  financeRows: async (_: unknown, t: string, k: string) => {
    expect(t).toBe(tenant);
    if (failed) throw new Error("read failed");
    return structuredClone(data[k]);
  },
}));

beforeEach(() => {
  data = fixture();
  failed = false;
});
describe("Same records across accounting surfaces", () => {
  it("keeps receipt date distinct from the subscription month and VOID in the history but not cash", async () => {
    data.meta.donor_subscription_payments[0].month = "2026-01";
    data.donations.push({
      ...posted,
      id: "void",
      donor_id: "old-member",
      receipt_no: "OLD-VOID",
      status: "VOID",
    });
    const view = await getLifeMemberDonors();
    expect(view.donors[0].total_donated).toBe(19);
    expect(view.payments.find((x) => x.id === "s1")).toMatchObject({
      month: "2026-01",
      payment_date: "2026-02-03",
      status: "COMPLETED",
    });
    expect(view.payments.find((x) => x.id === "void")).toMatchObject({
      month: "",
      receipt_no: "OLD-VOID",
      status: "VOID",
    });
    expect(view.payments.find((x) => x.id === "prior")?.receipt_no).toBe("");
  });
  it("balances, donor history, receipts and books agree without crediting the cache or a guessed mirror", async () => {
    const view = await getFundOverview();
    expect(view.error).toBeUndefined();
    expect(view.review.map((r) => r.id).sort()).toEqual([
      "d2",
      "disagree",
      "fee_extra",
      "legacy_fee_0",
      "over",
    ]);
    expect(view.funds.find((x) => x.id === "library")).toMatchObject({
      total_collected: 33,
      total_expense: 5,
      current_balance: 28,
    });
    expect(await getFundChoices()).not.toContainEqual(
      expect.objectContaining({ id: "library" }),
    );
    expect((await getFundLedgerData("library")).currentBalance).toBe(28);
    expect(
      (await getDonations({ fund_id: fund.id, startDate: date, endDate: date }))
        .map((x) => x.id)
        .sort(),
    ).toEqual([
      "fee_fee_0",
      "leather_inc_other-skin",
      "leather_inc_skin",
      "s1",
    ]);
    expect(await getDonationById("s1")).toMatchObject({
      fund_id: fund.id,
      amount: 15,
      donor_id: "old-member",
    });
    expect(await getDonationById("COLLISION")).toBeNull();
    expect((await getDonors())[0]).toMatchObject({
      id: "old-member",
      total_donated: 19,
      donation_count: 2,
    });
    expect((await getLifeMemberDonors()).donors[0]).toMatchObject({
      id: "old-member",
      total_donated: 19,
    });
    expect(await getFeeWithReceiptNo("legacy")).toMatchObject({
      id: "legacy",
      total_amount_received: 3,
    });
    const books = await readBooks(tenant, async () => ({
      payments: data.payments,
    }));
    expect(dashboardFinance(books, date)).toMatchObject({
      todayIncome: 63,
      todayExpense: 5,
      bazarSum: 0,
      totalIncome: 67,
      totalExpense: 5,
    });
    const history = await getUnifiedIncomeHistory();
    expect(history.totalIncome).toBe(67);
    expect(
      history.transactions.find((r) => r.id === "fee_extra"),
    ).toMatchObject({
      amount: 4,
      receipt_url: "/dashboard/accounting/fees/fee/receipt",
    });
    expect(history.sourceBreakdown).toMatchObject({
      studentFees: 18,
      subscriptions: 19,
      leatherSales: 8,
    });
  });
  it("compares current, opening and review lines in the actual executive, monthly and annual actions", async () => {
    expect(
      await getAccountingReport("02", "2026", REVIEW_FUND.id),
    ).toMatchObject({ totalIncome: 34, totalExpense: 0 });
    const monthly = await getAccountingReport("02", "2026");
    expect(monthly).toMatchObject({
      previousBalance: 4,
      totalIncome: 63,
      totalExpense: 5,
      adjustedClosingBalance: 62,
    });
    const annual = await getAnnualAuditStatement(
      "2026",
      "2026-02-01",
      "2026-02-28",
    );
    expect(annual?.grandTotal).toMatchObject({
      openingBalance: 4,
      totalIncome: 63,
      totalExpense: 5,
      closingBalance: 62,
      cashInHand: null,
      bankBalance: null,
    });
    const executive = await getMonthlyExecutiveSummary("2026-02");
    expect(executive.metrics).toMatchObject({
      previousBalance: 4,
      totalIncome: 63,
      totalExpense: 5,
      feeCollection: 18,
    });
    const jan = await getMonthlyExecutiveSummary("2026-01");
    expect(jan.metrics.totalIncome).toBe(4);
    expect(expensePeriod({ year: "2024", month: "02" })).toEqual({
      start: "2024-02-01",
      end: "2024-02-29",
    });
    expect(() => expensePeriod({ month: "2x" })).toThrow();
  });
  it('carries journal balances through fund, executive, monthly and annual reports without creating a donation',async()=>{
    data.treasury_journals=[{id:'opened',kind:'OPENING',posting_date:'2026-02-01',to_fund:fund.id,amount:20},{id:'move',kind:'TRANSFER',posting_date:date,from_fund:fund.id,to_fund:'fund-general',amount:8},{id:'adjust',kind:'ADJUST_OUT',posting_date:date,from_fund:fund.id,amount:1.25}];
    const monthly=await getAccountingReport('02','2026');expect(monthly).toMatchObject({previousBalance:24,totalIncome:63,totalExpense:5,adjustedClosingBalance:80.75});
    const ledger=await getFundLedgerData(fund.id);expect(ledger).toMatchObject({totalInflow:33,totalOutflow:5,currentBalance:38.75});
    expect(ledger.transactions.filter(r=>r.journal_kind)).toHaveLength(3);
    expect((await getMonthlyExecutiveSummary('2026-02')).metrics).toMatchObject({totalIncome:63,totalExpense:5,adjustedClosingBalance:80.75});
    expect((await getAnnualAuditStatement('2026','2026-02-01','2026-02-28'))?.grandTotal).toMatchObject({openingBalance:24,totalIncome:63,totalExpense:5,closingBalance:80.75});
    expect((await getUnifiedIncomeHistory()).totalIncome).toBe(67);expect((await getFundOverview()).funds.find(f=>f.id===fund.id)?.current_balance).toBe(38.75);
  });
  it("quarantines missing/duplicate IDs and conflicting leather aliases rather than making a printable match", async () => {
    data.meta.donor_subscription_payments.push(
      f("", 1),
      f("duplicate", 4),
      f("duplicate", 5),
    );
    data.meta.leather_batches[0].received_amount = 66;
    const books = await readBooks(tenant, async () => ({ payments: [] }));
    const entries = ledgerEntries(books);
    for (const id of ["", "duplicate", "leather_inc_skin", "leather_exp_skin"])
      expect(
        entries
          .filter((e) => e.id === id)
          .every((e) => e.fund_id === REVIEW_FUND.id),
      ).toBe(true);
    expect(await getDonationById("duplicate")).toBeNull();
    expect(await getDonationById("")).toBeNull();
    expect(entries.filter((e) => e.id === "leather_inc_skin")).toHaveLength(1);
  });
  it("surfaces incomplete reads instead of a legitimate zero/printable receipt", async () => {
    failed = true;
    vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect((await getFundOverview()).error).toBeTruthy();
      await expect(getFundLedgerData("library")).rejects.toThrow();
      await expect(getDonationById("s1")).rejects.toThrow();
      await expect(getUnifiedIncomeHistory()).rejects.toThrow();
    } finally {
      vi.restoreAllMocks();
    }
  });
});
