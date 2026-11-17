"use server";

import { toDhakaDateString } from "@/lib/date-utils";
import { writeGuard } from "@/lib/action-authorization";
import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getAuthMadrasaId } from "./students";
import { getMadrasaMetadata, saveMadrasaMetadata, MadrasaMetaWithSessions, hydrateStudentWithMetadata } from "@/lib/sessions";
import {
  GradeRule,
  ExamGradingConfig,
  DEFAULT_GRADE_RULES,
  DEFAULT_GRADING_CONFIG,
  normalizeGradeRules,
  normalizeGradingConfig,
  resolveGradeRule,
  resolveGradeFromGpa,
  resolveSubjectGpa,
  getFailRule,
  getMinPassPercentage,
} from "@/lib/exam-grading";
import { sortStudentsByRoll } from "@/lib/student-utils";
import { requirePermission } from "@/lib/permissions-server";
import { logAuditEvent } from "@/lib/audit-log";
import {
  getStructuredExamGradingConfig,
  saveStructuredExamGradingConfig,
  getStructuredExamSetting,
  saveStructuredExamSetting,
  getExamSettingsBundle,
  getStructuredMadrasaSetting,
  saveStructuredMadrasaSetting,
} from "@/lib/structured-config";
import {
  assertExamUnlocked,
  getExamLockState,
  hasLockPrivilege,
  LOCK_PRIVILEGED_ROLES,
  type ExamLockState,
} from "@/lib/lock-guards";

function computeExamStatus(
  startDate?: string | null,
  routines?: { exam_date: string }[] | null,
  manualStatus?: string,
  endDate?: string | null
): {
  status: "Upcoming" | "Ongoing" | "Completed";
  statusTextBangla: string;
  effectiveStartDate: string | null;
  effectiveEndDate: string | null;
  totalRoutineDays: number;
} {
  // Extract all valid routine dates sorted chronologically
  const routineDates = (routines || [])
    .map(r => r.exam_date)
    .filter(Boolean)
    .sort();

  const minRoutineDate = routineDates.length > 0 ? routineDates[0] : null;
  const maxRoutineDate = routineDates.length > 0 ? routineDates[routineDates.length - 1] : null;

  // Effective Start Date: if startDate provided, use it, else minRoutineDate
  const effectiveStartDate = startDate || minRoutineDate;
  // Effective End Date: if endDate provided, use it; else if routine exists, maxRoutineDate; else startDate
  const effectiveEndDate = endDate || maxRoutineDate || startDate || null;

  if (!effectiveStartDate) {
    return {
      status: "Upcoming",
      statusTextBangla: "আসন্ন",
      effectiveStartDate: null,
      effectiveEndDate: null,
      totalRoutineDays: routineDates.length,
    };
  }

  // Current date string in YYYY-MM-DD format (Asia/Dhaka timezone)
  let todayStr: string;
  try {
    todayStr = new Intl.DateTimeFormat('en-CA', { 
      timeZone: 'Asia/Dhaka', 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    }).format(new Date());
  } catch {
    todayStr = toDhakaDateString();
  }

  const startStr = effectiveStartDate.split('T')[0];
  const endStr = (effectiveEndDate || effectiveStartDate).split('T')[0];

  let status: "Upcoming" | "Ongoing" | "Completed";
  let statusTextBangla: string;

  if (todayStr < startStr) {
    status = "Upcoming";
    statusTextBangla = "আসন্ন";
  } else if (todayStr >= startStr && todayStr <= endStr) {
    status = "Ongoing";
    statusTextBangla = "চলমান";
  } else {
    status = "Completed";
    statusTextBangla = "সম্পন্ন";
  }

  return {
    status,
    statusTextBangla,
    effectiveStartDate,
    effectiveEndDate,
    totalRoutineDays: routineDates.length,
  };
}

export async function getExams() {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return [];

  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return [];

  const { data: exams, error } = await supabase
    .from("exams")
    .select("*")
    .eq('madrasa_id', finalMadrasaId)
    .order("start_date", { ascending: false });

  if (error || !exams) {
    console.error("Error fetching exams:", error);
    return [];
  }

  const examIds = exams.map(e => e.id);
  const [{ data: routines }, madrasaMeta] = await Promise.all([
    examIds.length > 0
      ? supabase
          .from("exam_routines")
          .select("id, exam_id, exam_date")
          .in("exam_id", examIds)
      : Promise.resolve({ data: [] }),
    getMadrasaMetadata(finalMadrasaId),
  ]);

  const publishedExams = madrasaMeta?.published_exams || {};
  const examEndDates = madrasaMeta?.exam_end_dates || {};
  const fallbackLocksSetting = await getStructuredMadrasaSetting<Record<string, ExamLockState>>(
    finalMadrasaId,
    "locks",
    "exam_locks"
  );
  const fallbackLocks: Record<string, ExamLockState> =
    (fallbackLocksSetting.found && fallbackLocksSetting.value) ||
    (madrasaMeta as any)?.exam_locks ||
    {};

  const routinesByExam = new Map<string, any[]>();
  (routines || []).forEach(r => {
    if (!routinesByExam.has(r.exam_id)) {
      routinesByExam.set(r.exam_id, []);
    }
    routinesByExam.get(r.exam_id)!.push(r);
  });

  return exams.map(exam => {
    const examRoutines = routinesByExam.get(exam.id) || [];
    const effectiveStoredEndDate = exam.end_date || examEndDates[exam.id] || null;
    const computed = computeExamStatus(exam.start_date, examRoutines, exam.status, effectiveStoredEndDate);
    const publishInfo = publishedExams[exam.id];
    const isPublished = Boolean(publishInfo?.is_published || exam.status === "Published");
    const lockInfo = fallbackLocks[exam.id];
    const isLocked = typeof exam.is_locked === "boolean" ? exam.is_locked : Boolean(lockInfo?.is_locked);

    return {
      ...exam,
      end_date: effectiveStoredEndDate,
      status: isPublished ? "Published" : computed.status,
      computed_status: computed.status,
      dynamic_status: computed.status,
      dynamic_status_bangla: computed.statusTextBangla,
      is_published: isPublished,
      published_at: publishInfo?.published_at || null,
      published_by: publishInfo?.published_by || null,
      publish_note: publishInfo?.note || null,
      is_locked: isLocked,
      locked_by: exam.locked_by || lockInfo?.locked_by || null,
      locked_by_name: exam.locked_by_name || lockInfo?.locked_by_name || null,
      locked_at: exam.locked_at || lockInfo?.locked_at || null,
      lock_reason: exam.lock_reason || lockInfo?.lock_reason || null,
      effective_start_date: computed.effectiveStartDate,
      effective_end_date: computed.effectiveEndDate,
      routine_count: computed.totalRoutineDays,
      last_routine_date: computed.effectiveEndDate,
    };
  });
}

