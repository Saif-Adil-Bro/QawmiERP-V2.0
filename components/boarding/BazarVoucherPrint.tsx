"use client";

import React, { useState } from "react";
import { Printer, Scissors, FileText, CheckCircle2, ShieldCheck, X } from "lucide-react";
import { toBanglaNumber, formatBanglaCurrency, numberToBanglaWords } from "@/lib/numberToBangla";
import { BazarExpenseItem } from "@/app/actions/boarding";

export interface MadrasaInfoType {
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

interface BazarVoucherPrintProps {
  expense: BazarExpenseItem;
  madrasaInfo?: MadrasaInfoType;
  onClose?: () => void;
  showControls?: boolean;
}

interface ParsedItem {
  id: number;
  name: string;
  qtyRate: string;
  amount: string;
}

// Helper to parse multi-line items like "Chal 2kg - 120", "Ice-cream - 70", "Milk - 50"
function parseBazarLines(text: string): ParsedItem[] {
  if (!text || !text.trim()) return [];

  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const items: ParsedItem[] = [];

  lines.forEach((line, idx) => {
    // 1. Try separator like '-' or '=' or ':' with amount at end
    // e.g. "Chal 2kg - 120" or "আলু ৫ কেজি : ১০০ টাকা" or "মাছ = ৫০০/-"
    const matchWithSep = line.match(/^(.+?)\s*[-=:]\s*([০-৯0-9,.]+)\s*(?:টাকা|\/-|tk|taka)?$/i);
    if (matchWithSep) {
      const namePart = matchWithSep[1].trim();
      const amountPart = matchWithSep[2].trim();
      items.push({
        id: idx + 1,
        name: namePart,
        qtyRate: "-",
        amount: amountPart,
      });
      return;
    }

    // 2. Try pattern like "Chal 2kg 120" (amount at very end)
    const matchTrailingNum = line.match(/^(.+?)\s+([০-৯0-9,.]+)\s*(?:টাকা|\/-|tk|taka)?$/i);
    if (matchTrailingNum && isNaN(Number(matchTrailingNum[1]))) {
      items.push({
        id: idx + 1,
        name: matchTrailingNum[1].trim(),
        qtyRate: "-",
        amount: matchTrailingNum[2].trim(),
      });
      return;
    }

    // 3. Fallback: single item line without parsed amount
    items.push({
      id: idx + 1,
      name: line,
      qtyRate: "-",
      amount: "-",
    });
  });

  return items;
}

export default function BazarVoucherPrint({
  expense,
  madrasaInfo,
  onClose,
  showControls = true,
}: BazarVoucherPrintProps) {
  const [printLayout, setPrintLayout] = useState<"dual" | "single">("dual");

  const amountVal = typeof expense.amount === "number" ? expense.amount : parseFloat(String(expense.amount || 0));
  const banglaAmount = formatBanglaCurrency(amountVal);
  const inWords = numberToBanglaWords(amountVal);

  const dateObj = expense.expense_date ? new Date(expense.expense_date) : new Date();
  const formattedDate = dateObj.toLocaleDateString("en-GB");
  const banglaDate = toBanglaNumber(formattedDate);

  const voucherNo = expense.voucher_no || `BV-${expense.id?.substring(0, 6).toUpperCase() || "AUTO"}`;
  const buyerName = expense.buyer_name || "মাদরাসা প্রতিনিধি / বাবুর্চি";
  const paymentMethod = expense.payment_method === "Bkash" 
    ? "বিকাশ / মোবাইল ব্যাংকিং" 
    : expense.payment_method === "Bank" 
    ? "ব্যাংক চেক / ট্রান্সফার" 
    : "নগদ (Cash)";

  const parsedItems = parseBazarLines(expense.items_details);

  const handlePrint = () => {
    window.print();
  };

  const renderSingleVoucher = (copyType: "office" | "boarding", copyLabel: string) => {
    const isOffice = copyType === "office";

    return (
      <div 
        className="voucher-card bg-white border-2 border-slate-700 rounded-lg p-3.5 sm:p-5 relative flex flex-col justify-between text-slate-900 shadow-2xs print:shadow-none print:border-slate-800"
        style={{ minHeight: printLayout === "dual" ? "128mm" : "240mm" }}
      >
        {/* Top Header */}
        <div>
          <div className="flex items-start justify-between border-b-2 border-slate-700 pb-2.5 gap-2">
            {/* Madrasa Logo + Details */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {madrasaInfo?.logo_url ? (
                <img 
                  src={madrasaInfo.logo_url} 
                  alt="Madrasa Logo" 
                  className="w-12 h-12 sm:w-14 sm:h-14 object-contain rounded-md shrink-0 print:block" 
                  onError={(e) => { e.currentTarget.style.display = "none"; }} 
                />
              ) : (
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-slate-900 text-white flex items-center justify-center font-black text-lg shrink-0 border border-slate-700">
                  ম
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h2 className="text-base sm:text-lg font-black text-slate-950 leading-tight truncate">
                  {madrasaInfo?.name || "আল জামিয়া ইসলামিয়া মাদরাসা ও এতিমখানা"}
                </h2>
                {madrasaInfo?.address && (
                  <p className="text-[11px] sm:text-xs text-slate-700 leading-normal line-clamp-1 mt-0.5">
                    {madrasaInfo.address}
                  </p>
                )}
                {madrasaInfo?.phone && (
                  <p className="text-[10px] sm:text-[11px] text-slate-600 font-mono">
                    যোগাযোগ: {toBanglaNumber(madrasaInfo.phone)}
                  </p>
                )}
              </div>
            </div>

            {/* Voucher Title Badge & Copy Info */}
            <div className="text-right shrink-0 flex flex-col items-end">
              <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                isOffice 
                  ? "bg-slate-100 text-slate-900 border-slate-400" 
                  : "bg-emerald-50 text-emerald-900 border-emerald-400"
              }`}>
                {copyLabel}
              </div>
              <div className="mt-1">
                <span className="inline-block bg-slate-950 text-white text-xs sm:text-sm font-black px-2.5 py-0.5 rounded">
                  বাজার খরচ ভাউচার
                </span>
              </div>
              <span className="text-[9px] text-slate-500 font-bold mt-0.5">বোর্ডিং ও মেস বিভাগ</span>
            </div>
          </div>

          {/* Meta Info Bar: Voucher No, Date, Account Head */}
          <div className="grid grid-cols-3 bg-slate-100/90 border-b border-slate-400 px-2.5 py-1 text-xs text-slate-800 font-medium my-1.5">
            <div>
              ভাউচার নং: <span className="font-mono font-black text-slate-950 text-xs sm:text-sm">{voucherNo}</span>
            </div>
            <div className="text-center">
              তারিখ: <span className="font-bold text-slate-900">{banglaDate}</span> <span className="text-[10px] text-slate-600 font-mono">({formattedDate})</span>
            </div>
            <div className="text-right">
              পরিশোধ: <span className="font-bold text-slate-900">{paymentMethod}</span>
            </div>
          </div>

          {/* Buyer / Responsible Person & Fund Account Head */}
          <div className="flex items-center justify-between px-2.5 py-1 text-xs border-b border-slate-200 bg-white">
            <div>
              <span className="text-slate-600 font-semibold">বাজারকারী / ক্রেতা:</span>{" "}
              <span className="font-bold text-slate-950">{buyerName}</span>
            </div>
            <div className="flex items-center gap-2">
              <div>
                <span className="text-slate-600 font-semibold">খরচের ফান্ড:</span>{" "}
                <span className="font-bold text-emerald-950 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300">
                  {expense.fund_name || "লিল্লাহ বোর্ডিং ফান্ড"}
                </span>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="mt-2 border border-slate-400 rounded overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-200/80 border-b border-slate-400 text-[11px] font-bold text-slate-900">
                  <th className="py-1 px-2.5 w-10 text-center border-r border-slate-300">ক্র.নং</th>
                  <th className="py-1 px-2.5 border-r border-slate-300">বাজারের মালামাল ও বিবরণ</th>
                  <th className="py-1 px-2.5 w-24 text-right">টাকা (৳)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300">
                {parsedItems.length > 0 ? (
                  parsedItems.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-1 px-2.5 text-center font-mono text-slate-700 border-r border-slate-300">
                        {toBanglaNumber(idx + 1)}
                      </td>
                      <td className="py-1 px-2.5 font-medium text-slate-900 border-r border-slate-300">
                        {item.name}
                      </td>
                      <td className="py-1 px-2.5 text-right font-mono font-bold text-slate-950">
                        {item.amount !== "-" ? toBanglaNumber(item.amount) : "-"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="py-2 px-2.5 text-center font-mono text-slate-700 border-r border-slate-300">
                      ১
                    </td>
                    <td className="py-2 px-2.5 font-medium text-slate-900 border-r border-slate-300 whitespace-pre-line">
                      {expense.items_details || "দৈনন্দিন বাজার খরচের মালামাল"}
                    </td>
                    <td className="py-2 px-2.5 text-right font-mono font-bold text-slate-950">
                      {banglaAmount}
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 border-t-2 border-slate-600 font-bold text-slate-950">
                  <td colSpan={2} className="py-1.5 px-2.5 text-right border-r border-slate-300 text-xs">
                    মোট খরচের পরিমাণ:
                  </td>
                  <td className="py-1.5 px-2.5 text-right font-mono text-sm text-slate-950 font-black">
                    ৳ {banglaAmount}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* In Words Box */}
          <div className="mt-2 p-1.5 bg-slate-50 border border-slate-300 rounded text-xs text-slate-800 flex items-center justify-between">
            <span className="font-bold text-slate-700 shrink-0">কথায়:</span>
            <span className="font-bold text-slate-950 text-right flex-1 ml-2 underline decoration-slate-400">
              {inWords}
            </span>
          </div>
        </div>

        {/* Official Signatures Row */}
        <div className="pt-8 sm:pt-10 mt-3 border-t border-slate-300">
          <div className="grid grid-cols-4 gap-2 text-center text-[10px] sm:text-[11px] text-slate-800">
            {/* 1. Buyer */}
            <div className="flex flex-col items-center">
              <div className="w-full border-t border-dashed border-slate-600 pt-1 font-bold">
                বাজারকারী / ক্রেতা
              </div>
              <span className="text-[9px] text-slate-500">স্বাক্ষর ও তারিখ</span>
            </div>

            {/* 2. Hostel Super / Cook */}
            <div className="flex flex-col items-center">
              <div className="w-full border-t border-dashed border-slate-600 pt-1 font-bold">
                বাবুর্চি / সুপার
              </div>
              <span className="text-[9px] text-slate-500">গৃহীত মালামাল</span>
            </div>

            {/* 3. Accountant */}
            <div className="flex flex-col items-center">
              <div className="w-full border-t border-dashed border-slate-600 pt-1 font-bold">
                হিসাবরক্ষক / নাজের
              </div>
              <span className="text-[9px] text-slate-500">যাচাইকৃত</span>
            </div>

            {/* 4. Principal / Muhtamim */}
            <div className="flex flex-col items-center">
              <div className="w-full border-t border-dashed border-slate-600 pt-1 font-bold text-slate-950">
                মুহতামিম / সভাপতি
              </div>
              <span className="text-[9px] text-slate-500">অনুমোদনকারী</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Top Action Controls (Hidden on Print) */}
      {showControls && (
        <div className="print:hidden bg-white p-3 sm:p-4 rounded-xl border border-slate-300 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700">প্রিন্ট লেআউট:</span>
            <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setPrintLayout("dual")}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  printLayout === "dual"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Scissors className="w-3.5 h-3.5 text-emerald-600" />
                <span>A4 ডাবল কপি (অফিস + বোর্ডিং)</span>
              </button>
              <button
                type="button"
                onClick={() => setPrintLayout("single")}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  printLayout === "single"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                <span>সিঙ্গেল কপি</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs sm:text-sm font-bold transition shadow-xs flex items-center gap-2 cursor-pointer active:scale-98"
              id="btn_print_bazar_voucher"
            >
              <Printer className="w-4 h-4 text-emerald-400" />
              <span>🖨️ ভাউচার প্রিন্ট করুন</span>
            </button>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 border border-slate-300 hover:bg-slate-100 rounded-lg text-xs font-bold text-slate-700 transition cursor-pointer"
              >
                বন্ধ করুন
              </button>
            )}
          </div>
        </div>
      )}

      {/* Printable Area */}
      <div className="bazar-voucher-printable-area bg-white p-2 sm:p-4 rounded-xl border border-slate-200 print:border-none print:p-0">
        {printLayout === "dual" ? (
          <div className="space-y-4 print:space-y-3">
            {/* Copy 1: Office Copy */}
            {renderSingleVoucher("office", "অফিস কপি (Office Copy)")}

            {/* Scissors Cutting Divider */}
            <div className="relative flex items-center justify-center py-1">
              <div className="w-full border-t-2 border-dashed border-slate-400"></div>
              <span className="absolute bg-white px-2 text-[11px] font-bold text-slate-500 flex items-center gap-1">
                <Scissors className="w-3.5 h-3.5 text-slate-600 -rotate-90" />
                <span>এখানে কাটুন (Cut Along The Dotted Line)</span>
              </span>
            </div>

            {/* Copy 2: Boarding / Kitchen Copy */}
            {renderSingleVoucher("boarding", "বোর্ডিং / মেস কপি (Boarding Copy)")}
          </div>
        ) : (
          <div>
            {renderSingleVoucher("office", "মূল ভাউচার (Original Voucher)")}
          </div>
        )}
      </div>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .bazar-voucher-printable-area,
          .bazar-voucher-printable-area * {
            visibility: visible;
          }
          .bazar-voucher-printable-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
          }
          @page {
            size: A4 portrait;
            margin: 8mm;
          }
        }
      `}</style>
    </div>
  );
}
