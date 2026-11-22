import { createAdminClient } from "@/lib/supabase/admin";
import { getMadrasaMetadata, saveMadrasaMetadata } from "@/lib/sessions";
import { isMissingTableError } from "@/lib/audit-log";
import {
  ExamGradingConfig,
  DEFAULT_GRADING_CONFIG,
  normalizeGradingConfig,
} from "@/lib/exam-grading";
import type { StaffLeaveRequest } from "@/lib/staff-management";

const GLOBAL_EXAM_SCOPE = "__global__";

// ============================================================================
// 1. EXAM SETTINGS (public.exam_settings with graceful metadata fallback)
// ============================================================================

export async function getStructuredExamSetting<T = any>(
  madrasaId: string,
  examId: string | null,
  settingKey: string
): Promise<{ found: boolean; value: T | null; source: "sql" | "fallback" }> {
  if (!madrasaId) return { found: false, value: null, source: "fallback" };

  try {
    const adminClient = await createAdminClient();
    const scopeKey = examId || GLOBAL_EXAM_SCOPE;
    const { data, error } = await adminClient
      .from("exam_settings")
      .select("setting_value")
      .eq("madrasa_id", madrasaId)
      .eq("scope_key", scopeKey)
      .eq("setting_key", settingKey)
      .maybeSingle();

    if (!error && data && data.setting_value !== null && data.setting_value !== undefined) {
      return { found: true, value: data.setting_value as T, source: "sql" };
    }

    if (error && !isMissingTableError(error)) {
      console.warn(`getStructuredExamSetting(${settingKey}) error:`, error.message);
    }
  } catch (err) {
    console.warn(`getStructuredExamSetting(${settingKey}) catch:`, err);
  }

  return { found: false, value: null, source: "fallback" };
}

export async function saveStructuredExamSetting(
  madrasaId: string,
  examId: string | null,
  settingKey: string,
  settingValue: any,
  updatedBy?: string | null
): Promise<{ ok: boolean; storage: "sql" | "fallback" }> {
  if (!madrasaId) return { ok: false, storage: "fallback" };

  try {
    const adminClient = await createAdminClient();
    const scopeKey = examId || GLOBAL_EXAM_SCOPE;
    const { error } = await adminClient.from("exam_settings").upsert(
      {
        madrasa_id: madrasaId,
        exam_id: examId || null,
        scope_key: scopeKey,
        setting_key: settingKey,
        setting_value: settingValue,
        updated_by: updatedBy || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "madrasa_id,scope_key,setting_key" }
    );

    if (!error) {
      return { ok: true, storage: "sql" };
    }
    if (!isMissingTableError(error)) {
      throw new Error(error.message);
    }
  } catch (err) {
    throw err;
  }

  return { ok: false, storage: "fallback" };
}

export async function getStructuredExamGradingConfig(
  madrasaId: string
): Promise<ExamGradingConfig> {
  if (!madrasaId) return DEFAULT_GRADING_CONFIG;

  const sqlRes = await getStructuredExamSetting<ExamGradingConfig>(
    madrasaId,
    null,
    "grading_config"
  );
  if (sqlRes.found && sqlRes.value) {
    return normalizeGradingConfig(sqlRes.value);
  }

  const meta = await getMadrasaMetadata(madrasaId);
  return normalizeGradingConfig(meta?.exam_grading_config || meta?.exam_grade_scale);
}

export async function saveStructuredExamGradingConfig(
  madrasaId: string,
  config: ExamGradingConfig,
  updatedBy?: string | null
): Promise<{ ok: boolean; storage: "sql" | "fallback"; config: ExamGradingConfig }> {
  const normalized = normalizeGradingConfig(config);

  const sqlSave = await saveStructuredExamSetting(
    madrasaId,
    null,
    "grading_config",
    normalized,
    updatedBy
  );

  // Dual-write to metadata only when SQL table is absent, OR keep legacy readers synced safely
  if (!sqlSave.ok) {
    const meta = await getMadrasaMetadata(madrasaId);
    meta.exam_grading_config = normalized;
    meta.exam_grade_scale = normalized.rules;
    const saved = await saveMadrasaMetadata(madrasaId, meta);
    return { ok: saved, storage: "fallback", config: normalized };
  }

  // Keep legacy metadata mirror non-blocking so older code paths (e.g. mobile/portal) stay consistent
  getMadrasaMetadata(madrasaId)
    .then((meta) => {
      meta.exam_grading_config = normalized;
      meta.exam_grade_scale = normalized.rules;
      return saveMadrasaMetadata(madrasaId, meta);
    })
    .catch(() => {});

  return { ok: true, storage: "sql", config: normalized };
}

