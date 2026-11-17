import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getExamById } from "@/app/actions/exams";
import { getCanManageLocks } from "@/app/actions/locks";
import { getClasses } from "@/app/actions/students";
import MarksEntryClient from "./MarksEntryClient";
import { notFound } from "next/navigation";
import ExamNavTabs from "../ExamNavTabs";

export default async function ExamMarksPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const examId = resolvedParams.id;
  
  const [exam, classes, canManageLocks] = await Promise.all([
    getExamById(examId),
    getClasses(),
    getCanManageLocks(),
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
          <h1 className="text-2xl font-bold text-slate-800">নম্বর এন্ট্রি</h1>
          <p className="text-slate-500 text-sm">{exam.title} - {exam.year}</p>
        </div>
      </div>

      <ExamNavTabs examId={examId} />

      <div className="bg-white rounded-xl shadow-sm border p-6">
        <MarksEntryClient
          examId={examId}
          examTitle={`${exam.title} - ${exam.year}`}
          classes={classes}
          initialLocked={Boolean((exam as any).is_locked)}
          lockedByName={(exam as any).locked_by_name || null}
          lockedAt={(exam as any).locked_at || null}
          lockReason={(exam as any).lock_reason || null}
          canManageLocks={canManageLocks}
        />
      </div>
    </div>
  );
}
