"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Search,
  Filter,
  FileText,
  Printer,
  TrendingUp,
  Wallet,
  Landmark,
  Receipt,
  Users,
  Calendar,
  Sparkles,
  Layers,
  ArrowUpRight,
  ExternalLink,
  ChevronRight,
  CheckCircle2,
  DollarSign
} from "lucide-react";
import { FundItem, getFundCategoryBadge, getPaymentMethodName } from "@/lib/fund-utils";
import { formatBanglaCurrency, toBanglaNumber } from "@/lib/numberToBangla";
import { UnifiedIncomeOverview, UnifiedIncomeTransaction } from "@/app/actions/accounting";
import PrintLetterpad from "@/app/components/PrintLetterpad";
import { printElementIsolated } from "@/lib/printUtils";
import { format } from "date-fns";

interface IncomeHistoryClientProps {
  initialData: UnifiedIncomeOverview;
  madrasaInfo: any;
  logoUrl: string;
}

export default function IncomeHistoryClient({
  initialData,
  madrasaInfo,
  logoUrl,
}: IncomeHistoryClientProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFundId, setSelectedFundId] = useState<string>("ALL");
  const [selectedSourceType, setSelectedSourceType] = useState<string>("ALL");
  const [dateFilter, setDateFilter] = useState<string>("ALL");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");

  const todayStr = new Date().toISOString().split("T")[0];
  const currentMonthStr = todayStr.substring(0, 7);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return initialData.transactions.filter((t) => {
      // Search term
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matchesName = t.source_name.toLowerCase().includes(q);
        const matchesDetails = (t.source_details || "").toLowerCase().includes(q);
        const matchesReceipt = t.receipt_no.toLowerCase().includes(q);
        const matchesCategory = t.category.toLowerCase().includes(q);
        const matchesNotes = (t.notes || "").toLowerCase().includes(q);
        const matchesFund = t.fund_name.toLowerCase().includes(q);
        if (!matchesName && !matchesDetails && !matchesReceipt && !matchesCategory && !matchesNotes && !matchesFund) {
          return false;
        }
      }

      // Fund filter
      if (selectedFundId !== "ALL" && t.fund_id !== selectedFundId) {
        return false;
      }

      // Source type filter
      if (selectedSourceType !== "ALL" && t.source_type !== selectedSourceType) {
        return false;
      }

      // Date filter
      if (dateFilter === "TODAY" && t.date !== todayStr) {
        return false;
      }
      if (dateFilter === "THIS_MONTH" && !t.date.startsWith(currentMonthStr)) {
        return false;
      }
      if (dateFilter === "CUSTOM") {
        if (customStartDate && t.date < customStartDate) return false;
        if (customEndDate && t.date > customEndDate) return false;
      }

      return true;
    });
  }, [
    initialData.transactions,
    searchTerm,
    selectedFundId,
    selectedSourceType,
    dateFilter,
    customStartDate,
    customEndDate,
    todayStr,
    currentMonthStr,
  ]);

  const filteredTotal = useMemo(() => {
    return filteredTransactions.reduce((sum, t) => sum + t.amount, 0);
  }, [filteredTransactions]);

  const handlePrint = () => {
    printElementIsolated("madrasa-income-history-print-root", "মাদরাসা_সর্বমোট_আয়_ও_ফান্ড_কালেকশন_হিস্ট্রি");
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs print:hidden">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="p-2.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            title="ড্যাশবোর্ডে ফিরে যান"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                মাদরাসার সর্বমোট আয় ও কালেকশন হিস্ট্রি
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                লাইভ ব্যালেন্স
              </span>
            </div>
            <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
              সকল ফান্ড, ছাত্র ফি, অনুদান, যাকাত ও বিভিন্ন উৎস থেকে প্রাপ্ত আয়ের পুঙ্খানুপুঙ্খ বিবরণ
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/dashboard/zakat/funds"
            className="flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs sm:text-sm font-semibold transition"
          >
            <Landmark className="w-4 h-4 text-emerald-600" />
            <span>ফান্ড ব্যবস্থাপনা</span>
          </Link>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition cursor-pointer"
          >
            <Printer className="w-4 h-4 text-emerald-400" />
            <span>আয় বিবরণী প্রিন্ট</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
        {/* Total Collected */}
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white p-5 rounded-2xl shadow-sm relative overflow-hidden">
          <div className="relative z-10 space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-100">
              সর্বমোট অর্জিত আয় ও ফান্ড
            </span>
            <div className="text-2xl sm:text-3xl font-black font-mono">
              ৳ {formatBanglaCurrency(initialData.totalIncome)}
            </div>
            <div className="text-[11px] text-emerald-100/90 flex items-center gap-1 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
              <span>সকল ফান্ড ও আয়ের উৎসের নিখুঁত যোগফল</span>
            </div>
          </div>
          <div className="absolute right-[-10px] bottom-[-10px] opacity-10 text-white pointer-events-none">
            <Wallet className="w-24 h-24" />
          </div>
        </div>

        {/* Student Fees */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              শিক্ষার্থী ফি আদায়
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
            ৳ {formatBanglaCurrency(initialData.sourceBreakdown.studentFees)}
          </div>
          <span className="text-[11px] text-slate-500 font-medium block">
            মাসিক বেতন, ভর্তি ও অন্যান্য ফি
          </span>
        </div>

        {/* Donations & Zakat */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              দান, সদকা ও যাকাত
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
            ৳ {formatBanglaCurrency(
              initialData.sourceBreakdown.donations +
              initialData.sourceBreakdown.subscriptions +
              initialData.sourceBreakdown.onlineDonations +
              initialData.sourceBreakdown.donationBoxes +
              initialData.sourceBreakdown.leatherSales +
              initialData.sourceBreakdown.mahfils
            )}
          </div>
          <span className="text-[11px] text-slate-500 font-medium block">
            শুভাকাঙ্ক্ষী, সদস্য ও মাহফিল তহবিল
          </span>
        </div>

        {/* Total Transactions */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              মোট আয় লেনদেন
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
            {toBanglaNumber(initialData.totalTransactions)} টি
          </div>
          <span className="text-[11px] text-slate-500 font-medium block">
            রসিদ ও ভাউচার এন্ট্রি
          </span>
        </div>
      </div>

      {/* Fund-wise Collection Breakdown Grid */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Landmark className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              ফান্ডভিত্তিক আয়ের পুঙ্খানুপুঙ্খ বিবরণ (Fund Breakdown)
            </h2>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            যেকোনো ফান্ডের কার্ডে ক্লিক করে সরাসরি ফিল্টার করুন
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
          {initialData.funds.map((fund: FundItem) => {
            const isSelected = selectedFundId === fund.id;
            const collected = Number(fund.total_collected || 0);
            const percentage = initialData.totalIncome > 0 ? Math.round((collected / initialData.totalIncome) * 100) : 0;
            const badge = getFundCategoryBadge(fund.category);

            return (
              <button
                key={fund.id}
                onClick={() => setSelectedFundId(isSelected ? "ALL" : fund.id)}
                className={`text-left p-4 rounded-xl border transition-all cursor-pointer relative ${
                  isSelected
                    ? "bg-emerald-50/70 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs"
                    : "bg-slate-50/50 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${badge.bg} ${badge.text}`}>
                    {badge.label}
                  </span>
                  <span className="text-[11px] font-bold text-slate-400 font-mono">
                    {percentage}%
                  </span>
                </div>

                <div className="font-bold text-slate-900 text-sm line-clamp-1">
                  {fund.name}
                </div>

                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-base font-black text-emerald-800 font-mono">
                    ৳ {formatBanglaCurrency(collected)}
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">
                    {toBanglaNumber(fund.donations_count || 0)} টি জমা
                  </span>
                </div>

                <div className="w-full bg-slate-200/80 rounded-full h-1.5 mt-2.5 overflow-hidden">
                  <div
                    className="bg-emerald-600 h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, percentage)}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Search, Filter & Controls Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4 print:hidden">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Search Box */}
          <div className="md:col-span-4 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="শিক্ষার্থী/দাতার নাম, রোল, রসিদ নং বা খাত খুঁজুন..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
            />
          </div>

          {/* Fund Filter */}
          <div className="md:col-span-3">
            <select
              value={selectedFundId}
              onChange={(e) => setSelectedFundId(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition bg-white text-slate-800 font-medium"
            >
              <option value="ALL">সকল ফান্ড (All Funds)</option>
              {initialData.funds.map((f: FundItem) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          {/* Source Type Filter */}
          <div className="md:col-span-3">
            <select
              value={selectedSourceType}
              onChange={(e) => setSelectedSourceType(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition bg-white text-slate-800 font-medium"
            >
              <option value="ALL">সকল আয়ের খাত (All Sources)</option>
              <option value="STUDENT_FEE">শিক্ষার্থী ফি (মাসিক বেতন/ভর্তি)</option>
              <option value="DONATION">অনুদান ও যাকাত</option>
              <option value="SUBSCRIPTION">আজীবন সদস্য ও মাসিক চাঁদা</option>
              <option value="MAHFIL">মাহফিল উদ্বৃত্ত</option>
              <option value="ONLINE">অনলাইন অনুদান</option>
              <option value="DONATION_BOX">দানবাক্স</option>
              <option value="LEATHER_SALE">কুরবানির চামড়া বিক্রয়</option>
            </select>
          </div>

          {/* Date Range Filter */}
          <div className="md:col-span-2">
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition bg-white text-slate-800 font-medium"
            >
              <option value="ALL">সকল সময়</option>
              <option value="TODAY">আজকের আয়</option>
              <option value="THIS_MONTH">চলতি মাস</option>
              <option value="CUSTOM">কাস্টম তারিখ</option>
            </select>
          </div>
        </div>

        {/* Custom Date Inputs if selected */}
        {dateFilter === "CUSTOM" && (
          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">হতে:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">পর্যন্ত:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        )}

        {/* Active Filters Summary */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-2 border-t border-slate-100">
          <div className="text-slate-500 flex items-center gap-1.5">
            <span>প্রদর্শিত লেনদেন: <strong className="text-slate-800 font-bold">{toBanglaNumber(filteredTransactions.length)}</strong> টি</span>
            <span>•</span>
            <span>মোট প্রদর্শিত পরিমাণ: <strong className="text-emerald-800 font-bold font-mono">৳ {formatBanglaCurrency(filteredTotal)}</strong></span>
          </div>

          {(searchTerm || selectedFundId !== "ALL" || selectedSourceType !== "ALL" || dateFilter !== "ALL") && (
            <button
              onClick={() => {
                setSearchTerm("");
                setSelectedFundId("ALL");
                setSelectedSourceType("ALL");
                setDateFilter("ALL");
                setCustomStartDate("");
                setCustomEndDate("");
              }}
              className="text-emerald-700 hover:text-emerald-800 font-semibold cursor-pointer underline"
            >
              সব ফিল্টার রিসেট করুন
            </button>
          )}
        </div>
      </div>

      {/* Main Income Transactions Table & Print View */}
      <div id="madrasa-income-history-print-root" className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden print:border-none print:shadow-none">
        <PrintLetterpad madrasaInfo={madrasaInfo} logoUrl={logoUrl}>
          <div className="p-4 sm:p-6 print:p-0">
            {/* Print Header */}
            <div className="hidden print:block text-center border-b-2 border-slate-800 pb-4 mb-4">
              <h2 className="text-xl font-black text-slate-900">
                মাদরাসার সার্বিক আয় ও ফান্ড কালেকশন বিবরণী
              </h2>
              <p className="text-xs text-slate-600 mt-1">
                তারিখ: {format(new Date(), "dd/MM/yyyy")} | সর্বমোট সংগৃহীত আয়: ৳ {formatBanglaCurrency(initialData.totalIncome)}
              </p>
            </div>

            {filteredTransactions.length === 0 ? (
              <div className="py-16 text-center text-slate-500 space-y-2">
                <Receipt className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="font-semibold text-slate-700">কোনো আয়ের লেনদেন পাওয়া যায়নি</p>
                <p className="text-xs text-slate-400">ফিল্টার পরিবর্তন করে পুনরায় চেষ্টা করুন</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 print:bg-slate-200">
                      <th className="py-3 px-3.5 whitespace-nowrap">ক্রম</th>
                      <th className="py-3 px-3.5 whitespace-nowrap">তারিখ</th>
                      <th className="py-3 px-3.5 whitespace-nowrap">রসিদ / ভাউচার</th>
                      <th className="py-3 px-3.5">উৎস / কার কাছ থেকে</th>
                      <th className="py-3 px-3.5">খাত / বিবরণ</th>
                      <th className="py-3 px-3.5">জমা ফান্ড</th>
                      <th className="py-3 px-3.5 whitespace-nowrap">মেথড</th>
                      <th className="py-3 px-3.5 text-right whitespace-nowrap">পরিমাণ (৳)</th>
                      <th className="py-3 px-3.5 text-right print:hidden">রসিদ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 print:divide-slate-300">
                    {filteredTransactions.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-3.5 text-slate-400 font-mono text-xs">
                          {toBanglaNumber(idx + 1)}
                        </td>
                        <td className="py-3 px-3.5 text-slate-600 whitespace-nowrap font-medium text-xs">
                          {item.date ? format(new Date(item.date), "dd/MM/yyyy") : "-"}
                        </td>
                        <td className="py-3 px-3.5 font-mono font-bold text-slate-800 text-xs whitespace-nowrap">
                          {item.receipt_no}
                        </td>
                        <td className="py-3 px-3.5">
                          <div className="font-bold text-slate-900">
                            {item.source_name}
                          </div>
                          {item.source_details && (
                            <div className="text-[11px] text-slate-500">
                              {item.source_details}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-800 border border-slate-200/60">
                            {item.category}
                          </span>
                          {item.notes && (
                            <span className="block text-[10px] text-slate-500 mt-0.5 line-clamp-1">
                              {item.notes}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3.5">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/60 whitespace-nowrap">
                            {item.fund_name}
                          </span>
                        </td>
                        <td className="py-3 px-3.5 text-slate-600 text-xs whitespace-nowrap">
                          {getPaymentMethodName(item.payment_method)}
                        </td>
                        <td className="py-3 px-3.5 text-right font-mono font-bold text-emerald-800 whitespace-nowrap">
                          ৳ {formatBanglaCurrency(item.amount)}
                        </td>
                        <td className="py-3 px-3.5 text-right print:hidden whitespace-nowrap">
                          {item.receipt_url ? (
                            <Link
                              href={item.receipt_url}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 font-semibold rounded-lg transition"
                              title="রসিদ দেখুন বা প্রিন্ট করুন"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>রসিদ</span>
                            </Link>
                          ) : (
                            <span className="text-slate-300 text-xs">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 font-bold border-t-2 border-slate-300 print:bg-slate-200">
                      <td colSpan={7} className="py-3 px-3.5 text-slate-900 text-right font-bold">
                        সর্বমোট আদায়কৃত পরিমাণ:
                      </td>
                      <td className="py-3 px-3.5 text-right font-mono font-black text-emerald-950 text-sm sm:text-base">
                        ৳ {formatBanglaCurrency(filteredTotal)}
                      </td>
                      <td className="print:hidden"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </PrintLetterpad>
      </div>
    </div>
  );
}
