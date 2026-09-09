"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Eye, EyeOff, KeyRound, User, Sparkles } from "lucide-react";

export default function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

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
          <span className="font-semibold text-emerald-950">অভিভাবক লগইন:</span> শিক্ষার্থীর আইডি (যেমন: <span className="font-mono font-bold bg-white px-1 py-0.5 rounded border border-emerald-200 text-emerald-700">480001</span>) এবং ডিফল্ট পাসওয়ার্ড <span className="font-mono font-bold bg-white px-1 py-0.5 rounded border border-emerald-200 text-emerald-700">123456</span> দিয়ে সরাসরি লগইন করতে পারবেন। পরবর্তীতে নিজের ইচ্ছামতো পাসওয়ার্ড পরিবর্তন করা যাবে।
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
            placeholder="যেমন: 480001 বা admin@madrasa.com"
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
            placeholder="ডিফল্ট: 123456"
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
        disabled={loading}
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
    </form>
  );
}

