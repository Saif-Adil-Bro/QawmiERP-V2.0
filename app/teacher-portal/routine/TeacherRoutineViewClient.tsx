"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Clock,
  MapPin,
  ShieldCheck,
  BookOpen,
  Radio,
  ArrowRight,
  Calendar,
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

interface TeacherRoutineViewClientProps {
  schedule: {
    isTeachingStaff: boolean;
    assignedSubjects: any[];
    inChargeClasses: any[];
    routines: any[];
  };
  holidays?: HolidayRangeLike[];
  teacherName: string;
  teacherDesignation: string;
}

const DAY_TABS = [
  { full: "শনিবার", short: "শনি" },
  { full: "রবিবার", short: "রবি" },
  { full: "সোমবার", short: "সোম" },
  { full: "মঙ্গলবার", short: "মঙ্গল" },
  { full: "বুধবার", short: "বুধ" },
  { full: "বৃহস্পতিবার", short: "বৃহঃ" },
  { full: "শুক্রবার", short: "শুক্র" },
] as const;

export default function TeacherRoutineViewClient({
  schedule,
  holidays = [],
  teacherName,
  teacherDesignation,
}: TeacherRoutineViewClientProps) {
  const offlineSnapshot = useOfflinePortalSnapshot();

  // Hydration-safe: initialize client time & default day strictly inside useEffect
  const [now, setNow] = useState<Date | null>(null);
  const [selectedDay, setSelectedDay] = useState<string>("শনিবার");

  useEffect(() => {
    const initial = new Date();
    setNow(initial);
    setSelectedDay(getDhakaClockParts(initial).banglaDay);

    const timer = setInterval(() => {
      setNow(new Date());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const effectiveRoutines=offlineSnapshot?.routines ?? schedule.routines;
  const effectiveHolidays:HolidayRangeLike[]=offlineSnapshot?.academicCalendar ?? holidays;
  const liveStatus = useMemo(
    () => (now ? getRoutineLiveStatus(effectiveRoutines, now, effectiveHolidays) : null),
    [effectiveRoutines, now, effectiveHolidays]
  );

  const renderPeriodCard = (r: any, idx: number) => {
    const start = formatBanglaTime(r.start_time);
    const end = formatBanglaTime(r.end_time);
    const isCurrentLive = Boolean(liveStatus?.isCurrent(r));
    const isNextLive = Boolean(liveStatus?.isNext(r));

    return (
      <div
        key={r.id || idx}
        className={`p-3.5 rounded-xl transition space-y-2 ${
          isCurrentLive
            ? "bg-rose-50/90 border-2 border-rose-500 shadow-md ring-2 ring-rose-400/25"
            : isNextLive
            ? "bg-amber-50/80 border border-amber-300 shadow-2xs"
            : "bg-slate-50 hover:bg-indigo-50/50 border border-slate-200 hover:border-indigo-300"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <span
            className={`text-[11px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 ${
              isCurrentLive
                ? "bg-rose-600 text-white"
                : isNextLive
                ? "bg-amber-200 text-amber-950"
                : "bg-indigo-50 text-indigo-700 border border-indigo-100"
            }`}
          >
            {isCurrentLive ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                <Radio className="w-3 h-3 shrink-0" />
                <span>চলমান ক্লাস</span>
              </>
            ) : isNextLive ? (
              <>
                <Clock className="w-3 h-3 shrink-0" />
                <span>পরবর্তী ক্লাস</span>
              </>
            ) : (
              <>
                <Clock className="w-3 h-3 text-indigo-600 shrink-0" />
                <span>
                  {start} – {end}
                </span>
              </>
            )}
          </span>
          {r.class_name && (
            <span className="text-[10px] font-black px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded-md">
              {r.class_name}
            </span>
          )}
        </div>

        <div>
          <h5
            className={`font-black text-xs sm:text-sm break-words ${
              isCurrentLive ? "text-rose-950" : "text-slate-900"
            }`}
          >
            {r.display_title || r.subject_name}
          </h5>
          <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1">
            <span>
              {start} – {end}
            </span>
            {r.clean_room && (
              <span className="inline-flex items-center gap-0.5 text-slate-600">
                <MapPin className="w-3 h-3 text-indigo-500 shrink-0" />
                <span>কক্ষ: {r.clean_room}</span>
              </span>
            )}
          </div>
        </div>

        {isCurrentLive && (
          <div className="pt-1">
            <Link
              href="/teacher-portal/attendance"
              className="w-full min-h-[44px] py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition shadow-2xs"
            >
              <span>এখনই হাজিরা নিন</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}
      </div>
    );
  };

  const selectedDayRoutines = effectiveRoutines.filter((r: any) => {
    const normalizedDay = DAY_TRANSLATIONS[r.day_of_week] || r.day_of_week;
    return normalizedDay === selectedDay;
  });

  return (
    <div className="space-y-5 sm:space-y-6 max-w-6xl mx-auto w-full overflow-x-hidden">
      {/* Header Banner */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="p-2.5 sm:p-3 bg-indigo-50 text-indigo-700 rounded-2xl border border-indigo-100 shrink-0">
            <CalendarDays className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-black text-slate-900">
              আমার পাঠদান ও সাপ্তাহিক রুটিন
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5 break-words">
              উস্তাদ: <strong className="text-slate-800">{teacherName}</strong>
              <span className="text-slate-400"> • পদবি: {teacherDesignation}</span>
            </p>
          </div>
        </div>

        <Link
          href="/teacher-portal"
          className="min-h-[44px] px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition inline-flex items-center justify-center shrink-0"
        >
          ড্যাশবোর্ডে ফিরুন
        </Link>
      </div>

      {/* Real-time Current Class Live Banner */}
      <CurrentClassLiveBanner
        routines={effectiveRoutines}
        holidays={effectiveHolidays}
        isTeacherView={true}
        teacherName={teacherName}
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0 border border-teal-100">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-500">শ্রেণি জিম্মাদারি</p>
            <p className="text-sm sm:text-base font-black text-teal-800 break-words">
              {schedule.inChargeClasses.length > 0
                ? schedule.inChargeClasses.map((c) => c.class_name).join(", ")
                : "জিম্মাদারি নেই"}
            </p>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-100">
            <BookOpen className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-500">বরাদ্দকৃত বিষয় / কিতাব</p>
            <p className="text-sm sm:text-base font-black text-emerald-800">
              {toBanglaNumber(schedule.assignedSubjects.length)}টি কিতাব
            </p>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0 border border-indigo-100">
            <Clock className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-500">সাপ্তাহিক ক্লাস পিরিয়ড</p>
            <p className="text-sm sm:text-base font-black text-indigo-800">
              {toBanglaNumber(effectiveRoutines.length)}টি পিরিয়ড
            </p>
          </div>
        </div>
      </div>

      {/* Assigned Subjects Summary Grid */}
      {schedule.assignedSubjects.length > 0 && (
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>আমার নির্ধারিত জামাত ও কিতাবসমূহ</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {schedule.assignedSubjects.map((sub) => (
              <div
                key={sub.id}
                className="p-3.5 bg-slate-50/80 border border-slate-200 rounded-xl space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded-md">
                    {sub.class_name}
                  </span>
                  {sub.subject_code && (
                    <span className="text-[10px] font-mono text-slate-400">
                      {sub.subject_code}
                    </span>
                  )}
                </div>
                <h4 className="text-xs sm:text-sm font-black text-slate-900 break-words">
                  {sub.subject_name}
                </h4>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mobile Day Slider (< 768px) */}
      <div className="md:hidden space-y-3">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Clock className="w-4 h-4 text-indigo-600 shrink-0" />
          <span>দিনভিত্তিক ক্লাস শিডিউল</span>
        </h3>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {DAY_TABS.map((d) => {
            const isSelected = selectedDay === d.full;
            const isTodayDay = Boolean(liveStatus?.isToday(d.full));
            return (
              <button
                key={d.full}
                type="button"
                onClick={() => setSelectedDay(d.full)}
                className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition shrink-0 flex items-center gap-1.5 border ${
                  isSelected
                    ? "bg-indigo-700 text-white border-indigo-700 shadow-xs"
                    : isTodayDay
                    ? "bg-indigo-50 text-indigo-900 border-indigo-300"
                    : "bg-white text-slate-700 border-slate-200"
                }`}
              >
                <span>{d.short}</span>
                {isTodayDay && (
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isSelected ? "bg-amber-300" : "bg-indigo-600"
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          <div className="px-4 py-3 bg-gradient-to-r from-indigo-900 to-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-300" />
              <span className="font-bold text-sm">{selectedDay}</span>
              {liveStatus?.isToday(selectedDay) && (
                <span className="text-[10px] font-black px-2 py-0.5 bg-amber-400 text-slate-950 rounded-full">
                  আজ
                </span>
              )}
            </div>
            <span className="text-[11px] font-bold text-amber-300">
              {selectedDayRoutines.length > 0
                ? `${toBanglaNumber(selectedDayRoutines.length)}টি পিরিয়ড`
                : "ফ্রি ডে"}
            </span>
          </div>

          <div className="p-3.5 space-y-2.5">
            {selectedDayRoutines.length > 0 ? (
              selectedDayRoutines.map((r: any, idx: number) => renderPeriodCard(r, idx))
            ) : (
              <div className="py-6 text-center text-slate-400 text-xs">
                এই বারে কোনো ক্লাস নির্ধারিত নেই।
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Desktop Weekly View (>= 768px) */}
      <div className="hidden md:block space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-600" />
            <span>সাপ্তাহিক দিনভিত্তিক ক্লাস শিডিউল</span>
          </h3>
        </div>

        <div className="space-y-4">
          {DAY_TABS.map(({ full: day }) => {
            const dayRoutines = effectiveRoutines.filter((r: any) => {
              const normalizedDay = DAY_TRANSLATIONS[r.day_of_week] || r.day_of_week;
              return normalizedDay === day;
            });

            const isTodayDay = Boolean(liveStatus?.isToday(day));

            return (
              <div
                key={day}
                className={`rounded-2xl border overflow-hidden transition ${
                  isTodayDay
                    ? "border-2 border-indigo-500 bg-indigo-50/30 shadow-xs"
                    : "border-slate-200/80 bg-white shadow-xs"
                }`}
              >
                <div
                  className={`px-4 py-3 flex items-center justify-between ${
                    isTodayDay
                      ? "bg-gradient-to-r from-indigo-900 to-slate-900 text-white"
                      : "bg-slate-900 text-white"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Calendar
                      className={`w-4 h-4 ${isTodayDay ? "text-amber-300" : "text-slate-400"}`}
                    />
                    <span className="font-bold text-sm">{day}</span>
                    {isTodayDay && (
                      <span className="text-[10px] font-black px-2 py-0.5 bg-amber-400 text-slate-950 rounded-full">
                        আজকের দিন
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                      dayRoutines.length > 0
                        ? isTodayDay
                          ? "bg-white/20 text-white"
                          : "bg-indigo-500/30 text-amber-300 border border-indigo-400/30"
                        : "text-slate-400"
                    }`}
                  >
                    {dayRoutines.length > 0
                      ? `${toBanglaNumber(dayRoutines.length)}টি পিরিয়ড`
                      : "ফ্রি ডে"}
                  </span>
                </div>

                <div className="p-4">
                  {dayRoutines.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {dayRoutines.map((r: any, idx: number) => renderPeriodCard(r, idx))}
                    </div>
                  ) : (
                    <div className="py-5 text-center text-slate-400 text-xs">
                      এই বারে কোনো ক্লাস নির্ধারিত নেই
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
