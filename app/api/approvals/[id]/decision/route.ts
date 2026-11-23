import { NextRequest, NextResponse } from "next/server";
import { authorizeApi } from "@/lib/api-auth";
import { loadServerPermissions } from "@/lib/permissions-server";
import { decideApprovalStepForActor } from "@/lib/approval-execution";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeApi("approvals");
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    const body = (await req.json().catch(() => ({}))) as Record<string, any>;
    const decision = String(body.decision || "").toUpperCase() as
      | "APPROVED"
      | "REJECTED";
    const notes = typeof body.notes === "string" ? body.notes : "";
    const stepUpToken =
      typeof body.stepUpToken === "string"
        ? body.stepUpToken
        : req.headers.get("x-step-up-token");

    const permCtx = await loadServerPermissions(auth.ctx.userId, auth.ctx.madrasaId);
    const result = await decideApprovalStepForActor({
      madrasaId: auth.ctx.madrasaId,
      userId: auth.ctx.userId,
      actorName: auth.ctx.actorName || permCtx?.profile?.fullName || "অনুমোদনকারী",
      actorRole: auth.ctx.actorRole || permCtx?.role || "staff",
      roles: permCtx?.roles || [auth.ctx.actorRole || "staff"],
      permissions: permCtx?.summary?.effectivePermissions || [],
      requestId: id,
      decision,
      notes,
      stepUpToken,
    });

    if (result.error) {
      return NextResponse.json(
        {
          error: result.error,
          ...(result.stepUpRequired
            ? {
                stepUpRequired: true,
                code: result.errorCode || "STEP_UP_REQUIRED",
                actionScope: result.actionScope,
              }
            : {}),
        },
        { status: result.statusCode || 400 }
      );
    }

    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    console.error("POST /api/approvals/[id]/decision error:", err);
    return NextResponse.json(
      { error: err?.message || "অনুমোদনের সিদ্ধান্ত প্রক্রিয়ায় ত্রুটি হয়েছে।" },
      { status: 500 }
    );
  }
}
