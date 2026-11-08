"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Eye, EyeOff, KeyRound, User, Sparkles } from "lucide-react";

export default function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  async function handleDemoLogin() {
    setError(null);
    setDemoLoading(true);

    try {
      const res = await fetch("/api/auth/demo-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || "ডেমো অ্যাকাউন্টে প্রবেশ করতে সমস্যা হয়েছে।");
        setDemoLoading(false);
        return;
      }

      if (data.session) {
        try {
          const supabase = createClient();
          await supabase.auth.setSession({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
          });
        } catch (sessionErr) {
          console.warn("Client session sync warning:", sessionErr);
        }
      }

      window.location.href = data.redirectUrl || "/dashboard";
    } catch (err: any) {
      console.error("Demo login submission error:", err);
      setError(err?.message || "ডেমো অ্যাকাউন্টে প্রবেশ করতে সমস্যা হয়েছে।");
      setDemoLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const identifier = (formData.get("identifier") as string || "").trim();
    const password = (formData.get("password") as string || "").trim();

    if (!identifier || !password) {
      setError("শিক্ষার্থী আইডি / ইমেইল এবং পাসওয়ার্ড আবশ্যক");
      setLoading(false);
      return;
    }

    try {
      // 1. Server authentication & student ID resolver
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });

      const loginData = await res.json();

      if (!res.ok || loginData.error) {
        setError(loginData.error || "লগইন ব্যর্থ হয়েছে। তথ্য যাচাই করে আবার চেষ্টা করুন।");
        setLoading(false);
        return;
      }

      // 2. Sync client Supabase session for seamless client-side auth cookies
      if (loginData.session) {
        try {
          const supabase = createClient();
          await supabase.auth.setSession({
            access_token: loginData.session.access_token,
            refresh_token: loginData.session.refresh_token,
          });
        } catch (sessionErr) {
          console.warn("Client session sync warning:", sessionErr);
        }
      }

      // 3. Navigate directly to designated destination
      const targetUrl = loginData.redirectUrl || "/dashboard";
      window.location.href = targetUrl;
    } catch (err: any) {
      console.error("Login submission error:", err);
      setError(err?.message || "লগইন করতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-slate-900 dark:text-slate-100">
      {error && (
        <div className="p-3.5 text-sm font-medium text-rose-800 dark:text-rose-200 bg-rose-50 dark:bg-rose-950/60 rounded-xl border border-rose-300 dark:border-rose-800 leading-relaxed animate-in fade-in duration-200">
          {error}
        </div>
      )}

      {/* Guardian Quick Helper Notice */}
      <div className="notice-banner p-3.5 rounded-xl border text-xs leading-relaxed flex items-start gap-2.5">
        <Sparkles className="w-4 h-4 shrink-0 mt-0.5 text-emerald-700 dark:text-emerald-400" />
        <div className="text-emerald-950 dark:text-emerald-100">
          <span className="font-bold text-emerald-950 dark:text-white">শিক্ষার্থী ও অভিভাবক লগইন:</span> প্রাতিষ্ঠানিক পরিচিতি আইডি (Student ID) এবং মাদরাসা থেকে নির্ধারিত পাসওয়ার্ড ব্যবহার করে লগইন সম্পন্ন করুন।
        </div>
      </div>

      <div>
        <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1.5">
          শিক্ষার্থী আইডি অথবা ইমেইল
        </label>
        <div className="relative">
          <input
            name="identifier"
            type="text"
            required
            autoComplete="username"
            className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-sm font-medium transition-all"
            placeholder="শিক্ষার্থী আইডি অথবা ইমেইল ঠিকানা"
          />
          <User className="w-4 h-4 text-slate-500 dark:text-slate-400 absolute left-3 top-3 pointer-events-none" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-bold text-slate-800 dark:text-slate-200 mb-1.5">
          পাসওয়ার্ড
        </label>
        <div className="relative">
          <input
            name="password"
            type={showPassword ? "text" : "password"}
            required
            autoComplete="current-password"
            className="w-full pl-9 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-sm font-medium transition-all"
            placeholder="আপনার গোপন পাসওয়ার্ড দিন"
          />
          <KeyRound className="w-4 h-4 text-slate-500 dark:text-slate-400 absolute left-3 top-3 pointer-events-none" />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-2.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 focus:outline-none p-0.5 cursor-pointer"
            tabIndex={-1}
            title={showPassword ? "পাসওয়ার্ড লুকান" : "পাসওয়ার্ড দেখুন"}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading || demoLoading}
        className="w-full bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl transition duration-200 disabled:opacity-50 text-sm cursor-pointer shadow-md active:scale-[0.99] flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>যাচাই হচ্ছে...</span>
          </>
        ) : (
          "লগইন করুন"
        )}
      </button>

      {/* 1-Click Interactive Live Demo Profile Card */}
      <div className="pt-3 border-t border-slate-200 dark:border-slate-800 mt-2">
        <div className="demo-card-box p-3.5 rounded-2xl border text-xs space-y-2.5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold text-indigo-950 dark:text-indigo-300">
              <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span>সফটওয়্যারটির লাইভ ডেমো দেখতে চান?</span>
            </div>
            <span className="text-[10px] bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 px-2 py-0.5 rounded-full font-bold">
              ১-ক্লিক ডেমো
            </span>
          </div>

          <p className="text-[11px] leading-relaxed font-medium">
            <strong className="font-bold">মাদ্রাসাতুল মুসলিমিন</strong>-এর বাস্তবসম্মত শিক্ষার্থী, শিক্ষক, জামাত, আয়-ব্যয়, ক্যাশবুক, ইনভেন্টরি ও পরীক্ষার পূর্ণাঙ্গ ডাটাবেজসহ সরাসরি সিস্টেমটি ঘুরে দেখুন।
          </p>

          <button
            type="button"
            onClick={handleDemoLogin}
            disabled={demoLoading || loading}
            className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition active:scale-[0.99] cursor-pointer disabled:opacity-50"
          >
            {demoLoading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>ডেমো প্রোফাইল প্রস্তুত হচ্ছে...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>🚀 ডেমো প্রোফাইল এক্সপ্লোর করুন (Live Demo)</span>
              </>
            )}
          </button>

          <div className="flex items-center justify-between text-[11px] pt-2 border-t border-slate-200 dark:border-slate-700 font-mono font-medium">
            <span>ইউজার: <strong>demo@qawmierp.com</strong></span>
            <span>পাসওয়ার্ড: <strong>demo@qawmierp.com</strong></span>
          </div>
        </div>
      </div>
    </form>
  );
}

