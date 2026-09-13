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
  Info,
  Clock,
} from "lucide-react";
import { toBanglaNumber, formatBanglaCurrency } from "@/lib/numberToBangla";
import { numberToBanglaWords } from "@/lib/utils";
import { printElementIsolated } from "@/lib/printUtils";
import type { IslamiBankConfig } from "@/lib/payment-gateway";
import { PaymentBrandSymbol, CardBrandsIcon } from "@/components/payments/PaymentBrandLogos";

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
type CheckoutStep =
  | "SELECT_METHOD"
  | "GATEWAY_PROCESSING"
  | "GATEWAY_REDIRECT"
  | "IBBL_MANUAL_SUBMIT"
  | "PENDING_VERIFICATION"
  | "SUCCESS";

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
  const [payerPhone, setPayerPhone] = useState<string>("");
  const [redirectUrl, setRedirectUrl] = useState<string>("");
  const [gatewayProvider, setGatewayProvider] = useState<string>("SSLCOMMERZ");

  // IBBL Manual Submission
  const [ibblSenderPhone, setIbblSenderPhone] = useState<string>("");
  const [ibblTrxId, setIbblTrxId] = useState<string>("");
  const [ibblNotes, setIbblNotes] = useState<string>("");

  // Result state
  const [completedReceipt, setCompletedReceipt] = useState<any>(null);
  const [pendingSubmission, setPendingSubmission] = useState<any>(null);
  const [isCopied, setIsCopied] = useState(false);

  if (!isOpen) return null;

  // Handle fee selection toggle
  const toggleFeeSelection = (feeId: string) => {
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

  // Step 1: Initiate Payment Session via Real Gateway API
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
          payer_phone: payerPhone || undefined,
          selected_fee_ids: selectedFeeIds,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "পেমেন্ট গেটওয়ে সার্ভারের সাথে সংযোগে ত্রুটি ঘটেছে।");
      }

      setActiveTxnId(data.transaction_id);

      if (data.is_manual_bank || selectedChannel === "Islami Bank") {
        setIsLoading(false);
        setStep("IBBL_MANUAL_SUBMIT");
        return;
      }

      if (data.redirect_url || data.gateway_url) {
        const url = data.redirect_url || data.gateway_url;
        setRedirectUrl(url);
        setGatewayProvider(data.provider || "SSLCOMMERZ");
        setIsLoading(false);
        setStep("GATEWAY_REDIRECT");
        return;
      }

      throw new Error("গেটওয়ে থেকে কোনো পেমেন্ট লিংক তৈরি করা যায়নি। ক্রেডেনশিয়ালস পরীক্ষা করুন।");
    } catch (err: any) {
      setIsLoading(false);
      setErrorMsg(err.message || "পেমেন্ট গেটওয়ের সংযোগে ত্রুটি দেখা দিয়েছে। সেটিংসে ক্রেডেনশিয়ালস চেক করুন।");
      setStep("SELECT_METHOD");
    }
  };

  // Handle Manual Bank Slip Submission
  const handleManualBankSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ibblTrxId || ibblTrxId.trim().length < 4) {
      setErrorMsg("অনুগ্রহ করে সেলফিন বা ব্যাংক ডিপোজিট ট্রানজেকশন রেফারেন্স (TrxID) প্রদান করুন।");
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      setPendingSubmission({
        transaction_id: activeTxnId,
        amount: payAmount,
        channel: "Islami Bank (IBBL)",
        sender_phone: ibblSenderPhone || payerPhone,
        trx_id: ibblTrxId.trim().toUpperCase(),
        date: new Date().toLocaleDateString("bn-BD"),
      });
      setStep("PENDING_VERIFICATION");
    } catch (err: any) {
      setErrorMsg(err.message || "ট্রানজেকশন জমা দিতে সমস্যা হয়েছে।");
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
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-xs text-rose-800 font-medium animate-in fade-in">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1">
                <div className="font-bold text-rose-900">পেমেন্ট গেটওয়ে সংযোগ সতর্কতা:</div>
                <div>{errorMsg}</div>
              </div>
              <button onClick={() => setErrorMsg(null)} className="text-rose-500 font-bold p-1">
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
                      মোট বকেয়া: {formatBanglaCurrency(totalDue)}
                    </span>
                  </div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {unpaidFees.map((fee) => {
                      const isSelected = selectedFeeIds.includes(fee.id);
                      return (
                        <div
                          key={fee.id}
                          onClick={() => toggleFeeSelection(fee.id)}
                          className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition ${
                            isSelected
                              ? "bg-emerald-50/70 border-emerald-300 text-emerald-950 font-medium"
                              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100/50"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                            />
                            <div>
                              <span className="font-semibold">{fee.fee_type_name}</span>
                              <span className="text-[11px] text-slate-400 ml-1.5 font-normal">
                                ({fee.billing_period})
                              </span>
                            </div>
                          </div>
                          <span className="font-bold font-mono">
                            {formatBanglaCurrency(fee.due_amount)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Amount Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  প্রদেয় মোট টাকার পরিমাণ (টাকা):
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-base">
                    ৳
                  </span>
                  <input
                    type="number"
                    value={payAmount || ""}
                    onChange={(e) => setPayAmount(Math.max(0, Number(e.target.value)))}
                    placeholder="0"
                    className="w-full pl-9 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-mono font-bold text-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  কথায়:{" "}
                  <span className="text-slate-600 font-medium">
                    {payAmount > 0 ? numberToBanglaWords(payAmount) + " টাকা মাত্র" : "শূণ্য টাকা"}
                  </span>
                </p>
              </div>

              {/* Payment Channels Grid */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  পেমেন্ট মাধ্যম বা চ্যানেল নির্বাচন করুন:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {/* bKash */}
                  <button
                    type="button"
                    onClick={() => setSelectedChannel("bKash")}
                    className={`flex items-center gap-2.5 p-3 rounded-2xl border text-left transition cursor-pointer ${
                      selectedChannel === "bKash"
                        ? "bg-[#D12053]/5 border-[#D12053] text-[#D12053] ring-2 ring-[#D12053]/20 shadow-sm"
                        : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    <PaymentBrandSymbol brand="bKash" size="sm" />
                    <div>
                      <div className="text-xs font-bold leading-tight">বিকাশ</div>
                      <div className="text-[10px] text-slate-400">bKash PGW</div>
                    </div>
                  </button>

                  {/* Nagad */}
                  <button
                    type="button"
                    onClick={() => setSelectedChannel("Nagad")}
                    className={`flex items-center gap-2.5 p-3 rounded-2xl border text-left transition cursor-pointer ${
                      selectedChannel === "Nagad"
                        ? "bg-[#EA1D25]/5 border-[#EA1D25] text-[#EA1D25] ring-2 ring-[#EA1D25]/20 shadow-sm"
                        : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    <PaymentBrandSymbol brand="Nagad" size="sm" />
                    <div>
                      <div className="text-xs font-bold leading-tight">নগদ</div>
                      <div className="text-[10px] text-slate-400">Nagad Pay</div>
                    </div>
                  </button>

                  {/* Rocket */}
                  <button
                    type="button"
                    onClick={() => setSelectedChannel("Rocket")}
                    className={`flex items-center gap-2.5 p-3 rounded-2xl border text-left transition cursor-pointer ${
                      selectedChannel === "Rocket"
                        ? "bg-[#8C3494]/5 border-[#8C3494] text-[#8C3494] ring-2 ring-[#8C3494]/20 shadow-sm"
                        : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    <PaymentBrandSymbol brand="Rocket" size="sm" />
                    <div>
                      <div className="text-xs font-bold leading-tight">রকেট</div>
                      <div className="text-[10px] text-slate-400">DBBL Rocket</div>
                    </div>
                  </button>

                  {/* Islami Bank */}
                  <button
                    type="button"
                    onClick={() => setSelectedChannel("Islami Bank")}
                    className={`flex items-center gap-2.5 p-3 rounded-2xl border text-left transition cursor-pointer col-span-2 sm:col-span-1 ${
                      selectedChannel === "Islami Bank"
                        ? "bg-emerald-50 border-emerald-600 text-emerald-800 ring-2 ring-emerald-500/20 shadow-sm"
                        : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    <PaymentBrandSymbol brand="Islami Bank" size="sm" />
                    <div>
                      <div className="text-xs font-bold leading-tight">ইসলামী ব্যাংক</div>
                      <div className="text-[10px] text-slate-400">iBanking / CellFin</div>
                    </div>
                  </button>

                  {/* Cards & Others */}
                  <button
                    type="button"
                    onClick={() => setSelectedChannel("Card / Other")}
                    className={`flex items-center gap-2.5 p-3 rounded-2xl border text-left transition cursor-pointer col-span-2 sm:col-span-2 ${
                      selectedChannel === "Card / Other"
                        ? "bg-slate-900 border-slate-900 text-white shadow-sm"
                        : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    <CardBrandsIcon className="h-6 w-auto shrink-0" />
                    <div>
                      <div className="text-xs font-bold leading-tight">ভিসা / মাস্টারকার্ড / অন্য ব্যাংক</div>
                      <div className={`text-[10px] ${selectedChannel === "Card / Other" ? "text-slate-300" : "text-slate-400"}`}>
                        SSLCommerz Payment
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleStartPayment}
                  disabled={payAmount <= 0 || isLoading}
                  className="flex-1 py-3.5 px-6 bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-bold rounded-2xl text-sm transition shadow-md shadow-emerald-700/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Lock className="w-4 h-4" />
                  <span>নিরাপদ পেমেন্ট সম্পন্ন করতে এগিয়ে যান</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="py-3.5 px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-2xl text-xs transition"
                >
                  বাতিল
                </button>
              </div>
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
                  মাদ্রাসার অনুমোদিত সুরক্ষিত সার্ভার হ্যান্ডশেক ভ্যালিডেশন হচ্ছে। অনুগ্রহ করে অপেক্ষা করুন...
                </p>
              </div>
            </div>
          )}

          {/* STEP 3: REAL GATEWAY REDIRECT SCREEN */}
          {step === "GATEWAY_REDIRECT" && (
            <div className="py-6 space-y-5 text-center">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-3xl mx-auto flex items-center justify-center border border-emerald-200 shadow-sm">
                <Lock className="w-8 h-8" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h3 className="text-lg font-bold text-slate-900">
                  পেমেন্ট গেটওয়ে প্রস্তুত
                </h3>
                <p className="text-xs text-slate-500">
                  নিরাপদে ফি পরিশোধ করার জন্য আপনাকে অফিসিয়াল পেমেন্ট গেটওয়েতে রিডাইরেক্ট করা হচ্ছে।
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs space-y-2 text-left max-w-md mx-auto">
                <div className="flex justify-between text-slate-600">
                  <span>শিক্ষার্থীর নাম:</span>
                  <span className="font-semibold text-slate-900">{studentName}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>ট্রানজেকশন আইডি:</span>
                  <span className="font-mono font-bold text-slate-900">{activeTxnId}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>পেমেন্ট মেথড:</span>
                  <span className="font-bold text-emerald-700">{selectedChannel}</span>
                </div>
                <div className="flex justify-between text-slate-600 border-t border-slate-200 pt-2 font-bold text-sm">
                  <span>মোট পরিশোধিতব্য:</span>
                  <span className="text-emerald-700 font-mono">{formatBanglaCurrency(payAmount)}</span>
                </div>
              </div>

              <div className="flex flex-col gap-2.5 max-w-md mx-auto pt-2">
                <a
                  href={redirectUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-4 px-6 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-2xl text-sm transition shadow-lg shadow-emerald-700/20 flex items-center justify-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>অফিসিয়াল গেটওয়ে পেজে যান</span>
                </a>
                <button
                  type="button"
                  onClick={() => setStep("SELECT_METHOD")}
                  className="py-2.5 text-xs text-slate-500 hover:text-slate-700 font-medium"
                >
                  ফিরে যান ও মেথড পরিবর্তন করুন
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: ISLAMI BANK / CELLFIN MANUAL DEPOSIT SUBMISSION */}
          {step === "IBBL_MANUAL_SUBMIT" && (
            <form onSubmit={handleManualBankSubmit} className="space-y-4">
              <div className="bg-gradient-to-br from-emerald-900 to-teal-950 rounded-3xl p-5 text-white shadow-xl space-y-4 border border-emerald-500/30">
                <div className="flex items-center justify-between border-b border-emerald-600/40 pb-3">
                  <div className="flex items-center gap-2">
                    <PaymentBrandSymbol brand="Islami Bank" size="md" />
                    <div>
                      <span className="font-bold text-sm sm:text-base block">
                        ইসলামী ব্যাংক বাংলাদেশ পিএলসি
                      </span>
                      <span className="text-[10px] text-emerald-300">
                        iBanking / CellFin ট্রান্সফার
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-emerald-200 block">প্রদেয় ফি</span>
                    <span className="font-mono font-bold text-lg text-emerald-300">
                      {formatBanglaCurrency(payAmount)}
                    </span>
                  </div>
                </div>

                {/* Bank Account Details Card */}
                <div className="bg-black/30 border border-emerald-500/30 rounded-2xl p-3.5 text-xs space-y-1.5">
                  <div className="text-[11px] text-emerald-300 font-bold uppercase tracking-wider">
                    মাদরাসার ইসলামী ব্যাংক একাউন্ট বিবরণী:
                  </div>
                  <div className="text-sm font-mono font-bold text-white">
                    অ্যাকাউন্ট নং: {islamiBankConfig?.account_number || "সেটিংসে একাউন্ট প্রদান করুন"}
                  </div>
                  <div className="text-emerald-200 text-xs">
                    হিসাবের নাম: {islamiBankConfig?.account_name || "কওমি মাদরাসা সাধারণ তহবিল"}
                  </div>
                  <div className="text-emerald-200 text-[11px]">
                    শাখা: {islamiBankConfig?.branch_name || "স্থানীয় শাখা"}
                    {islamiBankConfig?.routing_number && ` • রাউটিং: ${islamiBankConfig.routing_number}`}
                  </div>
                  {islamiBankConfig?.cellfin_number && (
                    <div className="text-amber-300 text-xs font-semibold pt-1 border-t border-emerald-500/20">
                      সরাসরি সেলফিন (CellFin) নম্বর: {islamiBankConfig.cellfin_number}
                    </div>
                  )}
                </div>

                <div className="space-y-3 text-slate-900 text-xs">
                  <div>
                    <label className="text-emerald-100 text-xs font-semibold block mb-1">
                      প্রেরক মোবাইল বা সেলফিন নম্বর:
                    </label>
                    <input
                      type="text"
                      value={ibblSenderPhone}
                      onChange={(e) => setIbblSenderPhone(e.target.value)}
                      placeholder="01XXXXXXXXX"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white text-slate-900 font-mono text-sm focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-emerald-100 text-xs font-semibold block mb-1">
                      ব্যাংক ডিপোজিট / সেলফিন ট্রানজেকশন রেফারেন্স (TrxID): *
                    </label>
                    <input
                      type="text"
                      required
                      value={ibblTrxId}
                      onChange={(e) => setIbblTrxId(e.target.value)}
                      placeholder="e.g. IBBL-8237469123 বা CF-981245"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white text-slate-900 font-mono text-sm font-bold uppercase focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-2xl text-sm transition shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {isLoading ? "জমা হচ্ছে..." : "ট্রানজেকশন তথ্য জমা দিন"}
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
            </form>
          )}

          {/* STEP 5: PENDING BANK VERIFICATION CONFIRMATION */}
          {step === "PENDING_VERIFICATION" && (
            <div className="py-6 space-y-5 text-center">
              <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-3xl mx-auto flex items-center justify-center border border-amber-200 shadow-sm">
                <Clock className="w-8 h-8" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h3 className="text-lg font-bold text-slate-900">
                  ট্রানজেকশন যাচাইয়ের জন্য জমা হয়েছে
                </h3>
                <p className="text-xs text-slate-500">
                  আলহামদুলিল্লাহ! আপনার ব্যাংক পেমেন্ট রেফারেন্স মাদ্রাসা হিসাব শাখায় জমা হয়েছে।
                </p>
              </div>

              <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-4 text-xs space-y-2 text-left max-w-md mx-auto">
                <div className="flex justify-between text-slate-600">
                  <span>ট্র্যাকিং আইডি:</span>
                  <span className="font-mono font-bold text-slate-900">{pendingSubmission?.transaction_id}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>প্রদত্ত TrxID:</span>
                  <span className="font-mono font-bold text-amber-900">{pendingSubmission?.trx_id}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>টাকার পরিমাণ:</span>
                  <span className="font-mono font-bold text-emerald-700">{formatBanglaCurrency(pendingSubmission?.amount)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>স্ট্যাটাস:</span>
                  <span className="inline-flex items-center gap-1 font-bold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-full text-[11px]">
                    <Clock className="w-3 h-3" /> অপেক্ষমান (Pending Approval)
                  </span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-[11px] text-slate-500 max-w-md mx-auto">
                মাদ্রাসা অফিস থেকে ব্যাংক স্টেটমেন্ট যাচাই সম্পন্ন হলেই আপনার মূল মানি রসিদ (Money Receipt) ইস্যু হবে এবং ফি পরিশোধ সম্পন্ন হবে।
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-3.5 px-6 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl text-sm transition"
                >
                  ঠিক আছে, সম্পন্ন
                </button>
              </div>
            </div>
          )}

          {/* STEP 6: INSTANT SUCCESS SCREEN (If redirected back from verified gateway) */}
          {step === "SUCCESS" && completedReceipt && (
            <div className="space-y-4 animate-in zoom-in-95 duration-200">
              <div className="text-center space-y-1.5 py-2">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">
                  পেমেন্ট সফলভাবে সম্পন্ন হয়েছে!
                </h3>
                <p className="text-xs text-slate-500">
                  আপনার ফি মাদরাসা অ্যাকাউন্টে স্বয়ংক্রিয়ভাবে জমা ও হালনাগাদ হয়েছে।
                </p>
              </div>

              <div
                id="online-receipt-print-area"
                className="bg-emerald-50/50 border border-emerald-200 rounded-2xl p-4 text-xs space-y-2.5"
              >
                <div className="flex items-center justify-between border-b border-emerald-200/80 pb-2">
                  <span className="text-slate-500">অফিসিয়াল রসিদ নম্বর:</span>
                  <span className="font-mono font-bold text-emerald-800 text-sm">
                    {completedReceipt.receipt_no}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">ট্রানজেকশন আইডি:</span>
                  <span className="font-mono font-semibold text-slate-800">
                    {completedReceipt.transaction_id}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">শিক্ষার্থী:</span>
                  <span className="font-bold text-slate-800">{studentName}</span>
                </div>
                <div className="flex items-center justify-between border-t border-emerald-200/80 pt-2 text-sm font-bold">
                  <span className="text-emerald-950">পরিশোধিত টাকার পরিমাণ:</span>
                  <span className="font-mono text-emerald-800">
                    {formatBanglaCurrency(completedReceipt.amount || payAmount)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => printElementIsolated("online-receipt-print-area", "ফি পরিশোধের রসিদ")}
                  className="flex-1 py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-2xl text-xs transition flex items-center justify-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  রসিদ প্রিন্ট করুন
                </button>
                <button
                  type="button"
                  onClick={handleCopyReceipt}
                  className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-2xl text-xs transition flex items-center gap-1.5"
                >
                  {isCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  {isCopied ? "কপি হয়েছে" : "কপি"}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl text-xs transition"
                >
                  বন্ধ করুন
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
