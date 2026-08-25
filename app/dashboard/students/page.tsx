import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Plus, Search, Edit2 } from "lucide-react";
import { StudentDeleteButton } from "@/components/students/student-actions";
import { StudentSearch } from "@/components/students/student-search";
import { getStudentIdNumber, convertToBanglaNumber } from "@/lib/student-utils";

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const query = resolvedSearchParams.q || "";

  const supabase = await createClient();

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
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800">শিক্ষার্থী</h1>
        <Link
          href="/dashboard/students/new"
          className="bg-slate-900 text-white px-4 py-2 rounded-md hover:bg-slate-800 flex items-center space-x-2 transition"
        >
          <Plus className="w-4 h-4" />
          <span>নতুন শিক্ষার্থী</span>
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center bg-slate-50/50">
          <StudentSearch />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 font-medium border-b">
              <tr>
                <th className="px-6 py-3">আইডি নম্বর</th>
                <th className="px-6 py-3">রোল নম্বর</th>
                <th className="px-6 py-3">নাম</th>
                <th className="px-6 py-3">জামাত / ক্লাস</th>
                <th className="px-6 py-3">অভিভাবকের ফোন</th>
                <th className="px-6 py-3 text-right">পদক্ষেপ</th>
              </tr>
            </thead>
            <tbody className="divide-y text-slate-700">
              {students && students.length > 0 ? (
                students.map((student) => {
                  const studentId = getStudentIdNumber(student, students);
                  const studentIdBn = convertToBanglaNumber(studentId);
                  return (
                    <tr
                      key={student.id}
                      className="hover:bg-slate-50/50 transition"
                    >
                      <td className="px-6 py-4 font-mono font-bold text-blue-700">
                        {studentIdBn}
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-800">
                        {student.roll_number ? convertToBanglaNumber(student.roll_number) : "-"}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-900">
                        {student.first_name} {student.last_name}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                          {student.classes?.name || "অনির্ধারিত"}
                        </span>
                      </td>
                      <td className="px-6 py-4">{student.parent_phone || "-"}</td>
                      <td className="px-6 py-4 text-right flex items-center justify-end space-x-2">
                        <Link
                          href={`/dashboard/students/${student.id}/edit`}
                          className="text-blue-600 hover:text-blue-800 font-medium transition flex items-center justify-center p-1 rounded hover:bg-blue-50"
                          title="Edit Student"
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
                    <p className="text-slate-500 mb-2">কোনো শিক্ষার্থী পাওয়া যায়নি</p>
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
