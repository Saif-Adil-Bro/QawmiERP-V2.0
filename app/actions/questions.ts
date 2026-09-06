"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getAuthMadrasaId } from "./students";
import postgres from "postgres";

let isTableChecked = false;
let isQuestionBankChecked = false;

async function ensureQuestionBankColumns() {
  if (isQuestionBankChecked) return;
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) return;
  try {
    const sql = postgres(dbUrl);
    await sql`
      ALTER TABLE public.question_bank 
      ADD COLUMN IF NOT EXISTS chapter TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS difficulty TEXT DEFAULT 'medium';
    `;
    await sql.end();
    isQuestionBankChecked = true;
    console.log("Successfully verified and configured question_bank columns (chapter, difficulty) in DB.");
  } catch (err) {
    console.error("Error ensuring question_bank columns exist:", err);
  }
}

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
        academic_year TEXT DEFAULT '',
        is_archived BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
        UNIQUE(exam_id, class_id, subject_id)
      );
    `;

    // Ensure columns exam_time, exam_name, academic_year, is_archived, updated_at exist
    await sql`
      ALTER TABLE public.exam_papers 
      ADD COLUMN IF NOT EXISTS exam_time TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS exam_name TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS academic_year TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW());
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

export async function getQuestions(
  classId?: string, 
  subjectId?: string,
  chapter?: string,
  difficulty?: string
) {
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

  let result = (data || []).map((q: any) => ({
    ...q,
    chapter: q.chapter || q.options?.chapter || "",
    difficulty: q.difficulty || q.options?.difficulty || "medium",
  }));

  if (chapter && chapter.trim() !== "") {
    result = result.filter((q: any) => 
      q.chapter && q.chapter.toLowerCase().includes(chapter.trim().toLowerCase())
    );
  }

  if (difficulty && difficulty.trim() !== "") {
    result = result.filter((q: any) => q.difficulty === difficulty.trim());
  }

  return result;
}

export async function saveQuestion(data: {
  class_id: string;
  subject_id: string;
  question_type: string;
  question_text: string;
  options?: any;
  marks: number;
  chapter?: string;
  difficulty?: "easy" | "medium" | "hard" | string;
}) {
  await ensureQuestionBankColumns();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };
  const madrasaId = await getAuthMadrasaId(supabase, user);

  const chapterVal = data.chapter || data.options?.chapter || "";
  const difficultyVal = data.difficulty || data.options?.difficulty || "medium";

  const optionsPayload = {
    ...(data.options || {}),
    chapter: chapterVal,
    difficulty: difficultyVal,
  };

  // Attempt insert with direct columns first
  const { error } = await supabase.from("question_bank").insert({
    class_id: data.class_id,
    subject_id: data.subject_id,
    question_type: data.question_type,
    question_text: data.question_text,
    marks: data.marks,
    chapter: chapterVal,
    difficulty: difficultyVal,
    options: optionsPayload,
    madrasa_id: madrasaId,
  });

  if (error) {
    console.warn("Retrying saveQuestion without direct columns:", error.message);
    const retry = await supabase.from("question_bank").insert({
      class_id: data.class_id,
      subject_id: data.subject_id,
      question_type: data.question_type,
      question_text: data.question_text,
      marks: data.marks,
      options: optionsPayload,
      madrasa_id: madrasaId,
    });
    if (retry.error) {
      console.error("Error saving question:", retry.error);
      return { error: retry.error.message };
    }
  }

  revalidatePath(`/dashboard/exams/question-bank`);
  return { success: true };
}

