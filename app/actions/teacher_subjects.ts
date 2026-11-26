"use server";
import { webIdentity, teacherScope, teacherSchedule, hasRole } from '@/lib/portal/identity';
import {studentRoles, teacherRoles} from '@/lib/portal/rules';

import { writeGuard } from "@/lib/action-authorization";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {rows} from "@/lib/portal/queries";
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
  const s = await teacherScope(i, isStaffViewer ? teacherId : undefined,true);
  return s.assignments;
}

export async function getAvailableClassSubjects() {
  const access=await writeGuard("staffRead");
  if(!access.allowed || !access.madrasaId) return [];
  const db=await createAdminClient(), tenant=access.madrasaId;
  // A global/seed subject is selectable via a link to one of OUR classes.
  // Do not scan all tenants' directories or hydrate arbitrary orphan links.
  const result=await rows(()=>db.from("class_subjects")
    .select("id,class_id,subject_id,classes!inner(id,name,madrasa_id),subjects(id,name,code)")
    .or(`madrasa_id.eq.${tenant},madrasa_id.is.null`)
    .or(`madrasa_id.eq.${tenant},madrasa_id.is.null`,{referencedTable:'classes'}));
  return result.filter(r=>r.classes?.name && r.subjects?.name && (!r.classes.madrasa_id || r.classes.madrasa_id===tenant));
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

  // Verify the requested class belongs to this tenant (or shared seeded class)
  const { data: clsRow } = await adminClient
    .from("classes")
    .select("id, madrasa_id")
    .eq("id", classId)
    .maybeSingle();
  if (!clsRow || (clsRow.madrasa_id && clsRow.madrasa_id !== madrasaId)) {
    return [];
  }

  const { data } = await adminClient
    .from("teacher_subjects")
    .select("id, madrasa_id, teacher_id, class_id, subject_id, teachers(id, first_name, last_name, designation)")
    .or(`madrasa_id.eq.${madrasaId},madrasa_id.is.null`)
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
  const guard=await writeGuard("staff");
  if(!guard.allowed)return guard.fallback;
  const finalMadrasaId=guard.madrasaId;
  if(!finalMadrasaId || !guard.userId)return {error:"প্রতিষ্ঠান ও ব্যবহারকারী যাচাই করা যায়নি।"};
  const adminClient=await createAdminClient();
  const [classRow, subjectRow, classSubLink] = await Promise.all([
    adminClient.from("classes").select("id, name, madrasa_id").eq("id", classId).maybeSingle(),
    adminClient.from("subjects").select("id, name, madrasa_id").eq("id", subjectId).maybeSingle(),
    adminClient
      .from("class_subjects")
      .select("id,madrasa_id")
      .eq("class_id", classId)
      .eq("subject_id", subjectId)
      .maybeSingle(),
  ]);

  // Keep the original FK of a shared seeded book, but only via this
  // tenant's actual class-subject link. A visible name alone is not a grant.
  if(!classRow.data || !subjectRow.data || !classSubLink.data ||
     (classRow.data.madrasa_id && classRow.data.madrasa_id!==finalMadrasaId) ||
     (classSubLink.data.madrasa_id && classSubLink.data.madrasa_id!==finalMadrasaId)) return {error:"এই জামাতের বিষয় বরাদ্দ পাওয়া যায়নি।"};
  const resolvedTeacherId=await resolveTeacherUuid(teacherId,finalMadrasaId);
  if (!resolvedTeacherId)return {error:"শিক্ষকের আইডি সঠিক নয়।"};

  // Observation (ক): Keep one canonical subject-teacher per (class_id, subject_id) within the tenant
  // so assigning from a teacher's profile never leaves a conflicting assignment on another teacher.
  const { data: prevRows } = await adminClient
    .from("teacher_subjects")
    .select("id, teacher_id")
    .or(`madrasa_id.eq.${finalMadrasaId},madrasa_id.is.null`)
    .eq("class_id", classId)
    .eq("subject_id", subjectId);

  const replacedTeacherIds = Array.from(
    new Set(
      (prevRows || [])
        .map((r: any) => String(r.teacher_id || ""))
        .filter((tid) => tid && tid !== resolvedTeacherId),
    ),
  );

  const rpcSave = await adminClient.rpc("round7_set_subject_teacher", {
    t: finalMadrasaId,
    c: classId,
    s: subjectId,
    replacement: resolvedTeacherId,
  });

  if (rpcSave.error) {
    // Fallback if RPC unavailable: clean other teachers' rows in this tenant and upsert cleanly
    const staleIds = (prevRows || [])
      .filter((r: any) => String(r.teacher_id || "") !== resolvedTeacherId)
      .map((r: any) => r.id);
    if (staleIds.length > 0) {
      await adminClient.from("teacher_subjects").delete().in("id", staleIds);
    }
    const alreadyExists = (prevRows || []).some(
      (r: any) => String(r.teacher_id || "") === resolvedTeacherId,
    );
    if (!alreadyExists) {
      const { error } = await adminClient.from("teacher_subjects").insert({
        madrasa_id: finalMadrasaId,
        teacher_id: resolvedTeacherId,
        class_id: classId,
        subject_id: subjectId,
      });
      if (error && error.code !== "23505") {
        console.error("assignSubjectToTeacher error:", error);
        return { error: `বিষয় এসাইন করতে সমস্যা হয়েছে: ${error.message}` };
      }
    }
  } else {
    // Also clean any legacy madrasa_id IS NULL rows for other teachers on this same (class_id, subject_id)
    await adminClient
      .from("teacher_subjects")
      .delete()
      .is("madrasa_id", null)
      .eq("class_id", classId)
      .eq("subject_id", subjectId)
      .neq("teacher_id", resolvedTeacherId);
  }

  for (const prevTid of replacedTeacherIds) {
    revalidatePath(`/dashboard/teachers/${prevTid}/subjects`);
  }

  await logAuditEvent({
    madrasaId: finalMadrasaId,
    actorId: guard.userId,
    actorEmail: guard.actorEmail,
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
  const guard=await writeGuard("classes");
  if(!guard.allowed)return guard.fallback;
  const finalMadrasaId=guard.madrasaId;
  if(!finalMadrasaId || !guard.userId)return {error:"প্রতিষ্ঠান ও ব্যবহারকারী যাচাই করা যায়নি।"};
  const adminClient = await createAdminClient();

  const clear=!teacherId || teacherId==="NONE";
  const resolvedTeacherId=clear?null:await resolveTeacherUuid(teacherId, finalMadrasaId);
  if(!clear && !resolvedTeacherId) return {error:"শিক্ষকের আইডি সঠিক নয়।"};
  const { data: prevClassRows } = await adminClient
    .from("teacher_subjects")
    .select("id, teacher_id")
    .or(`madrasa_id.eq.${finalMadrasaId},madrasa_id.is.null`)
    .eq("class_id", classId)
    .eq("subject_id", subjectId);

  const saved = await adminClient.rpc("round7_set_subject_teacher", {
    t: finalMadrasaId,
    c: classId,
    s: subjectId,
    replacement: resolvedTeacherId,
  });
  if (saved.error) return { error: `শিক্ষক বরাদ্দ সেভ হয়নি: ${saved.error.message}` };

  // Also purge any legacy madrasa_id IS NULL duplicate rows for this class+subject
  if (clear) {
    await adminClient
      .from("teacher_subjects")
      .delete()
      .is("madrasa_id", null)
      .eq("class_id", classId)
      .eq("subject_id", subjectId);
  } else if (resolvedTeacherId) {
    await adminClient
      .from("teacher_subjects")
      .delete()
      .is("madrasa_id", null)
      .eq("class_id", classId)
      .eq("subject_id", subjectId)
      .neq("teacher_id", resolvedTeacherId);
  }

  for (const prev of prevClassRows || []) {
    if (prev.teacher_id && prev.teacher_id !== resolvedTeacherId) {
      revalidatePath(`/dashboard/teachers/${prev.teacher_id}/subjects`);
    }
  }
  if (clear) {
    await logAuditEvent({
      madrasaId: finalMadrasaId,
      actorId: guard.userId,
      actorEmail: guard.actorEmail,
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

  await logAuditEvent({
    madrasaId: finalMadrasaId,
    actorId: guard.userId,
    actorEmail: guard.actorEmail,
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
  routineUnavailable?:boolean;
  routines: TeacherRoutineScheduleItem[];
}

export async function getTeacherAcademicSchedule(
  staffId: string,
): Promise<TeacherAcademicSchedule> {
  const i = await webIdentity(true);
  if (!i || hasRole(i, studentRoles)) throw new Error("শিক্ষকের বরাদ্দ দেখার অনুমতি নেই।");
  const guard = await writeGuard("staffRead");
  const canInspect = guard.allowed || (await writeGuard("staff")).allowed;
  if (!canInspect && !hasRole(i, teacherRoles)) throw new Error("শিক্ষকের বরাদ্দ দেখার অনুমতি নেই।");
  const scope = await teacherScope(i, canInspect ? staffId : undefined,true);
  if (canInspect && !scope.keys.length) throw Error("কর্মীর সঙ্গে শিক্ষকের প্রোফাইল মেলেনি।");
  return teacherSchedule(i,scope,true);
}