export async function getExamById(id: string) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  const finalMadrasaId = user ? await getAuthMadrasaId(supabase, user) : null;

  const { data, error } = await supabase
    .from("exams")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    console.error("Error fetching exam:", error);
    return null;
  }

  const madrasaId = finalMadrasaId || data.madrasa_id;
  const [{ data: routines }, madrasaMeta, lockState] = await Promise.all([
    supabase
      .from("exam_routines")
      .select("id, exam_id, exam_date")
      .eq("exam_id", id),
    madrasaId ? getMadrasaMetadata(madrasaId) : Promise.resolve({} as MadrasaMetaWithSessions),
    madrasaId ? getExamLockState(madrasaId, id) : Promise.resolve({ is_locked: false } as ExamLockState),
  ]);

  const examEndDates = madrasaMeta?.exam_end_dates || {};
  const effectiveStoredEndDate = data.end_date || examEndDates[id] || null;
  const computed = computeExamStatus(data.start_date, routines, data.status, effectiveStoredEndDate);
  const publishInfo = madrasaMeta?.published_exams?.[id];
  const isPublished = Boolean(publishInfo?.is_published || data.status === "Published");

  return {
    ...data,
    end_date: effectiveStoredEndDate,
    status: isPublished ? "Published" : computed.status,
    computed_status: computed.status,
    dynamic_status: computed.status,
    dynamic_status_bangla: computed.statusTextBangla,
    is_published: isPublished,
    published_at: publishInfo?.published_at || null,
    published_by: publishInfo?.published_by || null,
    publish_note: publishInfo?.note || null,
    is_locked: lockState.is_locked,
    locked_by: lockState.locked_by || null,
    locked_by_name: lockState.locked_by_name || null,
    locked_at: lockState.locked_at || null,
    lock_reason: lockState.lock_reason || null,
    effective_start_date: computed.effectiveStartDate,
    effective_end_date: computed.effectiveEndDate,
    routine_count: computed.totalRoutineDays,
    last_routine_date: computed.effectiveEndDate,
  };
}

/**
 * Freeze/Lock or Unlock an Exam so marks & settings cannot be altered after result approval/publishing.
 * Strictly restricted to Muhtamim, Admin, or Super Admin.
 */
export async function toggleExamLock(
  examId: string,
  shouldLock: boolean,
  reason?: string
): Promise<{ success?: boolean; is_locked?: boolean; message?: string; error?: string }> {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অনুগ্রহ করে পুনরায় লগইন করুন।" };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "মাদরাসার তথ্য খুঁজে পাওয়া যায়নি।" };

    const guard = await requirePermission({
      userId: user.id,
      madrasaId,
      roles: LOCK_PRIVILEGED_ROLES,
      errorMessage: "পরীক্ষা লক বা আনলক করার অনুমতি কেবল মুহতামিম, অ্যাডমিন অথবা সুপার অ্যাডমিনের আছে।",
    });

    const actorName = guard.context?.profile?.fullName || user.email || "প্রশাসন";
    const actorEmail = guard.context?.profile?.email || user.email || null;
    const actorRole = guard.context?.role || null;

    if (!guard.allowed || !guard.context || !hasLockPrivilege(guard.context.roles, guard.context.role)) {
      await logAuditEvent({
        madrasaId,
        actorId: user.id,
        actorName,
        actorEmail,
        actorRole,
        module: "security",
        action: "UNAUTHORIZED_EXAM_LOCK_ATTEMPT",
        entityType: "exam",
        entityId: examId,
        summary: `পরীক্ষা (${examId}) লক/আনলক করার অননুমোদিত চেষ্টা ব্লক করা হয়েছে।`,
        severity: "CRITICAL",
      });
      return {
        error:
          guard.error ||
          "পরীক্ষা লক বা আনলক করার অনুমতি কেবল মুহতামিম, অ্যাডমিন অথবা সুপার অ্যাডমিনের আছে।",
      };
    }

    const adminClient = await createAdminClient();
    const { data: examRow } = await adminClient
      .from("exams")
      .select("id, title, year")
      .eq("id", examId)
      .eq("madrasa_id", madrasaId)
      .maybeSingle();

    const examLabel = examRow ? `${examRow.title} (${examRow.year})` : examId;
    const now = new Date().toISOString();
    const cleanReason =
      (reason || "").trim() ||
      (shouldLock ? "ফলাফল চূড়ান্তকরণ ও নম্বর ফ্রিজ" : "মুহতামিম কর্তৃক পুনর্মূল্যায়নের জন্য আনলক");

    const lockPayload: ExamLockState = {
      is_locked: shouldLock,
      locked_by: shouldLock ? user.id : null,
      locked_by_name: shouldLock ? actorName : null,
      locked_at: shouldLock ? now : null,
      lock_reason: shouldLock ? cleanReason : null,
    };

    // 1. Update relational exams table columns if migrated
    const { error: colErr } = await adminClient
      .from("exams")
      .update(lockPayload)
      .eq("id", examId)
      .eq("madrasa_id", madrasaId);

    // 2. Always persist fallback in madrasa_settings (or metadata) if exams.is_locked column isn't added yet
    if (colErr) {
      const existingSetting = await getStructuredMadrasaSetting<Record<string, ExamLockState>>(
        madrasaId,
        "locks",
        "exam_locks"
      );
      const nextMap: Record<string, ExamLockState> = {
        ...(existingSetting.value || {}),
        [examId]: lockPayload,
      };
      const savedSetting = await saveStructuredMadrasaSetting(
        madrasaId,
        "locks",
        "exam_locks",
        nextMap,
        user.id
      );
      if (!savedSetting.ok) {
        const meta: any = await getMadrasaMetadata(madrasaId);
        meta.exam_locks = { ...(meta.exam_locks || {}), [examId]: lockPayload };
        await saveMadrasaMetadata(madrasaId, meta);
      }
    }

    await logAuditEvent({
      madrasaId,
      actorId: user.id,
      actorName,
      actorEmail,
      actorRole,
      module: "exams",
      action: shouldLock ? "EXAM_LOCKED" : "EXAM_UNLOCKED",
      entityType: "exam",
      entityId: examId,
      entityLabel: examLabel,
      summary: shouldLock
        ? `"${examLabel}" পরীক্ষাটি লক/ফ্রিজ করা হয়েছে — নম্বর ও সেটিংস পরিবর্তন বন্ধ। কারণ: ${cleanReason}`
        : `"${examLabel}" পরীক্ষাটি আনলক করা হয়েছে। কারণ: ${cleanReason}`,
      oldValue: { is_locked: !shouldLock },
      newValue: lockPayload,
      severity: shouldLock ? "WARNING" : "CRITICAL",
    });

    revalidatePath("/dashboard/exams");
    revalidatePath(`/dashboard/exams/${examId}/marks`);
    revalidatePath(`/dashboard/exams/${examId}/setup`);
    revalidatePath(`/dashboard/exams/${examId}/results`);
    revalidatePath("/dashboard/settings/data-governance");

    return {
      success: true,
      is_locked: shouldLock,
      message: shouldLock
        ? `পরীক্ষা "${examLabel}" সফলভাবে লক/ফ্রিজ করা হয়েছে। এখন আর কেউ নম্বর পরিবর্তন করতে পারবেন না।`
        : `পরীক্ষা "${examLabel}" আনলক করা হয়েছে। এখন নম্বর এন্ট্রি ও সংশোধন করা যাবে।`,
    };
  } catch (err: any) {
    console.error("toggleExamLock error:", err);
    return { error: err?.message || "পরীক্ষা লক/আনলক করতে ত্রুটি হয়েছে।" };
  }
}

