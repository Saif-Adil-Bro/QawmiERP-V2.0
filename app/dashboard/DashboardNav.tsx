"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  CheckSquare,
  Wallet,
  Utensils,
  Library,
  HeartHandshake,
  MessageSquare,
  Award,
  CalendarDays,
  IdCard,
  GraduationCap,
  Settings,
  ShieldCheck,
  Briefcase,
  Boxes,
  Scale,
  UserCheck,
  Bell,
  FileText,
  ChevronDown,
  Search,
  X,
  ArrowUpRight,
  FolderOpen,
  FolderMinus,
  Sparkles,
} from "lucide-react";
import { usePermissions } from "@/components/permissions/PermissionContext";

interface NavSubItem {
  name: string;
  href: string;
  icon: any;
  exact?: boolean;
  permission?: string;
  roles?: string[];
  badge?: string;
  badgeColor?: string;
  keywords?: string[];
}

interface NavGroup {
  id: string;
  title: string;
  icon: any;
  items: NavSubItem[];
}

interface DirectNavItem {
  name: string;
  href: string;
  icon: any;
  exact?: boolean;
  permission?: string;
  roles?: string[];
}

// Direct top-level item (Dashboard)
const directTopItems: DirectNavItem[] = [
  {
    name: "ড্যাশবোর্ড (Dashboard)",
    href: "/dashboard",
    icon: LayoutDashboard,
    exact: true,
    permission: "dashboard.view",
  },
];

