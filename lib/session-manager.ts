import { studentRoles, teacherRoles } from "./portal/rules";
import type { ServerPermissionContext } from "./permissions-server";
/** Application session registry. Only bound SQL records authorize access; see current_app_session(). */
import { createHash, randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAuditEvent } from "@/lib/audit-log";

export type SessionChannel = "web" | "mobile";
export type DeviceType = "desktop" | "mobile" | "tablet" | "unknown";

export interface ParsedUserAgent {
  deviceName: string;
  deviceType: DeviceType;
  browser: string;
  os: string;
}

export interface UserSessionRecord {
  id: string;
  madrasa_id: string;
  user_id: string;
  session_token_hash?: string | null;
  provider_session_id?: string | null;
  channel: SessionChannel;
  device_name: string;
  device_type: DeviceType;
  browser: string;
  os: string;
  ip_address: string | null;
  user_agent: string | null;
  is_active: boolean;
  last_active_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
  revoked_reason: string | null;
  created_at: string;
  // Enriched UI metadata
  user_name?: string;
  user_email?: string;
  user_role?: string;
}

/**
 * Computes a SHA-256 hex digest of an access/session token for safe storage.
 */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(String(token)).digest("hex");
}

/**
 * Pure User-Agent parser extracting browser, OS, deviceType, and friendly deviceName.
 */
export function parseUserAgent(ua: string | null | undefined): ParsedUserAgent {
  const raw = String(ua || "").trim();
  if (!raw) {
    return {
      deviceName: "অজানা ডিভাইস",
      deviceType: "unknown",
      browser: "Unknown",
      os: "Unknown",
    };
  }

  let os = "Unknown OS";
  if (/Android/i.test(raw)) {
    const m = raw.match(/Android\s+([\d.]+)/i);
    os = m ? `Android ${m[1]}` : "Android";
  } else if (/iPhone|iPad|iPod/i.test(raw)) {
    os = /iPad/i.test(raw) ? "iPadOS" : "iOS";
  } else if (/Windows NT 10\.0/i.test(raw)) {
    os = "Windows 10/11";
  } else if (/Windows NT/i.test(raw)) {
    os = "Windows";
  } else if (/Mac OS X|Macintosh/i.test(raw)) {
    os = "macOS";
  } else if (/CrOS/i.test(raw)) {
    os = "ChromeOS";
  } else if (/Linux/i.test(raw)) {
    os = "Linux";
  }

  let browser = "Unknown Browser";
  if (/QawmiERP|Capacitor|okhttp|Dalvik/i.test(raw)) {
    browser = "QawmiERP Mobile App";
  } else if (/EdgA?|Edge/i.test(raw)) {
    browser = "Microsoft Edge";
  } else if (/OPR|Opera/i.test(raw)) {
    browser = "Opera";
  } else if (/Firefox|FxiOS/i.test(raw)) {
    browser = "Firefox";
  } else if (/Chrome|CriOS/i.test(raw) && !/Edg/i.test(raw)) {
    browser = "Chrome";
  } else if (/Safari/i.test(raw) && !/Chrome/i.test(raw)) {
    browser = "Safari";
  } else if (/curl|Postman|insomnia/i.test(raw)) {
    browser = "API Client";
  }

  let deviceType: DeviceType = "desktop";
  if (
    /iPad|Tablet|PlayBook|Silk/i.test(raw) ||
    (/Android/i.test(raw) && !/Mobile/i.test(raw))
  ) {
    deviceType = "tablet";
  } else if (
    /Mobile|iPhone|iPod|Android.*Mobile|QawmiERP|Capacitor|okhttp/i.test(raw)
  ) {
    deviceType = "mobile";
  } else if (os === "Unknown OS" && browser === "Unknown Browser") {
    deviceType = "unknown";
  }

  const deviceName = `${browser} (${os})`;
  return { deviceName, deviceType, browser, os };
}

// Decoding is NOT authentication. Use only at issuance, on the session just
// returned by the server-side password grant. No request path registers a JWT.
function issuedProviderId(accessToken: string, userId: string): string {
  try {
    const claims = JSON.parse(
      Buffer.from(accessToken.split(".")[1], "base64url").toString("utf8"),
    );
    if (
      claims.sub === userId &&
      typeof claims.session_id === "string" &&
      /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(claims.session_id)
    )
      return claims.session_id;
  } catch {
    /* no usable binding */
  }
  throw new Error("Missing provider session binding");
}