export async function toggleExamPublish(examId: string, isPublished: boolean, note?: string) {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  const __authz = await writeGuard("exams");
  if (!__authz.allowed) return __authz.fallback;

  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অনুগ্রহ করে পুনরায় লগইন করুন।" };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "মাদরাসার তথ্য খুঁজে পাওয়া যায়নি।" };

    const meta = await getMadrasaMetadata(madrasaId);
    const prevPublish = meta.published_exams?.[examId] || { is_published: false };
    if (!meta.published_exams) {
      meta.published_exams = {};
    }

    const { data: userData } = await supabase
      .from("users")
      .select("full_name, email")
      .eq("id", user.id)
      .single();

    const publisherName = userData?.full_name || userData?.email || "কর্তৃপক্ষ";

    const nextPublish = {
      is_published: isPublished,
      published_at: new Date().toISOString(),
      published_by: publisherName,
      note: note || "",
    };

    // Save to relational exam_settings table first
    await saveStructuredExamSetting(madrasaId, examId, "publish_info", nextPublish, user.id);

    meta.published_exams[examId] = nextPublish;
    const saved = await saveMadrasaMetadata(madrasaId, meta);
    if (!saved) {
      return { error: "ফলাফলের অবস্থা সংরক্ষণ করা যায়নি।" };
    }

    // Update status in exams table as well
    const adminClient = await createAdminClient();
    const { data: examRow } = await adminClient
      .from("exams")
      .update({
        status: isPublished ? "Published" : "Completed",
      })
      .eq("id", examId)
      .select("title, year")
      .maybeSingle();

    await __authz.logAudit({
      action: isPublished ? "EXAM_RESULT_PUBLISHED" : "EXAM_RESULT_UNPUBLISHED",
      entityType: "exam",
      entityId: examId,
      entityLabel: examRow ? `${examRow.title} (${examRow.year})` : examId,
      summary: isPublished
        ? `পরীক্ষার ফলাফল আনুষ্ঠানিকভাবে প্রকাশ করা হয়েছে (${examRow?.title || examId})।`
        : `পরীক্ষার ফলাফল স্থগিত/অপ্রকাশিত করা হয়েছে (${examRow?.title || examId})।`,
      oldValue: prevPublish,
      newValue: nextPublish,
      severity: isPublished ? "WARNING" : "CRITICAL",
    });

    revalidatePath("/dashboard/exams");
    revalidatePath(`/dashboard/exams/${examId}/results`);
    revalidatePath(`/dashboard/exams/${examId}/merit-list`);
    revalidatePath(`/dashboard/exams/${examId}/report-cards`);
    revalidatePath("/portal/exams");
    revalidatePath("/portal", "layout");

    return {
      success: true,
      is_published: isPublished,
      message: isPublished
        ? "পরীক্ষার ফলাফল আনুষ্ঠানিকভাবে সফলভাবে প্রকাশিত হয়েছে! অভিভাবক ও শিক্ষার্থীরা এখন পোর্টালে রেজাল্ট ও মার্কশিট দেখতে পাবেন।"
        : "পরীক্ষার ফলাফল স্থগিত/অপ্রকাশিত করা হয়েছে। পোর্টাল থেকে ফলাফল লুকানো হয়েছে।",
    };
  } catch (err: any) {
    console.error("toggleExamPublish error:", err);
    return { error: err.message || "একটি ত্রুটি হয়েছে" };
  }
}

export async function getExamPublishStatus(examId: string) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { isPublished: false };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { isPublished: false };

    const meta = await getMadrasaMetadata(madrasaId);
    const publishInfo = meta?.published_exams?.[examId];

    return {
      isPublished: Boolean(publishInfo?.is_published),
      publishedAt: publishInfo?.published_at || null,
      publishedBy: publishInfo?.published_by || null,
      note: publishInfo?.note || null,
    };
  } catch (err) {
    console.error("getExamPublishStatus error:", err);
    return { isPublished: false };
  }
}

export async function createExam(prevState: any, formData: FormData) {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  const __authz = await writeGuard("exams");
  if (!__authz.allowed) return __authz.fallback;

  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return { error: "Unauthorized" };

  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return { error: "Madrasa not found" };

  let title = (formData.get("title") as string)?.trim();
  const custom_title = (formData.get("custom_title") as string)?.trim();
  const year = (formData.get("year") as string)?.trim();
  const start_date = formData.get("start_date") as string;
  const end_date = formData.get("end_date") as string;

  if (title === "অন্যান্য" || title === "অন্যান্য (Custom)" || title === "custom") {
    title = custom_title || "অন্যান্য পরীক্ষা";
  }

  if (!title || !year) {
    return { error: "পরীক্ষার নাম এবং বছর আবশ্যক।" };
  }

  // Calculate dynamic status initially
  const computed = computeExamStatus(start_date, null, undefined, end_date);

  let insertPayload: any = {
    madrasa_id: finalMadrasaId,
    title,
    year,
    start_date: start_date || null,
    end_date: end_date || null,
    status: computed.status
  };

  let newExamId: string | null = null;
  let { data: insertedData, error } = await supabase.from("exams").insert(insertPayload).select("id").single();
  if (insertedData?.id) {
    newExamId = insertedData.id;
  }

  // If DB table doesn't have end_date column, fallback without end_date
  if (error && (error.message?.includes("end_date") || error.code === "PGRST204")) {
    delete insertPayload.end_date;
    const retry = await supabase.from("exams").insert(insertPayload).select("id").single();
    if (retry.data?.id) {
      newExamId = retry.data.id;
    }
    error = retry.error;
  }

  if (error) {
    console.error("Error creating exam:", error);
    return { error: error.message };
  }

  // Always store end_date in madrasa metadata to ensure 100% persistence
  if (newExamId && end_date) {
    try {
      const meta = await getMadrasaMetadata(finalMadrasaId);
      meta.exam_end_dates = meta.exam_end_dates || {};
      meta.exam_end_dates[newExamId] = end_date;
      await saveMadrasaMetadata(finalMadrasaId, meta);
    } catch (metaErr) {
      console.error("Error persisting exam end_date in metadata:", metaErr);
    }
  }

  await __authz.logAudit({
    action: "EXAM_CREATED",
    entityType: "exam",
    entityId: newExamId,
    entityLabel: `${title} (${year})`,
    summary: `নতুন পরীক্ষা "${title} (${year})" তৈরি করা হয়েছে।`,
    newValue: { title, year, start_date: start_date || null, end_date: end_date || null },
    severity: "INFO",
  });

  revalidatePath("/dashboard/exams");
  return { success: true };
}

