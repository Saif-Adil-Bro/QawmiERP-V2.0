"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getAuthMadrasaId } from "./students";

export async function getHifzStudents(classId?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  let query = supabase
    .from("students")
    .select("id, first_name, last_name, roll_number, class_id, classes!inner(name)")
    .order("roll_number");

  if (classId && classId !== "All") {
    query = query.eq("class_id", classId);
  } else {
    // If no class selected, maybe try to match 'hifz' in class name as default or just return all
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching Hifz students:", error);
    return [];
  }
  return data;
}

export async function getHifzLogs(studentId: string, limit = 10) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("hifz_logs")
    .select(`*`)
    .eq("student_id", studentId)
    .order("log_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching hifz logs:", error);
    return [];
  }
  return data;
}

export async function createHifzLog(prevState: any, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return { error: "Madrasa not found" };

  const studentId = formData.get("student_id") as string;
  const logDate = formData.get("log_date") as string;
  const sabakPara = formData.get("sabak_para") as string;
  const sabakPage = formData.get("sabak_page") as string;
  const sabokiPara = formData.get("saboki_para") as string;
  const amukhtaPara = formData.get("amukhta_para") as string;
  const performance = formData.get("performance_rating") as string;
  const rawNotes = formData.get("notes") as string;
  const dailyTilawat = formData.get("daily_tilawat") as string;

  if (!studentId || !logDate) {
    return { error: "Student and Date are required." };
  }

  let finalNotes = rawNotes || "";
  if (dailyTilawat) {
    const tilawatText = `তেলাওয়াত: ${dailyTilawat}`;
    finalNotes = finalNotes ? `${tilawatText} | ${finalNotes}` : tilawatText;
  }

  const { error } = await supabase.from("hifz_logs").insert({
    madrasa_id: finalMadrasaId,
    student_id: studentId,
    log_date: logDate,
    sabak_para: sabakPara ? parseInt(sabakPara) : null,
    sabak_page: sabakPage ? parseInt(sabakPage) : null,
    saboki_para: sabokiPara ? parseInt(sabokiPara) : null,
    amukhta_para: amukhtaPara ? parseInt(amukhtaPara) : null,
    performance_rating: performance || null,
    notes: finalNotes || null,
  });

  if (error) {
    console.error("Error creating hifz log:", error);
    return { error: error.message };
  }

  revalidatePath("/dashboard", "layout");
  return { success: true };
}

export async function deleteHifzLog(logId: string, studentId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("hifz_logs")
    .delete()
    .eq("id", logId);

  if (error) {
    console.error("Error deleting hifz log:", error);
    return { error: error.message };
  }

  revalidatePath("/dashboard", "layout");
  return { success: true };
}
