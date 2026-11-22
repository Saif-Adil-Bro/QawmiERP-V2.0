"use client";
import {attendanceStats} from '@/lib/portal/rules';

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  GraduationCap,
  Calendar,
  CreditCard,
  Award,
  BookOpen,
  CalendarDays,
  Bell,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
  TrendingUp,
  Star,
  Trophy,
} from "lucide-react";
import { toBanglaNumber, formatBanglaCurrency } from "@/lib/numberToBangla";
import { useOfflinePortalSnapshot } from "@/hooks/useOfflinePortalData";
import LiveRoutineCarousel from "@/components/routine/LiveRoutineCarousel";
import type { HolidayRangeLike } from "@/lib/routine-helper";
import { toBanglaOrdinal } from "@/lib/exam-grading";

export interface DashboardLatestExamInfo {
  examId: string;
  examTitle: string;
  examYear?: string | number | null;
  hasMarks: boolean;
  gradeLabel: string;
  gpa: number;
  percentage: number;
  totalObtained: number;
  totalMax: number;
  isPassed: boolean;
  statusLabel: string;
  meritPosition: number | null;
  meritLabel: string;
  totalCandidates: number;
}

interface PortalDashboardClientProps {
  students: any[];
  child: any;
  attendanceList: any[];
  latestHifz: any | null;
  totalPaid: number;
  totalDue: number;
  latestReceiptNo: string;
  feesList: any[];
  latestExam: DashboardLatestExamInfo | null;
  notices: any[];
  childAssignments: any[];
  routines: any[];
  holidays: HolidayRangeLike[];
  todayDateStr: string;
}

