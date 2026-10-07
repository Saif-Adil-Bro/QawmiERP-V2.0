"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Clock, BookOpen, MapPin, Radio, Calendar, 
  ArrowRight, CheckCircle2, AlertCircle, Sparkles, ChevronRight 
} from "lucide-react";
import { toBanglaNumber } from "@/lib/numberToBangla";
import { 
  getRoutineLiveStatus, 
  formatTimeString, 
  timeStringToMinutes 
} from "@/lib/routine-helper";

interface CurrentClassLiveBannerProps {
  routines: any[];
  isTeacherView?: boolean;
  teacherName?: string;
  showFullTimeline?: boolean;
}

export default function CurrentClassLiveBanner({
  routines = [],
  isTeacherView = false,
  teacherName,
  showFullTimeline = false,
}: CurrentClassLiveBannerProps) {
  const [now, setNow] = useState<Date>(new Date());

  // Update clock every 30 seconds for real-time reactivity
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const liveStatus = getRoutineLiveStatus(routines, now);
  const { todayBangla, todayClasses, currentClass, nextClass } = liveStatus;

  // Calculate minutes remaining if currently in class
  let minutesLeft = 0;
  if (currentClass) {
    const endMinutes = timeStringToMinutes(currentClass.end_time);
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    if (endMinutes > nowMinutes) {
      minutesLeft = endMinutes - nowMinutes;
    }
  }

  // Calculate minutes until next class
  let minutesUntilNext = 0;
  if (nextClass) {
    const startMinutes = timeStringToMinutes(nextClass.start_time);
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    if (startMinutes > nowMinutes) {
      minutesUntilNext = startMinutes - nowMinutes;
    }
  }

  return (
    <div className="space-y-3">
      {/* 1. ONGOING / LIVE CLASS ACTIVE NOW */}
      {currentClass ? (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-rose-950 via-slate-900 to-rose-950 text-white p-5 sm:p-6 border-2 border-rose-500/80 shadow-lg shadow-rose-950/20 animate-pulse-glow">
          <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-rose-500/20 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-600 text-white text-xs font-black tracking-wider uppercase shadow-xs">
                <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                <Radio className="w-3.5 h-3.5" />
                <span>বর্তমানে ক্লাস চলমান (Live Now)</span>
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg sm:text-2xl font-black text-white">
                    {currentClass.display_title || currentClass.subject_name}
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-lg bg-white/20 text-rose-200 text-xs font-bold backdrop-blur-xs border border-white/20">
                    জামাত: {currentClass.class_name}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-rose-100/90 mt-1.5 font-medium">
                  <span className="flex items-center gap-1.5 font-mono font-bold bg-black/30 px-2.5 py-1 rounded-lg">
                    <Clock className="w-4 h-4 text-rose-400" />
                    {toBanglaNumber(formatTimeString(currentClass.start_time))} - {toBanglaNumber(formatTimeString(currentClass.end_time))}
                  </span>

                  {minutesLeft > 0 && (
                    <span className="text-amber-300 font-bold">
                      (আর প্রায় {toBanglaNumber(minutesLeft)} মিনিট বাকি)
                    </span>
                  )}

                  {currentClass.clean_room && (
                    <span className="flex items-center gap-1 text-slate-300">
                      <MapPin className="w-3.5 h-3.5 text-rose-400" />
                      কক্ষ: {currentClass.clean_room}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Actions during live class */}
            <div className="flex items-center gap-2.5 shrink-0">
              {isTeacherView ? (
                <>
                  <Link
                    href="/teacher-portal/attendance"
                    className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>হাজিরা নিন</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link
                    href="/teacher-portal/kitab"
                    className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs sm:text-sm font-bold backdrop-blur-xs border border-white/20 transition flex items-center gap-1.5"
                  >
                    <span>দরস ডায়েরি</span>
                  </Link>
                </>
              ) : (
                <div className="px-3.5 py-2 bg-rose-900/60 border border-rose-500/40 rounded-xl text-xs text-rose-200 font-bold">
                  📍 নির্ধারিত সময়ে পাঠদান চলমান
                </div>
              )}
            </div>
          </div>
        </div>
      ) : nextClass ? (
        /* 2. UPCOMING CLASS TODAY */
        <div className="rounded-2xl bg-gradient-to-r from-amber-50 via-orange-50/60 to-amber-50 p-4 sm:p-5 border border-amber-300/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-xs">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-200 text-amber-950 rounded-md uppercase">
                  আজকের পরবর্তী ক্লাস
                </span>
                {minutesUntilNext > 0 && (
                  <span className="text-xs font-bold text-amber-800">
                    ({toBanglaNumber(minutesUntilNext)} মিনিট পর শুরু)
                  </span>
                )}
              </div>
              <h4 className="text-sm sm:text-base font-black text-slate-900 mt-0.5">
                {nextClass.display_title || nextClass.subject_name} • <span className="text-amber-900 font-bold">জামাত: {nextClass.class_name}</span>
              </h4>
              <p className="text-xs text-slate-600 font-mono mt-0.5">
                ⏰ সময়: {toBanglaNumber(formatTimeString(nextClass.start_time))} - {toBanglaNumber(formatTimeString(nextClass.end_time))}
                {nextClass.clean_room && <span> | 📍 কক্ষ: {nextClass.clean_room}</span>}
              </p>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="text-xs font-bold text-amber-800 bg-white px-3 py-1.5 rounded-xl border border-amber-200 shadow-2xs">
              আজ মোট {toBanglaNumber(todayClasses.length)} টি ক্লাসের শিডিউল
            </span>
          </div>
        </div>
      ) : todayClasses.length > 0 ? (
        /* 3. TODAY'S CLASSES COMPLETED */
        <div className="rounded-2xl bg-emerald-50/70 p-4 border border-emerald-200 shadow-2xs flex items-center justify-between gap-3 text-emerald-950">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <p className="text-xs sm:text-sm font-bold">
                আজকের ({todayBangla}) সকল নির্ধারিত পাঠদান সম্পন্ন হয়েছে।
              </p>
              <p className="text-[11px] text-emerald-800/80">
                মোট {toBanglaNumber(todayClasses.length)} টি পিরিয়ড সফলভাবে সমাপ্ত হয়েছে।
              </p>
            </div>
          </div>
          <span className="text-[11px] font-bold px-2.5 py-1 bg-emerald-100 text-emerald-900 rounded-lg">
            ✓ ক্লাস সমাপ্ত
          </span>
        </div>
      ) : (
        /* 4. NO CLASSES SCHEDULED TODAY */
        <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200 shadow-2xs flex items-center justify-between gap-3 text-slate-600">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-slate-400 shrink-0" />
            <div>
              <p className="text-xs sm:text-sm font-bold text-slate-800">
                আজকে ({todayBangla}) কোনো ক্লাস নির্ধারিত নেই (অফ-পিরিয়ড / ছুটি)।
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
