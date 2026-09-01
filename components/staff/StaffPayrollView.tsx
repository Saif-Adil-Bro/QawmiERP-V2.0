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
} from "lucide-react";
import { toBanglaNumber } from "@/lib/numberToBangla";

interface StaffPayrollViewProps {
  salaryRecords: StaffSalaryPaymentRecord[];
  staffList: StaffMember[];
  madrasaName?: string;
  onRefresh: () => void;
}

export default function StaffPayrollView({
  salaryRecords,
  staffList,
  madrasaName = "দারুল উলুম কওমিয়া মাদ্রাসা",
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

  const handlePrint = () => {
    window.print();
  };

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
              onClick={handlePrint}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition border border-slate-200"
              title="পেরোল শিট প্রিন্ট করুন"
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

                      <td className="py-3 px-4">৳{toBanglaNumber(rec.basic_salary.toString())}</td>
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
                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                            title="পে স্লিপ"
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
                            <span className="text-[10px] text-slate-400 font-mono">
                              {toBanglaNumber(rec.payment_date || "")}
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
              <button onClick={() => setSelectedRecordToPay(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs space-y-1">
              <span className="text-slate-600 block">কর্মী: <strong>{selectedRecordToPay.staff_name}</strong></span>
              <span className="text-slate-600 block">মাস: <strong>{selectedRecordToPay.month}/{selectedRecordToPay.year}</strong></span>
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
                  <option value="CASH">নগদ (Cash Payment)</option>
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
                  className="px-4 py-2 bg-slate-100 rounded-xl font-semibold text-slate-700"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isPaying}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-semibold shadow-xs"
                >
                  {isPaying ? "প্রক্রিয়াকরণ হচ্ছে..." : "পরিশোধ সম্পন্ন করুন"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pay Slip Print Modal */}
      {slipRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 font-sans">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-sm text-slate-800">মাসিক বেতন রসিদ / পে স্লিপ (Pay Slip)</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  className="px-3 py-1 bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>প্রিন্ট</span>
                </button>
                <button onClick={() => setSlipRecord(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-4">
              <div className="text-center border-b pb-2 space-y-0.5">
                <h4 className="font-bold text-base text-slate-900">{madrasaName}</h4>
                <p className="text-[11px] text-slate-500">
                  মাসিক বেতন বিবরণী — {slipRecord.month}/{slipRecord.year}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-400">নাম:</span>
                  <span className="font-bold text-slate-800 block">{slipRecord.staff_name}</span>
                </div>
                <div>
                  <span className="text-slate-400">স্টাফ আইডি:</span>
                  <span className="font-mono font-bold text-slate-800 block">{slipRecord.staff_id_code}</span>
                </div>
                <div>
                  <span className="text-slate-400">পদবী:</span>
                  <span className="font-semibold text-slate-800 block">{slipRecord.designation}</span>
                </div>
                <div>
                  <span className="text-slate-400">বিভাগ:</span>
                  <span className="font-semibold text-slate-800 block">{slipRecord.department}</span>
                </div>
              </div>

              <div className="border-t border-b border-slate-200 py-2 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-600">মূল বেতন (Basic Salary)</span>
                  <span className="font-semibold">৳{toBanglaNumber(slipRecord.basic_salary.toString())}</span>
                </div>
                <div className="flex justify-between text-emerald-800">
                  <span>মোট ভাতাসমূহ (+)</span>
                  <span className="font-semibold">৳{toBanglaNumber(slipRecord.allowances.toString())}</span>
                </div>
                <div className="flex justify-between text-rose-600">
                  <span>মোট কর্তনসমূহ (-)</span>
                  <span className="font-semibold">৳{toBanglaNumber(slipRecord.deductions.toString())}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-900 border-t pt-1.5 text-sm">
                  <span>সর্বমোট প্রদেয় নেট বেতন:</span>
                  <span className="text-emerald-700">৳{toBanglaNumber(slipRecord.net_salary.toString())}</span>
                </div>
              </div>

              <div className="flex justify-between items-center text-[10px] text-slate-400 pt-4">
                <div>হিসাবরক্ষক স্বাক্ষর</div>
                <div>মুহতামিম স্বাক্ষর</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
