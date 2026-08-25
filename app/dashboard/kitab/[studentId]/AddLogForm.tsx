"use client";

import { useActionState, useEffect, useRef } from "react";
import { createKitabLog } from "@/app/actions/kitab";

const initialState: { error?: string; success?: boolean } = {};

export default function AddKitabLogForm({ studentId }: { studentId: string }) {
  const [state, formAction, isPending] = useActionState(createKitabLog, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset();
      // Set today's date back after reset
      const dateInput = formRef.current?.elements.namedItem('log_date') as HTMLInputElement;
      if (dateInput) {
        dateInput.value = new Date().toISOString().split('T')[0];
      }
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
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
          defaultValue={new Date().toISOString().split('T')[0]}
          required
          className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="kitab_name" className="text-sm font-medium text-slate-700">কিতাবের নাম <span className="text-red-500">*</span></label>
        <input
          type="text"
          id="kitab_name"
          name="kitab_name"
          required
          placeholder="যেমন: হেদায়াতুন্নাহু"
          className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label htmlFor="page_from" className="text-sm font-medium text-slate-700">পৃষ্ঠা/অধ্যায় (শুরু)</label>
          <input
            type="text"
            id="page_from"
            name="page_from"
            placeholder="যেমন: ১২"
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="page_to" className="text-sm font-medium text-slate-700">পৃষ্ঠা/অধ্যায় (শেষ)</label>
          <input
            type="text"
            id="page_to"
            name="page_to"
            placeholder="যেমন: ১৫"
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
        <label htmlFor="notes" className="text-sm font-medium text-slate-700">মন্তব্য (ঐচ্ছিক)</label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          placeholder="কোনো বিশেষ মন্তব্য থাকলে লিখুন..."
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
