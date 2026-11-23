import { createAdminClient } from "@/lib/supabase/admin";
import { isPostingUuid as isUuid } from "./collection-links";
import { getMadrasaMetadata } from "@/lib/sessions";
import {
  bazarFund,
  collectionFund,
  isVoidDonation,
  isVoidedExpense,
  settlementIndex,
  storedFund,
} from "@/lib/fund-utils";
import { fundCatalog, postingError, postingFund } from "./funds";
import {
  confirmsMirror,
  leatherAgrees,
  transportCost,
  transportVoid,
  sourceAmount,
  sourceKeys,
  sourceVoid,
  type SourceKey,
} from "./collection-links";

const review = "মূল ভাউচার ও উৎসের তথ্য মিলছে না। ম্যানুয়াল সমন্বয় করুন।";
const stripped = (text?: string) =>
  (text || "").replace(/\[VOID:[^\]]*\]\s*/gi, "").trim();

// The caller's display number is never used. Lock and compare the row and all
// affected sources in the RPC; a stale second write must roll back the first.
export async function changeVoucherStatus(
  tenant: string,
  actor: string,
  id: string,
  income: boolean,
  reason: string,
  voiding: boolean,
) {
  if (!tenant || !actor || !id || !reason?.trim() || reason.trim().length > 500)
    throw new Error("প্রতিষ্ঠান, ভাউচার ও ১–৫০০ অক্ষরে কারণ আবশ্যক।");
  const db = await createAdminClient();
  const bazar = !income && id.startsWith("bazar_"),
    transport = !income && id.startsWith("leather_exp_");
  const table = income ? "donations" : bazar ? "bazar_expenses" : "expenses";
  const [meta, catalog] = await Promise.all([
    getMadrasaMetadata(tenant, true),
    fundCatalog(tenant),
  ]);
  async function lookup(col: "id" | "receipt_no", value: string) {
    const { data, error } = await db
      .from(table)
      .select("*")
      .eq("madrasa_id", tenant)
      .eq(col, value)
      .maybeSingle();
    if (error) throw new Error(review);
    return data;
  }
  const sqlId = bazar ? id.slice(6) : id;
  let row = isUuid(sqlId) ? await lookup("id", sqlId) : null;
  const sources = ([...sourceKeys, "leather_batches"] as const).flatMap((key) =>
    ((meta[key] || []) as any[]).map((r) => ({
      key,
      canonical: (key === "leather_batches"
        ? "qurbani_leather_records"
        : key) as SourceKey,
      r,
    })),
  );
  const direct = sources.filter(({ canonical, r }) =>
    income
      ? r.id === id ||
        (canonical === "qurbani_leather_records" &&
          id === `leather_inc_${r.id}`)
      : transport &&
        canonical === "qurbani_leather_records" &&
        id === `leather_exp_${r.id}`,
  );
  if (
    direct.some((s) => !s.r.id) ||
    new Set(direct.map((s) => s.key)).size !== direct.length
  )
    throw new Error(review);
  if (income && !row && direct.length) {
    const source = direct[0].r;
    row = source.accounting_record_id
      ? await lookup("id", source.accounting_record_id)
      : source.receipt_no || source.trx_id
        ? await lookup("receipt_no", source.receipt_no || source.trx_id)
        : null;
    if (!row && source.accounting_record_id) throw new Error(review);
  }
  const matches = sources.filter(
    (s) =>
      direct.includes(s) ||
      (income &&
        row &&
        (s.r.id === row.id ||
          s.r.accounting_record_id === row.id ||
          (row.receipt_no &&
            [s.r.receipt_no, s.r.trx_id].includes(row.receipt_no)))),
  );
  if (!row && !matches.length) return false;
  if (
    new Set(matches.map((s) => s.canonical + ":" + s.r.id)).size > 1 ||
    new Set(matches.map((s) => s.key)).size !== matches.length
  )
    throw new Error(review);
  const before: Record<string, any> = {},
    after: Record<string, any> = {};
  for (const { key, canonical, r } of matches) {
    const leather = canonical === "qurbani_leather_records",
      online = canonical === "online_donations";
    const statusKey = leather
      ? transport
        ? "expense_status"
        : "income_status"
      : "status";
    const noteKey = transport ? "exp_notes" : online ? "message" : "notes";
    if (
      (r.madrasa_id && r.madrasa_id !== tenant) ||
      (row && !confirmsMirror(catalog, row, canonical, r))
    )
      throw new Error(review);
    if (
      !r.id ||
      (matches.length > 1 && !leatherAgrees(r, matches[0].r)) ||
      !(transport ? transportCost(r) > 0 : sourceAmount(canonical, r) > 0)
    )
      throw new Error(review);
    const cancelled = transport ? transportVoid(r) : sourceVoid(canonical, r);
    if (Boolean(cancelled) === voiding)
      throw new Error("ভাউচারের অবস্থা বদলেছে। রিফ্রেশ করুন।");
    const next = { ...r };
    if (!voiding) {
      if (
        (leather && r.status === "VOID") ||
        !collectionFund(catalog, r) ||
        (online &&
          !["VERIFIED", "SUCCESS", "COMPLETED"].includes(r.previous_status))
      )
        throw new Error(review);
      await postingFund(
        tenant,
        r.fund_id,
        transport ? "expense" : "deposit",
        transport ? "Transport" : "",
        "",
        r.fund_name,
        r.target_fund,
        r.fund_category,
      );
    } else if (online) {
      if (!["VERIFIED", "COMPLETED", "SUCCESS"].includes(r.status))
        throw new Error(review);
      next.previous_status = r.status;
    }
    next[statusKey] = voiding
      ? "VOID"
      : online
        ? r.previous_status
        : "COMPLETED";
    const reasonKey = transport
      ? "exp_cancellation_reason"
      : "cancellation_reason";
    if (voiding) next[reasonKey] = reason.trim();
    else {
      delete next[reasonKey];
      delete next.void_reason;
      delete next.voided_at;
    }
    next[noteKey] = stripped(next[noteKey]);
    if (online && next.notes) next.notes = stripped(next.notes);
    before[key] = meta[key];
    after[key] = meta[key].map((s: any) => (s === r ? next : s));
  }
  if (row) {
    const voucher = row.receipt_no || row.voucher_no,
      links = settlementIndex(meta.mahfils);
    if (
      links.has(row.id) ||
      links.has(voucher) ||
      /^(MHF-|EXP-MHF)/i.test(voucher || "") ||
      /মাহফিল/.test(row.notes || row.description || "")
    )
      throw new Error("মূল মাহফিল সমন্বয় ভাউচার ব্যবহার করুন।");
    if ((income ? isVoidDonation(row) : isVoidedExpense(row)) === voiding)
      throw new Error("ভাউচারের অবস্থা বদলেছে। রিফ্রেশ করুন।");
    if (
      !voiding &&
      !(bazar ? bazarFund(catalog, row) : storedFund(catalog, row))
    )
      throw new Error(review);
  }
  const { error } = await db.rpc("finance_change_voucher", {
    p_tenant: tenant,
    p_actor: actor,
    p_table: row ? table : "source",
    p_expected: row || {},
    p_before: before,
    p_after: after,
    p_void: voiding,
    p_reason: reason.trim(),
    p_record: id,
  });
  if (error) throw new Error(postingError(error));
  return true;
}