export async function updateExamDetails(examId: string, data: { title?: string; year?: string; start_date?: string | null; end_date?: string | null }) {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  const __authz = await writeGuard("exams");
  if (!__authz.allowed) return __authz.fallback;

  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return { error: "Unauthorized" };

  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (finalMadrasaId) {
    const lockCheck = await assertExamUnlocked(finalMadrasaId, examId, "পরীক্ষার তথ্য সংশোধন");
    if (lockCheck.locked) return { error: lockCheck.error };
  }

  const { data: oldExam } = await supabase
    .from("exams")
    .select("title, year, start_date, end_date")
    .eq("id", examId)
    .maybeSingle();

  const computed = computeExamStatus(data.start_date, null, undefined, data.end_date);

  let updatePayload: any = {
    title: data.title,
    year: data.year,
    start_date: data.start_date || null,
    end_date: data.end_date || null,
    status: computed.status
  };

  let { error } = await supabase.from("exams").update(updatePayload).eq("id", examId);

  if (error && (error.message?.includes("end_date") || error.code === "PGRST204")) {
    delete updatePayload.end_date;
    const retry = await supabase.from("exams").update(updatePayload).eq("id", examId);
    error = retry.error;
  }

  if (error) {
    console.error("Error updating exam:", error);
    return { error: error.message };
  }

  // Update in madrasa metadata
  if (finalMadrasaId && data.end_date !== undefined) {
    try {
      const meta = await getMadrasaMetadata(finalMadrasaId);
      meta.exam_end_dates = meta.exam_end_dates || {};
      if (data.end_date) {
        meta.exam_end_dates[examId] = data.end_date;
      } else {
        delete meta.exam_end_dates[examId];
      }
      await saveMadrasaMetadata(finalMadrasaId, meta);
    } catch (metaErr) {
      console.error("Error updating exam end_date in metadata:", metaErr);
    }
  }

  await __authz.logAudit({
    action: "EXAM_UPDATED",
    entityType: "exam",
    entityId: examId,
    entityLabel: `${data.title || oldExam?.title || examId} (${data.year || oldExam?.year || ""})`,
    summary: `পরীক্ষার তথ্য হালনাগাদ করা হয়েছে: "${data.title || oldExam?.title || examId}"।`,
    oldValue: oldExam || null,
    newValue: data,
    severity: "INFO",
  });

  revalidatePath("/dashboard/exams");
  revalidatePath(`/dashboard/exams/${examId}/setup`);
  return { success: true };
}

export async function deleteExam(examId: string) {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  const __authz = await writeGuard("exams");
  if (!__authz.allowed) return __authz.fallback;

  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  const finalMadrasaId = user ? await getAuthMadrasaId(supabase, user) : null;

  if (finalMadrasaId) {
    const lockCheck = await assertExamUnlocked(finalMadrasaId, examId, "পরীক্ষাটি মুছে ফেলা");
    if (lockCheck.locked) return { error: lockCheck.error };
  }

  const { data: oldExam } = await supabase
    .from("exams")
    .select("id, title, year, start_date, status")
    .eq("id", examId)
    .maybeSingle();

  const { error } = await supabase.from("exams").delete().eq("id", examId);

  if (error) {
    console.error("Error deleting exam:", error);
    return { error: error.message };
  }

  if (finalMadrasaId) {
    try {
      const meta = await getMadrasaMetadata(finalMadrasaId);
      if (meta.exam_end_dates && meta.exam_end_dates[examId]) {
        delete meta.exam_end_dates[examId];
        await saveMadrasaMetadata(finalMadrasaId, meta);
      }
    } catch (metaErr) {
      console.error("Error cleaning exam metadata:", metaErr);
    }
  }

  await __authz.logAudit({
    action: "EXAM_DELETED",
    entityType: "exam",
    entityId: examId,
    entityLabel: oldExam ? `${oldExam.title} (${oldExam.year})` : examId,
    summary: `পরীক্ষা "${oldExam?.title || examId}" মুছে ফেলা হয়েছে।`,
    oldValue: oldExam || null,
    severity: "CRITICAL",
  });

  revalidatePath("/dashboard/exams");
  return { success: true };
}

export async function getStudentsByClass(classId: string) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return [];

  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return [];

  const { data, error } = await supabase
    .from("students")
    .select("*")
    .eq("madrasa_id", finalMadrasaId)
    .eq("class_id", classId)
    .order("roll_number", { ascending: true });

  let rawStudents = data || [];
  if (error || rawStudents.length === 0) {
    try {
      const adminClient = await createAdminClient();
      const { data: adminData } = await adminClient
        .from("students")
        .select("*")
        .eq("madrasa_id", finalMadrasaId)
        .eq("class_id", classId)
        .order("roll_number", { ascending: true });
      if (adminData && adminData.length > 0) {
        rawStudents = adminData;
      }
    } catch (e) {
      console.warn("Could not query admin client in getStudentsByClass:", e);
    }
  }

  try {
    const meta = await getMadrasaMetadata(finalMadrasaId);
    const hydratedList = rawStudents.map((std: any) => {
      const hydrated: any = hydrateStudentWithMetadata(std, meta);
      const profile: any = meta?.student_profiles?.[std.id];
      const guardianPhone = 
        profile?.parent_phone || 
        profile?.guardian_phone || 
        profile?.emergency_contact || 
        hydrated?.parent_phone || 
        hydrated?.guardian_phone || 
        hydrated?.emergency_contact || 
        std.parent_phone || 
        std.guardian_phone || 
        std.emergency_contact || 
        hydrated?.phone || 
        std.phone || 
        "";
      const photoUrl = profile?.photo_url || hydrated?.photo_url || std.photo_url || "";
      return {
        ...hydrated,
        parent_phone: guardianPhone,
        guardian_phone: guardianPhone,
        phone: guardianPhone,
        photo_url: photoUrl
      };
    });
    return sortStudentsByRoll(hydratedList);
  } catch (e) {
    return sortStudentsByRoll(rawStudents);
  }
}

export async function getExamResults(examId: string, classId: string, subjectName: string) {
  const supabase = await createClient();
  
  // Get all students of the class
  const students = await getStudentsByClass(classId);
  if (!students.length) return [];

  // Get marks for these students
  const { data: results, error } = await supabase
    .from("exam_results")
    .select("*")
    .eq("exam_id", examId)
    .eq("subject_name", subjectName)
    .in("student_id", students.map(s => s.id));

  const marksMap = new Map();
  results?.forEach(r => {
    marksMap.set(r.student_id, { marks: r.marks_obtained, total: r.total_marks });
  });

  return students.map(s => ({
    ...s,
    marks_obtained: marksMap.get(s.id)?.marks || '',
    total_marks: marksMap.get(s.id)?.total || 100
  }));
}

