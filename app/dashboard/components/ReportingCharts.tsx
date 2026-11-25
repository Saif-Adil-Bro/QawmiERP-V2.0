"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  CalendarCheck,
  CalendarDays,
  ArrowRight,
  BarChart3,
  TrendingUp,
  Award,
} from "lucide-react";
import { toBanglaNumber, formatBanglaCurrency } from "@/lib/numberToBangla";

const STATUS_COLORS: Record<string, string> = {
  উপস্থিত: "#10b981", // Emerald green
  অনুপস্থিত: "#f43f5e", // Rose red
  ছুটি: "#f59e0b", // Amber orange
  বিলম্ব: "#0ea5e9", // Sky blue
  "হাজিরা বাকি": "#94a3b8", // Slate 400
};

interface ReportingChartsProps {
  incomeExpenseData: any[];
  attendanceData: any[];
  todayAttendanceData?: any[];
  examPassRateData: any[];
}

function CustomFinanceTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  const income = Number(payload.find((p: any) => p.dataKey === "income")?.value || 0);
  const expense = Number(payload.find((p: any) => p.dataKey === "expense")?.value || 0);
  const net = income - expense;

  return (
    <div className="rounded-xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-700 shadow-lg p-3 text-xs space-y-1.5 min-w-[180px]">
      <p className="font-bold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-1">
        মাস: {label}
      </p>
      <div className="flex items-center justify-between gap-4">
        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">আয়:</span>
        <span className="font-bold text-slate-900 dark:text-white tabular-nums">
          ৳ {formatBanglaCurrency(income)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-rose-600 dark:text-rose-400 font-semibold">ব্যয়:</span>
        <span className="font-bold text-slate-900 dark:text-white tabular-nums">
          ৳ {formatBanglaCurrency(expense)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-4 pt-1 border-t border-slate-100 dark:border-slate-800">
        <span className="text-sky-600 dark:text-sky-400 font-semibold">
          {net >= 0 ? "উদ্বৃত্ত:" : "ঘাটতি:"}
        </span>
        <span
          className={`font-extrabold tabular-nums ${
            net >= 0
              ? "text-sky-600 dark:text-sky-400"
              : "text-amber-600 dark:text-amber-400"
          }`}
        >
          ৳ {formatBanglaCurrency(Math.abs(net))}
        </span>
      </div>
    </div>
  );
}

export default function ReportingCharts({
  incomeExpenseData,
  attendanceData,
  todayAttendanceData = [],
  examPassRateData,
}: ReportingChartsProps) {
  const hasTodayData = todayAttendanceData && todayAttendanceData.length > 0;
  const has30DaysData = attendanceData && attendanceData.length > 0;
  const [attendanceView, setAttendanceView] = useState<"today" | "30days">(
    hasTodayData ? "today" : has30DaysData ? "30days" : "today"
  );
  const [financeChartType, setFinanceChartType] = useState<"bar" | "area">("bar");

  const activeAttendanceData =
    attendanceView === "today" ? todayAttendanceData || [] : attendanceData || [];

  const totalAttendanceCount = activeAttendanceData.reduce(
    (acc, curr) => acc + (Number(curr.value) || 0),
    0
  );
  const presentEntry = activeAttendanceData.find((d: any) => d.name === "উপস্থিত");
  const presentPercentage =
    totalAttendanceCount > 0 && presentEntry
      ? Math.round((Number(presentEntry.value) / totalAttendanceCount) * 100)
      : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 1. Monthly Income vs Expense Chart */}
      <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm col-span-1 lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h3 className="text-slate-900 dark:text-white font-bold text-base sm:text-lg">
              মাসিক আয়-ব্যয় বিশ্লেষণ (Monthly Income vs Expense)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              বিগত ৬ মাসের আর্থিক প্রবাহ ও উদ্বৃত্তের তুলনামূলক চিত্র
            </p>
          </div>

          {/* Chart Type Switcher */}
          <div className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-xs">
            <button
              type="button"
              onClick={() => setFinanceChartType("bar")}
              className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
                financeChartType === "bar"
                  ? "bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>বার চার্ট</span>
            </button>
            <button
              type="button"
              onClick={() => setFinanceChartType("area")}
              className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
                financeChartType === "area"
                  ? "bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>এরিয়া ট্রেন্ড</span>
            </button>
          </div>
        </div>

        <div className="h-80">
          {incomeExpenseData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              {financeChartType === "bar" ? (
                <BarChart
                  data={incomeExpenseData}
                  margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#94a3b8"
                    strokeOpacity={0.2}
                  />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#64748b", fontSize: 12 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#64748b", fontSize: 12 }}
                    tickFormatter={(value) => `৳${toBanglaNumber(value)}`}
                  />
                  <RechartsTooltip
                    cursor={{ fill: "rgba(148, 163, 184, 0.12)" }}
                    content={<CustomFinanceTooltip />}
                  />
                  <Legend wrapperStyle={{ paddingTop: "16px", fontSize: "12px" }} />
                  <Bar
                    dataKey="income"
                    name="আয় (Income)"
                    fill="#10b981"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={44}
                  />
                  <Bar
                    dataKey="expense"
                    name="ব্যয় (Expense)"
                    fill="#f43f5e"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={44}
                  />
                </BarChart>
              ) : (
                <AreaChart
                  data={incomeExpenseData}
                  margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                >
                  <defs>
                    <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#94a3b8"
                    strokeOpacity={0.2}
                  />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#64748b", fontSize: 12 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#64748b", fontSize: 12 }}
                    tickFormatter={(value) => `৳${toBanglaNumber(value)}`}
                  />
                  <RechartsTooltip content={<CustomFinanceTooltip />} />
                  <Legend wrapperStyle={{ paddingTop: "16px", fontSize: "12px" }} />
                  <Area
                    type="monotone"
                    dataKey="income"
                    name="আয় (Income)"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#incomeGrad)"
                  />
                  <Area
                    type="monotone"
                    dataKey="expense"
                    name="ব্যয় (Expense)"
                    stroke="#f43f5e"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#expenseGrad)"
                  />
                </AreaChart>
              )}
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
              মাসিক আয়-ব্যয়ের পর্যাপ্ত ডেটা এখনো যুক্ত হয়নি
            </div>
          )}
        </div>
      </div>

      {/* 2. Attendance Rate Donut */}
      <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <div>
              <h3 className="text-slate-900 dark:text-white font-bold text-base sm:text-lg">
                উপস্থিতির হার (Attendance Rate)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {attendanceView === "today"
                  ? "আজকের সার্বিক শিক্ষার্থীর বাস্তব হাজিরা অনুপাত"
                  : "বিগত ৩০ দিনের সার্বিক শিক্ষার্থীর মোট হাজিরা অনুপাত"}
              </p>
            </div>

            {/* Toggle between Today and 30 Days */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => setAttendanceView("today")}
                className={`px-3 py-1 rounded-lg font-semibold transition cursor-pointer ${
                  attendanceView === "today"
                    ? "bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 font-bold shadow-xs"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                আজকের দিন
              </button>
              <button
                type="button"
                onClick={() => setAttendanceView("30days")}
                className={`px-3 py-1 rounded-lg font-semibold transition cursor-pointer ${
                  attendanceView === "30days"
                    ? "bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 font-bold shadow-xs"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                বিগত ৩০ দিন
              </button>
            </div>
          </div>

          <div className="h-64 flex justify-center items-center relative">
            {activeAttendanceData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={activeAttendanceData}
                      cx="50%"
                      cy="50%"
                      innerRadius={62}
                      outerRadius={86}
                      paddingAngle={4}
                      dataKey="value"
                      stroke="none"
                    >
                      {activeAttendanceData.map((entry: any, index: number) => {
                        const color = STATUS_COLORS[entry.name] || "#64748b";
                        return <Cell key={`cell-${index}`} fill={color} />;
                      })}
                    </Pie>
                    <RechartsTooltip
                      contentStyle={{
                        borderRadius: "12px",
                        border: "1px solid rgba(148,163,184,0.3)",
                        fontSize: "12px",
                      }}
                      formatter={(value: number, name: string) => [
                        `${toBanglaNumber(value)} জন ${
                          attendanceView === "today" ? "শিক্ষার্থী" : "রেকর্ড"
                        }`,
                        name,
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center KPI Overlay */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums">
                    {toBanglaNumber(presentPercentage)}%
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    উপস্থিত
                  </span>
                </div>
              </>
            ) : attendanceView === "today" ? (
              <div className="text-center p-6 space-y-2">
                <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                  <CalendarCheck className="w-6 h-6" />
                </div>
                <p className="text-slate-800 dark:text-slate-100 font-semibold text-sm">
                  আজকের হাজিরা এখনো গ্রহণ করা হয়নি
                </p>
                <p className="text-slate-500 dark:text-slate-400 text-xs max-w-xs mx-auto">
                  শিক্ষক বা এডমিন আজকের হাজিরা গ্রহণ করলে এখানে তাৎক্ষণিক বাস্তব অনুপাত প্রদর্শিত হবে।
                </p>
                <div className="pt-2">
                  <Link
                    href="/dashboard/attendance/students"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
                  >
                    <span>আজকের হাজিরা গ্রহণ করুন</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="text-center p-6 space-y-2">
                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                  <CalendarDays className="w-6 h-6" />
                </div>
                <p className="text-slate-700 dark:text-slate-200 font-semibold text-sm">
                  বিগত ৩০ দিনে কোনো হাজিরার রেকর্ড নেই
                </p>
                <p className="text-slate-400 text-xs max-w-xs mx-auto">
                  হাজিরা গ্রহণের পর চার্টে স্বয়ংক্রিয়ভাবে বাস্তব উপস্থিতি ও ছুটির পরিসংখ্যান প্রদর্শিত হবে।
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Dynamic Summary Badges below the chart */}
        {activeAttendanceData.length > 0 && (
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-center flex-wrap gap-3 text-xs">
            {activeAttendanceData.map((item: any, idx: number) => {
              const color = STATUS_COLORS[item.name] || "#64748b";
              const percent =
                totalAttendanceCount > 0
                  ? ((item.value / totalAttendanceCount) * 100).toFixed(0)
                  : 0;
              return (
                <div
                  key={idx}
                  className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/70 px-2.5 py-1 rounded-lg border border-slate-200/60 dark:border-slate-700/60"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span>{item.name}:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {toBanglaNumber(item.value)}
                  </span>
                  <span className="text-slate-400">({toBanglaNumber(percent)}%)</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Exam Pass Rate Smooth Area Chart */}
      <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div>
            <h3 className="text-slate-900 dark:text-white font-bold text-base sm:text-lg">
              পরীক্ষার পাসের হার (Exam Pass Rate)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              সাম্প্রতিক পরীক্ষাসমূহের গড় সাফল্যের ধারা
            </p>
          </div>
          <div className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
            <Award className="w-5 h-5" />
          </div>
        </div>

        <div className="h-64">
          {examPassRateData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={examPassRateData}
                margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
              >
                <defs>
                  <linearGradient id="passRateGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#94a3b8"
                  strokeOpacity={0.2}
                />
                <XAxis
                  dataKey="exam"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#64748b", fontSize: 12 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  domain={[0, 100]}
                  tick={{ fill: "#64748b", fontSize: 12 }}
                  tickFormatter={(val) => `${toBanglaNumber(val)}%`}
                />
                <RechartsTooltip
                  contentStyle={{
                    borderRadius: "12px",
                    border: "1px solid rgba(148,163,184,0.3)",
                    fontSize: "12px",
                  }}
                  formatter={(value: number) => [
                    `${toBanglaNumber(value.toFixed(1))}%`,
                    "পাসের হার",
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="passRate"
                  name="পাসের হার (%)"
                  stroke="#0ea5e9"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#passRateGrad)"
                  dot={{ r: 4, fill: "#0ea5e9", strokeWidth: 2, stroke: "#fff" }}
                  activeDot={{ r: 6 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-center p-6 space-y-2">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center">
                <Award className="w-6 h-6" />
              </div>
              <p className="text-slate-600 dark:text-slate-300 font-semibold text-sm">
                পরীক্ষার পর্যাপ্ত ফলাফল নেই
              </p>
              <p className="text-slate-400 text-xs max-w-xs">
                পরীক্ষার নম্বর এন্ট্রি করা হলে এখানে পাসের হারের গ্রাফ স্বয়ংক্রিয়ভাবে প্রদর্শিত হবে।
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
