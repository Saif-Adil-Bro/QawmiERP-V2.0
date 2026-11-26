import { createAdminClient } from "@/lib/supabase/admin";
import { logAuditEvent } from "@/lib/audit-log";

import { DEMO_ADMIN_EMAIL, DEMO_MADRASA_NAME } from "@/lib/demo-data";

export async function resolveFailedLoginMadrasaId(
  email: string,
  resolvedTenant?: string | null,
) {
  if (resolvedTenant) return resolvedTenant; // supplied by server-side identity lookup, never the request body
  const db = await createAdminClient();
  const cleaned = String(email || "").trim().toLowerCase();

  const singleTenant = (rows: Array<{ madrasa_id?: string | null }> | null | undefined) => {
    const unique = Array.from(
      new Set((rows || []).map((r) => r?.madrasa_id).filter(Boolean).map(String)),
    );
    return unique.length === 1 ? unique[0] : null;
  };

  if (cleaned.includes("@")) {
    const { data, error } = await db
      .from("users")
      .select("madrasa_id")
      .ilike("email", cleaned)
      .limit(2);
    if (error) throw Error("Could not verify login tenant");
    const fromUsers = singleTenant(data as any);
    if (fromUsers) return fromUsers;

    const { data: teacherRows } = await db
      .from("teachers")
      .select("madrasa_id")
      .ilike("email", cleaned)
      .limit(2);
    const fromTeachers = singleTenant(teacherRows as any);
    if (fromTeachers) return fromTeachers;

    const { data: madrasaRows } = await db
      .from("madrasas")
      .select("id")
      .ilike("email", cleaned)
      .limit(2);
    if (madrasaRows?.length === 1 && madrasaRows[0]?.id) {
      return String(madrasaRows[0].id);
    }

    const { data: studentRows } = await db
      .from("students")
      .select("madrasa_id")
      .ilike("email", cleaned)
      .limit(2);
    const fromStudents = singleTenant(studentRows as any);
    if (fromStudents) return fromStudents;
  } else if (cleaned) {
    const { data: studentById } = await db
      .from("students")
      .select("madrasa_id")
      .or(
        `student_id.ilike.${cleaned},roll_number.eq.${cleaned},guardian_phone.eq.${cleaned}`,
      )
      .limit(2);
    const fromStudents = singleTenant(studentById as any);
    if (fromStudents) return fromStudents;

    const { data: teacherByPhone } = await db
      .from("teachers")
      .select("madrasa_id")
      .eq("phone", cleaned)
      .limit(2);
    const fromTeachers = singleTenant(teacherByPhone as any);
    if (fromTeachers) return fromTeachers;
  }

  // An unknown login cannot be attributed to an arbitrary school on a shared multi-tenant instance.
  // However, if there is only 1 real madrasa (plus optionally the built-in Demo Madrasa),
  // attribute safely to that single real deployment so security audits never drop LOGIN_FAILED.
  const { data, error } = await db
    .from("madrasas")
    .select("id, name, email")
    .limit(10);
  if (error) throw Error("Could not verify login tenant");
  if (!Array.isArray(data) || data.length === 0) return null;
  if (data.length === 1) return String(data[0].id);

  const nonDemo = data.filter((m: any) => {
    const name = String(m?.name || "").trim();
    const mEmail = String(m?.email || "").trim().toLowerCase();
    return (
      name !== DEMO_MADRASA_NAME &&
      mEmail !== DEMO_ADMIN_EMAIL.toLowerCase()
    );
  });
  return nonDemo.length === 1 ? String(nonDemo[0].id) : null;
}

export async function recordFailedLogin(
  identifier: string,
  channel: string,
  tenant?: string | null,
) {
  try {
    const madrasaId = await resolveFailedLoginMadrasaId(identifier, tenant);
    const safeIdentifier = String(identifier || "unknown").trim().slice(0, 120);
    if (madrasaId) {
      const r = await logAuditEvent({
        madrasaId,
        actorName: safeIdentifier || "অননুমোদিত লগইন",
        actorEmail: safeIdentifier.includes("@") ? safeIdentifier : null,
        module: "security",
        action: "LOGIN_FAILED",
        entityType: "auth_session",
        entityLabel: safeIdentifier,
        summary: `লগইন প্রচেষ্টা ব্যর্থ হয়েছে (${safeIdentifier})।`,
        severity: "WARNING",
        metadata: { channel, identifier: safeIdentifier },
      });
      if (r.success) return;
    }
    console.warn("LOGIN_FAILED", {
      channel,
      attribution: madrasaId ? "audit_write_failed" : "unattributed",
    });
  } catch {
    console.warn("LOGIN_FAILED", { channel, attribution: "unavailable" });
  }
}