export async function saveExamMarks(examId: string, subjectName: string, marksData: { student_id: string, marks_obtained: number, total_marks: number }[]) {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  const __authz = await writeGuard("exams");
  if (!__authz.allowed) return __authz.fallback;

  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return { error: "Unauthorized" };

  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return { error: "Madrasa not found" };

  // 1.3 Granular Exam Marks Freeze Guard
  const lockCheck = await assertExamUnlocked(finalMadrasaId, examId, "পরীক্ষার নম্বর এন্ট্রি বা পরিবর্তন");
  if (lockCheck.locked) return { error: lockCheck.error };

  // Snapshot existing marks before upsert so we can track exact changes in system_audit_logs
  const studentIds = marksData.map((m) => m.student_id);
  const { data: prevRows } = await supabase
    .from("exam_results")
    .select("student_id, marks_obtained, total_marks")
    .eq("exam_id", examId)
    .eq("subject_name", subjectName)
    .in("student_id", studentIds);

  const prevMap = new Map<string, { marks_obtained: number; total_marks: number }>();
  (prevRows || []).forEach((r: any) => {
    prevMap.set(r.student_id, {
      marks_obtained: Number(r.marks_obtained),
      total_marks: Number(r.total_marks),
    });
  });

  const recordsToUpsert = marksData.map(record => ({
    madrasa_id: finalMadrasaId,
    exam_id: examId,
    student_id: record.student_id,
    subject_name: subjectName,
    marks_obtained: record.marks_obtained,
    total_marks: record.total_marks
  }));

  const { error } = await supabase
    .from("exam_results")
    .upsert(recordsToUpsert, { onConflict: 'exam_id, student_id, subject_name' });

  if (error) {
    console.error("Error saving marks:", error);
    return { error: error.message };
  }

  // Build compact changed-marks diff for immutable audit trail
  const changedEntries = marksData
    .map((m) => {
      const prev = prevMap.get(m.student_id);
      if (!prev) {
        return {
          student_id: m.student_id,
          before: null,
          after: { marks_obtained: m.marks_obtained, total_marks: m.total_marks },
        };
      }
      if (prev.marks_obtained !== m.marks_obtained || prev.total_marks !== m.total_marks) {
        return {
          student_id: m.student_id,
          before: prev,
          after: { marks_obtained: m.marks_obtained, total_marks: m.total_marks },
        };
      }
      return null;
    })
    .filter(Boolean);

  if (changedEntries.length > 0) {
    const updatedCount = changedEntries.filter((c: any) => c.before !== null).length;
    const newCount = changedEntries.length - updatedCount;
    await __authz.logAudit({
      action: updatedCount > 0 ? "EXAM_MARKS_UPDATED" : "EXAM_MARKS_ENTERED",
      entityType: "exam_marks",
      entityId: examId,
      entityLabel: `${subjectName} (${changedEntries.length} জন শিক্ষার্থী)`,
      summary: `"${subjectName}" বিষয়ের নম্বর সংরক্ষণ করা হয়েছে (নতুন: ${newCount} জন, সংশোধিত: ${updatedCount} জন)।`,
      oldValue: changedEntries.slice(0, 40).map((c: any) => ({
        student_id: c.student_id,
        ...(c.before || { marks_obtained: null }),
      })),
      newValue: changedEntries.slice(0, 40).map((c: any) => ({
        student_id: c.student_id,
        ...c.after,
      })),
      metadata: { subject_name: subjectName, total_changed: changedEntries.length },
      severity: updatedCount > 0 ? "WARNING" : "INFO",
    });
  }

  revalidatePath(`/dashboard/exams/${examId}/marks`);
  return { success: true };
}

