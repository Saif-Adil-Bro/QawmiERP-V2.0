"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Calendar,
  BookOpen,
  ClipboardList,
  FileText,
  CalendarDays,
  Users,
  Bell,
} from "lucide-react";

interface TeacherNavProps {
  onItemClick?: () => void;
}

export default function TeacherNav({ onItemClick }: TeacherNavProps) {
  const pathname = usePathname();

  const links = [
    { href: "/teacher-portal", label: "শিক্ষক ড্যাশবোর্ড", icon: LayoutDashboard, exact: true },
    { href: "/teacher-portal/attendance", label: "দৈনিক হাজিরা গ্রহণ", icon: Calendar },
    { href: "/teacher-portal/assignments", label: "দৈনিক পড়া ও অ্যাসাইনমেন্ট", icon: BookOpen },
    { href: "/teacher-portal/hifz", label: "হিফজ সবক ও আমুখতা", icon: BookOpen },
    { href: "/teacher-portal/kitab", label: "কিতাবাত ও পাঠ ডায়েরি", icon: FileText },
    { href: "/teacher-portal/exams", label: "পরীক্ষার নম্বর এন্ট্রি", icon: ClipboardList },
    { href: "/teacher-portal/routine", label: "আমার ক্লাস রুটিন", icon: CalendarDays },
    { href: "/teacher-portal/students", label: "শিক্ষার্থী ও যোগাযোগ", icon: Users },
    { href: "/teacher-portal/notices", label: "মাদরাসা নোটিশ বোর্ড", icon: Bell },
  ];

  return (
    <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
      {links.map((link) => {
        const active = link.exact
          ? pathname === link.href
          : pathname === link.href || pathname.startsWith(link.href + "/");
        const Icon = link.icon;

        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={onItemClick}
            className={`flex items-center px-3.5 py-2.5 text-xs sm:text-sm font-semibold rounded-xl transition-all duration-150 ${
              active
                ? "bg-emerald-600 text-white shadow-md shadow-emerald-950/30"
                : "text-slate-400 hover:bg-slate-800/70 hover:text-slate-100"
            }`}
          >
            <Icon className={`w-4 h-4 sm:w-5 sm:h-5 mr-3 transition-colors ${active ? "text-white" : "text-slate-400"}`} />
            <span className="flex-1">{link.label}</span>
            {active && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 shadow-[0_0_8px_#6ee7b7]" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
