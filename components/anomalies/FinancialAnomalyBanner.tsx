"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ShieldAlert,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";
import type { FinancialAnomalyRecord } from "@/lib/anomaly-detection-service";
import { toBanglaNumber } from "@/lib/numberToBangla";

interface FinancialAnomalyBannerProps {
  anomalies: FinancialAnomalyRecord[];
}

export default function FinancialAnomalyBanner({
  anomalies,
}: FinancialAnomalyBannerProps) {
  const openAnomalies = (anomalies || []).filter(
    (a) => a.status === "OPEN" || a.status === "INVESTIGATING"
  );

  if (openAnomalies.length === 0) {
    return (
      <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-emerald-950 dark:text-emerald-200">
              কোনো অমীমাংসিত আর্থিক বা বোর্ডিং অসঙ্গতি নেই
            </h4>
            <p className="text-xs text-emerald-700 dark:text-emerald-400">
              বাজার খরচ, ভাউচার ও ফি মওকুফ স্বাভাবিক সীমার মধ্যে রয়েছে।
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/accounting/anomalies"
          className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:underline shrink-0"
        >
          <span>অ্যানোমালি মনিটর</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    );
  }

  const criticalCount = openAnomalies.filter(
    (a) => a.severity === "CRITICAL"
  ).length;
  const warningCount = openAnomalies.length - criticalCount;

  return (
    <div className="bg-amber-50/80 dark:bg-amber-950/30 border-2 border-amber-300 dark:border-amber-800/70 rounded-2xl p-4 shadow-xs space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
            {criticalCount > 0 ? (
              <ShieldAlert className="w-5 h-5 animate-pulse" />
            ) : (
              <AlertTriangle className="w-5 h-5" />
            )}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-sm font-black text-amber-950 dark:text-amber-100">
                আর্থিক ও বোর্ডিং অসঙ্গতি সতর্কতা (Anomaly Detection)
              </h4>
              {criticalCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black">
                  জরুরি: {toBanglaNumber(criticalCount)}টি
                </span>
              )}
              {warningCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-amber-600 text-white text-[10px] font-black">
                  সতর্কতা: {toBanglaNumber(warningCount)}টি
                </span>
              )}
            </div>
            <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
              সর্বশেষ: {openAnomalies[0]?.title}
            </p>
          </div>
        </div>

        <Link
          href="/dashboard/accounting/anomalies"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition self-start sm:self-center shrink-0"
        >
          <span>পর্যালোচনা ও সমাধান করুন</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
