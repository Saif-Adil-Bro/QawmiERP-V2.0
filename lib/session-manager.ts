/**
 * Active Session Management & Remote Termination (Feature 1.2)
 *
 * Tracks web & mobile login sessions in `public.user_sessions` with automatic
 * `isMissingTableError` graceful fallback to `madrasas.security_metadata.user_sessions_fallback`.
 */

import { createHash, randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { readJsonStore, mergeJsonStore } from "@/lib/madrasa-store";
import { isMissingTableError, logAuditEvent } from "@/lib/audit-log";

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

export const SESSION_COOKIE_NAME = "qawmi_session_id";
const FALLBACK_KEY = "user_sessions_fallback";
const FALLBACK_MAX_RECORDS = 200;

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
  if (/iPad|Tablet|PlayBook|Silk/i.test(raw) || (/Android/i.test(raw) && !/Mobile/i.test(raw))) {
    deviceType = "tablet";
  } else if (/Mobile|iPhone|iPod|Android.*Mobile|QawmiERP|Capacitor|okhttp/i.test(raw)) {
    deviceType = "mobile";
  } else if (os === "Unknown OS" && browser === "Unknown Browser") {
    deviceType = "unknown";
  }

  const deviceName = `${browser} (${os})`;
  return { deviceName, deviceType, browser, os };
}

/**
 * Pure session status evaluator (used in both DB and fallback paths + unit tests).
 */
export function evaluateSessionRecordRevoked(
  session: Pick<UserSessionRecord, "is_active" | "revoked_at" | "expires_at"> | null | undefined,
  nowMs: number = Date.now()
): { revoked: boolean; reason?: "REVOKED" | "EXPIRED" | "INACTIVE" } {
  if (!session) return { revoked: false };
  if (session.revoked_at) return { revoked: true, reason: "REVOKED" };
  if (session.is_active === false) return { revoked: true, reason: "INACTIVE" };
  if (session.expires_at) {
    const exp = new Date(session.expires_at).getTime();
    if (!Number.isNaN(exp) && exp <= nowMs) {
      return { revoked: true, reason: "EXPIRED" };
    }
  }
  return { revoked: false };
}

/**
 * Registers a new active session on login (web or mobile).
 * Never throws; falls back cleanly to `madrasas.security_metadata` if table is missing.
 */
export async function registerUserSession(params: {
  userId: string;
  madrasaId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  accessToken?: string | null;
  sessionToken?: string | null;
  remember?: boolean;
  channel?: SessionChannel;
  expiresAt?: string | null;
}): Promise<UserSessionRecord> {
  const now = new Date();
  const parsed = parseUserAgent(params.userAgent);
  const channel: SessionChannel = params.channel || "web";
  const ttlMs = params.remember ? 365 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  const expiresAt = params.expiresAt || new Date(now.getTime() + ttlMs).toISOString();
  const rawToken = params.accessToken?.trim() || params.sessionToken?.trim() || null;
  const tokenHash = rawToken ? hashSessionToken(rawToken) : null;

  const record: UserSessionRecord = {
    id: randomUUID(),
    madrasa_id: params.madrasaId,
    user_id: params.userId,
    session_token_hash: tokenHash,
    channel,
    device_name: parsed.deviceName,
    device_type: parsed.deviceType,
    browser: parsed.browser,
    os: parsed.os,
    ip_address: params.ipAddress || null,
    user_agent: params.userAgent ? String(params.userAgent).slice(0, 512) : null,
    is_active: true,
    last_active_at: now.toISOString(),
    expires_at: expiresAt,
    revoked_at: null,
    revoked_by: null,
    revoked_reason: null,
    created_at: now.toISOString(),
  };

  try {
    const admin = await createAdminClient();
    const { data, error } = await admin
      .from("user_sessions")
      .insert(record)
      .select("*")
      .maybeSingle();

    if (!error && data) {
      return data as UserSessionRecord;
    }

    if (error && !isMissingTableError(error)) {
      console.error("registerUserSession SQL error:", error);
    }
  } catch (err) {
    console.warn("registerUserSession SQL exception, using fallback:", err);
  }

  // Fallback to madrasas.security_metadata
  try {
    await mergeJsonStore(params.madrasaId, "security", (current) => {
      const existing: UserSessionRecord[] = Array.isArray(current[FALLBACK_KEY])
        ? current[FALLBACK_KEY]
        : [];
      const next = [record, ...existing].slice(0, FALLBACK_MAX_RECORDS);
      return { ...current, [FALLBACK_KEY]: next };
    });
  } catch (err) {
    console.warn("registerUserSession fallback store error:", err);
  }

  return record;
}

export const registerActiveSession = registerUserSession;
export const recordUserSession = registerUserSession;

/**
 * Updates the heartbeat timestamp for a session (best-effort).
 */
