import { createAdminClient } from "@/lib/supabase/admin";
import { financeRows } from "./funds";

/** A proposal, not a reservation. Both expense books share a tenant's voucher namespace. */
export async function nextVoucherNumber(
  tenant: string,
  date: string,
  kind: "bazar" | "expense",
) {
  if (!tenant || !/^\d{4}-\d\d-\d\d$/.test(date))
    throw Error("ভাউচারের তারিখ ও প্রতিষ্ঠান আবশ্যক।");
  const prefix =
    (kind === "expense" ? "EXP-" : "BV-") +
    date.slice(2, 4) +
    date.slice(5, 7) +
    (kind === "expense" ? "-" : "");
  const db = await createAdminClient();
  const [expenses, bazar] = await Promise.all([
    financeRows(db, tenant, "expenses", "id,voucher_no,description"),
    financeRows(db, tenant, "bazar_expenses", "id,voucher_no,items_details"),
  ]);
  let max = 0;
  for (const row of [...expenses, ...bazar]) {
    const n = String(
      row.voucher_no ||
        (row.description || row.items_details || "").match(
          /\[VOUCHER:\s*([^|\]]+)/i,
        )?.[1] ||
        "",
    )
      .trim()
      .toUpperCase();
    if (n.startsWith(prefix) && /^\d+$/.test(n.slice(prefix.length)))
      max = Math.max(max, Number(n.slice(prefix.length)));
  }
  if (!Number.isSafeInteger(max + 1)) throw Error("ভাউচার সিরিজ যাচাই করুন।");
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}
