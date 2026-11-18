import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  authorizeCronRequest,
  resolveCronTenant,
  runTrackedCronJob,
} from "@/lib/automation/cron-auth";
import { runFinancialAnomalyScan } from "@/lib/anomaly-detection-service";

// Next.js যেন কোনো প্ল্যাটফর্মে (Vercel/Railway) cron রিকোয়েস্ট ক্যাশ না করে
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function handleAnomaliesCron(req: Request) {
  const auth = await authorizeCronRequest(req);
  if (!auth.ok) {
    if (req.headers.get("authorization")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return auth.response;
  }

  const url = new URL(req.url);
  let targetMadrasaId = url.searchParams.get("madrasaId") || null;

  if (!targetMadrasaId && req.method === "POST") {
    try {
      const body = await req.json();
      if (body?.madrasaId) targetMadrasaId = String(body.madrasaId);
    } catch {
      // ignore empty body
    }
  }

  const admin = await createAdminClient();
  targetMadrasaId = resolveCronTenant(auth, targetMadrasaId);
  let madrasaIds: string[] = [];

  if (targetMadrasaId) {
    madrasaIds = [targetMadrasaId];
  } else {
    const { data: madrasas } = await admin.from("madrasas").select("id");
    madrasaIds = (madrasas || []).map((m) => String(m.id));
  }

  const results = [];
  for (const madrasaId of madrasaIds) {
    const tracked = await runTrackedCronJob(
      "anomalies",
      madrasaId,
      "cron",
      async () => {
        const scan = await runFinancialAnomalyScan(madrasaId, {
          lookbackDays: 60,
        });
        return {
          processedCount: scan.detectedCount,
          successCount: scan.newlyCreatedCount,
          failedCount: 0,
          summary: {
            madrasaId,
            detectedCount: scan.detectedCount,
            newlyCreatedCount: scan.newlyCreatedCount,
            deduplicatedCount: scan.deduplicatedCount,
          },
        };
      }
    );
    results.push(tracked);
  }

  return NextResponse.json({
    ok: true,
    jobKey: "anomalies",
    tenantsProcessed: results.length,
    results,
  });
}

export async function GET(req: Request) {
  return handleAnomaliesCron(req);
}

export async function POST(req: Request) {
  return handleAnomaliesCron(req);
}
