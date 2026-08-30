import { getStudentById, getStudents } from "@/app/actions/students";
import { getStudentAcademicHistory } from "@/app/actions/sessions";
import StudentProfileClient from "./StudentProfileClient";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "শিক্ষার্থীর বিস্তারিত তথ্য | QawmiERP",
};

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [historyData, allStudents] = await Promise.all([
    getStudentAcademicHistory(id),
    getStudents(),
  ]);

  if (!historyData.student) {
    return (
      <div className="max-w-xl mx-auto p-8 text-center bg-white rounded-3xl shadow-sm border border-slate-200 space-y-4">
        <p className="text-rose-600 font-bold">শিক্ষার্থী পাওয়া যায়নি।</p>
        <Link
          href="/dashboard/students"
          className="inline-flex items-center text-sm font-semibold text-slate-700 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> শিক্ষার্থীদের তালিকায় ফিরে যান
        </Link>
      </div>
    );
  }

  return (
    <StudentProfileClient
      student={historyData.student}
      currentEnrollment={historyData.currentEnrollment}
      academicHistory={historyData.history}
      allStudents={allStudents}
    />
  );
}
