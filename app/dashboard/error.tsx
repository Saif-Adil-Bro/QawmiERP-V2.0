"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw, RotateCcw } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [isStaleAction, setIsStaleAction] = useState(false);

  useEffect(() => {
    console.error("Dashboard Error Boundary:", error);
    const msg = error?.message || "";
    if (
      msg.includes("Failed to find Server Action") ||
      msg.includes("older or newer deployment") ||
      error?.digest?.includes("NEXT_NOT_FOUND")
    ) {
      setIsStaleAction(true);
      // Automatically reload page after brief delay if server action was invalidated by a deployment/update
      const timer = setTimeout(() => {
        if (typeof window !== "undefined") {
          window.location.reload();
        }
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleHardReload = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center space-y-4">
      <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center shadow-xs">
        <AlertTriangle className="w-7 h-7" />
      </div>
      <div className="max-w-md space-y-1">
        <h2 className="text-lg font-bold text-slate-800">
          {isStaleAction ? "নতুন আপডেট যুক্ত হয়েছে" : "পেজটি লোড হতে সমস্যা হয়েছে"}
        </h2>
        <p className="text-xs text-slate-500">
          {isStaleAction
            ? "অ্যাপ্লিকেশনে নতুন কোড আপডেট হয়েছে। পৃষ্ঠাটি স্বয়ংক্রিয়ভাবে রিফ্রেশ হচ্ছে..."
            : "নেটওয়ার্ক বা ডেটা ফেচিংয়ে সাময়িক বিলম্ব হতে পারে। পুনরায় চেষ্টা করুন।"}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={handleHardReload}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>পেজ রিফ্রেশ করুন</span>
        </button>
        {!isStaleAction && (
          <button
            onClick={() => reset()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>আবার চেষ্টা করুন</span>
          </button>
        )}
      </div>
    </div>
  );
}
