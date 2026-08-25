import Link from "next/link";
import { getExams } from "@/app/actions/exams";
import { Plus, ArrowLeft, PenTool, FileText, Printer, IdCard, Trophy, Settings, FileSignature } from "lucide-react";
import { format } from "date-fns";

export default async function ExamsPage() {
  const exams = await getExams();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">পরীক্ষা (Examinations)</h1>
          <p className="text-slate-500 text-sm">মাদরাসার সকল পরীক্ষার তালিকা ও ফলাফল</p>
        </div>
        <Link
          href="/dashboard/exams/question-bank"
          className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-md hover:bg-indigo-100 transition flex items-center space-x-2"
        >
          <FileText className="w-4 h-4" />
          <span>প্রশ্নব্যাংক (Question Bank)</span>
        </Link>
        <Link
          href="/dashboard/exams/new"
          className="bg-slate-900 text-white px-4 py-2 rounded-md hover:bg-slate-800 transition flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>নতুন পরীক্ষা তৈরি করুন</span>
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        {exams.length === 0 ? (
          <div className="p-8 text-center text-slate-500">কোনো পরীক্ষা পাওয়া যায়নি।</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-700 border-b">
                <tr>
                  <th className="px-6 py-4 font-medium">পরীক্ষার নাম</th>
                  <th className="px-6 py-4 font-medium">বছর</th>
                  <th className="px-6 py-4 font-medium">শুরুর তারিখ</th>
                  <th className="px-6 py-4 font-medium">অবস্থা (Status)</th>
                  <th className="px-6 py-4 font-medium text-right">পদক্ষেপ</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {exams.map((exam) => (
                  <tr key={exam.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-6 py-4 font-medium text-slate-900">{exam.title}</td>
                    <td className="px-6 py-4">{exam.year}</td>
                    <td className="px-6 py-4">
                      {exam.start_date ? format(new Date(exam.start_date), "dd MMM, yyyy") : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                        exam.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                        exam.status === 'Ongoing' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                        'bg-blue-50 text-blue-700 border-blue-100'
                      }`}>
                        {exam.status === 'Upcoming' ? 'আসন্ন' : exam.status === 'Ongoing' ? 'চলমান' : 'সম্পন্ন'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <Link
                        href={`/dashboard/exams/${exam.id}/marks`}
                        className="inline-flex items-center justify-center p-2 text-indigo-600 hover:bg-indigo-50 rounded-md transition border border-transparent hover:border-indigo-100"
                        title="নম্বর এন্ট্রি"
                      >
                        <PenTool className="w-4 h-4" />
                      </Link>
                      <Link
                        href={`/dashboard/exams/${exam.id}/results`}
                        className="inline-flex items-center justify-center p-2 text-emerald-600 hover:bg-emerald-50 rounded-md transition border border-transparent hover:border-emerald-100"
                        title="ফলাফল তালিকা (Tabulation)"
                      >
                        <FileText className="w-4 h-4" />
                      </Link>
                      <Link
                        href={`/dashboard/exams/${exam.id}/report-cards`}
                        className="inline-flex items-center justify-center p-2 text-slate-600 hover:bg-slate-100 rounded-md transition border border-transparent hover:border-slate-200"
                        title="স্বতন্ত্র মার্কশিট (Report Cards)"
                      >
                        <Printer className="w-4 h-4" />
                      </Link>
                      <Link
                        href={`/dashboard/exams/${exam.id}/admit-cards`}
                        className="inline-flex items-center justify-center p-2 text-blue-600 hover:bg-blue-50 rounded-md transition border border-transparent hover:border-blue-200"
                        title="প্রবেশপত্র (Admit Cards)"
                      >
                        <IdCard className="w-4 h-4" />
                      </Link>
                      <Link
                        href={`/dashboard/exams/${exam.id}/merit-list`}
                        className="inline-flex items-center justify-center p-2 text-amber-600 hover:bg-amber-50 rounded-md transition border border-transparent hover:border-amber-200"
                        title="মেধাতালিকা (Merit List)"
                      >
                        <Trophy className="w-4 h-4" />
                      </Link>
                      <Link
                        href={`/dashboard/exams/${exam.id}/routine`}
                        className="inline-flex items-center justify-center p-2 text-indigo-600 hover:bg-indigo-50 rounded-md transition border border-transparent hover:border-indigo-200"
                        title="পরীক্ষার রুটিন (Exam Routine)"
                      >
                        <FileText className="w-4 h-4" />
                      </Link>
                      <Link
                        href={`/dashboard/exams/${exam.id}/paper`}
                        className="inline-flex items-center justify-center p-2 text-violet-600 hover:bg-violet-50 rounded-md transition border border-transparent hover:border-violet-200"
                        title="প্রশ্নপত্র বিল্ডার (Paper Generator)"
                      >
                        <FileSignature className="w-4 h-4" />
                      </Link>
                      <Link
                        href={`/dashboard/exams/${exam.id}/setup`}
                        className="inline-flex items-center justify-center p-2 text-orange-600 hover:bg-orange-50 rounded-md transition border border-transparent hover:border-orange-200"
                        title="পরীক্ষা সেটআপ (Exam Setup)"
                      >
                        <Settings className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
