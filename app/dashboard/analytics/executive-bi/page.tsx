import { redirect } from "next/navigation";
import { createAdminClient, createClient, getAuthUser } from "@/lib/supabase/server";
import {
  getDigestSchedulesAction,
  getExecutiveBiDashboardDataAction,
  getSavedCustomReportsAction,
} from "@/app/actions/bi";
import ExecutiveBiClient from "./ExecutiveBiClient";

export const dynamic = "force-dynamic";

export default async function ExecutiveBiPage() {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) {
    redirect("/login");
  }

  const [biRes, reportsRes, schedulesRes] = await Promise.all([
    getExecutiveBiDashboardDataAction({ months: 6 }),
    getSavedCustomReportsAction(),
    getDigestSchedulesAction(),
  ]);

  let sessions: { id: string; name: string }[] = [];
  try {
    const admin = await createAdminClient();
    const { data: userRow } = await admin
      .from("users")
      .select("madrasa_id")
      .eq("id", user.id)
      .maybeSingle();

    const madrasaId = (userRow as any)?.madrasa_id;
    if (madrasaId) {
      const { data: sessionRows } = await admin
        .from("academic_sessions")
        .select("id, name, code, hijri_year")
        .eq("madrasa_id", madrasaId)
        .order("created_at", { ascending: false });

      if (Array.isArray(sessionRows)) {
        sessions = sessionRows.map((s: any) => ({
          id: String(s.id),
          name: String(s.name || s.code || s.hijri_year || s.id),
        }));
      }
    }
  } catch {
    sessions = [];
  }

  return (
    <ExecutiveBiClient
      initialSnapshot={biRes.snapshot}
      initialError={biRes.error || null}
      initialSavedReports={reportsRes.reports || []}
      initialSchedules={schedulesRes.schedules || []}
      sessions={sessions}
    />
  );
}
