"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  X,
  LogOut,
  LayoutDashboard,
  Users,
  CheckSquare,
  BookOpen,
  Wallet,
  Shield,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import DashboardNav from "./DashboardNav";
import { logout } from "@/app/actions/auth";
import { SessionProvider } from "@/components/sessions/SessionContext";
import SessionSelector from "@/components/sessions/SessionSelector";
import ArchivedSessionBanner from "@/components/sessions/ArchivedSessionBanner";
import { PermissionProvider, usePermissions } from "@/components/permissions/PermissionContext";
import GlobalNotificationBell from "@/components/notifications/GlobalNotificationBell";

function HeaderUserProfile() {
  const { profile, summary } = usePermissions();
  const roleId = summary?.primaryRole || profile?.primaryRole || "super_admin";
  const roleNameMap: Record<string, string> = {
    super_admin: "সুপার অ্যাডমিন",
    admin: "অ্যাডমিন",
    muhtamim: "মুহতামিম",
    naib_muhtamim: "নায়েবে মুহতামিম",
    education_secretary: "শিক্ষা সচিব",
    exam_manager: "পরীক্ষা নিয়ন্ত্রক",
    teacher: "শিক্ষক",
    accountant: "হিসাবরক্ষক",
    hifz_teacher: "হিফজ উস্তাদ",
    hifz_supervisor: "হিফজ সুপারভাইজার",
    hostel_manager: "বোর্ডিং সুপার",
    library_manager: "গ্রন্থাগারিক",
    attendance_manager: "হাজিরা ইনচার্জ",
    hr_manager: "মানবসম্পদ ইনচার্জ",
    parent: "অভিভাবক",
    student: "শিক্ষার্থী",
    staff: "স্টাফ",
  };
  const displayName = profile?.fullName || "ব্যবহারকারী";
  const initialChar = displayName ? displayName.charAt(0) : "A";
  const roleLabel = roleNameMap[roleId] || roleId;

  return (
    <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200/80 rounded-xl px-2.5 py-1">
      <div className="w-8 h-8 bg-emerald-600 text-white rounded-lg flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
        {initialChar}
      </div>
      <div className="hidden sm:flex flex-col text-left text-xs min-w-0">
        <span className="font-bold text-slate-800 truncate max-w-[130px] leading-tight">{displayName}</span>
        <span className="text-[10px] text-emerald-700 font-semibold truncate leading-tight flex items-center gap-1">
          <Shield className="w-2.5 h-2.5 shrink-0" />
          {roleLabel}
        </span>
      </div>
    </div>
  );
}

