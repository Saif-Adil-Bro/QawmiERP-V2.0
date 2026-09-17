"use client";

import { useState, useRef, useEffect } from "react";
import { useSession } from "./SessionContext";
import Link from "next/link";
import {
  Calendar,
  ChevronDown,
  Check,
  Archive,
  Sparkles,
  ArrowRight,
  Settings,
  GraduationCap,
} from "lucide-react";

export default function SessionSelector() {
  const {
    sessions,
    selectedSession,
    currentSession,
    changeSelectedSession,
    isLoading,
  } = useSession();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (isLoading && !selectedSession) {
    return (
      <div className="flex items-center space-x-2 px-3 py-1.5 bg-slate-100 rounded-lg text-xs text-slate-500 animate-pulse">
        <Calendar className="w-3.5 h-3.5 text-slate-400" />
        <span>শিক্ষাবর্ষ লোড হচ্ছে...</span>
      </div>
    );
  }

  const isCurrentSelected = selectedSession?.id === currentSession?.id;
  const isArchivedSelected = selectedSession?.status === "ARCHIVED";

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Selector Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 sm:gap-2 p-2 sm:px-3 sm:py-1.5 rounded-xl border text-xs sm:text-sm font-medium transition-all duration-150 shadow-2xs shrink-0 ${
          isArchivedSelected
            ? "bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 sepia-mode:bg-[#EFE6D8] sepia-mode:text-[#451A03] sepia-mode:border-[#D5C9B3]"
            : isCurrentSelected
            ? "bg-emerald-50 text-emerald-950 border-emerald-200 hover:bg-emerald-100/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 sepia-mode:bg-[#EAE2D2] sepia-mode:text-[#2C1A0C] sepia-mode:border-[#D5C9B3]"
            : "bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 sepia-mode:bg-[#F5EFE6] sepia-mode:text-[#5A3825] sepia-mode:border-[#E8DFD1]"
        }`}
        title={`শিক্ষাবর্ষ: ${selectedSession?.name || "১৪৪৭-৪৮ হিজরি"} (পরিবর্তন করতে ট্যাপ করুন)`}
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <Calendar
            className={`w-4 h-4 sm:w-3.5 sm:h-3.5 shrink-0 ${
              isArchivedSelected
                ? "text-amber-600 dark:text-amber-400"
                : isCurrentSelected
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-slate-500 dark:text-slate-400"
            }`}
          />
          <span className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 hidden lg:inline">শিক্ষাবর্ষ:</span>
          <span className="font-semibold truncate hidden sm:inline max-w-[120px] md:max-w-[160px]">
            {selectedSession?.name || "১৪৪৭-৪৮ হিজরি"}
          </span>
        </div>

        {isArchivedSelected ? (
          <span className="hidden sm:inline-block px-1.5 py-0.2 bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-200 text-[10px] font-bold rounded-md shrink-0">
            আর্কাইভ
          </span>
        ) : isCurrentSelected ? (
          <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981] shrink-0" />
        ) : null}

        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-500 dark:text-slate-400 transition-transform duration-150 shrink-0 hidden sm:inline-block ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 sm:w-80 max-w-[calc(100vw-1.5rem)] bg-white dark:bg-slate-900 sepia-mode:bg-[#FDFBF7] rounded-2xl shadow-xl border border-slate-200/90 dark:border-slate-800 sepia-mode:border-[#E8DFD1] py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
          <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 sepia-mode:border-[#E8DFD1] flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-100 sepia-mode:text-[#2C1A0C]">শিক্ষাবর্ষ নির্বাচন করুন</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 sepia-mode:text-[#8C6D53]">ডাটা দেখার জন্য সেশন পরিবর্তন করুন</p>
            </div>
            <Link
              href="/dashboard/academic/sessions"
              onClick={() => setIsOpen(false)}
              className="text-xs text-emerald-700 dark:text-emerald-400 sepia-mode:text-amber-800 hover:text-emerald-800 font-semibold flex items-center gap-1 hover:underline"
            >
              <Settings className="w-3 h-3" />
              <span>পরিচালনা</span>
            </Link>
          </div>

          {/* Session List */}
          <div className="max-h-64 overflow-y-auto p-1.5 space-y-1">
            {sessions.map((sess) => {
              const isSelected = selectedSession?.id === sess.id;
              const isCurrent = sess.is_current;
              const isArch = sess.status === "ARCHIVED";

              return (
                <button
                  key={sess.id}
                  type="button"
                  onClick={() => {
                    changeSelectedSession(sess.id);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-xs sm:text-sm flex items-center justify-between transition-colors ${
                    isSelected
                      ? isArch
                        ? "bg-amber-100/70 text-amber-950 font-semibold dark:bg-amber-950/60 dark:text-amber-200 sepia-mode:bg-[#EFE6D8] sepia-mode:text-[#451A03]"
                        : "bg-emerald-50 text-emerald-950 font-semibold dark:bg-emerald-950/60 dark:text-emerald-200 sepia-mode:bg-[#EAE2D2] sepia-mode:text-[#2C1A0C]"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 sepia-mode:text-[#5A3825] sepia-mode:hover:bg-[#F5EFE6]"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        isCurrent
                          ? "bg-emerald-600 text-white"
                          : isArch
                          ? "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                      }`}
                    >
                      {isArch ? (
                        <Archive className="w-3.5 h-3.5" />
                      ) : (
                        <Calendar className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div className="truncate">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-900 dark:text-slate-100 sepia-mode:text-[#2C1A0C] truncate">{sess.name}</span>
                        {isCurrent && (
                          <span className="px-1.5 py-0.2 bg-emerald-600 text-white text-[9px] font-bold rounded-sm uppercase tracking-wide">
                            বর্তমান
                          </span>
                        )}
                        {isArch && (
                          <span className="px-1.5 py-0.2 bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-[9px] font-semibold rounded-sm">
                            সংরক্ষিত
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 sepia-mode:text-[#8C6D53] mt-0.5">
                        {sess.academic_year} ইংরেজি • {sess.hijri_year}
                      </p>
                    </div>
                  </div>

                  {isSelected && (
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                        isArch ? "bg-amber-600 text-white" : "bg-emerald-600 text-white"
                      }`}
                    >
                      <Check className="w-3 h-3" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick Links Footer */}
          <div className="pt-2 mt-1 border-t border-slate-100 dark:border-slate-800 sepia-mode:border-[#E8DFD1] px-3 space-y-1">
            <Link
              href="/dashboard/students/promotion"
              onClick={() => setIsOpen(false)}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-slate-700 dark:text-slate-300 sepia-mode:text-[#5A3825] hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-400 font-medium">
                <GraduationCap className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>শিক্ষার্থী প্রমোশন (শ্রেণি উন্নয়ন)</span>
              </div>
              <ArrowRight className="w-3 h-3 text-slate-400" />
            </Link>

            <Link
              href="/dashboard/academic/sessions"
              onClick={() => setIsOpen(false)}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-slate-700 dark:text-slate-300 sepia-mode:text-[#5A3825] hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                <Sparkles className="w-3.5 h-3.5 text-slate-400" />
                <span>সকল শিক্ষাবর্ষ ও আর্কাইভ তালিকা</span>
              </div>
              <ArrowRight className="w-3 h-3 text-slate-400" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
