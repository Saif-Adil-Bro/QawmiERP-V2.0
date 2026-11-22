"use client";
import {attendanceStats} from '@/lib/portal/rules';

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  CalendarCheck,
} from "lucide-react";
import { toBanglaNumber } from "@/lib/numberToBangla";
import { useOfflinePortalSnapshot } from "@/hooks/useOfflinePortalData";

interface PortalAttendanceClientProps {
  students: any[];
  child: any;
  attendanceLogs: any[];month?:string;
}

type AttendanceFilter = "all" | "Present" | "Absent" | "Other";

function formatBanglaAttendanceDate(dateStr?: string | null): string {
  if (!dateStr) return "-";
  try {
    const clean = String(dateStr).slice(0, 10);
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
    return clean;
  } catch {
    return String(dateStr).slice(0, 10);
  }
}

export default function PortalAttendanceClient({
  students,
  child,
  attendanceLogs,month,
}: PortalAttendanceClientProps) {
  const offlineSnapshot = useOfflinePortalSnapshot();
  const [filter, setFilter] = useState<AttendanceFilter>("all");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);



  const effectiveLogs=offlineSnapshot && offlineSnapshot.activeStudent?.id===child.id ? offlineSnapshot.attendance.filter(a=>!month || a.date.startsWith(month)) : attendanceLogs;
  const {total:totalDays,present:presentDays,absent:absentDays,late:lateDays,leave:leaveDays,percentage:attendancePercentage} = attendanceStats(effectiveLogs);
  const filteredLogs = useMemo(() => {
    if (filter === "all") return effectiveLogs;
    if (filter === "Present") return effectiveLogs.filter((l: any) => l.status === "Present");
    if (filter === "Absent") return effectiveLogs.filter((l: any) => l.status === "Absent");
    return effectiveLogs.filter((l: any) => l.status === "Late" || l.status === "Leave");
  }, [effectiveLogs, filter]);

  const getStatusBadge = (status: string) => {
    if (status === "Present") {
      return {
        label: "উপস্থিত",
        classes: "bg-emerald-100 text-emerald-800",
        icon: <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />,
      };
    }
    if (status === "Absent") {
      return {
        label: "অনুপস্থিত",
        classes: "bg-red-100 text-red-800",
        icon: <XCircle className="w-3.5 h-3.5 shrink-0" />,
      };
    }
    if (status === "Late") {
      return {
        label: "বিলম্ব",
        classes: "bg-amber-100 text-amber-800",
        icon: <Clock className="w-3.5 h-3.5 shrink-0" />,
      };
    }
    return {
      label: "ছুটি",
      classes: "bg-blue-100 text-blue-800",
      icon: <Clock className="w-3.5 h-3.5 shrink-0" />,
    };
  };

  return (
    <div className="space-y-5 sm:space-y-6 w-full max-w-full overflow-x-hidden">
      {/* Header Banner */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          {child.photo_url ? (
            <img
              src={child.photo_url}
              alt=""
              className="w-12 h-12 rounded-xl object-cover border border-emerald-200 shrink-0 shadow-2xs"
            />
          ) : (
            <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl shrink-0">
              <CalendarCheck className="w-5 h-5" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-bold text-slate-900">
              দৈনিক হাজিরা রেকর্ড ও উপস্থিতি
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>
                শিক্ষার্থী:{" "}
                <strong className="text-slate-800">
                  {child.first_name} {child.last_name}
                </strong>
              </span>
              {(child.student_id || child.student_id_formatted) && (
                <span className="font-mono bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-xs border border-emerald-200 font-bold">
                  আইডি: {child.student_id || child.student_id_formatted}
                </span>
              )}
              <span>(রোল: {toBanglaNumber(child.roll_number || "-")})</span>
            </p>
          </div>
        </div>

        {students.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            {students.map((s: any) => (
              <Link
                key={s.id}
                href={`/portal/attendance?student_id=${s.id}${month ? `&month=${month}` : ''}`}
                className={`min-h-[44px] sm:min-h-0 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 shrink-0 ${
                  s.id === child.id
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
                }`}
              >
                <span>
                  {s.first_name} {s.last_name || ""}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-slate-500">মোট কার্যদিবস</p>
            <p className="text-lg sm:text-2xl font-bold text-slate-900">
              {toBanglaNumber(totalDays)} দিন
            </p>
          </div>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-emerald-600">উপস্থিত</p>
            <p className="text-lg sm:text-2xl font-bold text-emerald-700">
              {toBanglaNumber(presentDays)} দিন
            </p>
          </div>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-2.5 bg-red-50 text-red-600 rounded-xl shrink-0">
            <XCircle className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-red-600">অনুপস্থিত</p>
            <p className="text-lg sm:text-2xl font-bold text-red-700">
              {toBanglaNumber(absentDays)} দিন
            </p>
          </div>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-amber-600">বিলম্ব / ছুটি</p>
            <p className="text-lg sm:text-2xl font-bold text-amber-700">
              {toBanglaNumber(lateDays + leaveDays)} দিন
            </p>
          </div>
        </div>

        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3 col-span-2 lg:col-span-1">
          <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-purple-600">উপস্থিতির হার</p>
            <p className="text-lg sm:text-2xl font-bold text-purple-800">
              {attendancePercentage === null ? '—' : `${toBanglaNumber(attendancePercentage)}%`}
            </p>
          </div>
        </div>
      </div>

      {/* Attendance Log Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">
              দৈনিক হাজিরার বিস্তারিত তালিকা
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">সর্বশেষ তারিখ সবার উপরে প্রদর্শিত</p>
          </div>

          {/* Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {(
              [
                { key: "all", label: `সকল (${toBanglaNumber(totalDays)})` },
                { key: "Present", label: `উপস্থিত (${toBanglaNumber(presentDays)})` },
                { key: "Absent", label: `অনুপস্থিত (${toBanglaNumber(absentDays)})` },
                { key: "Other", label: `বিলম্ব/ছুটি (${toBanglaNumber(lateDays + leaveDays)})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilter(tab.key)}
                className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition shrink-0 ${
                  filter === tab.key
                    ? "bg-emerald-700 text-white shadow-2xs"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Mobile Stacked Cards (< 768px) */}
        <div className="md:hidden divide-y divide-slate-100">
          {filteredLogs.length > 0 ? (
            filteredLogs.map((log: any) => {
              const badge = getStatusBadge(log.status);
              return (
                <div key={log.id} className="p-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800 break-words">
                      {mounted
                        ? formatBanglaAttendanceDate(log.date)
                        : String(log.date || "").slice(0, 10)}
                    </p>
                    <p className="text-xs text-slate-500 mt-1 break-words">
                      {log.notes ? `মন্তব্য: ${log.notes}` : "কোনো বিশেষ মন্তব্য নেই"}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold shrink-0 ${badge.classes}`}
                  >
                    {badge.icon}
                    <span>{badge.label}</span>
                  </span>
                </div>
              );
            })
          ) : (
            <div className="text-center py-10 px-4 text-slate-400 text-sm">
              কোনো হাজিরার রেকর্ড পাওয়া যায়নি।
            </div>
          )}
        </div>

        {/* Desktop Table (>= 768px) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 tracking-wider">
                <th className="px-4 py-3.5">তারিখ ও বার</th>
                <th className="px-4 py-3.5">অবস্থা</th>
                <th className="px-4 py-3.5">মন্তব্য</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredLogs.length > 0 ? (
                filteredLogs.map((log: any) => {
                  const badge = getStatusBadge(log.status);
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/60 transition">
                      <td className="px-4 py-3 font-semibold text-slate-800">
                        {mounted
                          ? formatBanglaAttendanceDate(log.date)
                          : String(log.date || "").slice(0, 10)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${badge.classes}`}
                        >
                          {badge.icon}
                          <span>{badge.label}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{log.notes || "-"}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={3} className="text-center py-10 text-slate-400 text-sm">
                    কোনো হাজিরার রেকর্ড পাওয়া যায়নি।
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