export async function touchSessionHeartbeat(params: {
  sessionId: string;
  madrasaId?: string;
  ipAddress?: string | null;
}): Promise<void> {
  if (!params.sessionId) return;
  const nowIso = new Date().toISOString();

  try {
    const admin = await createAdminClient();
    const updatePayload: Record<string, any> = { last_active_at: nowIso };
    if (params.ipAddress) updatePayload.ip_address = params.ipAddress;

    const { error } = await admin
      .from("user_sessions")
      .update(updatePayload)
      .eq("id", params.sessionId)
      .eq("is_active", true);

    if (!error) return;
    if (!isMissingTableError(error)) return;
  } catch {
    // fall through to fallback
  }

  if (!params.madrasaId) return;
  try {
    await mergeJsonStore(params.madrasaId, "security", (current) => {
      const existing: UserSessionRecord[] = Array.isArray(current[FALLBACK_KEY])
        ? current[FALLBACK_KEY]
        : [];
      const updated = existing.map((s) =>
        s.id === params.sessionId && s.is_active
          ? { ...s, last_active_at: nowIso, ...(params.ipAddress ? { ip_address: params.ipAddress } : {}) }
          : s
      );
      return { ...current, [FALLBACK_KEY]: updated };
    });
  } catch {
    // ignore
  }
}

/**
 * Lists active (or all) sessions for a user or an entire madrasa.
 */
