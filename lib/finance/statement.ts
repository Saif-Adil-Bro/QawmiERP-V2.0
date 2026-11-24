import { journalLegs, type Journal } from "./journal";
import { ledgerEntries, money } from "./entries";
import { toDhakaDateStringFrom } from "@/lib/date-utils";
import { REVIEW_FUND, type FundItem } from "@/lib/fund-utils";

export type FundLine = {
  fundId: string;
  fundName: string;
  fundArabicName: string;
  openingBalance: number;
  totalIncome: number;
  totalExpense: number;
  closingBalance: number;
  movement?: number;
  incomesByCategory: { category: string; amount: number }[];
  expensesByCategory: { category: string; amount: number }[];
};
export const emptyLine = (id: string, name: string): FundLine => ({
  fundId: id,
  fundName: name,
  fundArabicName: "",
  openingBalance: 0,
  totalIncome: 0,
  totalExpense: 0,
  closingBalance: 0,
  incomesByCategory: [],
  expensesByCategory: [],
});
function addCategory(
  list: FundLine["incomesByCategory"],
  category: string,
  amount: number,
) {
  const existing = list.find((x) => x.category === category);
  if (existing) existing.amount = money(existing.amount + amount);
  else list.push({ category, amount });
}

// One classifier for current AND prior periods in both accounting statements.
// __review__ is a reporting bucket, never an ID that can be used for posting.
export function periodLines({
  funds,
  start,
  end,
  donations,
  expenses,
  bazar,
  meta,
  payments,
  onCurrent,
  journals,
}: {
  funds: FundItem[];
  start: string;
  end: string;
  donations: any[];
  expenses: any[];
  bazar: any[];
  meta: Record<string, any>;
  payments: any[];
  journals?: Journal[];
  onCurrent?: (
    kind: "in" | "out",
    source: "donation" | "fee" | "mahfil" | "bazar" | "expense",
    fund: FundItem,
    amount: number,
  ) => void;
}) {
  const lines = new Map(funds.map((f) => [f.id, emptyLine(f.id, f.name)]));
  function add(
    date: string | undefined,
    f: FundItem | undefined,
    kind: "in" | "out",
    value: unknown,
    label: string,
    source: "donation" | "fee" | "mahfil" | "bazar" | "expense" = kind === "in"
      ? "donation"
      : "expense",
  ) {
    const d = date?.includes("T") ? toDhakaDateStringFrom(date) : date;
    const amount = Number(value);
    if (!d || d > end || !amount || !Number.isFinite(amount)) return;
    const fund = f || REVIEW_FUND;
    const l = lines.get(fund.id) || emptyLine(fund.id, fund.name);
    lines.set(fund.id, l);
    const delta = kind === "in" ? amount : -amount;
    if (d < start) l.openingBalance = money(l.openingBalance + delta);
    else if (kind === "in") {
      l.totalIncome = money(l.totalIncome + amount);
      addCategory(l.incomesByCategory, label, amount);
    } else {
      l.totalExpense = money(l.totalExpense + amount);
      addCategory(l.expensesByCategory, label, amount);
    }
    l.closingBalance = money(l.closingBalance + delta);
    if (d >= start) onCurrent?.(kind, source, fund, amount);
  }
  for (const e of ledgerEntries({
    funds,
    donations,
    expenses,
    bazar,
    meta,
    payments,
  })) {
    if (e.status === "VOID") continue;
    const source =
      e.source === "fee" || e.source === "bazar" || e.source === "mahfil"
        ? e.source
        : e.income
          ? "donation"
          : "expense";
    add(
      e.date,
      funds.find((f) => f.id === e.fund_id),
      e.income ? "in" : "out",
      e.amount,
      e.category!,
      source,
    );
  }
  for (const leg of journalLegs(journals, funds)) {
    if (leg.date > end) continue;
    const line =
      lines.get(leg.fund_id) || emptyLine(leg.fund_id, leg.fund_name);
    lines.set(leg.fund_id, line);
    if (
      leg.date < start ||
      (leg.date === start && leg.journal_kind === "OPENING")
    ) {
      line.openingBalance = money(line.openingBalance + leg.delta);
    } else line.movement = money((line.movement || 0) + leg.delta);
    line.closingBalance = money(line.closingBalance + leg.delta);
  }
  // Event custody stays in the Mahfil book until an identified settlement posts.
  return [...lines.values()];
}

// Preserve the four existing Shura headings and their manually configured opening balances.
// Membership is by exact built-in ID only. Every other fund gets its own line (not General).
export function auditLines(
  lines: FundLine[],
  openings: Record<string, number | undefined>,
) {
  const groups = [
    ["general", "সাধারণ ফান্ড", "الصندوق العام", ["fund-general"]],
    [
      "lillah",
      "লিল্লাহ বোর্ডিং ও এতিম কল্যাণ",
      "صندوق دار الإطعام للفقراء",
      ["fund-lillah", "fund-orphan"],
    ],
    [
      "zakat",
      "যাকাত ও ফিতরা ফান্ড",
      "صندوق الزكاة والصدقات الواجبة",
      ["fund-zakat", "fund-fitra"],
    ],
    [
      "building",
      "উন্নয়ন ও মসজিদ নির্মাণ ফান্ড",
      "صندوق التعمير والتطوير",
      ["fund-dev"],
    ],
  ] as const;
  const used = new Set<string>();
  const combined = groups.map(([key, name, arabic, ids]) => {
    const l = emptyLine(ids[0], name);
    l.fundArabicName = arabic;
    for (const id of ids) {
      used.add(id);
      const child = lines.find((f) => f.fundId === id);
      if (!child) continue;
      l.openingBalance += child.openingBalance;
      l.movement = money((l.movement || 0) + (child.movement || 0));
      l.totalIncome += child.totalIncome;
      l.totalExpense += child.totalExpense;
      for (const key of ["incomesByCategory", "expensesByCategory"] as const)
        for (const c of child[key]) addCategory(l[key], c.category, c.amount);
    }
    // An explicit Shura opening is the entire brought-forward amount for that heading,
    // not an additional deposit on top of a dated opening already in the journal.
    l.openingBalance = Number(openings[key] ?? l.openingBalance);
    l.closingBalance = money(
      l.openingBalance + l.totalIncome - l.totalExpense + (l.movement || 0),
    );
    return l;
  });
  return [...combined, ...lines.filter((l) => !used.has(l.fundId))];
}
