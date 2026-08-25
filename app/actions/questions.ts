"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getAuthMadrasaId } from "./students";
import postgres from "postgres";

let isTableChecked = false;

async function ensureExamPapersTable() {
  if (isTableChecked) return;
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.log("No DATABASE_URL found in process.env");
    return;
  }
  try {
    const sql = postgres(dbUrl);
    // Create the exam_papers table if it doesn't exist
    await sql`
      CREATE TABLE IF NOT EXISTS public.exam_papers (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        madrasa_id UUID,
        exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE,
        class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
        subject_id UUID REFERENCES public.subjects(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        total_marks INTEGER NOT NULL DEFAULT 100,
        exam_time TEXT DEFAULT '',
        exam_name TEXT DEFAULT '',
        questions JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
        UNIQUE(exam_id, class_id, subject_id)
      );
    `;

    // Ensure columns exam_time and exam_name exist (for compatibility if table was created earlier without them)
    await sql`
      ALTER TABLE public.exam_papers 
      ADD COLUMN IF NOT EXISTS exam_time TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS exam_name TEXT DEFAULT '';
    `;

    // Enable Row Level Security
    await sql`ALTER TABLE public.exam_papers ENABLE ROW LEVEL SECURITY;`;

    // Create policy for multi-tenant isolation
    await sql`
      DROP POLICY IF EXISTS "Users can manage exam papers in same madrasa" ON public.exam_papers;
    `;
    await sql`
      CREATE POLICY "Users can manage exam papers in same madrasa" ON public.exam_papers
        FOR ALL USING (madrasa_id = public.get_auth_madrasa_id());
    `;

    await sql.end();
    isTableChecked = true;
    console.log("Successfully verified and configured exam_papers table in DB.");
  } catch (err) {
    console.error("Error ensuring exam_papers table exists:", err);
  }
}

export async function getQuestions(classId?: string, subjectId?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("question_bank")
    .select(`*, class:classes(name), subject:subjects(name)`);

  if (classId) query = query.eq("class_id", classId);
  if (subjectId) query = query.eq("subject_id", subjectId);

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) {
    console.error("Error fetching questions:", error);
    return [];
  }
  return data || [];
}

export async function saveQuestion(data: {
  class_id: string;
  subject_id: string;
  question_type: string;
  question_text: string;
  options?: any;
  marks: number;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };
  const madrasaId = await getAuthMadrasaId(supabase, user);

  const { error } = await supabase.from("question_bank").insert({
    ...data,
    madrasa_id: madrasaId,
  });

  if (error) {
    console.error("Error saving question:", error);
    return { error: error.message };
  }
  revalidatePath(`/dashboard/exams/question-bank`);
  return { success: true };
}

export async function deleteQuestion(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("question_bank").delete().eq("id", id);
  if (error) {
    console.error("Error deleting question:", error);
    return { error: error.message };
  }
  revalidatePath(`/dashboard/exams/question-bank`);
  return { success: true };
}

export async function getExamPaper(examId: string, classId: string, subjectId: string) {
  await ensureExamPapersTable();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exam_papers")
    .select("*")
    .eq("exam_id", examId)
    .eq("class_id", classId)
    .eq("subject_id", subjectId)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Error fetching exam paper:", error);
  }
  return data || null;
}

export async function saveExamPaper(data: {
  exam_id: string;
  class_id: string;
  subject_id: string;
  title: string;
  total_marks: number;
  exam_time?: string;
  exam_name?: string;
  questions: any;
}) {
  await ensureExamPapersTable();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };
  const madrasaId = await getAuthMadrasaId(supabase, user);

  const existing = await getExamPaper(data.exam_id, data.class_id, data.subject_id);
  
  if (existing) {
    const { error } = await supabase.from("exam_papers")
      .update({
        title: data.title,
        total_marks: data.total_marks,
        exam_time: data.exam_time || "",
        exam_name: data.exam_name || "",
        questions: data.questions
      })
      .eq("id", existing.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("exam_papers").insert({
      exam_id: data.exam_id,
      class_id: data.class_id,
      subject_id: data.subject_id,
      title: data.title,
      total_marks: data.total_marks,
      exam_time: data.exam_time || "",
      exam_name: data.exam_name || "",
      questions: data.questions,
      madrasa_id: madrasaId,
    });
    if (error) return { error: error.message };
  }

  revalidatePath(`/dashboard/exams/${data.exam_id}/paper`);
  return { success: true };
}
