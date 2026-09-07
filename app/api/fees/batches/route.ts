import { NextResponse } from "next/server";
import { getGeneratedFeeBatches } from "@/app/actions/fee-management";

export async function GET() {
  try {
    const batches = await getGeneratedFeeBatches();
    return NextResponse.json(batches);
  } catch (error: any) {
    console.error("API /api/fees/batches error:", error);
    return NextResponse.json([], { status: 500 });
  }
}
