"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  CalendarDays, Clock, MapPin, Layers, Coffee, Sparkles, 
  Sun, ShieldCheck, BookOpen, Printer, CheckCircle2, Radio,
  ArrowRight, Calendar
} from "lucide-react";
import { toBanglaNumber } from "@/lib/numberToBangla";
import { 
  parseRoutineItem, 
  formatTimeString, 
  getRoutineLiveStatus 
} from "@/lib/routine-helper";
import CurrentClassLiveBanner from "@/components/routine/CurrentClassLiveBanner";

interface TeacherRoutineViewClientProps {
  schedule: {
    isTeachingStaff: boolean;
    assignedSubjects: any[];
    inChargeClasses: any[];
    routines: any[];
  };
  teacherName: string;
  teacherDesignation: string;
}

const DAY_MAP: Record<string, string> = {
  Saturday: "শনিবার",
  Sunday: "রবিবার",
  Monday: "সোমবার",
  Tuesday: "মঙ্গলবার",
  Wednesday: "বুধবার",
  Thursday: "বৃহস্পতিবার",
  Friday: "শুক্রবার",
  "শনিবার": "শনিবার",
  "রবিবার": "রবিবার",
  "সোমবার": "সোমবার",
  "মঙ্গলবার": "মঙ্গলবার",
  "বুধবার": "বুধবার",
  "বৃহস্পতিবার": "বৃহস্পতিবার",
  "শুক্রবার": "শুক্রবার",
};

const DAY_KEYS = ["শনিবার", "রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার"];

