"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  CreditCard,
  Receipt,
  TrendingUp,
  CheckCircle2,
  Printer,
  Clock,
  Zap,
  ArrowRight,
  X,
} from "lucide-react";
import Link from "next/link";
import { toBanglaNumber, formatBanglaCurrency } from "@/lib/numberToBangla";
import OnlinePaymentCheckoutModal from "@/components/payments/OnlinePaymentCheckoutModal";
import DualMoneyReceipt from "@/components/accounting/DualMoneyReceipt";
import type { PublicPaymentGatewayConfig } from "@/lib/payment-gateway";
import type { PublicMadrasaInfo } from "@/lib/getMadrasaInfo";
import { seedPortalOfflineCache } from "@/lib/portal-sync";
import { useOfflinePortalSnapshot } from "@/hooks/useOfflinePortalData";

interface Props {
  child: {
    id: string;
    first_name: string;
    last_name: string;
    roll_number?: string;
    student_id?: string;
    student_id_formatted?: string;
    class_name?: string;
    [key: string]: any;
  };
  students: any[];
  totalPaid: number;
  totalDue: number;
  unpaidInvoices: any[];
  combinedPayments: any[];
  gatewayConfig?: PublicPaymentGatewayConfig;
  madrasaInfo?: PublicMadrasaInfo;
}

