"use client";

import React from "react";
import { Zap, Rocket, LayoutGrid, X } from "lucide-react";
import { useAppMode } from "./ModeContext";

interface ModeToggleSwitchProps {
  compact?: boolean;
}

export function ModeToggleSwitch({ compact = false }: ModeToggleSwitchProps) {
  const { mode, setMode, isStartMenuOpen, toggleStartMenu } = useAppMode();
  const isBasic = mode === "basic";

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      {/* If in basic mode, prominent Start Menu floating screen trigger button */}
      {isBasic && (
        <button
          type="button"
          onClick={toggleStartMenu}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all duration-150 shadow-sm cursor-pointer border ${
            isStartMenuOpen
              ? "bg-rose-600 hover:bg-rose-700 text-white border-rose-500 shadow-rose-600/30 scale-102"
              : "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-amber-400 shadow-amber-500/25 active:scale-95"
          }`}
          title="উইন্ডোজ স্টার্ট মেনুর মতো ফুল ফ্লোটিং স্ক্রিন অন/অফ করুন"
        >
          {isStartMenuOpen ? (
            <>
              <X className="w-3.5 h-3.5" />
              <span>মেনু বন্ধ করুন</span>
            </>
          ) : (
            <>
              <LayoutGrid className="w-3.5 h-3.5 animate-pulse" />
              <span>স্টার্ট মেনু</span>
            </>
          )}
        </button>
      )}

      {/* Mode Selector Capsule */}
      <div
        role="group"
        aria-label="সিস্টেম মোড নির্বাচন"
        className="inline-flex items-center p-1 bg-slate-100 dark:bg-slate-800/90 rounded-2xl border border-slate-200/90 dark:border-slate-700/80 shadow-2xs sepia-mode:bg-[#F3ECE0] sepia-mode:border-[#DECDB7]"
      >
        <button
          type="button"
          onClick={() => setMode("basic")}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
            isBasic
              ? "bg-amber-500 text-white shadow-sm shadow-amber-500/30 scale-[1.02]"
              : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
          }`}
          title="সহজ ও ঝামেলামুক্ত ইন্টারফেস"
        >
          <Zap className={`w-3.5 h-3.5 ${isBasic ? "fill-white" : "text-amber-500"}`} />
          <span>বেসিক মোড</span>
        </button>

        <button
          type="button"
          onClick={() => setMode("advanced")}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
            !isBasic
              ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/30 scale-[1.02]"
              : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
          }`}
          title="পূর্ণাঙ্গ ইআরপি ও অ্যাডভান্সড ফিচার"
        >
          <Rocket className={`w-3.5 h-3.5 ${!isBasic ? "fill-white" : "text-emerald-500"}`} />
          <span>অ্যাডভান্সড</span>
        </button>
      </div>
    </div>
  );
}