// Hierarchical Menu ↓ Sub-Menu Categories
const navGroups: NavGroup[] = [
  {
    id: "students",
    title: "শিক্ষার্থী ব্যবস্থাপনা",
    icon: Users,
    items: [
      {
        name: "শিক্ষার্থী তালিকা ও প্রোফাইল",
        href: "/dashboard/students",
        icon: Users,
        permission: "student.view",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "admin", "office_staff", "teacher", "education_secretary"],
        keywords: ["student", "shikkharthi", "talika", "profile", "ছাত্র", "তালিকা"],
      },
      {
        name: "ভর্তি ব্যবস্থাপনা ও আবেদন",
        href: "/dashboard/admissions",
        icon: GraduationCap,
        permission: "student.view",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "admin", "office_staff", "education_secretary"],
        badge: "ভর্তি",
        badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
        keywords: ["admission", "vorti", "abedon", "ভর্তি", "আবেদন", "নতুন ছাত্র"],
      },
      {
        name: "শিক্ষার্থী প্রমোশন ও জামাত পরিবর্তন",
        href: "/dashboard/students/promotion",
        icon: ArrowUpRight,
        permission: "student.edit",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "admin", "education_secretary"],
        keywords: ["promotion", "upgrade", "প্রমোশন", "জামাত পরিবর্তন"],
      },
      {
        name: "আইডি কার্ড জেনারেটর",
        href: "/dashboard/academic/id-cards",
        icon: IdCard,
        permission: "id.view",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "office_staff", "admin"],
        keywords: ["id card", "card", "পরিচয়পত্র", "আইডি কার্ড"],
      },
      {
        name: "ফারিগীন ও অ্যালামনাই",
        href: "/dashboard/alumni",
        icon: UserCheck,
        permission: "student.view",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "admin", "office_staff", "teacher", "education_secretary"],
        keywords: ["alumni", "farigin", "সমাবর্তন", "ফারিগীন", "প্রাক্তন"],
      },
    ],
  },
  {
    id: "academic",
    title: "একাডেমিক ও পাঠদান",
    icon: BookOpen,
    items: [
      {
        name: "জামাত ও শাখা (Classes)",
        href: "/dashboard/classes",
        icon: BookOpen,
        permission: "academic.view",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "admin", "education_secretary", "office_staff"],
        keywords: ["class", "jamat", "shakha", "ক্লাস", "জামাত", "শাখা"],
      },
      {
        name: "কিতাব ও বিষয়সমূহ (Subjects)",
        href: "/dashboard/subjects",
        icon: BookOpen,
        permission: "academic.manage",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "admin", "education_secretary"],
        keywords: ["subject", "kitab", "bishoy", "কিতাব", "বিষয়"],
      },
      {
        name: "দৈনিক পড়া ও অ্যাসাইনমেন্ট (Assignments)",
        href: "/dashboard/assignments",
        icon: FileText,
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "admin", "office_staff", "teacher", "education_secretary"],
        badge: "অ্যাসাইনমেন্ট",
        badgeColor: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
        keywords: ["assignment", "assignments", "homework", "হোমওয়ার্ক", "অ্যাসাইনমেন্ট", "পড়া", "দৈনিক পড়া", "work", "task"],
      },
      {
        name: "ক্লাস ও বিষয় রুটিন (Routine)",
        href: "/dashboard/academic/routine",
        icon: CalendarDays,
        permission: "routine.view",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "teacher", "admin", "education_secretary"],
        keywords: ["routine", "schedule", "ক্লাস রুটিন", "সময়সূচি"],
      },
      {
        name: "কিতাব ও দারস ট্র্যাকিং",
        href: "/dashboard/kitab",
        icon: Library,
        permission: "library.view",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "teacher", "librarian"],
        keywords: ["dars", "kitab tracking", "দরস", "দারস"],
      },
      {
        name: "শিক্ষাবর্ষ ও সেশন (Sessions)",
        href: "/dashboard/academic/sessions",
        icon: CalendarDays,
        permission: "academic.manage",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "admin", "education_secretary"],
        keywords: ["session", "academic year", "শিক্ষাবর্ষ", "সেশন"],
      },
    ],
  },
  {
    id: "hifz",
    title: "হিফজুল কুরআন বিভাগ",
    icon: BookOpen,
    items: [
      {
        name: "হিফজ ড্যাশবোর্ড ও ট্র্যাকিং",
        href: "/dashboard/hifz",
        icon: BookOpen,
        permission: "hifz.view",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "hifz_supervisor", "hifz_teacher", "teacher", "admin"],
        badge: "হিফজ",
        badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/30",
        keywords: ["hifz", "quran", "হিফজ", "কুরআন", "পারা", "হাফেজ", "সবক", "আমুক্তা", "নাযেরা"],
      },
    ],
  },
  {
    id: "attendance",
    title: "হাজিরা ও ছুটি",
    icon: CheckSquare,
    items: [
      {
        name: "দৈনিক হাজিরা গ্রহণ",
        href: "/dashboard/attendance",
        icon: CheckSquare,
        permission: "attendance.view",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "teacher", "attendance_manager", "admin"],
        keywords: ["attendance", "hazira", "হাজিরা", "উপস্থিতি"],
      },
      {
        name: "হাজিরা রিপোর্ট ও শিট",
        href: "/dashboard/attendance/reports",
        icon: FileText,
        permission: "attendance.view",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "admin", "education_secretary", "teacher", "attendance_manager"],
        keywords: ["attendance report", "sheet", "হাজিরা রিপোর্ট"],
      },
      {
        name: "ছুটি অনুমোদন ও দরখাস্ত (Leaves)",
        href: "/dashboard/attendance/leaves",
        icon: CalendarDays,
        permission: "attendance.view",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "admin", "education_secretary", "teacher", "office_staff"],
        keywords: ["leave", "chuti", "ছুটি", "দরখাস্ত"],
      },
      {
        name: "বার্ষিক ছুটি ও ক্যালেন্ডার (Holidays)",
        href: "/dashboard/attendance/holidays",
        icon: CalendarDays,
        permission: "attendance.view",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "admin", "education_secretary", "teacher", "office_staff"],
        keywords: ["holiday", "calendar", "অবকাশ", "ছুটির তালিকা"],
      },
    ],
  },
  {
    id: "exams",
    title: "পরীক্ষা ও মূল্যায়ন",
    icon: Award,
    items: [
      {
        name: "পরীক্ষা ও ফলাফল তালিকা",
        href: "/dashboard/exams",
        icon: Award,
        permission: "exam.view",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "teacher", "exam_manager", "admin", "education_secretary"],
        keywords: ["exam", "porikkha", "result", "ফলাফল", "পরীক্ষা"],
      },
      {
        name: "প্রশ্নব্যাংক ও প্রশ্নপত্র জেনারেটর",
        href: "/dashboard/exams/question-bank",
        icon: FileText,
        permission: "exam.view",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "teacher", "exam_manager", "admin"],
        badge: "স্পেশালাইজড",
        badgeColor: "bg-purple-500/20 text-purple-300 border-purple-500/30",
        keywords: ["question", "question bank", "builder", "proshno", "প্রশ্নব্যাংক", "প্রশ্নপত্র", "ইবারত", "তাহকীক"],
      },
      {
        name: "সনদ ও মার্কশিট প্রিন্ট",
        href: "/dashboard/academic/certificates",
        icon: Award,
        permission: "certificate.view",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "exam_manager", "admin", "office_staff"],
        keywords: ["certificate", "marksheet", "সনদ", "নম্বরপত্র", "মার্কশিট"],
      },
    ],
  },
  {
    id: "finance",
    title: "হিসাব ও অর্থায়ন",
    icon: Wallet,
    items: [
      {
        name: "অর্থ ও ফি কালেকশন (Finance)",
        href: "/dashboard/accounting",
        icon: Wallet,
        permission: "finance.view",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "admin", "accountant"],
        keywords: ["finance", "fee", "collection", "হিসাব", "ফি"],
      },
      {
        name: "বকেয়া ফি ও তাগাদা",
        href: "/dashboard/accounting/due",
        icon: Wallet,
        permission: "finance.view",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "admin", "accountant"],
        keywords: ["due", "bokeya", "বকেয়া", "তাগাদা"],
      },
      {
        name: "দৈনিক খরচ ও ভাউচার",
        href: "/dashboard/accounting/expenses",
        icon: Wallet,
        permission: "finance.view",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "admin", "accountant"],
        keywords: ["expense", "voucher", "খরচ", "ভাউচার"],
      },
      {
        name: "আর্থিক রিপোর্ট ও লেজার",
        href: "/dashboard/accounting/reports",
        icon: Scale,
        permission: "finance.view",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "admin", "accountant"],
        keywords: ["report", "ledger", "আর্থিক রিপোর্ট", "খতিয়ান"],
      },
      {
        name: "যাকাত ও অনুদান তহবিল",
        href: "/dashboard/zakat",
        icon: HeartHandshake,
        permission: "finance.view",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "accountant"],
        keywords: ["zakat", "donation", "দান", "যাকাত", "অনুদান"],
      },
      {
        name: "বার্ষিক শুরা অডিট",
        href: "/dashboard/accounting/audit",
        icon: Scale,
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "admin", "accountant"],
        keywords: ["audit", "shura", "অডিট", "শুরা"],
      },
    ],
  },
  {
    id: "admin_assets",
    title: "প্রশাসন ও হোস্টেল",
    icon: Briefcase,
    items: [
      {
        name: "শিক্ষক ও স্টাফ (HR)",
        href: "/dashboard/staff",
        icon: Users,
        permission: "staff.view",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "admin", "hr_manager", "education_secretary"],
        keywords: ["staff", "teacher", "hr", "উস্তাদ", "শিক্ষক", "স্টাফ"],
      },
      {
        name: "বোর্ডিং ও মিল ব্যবস্থাপনা",
        href: "/dashboard/boarding",
        icon: Utensils,
        permission: "staff.view",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "hostel_manager", "admin"],
        keywords: ["boarding", "meal", "hostel", "বোর্ডিং", "খাবার", "মিল"],
      },
      {
        name: "কুতুবখানা (Library)",
        href: "/dashboard/library",
        icon: Library,
        permission: "library.view",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "librarian", "admin"],
        keywords: ["library", "kutubkhana", "বই", "লাইব্রেরি", "কুতুবখানা"],
      },
      {
        name: "ইনভেন্টরি ও সম্পত্তি",
        href: "/dashboard/inventory",
        icon: Boxes,
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "admin", "accountant", "hostel_manager"],
        keywords: ["inventory", "asset", "সম্পত্তি", "মালামাল"],
      },
    ],
  },
  {
    id: "communication",
    title: "যোগাযোগ ও এসএমএস",
    icon: Bell,
    items: [
      {
        name: "বিজ্ঞপ্তি ও অ্যাক্টিভিটি লগ",
        href: "/dashboard/notifications",
        icon: Bell,
        permission: "notification.view",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "admin", "office_staff", "teacher"],
        keywords: ["notification", "notice", "নোটিশ", "বিজ্ঞপ্তি"],
      },
      {
        name: "অভিভাবক মতামত ও অভিযোগ",
        href: "/dashboard/communication/feedback",
        icon: MessageSquare,
        permission: "notification.view",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "admin", "office_staff", "teacher"],
        keywords: ["feedback", "complaint", "অভিযোগ", "পরামর্শ"],
      },
      {
        name: "অনুপস্থিতির সতর্কতা এসএমএস",
        href: "/dashboard/communication/absence-alerts",
        icon: Bell,
        permission: "notification.view",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "admin", "office_staff", "teacher"],
        keywords: ["sms", "alert", "absence", "অনুপস্থিতি এসএমএস"],
      },
      {
        name: "নোটিশ ও যোগাযোগ কেন্দ্র",
        href: "/dashboard/communication",
        icon: MessageSquare,
        permission: "notification.view",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "admin", "office_staff", "teacher"],
        keywords: ["communication", "sms", "বার্তা", "মেসেজ"],
      },
    ],
  },
  {
    id: "system",
    title: "সিস্টেম ও পোর্টাল",
    icon: Settings,
    items: [
      {
        name: "শিক্ষক পোর্টাল (Teacher)",
        href: "/teacher-portal",
        icon: GraduationCap,
        exact: true,
        roles: ["super_admin", "teacher", "hifz_teacher", "muhtamim", "naib_muhtamim"],
        keywords: ["teacher portal", "শিক্ষক পোর্টাল"],
      },
      {
        name: "প্যারেন্ট পোর্টাল (Parent)",
        href: "/portal",
        icon: Users,
        exact: true,
        roles: ["super_admin", "parent", "muhtamim", "naib_muhtamim"],
        keywords: ["parent portal", "অভিভাবক পোর্টাল"],
      },
      {
        name: "ইউজার আইডি ও একাউন্ট",
        href: "/dashboard/users",
        icon: ShieldCheck,
        permission: "user.view",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "admin"],
        keywords: ["user", "role", "permission", "ইউজার", "পারমিশন"],
      },
      {
        name: "মাদ্রাসা সেটিংস",
        href: "/dashboard/settings",
        icon: Settings,
        permission: "settings.view",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "admin"],
        keywords: ["settings", "setup", "মাদ্রাসা সেটিংস", "কনফিগ"],
      },
    ],
  },
];

