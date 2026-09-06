import { getGlobalNotifications } from "@/app/actions/notifications";
import { getActivityLogs } from "@/app/actions/activity-logs";
import NotificationsClient from "./NotificationsClient";

export const metadata = {
  title: "বিজ্ঞপ্তি ও অ্যাক্টিভিটি লগ | QawmiManager",
  description: "মাদরাসার সকল গুরুত্বপূর্ণ ইভেন্ট, ছুটির আবেদন, অভিভাবকের অভিযোগ ও গ্লোবাল অ্যাক্টিভিটি হিস্ট্রি লগ ট্র্যাকিং।",
};

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const [notifData, activityData] = await Promise.all([
    getGlobalNotifications(100),
    getActivityLogs({ limit: 150 }),
  ]);

  return (
    <NotificationsClient
      initialNotifications={notifData?.notifications || []}
      initialStats={
        notifData?.stats || {
          total: 0,
          unread: 0,
          pendingLeaves: 0,
          pendingComplaints: 0,
          pendingAdmissions: 0,
        }
      }
      initialActivityLogs={activityData?.logs || []}
      initialActivityStats={
        activityData?.stats || {
          totalLogs: 0,
          todayCount: 0,
          weekCount: 0,
          successCount: 0,
          moduleCounts: {},
        }
      }
    />
  );
}

