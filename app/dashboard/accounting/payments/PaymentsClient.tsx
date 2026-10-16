"use client";

import { useState } from "react";
import { FeePayment, FeeAuditLog } from "@/lib/fee-management";
import {
  voidFeePayment,
  unvoidFeePayment,
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
  RefreshCw,
  Trash2,
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
  const [statusFilter, setStatusFilter] = useState<"ALL" | "COMPLETED" | "VOID">("ALL");
  const [methodFilter, setMethodFilter] = useState<string>("ALL");

  // Void Receipt Modal
  const [isVoidModalOpen, setIsVoidModalOpen] = useState(false);
  const [selectedPaymentForVoid, setSelectedPaymentForVoid] = useState<FeePayment | null>(null);
  const [cancellationReason, setCancellationReason] = useState("");

  // Unvoid Modal (Super Admin Reactivation)
  const [isUnvoidModalOpen, setIsUnvoidModalOpen] = useState(false);
  const [selectedPaymentForUnvoid, setSelectedPaymentForUnvoid] = useState<FeePayment | null>(null);
  const [unvoidReason, setUnvoidReason] = useState("");

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
    const isVoid = p.status === "REVERSED" || p.status === "VOID";
    if (statusFilter === "COMPLETED" && isVoid) return false;
    if (statusFilter === "VOID" && !isVoid) return false;
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

  // Client-Side Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  const totalPages = Math.ceil(filteredPayments.length / itemsPerPage);
  const paginatedPayments = filteredPayments.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Open Void Modal
  const handleOpenVoid = (p: FeePayment) => {
    setSelectedPaymentForVoid(p);
    setCancellationReason("");
    setIsVoidModalOpen(true);
  };

  // Confirm Void Receipt (Soft-Delete)
  const handleConfirmVoid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPaymentForVoid) return;
    if (!cancellationReason.trim()) {
      alert("রসিদ বাতিলের সুনির্দিষ্ট কারণ উল্লেখ করা বাধ্যতামূলক।");
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    const res = await voidFeePayment(selectedPaymentForVoid.id, cancellationReason.trim());
    setIsSubmitting(false);

    if (res.success) {
      setFeedback({ type: "success", text: res.message || "রসিদ সফলভাবে বাতিল (VOID) ও বকেয়া পুনর্বহাল করা হয়েছে।" });
      setPayments((prev) =>
        prev.map((p) =>
          p.id === selectedPaymentForVoid.id
            ? {
                ...p,
                status: "VOID",
                cancellation_reason: cancellationReason.trim(),
                reversal_reason: cancellationReason.trim(),
                voided_at: new Date().toISOString(),
              }
            : p
        )
      );
      setIsVoidModalOpen(false);
    } else {
      setFeedback({ type: "error", text: res.error || "রসিদ বাতিল করতে ব্যর্থ হয়েছে।" });
    }
  };

  // Open Unvoid Modal
  const handleOpenUnvoid = (p: FeePayment) => {
    setSelectedPaymentForUnvoid(p);
    setUnvoidReason("প্রধান এডমিনের অনুমোদনক্রমে পুনর্বহাল");
    setIsUnvoidModalOpen(true);
  };

  // Confirm Unvoid (Super Admin)
  const handleConfirmUnvoid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPaymentForUnvoid) return;

    setIsSubmitting(true);
    setFeedback(null);

    const res = await unvoidFeePayment(selectedPaymentForUnvoid.id, unvoidReason.trim() || "পুনরায় সক্রিয়");
    setIsSubmitting(false);

    if (res.success) {
      setFeedback({ type: "success", text: res.message || "রসিদটি পুনরায় সক্রিয় করা হয়েছে।" });
      setPayments((prev) =>
        prev.map((p) =>
          p.id === selectedPaymentForUnvoid.id
            ? {
                ...p,
                status: "COMPLETED",
              }
            : p
        )
      );
      setIsUnvoidModalOpen(false);
    } else {
      setFeedback({ type: "error", text: res.error || "পুনরায় সক্রিয় করতে সমস্যা হয়েছে।" });
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
              <option value="ALL">সকল রসিদ (সকল স্ট্যাটাস)</option>
              <option value="COMPLETED">সফল রসিদ (Active)</option>
              <option value="VOID">বাতিলকৃত রসিদ (VOID)</option>
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
                    {paginatedPayments.map((p) => {
                      const isVoid = p.status === "REVERSED" || p.status === "VOID";

                      return (
                        <tr
                          key={p.id}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            isVoid ? "bg-rose-50/25 opacity-75" : ""
                          }`}
                        >
                          {/* Receipt & Date */}
                          <td className="py-3.5 px-4">
                            <span className={`font-mono font-bold block ${isVoid ? "line-through text-slate-400" : "text-slate-900"}`}>
                              {p.receipt_no}
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono">{p.payment_date}</span>
                          </td>

                          {/* Student */}
                          <td className="py-3.5 px-4">
                            <span className={`font-bold block ${isVoid ? "line-through text-slate-400" : "text-slate-900"}`}>
                              {p.student_name}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              {p.class_name || "-"} • রোল: {toBanglaNumber(p.student_roll || "-")}
                            </span>
                            {isVoid && (p.cancellation_reason || p.reversal_reason) && (
                              <div className="text-[10px] text-rose-600 font-medium italic mt-0.5">
                                বাতিলের কারণ: {p.cancellation_reason || p.reversal_reason}
                              </div>
                            )}
                          </td>

                          {/* Items Breakdown */}
                          <td className="py-3.5 px-4">
                            {p.allocations && p.allocations.length > 0 ? (
                              <div className="space-y-0.5">
                                {p.allocations.map((a, aIdx) => (
                                  <div key={aIdx} className={`text-xs ${isVoid ? "line-through text-slate-400" : "text-slate-700"}`}>
                                    <span className="font-medium">{a.fee_type_name}</span>
                                    {a.fund_name ? (
                                      <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded ml-1 font-sans">
                                        {a.fund_name}
                                      </span>
                                    ) : null}
                                    <span className="font-mono font-bold ml-1">
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
                            <span
                              className={`font-mono font-bold text-sm ${
                                isVoid ? "line-through text-slate-400 opacity-60" : "text-emerald-700"
                              }`}
                            >
                              ৳ {formatBanglaCurrency(p.total_amount_received)}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4 text-center">
                            {isVoid ? (
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold font-mono bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs">
                                  <Ban className="w-3 h-3 text-rose-600" />
                                  VOID
                                </span>
                                {p.voided_at && (
                                  <span className="text-[9px] text-slate-400 block font-mono">
                                    {toBanglaNumber(new Date(p.voided_at).toLocaleDateString("en-GB"))}
                                  </span>
                                )}
                              </div>
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

                              {/* Void Button (if active) */}
                              {!isVoid ? (
                                <button
                                  type="button"
                                  onClick={() => handleOpenVoid(p)}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition cursor-pointer"
                                  title="রসিদ বাতিল করুন (Void Receipt)"
                                >
                                  <Ban className="w-3.5 h-3.5 text-rose-600" />
                                  <span>বাতিল</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleOpenUnvoid(p)}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition cursor-pointer"
                                  title="প্রধান এডমিন: রসিদটি পুনরায় সক্রিয় করুন"
                                >
                                  <RefreshCw className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>সক্রিয় করুন</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Client Side Pagination */}
                {totalPages > 1 && (
                  <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
                    <div>
                      সর্বমোট <strong className="text-slate-800">{toBanglaNumber(filteredPayments.length)}</strong> টি পেমেন্টের মধ্যে{" "}
                      <strong className="text-slate-800">
                        {toBanglaNumber((currentPage - 1) * itemsPerPage + 1)} - {toBanglaNumber(Math.min(currentPage * itemsPerPage, filteredPayments.length))}
                      </strong>{" "}
                      দেখাচ্ছে
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 font-semibold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      >
                        পূর্ববর্তী
                      </button>
                      <span className="px-2 font-bold text-slate-800">
                        পৃষ্ঠা {toBanglaNumber(currentPage)} / {toBanglaNumber(totalPages)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 font-semibold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      >
                        পরবর্তী
                      </button>
                    </div>
                  </div>
                )}
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

      {/* Void Receipt Modal (Soft-Delete with Reason) */}
      {isVoidModalOpen && selectedPaymentForVoid && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl border border-rose-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-rose-600">
                <Ban className="w-5 h-5" />
                <h3 className="text-base font-bold text-slate-900">রসিদ বাতিল করুন (Void Receipt)</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsVoidModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-rose-50/70 text-slate-800 p-4 rounded-2xl text-xs space-y-2 border border-rose-200">
              <div className="space-y-1 font-sans">
                <p><strong>রসিদ নং:</strong> <span className="font-mono text-rose-700 font-bold">{selectedPaymentForVoid.receipt_no}</span></p>
                <p><strong>শিক্ষার্থী:</strong> {selectedPaymentForVoid.student_name} ({selectedPaymentForVoid.class_name || "-"})</p>
                <p><strong>আদায়কৃত অর্থ:</strong> ৳ {formatBanglaCurrency(selectedPaymentForVoid.total_amount_received)}</p>
                <p><strong>তারিখ:</strong> {selectedPaymentForVoid.payment_date}</p>
              </div>
              <p className="text-[11px] text-rose-700 pt-2 border-t border-rose-200/60 leading-relaxed">
                ⚠️ আর্থিক স্বচ্ছতার জন্য রসিদ স্থায়ীভাবে মুছে ফেলা হয় না। এটি বাতিল (VOID) হিসেবে সংরক্ষিত থাকবে, মোট আয় থেকে বাদ পড়বে এবং শিক্ষার্থীর বকেয়া পূর্বে যে অবস্থায় ছিল সেভাবে পুনর্বহাল হবে।
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
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  placeholder="যেমন: ভুল ছাত্রের নামে এন্ট্রি / ভুল অংক / চেক বাউন্স / অভিভাবকের অনুরোধ..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 text-xs sm:text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsVoidModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold cursor-pointer"
                >
                  ফিরে যান
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Ban className="w-4 h-4" />
                  <span>{isSubmitting ? "বাতিল হচ্ছে..." : "নিশ্চিত বাতিল করুন (VOID)"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Unvoid Modal (Super Admin Reactivation) */}
      {isUnvoidModalOpen && selectedPaymentForUnvoid && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl border border-emerald-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-emerald-700">
                <RefreshCw className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900">রসিদ পুনরায় সক্রিয় করুন (Unvoid)</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsUnvoidModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-emerald-50/60 text-slate-800 p-4 rounded-2xl text-xs space-y-2 border border-emerald-200">
              <div className="space-y-1 font-sans">
                <p><strong>রসিদ নং:</strong> <span className="font-mono text-emerald-800 font-bold">{selectedPaymentForUnvoid.receipt_no}</span></p>
                <p><strong>শিক্ষার্থী:</strong> {selectedPaymentForUnvoid.student_name}</p>
                <p><strong>পরিমাণ:</strong> ৳ {formatBanglaCurrency(selectedPaymentForUnvoid.total_amount_received)}</p>
                <p>
                  <strong>পূর্বে বাতিলের কারণ:</strong>{" "}
                  <span className="text-rose-700 italic">
                    {selectedPaymentForUnvoid.cancellation_reason || selectedPaymentForUnvoid.reversal_reason || "তথ্য নেই"}
                  </span>
                </p>
              </div>
              <p className="text-[11px] text-emerald-800 pt-2 border-t border-emerald-200/60 leading-relaxed">
                👑 শুধুমাত্র প্রধান এডমিন বিশেষ কারণে বাতিলকৃত রসিদ পুনর্বহাল করতে পারেন। এটি পুনরায় সক্রিয় করলে আয় ও ক্যাশে যুক্ত হবে এবং শিক্ষার্থীর বকেয়া সমন্বয় হবে।
              </p>
            </div>

            <form onSubmit={handleConfirmUnvoid} className="space-y-4 text-xs sm:text-sm">
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700 flex items-center gap-1">
                  <span>পুনরায় সক্রিয়করণের কারণ / এডমিন নোট (বাধ্যতামূলক)</span>
                  <span className="text-emerald-600">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={unvoidReason}
                  onChange={(e) => setUnvoidReason(e.target.value)}
                  placeholder="যেমন: ভুলবশত বাতিল করা হয়েছিল, যাচাই শেষে পুনর্বহাল করা হলো..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600 text-xs sm:text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsUnvoidModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold cursor-pointer"
                >
                  ফিরে যান
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>{isSubmitting ? "সক্রিয় হচ্ছে..." : "নিশ্চিত সক্রিয় করুন"}</span>
                </button>
              </div>
            </form>
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
