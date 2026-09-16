"use client";

import { useState } from "react";
import { FeePayment, FeeAuditLog } from "@/lib/fee-management";
import {
  reverseFeePayment,
  deleteSingleFeePayment,
  resetAllFeeData,
  syncFeesWithFunds,
} from "@/app/actions/fee-management";
import { formatBanglaCurrency, toBanglaNumber } from "@/lib/numberToBangla";
import {
  FileText,
  Search,
  Printer,
  Ban,
  CheckCircle2,
  AlertTriangle,
  History,
  X,
  CreditCard,
  Trash2,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";

interface PaymentsClientProps {
  initialPayments: FeePayment[];
  initialAuditLogs: FeeAuditLog[];
}

export default function PaymentsClient({
  initialPayments,
  initialAuditLogs,
}: PaymentsClientProps) {
  const [payments, setPayments] = useState<FeePayment[]>(initialPayments);
  const [auditLogs, setAuditLogs] = useState<FeeAuditLog[]>(initialAuditLogs);
  const [activeTab, setActiveTab] = useState<"payments" | "audit">("payments");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "COMPLETED" | "REVERSED">("ALL");
  const [methodFilter, setMethodFilter] = useState<string>("ALL");

  // Reversal Modal
  const [isReverseModalOpen, setIsReverseModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<FeePayment | null>(null);
  const [reversalReason, setReversalReason] = useState("");

  // Delete Single Modal
  const [isDeleteSingleModalOpen, setIsDeleteSingleModalOpen] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<FeePayment | null>(null);

  // Reset Hub Modal
  const [isResetHubOpen, setIsResetHubOpen] = useState(false);
  const [resetOptions, setResetOptions] = useState({
    deletePayments: true,
    resetInvoices: false,
    resetReceiptCounter: false,
  });
  const [confirmText, setConfirmText] = useState("");

  // Action Loading & Feedback
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const totalCollectedAmount = payments
    .filter((p) => p.status !== "REVERSED" && p.status !== "VOID")
    .reduce((sum, p) => sum + (Number(p.total_amount_received) || 0), 0);

  const filteredPayments = payments.filter((p) => {
    if (statusFilter !== "ALL" && p.status !== statusFilter) return false;
    if (methodFilter !== "ALL" && p.payment_method !== methodFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const receipt = (p.receipt_no || "").toLowerCase();
      const name = (p.student_name || "").toLowerCase();
      const roll = (p.student_roll || "").toLowerCase();
      if (!receipt.includes(q) && !name.includes(q) && !roll.includes(q)) {
        return false;
      }
    }
    return true;
  });

  const handleOpenReverse = (p: FeePayment) => {
    setSelectedPayment(p);
    setReversalReason("");
    setIsReverseModalOpen(true);
  };

  const handleConfirmReverse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPayment) return;
    if (!reversalReason.trim()) {
      alert("রিভার্সালের কারণ উল্লেখ করা বাধ্যতামূলক।");
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    const res = await reverseFeePayment(selectedPayment.id, reversalReason);
    setIsSubmitting(false);

    if (res.success) {
      setFeedback({ type: "success", text: res.message || "পেমেন্ট সফলভাবে বাতিল ও সমন্বয় করা হয়েছে।" });
      setPayments((prev) =>
        prev.map((p) =>
          p.id === selectedPayment.id
            ? { ...p, status: "REVERSED", reversal_reason: reversalReason, reversed_at: new Date().toISOString() }
            : p
        )
      );
      setIsReverseModalOpen(false);
    } else {
      setFeedback({ type: "error", text: res.error || "পেমেন্ট বাতিল ব্যর্থ হয়েছে।" });
    }
  };

  const handleOpenDeleteSingle = (p: FeePayment) => {
    setPaymentToDelete(p);
    setIsDeleteSingleModalOpen(true);
  };

  const handleConfirmDeleteSingle = async () => {
    if (!paymentToDelete) return;
    setIsSubmitting(true);
    setFeedback(null);

    const res = await deleteSingleFeePayment(paymentToDelete.id);
    setIsSubmitting(false);

    if (res.success) {
      setFeedback({ type: "success", text: res.message || "পেমেন্ট রেকর্ড মুছে ফেলা হয়েছে।" });
      setPayments((prev) => prev.filter((p) => p.id !== paymentToDelete.id));
      setIsDeleteSingleModalOpen(false);
    } else {
      setFeedback({ type: "error", text: res.error || "ডিলিট করতে সমস্যা হয়েছে।" });
    }
  };

  const handleSyncToFunds = async () => {
    setIsSyncing(true);
    setFeedback(null);

    const res = await syncFeesWithFunds();
    setIsSyncing(false);

    if (res.success) {
      setFeedback({ type: "success", text: res.message || "সকল ফি ও ফান্ড সফলভাবে সিঙ্ক হয়েছে!" });
    } else {
      setFeedback({ type: "error", text: res.error || "সিঙ্ক করতে ব্যর্থ হয়েছে।" });
    }
  };

  const handleExecuteReset = async () => {
    if (confirmText.trim().toLowerCase() !== "delete" && confirmText.trim().toLowerCase() !== "রিসেট") {
      alert("নিশ্চিত করার জন্য বক্সে 'DELETE' বা 'রিসেট' লিখুন।");
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    const res = await resetAllFeeData(resetOptions);
    setIsSubmitting(false);

    if (res.success) {
      setFeedback({
        type: "success",
        text: res.message || "ফি ডাটা সফলভাবে রিসেট ও ক্লিনআপ করা হয়েছে।",
      });
      if (resetOptions.deletePayments) {
        setPayments([]);
      }
      setIsResetHubOpen(false);
      setConfirmText("");
    } else {
      setFeedback({ type: "error", text: res.error || "রিসেট করতে ব্যর্থ হয়েছে।" });
    }
  };

  return (
    <div className="space-y-6">
      {feedback && (
        <div
          className={`p-4 rounded-2xl text-xs sm:text-sm font-semibold flex items-center justify-between shadow-2xs ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Summary and Controls Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-5 sm:p-6 rounded-3xl text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="text-xs text-slate-300 font-medium">মোট সংগৃহীত ফি কালেকশন</span>
          <div className="flex items-baseline gap-2">
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight font-mono">
              ৳ {formatBanglaCurrency(totalCollectedAmount)}
            </h2>
            <span className="text-xs text-emerald-400 font-semibold">
              ({toBanglaNumber(payments.length)} টি পেমেন্ট রেকর্ড)
            </span>
          </div>
          <p className="text-[11px] text-slate-400">
            এই সমস্ত কালেকশন স্বয়ংক্রিয়ভাবে সংশ্লিষ্ট ফান্ড ও ড্যাশবোর্ডের মোট আয়ে প্রতিফলিত হচ্ছে।
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Sync Button */}
          <button
            type="button"
            onClick={handleSyncToFunds}
            disabled={isSyncing}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer disabled:opacity-50"
            title="ফান্ড ব্যালেন্স ও ড্যাশবোর্ড রিক্যালকুলেট ও সিঙ্ক করুন"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
            <span>{isSyncing ? "সিঙ্ক হচ্ছে..." : "ফান্ডে সিঙ্ক করুন"}</span>
          </button>

          {/* Reset Hub Button */}
          <button
            type="button"
            onClick={() => {
              setConfirmText("");
              setIsResetHubOpen(true);
            }}
            className="px-3.5 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-200 border border-red-500/40 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition cursor-pointer"
            title="পেছনের কালেকশন বা টেস্ট ডাটা রিসেট/মুছে ফেলার অপশন"
          >
            <Trash2 className="w-4 h-4 text-red-300" />
            <span>ডাটা রিসেট ও ডিলিট</span>
          </button>
        </div>
      </div>

      {/* Tabs & New Entry */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("payments")}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === "payments"
                ? "bg-slate-900 text-white shadow-2xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>পেমেন্ট ও রসিদ তালিকা ({payments.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("audit")}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === "audit"
                ? "bg-slate-900 text-white shadow-2xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <History className="w-4 h-4" />
            <span>অডিট লগ ({auditLogs.length})</span>
          </button>
        </div>

        {activeTab === "payments" && (
          <Link
            href="/dashboard/accounting/fees/new"
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 self-start sm:self-auto"
          >
            <span>+ নতুন ফি গ্রহণ</span>
          </Link>
        )}
      </div>

      {activeTab === "payments" && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="রসিদ নং, শিক্ষার্থীর নাম বা রোল দিয়ে খুঁজুন..."
                className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 font-medium cursor-pointer"
            >
              <option value="ALL">সকল স্ট্যাটাস</option>
              <option value="COMPLETED">সফল (Completed)</option>
              <option value="REVERSED">বাতিলকৃত (Reversed)</option>
            </select>

            {/* Method Filter */}
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 font-medium cursor-pointer"
            >
              <option value="ALL">সকল পেমেন্ট মাধ্যম</option>
              <option value="Cash">ক্যাশ (Cash)</option>
              <option value="bKash">বিকাশ (bKash)</option>
              <option value="Nagad">নগদ (Nagad)</option>
              <option value="Bank">ব্যাংক (Bank)</option>
            </select>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {filteredPayments.length === 0 ? (
              <div className="p-12 text-center text-slate-400 space-y-2">
                <FileText className="w-10 h-10 text-slate-300 mx-auto" />
                <h4 className="text-base font-bold text-slate-700">কোনো পেমেন্ট রেকর্ড পাওয়া যায়নি</h4>
                <p className="text-xs text-slate-400">নতুন ফি গ্রহণ করতে উপরের বাটনে ক্লিক করুন</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3.5 px-4">রিসিট নং ও তারিখ</th>
                      <th className="py-3.5 px-4">শিক্ষার্থীর নাম ও জামাত</th>
                      <th className="py-3.5 px-4">ফি'র বিবরণ ও ফান্ড</th>
                      <th className="py-3.5 px-4">মাধ্যম</th>
                      <th className="py-3.5 px-4 text-right">আদায়কৃত টাকা (৳)</th>
                      <th className="py-3.5 px-4 text-center">স্ট্যাটাস</th>
                      <th className="py-3.5 px-4 text-right">অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPayments.map((p) => {
                      const isReversed = p.status === "REVERSED" || p.status === "VOID";

                      return (
                        <tr key={p.id} className={`hover:bg-slate-50/60 transition ${isReversed ? "bg-red-50/30" : ""}`}>
                          {/* Receipt & Date */}
                          <td className="py-3.5 px-4">
                            <span className="font-mono font-bold text-slate-900 block">{p.receipt_no}</span>
                            <span className="text-[11px] text-slate-400">{p.payment_date}</span>
                          </td>

                          {/* Student */}
                          <td className="py-3.5 px-4">
                            <span className="font-bold text-slate-900 block">{p.student_name}</span>
                            <span className="text-[11px] text-slate-500">
                              {p.class_name || "-"} • রোল: {toBanglaNumber(p.student_roll || "-")}
                            </span>
                          </td>

                          {/* Items Breakdown */}
                          <td className="py-3.5 px-4">
                            {p.allocations && p.allocations.length > 0 ? (
                              <div className="space-y-0.5">
                                {p.allocations.map((a, aIdx) => (
                                  <div key={aIdx} className="text-xs text-slate-700">
                                    <span className="font-medium">{a.fee_type_name}</span>
                                    {a.fund_name ? (
                                      <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded ml-1 font-sans">
                                        {a.fund_name}
                                      </span>
                                    ) : null}
                                    <span className="font-mono font-bold text-slate-900 ml-1">
                                      ৳{formatBanglaCurrency(a.allocated_amount)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-500 font-sans">{p.notes || "সাধারণ ফি"}</span>
                            )}
                          </td>

                          {/* Method */}
                          <td className="py-3.5 px-4">
                            <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md font-medium text-xs">
                              {p.payment_method || "Cash"}
                            </span>
                          </td>

                          {/* Amount */}
                          <td className="py-3.5 px-4 text-right">
                            <span className={`font-mono font-bold text-sm ${isReversed ? "line-through text-slate-400" : "text-emerald-700"}`}>
                              ৳ {formatBanglaCurrency(p.total_amount_received)}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4 text-center">
                            {isReversed ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-100 text-red-700 border border-red-200">
                                <Ban className="w-3 h-3" />
                                বাতিলকৃত
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" />
                                সফল
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Print Receipt */}
                              <Link
                                href={`/dashboard/accounting/fees/${p.id}/receipt`}
                                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                                title="রসিদ দেখুন ও প্রিন্ট করুন"
                              >
                                <Printer className="w-4 h-4" />
                              </Link>

                              {/* Reverse Button (if not already reversed) */}
                              {!isReversed && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenReverse(p)}
                                  className="p-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition cursor-pointer"
                                  title="পেমেন্ট বাতিল / রিভার্স করুন"
                                >
                                  <Ban className="w-4 h-4" />
                                </button>
                              )}

                              {/* Delete Permanently Button */}
                              <button
                                type="button"
                                onClick={() => handleOpenDeleteSingle(p)}
                                className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition cursor-pointer"
                                title="রেকর্ডটি স্থায়ীভাবে ডিলিট করুন"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "audit" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-sm">হিসাব অডিট ও অ্যাক্টিভিটি লগ</h3>
            <span className="text-xs text-slate-500">সর্বশেষ ১০০টি পরিবর্তন</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">তারিখ ও সময়</th>
                  <th className="py-3 px-4">অ্যাকশন</th>
                  <th className="py-3 px-4">রেকর্ড ID</th>
                  <th className="py-3 px-4">ইউজার</th>
                  <th className="py-3 px-4">বিস্তারিত</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                      {new Date(log.created_at).toLocaleString("bn-BD")}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-900">{log.action}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {log.record_id ? log.record_id.slice(0, 12) : "-"}
                    </td>
                    <td className="py-3 px-4 text-slate-700 font-sans">
                      {log.user_name} ({log.user_role})
                    </td>
                    <td className="py-3 px-4 text-slate-800 font-sans">
                      {log.details || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reversal Confirmation Modal */}
      {isReverseModalOpen && selectedPayment && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="text-base font-bold text-slate-900">পেমেন্ট রিভার্স / বাতিলকরণ</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsReverseModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-red-50 text-red-900 p-3.5 rounded-xl text-xs space-y-1">
              <p>
                <strong>রিসিট নং:</strong> {selectedPayment.receipt_no}
              </p>
              <p>
                <strong>শিক্ষার্থী:</strong> {selectedPayment.student_name}
              </p>
              <p>
                <strong>পরিমাণ:</strong> ৳ {formatBanglaCurrency(selectedPayment.total_amount_received)}
              </p>
              <p className="text-[11px] text-red-700 pt-1">
                ⚠️ এই পেমেন্টটি বাতিল করলে শিক্ষার্থীর অ্যাকাউন্টে পূর্বের বকেয়া হিসাব পুনরায় যোগ হয়ে যাবে।
              </p>
            </div>

            <form onSubmit={handleConfirmReverse} className="space-y-4 text-xs sm:text-sm">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">
                  বাতিলের কারণ (বাধ্যতামূলক) <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  placeholder="যেমন: ভুল এন্ট্রি / ভুল শিক্ষার্থী নির্বাচিত হয়েছিল..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsReverseModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold cursor-pointer"
                >
                  ফিরে যান
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? "বাতিল হচ্ছে..." : "নিশ্চিত বাতিল করুন"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Single Modal */}
      {isDeleteSingleModalOpen && paymentToDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-red-600">
                <Trash2 className="w-5 h-5" />
                <h3 className="text-base font-bold text-slate-900">পেমেন্ট রেকর্ড ডিলিট</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsDeleteSingleModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-red-50 text-red-900 p-4 rounded-2xl text-xs space-y-2 border border-red-200">
              <p className="font-semibold text-red-800">
                আপনি কি নিশ্চিত যে আপনি এই পেমেন্ট রেকর্ডটি স্থায়ীভাবে মুছে ফেলতে চান?
              </p>
              <div className="space-y-1 text-slate-700 pt-1 bg-white p-3 rounded-xl border border-red-100 font-sans">
                <p><strong>রিসিট নং:</strong> {paymentToDelete.receipt_no}</p>
                <p><strong>শিক্ষার্থী:</strong> {paymentToDelete.student_name}</p>
                <p><strong>পরিমাণ:</strong> ৳ {formatBanglaCurrency(paymentToDelete.total_amount_received)}</p>
                <p><strong>তারিখ:</strong> {paymentToDelete.payment_date}</p>
              </div>
              <p className="text-[11px] text-red-600">
                ⚠️ এটি ডিলিট করলে ফান্ড ও ড্যাশবোর্ড থেকে এই কালেকশন সম্পূর্ণ মুছে যাবে এবং শিক্ষার্থীর বকেয়া সমন্বয় হবে।
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsDeleteSingleModalOpen(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold cursor-pointer"
              >
                ফিরে যান
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSingle}
                disabled={isSubmitting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isSubmitting ? "ডিলিট হচ্ছে..." : "স্থায়ীভাবে ডিলিট করুন"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Hub Modal */}
      {isResetHubOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-red-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="w-6 h-6" />
                <div>
                  <h3 className="text-lg font-bold text-slate-900">ফি ডাটা রিসেট ও ডিলিট হাব</h3>
                  <p className="text-xs text-slate-500">পেছনের টেস্ট কালেকশন বা ডাটা পরিষ্কার করুন</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsResetHubOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-600 font-medium">
                আপনি কী কী ডাটা মুছে ফেলতে চান তা নির্বাচন করুন:
              </p>

              {/* Option 1 */}
              <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-slate-200 hover:border-slate-300 bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={resetOptions.deletePayments}
                  onChange={(e) =>
                    setResetOptions((prev) => ({ ...prev, deletePayments: e.target.checked }))
                  }
                  className="mt-1 w-4 h-4 text-red-600 rounded border-slate-300 focus:ring-red-500 cursor-pointer"
                />
                <div className="space-y-0.5 text-xs">
                  <span className="font-bold text-slate-900 block">
                    সকল পূর্বের পেমেন্ট ও কালেকশন রেকর্ড মুছে ফেলুন (Delete All Payments)
                  </span>
                  <span className="text-slate-500 block">
                    পেছনের জমা হওয়া সমস্ত পেমেন্ট রিসিট (যেমন: ৳২২,১০০ কালেকশন) সম্পূর্ণ মুছে যাবে এবং ফান্ড শূন্য হবে।
                  </span>
                </div>
              </label>

              {/* Option 2 */}
              <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-slate-200 hover:border-slate-300 bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={resetOptions.resetInvoices}
                  onChange={(e) =>
                    setResetOptions((prev) => ({ ...prev, resetInvoices: e.target.checked }))
                  }
                  className="mt-1 w-4 h-4 text-red-600 rounded border-slate-300 focus:ring-red-500 cursor-pointer"
                />
                <div className="space-y-0.5 text-xs">
                  <span className="font-bold text-slate-900 block">
                    সকল তৈরি করা ফি বিল/ইনভয়েস মুছে ফেলুন (Delete All Generated Invoices)
                  </span>
                  <span className="text-slate-500 block">
                    শিক্ষার্থীদের নামে জেনারেট করা সকল মাসিক বিল সম্পূর্ণ ডিলিট হয়ে যাবে।
                  </span>
                </div>
              </label>

              {/* Option 3 */}
              <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-slate-200 hover:border-slate-300 bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={resetOptions.resetReceiptCounter}
                  onChange={(e) =>
                    setResetOptions((prev) => ({ ...prev, resetReceiptCounter: e.target.checked }))
                  }
                  className="mt-1 w-4 h-4 text-red-600 rounded border-slate-300 focus:ring-red-500 cursor-pointer"
                />
                <div className="space-y-0.5 text-xs">
                  <span className="font-bold text-slate-900 block">
                    রিসিট সিরিয়াল নম্বর রিসেট করুন (Reset Receipt Counter)
                  </span>
                  <span className="text-slate-500 block">
                    পরবর্তী রিসিট নম্বর শুরু হবে MR-100 থেকে।
                  </span>
                </div>
              </label>
            </div>

            {/* Warning & Confirmation input */}
            <div className="bg-red-50 p-4 rounded-2xl border border-red-200 text-xs space-y-2">
              <p className="text-red-900 font-bold">
                ⚠️ এই অ্যাকশনটি অপরিবর্তনযোগ্য (Irreversible)!
              </p>
              <p className="text-red-700">
                নিশ্চিত করার জন্য নিচের ঘরে <span className="font-mono font-bold bg-red-100 px-1.5 py-0.5 rounded text-red-900">DELETE</span> অথবা <span className="font-mono font-bold bg-red-100 px-1.5 py-0.5 rounded text-red-900">রিসেট</span> টাইপ করুন:
              </p>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE লিখুন..."
                className="w-full px-3 py-2 border border-red-300 rounded-xl bg-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsResetHubOpen(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold text-xs sm:text-sm cursor-pointer"
              >
                ফিরে যান
              </button>
              <button
                type="button"
                onClick={handleExecuteReset}
                disabled={isSubmitting || (!resetOptions.deletePayments && !resetOptions.resetInvoices && !resetOptions.resetReceiptCounter)}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isSubmitting ? "রিসেট হচ্ছে..." : "নিশ্চিত রিসেট করুন"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
