"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { getAuthMadrasaId, getStudents, getClasses } from "@/app/actions/students";
import { getMadrasaMetadata, saveMadrasaMetadata } from "@/lib/sessions";
import { getStaffMetadataFull } from "@/app/actions/staff";
import {
  getParentFeedbacks,
  updateParentFeedbackStatus,
  createParentFeedback,
  ParentFeedbackItem,
} from "@/app/actions/parent-communication";

export interface StudentLeaveApplication {
  id: string;
  madrasa_id: string;
  student_id: string;
  student_name: string;
  student_roll?: string;
  class_name?: string;
  class_id?: string;
  guardian_name?: string;
  guardian_phone?: string;
  leave_type: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  total_days: number;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "ARCHIVED";
  admin_remarks?: string;
  approved_start_date?: string;
  approved_end_date?: string;
  approved_total_days?: number;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
  source?: "PORTAL" | "ADMIN" | "TEACHER";
  feedback_id?: string;
}

export interface TeacherLeaveApplication {
  id: string;
  madrasa_id: string;
  teacher_id: string;
  teacher_name: string;
  staff_id_code?: string;
  designation?: string;
  phone?: string;
  leave_type: "CASUAL" | "SICK" | "ANNUAL" | "EMERGENCY" | "OTHER";
  leave_type_name_bn: string;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "ARCHIVED";
  admin_remarks?: string;
  approved_start_date?: string;
  approved_end_date?: string;
  approved_total_days?: number;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
  source?: "PORTAL" | "ADMIN" | "SELF";
}

/**
 * Calculates dates between startDate and endDate (inclusive, YYYY-MM-DD)
 */
function calculateDatesInRange(startDate: string, endDate: string): string[] {
  try {
    const dates: string[] = [];
    const [sy, sm, sd] = startDate.split("-").map(Number);
    const [ey, em, ed] = endDate.split("-").map(Number);
    const curr = new Date(sy, sm - 1, sd);
    const end = new Date(ey, em - 1, ed);

    let guard = 0;
    while (curr <= end && guard < 180) {
      const y = curr.getFullYear();
      const m = String(curr.getMonth() + 1).padStart(2, "0");
      const d = String(curr.getDate()).padStart(2, "0");
      dates.push(`${y}-${m}-${d}`);
      curr.setDate(curr.getDate() + 1);
      guard++;
    }
    return dates.length > 0 ? dates : [startDate];
  } catch {
    return [startDate];
  }
}

/**
 * Normalizes number of days between two dates
 */
function calculateDays(startDate: string, endDate: string): number {
  try {
    const d1 = new Date(startDate);
    const d2 = new Date(endDate);
    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return isNaN(diffDays) || diffDays < 1 ? 1 : diffDays;
  } catch {
    return 1;
  }
}

/**
 * Fetch all leave data (both student and teacher applications)
 */
