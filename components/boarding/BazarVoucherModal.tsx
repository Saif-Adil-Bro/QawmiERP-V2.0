"use client";

import React from "react";
import { X, Printer, Receipt } from "lucide-react";
import BazarVoucherPrint, { MadrasaInfoType } from "./BazarVoucherPrint";
import { BazarExpenseItem } from "@/app/actions/boarding";

interface BazarVoucherModalProps {
  isOpen: boolean;
  onClose: () => void;
  expense: BazarExpenseItem | null;
  madrasaInfo?: MadrasaInfoType;
}

export default function BazarVoucherModal({
  isOpen,
  onClose,
  expense,
  madrasaInfo,
}: BazarVoucherModalProps) {
  if (!isOpen || !expense) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto print:p-0 print:static print:bg-transparent">
      <div className="bg-slate-100 rounded-2xl border border-slate-300 shadow-2xl max-w-4xl w-full p-3 sm:p-5 relative my-auto print:border-none print:shadow-none print:p-0 print:m-0 print:max-w-none">
        {/* Modal Top Header (Hidden on Print) */}
        <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-slate-300 print:hidden">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                বোর্ডিং বাজার খরচ ভাউচার প্রিন্ট (A4 Print Preview)
              </h3>
              <p className="text-xs text-slate-500 font-mono">
                ভাউচার নং: {expense.voucher_no}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition cursor-pointer"
            id="btn_close_voucher_modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Voucher Component */}
        <BazarVoucherPrint
          expense={expense}
          madrasaInfo={madrasaInfo}
          onClose={onClose}
          showControls={true}
        />
      </div>
    </div>
  );
}