function MobileBottomNav({
  pathname,
  setSidebarOpen,
}: {
  pathname: string;
  setSidebarOpen: (open: boolean) => void;
}) {
  const { summary, hasPermission } = usePermissions();
  const roles = summary?.roles || [];
  const isParentOrStudent = roles.includes("parent") || roles.includes("student");
  const isTeacherOnly = roles.includes("teacher") && !roles.some((r) => ["super_admin", "muhtamim", "admin"].includes(r));

  let items = [
    { href: "/dashboard", label: "হোম", icon: LayoutDashboard, exact: true, show: true },
    { href: "/dashboard/students", label: "ছাত্র", icon: Users, show: hasPermission("student.view") },
    { href: "/dashboard/attendance", label: "হাজিরা", icon: CheckSquare, show: hasPermission("attendance.view") },
    { href: "/dashboard/classes", label: "জামাত", icon: BookOpen, show: hasPermission("academic.view") },
    { href: "/dashboard/accounting", label: "হিসাব", icon: Wallet, show: (hasPermission("finance.view") || hasPermission("fee.view")) && !isParentOrStudent },
  ];

  if (isParentOrStudent) {
    items = [
      { href: "/portal", label: "পোর্টাল", icon: LayoutDashboard, exact: true, show: true },
      { href: "/portal/attendance", label: "হাজিরা", icon: CheckSquare, show: true },
      { href: "/portal/fees", label: "ফি সমূহ", icon: Wallet, show: true },
      { href: "/portal/certificates", label: "সনদপত্র", icon: BookOpen, show: true },
    ];
  } else if (isTeacherOnly) {
    items = [
      { href: "/teacher-portal", label: "পোর্টাল", icon: LayoutDashboard, exact: true, show: true },
      { href: "/dashboard/students", label: "ছাত্র", icon: Users, show: hasPermission("student.view") },
      { href: "/dashboard/attendance", label: "হাজিরা", icon: CheckSquare, show: hasPermission("attendance.view") },
      { href: "/dashboard/hifz", label: "হিফজ", icon: BookOpen, show: hasPermission("hifz.view") },
    ];
  }

  const visibleItems = items.filter((i) => i.show);

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5 flex items-center justify-around shadow-lg print:hidden">
      {visibleItems.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all ${
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
      <button
        type="button"
        onClick={() => setSidebarOpen(true)}
        className="flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-slate-500 hover:text-slate-800 font-medium"
      >
        <div className="p-1 rounded-lg text-slate-500">
          <Menu className="w-5 h-5" />
        </div>
        <span className="text-[10px] leading-tight mt-0.5">সব মেনু</span>
      </button>
    </nav>
  );
}

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const pathname = usePathname();

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await logout();
    } catch (e) {
      console.error(e);
      setLoggingOut(false);
    }
  };

  // Load saved preference for desktop sidebar
  useEffect(() => {
    try {
      const saved = localStorage.getItem("qawmi_desktop_sidebar");
      if (saved !== null) {
        setDesktopSidebarOpen(saved === "true");
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const toggleDesktopSidebar = () => {
    setDesktopSidebarOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("qawmi_desktop_sidebar", String(next));
      } catch {
        // Ignore localStorage errors
      }
      return next;
    });
  };

  // Automatically close mobile sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  return (
    <PermissionProvider>
      <SessionProvider>
        {/* Fixed screen wrapper: h-screen overflow-hidden ensures fixed viewport on big screens */}
        <div className="flex h-screen w-full bg-slate-50 print:bg-white print:h-auto overflow-hidden">
          {/* Mobile Backdrop Overlay */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs lg:hidden transition-opacity"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* Sidebar Drawer: w-72 sm:w-80 on mobile/tablet, w-72 lg:w-80 (320px) on desktop for spacious layout */}
          <aside
            className={`fixed inset-y-0 left-0 z-50 w-72 sm:w-80 lg:w-80 bg-slate-900 text-slate-300 flex flex-col transition-all duration-200 ease-in-out lg:static print:hidden shrink-0 select-none ${
              sidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
            } ${
              desktopSidebarOpen
                ? "lg:translate-x-0 lg:w-80"
                : "lg:-translate-x-full lg:w-0 lg:overflow-hidden"
            }`}
          >
            {/* Sidebar Brand Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 shrink-0 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                  <span className="bg-emerald-600 text-white p-1 rounded-lg text-sm font-black">Q</span>
                  <span>QawmiERP</span>
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5 font-medium">মাদরাসা ম্যানেজমেন্ট সিস্টেম</p>
              </div>

              <div className="flex items-center gap-1">
                {/* Desktop Collapse Toggle */}
                <button
                  type="button"
                  onClick={toggleDesktopSidebar}
                  className="hidden lg:flex p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                  title="সাইডবার লুকান (Hide Sidebar)"
                  aria-label="Collapse sidebar"
                >
                  <PanelLeftClose className="w-5 h-5" />
                </button>

                {/* Mobile Close Button */}
                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Dynamic Nav Menu with Independent Scroll */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              <DashboardNav />
            </div>

            {/* Logout Button */}
            <div className="p-3.5 sm:p-4 border-t border-slate-800 shrink-0">
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl hover:bg-slate-800 text-rose-400 hover:text-rose-300 transition text-xs sm:text-sm font-semibold cursor-pointer disabled:opacity-50"
              >
                <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>{loggingOut ? "লগআউট হচ্ছে..." : "লগআউট"}</span>
              </button>
            </div>
          </aside>

          {/* Main Content Area (Fixed layout, independent scrolling viewport) */}
          <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden print:overflow-visible">
            {/* Top Fixed Header */}
            <header className="h-16 bg-white/95 backdrop-blur-xs border-b border-slate-200/80 flex items-center justify-between px-4 sm:px-6 lg:px-8 print:hidden shrink-0 gap-3 z-20">
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                {/* Mobile Hamburger Toggle */}
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  className="lg:hidden p-2 text-slate-700 hover:bg-slate-100 rounded-xl transition border border-slate-200"
                  aria-label="Open menu"
                >
                  <Menu className="w-5 h-5" />
                </button>

                {/* Desktop Expand Button when sidebar is collapsed */}
                {!desktopSidebarOpen && (
                  <button
                    type="button"
                    onClick={toggleDesktopSidebar}
                    className="hidden lg:flex items-center gap-1.5 p-2 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition border border-slate-200"
                    title="সাইডবার খুলুন (Open Sidebar)"
                    aria-label="Expand sidebar"
                  >
                    <PanelLeftOpen className="w-5 h-5 text-emerald-600" />
                    <span className="text-xs font-semibold text-slate-700">মেনু</span>
                  </button>
                )}

                <h1 className="text-base sm:text-lg font-bold text-slate-900 truncate">এডমিন পোর্টাল</h1>
              </div>

              <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
                {/* Global Academic Session Selector */}
                <SessionSelector />

                {/* Global Notification Bell */}
                <GlobalNotificationBell />

                <HeaderUserProfile />
              </div>
            </header>

            {/* Archived Session Notice Banner */}
            <ArchivedSessionBanner />

            {/* Page Content: Dedicated smooth scrolling main viewport */}
            <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-20 lg:pb-8 print:p-0 print:overflow-visible">
              {children}
            </main>

            {/* Mobile Bottom Navigation Bar */}
            <MobileBottomNav pathname={pathname} setSidebarOpen={setSidebarOpen} />
          </div>
        </div>
      </SessionProvider>
    </PermissionProvider>
  );
}