export async function updateQuestion(
  id: string,
  data: {
    class_id: string;
    subject_id: string;
    question_type: string;
    question_text: string;
    options?: any;
    marks: number;
    chapter?: string;
    difficulty?: "easy" | "medium" | "hard" | string;
  }
) {
  await ensureQuestionBankColumns();
  const supabase = await createClient();
  const chapterVal = data.chapter || data.options?.chapter || "";
  const difficultyVal = data.difficulty || data.options?.difficulty || "medium";

  const optionsPayload = {
    ...(data.options || {}),
    chapter: chapterVal,
    difficulty: difficultyVal,
  };

  const { error } = await supabase
    .from("question_bank")
    .update({
      class_id: data.class_id,
      subject_id: data.subject_id,
      question_type: data.question_type,
      question_text: data.question_text,
      marks: data.marks,
      chapter: chapterVal,
      difficulty: difficultyVal,
      options: optionsPayload,
    })
    .eq("id", id);

  if (error) {
    console.warn("Retrying updateQuestion without direct columns:", error.message);
    const retry = await supabase
      .from("question_bank")
      .update({
        class_id: data.class_id,
        subject_id: data.subject_id,
        question_type: data.question_type,
        question_text: data.question_text,
        marks: data.marks,
        options: optionsPayload,
      })
      .eq("id", id);

    if (retry.error) {
      console.error("Error updating question:", retry.error);
      return { error: retry.error.message };
    }
  }

  revalidatePath(`/dashboard/exams/question-bank`);
  return { success: true };
}

export async function bulkSaveQuestions(questionsList: Array<{
  class_id: string;
  subject_id: string;
  question_type: string;
  question_text: string;
  marks: number;
  chapter?: string;
  difficulty?: "easy" | "medium" | "hard" | string;
  options?: any;
}>) {
  await ensureQuestionBankColumns();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "অননুমোদিত অ্যাক্সেস (Unauthorized)" };
  const madrasaId = await getAuthMadrasaId(supabase, user);

  if (!questionsList || questionsList.length === 0) {
    return { error: "কোনো প্রশ্ন প্রদান করা হয়নি।" };
  }

  const rows = questionsList.map(q => {
    const chapterVal = q.chapter || q.options?.chapter || "";
    const difficultyVal = q.difficulty || q.options?.difficulty || "medium";
    const opts = {
      ...(q.options || {}),
      chapter: chapterVal,
      difficulty: difficultyVal,
    };
    return {
      class_id: q.class_id,
      subject_id: q.subject_id,
      question_type: q.question_type || "Broad",
      question_text: q.question_text,
      marks: Number(q.marks) || 10,
      chapter: chapterVal,
      difficulty: difficultyVal,
      options: opts,
      madrasa_id: madrasaId,
    };
  });

  // Attempt bulk insert
  const { data: inserted, error } = await supabase
    .from("question_bank")
    .insert(rows)
    .select();

  if (error) {
    console.warn("Retrying bulk insert with fallback options:", error.message);
    const fallbackRows = rows.map(r => ({
      class_id: r.class_id,
      subject_id: r.subject_id,
      question_type: r.question_type,
      question_text: r.question_text,
      marks: r.marks,
      options: r.options,
      madrasa_id: r.madrasa_id,
    }));
    const retry = await supabase.from("question_bank").insert(fallbackRows).select();
    if (retry.error) {
      console.error("Bulk save error:", retry.error);
      return { error: retry.error.message };
    }
    revalidatePath(`/dashboard/exams/question-bank`);
    return { success: true, count: retry.data?.length || fallbackRows.length, questions: retry.data };
  }

  revalidatePath(`/dashboard/exams/question-bank`);
  return { success: true, count: inserted?.length || rows.length, questions: inserted };
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
  revalidatePath(`/dashboard/exams/archives`);
  return { success: true };
}

