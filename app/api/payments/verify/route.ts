import { NextRequest, NextResponse } from "next/server";
import { verifyAndCompleteOnlinePayment } from "@/app/actions/payment-gateway";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { transaction_id, gateway_ref, bank_tran_id, payer_phone, is_simulated } = body;

    if (!transaction_id) {
      return NextResponse.json(
        { error: "ট্রানজেকশন আইডি প্রয়োজন।" },
        { status: 400 }
      );
    }

    const result = await verifyAndCompleteOnlinePayment({
      transaction_id,
      gateway_ref,
      bank_tran_id,
      payer_phone,
      is_simulated,
    });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Payment verify API error:", error);
    return NextResponse.json(
      { error: error.message || "পেমেন্ট সম্পন্ন করতে সমস্যা হয়েছে।" },
      { status: 500 }
    );
  }
}
