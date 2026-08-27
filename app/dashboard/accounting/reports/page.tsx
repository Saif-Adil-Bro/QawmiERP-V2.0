"use client";

import { useState, useEffect } from "react";
import { getAccountingReport } from "@/app/actions/accounting";
import { getFunds } from "@/app/actions/zakat";
import { FundItem, DEFAULT_FUNDS } from "@/lib/fund-utils";
import { ArrowLeft, FileText, TrendingUp, TrendingDown, Wallet, Landmark } from "lucide-react";
import Link from "next/link";
import { getMadrasaProfileWithLogo } from "@/app/actions/tenant";
import PrintLetterpad from "@/app/components/PrintLetterpad";

export default function AccountingReportPage() {
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  
  const [month, setMonth] = useState<string>(currentMonth.toString());
  const [year, setYear] = useState<string>(currentYear.toString());
  const [selectedFundId, setSelectedFundId] = useState<string>("all");
  const [funds, setFunds] = useState<FundItem[]>(DEFAULT_FUNDS);
  
  const [report, setReport] = useState<{ totalIncome: number; totalExpense: number; netBalance: number; fundStats?: any[] } | null>(null);
  const [loading, setLoading] = useState(false);
  
  const [madrasaInfo, setMadrasaInfo] = useState<any>(null);
  const [logoUrl, setLogoUrl] = useState<string>("");

  useEffect(() => {
    async function loadInitialData() {
      try {
        const [res, fundsList] = await Promise.all([
          getMadrasaProfileWithLogo(),
          getFunds(),
        ]);
        if (res) {
          setMadrasaInfo(res.madrasa);
          setLogoUrl(res.logoUrl);
        }
        if (fundsList && fundsList.length > 0) {
          setFunds(fundsList);
        }
      } catch (e) {
        console.error("Error loading profile or funds:", e);
      }
    }
    loadInitialData();
  }, []);

  useEffect(() => {
    async function loadReport() {
      setLoading(true);
      const data = await getAccountingReport(month, year, selectedFundId);
      setReport(data);
      setLoading(false);
    }
    loadReport();
  }, [month, year, selectedFundId]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4 print:hidden">
        <Link
          href="/dashboard/accounting"
          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">আয়-ব্যয়ের রিপোর্ট ও ফান্ড সমন্বয়</h1>
          <p className="text-slate-500 text-sm">মাসিক ও ফান্ডভিত্তিক আয়-ব্যয়ের পরিসংখ্যান</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-6 print:shadow-none print:border-none print:p-0">
        <div className="flex flex-col md:flex-row gap-4 items-end mb-8 print:hidden">
          <div className="w-full md:w-auto">
            <label className="block text-sm font-medium text-slate-700 mb-1">ফান্ড ফিল্টার</label>
            <select
              value={selectedFundId}
              onChange={(e) => setSelectedFundId(e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 transition font-semibold text-slate-800"
            >
              <option value="all">সকল ফান্ড একনজরে (All Funds)</option>
              {funds.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          <div className="w-full md:w-auto">
            <label className="block text-sm font-medium text-slate-700 mb-1">মাস</label>
            <select 
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
            >
              <option value="1">জানুয়ারি</option>
              <option value="2">ফেব্রুয়ারি</option>
              <option value="3">মার্চ</option>
              <option value="4">এপ্রিল</option>
              <option value="5">মে</option>
              <option value="6">জুন</option>
              <option value="7">জুলাই</option>
              <option value="8">আগস্ট</option>
              <option value="9">সেপ্টেম্বর</option>
              <option value="10">অক্টোবর</option>
              <option value="11">নভেম্বর</option>
              <option value="12">ডিসেম্বর</option>
            </select>
          </div>

          <div className="w-full md:w-auto">
            <label className="block text-sm font-medium text-slate-700 mb-1">বছর</label>
            <select 
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
            >
              <option value={(currentYear - 1).toString()}>{currentYear - 1}</option>
              <option value={currentYear.toString()}>{currentYear}</option>
              <option value={(currentYear + 1).toString()}>{currentYear + 1}</option>
            </select>
          </div>
          
          <div className="ml-auto w-full md:w-auto">
            <button 
              onClick={handlePrint}
              className="w-full md:w-auto flex items-center justify-center space-x-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 transition font-medium cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              <span>প্রিন্ট করুন</span>
            </button>
          </div>
        </div>

        <PrintLetterpad madrasaInfo={madrasaInfo} logoUrl={logoUrl}>
          <div className="mb-6 text-center border-b border-slate-100 pb-4">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-800">
              {selectedFundId !== "all" 
                ? `${funds.find(f => f.id === selectedFundId)?.name || "ফান্ড"} - আয়-ব্যয় রিপোর্ট`
                : "মাসিক সাধারণ ও ফান্ডভিত্তিক হিসাবরক্ষণ রিপোর্ট"}
            </h2>
            <p className="text-slate-500 font-semibold text-xs mt-1.5">
              মাস: {month === "1" ? "জানুয়ারি" : month === "2" ? "ফেব্রুয়ারি" : month === "3" ? "মার্চ" : month === "4" ? "এপ্রিল" : month === "5" ? "মে" : month === "6" ? "জুন" : month === "7" ? "জুলাই" : month === "8" ? "আগস্ট" : month === "9" ? "সেপ্টেম্বর" : month === "10" ? "অক্টোবর" : month === "11" ? "নভেম্বর" : "ডিসেম্বর"} / বছর: {year}
            </p>
          </div>

          {loading ? (
            <div className="py-12 text-center text-slate-500">রিপোর্ট তৈরি হচ্ছে...</div>
          ) : report ? (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-6 print:border-2 print:border-black print:bg-white">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-emerald-600 print:text-black font-medium">মোট আয় (Income)</div>
                    <TrendingUp className="w-6 h-6 text-emerald-600 print:text-black" />
                  </div>
                  <div className="text-3xl font-bold text-emerald-900 print:text-black">
                    ৳ {report.totalIncome.toLocaleString('bn-BD')}
                  </div>
                </div>

                <div className="bg-red-50 border border-red-100 rounded-xl p-6 print:border-2 print:border-black print:bg-white">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-red-600 print:text-black font-medium">মোট ব্যয় (Expense)</div>
                    <TrendingDown className="w-6 h-6 text-red-600 print:text-black" />
                  </div>
                  <div className="text-3xl font-bold text-red-900 print:text-black">
                    ৳ {report.totalExpense.toLocaleString('bn-BD')}
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 print:border-2 print:border-black print:bg-white">
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-blue-600 print:text-black font-medium">নিট ব্যালেন্স (Balance)</div>
                    <Wallet className="w-6 h-6 text-blue-600 print:text-black" />
                  </div>
                  <div className={`text-3xl font-bold ${report.netBalance >= 0 ? 'text-blue-900 print:text-black' : 'text-red-600 print:text-black'}`}>
                    {report.netBalance < 0 ? '-' : ''}৳ {Math.abs(report.netBalance).toLocaleString('bn-BD')}
                  </div>
                </div>
              </div>

              {/* Fund-wise Reconciliation Breakdown Table */}
              {report.fundStats && report.fundStats.length > 0 && selectedFundId === "all" && (
                <div className="border border-slate-200 rounded-xl overflow-hidden print:border-black">
                  <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center gap-2 print:bg-white print:border-black">
                    <Landmark className="w-4 h-4 text-emerald-700 print:hidden" />
                    <h3 className="font-bold text-slate-800 text-sm sm:text-base print:text-black">
                      ফান্ডভিত্তিক আয়-ব্যয়ের পুঙ্খানুপুঙ্খ সমন্বয় (Fund Reconciliation)
                    </h3>
                  </div>
                  <table className="w-full text-left text-xs sm:text-sm border-collapse">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 print:bg-slate-200 print:border-black">
                      <tr>
                        <th className="py-2.5 px-4">ফান্ডের নাম</th>
                        <th className="py-2.5 px-4 text-right">আদায় / জমা (৳)</th>
                        <th className="py-2.5 px-4 text-right">ব্যয় / খরচ (৳)</th>
                        <th className="py-2.5 px-4 text-right">অবশিষ্ট ব্যালেন্স (৳)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 print:divide-black">
                      {report.fundStats.map((f: any) => (
                        <tr key={f.fund_id} className="hover:bg-slate-50/60 transition">
                          <td className="py-2.5 px-4 font-semibold text-slate-900 print:text-black">
                            {f.fund_name}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-800 print:text-black">
                            ৳ {f.income.toLocaleString('bn-BD')}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-red-700 print:text-black">
                            ৳ {f.expense.toLocaleString('bn-BD')}
                          </td>
                          <td className={`py-2.5 px-4 text-right font-mono font-bold ${f.balance >= 0 ? "text-blue-900" : "text-red-600"} print:text-black`}>
                            {f.balance < 0 ? "-" : ""}৳ {Math.abs(f.balance).toLocaleString('bn-BD')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 font-bold border-t-2 border-slate-300 print:border-black">
                        <td className="py-2.5 px-4 text-slate-900 print:text-black">সর্বমোট:</td>
                        <td className="py-2.5 px-4 text-right font-mono text-emerald-900 font-black print:text-black">
                          ৳ {report.totalIncome.toLocaleString('bn-BD')}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-red-950 font-black print:text-black">
                          ৳ {report.totalExpense.toLocaleString('bn-BD')}
                        </td>
                        <td className={`py-2.5 px-4 text-right font-mono font-black ${report.netBalance >= 0 ? "text-blue-950" : "text-red-700"} print:text-black`}>
                          {report.netBalance < 0 ? "-" : ""}৳ {Math.abs(report.netBalance).toLocaleString('bn-BD')}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              <div className="border-t border-slate-200 pt-8 print:border-black">
                <h3 className="text-lg font-bold text-slate-800 mb-4 print:text-black">রিপোর্টের সারসংক্ষেপ</h3>
                <p className="text-slate-600 print:text-black">
                  {month}/{year} মাসে মাদরাসার মোট আয় হয়েছে <strong>৳{report.totalIncome.toLocaleString('bn-BD')}</strong> এবং মোট ব্যয় হয়েছে <strong>৳{report.totalExpense.toLocaleString('bn-BD')}</strong>। 
                  মাসের শেষে নিট ব্যালেন্স দাঁড়াচ্ছে <strong className={report.netBalance >= 0 ? 'text-emerald-600 print:text-black' : 'text-red-600 print:text-black'}>
                    {report.netBalance < 0 ? '-' : ''}৳{Math.abs(report.netBalance).toLocaleString('bn-BD')}
                  </strong>।
                </p>
              </div>
            </div>
          ) : null}
        </PrintLetterpad>
      </div>
    </div>
  );
}
