import { getParentFeedbacks } from "@/app/actions/parent-communication";
import FeedbackClient from "./FeedbackClient";
import { getPortalStudentData } from "@/lib/portal-data";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "অভিযোগ, পরামর্শ ও সাক্ষাতকার | অভিভাবক পোর্টাল",
};

export default async function ParentPortalFeedbackPage() {
  const portalData = await getPortalStudentData();

  if (!portalData || !portalData.user) return null;

  const { students, userData } = portalData;

  // Fetch feedbacks
  const initialFeedbacks = await getParentFeedbacks();

  return (
    <FeedbackClient
      students={students || []}
      userProfile={userData}
      initialFeedbacks={initialFeedbacks}
    />
  );
}
