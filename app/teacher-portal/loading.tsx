"use client";

import { Loader2 } from "lucide-react";

export default function TeacherPortalLoading() {
  return (
    <div className="space-y-6 animate-pulse p-2">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-6 w-44 bg-slate-200 rounded-lg"></div>
          <div className="h-3 w-60 bg-slate-100 rounded"></div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs space-y-3">
            <div className="h-4 w-24 bg-slate-100 rounded"></div>
            <div className="h-7 w-20 bg-slate-200 rounded-lg"></div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-6 space-y-4">
        <div className="h-5 w-32 bg-slate-200 rounded"></div>
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 bg-slate-50 rounded-xl border border-slate-100"></div>
          ))}
        </div>
      </div>
    </div>
  );
}
