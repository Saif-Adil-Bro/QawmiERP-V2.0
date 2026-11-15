"use client";

import { useState, useEffect } from "react";
import { registerMadrasa, getSuggestedMadrasaPrefixAction, checkPrefixAvailabilityAction } from "./actions/tenant";
import { generateSuggestedPrefix } from "@/lib/madrasa-prefix";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Sparkles, ShieldCheck, CheckCircle2, AlertCircle, ArrowRight, ArrowLeft, BookOpen } from "lucide-react";

export default function RegisterForm() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [mobileStep, setMobileStep] = useState<1 | 2>(1);

  const [madrasaName, setMadrasaName] = useState("");
  const [prefix, setPrefix] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [isManualPrefix, setIsManualPrefix] = useState(false);
  const [prefixStatus, setPrefixStatus] = useState<{ available?: boolean; message?: string } | null>(null);

  useEffect(() => {
    try {
      const supabase = createClient();
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          window.location.href = "/dashboard";
        }
      });
    } catch (err) {
      console.warn("Client session check warning:", err);
    }
  }, []);

  const handleMadrasaNameChange = (val: string) => {
    setMadrasaName(val);
    if (!isManualPrefix) {
      const suggested = generateSuggestedPrefix(val);
      setPrefix(suggested);
      checkAvailability(suggested);
    }
  };

  const handlePrefixChange = (val: string) => {
    setIsManualPrefix(true);
    const cleaned = val.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
    setPrefix(cleaned);
    checkAvailability(cleaned);
  };

  const checkAvailability = async (code: string) => {
    if (code.length >= 2) {
      try {
        const res = await checkPrefixAvailabilityAction(code);
        setPrefixStatus(res);
      } catch {
        setPrefixStatus(null);
      }
    } else {
      setPrefixStatus(null);
    }
  };

  const handleAutoSuggestClick = async () => {
    if (!madrasaName) return;
    const res = await getSuggestedMadrasaPrefixAction(madrasaName);
    if (res?.prefix) {
      setPrefix(res.prefix);
      setIsManualPrefix(false);
      checkAvailability(res.prefix);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const formData = new FormData(e.currentTarget);
      formData.set("prefix", prefix);
      
      const timeoutPromise = new Promise<any>((_, reject) => 
        setTimeout(() => reject(new Error("Request timed out. Please verify your Supabase configuration.")), 8000)
      );

      const result = await Promise.race([
        registerMadrasa(formData),
        timeoutPromise
      ]);

      if (result.error) {
        setError(result.error);
      } else if (result.success) {
        setMessage(result.message!);
      }
    } catch (err: any) {
      setError(err?.message || "রেজিস্ট্রেশনের সময় সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।");
    } finally {
      setLoading(false);
    }
  };

  const handleNextStep = () => {
    setError("");
    if (!madrasaName.trim()) {
      setError("অনুগ্রহ করে মাদ্রাসার নাম লিখুন।");
      return;
    }
    if (!prefix.trim() || prefix.trim().length < 2) {
      setError("মাদ্রাসা প্রিফিক্স কোড কমপক্ষে ২ অক্ষরের হতে হবে।");
      return;
    }
    if (!contactEmail.trim() || !contactEmail.includes("@")) {
      setError("সঠিক মাদ্রাসা ইমেইল ঠিকানা দিন।");
      return;
    }
    setMobileStep(2);
  };

  return (
    <div className="h-dvh overflow-hidden sm:h-auto sm:min-h-screen sm:overflow-auto flex flex-col sm:items-center sm:justify-center bg-white sm:bg-slate-50 sm:py-10 sm:px-4">
      {/* Mobile Full-Screen Top Header */}
      <div className="sm:hidden bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 px-5 pt-5 pb-4 text-center shrink-0">
        <div className="inline-flex items-center justify-center w-11 h-11 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-2">
          <BookOpen className="w-5 h-5" />
        </div>
        <h1 className="text-lg font-extrabold text-white tracking-tight">QawmiERP সাইন আপ</h1>
        <p className="text-xs text-emerald-200/75 mt-0.5">
          {mobileStep === 1 ? "ধাপ ১/২: মাদ্রাসার তথ্য" : "ধাপ ২/২: অ্যাডমিন অ্যাকাউন্ট"}
        </p>
        <div className="flex gap-1.5 mt-3 max-w-[160px] mx-auto">
          <div className={`h-1 flex-1 rounded-full transition-colors ${mobileStep >= 1 ? "bg-emerald-400" : "bg-white/20"}`} />
          <div className={`h-1 flex-1 rounded-full transition-colors ${mobileStep === 2 ? "bg-emerald-400" : "bg-white/20"}`} />
        </div>
      </div>

      <div className="w-full flex-1 flex flex-col justify-between px-5 py-4 sm:flex-none sm:max-w-md sm:p-8 bg-white sm:rounded-2xl sm:shadow-lg sm:border sm:border-slate-100 overflow-hidden">
        <div className="hidden sm:block">
          <h1 className="text-2xl font-bold mb-1 text-center text-slate-800">QawmiERP Setup</h1>
          <p className="text-slate-500 mb-6 text-center text-sm">নতুন মাদ্রাসা রেজিস্ট্রেশন ও প্রিফিক্স সেটআপ</p>
        </div>

        <div className="flex-1 flex flex-col justify-center sm:block">
          {message && (
            <div className="mb-3 sm:mb-4 p-3 sm:p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs sm:text-sm flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <div>{message}</div>
            </div>
          )}
          {error && (
            <div className="mb-3 sm:mb-4 p-3 sm:p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs sm:text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
              <div>{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5 sm:space-y-4">
            {/* Step 1: Madrasa Info */}
            <div className={`space-y-3.5 sm:space-y-4 ${mobileStep === 1 ? "block" : "hidden sm:block"}`}>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  মাদ্রাসার নাম (Madrasa Name) <span className="text-red-500">*</span>
                </label>
                <input
                  name="madrasaName"
                  required
                  value={madrasaName}
                  onChange={(e) => handleMadrasaNameChange(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none transition"
                  placeholder="উদা: আলহাজ্ব আবুল হোসেন হাফিজিয়া মাদ্রাসা"
                />
              </div>

              {/* Madrasa Prefix Field */}
              <div className="bg-slate-50 p-3 sm:p-3.5 rounded-xl border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    মাদ্রাসা প্রিফিক্স কোড (Prefix)
                  </label>
                  <button
                    type="button"
                    onClick={handleAutoSuggestClick}
                    className="text-[11px] font-medium text-emerald-700 hover:text-emerald-800 flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-md transition"
                  >
                    <Sparkles className="w-3 h-3 text-emerald-600" />
                    সাজেস্ট করুন
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    name="prefix"
                    type="text"
                    required
                    maxLength={4}
                    value={prefix}
                    onChange={(e) => handlePrefixChange(e.target.value)}
                    className="w-28 p-2 border border-slate-300 rounded-lg text-sm font-mono font-bold uppercase tracking-wider text-center bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    placeholder="JMD"
                  />
                  <div className="text-xs text-slate-500">
                    আইডি ফরম্যাট: <span className="font-mono font-bold text-emerald-700 bg-emerald-100/60 px-1.5 py-0.5 rounded">{prefix || "JMD"}-480001</span>
                  </div>
                </div>

                {prefixStatus && (
                  <p className={`text-[11px] font-medium ${prefixStatus.available ? "text-emerald-600" : "text-amber-600"}`}>
                    {prefixStatus.message}
                  </p>
                )}
                <p className="hidden sm:block text-[11px] text-slate-500 leading-relaxed">
                  আপনার মাদ্রাসার প্রতিটি শিক্ষার্থীর স্বয়ংক্রিয় পরিচিতি কোড নির্ধারণের জন্য ২-৩ অক্ষরের স্বতন্ত্র প্রাতিষ্ঠানিক কোড।
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  মাদ্রাসা ইমেইল (Contact Email) <span className="text-red-500">*</span>
                </label>
                <input
                  name="contactEmail"
                  type="email"
                  required
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none transition"
                  placeholder="info@jamia.edu"
                />
              </div>

              <button
                type="button"
                onClick={handleNextStep}
                className="sm:hidden w-full bg-emerald-600 hover:bg-emerald-700 text-white p-3 rounded-xl font-semibold text-sm transition shadow-sm flex items-center justify-center gap-2"
              >
                <span>পরবর্তী ধাপ</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="hidden sm:block border-t border-slate-100 my-3"></div>

            {/* Step 2: Admin Account */}
            <div className={`space-y-3.5 sm:space-y-4 ${mobileStep === 2 ? "block" : "hidden sm:block"}`}>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  অ্যাডমিন নাম (Admin Name) <span className="text-red-500">*</span>
                </label>
                <input
                  name="adminName"
                  required
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none transition"
                  placeholder="উদা: আব্দুল্লাহ"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  অ্যাডমিন ইমেইল (Admin Email) <span className="text-red-500">*</span>
                </label>
                <input
                  name="adminEmail"
                  type="email"
                  required
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none transition"
                  placeholder="admin@jamia.edu"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  অ্যাডমিন পাসওয়ার্ড (Password) <span className="text-red-500">*</span>
                </label>
                <input
                  name="adminPassword"
                  type="password"
                  required
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none transition"
                  placeholder="••••••••"
                />
              </div>

              <div className="flex sm:hidden gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => { setError(""); setMobileStep(1); }}
                  className="px-4 py-3 rounded-xl border border-slate-200 text-slate-700 font-semibold text-sm flex items-center justify-center gap-1.5 hover:bg-slate-50 transition"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>পূর্ববর্তী</span>
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-slate-900 text-white p-3 rounded-xl hover:bg-slate-800 disabled:opacity-50 font-semibold text-sm transition shadow-sm"
                >
                  {loading ? "রেজিস্ট্রেশন হচ্ছে..." : "রেজিস্টার করুন"}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="hidden sm:block w-full bg-slate-900 text-white p-3 rounded-xl hover:bg-slate-800 disabled:opacity-50 font-semibold text-sm transition shadow-sm"
            >
              {loading ? "রেজিস্ট্রেশন হচ্ছে..." : "মাদ্রাসা রেজিস্টার করুন"}
            </button>
          </form>
        </div>

        <div className="pt-3 sm:mt-6 sm:pt-0 text-center text-xs sm:text-sm text-slate-500 shrink-0">
          <p>পূর্বেই অ্যাকাউন্ট আছে? <Link href="/login" className="text-emerald-700 font-bold hover:underline">লগইন করুন</Link></p>
        </div>
      </div>
    </div>
  );
}
