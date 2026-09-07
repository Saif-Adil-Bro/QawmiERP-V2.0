"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
} from 'recharts';
import { CalendarCheck, CalendarDays, ArrowRight } from 'lucide-react';
import { toBanglaNumber } from "@/lib/numberToBangla";

const STATUS_COLORS: Record<string, string> = {
  'উপস্থিত': '#10b981', // Emerald green
  'অনুপস্থিত': '#f43f5e', // Rose red
  'ছুটি': '#f59e0b',     // Amber orange
  'বিলম্ব': '#0ea5e9',    // Sky blue
};

interface ReportingChartsProps {
  incomeExpenseData: any[];
  attendanceData: any[];
  todayAttendanceData?: any[];
  examPassRateData: any[];
}

export default function ReportingCharts({
  incomeExpenseData,
  attendanceData,
  todayAttendanceData = [],
  examPassRateData
}: ReportingChartsProps) {
  const hasTodayData = todayAttendanceData && todayAttendanceData.length > 0;
  const has30DaysData = attendanceData && attendanceData.length > 0;
  const [attendanceView, setAttendanceView] = useState<'today' | '30days'>(
    hasTodayData ? 'today' : (has30DaysData ? '30days' : 'today')
  );

  const activeAttendanceData = attendanceView === 'today' 
    ? (todayAttendanceData || [])
    : (attendanceData || []);

  const totalAttendanceCount = activeAttendanceData.reduce((acc, curr) => acc + (Number(curr.value) || 0), 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
      {/* Income vs Expense Chart */}
      <div className="bg-white p-6 rounded-xl border shadow-sm col-span-1 lg:col-span-2">
        <h3 className="text-slate-700 font-semibold mb-6 text-lg">মাসিক আয়-ব্যয় (Monthly Income vs Expense)</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={incomeExpenseData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" axisLine={false} tickLine={false} />
              <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `৳ ${value}`} />
              <RechartsTooltip cursor={{ fill: '#f1f5f9' }} formatter={(value: number) => [`৳ ${value.toLocaleString('en-IN')}`, '']} />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />
              <Bar dataKey="income" name="আয় (Income)" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" name="ব্যয় (Expense)" fill="#f43f5e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Attendance Rate */}
      <div className="bg-white p-6 rounded-xl border shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
            <div>
              <h3 className="text-slate-800 font-semibold text-lg">উপস্থিতির হার (Attendance Rate)</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {attendanceView === 'today' 
                  ? 'আজকের সার্বিক শিক্ষার্থীর বাস্তব হাজিরা অনুপাত' 
                  : 'বিগত ৩০ দিনের সার্বিক শিক্ষার্থীর মোট হাজিরা অনুপাত'}
              </p>
            </div>
            
            {/* Toggle between Today and 30 Days */}
            <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setAttendanceView('today')}
                className={`px-3 py-1 rounded-md font-medium transition cursor-pointer ${
                  attendanceView === 'today'
                    ? 'bg-white text-emerald-700 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                আজকের দিন
              </button>
              <button
                type="button"
                onClick={() => setAttendanceView('30days')}
                className={`px-3 py-1 rounded-md font-medium transition cursor-pointer ${
                  attendanceView === '30days'
                    ? 'bg-white text-emerald-700 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                বিগত ৩০ দিন
              </button>
            </div>
          </div>

          <div className="h-64 flex justify-center items-center relative">
            {activeAttendanceData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={activeAttendanceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {activeAttendanceData.map((entry: any, index: number) => {
                      const color = STATUS_COLORS[entry.name] || '#64748b';
                      return <Cell key={`cell-${index}`} fill={color} />;
                    })}
                  </Pie>
                  <RechartsTooltip
                    formatter={(value: number, name: string) => [
                      `${toBanglaNumber(value)} জন ${attendanceView === 'today' ? 'শিক্ষার্থী' : 'রেকর্ড'}`,
                      name
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : attendanceView === 'today' ? (
              <div className="text-center p-6 space-y-2">
                <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                  <CalendarCheck className="w-6 h-6" />
                </div>
                <p className="text-slate-800 font-semibold text-sm">আজকের হাজিরা এখনো গ্রহণ করা হয়নি</p>
                <p className="text-slate-500 text-xs max-w-xs mx-auto">
                  শিক্ষক বা এডমিন আজকের হাজিরা গ্রহণ করলে এখানে তাৎক্ষণিক বাস্তব অনুপাত প্রদর্শিত হবে।
                </p>
                <div className="pt-2">
                  <Link
                    href="/dashboard/attendance/students"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-xs"
                  >
                    <span>আজকের হাজিরা গ্রহণ করুন</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="text-center p-6 space-y-2">
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <CalendarDays className="w-6 h-6" />
                </div>
                <p className="text-slate-700 font-semibold text-sm">বিগত ৩০ দিনে কোনো হাজিরার রেকর্ড নেই</p>
                <p className="text-slate-400 text-xs max-w-xs mx-auto">
                  হাজিরা গ্রহণের পর চার্টে স্বয়ংক্রিয়ভাবে বাস্তব উপস্থিতি ও ছুটির পরিসংখ্যান প্রদর্শিত হবে।
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Dynamic Summary Badges below the chart */}
        {activeAttendanceData.length > 0 && (
          <div className="pt-3 border-t border-slate-100 flex items-center justify-center flex-wrap gap-4 text-xs">
            {activeAttendanceData.map((item: any, idx: number) => {
              const color = STATUS_COLORS[item.name] || '#64748b';
              const percent = totalAttendanceCount > 0 
                ? ((item.value / totalAttendanceCount) * 100).toFixed(0) 
                : 0;
              return (
                <div key={idx} className="flex items-center gap-1.5 font-medium text-slate-700">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                  <span>{item.name}:</span>
                  <span className="font-bold">{toBanglaNumber(item.value)} জন</span>
                  <span className="text-slate-400">({toBanglaNumber(percent)}%)</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Exam Pass Rate */}
      <div className="bg-white p-6 rounded-xl border shadow-sm">
        <h3 className="text-slate-700 font-semibold mb-6 text-lg">পরীক্ষার পাসের হার (Exam Pass Rate)</h3>
        <div className="h-64">
          {examPassRateData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={examPassRateData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="exam" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} domain={[0, 100]} tickFormatter={(val) => `${val}%`} />
                <RechartsTooltip formatter={(value: number) => [`${value.toFixed(1)}%`, 'পাসের হার']} />
                <Legend />
                <Line type="monotone" dataKey="passRate" name="পাসের হার (%)" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-slate-400 text-sm">পর্যাপ্ত ডেটা নেই</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
