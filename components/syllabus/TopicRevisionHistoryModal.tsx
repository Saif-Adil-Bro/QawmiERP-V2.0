"use client";

import { X, RotateCcw, Calendar, User, Clock, CheckCircle2, Star } from "lucide-react";
import { SyllabusTopic } from "@/lib/syllabus";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  topic: SyllabusTopic | null;
  subjectName?: string;
  classNameStr?: string;
}

export default function TopicRevisionHistoryModal({
  isOpen,
  onClose,
  topic,
  subjectName,
  classNameStr,
}: Props) {
  if (!isOpen || !topic) return null;

  const todayStr = new Date().toISOString().split("T")[0];
  const lastRevDate = topic.last_revised_date || topic.initial_completed_date;
  let gapDays = 0;
  if (lastRevDate) {
    gapDays = Math.floor(
      (new Date(todayStr).getTime() - new Date(lastRevDate).getTime()) / (1000 * 60 * 60 * 24)
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-amber-50/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                রিভিশন হিস্ট্রি ও পুনরাবৃত্তি লগ
              </h2>
              <p className="text-xs text-slate-500">
                {subjectName} {classNameStr ? `• ${classNameStr}` : ""}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Topic Summary Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              নির্বাচিত পাঠ / টপিক
            </div>
            <h3 className="text-base font-bold text-slate-900">{topic.name}</h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 pt-3 border-t border-slate-200 text-xs">
              <div>
                <span className="text-slate-500 block">সিলেবাস অগ্রগতি:</span>
                <span className="font-bold text-emerald-700">
                  {topic.progress_percentage || 0}% ({topic.status === "COMPLETED" ? "সম্পন্ন" : "চলমান"})
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">প্রথম সমাপ্তি:</span>
                <span className="font-semibold text-slate-800">
                  {topic.initial_completed_date || "চলমান"}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">মোট রিভিশন:</span>
                <span className="font-bold text-amber-700">{topic.revision_count || 0} বার</span>
              </div>
              <div>
                <span className="text-slate-500 block">সর্বশেষ রিভিশন:</span>
                <span className="font-semibold text-slate-800">
                  {topic.last_revised_date || "রেকর্ড নেই"}
                  {gapDays > 0 ? ` (${gapDays} দিন পূর্বে)` : ""}
                </span>
              </div>
            </div>
          </div>

          {/* Revision Timeline */}
          <div>
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
              রিভিশন সেশন লগ ({topic.revision_history?.length || 0}টি সেশন)
            </h4>

            {(!topic.revision_history || topic.revision_history.length === 0) ? (
              <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500">
                এই টপিকের কোনো পূর্ববর্তী রিভিশন লগ এখনও রেকর্ড করা হয়নি।
              </div>
            ) : (
              <div className="space-y-3">
                {topic.revision_history.map((rev, idx) => (
                  <div
                    key={rev.id || idx}
                    className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs space-y-2 hover:border-amber-300 transition-colors"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 font-bold text-slate-900">
                        <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 text-[10px] flex items-center justify-center font-bold">
                          {topic.revision_history.length - idx}
                        </span>
                        <span>রিভিশন সেশন #{topic.revision_history.length - idx}</span>
                      </div>
                      <div className="flex items-center gap-1 text-slate-500 font-mono">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{rev.date}</span>
                      </div>
                    </div>

                    <div className="text-xs text-slate-600 pl-7 space-y-1">
                      {rev.teacher_name && (
                        <div className="flex items-center gap-1 text-slate-500">
                          <User className="w-3.5 h-3.5" />
                          <span>উস্তাদ: {rev.teacher_name}</span>
                        </div>
                      )}
                      {rev.notes && (
                        <div className="bg-slate-50 p-2 rounded-lg text-slate-700 text-xs">
                          {rev.notes}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/60 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-sm font-semibold bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl transition-colors"
          >
            বন্ধ করুন
          </button>
        </div>
      </div>
    </div>
  );
}