export async function getArchivedExamPapers(filters?: {
  year?: string;
  examId?: string;
  classId?: string;
  subjectId?: string;
  search?: string;
}) {
  await ensureExamPapersTable();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const madrasaId = await getAuthMadrasaId(supabase, user);
  if (!madrasaId) return [];

  let query = supabase
    .from("exam_papers")
    .select(`
      *,
      exam:exams(id, title, year, start_date, status),
      class:classes(id, name),
      subject:subjects(id, name, code)
    `)
    .eq("madrasa_id", madrasaId)
    .order("created_at", { ascending: false });

  if (filters?.examId) query = query.eq("exam_id", filters.examId);
  if (filters?.classId) query = query.eq("class_id", filters.classId);
  if (filters?.subjectId) query = query.eq("subject_id", filters.subjectId);

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching archived exam papers:", error);
    return [];
  }

  let result = (data || []).map((paper: any) => {
    const qData = paper.questions || {};
    let totalQuestionsCount = 0;
    let sectionsCount = 0;
    const questionTypesBreakdown: Record<string, number> = {};
    const sectionNames: string[] = [];

    if (qData.is_sectioned && Array.isArray(qData.sections)) {
      sectionsCount = qData.sections.length;
      qData.sections.forEach((sec: any) => {
        sectionNames.push(sec.name || "");
        (sec.questions || []).forEach((q: any) => {
          totalQuestionsCount++;
          const type = q.question_type || "Broad";
          questionTypesBreakdown[type] = (questionTypesBreakdown[type] || 0) + 1;
        });
      });
    } else if (Array.isArray(qData)) {
      totalQuestionsCount = qData.length;
      qData.forEach((q: any) => {
        const type = q.question_type || "Broad";
        questionTypesBreakdown[type] = (questionTypesBreakdown[type] || 0) + 1;
      });
    } else if (Array.isArray(qData.questions)) {
      totalQuestionsCount = qData.questions.length;
      qData.questions.forEach((q: any) => {
        const type = q.question_type || "Broad";
        questionTypesBreakdown[type] = (questionTypesBreakdown[type] || 0) + 1;
      });
    }

    const academicYear = paper.academic_year || paper.exam?.year || (paper.created_at ? new Date(paper.created_at).getFullYear().toString() : "");

    return {
      ...paper,
      academic_year: academicYear,
      total_questions_count: totalQuestionsCount,
      sections_count: sectionsCount,
      section_names: sectionNames,
      question_types_breakdown: questionTypesBreakdown,
    };
  });

  if (filters?.year && filters.year.trim() !== "") {
    result = result.filter(p => p.academic_year === filters.year || p.exam?.year === filters.year);
  }

  if (filters?.search && filters.search.trim() !== "") {
    const searchLower = filters.search.toLowerCase().trim();
    result = result.filter(p => {
      return (
        (p.title && p.title.toLowerCase().includes(searchLower)) ||
        (p.exam_name && p.exam_name.toLowerCase().includes(searchLower)) ||
        (p.exam?.title && p.exam.title.toLowerCase().includes(searchLower)) ||
        (p.class?.name && p.class.name.toLowerCase().includes(searchLower)) ||
        (p.subject?.name && p.subject.name.toLowerCase().includes(searchLower)) ||
        (p.academic_year && p.academic_year.includes(searchLower))
      );
    });
  }

  return result;
}

