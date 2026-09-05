import Link from "next/link";
import { getExams } from "@/app/actions/exams";
import { Plus, ArrowLeft, PenTool, FileText, Printer, IdCard, Trophy, Settings, FileSignature, Globe } from "lucide-react";
import { format } from "date-fns";
import ExamPublishToggle from "./ExamPublishToggle";

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
                  <th className="px-6 py-4 font-medium">তারিখ ও সময়সূচি</th>
                  <th className="px-6 py-4 font-medium">অবস্থা (Status)</th>
                  <th className="px-6 py-4 font-medium text-right">পদক্ষেপ</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {exams.map((exam: any) => {
                  const startDateStr = exam.effective_start_date || exam.start_date;
                  const endDateStr = exam.effective_end_date || exam.last_routine_date;
                  const hasDifferentEndDate = endDateStr && startDateStr && endDateStr !== startDateStr;

                  return (
                    <tr key={exam.id} className="hover:bg-slate-50/50 transition">
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">{exam.title}</div>
                        {exam.routine_count > 0 && (
                          <div className="text-xs text-slate-400 mt-0.5">
                            {exam.routine_count} টি বিষয়ের রুটিন নির্ধারিত
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-600">{exam.year}</td>
                      <td className="px-6 py-4">
                        {startDateStr ? (
                          <div>
                            <div className="text-slate-800 font-medium text-xs sm:text-sm">
                              {format(new Date(startDateStr), "dd MMM, yyyy")}
                              {hasDifferentEndDate && ` — ${format(new Date(endDateStr), "dd MMM, yyyy")}`}
                            </div>
                            {hasDifferentEndDate && (
                              <div className="text-[11px] text-indigo-600 mt-0.5">
                                রুটিনের শেষ দিন: {format(new Date(endDateStr), "dd MMM")}
                              </div>
                            )}
                            {!hasDifferentEndDate && exam.routine_count === 0 && (
                              <div className="text-[11px] text-slate-400 mt-0.5">রুটিন এন্ট্রি বাকি</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">তারিখ নির্ধারিত নেই</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1.5">
                          <div>
                            {exam.dynamic_status === "Ongoing" ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                <span className="relative flex h-2 w-2 mr-1.5">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                                </span>
                                চলমান
                              </span>
                            ) : exam.dynamic_status === "Completed" ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
                                সম্পন্ন
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5"></span>
                                আসন্ন
                              </span>
                            )}
                          </div>
                          <div>
                            <ExamPublishToggle
                              examId={exam.id}
                              initialPublished={exam.is_published}
                              publishedAt={exam.published_at}
                              publishedBy={exam.published_by}
                              publishNote={exam.publish_note}
                              size="compact"
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right space-x-1.5">
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
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
