"use client";

import { useState, useEffect, useMemo } from "react";
import { getMonthlyBoardingReport } from "@/app/actions/boarding";
import { format } from "date-fns";
import {
  ArrowLeft,
  CalendarDays,
  Printer,
  Calculator,
  FileText,
  Search,
  TrendingUp,
  SlidersHorizontal,
  DollarSign,
  HeartHandshake,
  Users,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

export default function MonthlyReportsPage() {
  const currentDate = new Date();
  const [year, setYear] = useState<string>(format(currentDate, "yyyy"));
  const [month, setMonth] = useState<string>(format(currentDate, "MM"));
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [selectedClass, setSelectedClass] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  
  // Custom Meal Rate override / simulation
  const [customRateEnabled, setCustomRateEnabled] = useState(false);
  const [customRateInput, setCustomRateInput] = useState<string>("50");

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
    { value: "12", label: "ডিসেম্বর" },
  ];

  const yearsList = [
    { value: "2025", label: "২০২৫" },
    { value: "2026", label: "২০২৬" },
    { value: "2027", label: "২০২৭" },
    { value: "2028", label: "২০২৮" },
  ];

  const loadReport = async () => {
    setLoading(true);
    try {
      const data = await getMonthlyBoardingReport(year, month);
      setReport(data || null);
    } catch (err) {
      console.error("getMonthlyBoardingReport failed:", err);
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [year, month]);

  const handlePrint = () => {
    window.print();
  };

  const getSelectedMonthLabel = () => {
    return monthsList.find((m) => m.value === month)?.label || "";
  };

  const getSelectedYearLabel = () => {
    return yearsList.find((y) => y.value === year)?.label || year;
  };

  // Effective meal rate (either auto-calculated from bazar expenses or manually overridden)
  const effectiveMealRate = useMemo(() => {
    if (customRateEnabled) {
      const parsed = parseFloat(customRateInput);
      return isNaN(parsed) ? 0 : parsed;
    }
    return report?.mealRate ?? 0;
  }, [customRateEnabled, customRateInput, report?.mealRate]);

  // Unique classes list from current report
  const classesList = useMemo(() => {
    if (!report?.studentsReport) return [];
    const set = new Set<string>();
    report.studentsReport.forEach((s: any) => {
      if (s.class_name && s.class_name !== "—") set.add(s.class_name);
    });
    return Array.from(set).sort();
  }, [report?.studentsReport]);

  // Processed and filtered student reports
  const processedStudents = useMemo(() => {
    if (!report?.studentsReport) return [];

    return report.studentsReport
      .map((std: any) => {
        const gross = std.meals_count * effectiveMealRate;
        let discount = 0;
        if (std.boarding_type === "লিল্লাহ বোর্ডিং (ফ্রি)") {
          discount = gross;
        } else if (std.boarding_type === "হাফ-ফ্রি") {
          discount = gross * 0.5;
        }
        const net = Math.max(0, gross - discount);

        return {
          ...std,
          calculated_gross: Math.round(gross * 100) / 100,
          calculated_discount: Math.round(discount * 100) / 100,
          calculated_bill: Math.round(net * 100) / 100,
        };
      })
      .filter((std: any) => {
        // Search filter
        if (search.trim()) {
          const q = search.toLowerCase();
          const nameMatch = std.student_name?.toLowerCase().includes(q);
          const rollMatch = String(std.roll_number || "").includes(q);
          if (!nameMatch && !rollMatch) return false;
        }

        // Class filter
        if (selectedClass !== "ALL" && std.class_name !== selectedClass) {
          return false;
        }

        // Boarding category filter
        if (categoryFilter === "PAYING") {
          return std.boarding_type === "সাধারণ পেইং";
        }
        if (categoryFilter === "LILLAH") {
          return std.boarding_type === "লিল্লাহ বোর্ডিং (ফ্রি)";
        }
        if (categoryFilter === "HALF") {
          return std.boarding_type === "হাফ-ফ্রি";
        }
        if (categoryFilter === "NON_RESIDENTIAL") {
          return !std.is_boarding;
        }
        if (categoryFilter === "BOARDING_ONLY") {
          return std.is_boarding;
        }

        return true;
      });
  }, [report?.studentsReport, effectiveMealRate, search, selectedClass, categoryFilter]);

  // Aggregated sums based on filtered students
  const filteredTotals = useMemo(() => {
    let totalMeals = 0;
    let totalGross = 0;
    let totalDiscount = 0;
    let totalPayable = 0;

    processedStudents.forEach((s: any) => {
      totalMeals += s.meals_count || 0;
      totalGross += s.calculated_gross || 0;
      totalDiscount += s.calculated_discount || 0;
      totalPayable += s.calculated_bill || 0;
    });

    return {
      totalMeals,
      totalGross: Math.round(totalGross * 100) / 100,
      totalDiscount: Math.round(totalDiscount * 100) / 100,
      totalPayable: Math.round(totalPayable * 100) / 100,
    };
  }, [processedStudents]);

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
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <span>মাসিক মিল হিসাব ও বিল শিট</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                ডায়নামিক ও রিয়েল-টাইম
              </span>
            </h1>
            <p className="text-slate-500 text-sm">
              রিয়েল বাজার খরচ ও দৈনিক মিল উপস্থিতির ভিত্তিতে স্বয়ংক্রিয় বিল নির্ধারণ
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Year select */}
          <div className="flex items-center space-x-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-xs">
            <label htmlFor="select_year" className="text-xs font-semibold text-slate-500">
              বছর:
            </label>
            <select
              id="select_year"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="border-none focus:outline-none focus:ring-0 text-xs font-bold text-slate-800 bg-transparent cursor-pointer"
            >
              {yearsList.map((y) => (
                <option key={y.value} value={y.value}>
                  {y.label}
                </option>
              ))}
            </select>
          </div>

          {/* Month select */}
          <div className="flex items-center space-x-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-xs">
            <label htmlFor="select_month" className="text-xs font-semibold text-slate-500">
              মাস:
            </label>
            <select
              id="select_month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="border-none focus:outline-none focus:ring-0 text-xs font-bold text-slate-800 bg-transparent cursor-pointer"
            >
              {monthsList.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={loadReport}
            disabled={loading}
            title="রিফ্রেশ করুন"
            className="p-2.5 bg-white border border-slate-200 text-slate-600 hover:text-slate-900 rounded-xl shadow-xs transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-emerald-600" : ""}`} />
          </button>

          <button
            onClick={handlePrint}
            disabled={loading || !report}
            className="bg-slate-900 text-white px-4 py-2.5 rounded-xl hover:bg-slate-800 font-semibold transition shadow-xs flex items-center justify-center disabled:opacity-50 text-xs"
            id="btn_print_report"
          >
            <Printer className="w-4 h-4 mr-1.5" />
            রিপোর্ট প্রিন্ট করুন
          </button>
        </div>
      </div>

      {/* Available Data Quick Switcher Banner */}
      {report?.monthsWithData && report.monthsWithData.length > 0 && (
        <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs print:hidden">
          <div className="flex items-center gap-2 text-emerald-900 font-medium">
            <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              <strong>ডাটাবেজ রেকর্ড শনাক্ত:</strong> নিচের মাসগুলোতে বাজার খরচ অথবা মিল হাজিরা বিদ্যমান রয়েছে:
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {report.monthsWithData.map((mItem: any) => {
              const isCurrentSelected = mItem.year === year && mItem.month === month;
              return (
                <button
                  key={`${mItem.year}-${mItem.month}`}
                  type="button"
                  onClick={() => {
                    setYear(mItem.year);
                    setMonth(mItem.month);
                  }}
                  className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 ${
                    isCurrentSelected
                      ? "bg-emerald-700 text-white shadow-xs"
                      : "bg-white text-emerald-800 hover:bg-emerald-100 border border-emerald-200"
                  }`}
                >
                  <CalendarDays className="w-3 h-3" />
                  <span>{mItem.label}</span>
                  {isCurrentSelected && <span className="text-[10px] bg-emerald-800 px-1 rounded">সচল</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Printable Heading Block (Visible ONLY in print mode) */}
      <div className="hidden print:block text-center border-b-2 border-slate-800 pb-4 mb-6">
        <h1 className="text-2xl font-extrabold text-slate-900">মাদ্রাসাতুল মুসলিমীন</h1>
        <h2 className="text-lg font-bold text-slate-700 mt-1">বোর্ডিং ও মিল হিসাব রিপোর্ট (মাসিক বিল রেজিস্টার)</h2>
        <p className="text-slate-600 text-sm mt-0.5">
          মাস: {getSelectedMonthLabel()} - {getSelectedYearLabel()} | মিল রেট: {effectiveMealRate} ৳
        </p>
      </div>

      {loading ? (
        <div className="p-16 text-center text-slate-500 flex flex-col items-center justify-center space-y-3 bg-white rounded-3xl border border-slate-200 shadow-xs">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin"></div>
          <span className="text-xs font-semibold">রিয়েল-টাইম ডাটাবেজ থেকে মিল ও বাজার রিপোর্ট গণনা হচ্ছে...</span>
        </div>
      ) : !report ? (
        <div className="p-12 text-center text-slate-500 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3">
          <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
          <p className="font-bold text-slate-800">রিপোর্ট লোড করা যায়নি।</p>
          <p className="text-xs text-slate-500">অনুগ্রহ করে ইন্টারনেট সংযোগ অথবা সেশন যাচাই করুন।</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* High-level KPI Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:grid-cols-4 print:gap-2">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-3.5">
              <div className="bg-emerald-50 text-emerald-600 p-3.5 rounded-xl">
                <Calculator className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">মাসের মোট বাজার খরচ</p>
                <h3 className="text-xl font-extrabold text-slate-900 mt-0.5">
                  {(report?.totalBazarCost ?? 0).toLocaleString()} ৳
                </h3>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-3.5">
              <div className="bg-amber-50 text-amber-600 p-3.5 rounded-xl">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">মোট সক্রিয় মিল (Active Meals)</p>
                <h3 className="text-xl font-extrabold text-slate-900 mt-0.5">
                  {(report?.totalMealsCount ?? 0).toLocaleString()} টি
                </h3>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-3.5">
              <div className="bg-blue-50 text-blue-600 p-3.5 rounded-xl">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">
                  {customRateEnabled ? "কাস্টম মিল রেট" : "হিসাবকৃত মিল রেট"}
                </p>
                <h3 className="text-xl font-extrabold text-blue-700 mt-0.5">
                  {effectiveMealRate.toFixed(2)} ৳
                </h3>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-3.5">
              <div className="bg-purple-50 text-purple-600 p-3.5 rounded-xl">
                <HeartHandshake className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">লিল্লাহ বোর্ডিং সহায়তা</p>
                <h3 className="text-xl font-extrabold text-purple-700 mt-0.5">
                  {filteredTotals.totalDiscount.toLocaleString()} ৳
                </h3>
              </div>
            </div>
          </div>

          {/* Rate Notice / Override Control (Hidden in print) */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4 print:hidden">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800">মিল রেট হিসাব সূত্র:</span>
                <code className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono">
                  বাজার খরচ ({report.totalBazarCost}৳) ÷ মোট মিল ({report.totalMealsCount}টি) = {report.mealRate}৳ / মিল
                </code>
              </div>
              {report.totalBazarCost === 0 && report.totalMealsCount > 0 && (
                <p className="text-xs text-amber-700">
                  ⚠️ এই মাসের বাজার খরচ এখনো এন্ট্রি করা হয়নি, তাই স্বয়ংক্রিয় রেট ০৳ এসেছে। নিচের অপশন থেকে কাস্টম মিল রেট প্রয়োগ করতে পারেন।
                </p>
              )}
            </div>

            <div className="flex items-center gap-3 self-end md:self-auto">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={customRateEnabled}
                  onChange={(e) => setCustomRateEnabled(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span>কাস্টম মিল রেট প্রয়োগ করুন</span>
              </label>

              {customRateEnabled && (
                <div className="flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-xl border border-slate-200">
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={customRateInput}
                    onChange={(e) => setCustomRateInput(e.target.value)}
                    className="w-16 text-xs font-bold px-1 py-0.5 bg-white border border-slate-300 rounded text-center"
                  />
                  <span className="text-xs font-medium text-slate-600">৳/মিল</span>
                </div>
              )}
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 print:hidden">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              {/* Search */}
              <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="নাম বা রোল দিয়ে খুঁজুন..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Class Filter */}
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="ALL">সকল জামাত</option>
                {classesList.map((cName) => (
                  <option key={cName} value={cName}>
                    {cName}
                  </option>
                ))}
              </select>

              {/* Category Filter */}
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="ALL">সকল শিক্ষার্থী ও বোর্ডিং ধরন</option>
                <option value="BOARDING_ONLY">শুধুমাত্র বোর্ডিং ছাত্র</option>
                <option value="PAYING">সাধারণ পেইং ছাত্র</option>
                <option value="LILLAH">লিল্লাহ বোর্ডিং (ফ্রি)</option>
                <option value="HALF">হাফ-ফ্রি বোর্ডিং</option>
                <option value="NON_RESIDENTIAL">অনাবাসিক ছাত্র</option>
              </select>
            </div>

            <div className="text-xs font-semibold text-slate-500">
              তালিকাভুক্ত: <span className="text-slate-800 font-bold">{processedStudents.length}</span> জন
            </div>
          </div>

          {/* Detailed Printable Table */}
          <div className="bg-white rounded-3xl shadow-xs border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex justify-between items-center print:hidden">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-600" />
                <span>শিক্ষার্থীদের মাসিক মিল বিল রেজিস্টার</span>
              </h3>
              <div className="flex items-center gap-4 text-xs">
                <span className="text-slate-600">
                  মোট প্রদেয় বিল: <strong className="text-emerald-700">{filteredTotals.totalPayable.toLocaleString()} ৳</strong>
                </span>
                <span className="text-slate-600">
                  মোট লিল্লাহ ফান্ড: <strong className="text-purple-700">{filteredTotals.totalDiscount.toLocaleString()} ৳</strong>
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600 border-collapse">
                <thead className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-tight text-[11px]">
                  <tr>
                    <th className="px-4 py-3.5 border-b text-center w-16">রোল</th>
                    <th className="px-4 py-3.5 border-b">শিক্ষার্থীর নাম</th>
                    <th className="px-4 py-3.5 border-b">জামাত</th>
                    <th className="px-4 py-3.5 border-b">আবাসিক অবস্থা</th>
                    <th className="px-4 py-3.5 border-b">বোর্ডিং ক্যাটাগরি</th>
                    <th className="px-4 py-3.5 border-b text-center w-24">খাওয়া মিল</th>
                    <th className="px-4 py-3.5 border-b text-right w-24">গ্রস খরচ (৳)</th>
                    <th className="px-4 py-3.5 border-b text-right w-24">ছাড় / অনুদান</th>
                    <th className="px-4 py-3.5 border-b text-right w-28 text-emerald-800 font-extrabold">প্রদেয় বিল (৳)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {processedStudents.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-12 text-center text-slate-400">
                        কোনো শিক্ষার্থীর তথ্য পাওয়া যায়নি
                      </td>
                    </tr>
                  ) : (
                    processedStudents.map((student: any) => (
                      <tr key={student.id} className="hover:bg-slate-50/60 transition">
                        <td className="px-4 py-3 text-center font-bold text-slate-900">
                          {student.roll_number || "-"}
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-900">
                          <Link
                            href={`/dashboard/students/${student.id}`}
                            className="hover:text-emerald-600 transition"
                          >
                            {student.student_name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-600">
                          {student.class_name || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              student.residential_status === "আবাসিক"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : student.residential_status === "ডে-কেয়ার"
                                ? "bg-blue-50 text-blue-700 border border-blue-200"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {student.residential_status}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-700">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              student.boarding_type === "লিল্লাহ বোর্ডিং (ফ্রি)"
                                ? "bg-purple-50 text-purple-700 border border-purple-200"
                                : student.boarding_type === "হাফ-ফ্রি"
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : student.boarding_type === "সাধারণ পেইং"
                                ? "bg-slate-100 text-slate-800"
                                : "text-slate-400"
                            }`}
                          >
                            {student.boarding_type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-slate-900 font-bold text-sm">
                          {student.meals_count}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-600">
                          {student.calculated_gross.toLocaleString()} ৳
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-purple-700">
                          {student.calculated_discount > 0 ? (
                            <span>-{student.calculated_discount.toLocaleString()} ৳</span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-900 font-black text-sm">
                          {student.calculated_bill > 0 ? (
                            <span className="text-emerald-700">{student.calculated_bill.toLocaleString()} ৳</span>
                          ) : (
                            <span className="text-slate-400 font-semibold">০ ৳ (ফ্রি)</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot className="bg-slate-100/80 font-bold text-slate-900 border-t-2 border-slate-300">
                  <tr>
                    <td colSpan={5} className="px-4 py-3 text-right">
                      সর্বমোট যোগফল ({processedStudents.length} জন):
                    </td>
                    <td className="px-4 py-3 text-center text-sm font-black">
                      {filteredTotals.totalMeals} টি
                    </td>
                    <td className="px-4 py-3 text-right font-black">
                      {filteredTotals.totalGross.toLocaleString()} ৳
                    </td>
                    <td className="px-4 py-3 text-right font-black text-purple-800">
                      {filteredTotals.totalDiscount.toLocaleString()} ৳
                    </td>
                    <td className="px-4 py-3 text-right font-black text-emerald-800 text-sm">
                      {filteredTotals.totalPayable.toLocaleString()} ৳
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Print Signatures Block */}
            <div className="hidden print:flex justify-between items-end mt-16 pt-8 px-6 pb-6">
              <div className="text-center w-44 border-t-2 border-slate-800 pt-2">
                <p className="font-bold text-slate-900 text-xs">বোর্ডিং সুপারভাইজার</p>
              </div>
              <div className="text-center w-44 border-t-2 border-slate-800 pt-2">
                <p className="font-bold text-slate-900 text-xs">হিসাবরক্ষক</p>
              </div>
              <div className="text-center w-44 border-t-2 border-slate-800 pt-2">
                <p className="font-bold text-slate-900 text-xs">মুহতামিম / অধ্যক্ষ</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
