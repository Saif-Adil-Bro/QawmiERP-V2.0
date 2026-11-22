import {childLogs} from '@/lib/portal/queries';
import { getPortalStudentData } from "@/lib/portal-data";
import PortalAttendanceClient from "./PortalAttendanceClient";

export const dynamic = "force-dynamic";

export default async function ParentPortalAttendance(props: {
  searchParams?: Promise<{ student_id?: string; month?: string }>;
}) {
  const params = props.searchParams ? (await props.searchParams) || {} : {};
  const portalData = await getPortalStudentData(params.student_id);

  if (!portalData || !portalData.user) return null;

  const { students, child, adminClient } = portalData;

  if (students.length === 0 || !child) {
    return (
      <div className="p-8 bg-white rounded-2xl border border-slate-200 text-center text-slate-500">
        কোনো শিক্ষার্থী সংযুক্ত পাওয়া যায়নি।
      </div>
    );
  }

  const attendanceLogs = (await childLogs(adminClient,portalData.madrasaId,'attendance',[child.id]))
    .filter(log=> !params.month || log.date.startsWith(params.month));
  return (
    <PortalAttendanceClient
      students={students}
      child={child}
      month={params.month} attendanceLogs={attendanceLogs || []}
    />
  );
}
