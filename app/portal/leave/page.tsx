import LeaveClient from "./LeaveClient";
import { getParentFeedbacks } from "@/app/actions/parent-communication";
import { getPortalStudentData } from "@/lib/portal-data";

export const dynamic = "force-dynamic";

export default async function ParentPortalLeave() {
  const portalData = await getPortalStudentData();

  if (!portalData || !portalData.user) return null;

  const { students, userData } = portalData;

  // Fetch real leave requests for this parent / student
  const allFeedbacks = await getParentFeedbacks();
  const leaveApplications = allFeedbacks.filter(
    (f) => f.category === "ছুটির আবেদন" || f.action_type === "GENERAL"
  );

  return (
    <LeaveClient
      students={students || []}
      userProfile={userData}
      initialApplications={leaveApplications}
    />
  );
}
