import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Plus, Search, Edit2, User, GraduationCap, Calendar, Eye } from "lucide-react";
import { StudentDeleteButton } from "@/components/students/student-actions";
import { StudentSearch } from "@/components/students/student-search";
import { getStudentIdNumber, convertToBanglaNumber } from "@/lib/student-utils";
import { getAcademicSessions, getCurrentSession } from "@/app/actions/sessions";

export const metadata = {
  title: "শিক্ষার্থী তালিকা | QawmiERP",
};

export default async function StudentsPage(props: {
  searchParams?: Promise<{ q?: string; session?: string }>;
}) {
  const resolvedSearchParams = props.searchParams ? (await props.searchParams) || {} : {};
  const query = resolvedSearchParams?.q || "";

  const [supabase, sessions, currentSession] = await Promise.all([
    createClient(),
    getAcademicSessions(),
    getCurrentSession(),
  ]);

  let supabaseQuery = supabase
    .from("students")
    .select("*, classes(*)")
    .order("created_at", { ascending: false });

  if (query) {
    supabaseQuery = supabaseQuery.or(
      `first_name.ilike.%${query}%,last_name.ilike.%${query}%,roll_number.ilike.%${query}%`
    );
  }

  const { data: students } = await supabaseQuery;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">শিক্ষার্থী</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            সকল নিবন্ধিত শিক্ষার্থীর তালিকা ও একাডেমিক প্রোফাইল
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/dashboard/students/promotion"
            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center space-x-2 transition"
          >
            <GraduationCap className="w-4 h-4 text-emerald-600" />
            <span>শিক্ষার্থী প্রমোশন</span>
          </Link>

          <Link
            href="/dashboard/students/new"
            className="bg-slate-900 text-white px-4 py-2 rounded-xl hover:bg-slate-800 flex items-center space-x-2 text-xs sm:text-sm font-semibold transition shadow-2xs"
          >
            <Plus className="w-4 h-4" />
            <span>নতুন শিক্ষার্থী</span>
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-slate-50/50">
          <StudentSearch />

          {currentSession && (
            <div className="flex items-center gap-2 text-xs text-slate-600 self-end sm:self-center">
              <span className="text-slate-400">বর্তমান শিক্ষাবর্ষ:</span>
              <span className="font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                {currentSession.name}
              </span>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-xs">
              <tr>
                <th className="px-6 py-3.5">আইডি নম্বর</th>
                <th className="px-6 py-3.5">রোল</th>
                <th className="px-6 py-3.5">নাম</th>
                <th className="px-6 py-3.5">জামাত / ক্লাস</th>
                <th className="px-6 py-3.5">অভিভাবকের ফোন</th>
                <th className="px-6 py-3.5 text-right">পদক্ষেপ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 text-xs sm:text-sm">
              {students && students.length > 0 ? (
                students.map((student) => {
                  const studentId = getStudentIdNumber(student, students);
                  const studentIdBn = convertToBanglaNumber(studentId);
                  return (
                    <tr
                      key={student.id}
                      className="hover:bg-slate-50/80 transition group"
                    >
                      <td className="px-6 py-4 font-mono font-bold text-emerald-700">
                        {studentIdBn}
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-800">
                        {student.roll_number ? convertToBanglaNumber(student.roll_number) : "-"}
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-900">
                        <Link
                          href={`/dashboard/students/${student.id}`}
                          className="hover:text-emerald-700 hover:underline flex items-center gap-1.5"
                        >
                          <span>
                            {student.first_name} {student.last_name}
                          </span>
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {(Array.isArray(student.classes) ? student.classes[0]?.name : student.classes?.name) || "অনির্ধারিত"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600">{student.parent_phone || "-"}</td>
                      <td className="px-6 py-4 text-right flex items-center justify-end space-x-1.5">
                        <Link
                          href={`/dashboard/students/${student.id}`}
                          className="text-slate-600 hover:text-emerald-700 font-medium transition p-1.5 rounded-lg hover:bg-emerald-50"
                          title="বিস্তারিত প্রোফাইল ও ইতিহাস"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <Link
                          href={`/dashboard/students/${student.id}/edit`}
                          className="text-blue-600 hover:text-blue-800 font-medium transition p-1.5 rounded-lg hover:bg-blue-50"
                          title="তথ্য সম্পাদনা"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Link>
                        <StudentDeleteButton id={student.id} />
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <p className="text-slate-500 mb-2 font-medium">কোনো শিক্ষার্থী পাওয়া যায়নি</p>
                    <p className="text-xs text-slate-400">
                      নতুন শিক্ষার্থী নিবন্ধন করতে "নতুন শিক্ষার্থী" ক্লিক করুন।
                    </p>
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
