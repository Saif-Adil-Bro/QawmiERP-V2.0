import { createClient } from "@/lib/supabase/server";
import ExamMarksForm from "./ExamMarksForm";

export default async function TeacherExamsPage(props: { searchParams?: Promise<{ exam_id?: string, class_id?: string, subject_name?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: userData } = await supabase.from("users").select("madrasa_id").eq("id", user.id).single();
  const madrasaId = userData?.madrasa_id;

  // Await search params
  const awaitedSearchParams = props.searchParams ? (await props.searchParams) || {} : {};
  
  const { getUserDataAccessScope } = await import("@/lib/data-access-guards");
  const scope = await getUserDataAccessScope();

  const { data: exams } = await supabase.from("exams").select("id, title, year").eq("madrasa_id", madrasaId).order("start_date", { ascending: false });

  let classesQuery = supabase.from("classes").select("id, name").eq("madrasa_id", madrasaId).order("name");

  if (!scope.isUnrestricted && scope.userRole === "teacher") {
    if (scope.allowedClassIds.length === 0) {
      return (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Exam Marks Entry</h1>
            <p className="text-slate-500">Enter marks for students by selecting the exam, class, and subject.</p>
          </div>
          <div className="p-8 bg-white rounded-2xl border border-slate-200 text-center text-slate-500">
            আপনাকে কোনো ক্লাস অর্পণ করা হয়নি। নম্বর দেওয়ার অনুমতি পাওয়া যায়নি।
          </div>
        </div>
      );
    }
    classesQuery = classesQuery.in("id", scope.allowedClassIds);
  }

  const { data: classes } = await classesQuery;
  
  const examId = awaitedSearchParams?.exam_id || (exams?.[0]?.id || "");
  const classId = awaitedSearchParams?.class_id || (classes?.[0]?.id || "");
  const subjectName = awaitedSearchParams?.subject_name || "Quran";

  let students: any[] = [];
  let existingMarks: any[] = [];

  if (classId && examId) {
    const { data: s } = await supabase.from("students").select("id, first_name, last_name, roll_number").eq("class_id", classId).order("roll_number");
    students = s || [];

    const { data: m } = await supabase.from("exam_results").select("*").in("student_id", students.map(st => st.id)).eq("exam_id", examId).eq("subject_name", subjectName);
    existingMarks = m || [];
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Exam Marks Entry</h1>
        <p className="text-slate-500">Enter marks for students by selecting the exam, class, and subject.</p>
      </div>

      <ExamMarksForm 
        exams={exams || []}
        classes={classes || []} 
        students={students} 
        existingMarks={existingMarks}
        currentExamId={examId}
        currentClassId={classId}
        currentSubject={subjectName}
        madrasaId={madrasaId}
      />
    </div>
  );
}
