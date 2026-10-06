"use client";

import React, { useState } from "react";
import {
  StaffMember,
  StaffSalaryPaymentRecord,
} from "@/lib/staff-management";
import {
  generateMonthlyPayroll,
  processSalaryPayment,
} from "@/app/actions/staff";
import {
  DollarSign,
  Calendar,
  CheckCircle,
  Clock,
  Printer,
  FileText,
  Search,
  Check,
  Building,
  CreditCard,
  AlertCircle,
  X,
  Receipt,
  UserCheck,
} from "lucide-react";
import { toBanglaNumber } from "@/lib/numberToBangla";

interface StaffPayrollViewProps {
  salaryRecords: StaffSalaryPaymentRecord[];
  staffList: StaffMember[];
  madrasaName?: string;
  madrasaInfo?: any;
  onRefresh: () => void;
}

const MONTH_NAMES_BN: Record<string, string> = {
  "01": "জানুয়ারি",
  "02": "ফেব্রুয়ারি",
  "03": "মার্চ",
  "04": "এপ্রিল",
  "05": "মে",
  "06": "জুন",
  "07": "জুলাই",
  "08": "আগস্ট",
  "09": "সেপ্টেম্বর",
  "10": "অক্টোবর",
  "11": "নভেম্বর",
  "12": "ডিসেম্বর",
};

