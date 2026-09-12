import { NextRequest, NextResponse } from "next/server";
import { saveQurbaniLeatherRecord, deleteQurbaniLeatherRecord } from "@/app/actions/fundraising";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await saveQurbaniLeatherRecord(body);
    if (result && "error" in result && result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    console.error("API error saving leather collection:", err);
    return NextResponse.json({ error: err.message || "চামড়া চালান সংরক্ষণে সমস্যা হয়েছে" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "আইডি আবশ্যক" }, { status: 400 });
    }
    const result = await deleteQurbaniLeatherRecord(id);
    if (result && "error" in result && result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("API error deleting leather collection:", err);
    return NextResponse.json({ error: err.message || "মুছতে সমস্যা হয়েছে" }, { status: 500 });
  }
}
