import { createClient } from "@/lib/supabase/server";
import { CalendarDays, Clock, BookOpen, User, Layers } from "lucide-react";
import { toBanglaNumber } from "@/lib/numberToBangla";

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
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: userData } = await supabase
    .from("users")
    .select("madrasa_id, full_name")
    .eq("id", user.id)
    .single();
  const madrasaId = userData?.madrasa_id;

  const { data: teacher } = await supabase
    .from("teachers")
    .select("id, first_name, last_name")
    .eq("madrasa_id", madrasaId)
    .or(`email.eq.${user.email},phone.eq.${userData?.full_name || ""}`)
    .maybeSingle();

  // Fetch routine from routines table
  let routineQuery = supabase
    .from("routines")
    .select("*, classes(name), subjects(name)")
    .eq("madrasa_id", madrasaId);

  if (teacher?.id) {
    routineQuery = routineQuery.eq("teacher_id", teacher.id);
  }

  const { data: rawRoutines } = await routineQuery.order("start_time", { ascending: true });
  const routines = rawRoutines || [];

  const daysOfWeek = ["শনিবার", "রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-50 text-amber-700 rounded-xl">
              <CalendarDays className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">আমার ক্লাস ও সাপ্তাহিক রুটিন</h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            উস্তাদ: <strong className="text-slate-800">{teacher ? `${teacher.first_name} ${teacher.last_name}` : userData?.full_name}</strong> | সাপ্তাহিক দায়িত্ব ও ক্লাসরুম শিডিউল
          </p>
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
                  {dayRoutines.length > 0 ? `${toBanglaNumber(dayRoutines.length)} টি ক্লাস` : "অফ / ফ্রি ডে"}
                </span>
              </div>

              <div className="p-4 space-y-2.5 flex-1">
                {dayRoutines.length > 0 ? (
                  dayRoutines.map((r: any, idx: number) => {
                    const subjectName =
                      (Array.isArray(r.subjects) ? r.subjects[0]?.name : r.subjects?.name) ||
                      r.subject_name ||
                      "দরস";
                    const className =
                      (Array.isArray(r.classes) ? r.classes[0]?.name : r.classes?.name) ||
                      "নির্দিষ্ট শ্রেণি";

                    return (
                      <div
                        key={r.id || idx}
                        className="p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-amber-300 transition space-y-1"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-900 text-sm">{subjectName}</span>
                          <span className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>{r.start_time?.slice(0, 5) || "০৯:০০"} - {r.end_time?.slice(0, 5) || "১০:০০"}</span>
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs text-slate-500 pt-0.5">
                          <span className="flex items-center gap-1 font-semibold text-indigo-700">
                            <Layers className="w-3.5 h-3.5" />
                            <span>জামাত: {className}</span>
                          </span>
                          {r.room_number && (
                            <span className="bg-slate-200 px-1.5 py-0.5 rounded text-[10px] font-mono">
                              রুম: {r.room_number}
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