export default function StaffPayrollView({
  salaryRecords,
  staffList,
  madrasaName = "আলহাজ্ব আবুল হোসেন হাফিজিয়া মাদ্রাসা",
  madrasaInfo,
  onRefresh,
}: StaffPayrollViewProps) {
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, "0");
  const currentYear = String(new Date().getFullYear());

  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [isGenerating, setIsGenerating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Pay Modal
  const [selectedRecordToPay, setSelectedRecordToPay] = useState<StaffSalaryPaymentRecord | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [transactionRef, setTransactionRef] = useState("");
  const [remarks, setRemarks] = useState("");
  const [isPaying, setIsPaying] = useState(false);

  // Pay Slip Print Modal
  const [slipRecord, setSlipRecord] = useState<StaffSalaryPaymentRecord | null>(null);

  // Filter records for selected month/year
  const filteredRecords = salaryRecords.filter((r) => {
    const matchesMonth = r.month === selectedMonth && r.year === selectedYear;
    if (!matchesMonth) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return (
        r.staff_name.toLowerCase().includes(q) ||
        r.staff_id_code.toLowerCase().includes(q) ||
        r.designation.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalPaid = filteredRecords
    .filter((r) => r.status === "PAID")
    .reduce((sum, r) => sum + r.net_salary, 0);

  const totalPending = filteredRecords
    .filter((r) => r.status === "PENDING")
    .reduce((sum, r) => sum + r.net_salary, 0);

  const totalBasic = filteredRecords.reduce((sum, r) => sum + (r.basic_salary || 0), 0);
  const totalAllowances = filteredRecords.reduce((sum, r) => sum + (r.allowances || 0), 0);
  const totalDeductions = filteredRecords.reduce((sum, r) => sum + (r.deductions || 0), 0);
  const grandTotal = filteredRecords.reduce((sum, r) => sum + (r.net_salary || 0), 0);

  const handleGeneratePayroll = async () => {
    setIsGenerating(true);
    const res = await generateMonthlyPayroll(selectedMonth, selectedYear);
    setIsGenerating(false);
    if (res.success) {
      alert(`${toBanglaNumber(res.count || 0)} জন কর্মীর মাসিক পেরোল শিট সফলভাবে তৈরি করা হয়েছে।`);
      onRefresh();
    } else {
      alert(res.error);
    }
  };

  const handleProcessPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecordToPay) return;
    setIsPaying(true);

    const res = await processSalaryPayment({
      recordId: selectedRecordToPay.id,
      paymentMethod,
      transactionRef,
      remarks,
    });
    setIsPaying(false);

    if (res.success) {
      setSelectedRecordToPay(null);
      setTransactionRef("");
      setRemarks("");
      onRefresh();
    } else {
      alert(res.error);
    }
  };

  // Safe Isolated Print Execution
  const triggerPrintElement = (elementId: string) => {
    const printableElement = document.getElementById(elementId);
    if (!printableElement) {
      window.print();
      return;
    }

    const existing = document.getElementById("temp-print-frame");
    if (existing) existing.remove();

    const clone = printableElement.cloneNode(true) as HTMLElement;
    clone.id = "temp-print-frame";
    clone.classList.remove("hidden");
    clone.classList.add("block");
    document.body.appendChild(clone);
    document.body.classList.add("is-printing-now");

    setTimeout(() => {
      window.print();
      setTimeout(() => {
        document.body.classList.remove("is-printing-now");
        const temp = document.getElementById("temp-print-frame");
        if (temp) temp.remove();
      }, 500);
    }, 200);
  };

  const handlePrintSlip = () => {
    triggerPrintElement("printable-pay-slip-element");
  };

  const handlePrintSheet = () => {
    triggerPrintElement("printable-payroll-sheet-element");
  };

  const currentMadrasaName = madrasaInfo?.name || madrasaName || "মাদরাসা";
  const currentMadrasaAddress = madrasaInfo?.address || "কাটিয়ারচর, কিশোরগঞ্জ সদর, কিশোরগঞ্জ";
  const currentMadrasaPhone = madrasaInfo?.phone || "";

  return (
    <div className="space-y-6">
      {/* Top Controls & Month Selector */}
      <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-200/80 space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">মাসিক বেতন ও পেরোল শিট (Monthly Payroll)</h3>
            <p className="text-xs text-slate-500">
              সকল শিক্ষক ও কর্মচারীদের মাসিক বেতন প্রস্তুত, পারিশ্রমিক পরিশোধ ও হিসেব সংযোগ
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            >
              <option value="01">জানুয়ারি (০১)</option>
              <option value="02">ফেব্রুয়ারি (০২)</option>
              <option value="03">মার্চ (০৩)</option>
              <option value="04">এপ্রিল (০৪)</option>
              <option value="05">মে (০৫)</option>
              <option value="06">জুন (০৬)</option>
              <option value="07">জুলাই (০৭)</option>
              <option value="08">আগস্ট (০৮)</option>
              <option value="09">সেপ্টেম্বর (০৯)</option>
              <option value="10">অক্টোবর (১০)</option>
              <option value="11">নভেম্বর (১১)</option>
              <option value="12">ডিসেম্বর (১২)</option>
            </select>

            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            >
              <option value="2025">২০২৫</option>
              <option value="2026">২০২৬</option>
              <option value="2027">২০২৭</option>
            </select>

            <button
              onClick={handleGeneratePayroll}
              disabled={isGenerating}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <DollarSign className="w-4 h-4" />
              <span>{isGenerating ? "তৈরি হচ্ছে..." : "মাসিক পেরোল জেনারেট করুন"}</span>
            </button>

            <button
              onClick={handlePrintSheet}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition border border-slate-200 cursor-pointer"
              title="সম্পূর্ণ পেরোল শিট প্রিন্ট করুন"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Summary Metric Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/70 flex justify-between items-center">
            <span className="text-slate-600 font-medium">মোট নির্ধারিত বেতন:</span>
            <span className="font-bold text-slate-900 text-sm">
              ৳{toBanglaNumber((totalPaid + totalPending).toString())}
            </span>
          </div>

          <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200/70 flex justify-between items-center">
            <span className="text-emerald-800 font-medium">পরিশোধিত (Paid):</span>
            <span className="font-bold text-emerald-800 text-sm">
              ৳{toBanglaNumber(totalPaid.toString())}
            </span>
          </div>

          <div className="bg-amber-50 p-3 rounded-xl border border-amber-200/70 flex justify-between items-center">
            <span className="text-amber-800 font-medium">বকেয়া / অপেক্ষমাণ (Pending):</span>
            <span className="font-bold text-amber-800 text-sm">
              ৳{toBanglaNumber(totalPending.toString())}
            </span>
          </div>
        </div>
      </div>

      {/* Search Filter */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative w-full max-w-xs">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="নাম বা পদবী দিয়ে খুঁজুন..."
            className="w-full text-xs pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
          />
        </div>
        <span className="text-xs text-slate-500">
          রেকর্ড: <strong>{toBanglaNumber(filteredRecords.length)}</strong> জন
        </span>
      </div>

      {/* Payroll Table */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 font-bold">স্টাফ তথ্য</th>
                <th className="py-3 px-4 font-bold">পদবী ও বিভাগ</th>
                <th className="py-3 px-4 font-bold">মূল বেতন</th>
                <th className="py-3 px-4 font-bold">মোট ভাতা (+)</th>
                <th className="py-3 px-4 font-bold">কর্তন (-)</th>
                <th className="py-3 px-4 font-bold">সর্বমোট প্রদেয়</th>
                <th className="py-3 px-4 font-bold">স্ট্যাটাস</th>
                <th className="py-3 px-4 font-bold text-right">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    এই মাসের জন্য এখনও কোনো পেরোল রেকর্ড তৈরি করা হয়নি। উপরে 'মাসিক পেরোল জেনারেট করুন' বাটনে ক্লিক করুন।
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec) => {
                  const isPaid = rec.status === "PAID";

                  return (
                    <tr key={rec.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 block">{rec.staff_name}</span>
                        <span className="text-[11px] font-mono text-slate-400">{rec.staff_id_code}</span>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-medium text-emerald-900 block">{rec.designation}</span>
                        <span className="text-[11px] text-slate-500 block">{rec.department}</span>
                      </td>

                      <td className="py-3 px-4 font-medium">৳{toBanglaNumber(rec.basic_salary.toString())}</td>
                      <td className="py-3 px-4 text-emerald-700 font-semibold">+৳{toBanglaNumber(rec.allowances.toString())}</td>
                      <td className="py-3 px-4 text-rose-600 font-semibold">-৳{toBanglaNumber(rec.deductions.toString())}</td>
                      <td className="py-3 px-4 font-bold text-slate-900 text-sm">
                        ৳{toBanglaNumber(rec.net_salary.toString())}
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            isPaid
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : "bg-amber-50 text-amber-800 border-amber-200"
                          }`}
                        >
                          {isPaid ? "পরিশোধিত" : "অপেক্ষমাণ"}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSlipRecord(rec)}
                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                            title="পে স্লিপ দেখুন ও প্রিন্ট করুন"
                          >
                            <FileText className="w-4 h-4" />
                          </button>

                          {!isPaid ? (
                            <button
                              onClick={() => setSelectedRecordToPay(rec)}
                              className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-semibold text-[11px] transition cursor-pointer"
                            >
                              পরিশোধ করুন
                            </button>
                          ) : (
                            <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-medium">
                              পরিশোধিত
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pay Modal */}
      {selectedRecordToPay && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-sm text-slate-800">বেতন পরিশোধ নিশ্চিতকরণ</h3>
              <button onClick={() => setSelectedRecordToPay(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs space-y-1">
              <span className="text-slate-600 block">কর্মী: <strong>{selectedRecordToPay.staff_name}</strong></span>
              <span className="text-slate-600 block">পদবী: <strong>{selectedRecordToPay.designation}</strong></span>
              <span className="text-slate-600 block">মাস: <strong>{MONTH_NAMES_BN[selectedRecordToPay.month] || selectedRecordToPay.month}, {toBanglaNumber(selectedRecordToPay.year)}</strong></span>
              <div className="pt-1 flex justify-between font-bold text-emerald-900 text-sm border-t border-emerald-200">
                <span>প্রদেয় নেট বেতন:</span>
                <span>৳{toBanglaNumber(selectedRecordToPay.net_salary.toString())}</span>
              </div>
            </div>

            <form onSubmit={handleProcessPayment} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">পরিশোধের মাধ্যম</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                >
                  <option value="CASH">নগদ প্রদান (Cash Payment)</option>
                  <option value="BANK">ব্যাংক ট্রান্সফার (Bank Transfer)</option>
                  <option value="BKASH">বিকাশ (bKash)</option>
                  <option value="NAGAD">নগদ (Nagad)</option>
                </select>
              </div>

              <div>
                <label className="font-semibold block mb-1">ট্রানজেকশন আইডি / চেক নম্বর (ঐচ্ছিক)</label>
                <input
                  type="text"
                  value={transactionRef}
                  onChange={(e) => setTransactionRef(e.target.value)}
                  placeholder="উদা: TRX-987654"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">মন্তব্য</label>
                <input
                  type="text"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="নিয়মিত মাসিক বেতন পরিশোধ..."
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <p className="text-[11px] text-slate-500 italic">
                * নিশ্চিত করলে মাদ্রাসার সাধারণ হিসাব ফান্ডের খরচ (Expenses) হিসেবে স্বয়ংক্রিয়ভাবে লিপিবদ্ধ হবে।
              </p>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedRecordToPay(null)}
                  className="px-4 py-2 bg-slate-100 rounded-xl font-semibold text-slate-700 cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isPaying}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-semibold shadow-xs cursor-pointer"
                >
                  {isPaying ? "প্রক্রিয়াকরণ হচ্ছে..." : "পরিশোধ সম্পন্ন করুন"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pay Slip Preview Modal (Screen View) */}
      {slipRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 font-sans border border-slate-200">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 text-emerald-800 rounded-xl">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">মাসিক বেতন রসিদ / পে স্লিপ</h3>
                  <p className="text-[11px] text-slate-500">অফিসিয়াল প্রিন্ট ও রেকর্ড কপি</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrintSlip}
                  className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>রসিদ প্রিন্ট করুন</span>
                </button>
                <button
                  onClick={() => setSlipRecord(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Screen Slip Preview Box */}
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-4">
              <div className="text-center border-b border-slate-200 pb-3 space-y-0.5">
                <h4 className="font-bold text-base text-slate-900">{currentMadrasaName}</h4>
                <p className="text-[11px] text-slate-500">{currentMadrasaAddress}</p>
                <div className="inline-block mt-1 px-3 py-0.5 rounded-full bg-emerald-100/70 text-emerald-900 font-bold text-[11px]">
                  মাসিক বেতন বিবরণী — {MONTH_NAMES_BN[slipRecord.month] || slipRecord.month}, {toBanglaNumber(slipRecord.year)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-[11.5px] bg-white p-3 rounded-xl border border-slate-200/80">
                <div>
                  <span className="text-slate-400 block text-[10px]">কর্মীর নাম:</span>
                  <span className="font-bold text-slate-900 block">{slipRecord.staff_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">স্টাফ আইডি:</span>
                  <span className="font-mono font-bold text-emerald-900 block">{slipRecord.staff_id_code}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">পদবী:</span>
                  <span className="font-semibold text-slate-800 block">{slipRecord.designation}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">বিভাগ:</span>
                  <span className="font-semibold text-slate-800 block">{slipRecord.department}</span>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                <table className="w-full text-xs">
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="py-2 px-3 text-slate-600">মূল বেতন (Basic Salary)</td>
                      <td className="py-2 px-3 text-right font-semibold text-slate-900">৳{toBanglaNumber(slipRecord.basic_salary.toString())}</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 text-emerald-800">মোট ভাতাসমূহ (+)</td>
                      <td className="py-2 px-3 text-right font-semibold text-emerald-800">+৳{toBanglaNumber(slipRecord.allowances.toString())}</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 text-rose-600">মোট কর্তনসমূহ (-)</td>
                      <td className="py-2 px-3 text-right font-semibold text-rose-600">-৳{toBanglaNumber(slipRecord.deductions.toString())}</td>
                    </tr>
                    <tr className="bg-emerald-50/70 font-bold">
                      <td className="py-2.5 px-3 text-emerald-950 text-sm">সর্বমোট প্রদেয় নেট বেতন:</td>
                      <td className="py-2.5 px-3 text-right text-emerald-900 text-sm">৳{toBanglaNumber(slipRecord.net_salary.toString())}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center text-[11px] text-slate-500 pt-3">
                <div className="text-center border-t border-slate-300 pt-1 w-28">হিসাবরক্ষক</div>
                <div className="text-center border-t border-slate-300 pt-1 w-28">গ্রহীতার স্বাক্ষর</div>
                <div className="text-center border-t border-slate-300 pt-1 w-28">মুহতামিম / অধ্যক্ষ</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* HIDDEN PRINTABLE TEMPLATES FOR ISOLATED PRINTING */}
      {/* ========================================================================= */}

      {/* 1. PRINTABLE PAY SLIP VOUCHER (Dual Copy: Office & Staff Copy on A4) */}
      {slipRecord && (
        <div id="printable-pay-slip-element" className="hidden font-sans text-black bg-white p-3 space-y-6">
          {/* Top Copy: Office Copy */}
          <div className="border border-black p-4 rounded-lg bg-white">
            <div className="text-center border-b border-black pb-2 mb-3">
              <h2 className="text-base font-bold">{currentMadrasaName}</h2>
              <p className="text-[10.5px] text-gray-700">{currentMadrasaAddress} {currentMadrasaPhone && `• মোবা: ${currentMadrasaPhone}`}</p>
              <div className="inline-block mt-1 px-3 py-0.5 border border-black rounded-full font-bold text-xs">
                কর্মচারী বেতন রসিদ (Pay Slip) — {MONTH_NAMES_BN[slipRecord.month] || slipRecord.month}, {toBanglaNumber(slipRecord.year)} [অফিস কপি]
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs mb-3 border border-gray-400 p-2 rounded">
              <div><span className="text-gray-600">নাম:</span> <strong className="text-black">{slipRecord.staff_name}</strong></div>
              <div><span className="text-gray-600">স্টাফ আইডি:</span> <strong className="font-mono">{slipRecord.staff_id_code}</strong></div>
              <div><span className="text-gray-600">পদবী:</span> <strong>{slipRecord.designation}</strong></div>
              <div><span className="text-gray-600">বিভাগ:</span> <strong>{slipRecord.department}</strong></div>
            </div>

            <table className="w-full text-xs border-collapse border border-black mb-3">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <th className="border border-black p-1.5 font-bold">বেতন ও ভাতার বিবরণ</th>
                  <th className="border border-black p-1.5 font-bold text-right">টাকা</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-black p-1.5">মূল বেতন (Basic Salary)</td>
                  <td className="border border-black p-1.5 text-right font-medium">৳{toBanglaNumber(slipRecord.basic_salary.toString())}</td>
                </tr>
                <tr>
                  <td className="border border-black p-1.5">মোট ভাতাসমূহ (+)</td>
                  <td className="border border-black p-1.5 text-right font-medium">৳{toBanglaNumber(slipRecord.allowances.toString())}</td>
                </tr>
                <tr>
                  <td className="border border-black p-1.5">মোট কর্তনসমূহ (-)</td>
                  <td className="border border-black p-1.5 text-right font-medium">৳{toBanglaNumber(slipRecord.deductions.toString())}</td>
                </tr>
                <tr className="bg-gray-100 font-bold">
                  <td className="border border-black p-1.5 text-sm">সর্বমোট প্রদেয় নেট বেতন:</td>
                  <td className="border border-black p-1.5 text-right text-sm">৳{toBanglaNumber(slipRecord.net_salary.toString())}</td>
                </tr>
              </tbody>
            </table>

            <div className="flex justify-between items-end text-[11px] pt-4 mt-2">
              <div className="text-center border-t border-black pt-1 w-28">হিসাবরক্ষক</div>
              <div className="text-center border-t border-black pt-1 w-28">গ্রহীতার স্বাক্ষর</div>
              <div className="text-center border-t border-black pt-1 w-28">মুহতামিম / অধ্যক্ষ</div>
            </div>
          </div>

          <div className="border-t-2 border-dashed border-gray-400 my-2" />

          {/* Bottom Copy: Staff Copy */}
          <div className="border border-black p-4 rounded-lg bg-white">
            <div className="text-center border-b border-black pb-2 mb-3">
              <h2 className="text-base font-bold">{currentMadrasaName}</h2>
              <p className="text-[10.5px] text-gray-700">{currentMadrasaAddress} {currentMadrasaPhone && `• মোবা: ${currentMadrasaPhone}`}</p>
              <div className="inline-block mt-1 px-3 py-0.5 border border-black rounded-full font-bold text-xs">
                কর্মচারী বেতন রসিদ (Pay Slip) — {MONTH_NAMES_BN[slipRecord.month] || slipRecord.month}, {toBanglaNumber(slipRecord.year)} [কর্মী কপি]
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs mb-3 border border-gray-400 p-2 rounded">
              <div><span className="text-gray-600">নাম:</span> <strong className="text-black">{slipRecord.staff_name}</strong></div>
              <div><span className="text-gray-600">স্টাফ আইডি:</span> <strong className="font-mono">{slipRecord.staff_id_code}</strong></div>
              <div><span className="text-gray-600">পদবী:</span> <strong>{slipRecord.designation}</strong></div>
              <div><span className="text-gray-600">বিভাগ:</span> <strong>{slipRecord.department}</strong></div>
            </div>

            <table className="w-full text-xs border-collapse border border-black mb-3">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <th className="border border-black p-1.5 font-bold">বেতন ও ভাতার বিবরণ</th>
                  <th className="border border-black p-1.5 font-bold text-right">টাকা</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-black p-1.5">মূল বেতন (Basic Salary)</td>
                  <td className="border border-black p-1.5 text-right font-medium">৳{toBanglaNumber(slipRecord.basic_salary.toString())}</td>
                </tr>
                <tr>
                  <td className="border border-black p-1.5">মোট ভাতাসমূহ (+)</td>
                  <td className="border border-black p-1.5 text-right font-medium">৳{toBanglaNumber(slipRecord.allowances.toString())}</td>
                </tr>
                <tr>
                  <td className="border border-black p-1.5">মোট কর্তনসমূহ (-)</td>
                  <td className="border border-black p-1.5 text-right font-medium">৳{toBanglaNumber(slipRecord.deductions.toString())}</td>
                </tr>
                <tr className="bg-gray-100 font-bold">
                  <td className="border border-black p-1.5 text-sm">সর্বমোট প্রদেয় নেট বেতন:</td>
                  <td className="border border-black p-1.5 text-right text-sm">৳{toBanglaNumber(slipRecord.net_salary.toString())}</td>
                </tr>
              </tbody>
            </table>

            <div className="flex justify-between items-end text-[11px] pt-4 mt-2">
              <div className="text-center border-t border-black pt-1 w-28">হিসাবরক্ষক</div>
              <div className="text-center border-t border-black pt-1 w-28">গ্রহীতার স্বাক্ষর</div>
              <div className="text-center border-t border-black pt-1 w-28">মুহতামিম / অধ্যক্ষ</div>
            </div>
          </div>
        </div>
      )}

      {/* 2. PRINTABLE MONTHLY PAYROLL SHEET (Clean Official Report) */}
      <div id="printable-payroll-sheet-element" className="hidden font-sans text-black bg-white p-4">
        {/* Header */}
        <div className="text-center border-b-2 border-black pb-3 mb-4">
          <h1 className="text-xl font-bold">{currentMadrasaName}</h1>
          <p className="text-xs text-gray-700">{currentMadrasaAddress} {currentMadrasaPhone && `• ফোন: ${currentMadrasaPhone}`}</p>
          <h2 className="text-sm font-bold mt-1 tracking-wide">
            মাসিক শিক্ষক ও কর্মচারী বেতন-ভাতাদি শিট — {MONTH_NAMES_BN[selectedMonth] || selectedMonth}, {toBanglaNumber(selectedYear)}
          </h2>
        </div>

        {/* Table */}
        <table className="w-full text-xs border-collapse border border-black mb-6">
          <thead>
            <tr className="bg-gray-100 text-center font-bold">
              <th className="border border-black p-2 w-10">ক্রম</th>
              <th className="border border-black p-2 text-left">নাম ও পদবী</th>
              <th className="border border-black p-2 w-24">স্টাফ আইডি</th>
              <th className="border border-black p-2 text-right">মূল বেতন</th>
              <th className="border border-black p-2 text-right">ভাতা (+)</th>
              <th className="border border-black p-2 text-right">কর্তন (-)</th>
              <th className="border border-black p-2 text-right">নেট প্রদেয়</th>
              <th className="border border-black p-2 w-20">স্ট্যাটাস</th>
              <th className="border border-black p-2 w-28">স্বাক্ষর</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.map((rec, index) => (
              <tr key={rec.id} className="text-center">
                <td className="border border-black p-2">{toBanglaNumber((index + 1).toString())}</td>
                <td className="border border-black p-2 text-left">
                  <div className="font-bold">{rec.staff_name}</div>
                  <div className="text-[10px] text-gray-600">{rec.designation}</div>
                </td>
                <td className="border border-black p-2 font-mono font-bold">{rec.staff_id_code}</td>
                <td className="border border-black p-2 text-right font-medium">৳{toBanglaNumber(rec.basic_salary.toString())}</td>
                <td className="border border-black p-2 text-right">৳{toBanglaNumber(rec.allowances.toString())}</td>
                <td className="border border-black p-2 text-right">৳{toBanglaNumber(rec.deductions.toString())}</td>
                <td className="border border-black p-2 text-right font-bold">৳{toBanglaNumber(rec.net_salary.toString())}</td>
                <td className="border border-black p-2 text-[11px] font-semibold">{rec.status === "PAID" ? "পরিশোধিত" : "বকেয়া"}</td>
                <td className="border border-black p-2"></td>
              </tr>
            ))}
            <tr className="bg-gray-100 font-bold">
              <td colSpan={3} className="border border-black p-2 text-right">সর্বমোট যোগফল:</td>
              <td className="border border-black p-2 text-right">৳{toBanglaNumber(totalBasic.toString())}</td>
              <td className="border border-black p-2 text-right">৳{toBanglaNumber(totalAllowances.toString())}</td>
              <td className="border border-black p-2 text-right">৳{toBanglaNumber(totalDeductions.toString())}</td>
              <td className="border border-black p-2 text-right font-bold text-sm">৳{toBanglaNumber(grandTotal.toString())}</td>
              <td colSpan={2} className="border border-black p-2"></td>
            </tr>
          </tbody>
        </table>

        {/* Signatures */}
        <div className="flex justify-between items-end text-xs pt-12 mt-6">
          <div className="text-center border-t border-black pt-1 w-36 font-semibold">হিসাবরক্ষক</div>
          <div className="text-center border-t border-black pt-1 w-36 font-semibold">কোষাধ্যক্ষ / ক্যাশিয়ার</div>
          <div className="text-center border-t border-black pt-1 w-36 font-semibold">শিক্ষা সচিব</div>
          <div className="text-center border-t border-black pt-1 w-36 font-semibold">মুহতামিম / অধ্যক্ষ</div>
        </div>
      </div>
    </div>
  );
}
