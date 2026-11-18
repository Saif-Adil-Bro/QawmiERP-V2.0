import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  authorizeCronRequest,
  resolveCronTenant,
  runTrackedCronJob,
} from "@/lib/automation/cron-auth";
import { recalculateStudentRiskScores } from "@/lib/early-warning-service";

// Next.js যেন কোনো প্ল্যাটফর্মে (Vercel/Railway) cron রিকোয়েস্ট ক্যাশ না করে
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function handleEarlyWarningCron(req: Request) {
  const auth = await authorizeCronRequest(req);
  if (!auth.ok) return auth.response;

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
      "early_warning",
      madrasaId,
      "cron",
      async () => {
        const summary = await recalculateStudentRiskScores(madrasaId);
        const totalStudents = summary.risk_scores?.length || 0;
        const criticalCount = summary.risk_distribution?.CRITICAL || 0;
        const highCount = summary.risk_distribution?.HIGH || 0;

        return {
          processedCount: totalStudents,
          successCount: totalStudents,
          failedCount: 0,
          summary: {
            madrasaId,
            totalStudents,
            criticalCount,
            highCount,
            attendanceAlerts: summary.attendance_alerts.length,
            examDropAlerts: summary.exam_drop_alerts.length,
          },
        };
      }
    );
    results.push(tracked);
  }

  return NextResponse.json({
    ok: true,
    jobKey: "early_warning",
    tenantsProcessed: results.length,
    results,
  });
}

export async function GET(req: Request) {
  return handleEarlyWarningCron(req);
}

export async function POST(req: Request) {
  return handleEarlyWarningCron(req);
}
