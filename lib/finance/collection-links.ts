import {
  collectionFund,
  isVoidDonation,
  storedFund,
  type FundItem,
} from "@/lib/fund-utils";

export const collections = {
  donor_subscription_payments: {
    label: "সদস্য চাঁদা",
    marker: /^\[(?:মাসিক চাঁদা|সদস্য চাঁদা|চাঁদা)/,
  },
  donation_box_logs: { label: "দানবাক্স কালেকশন", marker: /^\[দানবাক্স কালেকশন/ },
  online_donations: {
    label: "অনলাইন অনুদান",
    marker: /^\[অনলাইন (?:অনুদান|দান)/,
  },
  qurbani_leather_records: {
    label: "কুরবানির চামড়া বিক্রয়",
    marker: /^\[কুরবানির চামড়া বিক্রয়/,
  },
} as const;
export type SourceKey = keyof typeof collections;
export const sourceKeys = Object.keys(collections) as SourceKey[];
export const saleAmount = (r: any) =>
  Number(
    r.received_amount ??
      r.paid_amount ??
      r.total_sale_price ??
      r.total_sale_amount ??
      0,
  );
export const sourceAmount = (k: SourceKey, r: any) =>
  k === "qurbani_leather_records" ? saleAmount(r) : Number(r.amount || 0);
export const sourceVoid = (k: SourceKey, r: any) =>
  r.status === "VOID" ||
  r.notes?.includes("[VOID:") ||
  (k === "qurbani_leather_records" && r.income_status === "VOID") ||
  (k === "online_donations" && r.message?.includes("[VOID:"));
export const transportCost = (r: any) =>
  Number(r.transport_labour_cost ?? r.transport_labor_cost ?? 0);
export const transportVoid = (r: any) =>
  Boolean(
    r.status === "VOID" ||
    r.expense_status === "VOID" ||
    r.exp_notes?.includes("[VOID:"),
  );
// Both leather keys have existed in production. Read a shared ID once, retain
// records present in only one book, and flag disagreeing copies for review.
export function leatherAgrees(a: any, b: any) {
  const fields = [
    "id",
    "madrasa_id",
    "accounting_record_id",
    "receipt_no",
    "donor_id",
    "fund_id",
    "fund_name",
    "target_fund",
    "sale_date",
  ];
  return (
    fields.every((k) => (a[k] ?? "") === (b[k] ?? "")) &&
    saleAmount(a) === saleAmount(b) &&
    transportCost(a) === transportCost(b) &&
    Boolean(sourceVoid("qurbani_leather_records", a)) ===
      Boolean(sourceVoid("qurbani_leather_records", b)) &&
    transportVoid(a) === transportVoid(b)
  );
}
export function sourceRows(meta: Record<string, any>, k: SourceKey): any[] {
  const rows: any[] = meta[k] || [];
  if (k !== "qurbani_leather_records") return rows;
  const ids = new Set(rows.map((r) => r.id).filter(Boolean));
  return [
    ...rows,
    ...(meta.leather_batches || []).filter((r: any) => !ids.has(r.id)),
  ];
}
export function confirmsMirror(
  funds: FundItem[],
  row: any,
  k: SourceKey,
  r: any,
) {
  const fund = collectionFund(funds, r);
  if (
    !r.id ||
    !row.id ||
    isVoidDonation(row) !== Boolean(sourceVoid(k, r)) ||
    !fund ||
    storedFund(funds, row)?.id !== fund.id ||
    Number(row.amount) !== sourceAmount(k, r) ||
    ((row.donor_id || row.member_id) &&
      r.donor_id &&
      (row.donor_id || row.member_id) !== r.donor_id) ||
    (row.madrasa_id && r.madrasa_id && row.madrasa_id !== r.madrasa_id)
  )
    return false;
  if (r.accounting_record_id && r.accounting_record_id !== row.id) return false;
  if (r.receipt_no && row.receipt_no && r.receipt_no !== row.receipt_no)
    return false;
  return (
    r.accounting_record_id === row.id ||
    r.id === row.id ||
    (!!r.receipt_no &&
      r.receipt_no === row.receipt_no &&
      collections[k].marker.test(
        (row.notes || "").replace(/\[VOID:[^\]]*\]/gi, "").trim(),
      ))
  );
}
// Never credit the same cash twice. Uncertain collisions keep the SQL amount in
// the review column, with the source ID(s) available for manual reconciliation.
export function collectionLinks(
  funds: FundItem[],
  donations: any[],
  meta: Record<string, any>,
) {
  const sql = new Map<string, Set<any>>();
  for (const row of donations)
    for (const key of [row.id, row.receipt_no].filter(Boolean)) {
      if (!sql.has(key)) sql.set(key, new Set());
      sql.get(key)!.add(row);
    }
  type Match = { key: SourceKey; source: any };
  const owners = new Map<any, Match[]>(),
    mirrored = new Set<any>(),
    reasons = new Map<any, string>();
  const sources = sourceKeys.flatMap((key) =>
    sourceRows(meta, key).map((source) => ({ key, source })),
  );
  const counts = new Map<string, number>();
  for (const { source } of sources)
    counts.set(source.id, (counts.get(source.id) || 0) + 1);
  const aliases = new Map<string, any[]>();
  for (const r of meta.leather_batches || [])
    aliases.set(r.id, [...(aliases.get(r.id) || []), r]);
  for (const { key, source } of sources) {
    if (
      key === "online_donations" &&
      !["VERIFIED", "COMPLETED", "SUCCESS", "VOID"].includes(source.status)
    )
      continue;
    if (!source.id || counts.get(source.id) !== 1)
      reasons.set(source, "উৎসের আইডি অনুপস্থিত বা একাধিক");
    if (key === "qurbani_leather_records") {
      const others = aliases.get(source.id) || [];
      if (others.length > 1 || others.some((r) => !leatherAgrees(source, r)))
        reasons.set(source, "চামড়ার দুই খাতা মেলেনি");
    }
    const candidates = new Set(
      [source.accounting_record_id, source.id, source.receipt_no, source.trx_id]
        .filter(Boolean)
        .flatMap((k) => [...(sql.get(k) || [])]),
    );
    if (!candidates.size) {
      if (source.accounting_record_id)
        reasons.set(source, "উৎসের মূল ভাউচার পাওয়া যায়নি");
      continue;
    }
    mirrored.add(source);
    for (const row of candidates) {
      owners.set(row, [...(owners.get(row) || []), { key, source }]);
      if (
        reasons.has(source) ||
        candidates.size !== 1 ||
        !confirmsMirror(funds, row, key, source)
      )
        reasons.set(
          row,
          `উৎস ও ভাউচার মেলেনি (${source.id || "আইডি নেই"}, ৳${sourceAmount(key, source)})`,
        );
    }
  }
  const confirmed = new Map<any, Match>();
  for (const [row, matches] of owners) {
    if (matches.length !== 1)
      reasons.set(
        row,
        `এক ভাউচারে একাধিক উৎস: ${matches.map((m) => m.source.id).join(", ")}`,
      );
    else if (!reasons.has(row)) confirmed.set(row, matches[0]);
  }
  return { confirmed, mirrored, reasons };
}

export const isPostingUuid = (id?: string | null): id is string =>
  typeof id === "string" &&
  /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id);
