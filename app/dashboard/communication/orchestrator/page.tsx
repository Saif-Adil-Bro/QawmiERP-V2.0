import { redirect } from "next/navigation";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import {
  getNotificationQueueAction,
  getNotificationTemplatesAction,
} from "@/app/actions/notification-orchestrator";
import NotificationOrchestratorClient from "./NotificationOrchestratorClient";

export const dynamic = "force-dynamic";

export default async function NotificationOrchestratorPage() {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) {
    redirect("/login");
  }

  const [tplRes, queueRes] = await Promise.all([
    getNotificationTemplatesAction(),
    getNotificationQueueAction(50),
  ]);

  return (
    <NotificationOrchestratorClient
      initialTemplates={tplRes.templates || []}
      initialQueue={queueRes.items || []}
    />
  );
}
