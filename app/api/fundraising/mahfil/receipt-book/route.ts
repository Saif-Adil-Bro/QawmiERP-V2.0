import { NextRequest, NextResponse } from "next/server";
import { saveMahfilReceiptBook, deleteMahfilReceiptBook } from "@/app/actions/fundraising";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { mahfilId, book } = body;
    if (!mahfilId || !book) {
      return NextResponse.json({ error: "মাহফিল আইডি এবং রসিদ বইয়ের তথ্য আবশ্যক" }, { status: 400 });
    }
    const result = await saveMahfilReceiptBook(mahfilId, book);
    if (result && "error" in result && result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    console.error("API error saving mahfil receipt book:", err);
    return NextResponse.json({ error: err.message || "রসিদ বই সংরক্ষণে সমস্যা হয়েছে" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mahfilId = searchParams.get("mahfilId");
    const bookId = searchParams.get("bookId");
    if (!mahfilId || !bookId) {
      return NextResponse.json({ error: "আইডি আবশ্যক" }, { status: 400 });
    }
    const result = await deleteMahfilReceiptBook(mahfilId, bookId);
    if (result && "error" in result && result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("API error deleting mahfil receipt book:", err);
    return NextResponse.json({ error: err.message || "রসিদ বই মুছতে সমস্যা হয়েছে" }, { status: 500 });
  }
}
