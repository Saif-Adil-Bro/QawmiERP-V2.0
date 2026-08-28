"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createExam } from "@/app/actions/exams";
import { Calendar, Clock, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";

const initialState: { error?: string; success?: boolean } = {};

function getDynamicStatusInfo(startDate: string, endDate: string) {
  if (!startDate) {
    return {
      type: "Upcoming",
      label: "আসন্ন (Upcoming)",
      description: "শুরুর তারিখ ও শেষের তারিখের ওপর ভিত্তি করে অবস্থা স্বয়ংক্রিয়ভাবে হিসাব করা হবে।",
      badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
      dotClass: "bg-blue-500",
      isPulsing: false,
    };
  }

  let todayStr: string;
  try {
    todayStr = new Intl.DateTimeFormat('en-CA', { 
      timeZone: 'Asia/Dhaka', 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    }).format(new Date());
  } catch {
    todayStr = new Date().toISOString().split('T')[0];
  }

  const sStr = startDate.split('T')[0];
  const eStr = endDate ? endDate.split('T')[0] : sStr;

  if (todayStr < sStr) {
    return {
      type: "Upcoming",
      label: "আসন্ন (Upcoming)",
      description: "পরীক্ষার তারিখ নির্ধারিত রয়েছে, নির্ধারিত দিনে পরীক্ষা শুরু হবে।",
      badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
      dotClass: "bg-blue-500",
      isPulsing: false,
    };
  } else if (todayStr >= sStr && todayStr <= eStr) {
    return {
      type: "Ongoing",
      label: "চলমান (Ongoing)",
      description: "আজকের তারিখ শুরু ও শেষ তারিখের মধ্যে হওয়ায় পরীক্ষাটি বর্তমানে চলমান।",
      badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
      dotClass: "bg-amber-500",
      isPulsing: true,
    };
  } else {
    return {
      type: "Completed",
      label: "সম্পন্ন (Completed)",
      description: "পরীক্ষার সময়সীমা অতিক্রান্ত হয়েছে, পরীক্ষা সফলভাবে সম্পন্ন।",
      badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
      dotClass: "bg-emerald-500",
      isPulsing: false,
    };
  }
}

export default function AddExamForm() {
  const [state, formAction, isPending] = useActionState(createExam, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 3 }, (_, i) => currentYear - 1 + i);

  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset();
      setStartDate("");
      setEndDate("");
    }
  }, [state]);

  const statusInfo = getDynamicStatusInfo(startDate, endDate);

  return (
    <form ref={formRef} action={formAction} className="space-y-6">
      {state?.error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-md text-sm border border-red-100 flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{state.error}</span>
        </div>
      )}
      
      {state?.success && (
        <div className="p-4 bg-green-50 text-green-700 rounded-md text-sm border border-green-100 flex items-center space-x-2">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>পরীক্ষা সফলভাবে তৈরি করা হয়েছে!</span>
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

        <div className="space-y-2 md:col-span-2">
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
          <label htmlFor="start_date" className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-slate-500" />
            <span>শুরুর তারিখ (Start Date)</span>
          </label>
          <input
            type="date"
            id="start_date"
            name="start_date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 transition bg-white"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="end_date" className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-slate-500" />
            <span>শেষের তারিখ (End Date)</span>
          </label>
          <input
            type="date"
            id="end_date"
            name="end_date"
            value={endDate}
            min={startDate || undefined}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 transition bg-white"
          />
        </div>
      </div>

      {/* Dynamic Status Preview Banner */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-slate-700 font-medium text-xs sm:text-sm">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span>স্বয়ংক্রিয় অবস্থা (Automatic Dynamic Status)</span>
          </div>

          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${statusInfo.badgeClass}`}>
            <span className="relative flex h-2 w-2 mr-1.5">
              {statusInfo.isPulsing && (
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${statusInfo.dotClass}`}></span>
              )}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${statusInfo.dotClass}`}></span>
            </span>
            {statusInfo.label}
          </span>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed">
          {statusInfo.description}
        </p>
      </div>

      <div className="pt-4 border-t">
        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-slate-900 text-white px-6 py-2.5 rounded-md hover:bg-slate-800 disabled:opacity-50 transition font-medium shadow-xs"
        >
          {isPending ? "প্রসেসিং হচ্ছে..." : "পরীক্ষা তৈরি করুন"}
        </button>
      </div>
    </form>
  );
}
