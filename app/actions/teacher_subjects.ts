"use server";

import { writeGuard } from "@/lib/action-authorization";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getMadrasaMetadata, saveMadrasaMetadata } from "@/lib/sessions";
import { isTeachingStaff } from "@/lib/staff-management";
import { resolveTeacherCandidateIdsByStaffId } from "@/lib/teacher-identity";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Safely resolves or repairs a teacher UUID across SQL tables and metadata.
 */
export async function resolveTeacherUuid(teacherId: string, madrasaId?: string): Promise<string> {
  if (!teacherId) return teacherId;

  const adminClient = await createAdminClient();

  // If already a valid UUID, verify if record exists in teachers table
  if (UUID_REGEX.test(teacherId)) {
    const { data: existing } = await adminClient
      .from("teachers")
      .select("id")
      .eq("id", teacherId)
      .maybeSingle();

    if (existing) {
      return teacherId;
    }

    // If UUID not in teachers table, look up in madrasa metadata staff
    if (madrasaId) {
      const meta: any = await getMadrasaMetadata(madrasaId);
      const staffMember = (meta.staff_members || []).find((s: any) => s.id === teacherId);
      if (staffMember) {
        await adminClient.from("teachers").upsert({
          id: teacherId,
          madrasa_id: madrasaId,
          first_name: staffMember.personal?.first_name || "শিক্ষক",
          last_name: staffMember.personal?.last_name || "",
          phone: staffMember.contact?.phone || null,
          email: staffMember.contact?.email || null,
          designation: staffMember.employment?.designation || "ওস্তাদ",
        });
      }
    }
    return teacherId;
  }

  // Legacy non-UUID ID (e.g. stf_...)
  if (madrasaId) {
    const meta: any = await getMadrasaMetadata(madrasaId);
    let modified = false;
    const staffList = meta.staff_members || [];
    let targetStaff = staffList.find((s: any) => s.id === teacherId || s.legacy_id === teacherId);

    if (targetStaff) {
      if (!UUID_REGEX.test(targetStaff.id)) {
        const newUuid = crypto.randomUUID();
        targetStaff.legacy_id = targetStaff.id;
        targetStaff.id = newUuid;
        modified = true;
      }

      await adminClient.from("teachers").upsert({
        id: targetStaff.id,
        madrasa_id: madrasaId,
        first_name: targetStaff.personal?.first_name || "শিক্ষক",
        last_name: targetStaff.personal?.last_name || "",
        phone: targetStaff.contact?.phone || null,
        email: targetStaff.contact?.email || null,
        designation: targetStaff.employment?.designation || "ওস্তাদ",
      });

      if (modified) {
        await saveMadrasaMetadata(madrasaId, meta);
      }

      return targetStaff.id;
    }
  }

  return teacherId;
}

export async function getTeacherSubjects(teacherId: string) {
  if (!teacherId) return [];

  const supabase = await createClient();
  let searchId = teacherId;

  // If not a valid UUID, attempt resolution
  if (!UUID_REGEX.test(teacherId)) {
    const { data: { user } } = await supabase.auth.getUser();
    const { getAuthMadrasaId } = await import("./students");
    const madrasaId = user ? await getAuthMadrasaId(supabase, user) : undefined;
    searchId = await resolveTeacherUuid(teacherId, madrasaId);
  }

  if (!UUID_REGEX.test(searchId)) {
    return [];
  }

  const { data, error } = await supabase
    .from("teacher_subjects")
    .select("*, classes(*), subjects(*)")
    .eq("teacher_id", searchId);

  if (error) {
    console.error("Error fetching teacher subjects:", error);
    return [];
  }
  return data || [];
}

export async function getAvailableClassSubjects() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("class_subjects")
    .select("*, classes(*), subjects(*)");

  if (error) {
    console.error("Error fetching available class subjects:", error);
    return [];
  }
  return data || [];
}

export async function assignSubjectToTeacher(teacherId: string, classId: string, subjectId: string) {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("generic");
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
  if (!UUID_REGEX.test(resolvedTeacherId)) {
    return { error: "শিক্ষকের আইডি সঠিক নয়।" };
  }

  const adminClient = await createAdminClient();

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
  revalidatePath(`/dashboard/teachers`);
  revalidatePath(`/dashboard/staff`);
  return { success: true, teacherId: resolvedTeacherId };
}

export async function removeSubjectFromTeacher(teacherSubjectId: string, teacherId: string) {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("generic");
    if (!__authz.allowed) return __authz.fallback;
  }

  const adminClient = await createAdminClient();
  const { error } = await adminClient
    .from("teacher_subjects")
    .delete()
    .eq("id", teacherSubjectId);

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

