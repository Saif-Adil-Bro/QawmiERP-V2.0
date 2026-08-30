"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard Error Boundary:", error);
  }, [error]);

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center space-y-4">
      <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center shadow-xs">
        <AlertTriangle className="w-7 h-7" />
      </div>
      <div className="max-w-md space-y-1">
        <h2 className="text-lg font-bold text-slate-800">পেজটি লোড হতে সমস্যা হয়েছে</h2>
        <p className="text-xs text-slate-500">
          নেটওয়ার্ক বা ডেটা ফেচিংয়ে সাময়িক বিলম্ব হতে পারে। পুনরায় চেষ্টা করুন।
        </p>
      </div>
      <button
        onClick={() => reset()}
        className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        <span>পুনরায় লোড করুন</span>
      </button>
    </div>
  );
}
