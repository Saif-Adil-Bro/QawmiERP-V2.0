"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { getAuthMadrasaId } from "./students";
import { getMadrasaMetadata } from "@/lib/sessions";
import {
  Syllabus,
  DailyClassRecord,
  SyllabusProgressEngine,
  getDefaultSyllabuses,
  SyllabusTopic,
  ClassType,
  CancellationReason,
  StudentEvaluation,
  AcademicWorkingDayCalculator,
} from "@/lib/syllabus";
import {
  getMadrasaSyllabuses,
  saveMadrasaSyllabuses,
  getMadrasaDailyClasses,
  saveMadrasaDailyClasses,
} from "@/lib/syllabus-server";

/**
 * Resolves the authenticated user and target madrasa ID
 */
async function resolveContext() {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) throw new Error("Unauthorized");

  const madrasaId = await getAuthMadrasaId(supabase, user);
  if (!madrasaId) throw new Error("Madrasa not found");

  return { supabase, user, madrasaId };
}

/**
 * Fetches all necessary intelligence and operational data for Syllabus Intelligence
 */
export async function getSyllabusDashboardData(overrideTeacherId?: string) {
  try {
    const { supabase, user, madrasaId } = await resolveContext();
    const admin = await createAdminClient();

    // 1. Fetch metadata and auxiliary tables concurrently
    const [
      meta,
      { data: classes },
      { data: subjects },
      { data: teachers },
      { data: routines },
      { data: madrasa },
    ] = await Promise.all([
      getMadrasaMetadata(madrasaId),
      admin.from("classes").select("id, name").order("name"),
      admin.from("subjects").select("id, name, code").order("name"),
      admin.from("teachers").select("id, first_name, last_name, phone"),
      admin.from("routines").select("*, classes(name), subjects(name), teachers(first_name, last_name)"),
      admin.from("madrasas").select("id, name, address, phone").eq("id", madrasaId).maybeSingle(),
    ]);

    const madrasaName = madrasa?.name || "কওমি মাদরাসা";
    const madrasaAddress = madrasa?.address || "";

    const activeHolidays = (meta.academic_holidays || []).filter((h) => !h.is_archived);

    // 2. Fetch syllabuses; if empty, initialize default Qawmi templates
    let syllabuses: Syllabus[] = (meta as any)?.syllabuses || [];
    if (syllabuses.length === 0) {
      syllabuses = getDefaultSyllabuses(
        madrasaId,
        classes || [],
        subjects || [],
        teachers || []
      );
      await saveMadrasaSyllabuses(madrasaId, syllabuses);
    }

    // 3. Daily class records
    const dailyClasses: DailyClassRecord[] = (meta as any)?.daily_classes || [];

    // Filter by teacher if requested (e.g. teacher portal)
    const targetTeacherId = overrideTeacherId;
    const filteredSyllabuses = targetTeacherId
      ? syllabuses.filter((s) => s.teacher_id === targetTeacherId)
      : syllabuses;

    // 4. Compute intelligence metrics for all relevant syllabuses
    const todayStr = AcademicWorkingDayCalculator.formatDate(new Date());
    const allMetrics = (filteredSyllabuses.length > 0 ? filteredSyllabuses : syllabuses).map((s) =>
      SyllabusProgressEngine.calculateMetrics(s, dailyClasses, activeHolidays, routines || [], todayStr)
    );

    // 5. Aggregate KPIs
    const totalSyllabuses = allMetrics.length;
    let totalTopics = 0;
    let completedTopics = 0;
    let remainingTopics = 0;
    let onTrackCount = 0;
    let atRiskCount = 0;
    let behindCount = 0;
    let completedCount = 0;
    let totalProgressSum = 0;

    allMetrics.forEach((m) => {
      totalTopics += m.total_topics;
      completedTopics += m.completed_topics;
      remainingTopics += m.remaining_topics;
      totalProgressSum += m.actual_progress_percentage;

      if (m.status === "COMPLETED") completedCount++;
      else if (m.status === "ON_TRACK") onTrackCount++;
      else if (m.status === "AT_RISK") atRiskCount++;
      else if (m.status === "BEHIND") behindCount++;
    });

    const overallProgress = totalSyllabuses > 0 ? Math.round(totalProgressSum / totalSyllabuses) : 0;

    // 6. Today's Academic Activity Breakdown
    // Day of week in English
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const todayDayName = dayNames[new Date().getDay()];

    const todayScheduledRoutines = (routines || []).filter(
      (r) => String(r.day_of_week).toLowerCase() === todayDayName.toLowerCase()
    );

    const todayDailyRecords = dailyClasses.filter((d) => d.date === todayStr);

    let todayNewLessonsCount = 0;
    let todayRevisionsCount = 0;
    let todayAssessmentsCount = 0;
    let todayCancelledCount = 0;

    todayDailyRecords.forEach((d) => {
      if (d.class_type === "NEW_LESSON" || d.class_type === "NEW_AND_REVISION") todayNewLessonsCount++;
      if (d.class_type === "REVISION" || d.class_type === "NEW_AND_REVISION") todayRevisionsCount++;
      if (d.class_type === "ASSESSMENT") todayAssessmentsCount++;
      if (d.class_type === "NO_ACADEMIC_CLASS") todayCancelledCount++;
    });

    // Unrecorded scheduled classes
    const unrecordedScheduledClasses = todayScheduledRoutines.filter((routine) => {
      const hasRecord = todayDailyRecords.some(
        (rec) =>
          rec.class_id === routine.class_id &&
          (rec.subject_id === routine.subject_id ||
            (rec.subject_name && routine.subjects?.name && rec.subject_name.trim() === routine.subjects.name.trim()))
      );
      return !hasRecord;
    });

    // Common working days remaining (using first syllabus or default)
    const primaryMetrics = allMetrics[0] || null;
    const remainingWorkingDays = primaryMetrics ? primaryMetrics.remaining_working_days : 0;

    return {
      success: true,
      data: {
        overallProgress,
        onTrackCount,
        atRiskCount,
        behindCount,
        completedCount,
        totalTopics,
        completedTopics,
        remainingTopics,
        remainingWorkingDays,
        allMetrics,
        syllabuses: filteredSyllabuses,
        allSyllabuses: syllabuses,
        dailyClasses,
        todayActivity: {
          todayStr,
          todayDayName,
          totalScheduled: todayScheduledRoutines.length,
          totalRecorded: todayDailyRecords.length,
          newLessons: todayNewLessonsCount,
          revisions: todayRevisionsCount,
          assessments: todayAssessmentsCount,
          cancelled: todayCancelledCount,
          unrecorded: unrecordedScheduledClasses,
        },
        classes: classes || [],
        subjects: subjects || [],
        teachers: teachers || [],
        routines: routines || [],
        holidays: activeHolidays,
        currentUser: user,
        madrasaName: madrasaName,
        madrasaAddress: madrasaAddress,
        madrasa: madrasa || null,
      },
    };
  } catch (err: any) {
    console.error("Error in getSyllabusDashboardData:", err);
    return { success: false, error: err.message || "Failed to load syllabus dashboard data" };
  }
}

