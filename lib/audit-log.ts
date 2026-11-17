import { headers } from "next/headers";
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

async function resolveActorInfo(
  adminClient: any,
  actorId?: string | null,
  actorName?: string | null,
  actorEmail?: string | null,
  actorRole?: string | null
) {
  if (!actorId || (actorName && actorEmail && actorRole)) {
    return {
      actorName: actorName || actorEmail || "সিস্টেম অ্যাডমিন",
      actorEmail: actorEmail || null,
      actorRole: actorRole || null,
    };
  }
  try {
    const { data } = await adminClient
      .from("users")
      .select("full_name, email, role")
      .eq("id", actorId)
      .maybeSingle();
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

/**
 * Central Immutable Audit Logger.
 * Writes directly to `public.system_audit_logs`. If the table has not been
 * migrated yet in Supabase, safely persists to a bounded fallback list inside
 * `madrasas.metadata.system_audit_logs_fallback` so no critical audit trail is lost.
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
    const mergedMeta: Record<string, unknown> = {
      ...(input.metadata || {}),
      ...(changedKeys.length > 0 ? { changed_fields: changedKeys } : {}),
    };

    const rowPayload = {
      madrasa_id: input.madrasaId,
      actor_id: input.actorId || null,
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

    const { data, error } = await adminClient
      .from("system_audit_logs")
      .insert(rowPayload)
      .select("id")
      .single();

    if (!error && data?.id) {
      return { success: true, storage: "sql", id: data.id };
    }

    if (error && isMissingTableError(error)) {
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
      return { success: true, storage: "fallback", id: fallbackId };
    }

    if (error) {
      console.warn("logAuditEvent SQL insert error:", error.message);
    }
    return { success: false, storage: "none" };
  } catch (err) {
    console.warn("logAuditEvent exception:", err);
    return { success: false, storage: "none" };
  }
}
