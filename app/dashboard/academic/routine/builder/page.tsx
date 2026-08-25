import { createClient } from "@/lib/supabase/server";
import { addRoutine, deleteRoutine } from "@/app/actions/routine";
import { CalendarDays, Clock, MapPin, User, BookOpen, PlusCircle, Trash2 } from "lucide-react";
import Link from "next/link";

export default async function RoutineBuilderPage({
  searchParams,
}: {
  searchParams: Promise<{ class_id?: string; type?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: classes } = await supabase.from("classes").select("id, name");
  const { data: subjects } = await supabase.from("subjects").select("id, name");
  const { data: teachers } = await supabase.from("teachers").select("id, first_name, last_name");

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

  const days = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  
  const groupedRoutines = days.reduce((acc, day) => {
    acc[day] = routines.filter((r: any) => r.day_of_week === day);
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">রুটিন বিল্ডার (Routine Builder)</h1>
          <p className="text-slate-500">সহজেই ক্লাস ও পরীক্ষার রুটিন তৈরি করুন</p>
        </div>
        <Link href={`/dashboard/academic/routine?class_id=${classId}&type=${routineType}`} className="px-4 py-2 bg-slate-800 text-white rounded-md hover:bg-slate-700 transition">
          রুটিন ভিউ
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Section */}
        <div className="bg-white p-6 rounded-xl border shadow-sm h-fit">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
            <PlusCircle className="w-5 h-5 mr-2 text-indigo-600" />
            নতুন রুটিন যোগ করুন
          </h2>
          <form action={addRoutine} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">রুটিনের ধরন</label>
              <select name="routine_type" className="w-full p-2 border rounded-md" defaultValue={routineType}>
                <option value="Class">ক্লাস রুটিন</option>
                <option value="Exam">পরীক্ষার রুটিন</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">জামাত (Class)</label>
              <select name="class_id" className="w-full p-2 border rounded-md" defaultValue={classId} required>
                {classes?.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">বার (Day)</label>
              <select name="day_of_week" className="w-full p-2 border rounded-md" required>
                {days.map((day) => (
                  <option key={day} value={day}>{dayTranslations[day]}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">শুরুর সময়</label>
                <input type="time" name="start_time" className="w-full p-2 border rounded-md" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">শেষের সময়</label>
                <input type="time" name="end_time" className="w-full p-2 border rounded-md" required />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">বিষয় (Subject)</label>
              <select name="subject_id" className="w-full p-2 border rounded-md">
                <option value="">-- নির্বাচন করুন --</option>
                {subjects?.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">শিক্ষক (Teacher)</label>
              <select name="teacher_id" className="w-full p-2 border rounded-md">
                <option value="">-- নির্বাচন করুন --</option>
                {teachers?.map((t) => (
                  <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">রুম নম্বর (Optional)</label>
              <input type="text" name="room_number" className="w-full p-2 border rounded-md" placeholder="যেমন: ১০১" />
            </div>
            
            <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded-md hover:bg-indigo-700 transition">
              যুক্ত করুন
            </button>
          </form>
        </div>

        {/* Live Preview / Delete Section */}
        <div className="lg:col-span-2">
           <div className="bg-white p-6 rounded-xl border shadow-sm">
             <form className="flex space-x-4 mb-6 pb-6 border-b">
               <div className="flex-1">
                 <label className="block text-sm font-medium text-slate-700 mb-1">জামাত ফিল্টার</label>
                 <select name="class_id" className="w-full p-2 border rounded-md" defaultValue={classId}>
                   {classes?.map((c) => (
                     <option key={c.id} value={c.id}>{c.name}</option>
                   ))}
                 </select>
               </div>
               <div className="flex-1">
                 <label className="block text-sm font-medium text-slate-700 mb-1">রুটিনের ধরন</label>
                 <select name="type" className="w-full p-2 border rounded-md" defaultValue={routineType}>
                   <option value="Class">ক্লাস রুটিন</option>
                   <option value="Exam">পরীক্ষার রুটিন</option>
                 </select>
               </div>
               <div className="flex items-end">
                 <button type="submit" className="bg-slate-800 text-white px-6 py-2 rounded-md hover:bg-slate-700 transition">
                   ফিল্টার
                 </button>
               </div>
             </form>

             <h2 className="text-xl font-bold text-slate-800 mb-6">
                {routineType === 'Class' ? 'ক্লাস রুটিন' : 'পরীক্ষার রুটিন'} - {classes?.find(c => c.id === classId)?.name}
             </h2>

             {routines.length > 0 ? (
               <div className="space-y-6">
                 {days.map(day => {
                    if (groupedRoutines[day].length === 0) return null;
                    
                    return (
                       <div key={day} className="mb-4">
                          <h3 className="text-md font-bold text-slate-700 mb-3 bg-slate-50 p-2 rounded border-l-4 border-indigo-500">
                             {dayTranslations[day]}
                          </h3>
                          <div className="space-y-2">
                             {groupedRoutines[day].map((routine: any) => (
                                <div key={routine.id} className="flex justify-between items-center border border-slate-200 rounded-lg p-3 hover:bg-slate-50 transition group">
                                   <div className="flex items-center space-x-4">
                                      <div className="bg-indigo-100 text-indigo-700 font-semibold px-3 py-1 rounded text-sm min-w-[120px] text-center">
                                         {routine.start_time.slice(0, 5)} - {routine.end_time.slice(0, 5)}
                                      </div>
                                      <div>
                                         <div className="font-semibold text-slate-800 text-sm">{routine.subjects?.name || 'Subject Not Set'}</div>
                                         <div className="text-xs text-slate-500 flex items-center space-x-2 mt-0.5">
                                            <span className="flex items-center"><User className="w-3 h-3 mr-1"/> {routine.teachers ? `${routine.teachers.first_name} ${routine.teachers.last_name}` : 'No Teacher'}</span>
                                            {routine.room_number && (
                                               <span className="flex items-center"><MapPin className="w-3 h-3 mr-1"/> {routine.room_number}</span>
                                            )}
                                         </div>
                                      </div>
                                   </div>
                                   <form action={async () => {
                                      "use server";
                                      await deleteRoutine(routine.id);
                                   }}>
                                      <button type="submit" className="text-red-500 hover:bg-red-100 p-2 rounded-md transition opacity-0 group-hover:opacity-100">
                                         <Trash2 className="w-4 h-4" />
                                      </button>
                                   </form>
                                </div>
                             ))}
                          </div>
                       </div>
                    )
                 })}
               </div>
             ) : (
                <div className="text-center py-12 border-2 border-dashed rounded-xl border-slate-200">
                  <CalendarDays className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">এই জামাতের কোনো রুটিন এখনও তৈরি করা হয়নি</p>
                </div>
             )}
           </div>
        </div>
      </div>
    </div>
  );
}