export async function getStudentReportCard(examId: string, classId?: string) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return [];

  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return [];
  
  let studentsQuery = supabase
    .from("students")
    .select("id, first_name, last_name, roll_number, class_id, classes(name)")
    .eq("madrasa_id", finalMadrasaId);
    
  if (classId) {
    studentsQuery = studentsQuery.eq("class_id", classId);
  }
  
  const { data: students, error: studentsError } = await studentsQuery.order('roll_number');
  
  if (studentsError || !students.length) return [];

  const [{ data: results, error: resultsError }, { data: validSubjects }, settingsBundle] = await Promise.all([
    supabase
      .from("exam_results")
      .select("*")
      .eq("exam_id", examId)
      .in("student_id", students.map(s => s.id)),
    supabase
      .from("exam_subjects")
      .select("*")
      .eq("exam_id", examId),
    getExamSettingsBundle(finalMadrasaId, examId),
  ]);
    
  if (resultsError) return [];

  // Evaluation rules, grading config, and per-subject compulsory settings (from structured exam_settings with fallback)
  const gradingConfig = settingsBundle.gradingConfig;
  const examRules = settingsBundle.evaluationRules || {};
  const failPolicy = examRules?.fail_policy || "compulsory_subject_fail"; // "compulsory_subject_fail" | "any_subject_fail" | "percentage_only"
  const compulsoryMeta = settingsBundle.compulsorySubjects || {};
  const gradeRules = gradingConfig.rules;
  const minPassPct = getMinPassPercentage(gradeRules);
  const failRule = getFailRule(gradeRules);

  // If highest marks scope is "exam" and a specific class was requested,
  // we also fetch all results of this exam to compute the true exam-wide highest marks per subject.
  let allExamResults = results || [];
  if (classId && gradingConfig.highestMarksScope === "exam") {
    try {
      const { data: examWideResults } = await supabase
        .from("exam_results")
        .select("subject_name, marks_obtained, class_id")
        .eq("exam_id", examId);
      if (examWideResults && examWideResults.length > 0) {
        allExamResults = examWideResults;
      }
    } catch (e) {
      console.warn("Could not fetch exam-wide results for highest marks:", e);
    }
  }

  // Pre-calculate highest marks per subject
  // Key: subject_name or `${class_id}:${subject_name}`
  const highestMarksMap = new Map<string, number>();
  (allExamResults || []).forEach((r: any) => {
    if (!r.subject_name || r.marks_obtained === null || r.marks_obtained === undefined) return;
    const obtained = Number(r.marks_obtained) || 0;
    
    // Exam-wide highest
    const currentExamMax = highestMarksMap.get(`exam:${r.subject_name}`) || 0;
    if (obtained > currentExamMax) {
      highestMarksMap.set(`exam:${r.subject_name}`, obtained);
    }

    // Class-wide highest (using r.class_id or matching student's class_id)
    const rClassId = r.class_id || students.find(s => s.id === r.student_id)?.class_id;
    if (rClassId) {
      const classKey = `class:${rClassId}:${r.subject_name}`;
      const currentClassMax = highestMarksMap.get(classKey) || 0;
      if (obtained > currentClassMax) {
        highestMarksMap.set(classKey, obtained);
      }
    }
  });

  // Group students by class to resolve complete subject lists
  const classSubjectMap = new Map<string, { subject_name: string; total_marks: number; pass_marks: number; is_compulsory: boolean; exam_type: string }[]>();

  // 1. Populate from exam_subjects setup
  (validSubjects || []).forEach((vs: any) => {
    if (!classSubjectMap.has(vs.class_id)) {
      classSubjectMap.set(vs.class_id, []);
    }
    const isComp = compulsoryMeta[`${vs.class_id}:${vs.subject_name}`] !== undefined 
      ? Boolean(compulsoryMeta[`${vs.class_id}:${vs.subject_name}`])
      : (vs.is_compulsory !== undefined ? Boolean(vs.is_compulsory) : true); // default compulsory

    classSubjectMap.get(vs.class_id)!.push({
      subject_name: vs.subject_name,
      total_marks: Number(vs.total_marks) || 100,
      pass_marks: Number(vs.pass_marks) || 33,
      is_compulsory: isComp,
      exam_type: vs.exam_type || "Written"
    });
  });

  // 2. Fallback: if a class has no exam_subjects setup, discover all distinct subjects from entered results
  students.forEach(student => {
    if (!classSubjectMap.has(student.class_id) || classSubjectMap.get(student.class_id)!.length === 0) {
      const studentClassResults = (results || []).filter(r => {
        const studentRecord = students.find(s => s.id === r.student_id);
        return studentRecord?.class_id === student.class_id;
      });
      const uniqueSubjects = new Map<string, { total_marks: number }>();
      studentClassResults.forEach(r => {
        if (r.subject_name) {
          uniqueSubjects.set(r.subject_name, {
            total_marks: Number(r.total_marks) || 100
          });
        }
      });
      const fallbackList: any[] = [];
      uniqueSubjects.forEach((val, subName) => {
        const isComp = compulsoryMeta[`${student.class_id}:${subName}`] !== undefined 
          ? Boolean(compulsoryMeta[`${student.class_id}:${subName}`])
          : true;
        fallbackList.push({
          subject_name: subName,
          total_marks: val.total_marks,
          pass_marks: 33,
          is_compulsory: isComp,
          exam_type: "Written"
        });
      });
      if (fallbackList.length > 0) {
        classSubjectMap.set(student.class_id, fallbackList);
      }
    }
  });

  // Group results by student ensuring EVERY class subject is present
  const studentResults = students.map(student => {
    const classSubjects = classSubjectMap.get(student.class_id) || [];
    
    // Construct complete subject-wise marks
    const studentMarks = classSubjects.map(subDef => {
      const existingResult = (results || []).find(r => r.student_id === student.id && r.subject_name === subDef.subject_name);
      const hasEntered = existingResult !== undefined && existingResult.marks_obtained !== null && existingResult.marks_obtained !== undefined;
      
      const marksObtained = hasEntered ? Number(existingResult.marks_obtained) : 0;
      const totalMarks = Number(existingResult?.total_marks || subDef.total_marks || 100);
      const passMarks = Number(subDef.pass_marks || 33);
      // Unentered marks do not count as failed
      const isFailed = hasEntered ? (marksObtained < passMarks) : false;

      // Subject percentage & grade
      const subPct = totalMarks > 0 ? (marksObtained / totalMarks) * 100 : 0;
      const subRule = hasEntered ? resolveGradeRule(subPct, gradeRules, isFailed) : null;
      const subGrade = subRule ? subRule.label : "-";
      const subGpa = subRule ? subRule.gpa : 0;

      // Highest marks for this subject
      const classKey = `class:${student.class_id}:${subDef.subject_name}`;
      const examKey = `exam:${subDef.subject_name}`;
      const highestMarks = gradingConfig.highestMarksScope === "exam"
        ? (highestMarksMap.get(examKey) ?? marksObtained)
        : (highestMarksMap.get(classKey) ?? marksObtained);

      return {
        id: existingResult?.id || `fallback_${student.id}_${subDef.subject_name}`,
        exam_id: examId,
        student_id: student.id,
        subject_name: subDef.subject_name,
        marks_obtained: hasEntered ? marksObtained : 0,
        total_marks: totalMarks,
        pass_marks: passMarks,
        is_compulsory: subDef.is_compulsory,
        is_failed: isFailed,
        has_entered_marks: hasEntered,
        exam_type: subDef.exam_type,
        highest_marks: highestMarks,
        grade: subGrade,
        gpa: subGpa,
        percentage: subPct
      };
    });
    
    const enteredMarksCount = studentMarks.filter(m => m.has_entered_marks).length;
    const totalObtained = studentMarks.reduce((sum, r) => sum + Number(r.marks_obtained || 0), 0);
    const totalMax = studentMarks.reduce((sum, r) => sum + Number(r.total_marks || 100), 0);
    const percentage = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;
    
    // Compulsory vs Optional Subjects
    const compulsorySubjects = studentMarks.filter(m => m.is_compulsory !== false);
    const optionalSubjects = studentMarks.filter(m => m.is_compulsory === false);

    const failedCompulsorySubjects = studentMarks.filter(m => m.is_compulsory !== false && m.is_failed && m.has_entered_marks);
    const failedAllSubjects = studentMarks.filter(m => m.is_failed && m.has_entered_marks);

    let isOverallFailed = false;
    let failReason = "";

    if (enteredMarksCount === 0) {
      isOverallFailed = false;
      failReason = "";
    } else {
      if (failPolicy === "any_subject_fail" && failedAllSubjects.length > 0) {
        isOverallFailed = true;
        failReason = `${failedAllSubjects.length}টি বিষয়ে অকৃতকার্য`;
      } else if (failPolicy === "percentage_only") {
        isOverallFailed = percentage < minPassPct;
        failReason = isOverallFailed ? `নম্বর শতকরা ${minPassPct}% এর কম` : "";
      } else {
        // Default "compulsory_subject_fail"
        if (failedCompulsorySubjects.length > 0) {
          isOverallFailed = true;
          failReason = `আবশ্যক বিষয়ে অকৃতকার্য (${failedCompulsorySubjects.map(s => s.subject_name).join(", ")})`;
        } else if (percentage < minPassPct) {
          isOverallFailed = true;
          failReason = `নম্বর শতকরা ${minPassPct}% এর কম`;
        }
      }
    }

    let calculatedGrade = "N/A";
    let calculatedGpa = "N/A";

    if (enteredMarksCount > 0) {
      if (isOverallFailed) {
        calculatedGrade = failRule.label;
        calculatedGpa = "০.০০";
      } else if (gradingConfig.calculationMode === "average_percentage") {
        // 'গড় মোড': মোট শতকরা থেকে সরাসরি বিভাগ নির্ধারণ
        calculatedGrade = resolveGradeRule(percentage, gradeRules, false).label;
        const matchingRule = resolveGradeRule(percentage, gradeRules, false);
        calculatedGpa = matchingRule.gpa.toFixed(2);
      } else {
        // 'বিষয়ভিত্তিক GPA মোড': প্রতিটি বিষয়ের GPA পয়েন্ট যোগ করে গড় থেকে বিভাগ নির্ধারণ
        const compulsoryGpaSum = compulsorySubjects.reduce((sum, m) => sum + resolveSubjectGpa(m, gradeRules), 0);
        const optionalGpaBonus = optionalSubjects.reduce((sum, m) => sum + Math.max(0, resolveSubjectGpa(m, gradeRules) - 2.0), 0);
        const totalGpaPoints = compulsoryGpaSum + optionalGpaBonus;

        const mainCount = compulsorySubjects.length > 0 ? compulsorySubjects.length : studentMarks.length;
        const rawGpa = mainCount > 0 ? Math.min(5.0, totalGpaPoints / mainCount) : 0;
        calculatedGpa = rawGpa.toFixed(2);
        calculatedGrade = resolveGradeFromGpa(rawGpa, gradeRules, false).label;
      }
    }

    return {
      ...student,
      class_name: Array.isArray(student.classes) ? student.classes[0]?.name : (student.classes as any)?.name,
      marks: studentMarks,
      totalObtained,
      totalMax,
      percentage: percentage.toFixed(2),
      grade: calculatedGrade,
      gpa: calculatedGpa,
      grading_mode: gradingConfig.calculationMode,
      highest_marks_scope: gradingConfig.highestMarksScope,
      is_failed: isOverallFailed,
      fail_reason: failReason,
      failed_compulsory_count: failedCompulsorySubjects.length,
      failed_total_count: failedAllSubjects.length
    };
  });

  return studentResults;
}

