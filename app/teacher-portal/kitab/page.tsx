import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import KitabEntryClient from "./KitabEntryClient";
import { getMadrasaMetadata } from "@/lib/sessions";

export const dynamic = "force-dynamic";

export default async function TeacherPortalKitab(props: {
  searchParams?: Promise<{ class_id?: string; date?: string }>;
}) {
  const params = props.searchParams ? (await props.searchParams) || {} : {};
  const supabase = await createClient();
  const user = await getAuthUser(supabase);

  if (!user) return null;

  // Safe user profile lookup
  let madrasaId = "";
  try {
    const admin = await createAdminClient();
    const { data: uAdmin } = await admin
      .from("users")
      .select("madrasa_id")
      .eq("id", user.id)
      .maybeSingle();
    madrasaId = uAdmin?.madrasa_id || "";
  } catch {
    const { data: u } = await supabase
      .from("users")
      .select("madrasa_id")
      .eq("id", user.id)
      .maybeSingle();
    madrasaId = u?.madrasa_id || "";
  }

  // Safe teacher lookup
  let teacherId: string | undefined = undefined;
  if (madrasaId && user.email) {
    try {
      const { data: teacher } = await supabase
        .from("teachers")
        .select("id, first_name, last_name")
        .eq("madrasa_id", madrasaId)
        .eq("email", user.email)
        .maybeSingle();
      teacherId = teacher?.id;
    } catch {
      // ignore
    }
  }

  const { getUserDataAccessScope } = await import("@/lib/data-access-guards");
  const scope = await getUserDataAccessScope();

  let adminClient: any = null;
  try {
    adminClient = await createAdminClient();
  } catch {
    adminClient = supabase;
  }

  let classes: any[] = [];
  try {
    let classesQuery = (adminClient || supabase)
      .from("classes")
      .select("id, name")
      .order("name", { ascending: true });

    if (madrasaId) {
      classesQuery = classesQuery.eq("madrasa_id", madrasaId);
    }

    if (!scope.isUnrestricted && scope.userRole === "teacher") {
      if (scope.allowedClassIds.length === 0) {
        return (
          <KitabEntryClient
            classes={[]}
            students={[]}
            existingLogs={[]}
            currentClassId=""
            currentDate={params.date || new Date().toISOString().split("T")[0]}
            teacherId={teacherId}
            madrasaId={madrasaId}
          />
        );
      }
      classesQuery = classesQuery.in("id", scope.allowedClassIds);
    }

    const { data: clsData } = await classesQuery;
    classes = clsData || [];
  } catch (clsErr) {
    console.warn("Failed to fetch classes for kitab:", clsErr);
  }

  const meta = madrasaId ? await getMadrasaMetadata(madrasaId) : null;

  const currentClassId = params.class_id || classes?.[0]?.id || "";
  const currentDate = params.date || new Date().toISOString().split("T")[0];

  let students: any[] = [];
  let existingLogs: any[] = [];

  if (currentClassId) {
    let rawStudents: any[] = [];
    try {
      const admin = adminClient || (await createAdminClient());
      const { data: sAdmin } = await admin
        .from("students")
        .select("id, first_name, last_name, roll_number, photo_url, parent_phone, class_id")
        .eq("class_id", currentClassId)
        .order("roll_number", { ascending: true });
      if (sAdmin) rawStudents = sAdmin;
    } catch {
      // fallback
    }

    if (rawStudents.length === 0) {
      const { data: s } = await supabase
        .from("students")
        .select("id, first_name, last_name, roll_number, photo_url, parent_phone, class_id")
        .eq("class_id", currentClassId)
        .order("roll_number", { ascending: true });
      rawStudents = s || [];
    }

    students = (rawStudents || []).map((s: any) => {
      const profile = meta?.student_profiles?.[s.id] || {};
      const admission = (meta?.admissions || []).find((a: any) => a.confirmed_student_id === s.id);
      const resolvedPhoto = profile.photo_url || s.photo_url || admission?.photo_url || "";
      const resolvedPhone = profile.parent_phone || s.parent_phone || admission?.guardian_phone || admission?.emergency_phone || "";

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

    // Guard: Only query kitab_logs if there are students, preventing PostgREST in.() 400 error
    if (students.length > 0) {
      const studentIds = students.map((st: any) => st.id);
      const clientForLogs = adminClient || supabase;
      const { data: el } = await clientForLogs
        .from("kitab_logs")
        .select("*")
        .in("student_id", studentIds)
        .eq("log_date", currentDate);
      existingLogs = el || [];
    }
  }

  return (
    <KitabEntryClient
      classes={classes || []}
      students={students}
      existingLogs={existingLogs || []}
      currentClassId={currentClassId}
      currentDate={currentDate}
      teacherId={teacherId}
      madrasaId={madrasaId}
    />
  );
}
