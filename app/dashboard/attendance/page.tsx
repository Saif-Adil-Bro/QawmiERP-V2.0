import Link from "next/link";
import { Users, GraduationCap, CalendarDays, FileBarChart, Sparkles, Sun, CheckCircle2 } from "lucide-react";

export default function AttendanceDashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">হাজিরা ও ছুটি ব্যবস্থাপনা (Attendance & Leaves)</h1>
          <p className="text-slate-500 text-xs sm:text-sm">
            শিক্ষার্থী ও স্টাফদের দৈনিক উপস্থিতি, মাসিক রিপোর্ট, সাপ্তাহিক বন্ধ ও শিক্ষাবর্ষের ছুটির তালিকা
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <Link href="/dashboard/attendance/students" className="block">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md hover:border-blue-300 transition group cursor-pointer h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center space-x-3 mb-3">
                <div className="bg-blue-50 p-3 rounded-xl group-hover:bg-blue-100 transition text-blue-600">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <h2 className="text-base font-bold text-slate-800">শিক্ষার্থী উপস্থিতি</h2>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                জামাত ও শাখা অনুযায়ী শিক্ষার্থীদের দৈনিক উপস্থিতি ও অনুপস্তিতি এন্ট্রি করুন।
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 text-xs font-semibold text-blue-600 flex items-center gap-1 group-hover:translate-x-1 transition">
              হাজিরা গ্রহণ করুন &rarr;
            </div>
          </div>
        </Link>

        <Link href="/dashboard/attendance/teachers" className="block">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md hover:border-emerald-300 transition group cursor-pointer h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center space-x-3 mb-3">
                <div className="bg-emerald-50 p-3 rounded-xl group-hover:bg-emerald-100 transition text-emerald-600">
                  <Users className="w-6 h-6" />
                </div>
                <h2 className="text-base font-bold text-slate-800">স্টাফ উপস্থিতি</h2>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                শিক্ষক ও কর্মচারীদের আগমন, প্রস্থান ও দৈনিক ছুটির রেকর্ড সংরক্ষণ করুন।
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 text-xs font-semibold text-emerald-600 flex items-center gap-1 group-hover:translate-x-1 transition">
              স্টাফ হাজিরা &rarr;
            </div>
          </div>
        </Link>

        <Link href="/dashboard/attendance/holidays" className="block">
          <div className="bg-white p-5 rounded-2xl border border-amber-200 shadow-xs hover:shadow-md hover:border-amber-400 ring-1 ring-amber-400/20 transition group cursor-pointer h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className="bg-amber-50 p-3 rounded-xl group-hover:bg-amber-100 transition text-amber-600">
                    <CalendarDays className="w-6 h-6" />
                  </div>
                  <h2 className="text-base font-bold text-slate-800">ছুটি ও অবকাশ</h2>
                </div>
                <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                  নতুন
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                সাময়িক পরীক্ষার ছুটি, ঈদের ছুটি, রমজান ও বার্ষিক ছুটির নোটিশ ও ক্যালেন্ডার।
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 text-xs font-semibold text-amber-700 flex items-center gap-1 group-hover:translate-x-1 transition">
              ছুটি পরিচালনা করুন &rarr;
            </div>
          </div>
        </Link>

        <Link href="/dashboard/attendance/reports" className="block">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:shadow-md hover:border-purple-300 transition group cursor-pointer h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center space-x-3 mb-3">
                <div className="bg-purple-50 p-3 rounded-xl group-hover:bg-purple-100 transition text-purple-600">
                  <FileBarChart className="w-6 h-6" />
                </div>
                <h2 className="text-base font-bold text-slate-800">উপস্থিতি রিপোর্ট</h2>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                মাসিক ও বার্ষিক উপস্থিতির সারাংশ ও পার্সেন্টেজ রিপোর্ট ডাউনলোড করুন।
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 text-xs font-semibold text-purple-600 flex items-center gap-1 group-hover:translate-x-1 transition">
              রিপোর্ট দেখুন &rarr;
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
