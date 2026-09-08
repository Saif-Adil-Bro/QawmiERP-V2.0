import { createClient } from "@/lib/supabase/server";
import StudentDirectoryClient from "./StudentDirectoryClient";
import { getMadrasaMetadata } from "@/lib/sessions";
import { getMadrasaInfo } from "@/lib/getMadrasaInfo";

export const dynamic = "force-dynamic";

export default async function TeacherPortalStudents(props: {
  searchParams?: Promise<{ class_id?: string }>;
}) {
  const params = props.searchParams ? (await props.searchParams) || {} : {};
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: userData } = await supabase
    .from("users")
    .select("madrasa_id")
    .eq("id", user.id)
    .single();
  const madrasaId = userData?.madrasa_id;

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
        <StudentDirectoryClient
          classes={[]}
          students={[]}
          currentClassId=""
        />
      );
    }
    classesQuery = classesQuery.in("id", scope.allowedClassIds);
  }

  const [{ data: classes }, meta, madrasaInfo] = await Promise.all([
    classesQuery,
    madrasaId ? getMadrasaMetadata(madrasaId) : null,
    getMadrasaInfo(),
  ]);

  const currentClassId = params.class_id && (!scope.isUnrestricted ? scope.allowedClassIds.includes(params.class_id) : true)
    ? params.class_id
    : classes?.[0]?.id || "";

  let studentsQuery = supabase
    .from("students")
    .select("*, classes(name)")
    .eq("madrasa_id", madrasaId);

  if (!scope.isUnrestricted) {
    if (scope.allowedStudentIds.length === 0) {
      return (
        <StudentDirectoryClient
          classes={classes || []}
          students={[]}
          currentClassId={currentClassId}
          madrasaName={madrasaInfo?.name}
        />
      );
    }
    studentsQuery = studentsQuery.in("id", scope.allowedStudentIds);
  }

  if (currentClassId) {
    studentsQuery = studentsQuery.eq("class_id", currentClassId);
  }

  const { data: rawStudents } = await studentsQuery.order("roll_number", { ascending: true });

  const students = (rawStudents || []).map((s: any) => {
    const profile = meta?.student_profiles?.[s.id] || {};
    const admission = (meta?.admissions || []).find((a: any) => a.confirmed_student_id === s.id);

    const resolvedPhoto = profile.photo_url || s.photo_url || admission?.photo_url || "";
    const resolvedPhone = profile.parent_phone || s.parent_phone || admission?.guardian_phone || admission?.emergency_phone || s.phone || "";
    const resolvedFather = profile.father_name || s.father_name || admission?.father_name_bn || admission?.father_name || "";
    const resolvedMother = profile.mother_name || s.mother_name || admission?.mother_name_bn || admission?.mother_name || "";
    const resolvedGuardian = profile.guardian_name || s.guardian_name || admission?.guardian_name_bn || admission?.guardian_name || resolvedFather || "";
    const resolvedGuardianRelation = profile.guardian_relation || admission?.guardian_relation || (resolvedFather ? "পিতা" : "");
    const resolvedBlood = profile.blood_group || s.blood_group || admission?.blood_group || "";
    const resolvedAddress = profile.address || s.address || admission?.address || "";
    const resolvedClass = profile.class_name || (Array.isArray(s.classes) ? s.classes[0]?.name : s.classes?.name) || s.class_name || "";

    const resolvedStudentId = profile.student_id || s.student_id || admission?.student_id || admission?.admission_no || s.student_code || "";

    return {
      ...s,
      student_id: resolvedStudentId,
      first_name: profile.first_name || s.first_name || "",
      last_name: profile.last_name || s.last_name || "",
      roll_number: profile.roll_number !== undefined && profile.roll_number !== "" ? profile.roll_number : (s.roll_number || ""),
      photo_url: resolvedPhoto,
      parent_phone: resolvedPhone,
      guardian_phone: resolvedPhone,
      phone: resolvedPhone,
      father_name: resolvedFather,
      mother_name: resolvedMother,
      guardian_name: resolvedGuardian,
      guardian_relation: resolvedGuardianRelation,
      blood_group: resolvedBlood,
      address: resolvedAddress,
      class_name: resolvedClass,
      classes: s.classes || (resolvedClass ? { name: resolvedClass } : undefined),
    };
  });

  return (
    <StudentDirectoryClient
      classes={classes || []}
      students={students}
      currentClassId={currentClassId}
      madrasaName={madrasaInfo?.name}
    />
  );
}
