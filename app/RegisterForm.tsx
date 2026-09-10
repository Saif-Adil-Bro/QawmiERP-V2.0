"use client";

import { useState } from "react";
import { registerMadrasa, getSuggestedMadrasaPrefixAction, checkPrefixAvailabilityAction } from "./actions/tenant";
import { generateSuggestedPrefix } from "@/lib/madrasa-prefix";
import Link from "next/link";
import { Sparkles, ShieldCheck, CheckCircle2, AlertCircle } from "lucide-react";

export default function RegisterForm() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [madrasaName, setMadrasaName] = useState("");
  const [prefix, setPrefix] = useState("");
  const [isManualPrefix, setIsManualPrefix] = useState(false);
  const [prefixStatus, setPrefixStatus] = useState<{ available?: boolean; message?: string } | null>(null);

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

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 py-10 px-4">
      <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-lg border border-slate-100">
        <h1 className="text-2xl font-bold mb-1 text-center text-slate-800">QawmiERP Setup</h1>
        <p className="text-slate-500 mb-6 text-center text-sm">নতুন মাদ্রাসা রেজিস্ট্রেশন ও প্রিফিক্স সেটআপ</p>
        
        {message && (
          <div className="mb-4 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
            <div>{message}</div>
          </div>
        )}
        {error && (
          <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-sm flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
            <div>{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
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
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-2">
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
                placeholder="AHH"
              />
              <div className="text-xs text-slate-500">
                আইডি দেখতে হবে: <span className="font-mono font-bold text-emerald-700 bg-emerald-100/60 px-1.5 py-0.5 rounded">{prefix || "AHH"}480001</span>
              </div>
            </div>

            {prefixStatus && (
              <p className={`text-[11px] font-medium ${prefixStatus.available ? "text-emerald-600" : "text-amber-600"}`}>
                {prefixStatus.message}
              </p>
            )}
            <p className="text-[11px] text-slate-400">
              ৩ অক্ষরের ইউনিক কোড যা ছাত্র আইডি ও লগইনে সরাসরি প্রিফিক্স হিসেবে থাকবে (যেমন: {prefix || "AHH"}480001)।
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
              className="w-full p-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none transition" 
              placeholder="info@jamia.edu" 
            />
          </div>

          <div className="border-t border-slate-100 my-3"></div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              অ্যাডমিন নাম (Admin Name) <span className="text-red-500">*</span>
            </label>
            <input 
              name="adminName" 
              required 
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
              className="w-full p-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none transition" 
              placeholder="••••••••" 
            />
          </div>
          
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-slate-900 text-white p-3 rounded-xl hover:bg-slate-800 disabled:opacity-50 font-semibold text-sm transition shadow-sm"
          >
            {loading ? "রেজিস্ট্রেশন হচ্ছে..." : "মাদ্রাসা রেজিস্টার করুন"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-500">
          <p>পূর্বেই অ্যাকাউন্ট আছে? <Link href="/login" className="text-emerald-700 font-bold hover:underline">লগইন করুন</Link></p>
        </div>
      </div>
    </div>
  );
}
