"use client";

import { WifiOff, RefreshCw, AlertTriangle, CloudUpload } from "lucide-react";
import { useOfflineSync } from "./OfflineSyncProvider";
import { toBanglaNumber } from "@/lib/numberToBangla";

export default function OfflineStatusBanner() {
  const { isOnline, isSyncing, pendingCount, failedCount, syncNow, retryFailed } =
    useOfflineSync();

  // Hide completely when online, not syncing, and nothing pending/failed
  if (isOnline && !isSyncing && pendingCount === 0 && failedCount === 0) {
    return null;
  }

  return (
    <div
      className="fixed bottom-20 md:bottom-4 right-3 md:right-4 z-[60] flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold shadow-lg backdrop-blur-md transition-all print:hidden max-w-[calc(100vw-24px)]"
      role="status"
      aria-live="polite"
      style={{
        backgroundColor: !isOnline
          ? "rgba(180, 83, 9, 0.94)"
          : isSyncing
          ? "rgba(15, 118, 110, 0.94)"
          : failedCount > 0
          ? "rgba(185, 28, 28, 0.94)"
          : "rgba(30, 41, 59, 0.94)",
        color: "#ffffff",
      }}
    >
      {!isOnline ? (
        <>
          <WifiOff className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            অফলাইন মোড
            {pendingCount > 0 ? ` • ${toBanglaNumber(pendingCount)}টি সিঙ্কের অপেক্ষায়` : ""}
          </span>
        </>
      ) : isSyncing ? (
        <>
          <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin" />
          <span className="truncate">
            সিঙ্ক হচ্ছে...{pendingCount > 0 ? ` (${toBanglaNumber(pendingCount)}টি বাকি)` : ""}
          </span>
        </>
      ) : failedCount > 0 ? (
        <>
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{toBanglaNumber(failedCount)}টি তথ্য সিঙ্ক হয়নি</span>
          <button
            type="button"
            onClick={() => retryFailed()}
            className="ml-1 rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-bold hover:bg-white/30 shrink-0"
          >
            আবার চেষ্টা
          </button>
        </>
      ) : (
        <>
          <CloudUpload className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{toBanglaNumber(pendingCount)}টি সিঙ্কের অপেক্ষায়</span>
          <button
            type="button"
            onClick={() => syncNow()}
            className="ml-1 rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-bold hover:bg-white/30 shrink-0"
          >
            সিঙ্ক করুন
          </button>
        </>
      )}
    </div>
  );
}
