import { createAdminClient } from "@/lib/supabase/admin";

/** Legacy automation schemas use a shared JSON settings row per list. Preserve
 * other rule/log entries when two dispatchers work on different jobs. */
export async function changeAutomationList(
  tenant: string,
  setting_key: string,
  plan: (current: any[]) => any[] | null,
) {
  const db = await createAdminClient(),
    key = { madrasa_id: tenant, namespace: "automation", setting_key };
  for (let attempt = 0; attempt < 6; attempt++) {
    const { data: row, error } = await db
      .from("madrasa_settings")
      .select("id,updated_at,setting_value")
      .match(key)
      .maybeSingle();
    if (error) throw Error(error.message);
    if (row && !Array.isArray(row.setting_value))
      throw Error("অটোমেশন রেকর্ড যাচাই করুন।");
    const value = plan(row?.setting_value || []);
    if (!value) return false;
    const payload = {
      setting_value: value,
      updated_at: new Date(
        Math.max(Date.now(), (Date.parse(row?.updated_at) || 0) + 1),
      ).toISOString(),
    };
    const saved = row
      ? await db
          .from("madrasa_settings")
          .update(payload)
          .eq("id", row.id)
          .eq("updated_at", row.updated_at)
          .select("id")
      : await db
          .from("madrasa_settings")
          .insert({ ...key, ...payload })
          .select("id");
    if (saved.error?.code === "23505") continue;
    if (saved.error) throw Error(saved.error.message);
    if (saved.data?.length) return true;
  }
  throw Error("অটোমেশন রেকর্ড বদলেছে, রিফ্রেশ করুন।");
}
