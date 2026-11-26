import { createAdminClient } from "@/lib/supabase/admin";
import { logAuditEvent } from "@/lib/audit-log";

export async function resolveFailedLoginMadrasaId(
  email: string,
  resolvedTenant?: string | null,
) {
  if (resolvedTenant) return resolvedTenant; // supplied by server-side identity lookup, never the request body
  const db = await createAdminClient();
  if (email.includes("@")) {
    const { data, error } = await db
      .from("users")
      .select("madrasa_id")
      .eq("email", email.trim().toLowerCase())
      .limit(2);
    if (error) throw Error("Could not verify login tenant");
    if (data?.length === 1 && data[0].madrasa_id)
      return String(data[0].madrasa_id);
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
    if (madrasaId) {
      const r = await logAuditEvent({
        madrasaId,
        actorName: "অননুমোদিত লগইন",
        module: "security",
        action: "LOGIN_FAILED",
        entityType: "auth_session",
        summary: "লগইন প্রচেষ্টা ব্যর্থ হয়েছে।",
        severity: "WARNING",
        metadata: { channel },
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
