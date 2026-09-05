"use client";

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
} from "lucide-react";
import { usePermissions } from "@/components/permissions/PermissionContext";

interface NavItem {
  name: string;
  href: string;
  icon: any;
  exact?: boolean;
  permission?: string;
  roles?: string[];
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    items: [
      { name: "ড্যাশবোর্ড", href: "/dashboard", icon: LayoutDashboard, exact: true, permission: "dashboard.view" },
      { name: "শিক্ষার্থী", href: "/dashboard/students", icon: Users, permission: "student.view", roles: ["super_admin", "muhtamim", "admin", "office_staff", "teacher", "education_secretary"] },
      { name: "শিক্ষক ও স্টাফ (HR)", href: "/dashboard/staff", icon: Users, permission: "staff.view", roles: ["super_admin", "muhtamim", "admin", "hr_manager", "education_secretary"] },
      { name: "হাজিরা", href: "/dashboard/attendance", icon: CheckSquare, permission: "attendance.view", roles: ["super_admin", "muhtamim", "teacher", "attendance_manager", "admin"] },
      { name: "জামাত (Classes)", href: "/dashboard/classes", icon: BookOpen, permission: "academic.view", roles: ["super_admin", "muhtamim", "admin", "education_secretary", "office_staff"] },
      { name: "দৈনিক পড়া ও অ্যাসাইনমেন্ট", href: "/dashboard/assignments", icon: FileText, roles: ["super_admin", "muhtamim", "admin", "office_staff", "teacher", "education_secretary"] },
    ],
  },
  {
    title: "একাডেমিক",
    items: [
      { name: "দৈনিক পড়া ও অ্যাসাইনমেন্ট", href: "/dashboard/assignments", icon: FileText, roles: ["super_admin", "muhtamim", "admin", "office_staff", "teacher", "education_secretary"] },
      { name: "অনলাইন ভর্তি ও টেস্ট", href: "/dashboard/admissions", icon: GraduationCap, permission: "student.view", roles: ["super_admin", "muhtamim", "admin", "office_staff", "education_secretary"] },
      { name: "শিক্ষাবর্ষ (Sessions)", href: "/dashboard/academic/sessions", icon: CalendarDays, permission: "academic.manage", roles: ["super_admin", "muhtamim", "admin", "education_secretary"] },
      { name: "শিক্ষার্থী প্রমোশন", href: "/dashboard/students/promotion", icon: GraduationCap, permission: "student.edit", roles: ["super_admin", "muhtamim", "admin", "education_secretary"] },
      { name: "হিফজ ট্র্যাকিং", href: "/dashboard/hifz", icon: BookOpen, permission: "hifz.view", roles: ["super_admin", "muhtamim", "hifz_supervisor", "hifz_teacher", "teacher"] },
      { name: "রুটিন (Routine)", href: "/dashboard/academic/routine", icon: CalendarDays, permission: "routine.view", roles: ["super_admin", "muhtamim", "teacher", "admin", "education_secretary"] },
      { name: "সনদ ও মার্কশিট", href: "/dashboard/academic/certificates", icon: Award, permission: "certificate.view", roles: ["super_admin", "muhtamim", "exam_manager", "admin", "office_staff"] },
      { name: "আইডি কার্ড", href: "/dashboard/academic/id-cards", icon: IdCard, permission: "id.view", roles: ["super_admin", "muhtamim", "office_staff", "admin"] },
      { name: "কিতাব ট্র্যাকিং", href: "/dashboard/kitab", icon: BookOpen, permission: "library.view", roles: ["super_admin", "muhtamim", "teacher", "librarian"] },
      { name: "পরীক্ষা ও ফলাফল", href: "/dashboard/exams", icon: BookOpen, permission: "exam.view", roles: ["super_admin", "muhtamim", "teacher", "exam_manager", "admin", "education_secretary"] },
      { name: "ছুটি অনুমোদন ও দরখাস্ত", href: "/dashboard/attendance/leaves", icon: CalendarDays, permission: "attendance.view", roles: ["super_admin", "muhtamim", "admin", "education_secretary", "teacher", "office_staff"] },
      { name: "ছুটি ও অবকাশ (Holidays)", href: "/dashboard/attendance/holidays", icon: CalendarDays, permission: "attendance.view", roles: ["super_admin", "muhtamim", "admin", "education_secretary", "teacher", "office_staff"] },
      { name: "ফারিগীন ও অ্যালামনাই", href: "/dashboard/alumni", icon: UserCheck, permission: "student.view", roles: ["super_admin", "muhtamim", "admin", "office_staff", "teacher", "education_secretary"] },
    ],
  },
  {
    title: "অফিস ও ব্যবস্থাপনা",
    items: [
      { name: "বিজ্ঞপ্তি ও অ্যাক্টিভিটি লগ", href: "/dashboard/notifications", icon: Bell, permission: "notification.view", roles: ["super_admin", "muhtamim", "admin", "office_staff", "teacher"] },
      { name: "যোগাযোগ ও নোটিশ", href: "/dashboard/communication", icon: MessageSquare, permission: "notification.view", roles: ["super_admin", "muhtamim", "admin", "office_staff", "teacher"] },
      { name: "অর্থ ও ফি (Finance)", href: "/dashboard/accounting", icon: Wallet, permission: "finance.view", roles: ["super_admin", "muhtamim", "admin", "accountant"] },
      { name: "বার্ষিক শুরা অডিট", href: "/dashboard/accounting/audit", icon: Scale, roles: ["super_admin", "muhtamim", "admin", "accountant"] },
      { name: "ইনভেন্টরি ও সম্পত্তি", href: "/dashboard/inventory", icon: Boxes, roles: ["super_admin", "muhtamim", "admin", "accountant", "hostel_manager"] },
      { name: "যাকাত ও অনুদান", href: "/dashboard/zakat", icon: HeartHandshake, permission: "finance.view", roles: ["super_admin", "muhtamim", "accountant"] },
      { name: "বোর্ডিং ও মিল", href: "/dashboard/boarding", icon: Utensils, permission: "staff.view", roles: ["super_admin", "muhtamim", "hostel_manager", "admin"] },
      { name: "কুতুবখানা (Library)", href: "/dashboard/library", icon: Library, permission: "library.view", roles: ["super_admin", "muhtamim", "librarian"] },
    ],
  },
  {
    title: "সিস্টেম",
    items: [
      { name: "ইউজার আইডি ও একাউন্ট", href: "/dashboard/users", icon: ShieldCheck, permission: "user.view", roles: ["super_admin", "muhtamim", "admin"] },
      { name: "প্যারেন্ট পোর্টাল (Parent Portal)", href: "/portal", icon: Users, exact: true, roles: ["super_admin", "parent", "muhtamim"] },
      { name: "শিক্ষক পোর্টাল (Teacher Portal)", href: "/teacher-portal", icon: GraduationCap, exact: true, roles: ["super_admin", "teacher", "hifz_teacher", "muhtamim"] },
      { name: "সেটিংস", href: "/dashboard/settings", icon: Settings, permission: "settings.view", roles: ["super_admin", "muhtamim", "admin"] },
    ],
  },
];