export async function getTeacherAcademicSchedule(
  staffId: string,
  options?: { madrasaId?: string; candidateIds?: string[] }
): Promise<TeacherAcademicSchedule> {
  const result: TeacherAcademicSchedule = {
    isTeachingStaff: false,
    teacherId: staffId,
    assignedSubjects: [],
    inChargeClasses: [],
    routines: [],
  };

  const hasExplicitCandidates = Boolean(options?.candidateIds && options.candidateIds.length > 0);
  if (!staffId && !hasExplicitCandidates) return result;

  try {
    const supabase = await createClient();
    const adminClient = await createAdminClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { getAuthMadrasaId } = await import("./students");
    let madrasaId =
      options?.madrasaId || (user ? await getAuthMadrasaId(supabase, user) : undefined);

    if (!madrasaId && user) {
      const { data: uRow } = await adminClient
        .from("users")
        .select("madrasa_id")
        .eq("id", user.id)
        .maybeSingle();
      madrasaId = uRow?.madrasa_id || user.user_metadata?.madrasa_id || undefined;
    }

    if (!madrasaId) return result;

    const meta = ((await getMadrasaMetadata(madrasaId)) as any) || {};

    const resolvedByStaff = staffId
      ? await resolveTeacherCandidateIdsByStaffId({
          adminClient,
          madrasaId,
          staffOrTeacherId: staffId,
          madrasaMeta: meta,
        })
      : { candidateIds: [], matchedTeacher: null, matchedStaff: null };

    const candidateIds = new Set<string>(resolvedByStaff.candidateIds);
    for (const extraId of options?.candidateIds || []) {
      const trimmed = String(extraId || "").trim();
      if (trimmed) candidateIds.add(trimmed);
    }

    const staff = resolvedByStaff.matchedStaff;
    const isTeacher = staff
      ? isTeachingStaff(staff) ||
        staff.employment?.category_id === "cat-teaching" ||
        staff.employment?.category_id === "cat_teaching" ||
        staff.employment?.designation?.includes("মুদাররিস") ||
        staff.employment?.designation?.includes("শিক্ষক") ||
        staff.employment?.designation?.includes("উস্তাদ")
      : true;

    result.isTeachingStaff = isTeacher;
    result.teacherId =
      resolvedByStaff.matchedTeacher?.id ||
      resolvedByStaff.matchedStaff?.id ||
      staffId ||
      Array.from(candidateIds)[0] ||
      "";

    const candidateIdsArr = Array.from(candidateIds);
    if (candidateIdsArr.length === 0) return result;

    // 1. Fetch assigned subjects from `teacher_subjects`
    const { data: dbAssigned, error: assignedErr } = await adminClient
      .from("teacher_subjects")
      .select("id, class_id, subject_id, classes(id, name), subjects(id, name, code)")
      .in("teacher_id", candidateIdsArr);

    if (!assignedErr && dbAssigned) {
      dbAssigned.forEach((item: any) => {
        const clsName = Array.isArray(item.classes) ? item.classes[0]?.name : item.classes?.name;
        const subName = Array.isArray(item.subjects) ? item.subjects[0]?.name : item.subjects?.name;
        const subCode = Array.isArray(item.subjects) ? item.subjects[0]?.code : item.subjects?.code;

        result.assignedSubjects.push({
          id: item.id,
          class_id: item.class_id,
          class_name: clsName || "জামাত",
          subject_id: item.subject_id,
          subject_name: subName || "বিষয়",
          subject_code: subCode || null,
        });
      });
    }

    // 2. Fetch In-Charge / Jimmadar classes
    const classTeachersMap = meta.class_teachers || {};
    const { data: dbClasses } = await adminClient
      .from("classes")
      .select("id, name, description")
      .eq("madrasa_id", madrasaId);

    const classesMap = new Map<string, any>();
    (dbClasses || []).forEach((c) => classesMap.set(c.id, c));

    for (const [clsId, ctInfo] of Object.entries<any>(classTeachersMap)) {
      if (ctInfo?.teacher_id && candidateIds.has(ctInfo.teacher_id)) {
        const clsObj = classesMap.get(clsId);
        result.inChargeClasses.push({
          class_id: clsId,
          class_name: clsObj?.name || ctInfo.class_name || "জামাত",
        });
      }
    }

    // Also check SQL classes table if class_teacher_id column exists
    (dbClasses || []).forEach((cls: any) => {
      if (cls.class_teacher_id && candidateIds.has(cls.class_teacher_id)) {
        if (!result.inChargeClasses.some((c) => c.class_id === cls.id)) {
          result.inChargeClasses.push({
            class_id: cls.id,
            class_name: cls.name,
          });
        }
      }
    });

    // 3. Fetch Weekly Routines strictly assigned directly to this teacher's candidate IDs
    const { data: dbRoutines } = await adminClient
      .from("routines")
      .select("*, classes(id, name), subjects(id, name, code), teachers(id, first_name, last_name)")
      .in("teacher_id", candidateIdsArr)
      .order("start_time", { ascending: true });

    const rawRoutinesList = (dbRoutines || []).filter(
      (r: any) => !r?.madrasa_id || r.madrasa_id === madrasaId
    );

    const { parseRoutineItem } = await import("@/lib/routine-helper");
    const seenRoutineIds = new Set<string>();

    rawRoutinesList.forEach((r: any) => {
      if (seenRoutineIds.has(r.id)) return;
      seenRoutineIds.add(r.id);

      const parsed = parseRoutineItem(r);
      const clsName = Array.isArray(r.classes) ? r.classes[0]?.name : r.classes?.name;
      const subName = Array.isArray(r.subjects) ? r.subjects[0]?.name : r.subjects?.name;

      result.routines.push({
        id: r.id,
        class_id: r.class_id,
        class_name: clsName || "জামাত",
        subject_id: r.subject_id,
        subject_name: subName || parsed.display_title || "বিষয়",
        day_of_week: r.day_of_week,
        start_time: r.start_time,
        end_time: r.end_time,
        room_number: r.room_number,
        routine_type: r.routine_type,
        item_type: parsed.item_type,
        display_title: parsed.display_title,
        clean_room: parsed.clean_room,
      });
    });

    return result;
  } catch (err) {
    console.error("Error in getTeacherAcademicSchedule:", err);
    return result;
  }
}

