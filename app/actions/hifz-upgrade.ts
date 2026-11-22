"use server";

import { revalidatePath } from "next/cache";
import { writeGuard } from "@/lib/action-authorization";
import { createAdminClient, createClient, getAuthUser } from "@/lib/supabase/server";
import { getAuthMadrasaId } from "./students";
import { toDhakaDateString } from "@/lib/date-utils";
import { buildHifzLogNotes, type HifzLogMeta } from "@/lib/hifz-utils";
import {
  getStructuredMadrasaSetting,
  saveStructuredMadrasaSetting,
} from "@/lib/structured-config";
import {
  applyKhatmiCycleProgress,
  buildParaBreakdown,
  expandParaRange,
  normalizeParaList,
  summarizeParaBreakdown,
  type HifzCategory,
  type HifzDashboardSummary,
  type HifzSpecialSabinaRecord,
  type HifzStudentProfile,
  type HifzWeeklySabinaRecord,
  type SabinaListeningMode,
  type SpecialSabinaSessionLog,
} from "@/lib/hifz-upgrade-utils";

const PROFILES_SETTING_KEY = "hifz_student_profiles_v1";
const WEEKLY_SABINA_SETTING_KEY = "hifz_weekly_sabina_v1";
const SPECIAL_SABINA_SETTING_KEY = "hifz_special_sabina_v1";

function isMissingRelationError(err: any): boolean {
  const code = String(err?.code || "");
  const msg = String(err?.message || "");
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    code === "PGRST204" ||
    msg.includes("does not exist") ||
    msg.includes("schema cache")
  );
}

async function resolveClientAndMadrasa(madrasaIdOverride?: string) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  const madrasaId = madrasaIdOverride || (user ? await getAuthMadrasaId(supabase, user) : null);
  let admin: any = supabase;
  try {
    admin = await createAdminClient();
  } catch {
    admin = supabase;
  }
  return { supabase, admin, user, madrasaId };
}

export async function getHifzStudentProfiles(
  madrasaIdOverride?: string
): Promise<Record<string, HifzStudentProfile>> {
  const { admin, madrasaId } = await resolveClientAndMadrasa(madrasaIdOverride);
  if (!madrasaId) return {};

  const { data, error } = await admin
    .from("hifz_student_profiles")
    .select("*")
    .eq("madrasa_id", madrasaId);

  if (!error && Array.isArray(data)) {
    const map: Record<string, HifzStudentProfile> = {};
    for (const row of data) {
      map[row.student_id] = {
        student_id: row.student_id,
        madrasa_id: row.madrasa_id,
        hifz_category: row.hifz_category === "khatmi" ? "khatmi" : "sabqi",
        previously_memorized_paras: normalizeParaList(row.previously_memorized_paras),
        total_khatams_completed: Number(row.total_khatams_completed) || 0,
        current_khatam_paras_done: normalizeParaList(row.current_khatam_paras_done),
        default_sabina_partner_id: row.default_sabina_partner_id || null,
        updated_at: row.updated_at,
      };
    }
    return map;
  }

  if (error && !isMissingRelationError(error)) {
    console.warn("getHifzStudentProfiles warning:", error.message);
  }

  const fallback = await getStructuredMadrasaSetting<Record<string, HifzStudentProfile>>(
    madrasaId,
    "hifz",
    PROFILES_SETTING_KEY
  );
  return fallback?.value || {};
}

export async function getHifzWeeklySabinas(
  madrasaIdOverride?: string,
  studentId?: string
): Promise<HifzWeeklySabinaRecord[]> {
  const { admin, madrasaId } = await resolveClientAndMadrasa(madrasaIdOverride);
  if (!madrasaId) return [];

  let query = admin
    .from("hifz_weekly_sabina")
    .select("*")
    .eq("madrasa_id", madrasaId)
    .order("sabina_date", { ascending: false })
    .limit(100);

  if (studentId) {
    query = query.eq("student_id", studentId);
  }

  const { data, error } = await query;
  if (!error && Array.isArray(data)) {
    return data as HifzWeeklySabinaRecord[];
  }

  const fallback = await getStructuredMadrasaSetting<HifzWeeklySabinaRecord[]>(
    madrasaId,
    "hifz",
    WEEKLY_SABINA_SETTING_KEY
  );
  const list = Array.isArray(fallback?.value) ? fallback.value : [];
  return studentId ? list.filter((r) => r.student_id === studentId) : list;
}

