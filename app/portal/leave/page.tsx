import { isLeaveFeedback } from "@/lib/portal/rules";
import type { StudentLeaveApplication } from "@/app/actions/leaves";
import LeaveClient from "./LeaveClient";
import { getParentFeedbacks } from "@/app/actions/parent-communication";
import { getPortalStudentData } from "@/lib/portal-data";

export const dynamic = "force-dynamic";

export default async function ParentPortalLeave({
  searchParams,
}: {
  searchParams: Promise<{ student_id?: string }>;
}) {
  const portalData = await getPortalStudentData(
    (await searchParams).student_id,
  );

  if (!portalData || !portalData.child) return null;

  const { students, userData } = portalData;

  // Fetch real leave requests for this parent / student
  const allFeedbacks = await getParentFeedbacks({
    studentId: portalData.child.id,
  });
  const raw: StudentLeaveApplication[] = Array.isArray(
    portalData.meta.student_leave_applications,
  )
    ? portalData.meta.student_leave_applications
    : [];
  const stored = raw.filter(
    (a) => a?.student_id === portalData.child.id && a.status !== "ARCHIVED",
  );
  const mirrors = new Set(
    raw
      .filter((a) => a?.student_id === portalData.child.id)
      .map((a) => a.feedback_id)
      .filter(Boolean),
  );
  const leaveApplications = allFeedbacks.filter(
    (f) => !mirrors.has(f.id) && isLeaveFeedback(f),
  );

  return (
    <LeaveClient
      key={portalData.child.id}
      selectedStudentId={portalData.child.id}
      students={students || []}
      userProfile={userData}
      initialApplications={[
        ...stored.map((a) => ({
          ...a,
          subject: `${a.leave_type} - ছুটির আবেদন`,
          description: `${a.approved_start_date || a.start_date} – ${a.approved_end_date || a.end_date}: ${a.reason}`,
        })),
        ...leaveApplications,
      ].sort((a, b) =>
        String(b.created_at || "").localeCompare(String(a.created_at || "")),
      )}
    />
  );
}
