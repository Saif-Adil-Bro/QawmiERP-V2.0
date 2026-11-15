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
    <div className="h-dvh overflow-hidden sm:h-auto sm:min-h-screen sm:overflow-auto bg-white dark:bg-slate-900 sm:bg-gradient-to-br sm:from-emerald-950 sm:via-slate-900 sm:to-slate-950 flex flex-col justify-between sm:justify-center sm:py-12 sm:px-6 lg:px-8">
      <div className="bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 sm:bg-none px-5 pt-6 pb-5 sm:p-0 sm:mx-auto sm:w-full sm:max-w-md text-center shrink-0">
        <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-2.5 sm:mb-4 shadow-lg shadow-emerald-950/50">
          <BookOpen className="w-6 h-6 sm:w-8 sm:h-8" />
        </div>
        <h2 className="text-xl sm:text-3xl font-extrabold text-white tracking-tight">
          কওমি মাদ্রাসা ম্যানেজমেন্ট
        </h2>
        <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-emerald-200/75">
          অ্যাকাডেমিক ও আর্থিক ব্যবস্থাপনা পোর্টালে লগইন করুন
        </p>
      </div>

      <div className="flex-1 flex flex-col justify-center sm:flex-none sm:mt-8 sm:mx-auto sm:w-full sm:max-w-md overflow-hidden">
        <div className="login-card-container bg-white dark:bg-slate-900 px-5 py-4 sm:py-8 sm:px-10 sm:shadow-2xl sm:rounded-2xl sm:border sm:border-slate-200 dark:sm:border-slate-800 transition-colors">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
