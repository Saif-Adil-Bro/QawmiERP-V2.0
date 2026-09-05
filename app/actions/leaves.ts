"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { getAuthMadrasaId } from "@/app/actions/students";
import { getMadrasaMetadata, saveMadrasaMetadata } from "@/lib/sessions";
import { getStaffMetadataFull } from "@/app/actions/staff";

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
    ((staffMeta as any)?.leave_requests || []).forEach((slr: any) => {
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

    // Also merge any leave requests submitted from portal feedback table (e.g. from parent feedback)
    const { data: feedbacks } = await supabase
      .from("feedbacks")
      .select("*")
      .or("category.eq.ছুটির আবেদন,action_type.eq.LEAVE_APPLICATION")
      .order("created_at", { ascending: false });

    const existingFeedbackIds = new Set(studentLeaves.map((sl) => sl.feedback_id).filter(Boolean));
    if (feedbacks && feedbacks.length > 0) {
      feedbacks.forEach((fb: any) => {
        if (!existingFeedbackIds.has(fb.id)) {
          // Parse start and end date from description if available
          let startDate = fb.preferred_date || new Date().toISOString().split("T")[0];
          let endDate = startDate;
          let reasonText = fb.description || "";

          // Match pattern "ছুটির মেয়াদ: YYYY-MM-DD হতে YYYY-MM-DD"
          const dateMatch = fb.description?.match(/মেয়াদ:\s*(\d{4}-\d{2}-\d{2})\s*হতে\s*(\d{4}-\d{2}-\d{2})/);
          if (dateMatch) {
            startDate = dateMatch[1];
            endDate = dateMatch[2];
          }

          studentLeaves.push({
            id: `portal_fb_${fb.id}`,
            feedback_id: fb.id,
            madrasa_id: madrasaId,
            student_id: fb.student_id || "",
            student_name: fb.student_name || "শিক্ষার্থী",
            student_roll: fb.student_roll || "",
            class_name: fb.class_name || "",
            guardian_name: fb.guardian_name || "অভিভাবক",
            guardian_phone: fb.guardian_phone || "",
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
    }

    // Sort by created_at desc
    studentLeaves.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    teacherLeaves.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Fetch student and teacher rosters for dropdowns
    const { data: studentsData } = await supabase
      .from("students")
      .select("id, first_name, last_name, roll_number, class_name, phone, parent_phone")
      .order("roll_number");

    const { data: teachersData } = await supabase
      .from("teachers")
      .select("id, first_name, last_name, designation, phone")
      .order("first_name");

    const { data: classesData } = await supabase
      .from("classes")
      .select("id, name")
      .order("name");

    return {
      studentLeaves,
      teacherLeaves,
      students: studentsData || [],
      teachers: teachersData || [],
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

    const { data: student } = await supabase
      .from("students")
      .select("id, first_name, last_name, roll_number, class_name, parent_phone, phone, classes(name)")
      .eq("id", payload.studentId)
      .single();

    if (!student) return { error: "শিক্ষার্থী পাওয়া যায়নি।" };

    const studentName = `${student.first_name || ""} ${student.last_name || ""}`.trim();
    const className = student.class_name || (Array.isArray(student.classes) ? student.classes[0]?.name : (student.classes as any)?.name) || "";
    const totalDays = calculateDays(payload.startDate, payload.endDate);

    const newApp: StudentLeaveApplication = {
      id: `std_leave_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      madrasa_id: madrasaId,
      student_id: student.id,
      student_name: studentName,
      student_roll: student.roll_number ? String(student.roll_number) : "",
      class_name: className,
      guardian_name: payload.guardianName || "সম্মানিত অভিভাবক",
      guardian_phone: payload.guardianPhone || student.parent_phone || student.phone || "",
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
      const { data: fb } = await supabase.from("feedbacks").select("*").eq("id", fbId).single();
      if (fb) {
        let sd = fb.preferred_date || new Date().toISOString().split("T")[0];
        let ed = sd;
        const dateMatch = fb.description?.match(/মেয়াদ:\s*(\d{4}-\d{2}-\d{2})\s*হতে\s*(\d{4}-\d{2}-\d{2})/);
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

    // Sync with linked feedback if exists
    if (app.feedback_id) {
      await adminClient
        .from("feedbacks")
        .update({
          status: payload.status === "APPROVED" ? "RESOLVED" : "CLOSED",
          official_response: payload.adminRemarks || (payload.status === "APPROVED" ? `ছুটি অনুমোদিত হয়েছে (${effectiveStartDate} হতে ${effectiveEndDate}, মোট ${effectiveTotalDays} দিন)` : "ছুটির আবেদনটি বাতিল করা হয়েছে।"),
          responded_by: user.email || "অ্যাডমিন",
          responded_at: nowStr,
        })
        .eq("id", app.feedback_id);
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

      if (itemToDelete?.feedback_id) {
        const adminClient = await createAdminClient();
        await adminClient.from("feedbacks").delete().eq("id", itemToDelete.feedback_id);
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
