import { redirect } from "next/navigation";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import {
  getWebhookDeliveriesAction,
  getWebhookEndpointsAction,
} from "@/app/actions/webhooks";
import WebhooksSettingsClient from "./WebhooksSettingsClient";

export const dynamic = "force-dynamic";

export default async function WebhooksSettingsPage() {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) {
    redirect("/login");
  }

  const [epRes, delRes] = await Promise.all([
    getWebhookEndpointsAction(),
    getWebhookDeliveriesAction(50),
  ]);

  return (
    <WebhooksSettingsClient
      initialEndpoints={epRes.endpoints || []}
      initialDeliveries={delRes.deliveries || []}
    />
  );
}
