import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getClasses } from "@/app/actions/students";
import { getSubjects } from "@/app/actions/subjects";
import { getQuestions } from "@/app/actions/questions";
import QuestionBankClient from "./QuestionBankClient";

export default async function QuestionBankPage() {
  const [classes, subjects, questions] = await Promise.all([
    getClasses(),
    getSubjects(),
    getQuestions()
  ]);

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
          <h1 className="text-2xl font-bold text-slate-800">প্রশ্নব্যাংক (Question Bank)</h1>
          <p className="text-slate-500 text-sm">বিভিন্ন বিষয়ের প্রশ্ন সংগ্রহ ও সংরক্ষণ</p>
        </div>
      </div>

      <QuestionBankClient 
        classes={classes} 
        subjects={subjects} 
        initialQuestions={questions} 
      />
    </div>
  );
}
