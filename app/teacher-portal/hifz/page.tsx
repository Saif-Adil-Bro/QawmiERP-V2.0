import { createClient } from "@/lib/supabase/server";
import HifzForm from "./HifzForm";
import { getMadrasaMetadata } from "@/lib/sessions";

export default async function TeacherHifzPage(props: { searchParams?: Promise<{ date?: string, class_id?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: userData } = await supabase.from("users").select("madrasa_id").eq("id", user.id).single();
  const madrasaId = userData?.madrasa_id;

  const { data: teacher } = await supabase.from("teachers").select("id").eq("madrasa_id", madrasaId).eq("email", user.email).single();
  const teacherId = teacher?.id;

  const { getUserDataAccessScope } = await import("@/lib/data-access-guards");
  const scope = await getUserDataAccessScope();

  let classesQuery = supabase.from("classes").select("id, name").eq("madrasa_id", madrasaId).order("name");

  if (!scope.isUnrestricted && scope.userRole === "teacher") {
    if (scope.allowedClassIds.length === 0) {
      return (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Daily Hifz Sabak</h1>
            <p className="text-slate-500">Update Sabak, Saboki, and Amukhta progress for your class.</p>
          </div>
          <div className="p-8 bg-white rounded-2xl border border-slate-200 text-center text-slate-500">
            আপনাকে কোনো হিফজ ক্লাস অর্পণ করা হয়নি। মাদরাসা কর্তৃপক্ষের সাথে যোগাযোগ করুন।
          </div>
        </div>
      );
    }
    classesQuery = classesQuery.in("id", scope.allowedClassIds);
  }

  const [{ data: classes }, meta] = await Promise.all([
    classesQuery,
    madrasaId ? getMadrasaMetadata(madrasaId) : null,
  ]);

  // Await search params
  const awaitedSearchParams = props.searchParams ? (await props.searchParams) || {} : {};
  const dateStr = awaitedSearchParams?.date || new Date().toISOString().split('T')[0];
  const classId = awaitedSearchParams?.class_id || (classes?.[0]?.id || "");

  let students: any[] = [];
  let existingLogs: any[] = [];

  if (classId) {
    const { data: rawStudents } = await supabase
      .from("students")
      .select("id, first_name, last_name, roll_number, photo_url, phone")
      .eq("class_id", classId)
      .order("roll_number");

    students = (rawStudents || []).map((s: any) => {
      const profile = meta?.student_profiles?.[s.id] || {};
      const admission = (meta?.admissions || []).find((a: any) => a.confirmed_student_id === s.id);
      const resolvedPhoto = profile.photo_url || s.photo_url || admission?.photo_url || "";
      const resolvedPhone = profile.parent_phone || s.parent_phone || admission?.guardian_phone || admission?.emergency_phone || s.phone || "";

      return {
        ...s,
        first_name: profile.first_name || s.first_name || "",
        last_name: profile.last_name || s.last_name || "",
        roll_number: profile.roll_number !== undefined && profile.roll_number !== "" ? profile.roll_number : (s.roll_number || ""),
        photo_url: resolvedPhoto,
        phone: resolvedPhone,
        parent_phone: resolvedPhone,
      };
    });

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
        madrasaId={madrasaId}
      />
    </div>
  );
}
