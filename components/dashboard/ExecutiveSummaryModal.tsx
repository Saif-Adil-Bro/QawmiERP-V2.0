"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  X,
  Printer,
  Calendar,
  Building,
  Users,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Wallet,
  Scale,
  Award,
  Download,
  Loader2,
  ChevronDown,
  FileText,
  DollarSign,
  ShieldCheck,
} from "lucide-react";
import { getMonthlyExecutiveSummary, MonthlyExecutiveSummaryData } from "@/app/actions/executive-summary";

export function ExecutiveSummaryModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [data, setData] = useState<MonthlyExecutiveSummaryData | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => new Date().toISOString().substring(0, 7));
  const [isPending, startTransition] = useTransition();

  const loadData = (month: string) => {
    startTransition(async () => {
      try {
        const res = await getMonthlyExecutiveSummary(month);
        setData(res);
      } catch (err) {
        console.error("Failed to load executive summary:", err);
      }
    });
  };

  useEffect(() => {
    if (isOpen) {
      loadData(selectedMonth);
    }
  }, [isOpen, selectedMonth]);

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  const m = data?.metrics;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div
        className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col dark:bg-slate-900 dark:border-slate-800 sepia-mode:bg-[#FCF8F2] sepia-mode:border-[#E8DFD1]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Control Bar (Hidden in Print) */}
        <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between print:hidden shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-1.5 bg-emerald-600 rounded-lg text-white">
              <Scale className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold leading-tight">মাসিক সার্বিক নির্বাহী ড্যাশবোর্ড</h2>
              <p className="text-[11px] text-slate-300 leading-tight">
                মুহতামিম, নায়েবে মুহতামিম ও পরিচালনা কমিটির জন্য
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Month Selector */}
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-2.5 py-1 text-xs bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-hidden"
            />

            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5 shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>প্রিন্ট / PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body / Printable Sheet */}
        <div className="overflow-y-auto p-4 sm:p-8 space-y-6 flex-1 print:p-0 print:overflow-visible">
          {isPending && !data ? (
            <div className="py-20 text-center">
              <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-2" />
              <p className="text-sm text-slate-500">নির্বাহী তথ্য সংকলন করা হচ্ছে...</p>
            </div>
          ) : data ? (
            <div className="space-y-6">
              {/* Official Header */}
              <div className="text-center border-b pb-4 border-slate-200 dark:border-slate-800 sepia-mode:border-[#E8DFD1]">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 sepia-mode:text-[#2C1A0C]">
                  {data.madrasaInfo.name}
                </h1>
                <p className="text-xs text-slate-600 dark:text-slate-400 sepia-mode:text-[#7C6248] mt-0.5">
                  {data.madrasaInfo.address} | ফোন: {data.madrasaInfo.phone} | রেজি: {data.madrasaInfo.regNo}
                </p>
                <div className="inline-flex items-center gap-2 mt-2 px-3 py-1 bg-emerald-50 text-emerald-800 rounded-full border border-emerald-200 text-xs font-bold dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>মাসিক সার্বিক প্রশাসনিক ও আর্থিক প্রতিবেদন — {data.monthNameBn}</span>
                </div>
              </div>

              {/* 4 Main KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 sepia-mode:bg-[#F5EFE6] sepia-mode:border-[#E8DFD1]">
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">মোট শিক্ষার্থী ও শিক্ষক</p>
                  <p className="text-xl font-bold text-slate-800 dark:text-slate-100 mt-1">
                    {m?.totalStudents} <span className="text-xs font-normal text-slate-500">ছাত্র</span>
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    উস্তাদ: {m?.totalTeachers} জন | জামাত: {m?.activeClasses}টি
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900 sepia-mode:bg-[#EAE4D7] sepia-mode:border-[#D5C9B3]">
                  <p className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">চলতি মাসের মোট আয়</p>
                  <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400 mt-1">
                    ৳ {m?.totalIncome.toLocaleString("en-IN")}
                  </p>
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400/80 mt-0.5">
                    ফি: ৳{m?.feeCollection.toLocaleString("en-IN")} | যাকাত: ৳{m?.zakatCollection.toLocaleString("en-IN")}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-rose-50/70 border border-rose-200 dark:bg-rose-950/30 dark:border-rose-900 sepia-mode:bg-[#F3E2DB] sepia-mode:border-[#DEC3B8]">
                  <p className="text-[11px] font-semibold text-rose-800 dark:text-rose-300">চলতি মাসের মোট ব্যয়</p>
                  <p className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-1">
                    ৳ {m?.totalExpense.toLocaleString("en-IN")}
                  </p>
                  <p className="text-[10px] text-rose-600/80 dark:text-rose-400/80 mt-0.5">
                    মেস বাজার: ৳{m?.boardingBazarExpense.toLocaleString("en-IN")} | সাধারণ: ৳{m?.generalExpenses.toLocaleString("en-IN")}
                  </p>
                </div>

                <div
                  className={`p-4 rounded-xl border ${
                    (m?.netBalance || 0) >= 0
                      ? "bg-blue-50/70 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900"
                      : "bg-amber-50/70 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900"
                  }`}
                >
                  <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    {(m?.netBalance || 0) >= 0 ? "মাসিক নিট উদ্বৃত্ত" : "মাসিক নিট ঘাটতি"}
                  </p>
                  <p
                    className={`text-xl font-bold mt-1 ${
                      (m?.netBalance || 0) >= 0 ? "text-blue-700 dark:text-blue-400" : "text-amber-700 dark:text-amber-400"
                    }`}
                  >
                    ৳ {Math.abs(m?.netBalance || 0).toLocaleString("en-IN")}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    বকেয়া ফি: ৳{m?.totalDueAmount.toLocaleString("en-IN")} ({m?.studentsWithDueCount} জন)
                  </p>
                </div>
              </div>

              {/* Attendance & Hifz Progress Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Attendance Summary */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white dark:bg-slate-800/60 dark:border-slate-700 sepia-mode:bg-[#FDFBF7] sepia-mode:border-[#E8DFD1]">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>শিক্ষার্থী হাজিরা বিশ্লেষণ</span>
                    </h3>
                    <span className="text-xs font-bold text-emerald-600 px-2 py-0.5 bg-emerald-50 rounded-md">
                      গড় {m?.attendanceRate}% উপস্থিতি
                    </span>
                  </div>

                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden dark:bg-slate-700 mb-3">
                    <div
                      className="bg-emerald-600 h-2.5 rounded-full transition-all"
                      style={{ width: `${m?.attendanceRate}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2 bg-slate-50 rounded-lg dark:bg-slate-800">
                      <p className="text-slate-400 text-[10px]">মোট উপস্থিতি</p>
                      <p className="font-bold text-slate-800 dark:text-slate-200">{m?.totalPresents}</p>
                    </div>
                    <div className="p-2 bg-slate-50 rounded-lg dark:bg-slate-800">
                      <p className="text-slate-400 text-[10px]">অনুপস্থিতি</p>
                      <p className="font-bold text-rose-600">{m?.totalAbsents}</p>
                    </div>
                    <div className="p-2 bg-slate-50 rounded-lg dark:bg-slate-800">
                      <p className="text-slate-400 text-[10px]">ছুটি</p>
                      <p className="font-bold text-slate-700 dark:text-slate-300">{m?.totalLeaves}</p>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-2">
                    সেরা উপস্থিত জামাত: <span className="font-semibold text-slate-700 dark:text-slate-300">{m?.topAttendanceClass}</span>
                  </p>
                </div>

                {/* Hifz & Academic Progress */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white dark:bg-slate-800/60 dark:border-slate-700 sepia-mode:bg-[#FDFBF7] sepia-mode:border-[#E8DFD1]">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4 text-amber-600" />
                      <span>হিফজুল কুরআন ও কিতাব অগ্রগতি</span>
                    </h3>
                    <span className="text-xs font-bold text-amber-700 px-2 py-0.5 bg-amber-50 rounded-md">
                      {m?.hifzStudentsCount} জন হিফজ ছাত্র
                    </span>
                  </div>

                  <div className="space-y-2 mt-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600 dark:text-slate-400">খতম সম্পন্নকারী / হাফেজ:</span>
                      <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-sm">
                        {m?.hifzKhatamCount} জন
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600 dark:text-slate-400">মোট মুখস্থকৃত পারা:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {m?.hifzParasCompletedTotal} পারা
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600 dark:text-slate-400">কিতাব সিলেবাস সন্তোষজনক অগ্রগতি:</span>
                      <span className="font-bold text-indigo-700">{m?.syllabusCompletionRate}%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Funds Ledger Breakdown Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden dark:border-slate-700 sepia-mode:border-[#E8DFD1]">
                <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 dark:bg-slate-800 dark:border-slate-700 sepia-mode:bg-[#EFE6D8]">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    শরিয়াহ তহবিল ও ফান্ডভিত্তিক মাসিক স্থিতি
                  </h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-500 dark:border-slate-700 dark:bg-slate-800/40">
                        <th className="p-2.5 font-semibold">ফান্ডের নাম</th>
                        <th className="p-2.5 font-semibold text-right">আদায় (জমা)</th>
                        <th className="p-2.5 font-semibold text-right">ব্যয় (খরচ)</th>
                        <th className="p-2.5 font-semibold text-right">বর্তমান উদ্বৃত্ত</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {data.fundsBreakdown.map((f, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="p-2.5 font-medium text-slate-800 dark:text-slate-200">{f.fundName}</td>
                          <td className="p-2.5 text-right font-semibold text-emerald-600">
                            ৳ {f.income.toLocaleString("en-IN")}
                          </td>
                          <td className="p-2.5 text-right font-semibold text-rose-600">
                            ৳ {f.expense.toLocaleString("en-IN")}
                          </td>
                          <td
                            className={`p-2.5 text-right font-bold ${
                              f.balance >= 0 ? "text-slate-800 dark:text-slate-100" : "text-amber-600"
                            }`}
                          >
                            ৳ {f.balance.toLocaleString("en-IN")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Official Signatures for Printed Reports */}
              <div className="pt-10 flex items-center justify-between text-center text-xs text-slate-600 dark:text-slate-400">
                <div className="w-48">
                  <div className="border-t border-slate-400 pt-1 font-semibold">হিসাবরক্ষক / ক্যাশিয়ার</div>
                  <p className="text-[10px] text-slate-400">স্বাক্ষর ও তারিখ</p>
                </div>
                <div className="w-48">
                  <div className="border-t border-slate-400 pt-1 font-semibold">মুহতামিম / সভাপতি</div>
                  <p className="text-[10px] text-slate-400">স্বাক্ষর ও মাদরাসার সিল</p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
