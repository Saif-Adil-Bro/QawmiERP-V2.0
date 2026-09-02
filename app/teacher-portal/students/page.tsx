import { createClient } from "@/lib/supabase/server";
import StudentDirectoryClient from "./StudentDirectoryClient";

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

  const { data: classes } = await classesQuery;
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
        />
      );
    }
    studentsQuery = studentsQuery.in("id", scope.allowedStudentIds);
  }

  if (currentClassId) {
    studentsQuery = studentsQuery.eq("class_id", currentClassId);
  }

  const { data: students } = await studentsQuery.order("roll_number", { ascending: true });

  return (
    <StudentDirectoryClient
      classes={classes || []}
      students={students || []}
      currentClassId={currentClassId}
    />
  );
}
