import { createClient } from "@/lib/supabase/server";
import PortalNoticesClient from "@/components/portal/PortalNoticesClient";

export const dynamic = "force-dynamic";

export default async function ParentPortalNotices() {
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
      portalType="student"
      title="মাদরাসা নোটিশ ও জরুরি ঘোষণা"
      subtitle="মাদরাসার ছুটি, পরীক্ষার তারিখ ও গুরুত্বপূর্ণ বিজ্ঞপ্তি এখানে দেখুন।"
      accent="indigo"
      notices={notices || []}
    />
  );
}
