import { createAdminClient } from "@/lib/supabase/admin";
import { logAuditEvent } from "@/lib/audit-log";

export async function resolveFailedLoginMadrasaId(
  email: string,
  resolvedTenant?: string | null,
) {
  if (resolvedTenant) return resolvedTenant; // supplied by server-side identity lookup, never the request body
  const db = await createAdminClient();
  const cleaned = String(email || "").trim().toLowerCase();
  if (cleaned.includes("@")) {
    const { data, error } = await db
      .from("users")
      .select("madrasa_id")
      .ilike("email", cleaned)
      .limit(2);
    if (error) throw Error("Could not verify login tenant");
    const uniqueTenants = Array.from(
      new Set((data || []).map((r: any) => r?.madrasa_id).filter(Boolean).map(String)),
    );
    if (uniqueTenants.length === 1) return uniqueTenants[0];

    const { data: teacherRows } = await db
      .from("teachers")
      .select("madrasa_id")
      .ilike("email", cleaned)
      .limit(2);
    const teacherTenants = Array.from(
      new Set((teacherRows || []).map((r: any) => r?.madrasa_id).filter(Boolean).map(String)),
    );
    if (teacherTenants.length === 1) return teacherTenants[0];
  }
  // An unknown login cannot be attributed to an arbitrary school on a shared instance.
  const { data, error } = await db.from("madrasas").select("id").limit(2);
  if (error) throw Error("Could not verify login tenant");
  return data?.length === 1 ? String(data[0].id) : null;
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
