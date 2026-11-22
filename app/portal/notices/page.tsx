import {portalHolidays} from '@/lib/portal/rules';
import {notices as getNotices} from '@/lib/portal/queries';
import {getPortalStudentData} from '@/lib/portal-data';
import PortalNoticesClient from "@/components/portal/PortalNoticesClient";

export const dynamic = "force-dynamic";

export default async function NoticesPage({searchParams}:{searchParams:Promise<{student_id?:string}>}) {
  const data = await getPortalStudentData((await searchParams).student_id);
  if (!data) return null;
  const notices = await getNotices(data.adminClient,data.madrasaId,'Students',data.child?.class_id ? [data.child.class_id] : [],portalHolidays(data.meta.academic_holidays,data.child?.classes ? [data.child.classes] : []));
  return (
    <PortalNoticesClient
      portalType="student"
      title="মাদরাসা নোটিশ ও জরুরি ঘোষণা"
      subtitle="মাদরাসার ছুটি, পরীক্ষার তারিখ ও গুরুত্বপূর্ণ বিজ্ঞপ্তি এখানে দেখুন।"
      accent="indigo"
      notices={notices || []}
    />
  );
}
