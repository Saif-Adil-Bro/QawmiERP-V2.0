"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function getTeacherSubjects(teacherId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("teacher_subjects")
    .select("*, classes(*), subjects(*)")
    .eq("teacher_id", teacherId);

  if (error) {
    console.error("Error fetching teacher subjects:", error);
    return [];
  }
  return data;
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
  return data;
}

export async function assignSubjectToTeacher(teacherId: string, classId: string, subjectId: string) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { getAuthMadrasaId } = await import("./students");
  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) {
    return { error: "No Madrasa exists in the system." };
  }

  const { createAdminClient } = await import("@/lib/supabase/server");
  const adminClient = await createAdminClient();

  const { error } = await adminClient.from("teacher_subjects").insert({
    madrasa_id: finalMadrasaId,
    teacher_id: teacherId,
    class_id: classId,
    subject_id: subjectId,
  });

  if (error) {
    if (error.code === '23505') {
      return { error: "Subject is already assigned to this teacher for this class." };
    }
    return { error: error.message };
  }

  revalidatePath(`/dashboard/teachers/${teacherId}/subjects`);
  return { success: true };
}

export async function removeSubjectFromTeacher(teacherSubjectId: string, teacherId: string) {
  const { createAdminClient } = await import("@/lib/supabase/server");
  const adminClient = await createAdminClient();
  const { error } = await adminClient
    .from("teacher_subjects")
    .delete()
    .eq("id", teacherSubjectId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/dashboard/teachers/${teacherId}/subjects`);
  return { success: true };
}
