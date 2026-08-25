"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getAuthMadrasaId } from "./students";

export async function getKitabStudents() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Fetch only Kitab students (Maktab, Ibtidaia, Mutawassita, Sanawiya, Fadilat, Takmil)
  // or generally exclude Hifz/Nazira
  const { data, error } = await supabase
    .from("students")
    .select("id, first_name, last_name, roll_number, class_name")
    .not("class_name", "ilike", "%Hifz%")
    .order("class_name")
    .order("roll_number");

  if (error) {
    console.error("Error fetching Kitab students:", error);
    return [];
  }
  return data;
}

export async function getKitabLogs(studentId: string, limit = 10) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kitab_logs")
    .select(`
      *,
      teachers (first_name, last_name)
    `)
    .eq("student_id", studentId)
    .order("log_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return [];
  return data;
}

export async function createKitabLog(prevState: any, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return { error: "Madrasa not found" };

  const studentId = formData.get("student_id") as string;
  const logDate = formData.get("log_date") as string;
  const kitabName = formData.get("kitab_name") as string;
  const pageFrom = formData.get("page_from") as string;
  const pageTo = formData.get("page_to") as string;
  const performance = formData.get("performance_rating") as string;
  const notes = formData.get("notes") as string;

  if (!studentId || !logDate || !kitabName) {
    return { error: "তারিখ এবং কিতাবের নাম আবশ্যক।" };
  }

  const { error } = await supabase.from("kitab_logs").insert({
    madrasa_id: finalMadrasaId,
    student_id: studentId,
    log_date: logDate,
    kitab_name: kitabName,
    page_from: pageFrom || null,
    page_to: pageTo || null,
    performance_rating: performance || null,
    notes: notes || null,
  });

  if (error) {
    console.error("Error creating kitab log:", error);
    return { error: error.message };
  }

  revalidatePath("/dashboard", "layout");
  return { success: true };
}

export async function deleteKitabLog(logId: string, studentId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("kitab_logs")
    .delete()
    .eq("id", logId);

  if (error) {
    console.error("Error deleting kitab log:", error);
    return { error: error.message };
  }

  revalidatePath("/dashboard", "layout");
  return { success: true };
}
