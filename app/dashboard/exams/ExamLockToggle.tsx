"use client";

import { useState } from "react";
import { toggleExamLock } from "@/app/actions/exams";
import {
  Lock,
  Unlock,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
} from "lucide-react";

interface ExamLockToggleProps {
  examId: string;
  examTitle?: string;
  initialLocked?: boolean;
  lockedByName?: string | null;
  lockedAt?: string | null;
  lockReason?: string | null;
  canManageLocks?: boolean;
  size?: "compact" | "full";
  onStatusChange?: (
    isLocked: boolean,
    meta?: { lockReason?: string | null }
  ) => void;
}

export default function ExamLockToggle({
  examId,
  examTitle,
  initialLocked = false,
  lockedByName,
  lockedAt,
  lockReason,
  canManageLocks = false,
  size = "compact",
  onStatusChange,
}: ExamLockToggleProps) {
  const [isLocked, setIsLocked] = useState<boolean>(initialLocked);
  const [currentReason, setCurrentReason] = useState<string | null>(
    lockReason || null
  );
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [targetLock, setTargetLock] = useState<boolean>(!initialLocked);
  const [reasonInput, setReasonInput] = useState<string>("");
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const openModal = (nextLocked: boolean) => {
    setTargetLock(nextLocked);
    setReasonInput(
      nextLocked
        ? currentReason || "নম্বর যাচাই ও ফলাফল চূড়ান্তকরণ সম্পন্ন"
        : ""
    );
    setFeedback(null);
    setShowModal(true);
  };

  const handleConfirm = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const res = await toggleExamLock(examId, targetLock, reasonInput.trim());
      if (res?.error) {
        setFeedback({ type: "error", message: res.error });
      } else if (res?.success) {
        setIsLocked(targetLock);
        const nextReason = targetLock
          ? reasonInput.trim() || "চূড়ান্ত ফলাফল লক/ফ্রিজ করা হয়েছে"
          : null;
        setCurrentReason(nextReason);
        setShowModal(false);
        setFeedback({
          type: "success",
          message:
            res.message ||
            (targetLock
              ? "পরীক্ষাটি সফলভাবে ফ্রিজ (লক) করা হয়েছে।"
              : "পরীক্ষাটি সফলভাবে আনলক করা হয়েছে।"),
        });
        onStatusChange?.(targetLock, { lockReason: nextReason });
        setTimeout(() => setFeedback(null), 4000);
      }
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err?.message || "লক স্ট্যাটাস পরিবর্তন করতে সমস্যা হয়েছে।",
      });
    } finally {
      setLoading(false);
    }
  };

  function renderModal() {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
        <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 text-left">
          <div className="flex items-start gap-3">
            <div
              className={`p-3 rounded-xl shrink-0 ${
                targetLock
                  ? "bg-rose-50 text-rose-600"
                  : "bg-amber-50 text-amber-600"
              }`}
            >
              {targetLock ? (
                <Lock className="w-6 h-6" />
              ) : (
                <Unlock className="w-6 h-6" />
              )}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                {targetLock
                  ? "পরীক্ষার নম্বর ও তথ্য ফ্রিজ (লক) করুন"
                  : "পরীক্ষার লক আনলক করুন"}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {examTitle ? `${examTitle} — ` : ""}
                {targetLock
                  ? "লক করলে কোনো শিক্ষক বা অপারেটর আর নম্বর, বিষয় বা পরীক্ষার তথ্য পরিবর্তন/ডিলিট করতে পারবেন না।"
                  : "আনলক করলে পুনরায় নম্বর এন্ট্রি ও সংশোধন করা যাবে। এই অ্যাকশনটি CRITICAL অডিট লগে সংরক্ষিত হবে।"}
              </p>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
              {targetLock ? "লক করার কারণ" : "আনলক করার কারণ (অডিট লগের জন্য)"}
            </label>
            <textarea
              rows={2}
              value={reasonInput}
              onChange={(e) => setReasonInput(e.target.value)}
              placeholder={
                targetLock
                  ? "উদা: চূড়ান্ত রেজাল্ট যাচাই সম্পন্ন ও মার্কশিট প্রিন্টের জন্য প্রস্তুত"
                  : "উদা: মুহতামিমের অনুমতিক্রমে নির্দিষ্ট শিক্ষার্থীর নম্বর সংশোধন"
              }
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none"
            />
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-slate-700">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
              নিরাপত্তা নীতিমালা:
            </div>
            <p className="text-[11px] text-slate-500">
              {targetLock
                ? "• কেবল মুহতামিম, অ্যাডমিন অথবা সুপার অ্যাডমিন পরবর্তীতে এটি আনলক করতে পারবেন।"
                : "• আনলকের পর সংশোধন শেষে পুনরায় লক করে দেওয়া উত্তম।"}
            </p>
          </div>

          {feedback?.type === "error" && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{feedback.message}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              disabled={loading}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              বাতিল
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading}
              className={`px-5 py-2 text-xs font-semibold rounded-xl text-white transition flex items-center gap-1.5 shadow-sm ${
                targetLock
                  ? "bg-rose-600 hover:bg-rose-700"
                  : "bg-amber-600 hover:bg-amber-700"
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  প্রক্রিয়াধীন...
                </>
              ) : targetLock ? (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  হ্যাঁ, ফ্রিজ (লক) করুন
                </>
              ) : (
                <>
                  <Unlock className="w-3.5 h-3.5" />
                  হ্যাঁ, আনলক করুন
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (size === "compact") {
    return (
      <div className="inline-flex items-center gap-1.5 flex-wrap">
        {isLocked ? (
          <span
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200"
            title={currentReason || "পরীক্ষাটি ফ্রিজ (লক) করা আছে"}
          >
            <Lock className="w-3 h-3" />
            নম্বর ফ্রিজড
          </span>
        ) : null}

        {canManageLocks && (
          <button
            type="button"
            onClick={() => openModal(!isLocked)}
            disabled={loading}
            className={`text-[11px] px-2.5 py-0.5 rounded-lg font-semibold transition inline-flex items-center gap-1 border ${
              isLocked
                ? "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
                : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200"
            }`}
            title={
              isLocked
                ? "পরীক্ষার লক খুলুন (মুহতামিম/অ্যাডমিন)"
                : "নম্বর ফ্রিজ/লক করুন যাতে আর কেউ পরিবর্তন করতে না পারে"
            }
          >
            {loading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : isLocked ? (
              <>
                <Unlock className="w-3 h-3" />
                <span>আনলক</span>
              </>
            ) : (
              <>
                <Lock className="w-3 h-3" />
                <span>লক করুন</span>
              </>
            )}
          </button>
        )}

        {showModal && renderModal()}
      </div>
    );
  }

  // Full banner mode (e.g., Marks Entry Page)
  return (
    <div className="space-y-2 print:hidden">
      <div
        className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          isLocked
            ? "bg-rose-50/90 border-rose-200 text-rose-900"
            : "bg-slate-50 border-slate-200 text-slate-800"
        }`}
      >
        <div className="flex items-start sm:items-center gap-3">
          <div
            className={`p-2.5 rounded-xl shrink-0 ${
              isLocked
                ? "bg-rose-600 text-white shadow-sm"
                : "bg-emerald-600 text-white shadow-sm"
            }`}
          >
            {isLocked ? (
              <Lock className="w-5 h-5" />
            ) : (
              <Unlock className="w-5 h-5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold">
                {isLocked
                  ? "এই পরীক্ষার নম্বর ফ্রিজ (লক) করা আছে"
                  : "নম্বর এন্ট্রি উন্মুক্ত (Unlocked)"}
              </h3>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  isLocked
                    ? "bg-rose-100 text-rose-800 border border-rose-300"
                    : "bg-emerald-100 text-emerald-800 border border-emerald-300"
                }`}
              >
                {isLocked ? "সুরক্ষিত / রিড-অনলি" : "সম্পাদনাযোগ্য"}
              </span>
            </div>
            <p className="text-xs mt-0.5 opacity-90">
              {isLocked
                ? `${currentReason ? `কারণ: ${currentReason} • ` : ""}${
                    lockedByName ? `লক করেছেন: ${lockedByName}` : ""
                  }${
                    lockedAt
                      ? ` (${new Date(lockedAt).toLocaleDateString("bn-BD")})`
                      : ""
                  }${
                    !canManageLocks
                      ? " — পরিবর্তন করতে মুহতামিম বা সুপার অ্যাডমিনের অনুমতি প্রয়োজন।"
                      : ""
                  }`
                : "সকল বিষয়ের নম্বর এন্ট্রি ও যাচাই শেষ হলে ফলাফল সুরক্ষিত রাখতে পরীক্ষাটি লক/ফ্রিজ করে দিন।"}
            </p>
          </div>
        </div>

        {canManageLocks && (
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => openModal(!isLocked)}
              disabled={loading}
              className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition flex items-center gap-1.5 shadow-xs ${
                isLocked
                  ? "bg-white hover:bg-amber-50 text-amber-800 border border-amber-300"
                  : "bg-rose-600 hover:bg-rose-700 text-white"
              }`}
            >
              {isLocked ? (
                <>
                  <Unlock className="w-4 h-4" />
                  <span>আনলক করুন</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>নম্বর ফ্রিজ (লক) করুন</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
              : "bg-rose-50 text-rose-900 border border-rose-200"
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

      {showModal && renderModal()}
    </div>
  );
}
