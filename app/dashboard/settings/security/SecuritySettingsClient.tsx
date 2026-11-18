"use client";

import React, { useState } from "react";
import { ShieldCheck, Monitor, KeyRound, EyeOff, CheckCircle2, AlertTriangle } from "lucide-react";
import ActiveSessionsView from "@/components/security/ActiveSessionsView";
import MfaSettingsView from "@/components/security/MfaSettingsView";
import type { UserSessionRecord } from "@/lib/session-manager";
import type { StepUpChannel, TenantMaskingPolicy, TenantStepUpPolicy } from "@/lib/step-up-auth";

interface SecuritySettingsClientProps {
  initialSessions: UserSessionRecord[];
  initialCurrentSessionId: string | null;
  canManageAllSessions: boolean;
  canManageTenantPolicy: boolean;
  initialMfa: {
    totp_enabled: boolean;
    sms_enabled: boolean;
    sms_phone: string | null;
    email_enabled: boolean;
    email_address: string | null;
    preferred_channel: StepUpChannel;
    last_verified_at: string | null;
    recovery_codes_remaining: number;
  };
  initialStepUpPolicy: TenantStepUpPolicy;
  initialMaskingPolicy: TenantMaskingPolicy;
}

export default function SecuritySettingsClient({
  initialSessions,
  initialCurrentSessionId,
  canManageAllSessions,
  canManageTenantPolicy,
  initialMfa,
  initialStepUpPolicy,
  initialMaskingPolicy,
}: SecuritySettingsClientProps) {
  const [activeTab, setActiveTab] = useState<"sessions" | "mfa">("sessions");
  const [scope, setScope] = useState<"self" | "madrasa">("self");
  const [sessions, setSessions] = useState<UserSessionRecord[]>(initialSessions);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(initialCurrentSessionId);
  const [mfa, setMfa] = useState(initialMfa);
  const [stepUpPolicy, setStepUpPolicy] = useState(initialStepUpPolicy);
  const [maskingPolicy, setMaskingPolicy] = useState(initialMaskingPolicy);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const refreshSessions = async (nextScope: "self" | "madrasa" = scope) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/auth/sessions?scope=${nextScope}`);
      const data = await res.json();
      if (res.ok && Array.isArray(data.sessions)) {
        setSessions(data.sessions);
        setCurrentSessionId(data.currentSessionId || null);
      }
    } finally {
      setLoading(false);
    }
  };

  const refreshMfa = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/mfa/setup");
      const data = await res.json();
      if (res.ok && data.mfa) {
        setMfa(data.mfa);
        if (data.stepUpPolicy) setStepUpPolicy(data.stepUpPolicy);
        if (data.maskingPolicy) setMaskingPolicy(data.maskingPolicy);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleScopeChange = (next: "self" | "madrasa") => {
    setScope(next);
    refreshSessions(next);
  };

  const handleTerminateSingle = async (sessionId: string) => {
    setToast(null);
    const res = await fetch("/api/auth/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "terminate_single", sessionId }),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      setToast({ type: "ok", text: "সেশন সফলভাবে বাতিল করা হয়েছে।" });
      await refreshSessions();
    } else {
      setToast({ type: "err", text: data.error || "সেশন বাতিল করা যায়নি।" });
    }
  };

  const handleTerminateOthers = async () => {
    setToast(null);
    const res = await fetch("/api/auth/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "terminate_others", currentSessionId }),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      setToast({ type: "ok", text: "অন্যান্য সকল সক্রিয় ডিভাইস লগআউট করা হয়েছে।" });
      await refreshSessions();
    } else {
      setToast({ type: "err", text: data.error || "অন্যান্য সেশন বাতিল করা যায়নি।" });
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="p-3 rounded-2xl bg-emerald-600 text-white shadow-sm">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              সেশন নিয়ন্ত্রণ, ২-ধাপ যাচাইকরণ (2FA) ও তথ্য সুরক্ষা
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              সক্রিয় ডিভাইস সেশন পর্যবেক্ষণ, Step-Up 2FA এবং সংবেদনশীল তথ্য মাস্কিং ও এক্সপোর্ট নীতি পরিচালনা করুন।
            </p>
          </div>
        </div>
      </div>

      {toast && (
        <div
          className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${
            toast.type === "ok"
              ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200"
              : "border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200"
          }`}
        >
          {toast.type === "ok" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span>{toast.text}</span>
        </div>
      )}

      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("sessions")}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition ${
            activeTab === "sessions"
              ? "bg-emerald-600 text-white"
              : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Monitor className="w-4 h-4" />
          সক্রিয় সেশনসমূহ
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("mfa")}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition ${
            activeTab === "mfa"
              ? "bg-emerald-600 text-white"
              : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <KeyRound className="w-4 h-4" />
          ২-ধাপ যাচাই (2FA) ও মাস্কিং নীতি
        </button>
      </div>

      {activeTab === "sessions" ? (
        <ActiveSessionsView
          sessions={sessions}
          currentSessionId={currentSessionId}
          canManageAll={canManageAllSessions}
          scope={scope}
          onScopeChange={handleScopeChange}
          onRefresh={() => refreshSessions()}
          onTerminateSingle={handleTerminateSingle}
          onTerminateOthers={handleTerminateOthers}
          loading={loading}
        />
      ) : (
        <MfaSettingsView
          mfa={mfa}
          stepUpPolicy={stepUpPolicy}
          maskingPolicy={maskingPolicy}
          canManageTenantPolicy={canManageTenantPolicy}
          onRefresh={refreshMfa}
        />
      )}

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 p-4 flex items-start gap-3 text-xs text-slate-600 dark:text-slate-400">
        <EyeOff className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
        <p>
          নিরাপত্তা নোট: সকল এক্সপোর্টকৃত CSV/XLSX/Print রিপোর্টে এক্সপোর্টকারীর নাম, ভূমিকা, Asia/Dhaka সময় এবং IP ঠিকানাসহ অডিট ওয়াটারমার্ক যুক্ত হয় এবং `system_audit_logs`-এ `SENSITIVE_DATA_EXPORTED` ইভেন্ট বাধ্যতামূলকভাবে সংরক্ষিত হয়।
        </p>
      </div>
    </div>
  );
}
