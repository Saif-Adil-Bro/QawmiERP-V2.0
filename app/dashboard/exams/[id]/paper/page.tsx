import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getExamById, getExamSubjects } from "@/app/actions/exams";
import { getClasses } from "@/app/actions/students";
import { getSubjects } from "@/app/actions/subjects";
import { getQuestions } from "@/app/actions/questions";
import { getMadrasaDetails as getMadrasaInfo } from "@/app/actions/tenant";
import { notFound } from "next/navigation";
import PaperGeneratorClient from "./PaperGeneratorClient";
import ExamNavTabs from "../ExamNavTabs";

export default async function ExamPaperPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const examId = resolvedParams.id;
  
  const [exam, classes, subjects, questions, madrasa] = await Promise.all([
    getExamById(examId),
    getClasses(),
    getSubjects(),
    getQuestions(), // We load all questions to filter client-side or we can fetch via API. Let's just fetch all for now, it's easier.
    getMadrasaInfo()
  ]);

  if (!exam) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Link
          href="/dashboard/exams"
          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            {exam.title} - {exam.year}
          </h1>
          <p className="text-slate-500 text-sm">প্রশ্নপত্র তৈরি (Paper Generator)</p>
        </div>
      </div>

      <ExamNavTabs examId={examId} />

      <PaperGeneratorClient 
        examId={examId} 
        classes={classes} 
        subjects={subjects} 
        questions={questions}
        exam={exam}
        madrasa={madrasa}
      />
    </div>
  );
}