export async function getHifzSpecialSabinas(
  madrasaIdOverride?: string
): Promise<HifzSpecialSabinaRecord[]> {
  const { admin, madrasaId } = await resolveClientAndMadrasa(madrasaIdOverride);
  if (!madrasaId) return [];

  const { data, error } = await admin
    .from("hifz_special_sabina")
    .select("*")
    .eq("madrasa_id", madrasaId)
    .order("start_date", { ascending: false })
    .limit(50);

  if (!error && Array.isArray(data)) {
    return data as HifzSpecialSabinaRecord[];
  }

  const fallback = await getStructuredMadrasaSetting<HifzSpecialSabinaRecord[]>(
    madrasaId,
    "hifz",
    SPECIAL_SABINA_SETTING_KEY
  );
  return Array.isArray(fallback?.value) ? fallback.value : [];
}

export async function getHifzUpgradeBundleAction(madrasaIdOverride?: string) {
  const [profiles, weeklySabinas, specialSabinas] = await Promise.all([
    getHifzStudentProfiles(madrasaIdOverride),
    getHifzWeeklySabinas(madrasaIdOverride),
    getHifzSpecialSabinas(madrasaIdOverride),
  ]);
  return { profiles, weeklySabinas, specialSabinas };
}

export async function upsertHifzStudentProfileAction(
  studentId: string,
  updates: {
    hifz_category?: HifzCategory;
    previously_memorized_paras?: number[];
    total_khatams_completed?: number;
    current_khatam_paras_done?: number[];
    default_sabina_partner_id?: string | null;
  }
) {
  const __authz = await writeGuard("hifz");
  if (!__authz.allowed) return __authz.fallback;

  const { admin, madrasaId } = await resolveClientAndMadrasa();
  if (!madrasaId) return { error: "Madrasa not found" };

  const existingMap = await getHifzStudentProfiles(madrasaId);
  const current = existingMap[studentId] || {
    student_id: studentId,
    madrasa_id: madrasaId,
    hifz_category: "sabqi" as HifzCategory,
    previously_memorized_paras: [],
    total_khatams_completed: 0,
    current_khatam_paras_done: [],
    default_sabina_partner_id: null,
  };

  const nextProfile: HifzStudentProfile = {
    ...current,
    hifz_category: updates.hifz_category ?? current.hifz_category,
    previously_memorized_paras:
      updates.previously_memorized_paras !== undefined
        ? normalizeParaList(updates.previously_memorized_paras)
        : current.previously_memorized_paras,
    total_khatams_completed:
      updates.total_khatams_completed !== undefined
        ? Math.max(0, Number(updates.total_khatams_completed) || 0)
        : current.total_khatams_completed,
    current_khatam_paras_done:
      updates.current_khatam_paras_done !== undefined
        ? normalizeParaList(updates.current_khatam_paras_done)
        : current.current_khatam_paras_done,
    default_sabina_partner_id:
      updates.default_sabina_partner_id !== undefined
        ? updates.default_sabina_partner_id
        : current.default_sabina_partner_id,
    updated_at: new Date().toISOString(),
  };

  const { error } = await admin
    .from("hifz_student_profiles")
    .upsert(nextProfile, { onConflict: "student_id" });

  if (error) {
    if (isMissingRelationError(error)) {
      const nextMap = { ...existingMap, [studentId]: nextProfile };
      await saveStructuredMadrasaSetting(madrasaId, "hifz", PROFILES_SETTING_KEY, nextMap);
    } else {
      return { error: error.message };
    }
  }

  await __authz.logAudit({
    action: "HIFZ_PROFILE_UPDATED",
    entityType: "hifz_student_profile",
    entityId: studentId,
    summary: `হিফজ প্রোফাইল আপডেট করা হয়েছে (${nextProfile.hifz_category === "khatmi" ? "খতমী" : "সবকী"})।`,
    newValue: nextProfile,
    severity: "INFO",
  });

  revalidatePath("/teacher-portal/hifz");
  revalidatePath("/dashboard/hifz");
  revalidatePath("/portal/academic");
  return { success: true, profile: nextProfile };
}

