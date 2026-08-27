"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Layers, 
  Users, 
  HeartHandshake, 
  FileText,
  PlusCircle
} from "lucide-react";

export default function ZakatNav({ 
  totalFundsCount,
  totalDonorsCount
}: { 
  totalFundsCount?: number;
  totalDonorsCount?: number;
}) {
  const pathname = usePathname();

  const navItems = [
    {
      name: "ওভারভিউ",
      href: "/dashboard/zakat",
      icon: LayoutDashboard,
      exact: true,
    },
    {
      name: "ফান্ড ক্যাটাগরি",
      href: "/dashboard/zakat/funds",
      icon: Layers,
      count: totalFundsCount,
    },
    {
      name: "দাতাদের তালিকা",
      href: "/dashboard/zakat/donors",
      icon: Users,
      count: totalDonorsCount,
    },
    {
      name: "যাকাত ও অনুদান সংগ্রহ",
      href: "/dashboard/zakat/collection",
      icon: HeartHandshake,
    },
    {
      name: "ফান্ড রিপোর্টস",
      href: "/dashboard/zakat/reports",
      icon: FileText,
    },
  ];

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2 sm:p-2.5 rounded-2xl border border-slate-200 shadow-xs">
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        {navItems.map((item) => {
          const isActive = item.exact 
            ? pathname === item.href 
            : pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                isActive
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? "text-emerald-400" : "text-slate-500"}`} />
              <span>{item.name}</span>
              {typeof item.count === "number" && (
                <span className={`text-[11px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                  isActive ? "bg-slate-800 text-slate-200" : "bg-slate-100 text-slate-600"
                }`}>
                  {item.count}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <Link
          href="/dashboard/zakat/collection"
          className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 text-white rounded-xl text-xs sm:text-sm font-bold hover:bg-emerald-700 transition shadow-xs cursor-pointer active:scale-98"
        >
          <PlusCircle className="w-4 h-4" />
          <span>+ নতুন কালেকশন</span>
        </Link>
      </div>
    </div>
  );
}
