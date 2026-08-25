"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Calendar, BookOpen, ClipboardList } from "lucide-react";

export default function TeacherNav() {
  const pathname = usePathname();

  const links = [
    { href: "/teacher-portal", label: "Overview", icon: LayoutDashboard, exact: true },
    { href: "/teacher-portal/attendance", label: "Take Attendance", icon: Calendar },
    { href: "/teacher-portal/hifz", label: "Daily Hifz Sabak", icon: BookOpen },
    { href: "/teacher-portal/exams", label: "Exam Marks", icon: ClipboardList },
  ];

  return (
    <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
      {links.map((link) => {
        const active = link.exact
          ? pathname === link.href
          : pathname === link.href || pathname.startsWith(link.href + "/");
        const Icon = link.icon;

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`flex items-center px-3.5 py-2.5 text-sm font-medium rounded-lg transition-all duration-150 ${
              active
                ? "bg-emerald-600 text-white shadow-sm shadow-emerald-950/40"
                : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
            }`}
          >
            <Icon className={`w-5 h-5 mr-3 transition-colors ${active ? "text-white" : "text-slate-400"}`} />
            <span className="flex-1">{link.label}</span>
            {active && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-200 shadow-[0_0_8px_#a7f3d0]" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
