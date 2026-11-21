import {routines as getRoutines} from '@/lib/portal/queries';
import {portalHolidays} from '@/lib/portal/rules';
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

  const routines = await getRoutines(adminClient,madrasaId,classId ? [classId] : []);
  const activeHolidays = portalHolidays(portalData.meta.academic_holidays,child.classes ? [child.classes] : []);
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