export async function getAllLeaveData() {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অনুমতি নেই।" };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি।" };

    const meta = await getMadrasaMetadata(madrasaId);
    let studentLeaves: StudentLeaveApplication[] = (meta.student_leave_applications || []);
    let teacherLeaves: TeacherLeaveApplication[] = (meta.teacher_leave_applications || []);

    // Also fetch staff metadata to merge any leave_requests if not yet present
    const staffMeta = await getStaffMetadataFull();
    const existingTeacherLeaveIds = new Set(teacherLeaves.map((t) => t.id));
    const rawStaffLeaves = ((staffMeta as any)?.staff_leave_requests || (staffMeta as any)?.leave_requests || []);
    rawStaffLeaves.forEach((slr: any) => {
      if (!existingTeacherLeaveIds.has(slr.id)) {
        teacherLeaves.push({
          id: slr.id,
          madrasa_id: madrasaId,
          teacher_id: slr.staff_id,
          teacher_name: slr.staff_name,
          staff_id_code: slr.staff_id_code,
          designation: "শিক্ষক / স্টাফ",
          leave_type: slr.leave_type || "OTHER",
          leave_type_name_bn: slr.leave_type_name_bn || "ছুটি",
          start_date: slr.start_date,
          end_date: slr.end_date,
          total_days: slr.total_days || 1,
          reason: slr.reason || "",
          status: slr.status === "APPROVED" ? "APPROVED" : slr.status === "REJECTED" ? "REJECTED" : "PENDING",
          admin_remarks: slr.review_reason || "",
          reviewed_by: slr.reviewed_by,
          reviewed_at: slr.reviewed_at,
          created_at: slr.created_at || new Date().toISOString(),
          source: "SELF",
        });
      }
    });

    // Fetch authoritative student and class lists
    const [studentsData, classesData] = await Promise.all([
      getStudents(),
      getClasses(),
    ]);

    const studentsList = studentsData || [];
    const studentsMap = new Map<string, any>(studentsList.map((s: any) => [s.id, s]));

    // Fetch all feedbacks / leave requests from parent communication log
    const allParentFeedbacks: ParentFeedbackItem[] = await getParentFeedbacks();
    const existingFeedbackIds = new Set(studentLeaves.map((sl) => sl.feedback_id).filter(Boolean));

    // Filter feedback entries that are leave applications
    const leaveFeedbacks = allParentFeedbacks.filter((fb) => {
      const isLeaveCategory = fb.category === "ছুটির আবেদন";
      const isLeaveAction = fb.action_type === "GENERAL" || (fb.action_type as string) === "LEAVE_APPLICATION";
      const subjectHasLeave = Boolean(fb.subject && fb.subject.includes("ছুটি"));
      const descHasLeave = Boolean(fb.description && fb.description.includes("ছুটি"));
      return isLeaveCategory || isLeaveAction || subjectHasLeave || descHasLeave;
    });

    leaveFeedbacks.forEach((fb: ParentFeedbackItem) => {
      if (!existingFeedbackIds.has(fb.id)) {
        let startDate = fb.preferred_date || (fb.created_at ? fb.created_at.split("T")[0] : new Date().toISOString().split("T")[0]);
        let endDate = startDate;
        const reasonText = fb.description || "";

        // Parse date pattern like "মেয়াদ: 2026-09-01 হতে 2026-09-03" or "2026-09-01 হতে 2026-09-03" or "2026-09-01 to 2026-09-03"
        const dateMatch = fb.description?.match(/(\d{4}-\d{2}-\d{2})\s*(?:হতে|থেকে|-|to)\s*(\d{4}-\d{2}-\d{2})/i);
        if (dateMatch) {
          startDate = dateMatch[1];
          endDate = dateMatch[2];
        }

        // Try to match student info from student list if missing or partial
        let matchedStudent = fb.student_id ? studentsMap.get(fb.student_id) : undefined;
        if (!matchedStudent && fb.student_name) {
          matchedStudent = studentsList.find((s: any) =>
            `${s.first_name || ""} ${s.last_name || ""}`.trim().toLowerCase() === fb.student_name?.trim().toLowerCase()
          );
        }

        const resolvedStudentName =
          fb.student_name ||
          (matchedStudent ? `${matchedStudent.first_name || ""} ${matchedStudent.last_name || ""}`.trim() : "শিক্ষার্থী");

        const resolvedRoll =
          fb.student_roll ||
          (matchedStudent?.roll_number !== undefined && matchedStudent?.roll_number !== null
            ? String(matchedStudent.roll_number)
            : "");

        const resolvedClass =
          fb.class_name ||
          matchedStudent?.class_name ||
          (Array.isArray(matchedStudent?.classes)
            ? matchedStudent?.classes[0]?.name
            : matchedStudent?.classes?.name) ||
          "";

        const resolvedPhone =
          fb.guardian_phone ||
          matchedStudent?.parent_phone ||
          matchedStudent?.phone ||
          "";

        studentLeaves.push({
          id: `portal_fb_${fb.id}`,
          feedback_id: fb.id,
          madrasa_id: madrasaId,
          student_id: fb.student_id || matchedStudent?.id || "",
          student_name: resolvedStudentName,
          student_roll: resolvedRoll,
          class_name: resolvedClass,
          guardian_name: fb.guardian_name || "সম্মানিত অভিভাবক",
          guardian_phone: resolvedPhone,
          leave_type: fb.subject?.split("-")[0]?.trim() || "সাধারণ ছুটি",
          start_date: startDate,
          end_date: endDate,
          total_days: calculateDays(startDate, endDate),
          reason: reasonText,
          status: fb.status === "RESOLVED" ? "APPROVED" : fb.status === "CLOSED" ? "REJECTED" : "PENDING",
          admin_remarks: fb.official_response || "",
          reviewed_by: fb.responded_by,
          reviewed_at: fb.responded_at,
          created_at: fb.created_at || new Date().toISOString(),
          source: "PORTAL",
        });
      }
    });

    // Sort by created_at desc
    studentLeaves.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    teacherLeaves.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Prepare teacher roster
    let teachersData: any[] = [];
    if (staffMeta?.staff_members && staffMeta.staff_members.length > 0) {
      teachersData = staffMeta.staff_members.map((sm: any) => ({
        id: sm.id,
        first_name: sm.personal?.first_name || sm.first_name || "",
        last_name: sm.personal?.last_name || sm.last_name || "",
        designation: sm.designation_name || sm.designation || "শিক্ষক / স্টাফ",
        phone: sm.personal?.contact_number || sm.phone || "",
      }));
    }

    if (teachersData.length === 0) {
      const adminClient = await createAdminClient();
      const { data: rawTeachers } = await adminClient
        .from("teachers")
        .select("id, first_name, last_name, designation, phone")
        .order("first_name");
      if (rawTeachers && rawTeachers.length > 0) {
        teachersData = rawTeachers;
      }
    }

    return {
      studentLeaves,
      teacherLeaves,
      students: studentsList,
      teachers: teachersData,
      classes: classesData || [],
    };
  } catch (err: any) {
    console.error("Error in getAllLeaveData:", err);
    return { error: err.message || "ছুটির তথ্য লোড করতে সমস্যা হয়েছে।" };
  }
}

