import { redirect } from "next/navigation";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import {
  getEarlyWarningAlerts,
  getRiskScoresAction,
} from "@/app/actions/early-warning";
import EarlyWarningDashboardClient from "./EarlyWarningDashboardClient";

export const dynamic = "force-dynamic";

export default async function EarlyWarningAnalyticsPage() {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) {
    redirect("/login");
  }

  const [summary, scoresRes] = await Promise.all([
    getEarlyWarningAlerts(),
    getRiskScoresAction({ limit: 300 }),
  ]);

  return (
    <EarlyWarningDashboardClient
      initialSummary={summary}
      initialScores={
        summary.risk_scores && summary.risk_scores.length > 0
          ? summary.risk_scores
          : scoresRes.scores || []
      }
    />
  );
}
