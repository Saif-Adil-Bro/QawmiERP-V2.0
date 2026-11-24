"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  Users,
  GraduationCap,
  BookOpen,
  UserCheck,
  TrendingUp,
  TrendingDown,
  Wallet,
  Calendar,
  Clock,
  CheckSquare,
  ArrowUpRight,
  Banknote,
  Building2,
  ShieldCheck,
  Puzzle,
} from "lucide-react";
import { toBanglaNumber, formatBanglaCurrency } from "@/lib/numberToBangla";
import CustomWidgetFrame from "@/components/widgets/CustomWidgetFrame";
import {
  PrayerHijriWidget,
  QuickActionsWidget,
} from "@/components/widgets/BuiltinExtraWidgets";
import { DEFAULT_BUILTIN_WIDGETS } from "@/lib/widgets/registry";
import type { ErpWidgetBridgeData, WidgetConfigItem } from "@/lib/widgets/types";

export interface PremiumDashboardClientProps {
  profile: {
    full_name?: string | null;
    role?: string | null;
    madrasa_name?: string | null;
  };
  stats: {
    studentsCount: number;
    teachersCount: number;
    classesCount: number;
    todayPresent: number;
    todayAbsent: number;
    todayIncome: number;
    todayExpense: number;
    totalIncome: number;
    fundBalance: number;
    totalExpense: number;
    expensesSum: number;
    bazarSum: number;
  };
  widgets?: WidgetConfigItem[];
  errorMessage?: string | null;
  hifzSummaryNode?: React.ReactNode;
  sickStudentsNode?: React.ReactNode;
  showFinance?:boolean;
  earlyWarningNode: React.ReactNode;
  anomalyBannerNode?: React.ReactNode;
  chartsNode: React.ReactNode;
}

const ROLE_LABELS_BN: Record<string, string> = {
  super_admin: "সুপার এডমিন",
  admin: "এডমিন",
  muhtamim: "মুহতামিম",
  accountant: "হিসাবরক্ষক",
  teacher: "উস্তাদ / শিক্ষক",
};

