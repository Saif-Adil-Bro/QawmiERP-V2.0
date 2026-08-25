import { getStudentById, getClasses, getStudents } from "@/app/actions/students";
import EditStudentForm from "./EditStudentForm";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function EditStudentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [student, classes, allStudents] = await Promise.all([
    getStudentById(id),
    getClasses(),
    getStudents(),
  ]);

  if (!student) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center bg-white rounded-xl shadow-sm border space-y-4">
        <p className="text-red-500 font-medium">শিক্ষার্থী পাওয়া যায়নি।</p>
        <Link
          href="/dashboard/students"
          className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> শিক্ষার্থীদের তালিকায় ফিরে যান
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center space-x-4">
        <Link
          href="/dashboard/students"
          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">শিক্ষার্থী সম্পাদনা করুন</h1>
          <p className="text-slate-500">
            {student.first_name} {student.last_name} এর তথ্য আপডেট করুন
          </p>
        </div>
      </div>

      <EditStudentForm
        student={student}
        classes={classes}
        allStudents={allStudents}
      />
    </div>
  );
}
