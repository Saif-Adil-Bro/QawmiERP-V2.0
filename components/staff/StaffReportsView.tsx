"use client";

import React, { useState } from "react";
import {
  StaffMember,
  StaffCategory,
  StaffDepartment,
  STAFF_STATUS_LABELS,
  LEAVE_TYPE_LABELS,
} from "@/lib/staff-management";
import {
  Printer,
  FileText,
  Users,
  DollarSign,
  Calendar,
  Building,
  Download,
  Building2,
  ShieldCheck,
} from "lucide-react";
import { toBanglaNumber } from "@/lib/numberToBangla";

interface StaffReportsViewProps {
  staffList: StaffMember[];
  categories: StaffCategory[];
  departments: StaffDepartment[];
  madrasaInfo?: any;
  madrasaName?: string;
}

export default function StaffReportsView({
  staffList,
  categories,
  departments,
  madrasaInfo,
  madrasaName: fallbackMadrasaName = "মাদ্রাসাতুল মুসলিমীন",
}: StaffReportsViewProps) {
  const [reportType, setReportType] = useState<"directory" | "salary" | "category" | "leave">("directory");

  const mName = madrasaInfo?.name || fallbackMadrasaName;
  const mAddress = madrasaInfo?.address || "";
  const mPhone = madrasaInfo?.phone || "";
  const mEmail = madrasaInfo?.email || "";
  const mLogo = madrasaInfo?.logo_url || "";
  const mSignature = madrasaInfo?.signature_url || madrasaInfo?.principal_signature_url || "";
  const mPrincipalName = madrasaInfo?.principal_name || "মুহতামিম / প্রধান পরিচালক";
  const mRegNo = madrasaInfo?.registration_no || madrasaInfo?.reg_no || "";

  const handlePrint = () => {
    const printableElement = document.getElementById("staff-report-printable-area");
    if (!printableElement) {
      window.print();
      return;
    }

    const existing = document.getElementById("temp-print-frame");
    if (existing) existing.remove();

    const clone = printableElement.cloneNode(true) as HTMLElement;
    clone.id = "temp-print-frame";
    clone.classList.remove("hidden");
    clone.classList.add("block");
    document.body.appendChild(clone);
    document.body.classList.add("is-printing-now");

    setTimeout(() => {
      window.print();
      setTimeout(() => {
        document.body.classList.remove("is-printing-now");
        const temp = document.getElementById("temp-print-frame");
        if (temp) temp.remove();
      }, 500);
    }, 200);
  };

  const totalMonthlySalary = staffList.reduce((sum, s) => sum + (s.salary?.net_salary || 0), 0);
  const totalBasicSalary = staffList.reduce((sum, s) => sum + (s.salary?.basic_salary || 0), 0);
  const totalAllowances = staffList.reduce(
    (sum, s) =>
      sum +
      (s.salary?.allowances?.housing || 0) +
      (s.salary?.allowances?.food || 0) +
      (s.salary?.allowances?.transport || 0) +
      (s.salary?.allowances?.medical || 0) +
      (s.salary?.allowances?.other || 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* Report Switcher & Header */}
      <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900">রিপোর্ট ও প্রিন্ট সেন্টার (Staff Reports)</h3>
          <p className="text-xs text-slate-500">
            অফিসিয়াল ব্যবহারের জন্য স্টাফ তালিকা, মাসিক বেতন শিট ও বিভাগীয় সারসংক্ষেপ প্রস্তুত ও প্রিন্ট
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
            reportType === "directory" ? "bg-emerald-700 text-white shadow-xs" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          সম্পূর্ণ স্টাফ ডিরেক্টরি
        </button>

        <button
          onClick={() => setReportType("salary")}
          className={`px-3.5 py-2 rounded-xl transition cursor-pointer whitespace-nowrap ${
            reportType === "salary" ? "bg-emerald-700 text-white shadow-xs" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          মাসিক বেতন ও ভাতাদি শিট
        </button>

        <button
          onClick={() => setReportType("category")}
          className={`px-3.5 py-2 rounded-xl transition cursor-pointer whitespace-nowrap ${
            reportType === "category" ? "bg-emerald-700 text-white shadow-xs" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          বিভাগ ও ক্যাটাগরি বিশ্লেষণ
        </button>

        <button
          onClick={() => setReportType("leave")}
          className={`px-3.5 py-2 rounded-xl transition cursor-pointer whitespace-nowrap ${
            reportType === "leave" ? "bg-emerald-700 text-white shadow-xs" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          ছুটি ব্যালেন্স বিবরণী
        </button>
      </div>

      {/* REPORT PRINT CANVAS (On-screen & Printable) */}
      <div
        id="staff-report-printable-area"
        className="bg-white rounded-2xl p-8 sm:p-10 shadow-xs border border-slate-200/80 space-y-6 text-slate-800 font-sans"
      >
        {/* Madrasa Official Dynamic Header */}
        <div className="text-center border-b-2 border-slate-900 pb-5 space-y-1.5">
          <div className="flex items-center justify-center gap-3">
            {mLogo && (
              <img
                src={mLogo}
                alt="Madrasa Logo"
                className="w-12 h-12 object-contain rounded-full border border-slate-200 p-0.5"
              />
            )}
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">{mName}</h2>
              <p className="text-xs text-slate-600">
                {mAddress && `${mAddress} • `}
                {mPhone && `মোবাইল: ${toBanglaNumber(mPhone)}`}
                {mEmail && ` • ইমেইল: ${mEmail}`}
                {mRegNo && ` • রেজি: ${mRegNo}`}
              </p>
            </div>
          </div>

          <div className="pt-2">
            <span className="px-4 py-1.5 bg-slate-100 rounded-full font-bold text-xs text-slate-900 border border-slate-300 inline-block shadow-2xs">
              {reportType === "directory" && "অফিসিয়াল কর্মকর্তা-কর্মচারী ও শিক্ষক ডিরেক্টরি"}
              {reportType === "salary" && "মাসিক কর্মকর্তা-কর্মচারী বেতন রেজিস্টার ও বাজেট শিট"}
              {reportType === "category" && "বিভাগ ও পদবীভিত্তিক স্টাফ বণ্টন প্রতিবেদন"}
              {reportType === "leave" && "বাৎসরিক ছুটি ব্যালেন্স ও প্রাপ্য হিসেব বিবরণী"}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 pt-0.5">
            প্রতিবেদন প্রস্তুতের তারিখ: {toBanglaNumber(new Date().toISOString().split("T")[0])} খ্রিস্টাব্দ
          </p>
        </div>

        {/* 1. DIRECTORY REPORT */}
        {reportType === "directory" && (
          <div className="space-y-4 overflow-x-auto">
            <table className="w-full text-left text-xs border border-slate-300 border-collapse">
              <thead className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300">
                <tr>
                  <th className="p-2.5 border border-slate-300 text-center">ক্রম</th>
                  <th className="p-2.5 border border-slate-300">স্টাফ আইডি</th>
                  <th className="p-2.5 border border-slate-300">নাম</th>
                  <th className="p-2.5 border border-slate-300">পদবী</th>
                  <th className="p-2.5 border border-slate-300">বিভাগ</th>
                  <th className="p-2.5 border border-slate-300">ক্যাটাগরি</th>
                  <th className="p-2.5 border border-slate-300">মোবাইল নম্বর</th>
                  <th className="p-2.5 border border-slate-300">রক্তের গ্রুপ</th>
                  <th className="p-2.5 border border-slate-300">যোগদান</th>
                  <th className="p-2.5 border border-slate-300">স্ট্যাটাস</th>
                </tr>
              </thead>
              <tbody>
                {staffList.map((s, idx) => (
                  <tr key={s.id} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="p-2 border border-slate-300 text-center font-bold">{toBanglaNumber(idx + 1)}</td>
                    <td className="p-2 border border-slate-300 font-mono font-bold text-slate-800">{s.staff_id_code}</td>
                    <td className="p-2 border border-slate-300 font-bold">
                      {s.personal.full_name_bn || `${s.personal.first_name} ${s.personal.last_name}`}
                    </td>
                    <td className="p-2 border border-slate-300">{s.employment.designation}</td>
                    <td className="p-2 border border-slate-300">{s.employment.department_name}</td>
                    <td className="p-2 border border-slate-300 text-[11px] text-slate-600">
                      {s.employment.category_name?.split("(")[0] || "স্টাফ"}
                    </td>
                    <td className="p-2 border border-slate-300 font-medium">{s.contact.phone || "—"}</td>
                    <td className="p-2 border border-slate-300 font-bold text-rose-700 text-center">
                      {s.personal.blood_group || "—"}
                    </td>
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
          <div className="space-y-4 overflow-x-auto">
            <table className="w-full text-left text-xs border border-slate-300 border-collapse">
              <thead className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300">
                <tr>
                  <th className="p-2 border border-slate-300 text-center">ক্রম</th>
                  <th className="p-2 border border-slate-300">নাম ও পদবী</th>
                  <th className="p-2 border border-slate-300">মূল বেতন</th>
                  <th className="p-2 border border-slate-300">বাড়ি ভাড়া</th>
                  <th className="p-2 border border-slate-300">খাবার ও যাতায়াত</th>
                  <th className="p-2 border border-slate-300">বিশেষ ভাতা</th>
                  <th className="p-2 border border-slate-300">মোট কর্তন</th>
                  <th className="p-2 border border-slate-300 font-bold">নেট প্রদেয় বেতন</th>
                  <th className="p-2 border border-slate-300 text-center">গ্রহণকারীর স্বাক্ষর</th>
                </tr>
              </thead>
              <tbody>
                {staffList.map((s, idx) => (
                  <tr key={s.id} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="p-2 border border-slate-300 text-center">{toBanglaNumber(idx + 1)}</td>
                    <td className="p-2 border border-slate-300">
                      <span className="font-bold block text-slate-900">{s.personal.full_name_bn || s.personal.first_name}</span>
                      <span className="text-[10px] text-slate-500 font-medium">{s.employment.designation} ({s.staff_id_code})</span>
                    </td>
                    <td className="p-2 border border-slate-300">৳{toBanglaNumber(s.salary.basic_salary.toString())}</td>
                    <td className="p-2 border border-slate-300">৳{toBanglaNumber((s.salary.allowances?.housing || 0).toString())}</td>
                    <td className="p-2 border border-slate-300">
                      ৳{toBanglaNumber(((s.salary.allowances?.food || 0) + (s.salary.allowances?.transport || 0)).toString())}
                    </td>
                    <td className="p-2 border border-slate-300">
                      ৳{toBanglaNumber(((s.salary.allowances?.medical || 0) + (s.salary.allowances?.other || 0)).toString())}
                    </td>
                    <td className="p-2 border border-slate-300 text-rose-700">
                      -৳{toBanglaNumber(Object.values(s.salary.deductions || {}).reduce((a, b) => a + Number(b || 0), 0).toString())}
                    </td>
                    <td className="p-2 border border-slate-300 font-bold text-emerald-800 text-sm">
                      ৳{toBanglaNumber(s.salary.net_salary.toString())}
                    </td>
                    <td className="p-2 border border-slate-300 w-28"></td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 font-bold border-t-2 border-slate-400">
                <tr>
                  <td colSpan={2} className="p-2.5 border border-slate-300 text-right">
                    সর্বমোট যোগফল:
                  </td>
                  <td className="p-2.5 border border-slate-300">৳{toBanglaNumber(totalBasicSalary.toString())}</td>
                  <td colSpan={4} className="p-2.5 border border-slate-300 text-right">
                    মোট প্রদেয় মাসিক বাজেট:
                  </td>
                  <td colSpan={2} className="p-2.5 border border-slate-300 text-emerald-800 text-sm">
                    ৳{toBanglaNumber(totalMonthlySalary.toString())}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* 3. CATEGORY & DEPARTMENT BREAKDOWN REPORT */}
        {reportType === "category" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Department breakdown */}
              <div className="space-y-2">
                <h4 className="font-bold text-xs text-slate-800 border-b pb-1">বিভাগভিত্তিক কর্মকর্তা বিন্যাস</h4>
                <table className="w-full text-xs border border-slate-300 border-collapse">
                  <thead className="bg-slate-100 font-bold">
                    <tr>
                      <th className="p-2 border border-slate-300 text-left">বিভাগের নাম</th>
                      <th className="p-2 border border-slate-300 text-center">মোট কর্মী</th>
                      <th className="p-2 border border-slate-300 text-right">মাসিক বেতন বরাদ্দ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {departments.map((dept) => {
                      const deptStaff = staffList.filter((s) => s.employment.department_id === dept.id);
                      const deptSalary = deptStaff.reduce((sum, s) => sum + (s.salary?.net_salary || 0), 0);
                      return (
                        <tr key={dept.id} className="border-b">
                          <td className="p-2 border border-slate-300 font-medium">{dept.name}</td>
                          <td className="p-2 border border-slate-300 text-center font-bold">
                            {toBanglaNumber(deptStaff.length)}
                          </td>
                          <td className="p-2 border border-slate-300 text-right font-bold text-emerald-800">
                            ৳{toBanglaNumber(deptSalary.toString())}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Category breakdown */}
              <div className="space-y-2">
                <h4 className="font-bold text-xs text-slate-800 border-b pb-1">ক্যাটাগরিভিত্তিক বিন্যাস</h4>
                <table className="w-full text-xs border border-slate-300 border-collapse">
                  <thead className="bg-slate-100 font-bold">
                    <tr>
                      <th className="p-2 border border-slate-300 text-left">ক্যাটাগরি</th>
                      <th className="p-2 border border-slate-300 text-center">কর্মী সংখ্যা</th>
                      <th className="p-2 border border-slate-300 text-right">মোট প্রদেয়</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((cat) => {
                      const catStaff = staffList.filter((s) => s.employment.category_id === cat.id);
                      const catSalary = catStaff.reduce((sum, s) => sum + (s.salary?.net_salary || 0), 0);
                      return (
                        <tr key={cat.id} className="border-b">
                          <td className="p-2 border border-slate-300 font-medium">{cat.name}</td>
                          <td className="p-2 border border-slate-300 text-center font-bold">
                            {toBanglaNumber(catStaff.length)}
                          </td>
                          <td className="p-2 border border-slate-300 text-right font-bold text-emerald-800">
                            ৳{toBanglaNumber(catSalary.toString())}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 4. LEAVE BALANCE REPORT */}
        {reportType === "leave" && (
          <div className="space-y-4 overflow-x-auto">
            <table className="w-full text-left text-xs border border-slate-300 border-collapse">
              <thead className="bg-slate-100 text-slate-900 font-bold border-b border-slate-300">
                <tr>
                  <th className="p-2 border border-slate-300 text-center">ক্রম</th>
                  <th className="p-2 border border-slate-300">স্টাফ আইডি ও নাম</th>
                  <th className="p-2 border border-slate-300">পদবী ও বিভাগ</th>
                  <th className="p-2 border border-slate-300 text-center">বাৎসরিক বরাদ্দ</th>
                  <th className="p-2 border border-slate-300 text-center">ভোগকৃত ছুটি</th>
                  <th className="p-2 border border-slate-300 text-center">অবশিষ্ট ছুটি</th>
                  <th className="p-2 border border-slate-300 text-center">বর্তমান স্ট্যাটাস</th>
                </tr>
              </thead>
              <tbody>
                {staffList.map((s, idx) => {
                  const quota = (s.leave_balance?.casual_allocated || 10) + (s.leave_balance?.sick_allocated || 10) + (s.leave_balance?.annual_allocated || 10);
                  const taken = (s.leave_balance?.casual_used || 0) + (s.leave_balance?.sick_used || 0) + (s.leave_balance?.annual_used || 0);
                  const remaining = quota - taken;
                  return (
                    <tr key={s.id} className="border-b border-slate-200 hover:bg-slate-50">
                      <td className="p-2 border border-slate-300 text-center font-bold">{toBanglaNumber(idx + 1)}</td>
                      <td className="p-2 border border-slate-300">
                        <span className="font-bold block">{s.personal.full_name_bn || s.personal.first_name}</span>
                        <span className="font-mono text-[10px] text-slate-500">{s.staff_id_code}</span>
                      </td>
                      <td className="p-2 border border-slate-300">
                        <span>{s.employment.designation}</span>
                        <span className="text-[10px] text-slate-500 block">{s.employment.department_name}</span>
                      </td>
                      <td className="p-2 border border-slate-300 text-center font-semibold">{toBanglaNumber(quota)} দিন</td>
                      <td className="p-2 border border-slate-300 text-center font-bold text-amber-700">{toBanglaNumber(taken)} দিন</td>
                      <td className="p-2 border border-slate-300 text-center font-bold text-emerald-800">{toBanglaNumber(remaining)} দিন</td>
                      <td className="p-2 border border-slate-300 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          s.employment.status === "ACTIVE"
                            ? "bg-emerald-100 text-emerald-800"
                            : s.employment.status === "ON_LEAVE"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-100 text-slate-700"
                        }`}>
                          {STAFF_STATUS_LABELS[s.employment.status]?.label?.split("(")[0] || "সক্রিয়"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Official Signatures Grid */}
        <div className="pt-14 grid grid-cols-3 gap-8 text-center text-xs text-slate-700">
          <div className="flex flex-col items-center">
            <div className="w-36 border-b border-slate-400 mb-1" />
            <span className="font-semibold text-slate-800">প্রস্তুতকারী / দপ্তর সহকারী</span>
          </div>

          <div className="flex flex-col items-center">
            <div className="w-36 border-b border-slate-400 mb-1" />
            <span className="font-semibold text-slate-800">নাজেমে তা'লীমাত / হিসাবরক্ষক</span>
          </div>

          <div className="flex flex-col items-center">
            {mSignature ? (
              <img
                src={mSignature}
                alt="Signature"
                className="h-7 max-w-[120px] object-contain mb-1"
              />
            ) : (
              <div className="w-36 border-b border-slate-700 mb-1" />
            )}
            <span className="font-bold text-slate-900">{mPrincipalName}</span>
            <span className="text-[10px] text-slate-500">{mName}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
