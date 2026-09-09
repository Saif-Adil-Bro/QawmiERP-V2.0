"use client";

import { useState, useEffect, Fragment } from "react";
import { Printer, X, Edit3, Check } from "lucide-react";
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
  madrasaName = "কওমি মাদরাসা",
}: Props) {
  const [displayMadrasaName, setDisplayMadrasaName] = useState(madrasaName);
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  useEffect(() => {
    if (madrasaName) {
      setDisplayMadrasaName(madrasaName);
    }
  }, [madrasaName]);

  if (!isOpen || !metrics || !syllabus) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs overflow-y-auto p-2 sm:p-4 md:p-6 print:p-0 print:bg-white print:static print:overflow-visible">
      {/* Container that centers vertically if small, but scrolls naturally if tall */}
      <div className="min-h-full flex items-center justify-center py-2 sm:py-4 print:py-0 print:block">
        <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-300 overflow-hidden flex flex-col my-auto print:border-none print:shadow-none print:max-w-none print:my-0 print:rounded-none">
          
          {/* Modal Top Bar (Hidden on print) */}
          <div className="sticky top-0 z-20 px-4 sm:px-6 py-2.5 sm:py-3 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white print:hidden">
            <div className="flex items-center gap-2">
              <Printer className="w-5 h-5 text-emerald-400 shrink-0" />
              <span className="font-bold text-xs sm:text-sm truncate">
                সিলেবাস ও অগ্রগতি রিপোর্ট (প্রিন্ট ও PDF ভিউ)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-sm transition-all"
              >
                <Printer className="w-4 h-4" />
                <span>প্রিন্ট / PDF</span>
              </button>
              <button
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                title="বন্ধ করুন"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Printable Sheet */}
          <div className="p-3.5 sm:p-6 md:p-8 space-y-4 sm:space-y-6 text-slate-900 print:p-0 print:space-y-4">
            
            {/* Madrasa Header */}
            <div className="text-center border-b-2 border-emerald-800 pb-3 sm:pb-4">
              <div className="flex items-center justify-center gap-2">
                {isEditingTitle ? (
                  <div className="flex items-center gap-2 max-w-md w-full mx-auto print:hidden">
                    <input
                      type="text"
                      value={displayMadrasaName}
                      onChange={(e) => setDisplayMadrasaName(e.target.value)}
                      className="px-3 py-1 text-center font-black text-xl text-emerald-900 border border-emerald-400 rounded-lg w-full focus:ring-2 focus:ring-emerald-500"
                      autoFocus
                    />
                    <button
                      onClick={() => setIsEditingTitle(false)}
                      className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="group relative inline-flex items-center justify-center gap-2">
                    <h1 className="text-xl sm:text-2xl font-black text-emerald-900 tracking-wide">
                      {displayMadrasaName}
                    </h1>
                    <button
                      onClick={() => setIsEditingTitle(true)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-400 hover:text-emerald-700 print:hidden"
                      title="মাদরাসার নাম সম্পাদনা করুন"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
              <p className="text-xs sm:text-sm font-semibold text-slate-600 mt-1">
                একাডেমিক পাঠদান অগ্রগতি, রিভিশন ও কর্মদিবস গোয়েন্দা রিপোর্ট
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-[11px] sm:text-xs font-medium text-slate-500 mt-2">
                <span>শিক্ষাবর্ষ: {syllabus.academic_year || "১৪৪৭-৪৮ হিজরি"}</span>
                <span className="hidden sm:inline">•</span>
                <span>মেয়াদ: {syllabus.start_date} হতে {syllabus.end_date}</span>
                <span className="hidden sm:inline">•</span>
                <span>প্রিন্ট তারিখ: {new Date().toLocaleDateString("bn-BD")}</span>
              </div>
            </div>

            {/* Overview Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3.5 bg-slate-50 p-3 sm:p-4 rounded-xl border border-slate-300 text-xs print-avoid-break">
              <div>
                <span className="text-slate-500 block text-[11px]">জামাত / শ্রেণি:</span>
                <span className="font-bold text-slate-900 text-xs sm:text-sm">{syllabus.class_name}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">কিতাব ও বিষয়:</span>
                <span className="font-bold text-slate-900 text-xs sm:text-sm">
                  {syllabus.book_name || syllabus.subject_name}
                  {syllabus.book_name && syllabus.book_name !== syllabus.subject_name ? ` (${syllabus.subject_name})` : ""}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">দায়িত্বপ্রাপ্ত উস্তাদ:</span>
                <span className="font-bold text-slate-900 text-xs sm:text-sm">{syllabus.teacher_name || "অনির্ধারিত"}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">বর্তমান স্ট্যাটাস:</span>
                <span className="font-bold text-emerald-700 text-xs sm:text-sm">{metrics.status_label}</span>
              </div>
            </div>

            {/* Smart Working Days & Holidays Breakdown */}
            <div className="p-3 sm:p-3.5 bg-emerald-50/70 border border-emerald-300 rounded-xl text-xs space-y-1 print-avoid-break">
              <div className="font-bold text-emerald-950 flex flex-wrap items-center justify-between gap-1">
                <span>📅 শিক্ষাবর্ষ সময়কাল ও ছুটির বিশ্লেষণ:</span>
                <span className="font-mono text-emerald-800 text-[11px] sm:text-xs">
                  মোট {metrics.total_calendar_days || 0} দিন | জুমাবার: {metrics.fridays_count || 0} দিন | ছুটি: {metrics.holidays_count || 0} দিন
                </span>
              </div>
              <p className="text-emerald-900 text-[11px] sm:text-xs leading-relaxed">
                নিট পাঠদান কর্মদিবস: <strong>{metrics.total_working_days} দিন</strong> (অতিবাহিত: {metrics.elapsed_working_days} দিন, হাতে বাকি: {metrics.remaining_working_days} দিন)।
                {metrics.target_pages_label && ` • দৈনিক লক্ষ্য: ${metrics.target_pages_label}`}
                {metrics.target_weekly_pages_label && ` • সাপ্তাহিক লক্ষ্য: ${metrics.target_weekly_pages_label}`}
              </p>
            </div>

            {/* Core Analytics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 print-avoid-break">
              <div className="p-2.5 sm:p-3 bg-white border border-slate-200 rounded-xl text-center shadow-xs">
                <div className="text-[11px] sm:text-xs text-slate-500">সিলেবাস অগ্রগতি</div>
                <div className="text-xl sm:text-2xl font-black text-emerald-700 mt-0.5">
                  {metrics.actual_progress_percentage}%
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  {metrics.total_pages ? `পৃষ্ঠা: ${metrics.completed_pages || 0}/${metrics.total_pages}` : `${metrics.completed_topics}/${metrics.total_topics} টপিক`}
                </div>
              </div>

              <div className="p-2.5 sm:p-3 bg-white border border-slate-200 rounded-xl text-center shadow-xs">
                <div className="text-[11px] sm:text-xs text-slate-500">হাতে বাকি কর্মদিবস</div>
                <div className="text-xl sm:text-2xl font-black text-indigo-700 mt-0.5">
                  {metrics.remaining_working_days} দিন
                </div>
                <div className="text-[10px] text-slate-400">শুক্রবার ও ছুটি বাদে</div>
              </div>

              <div className="p-2.5 sm:p-3 bg-white border border-slate-200 rounded-xl text-center shadow-xs">
                <div className="text-[11px] sm:text-xs text-slate-500">দৈনিক পড়ার টার্গেট</div>
                <div className="text-xl sm:text-2xl font-black text-amber-700 mt-0.5">
                  {metrics.required_pages_per_day ? `${metrics.required_pages_per_day} পৃষ্ঠা` : `${metrics.required_pace_per_day} টপিক`}
                </div>
                <div className="text-[10px] text-slate-400 truncate">{metrics.target_weekly_pages_label || "প্রতি কর্মদিবসের লক্ষ্য"}</div>
              </div>

              <div className="p-2.5 sm:p-3 bg-white border border-slate-200 rounded-xl text-center shadow-xs">
                <div className="text-[11px] sm:text-xs text-slate-500">মোট রিভিশন সেশন</div>
                <div className="text-xl sm:text-2xl font-black text-purple-700 mt-0.5">
                  {metrics.total_revisions_done} বার
                </div>
                <div className="text-[10px] text-slate-400">বকেয়া: {metrics.revision_due_count}টি</div>
              </div>
            </div>

            {/* Detailed Syllabus Chapters & Topics Table */}
            <div className="space-y-1.5 print-avoid-break">
              <div className="flex items-center justify-between">
                <h3 className="text-xs sm:text-sm font-bold text-slate-900 border-b border-slate-200 pb-1">
                  অধ্যায় ও টপিকভিত্তিক পূর্ণাঙ্গ বিবরণ
                </h3>
                <span className="text-[10px] sm:text-[11px] text-emerald-700 font-medium sm:hidden print:hidden">
                  (ডানে স্ক্রোল করুন ↔)
                </span>
              </div>

              {/* Scrollable Container on Mobile */}
              <div className="border border-slate-300 rounded-xl overflow-x-auto shadow-xs">
                <table className="w-full text-left border-collapse text-xs min-w-[580px] sm:min-w-full">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                      <th className="p-2 sm:p-2.5 w-12 text-center">ক্রম</th>
                      <th className="p-2 sm:p-2.5 min-w-[170px]">অধ্যায় ও পাঠ্য টপিক</th>
                      <th className="p-2 sm:p-2.5 w-20 text-center">অগ্রগতি</th>
                      <th className="p-2 sm:p-2.5 w-24 text-center">সমাপ্তির তারিখ</th>
                      <th className="p-2 sm:p-2.5 w-20 text-center">রিভিশন</th>
                      <th className="p-2 sm:p-2.5 w-24 text-center">সর্বশেষ রিভিশন</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {syllabus.chapters.map((ch, chIdx) => (
                      <Fragment key={ch.id || chIdx}>
                        <tr className="bg-slate-50 font-bold text-slate-800 print-avoid-break">
                          <td colSpan={6} className="p-2 pl-3 sm:pl-4 text-emerald-900 bg-emerald-50/50">
                            অধ্যায় {chIdx + 1}: {ch.name} ({ch.topics.length}টি টপিক)
                          </td>
                        </tr>
                        {ch.topics.map((t, tIdx) => (
                          <tr key={t.id || tIdx} className="hover:bg-slate-50/60 print-avoid-break">
                            <td className="p-2 text-center text-slate-400 font-mono text-[11px]">
                              {chIdx + 1}.{tIdx + 1}
                            </td>
                            <td className="p-2 font-medium text-slate-800 text-[11px] sm:text-xs">{t.name}</td>
                            <td className="p-2 text-center font-bold text-[11px] sm:text-xs">
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
                            <td className="p-2 text-center text-slate-600 font-mono text-[11px]">
                              {t.initial_completed_date || "—"}
                            </td>
                            <td className="p-2 text-center font-bold text-amber-700 text-[11px] sm:text-xs">
                              {t.revision_count || 0} বার
                            </td>
                            <td className="p-2 text-center text-slate-600 font-mono text-[11px]">
                              {t.last_revised_date || "—"}
                            </td>
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Forecasting and Targets */}
            <div className="bg-slate-50 p-3.5 sm:p-4 rounded-xl border border-slate-300 text-xs space-y-1.5 print-avoid-break">
              <div className="font-bold text-slate-900">একাডেমিক লক্ষ্য ও পরামর্শ:</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2 text-slate-700 text-[11px] sm:text-xs">
                <div>• {metrics.today_target_label}</div>
                <div>• {metrics.weekly_target_label}</div>
                <div>• {metrics.forecast_label}</div>
                <div>• {metrics.catch_up_target_label}</div>
              </div>
            </div>

            {/* Signatures */}
            <div className="pt-8 sm:pt-12 grid grid-cols-3 gap-4 sm:gap-8 text-center text-xs print-avoid-break">
              <div className="border-t border-slate-400 pt-2 font-semibold text-slate-700 text-[11px] sm:text-xs">
                দায়িত্বপ্রাপ্ত উস্তাদ
              </div>
              <div className="border-t border-slate-400 pt-2 font-semibold text-slate-700 text-[11px] sm:text-xs">
                নাযেমে তালীমাত / শিক্ষা সচিব
              </div>
              <div className="border-t border-slate-400 pt-2 font-semibold text-slate-700 text-[11px] sm:text-xs">
                মুহতামিম / প্রিন্সিপাল
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
