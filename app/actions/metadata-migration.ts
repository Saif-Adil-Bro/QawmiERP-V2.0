"use server";

import { patchTenantJson } from "@/lib/tenant-json-patch";
import { revalidatePath } from "next/cache";
import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { getAuthMadrasaId } from "@/app/actions/students";
import { requirePermission } from "@/lib/permissions-server";
import { getMadrasaMetadata } from "@/lib/sessions";
import { logAuditEvent, isMissingTableError } from "@/lib/audit-log";
import {
  saveStructuredExamGradingConfig,
  saveStructuredExamSetting,
  saveStructuredMadrasaSetting,
  upsertStructuredStaffLeave,
} from "@/lib/structured-config";
import { LOCK_PRIVILEGED_ROLES } from "@/lib/lock-guards";

export interface TableHealthItem {
  table: string;
  labelBn: string;
  exists: boolean;
  sqlRowCount: number;
  legacyJsonCount: number;
}

export interface MetadataMigrationStatus {
  readyForMigration: boolean;
  tables: TableHealthItem[];
  examLockColumnExists: boolean;
  totalLegacyItems: number;
  totalSqlRows: number;
  canRunMigration: boolean;
}

async function probeTableCount(
  adminClient: any,
  table: string,
  madrasaId: string
): Promise<{ exists: boolean; count: number }> {
  try {
    const { count, error } = await adminClient
      .from(table)
      .select("*", { count: "exact", head: true })
      .eq("madrasa_id", madrasaId);
    if (!error) return { exists: true, count: count || 0 };
    if (isMissingTableError(error)) return { exists: false, count: 0 };
    return { exists: false, count: 0 };
  } catch {
    return { exists: false, count: 0 };
  }
}

async function probeExamLockColumn(adminClient: any, madrasaId: string): Promise<boolean> {
  try {
    const { error } = await adminClient
      .from("exams")
      .select("id, is_locked")
      .eq("madrasa_id", madrasaId)
      .limit(1);
    return !error;
  } catch {
    return false;
  }
}