export async function cloneExamPaper(params: {
  sourcePaperId: string;
  targetExamId: string;
  targetClassId?: string;
  targetSubjectId?: string;
  newTitle?: string;
  newExamName?: string;
  newExamTime?: string;
  totalMarks?: number;
  syncToQuestionBank?: boolean;
  selectedQuestionIds?: string[];
}) {
  await ensureExamPapersTable();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "অননুমোদিত অ্যাক্সেস (Unauthorized)" };
  const madrasaId = await getAuthMadrasaId(supabase, user);

  // 1. Fetch source paper
  const { data: sourcePaper, error: fetchErr } = await supabase
    .from("exam_papers")
    .select(`*, exam:exams(title, year)`)
    .eq("id", params.sourcePaperId)
    .single();

  if (fetchErr || !sourcePaper) {
    return { error: "সোর্স প্রশ্নপত্রটি খুঁজে পাওয়া যায়নি।" };
  }

  // 2. Fetch target exam details
  const { data: targetExam } = await supabase
    .from("exams")
    .select("id, title, year")
    .eq("id", params.targetExamId)
    .single();

  const finalClassId = params.targetClassId || sourcePaper.class_id;
  const finalSubjectId = params.targetSubjectId || sourcePaper.subject_id;
  const finalTitle = params.newTitle || `${targetExam?.title || "পরীক্ষা"} - ${targetExam?.year || ""}`;
  const finalExamName = params.newExamName || targetExam?.title || sourcePaper.exam_name || "";
  const finalExamTime = params.newExamTime || sourcePaper.exam_time || "২ ঘণ্টা ৩০ মিনিট";
  const finalTotalMarks = params.totalMarks || sourcePaper.total_marks || 100;

  // Process & clone questions JSON structure with freshly generated local IDs
  let rawQuestions = sourcePaper.questions;
  let clonedQuestions: any = rawQuestions;

  if (rawQuestions && typeof rawQuestions === "object") {
    if (rawQuestions.is_sectioned && Array.isArray(rawQuestions.sections)) {
      clonedQuestions = {
        ...rawQuestions,
        sections: rawQuestions.sections.map((sec: any, sIdx: number) => {
          let questionsInSec = sec.questions || [];
          if (params.selectedQuestionIds && params.selectedQuestionIds.length > 0) {
            questionsInSec = questionsInSec.filter((q: any) =>
              params.selectedQuestionIds!.includes(String(q.id))
            );
          }
          return {
            ...sec,
            id: `cloned-sec-${Date.now()}-${sIdx}`,
            questions: questionsInSec.map((q: any, qIdx: number) => ({
              ...q,
              id: `cloned-q-${Date.now()}-${sIdx}-${qIdx}`,
              class_id: finalClassId,
              subject_id: finalSubjectId,
            }))
          };
        })
      };
    } else if (Array.isArray(rawQuestions)) {
      let qList = rawQuestions;
      if (params.selectedQuestionIds && params.selectedQuestionIds.length > 0) {
        qList = qList.filter((q: any) => params.selectedQuestionIds!.includes(String(q.id)));
      }
      clonedQuestions = qList.map((q: any, qIdx: number) => ({
        ...q,
        id: `cloned-q-${Date.now()}-${qIdx}`,
        class_id: finalClassId,
        subject_id: finalSubjectId,
      }));
    }
  }

  // 3. Save or update into exam_papers for targetExamId + class + subject
  const existingTarget = await getExamPaper(params.targetExamId, finalClassId, finalSubjectId);

  let targetPaperId: string;
  if (existingTarget) {
    const { data: updated, error: updateErr } = await supabase
      .from("exam_papers")
      .update({
        title: finalTitle,
        total_marks: finalTotalMarks,
        exam_time: finalExamTime,
        exam_name: finalExamName,
        questions: clonedQuestions,
        academic_year: targetExam?.year || "",
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingTarget.id)
      .select()
      .single();

    if (updateErr) return { error: updateErr.message };
    targetPaperId = existingTarget.id;
  } else {
    const { data: inserted, error: insertErr } = await supabase
      .from("exam_papers")
      .insert({
        exam_id: params.targetExamId,
        class_id: finalClassId,
        subject_id: finalSubjectId,
        title: finalTitle,
        total_marks: finalTotalMarks,
        exam_time: finalExamTime,
        exam_name: finalExamName,
        questions: clonedQuestions,
        academic_year: targetExam?.year || "",
        madrasa_id: madrasaId,
      })
      .select()
      .single();

    if (insertErr) return { error: insertErr.message };
    targetPaperId = inserted.id;
  }

  // 4. Optionally sync cloned questions to question bank if requested
  if (params.syncToQuestionBank) {
    const questionsToSync: any[] = [];
    if (clonedQuestions?.is_sectioned && Array.isArray(clonedQuestions?.sections)) {
      clonedQuestions.sections.forEach((sec: any) => {
        (sec.questions || []).forEach((q: any) => questionsToSync.push(q));
      });
    } else if (Array.isArray(clonedQuestions)) {
      clonedQuestions.forEach((q: any) => questionsToSync.push(q));
    }

    if (questionsToSync.length > 0) {
      const bankRows = questionsToSync.map((q: any) => ({
        class_id: finalClassId,
        subject_id: finalSubjectId,
        question_type: q.question_type || "Broad",
        question_text: q.question_text,
        marks: Number(q.marks) || 10,
        chapter: q.chapter || q.options?.chapter || "",
        difficulty: q.difficulty || q.options?.difficulty || "medium",
        options: q.options || {},
        madrasa_id: madrasaId,
      }));
      await supabase.from("question_bank").insert(bankRows);
    }
  }

  revalidatePath(`/dashboard/exams/${params.targetExamId}/paper`);
  revalidatePath(`/dashboard/exams/archives`);
  revalidatePath(`/dashboard/exams/question-bank`);

  return {
    success: true,
    paperId: targetPaperId,
    targetExamId: params.targetExamId,
    classId: finalClassId,
    subjectId: finalSubjectId,
  };
}

