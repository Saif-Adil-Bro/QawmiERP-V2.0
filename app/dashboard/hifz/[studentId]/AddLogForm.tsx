"use client";

import { useActionState, useEffect } from "react";
import { createHifzLog } from "@/app/actions/hifz";
import { format } from "date-fns";

const initialState: { error?: string; success?: boolean } = {};

export default function AddLogForm({ studentId }: { studentId: string }) {
  const [state, formAction, isPending] = useActionState(createHifzLog, initialState);

  useEffect(() => {
    if (state?.success) {
      // Optional: reset form or show success message
      const form = document.getElementById('add-log-form') as HTMLFormElement;
      if (form) form.reset();
      
      // Default to today
      const dateInput = document.getElementById('log_date') as HTMLInputElement;
      if (dateInput) dateInput.value = format(new Date(), "yyyy-MM-dd");
    }
  }, [state]);

  return (
    <form id="add-log-form" action={formAction} className="space-y-4">
      <input type="hidden" name="student_id" value={studentId} />
      
      {state?.error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">
          {state.error}
        </div>
      )}
      
      {state?.success && (
        <div className="p-3 bg-green-50 text-green-700 rounded-md text-sm">
          লগ সফলভাবে যুক্ত হয়েছে!
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor="log_date" className="text-sm font-medium text-slate-700">তারিখ <span className="text-red-500">*</span></label>
        <input
          type="date"
          id="log_date"
          name="log_date"
          required
          defaultValue={format(new Date(), "yyyy-MM-dd")}
          className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label htmlFor="sabak_para" className="text-sm font-medium text-slate-700">সবক পারা</label>
          <input
            type="number"
            id="sabak_para"
            name="sabak_para"
            min="1" max="30"
            placeholder="১-৩০"
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="sabak_page" className="text-sm font-medium text-slate-700">সবক পৃষ্ঠা</label>
          <input
            type="number"
            id="sabak_page"
            name="sabak_page"
            min="1"
            placeholder="পৃষ্ঠা নং"
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label htmlFor="saboki_para" className="text-sm font-medium text-slate-700">সবকী পারা</label>
          <input
            type="number"
            id="saboki_para"
            name="saboki_para"
            min="1" max="30"
            placeholder="১-৩০"
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="amukhta_para" className="text-sm font-medium text-slate-700">আমুখতা পারা</label>
          <input
            type="number"
            id="amukhta_para"
            name="amukhta_para"
            min="1" max="30"
            placeholder="১-৩০"
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="performance_rating" className="text-sm font-medium text-slate-700">পারফরম্যান্স</label>
        <select
          id="performance_rating"
          name="performance_rating"
          className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 transition bg-white"
        >
          <option value="">রেটিং নির্বাচন করুন</option>
          <option value="Excellent">চমৎকার</option>
          <option value="Good">ভালো</option>
          <option value="Average">মোটামুটি</option>
          <option value="Poor">খারাপ</option>
        </select>
      </div>

      <div className="space-y-2">
        <label htmlFor="daily_tilawat" className="text-sm font-medium text-slate-700">দৈনিক তেলাওয়াত (পারা/সূরা)</label>
        <input
          type="text"
          id="daily_tilawat"
          name="daily_tilawat"
          placeholder="যেমন: সূরা ইয়াসিন বা পারা ৩০"
          className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="notes" className="text-sm font-medium text-slate-700">মন্তব্য (ঐচ্ছিক)</label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 transition resize-none"
        ></textarea>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-slate-900 text-white px-6 py-2 rounded-md hover:bg-slate-800 disabled:opacity-50 transition"
      >
        {isPending ? "সেভ হচ্ছে..." : "লগ সেভ করুন"}
      </button>
    </form>
  );
}
