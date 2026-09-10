import { createClient, getAuthUser } from "@/lib/supabase/server";
import { getAuthMadrasaId } from "@/app/actions/students";
import { getStaffMetadataFull } from "@/app/actions/staff";
import RoutineBuilderClient from "./RoutineBuilderClient";

export const dynamic = "force-dynamic";

export default async function RoutineBuilderPage(props: {
  searchParams?: Promise<{ class_id?: string; type?: string }>;
}) {
  const params = props.searchParams ? (await props.searchParams) || {} : {};
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  let madrasaId: string | null = null;
  if (user) {
    madrasaId = await getAuthMadrasaId(supabase, user);
  }

  const staffData = await getStaffMetadataFull();
  const staffMembers = staffData?.staff_members || [];

  let classesQuery = supabase.from("classes").select("id, name");
  let subjectsQuery = supabase.from("subjects").select("id, name, code");
  let teachersQuery = supabase.from("teachers").select("id, first_name, last_name");

  if (madrasaId) {
    classesQuery = classesQuery.eq("madrasa_id", madrasaId);
    subjectsQuery = subjectsQuery.eq("madrasa_id", madrasaId);
    teachersQuery = teachersQuery.eq("madrasa_id", madrasaId);
  }

  const [{ data: classesData }, { data: subjectsData }, { data: teachersData }] = await Promise.all([
    classesQuery.order("name", { ascending: true }),
    subjectsQuery.order("name", { ascending: true }),
    teachersQuery.order("first_name", { ascending: true }),
  ]);

  const classes = classesData || [];
  const subjects = subjectsData || [];
  let teachers = teachersData || [];

  const existingTeacherIds = new Set(teachers.map((t) => t.id));
  staffMembers.forEach((s) => {
    if (!existingTeacherIds.has(s.id)) {
      teachers.push({
        id: s.id,
        first_name: s.personal.first_name || s.personal.full_name_bn || "শিক্ষক",
        last_name: s.personal.last_name || "",
      });
    }
  });

  const classId = params?.class_id || (classes?.[0]?.id || "");
  const routineType = params?.type || "Class";

  let routines = [];
  if (classId) {
    let q = supabase
      .from("routines")
      .select("*, classes(name), subjects(name), teachers(first_name, last_name)")
      .eq("class_id", classId);

    if (routineType === "Class") {
      q = q.in("routine_type", ["Class", "OffDay"]);
    } else {
      q = q.eq("routine_type", routineType);
    }

    const { data } = await q.order("start_time", { ascending: true });
    routines = data || [];
  }

  return (
    <RoutineBuilderClient
      classes={classes}
      subjects={subjects}
      teachers={teachers}
      routines={routines}
      initialClassId={classId}
      initialType={routineType}
    />
  );
}