export async function saveDailyHifzUpgradeLogAction(payload: {
  student_id: string;
  teacher_id?: string | null;
  log_date?: string;
  student_category: HifzCategory;
  // Sabqi fields
  sabak_para?: number | null;
  sabak_page_from?: number | null;
  sabak_page_to?: number | null;
  sabak_mistakes?: number;
  saboki_para?: number | null;
  sat_sabak_mistakes?: number;
  amukhta_para?: number | null;
  amukhta_amount?: string;
  amukhta_mistakes?: number;
  // Khatmi dual-session fields
  morning_session_done?: boolean;
  morning_para_from?: number | null;
  morning_para_to?: number | null;
  morning_pages?: number | null;
  morning_mistakes?: number;
  afternoon_session_done?: boolean;
  afternoon_para_from?: number | null;
  afternoon_para_to?: number | null;
  afternoon_pages?: number | null;
  afternoon_mistakes?: number;
  // Common
  performance_rating?: string;
  teacher_remark?: string;
}) {
  const __authz = await writeGuard("hifz");
  if (!__authz.allowed) return __authz.fallback;

  const { admin, madrasaId } = await resolveClientAndMadrasa();
  if (!madrasaId) return { error: "Madrasa not found" };

  const logDate = payload.log_date || toDhakaDateString();
  const isKhatmi = payload.student_category === "khatmi";

  const meta: HifzLogMeta = {
    stage: isKhatmi ? "DAWR" : "HIFZ",
    student_category: payload.student_category,
    sabak_page_from: payload.sabak_page_from ?? null,
    sabak_page_to: payload.sabak_page_to ?? null,
    amukhta_amount: payload.amukhta_amount || "",
    sabak_mistakes: Math.max(0, Number(payload.sabak_mistakes) || 0),
    sat_sabak_mistakes: Math.max(0, Number(payload.sat_sabak_mistakes) || 0),
    amukhta_mistakes: Math.max(0, Number(payload.amukhta_mistakes) || 0),
    morning_session_done: Boolean(payload.morning_session_done),
    morning_para_from: payload.morning_para_from ?? null,
    morning_para_to: payload.morning_para_to ?? null,
    morning_pages: payload.morning_pages ?? 0,
    morning_mistakes: Math.max(0, Number(payload.morning_mistakes) || 0),
    afternoon_session_done: Boolean(payload.afternoon_session_done),
    afternoon_para_from: payload.afternoon_para_from ?? null,
    afternoon_para_to: payload.afternoon_para_to ?? null,
    afternoon_pages: payload.afternoon_pages ?? 0,
    afternoon_mistakes: Math.max(0, Number(payload.afternoon_mistakes) || 0),
    mistake_count: isKhatmi
      ? (Number(payload.morning_mistakes) || 0) + (Number(payload.afternoon_mistakes) || 0)
      : (Number(payload.sabak_mistakes) || 0) +
        (Number(payload.sat_sabak_mistakes) || 0) +
        (Number(payload.amukhta_mistakes) || 0),
  };

  const notes = buildHifzLogNotes({ rawNotes: payload.teacher_remark || "", meta });

  const baseRecord: Record<string, any> = {
    madrasa_id: madrasaId,
    student_id: payload.student_id,
    teacher_id: payload.teacher_id || null,
    log_date: logDate,
    sabak_para: isKhatmi ? payload.morning_para_from ?? null : payload.sabak_para ?? null,
    sabak_page: isKhatmi ? payload.morning_pages ?? null : payload.sabak_page_to ?? payload.sabak_page_from ?? null,
    saboki_para: isKhatmi ? payload.afternoon_para_from ?? null : payload.saboki_para ?? null,
    amukhta_para: payload.amukhta_para ?? null,
    performance_rating: payload.performance_rating || "Good",
    notes,
  };

  const extendedRecord: Record<string, any> = {
    ...baseRecord,
    student_category: payload.student_category,
    sabak_mistakes: meta.sabak_mistakes,
    sat_sabak_mistakes: meta.sat_sabak_mistakes,
    amukhta_mistakes: meta.amukhta_mistakes,
    morning_session_done: meta.morning_session_done,
    morning_para_from: meta.morning_para_from,
    morning_para_to: meta.morning_para_to,
    morning_pages: meta.morning_pages,
    morning_mistakes: meta.morning_mistakes,
    afternoon_session_done: meta.afternoon_session_done,
    afternoon_para_from: meta.afternoon_para_from,
    afternoon_para_to: meta.afternoon_para_to,
    afternoon_pages: meta.afternoon_pages,
    afternoon_mistakes: meta.afternoon_mistakes,
  };

  let { error } = await admin
    .from("hifz_logs")
    .upsert(extendedRecord, { onConflict: "student_id,log_date" });

  // Graceful fallback if new columns aren't migrated yet
  if (error && isMissingRelationError(error)) {
    const retry = await admin
      .from("hifz_logs")
      .upsert(baseRecord, { onConflict: "student_id,log_date" });
    error = retry.error;
  }

  if (error) {
    return { error: error.message };
  }

  // If Khatmi student completed paras in morning/afternoon sessions, auto-advance Khatam cycle
  let khatamJustCompleted = false;
  let updatedProfile: HifzStudentProfile | null = null;
  if (isKhatmi) {
    const completedParas = [
      ...(payload.morning_session_done
        ? expandParaRange(payload.morning_para_from, payload.morning_para_to)
        : []),
      ...(payload.afternoon_session_done
        ? expandParaRange(payload.afternoon_para_from, payload.afternoon_para_to)
        : []),
    ];

    if (completedParas.length > 0) {
      const profiles = await getHifzStudentProfiles(madrasaId);
      const current = profiles[payload.student_id] || {
        student_id: payload.student_id,
        madrasa_id: madrasaId,
        hifz_category: "khatmi" as HifzCategory,
        previously_memorized_paras: [],
        total_khatams_completed: 0,
        current_khatam_paras_done: [],
      };
      const progressed = applyKhatmiCycleProgress(current, completedParas);
      khatamJustCompleted = progressed.khatamJustCompleted;

      const res: any = await upsertHifzStudentProfileAction(payload.student_id, {
        hifz_category: "khatmi",
        total_khatams_completed: progressed.total_khatams_completed,
        current_khatam_paras_done: progressed.current_khatam_paras_done,
      });
      if (res?.profile) updatedProfile = res.profile;
    }
  }

  revalidatePath("/teacher-portal/hifz");
  revalidatePath("/dashboard/hifz");
  revalidatePath("/dashboard");
  revalidatePath("/portal/academic");

  return {
    success: true,
    khatamJustCompleted,
    profile: updatedProfile,
  };
}