export async function listUserSessions(params: {
  madrasaId: string;
  userId?: string;
  includeRevoked?: boolean;
  limit?: number;
}): Promise<{ sessions: UserSessionRecord[]; storage: "sql" | "fallback" }> {
  const limit = Math.min(Math.max(params.limit || 100, 1), 250);
  let sessions: UserSessionRecord[] = [];
  let storage: "sql" | "fallback" = "sql";

  try {
    const admin = await createAdminClient();
    let query = admin
      .from("user_sessions")
      .select("*")
      .eq("madrasa_id", params.madrasaId)
      .order("last_active_at", { ascending: false })
      .limit(limit);

    if (params.userId) {
      query = query.eq("user_id", params.userId);
    }
    if (!params.includeRevoked) {
      query = query.eq("is_active", true).is("revoked_at", null);
    }

    const { data, error } = await query;
    if (!error && Array.isArray(data)) {
      sessions = data as UserSessionRecord[];
    } else if (error && isMissingTableError(error)) {
      storage = "fallback";
    } else if (error) {
      console.error("listUserSessions error:", error);
      storage = "fallback";
    }
  } catch {
    storage = "fallback";
  }

  if (storage === "fallback") {
    try {
      const store = await readJsonStore(params.madrasaId, "security");
      const all: UserSessionRecord[] = Array.isArray(store[FALLBACK_KEY])
        ? store[FALLBACK_KEY]
        : [];
      sessions = all
        .filter((s) => {
          if (params.userId && s.user_id !== params.userId) return false;
          if (!params.includeRevoked && (!s.is_active || s.revoked_at)) return false;
          return true;
        })
        .sort(
          (a, b) =>
            new Date(b.last_active_at || b.created_at).getTime() -
            new Date(a.last_active_at || a.created_at).getTime()
        )
        .slice(0, limit);
    } catch {
      sessions = [];
    }
  }

  // Enrich with user name/email/role
  if (sessions.length > 0) {
    try {
      const admin = await createAdminClient();
      const userIds = Array.from(new Set(sessions.map((s) => s.user_id).filter(Boolean)));
      const { data: users } = await admin
        .from("users")
        .select("id, full_name, email, role")
        .in("id", userIds);
      const userMap = new Map<string, { full_name?: string; email?: string; role?: string }>();
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

  return { sessions, storage };
}

/**
 * Checks whether a session ID has been revoked or expired.
 * Fail-open if table is missing or session row doesn't exist (e.g. pre-migration login).
 */
export async function isSessionRevoked(params: {
  sessionId: string;
  userId?: string;
  madrasaId?: string;
}): Promise<boolean> {
  if (!params.sessionId) return false;

  try {
    const admin = await createAdminClient();
    let query = admin
      .from("user_sessions")
      .select("id, is_active, revoked_at, expires_at")
      .eq("id", params.sessionId);

    if (params.userId) query = query.eq("user_id", params.userId);
    const { data, error } = await query.maybeSingle();

    if (!error) {
      if (!data) return false;
      return evaluateSessionRecordRevoked(data as any).revoked;
    }

    if (!isMissingTableError(error)) {
      return false;
    }
  } catch {
    // check fallback if madrasaId provided
  }

  if (params.madrasaId) {
    try {
      const store = await readJsonStore(params.madrasaId, "security");
      const all: UserSessionRecord[] = Array.isArray(store[FALLBACK_KEY])
        ? store[FALLBACK_KEY]
        : [];
      const row = all.find(
        (s) => s.id === params.sessionId && (!params.userId || s.user_id === params.userId)
      );
      if (row) return evaluateSessionRecordRevoked(row).revoked;
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Checks whether a hashed mobile/API Bearer token has been revoked.
 */
export async function isTokenHashRevoked(
  tokenHash: string,
  userId?: string,
  madrasaId?: string
): Promise<boolean> {
  if (!tokenHash) return false;

  try {
    const admin = await createAdminClient();
    let query = admin
      .from("user_sessions")
      .select("id, is_active, revoked_at, expires_at")
      .eq("session_token_hash", tokenHash);
    if (userId) query = query.eq("user_id", userId);

    const { data, error } = await query
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error) {
      if (!data) return false;
      return evaluateSessionRecordRevoked(data as any).revoked;
    }

    if (!isMissingTableError(error)) {
      return false;
    }
  } catch {
    // fall through
  }

  if (madrasaId) {
    try {
      const store = await readJsonStore(madrasaId, "security");
      const all: UserSessionRecord[] = Array.isArray(store[FALLBACK_KEY])
        ? store[FALLBACK_KEY]
        : [];
      const row = all.find(
        (s) => s.session_token_hash === tokenHash && (!userId || s.user_id === userId)
      );
      if (row) return evaluateSessionRecordRevoked(row).revoked;
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Revokes a single session by ID and logs `SESSION_TERMINATED` to `system_audit_logs`.
 */
export async function revokeUserSession(params: {
  sessionId: string;
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
  let targetSession: UserSessionRecord | null = null;
  let usedFallback = false;

  try {
    const admin = await createAdminClient();
    const { data, error } = await admin
      .from("user_sessions")
      .update({
        is_active: false,
        revoked_at: nowIso,
        revoked_by: params.revokedBy || null,
        revoked_reason: reason,
      })
      .eq("id", params.sessionId)
      .eq("madrasa_id", params.madrasaId)
      .select("*")
      .maybeSingle();

    if (!error) {
      targetSession = (data as UserSessionRecord) || null;
    } else if (isMissingTableError(error)) {
      usedFallback = true;
    } else {
      return { success: false, error: error.message };
    }
  } catch {
    usedFallback = true;
  }

  if (usedFallback) {
    await mergeJsonStore(params.madrasaId, "security", (current) => {
      const existing: UserSessionRecord[] = Array.isArray(current[FALLBACK_KEY])
        ? current[FALLBACK_KEY]
        : [];
      const updated = existing.map((s) => {
        if (s.id === params.sessionId) {
          targetSession = {
            ...s,
            is_active: false,
            revoked_at: nowIso,
            revoked_by: params.revokedBy || null,
            revoked_reason: reason,
          };
          return targetSession;
        }
        return s;
      });
      return { ...current, [FALLBACK_KEY]: updated };
    });
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
  let usedFallback = false;

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
    if (!error) {
      count = Array.isArray(data) ? data.length : 0;
    } else if (isMissingTableError(error)) {
      usedFallback = true;
    } else {
      return { success: false, count: 0, error: error.message };
    }
  } catch {
    usedFallback = true;
  }

  if (usedFallback) {
    await mergeJsonStore(params.madrasaId, "security", (current) => {
      const existing: UserSessionRecord[] = Array.isArray(current[FALLBACK_KEY])
        ? current[FALLBACK_KEY]
        : [];
      const updated = existing.map((s) => {
        if (
          s.user_id === params.userId &&
          s.is_active &&
          (!params.currentSessionId || s.id !== params.currentSessionId)
        ) {
          count += 1;
          return {
            ...s,
            is_active: false,
            revoked_at: nowIso,
            revoked_by: params.revokedBy,
            revoked_reason: reason,
          };
        }
        return s;
      });
      return { ...current, [FALLBACK_KEY]: updated };
    });
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

/**
 * Revokes a session by its raw access token or SHA-256 token hash (used by mobile logout).
 */
export async function revokeSessionByTokenHash(
  tokenHash: string,
  reason = "MOBILE_LOGOUT",
  madrasaId?: string
): Promise<void> {
  if (!tokenHash) return;
  const nowIso = new Date().toISOString();

  try {
    const admin = await createAdminClient();
    const { error } = await admin
      .from("user_sessions")
      .update({
        is_active: false,
        revoked_at: nowIso,
        revoked_reason: reason,
      })
      .eq("session_token_hash", tokenHash)
      .eq("is_active", true);

    if (!error || !isMissingTableError(error)) return;
  } catch {
    // fall through
  }

  if (!madrasaId) return;
  try {
    await mergeJsonStore(madrasaId, "security", (current) => {
      const existing: UserSessionRecord[] = Array.isArray(current[FALLBACK_KEY])
        ? current[FALLBACK_KEY]
        : [];
      const updated = existing.map((s) =>
        s.session_token_hash === tokenHash && s.is_active
          ? { ...s, is_active: false, revoked_at: nowIso, revoked_reason: reason }
          : s
      );
      return { ...current, [FALLBACK_KEY]: updated };
    });
  } catch {
    // ignore
  }
}
