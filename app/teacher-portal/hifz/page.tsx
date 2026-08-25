import { createClient } from "@/lib/supabase/server";
import HifzForm from "./HifzForm";

export default async function TeacherHifzPage(props: { searchParams: Promise<{ date?: string, class_id?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: userData } = await supabase.from("users").select("madrasa_id").eq("id", user.id).single();
  const madrasaId = userData?.madrasa_id;

  const { data: teacher } = await supabase.from("teachers").select("id").eq("madrasa_id", madrasaId).eq("email", user.email).single();
  const teacherId = teacher?.id;

  const { data: classes } = await supabase.from("classes").select("id, name").eq("madrasa_id", madrasaId).order("name");

  // Await search params
  const awaitedSearchParams = await props.searchParams;
  const dateStr = awaitedSearchParams?.date || new Date().toISOString().split('T')[0];
  const classId = awaitedSearchParams?.class_id || (classes?.[0]?.id || "");

  let students: any[] = [];
  let existingLogs: any[] = [];

  if (classId) {
    const { data: s } = await supabase.from("students").select("id, first_name, last_name, roll_number").eq("class_id", classId).order("roll_number");
    students = s || [];

    const { data: l } = await supabase.from("hifz_logs").select("*").in("student_id", students.map(st => st.id)).eq("log_date", dateStr);
    existingLogs = l || [];
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Daily Hifz Sabak</h1>
        <p className="text-slate-500">Update Sabak, Saboki, and Amukhta progress for your class.</p>
      </div>

      <HifzForm 
        classes={classes || []} 
        students={students} 
        existingLogs={existingLogs}
        currentDate={dateStr}
        currentClassId={classId}
        teacherId={teacherId}
      />
    </div>
  );
}
