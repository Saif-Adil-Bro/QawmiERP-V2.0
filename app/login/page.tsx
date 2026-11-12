import LoginForm from "./LoginForm";
import { BookOpen } from "lucide-react";
import { getAuthUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getPortalRedirectUrl } from "@/lib/role-redirect";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getAuthUser();
  if (user) {
    const role = user.user_metadata?.role;
    const targetUrl = getPortalRedirectUrl(role);
    redirect(targetUrl || "/dashboard");
  }
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 px-4">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-4 shadow-lg shadow-emerald-950/50">
          <BookOpen className="w-8 h-8" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          কওমি মাদ্রাসা ম্যানেজমেন্ট
        </h2>
        <p className="mt-2 text-sm text-emerald-200/70">
          অ্যাকাডেমিক ও আর্থিক ব্যবস্থাপনা পোর্টালে লগইন করুন
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="login-card-container bg-white dark:bg-slate-900 py-8 px-6 shadow-2xl rounded-2xl sm:px-10 border border-slate-200 dark:border-slate-800 transition-colors">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
