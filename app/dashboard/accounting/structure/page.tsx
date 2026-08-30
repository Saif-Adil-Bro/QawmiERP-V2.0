import { getFeeStructures, getFeeTypes } from "@/app/actions/fee-management";
import { getAcademicSessions } from "@/app/actions/sessions";
import { getClasses } from "@/app/actions/students";
import StructureClient from "./StructureClient";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function FeeStructurePage() {
  const [structures, feeTypes, sessions, classes] = await Promise.all([
    getFeeStructures(),
    getFeeTypes(),
    getAcademicSessions(),
    getClasses(),
  ]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Link
            href="/dashboard/accounting"
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">ফি কাঠামো ও টাইপ কনফিগারেশন</h1>
            <p className="text-slate-500 text-xs sm:text-sm">
              জামাত ও ক্যাটাগরিভিত্তিক ফি তালিকা ও মাসিক চার্জ নির্ধারণ
            </p>
          </div>
        </div>
      </div>

      <StructureClient
        initialStructures={structures}
        initialFeeTypes={feeTypes}
        sessions={sessions}
        classes={classes}
      />
    </div>
  );
}
