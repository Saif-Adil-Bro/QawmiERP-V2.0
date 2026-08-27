import React from "react";
import Link from "next/link";
import { 
  HeartHandshake, 
  FileText, 
  Users, 
  Layers, 
  PlusCircle, 
  TrendingUp, 
  Printer, 
  ArrowRight,
  ShieldCheck,
  Award,
  DollarSign
} from "lucide-react";
import { getFunds, getDonors, getDonations, getZakatReportStats } from "@/app/actions/zakat";
import { formatBanglaCurrency, toBanglaNumber } from "@/lib/numberToBangla";
import { getFundCategoryBadge, getDonorTypeBadge } from "@/lib/fund-utils";
import ZakatNav from "@/components/zakat/ZakatNav";

export default async function ZakatDashboardPage() {
  const [funds, donors, donations, stats] = await Promise.all([
    getFunds(),
    getDonors(),
    getDonations(),
    getZakatReportStats(),
  ]);

  const recentDonations = donations.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Top Navigation */}
      <ZakatNav totalFundsCount={funds.length} totalDonorsCount={donors.length} />

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              যাকাত ও অনুদান তহবিল ব্যবস্থাপনা
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
              সক্রিয় তহবিল
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            সাধারণ ফান্ড, লিল্লাহ ফান্ড, যাকাত ফান্ড ও কাস্টম ফান্ডের অনুদান সংগ্রহ এবং দাতাদের রেজিস্টার
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/dashboard/zakat/funds"
            className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer"
          >
            <Layers className="w-4 h-4 text-slate-600" />
            <span>ফান্ডসমূহ ({toBanglaNumber(funds.length)})</span>
          </Link>
          <Link
            href="/dashboard/zakat/collection"
            className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold transition shadow-xs cursor-pointer active:scale-98"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ অনুদান সংগ্রহ</span>
          </Link>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Funds Collected */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">সর্বমোট তহবিল কালেকশন</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-slate-900 font-mono">
            ৳ {formatBanglaCurrency(stats?.grandTotal || 0)}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            মোট {toBanglaNumber(donations.length)} টি অনুদান গ্রহণ সম্পন্ন
          </p>
        </div>

        {/* Active Funds */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">মোট ফান্ড ক্যাটাগরি</span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-indigo-900 font-mono">
            {toBanglaNumber(funds.length)} <span className="text-sm font-normal text-slate-500">টি ফান্ড</span>
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            সাধারণ, লিল্লাহ, যাকাত ও কাস্টম ফান্ড
          </p>
        </div>

        {/* Donors Registered */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">নিবন্ধিত সম্মানিত দাতা</span>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-purple-900 font-mono">
            {toBanglaNumber(donors.length)} <span className="text-sm font-normal text-slate-500">জন</span>
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            মাসিক: {toBanglaNumber(stats?.donorTypeStats?.monthly?.count || 0)} | বার্ষিক: {toBanglaNumber(stats?.donorTypeStats?.annual?.count || 0)}
          </p>
        </div>

        {/* Regular Collections */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">মাসিক দাতাদের আদায়</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-blue-900 font-mono">
            ৳ {formatBanglaCurrency(stats?.donorTypeStats?.monthly?.collected || 0)}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            নিয়মিত মাসিক অনুদান
          </p>
        </div>
      </div>

      {/* 4 Feature Module Shortcut Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/dashboard/zakat/funds" className="block group">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs group-hover:border-indigo-300 group-hover:shadow-md transition-all h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <Layers className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">ফান্ড ক্যাটাগরি</h3>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                সাধারণ, লিল্লাহ, যাকাত ও যেকোনো কাস্টম ফান্ড তৈরি ও পরিচালনা করুন।
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-indigo-600 group-hover:text-indigo-800">
              <span>ফান্ডসমূহ দেখুন</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </Link>

        <Link href="/dashboard/zakat/donors" className="block group">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs group-hover:border-purple-300 group-hover:shadow-md transition-all h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl group-hover:bg-purple-600 group-hover:text-white transition-colors">
                  <Users className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">দাতাদের তালিকা</h3>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                বার্ষিক, মাসিক ও এককালীন সম্মানিত দাতাদের রেজিস্টার ও যোগাযোগ।
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-purple-600 group-hover:text-purple-800">
              <span>দাতা তালিকা দেখুন</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </Link>

        <Link href="/dashboard/zakat/collection" className="block group">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs group-hover:border-emerald-300 group-hover:shadow-md transition-all h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <HeartHandshake className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">অনুদান সংগ্রহ</h3>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                নির্দিষ্ট ফান্ডে অনুদান গ্রহণ ও তাৎক্ষণিক A4 মানি রসিদ তৈরি করুন।
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-emerald-600 group-hover:text-emerald-800">
              <span>কালেকশন শুরু করুন</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </Link>

        <Link href="/dashboard/zakat/reports" className="block group">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs group-hover:border-amber-300 group-hover:shadow-md transition-all h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl group-hover:bg-amber-600 group-hover:text-white transition-colors">
                  <FileText className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">তহবিল অডিট রিপোর্ট</h3>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                ফান্ডভিত্তিক বিস্তারিত আয় বিবরণী, চার্ট ও প্রিন্ট সুবিধা।
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-amber-600 group-hover:text-amber-800">
              <span>রিপোর্টস দেখুন</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </Link>
      </div>

      {/* Main Bottom Section: Fund Breakdown Left, Recent Collections Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Funds Summary Breakdown (6 Cols) */}
        <div className="lg:col-span-6 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-600" />
              <span>ফান্ডভিত্তিক কালেকশন স্থিতি</span>
            </h2>
            <Link
              href="/dashboard/zakat/funds"
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
            >
              সকল ফান্ড ({toBanglaNumber(funds.length)})
            </Link>
          </div>

          <div className="space-y-3">
            {(stats?.fundBreakdown || []).slice(0, 6).map((fb: any, idx: number) => {
              const badge = getFundCategoryBadge(fb.category);
              const grand = stats?.grandTotal || 1;
              const percent = Math.round((fb.total / (grand > 0 ? grand : 1)) * 100);

              return (
                <div key={idx} className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/70 hover:bg-slate-100/70 transition">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">{fb.name}</span>
                      <span className={`px-2 py-0.2 rounded-full text-[10px] font-bold ${badge.bg} ${badge.text}`}>
                        {badge.label}
                      </span>
                    </div>
                    <span className="font-black text-emerald-900 font-mono text-sm">
                      ৳ {formatBanglaCurrency(fb.total)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                    <span>{toBanglaNumber(fb.count)} বার অনুদান প্রাপ্তি</span>
                    <span className="font-bold text-slate-700">{toBanglaNumber(percent)}% অংশ</span>
                  </div>

                  <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-emerald-600 h-1.5 rounded-full"
                      style={{ width: `${percent}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Donations (6 Cols) */}
        <div className="lg:col-span-6 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <HeartHandshake className="w-5 h-5 text-emerald-600" />
              <span>সাম্প্রতিক অনুদান ও রসিদসমূহ</span>
            </h2>
            <Link
              href="/dashboard/zakat/collection"
              className="text-xs font-bold text-emerald-600 hover:text-emerald-800"
            >
              সবগুলো কালেকশন
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {recentDonations.map((donation) => (
              <div key={donation.id} className="py-3 flex items-center justify-between gap-3 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-slate-900 text-sm truncate">
                      {donation.donors?.name || "সাধারণ দাতা"}
                    </h4>
                    <span className="text-[10px] px-2 py-0.2 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold truncate">
                      {donation.fund_name || donation.donation_type}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                    <span>{toBanglaNumber(new Date(donation.donation_date).toLocaleDateString("en-GB"))}</span>
                    <span>• রসিদ: {donation.receipt_no || "ZR-Auto"}</span>
                  </div>
                </div>

                <div className="text-right shrink-0 flex items-center gap-3">
                  <div className="font-black text-emerald-800 font-mono text-sm">
                    ৳ {formatBanglaCurrency(donation.amount)}
                  </div>
                  <Link
                    href={`/dashboard/zakat/collection/${donation.id}/receipt`}
                    className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition"
                    title="মানি রসিদ দেখুন"
                  >
                    <Printer className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ))}

            {recentDonations.length === 0 && (
              <div className="py-8 text-center text-slate-500">
                <p className="text-sm font-semibold text-slate-700">এখনও কোনো অনুদান জমা হয়নি</p>
                <Link
                  href="/dashboard/zakat/collection"
                  className="text-xs text-emerald-600 font-bold hover:underline mt-1 inline-block"
                >
                  + প্রথম অনুদান সংগ্রহ করুন
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
