import { getGlobalNotifications } from "@/app/actions/notifications";
import NotificationsClient from "./NotificationsClient";

export const metadata = {
  title: "বিজ্ঞপ্তি ও অ্যাক্টিভিটি লগ | QawmiManager",
  description: "মাদরাসার সকল গুরুত্বপূর্ণ ইভেন্ট, ছুটির আবেদন, অভিভাবকের অভিযোগ ও সিস্টেম লগ ট্র্যাকিং।",
};

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const data = await getGlobalNotifications(100);

  return (
    <NotificationsClient
      initialNotifications={data?.notifications || []}
      initialStats={
        data?.stats || {
          total: 0,
          unread: 0,
          pendingLeaves: 0,
          pendingComplaints: 0,
          pendingAdmissions: 0,
        }
      }
    />
  );
}
