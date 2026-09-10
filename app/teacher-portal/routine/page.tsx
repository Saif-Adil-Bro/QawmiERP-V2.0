import { createClient, getAuthUser } from "@/lib/supabase/server";
import { getAuthMadrasaId } from "@/app/actions/students";
import { CalendarDays, Clock, MapPin, Layers, Coffee, Sparkles, Sun } from "lucide-react";
import { toBanglaNumber } from "@/lib/numberToBangla";
import { parseRoutineItem, formatTimeString } from "@/lib/routine-helper";

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
  const user = await getAuthUser(supabase);
  if (!user) return null;

  const madrasaId = await getAuthMadrasaId(supabase, user);

  // Find the teacher record for current logged-in user
  let teacherQuery = supabase
    .from("teachers")
    .select("id, first_name, last_name, designation")
    .eq("auth_user_id", user.id);

  if (madrasaId) {
    teacherQuery = teacherQuery.eq("madrasa_id", madrasaId);
  }

  const { data: teacher } = await teacherQuery.maybeSingle();

  // If no direct auth_user_id match, try matching by email
  let teacherId = teacher?.id;
  let teacherName = teacher ? `${teacher.first_name} ${teacher.last_name}` : "";

  if (!teacherId && user.email) {
    const { data: teacherByEmail } = await supabase
      .from("teachers")
      .select("id, first_name, last_name, designation")
      .eq("email", user.email)
      .maybeSingle();
    if (teacherByEmail) {
      teacherId = teacherByEmail.id;
      teacherName = `${teacherByEmail.first_name} ${teacherByEmail.last_name}`;
    }
  }

  // Fetch routines for this teacher
  let rawRoutines: any[] = [];
  if (teacherId) {
    const { data } = await supabase
      .from("routines")
      .select("*, classes(name), subjects(name)")
      .eq("teacher_id", teacherId)
      .order("start_time", { ascending: true });
    rawRoutines = data || [];
  }

  const routines = rawRoutines.map(parseRoutineItem);
  const daysOfWeek = ["শনিবার", "রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-xl">
            <CalendarDays className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">আমার পাঠদান ও দায়িত্ব রুটিন</h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              উস্তাদ: <strong className="text-slate-800">{teacherName || user.email}</strong>
              {teacher?.designation && <span> — {teacher.designation}</span>}
            </p>
          </div>
        </div>
      </div>

      {/* Routine Cards by Day */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {daysOfWeek.map((day) => {
          const dayRoutines = routines.filter((r: any) => {
            const normalizedDay = DAY_MAP[r.day_of_week] || r.day_of_week;
            return normalizedDay === day;
          });

          return (
            <div key={day} className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
              <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
                <span className="font-bold text-sm">{day}</span>
                <span className="text-[11px] text-amber-400 font-medium">
                  {dayRoutines.length > 0 ? `${toBanglaNumber(dayRoutines.length)} টি পিরিয়ড` : "অফ / ফ্রি ডে"}
                </span>
              </div>

              <div className="p-4 space-y-2.5 flex-1">
                {dayRoutines.length > 0 ? (
                  dayRoutines.map((r: any, idx: number) => {
                    const start = formatTimeString(r.start_time);
                    const end = formatTimeString(r.end_time);

                    if (r.item_type === "BREAK") {
                      return (
                        <div
                          key={r.id || idx}
                          className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-950 space-y-1 text-xs"
                        >
                          <div className="flex items-center justify-between font-bold">
                            <span className="flex items-center gap-1.5">
                              <Coffee className="w-3.5 h-3.5 text-amber-600" />
                              <span>{r.display_title}</span>
                            </span>
                            <span className="font-mono text-[11px] text-amber-800">
                              {start} - {end}
                            </span>
                          </div>
                          {r.clean_room && (
                            <div className="text-[11px] text-amber-800 flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              <span>স্থান: {r.clean_room}</span>
                            </div>
                          )}
                        </div>
                      );
                    }

                    if (r.item_type === "CUSTOM") {
                      return (
                        <div
                          key={r.id || idx}
                          className="p-3 bg-purple-50 rounded-xl border border-purple-200 text-purple-950 space-y-1 text-xs"
                        >
                          <div className="flex items-center justify-between font-bold">
                            <span className="flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                              <span>{r.display_title}</span>
                            </span>
                            <span className="font-mono text-[11px] text-purple-800">
                              {start} - {end}
                            </span>
                          </div>
                          {r.clean_room && (
                            <div className="text-[11px] text-purple-800 flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              <span>স্থান: {r.clean_room}</span>
                            </div>
                          )}
                        </div>
                      );
                    }

                    return (
                      <div
                        key={r.id || idx}
                        className="p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-amber-300 transition space-y-1"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-900 text-sm">{r.display_title}</span>
                          <span className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>{start} - {end}</span>
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs text-slate-500 pt-0.5">
                          <span className="flex items-center gap-1 font-semibold text-indigo-700">
                            <Layers className="w-3.5 h-3.5" />
                            <span>জামাত: {r.classes?.name || "নির্দিষ্ট জামাত"}</span>
                          </span>
                          {r.clean_room && (
                            <span className="bg-slate-200 px-1.5 py-0.5 rounded text-[10px] font-mono">
                              রুম: {r.clean_room}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-3 bg-slate-50/60 rounded-xl text-center text-xs text-slate-400 py-8">
                    এই দিনে কোন নির্ধারিত পিরিয়ড নেই
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
