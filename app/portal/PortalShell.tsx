"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  BookOpen,
  LogOut,
  Menu,
  X,
  LayoutDashboard,
  Calendar,
  GraduationCap,
  Award,
  CreditCard,
  ArrowLeft,
  KeyRound,
  ShieldAlert,
} from "lucide-react";
import PortalNav from "./PortalNav";
import { logout } from "@/app/actions/auth";
import ChangePasswordModal from "@/components/portal/ChangePasswordModal";
import PortalSyncStatusPill from "@/components/portal/PortalSyncStatusPill";
import {
  clearOfflineAuthSession,
  getOfflineAuthSession,
  saveOfflineAuthSession,
} from "@/lib/offline-auth";
import { useOfflinePortalSnapshot } from "@/hooks/useOfflinePortalData";

interface PortalShellProps {
  user: any;
  userData: any;
  children: React.ReactNode;
}

export default function PortalShell({ user, userData, children }: PortalShellProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [hideDefaultPassBanner, setHideDefaultPassBanner] = useState(false);
  const [cachedProfile, setCachedProfile] = useState<{
    fullName?: string;
    email?: string;
    role?: string;
  } | null>(null);

  const pathname = usePathname();
  const searchParams = useSearchParams();
  const studentId = searchParams.get("student_id");
  const offlineSnapshot = useOfflinePortalSnapshot();

  // Persist active session/profile for offline resilience & hydrate fallback if offline
  useEffect(() => {
    if (user?.id) {
      saveOfflineAuthSession({
        accessToken: '',
        role: userData?.role || user?.user_metadata?.role || "student",
        madrasaId: userData?.madrasa_id || "",
        userId: user.id,
        fullName: userData?.full_name || user?.user_metadata?.full_name || "",
        email: user?.email || "",
        redirectUrl: "/portal",
        savedAt: Date.now(),
      }).catch(() => {});

    } else {
      getOfflineAuthSession()
        .then((sess) => {
          if (sess) {
            setCachedProfile({
              fullName: sess.fullName,
              email: sess.email,
              role: sess.role,
            });
          }
        })
        .catch(() => {});
    }
  }, [user?.id, user?.email, user?.user_metadata?.full_name, user?.user_metadata?.role, user?.user_metadata?.avatar_url, userData?.full_name, userData?.madrasa_id, userData?.role, userData?.photo_url]);

  const effectiveFullName =
    userData?.full_name ||
    (offlineSnapshot?.profile?.full_name as string) ||
    cachedProfile?.fullName ||
    "অভিভাবক";
  const effectiveEmail =
    user?.email ||
    (offlineSnapshot?.profile?.email as string) ||
    cachedProfile?.email ||
    "";
  const effectivePhoto =
    userData?.photo_url ||
    user?.user_metadata?.avatar_url ||
    (offlineSnapshot?.profile?.photo_url as string) ||
    "";
  const effectiveRole =
    userData?.role ||
    (offlineSnapshot?.profile?.role as string) ||
    cachedProfile?.role ||
    "student";

  const studentIdCode =
    user?.user_metadata?.student_id_code ||
    effectiveEmail?.match(/student_([0-9a-zA-Z_-]+)@/)?.[1] ||
    null;

  const isDefaultPassword =
    user?.user_metadata?.is_default_password !== false &&
    effectiveEmail?.includes("student_");

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      try { await clearOfflineAuthSession(); } finally { await logout(); }
    } catch (e) {
      console.error(e);
      setLoggingOut(false);
    }
  };

  // Bottom navigation items for mobile
  const bottomNavItems = [
    { href: "/portal", label: "হোম", icon: LayoutDashboard, exact: true },
    { href: "/portal/attendance", label: "হাজিরা", icon: Calendar },
    { href: "/portal/academic", label: "হিফজ", icon: GraduationCap },
    { href: "/portal/exams", label: "ফলাফল", icon: Award },
    { href: "/portal/fees", label: "ফি", icon: CreditCard },
  ];

  const isRoleAdminOrStaff = ["super_admin", "admin", "muhtamim"].includes(effectiveRole);

  return (
    <div className="portal-native-shell flex h-dvh bg-slate-50 text-slate-900 overflow-hidden font-sans">
      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        user={user}
        userData={userData}
      />

      {/* DESKTOP SIDEBAR */}
      <aside className="hidden md:flex w-72 lg:w-80 bg-slate-950 text-slate-300 flex-col border-r border-slate-800 shrink-0 select-none">
        {/* Madrasa Brand */}
        <div className="p-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
          <Link href="/portal" className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold shadow-md shadow-emerald-950 shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-base font-bold text-white tracking-tight block truncate">
                অভিভাবক ও শিক্ষার্থী পোর্টাল
              </span>
              <span className="text-[11px] font-medium text-emerald-400 block truncate">
                কওমি মাদরাসা ডিজিটাল পোর্টাল
              </span>
            </div>
          </Link>
        </div>

        {/* Sidebar Nav Links */}
        <PortalNav />

        {/* Sidebar Footer User Info */}
        <div className="p-3.5 bg-slate-900/90 border-t border-slate-800 space-y-2">
          {isRoleAdminOrStaff && (
            <Link
              href="/dashboard"
              className="flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-lg text-xs font-semibold text-emerald-400 bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-800/60 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>মেইন ড্যাশবোর্ডে ফিরুন</span>
            </Link>
          )}

          <div className="flex items-center gap-3 p-2.5 bg-slate-800/50 rounded-xl border border-slate-700/50">
            <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs overflow-hidden">
              {effectivePhoto ? (
                <img src={effectivePhoto} alt="" className="w-full h-full object-cover" />
              ) : (
                (effectiveFullName || "অ")[0]
              )}
            </div>
            <div className="overflow-hidden min-w-0 flex-1">
              <p className="text-xs font-bold text-white truncate">{effectiveFullName}</p>
              {studentIdCode ? (
                <p className="text-[11px] text-emerald-400 font-semibold font-mono truncate">
                  আইডি: {studentIdCode}
                </p>
              ) : (
                <p className="text-[11px] text-slate-400 font-mono truncate">{effectiveEmail}</p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsPasswordModalOpen(true)}
            className="flex items-center justify-center w-full px-3 py-2 text-xs font-medium text-emerald-300 bg-emerald-950/50 hover:bg-emerald-900/70 border border-emerald-800/50 rounded-lg transition-colors cursor-pointer"
          >
            <KeyRound className="w-3.5 h-3.5 mr-2" />
            <span>পাসওয়ার্ড পরিবর্তন করুন</span>
          </button>

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex items-center justify-center w-full px-3 py-2 text-xs font-semibold text-red-400 rounded-lg hover:bg-red-950/40 hover:text-red-300 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <LogOut className="w-4 h-4 mr-2" />
            {loggingOut ? "লগআউট হচ্ছে..." : "লগআউট করুন"}
          </button>
        </div>
      </aside>

      {/* MOBILE DRAWER (SLIDE OVER) */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity animate-in fade-in"
            onClick={() => setIsMobileMenuOpen(false)}
          />

          <div className="relative flex-1 flex flex-col max-w-[85vw] sm:max-w-xs w-full bg-slate-950 text-slate-300 z-10 shadow-2xl border-r border-slate-800 animate-in slide-in-from-left duration-200">
            <div className="pt-safe bg-slate-900 border-b border-slate-800">
              <div className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold shrink-0">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-bold text-white truncate">প্যারেন্ট পোর্টাল</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(false)}
                  aria-label="মেনু বন্ধ করুন"
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <PortalNav onItemClick={() => setIsMobileMenuOpen(false)} />

            <div className="pb-safe bg-slate-900 border-t border-slate-800">
              <div className="p-4 space-y-2.5">
                {isRoleAdminOrStaff && (
                  <Link
                    href="/dashboard"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center justify-center gap-1.5 w-full min-h-[44px] px-3 rounded-xl text-xs font-semibold text-emerald-400 bg-emerald-950/80 border border-emerald-800/80"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>মেইন ড্যাশবোর্ড</span>
                  </Link>
                )}

                <div className="flex items-center gap-2.5 p-2 bg-slate-800/40 rounded-xl">
                  <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    {(effectiveFullName || "অ")[0]}
                  </div>
                  <div className="overflow-hidden min-w-0 flex-1">
                    <p className="text-xs font-bold text-white truncate">{effectiveFullName}</p>
                    {studentIdCode ? (
                      <p className="text-[11px] text-emerald-400 font-semibold font-mono truncate">
                        আইডি: {studentIdCode}
                      </p>
                    ) : (
                      <p className="text-[10px] text-slate-400 font-mono truncate">{effectiveEmail}</p>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setIsPasswordModalOpen(true);
                  }}
                  className="flex items-center justify-center w-full min-h-[44px] px-3 text-xs font-medium text-emerald-300 bg-emerald-950/50 hover:bg-emerald-900/70 border border-emerald-800/50 rounded-xl transition-colors cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5 mr-2" />
                  <span>পাসওয়ার্ড পরিবর্তন করুন</span>
                </button>

                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="flex items-center justify-center w-full min-h-[44px] px-3 text-xs font-semibold text-red-400 rounded-xl bg-red-950/30 hover:bg-red-950/60 disabled:opacity-50 cursor-pointer"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  {loggingOut ? "লগআউট হচ্ছে..." : "লগআউট"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* MOBILE TOPBAR (Compact <= 56px + safe area) */}
        <header className="md:hidden pt-safe bg-slate-900 text-white border-b border-slate-800 shrink-0 shadow-md">
          <div className="px-3 py-1.5 flex items-center justify-between gap-2 min-h-[52px]">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(true)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-slate-800 text-slate-200 hover:text-white shrink-0"
                aria-label="মেনু খুলুন"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
                  <BookOpen className="w-4 h-4" />
                </div>
                <span className="font-bold text-sm tracking-tight truncate">প্যারেন্ট পোর্টাল</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <PortalSyncStatusPill portalType="student" />
              <button
                type="button"
                onClick={() => setIsPasswordModalOpen(true)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 hover:bg-emerald-900"
                aria-label="পাসওয়ার্ড পরিবর্তন"
                title="পাসওয়ার্ড পরিবর্তন"
              >
                <KeyRound className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* DESKTOP TOPBAR */}
        <header className="hidden md:flex bg-white border-b border-slate-200/80 px-6 py-3 items-center justify-between shrink-0 shadow-2xs">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-bold text-slate-800 text-sm">অভিভাবক ও শিক্ষার্থী পোর্টাল</span>
            <span className="text-xs text-slate-300">•</span>
            <span className="text-xs text-emerald-700 font-semibold truncate">{effectiveFullName}</span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <PortalSyncStatusPill portalType="student" />
            {isRoleAdminOrStaff && (
              <Link
                href="/dashboard"
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition"
              >
                এডমিন প্যানেল
              </Link>
            )}
          </div>
        </header>

        {/* PAGE CONTENT CONTAINER (Zero horizontal overflow on 360px-430px) */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden pb-24 md:pb-8">
          <div className="p-3 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-4">
            {/* DEFAULT PASSWORD ALERT BANNER (inside scroll flow to preserve <= 15% sticky surface cap) */}
            {isDefaultPassword && !hideDefaultPassBanner && (
              <div className="bg-amber-50 border border-amber-300/60 rounded-2xl px-3.5 py-2.5 text-xs text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-start sm:items-center gap-2 min-w-0">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
                  <span className="font-medium leading-relaxed">
                    অ্যাকাউন্টের সুরক্ষার জন্য প্রাথমিক পাসওয়ার্ড পরিবর্তন করে নতুন শক্তিশালী পাসওয়ার্ড সেট করুন।
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setIsPasswordModalOpen(true)}
                    className="min-h-[44px] sm:min-h-[34px] px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs shadow-xs transition"
                  >
                    পাসওয়ার্ড পরিবর্তন
                  </button>
                  <button
                    type="button"
                    onClick={() => setHideDefaultPassBanner(true)}
                    aria-label="বন্ধ করুন"
                    className="min-w-[44px] min-h-[44px] sm:min-w-[32px] sm:min-h-[32px] flex items-center justify-center text-amber-700 hover:text-amber-900 rounded-lg"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {children}
          </div>
        </main>

        {/* MOBILE BOTTOM NAVIGATION BAR */}
        <nav className="md:hidden pb-safe fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-lg">
          <div className="grid grid-cols-5 items-center px-1 py-1">
            {bottomNavItems.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = item.icon;
              const targetHref = studentId ? `${item.href}?student_id=${studentId}` : item.href;

              return (
                <Link
                  key={item.href}
                  href={targetHref}
                  className={`flex flex-col items-center justify-center min-h-[48px] py-1 px-1 rounded-xl transition-all ${
                    active
                      ? "text-emerald-700 font-bold"
                      : "text-slate-500 hover:text-slate-800 font-medium"
                  }`}
                >
                  <div
                    className={`p-1 rounded-lg ${
                      active ? "bg-emerald-50 text-emerald-700" : "text-slate-500"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] leading-tight mt-0.5 truncate max-w-full">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
