"use client";

import React, { useState } from "react";
import { Printer, Type, Scissors, Copy, CheckCircle2, Download, ArrowLeft, Eye } from "lucide-react";
import { toBanglaNumber, formatBanglaCurrency, translateMonthToBangla, numberToBanglaWords } from "@/lib/numberToBangla";

interface StudentInfo {
  first_name?: string;
  last_name?: string;
  roll_number?: string | number;
  class_name?: string;
}

interface AllocationItem {
  fee_type_name: string;
  billing_period?: string;
  allocated_amount: number;
}

interface FeeData {
  id?: string;
  receipt_no?: string;
  student_id?: string;
  fee_type?: string;
  amount: number | string;
  payment_date: string;
  fee_month?: string | null;
  fee_year?: string | number | null;
  notes?: string | null;
  students?: StudentInfo;
  payment_method?: string;
  allocations?: AllocationItem[];
  discount_total?: number;
  fine_total?: number;
}

interface MadrasaInfo {
  name?: string;
  address?: string;
  phone?: string;
  email?: string;
  logo_url?: string;
  registration_no?: string;
  reg_no?: string;
  principal_name?: string;
}

interface DualMoneyReceiptProps {
  fee: FeeData;
  student?: StudentInfo;
  madrasaInfo?: MadrasaInfo;
  onPrint?: () => void;
  showControls?: boolean;
}