export default function TeacherRoutineViewClient({
  schedule,
  teacherName,
  teacherDesignation,
}: TeacherRoutineViewClientProps) {
  const [now, setNow] = useState<Date>(new Date());

  // Real-time ticking every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const liveStatus = getRoutineLiveStatus(schedule.routines, now);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header Banner */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-indigo-50 text-indigo-700 rounded-2xl border border-indigo-100">
            <CalendarDays className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900">আমার পাঠদান ও সাপ্তাহিক রুটিন</h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              উস্তাদ: <strong className="text-slate-800">{teacherName}</strong>
              <span className="text-slate-400"> | পদবি: {teacherDesignation}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/teacher-portal"
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
          >
            ড্যাশবোর্ডে ফিরুন
          </Link>
        </div>
      </div>

      {/* Real-time Current Class Live Banner */}
      {schedule.routines && schedule.routines.length > 0 && (
        <CurrentClassLiveBanner
          routines={schedule.routines}
          isTeacherView={true}
          teacherName={teacherName}
        />
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {/* In-Charge Role Card */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0 border border-teal-100">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500">শ্রেণি জিম্মাদারি</p>
            <p className="text-base font-black text-teal-800">
              {schedule.inChargeClasses.length > 0 ? (
                schedule.inChargeClasses.map(c => c.class_name).join(", ")
              ) : (
                "জিম্মাদারি নেই"
              )}
            </p>
          </div>
        </div>

        {/* Assigned Subjects Card */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-100">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500">বরাদ্দকৃত বিষয় / কিতাব</p>
            <p className="text-base font-black text-emerald-800">
              {toBanglaNumber(schedule.assignedSubjects.length)} টি কিতাব
            </p>
          </div>
        </div>

        {/* Total Periods Card */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0 border border-indigo-100">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500">সাপ্তাহিক ক্লাস পিরিয়ড</p>
            <p className="text-base font-black text-indigo-800">
              {toBanglaNumber(schedule.routines.length)} টি পিরিয়ড
            </p>
          </div>
        </div>
      </div>

      {/* In-Charge Classes Banner (if any) */}
      {schedule.inChargeClasses.length > 0 && (
        <div className="p-4 sm:p-5 bg-gradient-to-r from-teal-900 to-emerald-900 text-white rounded-2xl shadow-xs flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0 backdrop-blur-xs">
              <ShieldCheck className="w-6 h-6 text-teal-300" />
            </div>
            <div>
              <span className="text-[10px] font-bold bg-teal-400 text-teal-950 px-2 py-0.5 rounded-full uppercase tracking-wider">
                শ্রেণি জিম্মাদার শিক্ষক
              </span>
              <h3 className="text-base sm:text-lg font-black mt-0.5">
                {schedule.inChargeClasses.map(c => c.class_name).join(", ")}
              </h3>
              <p className="text-xs text-teal-100/80">
                আপনি উপরোক্ত জামাতের প্রধান জিম্মাদার শিক্ষক হিসেবে শিক্ষার্থীদের সার্বিক পাঠদান, হাজিরা ও শৃঙ্খলা তদারকির দায়িত্বে রয়েছেন।
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Assigned Subjects Summary Grid */}
      {schedule.assignedSubjects.length > 0 && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-emerald-700" />
            <span>আমার নির্ধারিত জামাত ও কিতাবসমূহ</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {schedule.assignedSubjects.map((sub) => (
              <div
                key={sub.id}
                className="p-3.5 bg-slate-50/80 border border-slate-200 rounded-xl space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded-md">
                    {sub.class_name}
                  </span>
                  {sub.subject_code && (
                    <span className="text-[10px] font-mono text-slate-400">
                      {sub.subject_code}
                    </span>
                  )}
                </div>
                <h4 className="text-xs sm:text-sm font-black text-slate-900">{sub.subject_name}</h4>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Routine Cards by Day (সাপ্তাহিক রুটিন with Dynamic Live Highlights) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-600" />
            <span>সাপ্তাহিক দিনভিত্তিক ক্লাস শিডিউল</span>
          </h3>
        </div>

        <div className="space-y-4">
          {DAY_KEYS.map((day) => {
            const dayRoutines = schedule.routines.filter((r) => {
              const normalizedDay = DAY_MAP[r.day_of_week] || r.day_of_week;
              return normalizedDay === day;
            });

            const isTodayDay = liveStatus.isToday(day);

            return (
              <div 
                key={day} 
                className={`rounded-2xl border overflow-hidden transition ${
                  isTodayDay 
                    ? "border-2 border-indigo-500 bg-indigo-50/30 shadow-xs" 
                    : "border-slate-200/80 bg-white shadow-xs"
                }`}
              >
                <div className={`px-4 py-3 flex items-center justify-between ${
                  isTodayDay 
                    ? "bg-gradient-to-r from-indigo-900 to-slate-900 text-white" 
                    : "bg-slate-900 text-white"
                }`}>
                  <div className="flex items-center gap-2">
                    <Calendar className={`w-4 h-4 ${isTodayDay ? "text-amber-300" : "text-slate-400"}`} />
                    <span className="font-bold text-sm">{day}</span>
                    {isTodayDay && (
                      <span className="text-[10px] font-black px-2 py-0.5 bg-amber-400 text-slate-950 rounded-full uppercase tracking-wider">
                        আজকের দিন
                      </span>
                    )}
                  </div>
                  <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                    dayRoutines.length > 0 
                      ? (isTodayDay ? "bg-white/20 text-white" : "bg-indigo-500/30 text-amber-300 border border-indigo-400/30") 
                      : "text-slate-400"
                  }`}>
                    {dayRoutines.length > 0 ? `${toBanglaNumber(dayRoutines.length)} টি পিরিয়ড` : "অফ / ফ্রি ডে"}
                  </span>
                </div>

                <div className="p-3.5 sm:p-4">
                  {dayRoutines.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {dayRoutines.map((r, idx) => {
                        const start = formatTimeString(r.start_time);
                        const end = formatTimeString(r.end_time);
                        const isCurrentLive = liveStatus.isCurrent(r);

                        return (
                          <div
                            key={r.id || idx}
                            className={`p-3.5 rounded-xl transition space-y-2 ${
                              isCurrentLive
                                ? "bg-rose-50/90 border-2 border-rose-500 shadow-md ring-2 ring-rose-400/30"
                                : "bg-slate-50 hover:bg-indigo-50/50 border border-slate-200 hover:border-indigo-300"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 ${
                                isCurrentLive
                                  ? "bg-rose-600 text-white"
                                  : "bg-indigo-50 text-indigo-700 border border-indigo-100"
                              }`}>
                                {isCurrentLive ? (
                                  <>
                                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                                    <Radio className="w-3 h-3" />
                                    <span>চলমান ({toBanglaNumber(start)} - {toBanglaNumber(end)})</span>
                                  </>
                                ) : (
                                  <>
                                    <Clock className="w-3 h-3 text-indigo-600" />
                                    {toBanglaNumber(start)} - {toBanglaNumber(end)}
                                  </>
                                )}
                              </span>
                              <span className="text-[10px] font-black px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded-md">
                                {r.class_name}
                              </span>
                            </div>

                            <div>
                              <h5 className={`font-black text-xs sm:text-sm ${
                                isCurrentLive ? "text-rose-950 font-bold" : "text-slate-900"
                              }`}>
                                {r.display_title || r.subject_name}
                              </h5>
                              <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-1">
                                <span>জামাত: <strong>{r.class_name}</strong></span>
                                {r.clean_room && (
                                  <span className="text-slate-400">| 📍 {r.clean_room}</span>
                                )}
                              </div>
                            </div>

                            {/* If live, show quick attendance link */}
                            {isCurrentLive && (
                              <div className="pt-1 flex items-center gap-2">
                                <Link
                                  href="/teacher-portal/attendance"
                                  className="w-full py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold rounded-lg flex items-center justify-center gap-1 transition shadow-2xs"
                                >
                                  <span>এখনই হাজিরা নিন</span>
                                  <ArrowRight className="w-3 h-3" />
                                </Link>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-5 text-center text-slate-400 text-xs italic">
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
