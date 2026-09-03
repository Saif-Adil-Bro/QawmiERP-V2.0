import { createClient } from "@/lib/supabase/server";
import AttendanceForm from "./AttendanceForm";

export default async function TeacherAttendancePage(props: { searchParams?: Promise<{ date?: string, class_id?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: userData } = await supabase.from("users").select("madrasa_id").eq("id", user.id).single();
  const madrasaId = userData?.madrasa_id;

  const { getUserDataAccessScope } = await import("@/lib/data-access-guards");
  const scope = await getUserDataAccessScope();

  let classesQuery = supabase.from("classes").select("id, name").eq("madrasa_id", madrasaId).order("name");

  if (!scope.isUnrestricted && scope.userRole === "teacher") {
    if (scope.allowedClassIds.length === 0) {
      return (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Take Attendance</h1>
            <p className="text-slate-500">Mark daily attendance for your classes.</p>
          </div>
          <div className="p-8 bg-white rounded-2xl border border-slate-200 text-center text-slate-500">
            আপনাকে কোনো ক্লাস অর্পণ করা হয়নি। মাদরাসা কর্তৃপক্ষের সাথে যোগাযোগ করুন।
          </div>
        </div>
      );
    }
    classesQuery = classesQuery.in("id", scope.allowedClassIds);
  }

  const { data: classes } = await classesQuery;

  // Await search params since we are in Next 15+
  const awaitedSearchParams = props.searchParams ? (await props.searchParams) || {} : {};
  const dateStr = awaitedSearchParams?.date || new Date().toISOString().split('T')[0];
  const classId = awaitedSearchParams?.class_id || (classes?.[0]?.id || "");

  let students: any[] = [];
  let existingAttendance: any[] = [];

  if (classId) {
    const { data: s } = await supabase.from("students").select("id, first_name, last_name, roll_number").eq("class_id", classId).order("roll_number");
    students = s || [];

    const { data: a } = await supabase.from("attendance").select("*").eq("class_id", classId).eq("date", dateStr);
    existingAttendance = a || [];
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Take Attendance</h1>
        <p className="text-slate-500">Mark daily attendance for your classes.</p>
      </div>

      <AttendanceForm 
        classes={classes || []} 
        students={students} 
        existingAttendance={existingAttendance}
        currentDate={dateStr}
        currentClassId={classId}
        madrasaId={madrasaId}
      />
    </div>
  );
}
