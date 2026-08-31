"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw, RotateCcw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [isStaleAction, setIsStaleAction] = useState(false);

  useEffect(() => {
    console.error("Global Root Error Boundary:", error);
    const msg = error?.message || "";
    if (
      msg.includes("Failed to find Server Action") ||
      msg.includes("older or newer deployment") ||
      error?.digest?.includes("NEXT_NOT_FOUND")
    ) {
      setIsStaleAction(true);
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
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center space-y-4 font-sans">
      <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center shadow-xs">
        <AlertTriangle className="w-8 h-8" />
      </div>
      <div className="max-w-md space-y-1.5">
        <h2 className="text-xl font-bold text-slate-800">
          {isStaleAction ? "নতুন আপডেট সফলভাবে যুক্ত হয়েছে" : "অ্যাপ্লিকেশনে ত্রুটি হয়েছে"}
        </h2>
        <p className="text-sm text-slate-500">
          {isStaleAction
            ? "অ্যাপ্লিকেশনে নতুন কোড আপডেট হয়েছে। সর্বশেষ সংস্করণের জন্য পৃষ্ঠাটি স্বয়ংক্রিয়ভাবে রিলোড হচ্ছে..."
            : "কিছু একটা সমস্যা হয়েছে। অনুগ্রহ করে পৃষ্ঠাটি রিফ্রেশ করে আবার চেষ্টা করুন।"}
        </p>
      </div>
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleHardReload}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-xs transition cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          <span>পেজ রিফ্রেশ করুন</span>
        </button>
        {!isStaleAction && (
          <button
            onClick={() => reset()}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl text-sm font-semibold transition cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>আবার চেষ্টা করুন</span>
          </button>
        )}
      </div>
    </div>
  );
}
