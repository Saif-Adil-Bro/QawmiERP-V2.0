import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import PortalShell from "./PortalShell";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch user profile
  const { data: userData } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  return (
    <PortalShell user={user} userData={userData}>
      {children}
    </PortalShell>
  );
}
