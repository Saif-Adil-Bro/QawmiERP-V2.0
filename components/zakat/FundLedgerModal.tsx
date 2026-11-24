"use client";

import React, { useState, useEffect,useRef } from "react";
import {
  X,
  Printer,
  Search,
  Layers,
  TrendingUp,
  TrendingDown,
  Wallet,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Ban,
  RefreshCw,
} from "lucide-react";
import { FundItem, FundTransactionRecord, DonationItem } from "@/lib/fund-utils";
import { toBanglaNumber, formatBanglaCurrency } from "@/lib/numberToBangla";
import {
  getFundLedgerData,
  getDonationById,
  getActiveMadrasaHeaderInfo,
  voidFundTransaction,
  unvoidFundTransaction,
} from "@/app/actions/zakat";
import DonationReceipt from "./DonationReceipt";
import { printElementIsolated } from "@/lib/printUtils";

interface FundLedgerModalProps {
  fund: FundItem | null;
  isOpen: boolean;
  onClose: () => void;
  onTransactionChanged?: () => void;
  madrasaInfo?: {
    name?: string;
    address?: string;
    phone?: string;
    logo_url?: string;
    registration_no?: string;
    slogan?: string;
  };
}

export default function FundLedgerModal({
  fund,
  isOpen,
  onClose,
  onTransactionChanged,
  madrasaInfo: initialMadrasaInfo,
}: FundLedgerModalProps) {
  const request=useRef(0);
  const [loadedId,setLoadedId]=useState<string|null>(null);
  const [loadError,setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<FundTransactionRecord[]>([]);
  const [totalInflow, setTotalInflow] = useState(0);
  const [totalOutflow, setTotalOutflow] = useState(0);
  const [currentBalance, setCurrentBalance] = useState(0);

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"ALL" | "INCOME" | "EXPENSE" | "MAHFIL" | "VOID">("ALL");

  const [activeReceiptDonation, setActiveReceiptDonation] = useState<DonationItem | null>(null);
  const [loadingReceipt, setLoadingReceipt] = useState(false);

  // Void / Unvoid states
  const [txnToVoid, setTxnToVoid] = useState<FundTransactionRecord | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [txnToUnvoid, setTxnToUnvoid] = useState<FundTransactionRecord | null>(null);
  const [unvoidReason, setUnvoidReason] = useState("");
  const [isActionSubmitting, setIsActionSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [liveMadrasaInfo, setLiveMadrasaInfo] = useState<any>(initialMadrasaInfo || null);

  useEffect(() => {
    if (initialMadrasaInfo && initialMadrasaInfo.name && initialMadrasaInfo.name !== "মাদরাসা") {
      setLiveMadrasaInfo(initialMadrasaInfo);
      return;
    }
    let isMounted = true;
    async function fetchInfo() {
      try {
        const info = await getActiveMadrasaHeaderInfo();
        if (isMounted && info) {
          setLiveMadrasaInfo((prev: any) => ({
            ...prev,
            ...info,
          }));
        }
      } catch (err) {
        console.error("Failed to load header info:", err);
      }
    }
    fetchInfo();
    return () => {
      isMounted = false;
    };
  }, [initialMadrasaInfo]);

  const madrasaInfo = liveMadrasaInfo || initialMadrasaInfo;

  useEffect(() => {
    if (isOpen && fund) {
      loadLedger();
    }
    return () => { request.current++; };
  }, [isOpen, fund]);

  const loadLedger = async () => {
    if (!fund) return;
    const seq=++request.current;
    setLoading(true);setLoadedId(null); setLoadError("");
    try {
      const res = await getFundLedgerData(fund.id);
      if (seq!==request.current) return;
      if (!res.fund || res.fund.id !== fund.id) throw new Error("Incomplete ledger");
      setLoadedId(fund.id);
      setTransactions(res.transactions || []);
      setTotalInflow(res.totalInflow || 0);
      setTotalOutflow(res.totalOutflow || 0);
      setCurrentBalance(res.currentBalance || 0);
    } catch (err) {
      if (seq!==request.current) return;
      setTransactions([]);
      setLoadError("খতিয়ান পড়া যায়নি। এই স্ক্রিনের স্থিতি ব্যবহার করবেন না; রিফ্রেশ করে আবার চেষ্টা করুন।");
    } finally {
      if (seq===request.current) setLoading(false);
    }
  };

  const handleConfirmVoid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txnToVoid) return;
    if (!voidReason.trim()) {
      setActionError("বাতিলের সুনির্দিষ্ট কারণ উল্লেখ করা আবশ্যক।");
      return;
    }

    setIsActionSubmitting(true);
    setActionError(null);
    try {
      const res = await voidFundTransaction(
        txnToVoid.id,
        txnToVoid.type,
        voidReason.trim(),
        txnToVoid.voucher_no
      );
      if (res?.success) {
        setTxnToVoid(null);
        setVoidReason("");
        setToastMessage(res.message || "ভাউচার/রসিদ সফলভাবে বাতিল (VOID) করা হয়েছে।");
        setTimeout(() => setToastMessage(null), 4000);
        await loadLedger();
        if (onTransactionChanged) onTransactionChanged();
      } else {
        setActionError(res?.error || "লেনদেন বাতিল করা যায়নি।");
      }
    } catch (err: any) {
      console.error("Error voiding txn:", err);
      setActionError("লেনদেন বাতিল করতে ত্রুটি হয়েছে।");
    } finally {
      setIsActionSubmitting(false);
    }
  };

  const handleConfirmUnvoid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txnToUnvoid) return;
    if (!unvoidReason.trim()) {
      setActionError("পুনরায় সক্রিয় করার কারণ উল্লেখ করা আবশ্যক।");
      return;
    }

    setIsActionSubmitting(true);
    setActionError(null);
    try {
      const res = await unvoidFundTransaction(
        txnToUnvoid.id,
        txnToUnvoid.type,
        unvoidReason.trim(),
        txnToUnvoid.voucher_no
      );
      if (res?.success) {
        setTxnToUnvoid(null);
        setUnvoidReason("");
        setToastMessage(res.message || "ভাউচার/রসিদ পুনরায় সক্রিয় করা হয়েছে।");
        setTimeout(() => setToastMessage(null), 4000);
        await loadLedger();
        if (onTransactionChanged) onTransactionChanged();
      } else {
        setActionError(res?.error || "পুনরায় সক্রিয় করা যায়নি।");
      }
    } catch (err: any) {
      console.error("Error unvoiding txn:", err);
      setActionError("পুনরায় সক্রিয় করতে ত্রুটি হয়েছে।");
    } finally {
      setIsActionSubmitting(false);
    }
  };

  const handleOpenReceipt = async (txn: FundTransactionRecord) => {
    setLoadingReceipt(true);
    try {
      if (txn.type === "INCOME" || txn.type === "MAHFIL_SURPLUS") {
        const don = await getDonationById(txn.id);
        if (!don) {setToastMessage('মূল রসিদ পাওয়া যায়নি। খতিয়ান রিফ্রেশ করুন।');return;}
        setActiveReceiptDonation(don);
      }
    } catch (err) {
      setToastMessage('রসিদ পড়া যায়নি। আবার চেষ্টা করুন।');
    } finally {
      setLoadingReceipt(false);
    }
  };

  const handlePrintStatement = () => {
    if (!loadedId || loadedId!==fund?.id || loading || loadError) return;
    printElementIsolated("fund-statement-print-area", `${fund?.name || "ফান্ড"} - খতিয়ান ও হিসাব বিবরণী`);
  };

  if (!isOpen || !fund) return null;

  const activeTxnsCount = transactions.filter((t) => t.status !== "VOID").length;
  const voidedTxnsCount = transactions.filter((t) => t.status === "VOID").length;

  const filteredTxns = transactions.filter((t) => {
    const matchesSearch =
      (t.source_or_recipient || "").toLowerCase().includes(search.toLowerCase()) ||
      (t.voucher_no || "").toLowerCase().includes(search.toLowerCase()) ||
      (t.notes || "").toLowerCase().includes(search.toLowerCase()) ||
      (t.category || "").toLowerCase().includes(search.toLowerCase()) ||
      (t.cancellation_reason || "").toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    if (filterType === "ALL") return true;
    if (filterType === "INCOME") return t.type === "INCOME" || t.type === "MAHFIL_SURPLUS";
    if (filterType === "EXPENSE") return t.type === "EXPENSE" || t.type === "MAHFIL_DEFICIT";
    if (filterType === "MAHFIL") return t.is_mahfil_settlement || t.type === "MAHFIL_SURPLUS" || t.type === "MAHFIL_DEFICIT";
    if (filterType === "VOID") return t.status === "VOID";
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Top Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-2xl shrink-0">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                  {fund.name}
                </h2>
                <span className="px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-slate-200 text-slate-800">
                  {fund.code || "FND"}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                ফান্ডের বিস্তারিত খতিয়ান, আয়-ব্যয় লেনদেন বিবরণী ও অডিট হিস্টোরি
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled={loading || !!loadError || loadedId!==fund.id}
              onClick={handlePrintStatement}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              title="স্টেটমেন্ট প্রিন্ট করুন"
            >
              <Printer className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">স্টেটমেন্ট প্রিন্ট</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-xl transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {toastMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{toastMessage}</span>
            </div>
          )}

          {loadError && <p role="alert" className="bg-red-50 p-3">{loadError}</p>}
          <a href="/dashboard/zakat/funds#reconciliation" className="block text-xs underline">অমিল ভাউচার এই স্থিতিতে ধরা হয়নি। ফান্ড তালিকায় ম্যানুয়াল সমন্বয় দেখুন।</a>
          {!loadError && !loading && <>
          {/* 4 Overview Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Total Inflow */}
            <div className="bg-emerald-50/60 border border-emerald-200 p-4 rounded-2xl flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-900">মোট জমা / আয়</span>
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="mt-2">
                <h3 className="text-lg sm:text-xl font-black text-emerald-950 font-mono">
                  ৳ {formatBanglaCurrency(totalInflow)}
                </h3>
                <span className="text-[10px] text-emerald-700">অনুদান, মাহফিল উদ্বৃত্ত ইত্যাদি</span>
              </div>
            </div>

            {/* Total Outflow */}
            <div className="bg-rose-50/60 border border-rose-200 p-4 rounded-2xl flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-rose-900">মোট খরচ / ব্যয়</span>
                <TrendingDown className="w-4 h-4 text-rose-600" />
              </div>
              <div className="mt-2">
                <h3 className="text-lg sm:text-xl font-black text-rose-950 font-mono">
                  ৳ {formatBanglaCurrency(totalOutflow)}
                </h3>
                <span className="text-[10px] text-rose-700">ফান্ড হতে খরচ ও ঘাটতি সমন্বয়</span>
              </div>
            </div>

            {/* Net Balance */}
            <div className="bg-indigo-50/60 border border-indigo-200 p-4 rounded-2xl flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-indigo-900">বর্তমান নেট স্থিতি</span>
                <Wallet className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="mt-2">
                <h3 className={`text-lg sm:text-xl font-black font-mono ${currentBalance >= 0 ? "text-indigo-950" : "text-rose-700"}`}>
                  ৳ {formatBanglaCurrency(currentBalance)}
                </h3>
                <span className="text-[10px] text-indigo-700">জমা, খরচ ও জার্নাল সমন্বয়ের জের</span>
              </div>
            </div>

            {/* Total Transactions */}
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-700">সক্রিয় লেনদেন সংখ্যা</span>
                <FileText className="w-4 h-4 text-slate-500" />
              </div>
              <div className="mt-2">
                <h3 className="text-lg sm:text-xl font-black text-slate-900 font-mono">
                  {toBanglaNumber(activeTxnsCount)} টি
                </h3>
                <span className="text-[10px] text-slate-500">
                  অনুমোদিত ভাউচার রেকর্ড
                  {voidedTxnsCount > 0 ? ` (বাতিল: ${toBanglaNumber(voidedTxnsCount)} টি)` : ""}
                </span>
              </div>
            </div>
          </div>

          </>}
          {/* Filters and Search Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="উৎস, ভাউচার নং বা বিবরণ দিয়ে খুঁজুন..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
              <span className="text-xs font-semibold text-slate-500 shrink-0">ফিল্টার:</span>
              {[
                { id: "ALL", label: "সবগুলো" },
                { id: "INCOME", label: "জমা / আয়" },
                { id: "EXPENSE", label: "খরচ / ব্যয়" },
                { id: "MAHFIL", label: "✨ মাহফিল সমন্বয়" },
                { id: "VOID", label: `বাতিলকৃত (VOID)${voidedTxnsCount > 0 ? ` (${toBanglaNumber(voidedTxnsCount)})` : ""}` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilterType(tab.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
                    filterType === tab.id
                      ? tab.id === "VOID"
                        ? "bg-rose-700 text-white shadow-2xs"
                        : "bg-slate-900 text-white shadow-2xs"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Transactions Table */}
          {loadError ? null : loading ? (
            <div className="py-16 text-center text-slate-500">
              <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              <p className="text-xs font-bold">ফান্ড স্টেটমেন্ট লোড হচ্ছে...</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                      <th className="py-3 px-4">তারিখ ও ভাউচার</th>
                      <th className="py-3 px-4">উৎস / দাতা / খাত</th>
                      <th className="py-3 px-4">লেনদেনের প্রকৃতি</th>
                      <th className="py-3 px-4 text-right">পরিমাণ ৳</th>
                      <th className="py-3 px-4 text-right">মেমো / রসিদ ও অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                    {filteredTxns.map((txn) => {
                      const isInflow = txn.type === "JOURNAL_IN" || txn.type === "INCOME" || txn.type === "MAHFIL_SURPLUS";
                      const isMahfil = txn.is_mahfil_settlement || txn.type === "MAHFIL_SURPLUS" || txn.type === "MAHFIL_DEFICIT";
                      const isVoid = txn.status === "VOID";

                      return (
                        <tr
                          key={txn.id}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            isVoid ? "bg-rose-50/25 opacity-75" : ""
                          }`}
                        >
                          {/* Date & Voucher */}
                          <td className="py-3 px-4">
                            <div className={`font-bold ${isVoid ? "line-through text-slate-400" : "text-slate-900"}`}>
                              {toBanglaNumber(new Date(txn.date).toLocaleDateString("en-GB"))}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {isVoid && (
                                <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs">
                                  VOID
                                </span>
                              )}
                              <span className={`text-[11px] font-mono ${isVoid ? "line-through text-slate-400" : "text-slate-500"}`}>
                                {txn.voucher_no}
                              </span>
                            </div>
                          </td>

                          {/* Source / Donor */}
                          <td className="py-3 px-4">
                            <div className={`font-bold text-sm ${isVoid ? "line-through text-slate-400" : "text-slate-900"}`}>
                              {txn.source_or_recipient}
                            </div>
                            {txn.notes && (
                              <div
                                className={`text-[11px] line-clamp-1 mt-0.5 ${isVoid ? "line-through text-slate-400" : "text-slate-500"}`}
                                title={txn.notes}
                              >
                                {txn.notes}
                              </div>
                            )}
                            {isVoid && txn.cancellation_reason && (
                              <div className="text-[10px] text-rose-600 font-medium italic mt-1">
                                বাতিলের কারণ: {txn.cancellation_reason}
                              </div>
                            )}
                          </td>

                          {/* Category / Nature Badge */}
                          <td className="py-3 px-4">
                            {txn.journal_kind ? <span>{txn.category}</span> : isVoid ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                <span>বাতিলকৃত ({isInflow ? "রসিদ" : "ভাউচার"})</span>
                              </span>
                            ) : isMahfil ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                <span>✨ মাহফিল উদ্বৃত্ত হস্তান্তর</span>
                              </span>
                            ) : isInflow ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                <span>দান ও অনুদান প্রাপ্তি</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                                <span>ব্যয় / খরচ ভাউচার</span>
                              </span>
                            )}
                          </td>

                          {/* Amount */}
                          <td className="py-3 px-4 text-right">
                            <div
                              className={`font-mono text-sm ${
                                isVoid
                                  ? "line-through text-slate-400 opacity-60 font-semibold"
                                  : `font-black ${isInflow ? "text-emerald-800" : "text-rose-700"}`
                              }`}
                            >
                              {isInflow ? "+ ৳ " : "- ৳ "}
                              {formatBanglaCurrency(txn.amount)}
                            </div>
                          </td>

                          {/* Action / Receipt / Void / Unvoid */}
                          <td className="py-3 px-4 text-right">
                            <div hidden={!!txn.journal_kind} className={txn.journal_kind ? "hidden" : "flex items-center justify-end gap-1.5"}>
                              {isInflow ? (
                                <button
                                  type="button"
                                  onClick={() => handleOpenReceipt(txn)}
                                  disabled={loadingReceipt}
                                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                                    isMahfil
                                      ? "bg-amber-700 hover:bg-amber-800 text-white shadow-2xs"
                                      : "bg-slate-900 hover:bg-slate-800 text-white"
                                  }`}
                                >
                                  <Printer className="w-3 h-3 text-emerald-300" />
                                  <span>{isMahfil ? "মেমো ভাউচার" : "রসিদ"}</span>
                                </button>
                              ) : (
                                <span className="text-[11px] font-mono text-slate-400">ব্যয় ভাউচার</span>
                              )}

                              {!isVoid ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTxnToVoid(txn);
                                    setVoidReason("");
                                    setActionError(null);
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition cursor-pointer"
                                  title="রসিদ বা ভাউচার বাতিল করুন (Void)"
                                >
                                  <Ban className="w-3.5 h-3.5 text-rose-600" />
                                  <span>বাতিল</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTxnToUnvoid(txn);
                                    setUnvoidReason("");
                                    setActionError(null);
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition cursor-pointer"
                                  title="বাতিলকৃত রসিদ বা ভাউচার পুনরায় সক্রিয় করুন (Unvoid)"
                                >
                                  <RefreshCw className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>সক্রিয়</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {filteredTxns.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-slate-400">
                          <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                          <p className="font-bold text-slate-700">কোনো লেনদেন রেকর্ড পাওয়া যায়নি</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">এই ফান্ডে নির্বাচিত ফিল্টারে কোনো লেনদেন নেই</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Hidden Printable Area for Official Fund Statement */}
        {!loading && !loadError && loadedId===fund.id && <div id="fund-statement-print-area" className="hidden print:block p-8 bg-white text-slate-900">
          <div className="border-b-2 border-slate-900 pb-4 mb-6 text-center">
            <p className="text-center text-xs font-serif text-slate-600 mb-2">
              بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ • حَامِدًا وَّمُصَلِّيًا
            </p>
            <div className="flex items-center justify-between gap-4">
              {/* Logo */}
              <div className="w-16 h-16 shrink-0 flex items-center justify-center">
                {madrasaInfo?.logo_url ? (
                  <img
                    src={madrasaInfo.logo_url}
                    alt={madrasaInfo.name || "লোগো"}
                    className="w-16 h-16 object-cover rounded-full border border-slate-200"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full border-2 border-emerald-700 bg-emerald-50 flex items-center justify-center text-emerald-800 font-bold text-xl">
                    {madrasaInfo?.name?.charAt(0) || "ম"}
                  </div>
                )}
              </div>

              {/* Title & Info Center */}
              <div className="text-center flex-1 space-y-1">
                <h1 className="text-2xl font-black text-slate-900">
                  {madrasaInfo?.name || "মাদরাসা"}
                </h1>
                {madrasaInfo?.slogan && (
                  <p className="text-xs italic text-emerald-700 font-medium">
                    "{madrasaInfo.slogan}"
                  </p>
                )}
                {madrasaInfo?.address && (
                  <p className="text-xs text-slate-600 font-medium">
                    {madrasaInfo.address}
                  </p>
                )}
                <div className="flex flex-wrap items-center justify-center gap-x-4 text-xs text-slate-600 font-medium">
                  {madrasaInfo?.phone && (
                    <span>মোবাইল: {toBanglaNumber(madrasaInfo.phone)}</span>
                  )}
                  {(madrasaInfo?.registration_no || (madrasaInfo as any)?.reg_no) && (
                    <span>রেজিস্ট্রেশন নং: {toBanglaNumber(madrasaInfo?.registration_no || (madrasaInfo as any)?.reg_no)}</span>
                  )}
                </div>
              </div>

              {/* Empty spacer to balance header center alignment */}
              <div className="w-16 shrink-0" />
            </div>

            <div className="mt-3 inline-block bg-slate-900 text-white px-5 py-1 rounded font-bold text-sm">
              ফান্ড খতিয়ান ও আর্থিক বিবরণী: {fund.name}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6 text-xs border border-slate-300 p-3 rounded bg-slate-50">
            <div>
              <span className="text-slate-500">মোট জমা / আয়:</span>
              <p className="font-bold text-emerald-800 text-base font-mono">৳ {formatBanglaCurrency(totalInflow)}</p>
            </div>
            <div>
              <span className="text-slate-500">মোট ব্যয় / খরচ:</span>
              <p className="font-bold text-rose-800 text-base font-mono">৳ {formatBanglaCurrency(totalOutflow)}</p>
            </div>
            <div>
              <span className="text-slate-500">বর্তমান নীট জের:</span>
              <p className="font-bold text-slate-900 text-base font-mono">৳ {formatBanglaCurrency(currentBalance)}</p>
            </div>
          </div>

          <table className="w-full border-collapse text-xs border border-slate-300">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 font-bold">
                <th className="p-2 border-r border-slate-300">তারিখ</th>
                <th className="p-2 border-r border-slate-300">ভাউচার নং</th>
                <th className="p-2 border-r border-slate-300">উৎস / খাত বিবরণ</th>
                <th className="p-2 border-r border-slate-300 text-right">জমা ৳</th>
                <th className="p-2 text-right">খরচ ৳</th><th className="p-2 text-right">জার্নাল ৳</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t, idx) => {
                const isVoid = t.status === "VOID";
                return (
                  <tr key={idx} className={`border-b border-slate-200 ${isVoid ? "text-slate-400" : ""}`}>
                    <td className={`p-2 border-r border-slate-300 ${isVoid ? "line-through" : ""}`}>
                      {toBanglaNumber(new Date(t.date).toLocaleDateString("en-GB"))}
                    </td>
                    <td className="p-2 border-r border-slate-300 font-mono">
                      {isVoid ? `[VOID] ${t.voucher_no}` : t.voucher_no}
                    </td>
                    <td className="p-2 border-r border-slate-300">
                      <div className={`font-bold ${isVoid ? "line-through" : ""}`}>{t.source_or_recipient}</div>
                      {t.notes && <div className="text-[10px] text-slate-500">{t.notes}</div>}
                      {isVoid && t.cancellation_reason && (
                        <div className="text-[10px] text-rose-600 italic">বাতিলের কারণ: {t.cancellation_reason}</div>
                      )}
                    </td>
                    <td className={`p-2 border-r border-slate-300 text-right font-mono ${isVoid ? "line-through text-slate-400" : "text-emerald-800"}`}>
                      {t.type === "INCOME" || t.type === "MAHFIL_SURPLUS" ? formatBanglaCurrency(t.amount) : "-"}
                    </td>
                    <td className={`p-2 text-right font-mono ${isVoid ? "line-through text-slate-400" : "text-rose-800"}`}>
                      {t.type === "EXPENSE" || t.type === "MAHFIL_DEFICIT" ? formatBanglaCurrency(t.amount) : "-"}
                    </td><td className="p-2 text-right">{t.journal_kind?formatBanglaCurrency(t.type==="JOURNAL_IN"?t.amount:-t.amount):"—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="mt-16 pt-4 flex justify-between text-xs border-t border-slate-300">
            <div className="text-center w-36 border-t border-slate-400 pt-1">হিসাবরক্ষক</div>
            <div className="text-center w-36 border-t border-slate-400 pt-1">অডিটর</div>
            <div className="text-center w-36 border-t border-slate-400 pt-1">মুহতামিম / সভাপতি</div>
          </div>
        </div>}
      </div>

      {/* Void Transaction Modal */}
      {txnToVoid && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-rose-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-rose-600">
                <Ban className="w-5 h-5" />
                <h3 className="text-base font-bold text-slate-900">
                  {txnToVoid.type === "INCOME" || txnToVoid.type === "MAHFIL_SURPLUS"
                    ? "রসিদ বাতিল করুন (Void Receipt)"
                    : "ভাউচার বাতিল করুন (Void Voucher)"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setTxnToVoid(null)}
                disabled={isActionSubmitting}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {actionError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            <div className="bg-rose-50/70 text-slate-800 p-4 rounded-2xl text-xs space-y-2 border border-rose-200">
              <div className="space-y-1 font-sans">
                <p>
                  <strong>ভাউচার/রসিদ নং:</strong>{" "}
                  <span className="font-mono text-rose-700 font-bold">{txnToVoid.voucher_no}</span>
                </p>
                <p>
                  <strong>উৎস / খাত:</strong> {txnToVoid.source_or_recipient}
                </p>
                <p>
                  <strong>ফান্ড:</strong> {fund.name}
                </p>
                <p>
                  <strong>পরিমাণ:</strong> ৳ {formatBanglaCurrency(txnToVoid.amount)}
                </p>
                <p>
                  <strong>তারিখ:</strong>{" "}
                  {toBanglaNumber(new Date(txnToVoid.date).toLocaleDateString("en-GB"))}
                </p>
              </div>
              <p className="text-[11px] text-rose-700 pt-2 border-t border-rose-200/60 leading-relaxed">
                ⚠️ আর্থিক স্বচ্ছতার স্বার্থে রসিদ বা ভাউচার কখনোই ডাটাবেজ থেকে স্থায়ীভাবে মুছে ফেলা হয় না। এটি বাতিল (VOID) হিসেবে সংরক্ষিত থাকবে এবং স্বয়ংক্রিয়ভাবে ফান্ডের ব্যালেন্স ও মোট হিসাব থেকে বাদ পড়বে।
              </p>
            </div>

            <form onSubmit={handleConfirmVoid} className="space-y-4 text-xs sm:text-sm">
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 flex items-center gap-1">
                  <span>বাতিলের সুনির্দিষ্ট কারণ (বাধ্যতামূলক)</span>
                  <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="যেমন: ভুল ফান্ডের নামে এন্ট্রি / ভুল অংক / চেক বাউন্স / ডুপ্লিকেট ভাউচার..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 text-xs sm:text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setTxnToVoid(null)}
                  disabled={isActionSubmitting}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold cursor-pointer"
                >
                  ফিরে যান
                </button>
                <button
                  type="submit"
                  disabled={isActionSubmitting}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isActionSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>বাতিল হচ্ছে...</span>
                    </>
                  ) : (
                    <>
                      <Ban className="w-4 h-4" />
                      <span>নিশ্চিত বাতিল করুন (VOID)</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Unvoid Transaction Modal */}
      {txnToUnvoid && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-emerald-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-emerald-700">
                <RefreshCw className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900">
                  ভাউচার/রসিদ পুনরায় সক্রিয় করুন (Unvoid)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setTxnToUnvoid(null)}
                disabled={isActionSubmitting}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {actionError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            <div className="bg-emerald-50/60 text-slate-800 p-4 rounded-2xl text-xs space-y-2 border border-emerald-200">
              <div className="space-y-1 font-sans">
                <p>
                  <strong>ভাউচার/রসিদ নং:</strong>{" "}
                  <span className="font-mono text-emerald-800 font-bold">{txnToUnvoid.voucher_no}</span>
                </p>
                <p>
                  <strong>উৎস / খাত:</strong> {txnToUnvoid.source_or_recipient}
                </p>
                <p>
                  <strong>ফান্ড:</strong> {fund.name}
                </p>
                <p>
                  <strong>পরিমাণ:</strong> ৳ {formatBanglaCurrency(txnToUnvoid.amount)}
                </p>
                <p>
                  <strong>পূর্বে বাতিলের কারণ:</strong>{" "}
                  <span className="text-rose-700 italic">{txnToUnvoid.cancellation_reason || "তথ্য নেই"}</span>
                </p>
              </div>
              <p className="text-[11px] text-emerald-800 pt-2 border-t border-emerald-200/60 leading-relaxed">
                👑 অনুমোদনক্রমে বাতিল হওয়া রসিদ বা ভাউচার পুনর্বহাল করা হচ্ছে। এটি সক্রিয় করলে ফান্ডের ব্যালেন্স ও মোট হিসাবে পুনরায় যুক্ত হবে।
              </p>
            </div>

            <form onSubmit={handleConfirmUnvoid} className="space-y-4 text-xs sm:text-sm">
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 flex items-center gap-1">
                  <span>পুনরায় সক্রিয়করণের কারণ / নোট (বাধ্যতামূলক)</span>
                  <span className="text-emerald-600">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={unvoidReason}
                  onChange={(e) => setUnvoidReason(e.target.value)}
                  placeholder="যেমন: ভুলবশত বাতিল করা হয়েছিল, অডিট শেষে অনুমোদনক্রমে পুনরায় সক্রিয় করা হলো..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600 text-xs sm:text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setTxnToUnvoid(null)}
                  disabled={isActionSubmitting}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold cursor-pointer"
                >
                  ফিরে যান
                </button>
                <button
                  type="submit"
                  disabled={isActionSubmitting}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isActionSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>সক্রিয় হচ্ছে...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      <span>নিশ্চিত সক্রিয় করুন</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receipt / Voucher Popup if clicked */}
      {activeReceiptDonation && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-3 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-4 max-h-[92vh] overflow-y-auto relative">
            <button
              onClick={() => setActiveReceiptDonation(null)}
              className="absolute top-4 right-4 p-1.5 bg-slate-100 hover:bg-slate-200 rounded-full transition z-10 cursor-pointer"
            >
              <X className="w-5 h-5 text-slate-600" />
            </button>
            <DonationReceipt
              donation={activeReceiptDonation}
              madrasaInfo={madrasaInfo}
              showControls={true}
            />
          </div>
        </div>
      )}
    </div>
  );
}
