"use server";
import { webIdentity, teacherScope, teacherSchedule, hasRole, type TeacherStaffHint } from '@/lib/portal/identity';
import {studentRoles, teacherRoles} from '@/lib/portal/rules';

import { writeGuard } from "@/lib/action-authorization";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {resolveTeacherUuid} from '@/lib/teacher-profile-write';
import { logAuditEvent } from "@/lib/audit-log";

export async function getTeacherSubjects(teacherId: string) {
  if (!teacherId) return [];

  const i = await webIdentity();
  if (!i || hasRole(i, studentRoles)) return [];
  const staffGuard = await writeGuard("staff");
  const staffReadGuard = staffGuard.allowed ? staffGuard : await writeGuard("staffRead");
  const isStaffViewer = staffGuard.allowed || staffReadGuard.allowed;
  if (!hasRole(i, teacherRoles) && !isStaffViewer) return [];
  // When an explicit teacherId is passed by a staff/admin viewer, always resolve that teacher's scope
  const s = await teacherScope(i, isStaffViewer ? teacherId : undefined);
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

  return (data || []).map((row: any) => ({
    id: String(row.id),
    teacher_id: String(row.teacher_id),
    class_id: String(row.class_id),
    subject_id: String(row.subject_id),
    teachers: Array.isArray(row.teachers) ? row.teachers[0] || null : row.teachers || null,
  }));
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

  const [classRow, subjectRow, classSubLink] = await Promise.all([
    adminClient.from("classes").select("id, name, madrasa_id").eq("id", classId).maybeSingle(),
    adminClient.from("subjects").select("id, name, madrasa_id").eq("id", subjectId).maybeSingle(),
    adminClient
      .from("class_subjects")
      .select("id")
      .eq("class_id", classId)
      .eq("subject_id", subjectId)
      .maybeSingle(),
  ]);

  if (
    !classRow.data ||
    !subjectRow.data ||
    (classRow.data.madrasa_id && classRow.data.madrasa_id !== finalMadrasaId)
  ) {
    return { error: "জামাত বা বিষয় এই প্রতিষ্ঠানের নয়।" };
  }

  // S2 Fix: Allow subject if it belongs to this tenant, is global (madrasa_id is null),
  // is linked via class_subjects for this class, or is in the visible subject catalog.
  if (
    subjectRow.data.madrasa_id &&
    subjectRow.data.madrasa_id !== finalMadrasaId &&
    !classSubLink.data
  ) {
    const { getSubjects } = await import("./subjects");
    const visibleCatalog = await getSubjects();
    const isInVisibleCatalog = (visibleCatalog || []).some((s: any) => s.id === subjectId);
    if (!isInVisibleCatalog) {
      return { error: "জামাত বা বিষয় এই প্রতিষ্ঠানের নয়।" };
    }
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

  await logAuditEvent({
    madrasaId: finalMadrasaId,
    actorId: user.id,
    actorEmail: user.email || null,
    module: "staff",
    action: "TEACHER_SUBJECT_ASSIGNED",
    entityType: "teacher_subject",
    entityId: `${resolvedTeacherId}:${classId}:${subjectId}`,
    entityLabel: `${classRow.data.name || classId} - ${subjectRow.data.name || subjectId}`,
    summary: `শিক্ষকের জন্য "${subjectRow.data.name || subjectId}" (${classRow.data.name || classId}) বিষয় নির্ধারণ করা হয়েছে`,
    newValue: { teacher_id: resolvedTeacherId, class_id: classId, subject_id: subjectId },
  });

  revalidatePath(`/dashboard/teachers/${teacherId}/subjects`);
  revalidatePath(`/dashboard/teachers/${resolvedTeacherId}/subjects`);
  revalidatePath(`/dashboard/classes/${classId}/subjects`);
  revalidatePath(`/dashboard/teachers`);
  revalidatePath(`/dashboard/staff`);
  revalidatePath(`/teacher-portal`);
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
    await logAuditEvent({
      madrasaId: finalMadrasaId,
      actorId: user.id,
      actorEmail: user.email || null,
      module: "staff",
      action: "CLASS_SUBJECT_TEACHER_CLEARED",
      entityType: "teacher_subject",
      entityId: `${classId}:${subjectId}`,
      summary: `জামাতের বিষয় শিক্ষক বরাদ্দ বাতিল করা হয়েছে (${classId})`,
      oldValue: { class_id: classId, subject_id: subjectId },
    });
    revalidatePath(`/dashboard/classes/${classId}/subjects`);
    revalidatePath(`/dashboard/staff`);
    revalidatePath(`/teacher-portal`);
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

  await logAuditEvent({
    madrasaId: finalMadrasaId,
    actorId: user.id,
    actorEmail: user.email || null,
    module: "staff",
    action: "CLASS_SUBJECT_TEACHER_SET",
    entityType: "teacher_subject",
    entityId: `${resolvedTeacherId}:${classId}:${subjectId}`,
    summary: `জামাতের বিষয়ের জন্য শিক্ষক নির্ধারণ করা হয়েছে`,
    newValue: { teacher_id: resolvedTeacherId, class_id: classId, subject_id: subjectId },
  });

  revalidatePath(`/dashboard/classes/${classId}/subjects`);
  revalidatePath(`/dashboard/teachers/${teacherId}/subjects`);
  revalidatePath(`/dashboard/teachers/${resolvedTeacherId}/subjects`);
  revalidatePath(`/dashboard/staff`);
  revalidatePath(`/teacher-portal`);
  return { success: true, teacherId: resolvedTeacherId };
}

export async function removeSubjectFromTeacher(teacherSubjectId: string, teacherId: string) {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  const __authz = await writeGuard("staff");
  if (!__authz.allowed) return __authz.fallback;

  const tenant = (await webIdentity())?.tenant || __authz.madrasaId || "";
  if (!tenant) {
    return { error: "সিস্টেমে কোনো মাদ্রাসা পাওয়া যায়নি।" };
  }

  const adminClient = await createAdminClient();
  const { data: existingRow, error: fetchErr } = await adminClient
    .from("teacher_subjects")
    .select("id, madrasa_id, teacher_id, class_id, subject_id")
    .eq("id", teacherSubjectId)
    .maybeSingle();

  if (fetchErr) {
    return { error: `বিষয়টি যাচাই করতে সমস্যা হয়েছে: ${fetchErr.message}` };
  }

  if (!existingRow) {
    return { error: "নির্বাচিত বিষয় বরাদ্দটি খুঁজে পাওয়া যায়নি।" };
  }

  // Tenant ownership verification: allow if row belongs to tenant or legacy null madrasa_id owned by a teacher in this tenant
  if (existingRow.madrasa_id && existingRow.madrasa_id !== tenant) {
    return { error: "এই বিষয় বরাদ্দটি আপনার প্রতিষ্ঠানের নয়।" };
  }
  if (!existingRow.madrasa_id && existingRow.teacher_id) {
    const { data: teacherRow } = await adminClient
      .from("teachers")
      .select("id, madrasa_id")
      .eq("id", existingRow.teacher_id)
      .maybeSingle();
    if (teacherRow?.madrasa_id && teacherRow.madrasa_id !== tenant) {
      return { error: "এই বিষয় বরাদ্দটি আপনার প্রতিষ্ঠানের নয়।" };
    }
  }

  const { error } = await adminClient
    .from("teacher_subjects")
    .delete()
    .eq("id", teacherSubjectId);

  if (error) {
    return { error: `বিষয়টি মুছতে সমস্যা হয়েছে: ${error.message}` };
  }

  await logAuditEvent({
    madrasaId: tenant,
    actorId: __authz.user?.id || null,
    actorEmail: __authz.user?.email || null,
    module: "staff",
    action: "TEACHER_SUBJECT_REMOVED",
    entityType: "teacher_subject",
    entityId: teacherSubjectId,
    summary: `শিক্ষকের বিষয় বরাদ্দ মুছে ফেলা হয়েছে (${teacherId})`,
    oldValue: {
      id: teacherSubjectId,
      teacher_id: existingRow.teacher_id || teacherId,
      class_id: existingRow.class_id,
      subject_id: existingRow.subject_id,
    },
  });

  revalidatePath(`/dashboard/teachers/${teacherId}/subjects`);
  if (existingRow.teacher_id && existingRow.teacher_id !== teacherId) {
    revalidatePath(`/dashboard/teachers/${existingRow.teacher_id}/subjects`);
  }
  if (existingRow.class_id) {
    revalidatePath(`/dashboard/classes/${existingRow.class_id}/subjects`);
  }
  revalidatePath(`/dashboard/teachers`);
  revalidatePath(`/dashboard/staff`);
  revalidatePath(`/teacher-portal`);
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

export async function getTeacherAcademicSchedule(
  staffId: string,
  staffHint?: TeacherStaffHint,
): Promise<TeacherAcademicSchedule> {
  const i = await webIdentity();
  if (i && !hasRole(i, studentRoles)) {
    // PB-06 Fix: If staffId is explicitly provided and the caller has staff or staffRead access (e.g. Admin viewing a teacher drawer),
    // always pass staffId + staffHint to teacherScope so admin users who also hold a teacher role don't see their own empty scope instead of the target teacher!
    if (staffId) {
      const canViewStaff =
        (await writeGuard("staff")).allowed ||
        (await writeGuard("staffRead")).allowed ||
        hasRole(i, ["super_admin", "admin", "muhtamim", "naib_muhtamim", "hr_manager", "office_staff"]);
      if (canViewStaff) {
        return teacherSchedule(i, await teacherScope(i, staffId, staffHint));
      }
    }
    if (hasRole(i, teacherRoles)) {
      return teacherSchedule(
        i,
        await teacherScope(i, staffId || undefined, staffId ? staffHint : undefined),
      );
    }
  }
  return { teacherId: "", isTeachingStaff: false, assignedSubjects: [], inChargeClasses: [], routines: [] };
}
