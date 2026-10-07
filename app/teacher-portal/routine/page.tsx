import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { getAuthMadrasaId } from "@/app/actions/students";
import { 
  CalendarDays, Clock, MapPin, Layers, Coffee, Sparkles, 
  Sun, ShieldCheck, BookOpen, Printer, CheckCircle2 
} from "lucide-react";
import { toBanglaNumber } from "@/lib/numberToBangla";
import { parseRoutineItem, formatTimeString } from "@/lib/routine-helper";
import { getTeacherAcademicSchedule } from "@/app/actions/teacher_subjects";
import Link from "next/link";

export const dynamic = "force-dynamic";

const DAY_MAP: Record<string, string> = {
  Saturday: "শনিবার",
  Sunday: "রবিবার",
  Monday: "সোমবার",
  Tuesday: "মঙ্গলবার",
  Wednesday: "বুধবার",
  Thursday: "বৃহস্পতিবার",
  Friday: "শুক্রবার",
  "শনিবার": "শনিবার",
  "রবিবার": "রবিবার",
  "সোমবার": "সোমবার",
  "মঙ্গলবার": "মঙ্গলবার",
  "বুধবার": "বুধবার",
  "বৃহস্পতিবার": "বৃহস্পতিবার",
  "শুক্রবার": "শুক্রবার",
};