export async function getExamSettingsBundle(
  madrasaId: string,
  examId: string
): Promise<{
  gradingConfig: ExamGradingConfig;
  evaluationRules: Record<string, any>;
  compulsorySubjects: Record<string, boolean>;
  publishInfo: {
    is_published?: boolean;
    published_at?: string | null;
    published_by?: string | null;
    note?: string | null;
  } | null;
}> {
  let gradingConfig: ExamGradingConfig | null = null;
  let evaluationRules: Record<string, any> | null = null;
  let compulsorySubjects: Record<string, boolean> | null = null;
  let publishInfo: any = null;

  {
    const adminClient = await createAdminClient();
    const { data, error } = await adminClient
      .from("exam_settings")
      .select("scope_key, setting_key, setting_value")
      .eq("madrasa_id", madrasaId)
      .in("scope_key", [GLOBAL_EXAM_SCOPE, examId]);

    if (error && !['42P01','PGRST205'].includes(error.code)) throw new Error(error.message);
    if (!error && Array.isArray(data)) {
      for (const row of data) {
        if (row.scope_key === GLOBAL_EXAM_SCOPE && row.setting_key === "grading_config") {
          gradingConfig = normalizeGradingConfig(row.setting_value);
        } else if (row.scope_key === examId) {
          if (row.setting_key === "evaluation_rules") evaluationRules = row.setting_value;
          if (row.setting_key === "compulsory_subjects") compulsorySubjects = row.setting_value;
          if (row.setting_key === "publish_info") publishInfo = row.setting_value;
        }
      }
    }
  }

  // Only read metadata JSON if any setting wasn't found in SQL
  if (!gradingConfig || !evaluationRules || !compulsorySubjects || !publishInfo) {
    const meta = await getMadrasaMetadata(madrasaId,true);
    if (!gradingConfig) {
      gradingConfig = normalizeGradingConfig(meta?.exam_grading_config || meta?.exam_grade_scale);
    }
    if (!evaluationRules) {
      evaluationRules = meta?.exam_evaluation_rules?.[examId] || {
        fail_policy: "compulsory_subject_fail",
      };
    }
    if (!compulsorySubjects) {
      compulsorySubjects = meta?.exam_compulsory_subjects?.[examId] || {};
    }
    if (!publishInfo) {
      publishInfo = meta?.published_exams?.[examId] || null;
    }
  }

  return {
    gradingConfig: gradingConfig || DEFAULT_GRADING_CONFIG,
    evaluationRules: evaluationRules || { fail_policy: "compulsory_subject_fail" },
    compulsorySubjects: compulsorySubjects || {},
    publishInfo,
  };
}

// ============================================================================
// 2. MADRASA SETTINGS (public.madrasa_settings with graceful fallback)
// ============================================================================

export async function getStructuredMadrasaSetting<T = any>(
  madrasaId: string,
  namespace: string,
  settingKey: string,
  strict = false
): Promise<{ found: boolean; value: T | null; source: "sql" | "fallback" }> {
  if (!madrasaId) return { found: false, value: null, source: "fallback" };

  try {
    const adminClient = await createAdminClient();
    const { data, error } = await adminClient
      .from("madrasa_settings")
      .select("setting_value")
      .eq("madrasa_id", madrasaId)
      .eq("namespace", namespace)
      .eq("setting_key", settingKey)
      .maybeSingle();

    if (strict && error && !["42P01", "PGRST205"].includes(error.code)) throw error;
    if (!error && data && data.setting_value !== undefined) {
      return { found: true, value: data.setting_value as T, source: "sql" };
    }
  } catch (error) {
    if (strict) throw error;
    // ignore and fallback
  }

  return { found: false, value: null, source: "fallback" };
}

export async function saveStructuredMadrasaSetting(
  madrasaId: string,
  namespace: string,
  settingKey: string,
  settingValue: any,
  updatedBy?: string | null,
  insertOnly = false,
): Promise<{ ok: boolean; storage: "sql" | "fallback" }> {
  if (!madrasaId) return { ok: false, storage: "fallback" };

  try {
    const adminClient = await createAdminClient();
    const payload = {
      madrasa_id: madrasaId,
      namespace,
      setting_key: settingKey,
      setting_value: settingValue,
      updated_by: updatedBy || null,
      updated_at: new Date().toISOString(),
    };
    const table = adminClient.from("madrasa_settings");
    const { error } = insertOnly
      ? await table.insert(payload)
      : await table.upsert(payload, {
          onConflict: "madrasa_id,namespace,setting_key",
        });

    if (!error) return { ok: true, storage: "sql" };
    if (!isMissingTableError(error)) {
      console.warn(
        `saveStructuredMadrasaSetting(${namespace}.${settingKey}) error:`,
        error.message,
      );
    }
  } catch (err) {
    console.warn(
      `saveStructuredMadrasaSetting(${namespace}.${settingKey}) catch:`,
      err,
    );
  }

  return { ok: false, storage: "fallback" };
}

