"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  BookOpen,
  User,
  LogOut,
  Menu,
  X,
  LayoutDashboard,
  Calendar,
  GraduationCap,
  Award,
  CreditCard,
  ArrowLeft,
  ChevronRight,
} from "lucide-react";
import PortalNav from "./PortalNav";
import { logout } from "@/app/actions/auth";

interface PortalShellProps {
  user: any;
  userData: any;
  children: React.ReactNode;
}

export default function PortalShell({ user, userData, children }: PortalShellProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const studentId = searchParams.get("student_id");

  // Bottom navigation items for mobile
  const bottomNavItems = [
    { href: "/portal", label: "হোম", icon: LayoutDashboard, exact: true },
    { href: "/portal/attendance", label: "হাজিরা", icon: Calendar },
    { href: "/portal/academic", label: "হিফজ", icon: GraduationCap },
    { href: "/portal/exams", label: "পরীক্ষা", icon: Award },
    { href: "/portal/fees", label: "ফি", icon: CreditCard },
  ];

  const isRoleAdminOrStaff = ["super_admin", "admin", "muhtamim"].includes(userData?.role);

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden font-sans">
      {/* DESKTOP SIDEBAR */}
      <aside className="hidden md:flex w-64 lg:w-72 bg-slate-950 text-slate-300 flex-col border-r border-slate-800 shrink-0 select-none">
        {/* Madrasa Brand */}
        <div className="p-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
          <Link href="/portal" className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold shadow-md shadow-emerald-950">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-base font-bold text-white tracking-tight block truncate">প্যারেন্ট পোর্টাল</span>
              <span className="text-[11px] font-medium text-emerald-400 block truncate">Parent & Student Portal</span>
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
              className="flex items-center justify-center gap-1.5 w-full py-1.5 px-3 rounded-lg text-xs font-semibold text-emerald-400 bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-800/60 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>মেইন ড্যাশবোর্ডে ফিরুন</span>
            </Link>
          )}

          <div className="flex items-center gap-3 p-2 bg-slate-800/50 rounded-xl border border-slate-700/50">
            <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
              {(userData?.full_name || "প")[0]}
            </div>
            <div className="overflow-hidden min-w-0 flex-1">
              <p className="text-xs font-bold text-white truncate">{userData?.full_name || "অভিভাবক"}</p>
              <p className="text-[11px] text-slate-400 font-mono truncate">{user?.email}</p>
            </div>
          </div>

          <form action={logout}>
            <button
              type="submit"
              className="flex items-center justify-center w-full px-3 py-2 text-xs font-semibold text-red-400 rounded-lg hover:bg-red-950/40 hover:text-red-300 transition-colors"
            >
              <LogOut className="w-4 h-4 mr-2" />
              লগআউট করুন
            </button>
          </form>
        </div>
      </aside>

      {/* MOBILE DRAWER (SLIDE OVER) */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity animate-in fade-in"
            onClick={() => setIsMobileMenuOpen(false)}
          />

          {/* Drawer Content */}
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-slate-950 text-slate-300 z-10 shadow-2xl border-r border-slate-800 animate-in slide-in-from-left duration-200">
            <div className="p-4 bg-slate-900 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold">
                  <BookOpen className="w-4 h-4" />
                </div>
                <span className="text-sm font-bold text-white">প্যারেন্ট পোর্টাল</span>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <PortalNav onItemClick={() => setIsMobileMenuOpen(false)} />

            <div className="p-4 bg-slate-900 border-t border-slate-800 space-y-3">
              {isRoleAdminOrStaff && (
                <Link
                  href="/dashboard"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center justify-center gap-1.5 w-full py-2 px-3 rounded-xl text-xs font-semibold text-emerald-400 bg-emerald-950/80 border border-emerald-800/80"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>মেইন ড্যাশবোর্ড</span>
                </Link>
              )}

              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                  {(userData?.full_name || "প")[0]}
                </div>
                <div className="overflow-hidden min-w-0 flex-1">
                  <p className="text-xs font-bold text-white truncate">{userData?.full_name || "অভিভাবক"}</p>
                  <p className="text-[10px] text-slate-400 font-mono truncate">{user?.email}</p>
                </div>
              </div>

              <form action={logout}>
                <button
                  type="submit"
                  className="flex items-center justify-center w-full px-3 py-2 text-xs font-semibold text-red-400 rounded-xl bg-red-950/30 hover:bg-red-950/60"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  লগআউট
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* MOBILE TOPBAR */}
        <header className="md:hidden bg-slate-900 text-white px-4 py-3 border-b border-slate-800 flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
              aria-label="মেনু খুলুন"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-xs">
                <BookOpen className="w-4 h-4" />
              </div>
              <span className="font-bold text-sm tracking-tight">প্যারেন্ট পোর্টাল</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-xs">
              {(userData?.full_name || "প")[0]}
            </div>
          </div>
        </header>

        {/* PAGE CONTENT CONTAINER */}
        <main className="flex-1 overflow-y-auto pb-20 md:pb-8">
          <div className="p-3 sm:p-6 lg:p-8 max-w-7xl mx-auto">
            {children}
          </div>
        </main>

        {/* MOBILE BOTTOM NAVIGATION BAR */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 px-2 py-1.5 flex items-center justify-around shadow-lg">
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
                className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl transition-all ${
                  active
                    ? "text-emerald-700 font-bold scale-105"
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
                <span className="text-[10px] leading-tight mt-0.5">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
