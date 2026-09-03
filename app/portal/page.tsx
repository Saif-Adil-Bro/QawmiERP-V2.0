import { createClient } from "@/lib/supabase/server";
import {
  GraduationCap,
  Calendar,
  CreditCard,
  AlertCircle,
  Award,
  BookOpen,
  CalendarDays,
  Bell,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
  TrendingUp,
  Star,
} from "lucide-react";
import Link from "next/link";
import { toBanglaNumber } from "@/lib/numberToBangla";

export const dynamic = "force-dynamic";

export default async function PortalOverview(props: {
  searchParams?: Promise<{ student_id?: string }>;
}) {
  const params = props.searchParams ? (await props.searchParams) || {} : {};
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // Get user's madrasa & profile
  const { data: userData } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  const madrasaId = userData?.madrasa_id;

  // Get data access scope (filters by linked children for parents)
  const { getUserDataAccessScope } = await import("@/lib/data-access-guards");
  const scope = await getUserDataAccessScope();

  // Fetch students for this parent / user
  let studentsQuery = supabase
    .from("students")
    .select("*, classes(name)")
    .eq("madrasa_id", madrasaId)
    .order("roll_number", { ascending: true });

  if (!scope.isUnrestricted) {
    if (scope.allowedStudentIds.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center p-8 bg-white rounded-2xl shadow-xs border border-slate-200 text-center">
          <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mb-3">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-800">কোন শিক্ষার্থীর তথ্য পাওয়া যায়নি</h2>
          <p className="text-sm text-slate-500 mt-1 max-w-md">
            আপনার অ্যাকাউন্টের সাথে সন্তানের প্রোফাইল লিঙ্ক করা নেই। মাদরাসা কর্তৃপক্ষের সাথে যোগাযোগ করে অভিভাবক নম্বর/ইমেইল আপডেট করুন।
          </p>
        </div>
      );
    }
    studentsQuery = studentsQuery.in("id", scope.allowedStudentIds);
  }

  const { data: students } = await studentsQuery;

  if (!students || students.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-white rounded-2xl shadow-xs border border-slate-200 text-center">
        <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mb-3">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-bold text-slate-800">কোন শিক্ষার্থীর তথ্য পাওয়া যায়নি</h2>
        <p className="text-sm text-slate-500 mt-1 max-w-md">
          আপনার অ্যাকাউন্টের সাথে শিক্ষার্থীর প্রোফাইল সংযুক্ত করতে মাদরাসা কর্তৃপক্ষের সাথে যোগাযোগ করুন।
        </p>
      </div>
    );
  }

  // Selected child
  const selectedStudentId = params.student_id || students[0]?.id;
  const child = students.find((s) => s.id === selectedStudentId) || students[0];

  // Fetch student's attendance records
  const { data: attendanceList } = await supabase
    .from("attendance")
    .select("*")
    .eq("student_id", child.id)
    .order("date", { ascending: false });

  // Calculate attendance statistics
  const totalDays = attendanceList?.length || 0;
  const presentDays = attendanceList?.filter((a) => a.status === "Present").length || 0;
  const absentDays = attendanceList?.filter((a) => a.status === "Absent").length || 0;
  const lateDays = attendanceList?.filter((a) => a.status === "Late" || a.status === "Leave").length || 0;
  const attendanceRate = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 100;

  // Fetch latest Hifz log
  const { data: latestHifz } = await supabase
    .from("hifz_logs")
    .select("*")
    .eq("student_id", child.id)
    .order("log_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Fetch fees records
  const { data: feesList } = await supabase
    .from("fees")
    .select("*")
    .eq("student_id", child.id)
    .order("payment_date", { ascending: false });

  const totalPaid = feesList?.reduce((acc, curr) => acc + (Number(curr.amount_paid) || 0), 0) || 0;

  // Fetch latest exam results
  const { data: examResults } = await supabase
    .from("exam_results")
    .select("*, exams(title, year)")
    .eq("student_id", child.id)
    .order("created_at", { ascending: false })
    .limit(4);

  // Fetch recent madrasa notices
  const { data: notices } = await supabase
    .from("notices")
    .select("*")
    .eq("madrasa_id", madrasaId)
    .order("created_at", { ascending: false })
    .limit(3);

  return (
    <div className="space-y-6">
      {/* Child Profile Hero Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white rounded-3xl p-5 sm:p-7 shadow-xl border border-emerald-800/60 flex flex-col md:flex-row md:items-center justify-between gap-5 relative overflow-hidden">
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/20 flex items-center justify-center text-white font-bold text-2xl sm:text-3xl shadow-inner shrink-0">
            {(child.first_name || "শ")[0]}
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 text-[11px] font-bold mb-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>নিয়মিত শিক্ষার্থী</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              {child.first_name} {child.last_name}
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-emerald-100/90 mt-1">
              <span><strong>রোল নম্বর:</strong> {toBanglaNumber(child.roll_number || child.student_id || "১")}</span>
              <span>•</span>
              <span><strong>জামাত / শ্রেণি:</strong> {child.classes?.name || child.class_name || "হিফজুল কুরআন"}</span>
              {child.father_name && (
                <>
                  <span>•</span>
                  <span><strong>পিতা:</strong> {child.father_name}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 relative z-10 shrink-0">
          <Link
            href="/portal/attendance"
            className="px-4 py-2.5 bg-white/15 hover:bg-white/25 text-white rounded-xl text-xs sm:text-sm font-bold backdrop-blur-xs border border-white/20 transition flex items-center gap-2"
          >
            <Calendar className="w-4 h-4 text-emerald-300" />
            <span>হাজিরা রেকর্ড</span>
          </Link>
          <Link
            href="/portal/exams"
            className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs sm:text-sm font-bold shadow-lg shadow-emerald-950/50 transition flex items-center gap-2"
          >
            <Award className="w-4 h-4" />
            <span>ফলাফল শিট</span>
          </Link>
        </div>
      </div>

      {/* 4 Rich KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Attendance KPI */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-emerald-300 transition group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">উপস্থিতির হার</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl group-hover:scale-110 transition">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">{toBanglaNumber(attendanceRate)}%</span>
            <span className="text-xs font-semibold text-emerald-600">সন্তোষজনক</span>
          </div>
          <div className="w-full bg-slate-100 h-2 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(attendanceRate, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-slate-500 mt-2 font-medium">
            <span>উপস্থিত: {toBanglaNumber(presentDays)} দিন</span>
            <span>অনুপস্থিত: {toBanglaNumber(absentDays)} দিন</span>
          </div>
        </div>

        {/* Hifz Sabak KPI */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-teal-300 transition group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">চলমান সবক (হিফজ)</span>
            <div className="p-2 bg-teal-50 text-teal-600 rounded-xl group-hover:scale-110 transition">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="min-h-[38px] flex flex-col justify-center">
            <span className="text-lg sm:text-xl font-bold text-slate-900 truncate">
              {latestHifz?.para_number ? `পারা: ${toBanglaNumber(latestHifz.para_number)}` : "দৈনিক সবক চলমান"}
            </span>
            <span className="text-xs text-slate-500 truncate">
              {latestHifz?.surah_name ? `সূরা: ${latestHifz.surah_name}` : "শিক্ষক কর্তৃক আপডেটেড"}
            </span>
          </div>
          <div className="flex items-center gap-1 mt-3 text-amber-500 text-xs font-bold bg-amber-50 py-1 px-2 rounded-lg border border-amber-200/60 w-fit">
            <Star className="w-3.5 h-3.5 fill-current" />
            <span>মূল্যায়ন: {latestHifz?.performance || "মুমতাজ (চমৎকার)"}</span>
          </div>
        </div>

        {/* Fees KPI */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-blue-300 transition group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">পরিশোধিত ফি</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl group-hover:scale-110 transition">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">৳{toBanglaNumber(totalPaid)}</span>
          </div>
          <p className="text-xs text-emerald-600 font-semibold mt-2 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>হালনাগাদ ফি পরিশোধিত</span>
          </p>
          <div className="mt-2 text-[11px] text-slate-500">
            সর্বশেষ রশিদ: {feesList?.[0]?.receipt_number || "স্বয়ংক্রিয় রসিদ"}
          </div>
        </div>

        {/* Exam Result KPI */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-purple-300 transition group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">সর্বশেষ পরীক্ষার গ্রেড</span>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl group-hover:scale-110 transition">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-purple-700">A+ (মুমতাজ)</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            পরীক্ষা: {examResults?.[0]?.exams?.title || (examResults?.[0]?.exams as any)?.name || "সাময়িক পরীক্ষা"}
          </p>
          <div className="mt-2 text-[11px] text-purple-600 font-bold flex items-center gap-1">
            <span>মার্কশিট দেখুন</span>
            <ChevronRight className="w-3 h-3" />
          </div>
        </div>
      </div>

      {/* Quick Action Navigation Tiles */}
      <div>
        <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-600" />
          <span>প্যারেন্ট পোর্টাল শর্টকাট মেনু</span>
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Link
            href="/portal/attendance"
            className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs hover:border-emerald-500 hover:shadow-md transition text-center flex flex-col items-center group"
          >
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-2 group-hover:scale-110 transition">
              <Calendar className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-800">দৈনিক হাজিরা</span>
            <span className="text-[10px] text-slate-400 mt-0.5">মাসিক উপস্থিতি</span>
          </Link>

          <Link
            href="/portal/academic"
            className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs hover:border-teal-500 hover:shadow-md transition text-center flex flex-col items-center group"
          >
            <div className="w-11 h-11 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center mb-2 group-hover:scale-110 transition">
              <BookOpen className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-800">হিফজ ও পাঠ</span>
            <span className="text-[10px] text-slate-400 mt-0.5">সবক ও আমুখতা</span>
          </Link>

          <Link
            href="/portal/exams"
            className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs hover:border-purple-500 hover:shadow-md transition text-center flex flex-col items-center group"
          >
            <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center mb-2 group-hover:scale-110 transition">
              <Award className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-800">পরীক্ষার ফলাফল</span>
            <span className="text-[10px] text-slate-400 mt-0.5">মার্কশিট ও সনদ</span>
          </Link>

          <Link
            href="/portal/fees"
            className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs hover:border-blue-500 hover:shadow-md transition text-center flex flex-col items-center group"
          >
            <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center mb-2 group-hover:scale-110 transition">
              <CreditCard className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-800">ফি ও রশিদ</span>
            <span className="text-[10px] text-slate-400 mt-0.5">পেমেন্ট হিস্ট্রি</span>
          </Link>

          <Link
            href="/portal/routine"
            className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs hover:border-amber-500 hover:shadow-md transition text-center flex flex-col items-center group"
          >
            <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center mb-2 group-hover:scale-110 transition">
              <CalendarDays className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-800">ক্লাস রুটিন</span>
            <span className="text-[10px] text-slate-400 mt-0.5">ঘণ্টা ও বিষয়</span>
          </Link>

          <Link
            href="/portal/leave"
            className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs hover:border-rose-500 hover:shadow-md transition text-center flex flex-col items-center group"
          >
            <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center mb-2 group-hover:scale-110 transition">
              <Send className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-800">ছুটির আবেদন</span>
            <span className="text-[10px] text-slate-400 mt-0.5">বার্তা ও ছুটি</span>
          </Link>
        </div>
      </div>

      {/* Two Column Layout: Recent Attendance Log & Notices */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attendance Activity Log */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-600" />
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">সর্বশেষ হাজিরা বিবরণ</h3>
            </div>
            <Link
              href="/portal/attendance"
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-0.5"
            >
              <span>বিস্তারিত দেখুন</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="p-4 sm:p-5 divide-y divide-slate-100">
            {attendanceList && attendanceList.length > 0 ? (
              attendanceList.slice(0, 5).map((record) => (
                <div key={record.id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-xl shrink-0 ${
                        record.status === "Present"
                          ? "bg-emerald-50 text-emerald-600"
                          : record.status === "Absent"
                          ? "bg-red-50 text-red-600"
                          : "bg-amber-50 text-amber-600"
                      }`}
                    >
                      {record.status === "Present" ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : record.status === "Absent" ? (
                        <XCircle className="w-4 h-4" />
                      ) : (
                        <Clock className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm font-bold text-slate-800">
                        {new Date(record.date).toLocaleDateString("bn-BD", {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {record.notes ? `মন্তব্য: ${record.notes}` : "স্বাভাবিক উপস্থিতি"}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold ${
                      record.status === "Present"
                        ? "bg-emerald-100 text-emerald-800"
                        : record.status === "Absent"
                        ? "bg-red-100 text-red-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {record.status === "Present"
                      ? "উপস্থিত"
                      : record.status === "Absent"
                      ? "অনুপস্থিত"
                      : record.status === "Late"
                      ? "বিলম্ব"
                      : "ছুটি"}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center py-6 text-slate-400 text-xs font-medium">
                কোন সাম্প্রতিক হাজিরার তথ্য পাওয়া যায়নি।
              </div>
            )}
          </div>
        </div>

        {/* Notices & Announcements */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-indigo-600" />
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">মাদরাসা নোটিশ ও ঘোষণা</h3>
            </div>
            <Link
              href="/portal/notices"
              className="text-xs font-bold text-indigo-700 hover:text-indigo-800 flex items-center gap-0.5"
            >
              <span>সকল নোটিশ</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="p-4 sm:p-5 space-y-3">
            {notices && notices.length > 0 ? (
              notices.map((n) => (
                <div
                  key={n.id}
                  className="p-3.5 bg-slate-50 hover:bg-indigo-50/40 rounded-xl border border-slate-200 transition space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                      {n.category || "সাধারণ নোটিশ"}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {n.created_at ? new Date(n.created_at).toLocaleDateString("bn-BD") : "-"}
                    </span>
                  </div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-800">{n.title}</h4>
                  <p className="text-xs text-slate-500 line-clamp-2">{n.content}</p>
                </div>
              ))
            ) : (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-center text-xs text-slate-500">
                বর্তমানে কোন নতুন নোটিশ নেই।
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
