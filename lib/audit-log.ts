import { cache } from "react";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { mergeJsonStore } from "@/lib/madrasa-store";

export type AuditSeverity = "INFO" | "WARNING" | "CRITICAL";

export type AuditModuleKey =
  | "exams"
  | "finance"
  | "fees"
  | "students"
  | "staff"
  | "users"
  | "roles"
  | "sessions"
  | "settings"
  | "security"
  | "locks"
  | "migration"
  | "boarding"
  | "anomaly"
  | "ai"
  | "approvals"
  | "automation"
  | "notifications"
  | "webhooks"
  | "analytics"
  | "generic";

export interface AuditEventInput {
  madrasaId: string;
  actorId?: string | null;
  actorName?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
  module: AuditModuleKey | string;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  entityLabel?: string | null;
  summary: string;
  oldValue?: unknown;
  newValue?: unknown;
  metadata?: Record<string, unknown>;
  severity?: AuditSeverity;
}

export interface SystemAuditLogRecord {
  id: string;
  madrasa_id: string;
  actor_id?: string | null;
  actor_name?: string | null;
  actor_email?: string | null;
  actor_role?: string | null;
  module: string;
  action: string;
  entity_type?: string | null;
  entity_id?: string | null;
  entity_label?: string | null;
  summary?: string | null;
  old_value?: any;
  new_value?: any;
  metadata?: Record<string, any>;
  ip_address?: string | null;
  user_agent?: string | null;
  severity: AuditSeverity;
  created_at: string;
}

export const AUDIT_MODULE_LABELS_BN: Record<string, string> = {
  exams: "পরীক্ষা ও ফলাফল",
  finance: "অর্থ ও খরচ",
  fees: "ফি ও কালেকশন",
  students: "শিক্ষার্থী",
  staff: "শিক্ষক ও স্টাফ",
  users: "ইউজার ও অ্যাকাউন্ট",
  roles: "রোল ও পারমিশন",
  sessions: "শিক্ষাবর্ষ (Session)",
  settings: "সেটিংস ও কনফিগ",
  security: "নিরাপত্তা (Security)",
  locks: "ডাটা লক ও ফ্রিজ",
  migration: "ডাটা মাইগ্রেশন",
  boarding: "বোর্ডিং ও বাজার",
  anomaly: "আর্থিক অসঙ্গতি (Anomaly)",
  ai: "এআই কো-পাইলট (AI)",
  approvals: "অনুমোদন ওয়ার্কফ্লো",
  automation: "অটোমেশন ও ক্রন",
  notifications: "নোটিফিকেশন অর্কেস্ট্রেটর",
  webhooks: "ওয়েবহুক ও ইন্টিগ্রেশন",
  analytics: "বিশ্লেষণ ও আর্লি ওয়ার্নিং",
  generic: "সিস্টেম",
};

function sanitizeJsonValue(val: unknown): unknown {
  if (val === undefined) return null;
  if (val === null) return null;
  try {
    // Strip undefined / circular references / functions safely and mask secrets
    const seen = new WeakSet();
    const raw = JSON.stringify(val, (key, value) => {
      if (/password|secret|token|api_key|private_key/i.test(key)) {
        return "[REDACTED]";
      }
      if (typeof value === "object" && value !== null) {
        if (seen.has(value)) return "[Circular]";
        seen.add(value);
      }
      return value;
    });
    return JSON.parse(raw);
  } catch {
    return String(val);
  }
}

export function isMissingTableError(error: any): boolean {
  const code = String(error?.code || "");
  const msg = String(error?.message || "");
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    /does not exist|Could not find the table|relation .* does not exist/i.test(msg)
  );
}

