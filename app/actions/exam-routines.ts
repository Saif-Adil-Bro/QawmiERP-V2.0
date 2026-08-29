"use server";

import { createClient, getAuthUser } from "@/lib/supabase/server";
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
  
  const user = await getAuthUser(supabase);
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
  revalidatePath("/dashboard/exams");
  revalidatePath(`/dashboard/exams/${data.exam_id}`);
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
  revalidatePath("/dashboard/exams");
  revalidatePath(`/dashboard/exams/${examId}`);
  revalidatePath(`/dashboard/exams/${examId}/routine`);
  return { success: true };
}

export async function publishExamRoutineNotice(
  examId: string,
  options?: { target_audience?: string; custom_note?: string; custom_title?: string }
) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return { error: "অননুমোদিত অ্যাক্সেস (Unauthorized)" };

  const madrasaId = await getAuthMadrasaId(supabase, user);
  if (!madrasaId) return { error: "মাদরাসা আইডি পাওয়া যায়নি" };

  // Fetch exam info
  const { data: exam, error: examError } = await supabase
    .from("exams")
    .select("title, year")
    .eq("id", examId)
    .single();

  if (examError || !exam) {
    return { error: "পরীক্ষার তথ্য পাওয়া যায়নি" };
  }

  // Fetch routines
  const routines = await getExamRoutines(examId);
  if (!routines || routines.length === 0) {
    return { error: "রুটিনে কোনো বিষয় এন্ট্রি করা হয়নি। অনুগ্রহ করে আগে অন্তত একটি রুটিন যুক্ত করুন।" };
  }

  const daysBangla = ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার"];
  const title = options?.custom_title || `${exam.title} (${exam.year}) - পরীক্ষার রুটিন ও সময়সূচি`;

  let scheduleText = `আসসালামু আলাইকুম,\n\nসম্মানিত শিক্ষক, অভিভাবক ও ছাত্রবৃন্দ,\n'${exam.title} (${exam.year})'-এর পরীক্ষার সময়সূচি ও কক্ষ বণ্টন প্রকাশ করা হলো:\n\n`;
  scheduleText += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  scheduleText += `📅 পরীক্ষার সময়সূচি তালিকা:\n`;
  scheduleText += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

  routines.forEach((r, idx) => {
    let dayName = "";
    if (r.exam_date) {
      const d = new Date(r.exam_date + "T00:00:00");
      if (!isNaN(d.getTime())) {
        dayName = daysBangla[d.getDay()] || "";
      }
    }
    const dateFormatted = dayName ? `${r.exam_date} (${dayName})` : r.exam_date;
    const timeFormatted = `${r.start_time || ""} - ${r.end_time || ""}`;
    const className = (r.class as any)?.name || "সকল জামাত";
    const subjectName = (r.subject as any)?.name || "বিষয়";
    const room = r.room_number ? ` | কক্ষ নং: ${r.room_number}` : "";

    scheduleText += `${idx + 1}. তারিখ: ${dateFormatted}\n   সময়: ${timeFormatted}\n   জামাত: ${className} | বিষয়: ${subjectName}${room}\n\n`;
  });

  if (options?.custom_note) {
    scheduleText += `\n📌 বিশেষ দ্রষ্টব্য:\n${options.custom_note}\n\n`;
  } else {
    scheduleText += `\n📌 বিশেষ নির্দেশনাবলী:\n- সকল পরীক্ষার্থীকে পরীক্ষা শুরুর ১৫ মিনিট পূর্বে স্ব-স্ব পরীক্ষা কক্ষে উপস্থিত থাকার জন্য নির্দেশ দেওয়া হচ্ছে।\n- প্রবেশপত্র সাথে আনা বাধ্যতামূলক।\n\n`;
  }

  scheduleText += `ধন্যবাদ,\nমাদরাসা কর্তৃপক্ষ`;

  const targetAudience = options?.target_audience || "All";

  const { error: insertError } = await supabase.from("notices").insert({
    madrasa_id: madrasaId,
    title,
    content: scheduleText,
    target_audience: targetAudience,
  });

  if (insertError) {
    console.error("Error publishing notice:", insertError);
    return { error: insertError.message };
  }

  revalidatePath("/dashboard/communication/notices");
  revalidatePath("/portal/notices");
  revalidatePath("/teacher-portal/notices");
  revalidatePath(`/dashboard/exams/${examId}/routine`);

  return { success: true, message: "পরীক্ষার রুটিন সফলভাবে নোটিশ বোর্ডে প্রকাশ করা হয়েছে!" };
}

