"use client";

import { WifiOff, RefreshCw, AlertTriangle, CloudUpload } from "lucide-react";
import { useOfflineSync } from "./OfflineSyncProvider";

export default function OfflineStatusBanner() {
  const { isOnline, isSyncing, pendingCount, failedCount, syncNow, retryFailed } =
    useOfflineSync();

  // Hide completely when online, not syncing, and nothing pending/failed
  if (isOnline && !isSyncing && pendingCount === 0 && failedCount === 0) {
    return null;
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-[9999] flex items-center gap-2.5 rounded-full px-4 py-2 text-xs font-medium shadow-lg backdrop-blur-md transition-all print:hidden"
      role="status"
      aria-live="polite"
      style={{
        backgroundColor: !isOnline
          ? "rgba(180, 83, 9, 0.92)"
          : isSyncing
          ? "rgba(15, 118, 110, 0.92)"
          : failedCount > 0
          ? "rgba(185, 28, 28, 0.92)"
          : "rgba(30, 41, 59, 0.92)",
        color: "#ffffff",
      }}
    >
      {!isOnline ? (
        <>
          <WifiOff className="h-3.5 w-3.5 shrink-0" />
          <span>
            অফলাইন মোড
            {pendingCount > 0 ? ` • ${pendingCount}টি সিঙ্কের অপেক্ষায়` : ""}
          </span>
        </>
      ) : isSyncing ? (
        <>
          <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin" />
          <span>
            সিঙ্ক হচ্ছে...{pendingCount > 0 ? ` (${pendingCount}টি বাকি)` : ""}
          </span>
        </>
      ) : failedCount > 0 ? (
        <>
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>{failedCount}টি তথ্য সিঙ্ক হয়নি</span>
          <button
            type="button"
            onClick={() => retryFailed()}
            className="ml-1 rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-semibold hover:bg-white/30"
          >
            আবার চেষ্টা করুন
          </button>
        </>
      ) : (
        <>
          <CloudUpload className="h-3.5 w-3.5 shrink-0" />
          <span>{pendingCount}টি তথ্য সিঙ্কের অপেক্ষায়</span>
          <button
            type="button"
            onClick={() => syncNow()}
            className="ml-1 rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-semibold hover:bg-white/30"
          >
            এখনই সিঙ্ক করুন
          </button>
        </>
      )}
    </div>
  );
}
