import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import {
  GraduationCap,
  Calendar,
  BookOpen,
  ClipboardList,
  FileText,
  CalendarDays,
  Users,
  Bell,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  MapPin,
  Coffee,
} from "lucide-react";
import Link from "next/link";
import { toBanglaNumber } from "@/lib/numberToBangla";
import { getEarlyWarningAlerts } from "@/app/actions/early-warning";
import { getTeacherAcademicSchedule } from "@/app/actions/teacher_subjects";
import { formatTimeString } from "@/lib/routine-helper";
import EarlyWarningWidget from "@/components/EarlyWarningWidget";

export const dynamic = "force-dynamic";

export default async function TeacherPortalOverview() {
  const supabase = await createClient();
  const adminClient = await createAdminClient();
  const user = await getAuthUser(supabase);

  if (!user) return null;

  const { data: userData } = await adminClient
    .from("users")
    .select("madrasa_id, full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  let madrasaId = userData?.madrasa_id;
  if (!madrasaId) {
    const { data: anyM } = await adminClient.from("madrasas").select("id").limit(1).single();
    madrasaId = anyM?.id || "";
  }

  // Find teacher record
  let teacherId = "";
  let teacherName = userData?.full_name || "মুহতারাম উস্তাদ";
  let designation = "মুদাররিস";

  const { data: teacher } = await adminClient
    .from("teachers")
    .select("id, first_name, last_name, designation, phone")
    .eq("madrasa_id", madrasaId)
    .or(`email.eq.${user.email},auth_user_id.eq.${user.id}`)
    .maybeSingle();

  if (teacher) {
    teacherId = teacher.id;
    teacherName = `${teacher.first_name || ""} ${teacher.last_name || ""}`.trim() || teacherName;
    designation = teacher.designation || designation;
  }

  // Fallback to staff metadata if needed
  if (!teacherId) {
    const { getMadrasaMetadata } = await import("@/lib/sessions");
    const meta = (await getMadrasaMetadata(madrasaId)) as any;
    const staffMembers = meta?.staff_members || [];
    const staff = staffMembers.find((s: any) => 
      (user.email && s.contact?.email?.toLowerCase() === user.email.toLowerCase()) ||
      (s.personal?.first_name && userData?.full_name?.includes(s.personal.first_name))
    );
    if (staff) {
      teacherId = staff.id;
      teacherName = staff.personal?.full_name_bn || `${staff.personal?.first_name || ""} ${staff.personal?.last_name || ""}`.trim() || teacherName;
      designation = staff.employment?.designation || designation;
    }
  }

  const todayStr = new Date().toISOString().split("T")[0];

  const [classesRes, studentsRes, todayAttendanceRes, todayHifzRes, noticesRes, earlyWarningData, teacherSchedule] = await Promise.all([
    adminClient.from("classes").select("id, name").eq("madrasa_id", madrasaId),
    adminClient.from("students").select("id").eq("madrasa_id", madrasaId),
    adminClient.from("attendance").select("id").eq("madrasa_id", madrasaId).eq("date", todayStr),
    adminClient.from("hifz_logs").select("id").eq("madrasa_id", madrasaId).eq("log_date", todayStr),
    adminClient.from("notices").select("*").eq("madrasa_id", madrasaId).order("created_at", { ascending: false }).limit(3),
    getEarlyWarningAlerts(),
    getTeacherAcademicSchedule(teacherId || user.id),
  ]);

  const totalClasses = classesRes.data?.length || 0;
  const totalStudents = studentsRes.data?.length || 0;
  const todayAttendanceCount = todayAttendanceRes.data?.length || 0;
  const todayHifzCount = todayHifzRes.data?.length || 0;

  // Compute Today's classes from weekly routine
  const dayNamesEnglish = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const todayEnglish = dayNamesEnglish[new Date().getDay()];
  const todayBanglaMap: Record<string, string> = {
    Saturday: "শনিবার",
    Sunday: "রবিবার",
    Monday: "সোমবার",
    Tuesday: "মঙ্গলবার",
    Wednesday: "বুধবার",
    Thursday: "বৃহস্পতিবার",
    Friday: "শুক্রবার",
  };
  const todayBangla = todayBanglaMap[todayEnglish] || todayEnglish;

  const todayClasses = teacherSchedule.routines.filter(
    (r) => r.day_of_week === todayEnglish || r.day_of_week === todayBangla
  );

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white rounded-3xl p-5 sm:p-7 shadow-xl border border-emerald-900/60 flex flex-col md:flex-row md:items-center justify-between gap-5 relative overflow-hidden">
        <div className="relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs font-bold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>আসসালামু আলাইকুম ওয়া রাহমাতুল্লাহ</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
            স্বাগতম, {teacherName}
          </h1>
          <p className="text-xs sm:text-sm text-emerald-100/80 mt-1">
            পদবি: <strong>{designation}</strong> | আজকের তারিখ: {new Date().toLocaleDateString("bn-BD", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>

        <div className="flex items-center gap-2.5 relative z-10 shrink-0">
          <Link
            href="/teacher-portal/attendance"
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-lg shadow-emerald-950/40 transition flex items-center gap-2"
          >
            <Calendar className="w-4 h-4" />
            <span>হাজিরা গ্রহণ করুন</span>
          </Link>
          <Link
            href="/teacher-portal/routine"
            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs sm:text-sm font-bold backdrop-blur-xs border border-white/20 transition flex items-center gap-2"
          >
            <CalendarDays className="w-4 h-4 text-emerald-300" />
            <span>আমার ক্লাস রুটিন</span>
          </Link>
        </div>
      </div>

      {/* In-Charge Classes Announcement Card */}
      {teacherSchedule.inChargeClasses.length > 0 && (
        <div className="bg-gradient-to-r from-teal-900 via-slate-900 to-emerald-900 text-white p-5 rounded-2xl border border-teal-700/50 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-teal-500/20 text-teal-300 rounded-2xl border border-teal-400/30">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-teal-400 text-teal-950 rounded-full uppercase tracking-wider">
                শ্রেণি জিম্মাদারি দায়িত্ব
              </span>
              <h3 className="text-base sm:text-lg font-black mt-1">
                {teacherSchedule.inChargeClasses.map(c => c.class_name).join(", ")}
              </h3>
              <p className="text-xs text-teal-100/80 mt-0.5">
                আপনি উপরোক্ত জামাতের প্রধান জিম্মাদার শিক্ষক। ছাত্র উপস্থিতি, পাঠদান শৃঙ্খলা ও সার্বিক তত্ত্বাবধান পরিচালনা করুন।
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/teacher-portal/students"
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl border border-white/20 transition"
            >
              শিক্ষার্থী তালিকা
            </Link>
            <Link
              href="/teacher-portal/attendance"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition"
            >
              হাজিরা নিন
            </Link>
          </div>
        </div>
      )}

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase">বরাদ্দকৃত কিতাব</p>
            <p className="text-xl sm:text-2xl font-bold text-slate-900">
              {toBanglaNumber(teacherSchedule.assignedSubjects.length)} টি
            </p>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-indigo-50 text-indigo-700 rounded-xl">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase">আজকের ক্লাস</p>
            <p className="text-xl sm:text-2xl font-bold text-indigo-700">
              {toBanglaNumber(todayClasses.length)} টি
            </p>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-teal-50 text-teal-700 rounded-xl">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-teal-700 uppercase">আজকের হাজিরা</p>
            <p className="text-xl sm:text-2xl font-bold text-slate-900">
              {todayAttendanceCount > 0 ? `${toBanglaNumber(todayAttendanceCount)} জন` : "শুরু করুন"}
            </p>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-3 bg-purple-50 text-purple-700 rounded-xl">
            <ClipboardList className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-purple-700 uppercase">আজকের সবক এন্ট্রি</p>
            <p className="text-xl sm:text-2xl font-bold text-slate-900">{toBanglaNumber(todayHifzCount)} টি</p>
          </div>
        </div>
      </div>

      {/* Today's Teaching Schedule Card (আজকের পাঠদান রুটিন) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <Clock className="w-5 h-5 text-indigo-600" />
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                আজকের পাঠদান রুটিন ও সময়সূচি ({todayBangla})
              </h3>
              <p className="text-xs text-slate-500">
                আজকের নির্ধারিত ক্লাস, সময় ও ক্লাসরুম নম্বর
              </p>
            </div>
          </div>

          <Link
            href="/teacher-portal/routine"
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 self-start sm:self-auto"
          >
            <span>সম্পূর্ণ সপ্তাহের রুটিন দেখুন</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {todayClasses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {todayClasses.map((r, idx) => {
              const start = formatTimeString(r.start_time);
              const end = formatTimeString(r.end_time);

              return (
                <div
                  key={r.id || idx}
                  className="p-4 bg-slate-50 hover:bg-indigo-50/50 rounded-xl border border-slate-200 hover:border-indigo-300 transition space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-md font-mono flex items-center gap-1">
                      <Clock className="w-3 h-3 text-indigo-600" />
                      {toBanglaNumber(start)} - {toBanglaNumber(end)}
                    </span>
                    <span className="text-[10px] font-black px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded-md">
                      {r.class_name}
                    </span>
                  </div>

                  <div>
                    <h5 className="font-black text-slate-900 text-sm">{r.display_title || r.subject_name}</h5>
                    <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-1">
                      <span>জামাত: <strong>{r.class_name}</strong></span>
                      {r.clean_room && (
                        <span className="text-slate-400">| 📍 {r.clean_room}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-6 text-center text-slate-500 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
            আজকে ({todayBangla}) আপনার কোনো নির্ধারিত ক্লাস নেই। সম্পূর্ণ রুটিন দেখতে{" "}
            <Link href="/teacher-portal/routine" className="font-bold text-indigo-600 underline">
              এখানে ক্লিক করুন
            </Link>।
          </div>
        )}
      </div>

      {/* Early Warning System Alert Widget */}
      <EarlyWarningWidget initialData={earlyWarningData} isTeacherView={true} />

      {/* Main Features Navigation Grid */}
      <div>
        <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-600" />
          <span>দৈনিক শিক্ষক মডিউলসমূহ</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            href="/teacher-portal/attendance"
            className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs hover:border-emerald-500 hover:shadow-md transition flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl group-hover:scale-110 transition">
                <Calendar className="w-6 h-6" />
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-base">দৈনিক হাজিরা গ্রহণ</h4>
              <p className="text-xs text-slate-500 mt-1">জামাতভিত্তিক উপস্থিতি ও অনুপস্থিতি রেকর্ড করুন।</p>
            </div>
          </Link>

          <Link
            href="/teacher-portal/hifz"
            className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs hover:border-teal-500 hover:shadow-md transition flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-teal-50 text-teal-700 rounded-xl group-hover:scale-110 transition">
                <BookOpen className="w-6 h-6" />
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-teal-600 group-hover:translate-x-1 transition" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-base">হিফজ সবক ও আমুখতা</h4>
              <p className="text-xs text-slate-500 mt-1">সবক, সবকি ও আমুখতা ট্র্যাকিং ও রেটিং দিন।</p>
            </div>
          </Link>

          <Link
            href="/teacher-portal/kitab"
            className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs hover:border-indigo-500 hover:shadow-md transition flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-indigo-50 text-indigo-700 rounded-xl group-hover:scale-110 transition">
                <FileText className="w-6 h-6" />
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-base">কিতাবাত ও পাঠ ডায়েরি</h4>
              <p className="text-xs text-slate-500 mt-1">দৈনিক পঠিত কিতাব ও বাব/পৃষ্ঠা আপডেট করুন।</p>
            </div>
          </Link>

          <Link
            href="/teacher-portal/exams"
            className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs hover:border-purple-500 hover:shadow-md transition flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-purple-50 text-purple-700 rounded-xl group-hover:scale-110 transition">
                <ClipboardList className="w-6 h-6" />
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-purple-600 group-hover:translate-x-1 transition" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-base">পরীক্ষার নম্বর এন্ট্রি</h4>
              <p className="text-xs text-slate-500 mt-1">বিষয়ভিত্তিক পরীক্ষার নম্বর ও গ্রেড প্রদান করুন।</p>
            </div>
          </Link>

          <Link
            href="/teacher-portal/routine"
            className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs hover:border-amber-500 hover:shadow-md transition flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-amber-50 text-amber-700 rounded-xl group-hover:scale-110 transition">
                <CalendarDays className="w-6 h-6" />
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600 group-hover:translate-x-1 transition" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-base">আমার ক্লাস রুটিন</h4>
              <p className="text-xs text-slate-500 mt-1">সাপ্তাহিক ক্লাস ঘণ্টা ও ক্লাসরুম শিডিউল দেখুন।</p>
            </div>
          </Link>

          <Link
            href="/teacher-portal/students"
            className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs hover:border-blue-500 hover:shadow-md transition flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-50 text-blue-700 rounded-xl group-hover:scale-110 transition">
                <Users className="w-6 h-6" />
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-base">শিক্ষার্থী ও অভিভাবক তালিকা</h4>
              <p className="text-xs text-slate-500 mt-1">শিক্ষার্থীর তথ্য ও অভিভাবকের মোবাইল নম্বরে কল/SMS।</p>
            </div>
          </Link>

          <Link
            href="/teacher-portal/notices"
            className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs hover:border-rose-500 hover:shadow-md transition flex flex-col justify-between group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-rose-50 text-rose-700 rounded-xl group-hover:scale-110 transition">
                <Bell className="w-6 h-6" />
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-rose-600 group-hover:translate-x-1 transition" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-base">মাদরাসা নোটিশ বোর্ড</h4>
              <p className="text-xs text-slate-500 mt-1">মাদরাসার দাপ্তরিক ঘোষণা ও ছুটি সংক্রান্ত নোটিশ।</p>
            </div>
          </Link>
        </div>
      </div>

      {/* Notices Section */}
      {noticesRes.data && noticesRes.data.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
              <Bell className="w-4 h-4 text-indigo-600" />
              <span>সাম্প্রতিক মাদরাসা নোটিশ</span>
            </h3>
            <Link href="/teacher-portal/notices" className="text-xs font-bold text-indigo-700 hover:underline">
              সকল নোটিশ
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {noticesRes.data.map((n) => (
              <div key={n.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                <span className="text-[10px] font-bold text-indigo-600 uppercase bg-indigo-50 px-2 py-0.5 rounded">
                  {n.category || "নোটিশ"}
                </span>
                <h5 className="font-bold text-slate-800 text-xs sm:text-sm">{n.title}</h5>
                <p className="text-xs text-slate-500 line-clamp-2">{n.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
