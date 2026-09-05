"use client";

import { useState } from "react";
import { toggleExamPublish } from "@/app/actions/exams";
import { 
  Globe, Eye, EyeOff, CheckCircle2, AlertCircle, 
  Loader2, ShieldAlert, Sparkles, MessageSquare 
} from "lucide-react";

interface ExamPublishToggleProps {
  examId: string;
  initialPublished?: boolean;
  publishedAt?: string | null;
  publishedBy?: string | null;
  publishNote?: string | null;
  size?: "compact" | "full";
  onStatusChange?: (isPublished: boolean) => void;
}

export default function ExamPublishToggle({
  examId,
  initialPublished = false,
  publishedAt,
  publishedBy,
  publishNote,
  size = "full",
  onStatusChange,
}: ExamPublishToggleProps) {
  const [isPublished, setIsPublished] = useState<boolean>(initialPublished);
  const [loading, setLoading] = useState<boolean>(false);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [note, setNote] = useState<string>(publishNote || "");
  const [targetState, setTargetState] = useState<boolean>(!initialPublished);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const handleOpenConfirm = (nextState: boolean) => {
    setTargetState(nextState);
    setShowConfirmModal(true);
    setFeedback(null);
  };

  const handleToggle = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const res = await toggleExamPublish(examId, targetState, note);
      if (res?.error) {
        setFeedback({ type: "error", message: res.error });
      } else if (res?.success) {
        setIsPublished(targetState);
        setShowConfirmModal(false);
        setFeedback({ type: "success", message: res.message });
        if (onStatusChange) {
          onStatusChange(targetState);
        }
        setTimeout(() => setFeedback(null), 4000);
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err?.message || "একটি ত্রুটি হয়েছে।" });
    } finally {
      setLoading(false);
    }
  };

  if (size === "compact") {
    return (
      <div className="inline-flex items-center gap-2">
        {isPublished ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            ফলাফল প্রকাশিত
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            ফলাফল অপ্রকাশিত
          </span>
        )}

        <button
          type="button"
          onClick={() => handleOpenConfirm(!isPublished)}
          disabled={loading}
          className={`text-xs px-2.5 py-1 rounded-lg font-medium transition flex items-center gap-1 border ${
            isPublished
              ? "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
              : "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 shadow-sm"
          }`}
          title={isPublished ? "ফলাফল অপ্রকাশ করুন" : "ফলাফল প্রকাশ করুন"}
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : isPublished ? (
            <>
              <EyeOff className="w-3.5 h-3.5" />
              <span>স্থগিত করুন</span>
            </>
          ) : (
            <>
              <Eye className="w-3.5 h-3.5" />
              <span>পাবলিশ করুন</span>
            </>
          )}
        </button>

        {/* Modal */}
        {showConfirmModal && renderModal()}
      </div>
    );
  }

  function renderModal() {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
        <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 text-left">
          <div className="flex items-center gap-3">
            <div
              className={`p-3 rounded-xl shrink-0 ${
                targetState ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
              }`}
            >
              {targetState ? <Globe className="w-6 h-6" /> : <EyeOff className="w-6 h-6" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                {targetState ? "ফলাফল আনুষ্ঠানিকভাবে প্রকাশ করুন" : "ফলাফল স্থগিত / অপ্রকাশ করুন"}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {targetState
                  ? "প্রকাশিত হলে অভিভাবক ও শিক্ষার্থীরা পোর্টালে ফলাফল দেখতে পাবেন।"
                  : "অপ্রকাশিত হলে পোর্টালে অভিভাবক/শিক্ষার্থীরা ফলাফল দেখতে পারবেন না।"}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
              পাবলিশ নোট বা ঘোষণা (ঐচ্ছিক)
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="উদা: ফলাফল সংশোধিত হয়েছে অথবা অফিসিয়াল ফলাফল প্রকাশিত হলো।"
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-slate-700">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              স্বয়ংক্রিয় প্রভাব:
            </div>
            <p className="text-[11px] text-slate-500">
              {targetState
                ? "• অভিভাবক পোর্টালে শিক্ষার্থীর পূর্ণ মার্কশিট, গ্রেড এবং পজিশন দৃশ্যমান হবে।"
                : "• অভিভাবক পোর্টালে ফলাফল সাময়িকভাবে লুকিয়ে রাখা হবে (প্রস্তুতি নোটিশ দেখাবে)।"}
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowConfirmModal(false)}
              disabled={loading}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              বাতিল
            </button>
            <button
              type="button"
              onClick={handleToggle}
              disabled={loading}
              className={`px-5 py-2 text-xs font-semibold rounded-xl text-white transition flex items-center gap-1.5 shadow-sm ${
                targetState
                  ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20"
                  : "bg-rose-600 hover:bg-rose-700 shadow-rose-600/20"
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  প্রক্রিয়াধীন...
                </>
              ) : targetState ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  হ্যাঁ, প্রকাশ করুন
                </>
              ) : (
                <>
                  <EyeOff className="w-3.5 h-3.5" />
                  হ্যাঁ, অপ্রকাশ করুন
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 print:hidden">
      {/* Banner Box */}
      <div
        className={`p-4 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
          isPublished
            ? "bg-emerald-50/70 border-emerald-200 text-emerald-900"
            : "bg-amber-50/80 border-amber-200 text-amber-900"
        }`}
      >
        <div className="flex items-start sm:items-center gap-3">
          <div
            className={`p-2.5 rounded-xl shrink-0 ${
              isPublished ? "bg-emerald-500 text-white shadow-sm" : "bg-amber-500 text-white shadow-sm"
            }`}
          >
            {isPublished ? <Globe className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold">
                {isPublished ? "পরীক্ষার ফলাফল প্রকাশিত (Published)" : "ফলাফল অপ্রকাশিত / ড্রাফট (Unpublished)"}
              </h3>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${
                  isPublished
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                    : "bg-amber-100 text-amber-800 border border-amber-300"
                }`}
              >
                {isPublished ? "পোর্টালে উন্মুক্ত" : "পোর্টালে সুরক্ষিত / লুকানো"}
              </span>
            </div>
            <p className="text-xs mt-0.5 opacity-90">
              {isPublished
                ? `ফলাফল অভিভাবকদের জন্য উন্মুক্ত আছে${publishedBy ? ` • প্রকাশক: ${publishedBy}` : ""}${
                    publishedAt ? ` (${new Date(publishedAt).toLocaleDateString("bn-BD")})` : ""
                  }`
                : "ফলাফল বর্তমানে অভিভাবক পোর্টালে প্রদর্শিত হচ্ছে না। পূর্ণ যাচাই শেষে প্রকাশ বাটনে ক্লিক করুন।"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isPublished ? (
            <button
              type="button"
              onClick={() => handleOpenConfirm(false)}
              disabled={loading}
              className="px-3.5 py-2 text-xs font-semibold bg-white hover:bg-rose-50 text-rose-700 rounded-xl border border-rose-200 transition flex items-center gap-1.5 shadow-xs"
            >
              <EyeOff className="w-4 h-4 text-rose-600" />
              ফলাফল অপ্রকাশ / স্থগিত করুন
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleOpenConfirm(true)}
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md shadow-emerald-600/20 transition flex items-center gap-1.5"
            >
              <Globe className="w-4 h-4" />
              ফলাফল সবার জন্য প্রকাশ করুন
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-xl text-xs flex items-center gap-2 animate-fadeIn ${
            feedback.type === "success"
              ? "bg-emerald-100 text-emerald-900 border border-emerald-200"
              : "bg-rose-100 text-rose-900 border border-rose-200"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {showConfirmModal && renderModal()}
    </div>
  );
}
