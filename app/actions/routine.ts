"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthMadrasaId } from "./students";

export async function addRoutine(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  
  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) throw new Error("Madrasa ID not found");

  const class_id = formData.get("class_id") as string;
  const subject_id = formData.get("subject_id") as string;
  const teacher_id = formData.get("teacher_id") as string;
  const day_of_week = formData.get("day_of_week") as string;
  const start_time = formData.get("start_time") as string;
  const end_time = formData.get("end_time") as string;
  const room_number = formData.get("room_number") as string;
  const routine_type = formData.get("routine_type") as string;

  const { error } = await supabase.from("routines").insert({
    madrasa_id: finalMadrasaId,
    class_id,
    subject_id: subject_id || null,
    teacher_id: teacher_id || null,
    day_of_week,
    start_time,
    end_time,
    room_number,
    routine_type,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/academic/routine");
  revalidatePath("/dashboard/academic/routine/builder");
}

export async function deleteRoutine(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("routines").delete().eq("id", id);
  
  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard/academic/routine");
  revalidatePath("/dashboard/academic/routine/builder");
}
