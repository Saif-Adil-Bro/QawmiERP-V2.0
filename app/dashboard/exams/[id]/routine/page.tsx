import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getExamById } from "@/app/actions/exams";
import { getClasses } from "@/app/actions/students";
import { getSubjects } from "@/app/actions/subjects";
import { getExamRoutines } from "@/app/actions/exam-routines";
import { getMadrasaDetails as getMadrasaInfo } from "@/app/actions/tenant";
import { notFound } from "next/navigation";
import ExamRoutineClient from "./ExamRoutineClient";
import ExamNavTabs from "../ExamNavTabs";

export default async function ExamRoutinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const examId = resolvedParams.id;
  
  const [exam, classes, subjects, routines, madrasa] = await Promise.all([
    getExamById(examId),
    getClasses(),
    getSubjects(),
    getExamRoutines(examId),
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
          <p className="text-slate-500 text-sm">Exam Routine Management</p>
        </div>
      </div>

      <ExamNavTabs examId={examId} />

      <ExamRoutineClient 
        examId={examId} 
        classes={classes} 
        subjects={subjects} 
        routines={routines} 
        exam={exam}
        madrasa={madrasa}
      />
    </div>
  );
}
