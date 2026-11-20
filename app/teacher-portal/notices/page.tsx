import { createClient } from "@/lib/supabase/server";
import PortalNoticesClient from "@/components/portal/PortalNoticesClient";

export const dynamic = "force-dynamic";

export default async function TeacherPortalNotices() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: userData } = await supabase
    .from("users")
    .select("madrasa_id")
    .eq("id", user.id)
    .maybeSingle();
  const madrasaId = userData?.madrasa_id;

  const { data: notices } = madrasaId
    ? await supabase
        .from("notices")
        .select("*")
        .eq("madrasa_id", madrasaId)
        .order("created_at", { ascending: false })
    : { data: [] as any[] };

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
