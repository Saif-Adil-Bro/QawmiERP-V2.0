// Internal helpers, NOT Next server actions. Callers must authorize the operator
// and derive tenant on the server before resolving an assignment or linking a user.
import { createAdminClient } from "@/lib/supabase/server";
import { getMadrasaMetadata, saveMadrasaMetadata } from "@/lib/sessions";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function resolveTeacherUuid(
  input: string,
  tenant: string,
): Promise<string | null> {
  if (!tenant || !input) return null;
  const db = await createAdminClient();
  const exists = async (id: string) => {
    const { data, error } = await db
      .from("teachers")
      .select("id")
      .eq("madrasa_id", tenant)
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error("শিক্ষক যাচাই করা যায়নি।");
    return !!data;
  };
  if (uuid.test(input) && (await exists(input))) return input;
  const meta = await getMadrasaMetadata(tenant, true);
  const matches = (meta.staff_members || []).filter(
    (s: any) => (!s.madrasa_id || s.madrasa_id === tenant) && (s.id === input || s.legacy_id === input),
  );
  if (matches.length !== 1) return null;
  const staff = matches[0];
  // Directory ids are sometimes the old text key, with a live SQL UUID in
  // the explicit link. Reuse it instead of creating another teacher.
  for(const link of [staff.teacher_id,staff.legacy_id]) if(uuid.test(link || '') && await exists(link))return link;
  const legacy = !uuid.test(staff.id),
    id = legacy ? crypto.randomUUID() : staff.id;
  if (!(await exists(id))) {
    // Never upsert by id: a stale staff alias must not overwrite a different tenant's row.
    const { error } = await db.from("teachers").insert({
      id,
      madrasa_id: tenant,
      first_name: staff.personal?.first_name || "শিক্ষক",
      last_name: staff.personal?.last_name || "",
      phone: staff.contact?.phone || null,
      email: staff.contact?.email || null,
      designation: staff.employment?.designation || "ওস্তাদ",
    });
    if (error && !(error.code === "23505" && (await exists(id)))) return null;
  }
  if (legacy) {
    staff.legacy_id = staff.id;
    staff.id = id;
    if (!(await saveMadrasaMetadata(tenant, meta)))
      throw new Error("পুরোনো শিক্ষক আইডির সংযোগ সংরক্ষণ করা যায়নি।");
  }
  return id;
}

/** A newly provisioned teacher account claims only an unbound, tenant-owned SQL row. */
export async function linkCreatedTeacherAccount(
  db: Awaited<ReturnType<typeof createAdminClient>>,
  tenant: string,
  userId: string,
  selectedId: string | null,
  email: string,
) {
  if (!tenant || !userId) return;
  let id = selectedId;
  if (!id && email) {
    const exact = email.replace(/[\\%_]/g, "\\$&");
    const { data, error } = await db
      .from("teachers")
      .select("id,email")
      .eq("madrasa_id", tenant)
      .ilike("email", exact)
      .limit(2);
    if (error) throw new Error("শিক্ষকের ইমেইল যাচাই করা যায়নি।");
    if (
      data?.length === 1 &&
      data[0].email?.toLowerCase() === email.toLowerCase()
    )
      id = data[0].id;
  }
  if (!id || !uuid.test(id)) return; // a metadata-only staff link stays on the tenant user row
  const { data, error } = await db
    .from("teachers")
    .select("email")
    .eq("id", id)
    .eq("madrasa_id", tenant)
    .maybeSingle();
  if (error) throw new Error("শিক্ষকের তথ্য যাচাই করা যায়নি।");
  if (
    !data ||
    (!selectedId && data.email?.toLowerCase() !== email.toLowerCase())
  )
    return;
  let update = db
    .from("teachers")
    .update({
      auth_user_id: userId,
      ...(!data.email && email ? { email } : {}),
    })
    .eq("id", id)
    .eq("madrasa_id", tenant);
  // Preserve a concurrent change to the email or the binding.
  update =
    data.email === null
      ? update.is("email", null)
      : update.eq("email", data.email);
  const { error: writeError } = await update.is("auth_user_id", null);
  if (writeError) throw new Error("শিক্ষক অ্যাকাউন্ট যুক্ত করা যায়নি।");
}
