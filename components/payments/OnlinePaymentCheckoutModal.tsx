"use client";

import React, { useState } from "react";
import {
  CreditCard,
  Building2,
  Smartphone,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Printer,
  Copy,
  Check,
  RefreshCw,
  Lock,
  ChevronRight,
  X,
  ExternalLink,
} from "lucide-react";
import { toBanglaNumber, formatBanglaCurrency } from "@/lib/numberToBangla";
import type { IslamiBankConfig } from "@/lib/payment-gateway";

interface FeeInvoiceItem {
  id: string;
  fee_type_name: string;
  billing_period: string;
  due_amount: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
  studentName: string;
  studentRoll?: string;
  className?: string;
  totalDue: number;
  unpaidFees?: FeeInvoiceItem[];
  islamiBankConfig?: IslamiBankConfig;
  onPaymentSuccess?: (receiptData: any) => void;
}

type ChannelType = "bKash" | "Nagad" | "Rocket" | "Islami Bank" | "Card / Other";
type CheckoutStep = "SELECT_METHOD" | "GATEWAY_PROCESSING" | "GATEWAY_AUTH" | "SUCCESS";

export default function OnlinePaymentCheckoutModal({
  isOpen,
  onClose,
  studentId,
  studentName,
  studentRoll,
  className,
  totalDue,
  unpaidFees = [],
  islamiBankConfig,
  onPaymentSuccess,
}: Props) {
  const [selectedChannel, setSelectedChannel] = useState<ChannelType>("bKash");
  const [payAmount, setPayAmount] = useState<number>(totalDue > 0 ? totalDue : 1000);
  const [selectedFeeIds, setSelectedFeeIds] = useState<string[]>(
    unpaidFees.map((f) => f.id)
  );

  const [step, setStep] = useState<CheckoutStep>("SELECT_METHOD");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Active Transaction Data
  const [activeTxnId, setActiveTxnId] = useState<string>("");
  const [payerPhone, setPayerPhone] = useState<string>("01700000000");
  const [gatewayPin, setGatewayPin] = useState<string>("");
  const [gatewayOtp, setGatewayOtp] = useState<string>("");
  const [ibblUserId, setIbblUserId] = useState<string>("");
  const [ibblAccountNo, setIbblAccountNo] = useState<string>("");

  // Result state
  const [completedReceipt, setCompletedReceipt] = useState<any>(null);
  const [isCopied, setIsCopied] = useState(false);

  if (!isOpen) return null;

  // Handle fee selection toggle
  const toggleFeeSelection = (feeId: string, feeAmount: number) => {
    let newSelected: string[];
    if (selectedFeeIds.includes(feeId)) {
      newSelected = selectedFeeIds.filter((id) => id !== feeId);
    } else {
      newSelected = [...selectedFeeIds, feeId];
    }
    setSelectedFeeIds(newSelected);

    // Recalculate amount
    const sum = unpaidFees
      .filter((f) => newSelected.includes(f.id))
      .reduce((acc, curr) => acc + curr.due_amount, 0);
    setPayAmount(sum > 0 ? sum : totalDue);
  };

  // Step 1: Initiate Payment Session
  const handleStartPayment = async () => {
    if (payAmount <= 0) {
      setErrorMsg("অনুগ্রহ করে পরিশোধের পরিমাণ নির্ধারণ করুন।");
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setStep("GATEWAY_PROCESSING");

    try {
      const res = await fetch("/api/payments/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: studentId,
          amount: payAmount,
          payment_channel: selectedChannel,
          payer_phone: payerPhone,
          selected_fee_ids: selectedFeeIds,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "পেমেন্ট শুরু করতে ব্যর্থ হয়েছে।");
      }

      setActiveTxnId(data.transaction_id);

      // Brief delay to simulate gateway SSL handshake
      setTimeout(() => {
        setIsLoading(false);
        setStep("GATEWAY_AUTH");
      }, 750);
    } catch (err: any) {
      setIsLoading(false);
      setErrorMsg(err.message || "পেমেন্ট গেটওয়ের সংযোগে ত্রুটি দেখা দিয়েছে।");
      setStep("SELECT_METHOD");
    }
  };

  // Step 2: Confirm / Verify Payment via Gateway
  const handleConfirmGatewayPayment = async () => {
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transaction_id: activeTxnId,
          gateway_ref: `PGW-${Date.now()}`,
          bank_tran_id: `IBBL-${Date.now()}`,
          payer_phone: payerPhone,
          is_simulated: true,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "পেমেন্ট সম্পন্ন হতে ব্যর্থ হয়েছে।");
      }

      setCompletedReceipt(data);
      setStep("SUCCESS");
      if (onPaymentSuccess) {
        onPaymentSuccess(data);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "পেমেন্ট ভেরিফিকেশনে ত্রুটি ঘটেছে।");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyReceipt = () => {
    if (completedReceipt?.receipt_no) {
      navigator.clipboard.writeText(
        `রসিদ নং: ${completedReceipt.receipt_no}\nট্রানজেকশন আইডি: ${completedReceipt.transaction_id}\nটাকার পরিমাণ: ৳ ${completedReceipt.amount}\nশিক্ষার্থী: ${completedReceipt.student_name}`
      );
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Header Bar */}
        <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 backdrop-blur-md rounded-2xl text-emerald-300">
              <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">অনলাইন ফি পেমেন্ট গেটওয়ে</h2>
              <div className="flex items-center gap-2 text-xs text-emerald-200/90 mt-0.5">
                <span>{studentName}</span>
                <span>•</span>
                <span>জামাত: {className || "সাধারণ"}</span>
                {studentRoll && <span>(রোল: {toBanglaNumber(studentRoll)})</span>}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body with Step Machine */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-xs text-rose-800 font-medium">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">{errorMsg}</div>
              <button onClick={() => setErrorMsg(null)} className="text-rose-500 font-bold">
                ✕
              </button>
            </div>
          )}

          {/* STEP 1: METHOD SELECTION & AMOUNT */}
          {step === "SELECT_METHOD" && (
            <div className="space-y-5">
              {/* Fee Breakdown Checklist */}
              {unpaidFees.length > 0 && (
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3 sm:p-4">
                  <div className="text-xs font-bold text-slate-700 mb-2 flex items-center justify-between">
                    <span>বকেয়া ফি নির্বাচন করুন:</span>
                    <span className="text-[11px] text-emerald-700 font-semibold">
                      {toBanglaNumber(selectedFeeIds.length)} টি নির্বাচিত
                    </span>
                  </div>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {unpaidFees.map((fee) => (
                      <label
                        key={fee.id}
                        className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200 hover:border-emerald-300 transition cursor-pointer text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedFeeIds.includes(fee.id)}
                            onChange={() => toggleFeeSelection(fee.id, fee.due_amount)}
                            className="w-4 h-4 text-emerald-600 rounded"
                          />
                          <div>
                            <span className="font-bold text-slate-800">{fee.fee_type_name}</span>
                            <span className="text-[11px] text-slate-500 block">
                              {fee.billing_period}
                            </span>
                          </div>
                        </div>
                        <div className="font-mono font-bold text-slate-900">
                          ৳ {formatBanglaCurrency(fee.due_amount)}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Total Payable Summary Card */}
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50/40 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-emerald-900 block">
                    সর্বমোট প্রদেয় ফি (Total Payable)
                  </span>
                  <div className="text-2xl sm:text-3xl font-black text-emerald-950 font-mono mt-0.5">
                    ৳ {formatBanglaCurrency(payAmount)}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100/70 border border-emerald-300/60 px-2.5 py-1 rounded-full inline-block">
                    ● ২৪/৭ অনলাইন পেমেন্ট
                  </span>
                </div>
              </div>

              {/* Payment Methods Grid */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-2.5">
                  পরিশোধের মাধ্যম নির্বাচন করুন:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {/* bKash */}
                  <button
                    type="button"
                    onClick={() => setSelectedChannel("bKash")}
                    className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition relative overflow-hidden ${
                      selectedChannel === "bKash"
                        ? "border-[#D12053] bg-pink-50/50 shadow-sm ring-2 ring-[#D12053]/20"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-black bg-[#D12053] text-white">
                        bKash
                      </span>
                      {selectedChannel === "bKash" && (
                        <CheckCircle2 className="w-4 h-4 text-[#D12053]" />
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-xs text-slate-900">বিকাশ</div>
                      <span className="text-[10px] text-slate-500">১-ক্লিক অনলাইন ফি</span>
                    </div>
                  </button>

                  {/* Nagad */}
                  <button
                    type="button"
                    onClick={() => setSelectedChannel("Nagad")}
                    className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition relative overflow-hidden ${
                      selectedChannel === "Nagad"
                        ? "border-[#EA1D25] bg-orange-50/50 shadow-sm ring-2 ring-[#EA1D25]/20"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-black bg-[#EA1D25] text-white">
                        Nagad
                      </span>
                      {selectedChannel === "Nagad" && (
                        <CheckCircle2 className="w-4 h-4 text-[#EA1D25]" />
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-xs text-slate-900">নগদ</div>
                      <span className="text-[10px] text-slate-500">ইনস্ট্যান্ট পেমেন্ট</span>
                    </div>
                  </button>

                  {/* Islami Bank Bangladesh */}
                  <button
                    type="button"
                    onClick={() => setSelectedChannel("Islami Bank")}
                    className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition relative overflow-hidden ${
                      selectedChannel === "Islami Bank"
                        ? "border-emerald-600 bg-emerald-50/60 shadow-sm ring-2 ring-emerald-600/20"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-700 text-white">
                        IBBL
                      </span>
                      {selectedChannel === "Islami Bank" && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-xs text-slate-900">ইসলামী ব্যাংক</div>
                      <span className="text-[10px] text-slate-500">CellFin / iBanking</span>
                    </div>
                  </button>

                  {/* Rocket */}
                  <button
                    type="button"
                    onClick={() => setSelectedChannel("Rocket")}
                    className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition relative overflow-hidden ${
                      selectedChannel === "Rocket"
                        ? "border-[#8C3494] bg-purple-50/50 shadow-sm ring-2 ring-[#8C3494]/20"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-black bg-[#8C3494] text-white">
                        Rocket
                      </span>
                      {selectedChannel === "Rocket" && (
                        <CheckCircle2 className="w-4 h-4 text-[#8C3494]" />
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-xs text-slate-900">রকেট</div>
                      <span className="text-[10px] text-slate-500">DBBL রকেট</span>
                    </div>
                  </button>

                  {/* Cards & Other Banks */}
                  <button
                    type="button"
                    onClick={() => setSelectedChannel("Card / Other")}
                    className={`col-span-2 sm:col-span-2 p-3 rounded-2xl border text-left flex flex-col justify-between transition relative overflow-hidden ${
                      selectedChannel === "Card / Other"
                        ? "border-blue-600 bg-blue-50/50 shadow-sm ring-2 ring-blue-600/20"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-black bg-blue-700 text-white">
                        Cards / Bank
                      </span>
                      {selectedChannel === "Card / Other" && (
                        <CheckCircle2 className="w-4 h-4 text-blue-700" />
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-xs text-slate-900">
                        ভিসা, মাস্টারকার্ড ও অন্যান্য ব্যাংক
                      </div>
                      <span className="text-[10px] text-slate-500">
                        Nexus Card, City Touch, অন্যান্য ডেবিট/ক্রেডিট কার্ড
                      </span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Payer Contact Number */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  অভিভাবকের মোবাইল নম্বর (কনফার্মেশন এসএমএসের জন্য):
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    value={payerPhone}
                    onChange={(e) => setPayerPhone(e.target.value)}
                    placeholder="017XXXXXXXX"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                  <Smartphone className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                </div>
              </div>

              {/* Proceed Button */}
              <button
                type="button"
                onClick={handleStartPayment}
                disabled={isLoading || payAmount <= 0}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold rounded-2xl text-sm shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <span>৳ {formatBanglaCurrency(payAmount)} পরিশোধ করুন</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* STEP 2: GATEWAY CONNECTING LOADER */}
          {step === "GATEWAY_PROCESSING" && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-14 h-14 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  নিরাপদ পেমেন্ট গেটওয়ের সাথে সংযোগ স্থাপন করা হচ্ছে...
                </h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  SSLCommerz / {selectedChannel} সুরক্ষিত সার্ভার লোড হচ্ছে। অনুগ্রহ করে অপেক্ষা করুন...
                </p>
              </div>
            </div>
          )}

          {/* STEP 3: AUTHENTIC GATEWAY CHECKOUT SCREEN (bKash / Nagad / Islami Bank / Rocket) */}
          {step === "GATEWAY_AUTH" && (
            <div className="space-y-4">
              {/* bKash Checkout UI */}
              {selectedChannel === "bKash" && (
                <div className="bg-[#D12053] rounded-3xl p-5 text-white shadow-lg space-y-4 animate-in zoom-in-95 duration-200">
                  <div className="flex items-center justify-between border-b border-white/20 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-white text-[#D12053] flex items-center justify-center font-black text-sm">
                        ৳
                      </div>
                      <span className="font-bold text-base">bKash Payment</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] opacity-80 block">প্রদেয় টাকা</span>
                      <span className="font-mono font-bold text-lg">৳ {payAmount}</span>
                    </div>
                  </div>

                  <div className="space-y-3 text-slate-900 text-xs">
                    <div>
                      <label className="text-white text-xs font-semibold block mb-1">
                        আপনার বিকাশ অ্যাকাউন্ট নম্বর:
                      </label>
                      <input
                        type="text"
                        value={payerPhone}
                        onChange={(e) => setPayerPhone(e.target.value)}
                        placeholder="01XXXXXXXXX"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white text-slate-900 font-mono text-sm font-bold focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-white text-xs font-semibold block mb-1">
                        ওটিপি (OTP / ভেরিফিকেশন কোড):
                      </label>
                      <input
                        type="text"
                        value={gatewayOtp}
                        onChange={(e) => setGatewayOtp(e.target.value)}
                        placeholder="123456 (টেস্টিং কোড)"
                        className="w-full px-3.5 py-2 rounded-xl bg-white text-slate-900 font-mono text-sm focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-white text-xs font-semibold block mb-1">
                        বিকাশ পিন (PIN):
                      </label>
                      <input
                        type="password"
                        value={gatewayPin}
                        onChange={(e) => setGatewayPin(e.target.value)}
                        placeholder="•••••"
                        maxLength={5}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white text-slate-900 font-mono text-base tracking-widest focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={handleConfirmGatewayPayment}
                      disabled={isLoading}
                      className="flex-1 py-3 bg-white hover:bg-slate-100 text-[#D12053] font-bold rounded-2xl text-sm transition shadow-sm cursor-pointer disabled:opacity-50"
                    >
                      {isLoading ? "যাচাই হচ্ছে..." : "কনফার্ম করুন"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep("SELECT_METHOD")}
                      className="px-4 py-3 bg-black/20 hover:bg-black/30 text-white rounded-2xl text-xs font-semibold transition"
                    >
                      বাতিল
                    </button>
                  </div>
                </div>
              )}

              {/* Nagad Checkout UI */}
              {selectedChannel === "Nagad" && (
                <div className="bg-[#EA1D25] rounded-3xl p-5 text-white shadow-lg space-y-4 animate-in zoom-in-95 duration-200">
                  <div className="flex items-center justify-between border-b border-white/20 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-white text-[#EA1D25] flex items-center justify-center font-black text-sm">
                        ন
                      </div>
                      <span className="font-bold text-base">নগদ পেমেন্ট গেটওয়ে</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] opacity-80 block">প্রদেয় টাকা</span>
                      <span className="font-mono font-bold text-lg">৳ {payAmount}</span>
                    </div>
                  </div>

                  <div className="space-y-3 text-slate-900 text-xs">
                    <div>
                      <label className="text-white text-xs font-semibold block mb-1">
                        নগদ অ্যাকাউন্ট নম্বর:
                      </label>
                      <input
                        type="text"
                        value={payerPhone}
                        onChange={(e) => setPayerPhone(e.target.value)}
                        placeholder="01XXXXXXXXX"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white text-slate-900 font-mono text-sm font-bold focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-white text-xs font-semibold block mb-1">
                        পিন নম্বর (PIN):
                      </label>
                      <input
                        type="password"
                        value={gatewayPin}
                        onChange={(e) => setGatewayPin(e.target.value)}
                        placeholder="••••"
                        maxLength={4}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white text-slate-900 font-mono text-base tracking-widest focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={handleConfirmGatewayPayment}
                      disabled={isLoading}
                      className="flex-1 py-3 bg-white hover:bg-slate-100 text-[#EA1D25] font-bold rounded-2xl text-sm transition shadow-sm cursor-pointer disabled:opacity-50"
                    >
                      {isLoading ? "যাচাই হচ্ছে..." : "পেমেন্ট নিশ্চিত করুন"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep("SELECT_METHOD")}
                      className="px-4 py-3 bg-black/20 hover:bg-black/30 text-white rounded-2xl text-xs font-semibold transition"
                    >
                      বাতিল
                    </button>
                  </div>
                </div>
              )}

              {/* Islami Bank Bangladesh (IBBL / CellFin) Checkout UI */}
              {selectedChannel === "Islami Bank" && (
                <div className="bg-gradient-to-br from-emerald-900 to-teal-950 rounded-3xl p-5 text-white shadow-xl space-y-4 animate-in zoom-in-95 duration-200 border border-emerald-500/30">
                  <div className="flex items-center justify-between border-b border-emerald-600/40 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-white text-emerald-800 flex items-center justify-center font-black text-xs">
                        IBBL
                      </div>
                      <div>
                        <span className="font-bold text-sm sm:text-base block">
                          ইসলামী ব্যাংক বাংলাদেশ পিএলসি
                        </span>
                        <span className="text-[10px] text-emerald-300">
                          iBanking & CellFin Gateway
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] text-emerald-200 block">মোট ফি</span>
                      <span className="font-mono font-bold text-lg text-emerald-300">
                        ৳ {payAmount}
                      </span>
                    </div>
                  </div>

                  {/* Madrasa Bank Account Box */}
                  <div className="bg-black/30 border border-emerald-500/30 rounded-2xl p-3 text-xs space-y-1">
                    <div className="text-[11px] text-emerald-300 font-bold uppercase tracking-wider">
                      মাদরাসার ইসলামী ব্যাংক অ্যাকাউন্ট:
                    </div>
                    <div className="text-sm font-mono font-bold text-white">
                      অ্যাকাউন্ট নং: {islamiBankConfig?.account_number || "20501450200123456"}
                    </div>
                    <div className="text-emerald-200 text-[11px]">
                      শাখা: {islamiBankConfig?.branch_name || "মিরপুর শাখা"} • রাউটিং:{" "}
                      {islamiBankConfig?.routing_number || "125262728"}
                    </div>
                    {islamiBankConfig?.cellfin_number && (
                      <div className="text-amber-300 text-[11px] font-semibold">
                        সরাসরি সেলফিন (CellFin) নম্বর: {islamiBankConfig.cellfin_number}
                      </div>
                    )}
                  </div>

                  {/* Interactive input for CellFin / iBanking */}
                  <div className="space-y-3 text-xs text-slate-900">
                    <div>
                      <label className="text-emerald-100 text-xs font-semibold block mb-1">
                        আপনার সেলফিন (CellFin) বা ব্যাংক অ্যাকাউন্ট নং:
                      </label>
                      <input
                        type="text"
                        value={ibblAccountNo || payerPhone}
                        onChange={(e) => setIbblAccountNo(e.target.value)}
                        placeholder="01XXXXXXXXX বা 2050..."
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white text-slate-900 font-mono text-sm font-bold focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-emerald-100 text-xs font-semibold block mb-1">
                        সেলফিন পিন বা ওটিপি:
                      </label>
                      <input
                        type="password"
                        value={gatewayPin}
                        onChange={(e) => setGatewayPin(e.target.value)}
                        placeholder="••••••"
                        maxLength={6}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white text-slate-900 font-mono text-base tracking-widest focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={handleConfirmGatewayPayment}
                      disabled={isLoading}
                      className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-2xl text-sm transition shadow-sm cursor-pointer disabled:opacity-50"
                    >
                      {isLoading ? "যাচাই হচ্ছে..." : "ইসলামী ব্যাংকে পেমেন্ট সম্পন্ন করুন"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep("SELECT_METHOD")}
                      className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-xs font-semibold transition"
                    >
                      বাতিল
                    </button>
                  </div>
                </div>
              )}

              {/* Rocket or Card Gateway Screen */}
              {(selectedChannel === "Rocket" || selectedChannel === "Card / Other") && (
                <div className="bg-slate-900 rounded-3xl p-5 text-white shadow-xl space-y-4 animate-in zoom-in-95 duration-200">
                  <div className="flex items-center justify-between border-b border-white/20 pb-3">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-blue-400" />
                      <span className="font-bold text-base">
                        {selectedChannel === "Rocket" ? "Rocket Gateway" : "Debit / Credit Card"}
                      </span>
                    </div>
                    <div className="text-right font-mono font-bold text-lg text-emerald-400">
                      ৳ {payAmount}
                    </div>
                  </div>

                  <div className="space-y-3 text-xs text-slate-900">
                    <div>
                      <label className="text-slate-200 text-xs font-semibold block mb-1">
                        {selectedChannel === "Rocket" ? "রকেট মোবাইল নম্বর (১২ ডিজিট)" : "কার্ড নম্বর"}
                      </label>
                      <input
                        type="text"
                        value={payerPhone}
                        onChange={(e) => setPayerPhone(e.target.value)}
                        placeholder="XXXX-XXXX-XXXX"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white text-slate-900 font-mono text-sm font-bold focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-slate-200 text-xs font-semibold block mb-1">
                        পিন / সিভিসি (PIN / CVC)
                      </label>
                      <input
                        type="password"
                        value={gatewayPin}
                        onChange={(e) => setGatewayPin(e.target.value)}
                        placeholder="•••"
                        maxLength={4}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white text-slate-900 font-mono text-base tracking-widest focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={handleConfirmGatewayPayment}
                      disabled={isLoading}
                      className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-2xl text-sm transition shadow-sm cursor-pointer disabled:opacity-50"
                    >
                      {isLoading ? "প্রসেসিং..." : "পেমেন্ট নিশ্চিত করুন"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep("SELECT_METHOD")}
                      className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-xs font-semibold transition"
                    >
                      বাতিল
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: SUCCESS RECEIPT SCREEN */}
          {step === "SUCCESS" && completedReceipt && (
            <div className="text-center py-4 space-y-4 animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  আলহামদুলিল্লাহ! পেমেন্ট সফলভাবে গৃহীত হয়েছে
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  টাকা মাদরাসার তহবিলে জমা হয়েছে এবং মানি রিসিট প্রস্তুত করা হয়েছে।
                </p>
              </div>

              {/* Receipt Summary Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left space-y-2.5 text-xs">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                  <span className="text-slate-500 font-medium">রসিদ নম্বর (Receipt No):</span>
                  <span className="font-mono font-bold text-emerald-800 text-sm">
                    {completedReceipt.receipt_no}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">ট্রানজেকশন আইডি:</span>
                  <span className="font-mono font-semibold text-slate-700">
                    {completedReceipt.transaction_id}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">পরিশোধের মাধ্যম:</span>
                  <span className="font-bold text-slate-800">
                    {completedReceipt.payment_channel || selectedChannel}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">পরিশোধিত টাকা:</span>
                  <span className="font-mono font-black text-emerald-700 text-base">
                    ৳ {formatBanglaCurrency(completedReceipt.amount)}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-slate-200/80">
                  <span className="text-slate-500 font-medium">তারিখ ও সময়:</span>
                  <span className="text-slate-700">{completedReceipt.payment_date || "আজ"}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleCopyReceipt}
                  className="w-full sm:flex-1 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
                >
                  {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{isCopied ? "কপি হয়েছে" : "রসিদ কপি করুন"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    window.print();
                  }}
                  className="w-full sm:flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>রসিদ প্রিন্ট করুন</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  window.location.reload();
                }}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm transition"
              >
                সম্পন্ন করুন
              </button>
            </div>
          )}
        </div>

        {/* Footer Security Badges */}
        <div className="bg-slate-50 border-t border-slate-100 p-3 sm:px-6 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
          <div className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-emerald-600" />
            <span>২৫৬-বিট SSL এনক্রিপ্টেড পেমেন্ট</span>
          </div>
          <div className="flex items-center gap-2 font-mono font-bold text-[10px] text-slate-400">
            <span>bKash</span>
            <span>•</span>
            <span>Nagad</span>
            <span>•</span>
            <span>IBBL</span>
            <span>•</span>
            <span>Rocket</span>
          </div>
        </div>
      </div>
    </div>
  );
}
