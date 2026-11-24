"use server";
import { webIdentity, teacherScope, teacherSchedule, hasRole } from '@/lib/portal/identity';
import {studentRoles, teacherRoles} from '@/lib/portal/rules';

import { writeGuard } from "@/lib/action-authorization";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {resolveTeacherUuid} from '@/lib/teacher-profile-write';

export async function getTeacherSubjects(teacherId: string) {
  if (!teacherId) return [];

  const i = await webIdentity(); if (!i || hasRole(i,studentRoles)) return [];
  if (!hasRole(i,teacherRoles) && !(await writeGuard("staff")).allowed) return [];
  const s = await teacherScope(i,hasRole(i,teacherRoles) ? undefined : teacherId);
  return s.assignments;

}

export async function getAvailableClassSubjects() {
  const supabase = await createClient();
  const adminClient = await createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { getAuthMadrasaId } = await import("./students");
  const madrasaId = user ? await getAuthMadrasaId(supabase, user) : null;

  let query = adminClient
    .from("class_subjects")
    .select("*, classes(*), subjects(*)");

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching available class subjects:", error);
    return [];
  }

  const rawRows = (data || []).filter((row: any) => {
    if (!madrasaId) return true;
    const classTenant = row.classes?.madrasa_id || row.madrasa_id;
    return !classTenant || classTenant === madrasaId;
  });

  // Hydrate missing classes or subjects in case FK join returned null
  const [{ data: allClasses }, { data: allSubjects }] = await Promise.all([
    adminClient.from("classes").select("id, name, madrasa_id"),
    adminClient.from("subjects").select("id, name, code, madrasa_id"),
  ]);
  const classMap = new Map((allClasses || []).map((c: any) => [c.id, c]));
  const subjectMap = new Map((allSubjects || []).map((s: any) => [s.id, s]));

  return rawRows
    .map((row: any) => ({
      ...row,
      classes: row.classes || classMap.get(row.class_id) || null,
      subjects: row.subjects || subjectMap.get(row.subject_id) || null,
    }))
    .filter((row: any) => row.classes?.name && row.subjects?.name);
}

export async function getClassTeacherSubjects(classId: string) {
  if (!classId) return [];
  const supabase = await createClient();
  const adminClient = await createAdminClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { getAuthMadrasaId } = await import("./students");
  const madrasaId = await getAuthMadrasaId(supabase, user);
  if (!madrasaId) return [];

  const { data } = await adminClient
    .from("teacher_subjects")
    .select("id, teacher_id, class_id, subject_id, teachers(id, first_name, last_name, designation)")
    .eq("madrasa_id", madrasaId)
    .eq("class_id", classId);

  return data || [];
}

export async function assignSubjectToTeacher(teacherId: string, classId: string, subjectId: string) {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("staff");
    if (!__authz.allowed) return __authz.fallback;
  }

  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "অননুমোদিত অ্যাক্সেস (অনুগ্রহ করে লগইন করুন)" };

  const { getAuthMadrasaId } = await import("./students");
  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) {
    return { error: "সিস্টেমে কোনো মাদ্রাসা পাওয়া যায়নি।" };
  }

  const resolvedTeacherId = await resolveTeacherUuid(teacherId, finalMadrasaId);
  if (!resolvedTeacherId) {
    return { error: "শিক্ষকের আইডি সঠিক নয়।" };
  }

  const adminClient = await createAdminClient();

  const [classRow, subjectRow] = await Promise.all([
    adminClient.from("classes").select("id, madrasa_id").eq("id", classId).maybeSingle(),
    adminClient.from("subjects").select("id, madrasa_id").eq("id", subjectId).maybeSingle(),
  ]);
  if (
    !classRow.data ||
    !subjectRow.data ||
    (classRow.data.madrasa_id && classRow.data.madrasa_id !== finalMadrasaId) ||
    (subjectRow.data.madrasa_id && subjectRow.data.madrasa_id !== finalMadrasaId)
  ) {
    return { error: "জামাত বা বিষয় এই প্রতিষ্ঠানের নয়।" };
  }
  const { error } = await adminClient.from("teacher_subjects").insert({
    madrasa_id: finalMadrasaId,
    teacher_id: resolvedTeacherId,
    class_id: classId,
    subject_id: subjectId,
  });

  if (error) {
    if (error.code === '23505') {
      return { error: "এই জামাতে এই শিক্ষকের জন্য ইতিমধ্যেই এই বিষয়টি নিযুক্ত করা হয়েছে।" };
    }
    console.error("assignSubjectToTeacher error:", error);
    return { error: `বিষয় এসাইন করতে সমস্যা হয়েছে: ${error.message}` };
  }

  revalidatePath(`/dashboard/teachers/${teacherId}/subjects`);
  revalidatePath(`/dashboard/teachers/${resolvedTeacherId}/subjects`);
  revalidatePath(`/dashboard/classes/${classId}/subjects`);
  revalidatePath(`/dashboard/teachers`);
  revalidatePath(`/dashboard/staff`);
  return { success: true, teacherId: resolvedTeacherId };
}

