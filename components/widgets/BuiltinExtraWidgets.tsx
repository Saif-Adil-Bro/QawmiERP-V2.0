"use client";

import React from "react";
import Link from "next/link";
import {
  Calendar,
  Clock,
  UserPlus,
  Banknote,
  CheckSquare,
  ShieldCheck,
  Puzzle,
  ArrowRight,
} from "lucide-react";

export function PrayerHijriWidget() {
  const now = new Date();
  let hijriDate = "";
  let gregDate = "";

  try {
    hijriDate = new Intl.DateTimeFormat("bn-BD-u-ca-islamic", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Asia/Dhaka",
    }).format(now);
  } catch {
    hijriDate = "হিজরি ক্যালেন্ডার";
  }

  try {
    gregDate = new Intl.DateTimeFormat("bn-BD", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Asia/Dhaka",
    }).format(now);
  } catch {
    gregDate = now.toDateString();
  }

  const prayers = [
    { name: "ফজর", time: "০৪:৫৫ AM" },
    { name: "যোহর", time: "১২:০০ PM" },
    { name: "আসর", time: "০৩:৪৫ PM" },
    { name: "মাগরিব", time: "০৫:১৫ PM" },
    { name: "এশা", time: "০৬:৪৫ PM" },
  ];

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold text-sm">
            <Calendar className="w-4 h-4" />
            <span>হিজরি তারিখ ও নামাজের সময়সূচি</span>
          </div>
          <p className="text-lg font-extrabold text-slate-900 dark:text-slate-100 mt-1">
            {hijriDate}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{gregDate}</p>
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
          <Clock className="w-3 h-3" />
          ঢাকা
        </span>
      </div>

      <div className="grid grid-cols-5 gap-2 pt-1">
        {prayers.map((p) => (
          <div
            key={p.name}
            className="rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-100 dark:border-slate-700 p-2 text-center"
          >
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              {p.name}
            </div>
            <div className="text-xs font-bold text-slate-800 dark:text-slate-100 mt-0.5">
              {p.time}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function QuickActionsWidget() {
  const actions = [
    {
      label: "নতুন শিক্ষার্থী ভর্তি",
      href: "/dashboard/students/new",
      icon: UserPlus,
      color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
    },
    {
      label: "ফি কালেকশন",
      href: "/dashboard/accounting/fees/new",
      icon: Banknote,
      color: "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300",
    },
    {
      label: "দৈনিক হাজিরা",
      href: "/dashboard/attendance/students",
      icon: CheckSquare,
      color: "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
    },
    {
      label: "অনুমোদন কিউ",
      href: "/dashboard/approvals",
      icon: ShieldCheck,
      color: "bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300",
    },
  ];

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100 font-bold text-sm">
          <Puzzle className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span>দ্রুত অ্যাকশন ও শর্টকাট</span>
        </div>
        <Link
          href="/dashboard/settings/widgets"
          className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
        >
          উইজেট ম্যানেজার
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {actions.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition"
            >
              <div className={`p-2 rounded-lg shrink-0 ${item.color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-snug">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
