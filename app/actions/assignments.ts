"use server";

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

export type { AssignmentItem, AssignmentType, AssignmentTargetType };

/**
 * Seed initial sample assignments if none exist
 */
function getDefaultAssignmentsSeed(madrasaId: string, classes: any[]): AssignmentItem[] {
  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

  const firstClass = classes[0] || { id: "c1", name: "হিফজুল কুরআন" };
  const secondClass = classes[1] || { id: "c2", name: "মিযান জামাত" };

  return [
    {
      id: "asg-seed-1",
      madrasa_id: madrasaId,
      title: "সূরা মুলক ১ হতে ১০ আয়াত শুদ্ধ তিলাওয়াত ও হিফজ",
      type: "TODAY_LESSON",
      type_bangla: "আজকের পড়া",
      target_type: "CLASS",
      class_id: firstClass.id,
      class_name: firstClass.name,
      subject_name: "হিফজুল কুরআন",
      description: "সূরা মুলক ১-১০ আয়াত তাজবীদসহ মাখরাজ ঠিক করে কমপক্ষে ১০ বার মশ্‌ক করতে হবে এবং মুখস্থ শুনাতে হবে।",
      image_urls: ["https://iili.io/J7qKxPs.jpg"],
      assigned_date: today,
      due_date: today,
      teacher_name: "হাফেজ মাওলানা ইব্রাহীম",
      created_by_role: "TEACHER",
      created_at: new Date(Date.now() - 3600000).toISOString(),
      status: "ACTIVE",
    },
    {
      id: "asg-seed-2",
      madrasa_id: madrasaId,
      title: "মিযানুস সরফ: ছিগাহ ও বহস ইসবাত ফে'লে মাযী মারূফ",
      type: "TOMORROW_LESSON",
      type_bangla: "আগামীকালের পড়া",
      target_type: "CLASS",
      class_id: secondClass.id,
      class_name: secondClass.name,
      subject_name: "আরবি ব্যাকরণ (ছরফ)",
      description: "পৃষ্ঠা নং ১৮-২০ এর সকল ছিগাহের অর্থসহ মুখস্থ করে খাতায় একবার লিখে আনতে হবে। ক্লাসে পড়া ধরা হবে।",
      image_urls: [],
      assigned_date: today,
      due_date: tomorrow,
      teacher_name: "মুফতি মাহমুদুল হাসান",
      created_by_role: "TEACHER",
      created_at: new Date(Date.now() - 7200000).toISOString(),
      status: "ACTIVE",
    },
    {
      id: "asg-seed-3",
      madrasa_id: madrasaId,
      title: "আমুক্তা ও পেছনের সবক দোহরানো (পারা ১-২)",
      type: "HOMEWORK",
      type_bangla: "হোমওয়ার্ক",
      target_type: "CLASS",
      class_id: firstClass.id,
      class_name: firstClass.name,
      subject_name: "আমুক্তা রিভিশন",
      description: "মাগরিবের পর পেছনের দুই পারা সহপাঠীর সাথে মশ্‌ক করে উস্তাদকে শুনাতে হবে। অভিভাবকগণ বাসায় তদারকি করবেন।",
      image_urls: [],
      assigned_date: today,
      due_date: today,
      teacher_name: "মাওলানা আব্দুল্লাহ",
      created_by_role: "TEACHER",
      created_at: new Date(Date.now() - 10800000).toISOString(),
      status: "ACTIVE",
    },
  ];
}

/**
 * Fetch all assignments with flexible filters
 */
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
}> {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const madrasaId = await getAuthMadrasaId(supabase, user);

    const classes = await getClasses();

    if (!madrasaId) {
      return { assignments: [], classes: classes || [] };
    }

    const meta = await getMadrasaMetadata(madrasaId);
    let list: AssignmentItem[] = meta.assignments || [];

    if (!list || list.length === 0) {
      list = getDefaultAssignmentsSeed(madrasaId, classes || []);
      meta.assignments = list;
      await saveMadrasaMetadata(madrasaId, meta);
    }

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
    };
  } catch (err) {
    console.error("getAssignments error:", err);
    return { assignments: [], classes: [] };
  }
}

/**
 * Fetch assignments specifically for a student (for Parent Portal or Student view)
 */
export async function getStudentAssignments(
  studentId: string,
  classId?: string
): Promise<AssignmentItem[]> {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const madrasaId = await getAuthMadrasaId(supabase, user);

    if (!madrasaId) return [];

    const meta = await getMadrasaMetadata(madrasaId);
    let list: AssignmentItem[] = meta.assignments || [];

    if (!list || list.length === 0) {
      const classes = await getClasses();
      list = getDefaultAssignmentsSeed(madrasaId, classes || []);
      meta.assignments = list;
      await saveMadrasaMetadata(madrasaId, meta);
    }

    // Filter items meant for this student:
    // 1. target_type == 'CLASS' and class matches
    // 2. target_type == 'STUDENT' and student_id matches
    const relevant = list.filter((item) => {
      if (item.status === "ARCHIVED") return false;

      if (item.target_type === "STUDENT" && item.student_id === studentId) {
        return true;
      }

      if (item.target_type === "CLASS" && classId && item.class_id === classId) {
        return true;
      }

      return false;
    });

    relevant.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return relevant;
  } catch (err) {
    console.error("getStudentAssignments error:", err);
    return [];
  }
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
}) {
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

    const { data: userData } = await supabase
      .from("users")
      .select("role, full_name")
      .eq("id", user.id)
      .single();

    const role = (userData?.role as any) || "TEACHER";
    const authorRole = ["super_admin", "admin", "muhtamim"].includes(role)
      ? "ADMIN"
      : "TEACHER";
    const authorName = data.teacher_name || userData?.full_name || "সম্মানিত উস্তাদ";

    const typeBangla = ASSIGNMENT_TYPE_MAP[data.type] || "অ্যাসাইনমেন্ট";

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
        status: data.status || existing.status || "ACTIVE",
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
        assigned_date: data.assigned_date || new Date().toISOString().split("T")[0],
        due_date: data.due_date || null,
        teacher_id: user.id,
        teacher_name: authorName,
        created_by_role: authorRole,
        created_at: new Date().toISOString(),
        status: "ACTIVE",
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

    return { success: true };
  } catch (err: any) {
    console.error("saveAssignment error:", err);
    return { error: err.message || "অ্যাসাইনমেন্ট সংরক্ষণে সমস্যা হয়েছে।" };
  }
}

/**
 * Delete an assignment
 */
export async function deleteAssignment(id: string) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অনুমতি নেই।" };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি।" };

    const meta = await getMadrasaMetadata(madrasaId);
    let list: AssignmentItem[] = meta.assignments || [];

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
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অনুমতি নেই।" };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি।" };

    const meta = await getMadrasaMetadata(madrasaId);
    let list: AssignmentItem[] = meta.assignments || [];

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
