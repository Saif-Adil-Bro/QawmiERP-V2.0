"use client";

import { useState } from "react";
import { FeePayment, FeeAuditLog } from "@/lib/fee-management";
import { reverseFeePayment } from "@/app/actions/fee-management";
import { formatBanglaCurrency, toBanglaNumber } from "@/lib/numberToBangla";
import {
  FileText,
  Search,
  Printer,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Calendar,
  User,
  Layers,
  History,
  X,
  CreditCard,
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

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
          <span>{feedback.text}</span>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabs */}
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
              className="px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 font-medium"
            >
              <option value="ALL">সকল স্ট্যাটাস</option>
              <option value="COMPLETED">সফল (Completed)</option>
              <option value="REVERSED">বাতিলকৃত (Reversed)</option>
            </select>

            {/* Method Filter */}
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 font-medium"
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
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">রিসিট নং ও তারিখ</th>
                      <th className="py-3 px-4">শিক্ষার্থীর নাম ও জামাত</th>
                      <th className="py-3 px-4">ফি'র বিবরণ</th>
                      <th className="py-3 px-4">মাধ্যম</th>
                      <th className="py-3 px-4 text-right">আদায়কৃত টাকা (৳)</th>
                      <th className="py-3 px-4 text-center">স্ট্যাটাস</th>
                      <th className="py-3 px-4 text-right">অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPayments.map((p) => {
                      const isReversed = p.status === "REVERSED";

                      return (
                        <tr key={p.id} className={`hover:bg-slate-50/60 transition ${isReversed ? "bg-red-50/20" : ""}`}>
                          {/* Receipt & Date */}
                          <td className="py-3 px-4">
                            <span className="font-mono font-bold text-slate-900 block">{p.receipt_no}</span>
                            <span className="text-[11px] text-slate-400">{p.payment_date}</span>
                          </td>

                          {/* Student */}
                          <td className="py-3 px-4">
                            <span className="font-bold text-slate-900 block">{p.student_name}</span>
                            <span className="text-[11px] text-slate-500">
                              {p.class_name || "-"} • রোল: {toBanglaNumber(p.student_roll || "-")}
                            </span>
                          </td>

                          {/* Items Breakdown */}
                          <td className="py-3 px-4">
                            {p.allocations && p.allocations.length > 0 ? (
                              <div className="space-y-0.5">
                                {p.allocations.map((a, aIdx) => (
                                  <div key={aIdx} className="text-xs text-slate-700">
                                    <span className="font-medium">{a.fee_type_name}</span>
                                    {a.billing_period ? <span className="text-slate-400"> ({a.billing_period})</span> : null}
                                    <span className="font-mono font-bold text-slate-900 ml-1">৳{formatBanglaCurrency(a.allocated_amount)}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-600 font-medium">সাধারণ ফি</span>
                            )}
                          </td>

                          {/* Method */}
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                              {p.payment_method}
                            </span>
                          </td>

                          {/* Amount */}
                          <td className="py-3 px-4 text-right">
                            <span className={`font-mono font-black text-sm ${isReversed ? "line-through text-slate-400" : "text-emerald-800"}`}>
                              ৳ {formatBanglaCurrency(p.total_amount_received)}
                            </span>
                            {p.discount_total ? (
                              <span className="text-[10px] text-amber-700 block font-medium">
                                ছাড়: ৳{p.discount_total}
                              </span>
                            ) : null}
                          </td>

                          {/* Status */}
                          <td className="py-3 px-4 text-center">
                            {isReversed ? (
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">
                                বাতিলকৃত
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                সফল
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Print Receipt */}
                              <Link
                                href={`/dashboard/accounting/fees/${p.id}/receipt`}
                                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                                title="রসিদ প্রিন্ট করুন"
                              >
                                <Printer className="w-4 h-4" />
                              </Link>

                              {/* Reverse Button (if completed) */}
                              {!isReversed && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenReverse(p)}
                                  className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition cursor-pointer"
                                  title="পেমেন্ট বাতিল / রিভার্স করুন"
                                >
                                  <RotateCcw className="w-4 h-4" />
                                </button>
                              )}
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

      {/* Audit Logs Tab */}
      {activeTab === "audit" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">
              ফি মডিউল সিকিউরিটি ও পরিবর্তন লগ ({auditLogs.length} টি রেকর্ড)
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">সময় ও তারিখ</th>
                  <th className="py-3 px-4">অ্যাকশন</th>
                  <th className="py-3 px-4">এনটিটি ও আইডি</th>
                  <th className="py-3 px-4">ব্যবহারকারী</th>
                  <th className="py-3 px-4">বিবরণ / কারণ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-xs">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 text-slate-500">
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
    </div>
  );
}
