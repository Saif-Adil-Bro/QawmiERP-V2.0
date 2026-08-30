"use client";

import { Loader2 } from "lucide-react";

export default function RootLoading() {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-4 p-8 text-center">
      <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shadow-xs">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
      <div>
        <p className="text-sm font-bold text-slate-800">লোড হচ্ছে, অনুগ্রহ করে অপেক্ষা করুন...</p>
        <p className="text-xs text-slate-400 mt-0.5">তথ্য লোড হচ্ছে</p>
      </div>
    </div>
  );
}