function formatBanglaDateSafe(dateInput?: string | null): string {
  if (!dateInput) return "-";
  try {
    const clean = String(dateInput).slice(0, 10);
    const parts = clean.split("-").map(Number);
    if (parts.length === 3 && !parts.some(Number.isNaN)) {
      const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 6, 0, 0));
      return d.toLocaleDateString("bn-BD", {
        timeZone: "Asia/Dhaka",
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    }
    return new Date(dateInput).toLocaleDateString("bn-BD", {
      timeZone: "Asia/Dhaka",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return String(dateInput).slice(0, 10);
  }
}

export default function PortalDashboardClient({
  students,
  child,
  attendanceList,
  latestHifz,
  totalPaid,
  totalDue,
  latestReceiptNo,
  feesList,
  latestExam,
  notices,
  childAssignments,
  routines,
  holidays,
  todayDateStr,
}: PortalDashboardClientProps) {
  const offlineSnapshot = useOfflinePortalSnapshot();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const cache = offlineSnapshot?.activeStudent?.id === child.id ? offlineSnapshot : null;
  const effectiveAttendance = cache?.attendance ?? attendanceList, effectiveRoutines=cache?.routines ?? routines;
  const effectiveHolidays = cache?.academicCalendar ?? holidays, effectiveNotices=cache?.notices.slice(0,3) ?? notices;
  const effectiveAssignments = cache?.homework ?? childAssignments;
  const stored = cache?.examSummaries[0];
  const effectiveLatestExam:DashboardLatestExamInfo|null = !cache ? latestExam : stored ? {...stored.summary,...stored.merit,examId:stored.exam_id,examTitle:stored.exam_title,examYear:stored.exam_year,meritLabel:stored.merit_label} : null;
  if (cache) { latestHifz=cache.hifzLogs[0]; totalPaid=cache.totalPaid; totalDue=cache.totalDue; latestReceiptNo=cache.feePayments[0]?.receipt_no || '—'; }
  const {total:totalDays,present:presentDays,absent:absentDays,percentage:attendanceRate} = attendanceStats(effectiveAttendance);
  const todayAssignments = effectiveAssignments.filter(
    (a: any) => a.type === "TODAY_LESSON" || a.assigned_date === todayDateStr
  );

  const studentQuerySuffix = child?.id ? `?student_id=${child.id}` : "";
  const className =
    (Array.isArray(child?.classes) ? child.classes[0]?.name : child?.classes?.name) ||
    child?.class_name ||
    "নির্ধারিত জামাত";

  return (
    <div className="space-y-5 sm:space-y-6 w-full max-w-full overflow-x-hidden">
      {/* Multi-child Switcher Bar */}
      {students.length > 1 && (
        <div className="bg-white border border-emerald-200/80 rounded-2xl p-3.5 sm:p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center font-bold shrink-0">
              <GraduationCap className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-800">
                সন্তান নির্বাচন করুন ({toBanglaNumber(students.length)} জন নিবন্ধিত)
              </p>
              <p className="text-[11px] text-slate-500">
                যেকোনো সন্তানের প্রোফাইলে ট্যাপ করে তার ড্যাশবোর্ড দেখুন
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 -mx-1 px-1">
            {students.map((st) => {
              const isSelected = st.id === child.id;
              const stuId = st.student_id || st.student_id_formatted || "";
              return (
                <Link
                  key={st.id}
                  href={`/portal?student_id=${st.id}`}
                  className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shrink-0 whitespace-nowrap ${
                    isSelected
                      ? "bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-600/30"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
                  }`}
                >
                  {st.photo_url ? (
                    <img
                      src={st.photo_url}
                      alt=""
                      className="w-6 h-6 rounded-full object-cover border border-white/40 shrink-0"
                    />
                  ) : (
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                        isSelected ? "bg-emerald-700 text-white" : "bg-slate-300 text-slate-700"
                      }`}
                    >
                      {(st.first_name || "শ")[0]}
                    </span>
                  )}
                  <span>
                    {st.first_name} {st.last_name || ""}
                  </span>
                  {stuId && (
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md ${
                        isSelected
                          ? "bg-emerald-700/60 text-emerald-100"
                          : "bg-white text-emerald-700 border border-slate-200 font-semibold"
                      }`}
                    >
                      আইডি: {stuId}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Child Profile Hero Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white rounded-3xl p-4 sm:p-7 shadow-xl border border-emerald-800/60 flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-5 relative overflow-hidden">
        <div className="flex items-center gap-3.5 sm:gap-4 relative z-10 min-w-0">
          <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/20 flex items-center justify-center text-white font-bold text-2xl sm:text-3xl shadow-inner shrink-0 overflow-hidden relative">
            {child.photo_url ? (
              <img
                src={child.photo_url}
                alt={`${child.first_name} ${child.last_name || ""}`}
                className="w-full h-full object-cover rounded-2xl"
              />
            ) : (
              <span>{(child.first_name || "শ")[0]}</span>
            )}
          </div>
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 text-[11px] font-bold mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>নিয়মিত শিক্ষার্থী</span>
            </div>
            <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-white break-words">
              {child.first_name} {child.last_name}
            </h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-emerald-100/90 mt-1.5">
              {(child.student_id || child.student_id_formatted) && (
                <span className="inline-flex items-center gap-1 font-mono bg-white/15 px-2 py-0.5 rounded-md text-emerald-200 border border-white/20 font-bold">
                  <span>আইডি:</span>
                  <span className="text-white">
                    {child.student_id || child.student_id_formatted}
                  </span>
                </span>
              )}
              <span>
                <strong>রোল:</strong> {toBanglaNumber(child.roll_number || "-")}
              </span>
              <span>•</span>
              <span>
                <strong>জামাত:</strong> {className}
              </span>
              {child.father_name && (
                <>
                  <span className="hidden sm:inline">•</span>
                  <span className="hidden sm:inline">
                    <strong>পিতা:</strong> {child.father_name}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:flex items-center gap-2 relative z-10 shrink-0">
          <Link
            href={`/portal/attendance${studentQuerySuffix}`}
            className="min-h-[44px] px-3.5 py-2.5 bg-white/15 hover:bg-white/25 text-white rounded-xl text-xs sm:text-sm font-bold backdrop-blur-xs border border-white/20 transition flex items-center justify-center gap-2"
          >
            <Calendar className="w-4 h-4 text-emerald-300 shrink-0" />
            <span>হাজিরা রেকর্ড</span>
          </Link>
          <Link
            href={`/portal/exams${studentQuerySuffix}`}
            className="min-h-[44px] px-3.5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs sm:text-sm font-bold shadow-lg shadow-emerald-950/50 transition flex items-center justify-center gap-2"
          >
            <Award className="w-4 h-4 shrink-0" />
            <span>ফলাফল শিট</span>
          </Link>
        </div>
      </div>

      {/* Live & Upcoming Class Routine Carousel */}
      <LiveRoutineCarousel
        routines={effectiveRoutines}
        holidays={effectiveHolidays}
        variant="student"
        studentClassId={child?.class_id || null}
        fullRoutineHref={`/portal/routine${studentQuerySuffix}`}
      />

      {/* 4 KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Attendance KPI */}
        <Link
          href={`/portal/attendance${studentQuerySuffix}`}
          className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-emerald-300 transition group block"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 tracking-wide">উপস্থিতির হার</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl group-hover:scale-105 transition">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              {attendanceRate === null ? '—' : `${toBanglaNumber(attendanceRate)}%`}
            </span>
            <span
              className={`text-xs font-semibold ${
                (attendanceRate ?? 0) >= 80
                  ? "text-emerald-600"
                  : (attendanceRate ?? 0) >= 60
                  ? "text-amber-600"
                  : "text-rose-600"
              }`}
            >
              {totalDays === 0
                ? "হালনাগাদ"
                : (attendanceRate ?? 0) >= 80
                ? "সন্তোষজনক"
                : (attendanceRate ?? 0) >= 60
                ? "মোটামুটি"
                : "মনোযোগ প্রয়োজন"}
            </span>
          </div>
          <div className="w-full bg-slate-100 h-2 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(attendanceRate ?? 0, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-slate-500 mt-2 font-medium">
            <span>উপস্থিত: {toBanglaNumber(presentDays)} দিন</span>
            <span>অনুপস্থিত: {toBanglaNumber(absentDays)} দিন</span>
          </div>
        </Link>

        {/* Hifz Sabak KPI */}
        <Link
          href={`/portal/academic${studentQuerySuffix}`}
          className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-teal-300 transition group block"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 tracking-wide">
              চলমান সবক ও পাঠ
            </span>
            <div className="p-2 bg-teal-50 text-teal-600 rounded-xl group-hover:scale-105 transition">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="min-h-[38px] flex flex-col justify-center">
            <span className="text-lg sm:text-xl font-bold text-slate-900 truncate">
              {(latestHifz?.sabak_para ?? latestHifz?.para_number)
                ? `পারা: ${toBanglaNumber(latestHifz.sabak_para ?? latestHifz.para_number)}`
                : "সবক নথিভুক্ত নেই"}
            </span>
            <span className="text-xs text-slate-500 truncate">
              {latestHifz?.surah_name
                ? `সূরা: ${latestHifz.surah_name}`
                : latestHifz?.log_date || "—"}
            </span>
          </div>
          <div className="flex items-center gap-1 mt-3 text-amber-700 text-xs font-bold bg-amber-50 py-1 px-2.5 rounded-lg border border-amber-200/70 w-fit max-w-full">
            <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500 shrink-0" />
            <span className="truncate">
              মূল্যায়ন: {latestHifz?.performance_rating || latestHifz?.performance || "—"}
            </span>
          </div>
        </Link>

        {/* Fees KPI */}
        <Link
          href={`/portal/fees${studentQuerySuffix}`}
          className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-blue-300 transition group block"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 tracking-wide">পরিশোধিত ফি</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl group-hover:scale-105 transition">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              ৳ {formatBanglaCurrency(totalPaid)}
            </span>
          </div>
          <p
            className={`text-xs font-semibold mt-2 flex items-center gap-1 ${
              totalDue > 0 ? "text-rose-600" : "text-emerald-600"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>
              {totalDue > 0
                ? `বর্তমান বকেয়া: ৳ ${formatBanglaCurrency(totalDue)}`
                : "কোনো বকেয়া নেই (পরিশোধিত)"}
            </span>
          </p>
          <div className="mt-2 text-[11px] text-slate-500 font-mono truncate">
            সর্বশেষ রসিদ: {latestReceiptNo}
          </div>
        </Link>

        {/* Exam Result KPI (Live Real Data + Merit Position) */}
        <Link
          href={
            effectiveLatestExam?.examId
              ? `/portal/exams?student_id=${child.id}&exam_id=${effectiveLatestExam.examId}`
              : `/portal/exams${studentQuerySuffix}`
          }
          className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-purple-300 transition group block"
        >
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-bold text-slate-500 tracking-wide">
              সর্বশেষ পরীক্ষার ফলাফল
            </span>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl group-hover:scale-105 transition">
              <Award className="w-4 h-4" />
            </div>
          </div>
          {effectiveLatestExam && effectiveLatestExam.hasMarks ? (
            <>
              <div className="flex flex-wrap items-baseline gap-2">
                <span
                  className={`text-xl sm:text-2xl font-extrabold leading-tight ${
                    effectiveLatestExam.isPassed ? "text-purple-700" : "text-rose-700"
                  }`}
                >
                  {effectiveLatestExam.gradeLabel}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md">
                  <Trophy className="w-3 h-3 text-amber-600" />
                  <span>মেধাস্থান: {effectiveLatestExam.meritLabel}</span>
                </span>
                <span className="text-[11px] font-bold bg-purple-50 text-purple-800 border border-purple-200 px-2 py-0.5 rounded-md">
                  জিপিএ: {toBanglaNumber(effectiveLatestExam.gpa.toFixed(2))}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-2 truncate">
                {effectiveLatestExam.examTitle} • {toBanglaNumber(effectiveLatestExam.percentage)}%
              </p>
            </>
          ) : (
            <>
              <div className="text-lg font-extrabold text-slate-700 mt-1">
                প্রকাশের অপেক্ষায়
              </div>
              <p className="text-xs text-slate-500 mt-1.5">
                {effectiveLatestExam?.examTitle
                  ? `${effectiveLatestExam.examTitle}-এর নম্বর যুক্ত হলে দেখা যাবে`
                  : "কোনো প্রকাশিত পরীক্ষার ফলাফল এখনো যুক্ত হয়নি"}
              </p>
              <div className="mt-2.5 text-[11px] text-purple-600 font-bold flex items-center gap-1">
                <span>পরীক্ষার পাতায় যান</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </>
          )}
        </Link>
      </div>

      {/* Quick Action Navigation Tiles */}
      <div>
        <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-600" />
          <span>পোর্টাল দ্রুত মেনু</span>
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 sm:gap-3">
          <Link
            href={`/portal/assignments${studentQuerySuffix}`}
            className="min-h-[96px] p-3.5 bg-emerald-50/70 rounded-2xl border border-emerald-200 shadow-2xs hover:border-emerald-600 hover:shadow-md transition text-center flex flex-col items-center justify-center group"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center mb-2 group-hover:scale-105 transition shadow-xs">
              <BookOpen className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-emerald-900">আজকের পড়া</span>
            <span className="text-[10px] text-emerald-700 mt-0.5">সবক ও কাজ</span>
          </Link>

          <Link
            href={`/portal/attendance${studentQuerySuffix}`}
            className="min-h-[96px] p-3.5 bg-white rounded-2xl border border-slate-200 shadow-2xs hover:border-emerald-500 hover:shadow-md transition text-center flex flex-col items-center justify-center group"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-2 group-hover:scale-105 transition">
              <Calendar className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-800">দৈনিক হাজিরা</span>
            <span className="text-[10px] text-slate-400 mt-0.5">মাসিক উপস্থিতি</span>
          </Link>

          <Link
            href={`/portal/academic${studentQuerySuffix}`}
            className="min-h-[96px] p-3.5 bg-white rounded-2xl border border-slate-200 shadow-2xs hover:border-teal-500 hover:shadow-md transition text-center flex flex-col items-center justify-center group"
          >
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center mb-2 group-hover:scale-105 transition">
              <BookOpen className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-800">হিফজ ও পাঠ</span>
            <span className="text-[10px] text-slate-400 mt-0.5">সবক ও আমুখতা</span>
          </Link>

          <Link
            href={`/portal/exams${studentQuerySuffix}`}
            className="min-h-[96px] p-3.5 bg-white rounded-2xl border border-slate-200 shadow-2xs hover:border-purple-500 hover:shadow-md transition text-center flex flex-col items-center justify-center group"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center mb-2 group-hover:scale-105 transition">
              <Award className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-800">পরীক্ষার ফলাফল</span>
            <span className="text-[10px] text-slate-400 mt-0.5">মার্কশিট ও মেধাস্থান</span>
          </Link>

          <Link
            href={`/portal/fees${studentQuerySuffix}`}
            className="min-h-[96px] p-3.5 bg-white rounded-2xl border border-slate-200 shadow-2xs hover:border-blue-500 hover:shadow-md transition text-center flex flex-col items-center justify-center group"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center mb-2 group-hover:scale-105 transition">
              <CreditCard className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-800">ফি ও রসিদ</span>
            <span className="text-[10px] text-slate-400 mt-0.5">পেমেন্ট হিস্ট্রি</span>
          </Link>

          <Link
            href={`/portal/routine${studentQuerySuffix}`}
            className="min-h-[96px] p-3.5 bg-white rounded-2xl border border-slate-200 shadow-2xs hover:border-amber-500 hover:shadow-md transition text-center flex flex-col items-center justify-center group"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center mb-2 group-hover:scale-105 transition">
              <CalendarDays className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-800">ক্লাস রুটিন</span>
            <span className="text-[10px] text-slate-400 mt-0.5">ঘণ্টা ও বিষয়</span>
          </Link>

          <Link
            href={`/portal/leave${studentQuerySuffix}`}
            className="min-h-[96px] p-3.5 bg-white rounded-2xl border border-slate-200 shadow-2xs hover:border-rose-500 hover:shadow-md transition text-center flex flex-col items-center justify-center group col-span-2 sm:col-span-1"
          >
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center mb-2 group-hover:scale-105 transition">
              <Send className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-800">ছুটির আবেদন</span>
            <span className="text-[10px] text-slate-400 mt-0.5">বার্তা ও ছুটি</span>
          </Link>
        </div>
      </div>

      {/* Daily Lessons & Homework Highlight Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-emerald-50/40">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 bg-emerald-600 text-white rounded-xl shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                আজকের পড়া ও বাড়ির কাজ
              </h3>
              <p className="text-[11px] text-slate-500">
                শিক্ষার্থীর আজকের পাঠ্য বিষয়, সবক এবং উস্তাদের বাড়ির কাজের নির্দেশনা
              </p>
            </div>
          </div>
          <Link
            href={`/portal/assignments${studentQuerySuffix}`}
            className="min-h-[44px] sm:min-h-0 text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center justify-center gap-1 bg-white px-3.5 py-2 rounded-xl border border-emerald-200 shadow-2xs hover:bg-emerald-50 transition shrink-0"
          >
            <span>সকল পড়া ({toBanglaNumber(effectiveAssignments.length)})</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="p-4 sm:p-5">
          {todayAssignments.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {todayAssignments.slice(0, 2).map((item: any) => (
                <div
                  key={item.id}
                  className="p-4 bg-slate-50 rounded-2xl border border-slate-200 hover:border-emerald-300 transition space-y-2 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-200">
                        {item.type_bangla || "আজকের পড়া"}
                      </span>
                      {item.subject_name && (
                        <span className="text-[11px] font-semibold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                          {item.subject_name}
                        </span>
                      )}
                    </div>
                    <h4 className="font-bold text-slate-900 text-sm break-words">{item.title}</h4>
                    <p className="text-xs text-slate-600 line-clamp-2 mt-1 leading-relaxed">
                      {item.description}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                    <span className="truncate">উস্তাদ: {item.teacher_name || "নির্ধারিত উস্তাদ"}</span>
                    <Link
                      href={`/portal/assignments${studentQuerySuffix}`}
                      className="font-bold text-emerald-700 hover:underline flex items-center gap-0.5 shrink-0"
                    >
                      <span>বিস্তারিত</span>
                      <ChevronRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : effectiveAssignments.length > 0 ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <div className="flex items-center gap-2 text-slate-700 min-w-0">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="truncate">
                  সর্বশেষ পাঠ: <strong>{effectiveAssignments[0].title}</strong>
                </span>
              </div>
              <Link
                href={`/portal/assignments${studentQuerySuffix}`}
                className="font-bold text-emerald-700 hover:underline shrink-0"
              >
                পড়া দেখুন →
              </Link>
            </div>
          ) : (
            <div className="text-center py-6 text-slate-400 text-xs font-medium">
              আজকের কোনো নতুন পড়া নির্ধারিত নেই।
            </div>
          )}
        </div>
      </div>

      {/* Two Column Layout: Recent Attendance Log & Notices */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
        {/* Attendance Activity Log */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
              <h3 className="font-bold text-slate-900 text-sm sm:text-base truncate">
                সর্বশেষ হাজিরা বিবরণ
              </h3>
            </div>
            <Link
              href={`/portal/attendance${studentQuerySuffix}`}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-0.5 shrink-0"
            >
              <span>বিস্তারিত</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="p-4 sm:p-5 divide-y divide-slate-100">
            {effectiveAttendance.length > 0 ? (
              effectiveAttendance.slice(0, 5).map((record: any) => (
                <div
                  key={record.id}
                  className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`p-2 rounded-xl shrink-0 ${
                        record.status === "Present"
                          ? "bg-emerald-50 text-emerald-600"
                          : record.status === "Absent"
                          ? "bg-red-50 text-red-600"
                          : "bg-amber-50 text-amber-600"
                      }`}
                    >
                      {record.status === "Present" ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : record.status === "Absent" ? (
                        <XCircle className="w-4 h-4" />
                      ) : (
                        <Clock className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-slate-800 truncate">
                        {mounted ? formatBanglaDateSafe(record.date) : String(record.date || "").slice(0, 10)}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate">
                        {record.notes ? `মন্তব্য: ${record.notes}` : "স্বাভাবিক হাজিরা"}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-bold shrink-0 ${
                      record.status === "Present"
                        ? "bg-emerald-100 text-emerald-800"
                        : record.status === "Absent"
                        ? "bg-red-100 text-red-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {record.status === "Present"
                      ? "উপস্থিত"
                      : record.status === "Absent"
                      ? "অনুপস্থিত"
                      : record.status === "Late"
                      ? "বিলম্ব"
                      : "ছুটি"}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center py-6 text-slate-400 text-xs font-medium">
                কোনো সাম্প্রতিক হাজিরার তথ্য পাওয়া যায়নি।
              </div>
            )}
          </div>
        </div>

        {/* Notices & Announcements */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Bell className="w-4 h-4 text-indigo-600 shrink-0" />
              <h3 className="font-bold text-slate-900 text-sm sm:text-base truncate">
                মাদরাসা নোটিশ ও ঘোষণা
              </h3>
            </div>
            <Link
              href={`/portal/notices${studentQuerySuffix}`}
              className="text-xs font-bold text-indigo-700 hover:text-indigo-800 flex items-center gap-0.5 shrink-0"
            >
              <span>সকল নোটিশ</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="p-4 sm:p-5 space-y-3">
            {effectiveNotices.length > 0 ? (
              effectiveNotices.map((n: any) => (
                <div
                  key={n.id}
                  className="p-3.5 bg-slate-50 hover:bg-indigo-50/40 rounded-xl border border-slate-200 transition space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 truncate">
                      {n.category || "সাধারণ নোটিশ"}
                    </span>
                    <span className="text-[11px] text-slate-400 shrink-0">
                      {mounted && n.created_at
                        ? formatBanglaDateSafe(n.created_at)
                        : n.created_at
                        ? String(n.created_at).slice(0, 10)
                        : "-"}
                    </span>
                  </div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-800 break-words">
                    {n.title}
                  </h4>
                  <p className="text-xs text-slate-500 line-clamp-2">{n.content}</p>
                </div>
              ))
            ) : (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-center text-xs text-slate-500">
                বর্তমানে কোনো নতুন নোটিশ নেই।
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
