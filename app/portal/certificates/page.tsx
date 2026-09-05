import { getStudentCertificates } from "@/app/actions/certificates";
import { getAuthUser, createClient } from "@/lib/supabase/server";
import { Award, FileText, CheckCircle2, ShieldCheck, Download, Printer } from "lucide-react";
import CertificatePortalClient from "./CertificatePortalClient";
import { getUserDataAccessScope } from "@/lib/data-access-guards";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "সনদপত্র ও অফিশিয়াল প্রত্যয়ন | QawmiPortal",
};

export default async function StudentPortalCertificatesPage(props: {
  searchParams?: Promise<{ student_id?: string }>;
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

  const scope = await getUserDataAccessScope();

  let studentsQuery = supabase
    .from("students")
    .select("id, first_name, last_name, roll_number, student_id, class_name, classes(name)")
    .order("roll_number", { ascending: true });

  if (!scope.isUnrestricted && scope.allowedStudentIds.length > 0) {
    studentsQuery = studentsQuery.in("id", scope.allowedStudentIds);
  } else if (madrasaId) {
    studentsQuery = studentsQuery.eq("madrasa_id", madrasaId);
  }

  const { data: fetchedStudents } = await studentsQuery;
  let allStudents = fetchedStudents || [];

  if (allStudents.length === 0) {
    const { data: fallbackStudents } = await supabase
      .from("students")
      .select("id, first_name, last_name, roll_number, student_id, class_name, classes(name)")
      .limit(5);
    allStudents = fallbackStudents || [];
  }

  if (allStudents.length === 0) {
    return (
      <div className="p-8 bg-white rounded-3xl border border-slate-200 text-center text-slate-500">
        কোনো সংযুক্ত শিক্ষার্থীর সনদপত্র তথ্য পাওয়া যায়নি।
      </div>
    );
  }

  const selectedStudentId = params.student_id || allStudents[0].id;
  const student = allStudents.find((s) => s.id === selectedStudentId) || allStudents[0];
  const certificates = student ? await getStudentCertificates(student.id) : [];

  return (
    <div className="space-y-6">
      {/* Page Title Header */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200/80 mb-2">
            <ShieldCheck className="w-4 h-4" />
            <span>সত্যায়িত ও কিউআরযুক্ত ডিজিটাল নথি</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            সনদপত্র ও অফিশিয়াল প্রত্যয়নপত্র
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            শিক্ষার্থী: <strong className="text-slate-800">{student.first_name} {student.last_name}</strong> | প্রশংসাপত্র, প্রত্যয়ন ও কোর্স সমাপ্তি ডকুমেন্টস
          </p>
        </div>

        {allStudents.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            {allStudents.map((s: any) => (
              <Link
                key={s.id}
                href={`/portal/certificates?student_id=${s.id}`}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                  s.id === student.id
                    ? "bg-emerald-700 text-white shadow-xs"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                }`}
              >
                {s.first_name} {s.last_name}
              </Link>
            ))}
          </div>
        )}
      </div>

      <CertificatePortalClient student={student} certificates={certificates} />
    </div>
  );
}
