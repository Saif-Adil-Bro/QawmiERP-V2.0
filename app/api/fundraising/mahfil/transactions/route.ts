import { NextRequest, NextResponse } from "next/server";
import { saveMahfilTransaction, deleteMahfilTransaction } from "@/app/actions/fundraising";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { mahfilId, transaction } = body;
    if (!mahfilId || !transaction) {
      return NextResponse.json({ error: "মাহফিল আইডি এবং লেনদেনের তথ্য আবশ্যক" }, { status: 400 });
    }
    const result = await saveMahfilTransaction(mahfilId, transaction);
    if (result && "error" in result && result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    console.error("API error saving mahfil transaction:", err);
    return NextResponse.json({ error: err.message || "ভাউচার সংরক্ষণে সমস্যা হয়েছে" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mahfilId = searchParams.get("mahfilId");
    const txnId = searchParams.get("txnId");
    if (!mahfilId || !txnId) {
      return NextResponse.json({ error: "আইডি আবশ্যক" }, { status: 400 });
    }
    const result = await deleteMahfilTransaction(mahfilId, txnId);
    if (result && "error" in result && result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("API error deleting mahfil transaction:", err);
    return NextResponse.json({ error: err.message || "ভাউচার মুছতে সমস্যা হয়েছে" }, { status: 500 });
  }
}