export async function registerUserSession(params: {
  userId: string;
  madrasaId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  accessToken: string;
  remember?: boolean;
  channel?: SessionChannel;
  expiresAt?: string | null;
}): Promise<UserSessionRecord> {
  const now = new Date();
  const parsed = parseUserAgent(params.userAgent);
  const channel: SessionChannel = params.channel || "web";
  const ttlMs = params.remember
    ? 365 * 24 * 60 * 60 * 1000
    : 24 * 60 * 60 * 1000;
  const expiresAt =
    params.expiresAt || new Date(now.getTime() + ttlMs).toISOString();
  const record: UserSessionRecord = {
    id: randomUUID(),
    madrasa_id: params.madrasaId,
    user_id: params.userId,
    provider_session_id: issuedProviderId(params.accessToken, params.userId),
    session_token_hash: hashSessionToken(params.accessToken), // audit only, never authorization
    channel,
    device_name: parsed.deviceName,
    device_type: parsed.deviceType,
    browser: parsed.browser,
    os: parsed.os,
    ip_address: params.ipAddress || null,
    user_agent: params.userAgent
      ? String(params.userAgent).slice(0, 512)
      : null,
    is_active: true,
    last_active_at: now.toISOString(),
    expires_at: expiresAt,
    revoked_at: null,
    revoked_by: null,
    revoked_reason: null,
    created_at: now.toISOString(),
  };

  const admin = await createAdminClient();
  const { data, error } = await admin
    .from("user_sessions")
    .insert(record)
    .select("id")
    .single();
  // Insert only, never upsert: registration may not reactivate an existing session.
  if (error || data?.id !== record.id)
    throw new Error("Cannot register session");
  return record;
}

export function mayManageTenantSessions(ctx: ServerPermissionContext) {
  const roles = ctx.roles.map((r) => r.toLowerCase());
  return (
    ctx.status === "ACTIVE" &&
    !roles.some((r) => [...studentRoles, ...teacherRoles].includes(r)) &&
    (roles.some((r) => ["super_admin", "admin", "muhtamim"].includes(r)) ||
      ctx.summary.effectivePermissions.includes("security.sessions.manage"))
  );
}

/**
 * Lists active (or all) sessions for a user or an entire madrasa.
 */
export async function listUserSessions(params: {
  madrasaId: string;
  userId?: string;
  includeRevoked?: boolean;
  limit?: number;
}): Promise<{ sessions: UserSessionRecord[]; storage: "sql" }> {
  const limit = Math.min(Math.max(params.limit || 100, 1), 250);
  let sessions: UserSessionRecord[] = [];
  const admin = await createAdminClient();
  let query = admin
    .from("user_sessions")
    .select(
      "id,madrasa_id,user_id,channel,device_name,device_type,browser,os,ip_address,user_agent,is_active,last_active_at,expires_at,revoked_at,revoked_by,revoked_reason,created_at",
    )
    .eq("madrasa_id", params.madrasaId)
    .order("last_active_at", { ascending: false })
    .limit(limit);
  if (params.userId) query = query.eq("user_id", params.userId);
  if (!params.includeRevoked)
    query = query
      .eq("is_active", true)
      .is("revoked_at", null)
      .not("provider_session_id", "is", null)
      .gt("expires_at", new Date().toISOString());
  const { data, error } = await query;
  if (error) throw new Error("Session registry unavailable");
  sessions = data || [];

  // Enrich with user name/email/role
  if (sessions.length > 0) {
    try {
      const userIds = Array.from(
        new Set(sessions.map((s) => s.user_id).filter(Boolean)),
      );
      const { data: users } = await admin
        .from("users")
        .select("id, full_name, email, role")
        .eq("madrasa_id", params.madrasaId)
        .in("id", userIds);
      const userMap = new Map<
        string,
        { full_name?: string; email?: string; role?: string }
      >();
      for (const u of users || []) {
        userMap.set(String((u as any).id), u as any);
      }
      sessions = sessions.map((s) => {
        const u = userMap.get(s.user_id);
        return {
          ...s,
          user_name: u?.full_name || s.user_name || undefined,
          user_email: u?.email || s.user_email || undefined,
          user_role: u?.role || s.user_role || undefined,
        };
      });
    } catch {
      // non-fatal enrichment failure
    }
  }

  return { sessions, storage: "sql" };
}

/**
 * Revokes a single session by ID and logs `SESSION_TERMINATED` to `system_audit_logs`.
 */
