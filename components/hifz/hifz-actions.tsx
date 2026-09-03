"use client";

import { deleteHifzLog, updateHifzLog } from "@/app/actions/hifz";
import { useState } from "react";
import { Trash2, Edit, X, Save } from "lucide-react";

export function HifzDeleteButton({ logId, studentId }: { logId: string, studentId: string }) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (confirm("আপনি কি নিশ্চিত যে এই হিফজ লগটি মুছে ফেলতে চান?")) {
      setIsDeleting(true);
      try {
        await deleteHifzLog(logId, studentId);
      } catch (err) {
        console.error("deleteHifzLog failed:", err);
        alert("একটি অপ্রত্যাশিত সমস্যা হয়েছে। অনুগ্রহ করে পেজ রিফ্রেশ করে আবার চেষ্টা করুন।");
      } finally {
        setIsDeleting(false);
      }
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={isDeleting}
      className="text-rose-500 hover:text-rose-700 font-medium transition flex items-center justify-center p-1.5 rounded-lg hover:bg-rose-50 disabled:opacity-50 cursor-pointer"
      title="লগ মুছুন"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  );
}

export function HifzLogActions({ log, studentId }: { log: any; studentId: string }) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMsg("");

    try {
      const formEl = e.currentTarget;
      const formData = new FormData(formEl);
      const res = await updateHifzLog(log.id, null, formData);
      if (res?.error) {
        setErrorMsg(res.error);
      } else {
        setIsEditOpen(false);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "হালনাগাদ করা যায়নি।");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex items-center space-x-1.5">
      <button
        type="button"
        onClick={() => setIsEditOpen(true)}
        className="inline-flex items-center space-x-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg transition cursor-pointer"
        title="সম্পাদনা করুন"
      >
        <Edit className="w-3.5 h-3.5" />
        <span>সম্পাদনা</span>
      </button>

      <HifzDeleteButton logId={log.id} studentId={studentId} />

      {isEditOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-base">হিফজ লগ সম্পাদনা করুন</h3>
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleUpdate} className="mt-4 space-y-4 text-xs sm:text-sm">
              <div>
                <label className="block text-slate-600 font-semibold mb-1">তারিখ</label>
                <input
                  type="date"
                  name="log_date"
                  defaultValue={log.log_date?.split("T")[0] || ""}
                  required
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">সবক (পারা)</label>
                  <input
                    type="number"
                    name="sabak_para"
                    min={1}
                    max={30}
                    defaultValue={log.sabak_para ?? ""}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">সবক (পৃষ্ঠা)</label>
                  <input
                    type="number"
                    name="sabak_page"
                    min={1}
                    max={650}
                    defaultValue={log.sabak_page ?? ""}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">সবকী (পারা)</label>
                  <input
                    type="number"
                    name="saboki_para"
                    min={1}
                    max={30}
                    defaultValue={log.saboki_para ?? ""}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">আমুখতা (পারা)</label>
                  <input
                    type="number"
                    name="amukhta_para"
                    min={1}
                    max={30}
                    defaultValue={log.amukhta_para ?? ""}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">পারফরম্যান্স মান</label>
                <select
                  name="performance_rating"
                  defaultValue={log.performance_rating || "Good"}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-medium"
                >
                  <option value="Excellent">চমৎকার (Excellent)</option>
                  <option value="Good">ভালো (Good)</option>
                  <option value="Average">মোটামুটি (Average)</option>
                  <option value="Poor">দুর্বল (Poor)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">মন্তব্য</label>
                <textarea
                  name="notes"
                  rows={3}
                  defaultValue={log.notes || ""}
                  placeholder="উস্তাদের বিশেষ নির্দেশনা বা মন্তব্য..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 font-semibold"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? "সংরক্ষণ হচ্ছে..." : "হালনাগাদ করুন"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

