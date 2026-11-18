import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/api-auth";
import {
  getFinancialAnomalies,
  runFinancialAnomalyScan,
  updateFinancialAnomalyStatus,
} from "@/lib/anomaly-detection-service";

export async function GET(req: Request) {
  const auth = await authorizeApi("anomaly");
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(req.url);
    const status = url.searchParams.get("status") || undefined;
    const severity = url.searchParams.get("severity") || undefined;
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam
      ? Math.max(1, Math.min(500, Number(limitParam) || 100))
      : undefined;

    const anomalies = await getFinancialAnomalies(auth.ctx.madrasaId, {
      status,
      severity,
      limit,
    });

    return NextResponse.json({
      ok: true,
      anomalies,
      count: anomalies.length,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "অ্যানোমালি তালিকা লোড ব্যর্থ হয়েছে।" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const auth = await authorizeApi("anomaly");
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "scan").toLowerCase();

    if (action === "scan") {
      const lookbackDays = body?.lookbackDays
        ? Number(body.lookbackDays)
        : undefined;
      const result = await runFinancialAnomalyScan(auth.ctx.madrasaId, {
        lookbackDays,
        actorId: auth.ctx.userId,
        actorName: auth.ctx.actorName,
      });

      return NextResponse.json({
        ok: true,
        result,
        anomalies: result.anomalies,
      });
    }

    if (action === "resolve" || action === "dismiss" || action === "investigate") {
      const anomalyId = String(body?.anomalyId || body?.id || "").trim();
      if (!anomalyId) {
        return NextResponse.json(
          { ok: false, error: "সঠিক anomalyId প্রদান করুন।" },
          { status: 400 }
        );
      }

      let status: "INVESTIGATING" | "RESOLVED" | "DISMISSED" = "RESOLVED";
      if (body?.status) {
        const requested = String(body.status).toUpperCase();
        if (
          requested === "INVESTIGATING" ||
          requested === "RESOLVED" ||
          requested === "DISMISSED"
        ) {
          status = requested;
        }
      } else if (action === "dismiss") {
        status = "DISMISSED";
      } else if (action === "investigate") {
        status = "INVESTIGATING";
      }

      const res = await updateFinancialAnomalyStatus({
        madrasaId: auth.ctx.madrasaId,
        anomalyId,
        status,
        actorId: auth.ctx.userId,
        actorName: auth.ctx.actorName,
        resolutionNotes: body?.resolutionNotes
          ? String(body.resolutionNotes)
          : undefined,
      });

      if (!res.ok) {
        return NextResponse.json(
          { ok: false, error: res.error || "আপডেট ব্যর্থ হয়েছে।" },
          { status: 400 }
        );
      }

      return NextResponse.json({
        ok: true,
        record: res.record,
      });
    }

    return NextResponse.json(
      { ok: false, error: "অকার্যকর অ্যাকশন।" },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "রিকোয়েস্ট প্রসেস ব্যর্থ হয়েছে।" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  const auth = await authorizeApi("anomaly");
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json().catch(() => ({}));
    const anomalyId = String(body?.anomalyId || body?.id || "").trim();
    const statusRaw = String(body?.status || "RESOLVED").toUpperCase();

    if (
      !anomalyId ||
      (statusRaw !== "INVESTIGATING" &&
        statusRaw !== "RESOLVED" &&
        statusRaw !== "DISMISSED")
    ) {
      return NextResponse.json(
        { ok: false, error: "সঠিক anomalyId এবং status প্রদান করুন।" },
        { status: 400 }
      );
    }

    const res = await updateFinancialAnomalyStatus({
      madrasaId: auth.ctx.madrasaId,
      anomalyId,
      status: statusRaw,
      actorId: auth.ctx.userId,
      actorName: auth.ctx.actorName,
      resolutionNotes: body?.resolutionNotes
        ? String(body.resolutionNotes)
        : undefined,
    });

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: res.error || "আপডেট ব্যর্থ হয়েছে।" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      record: res.record,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "রিকোয়েস্ট প্রসেস ব্যর্থ হয়েছে।" },
      { status: 500 }
    );
  }
}