/**
 * Submit Student Leave Request (from Admin or Portal)
 */
export async function submitStudentLeaveRequest(payload: {
  studentId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
  guardianName?: string;
  guardianPhone?: string;
  source?: "PORTAL" | "ADMIN" | "TEACHER";
}) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অনুমতি নেই।" };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি।" };

    const allStudents = await getStudents();
    const student = (allStudents || []).find((s: any) => s.id === payload.studentId);

    if (!student) return { error: "শিক্ষার্থী পাওয়া যায়নি।" };

    const studentName = `${student.first_name || ""} ${student.last_name || ""}`.trim() || student.name || "শিক্ষার্থী";
    const className =
      student.class_name ||
      (Array.isArray(student.classes) ? student.classes[0]?.name : student.classes?.name) ||
      "";
    const studentRoll = student.roll_number !== undefined && student.roll_number !== null ? String(student.roll_number) : "";
    const totalDays = calculateDays(payload.startDate, payload.endDate);
    const guardianName = payload.guardianName || student.guardian_name || student.father_name || "সম্মানিত অভিভাবক";
    const guardianPhone = payload.guardianPhone || student.parent_phone || student.phone || "";

    // Also sync to parent feedback log
    let syncedFeedbackId = "";
    try {
      const fbRes = await createParentFeedback({
        action_type: "GENERAL",
        category: "ছুটির আবেদন",
        subject: `${payload.leaveType || "ছুটি"} - ছুটির আবেদন`,
        description: `ছুটির মেয়াদ: ${payload.startDate} হতে ${payload.endDate}\nকারণ: ${payload.reason}`,
        student_id: student.id,
        student_name: studentName,
        student_roll: studentRoll,
        class_name: className,
        guardian_name: guardianName,
        guardian_phone: guardianPhone,
        preferred_date: payload.startDate,
      });
      if (fbRes?.id) {
        syncedFeedbackId = fbRes.id;
      }
    } catch (fbErr) {
      console.warn("Could not sync to parent feedback log:", fbErr);
    }

    const newApp: StudentLeaveApplication = {
      id: `std_leave_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      feedback_id: syncedFeedbackId || undefined,
      madrasa_id: madrasaId,
      student_id: student.id,
      student_name: studentName,
      student_roll: studentRoll,
      class_name: className,
      guardian_name: guardianName,
      guardian_phone: guardianPhone,
      leave_type: payload.leaveType || "অসুস্থতাজনিত ছুটি",
      start_date: payload.startDate,
      end_date: payload.endDate,
      total_days: totalDays,
      reason: payload.reason,
      status: "PENDING",
      created_at: new Date().toISOString(),
      source: payload.source || "ADMIN",
    };

    const meta = await getMadrasaMetadata(madrasaId);
    if (!meta.student_leave_applications) meta.student_leave_applications = [];
    meta.student_leave_applications.unshift(newApp);

    await saveMadrasaMetadata(madrasaId, meta);

    revalidatePath("/dashboard/attendance");
    revalidatePath("/dashboard/attendance/leaves");
    revalidatePath("/dashboard/attendance/students");
    revalidatePath("/portal/leave");
    revalidatePath("/dashboard/communication/feedback");

    return { success: true, application: newApp };
  } catch (err: any) {
    console.error("Error submitting student leave:", err);
    return { error: err.message || "ছুটির আবেদন জমা দেওয়া ব্যর্থ হয়েছে।" };
  }
}

/**
 * Submit Teacher / Staff Leave Request
 */
export async function submitTeacherLeaveRequest(payload: {
  teacherId: string;
  leaveType: "CASUAL" | "SICK" | "ANNUAL" | "EMERGENCY" | "OTHER";
  leaveTypeNameBn: string;
  startDate: string;
  endDate: string;
  reason: string;
  source?: "PORTAL" | "ADMIN" | "SELF";
}) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অনুমতি নেই।" };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি।" };

    const { data: teacher } = await supabase
      .from("teachers")
      .select("id, first_name, last_name, designation, phone")
      .eq("id", payload.teacherId)
      .single();

    const teacherName = teacher ? `${teacher.first_name || ""} ${teacher.last_name || ""}`.trim() : "শিক্ষক";
    const totalDays = calculateDays(payload.startDate, payload.endDate);

    const newApp: TeacherLeaveApplication = {
      id: `tch_leave_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      madrasa_id: madrasaId,
      teacher_id: payload.teacherId,
      teacher_name: teacherName,
      designation: teacher?.designation || "শিক্ষক",
      phone: teacher?.phone || "",
      leave_type: payload.leaveType,
      leave_type_name_bn: payload.leaveTypeNameBn,
      start_date: payload.startDate,
      end_date: payload.endDate,
      total_days: totalDays,
      reason: payload.reason,
      status: "PENDING",
      created_at: new Date().toISOString(),
      source: payload.source || "ADMIN",
    };

    const meta = await getMadrasaMetadata(madrasaId);
    if (!meta.teacher_leave_applications) meta.teacher_leave_applications = [];
    meta.teacher_leave_applications.unshift(newApp);

    await saveMadrasaMetadata(madrasaId, meta);

    revalidatePath("/dashboard/attendance");
    revalidatePath("/dashboard/attendance/leaves");
    revalidatePath("/dashboard/attendance/teachers");

    return { success: true, application: newApp };
  } catch (err: any) {
    console.error("Error submitting teacher leave:", err);
    return { error: err.message || "শিক্ষকের ছুটির আবেদন জমা দেওয়া ব্যর্থ হয়েছে।" };
  }
}

