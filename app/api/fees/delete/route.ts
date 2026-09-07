import { NextRequest, NextResponse } from "next/server";
import { deleteStudentFee, deleteGeneratedFeeBatch } from "@/app/actions/fee-management";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (body.action === "DELETE_SINGLE" && body.feeId) {
      const result = await deleteStudentFee(body.feeId);
      return NextResponse.json(result);
    }

    if (body.action === "DELETE_BATCH" && body.billingPeriod) {
      const result = await deleteGeneratedFeeBatch({
        sessionId: body.sessionId,
        billingPeriod: body.billingPeriod,
        feeTypeId: body.feeTypeId,
        classId: body.classId,
      });
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { success: false, error: "ভুল অনুরোধ। প্রয়োজনীয় প্যারামিটার অনুপস্থিত।" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("API /api/fees/delete error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "সার্ভার এরর" },
      { status: 500 }
    );
  }
}
