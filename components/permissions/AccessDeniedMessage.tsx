"use client";

import React from "react";
import { ShieldAlert, ArrowLeft, Lock, HelpCircle } from "lucide-react";
import Link from "next/link";
import { PERMISSION_MAP } from "@/lib/permissions";

interface AccessDeniedProps {
  requiredPermission?: string;
  customTitle?: string;
  customMessage?: string;
  showBackHome?: boolean;
}

export default function AccessDeniedMessage({
  requiredPermission,
  customTitle,
  customMessage,
  showBackHome = true,
}: AccessDeniedProps) {
  const permDef = requiredPermission ? PERMISSION_MAP[requiredPermission] : null;

  return (
    <div className="min-h-[380px] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 sm:p-8 text-center">
        <div className="w-16 h-16 bg-rose-50 border border-rose-100 rounded-2xl flex items-center justify-center mx-auto mb-5 text-rose-600 shadow-inner">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-2">
          {customTitle || "অ্যাক্সেস অনুমোদিত নয়"}
        </h3>

        <p className="text-sm text-slate-600 leading-relaxed mb-5">
          {customMessage || "আপনার এই অংশে প্রবেশ বা এই কাজটি সম্পন্ন করার পর্যাপ্ত অধিকার (Permission) নেই।"}
        </p>

        {permDef && (
          <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-3.5 mb-6 text-left">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              প্রয়োজনীয় অনুমতি (Required Permission):
            </div>
            <div className="text-sm font-semibold text-slate-800">
              {permDef.title}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              মডিউল: <span className="font-medium text-slate-700">{permDef.module}</span> | কী: <code className="font-mono text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded text-[11px]">{permDef.id}</code>
            </div>
          </div>
        )}

        <div className="bg-amber-50/80 border border-amber-200/60 rounded-xl p-3 text-left mb-6 flex items-start gap-2.5 text-xs text-amber-900 leading-relaxed">
          <HelpCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>
            প্রয়োজনে এই অধিকার বরাদ্দের জন্য আপনার মাদ্রাসার <strong>মুহতামিম</strong> বা <strong>সুপার অ্যাডমিনের</strong> সাথে যোগাযোগ করুন।
          </span>
        </div>

        {showBackHome && (
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5">
            <Link
              href="/dashboard"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-medium transition cursor-pointer shadow-xs"
            >
              <ArrowLeft className="w-4 h-4" />
              ড্যাশবোর্ডে ফিরে যান
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