export default function DualMoneyReceipt({
  fee,
  student,
  madrasaInfo,
  showControls = true,
}: DualMoneyReceiptProps) {
  const [banglaFont, setBanglaFont] = useState("font-solaiman");
  const [printLayout, setPrintLayout] = useState<"dual" | "student" | "office">("dual");

  const effectiveStudent = student || fee.students;
  const studentName = effectiveStudent 
    ? `${effectiveStudent.first_name || ''} ${effectiveStudent.last_name || ''}`.trim() || 'অজ্ঞাত শিক্ষার্থী'
    : 'অজ্ঞাত শিক্ষার্থী';
  const className = effectiveStudent?.class_name || 'N/A';
  const rollNumber = effectiveStudent?.roll_number ? toBanglaNumber(effectiveStudent.roll_number) : 'N/A';
  
  const receiptNumber = fee.receipt_no || (fee.id ? `RN${fee.id.substring(0, 6).toUpperCase()}` : 'RN0001');
  const formattedReceiptNo = receiptNumber;

  const dateObj = fee.payment_date ? new Date(fee.payment_date) : new Date();
  const formattedDate = dateObj.toLocaleDateString('en-GB'); // DD/MM/YYYY
  const banglaDate = toBanglaNumber(formattedDate);

  const getFeeTypeName = (type?: string) => {
    switch (type) {
      case 'Monthly': return 'মাসিক বেতন (Monthly Tuition)';
      case 'Admission': return 'ভর্তি ফি (Admission Fee)';
      case 'Exam': return 'পরীক্ষার ফি (Exam Fee)';
      case 'Hostel': return 'বোর্ডিং / খাবার ফি (Hostel/Food)';
      case 'Books': return 'কিতাব / বই ফি (Books Fee)';
      case 'Donation': return 'অনুদান / সদকা (Donation)';
      default: return type ? `${type} ফি` : 'সাধারণ ফি';
    }
  };

  const banglaMonth = translateMonthToBangla(fee.fee_month || '');
  const banglaYear = fee.fee_year ? toBanglaNumber(fee.fee_year) : '';
  const monthYearText = [banglaMonth, banglaYear].filter(Boolean).join(' ');

  const amountVal = typeof fee.amount === 'number' ? fee.amount : parseFloat(String(fee.amount || 0));
  const banglaAmount = formatBanglaCurrency(amountVal);
  const inWords = numberToBanglaWords(amountVal);

  const handlePrint = () => {
    const printElem = document.getElementById("dual-money-receipt-sheet");
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

  // Render a Single Receipt Card
  const renderSingleReceipt = (copyType: "student" | "office", copyLabel: string, copySubLabel: string) => {
    const isStudent = copyType === "student";

    return (
      <div 
        className={`receipt-card bg-white border border-slate-300 rounded-lg p-4 sm:p-5 relative flex flex-col justify-between text-slate-800 ${
          isStudent ? 'bg-white' : 'bg-slate-50/40'
        }`}
        style={{ minHeight: '128mm' }}
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
                  onError={(e) => { e.currentTarget.style.display = 'none'; }} 
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
                isStudent 
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 print:border-slate-400' 
                  : 'bg-indigo-50 text-indigo-800 border-indigo-300 print:border-slate-400'
              }`}>
                {copyLabel}
              </div>
              <div className="mt-1">
                <span className="inline-block bg-slate-900 text-white text-xs sm:text-sm font-bold px-2.5 py-0.5 rounded shadow-2xs">
                  মানি রিসিট
                </span>
              </div>
            </div>
          </div>

          {/* Meta Info Bar: Receipt No & Date */}
          <div className="grid grid-cols-2 bg-slate-100/90 border-b border-slate-200 px-3 py-1.5 text-xs text-slate-700 font-medium">
            <div>
              রিসিট নং: <span className="font-mono font-bold text-slate-900">{formattedReceiptNo}</span>
            </div>
            <div className="text-right">
              তারিখ: <span className="font-medium text-slate-900">{banglaDate} ({formattedDate})</span>
            </div>
          </div>

          {/* Student and Fee Details Table/Grid */}
          <div className="mt-2.5 border border-slate-200 rounded-md overflow-hidden text-xs sm:text-sm">
            <table className="w-full border-collapse">
              <tbody>
                <tr className="border-b border-slate-200">
                  <td className="bg-slate-50 px-3 py-1.5 font-semibold text-slate-700 w-1/4 border-r border-slate-200 text-xs">
                    শিক্ষার্থীর নাম:
                  </td>
                  <td className="px-3 py-1.5 font-bold text-slate-900 text-sm">
                    {studentName}
                  </td>
                  <td className="bg-slate-50 px-3 py-1.5 font-semibold text-slate-700 w-1/5 border-l border-r border-slate-200 text-xs">
                    রোল নং:
                  </td>
                  <td className="px-3 py-1.5 font-mono font-bold text-slate-900 text-xs sm:text-sm">
                    {rollNumber}
                  </td>
                </tr>

                {fee.allocations && fee.allocations.length > 0 ? (
                  <tr className="border-b border-slate-200">
                    <td colSpan={4} className="p-0">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200">
                          <tr>
                            <th className="py-1 px-3 text-left">ফি'র খাত / বিবরণ</th>
                            <th className="py-1 px-3 text-left">মাস/পিরিয়ড</th>
                            <th className="py-1 px-3 text-right">আদায়কৃত পরিমাণ (৳)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {fee.allocations.map((alloc, aIdx) => (
                            <tr key={aIdx}>
                              <td className="py-1 px-3 font-medium text-slate-800">{alloc.fee_type_name}</td>
                              <td className="py-1 px-3 text-slate-600">{alloc.billing_period || "-"}</td>
                              <td className="py-1 px-3 text-right font-mono font-bold text-slate-900">
                                ৳ {formatBanglaCurrency(alloc.allocated_amount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                ) : (
                  <tr className="border-b border-slate-200">
                    <td className="bg-slate-50 px-3 py-1.5 font-semibold text-slate-700 border-r border-slate-200 text-xs">
                      জামাত / শ্রেণি:
                    </td>
                    <td className="px-3 py-1.5 font-medium text-slate-800">
                      {className}
                    </td>
                    <td className="bg-slate-50 px-3 py-1.5 font-semibold text-slate-700 border-l border-r border-slate-200 text-xs">
                      ফি'র ধরন:
                    </td>
                    <td className="px-3 py-1.5 font-medium text-slate-800">
                      {getFeeTypeName(fee.fee_type)}
                    </td>
                  </tr>
                )}

                {(monthYearText || fee.notes || fee.payment_method) && (
                  <tr className="border-b border-slate-200">
                    <td className="bg-slate-50 px-3 py-1.5 font-semibold text-slate-700 border-r border-slate-200 text-xs">
                      {fee.payment_method ? "পরিশোধের মাধ্যম:" : "মাস ও বছর:"}
                    </td>
                    <td className="px-3 py-1.5 font-medium text-slate-800">
                      {fee.payment_method ? (
                        <span className="font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          {fee.payment_method}
                        </span>
                      ) : (
                        monthYearText || '-'
                      )}
                    </td>
                    <td className="bg-slate-50 px-3 py-1.5 font-semibold text-slate-700 border-l border-r border-slate-200 text-xs">
                      বিবরণ/নোট:
                    </td>
                    <td className="px-3 py-1.5 text-slate-600 text-xs">
                      {fee.notes || '-'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Total Paid Amount Highlight */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-emerald-50/80 px-3.5 py-2 border-t border-emerald-200">
              <div className="text-xs text-slate-700 mb-1 sm:mb-0">
                <span className="font-semibold">কথায়: </span>
                <span className="font-medium text-slate-800">{inWords}</span>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <span className="text-xs font-bold text-slate-700 uppercase">মোট আদায়:</span>
                <span className="text-base sm:text-lg font-black text-emerald-900 font-mono tracking-tight bg-white px-3 py-0.5 rounded border border-emerald-300 shadow-2xs">
                  ৳ {banglaAmount} /-
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Signature Section */}
        <div className="mt-6 pt-3 flex justify-between items-end text-xs text-slate-600 border-t border-dashed border-slate-200">
          <div className="text-center w-36">
            <div className="border-t border-slate-400 pt-1 font-medium">
              প্রদানকারীর স্বাক্ষর
            </div>
            <p className="text-[10px] text-slate-400">শিক্ষার্থী / অভিভাবক</p>
          </div>

          <div className="text-center text-[10px] text-slate-400 hidden sm:block">
            {isStudent ? 'যেকোনো প্রয়োজনে রিসিটটি সংরক্ষণ করুন' : 'অফিস নথিভূক্তির জন্য সংরক্ষিত'}
          </div>

          <div className="text-center w-36">
            <div className="border-t border-slate-400 pt-1 font-medium text-slate-900">
              আদায়কারীর স্বাক্ষর
            </div>
            <p className="text-[10px] text-slate-400">হিসাবরক্ষক / অফিস</p>
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
                A4 ২ কপি (স্টুডেন্ট + অফিস)
              </button>
              <button
                type="button"
                onClick={() => setPrintLayout("student")}
                className={`px-2 py-1 rounded-md transition ${
                  printLayout === "student" ? "bg-white text-slate-900 shadow-2xs font-bold" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                ১ম কপি
              </button>
              <button
                type="button"
                onClick={() => setPrintLayout("office")}
                className={`px-2 py-1 rounded-md transition ${
                  printLayout === "office" ? "bg-white text-slate-900 shadow-2xs font-bold" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                ২য় কপি
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
              <span>রিসিট প্রিন্ট করুন (A4)</span>
            </button>
          </div>
        </div>
      )}

      {/* A4 Printable Sheet Container */}
      <div 
        id="dual-money-receipt-sheet"
        className={`bg-white border border-slate-200 shadow-md p-4 sm:p-6 rounded-xl max-w-3xl mx-auto ${banglaFont}`}
      >
        {/* Top Copy: Student Copy */}
        {(printLayout === "dual" || printLayout === "student") && (
          <div className="receipt-wrapper student-copy">
            {renderSingleReceipt("student", "স্টুডেন্ট কপি", "Student Copy")}
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
            {renderSingleReceipt("office", "অফিস কপি", "Office / Admin Copy")}
          </div>
        )}
      </div>

      {/* Rock-solid Global Print Stylesheet specifically ensuring A4 dual receipts fit without parent clipping */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 5mm;
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
          }

          #temp-print-frame #dual-money-receipt-sheet,
          #dual-money-receipt-sheet {
            display: block !important;
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

          .cut-separator div {
            border-color: #64748b !important;
          }
        }
      `}</style>
    </div>
  );
}
