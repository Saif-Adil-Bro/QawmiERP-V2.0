"use client";

import { useState } from "react";
import Link from "next/link";
import {
  FileSpreadsheet,
  Printer,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Building2,
  ShieldCheck,
  Scale,
  DollarSign,
  Download,
  Award,
  Layers,
} from "lucide-react";
import { toBanglaNumber, formatCurrencyBangla } from "@/lib/numberToBangla";
import { AnnualAuditStatement } from "@/app/actions/audit";

interface AuditStatementClientProps {
  initialStatement: AnnualAuditStatement | null;
  initialYear: string;
}

export default function AuditStatementClient({
  initialStatement,
  initialYear,
}: AuditStatementClientProps) {
  const [statement, setStatement] = useState<AnnualAuditStatement | null>(initialStatement);
  const [selectedYear, setSelectedYear] = useState<string>(initialYear);
  const [activeFundView, setActiveFundView] = useState<"all" | "general" | "lillah" | "zakat" | "building">("all");

  if (!statement) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
        <p className="text-slate-500">অডিট স্টেটমেন্ট ডেটা লোড করা সম্ভব হয়নি।</p>
      </div>
    );
  }

  const { funds, grandTotal } = statement;

  // Selected fund details based on tab
  const currentFund =
    activeFundView === "general"
      ? funds.generalFund
      : activeFundView === "lillah"
      ? funds.lillahFund
      : activeFundView === "zakat"
      ? funds.zakatFund
      : activeFundView === "building"
      ? funds.buildingFund
      : null;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Action Bar (Hidden in Print) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/accounting"
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Scale className="w-6 h-6 text-emerald-700" />
              <span>বার্ষিক অডিট স্টেটমেন্ট ও শুরা ব্যালেন্স শিট</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              সাধারণ ফান্ড, লিল্লাহ বোর্ডিং ও যাকাত ফান্ডের জন্য এক ক্লিকে বার্ষিক ব্যালেন্স শিট (শুরা ও দাতাদের জন্য)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Year selector */}
          <select
            value={selectedYear}
            onChange={(e) => {
              setSelectedYear(e.target.value);
              // Reload with year in query param
              window.location.href = `/dashboard/accounting/audit?year=${e.target.value}`;
            }}
            className="px-3.5 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm font-bold bg-white text-slate-800 shadow-xs"
          >
            <option value="2026">২০২৬ অর্থবছর</option>
            <option value="2025">২০২৫ অর্থবছর</option>
            <option value="2024">২০২৪ অর্থবছর</option>
          </select>

          {/* One-Click Print */}
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-5 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>অডিট শিট প্রিন্ট করুন</span>
          </button>
        </div>
      </div>

      {/* Fund Filter Tabs (Hidden in Print) */}
      <div className="flex flex-wrap bg-slate-100 p-1 rounded-xl gap-1 print:hidden">
        <button
          onClick={() => setActiveFundView("all")}
          className={`flex-1 py-2 px-3 text-xs sm:text-sm font-bold rounded-lg transition ${
            activeFundView === "all"
              ? "bg-white text-emerald-800 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          সম্মিলিত ব্যালেন্স শিট (All Funds)
        </button>
        <button
          onClick={() => setActiveFundView("general")}
          className={`flex-1 py-2 px-3 text-xs sm:text-sm font-bold rounded-lg transition ${
            activeFundView === "general"
              ? "bg-white text-emerald-800 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          সাধারণ ফান্ড (General)
        </button>
        <button
          onClick={() => setActiveFundView("lillah")}
          className={`flex-1 py-2 px-3 text-xs sm:text-sm font-bold rounded-lg transition ${
            activeFundView === "lillah"
              ? "bg-white text-emerald-800 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          লিল্লাহ বোর্ডিং ফান্ড (Lillah)
        </button>
        <button
          onClick={() => setActiveFundView("zakat")}
          className={`flex-1 py-2 px-3 text-xs sm:text-sm font-bold rounded-lg transition ${
            activeFundView === "zakat"
              ? "bg-white text-emerald-800 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          যাকাত ও ফিতরা ফান্ড (Zakat)
        </button>
        <button
          onClick={() => setActiveFundView("building")}
          className={`flex-1 py-2 px-3 text-xs sm:text-sm font-bold rounded-lg transition ${
            activeFundView === "building"
              ? "bg-white text-emerald-800 shadow-xs"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          উন্নয়ন ফান্ড (Building)
        </button>
      </div>

      {/* Main Printable Document Layout */}
      <div className="bg-white border-2 border-slate-300 print:border-none rounded-2xl shadow-lg print:shadow-none p-6 sm:p-10 space-y-6 text-slate-900 print:p-0">
        {/* Madrasa Shura Letterhead Header */}
        <div className="text-center space-y-1.5 border-b-2 border-slate-900 pb-5">
          <p className="text-xs font-serif text-slate-600 print:text-black">
            بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ • حَامِدًا وَّمُصَلِّيًا
          </p>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-emerald-900 print:text-black tracking-tight">
            {statement.madrasaName}
          </h2>
          <p className="text-xs text-slate-600 print:text-black font-medium">
            {statement.madrasaAddress}
          </p>
          <div className="pt-2">
            <span className="inline-block bg-slate-900 text-white print:bg-black print:text-white px-5 py-1 rounded-md text-xs sm:text-sm font-bold tracking-wide uppercase">
              {activeFundView === "all"
                ? "বার্ষিক সমন্বিত আর্থিক অডিট স্টেটমেন্ট ও উদ্বৃত্ত পত্র"
                : `${currentFund?.fundName} — বার্ষিক নিরীক্ষা বিবরণী`}
            </span>
          </div>
          <p className="text-xs text-slate-700 print:text-black font-semibold pt-1">
            মজলিসে শুরা ও দাতাবৃন্দের অবগতির জন্য উপস্থাপিত • অর্থবছর: {toBanglaNumber(statement.fiscalYear)} ({statement.hijriYear})
          </p>
          <p className="text-[11px] text-slate-500 print:text-black">
            হিসাবকাল: {statement.startDate} খ্রি. হতে {statement.endDate} খ্রি. পর্যন্ত
          </p>
        </div>

        {/* 4 Tri-Fund Balance Overview Cards (if viewing All Funds) */}
        {activeFundView === "all" && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* 1. General Fund */}
            <div className="border border-slate-200 print:border-black rounded-xl p-3.5 bg-slate-50/70 print:bg-white space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 print:text-black">সাধারণ ফান্ড</span>
                <span className="text-[10px] text-slate-400 print:text-black">الصندوق العام</span>
              </div>
              <div className="text-xs space-y-0.5 pt-1 border-t border-slate-200 print:border-black">
                <div className="flex justify-between text-emerald-800 print:text-black">
                  <span>মোট আয়:</span>
                  <span className="font-bold">{formatCurrencyBangla(funds.generalFund.totalIncome)}</span>
                </div>
                <div className="flex justify-between text-rose-800 print:text-black">
                  <span>মোট ব্যয়:</span>
                  <span className="font-bold">{formatCurrencyBangla(funds.generalFund.totalExpense)}</span>
                </div>
                <div className="flex justify-between font-extrabold pt-1 border-t border-slate-200 text-slate-900 print:text-black">
                  <span>সমাপনী স্থিতি:</span>
                  <span>{formatCurrencyBangla(funds.generalFund.closingBalance)}</span>
                </div>
              </div>
            </div>

            {/* 2. Lillah Boarding Fund */}
            <div className="border border-slate-200 print:border-black rounded-xl p-3.5 bg-slate-50/70 print:bg-white space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 print:text-black">লিল্লাহ বোর্ডিং ফান্ড</span>
                <span className="text-[10px] text-slate-400 print:text-black">الإطعام</span>
              </div>
              <div className="text-xs space-y-0.5 pt-1 border-t border-slate-200 print:border-black">
                <div className="flex justify-between text-emerald-800 print:text-black">
                  <span>মোট আয়:</span>
                  <span className="font-bold">{formatCurrencyBangla(funds.lillahFund.totalIncome)}</span>
                </div>
                <div className="flex justify-between text-rose-800 print:text-black">
                  <span>মোট ব্যয়:</span>
                  <span className="font-bold">{formatCurrencyBangla(funds.lillahFund.totalExpense)}</span>
                </div>
                <div className="flex justify-between font-extrabold pt-1 border-t border-slate-200 text-slate-900 print:text-black">
                  <span>সমাপনী স্থিতি:</span>
                  <span>{formatCurrencyBangla(funds.lillahFund.closingBalance)}</span>
                </div>
              </div>
            </div>

            {/* 3. Zakat & Fitra Fund */}
            <div className="border border-slate-200 print:border-black rounded-xl p-3.5 bg-slate-50/70 print:bg-white space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 print:text-black">যাকাত ও ফিতরা ফান্ড</span>
                <span className="text-[10px] text-slate-400 print:text-black">الزكاة والصدقات</span>
              </div>
              <div className="text-xs space-y-0.5 pt-1 border-t border-slate-200 print:border-black">
                <div className="flex justify-between text-emerald-800 print:text-black">
                  <span>মোট আয়:</span>
                  <span className="font-bold">{formatCurrencyBangla(funds.zakatFund.totalIncome)}</span>
                </div>
                <div className="flex justify-between text-rose-800 print:text-black">
                  <span>মোট ব্যয়:</span>
                  <span className="font-bold">{formatCurrencyBangla(funds.zakatFund.totalExpense)}</span>
                </div>
                <div className="flex justify-between font-extrabold pt-1 border-t border-slate-200 text-slate-900 print:text-black">
                  <span>সমাপনী স্থিতি:</span>
                  <span>{formatCurrencyBangla(funds.zakatFund.closingBalance)}</span>
                </div>
              </div>
            </div>

            {/* 4. Building Fund */}
            <div className="border border-slate-200 print:border-black rounded-xl p-3.5 bg-slate-50/70 print:bg-white space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 print:text-black">উন্নয়ন ও নির্মাণ ফান্ড</span>
                <span className="text-[10px] text-slate-400 print:text-black">التعمير</span>
              </div>
              <div className="text-xs space-y-0.5 pt-1 border-t border-slate-200 print:border-black">
                <div className="flex justify-between text-emerald-800 print:text-black">
                  <span>মোট আয়:</span>
                  <span className="font-bold">{formatCurrencyBangla(funds.buildingFund.totalIncome)}</span>
                </div>
                <div className="flex justify-between text-rose-800 print:text-black">
                  <span>মোট ব্যয়:</span>
                  <span className="font-bold">{formatCurrencyBangla(funds.buildingFund.totalExpense)}</span>
                </div>
                <div className="flex justify-between font-extrabold pt-1 border-t border-slate-200 text-slate-900 print:text-black">
                  <span>সমাপনী স্থিতি:</span>
                  <span>{formatCurrencyBangla(funds.buildingFund.closingBalance)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* T-ACCOUNT BALANCE SHEET TABLE */}
        <div className="border-2 border-slate-800 print:border-2 print:border-black rounded-xl overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x-2 divide-slate-800 print:divide-black">
            {/* LEFT COLUMN: প্রাপ্তি / আয় সমূহ (Receipts & Incomes) */}
            <div className="flex flex-col justify-between">
              <div>
                <div className="bg-emerald-900 text-white print:bg-black print:text-white p-2.5 text-center font-bold text-sm tracking-wider uppercase">
                  প্রাপ্তি / আয় সমূহ (Receipts & Incomes)
                </div>

                <div className="p-4 space-y-3 text-xs sm:text-sm">
                  {/* Opening balance */}
                  <div className="flex justify-between items-center py-1 border-b border-dashed border-slate-300 font-bold text-slate-700 print:text-black">
                    <span>১. প্রারম্ভিক নগদ ও ব্যাংক স্থিতি (Opening Balance)</span>
                    <span className="font-mono">
                      {formatCurrencyBangla(
                        activeFundView === "all"
                          ? grandTotal.openingBalance
                          : currentFund?.openingBalance || 0
                      )}
                    </span>
                  </div>

                  {/* Income categories */}
                  <div className="space-y-1.5 pt-1">
                    <span className="font-bold text-slate-900 print:text-black text-xs block uppercase tracking-wider">
                      ২. রাজস্ব ও অনুদান প্রাপ্তি:
                    </span>

                    {(activeFundView === "all"
                      ? [
                          ...funds.generalFund.incomesByCategory.map((i) => ({ ...i, fund: "সাধারণ" })),
                          ...funds.lillahFund.incomesByCategory.map((i) => ({ ...i, fund: "লিল্লাহ" })),
                          ...funds.zakatFund.incomesByCategory.map((i) => ({ ...i, fund: "যাকাত" })),
                          ...funds.buildingFund.incomesByCategory.map((i) => ({ ...i, fund: "উন্নয়ন" })),
                        ]
                      : currentFund?.incomesByCategory || []
                    ).map((inc: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex justify-between items-center py-1 border-b border-slate-100 print:border-slate-300 text-slate-800 print:text-black"
                      >
                        <span className="pr-2">
                          • {inc.category} {inc.fund && `(${inc.fund})`}
                        </span>
                        <span className="font-mono font-semibold shrink-0">
                          {formatCurrencyBangla(inc.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Total Income footer */}
              <div className="bg-emerald-50 print:bg-slate-100 p-3 border-t-2 border-slate-800 print:border-black flex justify-between items-center font-extrabold text-sm sm:text-base text-emerald-950 print:text-black">
                <span>মোট প্রাপ্তি ও প্রারম্ভিক স্থিতি:</span>
                <span className="font-mono">
                  {formatCurrencyBangla(
                    activeFundView === "all"
                      ? grandTotal.openingBalance + grandTotal.totalIncome
                      : (currentFund?.openingBalance || 0) + (currentFund?.totalIncome || 0)
                  )}
                </span>
              </div>
            </div>

            {/* RIGHT COLUMN: পরিশোধ / ব্যয় সমূহ (Payments & Expenses) */}
            <div className="flex flex-col justify-between">
              <div>
                <div className="bg-rose-900 text-white print:bg-black print:text-white p-2.5 text-center font-bold text-sm tracking-wider uppercase">
                  পরিশোধ / ব্যয় সমূহ (Payments & Expenses)
                </div>

                <div className="p-4 space-y-3 text-xs sm:text-sm">
                  <div className="space-y-1.5">
                    <span className="font-bold text-slate-900 print:text-black text-xs block uppercase tracking-wider">
                      ১. শিক্ষামূলক, প্রশাসনিক ও পরিচালন ব্যয়:
                    </span>

                    {(activeFundView === "all"
                      ? [
                          ...funds.generalFund.expensesByCategory.map((e) => ({ ...e, fund: "সাধারণ" })),
                          ...funds.lillahFund.expensesByCategory.map((e) => ({ ...e, fund: "লিল্লাহ" })),
                          ...funds.zakatFund.expensesByCategory.map((e) => ({ ...e, fund: "যাকাত" })),
                          ...funds.buildingFund.expensesByCategory.map((e) => ({ ...e, fund: "উন্নয়ন" })),
                        ]
                      : currentFund?.expensesByCategory || []
                    ).map((exp: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex justify-between items-center py-1 border-b border-slate-100 print:border-slate-300 text-slate-800 print:text-black"
                      >
                        <span className="pr-2">
                          • {exp.category} {exp.fund && `(${exp.fund})`}
                        </span>
                        <span className="font-mono font-semibold shrink-0">
                          {formatCurrencyBangla(exp.amount)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Net Closing Balance calculation */}
                  <div className="pt-4 space-y-1.5 border-t border-dashed border-slate-300">
                    <span className="font-bold text-slate-900 print:text-black text-xs block uppercase tracking-wider">
                      ২. সমাপনী উদ্বৃত্ত (Closing Balance):
                    </span>
                    <div className="flex justify-between items-center py-1 font-bold text-emerald-800 print:text-black">
                      <span>হাতে নগদ ও ব্যাংক হিসাব স্থিতি</span>
                      <span className="font-mono">
                        {formatCurrencyBangla(
                          activeFundView === "all"
                            ? grandTotal.closingBalance
                            : currentFund?.closingBalance || 0
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Total Expenses + Closing balance footer */}
              <div className="bg-rose-50 print:bg-slate-100 p-3 border-t-2 border-slate-800 print:border-black flex justify-between items-center font-extrabold text-sm sm:text-base text-slate-900 print:text-black">
                <span>সর্বমোট পরিশোধ ও সমাপনী স্থিতি:</span>
                <span className="font-mono">
                  {formatCurrencyBangla(
                    activeFundView === "all"
                      ? grandTotal.totalExpense + grandTotal.closingBalance
                      : (currentFund?.totalExpense || 0) + (currentFund?.closingBalance || 0)
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Cash & Bank Reconciliation (সমাপনী স্থিতি বিশ্লেষণ) */}
        <div className="bg-slate-50 print:bg-white border border-slate-300 print:border-black p-4 rounded-xl text-xs sm:text-sm space-y-2">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <span className="font-bold text-slate-900 print:text-black flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              <span>সমাপনী স্থিতি ও ব্যাংক হিসাব বিবরণী (Bank & Cash Reconciliation):</span>
            </span>
            <span className="font-mono font-bold text-slate-900 print:text-black">
              সর্বমোট স্থিতি: {formatCurrencyBangla(grandTotal.closingBalance)}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div className="flex justify-between items-center">
              <span className="text-slate-600 print:text-black">ক. ক্যাশিয়ার ও অফিসের হাতে নগদ (Cash in Hand):</span>
              <span className="font-mono font-bold text-slate-800 print:text-black">
                {formatCurrencyBangla(grandTotal.cashInHand)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600 print:text-black">খ. ইসলামী ব্যাংক হিসাব নম্বরসমূহে জমা (Bank Accounts):</span>
              <span className="font-mono font-bold text-slate-800 print:text-black">
                {formatCurrencyBangla(grandTotal.bankBalance)}
              </span>
            </div>
          </div>
        </div>

        {/* Formal Shura Committee Audit Signatures */}
        <div className="pt-10 border-t-2 border-slate-900 print:border-black">
          <p className="text-[11px] text-slate-500 print:text-black text-center mb-8">
            সার্টিফিকেশন: অত্র নিরীক্ষা বিবরণী মাদরাসার যাবতীয় রেজিস্টার, রশিদ বই ও ভাউচারের সাথে পুঙ্খানুপুঙ্খভাবে যাচাই করে নির্ভুল পাওয়া গেল।
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center text-xs">
            <div className="space-y-1.5">
              <div className="w-32 mx-auto border-b border-slate-400 print:border-black pt-4" />
              <p className="font-bold text-slate-900 print:text-black">হিসাবরক্ষক / নিরীক্ষক</p>
              <span className="text-[10px] text-slate-400 print:text-black">অভ্যন্তরীণ অডিট শাখা</span>
            </div>

            <div className="space-y-1.5">
              <div className="w-32 mx-auto border-b border-slate-400 print:border-black pt-4" />
              <p className="font-bold text-slate-900 print:text-black">নাযেমে তালিমাত</p>
              <span className="text-[10px] text-slate-400 print:text-black">শিক্ষা পরিচালক</span>
            </div>

            <div className="space-y-1.5">
              <div className="w-32 mx-auto border-b border-slate-400 print:border-black pt-4" />
              <p className="font-bold text-slate-900 print:text-black">মুহতামিম / প্রিন্সিপাল</p>
              <span className="text-[10px] text-slate-400 print:text-black">{statement.principalName}</span>
            </div>

            <div className="space-y-1.5">
              <div className="w-32 mx-auto border-b border-slate-400 print:border-black pt-4" />
              <p className="font-bold text-slate-900 print:text-black">সভাপতি / সম্পাদক</p>
              <span className="text-[10px] text-slate-400 print:text-black">মজলিসে শুরা ও কার্যনির্বাহী পরিষদ</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
