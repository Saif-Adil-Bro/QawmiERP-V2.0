import { redirect } from "next/navigation";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import {
  getAutomationRulesAction,getAutomationHeartbeatAction,
  getJobExecutionLogsAction,
} from "@/app/actions/automation";
import AutomationSettingsClient from "./AutomationSettingsClient";

export const dynamic = "force-dynamic";

export default async function AutomationSettingsPage() {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) {
    redirect("/login");
  }

  const [rulesRes, logsRes, health] = await Promise.all([
    getAutomationRulesAction(),
    getJobExecutionLogsAction(50),getAutomationHeartbeatAction(),
  ]);

  return (
    <AutomationSettingsClient
      initialHeartbeat={health.heartbeat} initialError={rulesRes.error || logsRes.error || health.error}
      initialRules={rulesRes.rules || []}
      initialLogs={logsRes.logs || []}
    />
  );
}
