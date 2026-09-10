import { createClient, getAuthUser } from "@/lib/supabase/server";
import { getAuthMadrasaId } from "@/app/actions/students";
import { CalendarDays, Plus, ArrowRight, BookOpen, Layers } from "lucide-react";
import Link from "next/link";
import RoutineClient from "./RoutineClient";
import { getMadrasaInfo } from "@/lib/getMadrasaInfo";

export const dynamic = "force-dynamic";

export default async function RoutinePage(props: {
  searchParams?: Promise<{ class_id?: string; type?: string }>;
}) {
  const params = props.searchParams ? (await props.searchParams) || {} : {};
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  let madrasaId: string | null = null;
  if (user) {
    madrasaId = await getAuthMadrasaId(supabase, user);
  }

  const madrasaInfo = await getMadrasaInfo();

  let classesQuery = supabase.from("classes").select("id, name").order("name", { ascending: true });
  if (madrasaId) {
    classesQuery = classesQuery.eq("madrasa_id", madrasaId);
  }
  const { data: classesData } = await classesQuery;
  const classes = classesData || [];

  const classId = params?.class_id || (classes?.[0]?.id || "");
  const routineType = params?.type || "Class";

  let routines = [];
  if (classId) {
    let q = supabase
      .from("routines")
      .select("*, classes(name), subjects(name), teachers(first_name, last_name)")
      .eq("class_id", classId);

    if (routineType === "Class") {
      q = q.in("routine_type", ["Class", "OffDay"]);
    } else {
      q = q.eq("routine_type", routineType);
    }

    const { data } = await q.order("start_time", { ascending: true });
    routines = data || [];
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-2xl">
            <CalendarDays className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900">
              জামাত ও পাঠ্যসূচি রুটিন (Routine)
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              ক্লাস, দৈনিক ও আবাসিক কার্যক্রম এবং পরীক্ষার রুটিন ভিউ ও প্রিন্ট
            </p>
          </div>
        </div>

        <Link
          href={`/dashboard/academic/routine/builder?class_id=${classId}&type=${routineType}`}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition flex items-center gap-2 shadow-xs cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>রুটিন বিল্ডার / এডিটর</span>
        </Link>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs print:hidden">
        <form className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          <div className="sm:col-span-5">
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              জামাত নির্বাচন করুন
            </label>
            <select
              name="class_id"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
              defaultValue={classId}
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-5">
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              রুটিনের ধরন
            </label>
            <select
              name="type"
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs sm:text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
              defaultValue={routineType}
            >
              <option value="Class">ক্লাস রুটিন (Class Routine)</option>
              <option value="Daily">দৈনিক / ২৪-ঘণ্টা আবাসিক রুটিন (Daily Routine)</option>
              <option value="Exam">পরীক্ষার রুটিন (Exam Routine)</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <button
              type="submit"
              className="w-full bg-slate-900 hover:bg-slate-800 text-white py-2 rounded-xl text-xs sm:text-sm font-bold transition shadow-xs cursor-pointer"
            >
              ফিল্টার
            </button>
          </div>
        </form>
      </div>

      {/* Main Routine Display Component */}
      <RoutineClient
        routines={routines}
        routineType={routineType}
        className={classes.find((c) => c.id === classId)?.name}
        madrasaInfo={madrasaInfo}
      />
    </div>
  );
}
