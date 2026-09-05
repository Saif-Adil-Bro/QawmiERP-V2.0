import { getPublicHolidaysForPortal } from "@/app/actions/holidays";
import { 
  CalendarDays, Calendar, Clock, Sparkles, CheckCircle2, 
  AlertCircle, Info, ChevronRight, Download, Send, ArrowRight
} from "lucide-react";
import Link from "next/link";
import { toBanglaNumber } from "@/lib/numberToBangla";

export const dynamic = "force-dynamic";

export default async function PortalHolidaysPage() {
  const holidays = await getPublicHolidaysForPortal();

  const today = new Date().toISOString().split("T")[0];
  const ongoingHolidays = holidays.filter((h) => today >= h.start_date && today <= h.end_date);
  const upcomingHolidays = holidays.filter((h) => today < h.start_date);
  const pastHolidays = holidays.filter((h) => today > h.end_date);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 text-white rounded-3xl p-6 shadow-lg border border-emerald-900/60 flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
              মাদরাসা ক্যালেন্ডার ও অবকাশ
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/40 font-medium">
              অফিসিয়াল ছুটির তালিকা
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black">
            ছুটির নোটিশ ও একাডেমিক ক্যালেন্ডার
          </h1>
          <p className="text-xs sm:text-sm text-emerald-200 mt-1 max-w-xl">
            পরীক্ষার ছুটি, ঈদের ছুটি, রমজান ও বার্ষিক অবকাশের নির্ধারিত তারিখ ও মাদরাসা খোলার নোটিশ
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/portal/leave"
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs sm:text-sm font-bold transition flex items-center gap-2 shadow-md shadow-emerald-950/40"
          >
            <Send className="w-4 h-4" />
            ব্যক্তিগত ছুটির আবেদন
          </Link>
        </div>
      </div>

      {/* Ongoing Holiday Banner (if any) */}
      {ongoingHolidays.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-amber-900 flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
            </span>
            বর্তমানে চলমান ছুটি
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ongoingHolidays.map((h) => (
              <div
                key={h.id}
                className="bg-gradient-to-br from-amber-50 to-orange-50/50 rounded-2xl border border-amber-300 p-5 shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-800 bg-amber-200/60 px-2.5 py-0.5 rounded-full">
                    চলমান অবকাশ
                  </span>
                  <span className="text-xs font-semibold text-amber-900">
                    মোট {toBanglaNumber(h.total_days || 1)} দিন
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-slate-900">{h.title}</h3>
                  <p className="text-xs text-slate-600 mt-1">
                    {h.start_date} হতে {h.end_date} পর্যন্ত
                  </p>
                </div>

                {h.reopen_date && (
                  <div className="p-3 bg-white/80 rounded-xl border border-amber-200 text-xs text-slate-800 flex items-center justify-between">
                    <span className="font-medium text-slate-600">মাদরাসা খোলার তারিখ:</span>
                    <strong className="text-emerald-700 font-bold">{h.reopen_date}</strong>
                  </div>
                )}

                {h.description && (
                  <p className="text-xs text-slate-700 leading-relaxed bg-white/60 p-2.5 rounded-lg border border-amber-100">
                    {h.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Holidays Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-emerald-600" />
            আসন্ন ছুটির তালিকা ও নোটিশ
          </h2>
          <span className="text-xs text-slate-500">
            মোট {toBanglaNumber(upcomingHolidays.length)} টি ছুটি নির্ধারিত
          </span>
        </div>

        {upcomingHolidays.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500 text-xs sm:text-sm">
            আপাতত কোনো আসন্ন ছুটির নোটিশ নেই। মাদরাসা কর্তৃপক্ষ কোনো নতুন ছুটি ঘোষণা করলে এখানে দেখতে পাবেন।
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcomingHolidays.map((h) => (
              <div
                key={h.id}
                className="bg-white rounded-2xl border border-slate-200 hover:border-emerald-300 hover:shadow-md transition-all p-5 flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                      আসন্ন ছুটি
                    </span>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                      {toBanglaNumber(h.total_days || 1)} দিন
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-800 leading-snug">
                      {h.title}
                    </h3>
                    {h.notice_number && (
                      <span className="text-[11px] text-slate-400 font-mono block mt-0.5">
                        স্মারক: {h.notice_number}
                      </span>
                    )}
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-slate-600">
                      <span>ছুটির তারিখ:</span>
                      <strong className="text-slate-800">{h.start_date} হতে {h.end_date}</strong>
                    </div>

                    {h.reopen_date && (
                      <div className="flex items-center justify-between pt-1 border-t border-slate-200 text-indigo-900">
                        <span className="text-slate-600">খোলার তারিখ:</span>
                        <strong className="text-indigo-700">{h.reopen_date}</strong>
                      </div>
                    )}
                  </div>

                  {h.description && (
                    <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed bg-slate-50/50 p-2.5 rounded-lg border border-slate-100">
                      {h.description}
                    </p>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
                  <span>প্রযোজ্য: {h.applicable_to === "all" ? "সকল বিভাগ" : "নির্দিষ্ট বিভাগ"}</span>
                  <span className="text-emerald-600 font-medium">অফিসিয়াল নোটিশ</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Past Holidays History */}
      {pastHolidays.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-slate-200">
          <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            বিগত ছুটির রেকর্ড ({toBanglaNumber(pastHolidays.length)})
          </h2>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-500 uppercase tracking-wider">
                    <th className="px-4 py-3">ছুটির নাম</th>
                    <th className="px-4 py-3">সময়কাল</th>
                    <th className="px-4 py-3">মোট দিন</th>
                    <th className="px-4 py-3">খোলার তারিখ</th>
                    <th className="px-4 py-3 text-right">স্ট্যাটাস</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {pastHolidays.map((h) => (
                    <tr key={h.id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-3 font-semibold text-slate-800">{h.title}</td>
                      <td className="px-4 py-3 text-slate-600">{h.start_date} হতে {h.end_date}</td>
                      <td className="px-4 py-3 font-medium">{toBanglaNumber(h.total_days || 1)} দিন</td>
                      <td className="px-4 py-3 text-slate-600">{h.reopen_date || "—"}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600">
                          সম্পন্ন
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
