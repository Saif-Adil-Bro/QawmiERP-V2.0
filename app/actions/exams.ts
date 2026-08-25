"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getAuthMadrasaId } from "./students";

export async function getExams() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return [];

  const { data, error } = await supabase
    .from("exams")
    .select("*")
    .eq('madrasa_id', finalMadrasaId)
    .order("start_date", { ascending: false });

  if (error) {
    console.error("Error fetching exams:", error);
    return [];
  }
  return data;
}

export async function getExamById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exams")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching exam:", error);
    return null;
  }
  return data;
}

export async function createExam(prevState: any, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return { error: "Madrasa not found" };

  const title = formData.get("title") as string;
  const year = formData.get("year") as string;
  const start_date = formData.get("start_date") as string;
  const status = formData.get("status") as string;

  if (!title || !year) {
    return { error: "পরীক্ষার নাম এবং বছর আবশ্যক।" };
  }

  const { error } = await supabase.from("exams").insert({
    madrasa_id: finalMadrasaId,
    title,
    year,
    start_date: start_date || null,
    status: status || 'Upcoming'
  });

  if (error) {
    console.error("Error creating exam:", error);
    return { error: error.message };
  }

  revalidatePath("/dashboard/exams");
  return { success: true };
}

export async function deleteExam(examId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("exams").delete().eq("id", examId);

  if (error) {
    console.error("Error deleting exam:", error);
    return { error: error.message };
  }

  revalidatePath("/dashboard/exams");
  return { success: true };
}

export async function getStudentsByClass(classId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return [];

  const { data, error } = await supabase
    .from("students")
    .select("id, first_name, last_name, roll_number, class_id")
    .eq("madrasa_id", finalMadrasaId)
    .eq("class_id", classId)
    .order("roll_number", { ascending: true });

  if (error) return [];
  return data;
}

export async function getExamResults(examId: string, classId: string, subjectName: string) {
  const supabase = await createClient();
  
  // Get all students of the class
  const students = await getStudentsByClass(classId);
  if (!students.length) return [];

  // Get marks for these students
  const { data: results, error } = await supabase
    .from("exam_results")
    .select("*")
    .eq("exam_id", examId)
    .eq("subject_name", subjectName)
    .in("student_id", students.map(s => s.id));

  const marksMap = new Map();
  results?.forEach(r => {
    marksMap.set(r.student_id, { marks: r.marks_obtained, total: r.total_marks });
  });

  return students.map(s => ({
    ...s,
    marks_obtained: marksMap.get(s.id)?.marks || '',
    total_marks: marksMap.get(s.id)?.total || 100
  }));
}

export async function saveExamMarks(examId: string, subjectName: string, marksData: { student_id: string, marks_obtained: number, total_marks: number }[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return { error: "Madrasa not found" };

  const recordsToUpsert = marksData.map(record => ({
    madrasa_id: finalMadrasaId,
    exam_id: examId,
    student_id: record.student_id,
    subject_name: subjectName,
    marks_obtained: record.marks_obtained,
    total_marks: record.total_marks
  }));

  const { error } = await supabase
    .from("exam_results")
    .upsert(recordsToUpsert, { onConflict: 'exam_id, student_id, subject_name' });

  if (error) {
    console.error("Error saving marks:", error);
    return { error: error.message };
  }

  revalidatePath(`/dashboard/exams/${examId}/marks`);
  return { success: true };
}

export async function getStudentReportCard(examId: string, classId?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return [];
  
  let studentsQuery = supabase
    .from("students")
    .select("id, first_name, last_name, roll_number, class_id, classes(name)")
    .eq("madrasa_id", finalMadrasaId);
    
  if (classId) {
    studentsQuery = studentsQuery.eq("class_id", classId);
  }
  
  const { data: students, error: studentsError } = await studentsQuery.order('roll_number');
  
  if (studentsError || !students.length) return [];

  const { data: results, error: resultsError } = await supabase
    .from("exam_results")
    .select("*")
    .eq("exam_id", examId)
    .in("student_id", students.map(s => s.id));
    
  if (resultsError) return [];

  // Group results by student
  const studentResults = students.map(student => {
    const studentMarks = results.filter(r => r.student_id === student.id);
    const totalObtained = studentMarks.reduce((sum, r) => sum + Number(r.marks_obtained), 0);
    const totalMax = studentMarks.reduce((sum, r) => sum + Number(r.total_marks), 0);
    const percentage = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;
    
    return {
      ...student,
      class_name: Array.isArray(student.classes) ? student.classes[0]?.name : (student.classes as any)?.name,
      marks: studentMarks,
      totalObtained,
      totalMax,
      percentage: percentage.toFixed(2),
      grade: calculateGrade(percentage)
    };
  });

  return studentResults;
}

function calculateGrade(percentage: number) {
  if (percentage >= 80) return "মুমতাজ (A+)";
  if (percentage >= 70) return "জায়্যিদ জিদ্দান (A)";
  if (percentage >= 60) return "জায়্যিদ (B)";
  if (percentage >= 45) return "মাকবুল (C)";
  if (percentage >= 33) return "উত্তীর্ণ (D)";
  return "রাসিব (Fail)";
}

export async function getExamSubjects(examId: string, classId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exam_subjects")
    .select("*")
    .eq("exam_id", examId)
    .eq("class_id", classId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching exam subjects:", error);
    return [];
  }
  return data;
}

export async function saveExamSubjects(examId: string, classId: string, subjectsData: any[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };
  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return { error: "Madrasa not found" };

  await supabase
    .from("exam_subjects")
    .delete()
    .eq("exam_id", examId)
    .eq("class_id", classId);

  const recordsToInsert = subjectsData.map(record => ({
    madrasa_id: finalMadrasaId,
    exam_id: examId,
    class_id: classId,
    subject_name: record.subject_name,
    total_marks: record.total_marks,
    pass_marks: record.pass_marks,
    exam_type: record.exam_type
  }));

  if (recordsToInsert.length > 0) {
    const { error } = await supabase
      .from("exam_subjects")
      .insert(recordsToInsert);

    if (error) {
      console.error("Error saving exam subjects:", error);
      return { error: error.message };
    }
  }

  return { success: true };
}
