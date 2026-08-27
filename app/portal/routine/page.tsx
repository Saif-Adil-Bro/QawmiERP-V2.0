import { createClient } from "@/lib/supabase/server";
import {
  CalendarDays,
  Clock,
  BookOpen,
  User,
  GraduationCap,
} from "lucide-react";
import Link from "next/link";
import { toBanglaNumber } from "@/lib/numberToBangla";

export const dynamic = "force-dynamic";

export default async function ParentPortalRoutine({
  searchParams,
}: {
  searchParams: Promise<{ student_id?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: userData } = await supabase
    .from("users")
    .select("madrasa_id")
    .eq("id", user.id)
    .single();
  const madrasaId = userData?.madrasa_id;

  const { data: students } = await supabase
    .from("students")
    .select("id, first_name, last_name, roll_number, student_id, class_id, class_name, classes(id, name)")
    .eq("madrasa_id", madrasaId)
    .order("roll_number", { ascending: true });

  if (!students || students.length === 0) {
    return (
      <div className="p-8 bg-white rounded-2xl border border-slate-200 text-center text-slate-500">
        কোন শিক্ষার্থী পাওয়া যায়নি।
      </div>
    );
  }

  const selectedStudentId = params.student_id || students[0].id;
  const child: any = students.find((s: any) => s.id === selectedStudentId) || students[0];
  const classId = child?.class_id || (Array.isArray(child?.classes) ? child.classes[0]?.id : child?.classes?.id);
  const className = (Array.isArray(child?.classes) ? child.classes[0]?.name : child?.classes?.name) || child?.class_name || "হিফজ বিভাগ";

  // Fetch routine periods for this student's class
  let routineQuery = supabase
    .from("class_routines")
    .select("*, teachers(first_name, last_name)")
    .eq("madrasa_id", madrasaId);

  if (classId) {
    routineQuery = routineQuery.eq("class_id", classId);
  }

  const { data: routines } = await routineQuery.order("start_time", { ascending: true });

  const daysOfWeek = ["শনিবার", "রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-50 text-amber-700 rounded-xl">
              <CalendarDays className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">ক্লাস ও সাপ্তাহিক পাঠ্যসূচি (Routine)</h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            শিক্ষার্থী: <strong className="text-slate-800">{child.first_name} {child.last_name}</strong> | জামাত: <strong className="text-slate-800">{className}</strong>
          </p>
        </div>

        {students.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {students.map((s) => (
              <Link
                key={s.id}
                href={`/portal/routine?student_id=${s.id}`}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                  s.id === child.id
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {s.first_name} {s.last_name}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Routine Cards by Day */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {daysOfWeek.map((day) => {
          const dayRoutines = routines?.filter((r) => r.day_of_week === day) || [];

          return (
            <div key={day} className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
              <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
                <span className="font-bold text-sm">{day}</span>
                <span className="text-[11px] text-amber-400 font-medium">
                  {dayRoutines.length > 0 ? `${toBanglaNumber(dayRoutines.length)} টি পিরিয়ড` : "ছুটি / বিশেষ শিডিউল"}
                </span>
              </div>

              <div className="p-4 space-y-2.5 flex-1">
                {dayRoutines.length > 0 ? (
                  dayRoutines.map((r, idx) => (
                    <div
                      key={r.id || idx}
                      className="p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-amber-300 transition space-y-1"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-800">{r.subject_name || "হিফজ পাঠ"}</span>
                        <span className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{r.start_time} - {r.end_time}</span>
                        </span>
                      </div>
                      {r.teachers && (
                        <p className="text-[11px] text-slate-500 flex items-center gap-1">
                          <User className="w-3 h-3" />
                          <span>উস্তাদ: {r.teachers.first_name} {r.teachers.last_name}</span>
                        </p>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="p-3 bg-slate-50/60 rounded-xl text-center text-xs text-slate-400 py-6">
                    নিয়মিত দৈনিক কুরআন তিলাওয়াত ও সবক পাঠ
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
