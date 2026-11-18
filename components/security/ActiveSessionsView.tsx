"use client";

import React, { useState } from "react";
import {
  Monitor,
  Smartphone,
  Tablet,
  Globe,
  LogOut,
  Trash2,
  RefreshCw,
  ShieldAlert,
  CheckCircle2,
  Clock,
} from "lucide-react";
import type { UserSessionRecord } from "@/lib/session-manager";
import { toBanglaNumber } from "@/lib/numberToBangla";
import { formatDhakaTimestamp } from "@/lib/export-watermark";

interface ActiveSessionsViewProps {
  sessions: UserSessionRecord[];
  currentSessionId: string | null;
  canManageAll: boolean;
  scope: "self" | "madrasa";
  onScopeChange: (scope: "self" | "madrasa") => void;
  onRefresh: () => void;
  onTerminateSingle: (sessionId: string) => Promise<void>;
  onTerminateOthers: () => Promise<void>;
  loading?: boolean;
}

export default function ActiveSessionsView({
  sessions,
  currentSessionId,
  canManageAll,
  scope,
  onScopeChange,
  onRefresh,
  onTerminateSingle,
  onTerminateOthers,
  loading = false,
}: ActiveSessionsViewProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [terminatingOthers, setTerminatingOthers] = useState(false);

  const getDeviceIcon = (type: string) => {
    if (type === "mobile") return Smartphone;
    if (type === "tablet") return Tablet;
    return Monitor;
  };

  const handleSingle = async (id: string) => {
    setBusyId(id);
    try {
      await onTerminateSingle(id);
    } finally {
      setBusyId(null);
    }
  };

  const handleOthers = async () => {
    setTerminatingOthers(true);
    try {
      await onTerminateOthers();
    } finally {
      setTerminatingOthers(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {canManageAll && (
            <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-800/70 p-1">
              <button
                type="button"
                onClick={() => onScopeChange("self")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  scope === "self"
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs"
                    : "text-slate-600 dark:text-slate-400"
                }`}
              >
                আমার সেশনসমূহ
              </button>
              <button
                type="button"
                onClick={() => onScopeChange("madrasa")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  scope === "madrasa"
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs"
                    : "text-slate-600 dark:text-slate-400"
                }`}
              >
                সকল ইউজার ({toBanglaNumber(sessions.length)})
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            রিফ্রেশ
          </button>

          {sessions.length > 1 && (
            <button
              type="button"
              onClick={handleOthers}
              disabled={terminatingOthers}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 disabled:opacity-50"
            >
              <LogOut className="w-3.5 h-3.5" />
              অন্য সব ডিভাইস লগআউট করুন
            </button>
          )}
        </div>
      </div>

      {sessions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-sm text-slate-500 dark:text-slate-400">
          কোনো সক্রিয় সেশন রেকর্ড পাওয়া যায়নি।
        </div>
      ) : (
        <div className="grid gap-3">
          {sessions.map((s) => {
            const Icon = getDeviceIcon(s.device_type);
            const isCurrent = Boolean(currentSessionId && s.id === currentSessionId);

            return (
              <div
                key={s.id}
                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border p-4 transition ${
                  isCurrent
                    ? "border-emerald-300 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20"
                    : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div
                    className={`p-2.5 rounded-xl shrink-0 ${
                      isCurrent
                        ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                        {s.device_name || `${s.browser} (${s.os})`}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        {s.channel === "mobile" ? "মোবাইল অ্যাপ" : "ওয়েব ব্রাউজার"}
                      </span>
                      {isCurrent && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
                          <CheckCircle2 className="w-3 h-3" />
                          বর্তমান সেশন
                        </span>
                      )}
                    </div>

                    {scope === "madrasa" && (s.user_name || s.user_email) && (
                      <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300">
                        ইউজার: {s.user_name || s.user_email} {s.user_role ? `(${s.user_role})` : ""}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <Globe className="w-3.5 h-3.5" />
                        IP: {s.ip_address || "অজানা"}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        সর্বশেষ সক্রিয়: {formatDhakaTimestamp(s.last_active_at || s.created_at)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2">
                  {!isCurrent ? (
                    <button
                      type="button"
                      disabled={busyId === s.id}
                      onClick={() => handleSingle(s.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-xs font-semibold hover:bg-rose-100 dark:hover:bg-rose-900/40 disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {busyId === s.id ? "বাতিল হচ্ছে..." : "সেশন বাতিল করুন"}
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      সক্রিয় ডিভাইস
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
