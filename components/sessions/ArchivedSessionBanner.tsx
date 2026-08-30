"use client";

import { useSession } from "./SessionContext";
import { AlertTriangle, RotateCcw, ShieldAlert } from "lucide-react";

export default function ArchivedSessionBanner() {
  const { selectedSession, currentSession, changeSelectedSession, isArchived } = useSession();

  if (!isArchived || !selectedSession) return null;

  return (
    <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 text-white px-4 py-2.5 shadow-sm text-xs sm:text-sm flex flex-col sm:flex-row items-center justify-between gap-2 border-b border-amber-800/20 print:hidden animate-in slide-in-from-top-2">
      <div className="flex items-center gap-2">
        <ShieldAlert className="w-4 h-4 text-amber-100 shrink-0" />
        <div>
          <span className="font-bold">সতর্কতা: </span>
          <span>
            আপনি আর্কাইভকৃত শিক্ষাবর্ষে আছেন (<strong>{selectedSession.name}</strong> • {selectedSession.academic_year})। এর সকল তথ্য শুধুমাত্র দেখার জন্য সংরক্ষিত।
          </span>
        </div>
      </div>

      {currentSession && currentSession.id !== selectedSession.id && (
        <button
          type="button"
          onClick={() => changeSelectedSession(currentSession.id)}
          className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 hover:bg-white/30 text-white rounded-lg font-medium transition cursor-pointer shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>বর্তমান শিক্ষাবর্ষে ফিরুন ({currentSession.name})</span>
        </button>
      )}
    </div>
  );
}