export async function getMetadataMigrationStatus(): Promise<MetadataMigrationStatus> {
  const fallback: MetadataMigrationStatus = {
    readyForMigration: false,
    tables: [],
    examLockColumnExists: false,
    totalLegacyItems: 0,
    totalSqlRows: 0,
    canRunMigration: false,
  };

  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return fallback;

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return fallback;

    const guard = await requirePermission({
      userId: user.id,
      madrasaId,
      roles: LOCK_PRIVILEGED_ROLES,
    });

    const adminClient = await createAdminClient();
    const [
      meta,
      auditProbe,
      leaveProbe,
      examSettingsProbe,
      madrasaSettingsProbe,
      periodsProbe,
      examLockColumnExists,
    ] = await Promise.all([
      getMadrasaMetadata(madrasaId) as Promise<Record<string, any>>,
      probeTableCount(adminClient, "system_audit_logs", madrasaId),
      probeTableCount(adminClient, "staff_leave_requests", madrasaId),
      probeTableCount(adminClient, "exam_settings", madrasaId),
      probeTableCount(adminClient, "madrasa_settings", madrasaId),
      probeTableCount(adminClient, "accounting_periods", madrasaId),
      probeExamLockColumn(adminClient, madrasaId),
    ]);

    const legacyAuditCount =
      (Array.isArray(meta?.staff_audit_logs) ? meta.staff_audit_logs.length : 0) +
      (Array.isArray(meta?.system_audit_logs_fallback) ? meta.system_audit_logs_fallback.length : 0);

    const legacyLeavesCount = Array.isArray(meta?.staff_leave_requests)
      ? meta.staff_leave_requests.length
      : 0;

    const legacyExamSettingsCount =
      (meta?.exam_grading_config || meta?.exam_grade_scale ? 1 : 0) +
      Object.keys(meta?.exam_evaluation_rules || {}).length +
      Object.keys(meta?.exam_compulsory_subjects || {}).length +
      Object.keys(meta?.published_exams || {}).length;

    const legacyMadrasaSettingsCount =
      Object.keys(meta?.audit_settings || {}).length +
      (Object.keys(meta?.exam_end_dates || {}).length > 0 ? 1 : 0);

    const legacyPeriodsCount = Array.isArray(meta?.accounting_periods)
      ? meta.accounting_periods.length
      : 0;

    const tables: TableHealthItem[] = [
      {
        table: "system_audit_logs",
        labelBn: "ইউনিফাইড সিস্টেম অডিট লগ (Immutable)",
        exists: auditProbe.exists,
        sqlRowCount: auditProbe.count,
        legacyJsonCount: legacyAuditCount,
      },
      {
        table: "staff_leave_requests",
        labelBn: "স্টাফ ছুটির আবেদন (Staff Leaves)",
        exists: leaveProbe.exists,
        sqlRowCount: leaveProbe.count,
        legacyJsonCount: legacyLeavesCount,
      },
      {
        table: "exam_settings",
        labelBn: "পরীক্ষা ও গ্রেডিং কনফিগারেশন (Exam Settings)",
        exists: examSettingsProbe.exists,
        sqlRowCount: examSettingsProbe.count,
        legacyJsonCount: legacyExamSettingsCount,
      },
      {
        table: "madrasa_settings",
        labelBn: "মাদরাসা স্ট্রাকচার্ড সেটিংস (Madrasa Settings)",
        exists: madrasaSettingsProbe.exists,
        sqlRowCount: madrasaSettingsProbe.count,
        legacyJsonCount: legacyMadrasaSettingsCount,
      },
      {
        table: "accounting_periods",
        labelBn: "অ্যাকাউন্টিং পিরিয়ড লক (Accounting Periods)",
        exists: periodsProbe.exists,
        sqlRowCount: periodsProbe.count,
        legacyJsonCount: legacyPeriodsCount,
      },
    ];

    const readyForMigration = tables.every((t) => t.exists) && examLockColumnExists;
    const totalLegacyItems = tables.reduce((s, t) => s + t.legacyJsonCount, 0);
    const totalSqlRows = tables.reduce((s, t) => s + t.sqlRowCount, 0);

    return {
      readyForMigration,
      tables,
      examLockColumnExists,
      totalLegacyItems,
      totalSqlRows,
      canRunMigration: guard.allowed,
    };
  } catch (err) {
    console.error("getMetadataMigrationStatus error:", err);
    return fallback;
  }
}

/**
 * Idempotently migrates legacy JSON datasets from `madrasas.metadata` into
 * the dedicated relational SQL tables (`staff_leave_requests`, `exam_settings`,
 * `madrasa_settings`, `accounting_periods`, `system_audit_logs`).
 */
