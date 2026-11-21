"use server";
import {publishExam} from '@/lib/portal/publish';
import {teacherExamData} from '@/lib/portal/teacher-entry';
import {rows} from '@/lib/portal/queries';
import {examCohort} from '@/lib/portal/cohort';
import {webTeacher,teacherStudents} from '@/lib/portal/identity';
import {rankSummaries} from '@/lib/exam-grading';
import {examReport,publicationFlags} from '@/lib/portal/exams';
import {webIdentity, hasRole, teacherScope} from '@/lib/portal/identity';
import {studentRoles,teacherRoles,published} from '@/lib/portal/rules';

import { toDhakaDateString } from "@/lib/date-utils";
import { writeGuard } from "@/lib/action-authorization";
import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getAuthMadrasaId } from "./students";
import { getMadrasaMetadata, saveMadrasaMetadata, MadrasaMetaWithSessions, hydrateStudentWithMetadata } from "@/lib/sessions";
import { submitWorkflowHookApproval } from "@/lib/approval-workflow";
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

  const publishedExams = await publicationFlags(supabase,finalMadrasaId,madrasaMeta);
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
    const isPublished = published(publishedExams,exam);
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

  if (!finalMadrasaId) return null;
  const { data, error } = await supabase
    .from("exams")
    .select("*")
    .eq("madrasa_id",finalMadrasaId)
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
  const publishedExams=await publicationFlags(supabase,madrasaId,madrasaMeta);
  const publishInfo = publishedExams[id];
  const isPublished = published(publishedExams,data);

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
    const { data: examRow,error:statusError } = await adminClient
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

export async function toggleExamPublish(examId:string,isPublished:boolean,note?:string) {
  return publishExam(examId,isPublished,note);
}

export async function getExamPublishStatus(examId: string) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { isPublished: false };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { isPublished: false };

    const exam = await getExamById(examId);
    return {isPublished:!!exam?.is_published,publishedAt:exam?.published_at || null,publishedBy:exam?.published_by || null,note:exam?.publish_note || null};
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
  const i=await webIdentity(); if (!i || hasRole(i,studentRoles)) return [];
  const t=await webTeacher(); if (t) return teacherStudents(i,t.scope,[classId]);
  if (!(await writeGuard('exams')).allowed) return [];
  const meta=await getMadrasaMetadata(i.tenant,true);
  const result=await rows(()=>i.db.from('students').select('*, classes(*)').eq('madrasa_id',i.tenant).eq('class_id',classId).order('roll_number'));
  return sortStudentsByRoll(result.map(s=>hydrateStudentWithMetadata(s,meta)));
}

export async function getExamResults(examId:string,classId:string,subjectName:string) {
  const i=await webIdentity(); if (!i || hasRole(i,[...teacherRoles,...studentRoles]) || !(await writeGuard('exams')).allowed) return [];
  const {data:exam}=await i.db.from('exams').select('*').eq('madrasa_id',i.tenant).eq('id',examId).maybeSingle(); if (!exam) return [];
  const report=await examReport(i.db,i.tenant,exam,await getMadrasaMetadata(i.tenant,true));
  return report.filter(s=>s.class_id===classId).map(s=>{
    const m=s.own.find((r:any)=>r.subject_name===subjectName);
    return {id:s.id,first_name:s.first_name,last_name:s.last_name,roll_number:s.roll_number,marks_obtained:m?.marks_obtained ?? '',total_marks:m?.total_marks ?? null,
      written_marks:m?.written_marks ?? '',oral_marks:m?.oral_marks ?? '',tutorial_marks:m?.tutorial_marks ?? '',attendance_marks:m?.attendance_marks ?? ''};
  });
}

