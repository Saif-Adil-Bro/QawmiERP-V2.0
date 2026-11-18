import { NextResponse } from "next/server";
import { authorizeCronRequest, resolveCronTenant, runTrackedCronJob } from "@/lib/automation/cron-auth";
import { processNotificationQueue } from "@/lib/notifications/orchestrator";
import { retryPendingWebhookDeliveries } from "@/lib/webhooks/dispatcher";

async function handle(req: Request) {
  const auth = await authorizeCronRequest(req);
  if (!auth.ok) return auth.response;

  let body: any = {};
  if (req.method === "POST") {
    body = await req.json().catch(() => ({}));
  }
  const { searchParams } = new URL(req.url);
  const madrasaId = resolveCronTenant(auth, body.madrasaId || searchParams.get("madrasaId") || null);
  const limit = Math.min(200, Math.max(1, Number(body.limit || searchParams.get("limit") || 50)));

  const tracked = await runTrackedCronJob("process_queues", madrasaId, "cron", async () => {
    const [notifications, webhooks] = await Promise.all([
      processNotificationQueue(limit, madrasaId || undefined),
      retryPendingWebhookDeliveries(limit, madrasaId || undefined),
    ]);

    return {
      processedCount: notifications.processed + webhooks.processed,
      successCount: notifications.sent + webhooks.delivered,
      failedCount: notifications.failed + webhooks.failed,
      summary: {
        notifications,
        webhooks,
      },
    };
  });

  return NextResponse.json({
    ...tracked,
    notifications: (tracked.summary as any)?.notifications || null,
    webhooks: (tracked.summary as any)?.webhooks || null,
  });
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
