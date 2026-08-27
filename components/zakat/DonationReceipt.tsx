"use client";

import React, { useState } from "react";
import { Printer, Scissors, Type, HeartHandshake } from "lucide-react";
import { toBanglaNumber, formatBanglaCurrency, numberToBanglaWords } from "@/lib/numberToBangla";
import { DonationItem, getPaymentMethodName } from "@/lib/fund-utils";

interface MadrasaInfo {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  logo_url?: string;
  registration_no?: string;
}

interface DonationReceiptProps {
  donation: DonationItem;
  madrasaInfo?: MadrasaInfo;
  showControls?: boolean;
}

export default function DonationReceipt({
  donation,
  madrasaInfo,
  showControls = true,
}: DonationReceiptProps) {
  const [banglaFont, setBanglaFont] = useState("font-solaiman");
  const [printLayout, setPrintLayout] = useState<"dual" | "donor" | "office">("dual");

  const donorName = donation.donors?.name || "সম্মানিত সাধারণ দাতা";
  const donorPhone = donation.donors?.phone ? toBanglaNumber(donation.donors.phone) : "-";
  const donorAddress = donation.donors?.address || "-";
  const donorType = donation.donors?.donor_type 
    ? (donation.donors.donor_type === "Monthly" ? "মাসিক দাতা" : donation.donors.donor_type === "Annual" ? "বার্ষিক দাতা" : "এককালীন দাতা")
    : "এককালীন দাতা";

  const receiptNumber = donation.receipt_no || `ZR${donation.id?.substring(0, 6).toUpperCase() || "0001"}`;
  
  const dateObj = donation.donation_date ? new Date(donation.donation_date) : new Date();
  const formattedDate = dateObj.toLocaleDateString("en-GB");
  const banglaDate = toBanglaNumber(formattedDate);

  const amountVal = typeof donation.amount === "number" ? donation.amount : parseFloat(String(donation.amount || 0));
  const banglaAmount = formatBanglaCurrency(amountVal);
  const inWords = numberToBanglaWords(amountVal);
  const paymentMethodBangla = getPaymentMethodName(donation.payment_method);
  const fundName = donation.fund_name || donation.donation_type || "সাধারণ ফান্ড";

  const handlePrint = () => {
    window.print();
  };

  const renderSingleReceipt = (copyType: "donor" | "office", copyLabel: string) => {
    const isDonor = copyType === "donor";

    return (
      <div 
        className={`receipt-card bg-white border border-slate-300 rounded-lg p-4 sm:p-5 relative flex flex-col justify-between text-slate-800 ${
          isDonor ? "bg-white" : "bg-slate-50/40"
        }`}
        style={{ minHeight: "128mm" }}
      >
        {/* Top Header Row */}
        <div>
          <div className="flex items-start justify-between border-b border-slate-200 pb-3 gap-2">
            {/* Madrasa Logo + Info */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {madrasaInfo?.logo_url ? (
                <img 
                  src={madrasaInfo.logo_url} 
                  alt="Madrasa Logo" 
                  className="w-13 h-13 sm:w-14 sm:h-14 object-contain rounded-md shrink-0" 
                  onError={(e) => { e.currentTarget.style.display = "none"; }} 
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-lg shrink-0 border border-emerald-300 print:border-slate-400">
                  ম
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-tight truncate">
                  {madrasaInfo?.name || "আল জামিয়া ইসলামিয়া মাদরাসা"}
                </h2>
                {madrasaInfo?.address && (
                  <p className="text-[11px] sm:text-xs text-slate-600 leading-normal line-clamp-1 mt-0.5">
                    {madrasaInfo.address}
                  </p>
                )}
                {madrasaInfo?.phone && (
                  <p className="text-[10px] sm:text-[11px] text-slate-500 font-mono">
                    মোবাইল: {toBanglaNumber(madrasaInfo.phone)}
                  </p>
                )}
              </div>
            </div>

            {/* Receipt Title & Copy Badge */}
            <div className="text-right shrink-0 flex flex-col items-end">
              <div className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold tracking-wide uppercase border ${
                isDonor 
                  ? "bg-emerald-50 text-emerald-800 border-emerald-300 print:border-slate-400" 
                  : "bg-purple-50 text-purple-800 border-purple-300 print:border-slate-400"
              }`}>
                {copyLabel}
              </div>
              <div className="mt-1">
                <span className="inline-block bg-slate-900 text-white text-xs sm:text-sm font-bold px-2.5 py-0.5 rounded shadow-2xs">
                  দান ও অনুদান রসিদ
                </span>
              </div>
            </div>
          </div>

          {/* Meta Info Bar: Receipt No & Date */}
          <div className="grid grid-cols-2 bg-slate-100/90 border-b border-slate-200 px-3 py-1.5 text-xs text-slate-700 font-medium">
            <div>
              রসিদ নং: <span className="font-mono font-bold text-slate-900">{receiptNumber}</span>
            </div>
            <div className="text-right">
              তারিখ: <span className="font-medium text-slate-900">{banglaDate} ({formattedDate})</span>
            </div>
          </div>

          {/* Donor & Donation Details Grid */}
          <div className="mt-2.5 border border-slate-200 rounded-md overflow-hidden text-xs sm:text-sm">
            <table className="w-full border-collapse">
              <tbody>
                <tr className="border-b border-slate-200">
                  <td className="bg-slate-50 px-3 py-1.5 font-semibold text-slate-700 w-1/4 border-r border-slate-200 text-xs">
                    দাতার নাম:
                  </td>
                  <td className="px-3 py-1.5 font-bold text-slate-900 text-sm">
                    {donorName}
                  </td>
                  <td className="bg-slate-50 px-3 py-1.5 font-semibold text-slate-700 w-1/5 border-l border-r border-slate-200 text-xs">
                    দাতার ধরন:
                  </td>
                  <td className="px-3 py-1.5 font-medium text-slate-900 text-xs">
                    <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200 font-semibold">
                      {donorType}
                    </span>
                  </td>
                </tr>

                <tr className="border-b border-slate-200">
                  <td className="bg-slate-50 px-3 py-1.5 font-semibold text-slate-700 border-r border-slate-200 text-xs">
                    মোবাইল / ঠিকানা:
                  </td>
                  <td className="px-3 py-1.5 text-slate-800 text-xs">
                    {donorPhone} {donorAddress !== "-" ? `• ${donorAddress}` : ""}
                  </td>
                  <td className="bg-slate-50 px-3 py-1.5 font-semibold text-slate-700 border-l border-r border-slate-200 text-xs">
                    জমার ফান্ড:
                  </td>
                  <td className="px-3 py-1.5 font-bold text-emerald-800 text-xs sm:text-sm">
                    {fundName}
                  </td>
                </tr>

                <tr className="border-b border-slate-200">
                  <td className="bg-slate-50 px-3 py-1.5 font-semibold text-slate-700 border-r border-slate-200 text-xs">
                    পরিশোধের মাধ্যম:
                  </td>
                  <td className="px-3 py-1.5 text-slate-800 font-medium text-xs">
                    {paymentMethodBangla}
                  </td>
                  <td className="bg-slate-50 px-3 py-1.5 font-semibold text-slate-700 border-l border-r border-slate-200 text-xs">
                    বিবরণ / নোট:
                  </td>
                  <td className="px-3 py-1.5 text-slate-600 text-xs">
                    {donation.notes || "-"}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Total Collected Amount Highlight */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-emerald-50/90 px-3.5 py-2.5 border-t border-emerald-200">
              <div className="text-xs text-slate-700 mb-1 sm:mb-0">
                <span className="font-semibold">কথায়: </span>
                <span className="font-medium text-slate-800">{inWords}</span>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <span className="text-xs font-bold text-slate-700 uppercase">মোট প্রাপ্তি:</span>
                <span className="text-base sm:text-lg font-black text-emerald-900 font-mono tracking-tight bg-white px-3 py-0.5 rounded border border-emerald-300 shadow-2xs">
                  ৳ {banglaAmount} /-
                </span>
              </div>
            </div>
          </div>

          {/* Dua / Islamic Blessing */}
          <div className="mt-2 text-center text-[11px] text-emerald-800 font-medium bg-emerald-50/50 py-1 rounded border border-emerald-100">
            جَزَاكُمُ اللّٰهُ خَيْرًا — আল্লাহ তা'আলা আপনার দানকে কবুল করুন এবং দুনিয়া ও আখিরাতে উত্তম প্রতিদান দান করুন। আমীন।
          </div>
        </div>

        {/* Footer Signature Section */}
        <div className="mt-6 pt-3 flex justify-between items-end text-xs text-slate-600 border-t border-dashed border-slate-200">
          <div className="text-center w-36">
            <div className="border-t border-slate-400 pt-1 font-medium">
              দাতার স্বাক্ষর
            </div>
            <p className="text-[10px] text-slate-400">সম্মানিত দাতা</p>
          </div>

          <div className="text-center text-[10px] text-slate-400 hidden sm:block">
            {isDonor ? "যেকোনো প্রয়োজনে রসিদটি সংরক্ষণ করুন" : "মাদরাসা অফিসের নথিভূক্তির জন্য সংরক্ষিত"}
          </div>

          <div className="text-center w-36">
            <div className="border-t border-slate-400 pt-1 font-medium text-slate-900">
              আদায়কারীর স্বাক্ষর
            </div>
            <p className="text-[10px] text-slate-400">হিসাবরক্ষক / মুহতামিম</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Top Toolbar (Hidden during print) */}
      {showControls && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs print:hidden">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
              <Type className="w-4 h-4 text-slate-500 shrink-0" />
              <select 
                value={banglaFont} 
                onChange={(e) => setBanglaFont(e.target.value)}
                className="text-xs font-medium text-slate-700 bg-transparent focus:outline-none cursor-pointer"
              >
                <option value="font-solaiman">বাংলা: সোলাইমান লিপি</option>
                <option value="font-shorif">বাংলা: শরীফ শিশির</option>
                <option value="font-hindsiliguri">বাংলা: হিন্দ শিলিগুড়ি</option>
              </select>
            </div>

            <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-medium">
              <button
                type="button"
                onClick={() => setPrintLayout("dual")}
                className={`px-2.5 py-1 rounded-md transition ${
                  printLayout === "dual" ? "bg-white text-slate-900 shadow-2xs font-bold" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                A4 ২ কপি (দাতা + অফিস)
              </button>
              <button
                type="button"
                onClick={() => setPrintLayout("donor")}
                className={`px-2 py-1 rounded-md transition ${
                  printLayout === "donor" ? "bg-white text-slate-900 shadow-2xs font-bold" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                ১ম কপি (দাতা)
              </button>
              <button
                type="button"
                onClick={() => setPrintLayout("office")}
                className={`px-2 py-1 rounded-md transition ${
                  printLayout === "office" ? "bg-white text-slate-900 shadow-2xs font-bold" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                ২য় কপি (অফিস)
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-medium text-sm shadow-sm cursor-pointer active:scale-98"
            >
              <Printer className="w-4 h-4" />
              <span>রসিদ প্রিন্ট করুন (A4)</span>
            </button>
          </div>
        </div>
      )}

      {/* A4 Printable Sheet Container */}
      <div 
        id="donation-receipt-sheet"
        className={`bg-white border border-slate-200 shadow-md p-4 sm:p-6 rounded-xl max-w-3xl mx-auto ${banglaFont}`}
      >
        {/* Top Copy: Donor Copy */}
        {(printLayout === "dual" || printLayout === "donor") && (
          <div className="receipt-wrapper donor-copy">
            {renderSingleReceipt("donor", "দাতার কপি")}
          </div>
        )}

        {/* Cutting Line Separator for Dual Print */}
        {printLayout === "dual" && (
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
        {(printLayout === "dual" || printLayout === "office") && (
          <div className="receipt-wrapper office-copy">
            {renderSingleReceipt("office", "অফিস কপি")}
          </div>
        )}
      </div>

      {/* Clean Global Print Stylesheet for A4 */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 5mm;
          }

          html, body {
            background: white !important;
            height: auto !important;
            min-height: 100% !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          #__next, main, div, form, section, article {
            overflow: visible !important;
            height: auto !important;
            max-height: none !important;
          }

          header, aside, nav, footer, button, .print\\:hidden, .no-print {
            display: none !important;
          }

          #donation-receipt-sheet {
            display: block !important;
            position: static !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background: white !important;
          }

          .receipt-card {
            border: 1.5px solid #475569 !important;
            box-shadow: none !important;
            padding: 12px 16px !important;
            background: white !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .cut-separator {
            margin: 8px 0 !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>
    </div>
  );
}