export async function saveWeeklySabinaAction(payload: {
  sabina_date?: string;
  student_id: string;
  student_name?: string;
  listener_student_id?: string | null;
  listener_student_name?: string | null;
  verified_by_teacher_id?: string | null;
  assigned_para_from: number;
  assigned_para_to: number;
  mistakes_by_para: Record<number, number>;
  remarks?: string;
}) {
  const __authz = await writeGuard("hifz");
  if (!__authz.allowed) return __authz.fallback;

  const { admin, madrasaId } = await resolveClientAndMadrasa();
  if (!madrasaId) return { error: "Madrasa not found" };

  const breakdown = buildParaBreakdown(
    payload.assigned_para_from,
    payload.assigned_para_to,
    payload.mistakes_by_para || {}
  );
  const summary = summarizeParaBreakdown(breakdown);

  const record: HifzWeeklySabinaRecord = {
    id: crypto.randomUUID(),
    madrasa_id: madrasaId,
    sabina_date: payload.sabina_date || toDhakaDateString(),
    student_id: payload.student_id,
    student_name: payload.student_name,
    listener_student_id: payload.listener_student_id || null,
    listener_student_name: payload.listener_student_name || null,
    verified_by_teacher_id: payload.verified_by_teacher_id || null,
    assigned_para_from: payload.assigned_para_from,
    assigned_para_to: payload.assigned_para_to,
    para_breakdown: breakdown,
    total_paras_recited: summary.totalParas,
    total_mistakes: summary.totalMistakes,
    status: summary.weakParas.length > 0 ? "needs_review" : "completed",
    remarks: payload.remarks || null,
    created_at: new Date().toISOString(),
  };

  const dbPayload = {
    id: record.id,
    madrasa_id: record.madrasa_id,
    sabina_date: record.sabina_date,
    student_id: record.student_id,
    listener_student_id: record.listener_student_id,
    verified_by_teacher_id: record.verified_by_teacher_id,
    assigned_para_from: record.assigned_para_from,
    assigned_para_to: record.assigned_para_to,
    para_breakdown: record.para_breakdown,
    total_paras_recited: record.total_paras_recited,
    total_mistakes: record.total_mistakes,
    status: record.status,
    remarks: record.remarks,
  };

  const { error } = await admin.from("hifz_weekly_sabina").insert(dbPayload);
  if (error) {
    if (isMissingRelationError(error)) {
      const list = await getHifzWeeklySabinas(madrasaId);
      await saveStructuredMadrasaSetting(madrasaId, "hifz", WEEKLY_SABINA_SETTING_KEY, [
        record,
        ...list.slice(0, 199),
      ]);
    } else {
      return { error: error.message };
    }
  }

  await __authz.logAudit({
    action: "HIFZ_WEEKLY_SABINA_RECORDED",
    entityType: "hifz_weekly_sabina",
    entityId: record.id,
    summary: `বৃহস্পতিবারের সাপ্তাহিক সবিনা (পারা ${record.assigned_para_from}-${record.assigned_para_to}, মোট ভুল: ${record.total_mistakes}) সংরক্ষিত হয়েছে।`,
    newValue: record,
    severity: "INFO",
  });

  revalidatePath("/teacher-portal/hifz");
  revalidatePath("/dashboard/hifz");
  revalidatePath("/dashboard");
  revalidatePath("/portal/academic");
  return { success: true, record, summary };
}

