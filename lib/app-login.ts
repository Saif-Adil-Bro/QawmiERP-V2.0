import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "./supabase/admin";
import { loadServerPermissions } from "./permissions-server";
import { registerUserSession, type SessionChannel } from "./session-manager";

/** Call at password-grant issuance only. Refresh never creates or extends an app session. */
export async function completeAppLogin(
  client: SupabaseClient,
  session: Session,
  channel: SessionChannel,
  remember: boolean,
  headers?: Headers,
) {
  const inactive = {
    ok: false,
    status: 403,
    code: "ACCOUNT_INACTIVE",
    message: "সক্রিয় অ্যাকাউন্ট সংযুক্ত নেই। প্রশাসনের সাথে যোগাযোগ করুন।",
  } as const;
  const unavailable = {
    ok: false,
    status: 503,
    code: "SESSION_REGISTRATION_FAILED",
    message: "সেশন সংরক্ষণ করা যায়নি। কিছুক্ষণ পরে আবার লগইন করুন।",
  } as const;
  try {
    const db = await createAdminClient();
    const { data: row, error } = await db
      .from("users")
      .select("*,madrasas!madrasa_id(id,name,contact_email)")
      .eq("id", session.user.id)
      .maybeSingle();
    if (error) throw new Error("Profile unavailable");
    const perms = row?.madrasa_id
      ? await loadServerPermissions(session.user.id, row.madrasa_id)
      : null;
    if (row?.madrasa_id && !perms) throw new Error("Permissions unavailable");
    if (perms?.status === "ACTIVE") {
      await registerUserSession({
        userId: session.user.id,
        madrasaId: perms.madrasaId,
        accessToken: session.access_token,
        channel,
        remember,
        ipAddress:
          headers?.get("x-forwarded-for")?.split(",")[0].trim() ||
          headers?.get("x-real-ip"),
        userAgent:
          headers?.get("user-agent") ||
          (channel === "mobile" ? "QawmiERP Mobile App" : null),
      });
      return { ok: true, perms, row } as const;
    }
    await client.auth.signOut({ scope: "local" });
    return inactive;
  } catch {
    // SSR password sign-in may already have queued cookies. Drop this login only;
    // without the committed binding even a provider JWT cannot authorize app access.
    await client.auth.signOut({ scope: "local" }).catch(() => {});
    return unavailable;
  }
}
