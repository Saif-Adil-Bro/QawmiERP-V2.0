import type { Identity } from "@/lib/portal/identity";
import { hasRole } from "@/lib/portal/identity";
import { linkedIds, studentRoles } from "@/lib/portal/rules";
import { dialable } from "./model";
import { childHealth, findCase, HealthError, stamp } from "./store";

export async function familyHealth(
  db: any,
  tenant: string,
  child: string,
  meta: any,
) {
  const health_records = await childHealth(db, tenant, child);
  let phone = meta.contact_phone || meta.phone || "";
  if (health_records.length && !phone) {
    const { data } = await db
      .from("madrasas")
      .select("*")
      .eq("id", tenant)
      .maybeSingle();
    phone = data?.contact_phone || data?.phone || "";
  }
  return { health_records, emergency_phone: dialable(String(phone)) };
}
export async function acknowledgeLinkedCase(
  i: Identity,
  id: string,
  version?: string,
) {
  if (
    !hasRole(i, studentRoles) ||
    i.perms.status !== "ACTIVE" ||
    i.userRow.madrasa_id !== i.tenant
  )
    throw new HealthError("অনুমতি নেই।");
  const children = linkedIds(i.userRow, i.perms.profile);
  if (!children.length)
    throw new HealthError("শিক্ষার্থীর সঙ্গে সংযোগ পাওয়া যায়নি।");
  const found = await findCase(i.db, i.tenant, id);
  if (!children.includes(found.row.student_id))
    throw new HealthError("স্বাস্থ্য নথিটি পাওয়া যায়নি।");
  const { data, error } = await i.db
    .from("students")
    .select("id")
    .eq("id", found.row.student_id)
    .eq("madrasa_id", i.tenant)
    .maybeSingle();
  if (error || !data)
    throw new HealthError("শিক্ষার্থীর সংযোগ যাচাই করা যায়নি।");
  if (version && found.row.updated_at !== version)
    throw new HealthError("নতুন স্বাস্থ্য আপডেট এসেছে। রিফ্রেশ করে পড়ে নিন।");
  if (!found.row.guardian_acknowledged_at)
    await stamp(i.db, found, "guardian_acknowledged_at", i.user.id);
}
