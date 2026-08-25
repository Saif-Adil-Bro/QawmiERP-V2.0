import { createClient } from "@/lib/supabase/server";
import { CalendarDays, Clock, MapPin, User, BookOpen } from "lucide-react";
import PrintButton from "@/app/components/PrintButton";
import Link from "next/link";
import RoutineClient from "./RoutineClient";
import { getMadrasaInfo } from "@/lib/getMadrasaInfo";

export default async function RoutinePage({
  searchParams,
}: {
  searchParams: Promise<{ class_id?: string; type?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const madrasaInfo = await getMadrasaInfo();

  const { data: classes } = await supabase.from("classes").select("id, name");

  const classId = params?.class_id || (classes?.[0]?.id || "");
  const routineType = params?.type || "Class";

  let routines = [];
  if (classId) {
    const { data } = await supabase
      .from("routines")
      .select("*, classes(name), subjects(name), teachers(first_name, last_name)")
      .eq("class_id", classId)
      .eq("routine_type", routineType)
      .order("start_time", { ascending: true });
    routines = data || [];
  }

  // Group by day_of_week
  const days = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  
  const groupedRoutines = days.reduce((acc, day) => {
    acc[day] = routines.filter(r => r.day_of_week === day);
    return acc;
  }, {} as Record<string, any[]>);

  const dayTranslations: Record<string, string> = {
    Saturday: "শনিবার",
    Sunday: "রবিবার",
    Monday: "সোমবার",
    Tuesday: "মঙ্গলবার",
    Wednesday: "বুধবার",
    Thursday: "বৃহস্পতিবার",
    Friday: "শুক্রবার",
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">রুটিন (Routine)</h1>
          <p className="text-slate-500">জামাত ভিত্তিক ক্লাস এবং পরীক্ষার রুটিন</p>
        </div>
        <Link href="/dashboard/academic/routine/builder" className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition flex items-center">
          রুটিন বিল্ডার
        </Link>
      </div>

      <div className="bg-white p-6 rounded-xl border shadow-sm print:hidden">
        <form className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">জামাত নির্বাচন করুন</label>
            <select name="class_id" className="w-full p-2 border rounded-md" defaultValue={classId}>
              {classes?.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">রুটিনের ধরন</label>
            <select name="type" className="w-full p-2 border rounded-md" defaultValue={routineType}>
              <option value="Class">ক্লাস রুটিন</option>
              <option value="Exam">পরীক্ষার রুটিন</option>
            </select>
          </div>
          <div className="flex space-x-2">
            <button type="submit" className="w-full bg-slate-800 text-white py-2 rounded-md hover:bg-slate-700 transition">
              দেখুন
            </button>
          </div>
        </form>
      </div>

            <RoutineClient routines={routines} routineType={routineType} className={classes?.find(c => c.id === classId)?.name} madrasaInfo={madrasaInfo} />
    </div>
  );
}
