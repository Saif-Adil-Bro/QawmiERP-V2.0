import type { FundItem } from "@/lib/fund-utils";
export type JournalKind = "TRANSFER" | "OPENING" | "ADJUST_IN" | "ADJUST_OUT";
export interface Journal {
  id: string;
  posting_date: string;
  kind: JournalKind;
  from_fund: string | null;
  to_fund: string | null;
  amount: number | string;
  reason: string;
}
export const journalNames: Record<JournalKind, string> = {
  TRANSFER: "ফান্ড স্থানান্তর",
  OPENING: "প্রারম্ভিক স্থিতি",
  ADJUST_IN: "জমা সমন্বয়",
  ADJUST_OUT: "বিয়োগ সমন্বয়",
};
// A transfer cannot have a missing leg: the two account IDs are on ONE immutable voucher.
// These are balance movements, never donations, institutional revenue/expense, or physical cash.
export function journalLegs(journals: Journal[] = [], funds: FundItem[]) {
  const names = new Map(funds.map((f) => [f.id, f.name]));
  return journals.flatMap((j) =>
    [j.from_fund, j.to_fund].flatMap((id, i) =>
      id
        ? [
            {
              id: `journal:${j.id}:${i}`,
              voucher_no: `JV-${j.id}`,
              fund_id: id,
              fund_name: names.get(id) || id,
              date: j.posting_date,
              amount: Number(j.amount),
              delta: (i ? 1 : -1) * Number(j.amount),
              category: journalNames[j.kind],
              notes: j.reason,
              source_or_recipient:
                names.get((i ? j.from_fund : j.to_fund) || "") ||
                journalNames[j.kind],
              type: i ? ("JOURNAL_IN" as const) : ("JOURNAL_OUT" as const),
              status: "COMPLETED" as const,
              journal_kind: j.kind,
            },
          ]
        : [],
    ),
  );
}