/**
 * Fetches all syllabuses or filtered by class for auto-sync dropdowns
 */
export async function getSyllabusesForClassAction(classId?: string) {
  try {
    const { madrasaId } = await resolveContext();
    const syllabuses = await getMadrasaSyllabuses(madrasaId);
    const filtered = classId ? syllabuses.filter((s) => s.class_id === classId) : syllabuses;
    return { success: true, syllabuses: filtered };
  } catch (err: any) {
    console.error("Error in getSyllabusesForClassAction:", err);
    return { success: false, error: err.message || "Failed to fetch syllabuses", syllabuses: [] };
  }
}

/**
 * Saves a new Syllabus or updates an existing one (Full CRUD)
 */
export async function saveSyllabusAction(syllabusData: Partial<Syllabus>) {
  try {
    const { madrasaId } = await resolveContext();
    const syllabuses = await getMadrasaSyllabuses(madrasaId);

    const now = new Date().toISOString();

    if (syllabusData.id) {
      // Update existing
      const index = syllabuses.findIndex((s) => s.id === syllabusData.id);
      if (index === -1) {
        return { success: false, error: "সিলেবাস খুঁজে পাওয়া যায়নি।" };
      }

      syllabuses[index] = {
        ...syllabuses[index],
        ...syllabusData,
        updated_at: now,
      } as Syllabus;
    } else {
      // Create new
      const newSyllabus: Syllabus = {
        id: `syl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        madrasa_id: madrasaId,
        class_id: syllabusData.class_id || "",
        class_name: syllabusData.class_name || "",
        subject_id: syllabusData.subject_id || "",
        subject_name: syllabusData.subject_name || "",
        book_name: syllabusData.book_name || syllabusData.subject_name || "",
        total_pages: Number(syllabusData.total_pages) || 0,
        start_page: Number(syllabusData.start_page) || 1,
        end_page: Number(syllabusData.end_page) || Number(syllabusData.total_pages) || 0,
        current_page: Number(syllabusData.current_page) || Number(syllabusData.start_page) || 1,
        planned_daily_pages: Number(syllabusData.planned_daily_pages) || 0,
        planned_daily_topics: Number(syllabusData.planned_daily_topics) || 0,
        teacher_id: syllabusData.teacher_id,
        teacher_name: syllabusData.teacher_name,
        session_id: syllabusData.session_id,
        academic_year: syllabusData.academic_year || "১৪৪৭-৪৮ হিজরি",
        start_date: syllabusData.start_date || "2026-04-15",
        end_date: syllabusData.end_date || "2027-04-05",
        chapters: syllabusData.chapters || [],
        revision_interval_days: syllabusData.revision_interval_days || 7,
        status: "ACTIVE",
        created_at: now,
        updated_at: now,
      };
      syllabuses.unshift(newSyllabus);
    }

    await saveMadrasaSyllabuses(madrasaId, syllabuses);

    revalidatePath("/dashboard/academic/syllabus");
    revalidatePath("/teacher-portal/syllabus");

    return { success: true, message: "সিলেবাস সফলভাবে সংরক্ষিত হয়েছে।" };
  } catch (err: any) {
    console.error("Error in saveSyllabusAction:", err);
    return { success: false, error: err.message || "সিলেবাস সংরক্ষণ ব্যর্থ হয়েছে।" };
  }
}

/**
 * Deletes a syllabus by ID
 */
export async function deleteSyllabusAction(syllabusId: string) {
  try {
    const { madrasaId } = await resolveContext();
    const syllabuses = await getMadrasaSyllabuses(madrasaId);

    const filtered = syllabuses.filter((s) => s.id !== syllabusId);
    await saveMadrasaSyllabuses(madrasaId, filtered);

    revalidatePath("/dashboard/academic/syllabus");
    revalidatePath("/teacher-portal/syllabus");

    return { success: true, message: "সিলেবাস মুছে ফেলা হয়েছে।" };
  } catch (err: any) {
    console.error("Error in deleteSyllabusAction:", err);
    return { success: false, error: err.message || "সিলেবাস মোছা ব্যর্থ হয়েছে।" };
  }
}

/**
 * -------------------------------------------------------------
 * DAILY CLASS RECORDING & AUTOMATIC SYLLABUS LINKING
 * -------------------------------------------------------------
 * 1. Links Daily Class with Syllabus Topics.
 * 2. If New Lesson: updates topic progress up to 100%, marks Completed.
 * 3. If Revision: DOES NOT double count or increase %; increments revisionCount and appends to revisionHistory.
 * 4. Links with existing Attendance/Hajira to track present vs absent student learning.
 * 5. Updates existing kitab_logs for full continuity across the platform.
 */
export async function recordDailyClassAction(payload: {
  record_id?: string;
  syllabus_id?: string;
  date: string; // YYYY-MM-DD
  class_id: string;
  class_name: string;
  subject_id: string;
  subject_name: string;
  teacher_id?: string;
  teacher_name?: string;
  class_type: ClassType;
  cancellation_reason?: CancellationReason;
  cancellation_notes?: string;
  chapter_id?: string;
  chapter_name?: string;
  new_topic_ids?: string[];
  new_topic_names?: string[];
  new_topic_progress?: Record<string, number>; // topicId -> new % (e.g. 50, 100)
  revision_topic_ids?: string[];
  revision_topic_names?: string[];
  page_from?: string;
  page_to?: string;
  notes?: string;
  student_evaluations?: StudentEvaluation[];
}) {
  try {
    const { madrasaId, user } = await resolveContext();
    const admin = await createAdminClient();

    const now = new Date().toISOString();
    const syllabuses = await getMadrasaSyllabuses(madrasaId);
    const dailyClasses = await getMadrasaDailyClasses(madrasaId);

    // 1. Pull existing Attendance for this class on this date to connect real hajira
    const { data: attendanceRows } = await admin
      .from("attendance")
      .select("student_id, status, students(id, first_name, last_name, roll_number)")
      .eq("date", payload.date);

    // Also fetch students of this class to determine attendance summary accurately
    const { data: classStudents } = await admin
      .from("students")
      .select("id, first_name, last_name, roll_number")
      .eq("class_id", payload.class_id);

    const totalStudentsCount = classStudents?.length || 0;
    const presentStudents: any[] = [];
    const absentStudents: any[] = [];
    let leaveCount = 0;

    (classStudents || []).forEach((st) => {
      const att = attendanceRows?.find((a) => a.student_id === st.id);
      if (att?.status === "Present") {
        presentStudents.push(st);
      } else if (att?.status === "Leave") {
        leaveCount++;
      } else if (att?.status === "Absent") {
        absentStudents.push({
          id: st.id,
          name: `${st.first_name || ""} ${st.last_name || ""}`.trim() || `রোল ${st.roll_number}`,
          roll: st.roll_number,
        });
      } else {
        // If no explicit attendance recorded today, default to present for daily class engagement
        presentStudents.push(st);
      }
    });

    const attendanceSummary = {
      total: totalStudentsCount,
      present: presentStudents.length,
      absent: absentStudents.length,
      leave: leaveCount,
      absent_students: absentStudents,
    };

    // 2. Find target syllabus
    let targetSyllabus = syllabuses.find(
      (s) =>
        s.id === payload.syllabus_id ||
        (s.class_id === payload.class_id &&
          (s.subject_id === payload.subject_id ||
            (s.subject_name && payload.subject_name && s.subject_name.trim() === payload.subject_name.trim())))
    );

    // 3. Update Syllabus Topics if academic teaching occurred
    if (
      targetSyllabus &&
      payload.class_type !== "NO_ACADEMIC_CLASS"
    ) {
      // (A) NEW LESSON TOPICS: Update progress percentage & completion
      const newTopicIds = payload.new_topic_ids || [];
      const newProgressMap = payload.new_topic_progress || {};

      for (const ch of targetSyllabus.chapters || []) {
        for (const topic of ch.topics || []) {
          // Check if this topic was taught as a new lesson
          if (newTopicIds.includes(topic.id)) {
            const requestedProgress = newProgressMap[topic.id] !== undefined ? newProgressMap[topic.id] : 100;
            topic.progress_percentage = Math.max(topic.progress_percentage || 0, requestedProgress);

            if (topic.progress_percentage >= 100) {
              topic.status = "COMPLETED";
              if (!topic.initial_completed_date) {
                topic.initial_completed_date = payload.date;
                topic.initial_completed_by_teacher_id = payload.teacher_id;
                topic.initial_completed_by_teacher_name = payload.teacher_name;
              }
            } else if (topic.progress_percentage > 0) {
              topic.status = "IN_PROGRESS";
            }

            // Track absent students who missed this new lesson
            if (absentStudents.length > 0) {
              if (!topic.absent_followup) topic.absent_followup = [];
              absentStudents.forEach((abs) => {
                const alreadyRecorded = topic.absent_followup?.some(
                  (f) => f.student_id === abs.id && f.missed_date === payload.date
                );
                if (!alreadyRecorded) {
                  topic.absent_followup?.push({
                    student_id: abs.id,
                    student_name: abs.name,
                    roll_number: abs.roll,
                    missed_date: payload.date,
                    is_makeup_done: false,
                  });
                }
              });
            }
          }

          // (B) REVISION TOPICS: DO NOT increase completion percentage!
          // Increment revision_count & add to revision_history
          const revisionTopicIds = payload.revision_topic_ids || [];
          if (revisionTopicIds.includes(topic.id)) {
            topic.revision_count = (topic.revision_count || 0) + 1;
            topic.last_revised_date = payload.date;

            if (!topic.revision_history) topic.revision_history = [];
            topic.revision_history.unshift({
              id: `rev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              date: payload.date,
              teacher_id: payload.teacher_id,
              teacher_name: payload.teacher_name,
              class_type: payload.class_type,
              notes: payload.notes || "দৈনিক দরস রিভিশন",
              student_evaluations: payload.student_evaluations,
            });
          }
        }
      }

      // Update current_page if page_to is provided in lesson entry
      if (payload.page_to) {
        const pageToNum = parseInt(String(payload.page_to).replace(/[^0-9]/g, ""), 10);
        if (!isNaN(pageToNum) && pageToNum > 0) {
          targetSyllabus.current_page = Math.max(targetSyllabus.current_page || 0, pageToNum);
        }
      }

      targetSyllabus.updated_at = now;
      await saveMadrasaSyllabuses(madrasaId, syllabuses);
    }

    // 4. Save DailyClassRecord
    const newRecord: DailyClassRecord = {
      id: payload.record_id || `dc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      madrasa_id: madrasaId,
      syllabus_id: targetSyllabus?.id || payload.syllabus_id,
      date: payload.date,
      class_id: payload.class_id,
      class_name: payload.class_name,
      subject_id: payload.subject_id,
      subject_name: payload.subject_name,
      teacher_id: payload.teacher_id,
      teacher_name: payload.teacher_name,
      class_type: payload.class_type,
      cancellation_reason: payload.cancellation_reason,
      cancellation_notes: payload.cancellation_notes,
      chapter_id: payload.chapter_id,
      chapter_name: payload.chapter_name,
      new_topic_ids: payload.new_topic_ids || [],
      new_topic_names: payload.new_topic_names || [],
      new_topic_progress: payload.new_topic_progress,
      revision_topic_ids: payload.revision_topic_ids || [],
      revision_topic_names: payload.revision_topic_names || [],
      page_from: payload.page_from,
      page_to: payload.page_to,
      notes: payload.notes,
      student_attendance_summary: attendanceSummary,
      student_evaluations: payload.student_evaluations,
      created_at: now,
      updated_at: now,
    };

    if (payload.record_id) {
      const idx = dailyClasses.findIndex((d) => d.id === payload.record_id);
      if (idx !== -1) dailyClasses[idx] = newRecord;
      else dailyClasses.unshift(newRecord);
    } else {
      dailyClasses.unshift(newRecord);
    }

    await saveMadrasaDailyClasses(madrasaId, dailyClasses);

    // 5. Direct Link with existing kitab_logs for continuous backward compatibility
    if (classStudents && classStudents.length > 0 && payload.class_type !== "NO_ACADEMIC_CLASS") {
      const topicsText = [
        ...(payload.new_topic_names || []).map((t) => `নতুন: ${t}`),
        ...(payload.revision_topic_names || []).map((t) => `রিভিশন: ${t}`),
      ].join(", ");

      const kitabName = payload.subject_name || "কিতাবাত ও দরস";

      for (const student of classStudents) {
        const studentEval = payload.student_evaluations?.find((e) => e.student_id === student.id);
        const rating = studentEval ? studentEval.rating : "Good";

        const logRecord = {
          madrasa_id: madrasaId,
          student_id: student.id,
          teacher_id: payload.teacher_id || null,
          log_date: payload.date,
          kitab_name: kitabName,
          page_from: payload.page_from || null,
          page_to: payload.page_to || null,
          performance_rating: rating,
          notes: topicsText || payload.notes || "দৈনিক পাঠ সম্পন্ন",
        };

        const { data: existing } = await admin
          .from("kitab_logs")
          .select("id")
          .eq("student_id", student.id)
          .eq("log_date", payload.date)
          .eq("kitab_name", kitabName)
          .maybeSingle();

        if (existing?.id) {
          await admin.from("kitab_logs").update(logRecord).eq("id", existing.id);
        } else {
          await admin.from("kitab_logs").insert([logRecord]);
        }
      }
    }

    revalidatePath("/dashboard/academic/syllabus");
    revalidatePath("/teacher-portal/syllabus");
    revalidatePath("/dashboard/kitab");
    revalidatePath("/teacher-portal/kitab");

    return {
      success: true,
      message: "দৈনিক ক্লাস ও সিলেবাস অগ্রগতি সফলভাবে সংরক্ষিত হয়েছে!",
      record: newRecord,
    };
  } catch (err: any) {
    console.error("Error in recordDailyClassAction:", err);
    return { success: false, error: err.message || "দৈনিক ক্লাস রেকর্ড ব্যর্থ হয়েছে।" };
  }
}

/**
 * Marks absent student makeup done
 */
export async function markStudentMakeupDoneAction(
  syllabusId: string,
  topicId: string,
  studentId: string
) {
  try {
    const { madrasaId } = await resolveContext();
    const syllabuses = await getMadrasaSyllabuses(madrasaId);

    const sIndex = syllabuses.findIndex((s) => s.id === syllabusId);
    if (sIndex === -1) return { success: false, error: "সিলেবাস পাওয়া যায়নি" };

    const targetSyllabus = syllabuses[sIndex];
    let found = false;

    for (const ch of targetSyllabus.chapters || []) {
      for (const t of ch.topics || []) {
        if (t.id === topicId && t.absent_followup) {
          const fIndex = t.absent_followup.findIndex((f) => f.student_id === studentId);
          if (fIndex !== -1) {
            t.absent_followup[fIndex].is_makeup_done = true;
            t.absent_followup[fIndex].makeup_date = AcademicWorkingDayCalculator.formatDate(new Date());
            found = true;
          }
        }
      }
    }

    if (!found) return { success: false, error: "রেকর্ড পাওয়া যায়নি" };

    targetSyllabus.updated_at = new Date().toISOString();
    await saveMadrasaSyllabuses(madrasaId, syllabuses);

    revalidatePath("/dashboard/academic/syllabus");
    revalidatePath("/teacher-portal/syllabus");

    return { success: true, message: "মেকআপ পাঠ সফলভাবে সম্পন্ন হিসেবে চিহ্নিত করা হয়েছে।" };
  } catch (err: any) {
    return { success: false, error: err.message || "ব্যর্থ হয়েছে" };
  }
}

/**
 * Updates syllabus revision interval setting
 */
export async function updateSyllabusSettingsAction(
  syllabusId: string,
  revisionIntervalDays: number
) {
  try {
    const { madrasaId } = await resolveContext();
    const syllabuses = await getMadrasaSyllabuses(madrasaId);

    const target = syllabuses.find((s) => s.id === syllabusId);
    if (!target) return { success: false, error: "সিলেবাস পাওয়া যায়নি" };

    target.revision_interval_days = revisionIntervalDays;
    target.updated_at = new Date().toISOString();

    await saveMadrasaSyllabuses(madrasaId, syllabuses);

    revalidatePath("/dashboard/academic/syllabus");
    revalidatePath("/teacher-portal/syllabus");

    return { success: true, message: "রিভিশন ইন্টারভাল সফলভাবে আপডেট হয়েছে।" };
  } catch (err: any) {
    return { success: false, error: err.message || "আপডেট ব্যর্থ হয়েছে" };
  }
}

/**
 * Deletes a daily class record
 */
export async function deleteDailyClassRecordAction(recordId: string) {
  try {
    const { madrasaId } = await resolveContext();
    const dailyClasses = await getMadrasaDailyClasses(madrasaId);

    const filtered = dailyClasses.filter((d) => d.id !== recordId);
    await saveMadrasaDailyClasses(madrasaId, filtered);

    revalidatePath("/dashboard/academic/syllabus");
    revalidatePath("/teacher-portal/syllabus");

    return { success: true, message: "ক্লাস রেকর্ড মুছে ফেলা হয়েছে।" };
  } catch (err: any) {
    return { success: false, error: err.message || "রেকর্ড মোছা ব্যর্থ হয়েছে" };
  }
}
