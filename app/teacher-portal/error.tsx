"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

export default function TeacherPortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Teacher Portal Error caught in boundary:", error);
  }, [error]);

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4 shadow-xs border border-amber-200">
        <AlertCircle className="w-7 h-7" />
      </div>
      <h2 className="text-xl font-bold text-slate-900 mb-2">পৃষ্ঠা লোড করতে সাময়িক সমস্যা হয়েছে</h2>
      <p className="text-sm text-slate-500 max-w-md mb-6 leading-relaxed">
        ক্লাস বা ড্যাশবোর্ড ডেটা লোড করার সময় একটি ত্রুটি ঘটেছে। পুনরায় চেষ্টা বাটনে ক্লিক করুন।
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold shadow-xs transition"
      >
        <RefreshCw className="w-4 h-4" />
        <span>পুনরায় লোড করুন</span>
      </button>
    </div>
  );
}
