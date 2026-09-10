"use client";

import React, { useState } from "react";
import { Printer, Type, CheckCircle2, X, Download, Landmark, FileText, ArrowLeft } from "lucide-react";
import { toBanglaNumber, formatBanglaCurrency, numberToBanglaWords } from "@/lib/numberToBangla";
import { parseExpenseItems, ParsedExpenseItem } from "@/lib/expense-parser";

export interface ExpenseItem {
  id: string;
  category: string;
  amount: number | string;
  expense_date: string;
  description?: string;
  fund_id?: string;
  fund_name?: string;
  voucher_no?: string;
  created_at?: string;
}

export interface MadrasaInfo {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  logo_url?: string;
  registration_no?: string;
  reg_no?: string;
  principal_name?: string;
  principal_signature_url?: string;
}

interface ExpenseVoucherProps {
  expense: ExpenseItem;
  madrasaInfo?: MadrasaInfo;
  onClose?: () => void;
  showControls?: boolean;
}

export default function ExpenseVoucher({
  expense,
  madrasaInfo,
  onClose,
  showControls = true,
}: ExpenseVoucherProps) {
  const [banglaFont, setBanglaFont] = useState("font-solaiman");

  const madrasaName = madrasaInfo?.name || "আলহাজ্ব আবুল হোসেন হাফিজিয়া মাদ্রাসা";
  const madrasaAddress = madrasaInfo?.address || "কাতিয়ারচর, কিশোরগঞ্জ সদর, কিশোরগঞ্জ।";
  const madrasaPhone = madrasaInfo?.phone || "০১৬০০-৯৮৯৫৫৫";
  const regNo = madrasaInfo?.registration_no || madrasaInfo?.reg_no || "";

  const amountNum = typeof expense.amount === "number" ? expense.amount : parseFloat(String(expense.amount || 0));
  const banglaAmount = formatBanglaCurrency(amountNum);
  const inWords = numberToBanglaWords(amountNum);

  const dateObj = expense.expense_date ? new Date(expense.expense_date) : new Date();
  const banglaDate = toBanglaNumber(dateObj.toLocaleDateString("en-GB"));
  const engDate = dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const voucherNumber = expense.voucher_no || `EXP-${expense.id?.substring(0, 6).toUpperCase() || "001"}`;
  
  const categoryLabel = 
    expense.category === "Salary" ? "শিক্ষক/স্টাফ বেতন (Salary)" :
    expense.category === "Utility" ? "বিদ্যুৎ/ইউটিলিটি বিল" :
    expense.category === "Food" ? "খাবার ও মেস খরচ (Food)" :
    expense.category === "Maintenance" ? "মেরামত ও রক্ষণাবেক্ষণ" :
    expense.category === "Other" ? "বিবিধ / অন্যান্য খরচ" : (expense.category || "সাধারণ খরচ");

  const fundName = expense.fund_name || "সাধারণ ফান্ড (General Fund)";

  // Parse multi-item breakdown from expense description
  const parsedItems: ParsedExpenseItem[] = parseExpenseItems(expense.description, amountNum);

  const handlePrint = () => {
    const printElem = document.getElementById("expense-voucher-sheet");
    if (!printElem) {
      window.print();
      return;
    }

    const existing = document.getElementById("temp-print-frame");
    if (existing) existing.remove();

    const clone = printElem.cloneNode(true) as HTMLElement;
    clone.id = "temp-print-frame";
    document.body.appendChild(clone);
    document.body.classList.add("is-printing-now");

    setTimeout(() => {
      window.print();
      setTimeout(() => {
        document.body.classList.remove("is-printing-now");
        const temp = document.getElementById("temp-print-frame");
        if (temp) temp.remove();
      }, 600);
    }, 150);
  };

  return (
    <div className={`flex flex-col items-center w-full max-w-4xl mx-auto ${banglaFont}`}>
      {/* Top Action Control Toolbar */}
      {showControls && (
        <div className="w-full bg-slate-900 text-white p-3.5 sm:p-4 rounded-2xl mb-4 flex flex-wrap items-center justify-between gap-3 shadow-lg print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                <span>মাদরাসা ডেবিট ভাউচার</span>
                <span className="text-[11px] font-mono px-2 py-0.5 bg-slate-800 rounded-md text-emerald-400 border border-slate-700">
                  #{voucherNumber}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">ব্যয়ের হিসাব ও নিরীক্ষার জন্য অফিসিয়াল ভাউচার</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Font switcher */}
            <div className="flex items-center bg-slate-800 rounded-xl p-0.5 border border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => setBanglaFont("font-solaiman")}
                className={`px-2.5 py-1 rounded-lg transition font-medium cursor-pointer ${
                  banglaFont === "font-solaiman" ? "bg-emerald-600 text-white shadow-xs" : "text-slate-400 hover:text-slate-200"
                }`}
                title="সোলাইমান লিপি ফন্ট"
              >
                সোলাইমানলিপি
              </button>
              <button
                type="button"
                onClick={() => setBanglaFont("font-sans")}
                className={`px-2.5 py-1 rounded-lg transition font-medium cursor-pointer ${
                  banglaFont === "font-sans" ? "bg-emerald-600 text-white shadow-xs" : "text-slate-400 hover:text-slate-200"
                }`}
                title="ডিফল্ট ফন্ট"
              >
                স্ট্যান্ডার্ড
              </button>
            </div>

            {/* Print button */}
            <button
              type="button"
              onClick={handlePrint}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-sm cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>ভাউচার প্রিন্ট (A4)</span>
            </button>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white p-2 rounded-xl text-xs transition cursor-pointer"
                title="বন্ধ করুন"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Printable Voucher Container */}
      <div
        id="expense-voucher-sheet"
        className="voucher-printable-box w-full bg-white border-2 border-slate-800 rounded-xl p-6 sm:p-8 text-slate-900 shadow-sm relative overflow-hidden"
      >
        {/* Top Decorative Border */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-700 via-slate-800 to-emerald-700"></div>

        {/* Header Section with anti-overlap spacing */}
        <div className="voucher-header border-b-2 border-slate-900 pb-4 mb-4">
          <div className="voucher-header-inner flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            {/* Logo + Madrasa Details (Left) */}
            <div className="voucher-logo-and-info flex items-center gap-3.5 flex-1 min-w-0">
              {madrasaInfo?.logo_url ? (
                <img
                  src={madrasaInfo.logo_url}
                  alt={madrasaName}
                  className="w-16 h-16 object-contain rounded-full border border-slate-200 shrink-0"
                />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white flex flex-col items-center justify-center p-1 text-center shadow-xs shrink-0">
                  <Landmark className="w-6 h-6 text-emerald-400" />
                  <span className="text-[9px] font-bold text-slate-300 uppercase mt-0.5 tracking-tighter">Qawmi</span>
                </div>
              )}
              <div className="voucher-madrasa-text text-left min-w-0 flex-1">
                <div className="voucher-arabic-bismillah text-xs text-slate-500 font-arabic tracking-wide leading-normal mb-0.5">
                  بِسْمِ اللَّهِ الرَّحْمٰنِ الرَّحِيمِ
                </div>
                <h1 className="voucher-madrasa-title text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-snug">
                  {madrasaName}
                </h1>
                <p className="voucher-madrasa-address text-xs text-slate-600 font-medium leading-relaxed mt-0.5">
                  {madrasaAddress} {madrasaPhone && `| মোবাইল: ${toBanglaNumber(madrasaPhone)}`}
                </p>
                {regNo && (
                  <p className="voucher-madrasa-reg text-[11px] text-slate-500 leading-normal">
                    রেজিস্ট্রেশন নং: {toBanglaNumber(regNo)}
                  </p>
                )}
              </div>
            </div>

            {/* Voucher Title Badge (Right) */}
            <div className="voucher-title-badge-container text-left sm:text-right shrink-0 self-start sm:self-center">
              <div className="inline-block bg-slate-900 text-white px-3.5 py-1.5 rounded-lg border border-slate-800 shadow-xs">
                <span className="text-xs sm:text-sm font-black tracking-wider uppercase whitespace-nowrap">
                  ডেবিট ভাউচার (DEBIT VOUCHER)
                </span>
              </div>
              <p className="text-[11px] text-slate-600 font-semibold mt-1">মাদরাসা ব্যয় ও খরচের রসিদ</p>
            </div>
          </div>
        </div>

        {/* Voucher Meta Info Grid */}
        <div className="voucher-meta-grid grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs sm:text-sm mb-5">
          <div className="space-y-1.5">
            <div className="flex items-center">
              <span className="w-28 text-slate-500 font-medium">ভাউচার নম্বর:</span>
              <span className="font-mono font-bold text-slate-900 text-sm bg-white px-2 py-0.5 rounded border border-slate-300">
                {voucherNumber}
              </span>
            </div>
            <div className="flex items-center">
              <span className="w-28 text-slate-500 font-medium">হিসাব ফান্ড:</span>
              <span className="font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                {fundName}
              </span>
            </div>
          </div>

          <div className="space-y-1.5 sm:text-right">
            <div className="flex items-center sm:justify-end">
              <span className="w-24 text-slate-500 font-medium sm:text-right sm:mr-2">তারিখ:</span>
              <span className="font-bold text-slate-900">
                {banglaDate} ({engDate})
              </span>
            </div>
            <div className="flex items-center sm:justify-end">
              <span className="w-24 text-slate-500 font-medium sm:text-right sm:mr-2">খরচের খাত:</span>
              <span className="font-bold text-slate-800 bg-slate-200/70 px-2 py-0.5 rounded">
                {categoryLabel}
              </span>
            </div>
          </div>
        </div>

        {/* Expense Details Smart Itemized Table */}
        <div className="voucher-table-wrapper border border-slate-300 rounded-lg overflow-hidden mb-5">
          <table className="voucher-items-table w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-100 text-slate-800 border-b border-slate-300 font-bold">
              <tr>
                <th className="p-3 w-14 text-center border-r border-slate-300">নং</th>
                <th className="p-3 border-r border-slate-300">খরচের বিবরণ / পণ্যের নাম</th>
                <th className="p-3 w-36 text-right">পরিমাণ (টাকা)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {parsedItems.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/50">
                  <td className="p-3 text-center align-top border-r border-slate-300 font-bold text-slate-700 font-mono">
                    {item.serialBn}
                  </td>
                  <td className="p-3 align-top border-r border-slate-300 text-slate-800">
                    <div className="font-semibold text-slate-900 text-xs sm:text-sm">
                      {item.name}
                    </div>
                  </td>
                  <td className="p-3 text-right align-top font-bold text-slate-900 text-xs sm:text-sm font-mono whitespace-nowrap">
                    {item.amountFormatted ? `৳ ${item.amountFormatted}` : (parsedItems.length === 1 ? `৳ ${banglaAmount}` : "-")}
                  </td>
                </tr>
              ))}

              {/* Total Row */}
              <tr className="bg-slate-50 font-bold border-t-2 border-slate-900">
                <td colSpan={2} className="p-3 text-right border-r border-slate-300 text-slate-800 font-bold text-xs sm:text-sm">
                  সর্বমোট খরচের পরিমাণ:
                </td>
                <td className="p-3 text-right text-emerald-800 text-sm sm:text-base font-mono font-black whitespace-nowrap">
                  ৳ {banglaAmount}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Amount in Words */}
        <div className="voucher-words-box p-3 bg-emerald-50/50 rounded-lg border border-emerald-200 text-xs sm:text-sm flex flex-wrap items-center gap-2 mb-8">
          <span className="font-bold text-emerald-900">কথায়:</span>
          <span className="font-semibold text-slate-800 italic">
            {inWords}
          </span>
        </div>

        {/* 4 Signatures Row */}
        <div className="voucher-signatures-grid grid grid-cols-2 sm:grid-cols-4 gap-4 text-center pt-8 border-t border-slate-200 mt-6">
          <div className="space-y-1">
            <div className="h-9 flex items-end justify-center">
              <div className="w-24 border-b border-dashed border-slate-400"></div>
            </div>
            <p className="text-xs font-bold text-slate-800">প্রস্তুতকারী</p>
            <p className="text-[10px] text-slate-500">হিসাব সহকারী</p>
          </div>

          <div className="space-y-1">
            <div className="h-9 flex items-end justify-center">
              <div className="w-24 border-b border-dashed border-slate-400"></div>
            </div>
            <p className="text-xs font-bold text-slate-800">হিসাবরক্ষক</p>
            <p className="text-[10px] text-slate-500">অ্যাকাউন্ট্যান্ট</p>
          </div>

          <div className="space-y-1">
            <div className="h-9 flex items-end justify-center">
              <div className="w-24 border-b border-dashed border-slate-400"></div>
            </div>
            <p className="text-xs font-bold text-slate-800">গ্রহণকারী / পেয়ী</p>
            <p className="text-[10px] text-slate-500">অর্থ প্রাপকের স্বাক্ষর</p>
          </div>

          <div className="space-y-1">
            <div className="h-9 flex items-end justify-center">
              {madrasaInfo?.principal_signature_url ? (
                <img
                  src={madrasaInfo.principal_signature_url}
                  alt="Principal Signature"
                  className="max-h-8 object-contain mx-auto"
                />
              ) : (
                <div className="w-24 border-b border-dashed border-slate-400"></div>
              )}
            </div>
            <p className="text-xs font-bold text-slate-800">মুহতামিম / সভাপতি</p>
            <p className="text-[10px] text-slate-500">মাদরাসা প্রশাসন</p>
          </div>
        </div>

        {/* Footnote */}
        <div className="voucher-footer mt-8 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
          <span>* এটি মাদরাসা হিসাব সফটওয়্যারের মাধ্যমে স্বয়ংক্রিয়ভাবে প্রস্তুতকৃত অফিশিয়াল ডেবিট ভাউচার।</span>
          <span>প্রিন্ট সময়: {new Date().toLocaleTimeString("bn-BD")}</span>
        </div>
      </div>

      {/* Embedded Clean Print CSS with Anti-Overlap Enforcements */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm;
          }

          body.is-printing-now > *:not(#temp-print-frame) {
            display: none !important;
          }

          #temp-print-frame {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            box-shadow: none !important;
            border: none !important;
            z-index: 99999999 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          #temp-print-frame #expense-voucher-sheet,
          #expense-voucher-sheet {
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 20px !important;
            box-shadow: none !important;
            border: 2px solid #0f172a !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Header Layout - Guarantee side-by-side with no overlap */
          .voucher-header {
            border-bottom: 2px solid #0f172a !important;
            padding-bottom: 12px !important;
            margin-bottom: 14px !important;
          }

          .voucher-header-inner {
            display: flex !important;
            flex-direction: row !important;
            justify-content: space-between !important;
            align-items: flex-start !important;
            gap: 16px !important;
          }

          .voucher-logo-and-info {
            display: flex !important;
            flex-direction: row !important;
            align-items: center !important;
            gap: 14px !important;
            flex: 1 !important;
            text-align: left !important;
          }

          .voucher-madrasa-text {
            text-align: left !important;
          }

          .voucher-arabic-bismillah {
            font-size: 11px !important;
            line-height: 1.3 !important;
            margin-bottom: 2px !important;
            color: #475569 !important;
            display: block !important;
          }

          .voucher-madrasa-title {
            font-size: 20px !important;
            font-weight: 900 !important;
            line-height: 1.25 !important;
            color: #0f172a !important;
            margin: 0 0 3px 0 !important;
          }

          .voucher-madrasa-address {
            font-size: 11px !important;
            line-height: 1.35 !important;
            color: #475569 !important;
            margin: 0 !important;
          }

          .voucher-madrasa-reg {
            font-size: 10px !important;
            line-height: 1.3 !important;
            color: #64748b !important;
            margin-top: 1px !important;
          }

          .voucher-title-badge-container {
            text-align: right !important;
            flex-shrink: 0 !important;
          }

          /* Meta Grid */
          .voucher-meta-grid {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 10px !important;
            background-color: #f8fafc !important;
            border: 1px solid #e2e8f0 !important;
            padding: 10px 14px !important;
            margin-bottom: 14px !important;
          }

          /* Table Styles */
          .voucher-table-wrapper {
            border: 1px solid #cbd5e1 !important;
            margin-bottom: 14px !important;
          }

          .voucher-items-table {
            width: 100% !important;
            border-collapse: collapse !important;
          }

          .voucher-items-table th {
            background-color: #f1f5f9 !important;
            color: #0f172a !important;
            font-weight: 700 !important;
            padding: 8px 10px !important;
            border-bottom: 1px solid #cbd5e1 !important;
          }

          .voucher-items-table td {
            padding: 8px 10px !important;
            border-bottom: 1px solid #e2e8f0 !important;
          }

          /* Signatures Row */
          .voucher-signatures-grid {
            display: grid !important;
            grid-template-columns: repeat(4, 1fr) !important;
            gap: 12px !important;
            padding-top: 24px !important;
            margin-top: 16px !important;
            border-top: 1px solid #e2e8f0 !important;
          }
        }
      `}</style>
    </div>
  );
}
