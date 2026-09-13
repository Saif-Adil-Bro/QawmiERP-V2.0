import { NextRequest, NextResponse } from "next/server";
import { saveMahfilBulkReceiptBooks } from "@/app/actions/fundraising";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { mahfilId, ...params } = body;
    if (!mahfilId) {
      return NextResponse.json({ error: "মাহফিল আইডি আবশ্যক" }, { status: 400 });
    }
    const result = await saveMahfilBulkReceiptBooks(mahfilId, params);
    if (result && "error" in result && result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    console.error("API error saving bulk mahfil receipt books:", err);
    return NextResponse.json({ error: err.message || "বাল্ক রসিদ বই তৈরিতে সমস্যা হয়েছে" }, { status: 500 });
  }
}
