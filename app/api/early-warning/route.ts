import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/api-auth";
import {
  getCurrentUserMaskingContext,
  maskPhoneNumber,
} from "@/lib/data-access-guards";
import { requirePermission } from "@/lib/permissions-server";
import {
  getStudentRiskScores,
  recalculateStudentRiskScores,
  resolveStudentIdByRiskScoreId,
  updateRiskIntervention,
} from "@/lib/early-warning-service";
import type { InterventionStatus, RiskDistribution } from "@/lib/early-warning";

function maskScores<T extends { parent_phone?: string | null }>(
  items: T[],
  allowUnmasked: boolean
): T[] {
  if (allowUnmasked) return items;
  return items.map((item) => ({
    ...item,
    parent_phone: item.parent_phone ? maskPhoneNumber(item.parent_phone) : null,
  }));
}

export async function GET(req: Request) {
  const auth = await authorizeApi("analytics");
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(req.url);
    const riskLevel = url.searchParams.get("riskLevel") || undefined;
    const classId = url.searchParams.get("classId") || undefined;
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? Math.max(1, Math.min(500, Number(limitParam) || 100)) : undefined;
    const recalculate = url.searchParams.get("recalculate") === "true";

    const masking = await getCurrentUserMaskingContext("students", "phone");
    const allowUnmasked = masking.allowUnmasked === true;

    if (recalculate) {
      await recalculateStudentRiskScores(auth.ctx.madrasaId, { classId });
    }

    const rawScores = await getStudentRiskScores(auth.ctx.madrasaId, {
      riskLevel,
      classId,
      limit,
    });
    const scores = maskScores(rawScores, allowUnmasked);

    const distribution: RiskDistribution = {
      LOW: scores.filter((s) => s.risk_level === "LOW").length,
      MEDIUM: scores.filter((s) => s.risk_level === "MEDIUM").length,
      HIGH: scores.filter((s) => s.risk_level === "HIGH").length,
      CRITICAL: scores.filter((s) => s.risk_level === "CRITICAL").length,
      total: scores.length,
    };

    return NextResponse.json({
      ok: true,
      scores,
      distribution,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "আর্লি ওয়ার্নিং ডেটা লোড করতে সমস্যা হয়েছে।" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const auth = await authorizeApi("analytics");
  if (!auth.ok) return auth.response;

  const perm = await requirePermission({
    userId: auth.ctx.userId,
    madrasaId: auth.ctx.madrasaId,
    permissions: ["analytics.early_warning.manage"],
    roles: ["super_admin", "admin", "muhtamim", "naib_muhtamim"],
    errorMessage: "এই অপারেশনের জন্য আপনার অনুমতি নেই।",
  });
  if (!perm.allowed) {
    return NextResponse.json(
      { ok: false, error: perm.error || "এই অপারেশনের জন্য আপনার অনুমতি নেই।" },
      { status: 403 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "recalculate");
    const masking = await getCurrentUserMaskingContext("students", "phone");
    const allowUnmasked = masking.allowUnmasked === true;

    if (action === "recalculate") {
      const summary = await recalculateStudentRiskScores(auth.ctx.madrasaId, {
        classId: body?.classId ? String(body.classId) : undefined,
      });
      const maskedScores = maskScores(summary.risk_scores || [], allowUnmasked);
      return NextResponse.json({
        ok: true,
        summary: {
          ...summary,
          risk_scores: maskedScores,
          attendance_alerts: maskScores(summary.attendance_alerts, allowUnmasked),
          exam_drop_alerts: maskScores(summary.exam_drop_alerts, allowUnmasked),
        },
        scores: maskedScores,
        distribution: summary.risk_distribution,
      });
    }

    if (action === "intervene" || action === "notify_guardian") {
      let studentId = String(body?.studentId || "").trim();
      const riskScoreId = String(body?.riskScoreId || "").trim();
      const rawStatus = body?.status ? String(body.status).trim().toUpperCase() : "";
      const status = (
        rawStatus || (action === "notify_guardian" ? "CONTACTED" : "")
      ) as InterventionStatus;
      const validStatuses: InterventionStatus[] = [
        "PENDING",
        "CONTACTED",
        "IN_PROGRESS",
        "RESOLVED",
        "DISMISSED",
      ];

      if ((!studentId && !riskScoreId) || !validStatuses.includes(status)) {
        return NextResponse.json(
          { ok: false, error: "সঠিক studentId বা riskScoreId এবং intervention status প্রদান করুন।" },
          { status: 400 }
        );
      }

      if (!studentId && riskScoreId) {
        const resolved = await resolveStudentIdByRiskScoreId(
          auth.ctx.madrasaId,
          riskScoreId
        );
        if (!resolved) {
          return NextResponse.json(
            { ok: false, error: "সংশ্লিষ্ট ঝুঁকি রেকর্ড পাওয়া যায়নি।" },
            { status: 404 }
          );
        }
        studentId = resolved;
      }

      const notifyGuardian =
        action === "notify_guardian" ? true : Boolean(body?.notifyGuardian);

      const result = await updateRiskIntervention(auth.ctx.madrasaId, studentId, {
        status,
        notes: body?.notes ? String(body.notes) : undefined,
        actorId: auth.ctx.userId,
        actorName: auth.ctx.actorName,
        notifyGuardian,
      });

      if (!result.ok) {
        return NextResponse.json(
          { ok: false, error: result.error || "ইন্টারভেনশন সংরক্ষণ ব্যর্থ হয়েছে।" },
          { status: 400 }
        );
      }

      const record =
        result.record && !allowUnmasked && result.record.parent_phone
          ? {
              ...result.record,
              parent_phone: maskPhoneNumber(result.record.parent_phone),
            }
          : result.record;

      return NextResponse.json({
        ok: true,
        record,
        notificationSent: Boolean(result.notificationSent),
      });
    }

    return NextResponse.json(
      { ok: false, error: "অকার্যকর অ্যাকশন।" },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "রিকোয়েস্ট প্রসেস করতে সমস্যা হয়েছে।" },
      { status: 500 }
    );
  }
}
