import { createAdminClient } from "@/lib/supabase/admin";
import { getMadrasaMetadata } from "@/lib/sessions";
import { reconcilePayments } from "@/lib/portal/ledger";
import { financeRows, fundCatalog } from "./funds";
import type { Books } from "./entries";

// Server only. Caller supplies its authorized institution and fee reader (web RBAC or scheduled BI).
export async function readBooks(
  tenant: string,
  readFees: (
    tenant: string,
  ) => Promise<{ payments?: any[]; student_fees?: any[]; fee_types?: any[] }>,
  incomeOnly = false,
): Promise<Books> {
  if (!tenant) throw new Error("প্রতিষ্ঠান মেলেনি।");
  const db = await createAdminClient();
  const [funds, donations, expenses, bazar, meta, fees, legacy] =
    await Promise.all([
      fundCatalog(tenant, true),
      financeRows(
        db,
        tenant,
        "donations",
        "*,donors(id,madrasa_id,name,phone,address,donor_type)",
      ),
      incomeOnly ? [] : financeRows(db, tenant, "expenses"),
      incomeOnly ? [] : financeRows(db, tenant, "bazar_expenses"),
      getMadrasaMetadata(tenant, true),
      readFees(tenant),
      financeRows(db, tenant, "fees"),
    ]);
  return {
    funds,
    donations: donations.map((r) => ({
      ...r,
      donors: r.donors?.madrasa_id === tenant ? r.donors : null,
    })),
    expenses,
    bazar,
    meta,
    bills: fees.student_fees ?? [],
    feeTypes: fees.fee_types ?? [],
    payments: reconcilePayments(fees.payments || [], legacy, true),
  };
}
