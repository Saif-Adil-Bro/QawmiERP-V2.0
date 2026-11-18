import { redirect } from "next/navigation";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { getFinancialAnomaliesAction } from "@/app/actions/anomalies";
import AnomaliesDashboardClient from "./AnomaliesDashboardClient";

export const dynamic = "force-dynamic";

export default async function FinancialAnomaliesPage() {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) {
    redirect("/login");
  }

  const res = await getFinancialAnomaliesAction({ limit: 200 });

  return (
    <AnomaliesDashboardClient
      initialAnomalies={res.anomalies || []}
      initialError={res.ok ? undefined : res.error}
    />
  );
}
