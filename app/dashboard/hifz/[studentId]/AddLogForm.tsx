"use client";

import { useActionState, useEffect, useState } from "react";
import { createHifzLog } from "@/app/actions/hifz";
import { format } from "date-fns";

const initialState: { error?: string; success?: boolean } = {};

export default function AddLogForm({ studentId }: { studentId: string }) {
  const [state, formAction, isPending] = useActionState(createHifzLog, initialState);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (state?.success) {
      const form = document.getElementById("add-log-form") as HTMLFormElement;
      if (form) form.reset();
      setIsPaused(false);

      const dateInput = document.getElementById("log_date") as HTMLInputElement;
      if (dateInput) dateInput.value = format(new Date(), "yyyy-MM-dd");
    }
  }, [state]);

  return (
    <form id="add-log-form" action={formAction} className="space-y-4 text-xs sm:text-sm">
      <input type="hidden" name="student_id" value={studentId} />

      {state?.error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold">
          {state.error}
        </div>
      )}

      {state?.success && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold">
          আলহামদুলিল্লাহ! হিফজ লগ সফলভাবে সংরক্ষিত হয়েছে।
        </div>
      )}

      {/* Date & Stage */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="log_date" className="block text-slate-700 font-semibold mb-1">
            তারিখ <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            id="log_date"
            name="log_date"
            required
            defaultValue={format(new Date(), "yyyy-MM-dd")}
            className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 transition font-medium bg-white"
          />
        </div>

        <div>
          <label htmlFor="hifz_stage" className="block text-slate-700 font-semibold mb-1">
            ছাত্রের বর্তমান স্তর
          </label>
          <select
            id="hifz_stage"
            name="hifz_stage"
            defaultValue="HIFZ"
            className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 transition bg-white font-medium"
          >
            <option value="HIFZ">হিফজ (চলমান)</option>
            <option value="QAIDA">কায়দা / আমপারা</option>
            <option value="NAZERA">নাজেরা</option>
            <option value="DAWR">দাওর / খতম রিভিশন</option>
          </select>
        </div>
      </div>

      {/* Sabak (New Lesson) Section */}
      <div className="p-3.5 bg-emerald-50/60 border border-emerald-100 rounded-2xl space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-bold text-emerald-900 text-xs uppercase tracking-wider">
            ১. সবক (নতুন পাঠ)
          </span>
          <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
            <input
              type="checkbox"
              name="is_sabak_paused"
              value="true"
              checked={isPaused}
              onChange={(e) => setIsPaused(e.target.checked)}
              className="rounded text-amber-600 focus:ring-amber-500"
            />
            <span>আজ সবক বন্ধ ছিল</span>
          </label>
        </div>

        {!isPaused ? (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label htmlFor="sabak_para" className="block text-[11px] font-semibold text-slate-600 mb-1">
                  সবক পারা
                </label>
                <input
                  type="number"
                  id="sabak_para"
                  name="sabak_para"
                  min="1"
                  max="30"
                  placeholder="১-৩০"
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 font-semibold"
                />
              </div>

              <div>
                <label htmlFor="sabak_page_from" className="block text-[11px] font-semibold text-slate-600 mb-1">
                  পৃষ্ঠা হতে
                </label>
                <input
                  type="number"
                  id="sabak_page_from"
                  name="sabak_page_from"
                  min="1"
                  max="650"
                  placeholder="শুরু"
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 font-semibold"
                />
              </div>

              <div>
                <label htmlFor="sabak_page_to" className="block text-[11px] font-semibold text-slate-600 mb-1">
                  পৃষ্ঠা পর্যন্ত
                </label>
                <input
                  type="number"
                  id="sabak_page_to"
                  name="sabak_page_to"
                  min="1"
                  max="650"
                  placeholder="শেষ"
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 font-semibold"
                />
              </div>
            </div>

            <div>
              <label htmlFor="sabak_lines" className="block text-[11px] font-semibold text-slate-600 mb-1">
                সবকের পরিমাণ (যেমন: ১ পৃষ্ঠা বা ৮ লাইন)
              </label>
              <input
                type="text"
                id="sabak_lines"
                name="sabak_lines"
                placeholder="যেমন: ১ পৃষ্ঠা / ১০ লাইন"
                className="w-full px-3 py-1.5 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>
        ) : (
          <p className="text-xs text-amber-800 italic bg-amber-50/80 p-2 rounded-xl">
            আমুখতা/সবকী কাঁচা থাকার কারণে আজ নতুন সবক বন্ধ রাখা হয়েছে।
          </p>
        )}
      </div>

      {/* Saboki & Amukhta Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Saboki */}
        <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-2xl space-y-2">
          <span className="font-bold text-indigo-900 text-xs uppercase tracking-wider block">
            ২. সাত সবক / সবকী
          </span>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="saboki_para" className="block text-[11px] font-semibold text-slate-600 mb-1">
                পারা নং
              </label>
              <input
                type="number"
                id="saboki_para"
                name="saboki_para"
                min="1"
                max="30"
                placeholder="১-৩০"
                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-xl bg-white"
              />
            </div>
            <div>
              <label htmlFor="saboki_pages" className="block text-[11px] font-semibold text-slate-600 mb-1">
                পরিমাণ (পৃষ্ঠা)
              </label>
              <input
                type="text"
                id="saboki_pages"
                name="saboki_pages"
                placeholder="যেমন: ২ পৃষ্ঠা"
                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-xl bg-white"
              />
            </div>
          </div>
        </div>

        {/* Amukhta */}
        <div className="p-3 bg-purple-50/60 border border-purple-100 rounded-2xl space-y-2">
          <span className="font-bold text-purple-900 text-xs uppercase tracking-wider block">
            ৩. আমুখতা (পুরাতন পাঠ)
          </span>
          <div className="grid grid-cols-3 gap-1.5">
            <div>
              <label htmlFor="amukhta_para" className="block text-[11px] font-semibold text-slate-600 mb-1">
                পারা
              </label>
              <input
                type="number"
                id="amukhta_para"
                name="amukhta_para"
                min="1"
                max="30"
                placeholder="১-৩০"
                className="w-full px-2 py-1.5 border border-slate-200 rounded-xl bg-white"
              />
            </div>
            <div>
              <label htmlFor="amukhta_amount" className="block text-[11px] font-semibold text-slate-600 mb-1">
                পরিমাণ
              </label>
              <input
                type="text"
                id="amukhta_amount"
                name="amukhta_amount"
                placeholder="যেমন: ১ পারা"
                className="w-full px-2 py-1.5 border border-slate-200 rounded-xl bg-white"
              />
            </div>
            <div>
              <label htmlFor="mistake_count" className="block text-[11px] font-semibold text-slate-600 mb-1">
                লোকমা (ভুল)
              </label>
              <input
                type="number"
                id="mistake_count"
                name="mistake_count"
                min="0"
                placeholder="০"
                className="w-full px-2 py-1.5 border border-slate-200 rounded-xl bg-white font-bold text-rose-700"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Rating & Tilawat */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="performance_rating" className="block text-slate-700 font-semibold mb-1">
            পারফরম্যান্স মান
          </label>
          <select
            id="performance_rating"
            name="performance_rating"
            defaultValue="Good"
            className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 transition bg-white font-medium"
          >
            <option value="Excellent">চমৎকার / মুমতাজ (Excellent)</option>
            <option value="Good">ভালো / জায়্যিদ জিদ্দান (Good)</option>
            <option value="Average">মোটামুটি / জায়্যিদ (Average)</option>
            <option value="Poor">দুর্বল / তাকীদ (Poor)</option>
          </select>
        </div>

        <div>
          <label htmlFor="daily_tilawat" className="block text-slate-700 font-semibold mb-1">
            দৈনিক নফল তেলাওয়াত
          </label>
          <input
            type="text"
            id="daily_tilawat"
            name="daily_tilawat"
            placeholder="যেমন: সূরা ইয়াসিন / পারা ৩০"
            className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 transition bg-white"
          />
        </div>
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="notes" className="block text-slate-700 font-semibold mb-1">
          উস্তাদের মন্তব্য বা বিশেষ নির্দেশনা (ঐচ্ছিক)
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          placeholder="বাসায় আমুখতা বারবার মশ্‌ক করার জন্য অভিভাবককে তাগিদ দেওয়া হলো..."
          className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 transition resize-none bg-white"
        ></textarea>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-4 rounded-xl transition shadow-xs disabled:opacity-50 cursor-pointer"
      >
        {isPending ? "সংরক্ষণ হচ্ছে..." : "হিফজ লগ সংরক্ষণ করুন"}
      </button>
    </form>
  );
}
