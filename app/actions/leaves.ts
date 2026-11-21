"use server";

import {webIdentity,hasRole,webTeacher,linkedStudents,teacherStudents} from '@/lib/portal/identity';
import {validDate,studentRoles,isLeaveFeedback} from '@/lib/portal/rules';
import { toDhakaDateStringFrom, toDhakaDateString } from "@/lib/date-utils";
import { writeGuard } from "@/lib/action-authorization";
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
function validLeaveRange(start:string,end:string) {return validDate(start) && validDate(end) && start<=end && calculateDays(start,end)<=180;}
async function syncApprovedAttendance(db:any,tenant:string,kind:'student'|'teacher',person:string,request:string,status:string,start:string,end:string) {
  const table=kind==='student'?'attendance':'teacher_attendance', key=`${kind}_id`;
  // Never remove a holiday, an independent request or a manually posted mark.
  let clean=db.from(table).delete().eq('madrasa_id',tenant).eq(key,person).eq('leave_request_id',request).eq('status','Leave');
  if(status==='APPROVED') clean=clean.or(`date.lt.${start},date.gt.${end}`);
  const {error}=await clean; if(error) throw new Error(error.message);
  const dates=calculateDatesInRange(start,end).filter(date=>date<=toDhakaDateString());
  if(status==='APPROVED' && dates.length){
    const records=dates.map(date=>({madrasa_id:tenant,[key]:person,date,status:'Leave',leave_request_id:request}));
    const {error}=await db.from(table).upsert(records,{onConflict:`${key},date`,ignoreDuplicates:true});if(error) throw new Error(error.message);
  }
}

