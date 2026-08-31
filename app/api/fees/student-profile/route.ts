import { NextRequest, NextResponse } from "next/server";
import { getStudentFeeProfile } from "@/app/actions/fee-management";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("studentId");
    const sessionId = searchParams.get("sessionId") || undefined;

    if (!studentId) {
      return NextResponse.json({ error: "studentId is required" }, { status: 400 });
    }

    const profile = await getStudentFeeProfile(studentId, sessionId);
    return NextResponse.json({ success: true, profile });
  } catch (error: any) {
    console.error("API /api/fees/student-profile error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
