"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  GraduationCap,
  LogOut,
  Menu,
  X,
  LayoutDashboard,
  Calendar,
  BookOpen,
  FileText,
  ClipboardList,
  ArrowLeft,
} from "lucide-react";
import TeacherNav from "./TeacherNav";
import { logout } from "@/app/actions/auth";
import GlobalNotificationBell from "@/components/notifications/GlobalNotificationBell";
import PortalSyncStatusPill from "@/components/portal/PortalSyncStatusPill";
import {
  clearOfflineAuthSession,
  getOfflineAuthSession,
  saveOfflineAuthSession,
} from "@/lib/offline-auth";
import { useOfflinePortalSnapshot } from "@/hooks/useOfflinePortalData";

interface TeacherShellProps {
  user: any;
  userData: any;
  children: React.ReactNode;
}

export default function TeacherShell({ user, userData, children }: TeacherShellProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [cachedProfile, setCachedProfile] = useState<{
    fullName?: string;
    email?: string;
    role?: string;
  } | null>(null);

  const pathname = usePathname();
  const offlineSnapshot = useOfflinePortalSnapshot();

  useEffect(() => {
    if (user?.id) {
      saveOfflineAuthSession({
        accessToken: '',
        role: userData?.role || user?.user_metadata?.role || "teacher",
        madrasaId: userData?.madrasa_id || "",
        userId: user.id,
        fullName: userData?.full_name || user?.user_metadata?.full_name || "",
        email: user?.email || "",
        redirectUrl: "/teacher-portal",
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
  }, [user?.id, user?.email, user?.user_metadata?.full_name, user?.user_metadata?.role, userData?.full_name, userData?.madrasa_id, userData?.role]);

  const effectiveFullName =
    userData?.full_name ||
    (offlineSnapshot?.profile?.full_name as string) ||
    cachedProfile?.fullName ||
    "মুহতারাম উস্তাদ";
  const effectiveEmail =
    user?.email ||
    (offlineSnapshot?.profile?.email as string) ||
    cachedProfile?.email ||
    "";
  const effectiveRole =
    userData?.role ||
    (offlineSnapshot?.profile?.role as string) ||
    cachedProfile?.role ||
    "teacher";

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      try { await clearOfflineAuthSession(); } finally { await logout(); }
    } catch (e) {
      console.error(e);
      setLoggingOut(false);
    }
  };

  // Bottom navigation for mobile teachers on the go
  const bottomNavItems = [
    { href: "/teacher-portal", label: "হোম", icon: LayoutDashboard, exact: true },
    { href: "/teacher-portal/attendance", label: "হাজিরা", icon: Calendar },
    { href: "/teacher-portal/hifz", label: "হিফজ", icon: BookOpen },
    { href: "/teacher-portal/kitab", label: "কিতাবাত", icon: FileText },
    { href: "/teacher-portal/exams", label: "নম্বর", icon: ClipboardList },
  ];

  const isRoleAdminOrStaff = ["super_admin", "admin", "muhtamim"].includes(effectiveRole);

  return (
    <div className="portal-native-shell flex h-dvh bg-slate-50 text-slate-900 overflow-hidden font-sans">
      {/* DESKTOP SIDEBAR */}
      <aside className="hidden md:flex w-72 lg:w-80 bg-slate-950 text-slate-300 flex-col border-r border-slate-800 shrink-0 select-none">
        {/* Madrasa Brand */}
        <div className="p-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
          <Link href="/teacher-portal" className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold shadow-md shadow-emerald-950 shrink-0">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-base font-bold text-white tracking-tight block truncate">
                শিক্ষক পোর্টাল
              </span>
              <span className="text-[11px] font-medium text-emerald-400 block truncate">
                উস্তাদ ও পাঠদান ব্যবস্থাপনা
              </span>
            </div>
          </Link>
        </div>

        {/* Sidebar Navigation Links */}
        <TeacherNav canUseHealth={userData?.canUseHealth} />

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

          <div className="flex items-center gap-3 p-2 bg-slate-800/50 rounded-xl border border-slate-700/50">
            <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
              {(effectiveFullName || "উ")[0]}
            </div>
            <div className="overflow-hidden min-w-0 flex-1">
              <p className="text-xs font-bold text-white truncate">{effectiveFullName}</p>
              <p className="text-[11px] text-slate-400 font-mono truncate">{effectiveEmail}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex items-center justify-center w-full px-3 py-2 text-xs font-semibold text-red-400 rounded-lg hover:bg-red-950/40 hover:text-red-300 transition-colors disabled:opacity-50"
          >
            <LogOut className="w-4 h-4 mr-2" />
            {loggingOut ? "লগআউট হচ্ছে..." : "লগআউট করুন"}
          </button>
        </div>
      </aside>

      {/* MOBILE DRAWER */}
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
                    <GraduationCap className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-bold text-white truncate">শিক্ষক পোর্টাল</span>
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

            <TeacherNav canUseHealth={userData?.canUseHealth} onItemClick={() => setIsMobileMenuOpen(false)} />

            <div className="pb-safe bg-slate-900 border-t border-slate-800">
              <div className="p-4 space-y-3">
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
                    {(effectiveFullName || "উ")[0]}
                  </div>
                  <div className="overflow-hidden min-w-0 flex-1">
                    <p className="text-xs font-bold text-white truncate">{effectiveFullName}</p>
                    <p className="text-[10px] text-slate-400 font-mono truncate">{effectiveEmail}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="flex items-center justify-center w-full min-h-[44px] px-3 text-xs font-semibold text-red-400 rounded-xl bg-red-950/30 hover:bg-red-950/60 disabled:opacity-50"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  {loggingOut ? "লগআউট হচ্ছে..." : "লগআউট"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MAIN CONTENT CONTAINER */}
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
                  <GraduationCap className="w-4 h-4" />
                </div>
                <span className="font-bold text-sm tracking-tight truncate">শিক্ষক পোর্টাল</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <PortalSyncStatusPill portalType="teacher" />
              <GlobalNotificationBell />
            </div>
          </div>
        </header>

        {/* DESKTOP TOPBAR */}
        <header className="hidden md:flex bg-white border-b border-slate-200/80 px-6 py-3.5 items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-bold text-slate-800 text-sm">শিক্ষক পোর্টাল</span>
            <span className="text-xs text-slate-300">•</span>
            <span className="text-xs text-emerald-700 font-semibold truncate">{effectiveFullName}</span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <PortalSyncStatusPill portalType="teacher" />
            <GlobalNotificationBell />
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

        {/* PAGE CONTENT (Zero horizontal overflow on mobile) */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden pb-24 md:pb-8">
          <div className="p-3 sm:p-6 lg:p-8 max-w-7xl mx-auto">
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

              return (
                <Link
                  key={item.href}
                  href={item.href}
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