export async function getAllLeaveData() {
  if (!(await writeGuard('leaves')).allowed || await webTeacher()) return {error:'ছুটির তালিকা দেখার অনুমতি নেই।'};
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
    const allParentFeedbacks: ParentFeedbackItem[] = await getParentFeedbacks({leaveOnly:true});
    const existingFeedbackIds = new Set(studentLeaves.map((sl) => sl.feedback_id).filter(Boolean));

    // Filter feedback entries that are leave applications
    const leaveFeedbacks = allParentFeedbacks.filter(isLeaveFeedback);

    leaveFeedbacks.forEach((fb: ParentFeedbackItem) => {
      if (!existingFeedbackIds.has(fb.id)) {
        let startDate = fb.preferred_date || (fb.created_at ? toDhakaDateStringFrom(fb.created_at) : toDhakaDateString());
        let endDate = startDate;
        const reasonText = fb.description || "";

        // Parse date pattern like "মেয়াদ: 2026-09-01 হতে 2026-09-03" or "2026-09-01 হতে 2026-09-03" or "2026-09-01 to 2026-09-03"
        const dateMatch = fb.description?.match(/(\d{4}-\d{2}-\d{2})\s*(?:হতে|থেকে|-|to)\s*(\d{4}-\d{2}-\d{2})/i);
        if (dateMatch) {
          startDate = dateMatch[1];
          endDate = dateMatch[2];
        }

        const matchedStudent=fb.student_id ? studentsMap.get(fb.student_id) : undefined;
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
        .select("id, first_name, last_name, designation, phone").eq("madrasa_id",madrasaId)
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
    const i=await webIdentity(); if(!i) return {error:'অনুমতি নেই।'};
    if (!payload.reason?.trim() || !validLeaveRange(payload.startDate,payload.endDate)) return {error:'ছুটির কারণ ও তারিখ যাচাই করুন।'};
    const teacher=await webTeacher();
    const source=hasRole(i,studentRoles) ? 'PORTAL' : teacher ? 'TEACHER' : 'ADMIN';
    if(source==='ADMIN' && !(await writeGuard('leaves')).allowed) return {error:'অনুমতি নেই।'};
    const madrasaId=i.tenant;
    const student=source==='PORTAL' ? (await linkedStudents(i,payload.studentId)).child : teacher ? (await teacherStudents(i,teacher.scope)).find(s=>s.id===payload.studentId) : (await i.db.from('students').select('*').eq('madrasa_id',madrasaId).eq('id',payload.studentId).maybeSingle()).data;
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
      if (fbRes?.error) return {error:fbRes.error};
      if (fbRes?.id) {
        syncedFeedbackId = fbRes.id;
      }
    } catch (fbErr) {
      throw fbErr;
    }

    if (!syncedFeedbackId) return {error:'আবেদন সংরক্ষিত হয়নি।'};
    const newApp: StudentLeaveApplication = {
      id: `portal_fb_${syncedFeedbackId}`,
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
      source,
    };

    // The feedback ID is the pending application's single persisted identity. On review
    // it gets a canonical decision linked by this same ID; do not double-write on submit.
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
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("leaves");
    if (!__authz.allowed) return __authz.fallback;
    if (await webTeacher()) return {error:'প্রশাসনিক অনুমতি প্রয়োজন।'};
  }

  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অনুমতি নেই।" };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি।" };

    const { data: teacher } = await supabase
      .from("teachers")
      .select("id, first_name, last_name, designation, phone")
      .eq("madrasa_id",madrasaId).eq("id", payload.teacherId)
      .single();

    if (!teacher || !validLeaveRange(payload.startDate,payload.endDate)) return {error:'শিক্ষক বা তারিখ সঠিক নয়।'};
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

    if (!await saveMadrasaMetadata(madrasaId, meta)) return {error:'পরিবর্তন সংরক্ষিত হয়নি।'};

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
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("leaves");
    if (!__authz.allowed) return __authz.fallback;
    if (await webTeacher()) return {error:'প্রশাসনিক অনুমতি প্রয়োজন।'};
  }

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
      const allParentFeedbacks = await getParentFeedbacks({leaveOnly:true});
      const fb = allParentFeedbacks.find((f) => f.id === fbId);
      if (fb && isLeaveFeedback(fb)) {
        let sd = fb.preferred_date || (fb.created_at ? toDhakaDateStringFrom(fb.created_at) : toDhakaDateString());
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
    if (!['APPROVED','REJECTED'].includes(payload.status) || !validLeaveRange(effectiveStartDate,effectiveEndDate)) return {error:'সিদ্ধান্ত বা তারিখ সঠিক নয়।'};
    const effectiveTotalDays = calculateDays(effectiveStartDate, effectiveEndDate);
    const nowStr = new Date().toISOString();

    if(!app.student_id || !(await adminClient.from('students').select('id').eq('madrasa_id',madrasaId).eq('id',app.student_id).maybeSingle()).data) return {error:'শিক্ষার্থী সংযুক্ত নেই।'};
    app.status = payload.status;
    app.approved_start_date = effectiveStartDate;
    app.approved_end_date = effectiveEndDate;
    app.approved_total_days = effectiveTotalDays;
    app.admin_remarks = payload.adminRemarks ?? app.admin_remarks ?? "";
    app.reviewed_by = user.email || "অ্যাডমিন";
    app.reviewed_at = nowStr;

    applications[appIndex] = app;
    meta.student_leave_applications = applications;
    if (!await saveMadrasaMetadata(madrasaId, meta)) return {error:'পরিবর্তন সংরক্ষিত হয়নি।'};

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

    await syncApprovedAttendance(adminClient,madrasaId,'student',app.student_id,app.id,payload.status,effectiveStartDate,effectiveEndDate);

    revalidatePath("/dashboard/attendance");
    revalidatePath("/dashboard/attendance/leaves");
    revalidatePath("/dashboard/attendance/students");
    revalidatePath("/dashboard/communication/feedback");
    revalidatePath("/portal/leave");

    return {
      success: true,
      application: app,
      message: payload.status === "APPROVED"
        ? `ছুটি সফলভাবে অনুমোদন করা হয়েছে ।`
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
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("leaves");
    if (!__authz.allowed) return __authz.fallback;
    if (await webTeacher()) return {error:'প্রশাসনিক অনুমতি প্রয়োজন।'};
  }

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
    if (!['APPROVED','REJECTED'].includes(payload.status) || !validLeaveRange(effectiveStartDate,effectiveEndDate)) return {error:'সিদ্ধান্ত বা তারিখ সঠিক নয়।'};
    const effectiveTotalDays = calculateDays(effectiveStartDate, effectiveEndDate);
    const nowStr = new Date().toISOString();

    if(!app.teacher_id || !(await adminClient.from('teachers').select('id').eq('madrasa_id',madrasaId).eq('id',app.teacher_id).maybeSingle()).data) return {error:'শিক্ষক সংযুক্ত নেই।'};
    app.status = payload.status;
    app.approved_start_date = effectiveStartDate;
    app.approved_end_date = effectiveEndDate;
    app.approved_total_days = effectiveTotalDays;
    app.admin_remarks = payload.adminRemarks ?? app.admin_remarks ?? "";
    app.reviewed_by = user.email || "অ্যাডমিন";
    app.reviewed_at = nowStr;

    applications[appIndex] = app;
    meta.teacher_leave_applications = applications;
    if (!await saveMadrasaMetadata(madrasaId, meta)) return {error:'পরিবর্তন সংরক্ষিত হয়নি।'};

    await syncApprovedAttendance(adminClient,madrasaId,'teacher',app.teacher_id,app.id,payload.status,effectiveStartDate,effectiveEndDate);

    revalidatePath("/dashboard/attendance");
    revalidatePath("/dashboard/attendance/leaves");
    revalidatePath("/dashboard/attendance/teachers");

    return {
      success: true,
      application: app,
      message: payload.status === "APPROVED"
        ? `শিক্ষকের ছুটি সফলভাবে অনুমোদন করা হয়েছে ।`
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
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("leaves");
    if (!__authz.allowed) return __authz.fallback;
    if (await webTeacher()) return {error:'প্রশাসনিক অনুমতি প্রয়োজন।'};
  }

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
      if (!await saveMadrasaMetadata(madrasaId, meta)) return {error:'পরিবর্তন সংরক্ষিত হয়নি।'};

      const targetFeedbackId =
        itemToDelete?.feedback_id || (requestId.startsWith("portal_fb_") ? requestId.replace("portal_fb_", "") : undefined);
      if (targetFeedbackId) {
        try {
          const adminClient = await createAdminClient();
          await adminClient.from("fee_audit_logs").delete().eq("madrasa_id",madrasaId).like("action","PARENT_FEEDBACK%").eq("id", targetFeedbackId);
        } catch (delLogErr) {
          console.warn("Could not delete from fee_audit_logs:", delLogErr);
        }
      }
    } else {
      let list: TeacherLeaveApplication[] = meta.teacher_leave_applications || [];
      meta.teacher_leave_applications = list.filter((a: TeacherLeaveApplication) => a.id !== requestId);
      if (!await saveMadrasaMetadata(madrasaId, meta)) return {error:'পরিবর্তন সংরক্ষিত হয়নি।'};
    }

    revalidatePath("/dashboard/attendance/leaves");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "আবেদনটি মুছে ফেলতে সমস্যা হয়েছে।" };
  }
}
