import Link from "next/link";
import { ArrowLeft, BookOpen, FileSignature, History } from "lucide-react";
import { getArchivedExamPapers } from "@/app/actions/questions";
import { getExams } from "@/app/actions/exams";
import { getClasses } from "@/app/actions/students";
import { getSubjects } from "@/app/actions/subjects";
import { getMadrasaDetails } from "@/app/actions/tenant";
import ExamArchivesClient from "./ExamArchivesClient";

export default async function ExamArchivesPage() {
  const [archivedPapers, exams, classes, subjects, madrasa] = await Promise.all([
    getArchivedExamPapers(),
    getExams(),
    getClasses(),
    getSubjects(),
    getMadrasaDetails(),
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Link
            href="/dashboard/exams"
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <span>বিগত বছরের প্রশ্ন আর্কাইভ ও ক্লোন</span>
              <span className="text-xs bg-indigo-100 text-indigo-700 font-bold px-2.5 py-1 rounded-full border border-indigo-200">
                Archive & Clone
              </span>
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              পূর্ববর্তী সেমিস্টার বা বছরের তৈরিকৃত প্রশ্নপত্রের কেন্দ্রীয় সংগ্রহশালা ও ১-ক্লিক ক্লোনিং
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Link
            href="/dashboard/exams/question-bank"
            className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-xl hover:bg-slate-50 transition text-sm font-semibold flex items-center space-x-2 shadow-2xs"
          >
            <BookOpen className="w-4 h-4 text-indigo-600" />
            <span>প্রশ্নব্যাংক (Question Bank)</span>
          </Link>
        </div>
      </div>

      {/* Main Client UI */}
      <ExamArchivesClient
        initialPapers={archivedPapers}
        exams={exams}
        classes={classes}
        subjects={subjects}
        madrasa={madrasa}
      />
    </div>
  );
}
