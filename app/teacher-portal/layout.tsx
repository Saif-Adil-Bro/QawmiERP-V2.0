import { createClient, createAdminClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import TeacherShell from "./TeacherShell";

export const dynamic = "force-dynamic";

export default async function TeacherPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  // Cookie-based local session check first (no network round-trip required)
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  // Verify against auth server when reachable, but do not bounce on transient refresh/offline errors
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (!user && userError) {
    console.warn(
      "TeacherPortal: সেশন আছে কিন্তু সার্ভার যাচাইয়ে সাময়িক ত্রুটি হয়েছে:",
      userError.message
    );
  }

  const effectiveUser = user ?? session.user;
  if (!effectiveUser) {
    redirect("/login");
  }

  // Fetch teacher profile safely
  let userData: any = null;
  try {
    const admin = await createAdminClient();
    const { data } = await admin
      .from("users")
      .select("*")
      .eq("id", effectiveUser.id)
      .maybeSingle();
    userData = data;
  } catch {
    try {
      const { data } = await supabase
        .from("users")
        .select("*")
        .eq("id", effectiveUser.id)
        .maybeSingle();
      userData = data;
    } catch {
      userData = null;
    }
  }

  return (
    <TeacherShell user={effectiveUser} userData={userData}>
      {children}
    </TeacherShell>
  );
}