export async function getExamGradingConfig(explicitMadrasaId?: string): Promise<ExamGradingConfig> {
  try {
    let madrasaId = explicitMadrasaId || "";
    if (!madrasaId) {
      const supabase = await createClient();
      const user = await getAuthUser(supabase);
      madrasaId = user ? await getAuthMadrasaId(supabase, user) : "";
    }
    if (!madrasaId) return DEFAULT_GRADING_CONFIG;
    return await getStructuredExamGradingConfig(madrasaId);
  } catch (err) {
    console.warn("getExamGradingConfig error:", err);
    return DEFAULT_GRADING_CONFIG;
  }
}

export async function saveExamGradingConfig(config: ExamGradingConfig): Promise<{
  success?: boolean;
  config?: ExamGradingConfig;
  error?: string;
}> {
  const __authz = await writeGuard("exams");
  if (!__authz.allowed) return __authz.fallback as any;

  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const madrasaId = user ? await getAuthMadrasaId(supabase, user) : "";
    if (!madrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি।" };

    if (!Array.isArray(config.rules) || config.rules.length < 2) {
      return { error: "কমপক্ষে ২টি গ্রেড ধাপ (পাস ও ফেল) থাকতে হবে।" };
    }

    const oldConfig = await getStructuredExamGradingConfig(madrasaId);
    const saveRes = await saveStructuredExamGradingConfig(madrasaId, config, user?.id || null);
    if (!saveRes.ok) {
      return { error: "গ্রেড সেটিংস সংরক্ষণ করতে সমস্যা হয়েছে।" };
    }

    await __authz.logAudit({
      action: "EXAM_GRADING_CONFIG_UPDATED",
      entityType: "exam_settings",
      entityId: "grading_config",
      entityLabel: "পরীক্ষা গ্রেডিং স্কেল ও ক্যালকুলেশন মোড",
      summary: `গ্রেডিং কনফিগারেশন আপডেট করা হয়েছে (মোড: ${saveRes.config.calculationMode}, সর্বোচ্চ নম্বর স্কোপ: ${saveRes.config.highestMarksScope})।`,
      oldValue: oldConfig,
      newValue: saveRes.config,
      metadata: { storage: saveRes.storage },
      severity: "WARNING",
    });

    revalidatePath("/dashboard/exams");
    revalidatePath("/dashboard/exams/grading");
    revalidatePath("/portal/exams");
    revalidatePath("/teacher-portal/exams");

    return { success: true, config: saveRes.config };
  } catch (err: any) {
    console.error("saveExamGradingConfig error:", err);
    return { error: err?.message || "গ্রেড সেটিংস সংরক্ষণে ত্রুটি হয়েছে।" };
  }
}

export async function getExamGradeScale(explicitMadrasaId?: string): Promise<GradeRule[]> {
  try {
    const config = await getExamGradingConfig(explicitMadrasaId);
    return config.rules;
  } catch (err) {
    console.warn("getExamGradeScale error:", err);
    return DEFAULT_GRADE_RULES;
  }
}

export async function saveExamGradeScale(rules: GradeRule[]): Promise<{
  success?: boolean;
  rules?: GradeRule[];
  error?: string;
}> {
  const existingConfig = await getExamGradingConfig();
  const res = await saveExamGradingConfig({
    ...existingConfig,
    rules
  });
  if (res.error) return { error: res.error };
  return { success: true, rules: res.config?.rules };
}

export async function getAllExamSubjects(examId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exam_subjects")
    .select("*")
    .eq("exam_id", examId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching all exam subjects:", error);
    return [];
  }
  return data || [];
}

export async function getExamSubjects(examId: string, classId: string) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  const finalMadrasaId = user ? await getAuthMadrasaId(supabase, user) : null;

  const [{ data, error }, compSetting, madrasaMeta] = await Promise.all([
    supabase
      .from("exam_subjects")
      .select("*")
      .eq("exam_id", examId)
      .eq("class_id", classId)
      .order("created_at", { ascending: true }),
    finalMadrasaId
      ? getStructuredExamSetting<Record<string, boolean>>(finalMadrasaId, examId, "compulsory_subjects")
      : Promise.resolve({ found: false, value: null, source: "fallback" as const }),
    finalMadrasaId ? getMadrasaMetadata(finalMadrasaId) : Promise.resolve({} as MadrasaMetaWithSessions)
  ]);

  if (error) {
    console.error("Error fetching exam subjects:", error);
    return [];
  }

  const compulsoryMeta: Record<string, boolean> =
    (compSetting.found && compSetting.value) ||
    madrasaMeta?.exam_compulsory_subjects?.[examId] ||
    {};

  return (data || []).map((sub: any) => {
    const isComp = compulsoryMeta[`${classId}:${sub.subject_name}`] !== undefined
      ? Boolean(compulsoryMeta[`${classId}:${sub.subject_name}`])
      : (sub.is_compulsory !== undefined ? Boolean(sub.is_compulsory) : true);

    return {
      ...sub,
      is_compulsory: isComp
    };
  });
}