interface DashboardNavProps {
  onItemClick?: () => void;
}

export default function DashboardNav({ onItemClick }: DashboardNavProps = {}) {
  const pathname = usePathname();
  const { hasPermission, summary, loading } = usePermissions();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");

  const isItemActive = (item: { href: string; exact?: boolean }) => {
    if (item.exact) {
      return pathname === item.href;
    }
    return pathname === item.href || pathname.startsWith(item.href + "/");
  };

  const isItemAllowed = (item: { roles?: string[]; permission?: string }) => {
    if (loading || !summary) return false;
    if (summary.roles.includes("super_admin")) return true;

    // Parent and Student roles belong in Portal, not Admin Dashboard modules
    const isOnlyPortalUser =
      summary.roles.length === 1 &&
      (summary.roles.includes("parent") || summary.roles.includes("student"));
    if (
      isOnlyPortalUser &&
      !item.roles?.includes("parent") &&
      !item.roles?.includes("student")
    ) {
      return false;
    }

    // If roles list is explicitly defined for this nav item, user MUST match at least one role
    if (item.roles && item.roles.length > 0) {
      const hasRole = item.roles.some((r) => summary.roles.includes(r));
      if (!hasRole) return false;
    }

    // If permission is defined, user MUST have that permission
    if (item.permission) {
      return hasPermission(item.permission);
    }

    return true;
  };

  // Automatically expand group that contains currently active route
  useEffect(() => {
    navGroups.forEach((group) => {
      const hasActiveChild = group.items.some((item) => isItemActive(item));
      if (hasActiveChild) {
        setOpenGroups((prev) => ({ ...prev, [group.id]: true }));
      }
    });
  }, [pathname]);

  const toggleGroup = (groupId: string) => {
    setOpenGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const toggleAllGroups = (expand: boolean) => {
    const next: Record<string, boolean> = {};
    navGroups.forEach((g) => {
      next[g.id] = expand;
    });
    setOpenGroups(next);
  };

  // Filter items based on search query and permissions
  const filteredData = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const visibleDirectItems = directTopItems.filter(isItemAllowed).filter((item) => {
      if (!q) return true;
      return item.name.toLowerCase().includes(q);
    });

    const visibleGroups = navGroups
      .map((group) => {
        const allowedItems = group.items.filter(isItemAllowed);
        const matchedItems = allowedItems.filter((item) => {
          if (!q) return true;
          const matchName = item.name.toLowerCase().includes(q);
          const matchGroup = group.title.toLowerCase().includes(q);
          const matchKeywords = item.keywords?.some((k) => k.toLowerCase().includes(q));
          return matchName || matchGroup || !!matchKeywords;
        });

        return {
          ...group,
          allowedItems,
          matchedItems,
          hasActiveChild: allowedItems.some((item) => isItemActive(item)),
        };
      })
      .filter((group) => group.matchedItems.length > 0);

    return { visibleDirectItems, visibleGroups };
  }, [searchQuery, summary, loading, pathname]);

  const isAllExpanded = Object.keys(openGroups).length > 0 && 
    navGroups.every((g) => openGroups[g.id]);

  return (
    <nav className="p-3 space-y-2.5">
      {/* Quick Menu Search */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="মেনু খুঁজুন (যেমন: অ্যাসাইনমেন্ট, হিফজ...)"
          className="w-full pl-8 pr-7 py-2 bg-slate-800/90 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Collapse / Expand All toggle (when not searching) */}
      {!searchQuery && (
        <div className="flex items-center justify-between px-1 text-[11px] text-slate-400">
          <span className="font-medium text-slate-400 flex items-center gap-1">
            <span>মেনু তালিকা</span>
            <span className="text-[10px] text-slate-400 font-mono">(Menu ↓ Sub-menu)</span>
          </span>
          <button
            type="button"
            onClick={() => toggleAllGroups(!isAllExpanded)}
            className="hover:text-emerald-400 transition flex items-center gap-1 cursor-pointer py-0.5"
          >
            {isAllExpanded ? (
              <>
                <FolderMinus className="w-3 h-3 text-slate-400" />
                <span>সব বন্ধ করুন</span>
              </>
            ) : (
              <>
                <FolderOpen className="w-3 h-3 text-slate-400" />
                <span>সব খুলুন</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Top Direct Items (Dashboard) */}
      <div className="space-y-1">
        {filteredData.visibleDirectItems.map((item) => {
          const active = isItemActive(item);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onItemClick}
              className={`flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all duration-150 group ${
                active
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-200 hover:bg-slate-800/80 hover:text-white"
              }`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 transition-colors ${
                  active ? "text-white" : "text-emerald-400 group-hover:text-emerald-300"
                }`}
              />
              <span className="flex-1 truncate">{item.name}</span>
              {active && (
                <span className="w-2 h-2 rounded-full bg-emerald-200 shadow-[0_0_8px_#a7f3d0] shrink-0" />
              )}
            </Link>
          );
        })}
      </div>

      <div className="border-t border-slate-800" />

      {/* Menu Categories with Sub-menus */}
      <div className="space-y-2">
        {filteredData.visibleGroups.map((group) => {
          const isSearching = searchQuery.trim().length > 0;
          const isOpen = isSearching || !!openGroups[group.id];
          const hasActiveChild = group.hasActiveChild;
          const GroupIcon = group.icon;

          return (
            <div
              key={group.id}
              className={`rounded-xl transition-all duration-150 ${
                hasActiveChild
                  ? "bg-slate-800/50 border border-emerald-900/40"
                  : "hover:bg-slate-800/30 border border-transparent"
              }`}
            >
              {/* Parent Category Header Toggle Button */}
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs transition-all cursor-pointer select-none ${
                  hasActiveChild
                    ? "text-emerald-400 font-bold"
                    : "text-slate-200 hover:text-white font-semibold"
                }`}
              >
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div
                    className={`p-1 rounded-md shrink-0 ${
                      hasActiveChild ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    <GroupIcon className="w-3.5 h-3.5" />
                  </div>
                  <span className="truncate">{group.title}</span>
                </div>

                <div className="flex items-center space-x-1.5 shrink-0 ml-2">
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-800/90 text-slate-400 border border-slate-700/60">
                    {group.matchedItems.length}
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                      isOpen ? "rotate-180 text-emerald-400" : ""
                    }`}
                  />
                </div>
              </button>

              {/* Sub-menu items indented cleanly */}
              {isOpen && (
                <div className="pl-3.5 pr-1.5 pb-2 pt-0.5 ml-3 border-l-2 border-slate-700/60 space-y-0.5">
                  {group.matchedItems.map((item) => {
                    const active = isItemActive(item);
                    const SubIcon = item.icon;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onItemClick}
                        className={`flex items-center space-x-2.5 px-2.5 py-1.5 rounded-lg text-xs transition-all duration-150 group ${
                          active
                            ? "bg-emerald-600 text-white font-bold shadow-xs"
                            : "text-slate-300 hover:bg-slate-800 hover:text-white font-medium"
                        }`}
                      >
                        <SubIcon
                          className={`w-3.5 h-3.5 shrink-0 transition-colors ${
                            active
                              ? "text-white"
                              : "text-slate-400 group-hover:text-slate-200"
                          }`}
                        />
                        <span className="flex-1 truncate">{item.name}</span>

                        {item.badge && (
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded border leading-none ${
                              active
                                ? "bg-white/20 text-white border-white/30"
                                : item.badgeColor || "bg-slate-700 text-slate-300 border-slate-600"
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}

                        {active && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-200 shadow-[0_0_8px_#a7f3d0] shrink-0" />
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
