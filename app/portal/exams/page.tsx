import { createClient } from "@/lib/supabase/server";
import {
  Award,
  Calendar,
  FileText,
  TrendingUp,
  Printer,
  CheckCircle2,
  AlertCircle,
  GraduationCap,
} from "lucide-react";
import Link from "next/link";
import { toBanglaNumber } from "@/lib/numberToBangla";

export const dynamic = "force-dynamic";

export default async function ParentPortalExams(props: {
  searchParams?: Promise<{ student_id?: string; exam_id?: string }>;
}) {
  const params = props.searchParams ? (await props.searchParams) || {} : {};
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: userData } = await supabase
    .from("users")
    .select("madrasa_id")
    .eq("id", user.id)
    .single();
  const madrasaId = userData?.madrasa_id;

  const { getUserDataAccessScope } = await import("@/lib/data-access-guards");
  const scope = await getUserDataAccessScope();

  let studentsQuery = supabase
    .from("students")
    .select("id, first_name, last_name, roll_number, class_name, classes(name)")
    .order("roll_number", { ascending: true });

  if (!scope.isUnrestricted && scope.allowedStudentIds.length > 0) {
    studentsQuery = studentsQuery.in("id", scope.allowedStudentIds);
  } else if (madrasaId) {
    studentsQuery = studentsQuery.eq("madrasa_id", madrasaId);
  }

  const { data: fetchedStudents } = await studentsQuery;
  let students = fetchedStudents || [];

  if (students.length === 0) {
    const { data: fallbackStudents } = await supabase
      .from("students")
      .select("id, first_name, last_name, roll_number, class_name, classes(name)")
      .limit(5);
    students = fallbackStudents || [];
  }

  if (students.length === 0) {
    return (
      <div className="p-8 bg-white rounded-2xl border border-slate-200 text-center text-slate-500">
        কোন শিক্ষার্থী পাওয়া যায়নি।
      </div>
    );
  }

  const selectedStudentId = params.student_id || students[0].id;
  const child = students.find((s) => s.id === selectedStudentId) || students[0];

  // Fetch all exams for this madrasa
  const { data: exams } = await supabase
    .from("exams")
    .select("id, title, year, start_date, status")
    .eq("madrasa_id", madrasaId)
    .order("start_date", { ascending: false });

  const selectedExamId = params.exam_id || exams?.[0]?.id;

  // Fetch results for this student
  let resultsQuery = supabase
    .from("exam_results")
    .select("*, exams(id, title, year, start_date, status)")
    .eq("student_id", child.id);

  if (selectedExamId) {
    resultsQuery = resultsQuery.eq("exam_id", selectedExamId);
  }

  const { data: results } = await resultsQuery;

  // Calculate totals
  const totalObtained = results?.reduce((sum, r) => sum + (Number(r.marks_obtained) || 0), 0) || 0;
  const totalMax = results?.reduce((sum, r) => sum + (Number(r.total_marks) || 100), 0) || 0;
  const percentage = totalMax > 0 ? Math.round((totalObtained / totalMax) * 100) : 0;

  // Grade determination helper
  const getGrade = (pct: number) => {
    if (pct >= 80) return { grade: "A+ (মুমতাজ)", color: "text-emerald-700 bg-emerald-50 border-emerald-200" };
    if (pct >= 70) return { grade: "A (জায়্যিদ জিদ্দান)", color: "text-blue-700 bg-blue-50 border-blue-200" };
    if (pct >= 60) return { grade: "A- (জায়্যিদ)", color: "text-indigo-700 bg-indigo-50 border-indigo-200" };
    if (pct >= 50) return { grade: "B (মাকবুল)", color: "text-amber-700 bg-amber-50 border-amber-200" };
    if (pct >= 33) return { grade: "C (উত্তীর্ণ)", color: "text-orange-700 bg-orange-50 border-orange-200" };
    return { grade: "F (অনুত্তীর্ণ)", color: "text-red-700 bg-red-50 border-red-200" };
  };

  const gradeInfo = getGrade(percentage);
  const currentExam = exams?.find((e) => e.id === selectedExamId);

  return (
    <div className="space-y-6">
      {/* Header with Child Switcher */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-50 text-purple-700 rounded-xl">
              <Award className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">পরীক্ষা ও ফলাফল বিবরণী</h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            শিক্ষার্থী: <strong className="text-slate-800">{child.first_name} {child.last_name}</strong> (রোল: {toBanglaNumber(child.roll_number || "-")})
          </p>
        </div>

        {students.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            {students.map((s: any) => (
              <Link
                key={s.id}
                href={`/portal/exams?student_id=${s.id}${selectedExamId ? `&exam_id=${selectedExamId}` : ""}`}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                  s.id === child.id
                    ? "bg-purple-700 text-white shadow-xs"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                }`}
              >
                {s.first_name} {s.last_name}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Exam Selector Tabs */}
      {exams && exams.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {exams.map((exam) => (
            <Link
              key={exam.id}
              href={`/portal/exams?student_id=${child.id}&exam_id=${exam.id}`}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition cursor-pointer ${
                exam.id === selectedExamId
                  ? "bg-purple-700 text-white shadow-xs"
                  : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              {exam.title || (exam as any).name} ({toBanglaNumber(exam.year || "২০২৬")})
            </Link>
          ))}
        </div>
      )}

      {/* Overall Performance Card */}
      <div className="bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 text-white rounded-3xl p-5 sm:p-6 shadow-md border border-purple-900/60 flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div>
          <span className="text-xs font-bold text-purple-300 uppercase tracking-wider block mb-1">
            সামগ্রিক পরীক্ষার মূল্যায়ন
          </span>
          <h2 className="text-xl sm:text-2xl font-bold">
            {currentExam?.title || "সাময়িক পরীক্ষা ফলাফল"}
          </h2>
          <p className="text-xs text-purple-200 mt-1">
            মোট প্রাপ্ত নম্বর: <strong>{toBanglaNumber(totalObtained)} / {toBanglaNumber(totalMax)}</strong> ({toBanglaNumber(percentage)}%)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-4 py-3 bg-white/10 backdrop-blur-xs border border-white/20 rounded-2xl text-center">
            <span className="text-[10px] text-purple-200 uppercase font-bold block">প্রাপ্ত বিভাগ</span>
            <span className="text-lg sm:text-xl font-extrabold text-amber-300">{gradeInfo.grade}</span>
          </div>
        </div>
      </div>

      {/* Marksheet Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-purple-600" />
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">বিষয়ভিত্তিক নম্বর ও গ্রেড বিবরণী</h3>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="px-4 py-3.5">বিষয়ের নাম</th>
                <th className="px-4 py-3.5">পূর্ণমান (Total)</th>
                <th className="px-4 py-3.5">প্রাপ্ত নম্বর (Obtained)</th>
                <th className="px-4 py-3.5">শতকরা হার (%)</th>
                <th className="px-4 py-3.5 text-right">গ্রেড / বিভাগ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {results && results.length > 0 ? (
                results.map((r) => {
                  const maxM = Number(r.total_marks) || 100;
                  const obtM = Number(r.marks_obtained) || 0;
                  const pct = Math.round((obtM / maxM) * 100);
                  const subGrade = getGrade(pct);

                  return (
                    <tr key={r.id} className="hover:bg-slate-50/60 transition">
                      <td className="px-4 py-3 font-bold text-slate-800">
                        {r.subject_name || "বিষয়"}
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-xs sm:text-sm">
                        {toBanglaNumber(maxM)}
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900 text-sm">
                        {toBanglaNumber(obtM)}
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-xs sm:text-sm">
                        {toBanglaNumber(pct)}%
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold border ${subGrade.color}`}>
                          {subGrade.grade}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-slate-400 text-sm">
                    এই পরীক্ষার ফলাফল এখনো প্রকাশিত হয়নি।
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
