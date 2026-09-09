"use client";

import { useState } from "react";
import { KeyRound, Eye, EyeOff, ShieldCheck, X, AlertCircle, CheckCircle2, Lock } from "lucide-react";
import { changeGuardianPassword } from "@/app/actions/auth";
import { toBanglaNumber } from "@/lib/numberToBangla";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  userData: any;
}

export default function ChangePasswordModal({ isOpen, onClose, user, userData }: Props) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const studentIdCode =
    user?.user_metadata?.student_id_code ||
    user?.email?.match(/student_([0-9a-zA-Z_-]+)@/)?.[1] ||
    "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!currentPassword) {
      setError("বর্তমান পাসওয়ার্ড প্রদান করুন (ডিফল্ট পাসওয়ার্ড: 123456)");
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setError("নতুন পাসওয়ার্ড অন্তত ৬ অক্ষরের হতে হবে।");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("নতুন পাসওয়ার্ড ও কনফার্মেশন পাসওয়ার্ড মিলছে না।");
      return;
    }

    if (newPassword === "123456") {
      setError("ডিফল্ট পাসওয়ার্ড (123456) ছাড়া অন্য কোনো নতুন পাসওয়ার্ড সেট করুন।");
      return;
    }

    setLoading(true);
    try {
      const res = await changeGuardianPassword(currentPassword, newPassword, confirmPassword);
      if (!res.success) {
        setError(res.error || "পাসওয়ার্ড পরিবর্তনে ব্যর্থ হয়েছে।");
      } else {
        setSuccess(res.message || "পাসওয়ার্ড সফলভাবে পরিবর্তিত হয়েছে!");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setTimeout(() => {
          onClose();
          setSuccess(null);
        }, 2500);
      }
    } catch (err: any) {
      setError(err?.message || "পাসওয়ার্ড পরিবর্তন করার সময় একটি সমস্যা হয়েছে।");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-xs flex items-center justify-center shadow-inner">
              <KeyRound className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">পাসওয়ার্ড পরিবর্তন করুন</h3>
              <p className="text-xs text-emerald-100">অভিভাবক পোর্টাল নিরাপত্তা</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Account Summary Banner */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-xs text-slate-600 space-y-1">
            {studentIdCode && (
              <div className="flex justify-between items-center">
                <span className="text-slate-500">শিক্ষার্থী লগইন আইডি:</span>
                <span className="font-mono font-bold bg-white px-2 py-0.5 rounded border border-slate-300 text-slate-800">
                  {studentIdCode} ({toBanglaNumber(studentIdCode)})
                </span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-slate-500">অভিভাবকের নাম:</span>
              <span className="font-medium text-slate-800 truncate max-w-[200px]">
                {userData?.full_name || user?.user_metadata?.full_name || "অভিভাবক"}
              </span>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-start gap-2 leading-relaxed">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-start gap-2 leading-relaxed">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              <span>{success}</span>
            </div>
          )}

          {/* Current Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              বর্তমান পাসওয়ার্ড <span className="text-slate-400 font-normal">(প্রথমবার হলে 123456)</span>
            </label>
            <div className="relative">
              <input
                type={showCurrent ? "text" : "password"}
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="যেমন: 123456"
                className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-900"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                tabIndex={-1}
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              নতুন গোপন পাসওয়ার্ড <span className="text-slate-400 font-normal">(কমপক্ষে ৬ অক্ষর)</span>
            </label>
            <div className="relative">
              <input
                type={showNew ? "text" : "password"}
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="একটি শক্তিশালী নতুন পাসওয়ার্ড লিখুন"
                className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-900"
              />
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                tabIndex={-1}
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              নতুন পাসওয়ার্ড নিশ্চিত করুন
            </label>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="নতুন পাসওয়ার্ডটি পুনরায় লিখুন"
                className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white text-slate-900"
              />
              <ShieldCheck className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                tabIndex={-1}
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
            >
              বাতিল
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs hover:shadow-md transition active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>সংরক্ষণ হচ্ছে...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>পাসওয়ার্ড আপডেট করুন</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
