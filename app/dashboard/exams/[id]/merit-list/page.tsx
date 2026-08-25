import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getExamById } from "@/app/actions/exams";
import { getClasses } from "@/app/actions/students";
import { getMadrasaInfo } from "@/lib/getMadrasaInfo";
import { notFound } from "next/navigation";
import MeritListClient from "./MeritListClient";
import ExamNavTabs from "../ExamNavTabs";

export default async function MeritListPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const examId = resolvedParams.id;
  
  const [exam, classes, madrasaInfo] = await Promise.all([
    getExamById(examId),
    getClasses(),
    getMadrasaInfo()
  ]);

  if (!exam) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4 print:hidden">
        <Link
          href="/dashboard/exams"
          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">মেধাতালিকা (Merit List)</h1>
          <p className="text-slate-500 text-sm">{exam.title} - {exam.year}</p>
        </div>
      </div>

      <ExamNavTabs examId={examId} />

      <div className="bg-white rounded-xl shadow-sm border p-6 print:shadow-none print:border-none print:p-0">
        <MeritListClient examId={examId} classes={classes} examTitle={exam.title} examYear={exam.year} madrasaInfo={madrasaInfo} />
      </div>
    </div>
  );
}
