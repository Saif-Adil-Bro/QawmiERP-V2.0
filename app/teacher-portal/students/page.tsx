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

  const { data: classes } = await supabase
    .from("classes")
    .select("id, name")
    .eq("madrasa_id", madrasaId)
    .order("name", { ascending: true });

  const currentClassId = params.class_id || classes?.[0]?.id || "";

  let studentsQuery = supabase
    .from("students")
    .select("*, classes(name)")
    .eq("madrasa_id", madrasaId);

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