export default function ParentPortalFeesClient({
  child,
  students,
  totalPaid,
  totalDue,
  unpaidInvoices,
  combinedPayments,
  gatewayConfig,
  madrasaInfo,
}: Props) {
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [selectedReceiptFee, setSelectedReceiptFee] = useState<any | null>(null);
  const offlineSnapshot = useOfflinePortalSnapshot();

  // Seed Dexie IndexedDB silently for offline access
  useEffect(() => {
    if (!combinedPayments?.length) return;
    seedPortalOfflineCache("student", {
      fees: combinedPayments.map((p) => ({
        ...p,
        id: String(p.id),
        student_id: child.id,
        amount_paid: Number(p.total_amount_received || p.amount_paid || 0),
      })),
    });
  }, [combinedPayments, child.id]);

  const effectivePayments = useMemo(() => {
    if (combinedPayments.length > 0) return combinedPayments;
    if (!offlineSnapshot?.fees?.length) return [];
    return offlineSnapshot.fees
      .filter((f: any) => !child?.id || f.student_id === child.id)
      .map((f: any) => ({
        ...f,
        receipt_no: f.receipt_no || f.receipt_number || `REC-${String(f.id).slice(0, 6).toUpperCase()}`,
        total_amount_received: Number(f.total_amount_received ?? f.amount_paid ?? f.amount ?? 0),
      }));
  }, [combinedPayments, offlineSnapshot?.fees, child.id]);

  const effectiveTotalPaid =
    totalPaid > 0
      ? totalPaid
      : effectivePayments.reduce(
          (acc: number, curr: any) => acc + (Number(curr.total_amount_received) || 0),
          0
        );

  const openReceipt = (p: any) => {
    setSelectedReceiptFee({
      id: p.id,
      receipt_no: p.receipt_no,
      amount: p.total_amount_received,
      payment_date: p.payment_date,
      notes: p.notes,
      payment_method: p.payment_method,
      allocations: p.allocations,
      students: {
        first_name: child.first_name,
        last_name: child.last_name,
        roll_number: child.roll_number || child.student_id,
        class_name: child.class_name,
      },
    });
  };

  return (
    <div className="space-y-5 sm:space-y-6 w-full max-w-full overflow-x-hidden">
      {/* Top Header Banner */}
      <div className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {child.photo_url ? (
            <img
              src={child.photo_url}
              alt=""
              className="w-12 h-12 rounded-2xl object-cover border border-emerald-200 shrink-0 shadow-2xs"
            />
          ) : (
            <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-2xl shrink-0">
              <CreditCard className="w-5 h-5" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-bold text-slate-900">
              ফি ও অনলাইন পেমেন্ট পোর্টাল
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>
                শিক্ষার্থী:{" "}
                <strong className="text-slate-800">
                  {child.first_name} {child.last_name}
                </strong>
              </span>
              {(child.student_id || child.student_id_formatted) && (
                <span className="font-mono bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded text-xs border border-emerald-200 font-bold">
                  আইডি: {child.student_id || child.student_id_formatted}
                </span>
              )}
              {child.roll_number && (
                <span>(রোল: {toBanglaNumber(child.roll_number)})</span>
              )}
              {child.class_name && <span>• জামাত: {child.class_name}</span>}
            </p>
          </div>
        </div>

        {/* Action Buttons & Sibling Switcher */}
        <div className="flex flex-wrap items-center gap-2.5">
          {students.length > 1 && (
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-2xl text-xs font-semibold overflow-x-auto max-w-full">
              <span className="text-slate-500 shrink-0">সন্তান:</span>
              <div className="flex items-center gap-1">
                {students.map((s) => (
                  <Link
                    key={s.id}
                    href={`/portal/fees?student_id=${s.id}`}
                    className={`min-h-[36px] px-2.5 py-1 rounded-xl transition flex items-center gap-1 whitespace-nowrap ${
                      s.id === child.id
                        ? "bg-emerald-600 text-white font-bold"
                        : "text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    <span>{s.first_name}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {gatewayConfig?.is_enabled && (
            <button
              type="button"
              onClick={() => setIsPayModalOpen(true)}
              className="min-h-[44px] w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold rounded-2xl text-xs sm:text-sm shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Zap className="w-4 h-4 text-amber-300 shrink-0" />
              <span>অনলাইনে ফি পরিশোধ করুন</span>
            </button>
          )}
        </div>
      </div>

      {/* Financial Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4">
        {/* Total Paid */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-5 sm:p-6 shadow-md border border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-slate-300 tracking-wide">মোট পরিশোধিত ফি</h3>
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold mb-1 font-mono">
            ৳ {formatBanglaCurrency(effectiveTotalPaid)}
          </div>
          <p className="text-xs text-emerald-300 font-semibold flex items-center gap-1 mt-2">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>সকল রসিদ ডাটাবেজে সংরক্ষিত</span>
          </p>
        </div>

        {/* Current Due with Pay Button */}
        <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-slate-500 tracking-wide">বর্তমান বকেয়া</h3>
            <Clock
              className={`w-4 h-4 ${totalDue > 0 ? "text-rose-500" : "text-emerald-600"}`}
            />
          </div>
          <div>
            <div className="flex items-baseline justify-between gap-2">
              <p
                className={`text-2xl sm:text-3xl font-black font-mono ${
                  totalDue > 0 ? "text-rose-700" : "text-emerald-700"
                }`}
              >
                ৳ {formatBanglaCurrency(totalDue)}
              </p>
              {totalDue > 0 && gatewayConfig?.is_enabled && (
                <button
                  type="button"
                  onClick={() => setIsPayModalOpen(true)}
                  className="min-h-[36px] text-xs font-bold text-emerald-700 hover:text-emerald-800 underline flex items-center gap-0.5 cursor-pointer"
                >
                  <span>এখনই দিন</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {totalDue > 0
                ? `বকেয়া ইনভয়েস: ${toBanglaNumber(unpaidInvoices.length)}টি`
                : "কোনো বকেয়া নেই (পরিশোধিত)"}
            </p>
          </div>
        </div>

        {/* Latest Receipt */}
        <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-slate-500 tracking-wide">সর্বশেষ রসিদ নম্বর</h3>
            <Receipt className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <p className="text-lg sm:text-xl font-bold font-mono text-slate-800 truncate">
              {effectivePayments[0]?.receipt_no || "-"}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              তারিখ: {effectivePayments[0]?.payment_date || "হালনাগাদ"}
            </p>
          </div>
        </div>
      </div>

      {/* Online Payment Methods Highlights Card */}
      {gatewayConfig?.is_enabled && (
        <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-slate-50 border border-emerald-200 rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-emerald-800 tracking-wide">
                স্বয়ংক্রিয় ডিজিটাল পেমেন্ট মাধ্যম
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              বিকাশ, নগদ, রকেট এবং ইসলামী ব্যাংক অ্যাকাউন্ট থেকে যেকোনো সময় নিরাপদে ফি পরিশোধ করুন।
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsPayModalOpen(true)}
            className="min-h-[44px] px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 shrink-0"
          >
            <span>ফি পরিশোধ করুন</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Payment History: Mobile Stacked Cards + Desktop Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-emerald-700 shrink-0" />
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">
              পরিশোধিত ফি ও রসিদ তালিকা
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-medium">হিসাব বিভাগ</span>
        </div>

        {/* Mobile Stacked Receipt Cards (< 768px) */}
        <div className="md:hidden divide-y divide-slate-100">
          {effectivePayments.length > 0 ? (
            effectivePayments.map((p: any) => (
              <div key={p.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-bold text-slate-800 break-all">
                      {p.receipt_no}
                    </p>
                    <p className="text-sm font-bold text-slate-900 mt-0.5 break-words">
                      {p.allocations && p.allocations.length > 0
                        ? p.allocations.map((a: any) => a.fee_type_name).join(", ")
                        : p.notes || "মাসিক বেতন ও ফি"}
                    </p>
                  </div>
                  <span className="font-mono font-extrabold text-emerald-800 text-sm shrink-0">
                    ৳ {formatBanglaCurrency(p.total_amount_received)}
                  </span>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                  <div className="flex flex-wrap items-center gap-2">
                    <span>তারিখ: {p.payment_date || "-"}</span>
                    <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200 font-medium text-[11px] text-slate-700">
                      {p.payment_method || "নগদ"}
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>পরিশোধিত</span>
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => openReceipt(p)}
                  className="w-full min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200 hover:border-emerald-300 text-xs font-bold transition"
                >
                  <Printer className="w-4 h-4" />
                  <span>রসিদ দেখুন ও প্রিন্ট করুন</span>
                </button>
              </div>
            ))
          ) : (
            <div className="text-center py-10 px-4 text-slate-400 text-sm">
              কোনো পরিশোধিত ফির তথ্য পাওয়া যায়নি।
            </div>
          )}
        </div>

        {/* Desktop Table (>= 768px) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 tracking-wider">
                <th className="px-4 py-3.5">রসিদ নম্বর</th>
                <th className="px-4 py-3.5">ফি-এর ধরন ও বিবরণ</th>
                <th className="px-4 py-3.5">পরিশোধের তারিখ</th>
                <th className="px-4 py-3.5">মাধ্যম</th>
                <th className="px-4 py-3.5 text-right">টাকার পরিমাণ</th>
                <th className="px-4 py-3.5 text-center">অবস্থা</th>
                <th className="px-4 py-3.5 text-right">রসিদ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {effectivePayments.length > 0 ? (
                effectivePayments.map((p: any) => (
                  <tr key={p.id} className="hover:bg-slate-50/60 transition">
                    <td className="px-4 py-3 font-mono text-xs font-bold text-slate-800">
                      {p.receipt_no}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-800 text-xs sm:text-sm">
                        {p.allocations && p.allocations.length > 0
                          ? p.allocations.map((a: any) => a.fee_type_name).join(", ")
                          : p.notes || "মাসিক বেতন ও ফি"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{p.payment_date || "-"}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200 font-medium text-xs">
                        {p.payment_method || "নগদ"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-emerald-800 text-right text-sm">
                      ৳ {formatBanglaCurrency(p.total_amount_received)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>পরিশোধিত</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => openReceipt(p)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 hover:border-emerald-300 text-xs font-semibold transition cursor-pointer"
                        title="মানি রিসিট দেখুন ও প্রিন্ট করুন"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>রসিদ</span>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400 text-sm">
                    কোনো পরিশোধিত ফির তথ্য পাওয়া যায়নি।
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* View & Print Money Receipt Modal */}
      {selectedReceiptFee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-5 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] overflow-y-auto p-3.5 sm:p-6 shadow-2xl space-y-4 my-auto relative">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 print:hidden">
              <div className="flex items-center gap-2 min-w-0">
                <Receipt className="w-5 h-5 text-emerald-700 shrink-0" />
                <h3 className="font-bold text-slate-900 text-sm sm:text-lg truncate">
                  মানি রিসিট (ফি পরিশোধ রসিদ)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReceiptFee(null)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition shrink-0"
                aria-label="বন্ধ করুন"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <DualMoneyReceipt
                fee={selectedReceiptFee}
                student={selectedReceiptFee.students}
                madrasaInfo={madrasaInfo}
              />
            </div>
          </div>
        </div>
      )}

      {/* Online Payment Modal */}
      <OnlinePaymentCheckoutModal
        isOpen={isPayModalOpen}
        onClose={() => setIsPayModalOpen(false)}
        studentId={child.id}
        studentName={`${child.first_name} ${child.last_name}`.trim()}
        studentRoll={child.roll_number || child.student_id}
        className={child.class_name}
        totalDue={totalDue}
        unpaidFees={unpaidInvoices.map((f) => ({
          id: f.id,
          fee_type_name: f.fee_type_name,
          billing_period: f.billing_period,
          due_amount: f.due_amount,
        }))}
        islamiBankConfig={gatewayConfig?.islami_bank}
        onPaymentSuccess={() => {
          // Modal handles completion & reload
        }}
      />
    </div>
  );
}
