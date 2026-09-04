"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/app/actions/auth";
import { createClient } from "@/lib/supabase/client";
import { getPortalRedirectUrl } from "@/lib/role-redirect";

export default function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      // 1. Dual-Sync: First authenticate via client Supabase so browser gets cookies directly
      const supabase = createClient();
      const { data: authData, error: clientAuthError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (clientAuthError) {
        setError(clientAuthError.message);
        setLoading(false);
        return;
      }

      let targetUrl = "/dashboard";

      // 2. Sync server session and get role-based target redirect
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const loginData = await res.json();
        if (loginData?.redirectUrl) {
          targetUrl = loginData.redirectUrl;
        }
      } catch (apiErr) {
        // Fallback client role resolution
        if (authData?.user) {
          const { data: userRow } = await supabase
            .from("users")
            .select("role")
            .eq("id", authData.user.id)
            .maybeSingle();

          const clientRole = userRow?.role || authData.user.user_metadata?.role;
          targetUrl = getPortalRedirectUrl(clientRole);
        }
      }

      // 3. Navigate directly to the designated portal
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
        <div className="p-3 text-sm text-red-500 bg-red-50 rounded-lg border border-red-100">
          {error}
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          ইমেইল
        </label>
        <input
          name="email"
          type="email"
          required
          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 text-sm"
          placeholder="admin@madrasa.com"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          পাসওয়ার্ড
        </label>
        <input
          name="password"
          type="password"
          required
          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 text-sm"
          placeholder="••••••••"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 rounded-lg transition duration-200 disabled:opacity-50 text-sm cursor-pointer shadow-xs"
      >
        {loading ? "লগইন হচ্ছে..." : "লগইন করুন"}
      </button>
    </form>
  );
}

