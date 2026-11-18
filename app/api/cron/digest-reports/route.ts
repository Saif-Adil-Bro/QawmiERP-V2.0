import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMissingTableError } from "@/lib/audit-log";
import { authorizeCronRequest, resolveCronTenant, runTrackedCronJob } from "@/lib/automation/cron-auth";
import { getStructuredMadrasaSetting } from "@/lib/structured-config";
import {
  buildDigestHtml,
  buildDigestWorkbook,
  dispatchScheduledDigestNotifications,
  type DigestScheduleRecord,
} from "@/lib/bi/digest-generator";
import { buildExportWatermark } from "@/lib/export-watermark";
import { getExecutiveBiSnapshot } from "@/lib/bi/executive-bi-service";

// Next.js যেন কোনো প্ল্যাটফর্মে (Vercel/Railway) cron রিকোয়েস্ট ক্যাশ না করে
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function handleDigestCron(req: Request) {
  const auth = await authorizeCronRequest(req);
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  let targetMadrasaId = url.searchParams.get("madrasaId") || "";
  if (!targetMadrasaId && req.method === "POST") {
    try {
      const body = (await req.json()) as Record<string, unknown>;
      if (body && typeof body.madrasaId === "string") {
        targetMadrasaId = body.madrasaId;
      }
    } catch {
      // empty or non-json body is valid
    }
  }

  targetMadrasaId = resolveCronTenant(auth, targetMadrasaId) || "";
  const admin = await createAdminClient();
  let schedules: DigestScheduleRecord[] = [];
  let usingSql = true;

  try {
    let q = admin.from("digest_schedules").select("*").eq("is_enabled", true);
    if (targetMadrasaId) q = q.eq("madrasa_id", targetMadrasaId);
    const { data, error } = await q;

    if (!error && Array.isArray(data)) {
      schedules = data.map((d: any) => ({
        ...d,
        recipients: Array.isArray(d.recipients) ? d.recipients : [],
      }));
    } else if (error && isMissingTableError(error)) {
      usingSql = false;
    } else if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } catch {
    usingSql = false;
  }

  if (!usingSql && targetMadrasaId) {
    const fb = await getStructuredMadrasaSetting<DigestScheduleRecord[]>(
      targetMadrasaId,
      "bi",
      "digest_schedules"
    );
    if (Array.isArray(fb.value)) {
      schedules = fb.value.filter((s) => s.is_enabled);
    }
  }

  // Group schedules by madrasa_id
  const byMadrasa = new Map<string, DigestScheduleRecord[]>();
  for (const s of schedules) {
    if (!s.madrasa_id) continue;
    const arr = byMadrasa.get(s.madrasa_id) || [];
    arr.push(s);
    byMadrasa.set(s.madrasa_id, arr);
  }

  const results: any[] = [];
  let schedulesProcessed = 0;

  for (const [madrasaId, madrasaSchedules] of byMadrasa.entries()) {
    const tracked = await runTrackedCronJob(
      "digest-reports",
      madrasaId,
      "cron",
      async () => {
        const snapshot = await getExecutiveBiSnapshot(madrasaId, { months: 6 });
        let successCount = 0;
        let failedCount = 0;

        for (const sched of madrasaSchedules) {
          schedulesProcessed += 1;
          try {
            const watermark = buildExportWatermark({
              exportedBy: "Automated Cron",
              actorRole: "system",
              ipAddress: "cron",
              dataset: "executive_bi_digest",
            });

            if (sched.format === "xlsx") {
              buildDigestWorkbook(snapshot, watermark);
            } else {
              buildDigestHtml(snapshot, watermark, {
                title: sched.name || "Scheduled Executive BI Digest",
              });
            }

            await dispatchScheduledDigestNotifications(madrasaId, sched, snapshot);

            if (usingSql) {
              await admin
                .from("digest_schedules")
                .update({ last_sent_at: new Date().toISOString() })
                .eq("id", sched.id)
                .eq("madrasa_id", madrasaId);
            }

            successCount += 1;
          } catch {
            failedCount += 1;
          }
        }

        return {
          processedCount: madrasaSchedules.length,
          successCount,
          failedCount,
          summary: {
            madrasaId,
            scheduleIds: madrasaSchedules.map((s) => s.id),
          },
        };
      }
    );

    results.push(tracked);
  }

  return NextResponse.json(
    {
      ok: true,
      madrasasProcessed: byMadrasa.size,
      schedulesProcessed,
      results,
    },
    { status: 200 }
  );
}

export async function GET(req: Request) {
  return handleDigestCron(req);
}

export async function POST(req: Request) {
  return handleDigestCron(req);
}
