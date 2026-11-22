"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Clock,
  User,
  MapPin,
  Sparkles,
  Coffee,
  Sun,
  Radio,
} from "lucide-react";
import { toBanglaNumber } from "@/lib/numberToBangla";
import {
  DAY_TRANSLATIONS,
  formatBanglaTime,
  getDhakaClockParts,
  getRoutineLiveStatus,
  type HolidayRangeLike,
} from "@/lib/routine-helper";
import { useOfflinePortalSnapshot } from "@/hooks/useOfflinePortalData";
import CurrentClassLiveBanner from "@/components/routine/CurrentClassLiveBanner";

const DAYS_OF_WEEK = [
  { full: "শনিবার", short: "শনি" },
  { full: "রবিবার", short: "রবি" },
  { full: "সোমবার", short: "সোম" },
  { full: "মঙ্গলবার", short: "মঙ্গল" },
  { full: "বুধবার", short: "বুধ" },
  { full: "বৃহস্পতিবার", short: "বৃহঃ" },
  { full: "শুক্রবার", short: "শুক্র" },
] as const;

interface PortalRoutineClientProps {
  students: any[];
  child: any;
  className: string;
  routines: any[];
  holidays: HolidayRangeLike[];
}

export default function PortalRoutineClient({
  students,
  child,
  className,
  routines,
  holidays,
}: PortalRoutineClientProps) {
  const offlineSnapshot = useOfflinePortalSnapshot();

  // Hydration-safe live clock & default selected day initialized inside useEffect
  const [now, setNow] = useState<Date | null>(null);
  const [selectedDay, setSelectedDay] = useState<string>("শনিবার");

  useEffect(() => {
    const initial = new Date();
    setNow(initial);
    const dhaka = getDhakaClockParts(initial);
    setSelectedDay(dhaka.banglaDay);

    const timer = setInterval(() => {
      setNow(new Date());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const effectiveRoutines=offlineSnapshot?.routines ?? routines;
  const effectiveHolidays:HolidayRangeLike[]=offlineSnapshot?.academicCalendar ?? holidays;
  const liveStatus = useMemo(
    () => (now ? getRoutineLiveStatus(effectiveRoutines, now, effectiveHolidays) : null),
    [effectiveRoutines, now, effectiveHolidays]
  );

  const renderRoutineItem = (r: any, idx: number) => {
    const start = formatBanglaTime(r.start_time);
    const end = formatBanglaTime(r.end_time);
    const isCurrent = Boolean(liveStatus?.isCurrent(r));
    const isNext = Boolean(liveStatus?.isNext(r));

    if (r.item_type === "OFFDAY") {
      return (
        <div
          key={r.id || idx}
          className="p-3.5 bg-rose-50 rounded-xl border border-rose-200 text-rose-900 flex items-center gap-2.5 text-xs"
        >
          <Sun className="w-4 h-4 text-rose-600 shrink-0" />
          <span className="font-bold">{r.display_title || "সাপ্তাহিক ছুটি"}</span>
        </div>
      );
    }

    if (r.item_type === "BREAK") {
      return (
        <div
          key={r.id || idx}
          className={`p-3.5 rounded-xl border space-y-1 text-xs ${
            isCurrent
              ? "bg-rose-50 border-rose-400 ring-2 ring-rose-300/40 text-rose-950"
              : "bg-amber-50/80 border-amber-200 text-amber-950"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-1.5 font-bold">
            <span className="flex items-center gap-1.5">
              <Coffee className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>{r.display_title}</span>
            </span>
            <span className="text-[11px] text-amber-900 bg-amber-100 px-2 py-0.5 rounded-md">
              {start} – {end}
            </span>
          </div>
          {r.clean_room && (
            <div className="text-[11px] text-amber-800 flex items-center gap-1">
              <MapPin className="w-3 h-3 text-amber-600 shrink-0" />
              <span>স্থান: {r.clean_room}</span>
            </div>
          )}
        </div>
      );
    }

    if (r.item_type === "CUSTOM") {
      return (
        <div
          key={r.id || idx}
          className={`p-3.5 rounded-xl border space-y-1 text-xs ${
            isCurrent
              ? "bg-rose-50 border-rose-400 ring-2 ring-rose-300/40 text-rose-950"
              : "bg-purple-50/80 border-purple-200 text-purple-950"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-1.5 font-bold">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-600 shrink-0" />
              <span>{r.display_title}</span>
            </span>
            <span className="text-[11px] text-purple-900 bg-purple-100 px-2 py-0.5 rounded-md">
              {start} – {end}
            </span>
          </div>
          {r.clean_room && (
            <div className="text-[11px] text-purple-800 flex items-center gap-1">
              <MapPin className="w-3 h-3 text-purple-600 shrink-0" />
              <span>স্থান: {r.clean_room}</span>
            </div>
          )}
        </div>
      );
    }

    return (
      <div
        key={r.id || idx}
        className={`p-3.5 rounded-xl border transition space-y-1.5 ${
          isCurrent
            ? "bg-rose-50/90 border-2 border-rose-500 shadow-sm ring-2 ring-rose-400/25"
            : isNext
            ? "bg-amber-50/70 border-amber-300 shadow-2xs"
            : "bg-slate-50 border-slate-100 hover:border-amber-300"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={`font-bold break-words ${
                isCurrent ? "text-rose-950" : "text-slate-800"
              }`}
            >
              {r.display_title}
            </span>
            {isCurrent && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black shrink-0">
                <Radio className="w-2.5 h-2.5" />
                চলমান ক্লাস
              </span>
            )}
            {!isCurrent && isNext && (
              <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-950 text-[10px] font-bold shrink-0">
                পরবর্তী ক্লাস
              </span>
            )}
          </div>

          <span className="text-[11px] text-slate-600 font-semibold flex items-center gap-1 shrink-0">
            <Clock className="w-3 h-3 text-slate-400 shrink-0" />
            <span>
              {start} – {end}
            </span>
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 pt-0.5">
          {r.display_subtitle ? (
            <span className="flex items-center gap-1">
              <User className="w-3 h-3 shrink-0" />
              <span>উস্তাদ: {r.display_subtitle}</span>
            </span>
          ) : (
            <span className="text-slate-400">উস্তাদ নির্ধারিত নয়</span>
          )}
          {r.clean_room && (
            <span className="flex items-center gap-1 text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200 text-[10px]">
              <MapPin className="w-2.5 h-2.5 text-amber-600 shrink-0" />
              <span>কক্ষ: {r.clean_room}</span>
            </span>
          )}
        </div>
      </div>
    );
  };

  const selectedDayRoutines = effectiveRoutines.filter((r: any) => {
    const normalized = DAY_TRANSLATIONS[r.day_of_week] || r.day_of_week;
    return normalized === selectedDay;
  });

  return (
    <div className="space-y-5 sm:space-y-6 w-full max-w-full overflow-x-hidden">
      {/* Header with Child Switcher */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          {child.photo_url ? (
            <img
              src={child.photo_url}
              alt=""
              className="w-12 h-12 rounded-xl object-cover border border-amber-200 shrink-0 shadow-2xs"
            />
          ) : (
            <div className="p-2.5 bg-amber-50 text-amber-700 rounded-xl shrink-0">
              <CalendarDays className="w-5 h-5" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-bold text-slate-900">
              ক্লাস ও সাপ্তাহিক পাঠ্যসূচি
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>
                শিক্ষার্থী:{" "}
                <strong className="text-slate-800">
                  {child.first_name} {child.last_name}
                </strong>
              </span>
              {(child.student_id || child.student_id_formatted) && (
                <span className="font-mono bg-amber-50 text-amber-800 px-2 py-0.5 rounded text-xs border border-amber-200 font-bold">
                  আইডি: {child.student_id || child.student_id_formatted}
                </span>
              )}
              <span>
                • জামাত: <strong className="text-slate-800">{className}</strong>
              </span>
            </p>
          </div>
        </div>

        {students.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            {students.map((s: any) => (
              <Link
                key={s.id}
                href={`/portal/routine?student_id=${s.id}`}
                className={`min-h-[44px] sm:min-h-0 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 shrink-0 ${
                  s.id === child.id
                    ? "bg-amber-600 text-white shadow-xs"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                }`}
              >
                <span>
                  {s.first_name} {s.last_name}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Live Class Banner */}
      <CurrentClassLiveBanner
        routines={effectiveRoutines}
        holidays={effectiveHolidays}
        isTeacherView={false}
      />

      {/* Mobile Day Slider View (< 768px) */}
      <div className="md:hidden space-y-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {DAYS_OF_WEEK.map((d) => {
            const isSelected = selectedDay === d.full;
            const isToday = Boolean(liveStatus?.isToday(d.full));
            return (
              <button
                key={d.full}
                type="button"
                onClick={() => setSelectedDay(d.full)}
                className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition shrink-0 flex items-center gap-1.5 border ${
                  isSelected
                    ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                    : isToday
                    ? "bg-amber-50 text-amber-900 border-amber-300"
                    : "bg-white text-slate-700 border-slate-200"
                }`}
              >
                <span>{d.short}</span>
                {isToday && (
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isSelected ? "bg-amber-400" : "bg-amber-600"
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm">{selectedDay}</span>
              {liveStatus?.isToday(selectedDay) && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-400 text-slate-950">
                  আজ
                </span>
              )}
            </div>
            <span className="text-[11px] text-amber-300 font-semibold">
              {selectedDayRoutines.some((r: any) => r.item_type === "OFFDAY")
                ? "সাপ্তাহিক ছুটি"
                : selectedDayRoutines.length > 0
                ? `${toBanglaNumber(selectedDayRoutines.length)}টি পিরিয়ড`
                : "কোনো ক্লাস নেই"}
            </span>
          </div>

          <div className="p-3.5 space-y-2.5">
            {selectedDayRoutines.length > 0 ? (
              selectedDayRoutines.map((r: any, idx: number) => renderRoutineItem(r, idx))
            ) : (
              <div className="py-8 text-center text-xs text-slate-400">
                এই বারে কোনো নির্ধারিত ক্লাস নেই।
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Desktop Weekly Grid (>= 768px) */}
      <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {DAYS_OF_WEEK.map(({ full: day }) => {
          const dayRoutines = effectiveRoutines.filter((r: any) => {
            const normalizedDay = DAY_TRANSLATIONS[r.day_of_week] || r.day_of_week;
            return normalizedDay === day;
          });
          const isOffDay = dayRoutines.some((r: any) => r.item_type === "OFFDAY");
          const isToday = Boolean(liveStatus?.isToday(day));

          return (
            <div
              key={day}
              className={`bg-white rounded-2xl shadow-xs overflow-hidden flex flex-col border ${
                isToday ? "border-2 border-amber-500 ring-1 ring-amber-400/20" : "border-slate-200"
              }`}
            >
              <div
                className={`px-4 py-3 text-white flex items-center justify-between ${
                  isToday
                    ? "bg-gradient-to-r from-amber-900 to-slate-900"
                    : "bg-slate-900"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm">{day}</span>
                  {isToday && (
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-400 text-slate-950">
                      আজ
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-amber-300 font-medium">
                  {isOffDay
                    ? "সাপ্তাহিক ছুটি"
                    : dayRoutines.length > 0
                    ? `${toBanglaNumber(dayRoutines.length)}টি পিরিয়ড`
                    : "ফ্রি ডে"}
                </span>
              </div>

              <div className="p-4 space-y-2.5 flex-1">
                {dayRoutines.length > 0 ? (
                  dayRoutines.map((r: any, idx: number) => renderRoutineItem(r, idx))
                ) : (
                  <div className="py-8 text-center text-xs text-slate-400">
                    কোনো নির্ধারিত ক্লাস নেই
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
