"use client";

import { removeSubjectFromTeacher } from "@/app/actions/teacher_subjects";
import { acquireSaveGuard } from "@/lib/save-guard";
import { Trash2, Loader2, AlertTriangle, X } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RemoveTeacherSubjectButton({
  teacherSubjectId,
  teacherId,
  subjectName,
  className,
}: {
  teacherSubjectId: string;
  teacherId: string;
  subjectName?: string;
  className?: string;
}) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleConfirmRemove = async () => {
    setIsPending(true);
    setErrorMsg("");
    const releaseGuard = acquireSaveGuard("teacher-subject-remove");
    try {
      const res = await removeSubjectFromTeacher(teacherSubjectId, teacherId);
      if (res?.error) {
        setErrorMsg(res.error);
      } else {
        setConfirmOpen(false);
        router.refresh();
      }
    } catch (err) {
      console.error("removeSubjectFromTeacher failed:", err);
      setErrorMsg("একটি অপ্রত্যাশিত সমস্যা হয়েছে। অনুগ্রহ করে পেজ রিফ্রেশ করে আবার চেষ্টা করুন।");
    } finally {
      releaseGuard();
      setIsPending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setErrorMsg("");
          setConfirmOpen(true);
        }}
        disabled={isPending}
        className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors disabled:opacity-50 cursor-pointer border border-transparent hover:border-rose-200"
        title="বিষয়টি বাদ দিন"
        aria-label="Remove subject"
      >
        {isPending ? <Loader2 className="w-4 h-4 animate-spin text-rose-500" /> : <Trash2 className="w-4 h-4" />}
      </button>

      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`remove-subject-title-${teacherSubjectId}`}
        >
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-5 sm:p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <h3
                    id={`remove-subject-title-${teacherSubjectId}`}
                    className="text-base font-black text-slate-900"
                  >
                    বিষয় বরাদ্দ বাতিল করুন
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">এই কাজটি নিশ্চিত করুন</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isPending && setConfirmOpen(false)}
                disabled={isPending}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                aria-label="বন্ধ করুন"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-sm text-slate-700 leading-relaxed">
              আপনি কি নিশ্চিত যে এই শিক্ষক থেকে{" "}
              <span className="font-bold text-slate-900">
                {subjectName ? `"${subjectName}"` : "এই বিষয়টি"}
              </span>
              {className ? (
                <>
                  {" "}
                  (<span className="font-semibold text-emerald-700">{className}</span>)
                </>
              ) : null}{" "}
              বাদ দিতে চান?
            </p>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700">
                {errorMsg}
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={isPending}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-bold transition-colors disabled:opacity-50 cursor-pointer"
              >
                বাতিল করুন
              </button>
              <button
                type="button"
                onClick={handleConfirmRemove}
                disabled={isPending}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-bold transition-colors disabled:opacity-50 inline-flex items-center gap-2 cursor-pointer"
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>মুছে ফেলা হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>হ্যাঁ, মুছে ফেলুন</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
