import { getPortalStudentData } from "@/lib/portal-data";
import { getMadrasaMetadata, type MadrasaMetaWithSessions } from "@/lib/sessions";
import { parseRoutineItem } from "@/lib/routine-helper";
import PortalRoutineClient from "./PortalRoutineClient";

export const dynamic = "force-dynamic";

export default async function ParentPortalRoutine(props: {
  searchParams?: Promise<{ student_id?: string }>;
}) {
  const params = props.searchParams ? (await props.searchParams) || {} : {};
  const portalData = await getPortalStudentData(params.student_id);

  if (!portalData || !portalData.user) return null;

  const { students, child, madrasaId, adminClient } = portalData;

  if (students.length === 0 || !child) {
    return (
      <div className="p-8 bg-white rounded-2xl border border-slate-200 text-center text-slate-500">
        কোনো শিক্ষার্থী সংযুক্ত পাওয়া যায়নি।
      </div>
    );
  }

  const classId =
    child?.class_id || (Array.isArray(child?.classes) ? child.classes[0]?.id : child?.classes?.id);
  const className =
    (Array.isArray(child?.classes) ? child.classes[0]?.name : child?.classes?.name) ||
    child?.class_name ||
    "নির্ধারিত জামাত";

  let routineQuery = adminClient
    .from("routines")
    .select("*, subjects(name), teachers(first_name, last_name)")
    .eq("madrasa_id", madrasaId);

  if (classId) {
    routineQuery = routineQuery.eq("class_id", classId);
  }

  const [{ data: rawRoutines }, madrasaMeta] = await Promise.all([
    routineQuery.order("start_time", { ascending: true }),
    madrasaId
      ? getMadrasaMetadata(madrasaId)
      : Promise.resolve({} as MadrasaMetaWithSessions),
  ]);

  const routines = (rawRoutines || []).map(parseRoutineItem);
  const activeHolidays = (madrasaMeta?.academic_holidays || [])
    .filter((h) => !h.is_archived && h.publish_to_portal !== false)
    .map((h) => ({
      id: h.id,
      title: h.title,
      start_date: h.start_date,
      end_date: h.end_date,
    }));

  return (
    <PortalRoutineClient
      students={students}
      child={child}
      className={className}
      routines={routines}
      holidays={activeHolidays}
    />
  );
}
