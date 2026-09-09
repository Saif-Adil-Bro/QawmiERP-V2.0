"use client";

import { Printer, X, Download } from "lucide-react";
import { Syllabus, SyllabusIntelligenceMetrics } from "@/lib/syllabus";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  metrics: SyllabusIntelligenceMetrics | null;
  syllabus: Syllabus | null;
  madrasaName?: string;
}

export default function SyllabusPrintReport({
  isOpen,
  onClose,
  metrics,
  syllabus,
  madrasaName = "কওমি মাদরাসা শিক্ষা বোর্ড",
}: Props) {
  if (!isOpen || !metrics || !syllabus) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-300 overflow-hidden my-6 flex flex-col max-h-[96vh]">
        {/* Modal Top Bar (Hidden on print) */}
        <div className="px-6 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-800 text-white print:hidden">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-emerald-400" />
            <span className="font-bold text-sm">সিলেবাস ও অগ্রগতি বিশ্লেষণ রিপোর্ট (প্রিন্ট ভিউ)</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>প্রিন্ট / PDF সংরক্ষণ করুন</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Sheet */}
        <div className="p-8 overflow-y-auto print:p-0 space-y-6 text-slate-900">
          {/* Madrasa Header */}
          <div className="text-center border-b-2 border-emerald-800 pb-4">
            <h1 className="text-2xl font-black text-emerald-900 tracking-wide">{madrasaName}</h1>
            <p className="text-sm font-semibold text-slate-600 mt-1">
              একাডেমিক পাঠদান অগ্রগতি, রিভিশন ও কর্মদিবস গোয়েন্দা রিপোর্ট
            </p>
            <div className="flex items-center justify-center gap-4 text-xs font-medium text-slate-500 mt-2">
              <span>শিক্ষাবর্ষ: {syllabus.academic_year || "১৪৪৭-৪৮ হিজরি"}</span>
              <span>•</span>
              <span>মেয়াদ: {syllabus.start_date} হতে {syllabus.end_date}</span>
              <span>•</span>
              <span>প্রিন্ট তারিখ: {new Date().toLocaleDateString("bn-BD")}</span>
            </div>
          </div>

          {/* Overview Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-300 text-xs">
            <div>
              <span className="text-slate-500 block">জামাত / শ্রেণি:</span>
              <span className="font-bold text-slate-900 text-sm">{syllabus.class_name}</span>
            </div>
            <div>
              <span className="text-slate-500 block">কিতাব ও বিষয়:</span>
              <span className="font-bold text-slate-900 text-sm">
                {syllabus.book_name || syllabus.subject_name}
                {syllabus.book_name && syllabus.book_name !== syllabus.subject_name ? ` (${syllabus.subject_name})` : ""}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">দায়িত্বপ্রাপ্ত উস্তাদ:</span>
              <span className="font-bold text-slate-900 text-sm">{syllabus.teacher_name || "অনির্ধারিত"}</span>
            </div>
            <div>
              <span className="text-slate-500 block">বর্তমান স্ট্যাটাস:</span>
              <span className="font-bold text-emerald-700 text-sm">{metrics.status_label}</span>
            </div>
          </div>

          {/* Smart Working Days & Holidays Breakdown */}
          <div className="p-3.5 bg-emerald-50/70 border border-emerald-300 rounded-xl text-xs space-y-1">
            <div className="font-bold text-emerald-950 flex items-center justify-between">
              <span>📅 শিক্ষাবর্ষ সময়কাল ও ছুটির বিশ্লেষণ:</span>
              <span className="font-mono text-emerald-800">
                মোট {metrics.total_calendar_days || 0} দিন | জুমাবার: {metrics.fridays_count || 0} দিন | ছুটি: {metrics.holidays_count || 0} দিন
              </span>
            </div>
            <p className="text-emerald-900">
              নিট পাঠদান কর্মদিবস: <strong>{metrics.total_working_days} দিন</strong> (অতিবাহিত: {metrics.elapsed_working_days} দিন, হাতে বাকি: {metrics.remaining_working_days} দিন)।
              {metrics.target_pages_label && ` • দৈনিক লক্ষ্য: ${metrics.target_pages_label}`}
              {metrics.target_weekly_pages_label && ` • সাপ্তাহিক লক্ষ্য: ${metrics.target_weekly_pages_label}`}
            </p>
          </div>

          {/* Core Analytics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-white border border-slate-200 rounded-xl text-center">
              <div className="text-xs text-slate-500">সিলেবাস অগ্রগতি</div>
              <div className="text-2xl font-black text-emerald-700 mt-0.5">
                {metrics.actual_progress_percentage}%
              </div>
              <div className="text-[10px] text-slate-400">
                {metrics.total_pages ? `পৃষ্ঠা: ${metrics.completed_pages || 0}/${metrics.total_pages} (${metrics.completed_topics} টপিক)` : `${metrics.completed_topics} / ${metrics.total_topics} টপিক`}
              </div>
            </div>

            <div className="p-3 bg-white border border-slate-200 rounded-xl text-center">
              <div className="text-xs text-slate-500">হাতে বাকি কর্মদিবস</div>
              <div className="text-2xl font-black text-indigo-700 mt-0.5">
                {metrics.remaining_working_days} দিন
              </div>
              <div className="text-[10px] text-slate-400">শুক্রবার ও ছুটি বাদে</div>
            </div>

            <div className="p-3 bg-white border border-slate-200 rounded-xl text-center">
              <div className="text-xs text-slate-500">দৈনিক পড়ার টার্গেট</div>
              <div className="text-2xl font-black text-amber-700 mt-0.5">
                {metrics.required_pages_per_day ? `${metrics.required_pages_per_day} পৃষ্ঠা` : `${metrics.required_pace_per_day} টপিক`}
              </div>
              <div className="text-[10px] text-slate-400">{metrics.target_weekly_pages_label || "প্রতি কর্মদিবসের লক্ষ্য"}</div>
            </div>

            <div className="p-3 bg-white border border-slate-200 rounded-xl text-center">
              <div className="text-xs text-slate-500">মোট রিভিশন সেশন</div>
              <div className="text-2xl font-black text-purple-700 mt-0.5">
                {metrics.total_revisions_done} বার
              </div>
              <div className="text-[10px] text-slate-400">বকেয়া: {metrics.revision_due_count}টি</div>
            </div>
          </div>

          {/* Detailed Syllabus Chapters & Topics Table */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-2 border-b border-slate-200 pb-1">
              অধ্যায় ও টপিকভিত্তিক পূর্ণাঙ্গ বিবরণ
            </h3>

            <div className="border border-slate-300 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                    <th className="p-2.5 w-12 text-center">ক্রম</th>
                    <th className="p-2.5">অধ্যায় ও পাঠ্য টপিক</th>
                    <th className="p-2.5 w-24 text-center">প্রgress</th>
                    <th className="p-2.5 w-24 text-center">সমাপ্তির তারিখ</th>
                    <th className="p-2.5 w-20 text-center">রিভিশন সংখ্যা</th>
                    <th className="p-2.5 w-28 text-center">সর্বশেষ রিভিশন</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {syllabus.chapters.map((ch, chIdx) => (
                    <>
                      <tr key={ch.id || chIdx} className="bg-slate-50 font-bold text-slate-800">
                        <td colSpan={6} className="p-2 pl-4 text-emerald-900">
                          অধ্যায় {chIdx + 1}: {ch.name} ({ch.topics.length}টি টপিক)
                        </td>
                      </tr>
                      {ch.topics.map((t, tIdx) => (
                        <tr key={t.id || tIdx} className="hover:bg-slate-50/50">
                          <td className="p-2 text-center text-slate-400 font-mono">
                            {chIdx + 1}.{tIdx + 1}
                          </td>
                          <td className="p-2 font-medium text-slate-800">{t.name}</td>
                          <td className="p-2 text-center font-bold">
                            <span
                              className={
                                t.status === "COMPLETED"
                                  ? "text-emerald-700"
                                  : t.progress_percentage > 0
                                  ? "text-blue-600"
                                  : "text-slate-400"
                              }
                            >
                              {t.progress_percentage || 0}%
                            </span>
                          </td>
                          <td className="p-2 text-center text-slate-600 font-mono">
                            {t.initial_completed_date || "—"}
                          </td>
                          <td className="p-2 text-center font-bold text-amber-700">
                            {t.revision_count || 0} বার
                          </td>
                          <td className="p-2 text-center text-slate-600 font-mono">
                            {t.last_revised_date || "—"}
                          </td>
                        </tr>
                      ))}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Forecasting and Targets */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-300 text-xs space-y-2">
            <div className="font-bold text-slate-900">একাডেমিক লক্ষ্য ও পরামর্শ:</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700">
              <div>• {metrics.today_target_label}</div>
              <div>• {metrics.weekly_target_label}</div>
              <div>• {metrics.forecast_label}</div>
              <div>• {metrics.catch_up_target_label}</div>
            </div>
          </div>

          {/* Signatures */}
          <div className="pt-12 grid grid-cols-3 gap-8 text-center text-xs">
            <div className="border-t border-slate-400 pt-2 font-semibold text-slate-700">
              দায়িত্বপ্রাপ্ত উস্তাদ
            </div>
            <div className="border-t border-slate-400 pt-2 font-semibold text-slate-700">
              নাযেমে তালীমাত / শিক্ষা সচিব
            </div>
            <div className="border-t border-slate-400 pt-2 font-semibold text-slate-700">
              মুহতামিম / প্রিন্সিপাল
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
