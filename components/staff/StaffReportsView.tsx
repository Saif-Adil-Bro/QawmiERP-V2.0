"use client";

import React, { useState } from "react";
import {
  StaffMember,
  StaffCategory,
  StaffDepartment,
  STAFF_STATUS_LABELS,
} from "@/lib/staff-management";
import {
  Printer,
  FileText,
  Users,
  DollarSign,
  Calendar,
  Building,
  Download,
} from "lucide-react";
import { toBanglaNumber } from "@/lib/numberToBangla";

interface StaffReportsViewProps {
  staffList: StaffMember[];
  categories: StaffCategory[];
  departments: StaffDepartment[];
  madrasaName?: string;
}

export default function StaffReportsView({
  staffList,
  categories,
  departments,
  madrasaName = "দারুল উলুম কওমিয়া মাদ্রাসা",
}: StaffReportsViewProps) {
  const [reportType, setReportType] = useState<"directory" | "salary" | "category" | "leave">("directory");

  const handlePrint = () => {
    window.print();
  };

  const totalMonthlySalary = staffList.reduce((sum, s) => sum + (s.salary?.net_salary || 0), 0);

  return (
    <div className="space-y-6">
      {/* Report Switcher & Header */}
      <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900">রিপোর্ট ও প্রিন্ট সেন্টার (Staff Reports)</h3>
          <p className="text-xs text-slate-500">
            অফিসিয়াল ব্যবহারের জন্য স্টাফ তালিকা, মাসিক বেতন শিট ও বিভাগীয় সারসংক্ষেপ প্রস্তুত ও প্রিন্ট
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>প্রিন্ট / PDF সংরক্ষণ</span>
          </button>
        </div>
      </div>

      {/* Report Type Selector Pills */}
      <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200/80 overflow-x-auto text-xs font-semibold">
        <button
          onClick={() => setReportType("directory")}
          className={`px-3.5 py-2 rounded-xl transition cursor-pointer whitespace-nowrap ${
            reportType === "directory" ? "bg-emerald-700 text-white" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          সম্পূর্ণ স্টাফ ডিরেক্টরি
        </button>

        <button
          onClick={() => setReportType("salary")}
          className={`px-3.5 py-2 rounded-xl transition cursor-pointer whitespace-nowrap ${
            reportType === "salary" ? "bg-emerald-700 text-white" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          মাসিক বেতন ও ভাতাদি শিট
        </button>

        <button
          onClick={() => setReportType("category")}
          className={`px-3.5 py-2 rounded-xl transition cursor-pointer whitespace-nowrap ${
            reportType === "category" ? "bg-emerald-700 text-white" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          বিভাগ ও ক্যাটাগরি বিশ্লেষণ
        </button>

        <button
          onClick={() => setReportType("leave")}
          className={`px-3.5 py-2 rounded-xl transition cursor-pointer whitespace-nowrap ${
            reportType === "leave" ? "bg-emerald-700 text-white" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          ছুটি ব্যালেন্স বিবরণী
        </button>
      </div>

      {/* REPORT PRINT CANVAS */}
      <div className="bg-white rounded-2xl p-8 shadow-xs border border-slate-200/80 space-y-6 text-slate-800 font-sans printable-area">
        {/* Madrasa Official Header */}
        <div className="text-center border-b-2 border-slate-900 pb-4 space-y-1">
          <h2 className="text-xl font-bold text-slate-900">{madrasaName}</h2>
          <p className="text-xs text-slate-600">স্টাফ ও মানবসম্পদ ব্যবস্থাপনা বিভাগ (HR Department)</p>
          <div className="pt-2">
            <span className="px-4 py-1 bg-slate-100 rounded-full font-bold text-xs text-slate-800 border border-slate-300 inline-block">
              {reportType === "directory" && "অফিসিয়াল স্টাফ ডিরেক্টরি ও যোগাযোগ তালিকা"}
              {reportType === "salary" && "মাসিক কর্মকর্তা-কর্মচারী বেতন রেজিস্টার"}
              {reportType === "category" && "বিভাগ ও পদবীভিত্তিক স্টাফ বিন্যাস প্রতিবেদন"}
              {reportType === "leave" && "বাৎসরিক ছুটি ব্যালেন্স ও হিসেব বিবরণী"}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 pt-1">
            প্রতিবেদন তৈরির তারিখ: {toBanglaNumber(new Date().toISOString().split("T")[0])}
          </p>
        </div>

        {/* 1. DIRECTORY REPORT */}
        {reportType === "directory" && (
          <div className="space-y-4">
            <table className="w-full text-left text-xs border border-slate-300 border-collapse">
              <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                <tr>
                  <th className="p-2.5 border border-slate-300">ক্রম</th>
                  <th className="p-2.5 border border-slate-300">আইডি</th>
                  <th className="p-2.5 border border-slate-300">নাম</th>
                  <th className="p-2.5 border border-slate-300">পদবী</th>
                  <th className="p-2.5 border border-slate-300">বিভাগ</th>
                  <th className="p-2.5 border border-slate-300">মোবাইল</th>
                  <th className="p-2.5 border border-slate-300">যোগদান</th>
                  <th className="p-2.5 border border-slate-300">স্ট্যাটাস</th>
                </tr>
              </thead>
              <tbody>
                {staffList.map((s, idx) => (
                  <tr key={s.id} className="border-b border-slate-200">
                    <td className="p-2 border border-slate-300 text-center font-bold">{toBanglaNumber(idx + 1)}</td>
                    <td className="p-2 border border-slate-300 font-mono">{s.staff_id_code}</td>
                    <td className="p-2 border border-slate-300 font-bold">
                      {s.personal.full_name_bn || `${s.personal.first_name} ${s.personal.last_name}`}
                    </td>
                    <td className="p-2 border border-slate-300">{s.employment.designation}</td>
                    <td className="p-2 border border-slate-300">{s.employment.department_name}</td>
                    <td className="p-2 border border-slate-300">{s.contact.phone || "—"}</td>
                    <td className="p-2 border border-slate-300">{toBanglaNumber(s.employment.joining_date)}</td>
                    <td className="p-2 border border-slate-300 font-semibold">
                      {STAFF_STATUS_LABELS[s.employment.status]?.label?.split("(")[0] || "সক্রিয়"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 2. SALARY REGISTER REPORT */}
        {reportType === "salary" && (
          <div className="space-y-4">
            <table className="w-full text-left text-xs border border-slate-300 border-collapse">
              <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                <tr>
                  <th className="p-2 border border-slate-300">ক্রম</th>
                  <th className="p-2 border border-slate-300">নাম ও পদবী</th>
                  <th className="p-2 border border-slate-300">মূল বেতন</th>
                  <th className="p-2 border border-slate-300">বাড়ি ভাড়া</th>
                  <th className="p-2 border border-slate-300">খাবার ও যাতায়াত</th>
                  <th className="p-2 border border-slate-300">মোট কর্তন</th>
                  <th className="p-2 border border-slate-300">নেট প্রদেয় বেতন</th>
                  <th className="p-2 border border-slate-300 text-center">স্বাক্ষর</th>
                </tr>
              </thead>
              <tbody>
                {staffList.map((s, idx) => (
                  <tr key={s.id} className="border-b border-slate-200">
                    <td className="p-2 border border-slate-300 text-center">{toBanglaNumber(idx + 1)}</td>
                    <td className="p-2 border border-slate-300">
                      <span className="font-bold block">{s.personal.full_name_bn || s.personal.first_name}</span>
                      <span className="text-[10px] text-slate-500">{s.employment.designation}</span>
                    </td>
                    <td className="p-2 border border-slate-300">৳{toBanglaNumber(s.salary.basic_salary.toString())}</td>
                    <td className="p-2 border border-slate-300">৳{toBanglaNumber((s.salary.allowances?.housing || 0).toString())}</td>
                    <td className="p-2 border border-slate-300">
                      ৳{toBanglaNumber(((s.salary.allowances?.food || 0) + (s.salary.allowances?.transport || 0)).toString())}
                    </td>
                    <td className="p-2 border border-slate-300 text-rose-700">
                      -৳{toBanglaNumber(Object.values(s.salary.deductions || {}).reduce((a, b) => a + Number(b || 0), 0).toString())}
                    </td>
                    <td className="p-2 border border-slate-300 font-bold text-emerald-800">
                      ৳{toBanglaNumber(s.salary.net_salary.toString())}
                    </td>
                    <td className="p-2 border border-slate-300 w-24"></td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 font-bold border-t-2 border-slate-400">
                <tr>
                  <td colSpan={6} className="p-2.5 border border-slate-300 text-right">
                    সর্বমোট মাসিক বাজেট:
                  </td>
                  <td colSpan={2} className="p-2.5 border border-slate-300 text-emerald-800 text-sm">
                    ৳{toBanglaNumber(totalMonthlySalary.toString())}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Signatures */}
        <div className="pt-16 grid grid-cols-3 gap-8 text-center text-xs text-slate-700">
          <div className="border-t border-slate-400 pt-1">প্রস্তুতকারী</div>
          <div className="border-t border-slate-400 pt-1">হিসাবরক্ষক</div>
          <div className="border-t border-slate-400 pt-1">মুহতামিম / প্রধান পরিচালক</div>
        </div>
      </div>
    </div>
  );
}
