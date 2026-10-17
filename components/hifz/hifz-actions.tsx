"use client";

import { toDhakaDateStringFrom } from "@/lib/date-utils";
import { deleteHifzLog, updateHifzLog } from "@/app/actions/hifz";
import { parseHifzLogNotes } from "@/lib/hifz-utils";
import { useState } from "react";
import { Trash2, Edit, X, Save } from "lucide-react";

export function HifzDeleteButton({ logId, studentId }: { logId: string; studentId: string }) {
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
  const [isPaused, setIsPaused] = useState(Boolean(log.is_sabak_paused));

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
        onClick={() => {
          setIsPaused(Boolean(log.is_sabak_paused));
          setIsEditOpen(true);
        }}
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
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-semibold">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleUpdate} className="mt-4 space-y-4 text-xs sm:text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">তারিখ</label>
                  <input
                    type="date"
                    name="log_date"
                    defaultValue={toDhakaDateStringFrom(log.log_date) || ""}
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">ছাত্রের স্তর</label>
                  <select
                    name="hifz_stage"
                    defaultValue={log.hifz_stage || "HIFZ"}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-medium"
                  >
                    <option value="HIFZ">হিফজ (চলমান)</option>
                    <option value="QAIDA">কায়দা / আমপারা</option>
                    <option value="NAZERA">নাজেরা</option>
                    <option value="DAWR">দাওর / খতম রিভিশন</option>
                  </select>
                </div>
              </div>

              {/* Sabak */}
              <div className="p-3 bg-emerald-50/60 border border-emerald-100 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-900 text-xs">সবক (নতুন পাঠ)</span>
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-semibold">
                    <input
                      type="checkbox"
                      name="is_sabak_paused"
                      value="true"
                      checked={isPaused}
                      onChange={(e) => setIsPaused(e.target.checked)}
                      className="rounded text-amber-600"
                    />
                    <span>আজ সবক বন্ধ</span>
                  </label>
                </div>

                {!isPaused ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[11px] text-slate-600 mb-1">পারা</label>
                        <input
                          type="number"
                          name="sabak_para"
                          min={1}
                          max={30}
                          defaultValue={log.sabak_para ?? ""}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-xl bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-600 mb-1">পৃষ্ঠা হতে</label>
                        <input
                          type="number"
                          name="sabak_page_from"
                          min={1}
                          max={650}
                          defaultValue={log.sabak_page_from ?? log.sabak_page ?? ""}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-xl bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-600 mb-1">পৃষ্ঠা পর্যন্ত</label>
                        <input
                          type="number"
                          name="sabak_page_to"
                          min={1}
                          max={650}
                          defaultValue={log.sabak_page_to ?? log.sabak_page ?? ""}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-xl bg-white"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-600 mb-1">পরিমাণ (লাইন/পৃষ্ঠা)</label>
                      <input
                        type="text"
                        name="sabak_lines"
                        defaultValue={log.sabak_lines || ""}
                        placeholder="যেমন: ১ পৃষ্ঠা"
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-xl bg-white"
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-amber-800 italic">আজ নতুন সবক বন্ধ রাখা হয়েছে।</p>
                )}
              </div>

              {/* Saboki & Amukhta */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-2.5 bg-indigo-50/60 border border-indigo-100 rounded-2xl space-y-1.5">
                  <span className="font-bold text-indigo-900 text-xs block">সবকী</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <label className="block text-[10px] text-slate-500">পারা</label>
                      <input
                        type="number"
                        name="saboki_para"
                        min={1}
                        max={30}
                        defaultValue={log.saboki_para ?? ""}
                        className="w-full px-2 py-1 border border-slate-200 rounded-lg bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500">পৃষ্ঠা</label>
                      <input
                        type="text"
                        name="saboki_pages"
                        defaultValue={log.saboki_pages || ""}
                        placeholder="২ পৃষ্ঠা"
                        className="w-full px-2 py-1 border border-slate-200 rounded-lg bg-white text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-2.5 bg-purple-50/60 border border-purple-100 rounded-2xl space-y-1.5">
                  <span className="font-bold text-purple-900 text-xs block">আমুখতা & লোকমা</span>
                  <div className="grid grid-cols-3 gap-1">
                    <div>
                      <label className="block text-[10px] text-slate-500">পারা</label>
                      <input
                        type="number"
                        name="amukhta_para"
                        min={1}
                        max={30}
                        defaultValue={log.amukhta_para ?? ""}
                        className="w-full px-1.5 py-1 border border-slate-200 rounded-lg bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500">পরিমাণ</label>
                      <input
                        type="text"
                        name="amukhta_amount"
                        defaultValue={log.amukhta_amount || ""}
                        placeholder="১ পারা"
                        className="w-full px-1.5 py-1 border border-slate-200 rounded-lg bg-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500">ভুল</label>
                      <input
                        type="number"
                        name="mistake_count"
                        min={0}
                        defaultValue={log.mistake_count ?? 0}
                        className="w-full px-1.5 py-1 border border-slate-200 rounded-lg bg-white font-bold text-rose-700"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">পারফরম্যান্স মান</label>
                  <select
                    name="performance_rating"
                    defaultValue={log.performance_rating || "Good"}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-medium"
                  >
                    <option value="Excellent">চমৎকার / মুমতাজ</option>
                    <option value="Good">ভালো / জায়্যিদ জিদ্দান</option>
                    <option value="Average">মোটামুটি / জায়্যিদ</option>
                    <option value="Poor">দুর্বল / তাকীদ</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">দৈনিক তেলাওয়াত</label>
                  <input
                    type="text"
                    name="daily_tilawat"
                    defaultValue={log.daily_tilawat || ""}
                    placeholder="পারা/সূরা"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">মন্তব্য</label>
                <textarea
                  name="notes"
                  rows={2}
                  defaultValue={log.clean_notes !== undefined ? log.clean_notes : parseHifzLogNotes(log.notes).cleanNotes}
                  placeholder="উস্তাদের বিশেষ নির্দেশনা বা মন্তব্য..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 font-semibold cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
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
