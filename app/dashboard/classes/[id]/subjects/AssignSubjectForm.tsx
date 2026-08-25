"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { assignSubjectToClass } from "@/app/actions/class_subjects";
import { CheckCircle2, AlertCircle, RefreshCw, PlusCircle } from "lucide-react";

export default function AssignSubjectForm({ 
  classId, 
  unassignedSubjects 
}: { 
  classId: string; 
  unassignedSubjects: any[]; 
}) {
  const router = useRouter();
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedSubjectId) {
      setError("অনুগ্রহ করে একটি বিষয়/কিতাব নির্বাচন করুন");
      return;
    }

    setIsPending(true);
    setError("");
    setSuccess("");

    try {
      const res = await assignSubjectToClass(classId, selectedSubjectId);
      if (res.error) {
        setError(res.error);
      } else {
        setSuccess("বিষয়টি সফলভাবে জামাতে বরাদ্দ করা হয়েছে!");
        setSelectedSubjectId("");
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || "একটি সমস্যা হয়েছে।");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-rose-50 text-rose-700 rounded-xl text-xs sm:text-sm border border-rose-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-xs sm:text-sm border border-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      {unassignedSubjects.length === 0 ? (
        <div className="text-xs sm:text-sm text-slate-500 bg-slate-50 p-4 rounded-xl border border-slate-200 text-center">
          প্রতিষ্ঠানটিতে বিদ্যমান সকল বিষয় ইতিমধ্যেই এই জামাতে বরাদ্দ করা হয়ে গেছে।
        </div>
      ) : (
        <>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              বিষয় / কিতাব নির্বাচন করুন
            </label>
            <select
              value={selectedSubjectId}
              onChange={(e) => {
                setSelectedSubjectId(e.target.value);
                setError("");
                setSuccess("");
              }}
              className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-white text-slate-800 text-sm font-medium"
              required
            >
              <option value="" disabled>-- বিষয় নির্বাচন করুন --</option>
              {unassignedSubjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name} {sub.code ? `(${sub.code})` : ""}
                </option>
              ))}
            </select>
          </div>
          
          <button
            type="submit"
            disabled={isPending || !selectedSubjectId}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            {isPending ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>বরাদ্দ করা হচ্ছে...</span>
              </>
            ) : (
              <>
                <PlusCircle className="w-4 h-4" />
                <span>বিষয় বরাদ্দ নিশ্চিত করুন</span>
              </>
            )}
          </button>
        </>
      )}
    </form>
  );
}
