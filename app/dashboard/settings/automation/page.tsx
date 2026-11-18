import { redirect } from "next/navigation";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import {
  getAutomationRulesAction,
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

  const [rulesRes, logsRes] = await Promise.all([
    getAutomationRulesAction(),
    getJobExecutionLogsAction(50),
  ]);

  return (
    <AutomationSettingsClient
      initialRules={rulesRes.rules || []}
      initialLogs={logsRes.logs || []}
    />
  );
}
