"use client";

import { useState } from "react";
import { X, Users, AlertCircle, CheckCircle2, UserX, Loader2 } from "lucide-react";
import { SyllabusTopic } from "@/lib/syllabus";
import { markStudentMakeupDoneAction } from "@/app/actions/syllabus";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  syllabusId: string;
  topic: SyllabusTopic | null;
  subjectName?: string;
  onSuccess?: () => void;
}

export default function StudentAbsentFollowupModal({
  isOpen,
  onClose,
  syllabusId,
  topic,
  subjectName,
  onSuccess,
}: Props) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  if (!isOpen || !topic) return null;

  const followups = topic.absent_followup || [];
  const pendingCount = followups.filter((f) => !f.is_makeup_done).length;

  const handleMarkDone = async (studentId: string) => {
    setLoadingId(studentId);
    try {
      const res = await markStudentMakeupDoneAction(syllabusId, topic.id, studentId);
      if (res.success) {
        if (onSuccess) onSuccess();
      } else {
        alert(res.error || "ব্যর্থ হয়েছে");
      }
    } catch (err: any) {
      alert(err.message || "ত্রুটি হয়েছে");
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-rose-50/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-rose-100 text-rose-800 rounded-xl">
              <UserX className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                অনুপস্থিত শিক্ষার্থী ও মেকআপ ফলো-আপ
              </h2>
              <p className="text-xs text-slate-500">{subjectName} • হাজিরা ও শিক্ষা সমতা</p>
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
          {/* Topic Info */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-500 font-medium">পাঠ্য টপিক:</div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900">{topic.name}</h3>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-500 block">বকেয়া মেকআপ:</span>
              <span className="text-sm font-bold text-rose-600">{pendingCount} জন শিক্ষার্থী</span>
            </div>
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
            <span className="font-bold">নিয়ম:</span> কোনো শিক্ষার্থী অনুপস্থিত থাকার কারণে ক্লাসের সিলেবাস অগ্রগতি বাধাগ্রস্ত হবে না। তবে সংশ্লিষ্ট শিক্ষার্থী পাঠটি মিস করায় তার ব্যক্তিগত মেকআপ বা রিভিশন ট্র্যাকিং এখানে সংরক্ষিত হয়।
          </div>

          {/* List */}
          <div>
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
              অনুপস্থিত শিক্ষার্থীদের তালিকা ({followups.length} জন)
            </h4>

            {followups.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500">
                এই পাঠদানের দিন কোনো শিক্ষার্থী অনুপস্থিত ছিল না। আলহামদুলিল্লাহ!
              </div>
            ) : (
              <div className="space-y-2.5">
                {followups.map((item, idx) => (
                  <div
                    key={item.student_id + idx}
                    className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between shadow-xs hover:border-slate-300 transition-colors"
                  >
                    <div>
                      <div className="text-sm font-bold text-slate-900">{item.student_name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {item.roll_number ? `রোল: ${item.roll_number} • ` : ""}অনুপস্থিতির তারিখ:{" "}
                        <span className="font-mono text-slate-700">{item.missed_date}</span>
                      </div>
                    </div>

                    <div>
                      {item.is_makeup_done ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>মেকআপ সম্পন্ন ({item.makeup_date})</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={loadingId === item.student_id}
                          onClick={() => handleMarkDone(item.student_id)}
                          className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
                        >
                          {loadingId === item.student_id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          )}
                          <span>মেকআপ সম্পন্ন হিসেবে মার্ক করুন</span>
                        </button>
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
