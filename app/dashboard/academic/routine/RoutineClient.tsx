"use client";

import { useState } from "react";
import {
  CalendarDays,
  Clock,
  MapPin,
  User,
  BookOpen,
  Palette,
  LayoutTemplate,
  Type,
  Coffee,
  Sparkles,
  Sun,
  Edit,
} from "lucide-react";
import PrintButton from "@/app/components/PrintButton";
import Link from "next/link";
import {
  DAY_KEYS,
  DAY_TRANSLATIONS,
  parseRoutineItem,
  formatTimeString,
  ParsedRoutineItem,
} from "@/lib/routine-helper";

export default function RoutineClient({
  routines,
  routineType,
  className,
  madrasaInfo,
}: {
  routines: any[];
  routineType: string;
  className?: string;
  madrasaInfo?: { name: string; address: string; phone: string };
}) {
  const [template, setTemplate] = useState("grid");
  const [themeColor, setThemeColor] = useState("indigo");
  const [banglaFont, setBanglaFont] = useState("font-solaiman");

  const parsedRoutines = routines.map(parseRoutineItem);

  // Group by day_of_week
  const groupedRoutines = DAY_KEYS.reduce((acc, day) => {
    acc[day] = parsedRoutines.filter((r) => r.day_of_week === day);
    return acc;
  }, {} as Record<string, ParsedRoutineItem[]>);

  const colors: Record<
    string,
    { bg: string; text: string; border: string; light: string; accent: string }
  > = {
    indigo: {
      bg: "bg-indigo-600",
      text: "text-indigo-700",
      border: "border-indigo-600",
      light: "bg-indigo-50/70",
      accent: "border-indigo-200",
    },
    emerald: {
      bg: "bg-emerald-600",
      text: "text-emerald-700",
      border: "border-emerald-600",
      light: "bg-emerald-50/70",
      accent: "border-emerald-200",
    },
    rose: {
      bg: "bg-rose-600",
      text: "text-rose-700",
      border: "border-rose-600",
      light: "bg-rose-50/70",
      accent: "border-rose-200",
    },
    slate: {
      bg: "bg-slate-800",
      text: "text-slate-800",
      border: "border-slate-800",
      light: "bg-slate-100",
      accent: "border-slate-300",
    },
    blue: {
      bg: "bg-blue-600",
      text: "text-blue-700",
      border: "border-blue-600",
      light: "bg-blue-50/70",
      accent: "border-blue-200",
    },
  };

  const currentTheme = colors[themeColor] || colors.indigo;

  const routineTypeBangla =
    routineType === "Daily"
      ? "দৈনিক ও আবাসিক রুটিন"
      : routineType === "Exam"
      ? "পরীক্ষার রুটিন"
      : "ক্লাস রুটিন";

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-6 print:border-none print:shadow-none print:p-0">
      {/* Top Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 border-b border-slate-100 pb-5 print:hidden gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">
            {madrasaInfo?.name || "আল জামিয়া আল ইসলামিয়া"}
          </h1>
          <p className="text-xs text-slate-500">{madrasaInfo?.address || ""}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded-lg border">
              {routineTypeBangla}
            </span>
            {className && (
              <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-lg border border-indigo-100">
                জামাত: {className}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 bg-slate-50 p-2 rounded-2xl border border-slate-200">
          <div className="flex items-center gap-1.5">
            <LayoutTemplate className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              className="text-xs font-bold bg-white border border-slate-200 rounded-xl px-2 py-1.5 outline-none"
            >
              <option value="grid">গ্রিড ডিজাইন</option>
              <option value="table">টেবিল ডিজাইন</option>
              <option value="compact">কম্প্যাক্ট ডিজাইন</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={themeColor}
              onChange={(e) => setThemeColor(e.target.value)}
              className="text-xs font-bold bg-white border border-slate-200 rounded-xl px-2 py-1.5 outline-none"
            >
              <option value="indigo">ইন্ডিগো (Indigo)</option>
              <option value="emerald">সবুজ (Emerald)</option>
              <option value="blue">নীল (Blue)</option>
              <option value="rose">লাল (Rose)</option>
              <option value="slate">কালো (Dark)</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <Type className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={banglaFont}
              onChange={(e) => setBanglaFont(e.target.value)}
              className="text-xs font-bold bg-white border border-slate-200 rounded-xl px-2 py-1.5 outline-none"
            >
              <option value="font-solaiman">সোলাইমান লিপি</option>
              <option value="font-shorif">শরীফ শিশির</option>
              <option value="font-hindsiliguri">হিন্দ শিলিগুড়ি</option>
            </select>
          </div>

          <PrintButton targetId="printable-routine-content" fileName="routine.pdf" />
        </div>
      </div>

      {/* Printable Body */}
      <div id="printable-routine-content" className={`print:m-0 print:p-0 ${banglaFont}`}>
        {/* Printable Header */}
        <div className="hidden print:block mb-6 border-b-2 border-slate-800 pb-4 text-center">
          <h1 className={`text-2xl font-black ${currentTheme.text} tracking-wide`}>
            {madrasaInfo?.name || "আল জামিয়া আল ইসলামিয়া"}
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">{madrasaInfo?.address || ""}</p>
          <div className="mt-2 inline-flex items-center gap-3 px-4 py-1 border border-slate-300 rounded-full text-xs font-bold bg-slate-50">
            <span>{routineTypeBangla}</span>
            {className && <span>| জামাত: {className}</span>}
          </div>
        </div>

        {routines.length > 0 ? (
          <div className="space-y-6">
            {/* 1. GRID TEMPLATE */}
            {template === "grid" &&
              DAY_KEYS.map((day) => {
                const dayItems = groupedRoutines[day] || [];
                if (dayItems.length === 0) return null;

                const isOffDay = dayItems.some((r) => r.item_type === "OFFDAY");

                return (
                  <div key={day} className="mb-6">
                    <div
                      className={`flex items-center justify-between mb-3 ${currentTheme.light} p-2.5 rounded-2xl border-l-4 ${currentTheme.border}`}
                    >
                      <h3 className={`text-base font-black ${currentTheme.text}`}>
                        {DAY_TRANSLATIONS[day]}
                      </h3>
                      {isOffDay && (
                        <span className="text-[11px] font-bold px-2 py-0.5 bg-rose-100 text-rose-800 rounded-lg">
                          ছুটির দিন (Off Day)
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                      {dayItems.map((routine) => {
                        const start = formatTimeString(routine.start_time);
                        const end = formatTimeString(routine.end_time);

                        if (routine.item_type === "OFFDAY") {
                          return (
                            <div
                              key={routine.id}
                              className="border border-rose-200 rounded-2xl p-4 shadow-2xs bg-rose-50/70 flex items-center gap-3 col-span-full"
                            >
                              <div className="p-2 bg-rose-100 text-rose-700 rounded-xl">
                                <Sun className="w-5 h-5" />
                              </div>
                              <div>
                                <div className="font-bold text-sm text-rose-950">
                                  {routine.display_title || "সাপ্তাহিক ছুটি"}
                                </div>
                                <div className="text-xs text-rose-700">
                                  এই দিনে কোনো নির্ধারিত ক্লাস নেই।
                                </div>
                              </div>
                            </div>
                          );
                        }

                        if (routine.item_type === "BREAK") {
                          return (
                            <div
                              key={routine.id}
                              className="border border-amber-200 rounded-2xl p-3.5 shadow-2xs bg-amber-50/60"
                            >
                              <div className="flex items-center justify-between font-mono font-bold text-xs text-amber-900 mb-2">
                                <span className="bg-amber-100 px-2 py-0.5 rounded-lg">
                                  {start} - {end}
                                </span>
                                <span className="text-[10px] bg-amber-200/80 px-1.5 py-0.2 rounded font-sans font-bold">
                                  বিরতি
                                </span>
                              </div>
                              <div className="flex items-start gap-2 text-sm">
                                <Coffee className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                <div>
                                  <div className="font-bold text-amber-950">
                                    {routine.display_title}
                                  </div>
                                  {routine.clean_room && (
                                    <div className="text-xs text-amber-800/80 flex items-center gap-1 mt-0.5">
                                      <MapPin className="w-3 h-3" />
                                      <span>{routine.clean_room}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        }

                        if (routine.item_type === "CUSTOM") {
                          return (
                            <div
                              key={routine.id}
                              className="border border-purple-200 rounded-2xl p-3.5 shadow-2xs bg-purple-50/60"
                            >
                              <div className="flex items-center justify-between font-mono font-bold text-xs text-purple-900 mb-2">
                                <span className="bg-purple-100 px-2 py-0.5 rounded-lg">
                                  {start} - {end}
                                </span>
                                <span className="text-[10px] bg-purple-200/80 px-1.5 py-0.2 rounded font-sans font-bold">
                                  কার্যক্রম
                                </span>
                              </div>
                              <div className="flex items-start gap-2 text-sm">
                                <Sparkles className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                                <div>
                                  <div className="font-bold text-purple-950">
                                    {routine.display_title}
                                  </div>
                                  {routine.clean_room && (
                                    <div className="text-xs text-purple-800/80 flex items-center gap-1 mt-0.5">
                                      <MapPin className="w-3 h-3" />
                                      <span>{routine.clean_room}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        }

                        // Default Subject
                        return (
                          <div
                            key={routine.id}
                            className={`border ${currentTheme.accent} rounded-2xl p-3.5 shadow-2xs bg-white hover:border-indigo-300 transition`}
                          >
                            <div
                              className={`flex items-center space-x-2 ${currentTheme.text} font-mono font-bold text-xs mb-2`}
                            >
                              <Clock className="w-3.5 h-3.5" />
                              <span>
                                {start} - {end}
                              </span>
                            </div>

                            <div className="space-y-1.5 text-xs">
                              <div className="flex items-start space-x-1.5">
                                <BookOpen className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                                <span className="font-bold text-slate-900 text-sm">
                                  {routine.display_title}
                                </span>
                              </div>

                              <div className="flex items-start space-x-1.5">
                                <User className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                                <span className="text-slate-600 font-medium">
                                  {routine.display_subtitle || "উস্তাদ নির্ধারিত নয়"}
                                </span>
                              </div>

                              {routine.clean_room && (
                                <div className="flex items-start space-x-1.5">
                                  <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                                  <span className="text-slate-500">রুম: {routine.clean_room}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

            {/* 2. TABLE TEMPLATE */}
            {template === "table" && (
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className={`${currentTheme.bg} text-white text-xs`}>
                      <th className="p-3 border font-bold">দিন (Day)</th>
                      <th className="p-3 border font-bold">সময় (Time)</th>
                      <th className="p-3 border font-bold">বিষয় / কার্যক্রম</th>
                      <th className="p-3 border font-bold">উস্তাদ / তত্ত্বাবধায়ক</th>
                      <th className="p-3 border font-bold">রুম / স্থান</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs">
                    {DAY_KEYS.map((day) => {
                      const dayItems = groupedRoutines[day] || [];
                      if (dayItems.length === 0) return null;

                      return dayItems.map((routine, idx) => {
                        const start = formatTimeString(routine.start_time);
                        const end = formatTimeString(routine.end_time);

                        const isBreak = routine.item_type === "BREAK";
                        const isCustom = routine.item_type === "CUSTOM";
                        const isOff = routine.item_type === "OFFDAY";

                        return (
                          <tr
                            key={routine.id}
                            className={`border-b border-slate-200 ${
                              isBreak
                                ? "bg-amber-50/50"
                                : isCustom
                                ? "bg-purple-50/50"
                                : isOff
                                ? "bg-rose-50/60"
                                : "hover:bg-slate-50"
                            }`}
                          >
                            {idx === 0 && (
                              <td
                                rowSpan={dayItems.length}
                                className={`p-3 border font-bold ${currentTheme.text} ${currentTheme.light} align-top`}
                              >
                                {DAY_TRANSLATIONS[day]}
                              </td>
                            )}

                            {isOff ? (
                              <td colSpan={4} className="p-3 border font-bold text-rose-800">
                                🏖️ {routine.display_title || "সাপ্তাহিক ছুটি"} (কোনো ক্লাস নেই)
                              </td>
                            ) : (
                              <>
                                <td className="p-3 border font-mono font-bold text-slate-800">
                                  {start} - {end}
                                </td>
                                <td className="p-3 border font-bold text-slate-900">
                                  <div className="flex items-center gap-1.5">
                                    {isBreak && (
                                      <span className="px-1.5 py-0.5 bg-amber-200 text-amber-900 rounded text-[10px]">
                                        বিরতি
                                      </span>
                                    )}
                                    {isCustom && (
                                      <span className="px-1.5 py-0.5 bg-purple-200 text-purple-900 rounded text-[10px]">
                                        কার্যক্রম
                                      </span>
                                    )}
                                    <span>{routine.display_title}</span>
                                  </div>
                                </td>
                                <td className="p-3 border text-slate-600">
                                  {routine.display_subtitle || "-"}
                                </td>
                                <td className="p-3 border text-slate-600">
                                  {routine.clean_room || "-"}
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      });
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* 3. COMPACT TEMPLATE */}
            {template === "compact" &&
              DAY_KEYS.map((day) => {
                const dayItems = groupedRoutines[day] || [];
                if (dayItems.length === 0) return null;

                return (
                  <div key={day} className="mb-4">
                    <div
                      className={`flex items-center space-x-3 mb-2 border-b ${currentTheme.accent} pb-1`}
                    >
                      <h3 className={`text-sm font-black ${currentTheme.text} w-24 shrink-0`}>
                        {DAY_TRANSLATIONS[day]}
                      </h3>
                    </div>
                    <div className="flex flex-wrap gap-2.5">
                      {dayItems.map((routine) => {
                        const start = formatTimeString(routine.start_time);
                        const end = formatTimeString(routine.end_time);

                        return (
                          <div
                            key={routine.id}
                            className={`border rounded-xl p-2.5 bg-white flex flex-col justify-center min-w-[140px] text-xs ${
                              routine.item_type === "BREAK"
                                ? "border-amber-200 bg-amber-50/40"
                                : routine.item_type === "CUSTOM"
                                ? "border-purple-200 bg-purple-50/40"
                                : routine.item_type === "OFFDAY"
                                ? "border-rose-200 bg-rose-50/50"
                                : `${currentTheme.accent}`
                            }`}
                          >
                            <div className="text-[10px] font-mono font-bold text-slate-500 mb-0.5">
                              {start} - {end}
                            </div>
                            <div className="font-bold text-slate-900 truncate">
                              {routine.display_title}
                            </div>
                            {routine.display_subtitle && (
                              <div className="text-[11px] text-slate-600 truncate mt-0.5">
                                {routine.display_subtitle}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
          </div>
        ) : (
          <div className="text-center py-16 space-y-3">
            <CalendarDays className="w-12 h-12 text-slate-300 mx-auto" />
            <p className="font-bold text-slate-700">এই জামাতের জন্য কোনো রুটিন তৈরি করা হয়নি</p>
            <Link
              href="/dashboard/academic/routine/builder"
              className="inline-block px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition"
            >
              রুটিন বিল্ডারে যান
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
