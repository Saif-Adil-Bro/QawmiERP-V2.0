"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Printer,
  Search,
  Filter,
  Layers,
  TrendingUp,
  TrendingDown,
  Wallet,
  FileText,
  Sparkles,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Download,
} from "lucide-react";
import { FundItem, FundTransactionRecord, DonationItem } from "@/lib/fund-utils";
import { toBanglaNumber, formatBanglaCurrency, numberToBanglaWords } from "@/lib/numberToBangla";
import { getFundLedgerData, getDonationById } from "@/app/actions/zakat";
import DonationReceipt from "./DonationReceipt";

interface FundLedgerModalProps {
  fund: FundItem | null;
  isOpen: boolean;
  onClose: () => void;
  madrasaInfo?: {
    name?: string;
    address?: string;
    phone?: string;
    logo_url?: string;
  };
}

export default function FundLedgerModal({
  fund,
  isOpen,
  onClose,
  madrasaInfo,
}: FundLedgerModalProps) {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<FundTransactionRecord[]>([]);
  const [totalInflow, setTotalInflow] = useState(0);
  const [totalOutflow, setTotalOutflow] = useState(0);
  const [currentBalance, setCurrentBalance] = useState(0);

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"ALL" | "INCOME" | "EXPENSE" | "MAHFIL">("ALL");

  const [activeReceiptDonation, setActiveReceiptDonation] = useState<DonationItem | null>(null);
  const [loadingReceipt, setLoadingReceipt] = useState(false);

  useEffect(() => {
    if (isOpen && fund) {
      loadLedger();
    }
  }, [isOpen, fund]);

  const loadLedger = async () => {
    if (!fund) return;
    setLoading(true);
    try {
      const res = await getFundLedgerData(fund.id || fund.name);
      setTransactions(res.transactions || []);
      setTotalInflow(res.totalInflow || 0);
      setTotalOutflow(res.totalOutflow || 0);
      setCurrentBalance(res.currentBalance || 0);
    } catch (err) {
      console.error("Error loading fund ledger:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenReceipt = async (txn: FundTransactionRecord) => {
    setLoadingReceipt(true);
    try {
      if (txn.type === "INCOME" || txn.type === "MAHFIL_SURPLUS") {
        const don = await getDonationById(txn.id);
        if (don) {
          setActiveReceiptDonation(don);
        } else {
          // Construct fallback
          setActiveReceiptDonation({
            id: txn.id,
            amount: txn.amount,
            donation_type: txn.fund_name,
            fund_name: txn.fund_name,
            donation_date: txn.date,
            receipt_no: txn.voucher_no,
            payment_method: txn.payment_method || "Cash",
            notes: txn.notes,
            is_mahfil_settlement: txn.is_mahfil_settlement,
            donors: {
              name: txn.source_or_recipient,
              phone: "-",
              address: txn.is_mahfil_settlement ? "মাহফিল আয়োজক কমিটি" : "-",
            },
          });
        }
      }
    } catch (err) {
      console.error("Error opening receipt:", err);
    } finally {
      setLoadingReceipt(false);
    }
  };

  const handlePrintStatement = () => {
    const printElem = document.getElementById("fund-statement-print-area");
    if (!printElem) {
      window.print();
      return;
    }
    const existing = document.getElementById("temp-statement-print-frame");
    if (existing) existing.remove();

    const clone = printElem.cloneNode(true) as HTMLElement;
    clone.id = "temp-statement-print-frame";
    document.body.appendChild(clone);
    document.body.classList.add("is-printing-now");

    setTimeout(() => {
      window.print();
      setTimeout(() => {
        document.body.classList.remove("is-printing-now");
        const temp = document.getElementById("temp-statement-print-frame");
        if (temp) temp.remove();
      }, 600);
    }, 150);
  };

  if (!isOpen || !fund) return null;

  const filteredTxns = transactions.filter((t) => {
    const matchesSearch =
      (t.source_or_recipient || "").toLowerCase().includes(search.toLowerCase()) ||
      (t.voucher_no || "").toLowerCase().includes(search.toLowerCase()) ||
      (t.notes || "").toLowerCase().includes(search.toLowerCase()) ||
      (t.category || "").toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    if (filterType === "ALL") return true;
    if (filterType === "INCOME") return t.type === "INCOME" || t.type === "MAHFIL_SURPLUS";
    if (filterType === "EXPENSE") return t.type === "EXPENSE" || t.type === "MAHFIL_DEFICIT";
    if (filterType === "MAHFIL") return t.is_mahfil_settlement || t.type === "MAHFIL_SURPLUS" || t.type === "MAHFIL_DEFICIT";
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
                <span className="text-[10px] text-indigo-700">জমা ও খরচের জের</span>
              </div>
            </div>

            {/* Total Transactions */}
            <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-700">মোট লেনদেন সংখ্যা</span>
                <FileText className="w-4 h-4 text-slate-500" />
              </div>
              <div className="mt-2">
                <h3 className="text-lg sm:text-xl font-black text-slate-900 font-mono">
                  {toBanglaNumber(transactions.length)} টি
                </h3>
                <span className="text-[10px] text-slate-500">অনুমোদিত ভাউচার রেকর্ড</span>
              </div>
            </div>
          </div>

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
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilterType(tab.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
                    filterType === tab.id
                      ? "bg-slate-900 text-white shadow-2xs"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Transactions Table */}
          {loading ? (
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
                      <th className="py-3 px-4 text-right">মেমো / রসিদ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                    {filteredTxns.map((txn) => {
                      const isInflow = txn.type === "INCOME" || txn.type === "MAHFIL_SURPLUS";
                      const isMahfil = txn.is_mahfil_settlement || txn.type === "MAHFIL_SURPLUS" || txn.type === "MAHFIL_DEFICIT";

                      return (
                        <tr key={txn.id} className="hover:bg-slate-50/80 transition-colors">
                          {/* Date & Voucher */}
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900">
                              {toBanglaNumber(new Date(txn.date).toLocaleDateString("en-GB"))}
                            </div>
                            <div className="text-[11px] font-mono text-slate-500">
                              {txn.voucher_no}
                            </div>
                          </td>

                          {/* Source / Donor */}
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900 text-sm">
                              {txn.source_or_recipient}
                            </div>
                            {txn.notes && (
                              <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5" title={txn.notes}>
                                {txn.notes}
                              </div>
                            )}
                          </td>

                          {/* Category / Nature Badge */}
                          <td className="py-3 px-4">
                            {isMahfil ? (
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
                            <div className={`font-mono font-black text-sm ${isInflow ? "text-emerald-800" : "text-rose-700"}`}>
                              {isInflow ? "+ ৳ " : "- ৳ "}
                              {formatBanglaCurrency(txn.amount)}
                            </div>
                          </td>

                          {/* Action / Receipt */}
                          <td className="py-3 px-4 text-right">
                            {isInflow ? (
                              <button
                                type="button"
                                onClick={() => handleOpenReceipt(txn)}
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
                          </td>
                        </tr>
                      );
                    })}

                    {filteredTxns.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-slate-400">
                          <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                          <p className="font-bold text-slate-700">কোনো লেনদেন রেকর্ড পাওয়া যায়নি</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">এই ফান্ডে এখনও কোনো লেনদেন সংঘটিত হয়নি</p>
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
        <div id="fund-statement-print-area" className="hidden print:block p-8 bg-white text-slate-900">
          <div className="text-center border-b-2 border-slate-900 pb-4 mb-6">
            <h1 className="text-2xl font-black text-slate-900">{madrasaInfo?.name || "মাদরাসা"}</h1>
            {madrasaInfo?.address && <p className="text-xs text-slate-600 mt-1">{madrasaInfo.address}</p>}
            {madrasaInfo?.phone && <p className="text-xs text-slate-600">মোবাইল: {toBanglaNumber(madrasaInfo.phone)}</p>}
            <div className="mt-3 inline-block bg-slate-900 text-white px-4 py-1 rounded font-bold text-sm">
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
                <th className="p-2 text-right">খরচ ৳</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t, idx) => (
                <tr key={idx} className="border-b border-slate-200">
                  <td className="p-2 border-r border-slate-300">{toBanglaNumber(new Date(t.date).toLocaleDateString("en-GB"))}</td>
                  <td className="p-2 border-r border-slate-300 font-mono">{t.voucher_no}</td>
                  <td className="p-2 border-r border-slate-300">
                    <div className="font-bold">{t.source_or_recipient}</div>
                    {t.notes && <div className="text-[10px] text-slate-500">{t.notes}</div>}
                  </td>
                  <td className="p-2 border-r border-slate-300 text-right font-mono text-emerald-800">
                    {t.type === "INCOME" || t.type === "MAHFIL_SURPLUS" ? formatBanglaCurrency(t.amount) : "-"}
                  </td>
                  <td className="p-2 text-right font-mono text-rose-800">
                    {t.type === "EXPENSE" || t.type === "MAHFIL_DEFICIT" ? formatBanglaCurrency(t.amount) : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-16 pt-4 flex justify-between text-xs border-t border-slate-300">
            <div className="text-center w-36 border-t border-slate-400 pt-1">হিসাবরক্ষক</div>
            <div className="text-center w-36 border-t border-slate-400 pt-1">অডিটর</div>
            <div className="text-center w-36 border-t border-slate-400 pt-1">মুহতামিম / সভাপতি</div>
          </div>
        </div>
      </div>

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