export async function getExamEvaluationSettings(examId: string) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return { fail_policy: "compulsory_subject_fail" };
  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return { fail_policy: "compulsory_subject_fail" };

  const sqlSetting = await getStructuredExamSetting<{ fail_policy: string }>(
    finalMadrasaId,
    examId,
    "evaluation_rules"
  );
  if (sqlSetting.found && sqlSetting.value) {
    return sqlSetting.value;
  }

  const madrasaMeta = await getMadrasaMetadata(finalMadrasaId);
  return madrasaMeta?.exam_evaluation_rules?.[examId] || { fail_policy: "compulsory_subject_fail" };
}

export async function saveExamEvaluationSettings(examId: string, settings: { fail_policy: string }) {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  const __authz = await writeGuard("exams");
  if (!__authz.allowed) return __authz.fallback;

  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return { error: "Unauthorized" };
  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return { error: "Madrasa not found" };

  const lockCheck = await assertExamUnlocked(finalMadrasaId, examId, "পরীক্ষার মূল্যায়ন নীতিমালা পরিবর্তন");
  if (lockCheck.locked) return { error: lockCheck.error };

  const prevRule = await getExamEvaluationSettings(examId);
  const nextRule = {
    ...prevRule,
    ...settings,
    updated_at: new Date().toISOString(),
  };

  // Write to structured exam_settings table first
  const sqlSaved = await saveStructuredExamSetting(
    finalMadrasaId,
    examId,
    "evaluation_rules",
    nextRule,
    user.id
  );

  if (!sqlSaved.ok) {
    const madrasaMeta = await getMadrasaMetadata(finalMadrasaId);
    const examRules = madrasaMeta.exam_evaluation_rules || {};
    examRules[examId] = nextRule;
    const saveRes = await saveMadrasaMetadata(finalMadrasaId, {
      ...madrasaMeta,
      exam_evaluation_rules: examRules,
    });
    if (!saveRes) {
      return { error: "Failed to save evaluation settings" };
    }
  }

  await __authz.logAudit({
    action: "EXAM_EVALUATION_RULE_UPDATED",
    entityType: "exam_settings",
    entityId: examId,
    entityLabel: `মূল্যায়ন নীতি (${settings.fail_policy})`,
    summary: `পরীক্ষার মূল্যায়ন/ফেল নীতিমালা পরিবর্তন করা হয়েছে।`,
    oldValue: prevRule,
    newValue: nextRule,
    metadata: { storage: sqlSaved.storage },
    severity: "INFO",
  });

  revalidatePath(`/dashboard/exams/${examId}`);
  return { success: true };
}

export async function saveExamSubjects(examId: string, classId: string, subjectsData: any[], failPolicy?: string) {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  const __authz = await writeGuard("exams");
  if (!__authz.allowed) return __authz.fallback;

  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return { error: "Unauthorized" };
  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return { error: "Madrasa not found" };

  const lockCheck = await assertExamUnlocked(finalMadrasaId, examId, "পরীক্ষার বিষয় ও পূর্ণমান পরিবর্তন");
  if (lockCheck.locked) return { error: lockCheck.error };

  // Delete existing records for this class & exam
  await supabase
    .from("exam_subjects")
    .delete()
    .eq("exam_id", examId)
    .eq("class_id", classId);

  const recordsToInsert = subjectsData.map(record => ({
    madrasa_id: finalMadrasaId,
    exam_id: examId,
    class_id: classId,
    subject_name: record.subject_name,
    total_marks: Number(record.total_marks) || 100,
    pass_marks: Number(record.pass_marks) || 33,
    exam_type: record.exam_type || "Written"
  }));

  if (recordsToInsert.length > 0) {
    const { error } = await supabase
      .from("exam_subjects")
      .insert(recordsToInsert);

    if (error) {
      console.error("Error saving exam subjects:", error);
      return { error: error.message };
    }
  }

  // Persist compulsory flags & fail policy to structured exam_settings first, with fallback
  const existingComp = await getStructuredExamSetting<Record<string, boolean>>(
    finalMadrasaId,
    examId,
    "compulsory_subjects"
  );
  const madrasaMeta = await getMadrasaMetadata(finalMadrasaId);
  const currentExamCompulsory: Record<string, boolean> = {
    ...(madrasaMeta.exam_compulsory_subjects?.[examId] || {}),
    ...(existingComp.value || {}),
  };

  subjectsData.forEach(sub => {
    currentExamCompulsory[`${classId}:${sub.subject_name}`] = sub.is_compulsory !== false;
  });

  const compSqlRes = await saveStructuredExamSetting(
    finalMadrasaId,
    examId,
    "compulsory_subjects",
    currentExamCompulsory,
    user.id
  );

  let ruleSqlOk = true;
  if (failPolicy) {
    const nextRule = {
      ...(madrasaMeta.exam_evaluation_rules?.[examId] || {}),
      fail_policy: failPolicy,
      updated_at: new Date().toISOString(),
    };
    const rRes = await saveStructuredExamSetting(
      finalMadrasaId,
      examId,
      "evaluation_rules",
      nextRule,
      user.id
    );
    ruleSqlOk = rRes.ok;
  }

  if (!compSqlRes.ok || !ruleSqlOk) {
    const compulsoryMeta = madrasaMeta.exam_compulsory_subjects || {};
    compulsoryMeta[examId] = currentExamCompulsory;
    const examRules = madrasaMeta.exam_evaluation_rules || {};
    if (failPolicy) {
      examRules[examId] = {
        ...(examRules[examId] || {}),
        fail_policy: failPolicy,
        updated_at: new Date().toISOString(),
      };
    }
    await saveMadrasaMetadata(finalMadrasaId, {
      ...madrasaMeta,
      exam_compulsory_subjects: compulsoryMeta,
      exam_evaluation_rules: examRules,
    });
  }

  await __authz.logAudit({
    action: "EXAM_SUBJECTS_CONFIGURED",
    entityType: "exam_subjects",
    entityId: `${examId}:${classId}`,
    entityLabel: `${recordsToInsert.length} টি বিষয় কনফিগার করা হয়েছে`,
    summary: `পরীক্ষার শ্রেণিভিত্তিক বিষয় তালিকা (${recordsToInsert.length} টি বিষয়) সংরক্ষণ করা হয়েছে।`,
    newValue: {
      class_id: classId,
      fail_policy: failPolicy || null,
      subjects: recordsToInsert.map((r) => ({
        subject_name: r.subject_name,
        total_marks: r.total_marks,
        pass_marks: r.pass_marks,
      })),
    },
    severity: "INFO",
  });

  revalidatePath(`/dashboard/exams/${examId}/setup`);
  revalidatePath(`/dashboard/exams/${examId}/results`);
  revalidatePath(`/dashboard/exams/${examId}/merit-list`);
  revalidatePath(`/dashboard/exams/${examId}/report-cards`);
  return { success: true };
}

