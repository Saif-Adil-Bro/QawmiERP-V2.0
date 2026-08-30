"use client";

import { Loader2 } from "lucide-react";

export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse p-2">
      {/* Top Header Skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-48 bg-slate-200 rounded-lg"></div>
          <div className="h-4 w-72 bg-slate-100 rounded-md"></div>
        </div>
        <div className="h-9 w-32 bg-slate-200 rounded-xl"></div>
      </div>

      {/* Metrics Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-4 w-20 bg-slate-100 rounded"></div>
              <div className="w-8 h-8 rounded-xl bg-slate-100"></div>
            </div>
            <div className="h-8 w-28 bg-slate-200 rounded-lg"></div>
            <div className="h-3 w-36 bg-slate-100 rounded"></div>
          </div>
        ))}
      </div>

      {/* Main Table / Content Skeleton */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="h-5 w-36 bg-slate-200 rounded"></div>
          <div className="h-8 w-24 bg-slate-100 rounded-lg"></div>
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-slate-100"></div>
                <div className="space-y-1">
                  <div className="h-4 w-32 bg-slate-200 rounded"></div>
                  <div className="h-3 w-20 bg-slate-100 rounded"></div>
                </div>
              </div>
              <div className="h-4 w-16 bg-slate-100 rounded"></div>
              <div className="h-6 w-20 bg-slate-100 rounded-full"></div>
            </div>
          ))}
        </div>
      </div>

      {/* Floating gentle loading indicator */}
      <div className="fixed bottom-6 right-6 flex items-center gap-2.5 bg-slate-900/90 text-white text-xs px-4 py-2 rounded-full shadow-lg backdrop-blur-xs">
        <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
        <span>লোড হচ্ছে...</span>
      </div>
    </div>
  );
}
