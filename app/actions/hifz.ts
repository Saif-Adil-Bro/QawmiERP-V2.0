"use server";

import { createClient, getAuthUser } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getAuthMadrasaId } from "./students";
import {
  HifzLogMeta,
  parseHifzLogNotes,
  buildHifzLogNotes,
  calculateHifzPages,
  getHifzLogPagesCount,
  buildStudentHifzReportFromLogs,
} from "@/lib/hifz-utils";

export type { HifzLogMeta };

export async function parseHifzLogNotesAction(rawNotes?: string | null) {
  return parseHifzLogNotes(rawNotes);
}

export async function calculateHifzPagesAction(startPage?: number | string | null, endPage?: number | string | null) {
  return calculateHifzPages(startPage, endPage);
}

export async function getHifzLogPagesCountAction(startPage?: number | string | null, endPage?: number | string | null) {
  return getHifzLogPagesCount(startPage, endPage);
}

export async function getHifzStudents(classId?: string) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return [];

  const finalMadrasaId = await getAuthMadrasaId(supabase, user);

  let query = supabase
    .from("students")
    .select("id, first_name, last_name, roll_number, class_id, classes(name)")
    .order("roll_number");

  if (finalMadrasaId) {
    query = query.eq("madrasa_id", finalMadrasaId);
  }

  if (classId && classId !== "All") {
    query = query.eq("class_id", classId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching Hifz students:", error);
    return [];
  }

  return (data || []).sort(
    (a: any, b: any) =>
      (parseInt(a.roll_number) || 999999) - (parseInt(b.roll_number) || 999999)
  );
}

export async function getHifzLogs(studentId: string, limit = 20) {
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

  return (data || []).map((log: any) => {
    const parsed = parseHifzLogNotes(log.notes);
    return {
      ...log,
      clean_notes: parsed.cleanNotes,
      daily_tilawat: parsed.tilawatText,
      meta: parsed.meta,
      hifz_stage: parsed.meta.stage || "HIFZ",
      sabak_page_from: parsed.meta.sabak_page_from ?? log.sabak_page,
      sabak_page_to: parsed.meta.sabak_page_to ?? log.sabak_page,
      sabak_lines: parsed.meta.sabak_lines || "",
      is_sabak_paused: Boolean(parsed.meta.is_sabak_paused),
      saboki_pages: parsed.meta.saboki_pages || "",
      amukhta_amount: parsed.meta.amukhta_amount || "",
      mistake_count: parsed.meta.mistake_count ?? 0,
    };
  });
}

export async function createHifzLog(prevState: any, formData: FormData) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return { error: "Unauthorized" };

  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return { error: "Madrasa not found" };

  const studentId = formData.get("student_id") as string;
  const logDate = formData.get("log_date") as string;

  const hifzStage = (formData.get("hifz_stage") as string) || "HIFZ";
  const sabakPara = formData.get("sabak_para") as string;
  const sabakPage = formData.get("sabak_page") as string;
  const sabakPageFrom = formData.get("sabak_page_from") as string;
  const sabakPageTo = formData.get("sabak_page_to") as string;
  const sabakLines = formData.get("sabak_lines") as string;
  const isSabakPaused = formData.get("is_sabak_paused") === "true" || formData.get("is_sabak_paused") === "on";

  const sabokiPara = formData.get("saboki_para") as string;
  const sabokiPages = formData.get("saboki_pages") as string;

  const amukhtaPara = formData.get("amukhta_para") as string;
  const amukhtaAmount = formData.get("amukhta_amount") as string;
  const mistakeCount = formData.get("mistake_count") as string;

  const performance = formData.get("performance_rating") as string;
  const rawNotes = formData.get("notes") as string;
  const dailyTilawat = formData.get("daily_tilawat") as string;

  if (!studentId || !logDate) {
    return { error: "Student and Date are required." };
  }

  const primaryPage = sabakPageFrom ? parseInt(sabakPageFrom) : (sabakPage ? parseInt(sabakPage) : null);

  const meta: HifzLogMeta = {
    stage: hifzStage as any,
    sabak_page_from: sabakPageFrom ? parseInt(sabakPageFrom) : primaryPage,
    sabak_page_to: sabakPageTo ? parseInt(sabakPageTo) : primaryPage,
    sabak_lines: sabakLines || "",
    is_sabak_paused: isSabakPaused,
    saboki_pages: sabokiPages || "",
    amukhta_amount: amukhtaAmount || "",
    mistake_count: mistakeCount ? parseInt(mistakeCount) : 0,
  };

  const finalNotes = buildHifzLogNotes({
    rawNotes,
    dailyTilawat,
    meta,
  });

  const { error } = await supabase.from("hifz_logs").insert({
    madrasa_id: finalMadrasaId,
    student_id: studentId,
    log_date: logDate,
    sabak_para: sabakPara ? parseInt(sabakPara) : null,
    sabak_page: primaryPage,
    saboki_para: sabokiPara ? parseInt(sabokiPara) : null,
    amukhta_para: amukhtaPara ? parseInt(amukhtaPara) : null,
    performance_rating: performance || null,
    notes: finalNotes,
  });

  if (error) {
    console.error("Error creating hifz log:", error);
    return { error: error.message };
  }

  revalidatePath("/dashboard", "layout");
  revalidatePath(`/dashboard/hifz/${studentId}`);
  return { success: true };
}

