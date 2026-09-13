import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData().catch(async () => {
      const text = await req.text();
      return new URLSearchParams(text);
    });

    const tran_id = (formData.get("tran_id") as string) || "";
    const baseUrl = req.nextUrl.origin;

    if (tran_id.startsWith("DON-") || tran_id.startsWith("DONATION-")) {
      return NextResponse.redirect(
        `${baseUrl}/portal/donate?error=${encodeURIComponent("পেমেন্ট বাতিল করা হয়েছে।")}&txn=${tran_id}`,
        303
      );
    }

    return NextResponse.redirect(
      `${baseUrl}/portal/fees?error=${encodeURIComponent("পেমেন্ট প্রক্রিয়া বাতিল করা হয়েছে।")}&txn=${tran_id}`,
      303
    );
  } catch {
    return NextResponse.redirect(`${req.nextUrl.origin}/portal/fees?error=payment_cancelled`, 303);
  }
}
