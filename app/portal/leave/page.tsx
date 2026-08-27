import { createClient } from "@/lib/supabase/server";
import LeaveClient from "./LeaveClient";

export const dynamic = "force-dynamic";

export default async function ParentPortalLeave() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: userData } = await supabase
    .from("users")
    .select("madrasa_id, full_name, phone")
    .eq("id", user.id)
    .single();
  const madrasaId = userData?.madrasa_id;

  const { data: students } = await supabase
    .from("students")
    .select("id, first_name, last_name, roll_number, student_id, class_name, classes(name)")
    .eq("madrasa_id", madrasaId)
    .order("roll_number", { ascending: true });

  return (
    <LeaveClient
      students={students || []}
      userProfile={userData}
    />
  );
}