export async function createSpecialSabinaAction(payload: {
  title: string;
  duration_days: number;
  start_date: string;
  end_date?: string;
  listening_mode: SabinaListeningMode;
  participants?: HifzSpecialSabinaRecord["participants"];
}) {
  const __authz = await writeGuard("hifz");
  if (!__authz.allowed) return __authz.fallback;

  const { admin, user, madrasaId } = await resolveClientAndMadrasa();
  if (!madrasaId) return { error: "Madrasa not found" };

  const title = payload.title?.trim();
  if (!title) return { error: "সবিনা ইভেন্টের শিরোনাম আবশ্যক।" };

  const record: HifzSpecialSabinaRecord = {
    id: crypto.randomUUID(),
    madrasa_id: madrasaId,
    title,
    duration_days: Math.max(1, Number(payload.duration_days) || 3),
    start_date: payload.start_date || toDhakaDateString(),
    end_date: payload.end_date || null,
    status: "ongoing",
    listening_mode: payload.listening_mode || "one_to_one",
    participants: payload.participants || {},
    session_logs: [],
    created_by: user?.id || null,
    created_at: new Date().toISOString(),
  };

  const { error } = await admin.from("hifz_special_sabina").insert(record);
  if (error) {
    if (isMissingRelationError(error)) {
      const list = await getHifzSpecialSabinas(madrasaId);
      await saveStructuredMadrasaSetting(madrasaId, "hifz", SPECIAL_SABINA_SETTING_KEY, [
        record,
        ...list.slice(0, 49),
      ]);
    } else {
      return { error: error.message };
    }
  }

  await __authz.logAudit({
    action: "HIFZ_SPECIAL_SABINA_CREATED",
    entityType: "hifz_special_sabina",
    entityId: record.id,
    summary: `বিশেষ সবিনা ইভেন্ট "${record.title}" তৈরি করা হয়েছে।`,
    newValue: record,
    severity: "INFO",
  });

  revalidatePath("/teacher-portal/hifz");
  revalidatePath("/dashboard/hifz");
  revalidatePath("/dashboard");
  revalidatePath("/portal/academic");
  return { success: true, record };
}

export async function addSpecialSabinaSessionAction(
  sabinaId: string,
  sessionInput: {
    session_label: string;
    reciter_id: string;
    reciter_name?: string;
    listener_ids: string[];
    listener_names?: string[];
    para_from: number;
    para_to: number;
    mistakes_by_para: Record<number, number>;
  }
) {
  const __authz = await writeGuard("hifz");
  if (!__authz.allowed) return __authz.fallback;

  const { admin, madrasaId } = await resolveClientAndMadrasa();
  if (!madrasaId) return { error: "Madrasa not found" };

  const list = await getHifzSpecialSabinas(madrasaId);
  const target = list.find((s) => s.id === sabinaId);
  if (!target) return { error: "বিশেষ সবিনা ইভেন্ট খুঁজে পাওয়া যায়নি।" };

  const breakdown = buildParaBreakdown(
    sessionInput.para_from,
    sessionInput.para_to,
    sessionInput.mistakes_by_para || {}
  );
  const summary = summarizeParaBreakdown(breakdown);

  const newSession: SpecialSabinaSessionLog = {
    id: crypto.randomUUID(),
    session_label: sessionInput.session_label || "বৈঠক",
    reciter_id: sessionInput.reciter_id,
    reciter_name: sessionInput.reciter_name,
    listener_ids: sessionInput.listener_ids || [],
    listener_names: sessionInput.listener_names || [],
    para_from: sessionInput.para_from,
    para_to: sessionInput.para_to,
    para_wise_mistakes: breakdown,
    total_mistakes: summary.totalMistakes,
    timestamp: new Date().toISOString(),
  };

  const nextLogs = [newSession, ...(target.session_logs || [])];

  const { error } = await admin
    .from("hifz_special_sabina")
    .update({ session_logs: nextLogs })
    .eq("id", sabinaId)
    .eq("madrasa_id", madrasaId);

  if (error) {
    if (isMissingRelationError(error)) {
      const updatedList = list.map((item) =>
        item.id === sabinaId ? { ...item, session_logs: nextLogs } : item
      );
      await saveStructuredMadrasaSetting(madrasaId, "hifz", SPECIAL_SABINA_SETTING_KEY, updatedList);
    } else {
      return { error: error.message };
    }
  }

  revalidatePath("/teacher-portal/hifz");
  revalidatePath("/dashboard/hifz");
  revalidatePath("/portal/academic");
  return { success: true, session: newSession, session_logs: nextLogs };
}

