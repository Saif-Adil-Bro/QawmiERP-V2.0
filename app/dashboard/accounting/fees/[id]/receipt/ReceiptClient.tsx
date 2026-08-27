"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import DualMoneyReceipt from "@/components/accounting/DualMoneyReceipt";

export default function ReceiptClient({ fee, madrasaInfo }: { fee: any, madrasaInfo?: any }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center space-x-4">
          <Link
            href="/dashboard/accounting/fees"
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">মানি রিসিট</h1>
            <p className="text-slate-500 text-sm">রিসিট নং: {fee.receipt_no || fee.id?.substring(0, 8)?.toUpperCase()}</p>
          </div>
        </div>
      </div>

      <DualMoneyReceipt fee={fee} madrasaInfo={madrasaInfo} />
    </div>
  );
}

