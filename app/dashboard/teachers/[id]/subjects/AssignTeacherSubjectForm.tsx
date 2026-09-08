"use client";

import { useState } from "react";
import { assignSubjectToTeacher } from "@/app/actions/teacher_subjects";
import { BookOpen, Check, AlertCircle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export default function AssignTeacherSubjectForm({
  teacherId,
  unassignedClassSubjects,
}: {
  teacherId: string;
  unassignedClassSubjects: any[];
}) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsPending(true);
    setError("");
    setSuccessMsg("");

    const form = e.currentTarget;
    const formData = new FormData(form);
    const classSubjectStr = formData.get("class_subject") as string;

    if (!classSubjectStr) {
      setError("অনুগ্রহ করে একটি বিষয় নির্বাচন করুন।");
      setIsPending(false);
      return;
    }

    const [classId, subjectId] = classSubjectStr.split("|");

    try {
      const res = await assignSubjectToTeacher(teacherId, classId, subjectId);
      if (res?.error) {
        setError(res.error);
      } else {
        setSuccessMsg("বিষয় সফলভাবে এসাইন করা হয়েছে!");
        form.reset();
        router.refresh();
      }
    } catch (err) {
      console.error("assignSubjectToTeacher failed:", err);
      setError("একটি অপ্রত্যাশিত সমস্যা হয়েছে। অনুগ্রহ করে পেজ রিফ্রেশ করে আবার চেষ্টা করুন।");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-rose-50 text-rose-800 rounded-xl text-xs sm:text-sm border border-rose-200 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-xs sm:text-sm border border-emerald-200 flex items-start gap-2">
          <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      {unassignedClassSubjects.length === 0 ? (
        <div className="text-xs sm:text-sm text-slate-500 bg-slate-50 p-4 rounded-xl border border-slate-200/80 text-center">
          <BookOpen className="w-6 h-6 text-slate-400 mx-auto mb-1.5" />
          <p className="font-semibold text-slate-700">এসাইন করার মতো কোনো বিষয় অবশিষ্ট নেই।</p>
          <p className="text-[11px] text-slate-400 mt-1">সব জামাত-বিষয় ইতিমধ্যে বণ্টন করা আছে অথবা জামাত তালিকায় বিষয় যুক্ত নেই।</p>
        </div>
      ) : (
        <>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">
              জামাত ও বিষয় নির্বাচন করুন <span className="text-rose-500">*</span>
            </label>
            <select
              name="class_subject"
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-slate-900 font-medium"
              defaultValue=""
              required
            >
              <option value="" disabled>
                -- বিষয় ও জামাত নির্বাচন করুন --
              </option>
              {unassignedClassSubjects.map((cs) => (
                <option key={cs.id} value={`${cs.class_id}|${cs.subject_id}`}>
                  {cs.classes?.name || "জামাত"} — {cs.subjects?.name || "বিষয়"} {cs.subjects?.code ? `(${cs.subjects.code})` : ""}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-xs"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>এসাইন করা হচ্ছে...</span>
              </>
            ) : (
              <span>বিষয় এসাইন করুন</span>
            )}
          </button>
        </>
      )}
    </form>
  );
}
