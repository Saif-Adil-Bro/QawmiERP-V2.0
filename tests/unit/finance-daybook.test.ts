import { describe, it, expect } from "vitest";
import { numberToBanglaWords } from "@/lib/numberToBangla";
import { DEFAULT_FUNDS } from "@/lib/fund-utils";
import { daybook, spendable, type DayFilters } from "@/lib/finance/daybook";
import { parseVoucherLines } from "@/lib/finance/expense-lines";
import {
  financeApprovalError,
  voucherTerms,
} from "@/lib/finance/approval-terms";
import { journalLegs } from "@/lib/finance/journal";
import type { Books } from "@/lib/finance/entries";
const day = "2026-02-02",
  a = DEFAULT_FUNDS[0],
  z = DEFAULT_FUNDS.find((f) => f.id === "fund-zakat")!;
const fund = { fund_id: a.id, fund_name: a.name };
const f: DayFilters = { start: day, end: day };
const books: Books = {
  funds: DEFAULT_FUNDS,
  donations: [],
  bazar: [],
  payments: [
    {
      id: "receipt",
      student_id: "p",
      student_name: "Pupil",
      payment_date: day,
      total_amount_received: 6.25,
      ...fund,
    },
  ],
  expenses: [
    {
      ...fund,
      id: "voucher",
      expense_date: day,
      amount: 2.25,
      head_name: "Supplies",
      student_id: "p",
      staff_id: "s",
      line_items: [{ label: "Red pen", amount: 2.25 }],
    },
    {
      ...fund,
      id: "pay",
      expense_date: day,
      category: "Salary",
      payroll_record_id: "payroll",
      amount: 2,
    },
  ],
  meta: {
    staff_members: [
      { id: "s", personal: { first_name: "School", last_name: "Staff" } },
    ],
    staff_salary_records: [
      { id: "payroll", status: "PAID", staff_id: "s", expense_id: "pay" },
    ],
  },
  journals: [
    {
      id: "open",
      kind: "OPENING",
      posting_date: "2026-01-01",
      to_fund: a.id,
      from_fund: null,
      amount: 10,
      reason: "brought forward",
    },
    {
      id: "move",
      kind: "TRANSFER",
      posting_date: day,
      from_fund: a.id,
      to_fund: z.id,
      amount: 3,
      reason: "Designated",
    },
  ],
};
describe("Daybook, journal and voucher terms", () => {
  it("spells the posted poisha on the printed voucher", () => {
    expect(numberToBanglaWords(3.25)).toBe("তিন টাকা পঁচিশ পয়সা মাত্র");
    expect(numberToBanglaWords("0.01")).toBe("এক পয়সা মাত্র");
    expect(numberToBanglaWords(5)).toBe("পাঁচ টাকা মাত্র");
  });
  it("keeps both legs under one reference, out of income and expense filters", () => {
    expect(
      journalLegs(books.journals, books.funds)
        .filter((r) => r.voucher_no === "JV-move")
        .map((r) => r.delta),
    ).toEqual([-3, 3]);
    expect(
      daybook(books, { ...f, q: "designated" }, true).map((r) => r.kind),
    ).toEqual(["journal", "journal"]);
    expect(
      daybook(books, { ...f, flow: "income" }, true).map((r) => r.voucher),
    ).toEqual(["receipt"]);
    expect(daybook(books, { ...f, flow: "expense" }, true)).toHaveLength(2);
  });
  it("intersects exact student and staff IDs with a case-insensitive individual line filter", () => {
    expect(
      daybook(books, { ...f, student: "p", staff: "s", item: "PEN" }, true),
    ).toMatchObject([
      { category: "Supplies", staffName: "School Staff", amount: 2.25 },
    ]);
    expect(
      daybook(
        books,
        { ...f, student: "p", staff: "different", item: "pen" },
        true,
      ),
    ).toEqual([]);
    expect(
      daybook(books, { ...f, staff: "s" }, false).map((r) => r.expenseId),
    ).toEqual(["voucher"]);
    expect(daybook(books, { ...f, staff: "s" }, true)).toHaveLength(2);
    expect(() => daybook(books, { ...f, start: "2026-02-30" }, true)).toThrow();
  });
  it("does not make a later credit available early or spend the same money twice on a backdated voucher", () => {
    expect(spendable(books, a.id, "2025-12-31")).toBe(0);
    expect(spendable(books, a.id, "2026-01-10")).toBe(9);
    expect(spendable(books, z.id, day)).toBe(3);
  });
  it("validates structured rows in poisha and refuses a relabelled or reordered approval", () => {
    const lines = [
      { label: "Rice", amount: 1.2 },
      { label: "Oil", amount: 0.05 },
    ];
    expect(parseVoucherLines(JSON.stringify(lines), "1.25")).toEqual(lines);
    for (const v of [
      [],
      [{ label: "", amount: 1.25 }],
      [{ label: "A", amount: 1.251 }],
      [{ label: "A", amount: 1.24 }],
    ])
      expect(() => parseVoucherLines(JSON.stringify(v), 1.25)).toThrow();
    const data = {
      ...fund,
      amount: 1.25,
      expense_date: day,
      line_items: lines,
      category: "Food",
      head_id: "school-head",
      payment_method: "Cash",
    };
    const req = {
      madrasa_id: "t",
      target_id: a.id,
      request_type: "LARGE_EXPENSE",
      amount: 1.25,
      payload: {
        action: "create_expense",
        expenseData: data,
        voucherTerms: voucherTerms(data),
      },
    };
    expect(financeApprovalError("t", req)).toBeNull();
    for (const change of [
      { head_id: "other" },
      { payment_method: "Bank" },
      { line_items: [...lines].reverse() },
      { student_id: "other" },
    ])
      expect(
        financeApprovalError("t", {
          ...req,
          payload: { ...req.payload, expenseData: { ...data, ...change } },
        }),
      ).toBeTruthy();
  });
});
