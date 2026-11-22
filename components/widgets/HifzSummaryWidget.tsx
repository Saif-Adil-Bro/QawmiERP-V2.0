"use client";

import React from "react";
import Link from "next/link";
import {
  BookOpen,
  Award,
  AlertTriangle,
  Calendar,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import type { HifzDashboardSummary } from "@/lib/hifz-upgrade-utils";
import { toBanglaNumber } from "@/lib/numberToBangla";

interface Props {
  summary: HifzDashboardSummary;
}

export default function HifzSummaryWidget({ summary }: Props) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 flex items-center justify-center text-teal-600 dark:text-teal-400 shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              হিফজুল কুরআন ও সবিনা সারসংক্ষেপ
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              সবকী বনাম খতমী, সাপ্তাহিক বৃহস্পতিবারের সবিনা ও বিশেষ সবিনা
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/hifz"
          className="text-xs font-bold text-teal-600 dark:text-teal-400 hover:underline inline-flex items-center gap-1 shrink-0"
        >
          সব দেখুন
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/60 p-3">
          <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
            সবকী (Sabqi)
          </div>
          <div className="text-lg font-extrabold text-emerald-900 dark:text-emerald-100 mt-0.5">
            {toBanglaNumber(summary.sabqiCount)} জন
          </div>
        </div>

        <div className="rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 p-3">
          <div className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">
            খতমী (Khatmi)
          </div>
          <div className="text-lg font-extrabold text-indigo-900 dark:text-indigo-100 mt-0.5">
            {toBanglaNumber(summary.khatmiCount)} জন
          </div>
        </div>

        <div className="rounded-xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/60 p-3">
          <div className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-1">
            <Award className="w-3 h-3" />
            মোট খতম
          </div>
          <div className="text-lg font-extrabold text-amber-900 dark:text-amber-100 mt-0.5">
            {toBanglaNumber(summary.monthlyKhatamsCount)} বার
          </div>
        </div>

        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700 p-3">
          <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
            আজকের এন্ট্রি
          </div>
          <div className="text-lg font-extrabold text-slate-900 dark:text-slate-100 mt-0.5">
            {toBanglaNumber(summary.todayEntriesCount)} টি
          </div>
        </div>
      </div>

      {/* Sabina Highlights */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200/70 dark:border-blue-800 font-semibold">
            <Calendar className="w-3.5 h-3.5" />
            বৃহস্পতিবারের সবিনা: {toBanglaNumber(summary.thursdaySabinaCount)}টি
          </span>
          {summary.weakParasCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200/70 dark:border-rose-800 font-semibold">
              <AlertTriangle className="w-3.5 h-3.5" />
              দুর্বল পারা: {toBanglaNumber(summary.weakParasCount)}টি
            </span>
          )}
        </div>

        {summary.ongoingSpecialSabinaTitle && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200/70 dark:border-purple-800 font-semibold truncate max-w-full">
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">চলমান সবিনা: {summary.ongoingSpecialSabinaTitle}</span>
          </span>
        )}
      </div>

      {/* Action Links */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
        <Link
          href="/teacher-portal/hifz"
          className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition"
        >
          দৈনিক সবক ও সবিনা এন্ট্রি
        </Link>
        <Link
          href="/dashboard/hifz/report"
          className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-teal-700 dark:hover:text-teal-400 inline-flex items-center gap-1"
        >
          বিস্তারিত রিপোর্ট
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
