"use client";

import React, { useState } from "react";
import { AIQuestionScannerModal } from "@/components/ai/AIQuestionScannerModal";
import { Sparkles, Camera, ArrowLeft, Printer, FileText } from "lucide-react";
import Link from "next/link";

export default function AIScannerPage() {
  const [modalOpen, setModalOpen] = useState(true);

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/exams"
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 flex flex-wrap items-center gap-2">
              <span>এআই প্রশ্নপত্র ও টেবিল স্ক্যানার</span>
              <span className="text-[11px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>Gemini Vision</span>
              </span>
              <span className="text-[11px] bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <span>Tesseract.js (১০০% ফ্রি)</span>
              </span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              হাতে লেখা বা প্রিন্ট করা প্রশ্নের ছবি দিয়ে বিনামূল্যে অফলাইনে (Tesseract.js) অথবা গুগল এআই দিয়ে স্বয়ংক্রিয়ভাবে প্রশ্নপত্র তৈরি করুন
            </p>
          </div>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all shrink-0"
        >
          <Camera className="w-4 h-4 text-amber-300" />
          <span>স্ক্যানার চালু করুন</span>
        </button>
      </div>

      {/* Feature Explainer Banner */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-lg">
            ১
          </div>
          <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">ছবি আপলোড বা ছবি তুলুন</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            মোবাইল ক্যামেরা দিয়ে সরাসরি প্রশ্নের পাতার ছবি তুলুন অথবা গ্যালারি থেকে পরিষ্কার ছবি আপলোড করুন।
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold text-lg">
            ২
          </div>
          <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">এআই ভিশন ও টেবিল ডিজিটাইজেশন</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            জেমিনি এআই বাংলা ও আরবি হরকতসহ টেক্সট এবং ক-স্তম্ভ/খ-স্তম্ভ টেবিল স্বয়ংক্রিয়ভাবে শনাক্ত ও গঠন করে।
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-lg">
            ৩
          </div>
          <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">এডিট ও এক ক্লিকে A4 প্রিন্ট</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            দ্বৈত স্ক্রিনে মিলিয়ে দেখে প্রয়োজনমতো এডিট করুন এবং মাদরাসার অফিসিয়াল প্রশ্নপত্র ফরম্যাটে প্রিন্ট করুন।
          </p>
        </div>
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
