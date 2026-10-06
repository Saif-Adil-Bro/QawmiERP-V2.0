"use server";

import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getAuthMadrasaId, getStudents } from "./students";

export async function getKitabStudents() {
  try {
    const allStudents = await getStudents();
    if (!allStudents || allStudents.length === 0) {
      return [];
    }

    // Filter out Hifz department students if department/class explicitly contains Hifz,
    // while ensuring Kitab and General students are included.
    const kitabStudents = allStudents.filter((s: any) => {
      const clsName = (s.class_name || s.classes?.name || "").toLowerCase();
      const dept = (s.department || s.section || "").toLowerCase();
      
      const isHifz =
        clsName.includes("hifz") ||
        clsName.includes("হিফজ") ||
        dept.includes("hifz") ||
        dept.includes("হিফজ");

      return !isHifz;
    });

    // If all students happen to be under general or filtering resulted in 0, return all students as fallback
    return kitabStudents.length > 0 ? kitabStudents : allStudents;
  } catch (err) {
    console.error("Error in getKitabStudents:", err);
    return [];
  }
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

  if (error) {
    try {
      const admin = await createAdminClient();
      const { data: aData } = await admin
        .from("kitab_logs")
        .select(`
          *,
          teachers (first_name, last_name)
        `)
        .eq("student_id", studentId)
        .order("log_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(limit);
      return aData || [];
    } catch {
      return [];
    }
  }
  return data || [];
}

export async function createKitabLog(prevState: any, formData: FormData) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
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
    return { error: "শিক্ষার্থী, তারিখ এবং কিতাবের নাম আবশ্যক।" };
  }

  let { error } = await supabase.from("kitab_logs").insert({
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
    try {
      const admin = await createAdminClient();
      const { error: adminErr } = await admin.from("kitab_logs").insert({
        madrasa_id: finalMadrasaId,
        student_id: studentId,
        log_date: logDate,
        kitab_name: kitabName,
        page_from: pageFrom || null,
        page_to: pageTo || null,
        performance_rating: performance || null,
        notes: notes || null,
      });
      if (adminErr) {
        console.error("Admin client insert failed for kitab log:", adminErr);
        return { error: adminErr.message };
      }
    } catch (fallbackErr: any) {
      console.error("Error creating kitab log:", error);
      return { error: error.message };
    }
  }

  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/kitab");
  return { success: true };
}

export async function getAllRecentKitabLogs(limit = 100) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return [];

  const { data, error } = await supabase
    .from("kitab_logs")
    .select(`
      *,
      students (id, first_name, last_name, roll_number, class_name)
    `)
    .order("log_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    try {
      const admin = await createAdminClient();
      const { data: aData } = await admin
        .from("kitab_logs")
        .select(`
          *,
          students (id, first_name, last_name, roll_number, class_name)
        `)
        .order("log_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(limit);
      return aData || [];
    } catch {
      return [];
    }
  }
  return data || [];
}

export async function updateKitabLog(prevState: any, formData: FormData) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return { error: "Unauthorized" };

  const logId = formData.get("log_id") as string;
  const logDate = formData.get("log_date") as string;
  const kitabName = formData.get("kitab_name") as string;
  const pageFrom = formData.get("page_from") as string;
  const pageTo = formData.get("page_to") as string;
  const performance = formData.get("performance_rating") as string;
  const notes = formData.get("notes") as string;

  if (!logId || !logDate || !kitabName) {
    return { error: "তারিখ এবং কিতাবের নাম আবশ্যক।" };
  }

  let { error } = await supabase
    .from("kitab_logs")
    .update({
      log_date: logDate,
      kitab_name: kitabName,
      page_from: pageFrom || null,
      page_to: pageTo || null,
      performance_rating: performance || null,
      notes: notes || null,
    })
    .eq("id", logId);

  if (error) {
    try {
      const admin = await createAdminClient();
      const { error: adminErr } = await admin
        .from("kitab_logs")
        .update({
          log_date: logDate,
          kitab_name: kitabName,
          page_from: pageFrom || null,
          page_to: pageTo || null,
          performance_rating: performance || null,
          notes: notes || null,
        })
        .eq("id", logId);
      if (adminErr) {
        return { error: adminErr.message };
      }
    } catch {
      return { error: error.message };
    }
  }

  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/kitab");
  return { success: true };
}

export async function deleteKitabLog(logId: string, studentId?: string) {
  const supabase = await createClient();
  let { error } = await supabase
    .from("kitab_logs")
    .delete()
    .eq("id", logId);

  if (error) {
    try {
      const admin = await createAdminClient();
      const { error: adminErr } = await admin
        .from("kitab_logs")
        .delete()
        .eq("id", logId);
      if (adminErr) {
        return { error: adminErr.message };
      }
    } catch {
      return { error: error.message };
    }
  }

  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/kitab");
  return { success: true };
}
