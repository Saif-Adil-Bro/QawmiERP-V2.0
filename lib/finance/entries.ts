import {
  bazarFund,
  collectionFund,
  isVoidDonation,
  isVoidedExpense,
  parseExpenseFund,
  REVIEW_FUND,
  settlementIndex,
  storedFund,
  unmatchedMahfil,
  type FundItem,
  type FundTransactionRecord,
} from "@/lib/fund-utils";
import { toDhakaDateStringFrom } from "@/lib/date-utils";
import { feePortions } from "./fee-portions";
import {
  collections,
  collectionLinks,
  sourceKeys,
  sourceRows,
  sourceVoid,
  transportCost,
  transportVoid,
  sourceAmount,
  type SourceKey,
} from "./collection-links";

export interface Books {
  journals?: import('./journal').Journal[];
  funds: FundItem[];
  donations: any[];
  expenses: any[];
  bazar: any[];
  meta: Record<string, any>;
  payments: any[];
  feeTypes?: any[];
  bills?: any[];
}
export interface Entry extends FundTransactionRecord {
  fund_id: string;
  income: boolean;
  source: SourceKey | "donation" | "mahfil" | "bazar" | "expense" | "fee";
  // Receipt date and subscription month are different facts. Only the matched
  // subscription source can establish the latter (not the donor name or date).
  receipt_number?: string;
  subscription_month?: string;
  donor_id?: string;
  donor_phone?: string;
  donor_address?: string;
  reason?: string;
  receiptUrl?: string;
}
const dateOf = (date?: string) =>
  date?.includes("T") ? toDhakaDateStringFrom(date) : date || "";
const noteOf = (r: any) =>
  r.notes || r.description || r.items_details || r.message || "";
const voidReason = (r: any) =>
  r.void_reason ||
  r.cancellation_reason ||
  r.reversal_reason ||
  noteOf(r)
    .match(/\[VOID:\s*([^\]|]+)/i)?.[1]
    ?.trim();
const dateFor = (r: any) =>
  dateOf(
    r.donation_date ||
      r.expense_date ||
      r.payment_date ||
      r.sale_date ||
      r.collection_date ||
      r.date ||
      r.created_at,
  );
const partyFor = (k: SourceKey, r: any) =>
  r.donor_name ||
  r.buyer_name ||
  r.box_name ||
  r.location_name ||
  r.box_code ||
  collections[k].label;
export const money = (n: number) => Math.round(n * 100) / 100;

