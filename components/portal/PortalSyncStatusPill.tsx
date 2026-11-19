"use client";

import React from "react";
import { WifiOff, RefreshCw, CheckCircle2, CloudUpload } from "lucide-react";
import { useNetworkSync } from "@/hooks/useNetworkSync";
import type { PortalSyncType } from "@/lib/portal-sync";
import { toBanglaNumber } from "@/lib/numberToBangla";

interface PortalSyncStatusPillProps {
  portalType: PortalSyncType;
}

function formatSyncTime(ts: number | null): string {
  if (!ts) return "কখনোই নয়";
  try {
    return new Intl.DateTimeFormat("bn-BD", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(ts));
  } catch {
    return new Date(ts).toLocaleTimeString();
  }
}

export default function PortalSyncStatusPill({ portalType }: PortalSyncStatusPillProps) {
  const {
    isOnline,
    isSyncing,
    lastSyncedAt,
    pendingOutboxCount,
    triggerBackgroundSync,
  } = useNetworkSync(portalType);

  return (
    <button
      type="button"
      onClick={() => isOnline && !isSyncing && triggerBackgroundSync()}
      disabled={!isOnline || isSyncing}
      title={
        isOnline
          ? `সর্বশেষ সিঙ্ক: ${formatSyncTime(lastSyncedAt)} (ট্যাপ করে রিফ্রেশ করুন)`
          : `অফলাইন মোড • সর্বশেষ সিঙ্ক: ${formatSyncTime(lastSyncedAt)}`
      }
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-bold border transition active:scale-95 ${
        !isOnline
          ? "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800"
          : isSyncing
          ? "bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950/60 dark:text-teal-200 dark:border-teal-800"
          : pendingOutboxCount > 0
          ? "bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-200 dark:border-indigo-800"
          : "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-800"
      }`}
    >
      {!isOnline ? (
        <>
          <WifiOff className="w-3.5 h-3.5 shrink-0" />
          <span>অফলাইন</span>
          {lastSyncedAt && (
            <span className="hidden sm:inline opacity-80">
              • {formatSyncTime(lastSyncedAt)}
            </span>
          )}
        </>
      ) : isSyncing ? (
        <>
          <RefreshCw className="w-3.5 h-3.5 shrink-0 animate-spin" />
          <span>সিঙ্ক হচ্ছে...</span>
        </>
      ) : pendingOutboxCount > 0 ? (
        <>
          <CloudUpload className="w-3.5 h-3.5 shrink-0" />
          <span>{toBanglaNumber(pendingOutboxCount)}টি অপেক্ষমাণ</span>
        </>
      ) : (
        <>
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">সিঙ্কড: {formatSyncTime(lastSyncedAt)}</span>
          <span className="sm:hidden">অনলাইন</span>
        </>
      )}
    </button>
  );
}
