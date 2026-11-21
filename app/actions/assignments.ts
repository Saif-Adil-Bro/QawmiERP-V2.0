"use server";
import { realAssignments, studentHomework, studentRoles } from '@/lib/portal/rules';
import { webIdentity, hasRole, webTeacher, teacherStudents } from '@/lib/portal/identity';
import { getPortalStudentData } from '@/lib/portal-data';

import { toDhakaDateString } from "@/lib/date-utils";
import { writeGuard } from "@/lib/action-authorization";
import { revalidatePath } from "next/cache";
import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { getAuthMadrasaId, getClasses } from "@/app/actions/students";
import { getMadrasaMetadata, saveMadrasaMetadata } from "@/lib/sessions";
import { toBanglaNumber } from "@/lib/numberToBangla";
import {
  AssignmentItem,
  AssignmentType,
  AssignmentTargetType,
  ASSIGNMENT_TYPE_MAP,
} from "@/lib/assignmentTypes";
import { getMadrasaSyllabuses } from "@/lib/syllabus-server";
import { recordDailyClassAction } from "@/app/actions/syllabus";

export type { AssignmentItem, AssignmentType, AssignmentTargetType };

export async function getAssignments(filters?: {
  class_id?: string;
  student_id?: string;
  type?: string;
  status?: string;
  target_type?: string;
  search?: string;
  date?: string;
}): Promise<{
  assignments: AssignmentItem[];
  classes: any[];
  teachers: any[];
  currentTeacherName: string;
}> {
  try {
    const i = await webIdentity();
    if (!i || hasRole(i,studentRoles)) return {assignments:[],classes:[],teachers:[],currentTeacherName:''};
    const teacher = await webTeacher();
    const meta = teacher?.scope.meta || await getMadrasaMetadata(i.tenant);
    const classes = teacher ? teacher.scope.classes : await getClasses();
    const teachers = teacher ? [teacher.scope.teacher].filter(Boolean) : (await i.db.from('teachers').select('id,first_name,last_name,designation').eq('madrasa_id',i.tenant)).data || [];
    const currentTeacherName = i.userRow.full_name || '';
    let list = realAssignments(meta.assignments).filter(a=> !teacher || classes.some((c:any)=>c.id===a.class_id));
    // Filter by class_id
    if (filters?.class_id && filters.class_id !== "ALL") {
      list = list.filter((item) => item.class_id === filters.class_id);
    }

    // Filter by student_id
    if (filters?.student_id && filters.student_id !== "ALL") {
      list = list.filter(
        (item) => item.target_type === "CLASS" || item.student_id === filters.student_id
      );
    }

    // Filter by type
    if (filters?.type && filters.type !== "ALL") {
      list = list.filter((item) => item.type === filters.type);
    }

    // Filter by status
    if (filters?.status && filters.status !== "ALL") {
      list = list.filter((item) => item.status === filters.status);
    }

    // Filter by target_type
    if (filters?.target_type && filters.target_type !== "ALL") {
      list = list.filter((item) => item.target_type === filters.target_type);
    }

    // Filter by date
    if (filters?.date && filters.date.trim()) {
      list = list.filter((item) => item.assigned_date === filters.date);
    }

    // Filter by search query
    if (filters?.search && filters.search.trim()) {
      const q = filters.search.toLowerCase().trim();
      list = list.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.class_name.toLowerCase().includes(q) ||
          (item.subject_name && item.subject_name.toLowerCase().includes(q)) ||
          (item.student_name && item.student_name.toLowerCase().includes(q)) ||
          item.teacher_name.toLowerCase().includes(q)
      );
    }

    // Sort: newest first
    list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return {
      assignments: list,
      classes: classes || [],
      teachers: teachers || [],
      currentTeacherName: currentTeacherName || "উস্তাদ",
    };
  } catch (err) {
    console.error("getAssignments error:", err);
    return { assignments: [], classes: [], teachers: [], currentTeacherName: "উস্তাদ" };
  }
}

/**
 * Fetch assignments specifically for a student (for Parent Portal or Student view)
 */
export async function getStudentAssignments(
  studentId: string,
  classId?: string
): Promise<AssignmentItem[]> {
  const data = await getPortalStudentData(studentId);
  return data?.child ? studentHomework(data.meta.assignments,data.child) : [];
}

/**
 * Create or update an assignment (Admin and Teacher action)
 */
