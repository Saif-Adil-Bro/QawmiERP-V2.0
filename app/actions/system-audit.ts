"use server";

import {
  createClient,
  createAdminClient,
  getAuthUser,
} from "@/lib/supabase/server";
import { getAuthMadrasaId } from "@/app/actions/students";
import { requirePermission } from "@/lib/permissions-server";
import {
  fetchCanonicalAuditLogsAndCount,
  emptyAuditStats,
  type AuditFilters,
  type AuditStats,
  type SystemAuditLogRecord,
} from "@/lib/audit-log";
export type SystemAuditQueryFilters = AuditFilters;
export type SystemAuditStats = AuditStats;

export async function getSystemAuditLogs(
  filters?: SystemAuditQueryFilters,
): Promise<{
  success: boolean;
  storage: "sql" | "fallback";
  logs: SystemAuditLogRecord[];
  stats: SystemAuditStats;
  error?: string;
}> {
  const emptyStats = emptyAuditStats();
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) {
      return {
        success: false,
        storage: "fallback",
        logs: [],
        stats: emptyStats,
        error: "অননুমোদিত অ্যাক্সেস।",
      };
    }

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) {
      return {
        success: false,
        storage: "fallback",
        logs: [],
        stats: emptyStats,
        error: "মাদ্রাসা পাওয়া যায়নি।",
      };
    }

    const guard = await requirePermission({
      userId: user.id,
      madrasaId,
      permissions: ["settings.view", "user.view", "finance.view", "audit.view"],
      roles: [
        "super_admin",
        "admin",
        "muhtamim",
        "naib_muhtamim",
        "accountant",
      ],
      errorMessage: "সিস্টেম অডিট লগ দেখার অনুমতি কেবল প্রশাসনের আছে।",
    });
    if (!guard.allowed) {
      return {
        success: false,
        storage: "fallback",
        logs: [],
        stats: emptyStats,
        error: guard.error,
      };
    }

    const adminClient = await createAdminClient();
    const { logs, stats, storage } = await fetchCanonicalAuditLogsAndCount(
      adminClient,
      madrasaId,
      filters,
    );
    return { success: true, logs, stats, storage };
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