// One read-only projection for vouchers, balances, prior/current statements and
// exports. All IDs here identify stored records, never positions in a filtered list.
export function ledgerEntries({
  funds,
  donations,
  expenses,
  bazar,
  meta,
  payments,
}: Books): Entry[] {
  const entries: Entry[] = [];
  const settlements = settlementIndex(meta.mahfils, funds),
    links = collectionLinks(funds, donations, meta);
  function mahfilReview(r: any, orphan: boolean, linked: boolean) {
    // An explicit event cancellation removes its links and voids the central row
    // together. A legacy VOID marker by itself does not explain a missing link.
    const cancelled = !linked && r.status === 'VOID' && r.void_reason === 'মাহফিল সমন্বয় বাতিল';
    return orphan && !cancelled ? 'মাহফিল সমন্বয় ভাউচার মেলেনি' : undefined;
  }
  function add(
    r: any,
    amount: number,
    f: FundItem | undefined,
    income: boolean,
    source: Entry["source"],
    category: string,
    party: string,
    voided: boolean,
    fields: Partial<Entry> = {},
  ) {
    if (!Number.isFinite(amount) || (amount === 0 && !(source === "mahfil" && fields.reason))) return;
    const reason =
      fields.reason || (!f ? "ফান্ডের তথ্য অনুপস্থিত বা পরস্পরবিরোধী" : undefined);
    const fund = reason ? REVIEW_FUND : f!;
    entries.push({
      id: r.id || "",
      type: income ? "INCOME" : "EXPENSE",
      income,
      source,
      amount,
      fund_id: fund.id,
      fund_name: fund.name,
      date: dateFor(r),
      category,
      source_or_recipient: party,
      receipt_number: r.receipt_no || undefined,
      voucher_no: r.receipt_no || r.voucher_no || r.id || "—",
      status: voided ? "VOID" : "COMPLETED",
      payment_method:
        r.payment_method ||
        noteOf(r).match(/\[Method:\s*([^\]]+)/i)?.[1] ||
        "Unknown",
      notes: noteOf(r)
        .replace(/\[(?:VOID|Method):[^\]]*\]\s*/gi, "")
        .trim(),
      cancellation_reason: voided ? voidReason(r) : undefined,
      ...fields,
      reason,
    });
  }
  const members = new Map<string, any>(
    (meta.life_member_donors || []).map((m: any) => [m.id, m]),
  );
  for (const row of donations) {
    const voided = isVoidDonation(row),
      orphan = unmatchedMahfil(row, settlements);
    const linked = settlements.has(row.id) || settlements.has(row.receipt_no);
    const event = orphan || linked;
    const link = links.confirmed.get(row),
      src = link?.source;
    add(
      row,
      Number(row.amount),
      storedFund(funds, row),
      true,
      event ? "mahfil" : link?.key || "donation",
      event
        ? "মাহফিল উদ্বৃত্ত"
        : link
          ? collections[link.key].label
          : row.donation_type || "অনুদান",
      row.donors?.name ||
        members.get(row.member_id)?.name ||
        (link
          ? partyFor(link.key, src)
          : event
            ? "মাহফিল পরিচালনা কমিটি"
            : "সম্মানিত দাতা"),
      voided,
      {
        subscription_month:
          link?.key === "donor_subscription_payments" ? src.month : undefined,
        receipt_number: row.receipt_no || src?.receipt_no || undefined,
        donor_id: row.donor_id || row.member_id || src?.donor_id,
        donor_phone: row.donors?.phone || src?.phone,
        donor_address: row.donors?.address,
        is_mahfil_settlement: event,
        type: event ? "MAHFIL_SURPLUS" : "INCOME",
        receiptUrl: `/dashboard/zakat/collection/${row.id}/receipt`,
        reason: mahfilReview(row, orphan, linked) || links.reasons.get(row),
      },
    );
  }
  for (const key of sourceKeys)
    for (const row of sourceRows(meta, key)) {
      const fund = collectionFund(funds, row),
        leather = key === "qurbani_leather_records";
      if (
        key === "online_donations" &&
        !["VERIFIED", "COMPLETED", "SUCCESS", "VOID"].includes(row.status)
      )
        continue;
      if (!links.mirrored.has(row))
        add(
          row,
          sourceAmount(key, row),
          fund,
          true,
          key,
          collections[key].label,
          partyFor(key, row),
          sourceVoid(key, row),
          {
            id: row.id ? (leather ? `leather_inc_${row.id}` : row.id) : "",
            subscription_month:
              key === "donor_subscription_payments" ? row.month : undefined,
            donor_id: row.donor_id,
            donor_phone: row.phone,
            reason: links.reasons.get(row),
          },
        );
      if (leather)
        add(
          row,
          transportCost(row),
          fund,
          false,
          key,
          "চামড়া পরিবহন ও শ্রমিক মজুরি",
          row.buyer_name || "পরিবহন",
          transportVoid(row),
          {
            id: row.id ? `leather_exp_${row.id}` : "",
            reason: links.reasons.get(row),
            voucher_no: `EXP-LTH-${row.id}`,
            notes: row.exp_notes || "",
            cancellation_reason: row.exp_cancellation_reason,
          },
        );
    }
  for (const row of expenses) {
    const parsed = parseExpenseFund(row.description),
      voided = isVoidedExpense(row),
      orphan = unmatchedMahfil(row, settlements);
    const linked = settlements.has(row.id) || settlements.has(row.voucher_no || parsed.voucherNo || "");
    const event = orphan || linked;
    add(
      row,
      Number(row.amount),
      storedFund(funds, row),
      false,
      event ? "mahfil" : "expense",
      row.category || "ব্যয়",
      row.restricted_beneficiary ||
        (event ? "মাহফিল পরিচালনা কমিটি" : row.category || "প্রাপক"),
      voided,
      {
        type: event ? "MAHFIL_DEFICIT" : "EXPENSE",
        is_mahfil_settlement: event,
        voucher_no: row.voucher_no || parsed.voucherNo || row.id,
        notes: parsed.cleanDesc.replace(/\[VOID:[^\]]*\]\s*/gi, "").trim(),
        reason: mahfilReview(row, orphan, linked),
      },
    );
  }
  const bazarIds = new Set(bazar.map((b) => b.id));
  for (const row of [
    ...bazar,
    ...(meta.boarding_bazar_logs || []).filter((b: any) => !bazarIds.has(b.id)),
  ]) {
    add(
      row,
      Number(row.amount ?? row.total_cost),
      bazarFund(funds, row),
      false,
      "bazar",
      "বোর্ডিং বাজার",
      row.buyer_name || "বোর্ডিং বাজার",
      isVoidedExpense(row),
      { id: `${bazarIds.has(row.id) ? "bazar_" : "legacy_bazar_"}${row.id}` },
    );
  }
  for (const p of payments.filter(
    (p) =>
      !p.status ||
      ["COMPLETED", "VOID", "REVERSED", "VOIDED"].includes(p.status),
  ))
    for (const part of feePortions(p, funds)) {
      add(
        p,
        part.amount,
        part.fund,
        true,
        "fee",
        part.label,
        p.student_name || "শিক্ষার্থী",
        p.status === "REVERSED" || p.status === "VOIDED" || isVoidDonation(p),
        {
          id: part.id,
          donor_id: p.student_id,
          reason: p.finance_review_reason,
          receiptUrl: `/dashboard/accounting/fees/${p.id}/receipt`,
        },
      );
    }
  return entries;
}
