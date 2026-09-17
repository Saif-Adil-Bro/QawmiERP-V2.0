"use client";

import React, { useState, useRef, useEffect } from "react";
import { useTheme, QawmiTheme } from "./ThemeContext";
import { Sun, Moon, BookOpen, ChevronDown, Check } from "lucide-react";

const themes: { id: QawmiTheme; label: string; sub: string; icon: any; previewBg: string; border: string }[] = [
  {
    id: "light",
    label: "কওমি স্ট্যান্ডার্ড",
    sub: "দিনের কাজ ও প্রিন্ট উপযোগী",
    icon: Sun,
    previewBg: "bg-emerald-600 text-white",
    border: "border-slate-200",
  },
  {
    id: "dark",
    label: "ইসলামিক নাইট মোড",
    sub: "গভীর রাতের কাজ ও তাহাজ্জুদ",
    icon: Moon,
    previewBg: "bg-slate-900 text-emerald-400",
    border: "border-slate-700",
  },
  {
    id: "sepia",
    label: "কিতাব ও মুতালা'আ",
    sub: "চোখের আরামদায়ক প্রাচীন পাতা",
    icon: BookOpen,
    previewBg: "bg-[#78350F] text-[#FEF3C7]",
    border: "border-amber-300",
  },
];

export function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentTheme = themes.find((t) => t.id === theme) || themes[0];
  const CurrentIcon = currentTheme.icon;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 rounded-xl transition-all duration-200 border ${
          compact
            ? "p-2 bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"
            : "px-3 py-1.5 bg-slate-50/80 hover:bg-slate-100/90 border-slate-200/80 text-slate-700 text-xs font-semibold shadow-xs"
        } ${
          theme === "dark"
            ? "bg-slate-800! hover:bg-slate-700! border-slate-700! text-slate-200!"
            : theme === "sepia"
            ? "bg-[#F5EFE6]! hover:bg-[#EFE6D8]! border-[#E3D8C8]! text-[#5A3825]!"
            : ""
        }`}
        title="থিম পরিবর্তন করুন (Theme)"
        aria-expanded={isOpen}
      >
        <CurrentIcon className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400 sepia-mode:text-amber-700" />
        {!compact && (
          <span className="hidden sm:inline-block max-w-[110px] truncate">
            {currentTheme.label}
          </span>
        )}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 opacity-60 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-64 origin-top-right rounded-2xl bg-white p-2 shadow-xl ring-1 ring-black/5 focus:outline-hidden z-50 animate-in fade-in zoom-in-95 duration-150 border border-slate-100 dark:bg-slate-900 dark:border-slate-800 sepia-mode:bg-[#FDFBF7] sepia-mode:border-[#E8DFD1]"
          role="menu"
        >
          <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 sepia-mode:border-[#E8DFD1] mb-1">
            <p className="text-xs font-bold text-slate-700 dark:text-slate-200 sepia-mode:text-[#451A03]">
              কওমি ইসলামিক থিম সুইচ
            </p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 sepia-mode:text-[#8C6D53]">
              আপনার সুবিধাজনক কাজের পরিবেশ বেছে নিন
            </p>
          </div>

          <div className="space-y-1">
            {themes.map((t) => {
              const Icon = t.icon;
              const isSelected = theme === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setTheme(t.id);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all ${
                    isSelected
                      ? "bg-emerald-50 text-emerald-900 font-semibold dark:bg-emerald-950/40 dark:text-emerald-200 sepia-mode:bg-[#EFE6D8] sepia-mode:text-[#451A03]"
                      : "hover:bg-slate-50 text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800/60 sepia-mode:text-[#5A3825] sepia-mode:hover:bg-[#F5EFE6]"
                  }`}
                  role="menuitem"
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`p-1.5 rounded-lg ${t.previewBg}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold leading-tight">{t.label}</div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 sepia-mode:text-[#8C6D53] leading-tight mt-0.5">
                        {t.sub}
                      </div>
                    </div>
                  </div>
                  {isSelected && (
                    <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 sepia-mode:text-amber-800 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
