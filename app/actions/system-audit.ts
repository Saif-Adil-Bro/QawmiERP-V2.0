"use server";

import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { getAuthMadrasaId } from "@/app/actions/students";
import { requirePermission } from "@/lib/permissions-server";
import { getMadrasaMetadata } from "@/lib/sessions";
import { startOfDhakaDay } from "@/lib/date-utils";
import {
  type SystemAuditLogRecord,
  type AuditSeverity,
  isMissingTableError,
  mergeAndDeduplicateAuditLogs,
  fetchCanonicalAuditLogsAndCount,
} from "@/lib/audit-log";

export interface SystemAuditQueryFilters {
  module?: string;
  severity?: AuditSeverity | "ALL";
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}

export interface SystemAuditStats {
  total: number;
  todayCount: number;
  criticalCount: number;
  warningCount: number;
  moduleCounts: Record<string, number>;
}

function mergeAuditLogSources(
  sqlLogs: SystemAuditLogRecord[],
  fallbackLogs: SystemAuditLogRecord[]
): SystemAuditLogRecord[] {
  return mergeAndDeduplicateAuditLogs(sqlLogs, fallbackLogs);
}

export async function getSystemAuditLogs(filters?: SystemAuditQueryFilters): Promise<{
  success: boolean;
  storage: "sql" | "fallback";
  logs: SystemAuditLogRecord[];
  stats: SystemAuditStats;
  error?: string;
}> {
  const emptyStats: SystemAuditStats = {
    total: 0,
    todayCount: 0,
    criticalCount: 0,
    warningCount: 0,
    moduleCounts: {},
  };

  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) {
      return { success: false, storage: "fallback", logs: [], stats: emptyStats, error: "অননুমোদিত অ্যাক্সেস।" };
    }

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) {
      return { success: false, storage: "fallback", logs: [], stats: emptyStats, error: "মাদ্রাসা পাওয়া যায়নি।" };
    }

    const guard = await requirePermission({
      userId: user.id,
      madrasaId,
      permissions: ["settings.view", "user.view", "finance.view", "audit.view"],
      roles: ["super_admin", "admin", "muhtamim", "naib_muhtamim", "accountant"],
      errorMessage: "সিস্টেম অডিট লগ দেখার অনুমতি কেবল প্রশাসনের আছে।",
    });
    if (!guard.allowed) {
      return { success: false, storage: "fallback", logs: [], stats: emptyStats, error: guard.error };
    }

    const adminClient = await createAdminClient();
    const limit = Math.min(Math.max(Number(filters?.limit) || 200, 10), 500);
    const hasFilter = Boolean(
      (filters?.module && filters.module !== "ALL") ||
        (filters?.severity && filters.severity !== "ALL") ||
        filters?.dateFrom ||
        filters?.dateTo ||
        (filters?.search && filters.search.trim())
    );

    let logs: SystemAuditLogRecord[] = [];
    let storage: "sql" | "fallback" = "sql";

    if (!hasFilter) {
      // N9 Parity Fix: Read via the exact same canonical deduplicated query as Backup Overview
      const canonical = await fetchCanonicalAuditLogsAndCount(adminClient, madrasaId, {
        limit: Math.max(limit, 500),
      });
      if (canonical.error) {
        return {
          success: false,
          storage: "fallback",
          logs: [],
          stats: emptyStats,
          error: canonical.error,
        };
      }
      logs = canonical.logs;
      storage = canonical.storage;
    } else {
      let query = adminClient
        .from("system_audit_logs")
        .select("*")
        .eq("madrasa_id", madrasaId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (filters?.module && filters.module !== "ALL") {
        query = query.eq("module", filters.module);
      }
      if (filters?.severity && filters.severity !== "ALL") {
        query = query.eq("severity", filters.severity);
      }
      if (filters?.dateFrom) {
        query = query.gte("created_at", `${filters.dateFrom}T00:00:00.000Z`);
      }
      if (filters?.dateTo) {
        query = query.lte("created_at", `${filters.dateTo}T23:59:59.999Z`);
      }

      const [{ data, error }, meta] = await Promise.all([
        query,
        getMadrasaMetadata(madrasaId, true),
      ]);

      const rawFallback: SystemAuditLogRecord[] = Array.isArray((meta as any)?.system_audit_logs_fallback)
        ? ((meta as any).system_audit_logs_fallback as SystemAuditLogRecord[])
        : [];

      const filteredFallback = rawFallback.filter((item) => {
        if (filters?.module && filters.module !== "ALL" && item.module !== filters.module) return false;
        if (filters?.severity && filters.severity !== "ALL" && item.severity !== filters.severity) return false;
        if (filters?.dateFrom && String(item.created_at || "") < `${filters.dateFrom}T00:00:00`) return false;
        if (filters?.dateTo && String(item.created_at || "") > `${filters.dateTo}T23:59:59`) return false;
        return true;
      });

      if (!error && Array.isArray(data)) {
        logs = mergeAuditLogSources(data as SystemAuditLogRecord[], filteredFallback);
      } else if (error && isMissingTableError(error)) {
        storage = "fallback";
        logs = mergeAuditLogSources([], filteredFallback);
      } else if (error) {
        return {
          success: false,
          storage: "fallback",
          logs: [],
          stats: emptyStats,
          error: error.message,
        };
      }
    }

    if (filters?.search && filters.search.trim()) {
      const q = filters.search.trim().toLowerCase();
      logs = logs.filter((l) =>
        [
          l.summary,
          l.action,
          l.module,
          l.actor_name,
          l.actor_email,
          l.actor_role,
          l.entity_label,
          l.entity_id,
          l.ip_address,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q)
      );
    }

    const todayStartIso = startOfDhakaDay().toISOString();
    const stats: SystemAuditStats = {
      total: logs.length,
      todayCount: 0,
      criticalCount: 0,
      warningCount: 0,
      moduleCounts: {},
    };

    for (const l of logs) {
      if (l.created_at >= todayStartIso) stats.todayCount += 1;
      if (l.severity === "CRITICAL") stats.criticalCount += 1;
      if (l.severity === "WARNING") stats.warningCount += 1;
      stats.moduleCounts[l.module] = (stats.moduleCounts[l.module] || 0) + 1;
    }

    return {
      success: true,
      storage,
      logs: logs.slice(0, limit),
      stats,
    };
  } catch (err: any) {
    console.error("getSystemAuditLogs error:", err);
    return {
      success: false,
      storage: "fallback",
      logs: [],
      stats: emptyStats,
      error: err?.message || "অডিট লগ লোড করতে ত্রুটি হয়েছে।",
    };
  }
}
