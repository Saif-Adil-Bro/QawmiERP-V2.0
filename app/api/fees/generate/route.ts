import { NextRequest, NextResponse } from "next/server";
import { generateMonthlyFees } from "@/app/actions/fee-management";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await generateMonthlyFees(body);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("API /api/fees/generate error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