export async function runMetadataToTablesMigration(): Promise<{
  success: boolean;
  migrated: {
    staffLeaves: number;
    examSettings: number;
    madrasaSettings: number;
    accountingPeriods: number;
    auditLogs: number;
  };
  error?: string;
}> {
  const emptyCounts = {
    staffLeaves: 0,
    examSettings: 0,
    madrasaSettings: 0,
    accountingPeriods: 0,
    auditLogs: 0,
  };

  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { success: false, migrated: emptyCounts, error: "অননুমোদিত অ্যাক্সেস।" };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { success: false, migrated: emptyCounts, error: "মাদরাসা পাওয়া যায়নি।" };

    const guard = await requirePermission({
      userId: user.id,
      madrasaId,
      roles: LOCK_PRIVILEGED_ROLES,
      errorMessage: "ডাটাবেজ মাইগ্রেশন চালানোর অনুমতি কেবল মুহতামিম বা সুপার অ্যাডমিনের আছে।",
    });
    if (!guard.allowed) {
      return { success: false, migrated: emptyCounts, error: guard.error };
    }

    const status = await getMetadataMigrationStatus();
    if (!status.readyForMigration) {
      return {
        success: false,
        migrated: emptyCounts,
        error:
          "প্রয়োজনীয় SQL টেবিলগুলো এখনো Supabase-এ তৈরি হয়নি। প্রথমে supabase_phase_c_core_erp_migration.sql স্ক্রিপ্টটি Supabase SQL Editor-এ রান করুন।",
      };
    }

    const adminClient = await createAdminClient();
    const meta: Record<string, any> = (await getMadrasaMetadata(madrasaId)) || {};
    const migrated = { ...emptyCounts };

    // 1. Migrate staff_leave_requests
    if (Array.isArray(meta.staff_leave_requests)) {
      for (const leave of meta.staff_leave_requests) {
        if (!leave?.id || !leave?.staff_id) continue;
        const res = await upsertStructuredStaffLeave({
          ...leave,
          madrasa_id: madrasaId,
        });
        if (res.ok) migrated.staffLeaves += 1;
      }
    }

    // 2. Migrate exam_settings (grading config, evaluation rules, compulsory subjects, publish info)
    if (meta.exam_grading_config || meta.exam_grade_scale) {
      const res = await saveStructuredExamGradingConfig(
        madrasaId,
        meta.exam_grading_config || { rules: meta.exam_grade_scale },
        user.id
      );
      if (res.ok) migrated.examSettings += 1;
    }

    // Validate existing exam IDs so FK constraint on exam_settings(exam_id) never fails on deleted exams
    const { data: existingExams } = await adminClient
      .from("exams")
      .select("id")
      .eq("madrasa_id", madrasaId);
    const validExamIds = new Set((existingExams || []).map((e: any) => String(e.id)));

    for (const [examId, ruleVal] of Object.entries(meta.exam_evaluation_rules || {})) {
      if (!validExamIds.has(examId)) continue;
      const res = await saveStructuredExamSetting(madrasaId, examId, "evaluation_rules", ruleVal, user.id);
      if (res.ok) migrated.examSettings += 1;
    }

    for (const [examId, compVal] of Object.entries(meta.exam_compulsory_subjects || {})) {
      if (!validExamIds.has(examId)) continue;
      const res = await saveStructuredExamSetting(madrasaId, examId, "compulsory_subjects", compVal, user.id);
      if (res.ok) migrated.examSettings += 1;
    }

    for (const [examId, pubVal] of Object.entries(meta.published_exams || {})) {
      if (!validExamIds.has(examId)) continue;
      const res = await saveStructuredExamSetting(madrasaId, examId, "publish_info", pubVal, user.id);
      if (res.ok) migrated.examSettings += 1;
    }

    // 3. Migrate madrasa_settings (audit_settings, exam_end_dates)
    for (const [year, auditCfg] of Object.entries(meta.audit_settings || {})) {
      const res = await saveStructuredMadrasaSetting(
        madrasaId,
        "audit_settings",
        String(year),
        auditCfg,
        user.id
      );
      if (res.ok) migrated.madrasaSettings += 1;
    }

    if (meta.exam_end_dates && Object.keys(meta.exam_end_dates).length > 0) {
      const res = await saveStructuredMadrasaSetting(
        madrasaId,
        "exams",
        "exam_end_dates",
        meta.exam_end_dates,
        user.id
      );
      if (res.ok) migrated.madrasaSettings += 1;
    }

    // 4. Migrate fallback accounting_periods
    if (Array.isArray(meta.accounting_periods)) {
      for (const p of meta.accounting_periods) {
        if (!p?.period_key) continue;
        const { error, data } = await adminClient.from("accounting_periods").upsert(
          {
            madrasa_id: madrasaId,
            period_key: p.period_key,
            period_type: p.period_type || "MONTHLY",
            label: p.label || p.period_key,
            start_date: p.start_date,
            end_date: p.end_date,
            is_locked: Boolean(p.is_locked),
            locked_by: p.locked_by || null,
            locked_by_name: p.locked_by_name || null,
            locked_at: p.locked_at || null,
            lock_reason: p.lock_reason || null,
          },
          { onConflict: "madrasa_id,period_key", ignoreDuplicates: true }
        ).select('id');
        if (error) throw Error("হিসাবকাল রূপান্তর করা যায়নি। মূল রেকর্ড যাচাই করুন।");
        migrated.accountingPeriods += data?.length || 0;
      }
    }

    // 5. Migrate legacy staff_audit_logs & system_audit_logs_fallback into system_audit_logs
    // Check already migrated legacy IDs to stay strictly idempotent
    const { data: existingAudits } = await adminClient
      .from("system_audit_logs")
      .select("metadata")
      .eq("madrasa_id", madrasaId)
      .not("metadata->>legacy_id", "is", null)
      .limit(1000);

    const migratedLegacyIds = new Set(
      (existingAudits || [])
        .map((r: any) => r?.metadata?.legacy_id)
        .filter(Boolean)
        .map(String)
    );

    if (Array.isArray(meta.staff_audit_logs)) {
      for (const item of meta.staff_audit_logs) {
        const legacyId = String(item.id || `${item.action}_${item.created_at}`);
        if (migratedLegacyIds.has(legacyId)) continue;
        const { error } = await adminClient.from("system_audit_logs").insert({
          madrasa_id: madrasaId,
          actor_name: item.user_email || "প্রশাসন",
          actor_email: item.user_email || null,
          module: "staff",
          action: String(item.action || "STAFF_EVENT").slice(0, 100),
          summary: `${item.action || "স্টাফ কার্যক্রম"}: ${item.details || ""}`.trim(),
          metadata: { legacy_id: legacyId, migrated_from: "madrasas.metadata.staff_audit_logs" },
          severity: "INFO",
          created_at: item.created_at || new Date().toISOString(),
        });
        if (!error) {
          migrated.auditLogs += 1;
          migratedLegacyIds.add(legacyId);
        }
      }
    }

    if (Array.isArray(meta.system_audit_logs_fallback)) {
      for (const item of meta.system_audit_logs_fallback) {
        const legacyId = String(item.id || "");
        if (!legacyId || migratedLegacyIds.has(legacyId)) continue;
        const { error } = await adminClient.from("system_audit_logs").insert({
          madrasa_id: madrasaId,
          actor_id: item.actor_id || null,
          actor_name: item.actor_name || null,
          actor_email: item.actor_email || null,
          actor_role: item.actor_role || null,
          module: item.module || "generic",
          action: item.action || "EVENT",
          entity_type: item.entity_type || null,
          entity_id: item.entity_id || null,
          entity_label: item.entity_label || null,
          summary: item.summary || "",
          old_value: item.old_value ?? null,
          new_value: item.new_value ?? null,
          metadata: {
            ...(item.metadata || {}),
            legacy_id: legacyId,
            migrated_from: "system_audit_logs_fallback",
          },
          ip_address: item.ip_address || null,
          user_agent: item.user_agent || null,
          severity: item.severity || "INFO",
          created_at: item.created_at || new Date().toISOString(),
        });
        if (!error) {
          migrated.auditLogs += 1;
          migratedLegacyIds.add(legacyId);
        }
      }
      // Prune already-migrated fallback entries from metadata so they never linger alongside SQL rows
      try {
        await patchTenantJson(madrasaId, current => {
          const existing = current.system_audit_logs_fallback || [];
          const remaining = existing.filter((entry: any) => !migratedLegacyIds.has(String(entry?.id || "")));
          return { patch: remaining.length===existing.length ? undefined : {system_audit_logs_fallback:remaining}, result:null };
        });
      } catch {
        // non-fatal cleanup; canonical reader still deduplicates by legacy_id
      }
    }

    await logAuditEvent({
      madrasaId,
      actorId: user.id,
      actorName: guard.context?.profile?.fullName || user.email || "প্রশাসন",
      actorEmail: user.email || null,
      actorRole: guard.context?.role || null,
      module: "migration",
      action: "METADATA_TO_SQL_MIGRATED",
      entityType: "database",
      entityLabel: "Phase C Structured Tables",
      summary: `madrasas.metadata JSON থেকে স্ট্রাকচার্ড SQL টেবিলে ডেটা মাইগ্রেশন সম্পন্ন হয়েছে।`,
      newValue: migrated,
      severity: "WARNING",
    });

    revalidatePath("/dashboard/settings/data-governance");
    revalidatePath("/dashboard/settings/audit-logs");

    return { success: true, migrated };
  } catch (err: any) {
    console.error("runMetadataToTablesMigration error:", err);
    return {
      success: false,
      migrated: emptyCounts,
      error: err?.message || "মাইগ্রেশন চলাকালীন ত্রুটি হয়েছে।",
    };
  }
}