async function extractRequestContext(): Promise<{
  ipAddress: string | null;
  userAgent: string | null;
}> {
  try {
    const hdrs = await headers();
    const forwardedFor = hdrs.get("x-forwarded-for");
    const realIp = hdrs.get("x-real-ip") || hdrs.get("cf-connecting-ip");
    const ipAddress = forwardedFor
      ? forwardedFor.split(",")[0]?.trim() || null
      : realIp || null;
    const userAgent = hdrs.get("user-agent")?.slice(0, 300) || null;
    return { ipAddress, userAgent };
  } catch {
    return { ipAddress: null, userAgent: null };
  }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(val?: string | null): boolean {
  return Boolean(val && UUID_REGEX.test(String(val).trim()));
}

const fetchCachedActorRow = cache(async (actorId: string) => {
  if (!isValidUuid(actorId)) return null;
  const adminClient = await createAdminClient();
  const { data } = await adminClient
    .from("users")
    .select("full_name, email, role")
    .eq("id", actorId)
    .maybeSingle();
  return data;
});

async function resolveActorInfo(
  _adminClient: any,
  actorId?: string | null,
  actorName?: string | null,
  actorEmail?: string | null,
  actorRole?: string | null
) {
  if (!actorId || !isValidUuid(actorId) || (actorName && actorEmail && actorRole)) {
    return {
      actorName: actorName || actorEmail || "সিস্টেম অ্যাডমিন",
      actorEmail: actorEmail || null,
      actorRole: actorRole || null,
    };
  }
  try {
    const data = await fetchCachedActorRow(actorId);
    return {
      actorName: actorName || data?.full_name || data?.email || actorEmail || "সিস্টেম ব্যবহারকারী",
      actorEmail: actorEmail || data?.email || null,
      actorRole: actorRole || data?.role || null,
    };
  } catch {
    return {
      actorName: actorName || actorEmail || "সিস্টেম ব্যবহারকারী",
      actorEmail: actorEmail || null,
      actorRole: actorRole || null,
    };
  }
}

/**
 * Compute shallow changed keys between oldValue and newValue for fast diff indexing.
 */
function extractChangedKeys(oldVal: unknown, newVal: unknown): string[] {
  if (
    !oldVal ||
    !newVal ||
    typeof oldVal !== "object" ||
    typeof newVal !== "object" ||
    Array.isArray(oldVal) ||
    Array.isArray(newVal)
  ) {
    return [];
  }
  const o = oldVal as Record<string, unknown>;
  const n = newVal as Record<string, unknown>;
  const keys = new Set([...Object.keys(o), ...Object.keys(n)]);
  const changed: string[] = [];
  for (const k of keys) {
    if (JSON.stringify(o[k]) !== JSON.stringify(n[k])) {
      changed.push(k);
    }
  }
  return changed;
}

function triggerAuditRevalidate() {
  try {
    revalidatePath("/dashboard/settings/audit-logs");
    revalidatePath("/dashboard/settings/backup");
  } catch {
    // Safe no-op outside Next.js server action/request lifecycle (e.g. unit tests)
  }
}

function buildAuditSemanticKey(row: Partial<SystemAuditLogRecord>): string {
  const tsSecond = String(row.created_at || "").slice(0, 19);
  const action = String(row.action || "").trim().toUpperCase();
  const mod = String(row.module || "").trim().toLowerCase();
  const entityId = String(row.entity_id || "").trim();
  const summaryPrefix = String(row.summary || "").trim().slice(0, 80);
  if (!tsSecond || !action) return "";
  return `${action}|${mod}|${entityId}|${tsSecond}|${summaryPrefix}`;
}

/**
 * Canonical deduplication across SQL `system_audit_logs` and metadata fallback logs.
 * Prevents double-counting rows that were migrated from `system_audit_logs_fallback`
 * into SQL (linked via `metadata.legacy_id` or identical action/entity/timestamp).
 */
export function mergeAndDeduplicateAuditLogs(
  sqlLogs: SystemAuditLogRecord[],
  fallbackLogs: SystemAuditLogRecord[]
): SystemAuditLogRecord[] {
  const seenIds = new Set<string>();
  const migratedLegacyIds = new Set<string>();
  const seenSemanticKeys = new Set<string>();
  const merged: SystemAuditLogRecord[] = [];

  for (const row of sqlLogs) {
    const id = String(row.id || "");
    const legacyId = String((row.metadata as any)?.legacy_id || "");
    const semKey = buildAuditSemanticKey(row);
    if (id && seenIds.has(id)) continue;
    if (id) seenIds.add(id);
    if (legacyId) migratedLegacyIds.add(legacyId);
    if (semKey) seenSemanticKeys.add(semKey);
    merged.push(row);
  }

  for (const row of fallbackLogs) {
    const id = String(row.id || "");
    const semKey = buildAuditSemanticKey(row);
    if (id && (seenIds.has(id) || migratedLegacyIds.has(id))) continue;
    if (semKey && seenSemanticKeys.has(semKey)) continue;
    if (id) seenIds.add(id);
    if (semKey) seenSemanticKeys.add(semKey);
    merged.push(row);
  }

  merged.sort((a, b) =>
    String(b.created_at || "").localeCompare(String(a.created_at || ""))
  );
  return merged;
}

/**
 * Shared canonical audit log counter/reader used by both `/dashboard/settings/audit-logs`
 * and `/dashboard/settings/backup` so both views always show the exact same record count.
 */
export async function fetchCanonicalAuditLogsAndCount(
  adminClient: any,
  madrasaId: string,
  options?: {
    fallbackLogs?: SystemAuditLogRecord[];
    countOnly?: boolean;
    limit?: number;
  }
): Promise<{
  logs: SystemAuditLogRecord[];
  totalCount: number;
  storage: "sql" | "fallback";
  error?: string;
}> {
  let fallbackLogs: SystemAuditLogRecord[] = Array.isArray(options?.fallbackLogs)
    ? options.fallbackLogs
    : [];

  if (!options?.fallbackLogs) {
    try {
      const { getMadrasaMetadata } = await import("@/lib/sessions");
      const meta: any = await getMadrasaMetadata(madrasaId, true);
      fallbackLogs = Array.isArray(meta?.system_audit_logs_fallback)
        ? (meta.system_audit_logs_fallback as SystemAuditLogRecord[])
        : [];
    } catch {
      fallbackLogs = [];
    }
  }

  const selectCols = options?.countOnly
    ? "id, madrasa_id, module, action, entity_id, summary, metadata, severity, created_at"
    : "*";

  const sqlRows: SystemAuditLogRecord[] = [];
  let storage: "sql" | "fallback" = "sql";
  const maxRows = options?.countOnly
    ? 5000
    : Math.min(Math.max(Number(options?.limit) || 500, 10), 2000);
  const pageSize = 500;

  for (let offset = 0; offset < maxRows; offset += pageSize) {
    const end = Math.min(offset + pageSize - 1, maxRows - 1);
    const { data, error } = await adminClient
      .from("system_audit_logs")
      .select(selectCols)
      .eq("madrasa_id", madrasaId)
      .order("created_at", { ascending: false })
      .range(offset, end);

    if (error) {
      if (isMissingTableError(error)) {
        storage = "fallback";
        const mergedFallback = mergeAndDeduplicateAuditLogs([], fallbackLogs);
        return {
          logs: mergedFallback,
          totalCount: mergedFallback.length,
          storage,
        };
      }
      return {
        logs: [],
        totalCount: 0,
        storage: "fallback",
        error: error.message,
      };
    }

    const batch = Array.isArray(data) ? (data as SystemAuditLogRecord[]) : [];
    sqlRows.push(...batch);
    if (batch.length < pageSize) break;
  }

  const merged = mergeAndDeduplicateAuditLogs(sqlRows, fallbackLogs);
  return {
    logs: merged,
    totalCount: merged.length,
    storage,
  };
}

/**
 * Central Immutable Audit Logger.
 * Writes directly to `public.system_audit_logs`. If the table has not been
 * migrated yet or if SQL insertion fails (e.g. FK constraint / non-UUID actor_id),
 * retries with `actor_id: null` and safely persists to a bounded fallback list inside
 * `madrasas.metadata.system_audit_logs_fallback` so no critical audit trail is ever lost.
 * Never throws to callers so audit logging cannot break primary business workflows.
 */
export async function logAuditEvent(input: AuditEventInput): Promise<{
  success: boolean;
  storage: "sql" | "fallback" | "none";
  id?: string;
}> {
  if (!input.madrasaId) {
    return { success: false, storage: "none" };
  }

  try {
    const adminClient = await createAdminClient();
    const [{ ipAddress, userAgent }, actor] = await Promise.all([
      extractRequestContext(),
      resolveActorInfo(
        adminClient,
        input.actorId,
        input.actorName,
        input.actorEmail,
        input.actorRole
      ),
    ]);

    const cleanOld = sanitizeJsonValue(input.oldValue);
    const cleanNew = sanitizeJsonValue(input.newValue);
    const changedKeys = extractChangedKeys(cleanOld, cleanNew);
    const hasUuidActor = isValidUuid(input.actorId);
    const mergedMeta: Record<string, unknown> = {
      ...(input.metadata || {}),
      ...(changedKeys.length > 0 ? { changed_fields: changedKeys } : {}),
      ...(input.actorId && !hasUuidActor ? { original_actor_id: input.actorId } : {}),
    };

    const rowPayload = {
      madrasa_id: input.madrasaId,
      actor_id: hasUuidActor ? String(input.actorId).trim() : null,
      actor_name: actor.actorName,
      actor_email: actor.actorEmail,
      actor_role: actor.actorRole,
      module: input.module,
      action: input.action,
      entity_type: input.entityType || null,
      entity_id: input.entityId || null,
      entity_label: input.entityLabel || null,
      summary: input.summary,
      old_value: cleanOld,
      new_value: cleanNew,
      metadata: mergedMeta,
      ip_address: ipAddress,
      user_agent: userAgent,
      severity: input.severity || "INFO",
    };

    let { data, error } = await adminClient
      .from("system_audit_logs")
      .insert(rowPayload)
      .select("id")
      .single();

    if (!error && data?.id) {
      triggerAuditRevalidate();
      return { success: true, storage: "sql", id: data.id };
    }

    // Retry with actor_id = null if FK or UUID constraint failed on users(id)
    if (error && rowPayload.actor_id !== null && !isMissingTableError(error)) {
      const retryPayload = {
        ...rowPayload,
        actor_id: null,
        metadata: {
          ...mergedMeta,
          original_actor_id: rowPayload.actor_id,
        },
      };
      const retryRes = await adminClient
        .from("system_audit_logs")
        .insert(retryPayload)
        .select("id")
        .single();
      if (!retryRes.error && retryRes.data?.id) {
        triggerAuditRevalidate();
        return { success: true, storage: "sql", id: retryRes.data.id };
      }
      error = retryRes.error || error;
    }

    // Fallback to metadata store for ANY SQL failure so no audit log is ever lost
    const fallbackId = `audit_fb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const fallbackRecord: SystemAuditLogRecord = {
      id: fallbackId,
      ...rowPayload,
      created_at: new Date().toISOString(),
    };
    await mergeJsonStore(input.madrasaId, "meta", (current) => {
      const list = Array.isArray(current.system_audit_logs_fallback)
        ? current.system_audit_logs_fallback
        : [];
      return {
        ...current,
        system_audit_logs_fallback: [fallbackRecord, ...list].slice(0, 300),
      };
    });
    triggerAuditRevalidate();
    return { success: true, storage: "fallback", id: fallbackId };
  } catch (err) {
    console.warn("logAuditEvent exception:", err);
    return { success: false, storage: "none" };
  }
}
