"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  BookOpen,
  ClipboardList,
  FileText,
  CalendarDays,
  Users,
  Bell,
  Clock,
  Sparkles,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  MapPin,
  Radio,
} from "lucide-react";
import { toBanglaNumber } from "@/lib/numberToBangla";
import {
  formatBanglaTime,
  getDhakaClockParts,
  getRoutineLiveStatus,
  type HolidayRangeLike,
} from "@/lib/routine-helper";
import { seedPortalOfflineCache } from "@/lib/portal-sync";
import { useOfflinePortalSnapshot } from "@/hooks/useOfflinePortalData";
import EarlyWarningWidget from "@/components/EarlyWarningWidget";
import LiveRoutineCarousel from "@/components/routine/LiveRoutineCarousel";

interface TeacherDashboardClientProps {
  teacherId: string;
  teacherName: string;
  designation: string;
  todayAttendanceCount: number;
  todayHifzCount: number;
  classes: any[];
  notices: any[];
  holidays: HolidayRangeLike[];
  earlyWarningData: any;
  teacherSchedule: {
    isTeachingStaff: boolean;
    assignedSubjects: any[];
    inChargeClasses: any[];
    routines: any[];
  };
}

export default function TeacherDashboardClient({
  teacherId,
  teacherName,
  designation,
  todayAttendanceCount,
  todayHifzCount,
  classes,
  notices,
  holidays,
  earlyWarningData,
  teacherSchedule,
}: TeacherDashboardClientProps) {
  const offlineSnapshot = useOfflinePortalSnapshot();

  // Hydration-safe live Dhaka clock strictly initialized inside useEffect
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => {
      setNow(new Date());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // Seed Dexie IndexedDB silently for instant offline availability
  useEffect(() => {
    seedPortalOfflineCache("teacher", {
      profile: teacherId
        ? {
            id: teacherId,
            role: "teacher",
            full_name: teacherName,
            teacher: { id: teacherId, name: teacherName, designation },
            assigned_subjects: teacherSchedule.assignedSubjects,
            in_charge_classes: teacherSchedule.inChargeClasses,
          }
        : null,
      classes,
      notices,
      routines: teacherSchedule.routines,
      academicCalendar: holidays.map((h, i) => ({
        ...h,
        id: String(h.id || `hol_${i}`),
      })),
    });
  }, [
    teacherId,
    teacherName,
    designation,
    classes,
    notices,
    holidays,
    teacherSchedule.assignedSubjects,
    teacherSchedule.inChargeClasses,
    teacherSchedule.routines,
  ]);

  const effectiveRoutines = useMemo(() => {
    if (teacherSchedule.routines?.length) return teacherSchedule.routines;
    return offlineSnapshot?.routines || [];
  }, [teacherSchedule.routines, offlineSnapshot?.routines]);

  const effectiveHolidays: HolidayRangeLike[] = useMemo(() => {
    if (holidays?.length) return holidays;
    return (offlineSnapshot?.academicCalendar || []) as HolidayRangeLike[];
  }, [holidays, offlineSnapshot?.academicCalendar]);

  const effectiveNotices = useMemo(() => {
    if (notices?.length) return notices;
    return (offlineSnapshot?.notices || []).slice(0, 3);
  }, [notices, offlineSnapshot?.notices]);

  const liveStatus = useMemo(
    () => (now ? getRoutineLiveStatus(effectiveRoutines, now, effectiveHolidays) : null),
    [effectiveRoutines, now, effectiveHolidays]
  );

  const todayFormattedDate = useMemo(() => {
    if (!now) return "";
    try {
      return now.toLocaleDateString("bn-BD", {
        timeZone: "Asia/Dhaka",
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return getDhakaClockParts(now).dateStr;
    }
  }, [now]);

  const todayBangla = liveStatus?.todayBangla || "আজ";
  const todayClasses = liveStatus?.todayClasses || [];

  return (
    <div className="space-y-5 sm:space-y-6 w-full max-w-full overflow-x-hidden">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white rounded-3xl p-4 sm:p-7 shadow-xl border border-emerald-900/60 flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-5 relative overflow-hidden">
        <div className="relative z-10 min-w-0">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs font-bold mb-2">
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>আসসালামু আলাইকুম ওয়া রাহমাতুল্লাহ</span>
          </div>
          <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-white break-words">
            স্বাগতম, {teacherName}
          </h1>
          <p className="text-xs sm:text-sm text-emerald-100/85 mt-1">
            পদবি: <strong>{designation}</strong>
            {todayFormattedDate && <> • আজ: {todayFormattedDate}</>}
          </p>
        </div>

        <div className="grid grid-cols-2 sm:flex items-center gap-2 relative z-10 shrink-0">
          <Link
            href="/teacher-portal/attendance"
            className="min-h-[44px] px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-lg shadow-emerald-950/40 transition flex items-center justify-center gap-2"
          >
            <Calendar className="w-4 h-4 shrink-0" />
            <span>হাজিরা গ্রহণ</span>
          </Link>
          <Link
            href="/teacher-portal/routine"
            className="min-h-[44px] px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs sm:text-sm font-bold backdrop-blur-xs border border-white/20 transition flex items-center justify-center gap-2"
          >
            <CalendarDays className="w-4 h-4 text-emerald-300 shrink-0" />
            <span>আমার রুটিন</span>
          </Link>
        </div>
      </div>

      {/* Live & Upcoming Class Routine Carousel (Immediately Below Hero) */}
      <LiveRoutineCarousel
        routines={effectiveRoutines}
        holidays={effectiveHolidays}
        variant="teacher"
        fullRoutineHref="/teacher-portal/routine"
      />

      {/* In-Charge Classes Announcement Card */}
      {teacherSchedule.inChargeClasses.length > 0 && (
        <div className="bg-gradient-to-r from-teal-900 via-slate-900 to-emerald-900 text-white p-4 sm:p-5 rounded-2xl border border-teal-700/50 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <div className="p-2.5 bg-teal-500/20 text-teal-300 rounded-2xl border border-teal-400/30 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold px-2 py-0.5 bg-teal-400 text-teal-950 rounded-full tracking-wide">
                শ্রেণি জিম্মাদারি দায়িত্ব
              </span>
              <h3 className="text-base sm:text-lg font-black mt-1 break-words">
                {teacherSchedule.inChargeClasses.map((c) => c.class_name).join(", ")}
              </h3>
              <p className="text-xs text-teal-100/80 mt-0.5 leading-relaxed">
                আপনি উপরোক্ত জামাতের প্রধান জিম্মাদার শিক্ষক। ছাত্র উপস্থিতি, পাঠদান শৃঙ্খলা ও সার্বিক তত্ত্বাবধান পরিচালনা করুন।
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto shrink-0">
            <Link
              href="/teacher-portal/students"
              className="min-h-[44px] px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl border border-white/20 transition flex items-center justify-center"
            >
              শিক্ষার্থী তালিকা
            </Link>
            <Link
              href="/teacher-portal/attendance"
              className="min-h-[44px] px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition flex items-center justify-center"
            >
              হাজিরা নিন
            </Link>
          </div>
        </div>
      )}

      {/* KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-2.5 sm:p-3 bg-emerald-50 text-emerald-700 rounded-xl shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-slate-500">বরাদ্দকৃত কিতাব</p>
            <p className="text-lg sm:text-2xl font-bold text-slate-900">
              {toBanglaNumber(teacherSchedule.assignedSubjects.length)}টি
            </p>
          </div>
        </div>

        <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-2.5 sm:p-3 bg-indigo-50 text-indigo-700 rounded-xl shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-slate-500">আজকের ক্লাস</p>
            <p className="text-lg sm:text-2xl font-bold text-indigo-700">
              {now ? `${toBanglaNumber(todayClasses.length)}টি` : "..."}
            </p>
          </div>
        </div>

        <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-2.5 sm:p-3 bg-teal-50 text-teal-700 rounded-xl shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-teal-700">আজকের হাজিরা</p>
            <p className="text-lg sm:text-2xl font-bold text-slate-900">
              {todayAttendanceCount > 0 ? `${toBanglaNumber(todayAttendanceCount)} জন` : "শুরু করুন"}
            </p>
          </div>
        </div>

        <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-2.5 sm:p-3 bg-purple-50 text-purple-700 rounded-xl shrink-0">
            <ClipboardList className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-purple-700">আজকের সবক</p>
            <p className="text-lg sm:text-2xl font-bold text-slate-900">
              {toBanglaNumber(todayHifzCount)}টি
            </p>
          </div>
        </div>
      </div>

      {/* Today's Teaching Schedule Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Clock className="w-5 h-5 text-indigo-600 shrink-0" />
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                আজকের পাঠদান সময়সূচি ({todayBangla})
              </h3>
              <p className="text-xs text-slate-500">
                আজকের নির্ধারিত ক্লাস, সময় ও কক্ষ নম্বর
              </p>
            </div>
          </div>

          <Link
            href="/teacher-portal/routine"
            className="min-h-[40px] sm:min-h-0 text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 self-start sm:self-auto"
          >
            <span>সম্পূর্ণ সপ্তাহের রুটিন দেখুন</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {!now ? (
          <div className="h-20 rounded-xl bg-slate-100 animate-pulse" />
        ) : liveStatus?.isHoliday ? (
          <div className="py-6 px-4 text-center text-amber-900 text-xs sm:text-sm bg-amber-50 rounded-xl border border-amber-200 font-semibold">
            আজ একাডেমিক ছুটি ({liveStatus.holidayTitle || "নির্ধারিত ছুটি"}) — সকল পাঠদান বন্ধ রয়েছে।
          </div>
        ) : liveStatus?.isOffDay ? (
          <div className="py-6 px-4 text-center text-rose-900 text-xs sm:text-sm bg-rose-50 rounded-xl border border-rose-200 font-semibold">
            আজ সাপ্তাহিক ছুটি ({liveStatus.offDayTitle || todayBangla}) — কোনো নিয়মিত ক্লাস নেই।
          </div>
        ) : todayClasses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {todayClasses.map((r: any, idx: number) => {
              const start = formatBanglaTime(r.start_time);
              const end = formatBanglaTime(r.end_time);
              const isCurrent = Boolean(liveStatus?.isCurrent(r));
              const isNext = Boolean(liveStatus?.isNext(r));

              return (
                <div
                  key={r.id || idx}
                  className={`p-4 rounded-xl border transition space-y-2 ${
                    isCurrent
                      ? "bg-rose-50/90 border-2 border-rose-500 shadow-xs"
                      : isNext
                      ? "bg-amber-50/70 border-amber-300"
                      : "bg-slate-50 hover:bg-indigo-50/50 border-slate-200 hover:border-indigo-300"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 ${
                        isCurrent
                          ? "bg-rose-600 text-white"
                          : isNext
                          ? "bg-amber-200 text-amber-950"
                          : "bg-indigo-100 text-indigo-800"
                      }`}
                    >
                      {isCurrent ? (
                        <>
                          <Radio className="w-3 h-3 shrink-0" />
                          <span>চলমান ক্লাস</span>
                        </>
                      ) : isNext ? (
                        <>
                          <Clock className="w-3 h-3 shrink-0" />
                          <span>পরবর্তী ক্লাস</span>
                        </>
                      ) : (
                        <>
                          <Clock className="w-3 h-3 shrink-0" />
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
                    <h5 className="font-black text-slate-900 text-sm break-words">
                      {r.display_title || r.subject_name}
                    </h5>
                    <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1">
                      <span>
                        {start} – {end}
                      </span>
                      {r.clean_room && (
                        <span className="inline-flex items-center gap-0.5 text-slate-600">
                          <MapPin className="w-3 h-3 text-indigo-500" />
                          <span>কক্ষ: {r.clean_room}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-6 px-4 text-center text-slate-500 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
            আজকে ({todayBangla}) আপনার কোনো নির্ধারিত ক্লাস নেই। সম্পূর্ণ রুটিন দেখতে{" "}
            <Link href="/teacher-portal/routine" className="font-bold text-indigo-600 underline">
              এখানে ট্যাপ করুন
            </Link>
            ।
          </div>
        )}
      </div>

      {/* Early Warning System Alert Widget */}
      <EarlyWarningWidget initialData={earlyWarningData} isTeacherView={true} />

      {/* Main Features Navigation Grid */}
      <div>
        <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-600" />
          <span>দৈনিক শিক্ষক মডিউলসমূহ</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
          {[
            {
              href: "/teacher-portal/attendance",
              title: "দৈনিক হাজিরা গ্রহণ",
              desc: "জামাতভিত্তিক উপস্থিতি ও অনুপস্থিতি রেকর্ড করুন।",
              icon: Calendar,
              accent: "bg-emerald-50 text-emerald-700 hover:border-emerald-500",
            },
            {
              href: "/teacher-portal/hifz",
              title: "হিফজ সবক ও আমুখতা",
              desc: "সবক, সবকি ও আমুখতা ট্র্যাকিং ও মূল্যায়ন দিন।",
              icon: BookOpen,
              accent: "bg-teal-50 text-teal-700 hover:border-teal-500",
            },
            {
              href: "/teacher-portal/kitab",
              title: "কিতাবাত ও পাঠ ডায়েরি",
              desc: "দৈনিক পঠিত কিতাব ও পৃষ্ঠা আপডেট করুন।",
              icon: FileText,
              accent: "bg-indigo-50 text-indigo-700 hover:border-indigo-500",
            },
            {
              href: "/teacher-portal/exams",
              title: "পরীক্ষার নম্বর এন্ট্রি",
              desc: "বিষয়ভিত্তিক পরীক্ষার নম্বর ও গ্রেড প্রদান করুন।",
              icon: ClipboardList,
              accent: "bg-purple-50 text-purple-700 hover:border-purple-500",
            },
            {
              href: "/teacher-portal/routine",
              title: "আমার ক্লাস রুটিন",
              desc: "সাপ্তাহিক ক্লাস ঘণ্টা ও ক্লাসরুম শিডিউল দেখুন।",
              icon: CalendarDays,
              accent: "bg-amber-50 text-amber-700 hover:border-amber-500",
            },
            {
              href: "/teacher-portal/students",
              title: "শিক্ষার্থী ও অভিভাবক তালিকা",
              desc: "শিক্ষার্থীর তথ্য ও অভিভাবকের নম্বরে কল/বার্তা।",
              icon: Users,
              accent: "bg-blue-50 text-blue-700 hover:border-blue-500",
            },
            {
              href: "/teacher-portal/notices",
              title: "মাদরাসা নোটিশ বোর্ড",
              desc: "মাদরাসার দাপ্তরিক ঘোষণা ও ছুটি সংক্রান্ত নোটিশ।",
              icon: Bell,
              accent: "bg-rose-50 text-rose-700 hover:border-rose-500",
            },
          ].map((mod) => {
            const Icon = mod.icon;
            const [bgCls, txtCls, borderHover] = mod.accent.split(" ");
            return (
              <Link
                key={mod.href}
                href={mod.href}
                className={`p-4 sm:p-5 bg-white rounded-2xl border border-slate-200 shadow-xs ${borderHover} hover:shadow-md transition flex flex-col justify-between group`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className={`p-2.5 sm:p-3 ${bgCls} ${txtCls} rounded-xl group-hover:scale-105 transition`}>
                    <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm sm:text-base">{mod.title}</h4>
                  <p className="text-xs text-slate-500 mt-1">{mod.desc}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Notices Section */}
      {effectiveNotices.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
              <Bell className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>সাম্প্রতিক মাদরাসা নোটিশ</span>
            </h3>
            <Link
              href="/teacher-portal/notices"
              className="text-xs font-bold text-indigo-700 hover:underline shrink-0"
            >
              সকল নোটিশ
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {effectiveNotices.map((n: any) => (
              <div
                key={n.id}
                className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1"
              >
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded inline-block">
                  {n.category || "নোটিশ"}
                </span>
                <h5 className="font-bold text-slate-800 text-xs sm:text-sm break-words">
                  {n.title}
                </h5>
                <p className="text-xs text-slate-500 line-clamp-2">{n.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
