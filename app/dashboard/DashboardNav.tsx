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
} from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: any;
  exact?: boolean;
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    items: [
      { name: "ড্যাশবোর্ড", href: "/dashboard", icon: LayoutDashboard, exact: true },
      { name: "শিক্ষার্থী", href: "/dashboard/students", icon: Users },
      { name: "শিক্ষক ও স্টাফ", href: "/dashboard/teachers", icon: Users },
      { name: "হাজিরা", href: "/dashboard/attendance", icon: CheckSquare },
      { name: "জামাত (Classes)", href: "/dashboard/classes", icon: BookOpen },
    ],
  },
  {
    title: "একাডেমিক",
    items: [
      { name: "শিক্ষাবর্ষ (Sessions)", href: "/dashboard/academic/sessions", icon: CalendarDays },
      { name: "শিক্ষার্থী প্রমোশন", href: "/dashboard/students/promotion", icon: GraduationCap },
      { name: "হিফজ ট্র্যাকিং", href: "/dashboard/hifz", icon: BookOpen },
      { name: "রুটিন (Routine)", href: "/dashboard/academic/routine", icon: CalendarDays },
      { name: "সনদ ও মার্কশিট", href: "/dashboard/academic/certificates", icon: Award },
      { name: "আইডি কার্ড", href: "/dashboard/academic/id-cards", icon: IdCard },
      { name: "কিতাব ট্র্যাকিং", href: "/dashboard/kitab", icon: BookOpen },
      { name: "পরীক্ষা ও ফলাফল", href: "/dashboard/exams", icon: BookOpen },
    ],
  },
  {
    title: "অফিস ও ব্যবস্থাপনা",
    items: [
      { name: "যোগাযোগ ও নোটিশ", href: "/dashboard/communication", icon: MessageSquare },
      { name: "অর্থ ও ফি (Finance)", href: "/dashboard/accounting", icon: Wallet },
      { name: "যাকাত ও অনুদান", href: "/dashboard/zakat", icon: HeartHandshake },
      { name: "বোর্ডিং ও মিল", href: "/dashboard/boarding", icon: Utensils },
      { name: "কুতুবখানা (Library)", href: "/dashboard/library", icon: Library },
    ],
  },
  {
    title: "সিস্টেম",
    items: [
      { name: "ইউজার আইডি ও একাউন্ট", href: "/dashboard/users", icon: ShieldCheck },
      { name: "প্যারেন্ট পোর্টাল (Parent Portal)", href: "/portal", icon: Users, exact: true },
      { name: "শিক্ষক পোর্টাল (Teacher Portal)", href: "/teacher-portal", icon: GraduationCap, exact: true },
      { name: "সেটিংস", href: "/dashboard/settings", icon: Settings },
    ],
  },
];

export default function DashboardNav() {
  const pathname = usePathname();

  const isItemActive = (item: NavItem) => {
    if (item.exact) {
      return pathname === item.href;
    }
    return pathname === item.href || pathname.startsWith(item.href + "/");
  };

  return (
    <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
      {navSections.map((section, idx) => (
        <div key={idx} className="space-y-1">
          {section.title && (
            <div className="pt-4 pb-2 px-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {section.title}
              </p>
            </div>
          )}
          {section.items.map((item) => {
            const active = isItemActive(item);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
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
      ))}
    </nav>
  );
}
