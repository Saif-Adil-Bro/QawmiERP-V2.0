import { NextResponse } from "next/server";
import { authorizeCronRequest, resolveCronTenant } from "@/lib/automation/cron-auth";
import { runMonthlyFeeGenerationCron } from "@/lib/automation/fee-cron-service";

async function handle(req: Request) {
  const auth = await authorizeCronRequest(req);
  if (!auth.ok) return auth.response;

  let body: any = {};
  if (req.method === "POST") {
    body = await req.json().catch(() => ({}));
  }
  const { searchParams } = new URL(req.url);
  const madrasaId = resolveCronTenant(auth, body.madrasaId || searchParams.get("madrasaId") || null);
  const billingPeriod = body.billingPeriod || searchParams.get("billingPeriod") || undefined;

  const result = await runMonthlyFeeGenerationCron({
    madrasaId,
    billingPeriod,
    triggerSource: "cron",
  });

  return NextResponse.json({ ok: true, ...result });
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