export default async function TeacherPortalRoutine() {
  const supabase = await createClient();
  const adminClient = await createAdminClient();
  const user = await getAuthUser(supabase);
  if (!user) return null;

  let madrasaId = await getAuthMadrasaId(supabase, user);
  if (!madrasaId) {
    const { data: anyM } = await adminClient.from("madrasas").select("id").limit(1).single();
    madrasaId = anyM?.id || "";
  }

  // Find user profile
  const { data: userData } = await adminClient
    .from("users")
    .select("full_name, email, role")
    .eq("id", user.id)
    .maybeSingle();

  // Find teacher in teachers table
  let teacherId = "";
  let teacherName = userData?.full_name || "মুহতারাম উস্তাদ";
  let teacherDesignation = "মুদাররিস";

  const { data: teacherRow } = await adminClient
    .from("teachers")
    .select("id, first_name, last_name, designation, email, phone")
    .eq("madrasa_id", madrasaId)
    .or(`email.eq.${user.email},auth_user_id.eq.${user.id}`)
    .maybeSingle();

  if (teacherRow) {
    teacherId = teacherRow.id;
    teacherName = `${teacherRow.first_name || ""} ${teacherRow.last_name || ""}`.trim() || teacherName;
    teacherDesignation = teacherRow.designation || teacherDesignation;
  }

  // If not found in teachers table, look up in staff metadata
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
      teacherDesignation = staff.employment?.designation || teacherDesignation;
    }
  }

  // Load comprehensive academic schedule (subjects, in-charge classes, routines)
  const schedule = await getTeacherAcademicSchedule(teacherId || user.id);

  const daysOfWeek = ["শনিবার", "রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার"];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header Banner */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-indigo-50 text-indigo-700 rounded-2xl border border-indigo-100">
            <CalendarDays className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900">আমার পাঠদান ও সাপ্তাহিক রুটিন</h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              উস্তাদ: <strong className="text-slate-800">{teacherName}</strong>
              <span className="text-slate-400"> | পদবি: {teacherDesignation}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/teacher-portal"
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
          >
            ড্যাশবোর্ডে ফিরুন
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {/* In-Charge Role Card */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0 border border-teal-100">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500">শ্রেণি জিম্মাদারি</p>
            <p className="text-base font-black text-teal-800">
              {schedule.inChargeClasses.length > 0 ? (
                schedule.inChargeClasses.map(c => c.class_name).join(", ")
              ) : (
                "জিম্মাদারি নেই"
              )}
            </p>
          </div>
        </div>

        {/* Assigned Subjects Card */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-100">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500">বরাদ্দকৃত বিষয় / কিতাব</p>
            <p className="text-base font-black text-emerald-800">
              {toBanglaNumber(schedule.assignedSubjects.length)} টি কিতাব
            </p>
          </div>
        </div>

        {/* Total Periods Card */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0 border border-indigo-100">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold text-slate-500">সাপ্তাহিক ক্লাস পিরিয়ড</p>
            <p className="text-base font-black text-indigo-800">
              {toBanglaNumber(schedule.routines.length)} টি পিরিয়ড
            </p>
          </div>
        </div>
      </div>

      {/* In-Charge Classes Banner (if any) */}
      {schedule.inChargeClasses.length > 0 && (
        <div className="p-4 sm:p-5 bg-gradient-to-r from-teal-900 to-emerald-900 text-white rounded-2xl shadow-xs flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0 backdrop-blur-xs">
              <ShieldCheck className="w-6 h-6 text-teal-300" />
            </div>
            <div>
              <span className="text-[10px] font-bold bg-teal-400 text-teal-950 px-2 py-0.5 rounded-full uppercase tracking-wider">
                শ্রেণি জিম্মাদার শিক্ষক
              </span>
              <h3 className="text-base sm:text-lg font-black mt-0.5">
                {schedule.inChargeClasses.map(c => c.class_name).join(", ")}
              </h3>
              <p className="text-xs text-teal-100/80">
                আপনি উপরোক্ত জামাতের প্রধান জিম্মাদার শিক্ষক হিসেবে শিক্ষার্থীদের সার্বিক পাঠদান, হাজিরা ও শৃঙ্খলা তদারকির দায়িত্বে রয়েছেন।
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Assigned Subjects Summary Grid */}
      {schedule.assignedSubjects.length > 0 && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-emerald-700" />
            <span>আমার নির্ধারিত জামাত ও কিতাবসমূহ</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {schedule.assignedSubjects.map((sub) => (
              <div
                key={sub.id}
                className="p-3.5 bg-slate-50/80 border border-slate-200 rounded-xl space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded-md">
                    {sub.class_name}
                  </span>
                  {sub.subject_code && (
                    <span className="text-[10px] font-mono text-slate-400">
                      {sub.subject_code}
                    </span>
                  )}
                </div>
                <h4 className="text-xs sm:text-sm font-black text-slate-900">{sub.subject_name}</h4>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Routine Cards by Day (সাপ্তাহিক রুটিন) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-600" />
            <span>সাপ্তাহিক দিনভিত্তিক ক্লাস শিডিউল</span>
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {daysOfWeek.map((day) => {
            const dayRoutines = schedule.routines.filter((r) => {
              const normalizedDay = DAY_MAP[r.day_of_week] || r.day_of_week;
              return normalizedDay === day;
            });

            return (
              <div key={day} className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col">
                <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
                  <span className="font-bold text-sm">{day}</span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    dayRoutines.length > 0 ? "bg-indigo-500/30 text-amber-300 border border-indigo-400/30" : "text-slate-400"
                  }`}>
                    {dayRoutines.length > 0 ? `${toBanglaNumber(dayRoutines.length)} টি পিরিয়ড` : "অফ / ফ্রি ডে"}
                  </span>
                </div>

                <div className="p-3.5 space-y-2.5 flex-1">
                  {dayRoutines.length > 0 ? (
                    dayRoutines.map((r, idx) => {
                      const start = formatTimeString(r.start_time);
                      const end = formatTimeString(r.end_time);

                      return (
                        <div
                          key={r.id || idx}
                          className="p-3 bg-slate-50 hover:bg-indigo-50/50 rounded-xl border border-slate-200 hover:border-indigo-300 transition space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-mono text-[10px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md border border-indigo-100 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-indigo-600" />
                              {toBanglaNumber(start)} - {toBanglaNumber(end)}
                            </span>
                            <span className="text-[10px] font-black px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded-md">
                              {r.class_name}
                            </span>
                          </div>

                          <div>
                            <h5 className="font-black text-slate-900 text-xs sm:text-sm">
                              {r.display_title || r.subject_name}
                            </h5>
                            <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-1">
                              <span>জামাত: <strong>{r.class_name}</strong></span>
                              {r.clean_room && (
                                <span className="text-slate-400">| 📍 {r.clean_room}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-6 text-center text-slate-400 text-xs italic">
                      এই বারে কোনো ক্লাস নির্ধারিত নেই
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
