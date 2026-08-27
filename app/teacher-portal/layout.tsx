import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import TeacherShell from "./TeacherShell";

export const dynamic = "force-dynamic";

export default async function TeacherPortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch teacher profile
  const { data: userData } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  return (
    <TeacherShell user={user} userData={userData}>
      {children}
    </TeacherShell>
  );
}