export default function PremiumDashboardClient({
  profile,
  stats,
  widgets,
  errorMessage,
  hifzSummaryNode,showFinance=true,
  sickStudentsNode,
  earlyWarningNode,
  anomalyBannerNode,
  chartsNode,
}: PremiumDashboardClientProps) {
  const [financeScope, setFinanceScope] = useState<"total" | "today">("total");
  const [timeStr, setTimeStr] = useState<string>("");
  const [dateStr, setDateStr] = useState<string>("");

  const bridgeData: ErpWidgetBridgeData = {
    madrasaName: profile.madrasa_name,
    studentsCount: stats.studentsCount,
    teachersCount: stats.teachersCount,
    classesCount: stats.classesCount,
    todayPresent: stats.todayPresent,
    todayAbsent: stats.todayAbsent,
    todayIncome: stats.todayIncome,
    todayExpense: stats.todayExpense,
    totalIncome: stats.totalIncome,
    totalExpense: stats.totalExpense,
  };

  const activeWidgets = (
    widgets && widgets.length > 0 ? widgets : DEFAULT_BUILTIN_WIDGETS
  ).filter((w) => w.enabled);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setDateStr(
        new Intl.DateTimeFormat("bn-BD", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
          timeZone: "Asia/Dhaka",
        }).format(now)
      );
      setTimeStr(
        new Intl.DateTimeFormat("bn-BD", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
          timeZone: "Asia/Dhaka",
        }).format(now)
      );
    };
    updateClock();
    const timer = setInterval(updateClock, 30000);
    return () => clearInterval(timer);
  }, []);

  const totalMarkedToday = stats.todayPresent + stats.todayAbsent;
  const attendancePercent =
    totalMarkedToday > 0
      ? Math.round((stats.todayPresent / totalMarkedToday) * 100)
      : stats.studentsCount > 0 && stats.todayPresent > 0
      ? Math.min(100, Math.round((stats.todayPresent / stats.studentsCount) * 100))
      : 0;

  const activeIncome =
    financeScope === "today" ? stats.todayIncome : stats.totalIncome;
  const activeExpense =
    financeScope === "today" ? stats.todayExpense : stats.totalExpense;
  const operatingNet = activeIncome - activeExpense;
  const netBalance = financeScope === "today" ? operatingNet : stats.fundBalance;
  const savingsRate =
    activeIncome > 0 ? Math.round((operatingNet / activeIncome) * 100) : 0;

  const roleKey = (profile.role || "super_admin").toLowerCase();
  const displayRole =
    ROLE_LABELS_BN[roleKey] || (profile.role ? profile.role.replace("_", " ") : "সুপার এডমিন");

  return (
    <div className="space-y-6 pb-8">
      {/* 1. Contextual Hero Welcome Banner */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm p-5 sm:p-7"
      >
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300 font-medium">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700">
                <Building2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="font-semibold text-slate-800 dark:text-slate-100">
                  {profile.madrasa_name || "আপনার মাদরাসা"}
                </span>
              </span>
              {dateStr && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>{dateStr}</span>
                </span>
              )}
              {timeStr && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 tabular-nums">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  <span>{timeStr}</span>
                </span>
              )}
            </div>

            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                আস-সালামু আলাইকুম, {profile.full_name || "এডমিন"}
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 flex flex-wrap items-center gap-1.5">
                <span>প্রাতিষ্ঠানিক ও আর্থিক কার্যক্রমের রিয়েল-টাইম সারসংক্ষেপ।</span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200/70 dark:border-emerald-500/20">
                  <ShieldCheck className="w-3 h-3" />
                  {displayRole}
                </span>
              </p>
            </div>
          </div>

          {/* Interactive Quick Actions */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Link
              href="/dashboard/attendance/students"
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition active:scale-95 flex items-center gap-2"
            >
              <CheckSquare className="w-4 h-4" />
              <span>হাজিরা গ্রহণ</span>
            </Link>
            <Link
              href="/dashboard/assignments"
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700 text-xs sm:text-sm font-bold rounded-xl transition active:scale-95 flex items-center gap-2"
            >
              <BookOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>দৈনিক পড়া ও অ্যাসাইনমেন্ট</span>
            </Link>
            <Link
              href="/dashboard/accounting/fees"
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700 text-xs sm:text-sm font-bold rounded-xl transition active:scale-95 flex items-center gap-2"
            >
              <Banknote className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>ফি আদায়</span>
            </Link>
            <Link
              href="/dashboard/settings/widgets"
              className="px-3.5 py-2.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800 text-xs sm:text-sm font-bold rounded-xl transition active:scale-95 flex items-center gap-2"
            >
              <Puzzle className="w-4 h-4" />
              <span>উইজেট ম্যানেজ</span>
            </Link>
          </div>
        </div>
      </motion.section>

      {errorMessage && (
        <div className="bg-rose-50 dark:bg-rose-950/40 p-4 rounded-xl border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-sm">
          ডাটাবেস কানেকশন সমস্যা।
          <br />
          Error: {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {activeWidgets.map((w) => {
          const spanClass = w.size === "full" ? "lg:col-span-2" : "lg:col-span-1";

          if (w.type === "custom") {
            return (
              <div key={w.id} className={spanClass}>
                <CustomWidgetFrame widget={w} bridgeData={bridgeData} />
              </div>
            );
          }
          if (w.id === "builtin-hifz-tracker") {
            return hifzSummaryNode ? <div key={w.id} className={spanClass}>{hifzSummaryNode}</div> : null;
          }
          if (w.id === "builtin-sick-students") return sickStudentsNode ? <div key={w.id} className={spanClass}>{sickStudentsNode}</div> : null;
          if (w.id === "builtin-early-warning") {
            return (
              <div key={w.id} className={spanClass}>
                {earlyWarningNode}
              </div>
            );
          }
          if (w.id === "builtin-anomalies") {
            return anomalyBannerNode ? (
              <div key={w.id} className={spanClass}>
                {anomalyBannerNode}
              </div>
            ) : null;
          }
          if (w.id === "builtin-charts") {
            return (
              <div key={w.id} className={spanClass}>
                {chartsNode}
              </div>
            );
          }
          if (w.id === "builtin-prayer-hijri") {
            return (
              <div key={w.id} className={spanClass}>
                <PrayerHijriWidget />
              </div>
            );
          }
          if (w.id === "builtin-quick-actions") {
            return (
              <div key={w.id} className={spanClass}>
                <QuickActionsWidget />
              </div>
            );
          }
          if (w.id === "builtin-kpi") {
            return (
              <div key={w.id} className={spanClass}>
                {/* 3. Academic & Attendance KPI Cards */}
                <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            প্রাতিষ্ঠানিক ও আর্থিক সারসংক্ষেপ
          </h2>

          {/* Interactive Finance Scope Toggle */}
          {showFinance && <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700 text-xs">
            <button
              type="button"
              onClick={() => setFinanceScope("total")}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                financeScope === "total"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              সর্বমোট হিসাব
            </button>
            <button
              type="button"
              onClick={() => setFinanceScope("today")}
              className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                financeScope === "today"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              আজকের লেনদেন
            </button>
          </div>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Students */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.04 }}
          >
            <Link
              href="/dashboard/students"
              className="group block bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:border-emerald-500/50 dark:hover:border-emerald-500/50 shadow-sm hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    মোট শিক্ষার্থী
                  </p>
                  <p className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1.5 tabular-nums">
                    {toBanglaNumber(stats.studentsCount)}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Users className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                  নিবন্ধিত ছাত্র তালিকা
                </span>
                <span className="text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 flex items-center gap-0.5 transition-colors">
                  দেখুন <ArrowUpRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </Link>
          </motion.div>

          {/* Teachers & Staff */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.08 }}
          >
            <Link
              href="/dashboard/staff"
              className="group block bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:border-sky-500/50 dark:hover:border-sky-500/50 shadow-sm hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    মোট শিক্ষক ও স্টাফ
                  </p>
                  <p className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1.5 tabular-nums">
                    {toBanglaNumber(stats.teachersCount)}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <GraduationCap className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400 font-medium">
                  উস্তাদ ও কর্মকর্তা
                </span>
                <span className="text-slate-400 group-hover:text-sky-600 dark:group-hover:text-sky-400 flex items-center gap-0.5 transition-colors">
                  পরিচালনা <ArrowUpRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </Link>
          </motion.div>

          {/* Active Classes */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.12 }}
          >
            <Link
              href="/dashboard/classes"
              className="group block bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:border-amber-500/50 dark:hover:border-amber-500/50 shadow-sm hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    সক্রিয় জামাত (ক্লাস)
                  </p>
                  <p className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1.5 tabular-nums">
                    {toBanglaNumber(stats.classesCount)}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <BookOpen className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400 font-medium">
                  চলমান শিক্ষাবর্ষের বিভাগ
                </span>
                <span className="text-slate-400 group-hover:text-amber-600 dark:group-hover:text-amber-400 flex items-center gap-0.5 transition-colors">
                  বিস্তারিত <ArrowUpRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </Link>
          </motion.div>

          {/* Today Attendance */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.16 }}
          >
            <Link
              href="/dashboard/attendance/students"
              className="group block bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:border-teal-500/50 dark:hover:border-teal-500/50 shadow-sm hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    আজকের উপস্থিতি
                  </p>
                  <p className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1.5 tabular-nums">
                    {toBanglaNumber(stats.todayPresent)}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <UserCheck className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                    হার: {toBanglaNumber(attendancePercent)}%
                  </span>
                  <span className="text-rose-500 font-semibold">
                    অনুপস্থিত: {toBanglaNumber(stats.todayAbsent)}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${attendancePercent}%` }}
                  />
                </div>
              </div>
            </Link>
          </motion.div>
        </div>

        {/* 4. Financial Highlight Strip (3 Columns) */}
        {showFinance && <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Income */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            <Link
              href="/dashboard/accounting/income"
              className="group block bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:border-emerald-500/50 shadow-sm hover:shadow-md transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {financeScope === "today"
                    ? "আজকের মোট আয়"
                    : "মোট আয় (ফান্ড কালেকশন)"}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                  <TrendingUp className="w-3 h-3" />
                  আয়
                </span>
              </div>
              <p className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-2 tabular-nums">
                ৳ {formatBanglaCurrency(activeIncome)}
              </p>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>
                  {financeScope === "today"
                    ? "আজকের ফি ও অনুদান সংগ্রহ"
                    : `আজকের কালেকশন: ৳ ${formatBanglaCurrency(stats.todayIncome)}`}
                </span>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                  হিস্ট্রি <ArrowUpRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </Link>
          </motion.div>

          {/* Expense */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.24 }}
          >
            <Link
              href="/dashboard/accounting/expenses"
              className="group block bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:border-rose-500/50 shadow-sm hover:shadow-md transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {financeScope === "today"
                    ? "আজকের মোট ব্যয়"
                    : "মোট ব্যয় (বোর্ডিং বাজার সহ)"}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400">
                  <TrendingDown className="w-3 h-3" />
                  ব্যয়
                </span>
              </div>
              <p className="text-2xl sm:text-3xl font-extrabold text-rose-600 dark:text-rose-400 mt-2 tabular-nums">
                ৳ {formatBanglaCurrency(activeExpense)}
              </p>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 truncate">
                {financeScope === "today" ? (
                  <span>আজকের সাধারণ ও বাজার খরচ</span>
                ) : stats.bazarSum > 0 ? (
                  <span>
                    বাজার: ৳ {formatBanglaCurrency(stats.bazarSum)} • সাধারণ: ৳{" "}
                    {formatBanglaCurrency(stats.expensesSum)}
                  </span>
                ) : (
                  <span>সর্বমোট প্রাতিষ্ঠানিক খরচ</span>
                )}
              </div>
            </Link>
          </motion.div>

          {/* Net Balance */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.28 }}
          >
            <Link
              href="/dashboard/accounting"
              className="group block bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:border-sky-500/50 shadow-sm hover:shadow-md transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {financeScope === "today"
                    ? "আজকের নিট উদ্বৃত্ত"
                    : "জার্নালসহ মোট ফান্ড স্থিতি"}
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    netBalance >= 0
                      ? "bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400"
                      : "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400"
                  }`}
                >
                  <Wallet className="w-3 h-3" />
                  {netBalance >= 0 ? "উদ্বৃত্ত" : "ঘাটতি"}
                </span>
              </div>
              <p data-finance-balance={netBalance}
                className={`text-2xl sm:text-3xl font-extrabold mt-2 tabular-nums ${
                  netBalance >= 0
                    ? "text-sky-600 dark:text-sky-400"
                    : "text-amber-600 dark:text-amber-400"
                }`}
              >
                ৳ {formatBanglaCurrency(Math.abs(netBalance))}
              </p>
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>
                  {activeIncome > 0
                    ? `আয়-ব্যয় অনুপাত: ${toBanglaNumber(savingsRate)}%`
                    : "আর্থিক সার্বিক অবস্থা"}
                </span>
                <span className="text-sky-600 dark:text-sky-400 font-semibold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                  অ্যাকাউন্টিং <ArrowUpRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </Link>
          </motion.div>
        </div>}
        </section>
              </div>
            );
          }
          return null;
        })}
      </div>

      {/* Quick Intelligence Links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link
          href="/dashboard/analytics/executive-bi"
          className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/30 border border-emerald-200/80 dark:border-emerald-800/60 hover:border-emerald-400 transition group"
        >
          <div>
            <p className="text-xs font-extrabold text-emerald-900 dark:text-emerald-200">
              এক্সিকিউটিভ BI ও ডাইজেস্ট রিপোর্ট
            </p>
            <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
              বোর্ডিং, যাকাত, বকেয়া অনুপাত ও সেশন তুলনা
            </p>
          </div>
          <ArrowUpRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400 group-hover:translate-x-0.5 transition-transform" />
        </Link>

        <Link
          href="/dashboard/approvals"
          className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/30 border border-amber-200/80 dark:border-amber-800/60 hover:border-amber-400 transition group"
        >
          <div>
            <p className="text-xs font-extrabold text-amber-900 dark:text-amber-200">
              অনুমোদন ওয়ার্কফ্লো সেন্টার
            </p>
            <p className="text-[11px] text-amber-700 dark:text-amber-400">
              বড় খরচ, ফি মওকুফ ও রেজাল্ট অনুমোদন দেখুন
            </p>
          </div>
          <ArrowUpRight className="w-4 h-4 text-amber-600 dark:text-amber-400 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    </div>
  );
}
