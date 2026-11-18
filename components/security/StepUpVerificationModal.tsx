"use client";

import React, { useState } from "react";
import { ShieldCheck, Smartphone, Mail, KeyRound, Loader2, X, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { StepUpChannel } from "@/lib/step-up-auth";

interface StepUpVerificationModalProps {
  open: boolean;
  onClose: () => void;
  onVerified: (token: string) => void;
  actionScope?: string;
  actionLabel?: string;
  defaultChannel?: StepUpChannel;
}

export default function StepUpVerificationModal({
  open,
  onClose,
  onVerified,
  actionScope = "CRITICAL",
  actionLabel = "সংবেদনশীল অপারেশন",
  defaultChannel = "totp",
}: StepUpVerificationModalProps) {
  const [channel, setChannel] = useState<StepUpChannel>(defaultChannel);
  const [code, setCode] = useState("");
  const [challengeId, setChallengeId] = useState<string | undefined>(undefined);
  const [challengeSent, setChallengeSent] = useState(defaultChannel === "totp");
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  if (!open) return null;

  const handleChannelChange = (next: StepUpChannel) => {
    setChannel(next);
    setCode("");
    setError(null);
    setInfoMessage(null);
    setChallengeId(undefined);
    setChallengeSent(next === "totp");
  };

  const handleSendChallenge = async () => {
    setSending(true);
    setError(null);
    setInfoMessage(null);
    try {
      const res = await fetch("/api/auth/step-up/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, actionScope }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "যাচাইকরণ কোড পাঠানো যায়নি।");
      } else {
        setChallengeId(data.challengeId);
        setChallengeSent(true);
        setInfoMessage(data.message || "৬-অঙ্কের কোড পাঠানো হয়েছে।");
      }
    } catch {
      setError("সার্ভারের সাথে সংযোগ ব্যর্থ হয়েছে।");
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError("৬-অঙ্কের যাচাইকরণ কোড দিন।");
      return;
    }
    setVerifying(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/step-up/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          code: code.trim(),
          challengeId,
          actionScope,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success || !data.token) {
        setError(data.error || "যাচাইকরণ কোড সঠিক নয়।");
      } else {
        onVerified(data.token);
      }
    } catch {
      setError("যাচাইকরণ সম্পন্ন করা যায়নি।");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-emerald-50/70 dark:bg-emerald-950/30">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-600 text-white">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                ২-ধাপ নিরাপত্তা যাচাই (Step-Up 2FA)
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">{actionLabel}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200/70 dark:hover:bg-slate-800"
            aria-label="বন্ধ করুন"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleVerify} className="p-5 space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: "totp" as StepUpChannel, label: "Authenticator", icon: KeyRound },
              { id: "sms" as StepUpChannel, label: "SMS OTP", icon: Smartphone },
              { id: "email" as StepUpChannel, label: "Email OTP", icon: Mail },
            ].map((item) => {
              const Icon = item.icon;
              const active = channel === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleChannelChange(item.id)}
                  className={`flex flex-col items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl border text-xs font-semibold transition ${
                    active
                      ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                      : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {channel !== "totp" && (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 px-3.5 py-2.5">
              <span className="text-xs text-slate-600 dark:text-slate-300">
                {channel === "sms" ? "নিবন্ধিত মোবাইলে OTP পাঠান" : "নিবন্ধিত ইমেইলে OTP পাঠান"}
              </span>
              <button
                type="button"
                disabled={sending}
                onClick={handleSendChallenge}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-emerald-600 text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50"
              >
                {sending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {challengeSent ? "পুনরায় পাঠান" : "কোড পাঠান"}
              </button>
            </div>
          )}

          {infoMessage && (
            <div className="flex items-start gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-200">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{infoMessage}</span>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 px-3 py-2 text-xs text-rose-800 dark:text-rose-200">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              ৬-অঙ্কের যাচাইকরণ কোড (অথবা Recovery Code)
            </label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="যেমন: 123456"
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-center text-lg font-mono tracking-widest text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              বাতিল
            </button>
            <button
              type="submit"
              disabled={verifying || (!challengeSent && channel !== "totp")}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50"
            >
              {verifying && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              যাচাই করে এগিয়ে যান
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
