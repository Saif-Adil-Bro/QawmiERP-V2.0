import { createAdminClient } from "@/lib/supabase/admin";
import { getMadrasaMetadataUncached, saveMadrasaMetadata } from "@/lib/sessions";

function isMissingRpcError(error: any): boolean {
  const code = String(error?.code || "");
  const msg = String(error?.message || "");
  return (
    code === "42883" ||
    code === "PGRST202" ||
    /Could not find the function|function .* does not exist/i.test(msg)
  );
}

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
    if (error) {
      if (isMissingRpcError(error)) {
        const merged = { ...meta, ...patch };
        const saved = await saveMadrasaMetadata(tenant, merged);
        if (!saved) throw Error("তথ্য সংরক্ষণ করা যায়নি। আবার চেষ্টা করুন।");
        return result;
      }
      throw Error(error.message);
    }
    if (data === true) return result;
  }
  throw Error("একই সময়ে তথ্য বদলেছে। রিফ্রেশ করে আবার চেষ্টা করুন।");
}
