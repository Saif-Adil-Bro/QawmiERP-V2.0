"use client";

import { useState, useEffect } from "react";
import { collectFeePayment, getStudentFeeProfile } from "@/app/actions/fee-management";
import { formatBanglaCurrency, toBanglaNumber } from "@/lib/numberToBangla";
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  FileText,
  RefreshCw,
  Search,
  User,
  Calendar,
  Layers,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Building,
  Smartphone,
  Banknote,
  Percent,
} from "lucide-react";
import Link from "next/link";
import DualMoneyReceipt from "@/components/accounting/DualMoneyReceipt";
import StudentSearchSelector from "@/components/common/StudentSearchSelector";

interface CollectPaymentClientProps {
  students: any[];
  madrasaInfo?: any;
  preselectedStudentId?: string;
}

export default function CollectPaymentClient({
  students = [],
  madrasaInfo,
  preselectedStudentId,
}: CollectPaymentClientProps) {
  const currentYear = new Date().getFullYear();
  const todayStr = new Date().toISOString().split("T")[0];

  const [studentId, setStudentId] = useState<string>(preselectedStudentId || "");
  const [studentProfile, setStudentProfile] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  // Form Fields
  const [paymentDate, setPaymentDate] = useState<string>(todayStr);
  const [paymentMethod, setPaymentMethod] = useState<"Cash" | "Bank" | "bKash" | "Nagad" | "Rocket" | "Other">("Cash");
  const [transactionRef, setTransactionRef] = useState<string>("");
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [discountReason, setDiscountReason] = useState<string>("");
  const [fineAmount, setFineAmount] = useState<number>(0);
  const [fineReason, setFineReason] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // Allocations
  const [allocations, setAllocations] = useState<{
    [feeId: string]: number;
  }>({});

  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successReceipt, setSuccessReceipt] = useState<any>(null);

  // Load student due profile whenever studentId changes
  useEffect(() => {
    if (!studentId) {
      setStudentProfile(null);
      setAllocations({});
      setTotalAmount(0);
      return;
    }

    async function fetchProfile() {
      setLoadingProfile(true);
      setError(null);
      try {
        const profile = await getStudentFeeProfile(studentId);
        setStudentProfile(profile);

        if (profile && profile.fees) {
          const unpaidFees = profile.fees.filter((f: any) => f.due_amount > 0);
          const initialAlloc: Record<string, number> = {};
          let initialSum = 0;

          unpaidFees.forEach((f: any) => {
            initialAlloc[f.id] = f.due_amount;
            initialSum += f.due_amount;
          });

          setAllocations(initialAlloc);
          setTotalAmount(initialSum > 0 ? initialSum : 1500);
        }
      } catch (err) {
        console.error("getStudentFeeProfile failed:", err);
        setError("শিক্ষার্থীর বকেয়া তথ্য লোড করতে সমস্যা হয়েছে। পেজ রিফ্রেশ করে আবার চেষ্টা করুন।");
      } finally {
        setLoadingProfile(false);
      }
    }

    fetchProfile();
  }, [studentId]);

  const selectedStudent = students.find((s) => s.id === studentId);

  // Handle manual allocation amount change
  const handleAllocationChange = (feeId: string, val: number) => {
    const updated = { ...allocations, [feeId]: Math.max(0, val) };
    setAllocations(updated);
    const sum = Object.values(updated).reduce((a, b) => a + b, 0);
    setTotalAmount(sum);
  };

  // Submit payment
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId) {
      setError("অনুগ্রহ করে শিক্ষার্থী নির্বাচন করুন।");
      return;
    }
    if (totalAmount <= 0) {
      setError("টাকার পরিমাণ ০ এর বেশি হতে হবে।");
      return;
    }

    setIsPending(true);
    setError(null);

    // Prepare allocations payload
    const feeAllocationsList: any[] = [];
    if (studentProfile?.fees) {
      studentProfile.fees.forEach((f: any) => {
        const allocated = allocations[f.id] || 0;
        if (allocated > 0) {
          feeAllocationsList.push({
            student_fee_id: f.id,
            fee_type_id: f.fee_type_id,
            fee_type_name: f.fee_type_name,
            billing_period: f.billing_period,
            allocated_amount: allocated,
          });
        }
      });
    }

    try {
      const res = await collectFeePayment({
        student_id: studentId,
        session_id: studentProfile?.fees?.[0]?.session_id || "default",
        payment_date: paymentDate,
        payment_method: paymentMethod,
        transaction_ref: transactionRef,
        total_amount: Number(totalAmount),
        discount_amount: Number(discountAmount),
        discount_reason: discountReason,
        fine_amount: Number(fineAmount),
        fine_reason: fineReason,
        fee_allocations: feeAllocationsList,
        notes: notes,
      });

      if (res?.success && res.payment) {
        setSuccessReceipt(res.payment);
      } else {
        setError(res?.error || "ফি কালেকশন সম্পন্ন করা যায়নি।");
      }
    } catch (err) {
      console.error("collectFeePayment failed:", err);
      setError("একটি অপ্রত্যাশিত সমস্যা হয়েছে। সম্ভবত নতুন আপডেট ডিপ্লয় হয়েছে — অনুগ্রহ করে পেজ রিফ্রেশ করে আবার চেষ্টা করুন।");
    } finally {
      setIsPending(false);
    }
  };

  const handleReset = () => {
    setSuccessReceipt(null);
    setStudentId("");
    setStudentProfile(null);
    setTotalAmount(0);
    setDiscountAmount(0);
    setDiscountReason("");
    setFineAmount(0);
    setFineReason("");
    setNotes("");
    setAllocations({});
  };

  return (
    <div className="space-y-6">
      {/* If payment collected, show Instant A4 Dual Money Receipt */}
      {successReceipt ? (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="p-5 border border-emerald-200 bg-emerald-50/95 rounded-2xl print:hidden shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-emerald-600 text-white rounded-xl shrink-0 mt-0.5">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-emerald-950">
                    ফি সফলভাবে গ্রহণ করা হয়েছে ও মানি রিসিট প্রস্তুত!
                  </h3>
                  <p className="text-xs sm:text-sm text-emerald-800 mt-0.5">
                    রিসিট নং: <strong className="font-mono font-bold">{successReceipt.receipt_no}</strong> • পরিমাণ: <strong>৳ {formatBanglaCurrency(successReceipt.total_amount_received)}</strong>
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/dashboard/accounting/receipts`}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-white text-slate-700 border border-slate-300 rounded-xl hover:bg-slate-50 transition text-xs font-bold shadow-2xs"
                >
                  <FileText className="w-4 h-4 text-slate-500" />
                  <span>সকল রিসিট</span>
                </Link>

                <button
                  type="button"
                  onClick={handleReset}
                  className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition text-xs font-bold shadow-2xs cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>আরেকটি ফি আদায় করুন</span>
                </button>
              </div>
            </div>
          </div>

          <DualMoneyReceipt
            fee={{
              id: successReceipt.id,
              receipt_no: successReceipt.receipt_no,
              amount: successReceipt.total_amount_received,
              payment_date: successReceipt.payment_date,
              notes: successReceipt.notes,
              payment_method: successReceipt.payment_method,
              allocations: successReceipt.allocations,
              students: {
                first_name: selectedStudent?.first_name || successReceipt.student_name,
                last_name: selectedStudent?.last_name || "",
                roll_number: selectedStudent?.roll_number || successReceipt.student_roll,
                class_name: selectedStudent?.class_name || selectedStudent?.classes?.name || successReceipt.class_name,
              },
            }}
            student={selectedStudent}
            madrasaInfo={madrasaInfo}
            showControls={true}
          />
        </div>
      ) : (
        /* Payment Collection Entry Form */
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-4 bg-red-50 text-red-800 rounded-2xl text-xs sm:text-sm border border-red-200 font-semibold flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Student Selector Card */}
          <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <User className="w-5 h-5 text-emerald-600" />
              <h3 className="font-bold text-slate-900 text-base">১. শিক্ষার্থী নির্বাচন</h3>
            </div>

            <StudentSearchSelector
              students={students}
              name="student_id"
              id="student_id"
              label="শিক্ষার্থী অনুসন্ধান ও বাছাই"
              placeholder="শিক্ষার্থী বেছে নিন (নাম, রোল বা মোবাইল দিয়ে খুঁজুন)..."
              required
              onChange={(id) => setStudentId(id)}
              value={studentId}
            />

            {/* If student selected, show live summary badge */}
            {loadingProfile ? (
              <div className="text-xs text-slate-500 py-2">শিক্ষার্থীর বকেয়া তথ্য লোড হচ্ছে...</div>
            ) : studentProfile ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5">
                  <span className="text-[11px] text-slate-500 block font-semibold">মোট বকেয়া (Total Due)</span>
                  <span className="text-lg sm:text-xl font-black text-red-700 font-mono">
                    ৳ {formatBanglaCurrency(studentProfile.total_due)}
                  </span>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5">
                  <span className="text-[11px] text-slate-500 block font-semibold">পূর্বে পরিশোধিত ফি</span>
                  <span className="text-lg sm:text-xl font-black text-emerald-800 font-mono">
                    ৳ {formatBanglaCurrency(studentProfile.total_paid)}
                  </span>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5">
                  <span className="text-[11px] text-slate-500 block font-semibold">বকেয়া ইনভয়েস সংখ্যা</span>
                  <span className="text-lg sm:text-xl font-black text-slate-900 font-mono">
                    {toBanglaNumber(studentProfile.fees?.filter((f: any) => f.due_amount > 0).length || 0)} টি
                  </span>
                </div>
              </div>
            ) : null}
          </div>

          {/* Fee Invoices Breakdown & Allocations (if available) */}
          {studentProfile && studentProfile.fees && studentProfile.fees.filter((f: any) => f.due_amount > 0).length > 0 && (
            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-bold text-slate-900 text-base">২. বকেয়া ফি'র খাত ও বণ্টন (Allocations)</h3>
                </div>
                <span className="text-xs text-slate-500">বকেয়া ইনভয়েস অনুযায়ী স্বয়ংক্রিয় বরাদ্দ</span>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden text-xs sm:text-sm">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-4">ফি'র খাত</th>
                      <th className="py-2.5 px-4">মাস / পিরিয়ড</th>
                      <th className="py-2.5 px-4 text-right">নির্ধারিত ফি</th>
                      <th className="py-2.5 px-4 text-right">বকেয়া (৳)</th>
                      <th className="py-2.5 px-4 text-right">এই রিসিটে জমা (৳)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {studentProfile.fees
                      .filter((f: any) => f.due_amount > 0)
                      .map((fee: any) => (
                        <tr key={fee.id} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-4 font-bold text-slate-900">{fee.fee_type_name}</td>
                          <td className="py-2.5 px-4 text-slate-600">{fee.billing_period}</td>
                          <td className="py-2.5 px-4 text-right font-mono">৳{formatBanglaCurrency(fee.payable_amount)}</td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-red-700">
                            ৳{formatBanglaCurrency(fee.due_amount)}
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            <input
                              type="number"
                              min="0"
                              max={fee.due_amount}
                              value={allocations[fee.id] ?? fee.due_amount}
                              onChange={(e) => handleAllocationChange(fee.id, Number(e.target.value))}
                              className="w-28 px-2.5 py-1 border border-slate-300 rounded-lg text-right font-mono font-bold text-xs sm:text-sm focus:ring-2 focus:ring-slate-900"
                            />
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Payment Amount, Methods, Discounts & Notes */}
          <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-xs space-y-6">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <CreditCard className="w-5 h-5 text-emerald-600" />
              <h3 className="font-bold text-slate-900 text-base">৩. পেমেন্ট ও রসিদ বিবরণ</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 text-xs sm:text-sm">
              {/* Total Amount */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-800 block">
                  মোট আদায়কৃত টাকা (৳) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  step="1"
                  value={totalAmount || ""}
                  onChange={(e) => setTotalAmount(Number(e.target.value))}
                  placeholder="যেমন: 1500"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono font-bold text-base text-emerald-950 bg-emerald-50/40"
                />
              </div>

              {/* Payment Date */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-800 block">
                  জমার তারিখ <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white font-medium"
                />
              </div>

              {/* Payment Method */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-800 block">
                  পরিশোধের মাধ্যম <span className="text-red-500">*</span>
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white font-semibold"
                >
                  <option value="Cash">💵 ক্যাশ (নগদ)</option>
                  <option value="bKash">📱 বিকাশ (bKash)</option>
                  <option value="Nagad">📱 নগদ (Nagad)</option>
                  <option value="Rocket">📱 রকেট (Rocket)</option>
                  <option value="Bank">🏦 ব্যাংক ডিপোজিট / চেক</option>
                  <option value="Other">অন্যান্য</option>
                </select>
              </div>

              {/* Transaction Ref */}
              {paymentMethod !== "Cash" && (
                <div className="space-y-1.5 sm:col-span-2 md:col-span-3 animate-in fade-in">
                  <label className="font-bold text-slate-800 block">
                    ট্রানজেকশন আইডি / ব্যাংক ডিপোজিট স্লিপ নং
                  </label>
                  <input
                    type="text"
                    value={transactionRef}
                    onChange={(e) => setTransactionRef(e.target.value)}
                    placeholder="যেমন: TrxID: 9K8X2M1A বা ব্যাংক স্লিপ নং"
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono"
                  />
                </div>
              )}

              {/* Discount / Waiver */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-700 block">বিশেষ ছাড় / মওকুফ (ঐচ্ছিক)</label>
                <input
                  type="number"
                  min="0"
                  value={discountAmount || ""}
                  onChange={(e) => setDiscountAmount(Number(e.target.value))}
                  placeholder="ছাড়ের পরিমাণ (৳)"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono"
                />
              </div>

              {/* Discount Reason */}
              {discountAmount > 0 && (
                <div className="space-y-1.5 sm:col-span-2 animate-in fade-in">
                  <label className="font-bold text-slate-700 block">ছাড়ের কারণ / অনুমোদন</label>
                  <input
                    type="text"
                    value={discountReason}
                    onChange={(e) => setDiscountReason(e.target.value)}
                    placeholder="যেমন: মুহতারাম মুহতামিম সাহেবের অনুমোদনক্রমে"
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              )}

              {/* Notes */}
              <div className="space-y-1.5 sm:col-span-2 md:col-span-3">
                <label className="font-bold text-slate-700 block">রিসিট নোট / মন্তব্য (ঐচ্ছিক)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="যেমন: ৩ মাসের বকেয়া পরিশোধ / মে মাসের বেতন সহ..."
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>

            {/* Submission Button */}
            <div className="pt-4 border-t border-slate-100">
              <button
                type="submit"
                disabled={isPending || !studentId}
                className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 text-sm sm:text-base active:scale-99"
              >
                {isPending ? (
                  <span>ফি কালেকশন সম্পন্ন হচ্ছে...</span>
                ) : (
                  <>
                    <CreditCard className="w-5 h-5 text-emerald-400" />
                    <span>ফি সেভ ও A4 ডাবল মানি রিসিট প্রিন্ট করুন</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