export async function saveExamMarks(examId: string, subjectName: string, marksData: { student_id: string, marks_obtained: number, total_marks: number, written_marks?:number|null,oral_marks?:number|null,tutorial_marks?:number|null,attendance_marks?:number|null }[], classId?:string) {
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
  if (!Array.isArray(marksData) || !marksData.length || marksData.some(m=>!m || !Number.isFinite(m.marks_obtained) || !Number.isFinite(m.total_marks) || m.total_marks<=0 || m.marks_obtained<0 || m.marks_obtained>m.total_marks)) return {error:'নম্বর বা পূর্ণমান সঠিক নয়।'};
  const writer = await createAdminClient();
  const {data:ownedExam} = await writer.from('exams').select('*').eq('id',examId).eq('madrasa_id',finalMadrasaId).maybeSingle();
  if (!ownedExam || !classId || !subjectName?.trim()) return {error:'পরীক্ষা বা জামাত সঠিক নয়।'};
  const teacher = await webTeacher();
  if (teacher) {
    const roster=await teacherStudents(teacher.i,teacher.scope,[classId]);
    const entry=await teacherExamData(teacher.i,teacher.scope,ownedExam,roster,classId);
    const def=entry.subjects.find(s=>s.subject_name===subjectName);
    if (!def || marksData.some(m=>m.total_marks!==Number(def.total_marks) || !entry.students.some(s=>s.id===m.student_id))) return {error:'বরাদ্দকৃত বিষয়, শিক্ষার্থী ও পূর্ণমান ব্যবহার করুন।'};
  } else {
    const meta=await getMadrasaMetadata(finalMadrasaId,true);
    const cohort=await examCohort(writer,finalMadrasaId,ownedExam,meta);
    const students=await rows(()=>writer.from('students').select('id,class_id').eq('madrasa_id',finalMadrasaId).in('id',marksData.map(m=>m.student_id)));
    const eligible=new Set(students.filter(s=>cohort(s).class_id===classId).map(s=>s.id));
    const defs=await rows(()=>writer.from('exam_subjects').select('*').eq('madrasa_id',finalMadrasaId).eq('exam_id',examId).eq('class_id',classId),true);
    if(marksData.some(m=>!eligible.has(m.student_id) || defs.length && !defs.some(d=>d.subject_name===subjectName && Number(d.total_marks)===m.total_marks))) return {error:'পরীক্ষার জামাত, বিষয় বা পূর্ণমান মিলছে না।'};
  }
  const lockCheck = await assertExamUnlocked(finalMadrasaId, examId, "পরীক্ষার নম্বর এন্ট্রি বা পরিবর্তন");
  if (lockCheck.locked) return { error: lockCheck.error };

  // Snapshot existing marks before upsert so we can track exact changes in system_audit_logs
  const studentIds = marksData.map((m) => m.student_id);
  const { data: prevRows, error:beforeError } = await writer
    .from("exam_results")
    .select("student_id, marks_obtained, total_marks, written_marks, oral_marks, tutorial_marks, attendance_marks")
    .eq("madrasa_id",finalMadrasaId).eq("exam_id", examId)
    .eq("subject_name", subjectName)
    .in("student_id", studentIds);

  if (beforeError) return {error:beforeError.message};
  const prevMap = new Map<string, { marks_obtained: number; total_marks: number }>();
  (prevRows || []).forEach((r: any) => {
    prevMap.set(r.student_id, {
      marks_obtained: Number(r.marks_obtained),
      total_marks: Number(r.total_marks),
    });
  });

  const fields=['written_marks','oral_marks','tutorial_marks','attendance_marks'] as const;
  const previous=new Map((prevRows || []).map(m=>[m.student_id,m]));
  const recordsToUpsert = marksData.map(record => ({
    madrasa_id: finalMadrasaId,
    exam_id: examId,
    student_id: record.student_id,
    subject_name: subjectName,
    marks_obtained: record.marks_obtained,
    total_marks: record.total_marks,
    ...Object.fromEntries(fields.map(key=>[key,key in record ? record[key] : previous.get(record.student_id)?.[key] ?? null])),
  }));

  for (const record of recordsToUpsert) {
    const parts=fields.map(k=>(record as Record<string,unknown>)[k]).filter((v):v is number=>v!=null);
    if(parts.some(v=>!Number.isFinite(v) || v<0) || parts.length && Math.abs(parts.reduce((n,v)=>n+v,0)-record.marks_obtained)>0.000001) return {error:'বিভাগভিত্তিক নম্বর ও মোট নম্বর মিলছে না। বিভাগভিত্তিক ফর্মে সংশোধন করুন।'};
  }
  const { error } = await writer
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

  revalidatePath(`/dashboard/exams/${examId}`, 'layout');
  revalidatePath('/teacher-portal/exams');
  revalidatePath('/portal', 'layout');
  return { success: true };
}

export async function getStudentReportCard(examId: string, classId?: string) {
  const i = await webIdentity();
  if (!i || hasRole(i,studentRoles) || !hasRole(i,[...teacherRoles,"admin","super_admin","muhtamim","exam_manager"]) && !i.perms.summary.effectivePermissions.includes("exam.view")) return [];
  const {data:exam} = await i.db.from('exams').select('*').eq('madrasa_id',i.tenant).eq('id',examId).maybeSingle();
  if (!exam) return [];
  if (hasRole(i,teacherRoles)) return []; // This is the Admin tabulation, not the Teacher subject endpoint.
  const report=(await examReport(i.db,i.tenant,exam,await getMadrasaMetadata(i.tenant,true))).filter(s=>!classId || s.class_id===classId);
  const ranks = new Map<string,number>();
  for (const cohort of new Set(report.map(s=>s.class_id).filter(Boolean))) {
    for (const [id,rank] of rankSummaries(report.filter(s=>s.class_id===cohort)).ranks) ranks.set(id,rank);
  }
  return report.map(({own,summary,...s})=>({...s, badgeClass:summary.badgeClass, merit_position:ranks.get(s.id) ?? null}));
}

export async function getExamGradingConfig(explicitMadrasaId?: string): Promise<ExamGradingConfig> {
  try {
    const madrasaId=await getAuthMadrasaId();
    if (!madrasaId || explicitMadrasaId && madrasaId!==explicitMadrasaId) return DEFAULT_GRADING_CONFIG;
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

  if (!(await supabase.from('exams').select('id').eq('madrasa_id',finalMadrasaId).eq('id',examId).maybeSingle()).data || !(await supabase.from('classes').select('id').eq('madrasa_id',finalMadrasaId).eq('id',classId).maybeSingle()).data) return {error:'পরীক্ষা বা জামাত পাওয়া যায়নি।'};
  if (subjectsData.some(s=>!String(s.subject_name || '').trim() || !(Number(s.total_marks)>0) || Number(s.pass_marks??33)<0 || Number(s.pass_marks??33)>Number(s.total_marks))) return {error:'পূর্ণমান ও পাস নম্বর যাচাই করুন।'};
  const deletion=await supabase.from('exam_subjects').delete().eq('madrasa_id',finalMadrasaId).eq('exam_id',examId).eq('class_id',classId);
  if (deletion.error) return {error:deletion.error.message};
  const recordsToInsert = subjectsData.map(record => ({
    madrasa_id: finalMadrasaId,
    exam_id: examId,
    class_id: classId,
    subject_name: record.subject_name,
    total_marks: Number(record.total_marks) || 100,
    pass_marks: Number(record.pass_marks ?? 33),
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

