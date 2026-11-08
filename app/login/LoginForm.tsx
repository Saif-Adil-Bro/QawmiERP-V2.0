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
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3.5 text-sm text-rose-700 bg-rose-50 rounded-xl border border-rose-200 leading-relaxed animate-in fade-in duration-200">
          {error}
        </div>
      )}

      {/* Guardian Quick Helper Notice */}
      <div className="p-3 bg-emerald-50/80 rounded-xl border border-emerald-100/90 text-xs text-emerald-900 leading-relaxed flex items-start gap-2.5">
        <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-emerald-950">শিক্ষার্থী ও অভিভাবক লগইন:</span> প্রাতিষ্ঠানিক পরিচিতি আইডি (Student ID) এবং মাদরাসা থেকে নির্ধারিত পাসওয়ার্ড ব্যবহার করে লগইন সম্পন্ন করুন।
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          শিক্ষার্থী আইডি অথবা ইমেইল
        </label>
        <div className="relative">
          <input
            name="identifier"
            type="text"
            required
            autoComplete="username"
            className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-slate-800 text-sm transition-all"
            placeholder="শিক্ষার্থী আইডি অথবা ইমেইল ঠিকানা"
          />
          <User className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          পাসওয়ার্ড
        </label>
        <div className="relative">
          <input
            name="password"
            type={showPassword ? "text" : "password"}
            required
            autoComplete="current-password"
            className="w-full pl-9 pr-10 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-slate-800 text-sm transition-all"
            placeholder="আপনার গোপন পাসওয়ার্ড দিন"
          />
          <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 focus:outline-none p-0.5"
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
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 rounded-xl transition duration-200 disabled:opacity-50 text-sm cursor-pointer shadow-sm active:scale-[0.99] flex items-center justify-center gap-2"
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
      <div className="pt-3 border-t border-slate-100 mt-2">
        <div className="p-3.5 bg-gradient-to-br from-indigo-50/90 via-purple-50/60 to-emerald-50/70 rounded-2xl border border-indigo-100 text-xs space-y-2.5 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold text-indigo-950">
              <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>সফটওয়্যারটির লাইভ ডেমো দেখতে চান?</span>
            </div>
            <span className="text-[10px] bg-indigo-600/10 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
              ১-ক্লিক ডেমো
            </span>
          </div>

          <p className="text-[11px] text-slate-600 leading-relaxed">
            <strong>দারুল উলূম আল-ইসলামিয়া মডেল মাদরাসা</strong>-র বাস্তবসম্মত শিক্ষার্থী, শিক্ষক, জামাত, আয়-ব্যয়, ক্যাশবুক ও পরীক্ষার পূর্ণাঙ্গ ডাটাবেজসহ সরাসরি সিস্টেমটি ঘুরে দেখুন।
          </p>

          <button
            type="button"
            onClick={handleDemoLogin}
            disabled={demoLoading || loading}
            className="w-full py-2.5 px-4 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition active:scale-[0.99] cursor-pointer disabled:opacity-50"
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

          <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-indigo-100/60 font-mono">
            <span>ইউজার: demo@qawmierp.com</span>
            <span>পাসওয়ার্ড: demo@qawmierp.com</span>
          </div>
        </div>
      </div>
    </form>
  );
}

