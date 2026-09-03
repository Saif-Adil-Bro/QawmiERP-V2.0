import { NextResponse } from "next/server";
import { getMadrasaInfo } from "@/lib/getMadrasaInfo";

export async function GET() {
  try {
    const info = await getMadrasaInfo();
    return NextResponse.json(info);
  } catch (err: any) {
    console.error("Error in /api/madrasa-info:", err);
    return NextResponse.json({ error: "Failed to fetch madrasa info" }, { status: 500 });
  }
}
