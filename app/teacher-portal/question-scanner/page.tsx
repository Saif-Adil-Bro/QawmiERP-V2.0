"use client";

import React, { useState } from "react";
import { AIQuestionScannerModal } from "@/components/ai/AIQuestionScannerModal";
import { Sparkles, Camera, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function TeacherQuestionScannerPage() {
  const [modalOpen, setModalOpen] = useState(true);

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <Link
            href="/teacher-portal"
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>উস্তাদদের এআই প্রশ্নপত্র স্ক্যানার</span>
              <span className="text-[11px] bg-amber-100 text-amber-900 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>AI Vision</span>
              </span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              হাতে লেখা বা বইয়ের প্রশ্নের ছবি তুলে দ্রুত ডিজিটাল প্রশ্নপত্র তৈরি ও প্রিন্ট করুন
            </p>
          </div>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all shrink-0"
        >
          <Camera className="w-4 h-4 text-amber-300" />
          <span>স্ক্যানার খুলুন</span>
        </button>
      </div>

      {modalOpen && (
        <AIQuestionScannerModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}
