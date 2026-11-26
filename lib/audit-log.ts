import { cache } from "react";
import { startOfDhakaDay } from "@/lib/date-utils";
import { getMadrasaMetadataUncached } from "@/lib/sessions";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { patchTenantJson } from "@/lib/tenant-json-patch";

export type AuditSeverity = "INFO" | "WARNING" | "CRITICAL";

export type AuditModuleKey =
  | "attendance"
  | "biometric"
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
  attendance: "হাজিরা ও ছুটি",
  biometric: "বায়োমেট্রিক ডিভাইস",
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
    /does not exist|Could not find the table|relation .* does not exist/i.test(
      msg,
    )
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

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  actorRole?: string | null,
) {
  if (
    !actorId ||
    !isValidUuid(actorId) ||
    (actorName && actorEmail && actorRole)
  ) {
    return {
      actorName: actorName || actorEmail || "সিস্টেম অ্যাডমিন",
      actorEmail: actorEmail || null,
      actorRole: actorRole || null,
    };
  }
  try {
    const data = await fetchCachedActorRow(actorId);
    return {
      actorName:
        actorName ||
        data?.full_name ||
        data?.email ||
        actorEmail ||
        "সিস্টেম ব্যবহারকারী",
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

export function buildAuditSemanticKey(row: Partial<SystemAuditLogRecord>): string {
  const epoch = Date.parse(row.created_at || "");
  const tsSecond = Number.isFinite(epoch)
    ? new Date(epoch).toISOString().slice(0, 19)
    : "";
  const action = String(row.action || "")
    .trim()
    .toUpperCase();
  const mod = String(row.module || "")
    .trim()
    .toLowerCase();
  const entityId = String(row.entity_id || "").trim();
  const severity = String(row.severity || "INFO")
    .trim()
    .toUpperCase();
  const summaryPrefix = String(row.summary || "")
    .trim()
    .slice(0, 80);
  if (!tsSecond || !action) return "";
  return `${action}|${mod}|${entityId}|${severity}|${tsSecond}|${summaryPrefix}`;
}

/**
 * Canonical audit log merger & deduplicator (Round-6 parity fix restored).
 * Deduplicates fallback rows against SQL rows by:
 *   1. Exact `id` match
 *   2. `metadata.legacy_id` match (migrated fallback rows in SQL)
 *   3. Semantic match (`buildAuditSemanticKey`: action + module + entity_id + severity + timestamp second + summary)
 * Distinct SQL rows with unique IDs are never collapsed against each other.
 */
export function mergeAndDeduplicateAuditLogs(
  sqlLogs: SystemAuditLogRecord[],
  fallbackLogs: SystemAuditLogRecord[],
  tenantId?: string,
): SystemAuditLogRecord[] {
  const merged: SystemAuditLogRecord[] = [];
  const seenIds = new Set<string>();
  const sqlSemanticKeys = new Set<string>();

  for (const r of sqlLogs || []) {
    if (!r || !r.id) continue;
    if (tenantId && r.madrasa_id && r.madrasa_id !== tenantId) continue;
    if (seenIds.has(r.id)) continue;
    seenIds.add(r.id);
    if (r.metadata?.legacy_id) {
      seenIds.add(String(r.metadata.legacy_id));
    }
    const semKey = buildAuditSemanticKey(r);
    if (semKey) sqlSemanticKeys.add(semKey);
    merged.push(r);
  }

  for (const fb of fallbackLogs || []) {
    if (!fb || !fb.id) continue;
    if (tenantId && fb.madrasa_id && fb.madrasa_id !== tenantId) continue;
    if (seenIds.has(fb.id)) continue;
    if (fb.metadata?.legacy_id && seenIds.has(String(fb.metadata.legacy_id))) {
      continue;
    }
    const semKey = buildAuditSemanticKey(fb);
    if (semKey && sqlSemanticKeys.has(semKey)) continue;
    seenIds.add(fb.id);
    merged.push(fb);
  }

  merged.sort(
    (a, b) =>
      Date.parse(b.created_at) - Date.parse(a.created_at) ||
      String(b.id).localeCompare(String(a.id)),
  );
  return merged;
}

export type AuditStats = {
  total: number;
  todayCount: number;
  criticalCount: number;
  warningCount: number;
  moduleCounts: Record<string, number>;
};
export type AuditFilters = {
  module?: string;
  severity?: AuditSeverity | "ALL";
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
};
export function emptyAuditStats(): AuditStats {
  return {
    total: 0,
    todayCount: 0,
    criticalCount: 0,
    warningCount: 0,
    moduleCounts: {},
  };
}

/** Display and backup use the same ordered, tenant-scoped stream. Do not cap
 * the COUNT at a UI page. Keep at most the displayed SQL rows, one page and
 * the (small) legacy book in memory. Never turn a denied read into zero. */
export async function fetchCanonicalAuditLogsAndCount(
  db: Awaited<ReturnType<typeof createAdminClient>>,
  tenant: string,
  options: AuditFilters & {
    fallbackLogs?: SystemAuditLogRecord[];
    countOnly?: boolean;
  } = {},
) {
  const limit = options.countOnly
    ? 0
    : Math.min(500, Math.max(1, options.limit || 200));
  const stats = emptyAuditStats();
  const today = startOfDhakaDay().getTime();
  const q = options.search?.trim().toLowerCase();
  const from = options.dateFrom
    ? Date.parse(options.dateFrom + "T00:00:00+06:00")
    : -Infinity;
  const until = options.dateTo
    ? Date.parse(options.dateTo + "T00:00:00+06:00") + 86400000
    : Infinity;
  if (Number.isNaN(from) || Number.isNaN(until)) throw Error("তারিখ সঠিক নয়।");
  const matches = (r: SystemAuditLogRecord) => {
    const ts = Date.parse(r.created_at);
    return (
      (!r.madrasa_id || r.madrasa_id === tenant) &&
      ts >= from &&
      ts < until &&
      (!options.module ||
        options.module === "ALL" ||
        r.module === options.module) &&
      (!options.severity ||
        options.severity === "ALL" ||
        r.severity === options.severity) &&
      (!q ||
        [
          r.summary,
          r.action,
          r.module,
          AUDIT_MODULE_LABELS_BN[r.module],
          r.actor_name,
          r.actor_email,
          r.actor_role,
          r.entity_label,
          r.entity_id,
          r.ip_address,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q))
    );
  };
  const count = (r: SystemAuditLogRecord) => {
    stats.total++;
    if (
      Date.parse(r.created_at) >= today &&
      Date.parse(r.created_at) < today + 86400000
    )
      stats.todayCount++;
    if (r.severity === "CRITICAL") stats.criticalCount++;
    if (r.severity === "WARNING") stats.warningCount++;
    stats.moduleCounts[r.module] = (stats.moduleCounts[r.module] || 0) + 1;
  };
  const raw =
    options.fallbackLogs ??
    (await getMadrasaMetadataUncached(tenant, true))
      .system_audit_logs_fallback ??
    [];
  if (!Array.isArray(raw)) throw Error("বিকল্প অডিট খাতা পড়া যায়নি।");
  const fallback: SystemAuditLogRecord[] = raw.filter(
    (r): r is SystemAuditLogRecord =>
      !!r && (!r.madrasa_id || r.madrasa_id === tenant),
  );
  const seenSqlIds = new Set<string>();
  const sqlSemanticKeys = new Set<string>();
  const sqlTop: SystemAuditLogRecord[] = [];
  let storage: "sql" | "fallback" = "sql";
  const pageSize = 500,
    cutoff = new Date().toISOString();
  for (let offset = 0; ; offset += pageSize) {
    const full = sqlTop.length < limit;
    const { data, error } = await db
      .from("system_audit_logs")
      .select(
        full
          ? "*"
          : "id,madrasa_id,module,action,entity_id,summary,metadata,severity,created_at" +
              (q
                ? ",actor_name,actor_email,actor_role,entity_label,ip_address"
                : ""),
      )
      .eq("madrasa_id", tenant)
      .lte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) {
      if (
        offset === 0 &&
        (error.code === "42P01" || error.code === "PGRST205")
      ) {
        storage = "fallback";
        break;
      }
      throw Error("অডিট খাতা সম্পূর্ণ পড়া যায়নি।");
    }
    if (!Array.isArray(data)) throw Error("অডিট খাতার উত্তর অসম্পূর্ণ।");
    for (const r of data as unknown as SystemAuditLogRecord[]) {
      if (!r?.id || seenSqlIds.has(r.id)) continue;
      seenSqlIds.add(r.id);
      if (r.metadata?.legacy_id) seenSqlIds.add(String(r.metadata.legacy_id));
      const semKey = buildAuditSemanticKey(r);
      if (semKey) sqlSemanticKeys.add(semKey);
      if (matches(r)) {
        count(r);
        if (sqlTop.length < limit) sqlTop.push(r);
      }
    }
    if (data.length < pageSize) break;
  }

  // Deduplicate fallback rows against the full SQL stream (exact id, legacy_id, and semantic key)
  const seenFallbackIds = new Set<string>();
  const survivingFallback: SystemAuditLogRecord[] = [];
  for (const r of fallback) {
    if (!r?.id) continue;
    if (seenSqlIds.has(r.id) || seenFallbackIds.has(r.id)) continue;
    if (r.metadata?.legacy_id && seenSqlIds.has(String(r.metadata.legacy_id))) {
      continue;
    }
    const semKey = buildAuditSemanticKey(r);
    if (semKey && sqlSemanticKeys.has(semKey)) continue;
    seenFallbackIds.add(r.id);
    if (!matches(r)) continue;
    count(r);
    if (limit) survivingFallback.push(r);
  }

  const display = limit
    ? mergeAndDeduplicateAuditLogs(sqlTop, survivingFallback, tenant)
    : [];

  return {
    logs: display.slice(0, limit),
    totalCount: stats.total,
    stats,
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
        input.actorRole,
      ),
    ]);

    const cleanOld = sanitizeJsonValue(input.oldValue);
    const cleanNew = sanitizeJsonValue(input.newValue);
    const changedKeys = extractChangedKeys(cleanOld, cleanNew);
    const hasUuidActor = isValidUuid(input.actorId);
    const mergedMeta: Record<string, unknown> = {
      ...(input.metadata || {}),
      ...(changedKeys.length > 0 ? { changed_fields: changedKeys } : {}),
      ...(input.actorId && !hasUuidActor
        ? { original_actor_id: input.actorId }
        : {}),
    };

    const rowPayload = {
      id: crypto.randomUUID(),
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

    // Retry with safe nullable UUID fields if FK or UUID type constraint failed (e.g. non-UUID entity_id or actor_id)
    if (
      error &&
      !isMissingTableError(error) &&
      (rowPayload.actor_id !== null ||
        (rowPayload.entity_id !== null && !isValidUuid(rowPayload.entity_id)))
    ) {
      const safeEntityId = isValidUuid(rowPayload.entity_id)
        ? String(rowPayload.entity_id).trim()
        : null;
      const retryPayload = {
        ...rowPayload,
        actor_id: null,
        entity_id: safeEntityId,
        metadata: {
          ...mergedMeta,
          ...(rowPayload.actor_id ? { original_actor_id: rowPayload.actor_id } : {}),
          ...(rowPayload.entity_id && !safeEntityId
            ? { original_entity_id: rowPayload.entity_id }
            : {}),
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
    const fallbackId = rowPayload.id;
    const fallbackRecord: SystemAuditLogRecord = {
      ...rowPayload,
      created_at: new Date().toISOString(),
    };
    await patchTenantJson(input.madrasaId, (current) => ({
      patch: {
        system_audit_logs_fallback: [
          fallbackRecord,
          ...(current.system_audit_logs_fallback || []).filter(
            (r: any) => r.id !== fallbackId,
          ),
        ].slice(0, 300),
      },
      result: null,
    }));
    triggerAuditRevalidate();
    return { success: true, storage: "fallback", id: fallbackId };
  } catch (err) {
    console.warn("logAuditEvent exception:", err);
    return { success: false, storage: "none" };
  }
}