export async function setClassSubjectTeacher(classId: string, subjectId: string, teacherId: string | null) {
  {
    const __authz = await writeGuard("classes");
    if (!__authz.allowed) return __authz.fallback;
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "অননুমোদিত অ্যাক্সেস (অনুগ্রহ করে লগইন করুন)" };

  const { getAuthMadrasaId } = await import("./students");
  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return { error: "সিস্টেমে কোনো মাদ্রাসা পাওয়া যায়নি।" };

  const adminClient = await createAdminClient();

  // Remove any existing teacher assignment for this class + subject in this tenant
  await adminClient
    .from("teacher_subjects")
    .delete()
    .eq("madrasa_id", finalMadrasaId)
    .eq("class_id", classId)
    .eq("subject_id", subjectId);

  if (!teacherId || teacherId === "NONE") {
    revalidatePath(`/dashboard/classes/${classId}/subjects`);
    revalidatePath(`/dashboard/staff`);
    return { success: true, teacherId: null };
  }

  const resolvedTeacherId = await resolveTeacherUuid(teacherId, finalMadrasaId);
  if (!resolvedTeacherId) {
    return { error: "শিক্ষকের আইডি সঠিক নয়।" };
  }

  const { error } = await adminClient.from("teacher_subjects").insert({
    madrasa_id: finalMadrasaId,
    teacher_id: resolvedTeacherId,
    class_id: classId,
    subject_id: subjectId,
  });

  if (error) {
    return { error: `বিষয় শিক্ষক নির্ধারণে সমস্যা হয়েছে: ${error.message}` };
  }

  revalidatePath(`/dashboard/classes/${classId}/subjects`);
  revalidatePath(`/dashboard/teachers/${teacherId}/subjects`);
  revalidatePath(`/dashboard/teachers/${resolvedTeacherId}/subjects`);
  revalidatePath(`/dashboard/staff`);
  return { success: true, teacherId: resolvedTeacherId };
}

export async function removeSubjectFromTeacher(teacherSubjectId: string, teacherId: string) {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("staff");
    if (!__authz.allowed) return __authz.fallback;
  }

  const adminClient = await createAdminClient();
  const { error } = await adminClient
    .from("teacher_subjects")
    .delete()
    .eq("madrasa_id",(await webIdentity())?.tenant || "").eq("id", teacherSubjectId);

  if (error) {
    return { error: `বিষয়টি মুছতে সমস্যা হয়েছে: ${error.message}` };
  }

  revalidatePath(`/dashboard/teachers/${teacherId}/subjects`);
  revalidatePath(`/dashboard/teachers`);
  return { success: true };
}

export interface TeacherAssignedSubject {
  id: string;
  class_id: string;
  class_name: string;
  subject_id: string;
  subject_name: string;
  subject_code?: string | null;
}

export interface TeacherInChargeClass {
  class_id: string;
  class_name: string;
  sequence?: number;
}

export interface TeacherRoutineScheduleItem {
  id: string;
  class_id: string;
  class_name: string;
  subject_id?: string | null;
  subject_name: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  room_number?: string;
  routine_type?: string;
  item_type?: string;
  display_title: string;
  clean_room?: string;
}

export interface TeacherAcademicSchedule {
  isTeachingStaff: boolean;
  teacherId: string;
  assignedSubjects: TeacherAssignedSubject[];
  inChargeClasses: TeacherInChargeClass[];
  routines: TeacherRoutineScheduleItem[];
}

export async function getTeacherAcademicSchedule(staffId: string): Promise<TeacherAcademicSchedule> {
  const i = await webIdentity();
  if (i && !hasRole(i,studentRoles)) {
    if (hasRole(i,teacherRoles)) return teacherSchedule(i, await teacherScope(i));
    if (staffId && (await writeGuard('staff')).allowed) return teacherSchedule(i, await teacherScope(i,staffId));
  }
  return {teacherId:'',isTeachingStaff:false,assignedSubjects:[],inChargeClasses:[],routines:[]};
}
