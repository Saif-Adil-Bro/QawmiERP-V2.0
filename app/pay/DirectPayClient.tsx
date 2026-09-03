"use client";

import React, { useState } from "react";
import {
  CreditCard,
  Building2,
  Smartphone,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Lock,
  ArrowRight,
  Zap,
} from "lucide-react";
import { toBanglaNumber, formatBanglaCurrency } from "@/lib/numberToBangla";
import OnlinePaymentCheckoutModal from "@/components/payments/OnlinePaymentCheckoutModal";

interface Props {
  data: {
    student: {
      id: string;
      name: string;
      roll?: string;
      class_name?: string;
      parent_phone?: string;
    };
    madrasa: {
      name: string;
      address?: string;
      phone?: string;
    };
    fee_summary: {
      total_due: number;
      unpaid_fees: any[];
    };
    gateway_config: any;
  };
}

export default function DirectPayClient({ data }: Props) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { student, madrasa, fee_summary, gateway_config } = data;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-between p-4 sm:p-6">
      <div className="max-w-xl w-full mx-auto my-auto space-y-6">
        {/* Madrasa Brand Card */}
        <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white text-center shadow-xl border border-emerald-500/20 space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md text-emerald-300 flex items-center justify-center mx-auto mb-2">
            <Building2 className="w-6 h-6" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold">{madrasa.name}</h1>
          {madrasa.address && (
            <p className="text-xs text-emerald-200/80">{madrasa.address}</p>
          )}
          <div className="pt-2">
            <span className="inline-block px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 rounded-full text-xs font-semibold">
              ● অনলাইন ফি পরিশোধ পোর্টাল
            </span>
          </div>
        </div>

        {/* Student Fee Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-md border border-slate-200 space-y-6">
          {/* Student Info Box */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-500 font-semibold block">শিক্ষার্থীর নাম</span>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">
                {student.name}
              </h2>
              <div className="text-xs text-slate-600 mt-0.5">
                জামাত: {student.class_name || "সাধারণ"} • রোল: {toBanglaNumber(student.roll || "-")}
              </div>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-700 rounded-2xl">
              <ShieldCheck className="w-6 h-6" />
            </div>
          </div>

          {/* Due Amount Highlight */}
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-5 text-center space-y-1">
            <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider">
              বর্তমান বকেয়া ফি
            </span>
            <div className="text-3xl sm:text-4xl font-black text-emerald-950 font-mono">
              ৳ {formatBanglaCurrency(fee_summary.total_due)}
            </div>
            <span className="text-xs text-slate-500 block">
              {fee_summary.total_due > 0
                ? `${toBanglaNumber(fee_summary.unpaid_fees.length)} টি বকেয়া ইনভয়েস অন্তর্ভুক্ত`
                : "কোন বকেয়া নেই (পরিশোধিত)"}
            </span>
          </div>

          {/* Unpaid Fee Items Breakdown */}
          {fee_summary.unpaid_fees.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700 block">
                বকেয়া ফি এর বিস্তারিত বিবরণ:
              </span>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {fee_summary.unpaid_fees.map((fee: any) => (
                  <div
                    key={fee.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-800 block">
                        {fee.fee_type_name}
                      </span>
                      <span className="text-slate-500 text-[11px]">
                        {fee.billing_period}
                      </span>
                    </div>
                    <div className="font-mono font-bold text-slate-900 text-sm">
                      ৳ {formatBanglaCurrency(fee.due_amount)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Supported Channels Pill */}
          <div className="border-t border-slate-100 pt-4">
            <div className="text-[11px] font-semibold text-slate-500 mb-2 text-center">
              সমর্থিত পেমেন্ট মাধ্যমসমূহ:
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-pink-50 text-[#D12053] border border-pink-200">
                বিকাশ (bKash)
              </span>
              <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-orange-50 text-[#EA1D25] border border-orange-200">
                নগদ (Nagad)
              </span>
              <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                ইসলামী ব্যাংক (IBBL)
              </span>
              <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-purple-50 text-[#8C3494] border border-purple-200">
                রকেট (Rocket)
              </span>
            </div>
          </div>

          {/* Pay Button */}
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="w-full py-4 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold rounded-2xl text-base shadow-lg hover:shadow-xl transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <Zap className="w-5 h-5 text-amber-300" />
            <span>এখনই ফি পরিশোধ করুন</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>

        {/* Security Assurance */}
        <div className="text-center text-xs text-slate-500 flex items-center justify-center gap-2">
          <Lock className="w-4 h-4 text-emerald-600" />
          <span>২৫৬-বিট এনক্রিপ্টেড পেমেন্ট গেটওয়ে দ্বারা সুরক্ষিত</span>
        </div>
      </div>

      {/* Checkout Modal */}
      <OnlinePaymentCheckoutModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        studentId={student.id}
        studentName={student.name}
        studentRoll={student.roll}
        className={student.class_name}
        totalDue={fee_summary.total_due}
        unpaidFees={fee_summary.unpaid_fees.map((f: any) => ({
          id: f.id,
          fee_type_name: f.fee_type_name,
          billing_period: f.billing_period,
          due_amount: f.due_amount,
        }))}
        islamiBankConfig={gateway_config?.islami_bank}
        onPaymentSuccess={() => {
          // Modal handles receipt display
        }}
      />
    </div>
  );
}