export async function updateHifzLog(logId: string, prevState: any, formData: FormData) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return { error: "Unauthorized" };

  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return { error: "Madrasa not found" };

  const logDate = formData.get("log_date") as string;

  const hifzStage = (formData.get("hifz_stage") as string) || "HIFZ";
  const sabakPara = formData.get("sabak_para") as string;
  const sabakPage = formData.get("sabak_page") as string;
  const sabakPageFrom = formData.get("sabak_page_from") as string;
  const sabakPageTo = formData.get("sabak_page_to") as string;
  const sabakLines = formData.get("sabak_lines") as string;
  const isSabakPaused = formData.get("is_sabak_paused") === "true" || formData.get("is_sabak_paused") === "on";

  const sabokiPara = formData.get("saboki_para") as string;
  const sabokiPages = formData.get("saboki_pages") as string;

  const amukhtaPara = formData.get("amukhta_para") as string;
  const amukhtaAmount = formData.get("amukhta_amount") as string;
  const mistakeCount = formData.get("mistake_count") as string;

  const performance = formData.get("performance_rating") as string;
  const rawNotes = formData.get("notes") as string;
  const dailyTilawat = formData.get("daily_tilawat") as string;

  if (!logId || !logDate) {
    return { error: "Log ID and Date are required." };
  }

  const primaryPage = sabakPageFrom ? parseInt(sabakPageFrom) : (sabakPage ? parseInt(sabakPage) : null);

  const meta: HifzLogMeta = {
    stage: hifzStage as any,
    sabak_page_from: sabakPageFrom ? parseInt(sabakPageFrom) : primaryPage,
    sabak_page_to: sabakPageTo ? parseInt(sabakPageTo) : primaryPage,
    sabak_lines: sabakLines || "",
    is_sabak_paused: isSabakPaused,
    saboki_pages: sabokiPages || "",
    amukhta_amount: amukhtaAmount || "",
    mistake_count: mistakeCount ? parseInt(mistakeCount) : 0,
  };

  const finalNotes = buildHifzLogNotes({
    rawNotes,
    dailyTilawat,
    meta,
  });

  const { error } = await supabase
    .from("hifz_logs")
    .update({
      log_date: logDate,
      sabak_para: sabakPara ? parseInt(sabakPara) : null,
      sabak_page: primaryPage,
      saboki_para: sabokiPara ? parseInt(sabokiPara) : null,
      amukhta_para: amukhtaPara ? parseInt(amukhtaPara) : null,
      performance_rating: performance || null,
      notes: finalNotes,
    })
    .eq("id", logId)
    .eq("madrasa_id", finalMadrasaId);

  if (error) {
    console.error("Error updating hifz log:", error);
    return { error: error.message };
  }

  revalidatePath("/dashboard", "layout");
  return { success: true };
}

export async function deleteHifzLog(logId: string, studentId: string) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return { error: "Unauthorized" };

  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return { error: "Madrasa not found" };

  const { error } = await supabase
    .from("hifz_logs")
    .delete()
    .eq("id", logId)
    .eq("madrasa_id", finalMadrasaId);

  if (error) {
    console.error("Error deleting hifz log:", error);
    return { error: error.message };
  }

  revalidatePath("/dashboard", "layout");
  revalidatePath(`/dashboard/hifz/${studentId}`);
  return { success: true };
}

export async function getStudentHifzReport(studentId: string, month?: string, year?: string) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return null;

  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return null;

  const { data: student } = await supabase
    .from("students")
    .select("id, first_name, last_name, roll_number, class_id, classes(name)")
    .eq("id", studentId)
    .single();

  if (!student) return null;

  const { getMadrasaMetadata } = await import("@/lib/sessions");
  const meta = await getMadrasaMetadata(finalMadrasaId);
  const studentProfile = meta?.student_profiles?.[studentId] || {};

  const { data: allStudentLogs } = await supabase
    .from("hifz_logs")
    .select("*")
    .eq("student_id", studentId)
    .order("log_date", { ascending: false });

  return buildStudentHifzReportFromLogs({
    student,
    allStudentLogs: allStudentLogs || [],
    studentProfile,
    targetMonth: month,
    targetYear: year,
  });
}

export async function getMonthlyHifzSummary(classId?: string, month?: string, year?: string) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return { month: month || "", year: year || "", reports: [] };

  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return { month: month || "", year: year || "", reports: [] };

  const students = await getHifzStudents(classId);
  if (!students || students.length === 0) {
    return {
      month: month || new Date().toISOString().slice(5, 7),
      year: year || new Date().getFullYear().toString(),
      reports: [],
    };
  }

  const studentIds = students.map((s: any) => s.id);

  // Single bulk query for all students' hifz logs (Optimized N+1 fix)
  const { data: allLogs } = await supabase
    .from("hifz_logs")
    .select("*")
    .in("student_id", studentIds)
    .order("log_date", { ascending: false });

  // Single fetch for madrasa metadata (Optimized N+1 fix)
  const { getMadrasaMetadata } = await import("@/lib/sessions");
  const meta = await getMadrasaMetadata(finalMadrasaId);
  const profilesMap = meta?.student_profiles || {};

  // Group logs by student_id
  const logsByStudent = new Map<string, any[]>();
  (allLogs || []).forEach((log: any) => {
    if (!logsByStudent.has(log.student_id)) {
      logsByStudent.set(log.student_id, []);
    }
    logsByStudent.get(log.student_id)!.push(log);
  });

  const targetMonth = month || new Date().toISOString().slice(5, 7);
  const targetYear = year || new Date().getFullYear().toString();

  const reports = students.map((student: any) => {
    const studentLogs = logsByStudent.get(student.id) || [];
    const studentProfile = profilesMap[student.id] || {};

    return buildStudentHifzReportFromLogs({
      student,
      allStudentLogs: studentLogs,
      studentProfile,
      targetMonth,
      targetYear,
    });
  });

  return {
    month: targetMonth,
    year: targetYear,
    reports: reports.filter(Boolean),
  };
}
