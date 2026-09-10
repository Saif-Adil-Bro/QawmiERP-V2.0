import {
  CalendarDays,
  Clock,
  BookOpen,
  User,
  GraduationCap,
  MapPin,
  Sparkles,
  Coffee,
  Sun,
} from "lucide-react";
import Link from "next/link";
import { toBanglaNumber } from "@/lib/numberToBangla";
import { getPortalStudentData } from "@/lib/portal-data";
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

export default async function ParentPortalRoutine(props: {
  searchParams?: Promise<{ student_id?: string }>;
}) {
  const params = props.searchParams ? (await props.searchParams) || {} : {};
  const portalData = await getPortalStudentData(params.student_id);

  if (!portalData || !portalData.user) return null;

  const { students, child, madrasaId, adminClient } = portalData;

  if (students.length === 0 || !child) {
    return (
      <div className="p-8 bg-white rounded-2xl border border-slate-200 text-center text-slate-500">
        কোন শিক্ষার্থী সংযুক্ত পাওয়া যায়নি।
      </div>
    );
  }

  const classId = child?.class_id || (Array.isArray(child?.classes) ? child.classes[0]?.id : child?.classes?.id);
  const className = (Array.isArray(child?.classes) ? child.classes[0]?.name : child?.classes?.name) || child?.class_name || "হিফজ বিভাগ";

  // Fetch routine periods for this student's class from `routines` table via adminClient
  let routineQuery = adminClient
    .from("routines")
    .select("*, subjects(name), teachers(first_name, last_name)")
    .eq("madrasa_id", madrasaId);

  if (classId) {
    routineQuery = routineQuery.eq("class_id", classId);
  }

  const { data: rawRoutines } = await routineQuery.order("start_time", { ascending: true });
  const routines = (rawRoutines || []).map(parseRoutineItem);

  const daysOfWeek = ["শনিবার", "রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার"];

  return (
    <div className="space-y-6">
      {/* Header with Child Switcher */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          {child.photo_url ? (
            <img
              src={child.photo_url}
              alt=""
              className="w-12 h-12 rounded-xl object-cover border border-amber-200 shrink-0 shadow-2xs"
            />
          ) : (
            <div className="p-2.5 bg-amber-50 text-amber-700 rounded-xl shrink-0">
              <CalendarDays className="w-5 h-5" />
            </div>
          )}
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">ক্লাস ও সাপ্তাহিক পাঠ্যসূচি (Routine)</h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>শিক্ষার্থী: <strong className="text-slate-800">{child.first_name} {child.last_name}</strong></span>
              {(child.student_id || child.student_id_formatted) && (
                <span className="font-mono bg-amber-50 text-amber-800 px-2 py-0.5 rounded text-xs border border-amber-200 font-bold">
                  আইডি: {child.student_id || child.student_id_formatted}
                </span>
              )}
              <span>| জামাত: <strong className="text-slate-800">{className}</strong></span>
              {child.roll_number && <span>(রোল: {toBanglaNumber(child.roll_number)})</span>}
            </p>
          </div>
        </div>

        {students.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            {students.map((s: any) => (
              <Link
                key={s.id}
                href={`/portal/routine?student_id=${s.id}`}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 ${
                  s.id === child.id
                    ? "bg-amber-600 text-white shadow-xs"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                }`}
              >
                <span>{s.first_name} {s.last_name}</span>
                {(s.student_id || s.student_id_formatted) && (
                  <span className="text-[10px] font-mono opacity-85">
                    ({s.student_id || s.student_id_formatted})
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Routine Cards by Day */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {daysOfWeek.map((day) => {
          const dayRoutines = routines.filter((r: any) => {
            const normalizedDay = DAY_MAP[r.day_of_week] || r.day_of_week;
            return normalizedDay === day;
          });

          const isOffDay = dayRoutines.some((r: any) => r.item_type === "OFFDAY");

          return (
            <div key={day} className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
              <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
                <span className="font-bold text-sm">{day}</span>
                <span className="text-[11px] text-amber-400 font-medium">
                  {isOffDay
                    ? "সাপ্তাহিক ছুটি"
                    : dayRoutines.length > 0
                    ? `${toBanglaNumber(dayRoutines.length)} টি পিরিয়ড`
                    : "অফ / ফ্রি ডে"}
                </span>
              </div>

              <div className="p-4 space-y-2.5 flex-1">
                {dayRoutines.length > 0 ? (
                  dayRoutines.map((r: any, idx: number) => {
                    const start = formatTimeString(r.start_time);
                    const end = formatTimeString(r.end_time);

                    if (r.item_type === "OFFDAY") {
                      return (
                        <div
                          key={r.id || idx}
                          className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-rose-900 flex items-center gap-2.5 text-xs"
                        >
                          <Sun className="w-4 h-4 text-rose-600 shrink-0" />
                          <span className="font-bold">{r.display_title || "সাপ্তাহিক ছুটি"}</span>
                        </div>
                      );
                    }

                    if (r.item_type === "BREAK") {
                      return (
                        <div
                          key={r.id || idx}
                          className="p-3 bg-amber-50/80 rounded-xl border border-amber-200 text-amber-950 space-y-1 text-xs"
                        >
                          <div className="flex items-center justify-between font-bold">
                            <span className="flex items-center gap-1.5">
                              <Coffee className="w-3.5 h-3.5 text-amber-600" />
                              <span>{r.display_title}</span>
                            </span>
                            <span className="font-mono text-[11px] text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded">
                              {start} - {end}
                            </span>
                          </div>
                          {r.clean_room && (
                            <div className="text-[11px] text-amber-800 flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-amber-600" />
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
                          className="p-3 bg-purple-50/80 rounded-xl border border-purple-200 text-purple-950 space-y-1 text-xs"
                        >
                          <div className="flex items-center justify-between font-bold">
                            <span className="flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                              <span>{r.display_title}</span>
                            </span>
                            <span className="font-mono text-[11px] text-purple-800 bg-purple-100 px-1.5 py-0.2 rounded">
                              {start} - {end}
                            </span>
                          </div>
                          {r.clean_room && (
                            <div className="text-[11px] text-purple-800 flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-purple-600" />
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
                          <span className="font-bold text-slate-800">{r.display_title}</span>
                          <span className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>{start} - {end}</span>
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                          {r.display_subtitle ? (
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              <span>উস্তাদ: {r.display_subtitle}</span>
                            </span>
                          ) : (
                            <span className="text-slate-400">উস্তাদ নির্ধারিত নয়</span>
                          )}
                          {r.clean_room && (
                            <span className="flex items-center gap-1 text-slate-600 bg-white px-1.5 py-0.5 rounded border border-slate-200 text-[10px]">
                              <MapPin className="w-2.5 h-2.5 text-amber-600" />
                              <span>কক্ষ: {r.clean_room}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-8 text-center text-xs text-slate-400">
                    কোন নির্ধারিত ক্লাস নেই
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
