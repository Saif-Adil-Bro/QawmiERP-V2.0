"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Clock,
  MapPin,
  Radio,
  ArrowRight,
  CheckCircle2,
  Sun,
  CalendarOff,
} from "lucide-react";
import { toBanglaNumber } from "@/lib/numberToBangla";
import {
  getRoutineLiveStatus,
  formatBanglaTime,
  type HolidayRangeLike,
} from "@/lib/routine-helper";

interface CurrentClassLiveBannerProps {
  routines: any[];
  holidays?: HolidayRangeLike[];
  isTeacherView?: boolean;
  teacherName?: string;
  showFullTimeline?: boolean;
}

export default function CurrentClassLiveBanner({
  routines = [],
  holidays = [],
  isTeacherView = false,
}: CurrentClassLiveBannerProps) {
  // Hydration-safe: initialize client clock strictly inside useEffect
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => {
      setNow(new Date());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  if (!now) {
    return (
      <div className="rounded-2xl bg-slate-100/80 border border-slate-200/80 p-4 sm:p-5 animate-pulse">
        <div className="h-4 w-36 bg-slate-200 rounded-md mb-2" />
        <div className="h-5 w-56 bg-slate-200 rounded-md" />
      </div>
    );
  }

  const liveStatus = getRoutineLiveStatus(routines, now, holidays);
  const {
    todayBangla,
    todayClasses,
    currentClass,
    nextClass,
    minutesLeft,
    minutesUntilNext,
    isHoliday,
    holidayTitle,
    isOffDay,
    offDayTitle,
  } = liveStatus;

  return (
    <div className="space-y-3">
      {/* 1. ACADEMIC HOLIDAY */}
      {isHoliday ? (
        <div className="rounded-2xl bg-amber-50/90 p-4 sm:p-5 border border-amber-200 shadow-2xs flex items-start sm:items-center justify-between gap-3 text-amber-950">
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <div className="p-2.5 bg-amber-100 text-amber-700 rounded-xl shrink-0">
              <CalendarOff className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="inline-block text-[10px] font-bold px-2 py-0.5 bg-amber-200/80 text-amber-950 rounded-md mb-1">
                একাডেমিক ছুটি • {todayBangla}
              </span>
              <p className="text-sm font-bold text-amber-950 break-words">
                {holidayTitle || "আজ মাদরাসার নির্ধারিত একাডেমিক ছুটি"}
              </p>
              <p className="text-xs text-amber-800/85 mt-0.5">
                আজকের নির্ধারিত সকল ক্লাস ও পাঠদান বন্ধ রয়েছে।
              </p>
            </div>
          </div>
        </div>
      ) : isOffDay ? (
        /* 2. WEEKLY OFF-DAY */
        <div className="rounded-2xl bg-rose-50/80 p-4 sm:p-5 border border-rose-200 shadow-2xs flex items-start sm:items-center justify-between gap-3 text-rose-950">
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <div className="p-2.5 bg-rose-100 text-rose-600 rounded-xl shrink-0">
              <Sun className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="inline-block text-[10px] font-bold px-2 py-0.5 bg-rose-200/80 text-rose-950 rounded-md mb-1">
                সাপ্তাহিক ছুটি • {todayBangla}
              </span>
              <p className="text-sm font-bold text-rose-950 break-words">
                {offDayTitle || "আজ সাপ্তাহিক ছুটির দিন"}
              </p>
              <p className="text-xs text-rose-800/80 mt-0.5">
                আজ কোনো নিয়মিত ক্লাস পিরিয়ড নেই।
              </p>
            </div>
          </div>
        </div>
      ) : currentClass ? (
        /* 3. ONGOING LIVE CLASS */
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-rose-950 via-slate-900 to-rose-950 text-white p-4 sm:p-6 border-2 border-rose-500/80 shadow-lg shadow-rose-950/20">
          <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-rose-500/20 rounded-full blur-2xl pointer-events-none" />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
            <div className="space-y-2 min-w-0">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-600 text-white text-xs font-black tracking-wide shadow-xs">
                <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                <Radio className="w-3.5 h-3.5" />
                <span>চলমান ক্লাস</span>
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base sm:text-xl font-black text-white break-words">
                    {currentClass.display_title || currentClass.subject_name || "চলমান পিরিয়ড"}
                  </h3>
                  {currentClass.class_name && (
                    <span className="px-2.5 py-0.5 rounded-lg bg-white/15 text-rose-100 text-xs font-bold border border-white/20">
                      জামাত: {currentClass.class_name}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2.5 text-xs sm:text-sm text-rose-100/90 mt-2 font-medium">
                  <span className="inline-flex items-center gap-1.5 font-bold bg-black/30 px-2.5 py-1 rounded-lg">
                    <Clock className="w-3.5 h-3.5 text-rose-300 shrink-0" />
                    <span>
                      {formatBanglaTime(currentClass.start_time)} – {formatBanglaTime(currentClass.end_time)}
                    </span>
                  </span>

                  {minutesLeft > 0 && (
                    <span className="text-amber-300 font-bold">
                      আর {toBanglaNumber(minutesLeft)} মিনিট বাকি
                    </span>
                  )}

                  {currentClass.clean_room && (
                    <span className="inline-flex items-center gap-1 text-slate-200">
                      <MapPin className="w-3.5 h-3.5 text-rose-300 shrink-0" />
                      <span>কক্ষ: {currentClass.clean_room}</span>
                    </span>
                  )}

                  {!isTeacherView && currentClass.display_subtitle && (
                    <span className="text-rose-200">
                      উস্তাদ: {currentClass.display_subtitle}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {isTeacherView ? (
                <>
                  <Link
                    href="/teacher-portal/attendance"
                    className="min-h-[44px] px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition inline-flex items-center justify-center gap-1.5"
                  >
                    <span>হাজিরা নিন</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link
                    href="/teacher-portal/kitab"
                    className="min-h-[44px] px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs sm:text-sm font-bold border border-white/20 transition inline-flex items-center justify-center"
                  >
                    <span>দরস ডায়েরি</span>
                  </Link>
                </>
              ) : (
                <Link
                  href="/portal/routine"
                  className="min-h-[44px] px-4 py-2 bg-rose-800/80 hover:bg-rose-700 border border-rose-400/40 rounded-xl text-xs font-bold text-rose-100 inline-flex items-center justify-center gap-1.5 transition"
                >
                  <span>সম্পূর্ণ রুটিন</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
          </div>
        </div>
      ) : nextClass ? (
        /* 4. UPCOMING NEXT CLASS TODAY */
        <div className="rounded-2xl bg-gradient-to-r from-amber-50 via-orange-50/60 to-amber-50 p-4 sm:p-5 border border-amber-300/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-xs shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold px-2 py-0.5 bg-amber-200 text-amber-950 rounded-md">
                  পরবর্তী ক্লাস
                </span>
                {minutesUntilNext > 0 && (
                  <span className="text-xs font-bold text-amber-800">
                    {toBanglaNumber(minutesUntilNext)} মিনিট পর শুরু
                  </span>
                )}
              </div>
              <h4 className="text-sm sm:text-base font-black text-slate-900 mt-1 break-words">
                {nextClass.display_title || nextClass.subject_name || "নির্ধারিত পিরিয়ড"}
                {nextClass.class_name && (
                  <span className="text-amber-900 font-bold"> • জামাত: {nextClass.class_name}</span>
                )}
              </h4>
              <p className="text-xs text-slate-600 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="font-semibold">
                  সময়: {formatBanglaTime(nextClass.start_time)} – {formatBanglaTime(nextClass.end_time)}
                </span>
                {nextClass.clean_room && <span>• কক্ষ: {nextClass.clean_room}</span>}
                {!isTeacherView && nextClass.display_subtitle && (
                  <span>• উস্তাদ: {nextClass.display_subtitle}</span>
                )}
              </p>
            </div>
          </div>

          <div className="shrink-0">
            <span className="inline-block text-xs font-bold text-amber-900 bg-white px-3 py-1.5 rounded-xl border border-amber-200 shadow-2xs">
              আজ মোট {toBanglaNumber(todayClasses.length)}টি পিরিয়ড
            </span>
          </div>
        </div>
      ) : todayClasses.length > 0 ? (
        /* 5. TODAY'S CLASSES COMPLETED */
        <div className="rounded-2xl bg-emerald-50/80 p-4 border border-emerald-200 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-emerald-950">
          <div className="flex items-center gap-3 min-w-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-bold">
                আজকের ({todayBangla}) সকল নির্ধারিত ক্লাস সম্পন্ন হয়েছে।
              </p>
              <p className="text-[11px] text-emerald-800/80">
                মোট {toBanglaNumber(todayClasses.length)}টি পিরিয়ড সফলভাবে সমাপ্ত হয়েছে।
              </p>
            </div>
          </div>
          <span className="text-[11px] font-bold px-2.5 py-1 bg-emerald-100 text-emerald-900 rounded-lg shrink-0">
            ক্লাস সমাপ্ত
          </span>
        </div>
      ) : (
        /* 6. NO CLASSES SCHEDULED TODAY */
        <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200 shadow-2xs flex items-center gap-3 text-slate-600">
          <Clock className="w-5 h-5 text-slate-400 shrink-0" />
          <p className="text-xs sm:text-sm font-bold text-slate-700">
            আজকে ({todayBangla}) কোনো নিয়মিত ক্লাস নির্ধারিত নেই।
          </p>
        </div>
      )}
    </div>
  );
}
