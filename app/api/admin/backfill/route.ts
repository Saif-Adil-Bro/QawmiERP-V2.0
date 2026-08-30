import { NextRequest, NextResponse } from "next/server";
import { runPhaseBBackfill } from "@/lib/backfill-phase-b";

export async function GET(req: NextRequest) {
  try {
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
