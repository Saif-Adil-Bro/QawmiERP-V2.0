"use client";

import React, { useState } from "react";
import {
  KeyRound,
  Smartphone,
  Mail,
  ShieldCheck,
  QrCode,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Copy,
} from "lucide-react";
import type { StepUpChannel, TenantMaskingPolicy, TenantStepUpPolicy } from "@/lib/step-up-auth";

interface MfaState {
  totp_enabled: boolean;
  sms_enabled: boolean;
  sms_phone: string | null;
  email_enabled: boolean;
  email_address: string | null;
  preferred_channel: StepUpChannel;
  last_verified_at: string | null;
  recovery_codes_remaining: number;
}

interface MfaSettingsViewProps {
  mfa: MfaState;
  stepUpPolicy: TenantStepUpPolicy;
  maskingPolicy: TenantMaskingPolicy;
  canManageTenantPolicy: boolean;
  onRefresh: () => void;
}

export default function MfaSettingsView({
  mfa,
  stepUpPolicy,
  maskingPolicy,
  canManageTenantPolicy,
  onRefresh,
}: MfaSettingsViewProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  const [smsEnabled, setSmsEnabled] = useState(mfa.sms_enabled);
  const [smsPhone, setSmsPhone] = useState(mfa.sms_phone || "");
  const [emailEnabled, setEmailEnabled] = useState(mfa.email_enabled);
  const [emailAddress, setEmailAddress] = useState(mfa.email_address || "");
  const [preferredChannel, setPreferredChannel] = useState<StepUpChannel>(mfa.preferred_channel || "totp");

  const [enforceCritical, setEnforceCritical] = useState(stepUpPolicy.enforceCritical);
  const [maskPiiDefault, setMaskPiiDefault] = useState(maskingPolicy.enforceMasking);
  const [maskExportsDefault, setMaskExportsDefault] = useState(maskingPolicy.watermarkExports);

  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const callMfaApi = async (payload: Record<string, any>) => {
    const res = await fetch("/api/auth/mfa/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return { ok: res.ok, data: await res.json() };
  };

  const handleBeginTotp = async () => {
    setBusy(true);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      const { ok, data } = await callMfaApi({ action: "begin_totp" });
      if (!ok || !data.success) {
        setErrorMsg(data.error || "TOTP সেটআপ শুরু করা যায়নি।");
      } else {
        setQrDataUrl(data.qrDataUrl);
        setTotpSecret(data.secret);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrorMsg(null);
    try {
      const { ok, data } = await callMfaApi({ action: "confirm_totp", code: totpCode.trim() });
      if (!ok || !data.success) {
        setErrorMsg(data.error || "TOTP কোড সঠিক নয়।");
      } else {
        setRecoveryCodes(data.recoveryCodes || []);
        setQrDataUrl(null);
        setTotpSecret(null);
        setTotpCode("");
        setStatusMsg("Authenticator App (TOTP) সফলভাবে সক্রিয় হয়েছে!");
        onRefresh();
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDisableTotp = async () => {
    setBusy(true);
    setErrorMsg(null);
    try {
      const { ok, data } = await callMfaApi({ action: "disable_totp" });
      if (!ok || !data.success) {
        setErrorMsg(data.error || "TOTP বন্ধ করা যায়নি।");
      } else {
        setStatusMsg("Authenticator App (TOTP) নিষ্ক্রিয় করা হয়েছে।");
        onRefresh();
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSavePreferences = async () => {
    setBusy(true);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      const { ok, data } = await callMfaApi({
        action: "update_preferences",
        smsEnabled,
        smsPhone,
        emailEnabled,
        emailAddress,
        preferredChannel,
      });
      if (!ok || !data.success) {
        setErrorMsg(data.error || "পছন্দসমূহ সংরক্ষণ করা যায়নি।");
      } else {
        setStatusMsg("আপনার ২-ধাপ যাচাইকরণ পছন্দসমূহ সংরক্ষিত হয়েছে।");
        onRefresh();
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSaveTenantPolicy = async () => {
    setBusy(true);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      const { ok, data } = await callMfaApi({
        action: "update_tenant_policy",
        stepUpPolicy: { enforceCritical },
        maskingPolicy: {
          enforceMasking: maskPiiDefault,
          watermarkExports: maskExportsDefault,
        },
      });
      if (!ok || !data.success) {
        setErrorMsg(data.error || "প্রতিষ্ঠানের নীতিমালা সংরক্ষণ করা যায়নি।");
      } else {
        setStatusMsg("প্রতিষ্ঠানের Step-Up ও PII মাস্কিং নীতিমালা আপডেট হয়েছে।");
        onRefresh();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {statusMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-sm text-rose-800 dark:text-rose-200">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* TOTP Section */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Authenticator App (RFC 6238 TOTP)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Google Authenticator, Authy বা Microsoft Authenticator দিয়ে ৬-অঙ্কের কোড জেনারেট করুন।
              </p>
            </div>
          </div>

          {mfa.totp_enabled ? (
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
                সক্রিয়
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={handleDisableTotp}
                className="px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-800 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40"
              >
                নিষ্ক্রিয় করুন
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={handleBeginTotp}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50"
            >
              <QrCode className="w-4 h-4" />
              Authenticator যুক্ত করুন
            </button>
          )}
        </div>

        {qrDataUrl && totpSecret && (
          <form
            onSubmit={handleConfirmTotp}
            className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-4 flex flex-col sm:flex-row items-center gap-5"
          >
            <img
              src={qrDataUrl}
              alt="TOTP QR Code"
              className="w-40 h-40 rounded-xl border border-slate-200 bg-white p-2"
            />
            <div className="flex-1 space-y-3 w-full">
              <p className="text-xs text-slate-600 dark:text-slate-300">
                ১. আপনার Authenticator অ্যাপ দিয়ে QR কোডটি স্ক্যান করুন অথবা নিচের ম্যানুয়াল কী ব্যবহার করুন:
              </p>
              <div className="flex items-center gap-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-2 font-mono text-xs break-all">
                <span className="flex-1">{totpSecret}</span>
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(totpSecret)}
                  className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  title="কপি করুন"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  placeholder="অ্যাপের ৬-অঙ্কের কোড দিন"
                  className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-mono"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700"
                >
                  {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  নিশ্চিত করুন
                </button>
              </div>
            </div>
          </form>
        )}

        {recoveryCodes && recoveryCodes.length > 0 && (
          <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4 space-y-2">
            <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
              জরুরি রিকভারি কোডসমূহ (নিরাপদ স্থানে সংরক্ষণ করুন — একবার ব্যবহারযোগ্য):
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs">
              {recoveryCodes.map((rc) => (
                <div
                  key={rc}
                  className="rounded-lg bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800 px-2.5 py-1.5 text-center"
                >
                  {rc}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* SMS & Email OTP Preferences */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
          SMS ও Email Step-Up OTP চ্যানেল
        </h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2 rounded-xl border border-slate-200 dark:border-slate-800 p-3.5">
            <label className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span className="inline-flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-emerald-600" />
                SMS OTP সক্রিয়
              </span>
              <input
                type="checkbox"
                checked={smsEnabled}
                onChange={(e) => setSmsEnabled(e.target.checked)}
                className="h-4 w-4 accent-emerald-600"
              />
            </label>
            <input
              type="text"
              value={smsPhone}
              onChange={(e) => setSmsPhone(e.target.value)}
              placeholder="017XXXXXXXX"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
            />
          </div>

          <div className="space-y-2 rounded-xl border border-slate-200 dark:border-slate-800 p-3.5">
            <label className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
              <span className="inline-flex items-center gap-1.5">
                <Mail className="w-4 h-4 text-emerald-600" />
                Email OTP সক্রিয়
              </span>
              <input
                type="checkbox"
                checked={emailEnabled}
                onChange={(e) => setEmailEnabled(e.target.checked)}
                className="h-4 w-4 accent-emerald-600"
              />
            </label>
            <input
              type="email"
              value={emailAddress}
              onChange={(e) => setEmailAddress(e.target.value)}
              placeholder="user@madrasa.edu.bd"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-slate-600 dark:text-slate-300">ডিফল্ট মাধ্যম:</span>
            <select
              value={preferredChannel}
              onChange={(e) => setPreferredChannel(e.target.value as StepUpChannel)}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs"
            >
              <option value="totp">Authenticator (TOTP)</option>
              <option value="sms">SMS OTP</option>
              <option value="email">Email OTP</option>
            </select>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={handleSavePreferences}
            className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-emerald-600 text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50"
          >
            পছন্দ সংরক্ষণ করুন
          </button>
        </div>
      </div>

      {/* Tenant Policy (Admin Only) */}
      {canManageTenantPolicy && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                প্রতিষ্ঠানের Step-Up 2FA ও তথ্য মাস্কিং নীতিমালা
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                সংবেদনশীল অপারেশন ও এক্সপোর্ট নিরাপত্তা নীতি নির্ধারণ করুন।
              </p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <label className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 p-3.5">
              <span className="font-medium text-slate-800 dark:text-slate-200">
                CRITICAL অপারেশনে (হিসাবকাল আনলক, বাল্ক ডিলিট, ফি স্ট্রাকচার পরিবর্তন) Step-Up 2FA বাধ্যতামূলক
              </span>
              <input
                type="checkbox"
                checked={enforceCritical}
                onChange={(e) => setEnforceCritical(e.target.checked)}
                className="h-4 w-4 accent-emerald-600"
              />
            </label>

            <label className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 p-3.5">
              <span className="font-medium text-slate-800 dark:text-slate-200">
                শিক্ষার্থী/ডোনার ফোন, NID ও ব্যাংক তথ্য ডিফল্টভাবে মাস্ক করা থাকবে (`data.unmask` ছাড়া)
              </span>
              <input
                type="checkbox"
                checked={maskPiiDefault}
                onChange={(e) => setMaskPiiDefault(e.target.checked)}
                className="h-4 w-4 accent-emerald-600"
              />
            </label>

            <label className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 p-3.5">
              <span className="font-medium text-slate-800 dark:text-slate-200">
                এক্সপোর্টকৃত CSV/XLSX ফাইলে অডিট ওয়াটারমার্ক ও ডিফল্ট PII মাস্কিং প্রয়োগ করুন
              </span>
              <input
                type="checkbox"
                checked={maskExportsDefault}
                onChange={(e) => setMaskExportsDefault(e.target.checked)}
                className="h-4 w-4 accent-emerald-600"
              />
            </label>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              disabled={busy}
              onClick={handleSaveTenantPolicy}
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50"
            >
              প্রতিষ্ঠানের নীতি সংরক্ষণ করুন
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
