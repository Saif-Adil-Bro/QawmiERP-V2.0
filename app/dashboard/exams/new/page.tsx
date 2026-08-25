import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import AddExamForm from "./AddExamForm";

export default function NewExamPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center space-x-4">
        <Link
          href="/dashboard/exams"
          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">নতুন পরীক্ষা</h1>
          <p className="text-slate-500 text-sm">নতুন পরীক্ষার তথ্য যুক্ত করুন</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-6">
        <AddExamForm />
      </div>
    </div>
  );
}
