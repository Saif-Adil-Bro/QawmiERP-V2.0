"use client";

import Link from "next/link";
import { Clock, ArrowRight, RotateCcw } from "lucide-react";

interface PendingApprovalBannerProps {
  message?: string | null;
  approvalRequestId?: string | null;
  onReset?: () => void;
  resetLabel?: string;
  compact?: boolean;
}

export default function PendingApprovalBanner({
  message,
  approvalRequestId,
  onReset,
  resetLabel = "নতুন কাজ করুন",
  compact = false,
}: PendingApprovalBannerProps) {
  return (
    <div
      role="status"
      className={`rounded-xl border border-amber-300 bg-amber-50/90 text-amber-950 shadow-sm dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-100 ${
        compact ? "p-3" : "p-5"
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">
              অনুমোদনের জন্য অপেক্ষমাণ (Pending Approval)
            </h3>
            <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">
              {message ||
                "আপনার আবেদনটি সফলভাবে জমা হয়েছে এবং অনুমোদনের (Approval) জন্য অপেক্ষমাণ রয়েছে।"}
            </p>
            {approvalRequestId && (
              <p className="mt-1.5 font-mono text-xs text-amber-700 dark:text-amber-400">
                রিকোয়েস্ট আইডি: {approvalRequestId}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
          <Link
            href="/dashboard/approvals"
            className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
          >
            অ্যাপ্রুভাল স্ট্যাটাস দেখুন
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:bg-slate-900 dark:text-amber-200"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {resetLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
