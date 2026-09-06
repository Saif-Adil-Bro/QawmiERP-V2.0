import Link from "next/link";
import { getExams } from "@/app/actions/exams";
import { Plus, FileText, FileSignature } from "lucide-react";
import ExamListClient from "./ExamListClient";

export default async function ExamsPage() {
  const exams = await getExams();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">পরীক্ষা (Examinations)</h1>
          <p className="text-slate-500 text-sm">মাদরাসার সকল পরীক্ষার তালিকা, তথ্য সম্পাদনা ও ফলাফল ব্যবস্থাপনা</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/dashboard/exams/archives"
            className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-xl hover:bg-indigo-100 transition flex items-center space-x-2 border border-indigo-200 text-sm font-semibold shadow-2xs"
          >
            <FileSignature className="w-4 h-4 text-indigo-600" />
            <span>প্রশ্ন আর্কাইভ ও ক্লোন (Archive & Clone)</span>
          </Link>
          <Link
            href="/dashboard/exams/question-bank"
            className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-xl hover:bg-slate-50 transition flex items-center space-x-2 text-sm font-semibold shadow-2xs"
          >
            <FileText className="w-4 h-4 text-indigo-600" />
            <span>প্রশ্নব্যাংক (Question Bank)</span>
          </Link>
          <Link
            href="/dashboard/exams/new"
            className="bg-slate-900 text-white px-4 py-2 rounded-xl hover:bg-slate-800 transition flex items-center space-x-2 text-sm font-semibold shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>নতুন পরীক্ষা তৈরি করুন</span>
          </Link>
        </div>
      </div>

      <ExamListClient initialExams={exams} />
    </div>
  );
}
