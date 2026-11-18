import { NextRequest, NextResponse } from "next/server";
import { authorizeApi } from "@/lib/api-auth";
import {
  listApprovalRequestsForMadrasa,
  listWorkflowsForMadrasa,
} from "@/lib/approval-workflow";
import { submitApprovalRequestForActor } from "@/app/actions/approvals";

export async function GET(req: NextRequest) {
  const auth = await authorizeApi("approvals");
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || undefined;
    const requestType =
      searchParams.get("requestType") || searchParams.get("type") || undefined;
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Number(limitParam) : undefined;

    const [requests, workflows] = await Promise.all([
      listApprovalRequestsForMadrasa(auth.ctx.madrasaId, {
        status,
        requestType,
        limit: limit && Number.isFinite(limit) ? limit : undefined,
      }),
      listWorkflowsForMadrasa(auth.ctx.madrasaId),
    ]);

    return NextResponse.json({
      success: true,
      requests,
      workflows,
      data: requests,
    });
  } catch (err: any) {
    console.error("GET /api/approvals error:", err);
    return NextResponse.json(
      { error: err?.message || "অনুমোদনের তালিকা লোড করতে সমস্যা হয়েছে।" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await authorizeApi("approvals");
  if (!auth.ok) return auth.response;

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, any>;
    const result = await submitApprovalRequestForActor(
      {
        userId: auth.ctx.userId,
        madrasaId: auth.ctx.madrasaId,
        actorName: auth.ctx.actorName || "ব্যবহারকারী",
        actorRole: auth.ctx.actorRole || "staff",
      },
      body as any
    );

    if (result.error || !result.request) {
      return NextResponse.json(
        { error: result.error || "অনুমোদনের আবেদন জমা দেওয়া যায়নি।" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        id: result.id,
        request: result.request,
        data: result.request,
        message: result.message,
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("POST /api/approvals error:", err);
    return NextResponse.json(
      { error: err?.message || "অনুমোদনের আবেদন দাখিলে ত্রুটি হয়েছে।" },
      { status: 500 }
    );
  }
}