export async function revokeUserSession(params: {
  sessionId: string;
  ownerUserId?: string;
  madrasaId: string;
  revokedBy: string;
  actorName?: string;
  actorEmail?: string;
  actorRole?: string;
  reason?: string;
  skipAudit?: boolean;
}): Promise<{ success: boolean; notFound?: boolean; error?: string }> {
  const nowIso = new Date().toISOString();
  const reason = params.reason || "REMOTE_TERMINATED";
  let targetSession: Pick<
    UserSessionRecord,
    "id" | "user_id" | "device_name" | "ip_address"
  > | null = null;

  try {
    const admin = await createAdminClient();
    let query = admin
      .from("user_sessions")
      .update({
        is_active: false,
        revoked_at: nowIso,
        revoked_by: params.revokedBy || null,
        revoked_reason: reason,
      })
      .eq("id", params.sessionId)
      .eq("madrasa_id", params.madrasaId);
    if (params.ownerUserId) query = query.eq("user_id", params.ownerUserId);
    const { data, error } = await query
      .select("id,user_id,device_name,ip_address")
      .maybeSingle();

    if (error) return { success: false, error: "Session registry unavailable" };
    targetSession = data;
  } catch {
    return { success: false, error: "Session registry unavailable" };
  }

  if (!targetSession) {
    return { success: false, notFound: true, error: "Session not found" };
  }

  if (!params.skipAudit) {
    await logAuditEvent({
      madrasaId: params.madrasaId,
      actorId: params.revokedBy,
      actorName: params.actorName,
      actorEmail: params.actorEmail,
      actorRole: params.actorRole,
      module: "security",
      action: "SESSION_TERMINATED",
      entityType: "user_session",
      entityId: params.sessionId,
      entityLabel: targetSession?.device_name || params.sessionId,
      summary: `সক্রিয় সেশন বাতিল করা হয়েছে (${targetSession?.device_name || params.sessionId}, কারণ: ${reason})।`,
      metadata: {
        session_id: params.sessionId,
        target_user_id: targetSession?.user_id || null,
        ip_address: targetSession?.ip_address || null,
        reason,
      },
      severity: "WARNING",
    });
  }

  return { success: true };
}

/**
 * Revokes all other active sessions for a user except `currentSessionId`.
 */
export async function revokeOtherSessions(params: {
  madrasaId: string;
  userId: string;
  currentSessionId?: string | null;
  revokedBy: string;
  actorName?: string;
  actorEmail?: string;
  actorRole?: string;
  reason?: string;
}): Promise<{ success: boolean; count: number; error?: string }> {
  const nowIso = new Date().toISOString();
  const reason = params.reason || "TERMINATE_OTHER_SESSIONS";
  let count = 0;

  try {
    const admin = await createAdminClient();
    let query = admin
      .from("user_sessions")
      .update({
        is_active: false,
        revoked_at: nowIso,
        revoked_by: params.revokedBy,
        revoked_reason: reason,
      })
      .eq("madrasa_id", params.madrasaId)
      .eq("user_id", params.userId)
      .eq("is_active", true);

    if (params.currentSessionId) {
      query = query.neq("id", params.currentSessionId);
    }

    const { data, error } = await query.select("id");
    if (error)
      return {
        success: false,
        count: 0,
        error: "Session registry unavailable",
      };
    count = data?.length || 0;
  } catch {
    return { success: false, count: 0, error: "Session registry unavailable" };
  }

  await logAuditEvent({
    madrasaId: params.madrasaId,
    actorId: params.revokedBy,
    actorName: params.actorName,
    actorEmail: params.actorEmail,
    actorRole: params.actorRole,
    module: "security",
    action: "SESSION_TERMINATED",
    entityType: "user_session",
    entityId: params.userId,
    summary: `অন্যান্য ${count}টি সক্রিয় সেশন দূর থেকে বাতিল করা হয়েছে।`,
    metadata: {
      target_user_id: params.userId,
      preserved_session_id: params.currentSessionId || null,
      terminated_count: count,
      reason,
    },
    severity: "WARNING",
  });

  return { success: true, count };
}

/**
 * Revokes ALL active sessions for a specific user (admin action or emergency lockout).
 */
export async function revokeAllUserSessions(params: {
  madrasaId: string;
  targetUserId: string;
  revokedBy: string;
  actorName?: string;
  actorEmail?: string;
  actorRole?: string;
  reason?: string;
}): Promise<{ success: boolean; count: number; error?: string }> {
  return revokeOtherSessions({
    madrasaId: params.madrasaId,
    userId: params.targetUserId,
    currentSessionId: null,
    revokedBy: params.revokedBy,
    actorName: params.actorName,
    actorEmail: params.actorEmail,
    actorRole: params.actorRole,
    reason: params.reason || "ADMIN_REVOKE_ALL_SESSIONS",
  });
}
