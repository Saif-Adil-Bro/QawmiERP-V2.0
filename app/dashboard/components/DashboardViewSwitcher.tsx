"use client";

import React from "react";
import { useAppMode } from "@/components/mode/ModeContext";
import { LayoutGrid, Sparkles } from "lucide-react";

interface DashboardViewSwitcherProps {
  stats: {
    studentsCount: number;
    teachersCount: number;
    classesCount: number;
    todayPresent: number;
    todayAbsent: number;
    todayIncome?: number;
    todayExpense?: number;
    totalIncome: number;
    totalExpense: number;
    expensesSum: number;
    bazarSum: number;
  };
  children: React.ReactNode;
}

export default function DashboardViewSwitcher({
  stats,
  children,
}: DashboardViewSwitcherProps) {
  const { mode, openStartMenu } = useAppMode();

  return (
    <div className="space-y-6">
      {/* If in Basic Mode, show quick launcher strip on top */}
      {mode === "basic" && (
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-4 sm:p-5 rounded-2xl text-white border border-indigo-500/30 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in duration-200">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 flex items-center justify-center shrink-0 shadow-inner">
              <LayoutGrid className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm sm:text-base text-white">
                  সহজ মোড সক্রিয় আছে
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                  স্টার্ট স্ক্রিন
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                উইন্ডোজ স্টার্ট মেনুর মতো ফুল ফ্লোটিং স্ক্রিন দেখতে ক্লিক করুন
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={openStartMenu}
            className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition"
          >
            <LayoutGrid className="w-4 h-4" />
            <span>স্টার্ট মেনু খুলুন (Start)</span>
          </button>
        </div>
      )}

      {/* Main Dashboard Content */}
      {children}
    </div>
  );
}
