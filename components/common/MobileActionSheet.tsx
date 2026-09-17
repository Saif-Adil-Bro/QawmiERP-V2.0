"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
  X,
  UserPlus,
  Receipt,
  CheckSquare,
  BookOpen,
  Wallet,
  HeartHandshake,
  Scale,
  Database,
  Search,
  Moon,
  Sun,
  Palette,
  ChevronRight,
} from "lucide-react";
import { useTheme } from "./ThemeContext";

interface MobileActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSearch: () => void;
  onOpenExecutiveSummary: () => void;
}

export function MobileActionSheet({
  isOpen,
  onClose,
  onOpenSearch,
  onOpenExecutiveSummary,
}: MobileActionSheetProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  if (!isOpen) return null;

  const navigateTo = (path: string) => {
    onClose();
    router.push(path);
  };

  const actionButtons = [
    {
      title: "নতুন ছাত্র ভর্তি",
      sub: "ভর্তি ফরম পূরণ",
      icon: UserPlus,
      bg: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
      action: () => navigateTo("/dashboard/admissions"),
    },
    {
      title: "ফি আদায় / রসিদ",
      sub: "বেতন ও খোরাকি",
      icon: Receipt,
      bg: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
      action: () => navigateTo("/dashboard/accounting"),
    },
    {
      title: "দৈনিক হাজিরা",
      sub: "উপস্থিতি গ্রহণ",
      icon: CheckSquare,
      bg: "bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300",
      action: () => navigateTo("/dashboard/attendance"),
    },
    {
      title: "হিফজ সবক",
      sub: "পারা ও সবক এন্ট্রি",
      icon: BookOpen,
      bg: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
      action: () => navigateTo("/dashboard/hifz"),
    },
    {
      title: "ব্যয় ভাউচার",
      sub: "বাজার ও খরচ এন্ট্রি",
      icon: Wallet,
      bg: "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
      action: () => navigateTo("/dashboard/accounting/expenses"),
    },
    {
      title: "যাকাত ও অনুদান",
      sub: "কালেকশন রসিদ",
      icon: HeartHandshake,
      bg: "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300",
      action: () => navigateTo("/dashboard/zakat/collection"),
    },
    {
      title: "নির্বাহী সামারি",
      sub: "মুহতামিম ড্যাশবোর্ড",
      icon: Scale,
      bg: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300",
      action: () => {
        onClose();
        onOpenExecutiveSummary();
      },
    },
    {
      title: "১-ক্লিক ব্যাকআপ",
      sub: "ডাটা ডাউনলোড",
      icon: Database,
      bg: "bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300",
      action: () => navigateTo("/dashboard/settings/backup"),
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden max-h-[85vh] flex flex-col animate-in slide-in-from-bottom-8 duration-200 dark:bg-slate-900 dark:border-slate-800 sepia-mode:bg-[#FCF8F2] sepia-mode:border-[#E8DFD1]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle & Header */}
        <div className="pt-3 px-5 pb-3 border-b border-slate-100 dark:border-slate-800 sepia-mode:border-[#E8DFD1] text-center relative">
          <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-3 dark:bg-slate-700 sepia-mode:bg-[#E0D5C3]" />
          <div className="flex items-center justify-between">
            <div className="text-left">
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 sepia-mode:text-[#2C1A0C]">
                কওমি কুইক অ্যাকশন সেন্টার
              </h3>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                এক ক্লিকে মাদরাসার গুরুত্বপূর্ণ কাজ সম্পন্ন করুন
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action Grid */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {/* Universal Search Bar Trigger */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenSearch();
            }}
            className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 text-slate-600 text-xs sm:text-sm font-semibold transition dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 sepia-mode:bg-[#F5EFE6] sepia-mode:border-[#E8DFD1]"
          >
            <div className="flex items-center gap-2.5">
              <Search className="w-4 h-4 text-emerald-600" />
              <span>সার্বজনীন সার্চ ও কমান্ড বার (Ctrl + K)</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>

          {/* Quick Grid (8 Action Items) */}
          <div className="grid grid-cols-2 gap-2.5">
            {actionButtons.map((btn, idx) => {
              const Icon = btn.icon;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={btn.action}
                  className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-emerald-300 bg-white hover:bg-emerald-50/40 transition text-left shadow-2xs dark:bg-slate-800/80 dark:border-slate-700/80 dark:hover:bg-slate-800 sepia-mode:bg-[#FDFBF7] sepia-mode:border-[#E8DFD1]"
                >
                  <div className={`p-2.5 rounded-xl shrink-0 ${btn.bg}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-bold text-slate-800 truncate dark:text-slate-200 sepia-mode:text-[#2C1A0C]">
                      {btn.title}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5 dark:text-slate-500 sepia-mode:text-[#7C6248]">
                      {btn.sub}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Theme Switcher Fast Row */}
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 dark:bg-slate-800/60 dark:border-slate-700 sepia-mode:bg-[#F5EFE6] sepia-mode:border-[#E8DFD1]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-emerald-600" />
                <span>ইসলামিক থিম মোড</span>
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setTheme("light")}
                className={`py-2 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border ${
                  theme === "light"
                    ? "bg-white text-emerald-700 border-emerald-400 shadow-xs"
                    : "bg-slate-100 text-slate-600 border-transparent dark:bg-slate-700 dark:text-slate-300"
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                <span>কওমি ডে</span>
              </button>
              <button
                type="button"
                onClick={() => setTheme("dark")}
                className={`py-2 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border ${
                  theme === "dark"
                    ? "bg-slate-900 text-emerald-400 border-emerald-500 shadow-xs"
                    : "bg-slate-100 text-slate-600 border-transparent dark:bg-slate-700 dark:text-slate-300"
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
                <span>নাইট মোড</span>
              </button>
              <button
                type="button"
                onClick={() => setTheme("sepia")}
                className={`py-2 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border ${
                  theme === "sepia"
                    ? "bg-[#78350F] text-[#FEF3C7] border-amber-500 shadow-xs"
                    : "bg-slate-100 text-slate-600 border-transparent dark:bg-slate-700 dark:text-slate-300"
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>কিতাব মোড</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
