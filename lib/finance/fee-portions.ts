import { REVIEW_FUND, storedFund, type FundItem } from "@/lib/fund-utils";

// A fee name identifies a charge, not the destination of a receipt. Keep
// untagged receipts/remainders visible in review rather than guessing a fund.
type Portion = {
  id: string;
  amount: number;
  label: string;
  billId?: string;
  feeTypeId?: string;
  fund?: FundItem;
};
export function feePortions(p: any, funds: FundItem[]): Portion[] {
  const total = Math.round(Number(p.total_amount_received || 0) * 100);
  const parts: Portion[] = [];
  if (!Number.isFinite(total) || total <= 0) return parts;
  if (p.finance_review_reason)
    return [
      {
        id: p.id,
        amount: total / 100,
        label: p.finance_review_reason,
        fund: undefined,
      },
    ];
  const allocations: any[] = p.allocations || [];
  const identify = (a: any) => {
    const id = a.fund_id || p.fund_id,
      name =
        a.fund_name ||
        (!a.fund_id || a.fund_id === p.fund_id ? p.fund_name : undefined);
    return storedFund(funds, {
      fund_id: id,
      fund_name: name,
      notes: a.notes || (!a.fund_id && !a.fund_name ? p.notes : undefined),
    });
  };
  if (!allocations.length)
    return [
      { id: p.id, amount: total / 100, label: "ছাত্র ফি", fund: identify(p) },
    ];
  let allocated = 0;
  for (const [index, a] of allocations.entries()) {
    const cents = Math.round(Number(a.allocated_amount || 0) * 100);
    if (!Number.isFinite(cents) || cents < 0 || allocated + cents > total) {
      return [
        {
          id: p.id,
          amount: total / 100,
          label: "ফি বণ্টন যাচাই প্রয়োজন",
          fund: undefined,
        },
      ];
    }
    if (cents)
      parts.push({
        id: `${p.id}_fee_${index}`,
        amount: cents / 100,
        label: a.fee_type_name || "ছাত্র ফি",
        fund: identify(a),
        billId: a.student_fee_id,
        feeTypeId: a.fee_type_id,
      });
    allocated += cents;
  }
  // Fines/advances are part of total_amount_received, not additional cash receipts.
  if (allocated < total)
    parts.push({
      id: `${p.id}_extra`,
      amount: (total - allocated) / 100,
      label: "অতিরিক্ত / জরিমানা / অগ্রিম ফি",
      fund: identify(p),
    });
  return parts;
}

// Both copies of a money receipt must say where its *cash* was attributed, not
// turn a noncash waiver into a deposit or name the first fund for a split.
export function receiptFunds(p: any, funds: FundItem[]) {
  const groups = new Map<
    string,
    { id: string; name: string; amount: number }
  >();
  for (const line of feePortions(p, funds)) {
    const fund = line.fund || REVIEW_FUND,
      group = groups.get(fund.id) || {
        id: fund.id,
        name: fund.name,
        amount: 0,
      };
    group.amount = Math.round(100 * (group.amount + line.amount)) / 100;
    groups.set(group.id, group);
  }
  return [...groups.values()];
}
