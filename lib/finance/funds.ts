// Server-only posting checks. Never expose service-role RPCs as caller-scoped Server Actions.
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_FUNDS, type FundItem } from "@/lib/fund-utils";
import { getMadrasaMetadata } from "@/lib/sessions";

export const migrationError =
  "হিসাব সুরক্ষা মাইগ্রেশন (supabase_finance_integrity_migration.sql) প্রয়োগ করুন।";
export function postingError(error: { code?: string; message: string }) {
  return ["PGRST202", "PGRST204", "42883", "42703"].includes(error.code || "")
    ? migrationError
    : error.message;
}
export type FundUse = "deposit" | "expense" | "mahfil_deficit" | "bazar";
export async function postingFund(
  tenant: string,
  id: unknown,
  use: FundUse,
  category = "",
  beneficiary = "",
  ...labels: unknown[]
): Promise<FundItem> {
  if (!tenant || typeof id !== "string" || !id.trim())
    throw new Error("সক্রিয় ফান্ডের সঠিক আইডি আবশ্যক।");
  const db = await createAdminClient();
  const { data, error } = await db.rpc("finance_posting_fund", {
    p_tenant: tenant,
    p_id: id,
    p_use: use,
    p_category: category,
    p_beneficiary: beneficiary,
  });
  if (error || data?.id !== id)
    throw new Error(error ? postingError(error) : "ফান্ড যাচাই ব্যর্থ।");
  if (
    labels.some(
      (l) =>
        l != null && l !== "" && ![data.name, data.id, data.code].includes(l),
    )
  )
    throw new Error("ফান্ডের নাম ও আইডি মিলছে না।");
  return data;
}
export async function fundCatalog(
  tenant: string,
  legacyRead = false,
): Promise<FundItem[]> {
  const db = await createAdminClient();
  const { data, error } = await db.rpc("finance_fund_catalog", {
    p_tenant: tenant,
  });
  let funds: FundItem[];
  if (error) {
    if (!legacyRead || !["PGRST202", "42883"].includes(error.code))
      throw new Error(postingError(error));
    const [{ data: rows, error: readError }, meta] = await Promise.all([
      db.from("zakat_funds").select("*").eq("madrasa_id", tenant),
      getMadrasaMetadata(tenant, true),
    ]);
    if (readError && !["42P01", "PGRST205"].includes(readError.code))
      throw new Error(readError.message);
    funds = [
      ...new Map<string, FundItem>(
        [...DEFAULT_FUNDS, ...(meta.custom_funds || []), ...(rows || [])].map(
          (f) => [f.id, f],
        ),
      ).values(),
    ];
  } else funds = data || [];
  return funds
    .map((f) => ({ ...DEFAULT_FUNDS.find((d) => d.id === f.id), ...f }))
    .sort(
      (a, b) =>
        Number(b.id === "fund-general") - Number(a.id === "fund-general"),
    );
}
// PostgREST caps each response. Do not silently lose older postings or review flags.
export async function financeRows(
  db: Awaited<ReturnType<typeof createAdminClient>>,
  tenant: string,
  table: "expenses" | "donations" | "bazar_expenses" | "fees" | "donors",
  columns = "*",
  through?: string,
  since?: string,
) {
  const rows: any[] = [];
  let after: string | undefined;
  for (;;) {
    let query = db
      .from(table)
      .select(columns)
      .eq("madrasa_id", tenant)
      .order("id")
      .limit(500);
    const dateColumn =
      table === "fees"
        ? "payment_date"
        : table === "donations"
          ? "donation_date"
          : "expense_date";
    if (through) query = query.lte(dateColumn, through);
    if (since) query = query.gte(dateColumn, since);
    if (after) query = query.gt("id", after);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    if (!data?.length) return rows;
    const last = (data as any[]).at(-1)?.id;
    if (!last || after === last)
      throw new Error("অসম্পূর্ণ হিসাবের পৃষ্ঠা পাওয়া গেছে।");
    rows.push(...data);
    after = last;
  }
}

export function collectionSnapshot(
  meta: Record<string, any>,
  ...keys: string[]
) {
  return structuredClone(
    Object.fromEntries(keys.map((k) => [k, meta[k] ?? null])),
  );
}
export async function replaceSources(
  tenant: string,
  before: Record<string, any>,
  meta: Record<string, any>,
) {
  const db = await createAdminClient();
  const { error } = await db.rpc("finance_replace_sources", {
    p_tenant: tenant,
    p_before: before,
    p_after: Object.fromEntries(
      Object.keys(before).map((k) => [k, meta[k] ?? []]),
    ),
  });
  if (error) throw new Error(postingError(error));
  return true;
}
export async function postCollection(
  tenant: string,
  before: Record<string, any>,
  meta: Record<string, any>,
  kind: "donation" | "mahfil_deficit" | "void_surplus" | "void_deficit",
  row: {
    fund_id: string;
    fund_name: string;
    amount: number;
    date: string;
    receipt_no: string;
    notes: string;
    id?: string;
    donor_id?: string | null;
    member_id?: string;
  },
  edit = false,
) {
  const db = await createAdminClient();
  const { error } = await db.rpc("finance_post_collection", {
    p_tenant: tenant,
    p_before: before,
    p_after: Object.fromEntries(
      Object.keys(before).map((k) => [k, meta[k] ?? []]),
    ),
    p_kind: kind,
    p_row: row,
    p_edit: edit,
  });
  if (error) throw new Error(postingError(error));
}
