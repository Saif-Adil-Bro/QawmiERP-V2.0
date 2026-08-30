import Link from "next/link";
import {
  Wallet,
  Receipt,
  FileBarChart,
  CreditCard,
  Layers,
  Sparkles,
  Clock,
  History,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  Plus,
  CheckCircle2,
} from "lucide-react";
import { getFeeDashboardOverview } from "@/app/actions/fee-management";
import { formatBanglaCurrency, toBanglaNumber } from "@/lib/numberToBangla";

export default async function AccountingDashboardPage() {
  const overviewData = await getFeeDashboardOverview();
  const overview = overviewData || {
    totalCollected: 0,
    totalDue: 0,
    thisMonthCollection: 0,
    todayCollection: 0,
    totalPaymentsCount: 0,
    totalStudentsCount: 0,
    recentPayments: [],
    typeBreakdown: {},
    methodBreakdown: {},
    auditLogs: [],
  };

  const totalDemand = (overview.totalCollected || 0) + (overview.totalDue || 0);
  const collectionRate = totalDemand > 0 ? Math.round(((overview.totalCollected || 0) / totalDemand) * 100) : 100;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header & Quick Action Hub */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">হিসাবরক্ষণ ও ফি ম্যানেজমেন্ট</h1>
          <p className="text-slate-500 text-xs sm:text-sm">
            শিক্ষার্থীদের ফি আদায়, বকেয়া ট্র্যাকিং, মাসিক চার্জ এবং মাদরাসার আয়-ব্যয়
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/dashboard/accounting/fees/new"
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>ফি আদায় করুন</span>
          </Link>

          <Link
            href="/dashboard/accounting/generate"
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>মাসিক ফি জেনারেট</span>
          </Link>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Collected */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              চলতি মাসের আদায়
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-950 font-mono">
            ৳ {formatBanglaCurrency(overview.thisMonthCollection)}
          </div>
          <span className="text-[11px] text-emerald-700 font-medium block">
            সর্বমোট আদায়: ৳ {formatBanglaCurrency(overview.totalCollected)}
          </span>
        </div>

        {/* Total Due */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              সর্বমোট বকেয়া
            </span>
            <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-red-700 font-mono">
            ৳ {formatBanglaCurrency(overview.totalDue)}
          </div>
          <Link
            href="/dashboard/accounting/due"
            className="text-[11px] text-red-600 font-bold hover:underline flex items-center gap-1"
          >
            <span>বকেয়া তালিকা দেখুন</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {/* Collection Rate */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              আদায় হার (Rate)
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
            {toBanglaNumber(collectionRate)}%
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all"
              style={{ width: `${Math.min(100, collectionRate)}%` }}
            />
          </div>
        </div>

        {/* Total Students */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              মোট শিক্ষার্থী
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
            {toBanglaNumber(overview.totalStudentsCount)} জন
          </div>
          <span className="text-[11px] text-slate-500 font-medium block">
            মোট রসিদ: {toBanglaNumber(overview.totalPaymentsCount)} টি
          </span>
        </div>
      </div>

      {/* Modules Navigation Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* 1. Fee Collection */}
        <Link href="/dashboard/accounting/fees/new" className="block group">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs hover:shadow-md hover:border-emerald-300 transition h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center space-x-3 mb-3">
                <div className="bg-emerald-50 p-3 rounded-2xl group-hover:bg-emerald-100 transition text-emerald-600">
                  <CreditCard className="w-6 h-6" />
                </div>
                <h2 className="text-base font-bold text-slate-900 group-hover:text-emerald-700 transition">
                  ফি আদায় ও কালেকশন
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                শিক্ষার্থীর বকেয়া চার্জ থেকে ফি গ্রহণ, ছাড় সমন্বয় এবং A4 ডাবল মানি রিসিট প্রিন্ট করুন।
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-emerald-700">
              <span>ফি আদায় করুন</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
            </div>
          </div>
        </Link>

        {/* 2. Monthly Fee Generator */}
        <Link href="/dashboard/accounting/generate" className="block group">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs hover:shadow-md hover:border-slate-400 transition h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center space-x-3 mb-3">
                <div className="bg-indigo-50 p-3 rounded-2xl group-hover:bg-indigo-100 transition text-indigo-600">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h2 className="text-base font-bold text-slate-900 group-hover:text-indigo-700 transition">
                  মাসিক ফি জেনারেট
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                এক ক্লিকে সকল শিক্ষার্থী বা জামাতের জন্য হিজরি/ইংরেজি মাস অনুযায়ী অটোমেটিক চার্জ তৈরি করুন।
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-indigo-700">
              <span>ফি জেনারেটর খুলুন</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
            </div>
          </div>
        </Link>

        {/* 3. Due Tracking & Aging */}
        <Link href="/dashboard/accounting/due" className="block group">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs hover:shadow-md hover:border-amber-400 transition h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center space-x-3 mb-3">
                <div className="bg-amber-50 p-3 rounded-2xl group-hover:bg-amber-100 transition text-amber-600">
                  <Clock className="w-6 h-6" />
                </div>
                <h2 className="text-base font-bold text-slate-900 group-hover:text-amber-700 transition">
                  বকেয়া ফি ও ডিউ ট্র্যাকিং
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                ০-৩০, ৩১-৬০, ৬১-৯০ ও ৯০+ দিনের বকেয়া এজিং পর্যবেক্ষণ করুন এবং সরাসরি তাগিদ তালিকা প্রিন্ট করুন।
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-amber-700">
              <span>বকেয়া রিপোর্ট দেখুন</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
            </div>
          </div>
        </Link>

        {/* 4. Fee Structures */}
        <Link href="/dashboard/accounting/structure" className="block group">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs hover:shadow-md hover:border-blue-400 transition h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center space-x-3 mb-3">
                <div className="bg-blue-50 p-3 rounded-2xl group-hover:bg-blue-100 transition text-blue-600">
                  <Layers className="w-6 h-6" />
                </div>
                <h2 className="text-base font-bold text-slate-900 group-hover:text-blue-700 transition">
                  ফি কাঠামো ও ফি টাইপ
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                জামাত ও শিক্ষাবর্ষভিত্তিক মাসিক বেতন, ভর্তি ফি এবং বিভিন্ন খাতের স্ট্যান্ডার্ড চার্ট তৈরি করুন।
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-blue-700">
              <span>কাঠামো কনফিগারেশন</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
            </div>
          </div>
        </Link>

        {/* 5. Payments History & Audit Logs */}
        <Link href="/dashboard/accounting/payments" className="block group">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs hover:shadow-md hover:border-slate-400 transition h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center space-x-3 mb-3">
                <div className="bg-slate-100 p-3 rounded-2xl group-hover:bg-slate-200 transition text-slate-700">
                  <History className="w-6 h-6" />
                </div>
                <h2 className="text-base font-bold text-slate-900 group-hover:text-slate-800 transition">
                  পেমেন্ট হিস্ট্রি ও অডিট
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                সকল আদায়কৃত রিসিটের বিবরণ, পেমেন্ট রিভার্সাল এবং লেনদেনের অডিট ট্রেইল চেক করুন।
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-700">
              <span>হিস্ট্রি ও লগ দেখুন</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
            </div>
          </div>
        </Link>

        {/* 6. Expenses */}
        <Link href="/dashboard/accounting/expenses" className="block group">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs hover:shadow-md hover:border-red-300 transition h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center space-x-3 mb-3">
                <div className="bg-red-50 p-3 rounded-2xl group-hover:bg-red-100 transition text-red-600">
                  <Receipt className="w-6 h-6" />
                </div>
                <h2 className="text-base font-bold text-slate-900 group-hover:text-red-700 transition">
                  খরচ (Expense)
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                মাদরাসার দৈনন্দিন খরচ, শিক্ষক-স্টাফদের বেতন এবং অন্যান্য ব্যয়ের এন্ট্রি করুন।
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-red-700">
              <span>খরচ পরিচালনা করুন</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
            </div>
          </div>
        </Link>

        {/* 7. Accounting Reports */}
        <Link href="/dashboard/accounting/reports" className="block group">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs hover:shadow-md hover:border-purple-300 transition h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center space-x-3 mb-3">
                <div className="bg-purple-50 p-3 rounded-2xl group-hover:bg-purple-100 transition text-purple-600">
                  <FileBarChart className="w-6 h-6" />
                </div>
                <h2 className="text-base font-bold text-slate-900 group-hover:text-purple-700 transition">
                  আয়-ব্যয়ের রিপোর্ট
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                মাসিক ও বাৎসরিক আয়-ব্যয়ের লাভ-ক্ষতি বিবরণী ও অডিট রিপোর্ট দেখুন ও প্রিন্ট করুন।
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-purple-700">
              <span>রিপোর্ট দেখুন</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
            </div>
          </div>
        </Link>

        {/* 8. Money Receipts */}
        <Link href="/dashboard/accounting/receipts" className="block group">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs hover:shadow-md hover:border-emerald-400 transition h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center space-x-3 mb-3">
                <div className="bg-emerald-50 p-3 rounded-2xl group-hover:bg-emerald-100 transition text-emerald-600">
                  <Receipt className="w-6 h-6" />
                </div>
                <h2 className="text-base font-bold text-slate-900 group-hover:text-emerald-700 transition">
                  মানি রিসিট ভিউয়ার
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                পূর্বে সংগৃহীত যেকোনো ফি এর রিসিট A4 ডাবল বা সিঙ্গেল কপিতে রি-প্রিন্ট করুন।
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-emerald-700">
              <span>রিসিট বুক খুলুন</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
