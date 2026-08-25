"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getAuthMadrasaId } from "./students";

export async function getExamRoutines(examId: string, classId?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("exam_routines")
    .select(`
      *,
      subject:subjects(name),
      class:classes(name)
    `)
    .eq("exam_id", examId);

  if (classId) {
    query = query.eq("class_id", classId);
  }

  const { data, error } = await query.order("exam_date", { ascending: true }).order("start_time", { ascending: true });

  if (error) {
    console.error("Error fetching exam routines:", error);
    return [];
  }
  return data || [];
}

export async function saveExamRoutine(data: {
  exam_id: string;
  class_id: string;
  subject_id: string;
  exam_date: string;
  start_time: string;
  end_time: string;
  room_number: string;
}) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };
  const madrasaId = await getAuthMadrasaId(supabase, user);

  const { error } = await supabase.from("exam_routines").insert({
    exam_id: data.exam_id,
    class_id: data.class_id,
    subject_id: data.subject_id,
    exam_date: data.exam_date,
    start_time: data.start_time,
    end_time: data.end_time,
    room_number: data.room_number,
    madrasa_id: madrasaId,
  });

  if (error) {
    console.error("Error saving exam routine:", error);
    return { error: error.message };
  }
  revalidatePath(`/dashboard/exams/${data.exam_id}/routine`);
  return { success: true };
}

export async function deleteExamRoutine(id: string, examId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("exam_routines").delete().eq("id", id);
  if (error) {
    console.error("Error deleting exam routine:", error);
    return { error: error.message };
  }
  revalidatePath(`/dashboard/exams/${examId}/routine`);
  return { success: true };
}
