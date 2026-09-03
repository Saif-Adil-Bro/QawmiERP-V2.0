"use client";

import { Printer } from "lucide-react";

interface PrintButtonProps {
  label?: string;
  className?: string;
}

export default function PrintButton({
  label = "প্রিন্ট করুন (Print)",
  className = "inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition cursor-pointer print:hidden",
}: PrintButtonProps) {
  return (
    <button
      onClick={() => window.print()}
      className={className}
      type="button"
      id="global-print-btn"
    >
      <Printer className="w-4 h-4" />
      <span>{label}</span>
    </button>
  );
}
