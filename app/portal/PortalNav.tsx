"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  Calendar,
  GraduationCap,
  CreditCard,
  Award,
  CalendarDays,
  Bell,
  Send,
  IdCard,
  MessageSquarePlus,
} from "lucide-react";

interface PortalNavProps {
  onItemClick?: () => void;
}

export default function PortalNav({ onItemClick }: PortalNavProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const studentId = searchParams.get("student_id");

  const links = [
    { href: "/portal", label: "ড্যাশবোর্ড ও ওভারভিউ", icon: LayoutDashboard, exact: true },
    { href: "/portal/id-card", label: "ডিজিটাল আইডি কার্ড", icon: IdCard },
    { href: "/portal/certificates", label: "সনদপত্র ও প্রত্যয়ন", icon: Award },
    { href: "/portal/attendance", label: "দৈনিক হাজিরা রেকর্ড", icon: Calendar },
    { href: "/portal/academic", label: "হিফজ ও কিতাবাত অগ্রগতি", icon: GraduationCap },
    { href: "/portal/exams", label: "পরীক্ষা ও ফলাফল শিট", icon: Award },
    { href: "/portal/fees", label: "ফি ও পেমেন্ট হিস্ট্রি", icon: CreditCard },
    { href: "/portal/feedback", label: "অভিযোগ, পরামর্শ ও সাক্ষাতকার", icon: MessageSquarePlus },
    { href: "/portal/routine", label: "ক্লাস ও পরীক্ষার রুটিন", icon: CalendarDays },
    { href: "/portal/holidays", label: "ছুটির ক্যালেন্ডার ও বন্ধ", icon: CalendarDays },
    { href: "/portal/notices", label: "মাদরাসা নোটিশ বোর্ড", icon: Bell },
    { href: "/portal/leave", label: "ছুটির আবেদন ও বার্তা", icon: Send },
  ];

  return (
    <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
      {links.map((link) => {
        const active = link.exact
          ? pathname === link.href
          : pathname === link.href || pathname.startsWith(link.href + "/");
        const Icon = link.icon;
        const targetHref = studentId ? `${link.href}?student_id=${studentId}` : link.href;

        return (
          <Link
            key={link.href}
            href={targetHref}
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
