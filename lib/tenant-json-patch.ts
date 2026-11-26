import { createAdminClient } from "@/lib/supabase/admin";
import { getMadrasaMetadataUncached } from "@/lib/sessions";

/** Compare-and-swap only the registry keys the callback changes. The planner
 * may be retried; never perform I/O in it. No cached row or xmin/URL filters. */
export async function patchTenantJson<T>(
  tenant: string,
  plan: (meta: Record<string, any>) => {
    patch?: Record<string, unknown>;
    result: T;
  },
): Promise<T> {
  const db = await createAdminClient();
  for (let attempt = 0; attempt < 5; attempt++) {
    const meta = await getMadrasaMetadataUncached(tenant, true);
    const { patch, result } = plan(meta);
    if (!patch || !Object.keys(patch).length) return result;
    const expected = Object.fromEntries(
      Object.keys(patch)
        .filter((k) => k in meta)
        .map((k) => [k, meta[k]]),
    );
    const { data, error } = await db.rpc("round7_patch_registry", {
      t: tenant,
      expected,
      patch,
    });
    if (error) throw Error(error.message);
    if (data === true) return result;
  }
  throw Error("একই সময়ে তথ্য বদলেছে। রিফ্রেশ করে আবার চেষ্টা করুন।");
}
