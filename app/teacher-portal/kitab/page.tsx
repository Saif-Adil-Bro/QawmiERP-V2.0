import { createClient } from "@/lib/supabase/server";
import KitabEntryClient from "./KitabEntryClient";
import { getMadrasaMetadata } from "@/lib/sessions";

export const dynamic = "force-dynamic";

export default async function TeacherPortalKitab(props: {
  searchParams?: Promise<{ class_id?: string; date?: string }>;
}) {
  const params = props.searchParams ? (await props.searchParams) || {} : {};
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

  const { getUserDataAccessScope } = await import("@/lib/data-access-guards");
  const scope = await getUserDataAccessScope();

  let classesQuery = supabase
    .from("classes")
    .select("id, name")
    .eq("madrasa_id", madrasaId)
    .order("name", { ascending: true });

  if (!scope.isUnrestricted && scope.userRole === "teacher") {
    if (scope.allowedClassIds.length === 0) {
      return (
        <KitabEntryClient
          classes={[]}
          students={[]}
          existingLogs={[]}
          currentClassId=""
          currentDate={params.date || new Date().toISOString().split("T")[0]}
          teacherId={teacher?.id}
          madrasaId={madrasaId}
        />
      );
    }
    classesQuery = classesQuery.in("id", scope.allowedClassIds);
  }

  const [{ data: classes }, meta] = await Promise.all([
    classesQuery,
    madrasaId ? getMadrasaMetadata(madrasaId) : null,
  ]);

  const currentClassId = params.class_id || classes?.[0]?.id || "";
  const currentDate = params.date || new Date().toISOString().split("T")[0];

  const { data: rawStudents } = await supabase
    .from("students")
    .select("id, first_name, last_name, roll_number, photo_url, phone")
    .eq("madrasa_id", madrasaId)
    .eq("class_id", currentClassId)
    .order("roll_number", { ascending: true });

  const { data: existingLogs } = await supabase
    .from("kitab_logs")
    .select("*")
    .eq("madrasa_id", madrasaId)
    .eq("log_date", currentDate);

  const students = (rawStudents || []).map((s: any) => {
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

  return (
    <KitabEntryClient
      classes={classes || []}
      students={students}
      existingLogs={existingLogs || []}
      currentClassId={currentClassId}
      currentDate={currentDate}
      teacherId={teacher?.id}
      madrasaId={madrasaId}
    />
  );
}
