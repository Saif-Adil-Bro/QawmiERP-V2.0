"use client";

import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
} from 'recharts';

const COLORS = ['#10b981', '#f43f5e', '#f59e0b', '#3b82f6'];

interface ReportingChartsProps {
  incomeExpenseData: any[];
  attendanceData: any[];
  examPassRateData: any[];
}

export default function ReportingCharts({ incomeExpenseData, attendanceData, examPassRateData }: ReportingChartsProps) {
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
      <div className="bg-white p-6 rounded-xl border shadow-sm">
        <h3 className="text-slate-700 font-semibold mb-6 text-lg">উপস্থিতির হার (Attendance Rate)</h3>
        <div className="h-64 flex justify-center items-center">
          {attendanceData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={attendanceData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {attendanceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip formatter={(value: number) => [`${value} দিন`, '']} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-slate-400">পর্যাপ্ত ডেটা নেই</p>
          )}
        </div>
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
              <p className="text-slate-400">পর্যাপ্ত ডেটা নেই</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