/**
 * Review Student Leave Request:
 * - Admin can Approve or Disapprove / Reject
 * - Admin can change Start Date & End Date (ছুটির সময়সীমা পরিবর্তন)
 * - Admin can add Remarks / Comments (মন্তব্য যোগ)
 * - AUTOMATIC ATTENDANCE SYNC: When approved, updates `attendance` table with status 'Leave' for all dates in range!
 * - If rejected/cancelled: cleans up attendance table records!
 */
export async function reviewStudentLeaveRequest(payload: {
  requestId: string;
  status: "APPROVED" | "REJECTED";
  startDate?: string;
  endDate?: string;
  adminRemarks?: string;
}) {
  try {
    const supabase = await createClient();
    const adminClient = await createAdminClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অনুমতি নেই।" };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি।" };

    const meta = await getMadrasaMetadata(madrasaId);
    let applications: StudentLeaveApplication[] = meta.student_leave_applications || [];

    let appIndex = applications.findIndex((a) => a.id === payload.requestId);
    let app: StudentLeaveApplication | undefined;

    // Check if it was imported from feedback
    if (appIndex === -1 && payload.requestId.startsWith("portal_fb_")) {
      const fbId = payload.requestId.replace("portal_fb_", "");
      const allParentFeedbacks = await getParentFeedbacks();
      const fb = allParentFeedbacks.find((f) => f.id === fbId);
      if (fb) {
        let sd = fb.preferred_date || (fb.created_at ? fb.created_at.split("T")[0] : new Date().toISOString().split("T")[0]);
        let ed = sd;
        const dateMatch = fb.description?.match(/(\d{4}-\d{2}-\d{2})\s*(?:হতে|থেকে|-|to)\s*(\d{4}-\d{2}-\d{2})/i);
        if (dateMatch) {
          sd = dateMatch[1];
          ed = dateMatch[2];
        }

        app = {
          id: payload.requestId,
          feedback_id: fb.id,
          madrasa_id: madrasaId,
          student_id: fb.student_id || "",
          student_name: fb.student_name || "শিক্ষার্থী",
          student_roll: fb.student_roll || "",
          class_name: fb.class_name || "",
          guardian_name: fb.guardian_name || "",
          guardian_phone: fb.guardian_phone || "",
          leave_type: fb.subject?.split("-")[0]?.trim() || "ছুটির আবেদন",
          start_date: sd,
          end_date: ed,
          total_days: calculateDays(sd, ed),
          reason: fb.description || "",
          status: "PENDING",
          created_at: fb.created_at || new Date().toISOString(),
          source: "PORTAL",
        };
        applications.unshift(app);
        appIndex = 0;
      }
    } else {
      app = applications[appIndex];
    }

    if (!app) return { error: "ছুটির আবেদনটি পাওয়া যায়নি।" };

    const effectiveStartDate = payload.startDate || app.approved_start_date || app.start_date;
    const effectiveEndDate = payload.endDate || app.approved_end_date || app.end_date;
    const effectiveTotalDays = calculateDays(effectiveStartDate, effectiveEndDate);
    const nowStr = new Date().toISOString();

    app.status = payload.status;
    app.approved_start_date = effectiveStartDate;
    app.approved_end_date = effectiveEndDate;
    app.approved_total_days = effectiveTotalDays;
    app.admin_remarks = payload.adminRemarks ?? app.admin_remarks ?? "";
    app.reviewed_by = user.email || "অ্যাডমিন";
    app.reviewed_at = nowStr;

    applications[appIndex] = app;
    meta.student_leave_applications = applications;
    await saveMadrasaMetadata(madrasaId, meta);

    // Sync with linked parent feedback entry if exists
    if (app.feedback_id) {
      try {
        await updateParentFeedbackStatus({
          id: app.feedback_id,
          status: payload.status === "APPROVED" ? "RESOLVED" : "CLOSED",
          official_response:
            payload.adminRemarks ||
            (payload.status === "APPROVED"
              ? `ছুটি অনুমোদিত হয়েছে (${effectiveStartDate} হতে ${effectiveEndDate}, মোট ${effectiveTotalDays} দিন)`
              : "ছুটির আবেদনটি বাতিল করা হয়েছে।"),
          responded_by: user.email || "অ্যাডমিন",
        });
      } catch (fbSyncErr) {
        console.warn("Could not sync feedback status:", fbSyncErr);
      }
    }

    // AUTOMATIC ATTENDANCE SYNC
    if (app.student_id) {
      const datesToSync = calculateDatesInRange(effectiveStartDate, effectiveEndDate);

      if (payload.status === "APPROVED") {
        // Upsert 'Leave' status into attendance table for each day in range
        const recordsToUpsert = datesToSync.map((d) => ({
          madrasa_id: madrasaId,
          student_id: app!.student_id,
          date: d,
          status: "Leave",
        }));

        const { error: upsertErr } = await adminClient
          .from("attendance")
          .upsert(recordsToUpsert, { onConflict: "student_id, date" });

        if (upsertErr) {
          console.error("Error auto-syncing student leave attendance:", upsertErr);
        }
      } else if (payload.status === "REJECTED") {
        // If rejected, remove any auto-synced 'Leave' attendance for this student in this date range
        const { error: delErr } = await adminClient
          .from("attendance")
          .delete()
          .eq("student_id", app.student_id)
          .eq("status", "Leave")
          .in("date", datesToSync);

        if (delErr) {
          console.warn("Could not delete rejected leave attendance records:", delErr);
        }
      }
    }

    revalidatePath("/dashboard/attendance");
    revalidatePath("/dashboard/attendance/leaves");
    revalidatePath("/dashboard/attendance/students");
    revalidatePath("/dashboard/communication/feedback");
    revalidatePath("/portal/leave");

    return {
      success: true,
      application: app,
      message: payload.status === "APPROVED"
        ? `ছুটি সফলভাবে অনুমোদন করা হয়েছে এবং ${effectiveTotalDays} দিনের হাজিরা 'ছুটি (Leave)' হিসেবে সংরক্ষিত হয়েছে।`
        : "ছুটির আবেদনটি বাতিল করা হয়েছে।",
    };
  } catch (err: any) {
    console.error("Error reviewing student leave:", err);
    return { error: err.message || "ছুটি পর্যালোচনা করতে ব্যর্থ হয়েছে।" };
  }
}

