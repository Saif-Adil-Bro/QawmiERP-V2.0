"use client";

import { useActionState, useEffect, useRef } from "react";
import { createExam } from "@/app/actions/exams";

const initialState: { error?: string; success?: boolean } = {};

export default function AddExamForm() {
  const [state, formAction, isPending] = useActionState(createExam, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 3 }, (_, i) => currentYear - 1 + i);

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-6">
      {state?.error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-md text-sm border border-red-100">
          {state.error}
        </div>
      )}
      
      {state?.success && (
        <div className="p-4 bg-green-50 text-green-700 rounded-md text-sm border border-green-100">
          পরীক্ষা সফলভাবে তৈরি করা হয়েছে!
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2 md:col-span-2">
          <label htmlFor="title" className="text-sm font-medium text-slate-700">পরীক্ষার নাম (Exam Title) <span className="text-red-500">*</span></label>
          <select
            id="title"
            name="title"
            required
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 transition bg-white"
          >
            <option value="">নির্বাচন করুন</option>
            <option value="ছামাহি (Quarterly)">ছামাহি (Quarterly)</option>
            <option value="শশমাহি (Half-Yearly)">শশমাহি (Half-Yearly)</option>
            <option value="সালানা (Annual)">সালানা (Annual)</option>
            <option value="মাসিক পরীক্ষা (Monthly Test)">মাসিক পরীক্ষা (Monthly Test)</option>
            <option value="অন্যান্য">অন্যান্য (Custom)</option>
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="year" className="text-sm font-medium text-slate-700">শিক্ষাবর্ষ (Year) <span className="text-red-500">*</span></label>
          <select
            id="year"
            name="year"
            required
            defaultValue={currentYear.toString()}
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 transition bg-white"
          >
            {years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="status" className="text-sm font-medium text-slate-700">অবস্থা (Status)</label>
          <select
            id="status"
            name="status"
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 transition bg-white"
          >
            <option value="Upcoming">আসন্ন (Upcoming)</option>
            <option value="Ongoing">চলমান (Ongoing)</option>
            <option value="Completed">সম্পন্ন (Completed)</option>
          </select>
        </div>

        <div className="space-y-2 md:col-span-2">
          <label htmlFor="start_date" className="text-sm font-medium text-slate-700">শুরুর তারিখ (Start Date)</label>
          <input
            type="date"
            id="start_date"
            name="start_date"
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
          />
        </div>
      </div>

      <div className="pt-4 border-t">
        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-slate-900 text-white px-6 py-2.5 rounded-md hover:bg-slate-800 disabled:opacity-50 transition font-medium"
        >
          {isPending ? "প্রসেসিং হচ্ছে..." : "পরীক্ষা তৈরি করুন"}
        </button>
      </div>
    </form>
  );
}
