"use client";

import React from "react";
import { Scissors } from "lucide-react";
import { toBanglaNumber } from "@/lib/numberToBangla";

interface BlankMoneyReceiptProps {
  madrasaInfo: any;
  receiptType?: "dual" | "student" | "office";
  customReceiptPrefix?: string;
  defaultFeeType?: string;
}

export default function BlankMoneyReceipt({
  madrasaInfo,
  receiptType = "dual",
  customReceiptPrefix = "",
  defaultFeeType = "",
}: BlankMoneyReceiptProps) {
  const mName = madrasaInfo?.name || "মাদরাসা";
  const mAddress = madrasaInfo?.address || "";
  const mPhone = madrasaInfo?.phone || madrasaInfo?.contact_phone || "";
  const mRegNo = madrasaInfo?.registration_no || madrasaInfo?.reg_no || "";
  const logoUrl = madrasaInfo?.logo_url || "";

  const renderSingleReceipt = (
    copyType: "student" | "office",
    copyLabel: string,
    subLabel: string
  ) => {
    const isStudent = copyType === "student";

    return (
      <div
        className={`receipt-card bg-white border border-slate-300 rounded-lg p-3 sm:p-4 print:p-2.5 relative flex flex-col justify-between text-slate-800 ${
          isStudent ? "bg-white" : "bg-slate-50/40"
        }`}
        style={{ minHeight: "114mm", maxHeight: "124mm" }}
      >
        {/* Top Header Row */}
        <div>
          <div className="flex items-start justify-between border-b border-slate-200 pb-2 gap-2">
            {/* Madrasa Logo + Info */}
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Madrasa Logo"
                  className="w-10 h-10 sm:w-12 sm:h-12 object-cover rounded-full shrink-0 border border-slate-200"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-base shrink-0 border border-emerald-300 print:border-slate-400">
                  ম
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h2 className="text-sm sm:text-base font-bold text-slate-900 leading-tight truncate">
                  {mName}
                </h2>
                {mAddress && (
                  <p className="text-[10px] sm:text-[11px] text-slate-600 leading-normal line-clamp-1 mt-0.5">
                    {mAddress}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[9px] sm:text-[10px] text-slate-500 mt-0.5">
                  {mPhone && (
                    <span>মোবাইল: {toBanglaNumber(mPhone)}</span>
                  )}
                  {mRegNo && (
                    <span>রেজি নং: {toBanglaNumber(mRegNo)}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Receipt Title & Copy Badge */}
            <div className="text-right shrink-0 flex flex-col items-end">
              <div
                className={`px-2 py-0.2 rounded text-[10px] font-bold tracking-wide uppercase border ${
                  isStudent
                    ? "bg-emerald-50 text-emerald-800 border-emerald-300 print:border-slate-400"
                    : "bg-indigo-50 text-indigo-800 border-indigo-300 print:border-slate-400"
                }`}
              >
                {copyLabel}
              </div>
              <div className="mt-0.5">
                <span className="inline-block bg-slate-900 text-white text-[11px] sm:text-xs font-bold px-2 py-0.5 rounded shadow-2xs print:bg-black">
                  মানি রিসিট (Money Receipt)
                </span>
              </div>
            </div>
          </div>

          {/* Meta Info Bar: Receipt No & Date */}
          <div className="grid grid-cols-2 bg-slate-100/90 border-b border-slate-200 px-2.5 py-1 text-[11px] text-slate-700 font-medium">
            <div className="flex items-baseline gap-1">
              <span>রিসিট নং:</span>
              <span className="font-mono font-bold text-slate-900">
                {customReceiptPrefix ? `${customReceiptPrefix}-` : ""}..............................
              </span>
            </div>
            <div className="text-right flex items-baseline justify-end gap-1">
              <span>তারিখ:</span>
              <span className="font-medium text-slate-900">
                ........ / ........ / ২০২৬ খ্রি.
              </span>
            </div>
          </div>

          {/* Student and Fee Details Table/Grid */}
          <div className="mt-1.5 border border-slate-200 rounded-md overflow-hidden text-xs">
            <table className="w-full border-collapse">
              <tbody>
                <tr className="border-b border-slate-200">
                  <td className="bg-slate-50 px-2.5 py-1 font-semibold text-slate-700 w-1/4 border-r border-slate-200 text-[11px]">
                    শিক্ষার্থীর নাম:
                  </td>
                  <td className="px-2.5 py-1 font-bold text-slate-900 text-xs">
                    ................................................................................
                  </td>
                  <td className="bg-slate-50 px-2 py-1 font-semibold text-slate-700 w-1/6 border-l border-r border-slate-200 text-[11px]">
                    রোল নং:
                  </td>
                  <td className="px-2 py-1 font-mono font-bold text-slate-900 text-xs w-1/6">
                    ................
                  </td>
                </tr>

                <tr className="border-b border-slate-200">
                  <td className="bg-slate-50 px-2.5 py-1 font-semibold text-slate-700 border-r border-slate-200 text-[11px]">
                    জামাত / শ্রেণি:
                  </td>
                  <td className="px-2.5 py-1 font-medium text-slate-800 text-xs">
                    ................................................................
                  </td>
                  <td className="bg-slate-50 px-2 py-1 font-semibold text-slate-700 border-l border-r border-slate-200 text-[11px]">
                    শাখা / বিভাগ:
                  </td>
                  <td className="px-2 py-1 font-medium text-slate-800 text-xs">
                    ................
                  </td>
                </tr>

                {/* Table for multiple fee heads */}
                <tr className="border-b border-slate-200">
                  <td colSpan={4} className="p-0">
                    <table className="w-full text-[11px]">
                      <thead className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200">
                        <tr>
                          <th className="py-1 px-2.5 text-left w-10 border-r border-slate-200 text-center">ক্রম</th>
                          <th className="py-1 px-2.5 text-left border-r border-slate-200">ফি'র খাত / বিবরণ</th>
                          <th className="py-1 px-2.5 text-left w-28 border-r border-slate-200">মাস / পিরিয়ড</th>
                          <th className="py-1 px-2.5 text-right w-28">পরিমাণ (৳)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        <tr>
                          <td className="py-1 px-2.5 text-center text-slate-500 border-r border-slate-200">০১</td>
                          <td className="py-1 px-2.5 font-medium text-slate-800 border-r border-slate-200">
                            {defaultFeeType || ""}
                          </td>
                          <td className="py-1 px-2.5 text-slate-600 border-r border-slate-200"></td>
                          <td className="py-1 px-2.5 text-right font-mono font-bold text-slate-900"></td>
                        </tr>
                        <tr>
                          <td className="py-1 px-2.5 text-center text-slate-500 border-r border-slate-200">০২</td>
                          <td className="py-1 px-2.5 font-medium text-slate-800 border-r border-slate-200"></td>
                          <td className="py-1 px-2.5 text-slate-600 border-r border-slate-200"></td>
                          <td className="py-1 px-2.5 text-right font-mono font-bold text-slate-900"></td>
                        </tr>
                        <tr>
                          <td className="py-1 px-2.5 text-center text-slate-500 border-r border-slate-200">০৩</td>
                          <td className="py-1 px-2.5 font-medium text-slate-800 border-r border-slate-200"></td>
                          <td className="py-1 px-2.5 text-slate-600 border-r border-slate-200"></td>
                          <td className="py-1 px-2.5 text-right font-mono font-bold text-slate-900"></td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>

                <tr className="border-b border-slate-200">
                  <td className="bg-slate-50 px-2.5 py-1 font-semibold text-slate-700 border-r border-slate-200 text-[10px]">
                    পরিশোধের মাধ্যম:
                  </td>
                  <td colSpan={3} className="px-2.5 py-1 text-[10px] text-slate-700">
                    <span className="inline-flex items-center gap-3">
                      <span>[ ] নগদ (Cash)</span>
                      <span>[ ] বিকাশ / নগদ</span>
                      <span>[ ] ব্যাংক জমা</span>
                      <span>[ ] অন্যান্য</span>
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Total Paid Amount Highlight */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-emerald-50/80 px-2.5 py-1.5 border-t border-emerald-200">
              <div className="text-[11px] text-slate-700 mb-0.5 sm:mb-0">
                <span className="font-semibold">কথায়: </span>
                <span className="font-medium text-slate-800">
                  ........................................................................................................................
                </span>
              </div>
              <div className="flex items-center gap-1.5 self-end sm:self-auto">
                <span className="text-[11px] font-bold text-slate-700 uppercase">মোট আদায়:</span>
                <span className="text-sm sm:text-base font-black text-emerald-900 font-mono tracking-tight bg-white px-2.5 py-0.5 rounded border border-emerald-300 shadow-2xs">
                  ৳ ........................ /-
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Signature Section */}
        <div className="mt-3 pt-2 flex justify-between items-end text-[11px] text-slate-600 border-t border-dashed border-slate-200">
          <div className="text-center w-32">
            <div className="border-t border-slate-400 pt-0.5 font-medium">
              প্রদানকারীর স্বাক্ষর
            </div>
            <p className="text-[9px] text-slate-400">শিক্ষার্থী / অভিভাবক</p>
          </div>

          <div className="text-center text-[9px] text-slate-400 hidden sm:block">
            {isStudent
              ? "যেকোনো প্রয়োজনে রিসিটটি সংরক্ষণ করুন"
              : "অফিস নথিভূক্তির জন্য সংরক্ষিত"}
          </div>

          <div className="text-center w-32">
            <div className="border-t border-slate-400 pt-0.5 font-medium text-slate-900">
              আদায়কারীর স্বাক্ষর
            </div>
            <p className="text-[9px] text-slate-400">হিসাবরক্ষক / অফিস</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      {/* Top Copy: Student Copy */}
      {(receiptType === "dual" || receiptType === "student") && (
        <div>
          {renderSingleReceipt("student", "স্টুডেন্ট কপি", "Student Copy")}
        </div>
      )}

      {/* Cutting Line Separator for Dual Print */}
      {receiptType === "dual" && (
        <div className="relative my-4 sm:my-5 flex items-center justify-center cut-separator">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-dashed border-slate-400" />
          </div>
          <div className="relative flex items-center gap-2 bg-white px-3 text-[11px] text-slate-500 font-mono tracking-wider select-none">
            <Scissors className="w-3.5 h-3.5 text-slate-600 transform -rotate-90" />
            <span>কেটে আলাদা করুন (Cut along the line)</span>
            <Scissors className="w-3.5 h-3.5 text-slate-600 transform rotate-90" />
          </div>
        </div>
      )}

      {/* Bottom Copy: Office Copy */}
      {(receiptType === "dual" || receiptType === "office") && (
        <div>
          {renderSingleReceipt("office", "অফিস কপি", "Office / Admin Copy")}
        </div>
      )}
    </div>
  );
}