/**
 * Review Teacher Leave Request:
 * - Approve or Reject
 * - Change Start Date & End Date
 * - Add Remarks
 * - AUTOMATIC ATTENDANCE SYNC: Updates `teacher_attendance` table with status 'Leave'!
 */
export async function reviewTeacherLeaveRequest(payload: {
  requestId: string;
  status: "APPROVED" | "REJECTED";
  startDate?: string;
  endDate?: string;
  adminRemarks?: string;
}) {
  try {
    const supabase = await createClient();
    const adminClient = await createAdminClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অনুমতি নেই।" };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি।" };

    const meta = await getMadrasaMetadata(madrasaId);
    let applications: TeacherLeaveApplication[] = meta.teacher_leave_applications || [];

    const appIndex = applications.findIndex((a) => a.id === payload.requestId);
    if (appIndex === -1) return { error: "শিক্ষকের ছুটির আবেদনটি পাওয়া যায়নি।" };

    const app = applications[appIndex];
    const effectiveStartDate = payload.startDate || app.approved_start_date || app.start_date;
    const effectiveEndDate = payload.endDate || app.approved_end_date || app.end_date;
    const effectiveTotalDays = calculateDays(effectiveStartDate, effectiveEndDate);
    const nowStr = new Date().toISOString();

    app.status = payload.status;
    app.approved_start_date = effectiveStartDate;
    app.approved_end_date = effectiveEndDate;
    app.approved_total_days = effectiveTotalDays;
    app.admin_remarks = payload.adminRemarks ?? app.admin_remarks ?? "";
    app.reviewed_by = user.email || "অ্যাডমিন";
    app.reviewed_at = nowStr;

    applications[appIndex] = app;
    meta.teacher_leave_applications = applications;
    await saveMadrasaMetadata(madrasaId, meta);

    // AUTOMATIC TEACHER ATTENDANCE SYNC
    if (app.teacher_id) {
      const datesToSync = calculateDatesInRange(effectiveStartDate, effectiveEndDate);

      if (payload.status === "APPROVED") {
        const recordsToUpsert = datesToSync.map((d) => ({
          madrasa_id: madrasaId,
          teacher_id: app.teacher_id,
          date: d,
          status: "Leave",
        }));

        const { error: upsertErr } = await adminClient
          .from("teacher_attendance")
          .upsert(recordsToUpsert, { onConflict: "teacher_id, date" });

        if (upsertErr) {
          console.error("Error auto-syncing teacher leave attendance:", upsertErr);
        }
      } else if (payload.status === "REJECTED") {
        await adminClient
          .from("teacher_attendance")
          .delete()
          .eq("teacher_id", app.teacher_id)
          .eq("status", "Leave")
          .in("date", datesToSync);
      }
    }

    revalidatePath("/dashboard/attendance");
    revalidatePath("/dashboard/attendance/leaves");
    revalidatePath("/dashboard/attendance/teachers");

    return {
      success: true,
      application: app,
      message: payload.status === "APPROVED"
        ? `শিক্ষকের ছুটি সফলভাবে অনুমোদন করা হয়েছে এবং ${effectiveTotalDays} দিনের হাজিরা 'ছুটি (Leave)' হিসেবে সংরক্ষিত হয়েছে।`
        : "শিক্ষকের ছুটির আবেদনটি বাতিল করা হয়েছে।",
    };
  } catch (err: any) {
    console.error("Error reviewing teacher leave:", err);
    return { error: err.message || "শিক্ষকের ছুটি পর্যালোচনা করতে ব্যর্থ হয়েছে।" };
  }
}

