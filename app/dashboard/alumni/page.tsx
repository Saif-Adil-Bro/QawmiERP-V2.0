import { createClient, getAuthUser } from "@/lib/supabase/server";
import { getAlumniMembers } from "@/app/actions/alumni";
import AlumniClient from "./AlumniClient";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "ফারিগীন ও অ্যালামনাই নেটওয়ার্ক | QawmiManager",
  description: "হিফজ সমাপ্ত ও দাওরায়ে হাদিস পাসকৃত প্রাক্তন শিক্ষার্থীদের কর্মস্থল, খেদমত ও যোগাযোগ ডিরেক্টরি",
};

export const dynamic = "force-dynamic";

export default async function AlumniPage() {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);

  const initialAlumni = await getAlumniMembers();

  return (
    <div className="space-y-6">
      <AlumniClient initialAlumni={initialAlumni} />
    </div>
  );
}
