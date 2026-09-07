import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import TeacherShell from "./TeacherShell";

export const dynamic = "force-dynamic";

export default async function TeacherPortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);

  if (!user) {
    redirect("/login");
  }

  // Fetch teacher profile safely
  let userData: any = null;
  try {
    const admin = await createAdminClient();
    const { data } = await admin
      .from("users")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    userData = data;
  } catch {
    const { data } = await supabase
      .from("users")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    userData = data;
  }

  return (
    <TeacherShell user={user} userData={userData}>
      {children}
    </TeacherShell>
  );
}