/**
 * Delete a leave application
 */
export async function deleteLeaveApplication(requestId: string, type: "STUDENT" | "TEACHER") {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অনুমতি নেই।" };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি।" };

    const meta = await getMadrasaMetadata(madrasaId);

    if (type === "STUDENT") {
      let list: StudentLeaveApplication[] = meta.student_leave_applications || [];
      const itemToDelete = list.find((a: StudentLeaveApplication) => a.id === requestId);
      meta.student_leave_applications = list.filter((a: StudentLeaveApplication) => a.id !== requestId);
      await saveMadrasaMetadata(madrasaId, meta);

      const targetFeedbackId =
        itemToDelete?.feedback_id || (requestId.startsWith("portal_fb_") ? requestId.replace("portal_fb_", "") : undefined);
      if (targetFeedbackId) {
        try {
          const adminClient = await createAdminClient();
          await adminClient.from("fee_audit_logs").delete().eq("id", targetFeedbackId);
        } catch (delLogErr) {
          console.warn("Could not delete from fee_audit_logs:", delLogErr);
        }
      }
    } else {
      let list: TeacherLeaveApplication[] = meta.teacher_leave_applications || [];
      meta.teacher_leave_applications = list.filter((a: TeacherLeaveApplication) => a.id !== requestId);
      await saveMadrasaMetadata(madrasaId, meta);
    }

    revalidatePath("/dashboard/attendance/leaves");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "আবেদনটি মুছে ফেলতে সমস্যা হয়েছে।" };
  }
}