// ============================================================================
// 3. STAFF LEAVE REQUESTS (public.staff_leave_requests with graceful fallback)
// ============================================================================

function mapRowToStaffLeave(row: any): StaffLeaveRequest {
  return {
    id: String(row.id),
    madrasa_id: String(row.madrasa_id),
    staff_id: String(row.staff_id),
    staff_name: String(row.staff_name || ""),
    staff_id_code: String(row.staff_id_code || ""),
    leave_type: (row.leave_type || "CASUAL") as StaffLeaveRequest["leave_type"],
    leave_type_name_bn: String(row.leave_type_name_bn || row.leave_type || "ছুটি"),
    start_date: String(row.start_date),
    end_date: String(row.end_date),
    total_days: Number(row.total_days || 1),
    reason: String(row.reason || ""),
    status: (row.status || "PENDING") as StaffLeaveRequest["status"],
    reviewed_by: row.reviewed_by || undefined,
    review_reason: row.review_reason || undefined,
    reviewed_at: row.reviewed_at || undefined,
    created_at: String(row.created_at || new Date().toISOString()),
  };
}

export async function listStructuredStaffLeaves(
  madrasaId: string,
  legacyLeaves?: StaffLeaveRequest[]
): Promise<{ leaves: StaffLeaveRequest[]; source: "sql" | "fallback" }> {
  try {
    const adminClient = await createAdminClient();
    const { data, error } = await adminClient
      .from("staff_leave_requests")
      .select("*")
      .eq("madrasa_id", madrasaId)
      .order("created_at", { ascending: false });

    if (!error && Array.isArray(data)) {
      // Merge with any not-yet-migrated legacy entries by unique ID so zero history disappears
      const map = new Map<string, StaffLeaveRequest>();
      for (const row of data) {
        const mapped = mapRowToStaffLeave(row);
        map.set(mapped.id, mapped);
      }
      if (Array.isArray(legacyLeaves)) {
        for (const leg of legacyLeaves) {
          if (leg?.id && !map.has(leg.id)) {
            map.set(leg.id, leg);
          }
        }
      }
      const merged = Array.from(map.values()).sort((a, b) =>
        (b.created_at || "").localeCompare(a.created_at || "")
      );
      return { leaves: merged, source: "sql" };
    }
  } catch {
    // fallback below
  }

  return { leaves: legacyLeaves || [], source: "fallback" };
}

export async function upsertStructuredStaffLeave(
  leave: StaffLeaveRequest,
  reviewedById?: string | null
): Promise<{ ok: boolean; storage: "sql" | "fallback" }> {
  try {
    const adminClient = await createAdminClient();
    const { error } = await adminClient.from("staff_leave_requests").upsert(
      {
        id: leave.id,
        madrasa_id: leave.madrasa_id,
        staff_id: leave.staff_id,
        staff_name: leave.staff_name,
        staff_id_code: leave.staff_id_code || null,
        leave_type: leave.leave_type,
        leave_type_name_bn: leave.leave_type_name_bn,
        start_date: leave.start_date,
        end_date: leave.end_date,
        total_days: leave.total_days,
        reason: leave.reason || "",
        status: leave.status,
        reviewed_by: leave.reviewed_by || null,
        reviewed_by_id: reviewedById || null,
        review_reason: leave.review_reason || null,
        reviewed_at: leave.reviewed_at || null,
        created_at: leave.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    if (!error) return { ok: true, storage: "sql" };
    if (!isMissingTableError(error)) {
      console.warn("upsertStructuredStaffLeave error:", error.message);
    }
  } catch (err) {
    console.warn("upsertStructuredStaffLeave catch:", err);
  }
  return { ok: false, storage: "fallback" };
}

export async function deleteStructuredStaffLeavesForStaff(
  madrasaId: string,
  staffId: string
): Promise<void> {
  try {
    const adminClient = await createAdminClient();
    await adminClient
      .from("staff_leave_requests")
      .delete()
      .eq("madrasa_id", madrasaId)
      .eq("staff_id", staffId);
  } catch {
    // safe no-op if table doesn't exist
  }
}