export async function saveAssignment(data: {
  id?: string;
  title: string;
  type: AssignmentType;
  target_type: AssignmentTargetType;
  class_id: string;
  class_name: string;
  student_id?: string | null;
  student_name?: string | null;
  student_roll?: string | null;
  subject_name?: string;
  description: string;
  image_urls?: string[];
  assigned_date: string;
  due_date?: string | null;
  teacher_name?: string;
  status?: "ACTIVE" | "COMPLETED" | "ARCHIVED";
  kids_care?: import("@/lib/assignmentTypes").KidsCareDetails;
  // Syllabus Auto-Sync payload
  sync_to_syllabus?: boolean;
  syllabus_id?: string;
  syllabus_topic_id?: string;
  chapter_id?: string;
  selected_topic_ids?: string[];
  page_from?: string;
  page_to?: string;
  progress_type?: "NEW_LESSON" | "REVISION" | "ASSESSMENT";
}) {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("syllabus");
    if (!__authz.allowed) return __authz.fallback;
  }

  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অনুমতি নেই। লগইন করুন।" };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি।" };

    const meta = await getMadrasaMetadata(madrasaId);
    if (!meta.assignments) {
      meta.assignments = [];
    }

    const teacher = await webTeacher();
    if (teacher) {
      if (!teacher.scope.classes.some(c=>c.id===data.class_id) || (data.id && !teacher.scope.classes.some(c=>c.id===meta.assignments.find((a:any)=>a.id===data.id)?.class_id))) return {error:'জামাতটি আপনাকে বরাদ্দ করা নেই।'};
      if (data.target_type === 'STUDENT' && !(await teacherStudents(teacher.i,teacher.scope,[data.class_id])).some(s=>s.id===data.student_id)) return {error:'শিক্ষার্থী এই জামাতের নয়।'};
    }
    const { data: userData } = await supabase
      .from("users")
      .select("role, full_name")
      .eq("id", user.id)
      .single();

    const role = (userData?.role as any) || "TEACHER";
    const authorRole = ["super_admin", "admin", "muhtamim"].includes(role)
      ? "ADMIN"
      : "TEACHER";
    const authorId = teacher?.scope.teacher?.id || user.id;
    const authorName = teacher ? teacher.i.userRow.full_name :
      data.teacher_name && data.teacher_name.trim() !== ""
        ? data.teacher_name.trim()
        : userData?.full_name && userData.full_name !== "user"
        ? userData.full_name
        : "শিক্ষক";

    const typeBangla = ASSIGNMENT_TYPE_MAP[data.type] || "অ্যাসাইনমেন্ট";

    // Topic IDs handling
    const topicIds = data.selected_topic_ids || (data.syllabus_topic_id ? [data.syllabus_topic_id] : []);
    const primaryTopicId = data.syllabus_topic_id || (topicIds.length > 0 ? topicIds[0] : null);

    // Syllabus auto-sync processing
    let syllabusSynced = false;
    let syllabusBookName: string | null = null;
    let targetSyllabusId: string | null = data.syllabus_id || null;

    if (data.sync_to_syllabus) {
      try {
        const syllabuses = await getMadrasaSyllabuses(madrasaId);
        let targetSyllabus = data.syllabus_id
          ? syllabuses.find((s) => s.id === data.syllabus_id)
          : syllabuses.find(
              (s) =>
                s.class_id === data.class_id &&
                ((s.book_name && data.subject_name && s.book_name.trim().toLowerCase() === data.subject_name.trim().toLowerCase()) ||
                  (s.subject_name && data.subject_name && s.subject_name.trim().toLowerCase() === data.subject_name.trim().toLowerCase()))
            );

        if (targetSyllabus) {
          targetSyllabusId = targetSyllabus.id;
          syllabusBookName = targetSyllabus.book_name || targetSyllabus.subject_name;

          const assignedDate = data.assigned_date || toDhakaDateString();

          // Prevent Duplicate Sync: Check if updating an already synced assignment or if topic was already synced today
          const existingAssignments: AssignmentItem[] = meta.assignments || [];
          const isUpdatingExistingSynced = Boolean(data.id) && existingAssignments.some((a) => a.id === data.id && a.is_syllabus_synced);

          const alreadySynced = isUpdatingExistingSynced || existingAssignments.some((a) => {
            if (!a.is_syllabus_synced) return false;
            if (a.class_id !== data.class_id) return false;
            if (a.assigned_date !== assignedDate) return false;
            if (a.syllabus_id && a.syllabus_id === targetSyllabus.id) {
              if (primaryTopicId && (a.syllabus_topic_id === primaryTopicId || a.syllabus_topic_ids?.includes(primaryTopicId))) {
                return true;
              }
            }
            return false;
          });

          if (alreadySynced) {
            syllabusSynced = true;
          } else {
            const classType =
              data.progress_type ||
              (data.type === "EXAM_REVISION"
                ? "REVISION"
                : data.type === "MEMORIZATION"
                ? "NEW_LESSON"
                : "NEW_LESSON");

            const syncRes = await recordDailyClassAction({
              syllabus_id: targetSyllabus.id,
              date: assignedDate,
              class_id: data.class_id,
              class_name: data.class_name,
              subject_id: targetSyllabus.subject_id || "",
              subject_name: targetSyllabus.book_name || targetSyllabus.subject_name || data.subject_name || "",
              teacher_id: authorId,
              teacher_name: authorName,
              class_type: classType,
              chapter_id: data.chapter_id,
              new_topic_ids: classType !== "REVISION" ? topicIds : [],
              new_topic_progress: topicIds.reduce((acc: any, id: string) => {
                acc[id] = 100;
                return acc;
              }, {}),
              revision_topic_ids: classType === "REVISION" ? topicIds : [],
              page_from: data.page_from,
              page_to: data.page_to,
              notes: `[অ্যাসাইনমেন্ট হতে সিঙ্ক] ${data.title}${data.description ? `: ${data.description}` : ""}`,
            });

            if (syncRes && syncRes.success) {
              syllabusSynced = true;
            }
          }
        }
      } catch (syncErr) {
        console.warn("Auto-sync to syllabus warning:", syncErr);
      }
    }

    if (data.id) {
      // Update existing
      const index = meta.assignments.findIndex((a: AssignmentItem) => a.id === data.id);
      if (index === -1) return { error: "অ্যাসাইনমেন্ট পাওয়া যায়নি।" };

      const existing = meta.assignments[index];
      meta.assignments[index] = {
        ...existing,
        title: data.title,
        type: data.type,
        type_bangla: typeBangla,
        target_type: data.target_type,
        class_id: data.class_id,
        class_name: data.class_name,
        student_id: data.target_type === "STUDENT" ? data.student_id : null,
        student_name: data.target_type === "STUDENT" ? data.student_name : null,
        student_roll: data.target_type === "STUDENT" ? data.student_roll : null,
        subject_name: data.subject_name || existing.subject_name || "",
        description: data.description,
        image_urls: data.image_urls || existing.image_urls || [],
        assigned_date: data.assigned_date,
        due_date: data.due_date || null,
        teacher_name: authorName,
        status: data.status || existing.status || "ACTIVE",
        syllabus_id: targetSyllabusId || existing.syllabus_id,
        syllabus_book_name: syllabusBookName || existing.syllabus_book_name,
        syllabus_topic_id: primaryTopicId || existing.syllabus_topic_id || null,
        syllabus_topic_ids: topicIds.length > 0 ? topicIds : existing.syllabus_topic_ids || null,
        is_syllabus_synced: syllabusSynced || existing.is_syllabus_synced,
        page_from: data.page_from || existing.page_from,
        page_to: data.page_to || existing.page_to,
        kids_care: data.kids_care !== undefined ? data.kids_care : existing.kids_care,
        updated_at: new Date().toISOString(),
      };
    } else {
      // Create new
      const newAssignment: AssignmentItem = {
        id: `asg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        madrasa_id: madrasaId,
        title: data.title,
        type: data.type,
        type_bangla: typeBangla,
        target_type: data.target_type,
        class_id: data.class_id,
        class_name: data.class_name,
        student_id: data.target_type === "STUDENT" ? data.student_id : null,
        student_name: data.target_type === "STUDENT" ? data.student_name : null,
        student_roll: data.target_type === "STUDENT" ? data.student_roll : null,
        subject_name: data.subject_name || "",
        description: data.description,
        image_urls: data.image_urls || [],
        assigned_date: data.assigned_date || toDhakaDateString(),
        due_date: data.due_date || null,
        teacher_id: authorId,
        teacher_name: authorName,
        created_by_role: authorRole,
        created_at: new Date().toISOString(),
        status: "ACTIVE",
        syllabus_id: targetSyllabusId,
        syllabus_book_name: syllabusBookName,
        syllabus_topic_id: primaryTopicId,
        syllabus_topic_ids: topicIds.length > 0 ? topicIds : null,
        is_syllabus_synced: syllabusSynced,
        page_from: data.page_from || null,
        page_to: data.page_to || null,
        kids_care: data.kids_care || undefined,
      };

      meta.assignments.unshift(newAssignment);

      // Trigger automatic system notification for bell icon
      if (!meta.system_notifications) meta.system_notifications = [];
      const notifTitle = `${typeBangla}: ${data.title}`;
      const notifDesc = `${data.class_name} ${data.target_type === "STUDENT" && data.student_name ? `(${data.student_name})` : "সকল শিক্ষার্থী"} • শিক্ষক: ${authorName}`;
      meta.system_notifications.unshift({
        id: `sys-asg-${Date.now()}`,
        category: "ACADEMIC",
        title: notifTitle,
        description: notifDesc,
        timestamp: new Date().toISOString(),
        link: "/dashboard/assignments",
        status: "PENDING",
        severity: "INFO",
        sourceModule: "দৈনিক অ্যাসাইনমেন্ট",
        senderName: authorName,
      });
      if (meta.system_notifications.length > 80) {
        meta.system_notifications = meta.system_notifications.slice(0, 80);
      }
    }

    const saved = await saveMadrasaMetadata(madrasaId, meta);
    if (!saved) return { error: "ডাটা সংরক্ষণ করতে সমস্যা হয়েছে।" };

    revalidatePath("/dashboard/assignments");
    revalidatePath("/teacher-portal/assignments");
    revalidatePath("/portal/assignments");
    revalidatePath("/portal");
    revalidatePath("/dashboard/academic/syllabus");
    revalidatePath("/teacher-portal/syllabus");

    return {
      success: true,
      syllabus_synced: syllabusSynced,
      message: syllabusSynced
        ? "পড়া সফলভাবে পাঠানো হয়েছে এবং সিলেবাস প্রোগ্রেস সিঙ্ক হয়েছে!"
        : "পড়া সফলভাবে সংরক্ষিত হয়েছে।",
    };
  } catch (err: any) {
    console.error("saveAssignment error:", err);
    return { error: err.message || "অ্যাসাইনমেন্ট সংরক্ষণে সমস্যা হয়েছে।" };
  }
}

/**
 * Delete an assignment
 */
export async function deleteAssignment(id: string) {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("syllabus");
    if (!__authz.allowed) return __authz.fallback;
  }

  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অনুমতি নেই।" };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি।" };

    const meta = await getMadrasaMetadata(madrasaId);
    let list: AssignmentItem[] = meta.assignments || [];

    const teacher = await webTeacher();
    if (teacher && !teacher.scope.classes.some(c=>c.id===list.find(a=>a.id===id)?.class_id)) return {error:'অনুমতি নেই।'};
    meta.assignments = list.filter((item) => item.id !== id);
    await saveMadrasaMetadata(madrasaId, meta);

    revalidatePath("/dashboard/assignments");
    revalidatePath("/teacher-portal/assignments");
    revalidatePath("/portal/assignments");
    revalidatePath("/portal");

    return { success: true };
  } catch (err) {
    return { error: "ডিলিট করতে সমস্যা হয়েছে।" };
  }
}

/**
 * Update assignment status (e.g. COMPLETED or ARCHIVED)
 */
export async function updateAssignmentStatus(
  id: string,
  status: "ACTIVE" | "COMPLETED" | "ARCHIVED"
) {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("syllabus");
    if (!__authz.allowed) return __authz.fallback;
  }

  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অনুমতি নেই।" };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি।" };

    const meta = await getMadrasaMetadata(madrasaId);
    let list: AssignmentItem[] = meta.assignments || [];

    const teacher = await webTeacher();
    if (teacher && !teacher.scope.classes.some(c=>c.id===list.find(a=>a.id===id)?.class_id)) return {error:'অনুমতি নেই।'};
    const index = list.findIndex((item) => item.id === id);
    if (index !== -1) {
      list[index].status = status;
      list[index].updated_at = new Date().toISOString();
      await saveMadrasaMetadata(madrasaId, meta);
    }

    revalidatePath("/dashboard/assignments");
    revalidatePath("/teacher-portal/assignments");
    revalidatePath("/portal/assignments");
    revalidatePath("/portal");

    return { success: true };
  } catch (err) {
    return { error: "স্ট্যাটাস পরিবর্তন ব্যর্থ হয়েছে।" };
  }
}
