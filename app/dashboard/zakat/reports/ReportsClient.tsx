"use client";

import React, { useState } from "react";
import { 
  FileText, 
  Printer, 
  TrendingUp, 
  Layers, 
  Users, 
  HeartHandshake, 
  Calendar, 
  Filter,
  CheckCircle,
  Clock,
  PieChart
} from "lucide-react";
import { FundItem, DonorItem, DonationItem, getFundCategoryBadge, getDonorTypeBadge } from "@/lib/fund-utils";
import { formatBanglaCurrency, toBanglaNumber } from "@/lib/numberToBangla";

interface ReportsClientProps {
  stats: any;
  funds: FundItem[];
  donors: DonorItem[];
  donations: DonationItem[];
  madrasaInfo: any;
}

export default function ReportsClient({
  stats,
  funds,
  donors,
  donations,
  madrasaInfo,
}: ReportsClientProps) {
  const [selectedFund, setSelectedFund] = useState("ALL");
  const [selectedDonorType, setSelectedDonorType] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const filteredDonations = donations.filter(d => {
    const matchesFund = selectedFund === "ALL" || d.donation_type === selectedFund || d.fund_name === selectedFund;
    const matchesType = selectedDonorType === "ALL" || (d.donors?.donor_type || "OneTime") === selectedDonorType;
    const matchesStart = !startDate || d.donation_date >= startDate;
    const matchesEnd = !endDate || d.donation_date <= endDate;
    return matchesFund && matchesType && matchesStart && matchesEnd;
  });

  const totalFilteredAmount = filteredDonations.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs print:hidden">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            যাকাত ও ফান্ড বিস্তারিত অডিট রিপোর্ট
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            ফান্ডভিত্তিক আদায়, দাতার ধরনভিত্তিক বিশ্লেষণ এবং কাস্টম তারিখ ভিত্তিক রিপোর্ট
          </p>
        </div>

        <button
          type="button"
          onClick={handlePrint}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs sm:text-sm font-bold hover:bg-slate-800 transition shadow-xs cursor-pointer active:scale-98"
        >
          <Printer className="w-4 h-4 text-emerald-400" />
          <span>রিপোর্ট প্রিন্ট করুন</span>
        </button>
      </div>

      {/* Printable Report Header */}
      <div className="hidden print:block text-center border-b border-slate-300 pb-4 mb-6">
        <h2 className="text-xl font-bold text-slate-900">{madrasaInfo?.name || "আল জামিয়া ইসলামিয়া মাদরাসা"}</h2>
        <p className="text-xs text-slate-600">{madrasaInfo?.address}</p>
        <h3 className="text-base font-bold text-slate-800 mt-2 underline">যাকাত ও ফান্ড কালেকশন রিপোর্ট</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          প্রিন্টের তারিখ: {toBanglaNumber(new Date().toLocaleDateString("en-GB"))}
        </p>
      </div>

      {/* Top Level Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">সর্বমোট ফান্ড কালেকশন</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-slate-900 font-mono">
            ৳ {formatBanglaCurrency(stats?.grandTotal || totalFilteredAmount)}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            মোট {toBanglaNumber(donations.length)} টি অনুদান রসিদ
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">মাসিক দাতাদের আদায়</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-blue-900 font-mono">
            ৳ {formatBanglaCurrency(stats?.donorTypeStats?.monthly?.collected || 0)}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            {toBanglaNumber(stats?.donorTypeStats?.monthly?.count || 0)} জন নিয়মিত মাসিক দাতা
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">বাৎসরিক দাতাদের আদায়</span>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-purple-900 font-mono">
            ৳ {formatBanglaCurrency(stats?.donorTypeStats?.annual?.collected || 0)}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            {toBanglaNumber(stats?.donorTypeStats?.annual?.count || 0)} জন বার্ষিক দাতা
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">এককালীন ও যাকাত আদায়</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <HeartHandshake className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-amber-900 font-mono">
            ৳ {formatBanglaCurrency(stats?.donorTypeStats?.oneTime?.collected || 0)}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            {toBanglaNumber(stats?.donorTypeStats?.oneTime?.count || 0)} জন এককালীন অনুদানকারী
          </p>
        </div>
      </div>

      {/* Fund-wise Breakdown Grid */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-600" />
            <span>ফান্ডভিত্তিক কালেকশন বিবরণী</span>
          </h2>
          <span className="text-xs text-slate-500">
            {toBanglaNumber(stats?.fundBreakdown?.length || funds.length)} টি ফান্ড
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(stats?.fundBreakdown || []).map((fb: any, idx: number) => {
            const grand = stats?.grandTotal || 1;
            const percentage = Math.round((fb.total / (grand > 0 ? grand : 1)) * 100);

            return (
              <div key={idx} className="p-4 rounded-xl border border-slate-100 bg-slate-50/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-900">{fb.name}</span>
                  <span className="text-xs font-bold text-slate-600 font-mono">{toBanglaNumber(percentage)}%</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-base font-black text-emerald-900 font-mono">
                    ৳ {formatBanglaCurrency(fb.total)}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {toBanglaNumber(fb.count)} বার আদায়
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-emerald-600 h-1.5 rounded-full"
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filter Box (Hidden in Print) */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3 print:hidden">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
          <Filter className="w-4 h-4 text-slate-500" />
          <span>কাস্টম ফিল্টারিং ও অনুসন্ধান:</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">ফান্ড নির্বাচন</label>
            <select
              value={selectedFund}
              onChange={(e) => setSelectedFund(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium bg-white"
            >
              <option value="ALL">সকল ফান্ড</option>
              {funds.map(f => (
                <option key={f.id} value={f.name}>{f.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">দাতার ধরন</label>
            <select
              value={selectedDonorType}
              onChange={(e) => setSelectedDonorType(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium bg-white"
            >
              <option value="ALL">সকল ধরন (মাসিক/বার্ষিক/এককালীন)</option>
              <option value="Monthly">মাসিক দাতা</option>
              <option value="Annual">বার্ষিক দাতা</option>
              <option value="OneTime">এককালীন দাতা</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">শুরুর তারিখ</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">শেষ তারিখ</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs"
            />
          </div>
        </div>
      </div>

      {/* Filtered Transactions Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:px-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">অনুদান কালেকশন লগ ও তালিকা</h3>
            <p className="text-xs text-slate-500">
              ফিল্টার অনুযায়ী মোট {toBanglaNumber(filteredDonations.length)} টি রেকর্ড
            </p>
          </div>
          <div className="font-bold text-sm text-emerald-800 font-mono">
            নির্বাচিত মোট: ৳ {formatBanglaCurrency(totalFilteredAmount)}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-4 sm:px-6">তারিখ ও রসিদ</th>
                <th className="py-3 px-4">দাতার নাম ও যোগাযোগ</th>
                <th className="py-3 px-4">দাতার ধরন</th>
                <th className="py-3 px-4">জমার ফান্ড</th>
                <th className="py-3 px-4">মাধ্যম</th>
                <th className="py-3 px-4 sm:px-6 text-right">পরিমাণ ৳</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {filteredDonations.map((d) => {
                const donorBadge = getDonorTypeBadge(d.donors?.donor_type);
                return (
                  <tr key={d.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4 sm:px-6">
                      <div className="font-bold text-slate-900">
                        {toBanglaNumber(new Date(d.donation_date).toLocaleDateString("en-GB"))}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400">
                        {d.receipt_no || "ZR-Auto"}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{d.donors?.name || "সাধারণ দাতা"}</div>
                      {d.donors?.phone && (
                        <div className="text-[11px] text-slate-500 font-mono">{toBanglaNumber(d.donors.phone)}</div>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${donorBadge.bg} ${donorBadge.text}`}>
                        {donorBadge.label}
                      </span>
                    </td>

                    <td className="py-3 px-4 font-semibold text-slate-800">
                      {d.fund_name || d.donation_type}
                    </td>

                    <td className="py-3 px-4 text-slate-600">
                      {d.payment_method || "Cash"}
                    </td>

                    <td className="py-3 px-4 sm:px-6 text-right font-black text-emerald-800 font-mono text-sm">
                      ৳ {formatBanglaCurrency(d.amount)}
                    </td>
                  </tr>
                );
              })}

              {filteredDonations.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500">
                    কোনো তথ্য পাওয়া যায়নি
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
