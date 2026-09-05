import { getAcademicHolidays } from "@/app/actions/holidays";
import { getClasses } from "@/app/actions/students";
import { getMadrasaProfileWithLogo } from "@/app/actions/tenant";
import HolidaysClient from "./HolidaysClient";
import Link from "next/link";
import { CalendarDays, ArrowLeft, Plus } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AcademicHolidaysPage() {
  const [holidays, classes, madrasaInfo] = await Promise.all([
    getAcademicHolidays(true), // include archived to allow filter toggle
    getClasses(),
    getMadrasaProfileWithLogo(),
  ]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4 print:hidden">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <Link href="/dashboard/attendance" className="hover:text-emerald-600 transition">
              হাজিরা ও ছুটি
            </Link>
            <span>/</span>
            <span className="text-slate-800 font-medium">ছুটি ও অবকাশ ব্যবস্থাপনা</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2.5">
            <CalendarDays className="w-7 h-7 text-emerald-600" />
            ছুটি ও অবকাশ ব্যবস্থাপনা (Academic Holidays & Vacations)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            প্রথম সাময়িক, ঈদুল ফিতর, ঈদুল আযহা, রমজান ও অন্যান্য সাধারণ ছুটির তালিকা, নোটিশ ও পোর্টাল সমন্বয়
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/dashboard/attendance"
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition flex items-center gap-1.5 shadow-xs"
          >
            <ArrowLeft className="w-4 h-4 text-slate-500" />
            হাজিরা ড্যাশবোর্ড
          </Link>
        </div>
      </div>

      {/* Client Component */}
      <HolidaysClient
        initialHolidays={holidays}
        classes={classes || []}
        madrasaInfo={madrasaInfo}
      />
    </div>
  );
}
