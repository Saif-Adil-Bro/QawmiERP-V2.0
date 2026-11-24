import { expect, it } from "vitest";
import {
  DEFAULT_FUNDS,
  bazarFund,
  collectionFund,
  storedFund,
  unmatchedMahfil,
  settlementIndex,
  isVoidedExpense,
} from "@/lib/fund-utils";
import { receiptFunds } from "@/lib/finance/fee-portions";
const f = DEFAULT_FUNDS,
  account = f.find((x) => x.id === "fund-lillah")!;
it("never treats a fee name as a fund, including a hostel payment and its unassigned remainder", () => {
  const p = {
    id: "p",
    total_amount_received: 7,
    allocations: [
      { fee_type_name: "Hostel", allocated_amount: 2 },
      { fund_id: account.id, fund_name: account.name, allocated_amount: 4 },
    ],
  };
  expect(receiptFunds(p, f)).toEqual([
    { id: "__review__", name: "ফান্ড যাচাই প্রয়োজন", amount: 3 },
    { id: account.id, name: account.name, amount: 4 },
  ]);
  expect(receiptFunds({ ...p, total_amount_received: 3 }, f)).toEqual([
    { id: "__review__", name: "ফান্ড যাচাই প্রয়োজন", amount: 3 },
  ]);
  expect(
    storedFund(f, { fund_id: account.id, fund_name: "other fund" }),
  ).toBeUndefined();
  expect(
    bazarFund(f, { items_details: "[FUND_NAME: unknown]" }),
  ).toBeUndefined();
  expect(bazarFund(f, {})?.id).toBe(account.id);
  expect(isVoidedExpense({ items_details: "[VOID: duplicate]" })).toBe(true);
});
it("requires every stored fund ID and label to agree, not just the first tag or source field", () => {
  const general = f.find(x => x.id === "fund-general")!;
  const row = { fund_id: general.id, fund_name: general.name };
  const first = `[FUND: ${general.id} | ${general.name}]`;
  expect(storedFund(f, { ...row, notes: `${first}[FUND: fund-zakat | ZKT]` })).toBeUndefined();
  expect(storedFund(f, { ...row, description: first, notes: "[FUND: fund-zakat]" })).toBeUndefined();
  expect(bazarFund(f, { ...row, items_details: "[VOUCHER: B | FUND: fund-general | FUND_NAME: GEN | FUND: fund-zakat]" })).toBeUndefined();
  expect(collectionFund(f, { ...row, target_fund: "Zakat" })).toBeUndefined();
  expect(collectionFund(f, { ...row, target_fund: "General" })?.id).toBe(general.id);
});
it("requires both the central voucher and the opposite event transaction to identify a settlement", () => {
  const row = {
    id: "voucher",
    receipt_no: "MHF-1",
    amount: 10,
    fund_id: account.id,
  };
  const ref = {
    accounting_record_id: row.id,
    accounting_voucher_no: row.receipt_no,
    mahfil_txn_id: "counterpart",
    amount: 10,
    fund_id: account.id,
    settlement_type: "SURPLUS_DEPOSIT",
  };
  const txn = { id: "counterpart", type: "EXPENSE", amount: 10 };
  for (const transactions of [
    [],
    [{ ...txn, type: "INCOME" }],
    [{ ...txn, amount: 1 }],
    [{ ...txn, receipt_no: "a different voucher" }],
    [txn, txn],
  ])
    expect(
      unmatchedMahfil(
        row,
        settlementIndex([{ settlement: ref, transactions }]),
      ),
    ).toBe(true);
  const other = { ...ref, accounting_record_id: "second-id", accounting_voucher_no: "MHF-2" };
  const shared = settlementIndex([{ settlements: [ref, other], transactions: [txn] }]);
  for (const r of [ref, other])
    expect(unmatchedMahfil({ ...row, id: r.accounting_record_id, receipt_no: r.accounting_voucher_no }, shared)).toBe(true);
  expect(
    unmatchedMahfil(
      row,
      settlementIndex([
        { settlement: ref, settlements: [ref], transactions: [{ ...txn, receipt_no: row.receipt_no }] },
      ]),
    ),
  ).toBe(false);
});
