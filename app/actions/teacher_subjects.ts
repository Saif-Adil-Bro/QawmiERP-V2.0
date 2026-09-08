"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getMadrasaMetadata, saveMadrasaMetadata } from "@/lib/sessions";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Safely resolves or repairs a teacher UUID across SQL tables and metadata.
 */
async function resolveTeacherUuid(teacherId: string, madrasaId?: string): Promise<string> {
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
