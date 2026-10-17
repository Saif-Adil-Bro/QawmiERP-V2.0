"use client";

import { useState, useEffect, useRef } from "react";
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
  BookOpen,
} from "lucide-react";
import Link from "next/link";
import DualMoneyReceipt from "@/components/accounting/DualMoneyReceipt";
import StudentSearchSelector from "@/components/common/StudentSearchSelector";

import { DEFAULT_FUNDS } from "@/lib/fund-utils";

interface CollectPaymentClientProps {
  students: any[];
  madrasaInfo?: any;
  preselectedStudentId?: string;
  funds?: any[];
}

export default function CollectPaymentClient({
  students = [],
  madrasaInfo,
  preselectedStudentId,
  funds = [],
}: CollectPaymentClientProps) {
  const currentYear = new Date().getFullYear();
  const todayStr = new Date().toISOString().split("T")[0];

  // Only use actual active funds defined in the system
  const allFunds = funds && funds.length > 0 ? funds : DEFAULT_FUNDS;

  const [studentId, setStudentId] = useState<string>(preselectedStudentId || "");
  const [studentProfile, setStudentProfile] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  // Form Fields
  const [paymentDate, setPaymentDate] = useState<string>(todayStr);
  const [paymentMethod, setPaymentMethod] = useState<"Cash" | "Bank" | "bKash" | "Nagad" | "Rocket" | "Other">("Cash");
  const [transactionRef, setTransactionRef] = useState<string>("");
  const [totalAmount, setTotalAmount] = useState<number | "">("");
  const [discountAmount, setDiscountAmount] = useState<number | "">("");
  const [discountReason, setDiscountReason] = useState<string>("");
  const [fineAmount, setFineAmount] = useState<number | "">("");
  const [fineReason, setFineReason] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [selectedGlobalFund, setSelectedGlobalFund] = useState<string>(allFunds[0]?.id || "fund-general");

  // Allocations & Fund Overrides
  const [allocations, setAllocations] = useState<{
    [feeId: string]: number;
  }>({});
  const [itemDiscounts, setItemDiscounts] = useState<{
    [feeId: string]: number;
  }>({});
  const [allocationFunds, setAllocationFunds] = useState<{
    [feeId: string]: string;
  }>({});

  const [isPending, setIsPending] = useState(false);

  // ⛔ HI-2 ফিক্সের ক্লায়েন্ট অংশ: প্রতিটি "নতুন পেমেন্ট চেষ্টা"-র জন্য একটি অনন্য
  // idempotency key তৈরি হয়। ডাবল-ক্লিক বা নেটওয়ার্ক রিট্রাই হলে একই key যায় —
  // সার্ভার তখনই সেটি চিনে দ্বিতীয়বার পেমেন্ট তৈরি করে না (আগের ১৫-সেকেন্ডের
  // সময়-ভিত্তিক গার্ডটি বৈধ দ্বিতীয় পেমেন্টও গিলে ফেলত)। পেমেন্ট সফল হলে key
  // রিফ্রেশ হয়, তাই পরের পেমেন্ট নতুন হিসেবেই যায়।
  const idempotencyKeyRef = useRef<string>(
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `pay_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  );
  const [error, setError] = useState<string | null>(null);
  const [successReceipt, setSuccessReceipt] = useState<any>(null);

  // Helper to determine initial fund for a fee
  const resolveInitialFundId = (fee: any) => {
    if (fee.fund_id && allFunds.some((f: any) => f.id === fee.fund_id)) {
      return fee.fund_id;
    }
    const name = fee.fee_type_name || fee.name || "";
    const isLillah =
      name.includes("বোর্ডিং") ||
      name.includes("খাবার") ||
      name.includes("খোরাকি") ||
      fee.category === "BOARDING";

    if (isLillah) {
      const lillahFund = allFunds.find(
        (f: any) =>
          f.id === "fund-lillah" ||
          f.category === "Lillah" ||
          f.name.includes("লিল্লাহ") ||
          f.name.includes("বোর্ডিং")
      );
      if (lillahFund) return lillahFund.id;
    }

    const generalFund = allFunds.find(
      (f: any) =>
        f.id === "fund-general" ||
        f.category === "General" ||
        f.name.includes("সাধারণ")
    );
    return generalFund?.id || allFunds[0]?.id || "fund-general";
  };

  // Load student due profile whenever studentId changes
  useEffect(() => {
    if (!studentId) {
      setStudentProfile(null);
      setAllocations({});
      setItemDiscounts({});
      setAllocationFunds({});
      setTotalAmount("");
      setDiscountAmount("");
      return;
    }

    let isMounted = true;

    async function fetchProfile() {
      setLoadingProfile(true);
      setError(null);
      try {
        let profile = null;
        try {
          const res = await fetch(`/api/fees/student-profile?studentId=${encodeURIComponent(studentId)}`);
          if (res.ok) {
            const data = await res.json();
            profile = data.profile;
          }
        } catch {
          // fallback to direct action if fetch fails
          profile = await getStudentFeeProfile(studentId);
        }

        if (!isMounted) return;

        setStudentProfile(profile);

        if (profile && profile.fees) {
          const unpaidFees = profile.fees.filter((f: any) => f.due_amount > 0);
          const initialAlloc: Record<string, number> = {};
          const initialDiscounts: Record<string, number> = {};
          const initialFunds: Record<string, string> = {};
          let initialSum = 0;

          unpaidFees.forEach((f: any) => {
            initialAlloc[f.id] = f.due_amount;
            initialDiscounts[f.id] = 0;
            initialFunds[f.id] = resolveInitialFundId(f);
            initialSum += f.due_amount;
          });

          setAllocations(initialAlloc);
          setItemDiscounts(initialDiscounts);
          setAllocationFunds(initialFunds);
          setTotalAmount(initialSum > 0 ? initialSum : "");
          setDiscountAmount("");
        }
      } catch (err) {
        console.error("fetchProfile failed:", err);
        if (isMounted) {
          setError("শিক্ষার্থীর বকেয়া তথ্য লোড করতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।");
        }
      } finally {
        if (isMounted) {
          setLoadingProfile(false);
        }
      }
    }

    fetchProfile();

    return () => {
      isMounted = false;
    };
  }, [studentId]);

  const selectedStudent = students.find((s) => s.id === studentId);

  // Live Summary Calculations
  const unpaidFeesList = (studentProfile?.fees || []).filter((f: any) => f.due_amount > 0);
  const totalGrossDue = unpaidFeesList.reduce((s: number, f: any) => s + (Number(f.due_amount) || 0), 0);
  const totalItemDiscounts = Object.values(itemDiscounts).reduce((s, d) => s + (Number(d) || 0), 0);
  const effectiveTotalDiscount = Math.max(Number(discountAmount) || 0, totalItemDiscounts);
  const netPayableAfterDiscount = Math.max(0, totalGrossDue - effectiveTotalDiscount);
  const cashToCollect = totalAmount === "" ? 0 : Number(totalAmount) || 0;
  const remainingDueAfterPayment = Math.max(0, netPayableAfterDiscount - cashToCollect);

  // Handle item-level instant discount change
  const handleItemDiscountChange = (feeId: string, val: number | "") => {
    const fee = studentProfile?.fees?.find((f: any) => f.id === feeId);
    const feeDue = fee ? Number(fee.due_amount) || 0 : 0;
    const discountNum = val === "" ? 0 : Math.max(0, Math.min(Number(val), feeDue));

    const updatedDiscounts = { ...itemDiscounts, [feeId]: discountNum };
    setItemDiscounts(updatedDiscounts);

    // Net payable for this item after discount
    const netPayableForItem = Math.max(0, feeDue - discountNum);

    // Update allocation for this item to its new net payable
    const updatedAlloc = { ...allocations, [feeId]: netPayableForItem };
    setAllocations(updatedAlloc);

    // Recompute total discount and total cash to collect
    const totalDisc = Object.values(updatedDiscounts).reduce((a, b) => a + (Number(b) || 0), 0);
    const totalCash = Object.values(updatedAlloc).reduce((a, b) => a + (Number(b) || 0), 0);

    setDiscountAmount(totalDisc > 0 ? totalDisc : "");
    setTotalAmount(totalCash > 0 ? totalCash : (totalDisc > 0 ? 0 : ""));
  };

  // Handle item-level cash allocation change
  const handleAllocationChange = (feeId: string, val: number | "") => {
    const fee = studentProfile?.fees?.find((f: any) => f.id === feeId);
    const feeDue = fee ? Number(fee.due_amount) || 0 : 0;
    const itemDiscount = itemDiscounts[feeId] || 0;
    const maxPayable = Math.max(0, feeDue - itemDiscount);

    const cashNum = val === "" ? 0 : Math.max(0, Math.min(Number(val), maxPayable));
    const updatedAlloc = { ...allocations, [feeId]: val === "" ? ("" as any) : cashNum };
    setAllocations(updatedAlloc);

    const sum = Object.values(updatedAlloc).reduce((a, b) => a + (Number(b) || 0), 0);
    setTotalAmount(sum);
  };

  // Handle total discount change from section 3 (distribute across items)
  const handleTotalDiscountChange = (val: number | "") => {
    if (val === "") {
      setDiscountAmount("");
      const resetDiscounts: Record<string, number> = {};
      const resetAlloc: Record<string, number> = {};
      let totalDue = 0;
      unpaidFeesList.forEach((f: any) => {
        resetDiscounts[f.id] = 0;
        resetAlloc[f.id] = f.due_amount;
        totalDue += f.due_amount;
      });
      setItemDiscounts(resetDiscounts);
      setAllocations(resetAlloc);
      setTotalAmount(totalDue > 0 ? totalDue : "");
      return;
    }

    const discNum = Math.max(0, Math.min(Number(val), totalGrossDue));
    setDiscountAmount(discNum > 0 ? discNum : "");

    // Distribute discount sequentially across unpaid fees
    let remDiscount = discNum;
    const newItemDiscounts: Record<string, number> = {};
    const newAllocations: Record<string, number> = {};

    unpaidFeesList.forEach((f: any) => {
      const takeDisc = Math.min(remDiscount, f.due_amount);
      newItemDiscounts[f.id] = takeDisc;
      remDiscount -= takeDisc;
      const netPayable = Math.max(0, f.due_amount - takeDisc);
      newAllocations[f.id] = netPayable;
    });

    setItemDiscounts(newItemDiscounts);
    setAllocations(newAllocations);
    const newTotalCash = Math.max(0, totalGrossDue - discNum);
    setTotalAmount(newTotalCash > 0 ? newTotalCash : (discNum > 0 ? 0 : ""));
  };

  // Handle total amount change from section 3
  const handleTotalAmountChange = (val: number | "") => {
    if (val === "") {
      setTotalAmount("");
      return;
    }
    const cashNum = Math.max(0, Number(val));
    setTotalAmount(cashNum);

    // Distribute cash across fees' net payables
    let remCash = cashNum;
    const newAllocations: Record<string, number> = {};

    unpaidFeesList.forEach((f: any) => {
      const disc = itemDiscounts[f.id] || 0;
      const maxNetPayable = Math.max(0, f.due_amount - disc);
      const alloc = Math.min(remCash, maxNetPayable);
      newAllocations[f.id] = alloc;
      remCash -= alloc;
    });

    setAllocations(newAllocations);
  };

  // Handle fund change for a fee
  const handleAllocationFundChange = (feeId: string, fundId: string) => {
    setAllocationFunds((prev) => ({ ...prev, [feeId]: fundId }));
  };

  // Submit payment
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId) {
      setError("অনুগ্রহ করে শিক্ষার্থী নির্বাচন করুন।");
      return;
    }
    const finalCash = Number(totalAmount) || 0;
    if (finalCash <= 0 && effectiveTotalDiscount <= 0) {
      setError("আদায়ের পরিমাণ অথবা ছাড়ের পরিমাণ ০ এর বেশি হতে হবে।");
      return;
    }

    setIsPending(true);
    setError(null);

    // Prepare allocations payload with specific funds and instant discounts
    const feeAllocationsList: any[] = [];
    if (studentProfile?.fees) {
      studentProfile.fees.forEach((f: any) => {
        const allocated = allocations[f.id] || 0;
        const discount = itemDiscounts[f.id] || 0;
        if (allocated > 0 || discount > 0) {
          const assignedFundId = allocationFunds[f.id] || resolveInitialFundId(f);
          const fundObj = allFunds.find((af) => af.id === assignedFundId);
          feeAllocationsList.push({
            student_fee_id: f.id,
            fee_type_id: f.fee_type_id,
            fee_type_name: f.fee_type_name,
            billing_period: f.billing_period,
            allocated_amount: allocated,
            discount_applied: discount,
            fund_id: assignedFundId,
            fund_name: fundObj?.name || "সাধারণ ফান্ড",
          });
        }
      });
    }

    const globalFundObj = allFunds.find((af) => af.id === selectedGlobalFund);

    try {
      const res = await collectFeePayment({
        student_id: studentId,
        session_id: studentProfile?.fees?.[0]?.session_id || "default",
        payment_date: paymentDate,
        payment_method: paymentMethod,
        transaction_ref: transactionRef,
        total_amount: finalCash,
        discount_amount: effectiveTotalDiscount,
        discount_reason: discountReason,
        fine_amount: Number(fineAmount),
        fine_reason: fineReason,
        fee_allocations: feeAllocationsList,
        notes: notes,
        fund_id: selectedGlobalFund,
        fund_name: globalFundObj?.name || "সাধারণ ফান্ড",
        // HI-2: ডুপ্লিকেট পেমেন্ট ঠেকানোর idempotency key
        idempotency_key: idempotencyKeyRef.current,
      });

      if (res?.success && res.payment) {
        // পেমেন্ট সফল — পরের পেমেন্টের জন্য নতুন key
        idempotencyKeyRef.current =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `pay_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
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
    setTotalAmount("");
    setDiscountAmount("");
    setDiscountReason("");
    setFineAmount(0);
    setFineReason("");
    setNotes("");
    setAllocations({});
    setItemDiscounts({});
    setAllocationFunds({});
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

          {/* Fee Invoices Breakdown, Allocations & Destination Fund Selection */}
          {studentProfile && studentProfile.fees && studentProfile.fees.filter((f: any) => f.due_amount > 0).length > 0 && (
            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-bold text-slate-900 text-base">২. বকেয়া ফি'র খাত ও ফান্ড বণ্টন (Fund Allocations)</h3>
                </div>
                <span className="text-xs text-slate-500">প্রয়োজনে যেকোনো ফি'র ফান্ড পরিবর্তন করুন</span>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden text-xs sm:text-sm">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-4">ফি'র খাত</th>
                      <th className="py-2.5 px-4">জমা হওয়ার ফান্ড</th>
                      <th className="py-2.5 px-4 text-right">নির্ধারিত বকেয়া (৳)</th>
                      <th className="py-2.5 px-4 text-right text-amber-800">তাৎক্ষণিক ছাড় (৳)</th>
                      <th className="py-2.5 px-4 text-right text-slate-800">প্রদেয় নিট (৳)</th>
                      <th className="py-2.5 px-4 text-right text-emerald-900">এই রিসিটে জমা (৳)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {studentProfile.fees
                      .filter((f: any) => f.due_amount > 0)
                      .map((fee: any) => {
                        const currentFundId = allocationFunds[fee.id] || resolveInitialFundId(fee);
                        const itemDiscount = itemDiscounts[fee.id] || 0;
                        const netPayable = Math.max(0, fee.due_amount - itemDiscount);

                        return (
                          <tr key={fee.id} className="hover:bg-slate-50/50">
                            <td className="py-2.5 px-4">
                              <div className="font-bold text-slate-900">{fee.fee_type_name}</div>
                              <div className="text-[11px] text-slate-500">{fee.billing_period}</div>
                            </td>
                            <td className="py-2.5 px-4">
                              <select
                                value={currentFundId}
                                onChange={(e) => handleAllocationFundChange(fee.id, e.target.value)}
                                className="px-2.5 py-1 text-xs border border-emerald-300 rounded-lg bg-emerald-50/60 font-semibold text-emerald-950 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                              >
                                {allFunds.map((af) => (
                                  <option key={af.id} value={af.id}>
                                    {af.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-800">
                              ৳{formatBanglaCurrency(fee.due_amount)}
                            </td>
                            <td className="py-2.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <span className="text-amber-600 text-xs font-bold">(-)</span>
                                <input
                                  type="number"
                                  min="0"
                                  max={fee.due_amount}
                                  value={itemDiscounts[fee.id] ? itemDiscounts[fee.id] : ""}
                                  onChange={(e) => handleItemDiscountChange(fee.id, e.target.value === "" ? "" : Number(e.target.value))}
                                  placeholder="০"
                                  className="w-24 px-2 py-1 border border-amber-300 bg-amber-50/40 rounded-lg text-right font-mono font-bold text-xs sm:text-sm text-amber-950 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                                />
                              </div>
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">
                              ৳{formatBanglaCurrency(netPayable)}
                            </td>
                            <td className="py-2.5 px-4 text-right">
                              <input
                                type="number"
                                min="0"
                                max={netPayable}
                                value={allocations[fee.id] !== undefined ? allocations[fee.id] : netPayable}
                                onChange={(e) => handleAllocationChange(fee.id, e.target.value === "" ? "" : Number(e.target.value))}
                                className="w-28 px-2.5 py-1 border border-slate-300 rounded-lg text-right font-mono font-bold text-xs sm:text-sm focus:ring-2 focus:ring-slate-900 bg-emerald-50/30 text-emerald-950"
                              />
                            </td>
                          </tr>
                        );
                      })}
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
                  মোট আদায়কৃত নগদ টাকা (৳) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={totalAmount ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    handleTotalAmountChange(v === "" ? "" : Number(v));
                  }}
                  placeholder="যেমন: 1500"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono font-bold text-base text-emerald-950 bg-emerald-50/40"
                />
              </div>

              {/* Fund Selection for General or Direct collection */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-800 block flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
                  <span>জমা হওয়ার প্রধান ফান্ড</span>
                </label>
                <select
                  value={selectedGlobalFund}
                  onChange={(e) => setSelectedGlobalFund(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-emerald-300 bg-emerald-50/40 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600 font-bold text-slate-900"
                >
                  {allFunds.map((af) => (
                    <option key={af.id} value={af.id}>
                      {af.name}
                    </option>
                  ))}
                </select>
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
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700 block">বিশেষ ছাড় / মওকুফ (ঐচ্ছিক)</label>
                  {effectiveTotalDiscount > 0 && (
                    <span className="text-[11px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full">
                      ছাড়: ৳ {formatBanglaCurrency(effectiveTotalDiscount)}
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  min="0"
                  max={totalGrossDue}
                  value={discountAmount ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    handleTotalDiscountChange(v === "" ? "" : Number(v));
                  }}
                  placeholder="যেমন: 500"
                  className="w-full px-3.5 py-2.5 border border-amber-300 bg-amber-50/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono font-bold text-amber-950"
                />
              </div>

              {/* Discount Reason */}
              {effectiveTotalDiscount > 0 && (
                <div className="space-y-1.5 sm:col-span-2 animate-in fade-in">
                  <label className="font-bold text-slate-700 block">ছাড়ের কারণ / অনুমোদন</label>
                  <input
                    type="text"
                    value={discountReason}
                    onChange={(e) => setDiscountReason(e.target.value)}
                    placeholder="যেমন: মুহতারাম মুহতামিম সাহেবের অনুমোদনক্রমে / এতিম মওকুফ"
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

            {/* Live Calculation Summary Banner */}
            <div className="p-4.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-2.5">
                <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <span>লাইভ পেমেন্ট ও ডিসকাউন্ট সামারি (Live Calculation)</span>
                </div>
                <div>
                  {remainingDueAfterPayment === 0 ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-2xs">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                      {cashToCollect === 0 && effectiveTotalDiscount >= totalGrossDue
                        ? "শতভাগ মওকুফ (WAIVED) - বকেয়া ০"
                        : "সম্পূর্ণ পরিশোধ (PAID) - বকেয়া ০"}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-900 border border-amber-300">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-700" />
                      আংশিক পরিশোধ (PARTIAL)
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-center text-xs">
                <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="text-slate-500 font-semibold text-[11px]">১. মোট বকেয়া বিল</div>
                  <div className="text-sm sm:text-base font-black text-slate-900 font-mono mt-0.5">
                    ৳ {formatBanglaCurrency(totalGrossDue)}
                  </div>
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-amber-200 shadow-2xs">
                  <div className="text-amber-700 font-semibold text-[11px]">২. তাৎক্ষণিক ছাড় (-)</div>
                  <div className="text-sm sm:text-base font-black text-amber-800 font-mono mt-0.5">
                    ৳ {formatBanglaCurrency(effectiveTotalDiscount)}
                  </div>
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-indigo-200 shadow-2xs">
                  <div className="text-indigo-700 font-semibold text-[11px]">৩. প্রদেয় পরিমাণ (Net)</div>
                  <div className="text-sm sm:text-base font-black text-indigo-900 font-mono mt-0.5">
                    ৳ {formatBanglaCurrency(netPayableAfterDiscount)}
                  </div>
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-emerald-200 shadow-2xs">
                  <div className="text-emerald-700 font-semibold text-[11px]">৪. এই রিসিটে আদায়</div>
                  <div className="text-sm sm:text-base font-black text-emerald-900 font-mono mt-0.5">
                    ৳ {formatBanglaCurrency(cashToCollect)}
                  </div>
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs col-span-2 sm:col-span-1">
                  <div className="text-slate-500 font-semibold text-[11px]">৫. অবশিষ্ট বকেয়া</div>
                  <div className={`text-sm sm:text-base font-black font-mono mt-0.5 ${remainingDueAfterPayment === 0 ? "text-emerald-700" : "text-rose-700"}`}>
                    ৳ {formatBanglaCurrency(remainingDueAfterPayment)}
                  </div>
                </div>
              </div>
            </div>

            {/* Submission Button */}
            <div className="pt-2 border-t border-slate-100">
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