export async function completeSpecialSabinaAction(sabinaId: string) {
  const __authz = await writeGuard("hifz");
  if (!__authz.allowed) return __authz.fallback;

  const { admin, madrasaId } = await resolveClientAndMadrasa();
  if (!madrasaId) return { error: "Madrasa not found" };

  const { error } = await admin
    .from("hifz_special_sabina")
    .update({ status: "completed" })
    .eq("id", sabinaId)
    .eq("madrasa_id", madrasaId);

  if (error) {
    if (isMissingRelationError(error)) {
      const list = await getHifzSpecialSabinas(madrasaId);
      const updatedList = list.map((item) =>
        item.id === sabinaId ? { ...item, status: "completed" as const } : item
      );
      await saveStructuredMadrasaSetting(madrasaId, "hifz", SPECIAL_SABINA_SETTING_KEY, updatedList);
    } else {
      return { error: error.message };
    }
  }

  revalidatePath("/teacher-portal/hifz");
  revalidatePath("/dashboard/hifz");
  revalidatePath("/dashboard");
  return { success: true };
}

/**
 * Lightweight summary for the Built-in Dashboard Widget (`builtin-hifz-tracker`).
 */
export async function getHifzDashboardSummaryForWidget(
  madrasaId: string
): Promise<HifzDashboardSummary> {
  const today = toDhakaDateString();
  const { admin } = await resolveClientAndMadrasa(madrasaId);

  const [profiles, weeklySabinas, specialSabinas, todayLogsRes] = await Promise.all([
    getHifzStudentProfiles(madrasaId),
    getHifzWeeklySabinas(madrasaId),
    getHifzSpecialSabinas(madrasaId),
    admin
      .from("hifz_logs")
      .select("id", { count: "exact", head: true })
      .eq("madrasa_id", madrasaId)
      .eq("log_date", today),
  ]);

  const profileList = Object.values(profiles);
  const sabqiCount = profileList.filter((p) => p.hifz_category === "sabqi").length;
  const khatmiCount = profileList.filter((p) => p.hifz_category === "khatmi").length;
  const monthlyKhatamsCount = profileList.reduce(
    (sum, p) => sum + (Number(p.total_khatams_completed) || 0),
    0
  );

  // Recent 14 days Thursday Sabina stats
  const cutoffMs = Date.now() - 14 * 24 * 60 * 60 * 1000;
  const recentSabinas = weeklySabinas.filter(
    (s) => new Date(s.sabina_date || 0).getTime() >= cutoffMs
  );
  const weakParasCount = recentSabinas.reduce(
    (sum, s) =>
      sum + (s.para_breakdown || []).filter((item) => item.status === "weak").length,
    0
  );

  const ongoingSpecial = specialSabinas.filter((s) => s.status === "ongoing");

  return {
    sabqiCount,
    khatmiCount,
    todayEntriesCount: Number(todayLogsRes?.count) || 0,
    totalHifzStudents: profileList.length,
    monthlyKhatamsCount,
    thursdaySabinaCount: recentSabinas.length,
    weakParasCount,
    ongoingSpecialSabinaTitle: ongoingSpecial[0]?.title || null,
    ongoingSpecialSabinaCount: ongoingSpecial.length,
  };
}
