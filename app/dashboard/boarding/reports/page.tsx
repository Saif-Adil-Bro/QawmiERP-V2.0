"use client";

import { useState, useEffect } from "react";
import { getMonthlyBoardingReport } from "@/app/actions/boarding";
import { format } from "date-fns";
import { ArrowLeft, CalendarDays, Printer, Calculator, FileText, Search, TrendingUp } from "lucide-react";
import Link from "next/link";

export default function MonthlyReportsPage() {
  const currentDate = new Date();
  const [year, setYear] = useState<string>(format(currentDate, "yyyy"));
  const [month, setMonth] = useState<string>(format(currentDate, "MM"));
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const monthsList = [
    { value: "01", label: "জানুয়ারি" },
    { value: "02", label: "ফেব্রুয়ারি" },
    { value: "03", label: "মার্চ" },
    { value: "04", label: "এপ্রিল" },
    { value: "05", label: "মে" },
    { value: "06", label: "জুন" },
    { value: "07", label: "জুলাই" },
    { value: "08", label: "আগস্ট" },
    { value: "09", label: "সেপ্টেম্বর" },
    { value: "10", label: "অক্টোবর" },
    { value: "11", label: "নভেম্বর" },
    { value: "12", label: "ডিসেম্বর" }
  ];

  const yearsList = [
    { value: "2025", label: "২০২৫" },
    { value: "2026", label: "২০২৬" },
    { value: "2027", label: "২০২৭" },
    { value: "2028", label: "২০২৮" }
  ];

  const loadReport = async () => {
    setLoading(true);
    const data = await getMonthlyBoardingReport(year, month);
    setReport(data);
    setLoading(false);
  };

  useEffect(() => {
    loadReport();
  }, [year, month]);

  const handlePrint = () => {
    window.print();
  };

  const getSelectedMonthLabel = () => {
    return monthsList.find(m => m.value === month)?.label || "";
  };

  const getSelectedYearLabel = () => {
    return yearsList.find(y => y.value === year)?.label || year;
  };

  return (
    <div className="space-y-6">
      {/* Header and Print action (Hidden in print mode) */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
        <div className="flex items-center space-x-4">
          <Link
            href="/dashboard/boarding"
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition"
            id="back_to_boarding"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">মাসিক মিল বিল (Monthly Meal Bill)</h1>
            <p className="text-slate-500 text-sm">মিল ও বাজার খরচের হিসাবের ভিত্তিতে মাসিক বিল হিসাব বিবরণী</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <div className="flex items-center space-x-2 bg-white border rounded-md px-3 py-2 shadow-sm w-full sm:w-auto">
            <label htmlFor="select_year" className="text-sm font-medium text-slate-600">বছর:</label>
            <select
              id="select_year"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="border-none focus:outline-none focus:ring-0 text-sm font-medium text-slate-800 bg-transparent cursor-pointer"
            >
              {yearsList.map(y => (
                <option key={y.value} value={y.value}>{y.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2 bg-white border rounded-md px-3 py-2 shadow-sm w-full sm:w-auto">
            <label htmlFor="select_month" className="text-sm font-medium text-slate-600">মাস:</label>
            <select
              id="select_month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="border-none focus:outline-none focus:ring-0 text-sm font-medium text-slate-800 bg-transparent cursor-pointer"
            >
              {monthsList.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          <button
            onClick={handlePrint}
            disabled={loading || !report}
            className="bg-slate-900 text-white px-4 py-2.5 rounded-md hover:bg-slate-800 font-semibold transition shadow-sm flex items-center w-full sm:w-auto justify-center disabled:opacity-50"
            id="btn_print_report"
          >
            <Printer className="w-4 h-4 mr-1.5" />
            রিপোর্ট প্রিন্ট করুন
          </button>
        </div>
      </div>

      {/* Printable Heading Block (Visible ONLY in print mode) */}
      <div className="hidden print:block text-center border-b-2 border-slate-800 pb-4 mb-6">
        <h1 className="text-3xl font-extrabold text-slate-900">বোর্ডিং ও মিল হিসাব রিপোর্ট</h1>
        <p className="text-slate-600 font-bold text-lg mt-1">
          মাস: {getSelectedMonthLabel()} - {getSelectedYearLabel()}
        </p>
        <p className="text-slate-500 text-sm mt-1">প্রস্তুতকারী: বোর্ডিং ব্যবস্থাপনা বিভাগ</p>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center space-y-2">
          <div className="w-8 h-8 border-4 border-slate-300 border-t-blue-600 rounded-full animate-spin"></div>
          <span>রিপোর্ট জেনারেট হচ্ছে...</span>
        </div>
      ) : !report ? (
        <div className="p-12 text-center text-slate-500">
          রিপোর্ট তৈরি করতে ব্যর্থ হয়েছে। অনুগ্রহ করে ডেটা পরীক্ষা করুন।
        </div>
      ) : (
        <div className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl border shadow-sm flex items-center space-x-4">
              <div className="bg-emerald-50 p-4 rounded-lg">
                <Calculator className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-500">মাসের মোট বাজার খরচ</p>
                <h3 className="text-2xl font-bold text-slate-800">{report.totalBazarCost.toLocaleString()} ৳</h3>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border shadow-sm flex items-center space-x-4">
              <div className="bg-orange-50 p-4 rounded-lg">
                <FileText className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-500">মাসের মোট মিল সংখ্যা</p>
                <h3 className="text-2xl font-bold text-slate-800">{report.totalMealsCount} টি</h3>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl border shadow-sm flex items-center space-x-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <TrendingUp className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-500">হিসাবকৃত মিল রেট (Meal Rate)</p>
                <h3 className="text-2xl font-bold text-blue-700">{report.mealRate.toLocaleString()} ৳</h3>
              </div>
            </div>
          </div>

          {/* Detailed Printable Table */}
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="p-4 bg-slate-50 border-b flex justify-between items-center print:hidden">
              <h3 className="text-base font-bold text-slate-800 flex items-center">
                <Search className="w-4 h-4 mr-2 text-slate-500" />
                ছাত্রদের মিল বিল রেজিস্টার
              </h3>
              <span className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full font-bold">
                চলতি মাসে মোট ছাত্র: {report.studentsReport.length} জন
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600 border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b">
                  <tr>
                    <th className="px-6 py-4 border-b text-center w-24">রোল</th>
                    <th className="px-6 py-4 border-b">ছাত্রের নাম</th>
                    <th className="px-6 py-4 border-b w-36">ক্লাস</th>
                    <th className="px-6 py-4 border-b text-center w-36">খাওয়া মিল (Meals)</th>
                    <th className="px-6 py-4 border-b text-right w-44">মিলের বিল (৳)</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {report.studentsReport.map((student: any) => (
                    <tr key={student.id} className="hover:bg-slate-50/50 transition">
                      <td className="px-6 py-4 text-center font-medium text-slate-900">{student.roll_number || "-"}</td>
                      <td className="px-6 py-4 font-bold text-slate-900">
                        {student.first_name} {student.last_name}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-600">{student.class_name || "N/A"}</td>
                      <td className="px-6 py-4 text-center text-slate-800 font-bold text-base">
                        {student.meals_count}
                      </td>
                      <td className="px-6 py-4 text-right text-slate-900 font-extrabold text-base">
                        {student.bill_amount.toLocaleString()} ৳
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Print Signatures Block */}
            <div className="hidden print:flex justify-between items-end mt-16 pt-8 px-6">
              <div className="text-center w-48 border-t-2 border-slate-800 pt-2">
                <p className="font-bold text-slate-900 text-sm">বোর্ডিং সুপারভাইজার</p>
              </div>
              <div className="text-center w-48 border-t-2 border-slate-800 pt-2">
                <p className="font-bold text-slate-900 text-sm">হিসাবরক্ষক</p>
              </div>
              <div className="text-center w-48 border-t-2 border-slate-800 pt-2">
                <p className="font-bold text-slate-900 text-sm">মুহতামিম / প্রিন্সিপাল</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
