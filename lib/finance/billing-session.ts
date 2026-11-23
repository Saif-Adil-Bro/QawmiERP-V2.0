import type { createAdminClient } from "@/lib/supabase/admin";
// Never pick the first academic session, or create a second 'default' bill next
// to an active term. Older schools keep their session registry in the JSON store.
export async function billingSession(
  db: Awaited<ReturnType<typeof createAdminClient>>,
  tenant: string,
  wanted?: string,
  allowEmptyDefault = false,
): Promise<string> {
  const { data, error } = await db.rpc("finance_billing_session", {
    p_tenant: tenant,
    p_wanted: wanted || null,
    p_allow_default: allowEmptyDefault,
  });
  if (error || typeof data !== "string" || !data)
    throw Error("সচল শিক্ষাবর্ষ যাচাই করা যায়নি। খাতা ও লক মিলিয়ে দেখুন।");
  return data;
}
