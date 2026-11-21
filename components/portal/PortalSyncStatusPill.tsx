"use client";

import React, { useEffect, useState } from "react";
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
  const [mounted, setMounted] = useState(false);
  const {
    isOnline,
    isSyncing,
    lastSyncedAt,
    pendingOutboxCount, failedOutboxCount, syncMessage,
    triggerBackgroundSync,
  } = useNetworkSync(portalType);

  useEffect(() => {
    setMounted(true);
  }, []);

  const formattedTime = mounted ? formatSyncTime(lastSyncedAt) : "";

  return (
    <button
      type="button"
      onClick={() => isOnline && !isSyncing && triggerBackgroundSync()}
      disabled={!isOnline || isSyncing}
      title={
        isOnline
          ? `সর্বশেষ সিঙ্ক: ${formattedTime || "—"} (ট্যাপ করে রিফ্রেশ করুন)`
          : `অফলাইন মোড • সর্বশেষ সিঙ্ক: ${formattedTime || "—"}`
      }
      className={`inline-flex items-center justify-center gap-1.5 min-h-[44px] md:min-h-[34px] px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition active:scale-95 shrink-0 ${
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
          {mounted && lastSyncedAt && (
            <span className="hidden sm:inline opacity-80">• {formattedTime}</span>
          )}
        </>
      ) : isSyncing ? (
        <>
          <RefreshCw className="w-3.5 h-3.5 shrink-0 animate-spin" />
          <span>সিঙ্ক হচ্ছে</span>
        </>
      ) : syncMessage || failedOutboxCount ? (
        <span>সিঙ্ক অসম্পূর্ণ</span>
      ) : pendingOutboxCount > 0 ? (
        <>
          <CloudUpload className="w-3.5 h-3.5 shrink-0" />
          <span>{toBanglaNumber(pendingOutboxCount)}টি বাকি</span>
        </>
      ) : (
        <>
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">
            {mounted && lastSyncedAt ? `সিঙ্কড: ${formattedTime}` : "সিঙ্ক হয়নি"}
          </span>
          <span className="sm:hidden">অনলাইন</span>
        </>
      )}
    </button>
  );
}
