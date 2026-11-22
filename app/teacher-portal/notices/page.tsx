import {portalHolidays} from '@/lib/portal/rules';
import {notices as getNotices} from '@/lib/portal/queries';
import {webTeacher} from '@/lib/portal/identity';
import PortalNoticesClient from "@/components/portal/PortalNoticesClient";

export const dynamic = "force-dynamic";

export default async function NoticesPage() {
  const t = await webTeacher(); if (!t) return null;
  const notices = await getNotices(t.i.db,t.i.tenant,'Teachers',t.scope.classes.map(c=>c.id),portalHolidays(t.scope.meta.academic_holidays,t.scope.classes));
  return (
    <PortalNoticesClient
      portalType="teacher"
      title="শিক্ষক ও স্টাফ নোটিশ বোর্ড"
      subtitle="মাদরাসা পরিচালনা কমিটি ও মুহতামিমের পক্ষ থেকে জরুরি নির্দেশনা ও মিটিং নোটিশ।"
      accent="rose"
      notices={notices || []}
      emptyTitle="বর্তমানে কোনো স্টাফ নোটিশ নেই"
      emptySubtitle="নতুন দাপ্তরিক ঘোষণা এখানে প্রকাশিত হবে।"
    />
  );
}