interface DashboardNavProps {
  onItemClick?: () => void;
}

export default function DashboardNav({ onItemClick }: DashboardNavProps = {}) {
  const pathname = usePathname();
  const { hasPermission, summary, loading } = usePermissions();

  const isItemActive = (item: NavItem) => {
    if (item.exact) {
      return pathname === item.href;
    }
    return pathname === item.href || pathname.startsWith(item.href + "/");
  };

  const isItemAllowed = (item: NavItem) => {
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

  return (
    <nav className="p-4 space-y-1">
      {navSections.map((section, idx) => {
        const visibleItems = section.items.filter(isItemAllowed);
        if (visibleItems.length === 0) return null;

        return (
          <div key={idx} className="space-y-1">
            {section.title && (
              <div className="pt-4 pb-2 px-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {section.title}
                </p>
              </div>
            )}
            {visibleItems.map((item) => {
              const active = isItemActive(item);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onItemClick}
                  className={`flex items-center space-x-3 px-3.5 py-2.5 rounded-lg text-sm transition-all duration-150 group font-medium ${
                    active
                      ? "bg-emerald-600 text-white shadow-sm shadow-emerald-950/40"
                      : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 shrink-0 transition-colors ${
                      active
                        ? "text-white"
                        : "text-slate-400 group-hover:text-slate-200"
                    }`}
                  />
                  <span className="flex-1 truncate">{item.name}</span>
                  {active && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-200 shadow-[0_0_8px_#a7f3d0] shrink-0" />
                  )}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
