import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData().catch(async () => {
      const text = await req.text();
      return new URLSearchParams(text);
    });

    const tran_id = (formData.get("tran_id") as string) || "";
    const error_reason = (formData.get("error") as string) || "পেমেন্ট সম্পন্ন করা সম্ভব হয়নি। গেটওয়ে থেকে লেনদেনটি ব্যর্থ হয়েছে।";
    const baseUrl = req.nextUrl.origin;

    if (tran_id.startsWith("DON-") || tran_id.startsWith("DONATION-")) {
      return NextResponse.redirect(
        `${baseUrl}/portal/donate?error=${encodeURIComponent(error_reason)}&txn=${tran_id}`,
        303
      );
    }

    return NextResponse.redirect(
      `${baseUrl}/portal/fees?error=${encodeURIComponent(error_reason)}&txn=${tran_id}`,
      303
    );
  } catch {
    return NextResponse.redirect(`${req.nextUrl.origin}/portal/fees?error=payment_failed`, 303);
  }
}