export async function deleteExamPaper(paperId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("exam_papers").delete().eq("id", paperId);
  if (error) {
    console.error("Error deleting exam paper:", error);
    return { error: error.message };
  }
  revalidatePath(`/dashboard/exams/archives`);
  return { success: true };
}

export async function toggleArchivePaper(paperId: string, isArchived: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("exam_papers")
    .update({ is_archived: isArchived })
    .eq("id", paperId);
  if (error) {
    console.error("Error toggling paper archive state:", error);
    return { error: error.message };
  }
  revalidatePath(`/dashboard/exams/archives`);
  return { success: true };
}

export async function getPastPapersForSubject(classId: string, subjectId: string, excludeExamId?: string) {
  await ensureExamPapersTable();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const madrasaId = await getAuthMadrasaId(supabase, user);
  if (!madrasaId) return [];

  let query = supabase
    .from("exam_papers")
    .select(`
      *,
      exam:exams(id, title, year, start_date, status),
      class:classes(id, name),
      subject:subjects(id, name, code)
    `)
    .eq("madrasa_id", madrasaId)
    .eq("class_id", classId)
    .eq("subject_id", subjectId)
    .order("created_at", { ascending: false });

  if (excludeExamId) {
    query = query.neq("exam_id", excludeExamId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching past papers for subject:", error);
    return [];
  }

  return data || [];
}

export async function seedSampleQuestionsForSubject(classId: string, subjectId: string) {
  await ensureQuestionBankColumns();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };
  const madrasaId = await getAuthMadrasaId(supabase, user);

  const sampleQuestions = [
    {
      class_id: classId,
      subject_id: subjectId,
      question_type: "Broad",
      question_text: "ইলমে হাদীসের পরিভাষায় ‘মুতাওয়াতির’ ও ‘খবরে ওয়াহিদ’ বলতে কী বোঝায়? উভয়ের প্রকারভেদ, হুকুম ও গ্রহণযোগ্যতার শর্তাবলী বিস্তারিত আলোচনা কর।",
      marks: 10,
      chapter: "مقدمة علم الحديث (উসূলে হাদীস)",
      difficulty: "hard",
      options: { chapter: "مقدمة علم الحديث (উসূলে হাদীস)", difficulty: "hard" },
    },
    {
      class_id: classId,
      subject_id: subjectId,
      question_type: "Broad",
      question_text: "কিতাবুল বুয়ূ এর আলোকে ‘বায়য়ে সহীহ’, ‘বায়য়ে ফাসিদ’ ও ‘বায়য়ে বাতেল’-এর মধ্যকার পার্থক্য ও প্রতিটি প্রকারের শারঈ বিধান বিশদভাবে বর্ণনা কর।",
      marks: 10,
      chapter: "كتاب البيوع (মুআমালাত ও ব্যবসা)",
      difficulty: "medium",
      options: { chapter: "كتاب البيوع (মুআমালাত ও ব্যবসা)", difficulty: "medium" },
    },
    {
      class_id: classId,
      subject_id: subjectId,
      question_type: "Broad",
      question_text: "নাহুর পরিভাষায় ‘তারকীব’ ও ‘মামূল’-এর প্রকারভেদ কয়টি ও কী কী? উদাহরণসহ বিস্তারিত আলোচনা কর।",
      marks: 10,
      chapter: "باب العوامل والمفاعيل (নাহু)",
      difficulty: "medium",
      options: { chapter: "باب العوامل والمفاعيل (নাহু)", difficulty: "medium" },
    },
    {
      class_id: classId,
      subject_id: subjectId,
      question_type: "Broad",
      question_text: "তাফসিরে বির-রায় এবং তাফসিরে বিল-মাছুর-এর পরিচয় দিয়ে তাফসির শাস্ত্রের গ্রহণযোগ্য মূলনীতিসমূহ ব্যাখ্যা কর।",
      marks: 10,
      chapter: "أصول التفسير (উসূলে তাফসীর)",
      difficulty: "hard",
      options: { chapter: "أصول التفسير (উসূলে তাফসীর)", difficulty: "hard" },
    },
    {
      class_id: classId,
      subject_id: subjectId,
      question_type: "Short",
      question_text: "‘মুদাল্লাস’ হাদীস কাকে বলে? তাদুলীসের প্রধান দুটি কারণ উল্লেখ কর।",
      marks: 5,
      chapter: "مقدمة علم الحديث (উসূলে হাদীস)",
      difficulty: "medium",
      options: { chapter: "مقدمة علم الحديث (উসূলে হাদীস)", difficulty: "medium" },
    },
    {
      class_id: classId,
      subject_id: subjectId,
      question_type: "Short",
      question_text: "সাহু সিজদার ওয়াজিব হওয়ার তিনটি কারণ সংক্ষেপে লেখ।",
      marks: 5,
      chapter: "كتاب الصلاة (নামাজ)",
      difficulty: "easy",
      options: { chapter: "كتاب الصلاة (নামাজ)", difficulty: "easy" },
    },
    {
      class_id: classId,
      subject_id: subjectId,
      question_type: "Short",
      question_text: "আমিল ও মামূলের পারিভাষিক সংজ্ঞা দাও।",
      marks: 5,
      chapter: "باب العوامل والمفاعيل (নাহু)",
      difficulty: "easy",
      options: { chapter: "باب العوامل والمفاعيل (নাহু)", difficulty: "easy" },
    },
    {
      class_id: classId,
      subject_id: subjectId,
      question_type: "Short",
      question_text: "মুফরাদ ও মুরাক্কাব কাকে বলে? উদাহরণ দাও।",
      marks: 5,
      chapter: "مبادئ العربية (নাহু ও বালাগাত)",
      difficulty: "easy",
      options: { chapter: "مبادئ العربية (নাহু ও বালাগাত)", difficulty: "easy" },
    },
    {
      class_id: classId,
      subject_id: subjectId,
      question_type: "Short",
      question_text: "যাকাত ওয়াজিব হওয়ার প্রধান শর্তাবলী সংক্ষেপে লেখ।",
      marks: 5,
      chapter: "كتاب الزكاة (যাকাত)",
      difficulty: "easy",
      options: { chapter: "كتاب الزكاة (যাকাত)", difficulty: "easy" },
    },
    {
      class_id: classId,
      subject_id: subjectId,
      question_type: "Irab",
      question_text: "أعرب الكلمات التي تحتها خط في العبارة الآتية مع الضبط بالشكل وبيان موقعها الإعرابي:",
      marks: 10,
      chapter: "إعراب القرآن والحديث (এরাব)",
      difficulty: "hard",
      options: {
        chapter: "إعراب القرآن والحديث (এরাব)",
        difficulty: "hard",
        irab_text: "إِنَّمَا يَخْشَى اللَّهَ مِنْ عِبَادِهِ الْعُلَمَاءُ، وَإِنَّ الدِّينَ عِنْدَ اللَّهِ الْإِسْلَامُ، وَمَنْ يَبْتَغِ غَيْرَ الْإِسْلَامِ دِينًا فَلَنْ يُقْبَلَ مِنْهُ",
        target_words: "اللهَ، الْعُلَمَاءُ، دِينًا"
      },
    },
    {
      class_id: classId,
      subject_id: subjectId,
      question_type: "Tahqeeq",
      question_text: "حقق الكلمات الآتية ببيان الصيغة والبحث والباب والمصدر والمادة:",
      marks: 5,
      chapter: "علم الصرف والإعلال (ছরফ)",
      difficulty: "medium",
      options: {
        chapter: "علم الصرف والإعلال (ছরফ)",
        difficulty: "medium",
        tahqeeq_words: ["يَنْصُرُونَ", "اِسْتَغْفَرَ", "تُسَبِّحُونَ", "مُسْتَقِيمٌ", "لَا تَقْنَطُوا"]
      },
    },
    {
      class_id: classId,
      subject_id: subjectId,
      question_type: "Broad",
      question_text: "নিম্নোক্ত নসের প্রাঞ্জল বঙ্গানুবাদ ও ব্যাখ্যা লেখ:",
      marks: 10,
      chapter: "كتاب العلم والفضل (হাদীস)",
      difficulty: "medium",
      options: {
        chapter: "كتاب العلم والفضل (হাদীস)",
        difficulty: "medium",
        irab_text: "طَلَبُ الْعِلْمِ فَرِيضَةٌ عَلَى كُلِّ مُسْلِمٍ، وَإِنَّ الْمَلَائِكَةَ لَتَضَعُ أَجْنِحَتَهَا لِطَالِبِ الْعِلْمِ رِضًا بِمَا يَصْنَعُ"
      },
    },
    {
      class_id: classId,
      subject_id: subjectId,
      question_type: "Broad",
      question_text: "নিম্নোক্ত হাদিসটির তরজমা ও মূল শিক্ষা বিস্তারিত বর্ণনা কর:",
      marks: 10,
      chapter: "كتاب الإيمان والنية (হাদীস)",
      difficulty: "easy",
      options: {
        chapter: "كتاب الإيمان والنية (হাদীস)",
        difficulty: "easy",
        irab_text: "إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ، وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى، فَمَنْ كَانَتْ هِجْرَتُهُ إِلَى دُنْيَا يُصِيبُهَا أَوْ إِلَى امْرَأَةٍ يَنْكِحُهَا فَهِجْرَتُهُ إِلَى مَا هَاجَرَ إِلَيْهِ"
      },
    },
    {
      class_id: classId,
      subject_id: subjectId,
      question_type: "Masala",
      question_text: "নিম্নোক্ত সুরতহালের ফিকহি সমাধান ও দলীল বিশদভাবে লেখ:",
      marks: 10,
      chapter: "كتاب الصلاة (নামাজ ও সাহু সিজদা)",
      difficulty: "hard",
      options: {
        chapter: "كتاب الصلاة (নামাজ ও সাহু সিজদা)",
        difficulty: "hard",
        scenario: "এক ব্যক্তি জোহরের চার রাকাত ফরজ নামাজ পড়ার সময় প্রথম বৈঠকে তাশাহহুদ না পড়ে ভুলবশত ৩য় রাকাতে দাঁড়িয়ে গেল এবং সুরা ফাতিহা পড়ে রুকুতে চলে গেল।",
        sub_questions: [
          "১) এমতাবস্থায় সে কি পুনরায় প্রথম বৈঠকে ফিরে আসবে নাকি নামাজ চালিয়ে যাবে?",
          "২) এই অবস্থায় সাহু সিজদা কখন এবং কীভাবে আদায় করতে হবে? দলীলসহ ব্যাখ্যা কর।"
        ]
      },
    },
    {
      class_id: classId,
      subject_id: subjectId,
      question_type: "Sher",
      question_text: "اشرح الأبيات الآتية شرحاً وافياً مع ترجمة المفردات وبيان المعنى الإجمالي:",
      marks: 10,
      chapter: "ديوان الحماسة والمتنبي (আদব)",
      difficulty: "hard",
      options: {
        chapter: "ديوان الحماسة والمتنبي (আদব)",
        difficulty: "hard",
        poet_name: "أبو الطيب المتنبي",
        verses: [
          { first: "إذا غامَرْتَ في شَرَفٍ مَرُومِ", second: "فَلا تَقْنَعْ بما دونَ النّجومِ" },
          { first: "فَطَعْمُ المَوْتِ في أمْرٍ حَقِيرٍ", second: "كطَعْمِ المَوْتِ في أمْرٍ عَظِيمِ" }
        ]
      },
    },
  ];

  const formattedRows = sampleQuestions.map(q => ({
    ...q,
    madrasa_id: madrasaId,
  }));

  // Attempt insert with direct columns
  let { data: inserted, error } = await supabase
    .from("question_bank")
    .insert(formattedRows)
    .select();

  if (error) {
    console.warn("Retrying sample questions insert without direct columns:", error.message);
    const fallbackRows = formattedRows.map(r => ({
      class_id: r.class_id,
      subject_id: r.subject_id,
      question_type: r.question_type,
      question_text: r.question_text,
      marks: r.marks,
      options: r.options,
      madrasa_id: r.madrasa_id,
    }));
    const retry = await supabase.from("question_bank").insert(fallbackRows).select();
    if (retry.error) {
      console.error("Error seeding sample questions:", retry.error);
      return { error: retry.error.message };
    }
    inserted = retry.data;
  }

  revalidatePath(`/dashboard/exams/question-bank`);
  return { success: true, count: inserted?.length || 0, questions: inserted };
}

