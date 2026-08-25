import { getStudents } from "@/app/actions/students";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import AddFeeForm from "./AddFeeForm";

export default async function NewFeePage() {
  const students = await getStudents();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center space-x-4">
        <Link
          href="/dashboard/accounting/fees"
          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">নতুন ফি গ্রহণ</h1>
          <p className="text-slate-500 text-sm">শিক্ষার্থীর ফি রেকর্ড এন্ট্রি করুন</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-6">
        <AddFeeForm students={students} />
      </div>
    </div>
  );
}
