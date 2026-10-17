import { NextRequest, NextResponse } from "next/server";
import { runPhaseBBackfill } from "@/lib/backfill-phase-b";
import { authorizeSuperAdminOrCron } from "@/lib/api-auth";

/**
 * ⛔ সিকিউরিটি: এই রুটে আগে কোনো auth ছিল না — লগইন ছাড়াই যে কেউ GET দিয়ে
 * সব মাদ্রাসার ডেটা-মাইগ্রেশন (admin client, RLS-bypass) চালাতে পারত।
 * এখন শুধু super_admin অথবা সঠিক `CRON_SECRET` bearer টোকেন।
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await authorizeSuperAdminOrCron(req);
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(req.url);
    const dryRun = searchParams.get("dryRun") === "true";
    const madrasaId = searchParams.get("madrasaId") || undefined;

    const result = await runPhaseBBackfill({
      dryRun,
      targetMadrasaId: madrasaId,
    });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      report: result,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Migration failed" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authorizeSuperAdminOrCron(req);
    if (!auth.ok) return auth.response;

    const body = await req.json().catch(() => ({}));
    const result = await runPhaseBBackfill({
      dryRun: Boolean(body.dryRun),
      targetMadrasaId: body.targetMadrasaId || undefined,
    });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      report: result,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Migration failed" },
      { status: 500 }
    );
  }
}
