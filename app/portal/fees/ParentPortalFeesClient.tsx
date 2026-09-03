"use client";

import React, { useState } from "react";
import {
  CreditCard,
  Receipt,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Download,
  Printer,
  Clock,
  Zap,
  ArrowRight,
  ShieldCheck,
  Building2,
  ChevronDown,
} from "lucide-react";
import Link from "next/link";
import { toBanglaNumber, formatBanglaCurrency } from "@/lib/numberToBangla";
import OnlinePaymentCheckoutModal from "@/components/payments/OnlinePaymentCheckoutModal";
import type { PaymentGatewayConfig } from "@/lib/payment-gateway";

interface Props {
  child: {
    id: string;
    first_name: string;
    last_name: string;
    roll_number?: string;
    student_id?: string;
    class_name?: string;
  };
  students: any[];
  totalPaid: number;
  totalDue: number;
  unpaidInvoices: any[];
  combinedPayments: any[];
  gatewayConfig?: PaymentGatewayConfig;
}

export default function ParentPortalFeesClient({
  child,
  students,
  totalPaid,
  totalDue,
  unpaidInvoices,
  combinedPayments,
  gatewayConfig,
}: Props) {
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* Top Header Banner */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-2xl">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                ফি ও অনলাইন পেমেন্ট পোর্টাল
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                শিক্ষার্থী:{" "}
                <strong className="text-slate-800">
                  {child.first_name} {child.last_name}
                </strong>{" "}
                (রোল: {toBanglaNumber(child.roll_number || child.student_id || "-")})
                {child.class_name && ` • জামাত: ${child.class_name}`}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons & Sibling Switcher */}
        <div className="flex flex-wrap items-center gap-2.5">
          {students.length > 1 && (
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-2xl text-xs font-semibold">
              <span className="text-slate-500">সন্তান:</span>
              <div className="flex gap-1">
                {students.map((s) => (
                  <Link
                    key={s.id}
                    href={`/portal/fees?student_id=${s.id}`}
                    className={`px-2 py-1 rounded-xl transition ${
                      s.id === child.id
                        ? "bg-emerald-600 text-white font-bold"
                        : "text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {s.first_name}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Pay Online CTA Button */}
          {gatewayConfig?.is_enabled && (
            <button
              type="button"
              onClick={() => setIsPayModalOpen(true)}
              className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold rounded-2xl text-xs sm:text-sm shadow-md hover:shadow-lg transition flex items-center gap-2 cursor-pointer"
            >
              <Zap className="w-4 h-4 text-amber-300" />
              <span>অনলাইনে ফি পরিশোধ করুন</span>
            </button>
          )}
        </div>
      </div>

      {/* Financial Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Paid */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-5 sm:p-6 shadow-md border border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              মোট পরিশোধিত ফি
            </h3>
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold mb-1 font-mono">
            ৳ {formatBanglaCurrency(totalPaid)}
          </div>
          <p className="text-xs text-emerald-300 font-semibold flex items-center gap-1 mt-2">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>সকল রসিদ ডাটাবেজে সংরক্ষিত</span>
          </p>
        </div>

        {/* Current Due with Pay Button */}
        <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              বর্তমান বকেয়া (Current Due)
            </h3>
            <Clock
              className={`w-4 h-4 ${totalDue > 0 ? "text-rose-500" : "text-emerald-600"}`}
            />
          </div>
          <div>
            <div className="flex items-baseline justify-between">
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
                  className="text-xs font-bold text-emerald-700 hover:text-emerald-800 underline flex items-center gap-0.5 cursor-pointer"
                >
                  <span>এখনই দিন</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {totalDue > 0
                ? `বকেয়া ইনভয়েস: ${toBanglaNumber(unpaidInvoices.length)} টি`
                : "কোন বকেয়া নেই (পরিশোধিত)"}
            </p>
          </div>
        </div>

        {/* Latest Receipt */}
        <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              সর্বশেষ রসিদ নম্বর
            </h3>
            <Receipt className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <p className="text-lg sm:text-xl font-bold font-mono text-slate-800">
              {combinedPayments[0]?.receipt_no || "-"}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              তারিখ: {combinedPayments[0]?.payment_date || "হালনাগাদ"}
            </p>
          </div>
        </div>
      </div>

      {/* Online Payment Methods Highlights Card */}
      {gatewayConfig?.is_enabled && (
        <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-slate-50 border border-emerald-200 rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                স্বয়ংক্রিয় ডিজিটাল পেমেন্ট মাধ্যম
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            </div>
            <p className="text-xs text-slate-600">
              বিকাশ, নগদ, রকেট এবং ইসলামী ব্যাংক বাংলাদেশ (IBBL / CellFin) অ্যাকাউন্ট থেকে যেকোনো সময় নিরাপদে ফি পরিশোধ করুন।
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPayModalOpen(true)}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
            >
              <span>ফি পরিশোধ করুন</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Payment History Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-emerald-700" />
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">
              পরিশোধিত ফি ও রসিদ তালিকা
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-medium">রসিদ সংগ্রাহক: হিসাব বিভাগ</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="px-4 py-3.5">রশিদ নম্বর</th>
                <th className="px-4 py-3.5">ফি-এর ধরন ও বিবরণ</th>
                <th className="px-4 py-3.5">পরিশোধের তারিখ</th>
                <th className="px-4 py-3.5">পরিশোধের মাধ্যম</th>
                <th className="px-4 py-3.5 text-right">টাকার পরিমাণ</th>
                <th className="px-4 py-3.5 text-center">স্ট্যাটাস</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {combinedPayments.length > 0 ? (
                combinedPayments.map((p) => (
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
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {p.payment_date || "-"}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200 font-medium text-xs">
                        {p.payment_method || "ক্যাশ (নগদ)"}
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
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400 text-sm">
                    কোন পরিশোধিত ফির তথ্য পাওয়া যায়নি।
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

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
