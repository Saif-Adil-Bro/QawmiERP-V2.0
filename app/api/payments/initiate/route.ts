import { NextRequest, NextResponse } from "next/server";
import { initiateOnlinePayment } from "@/app/actions/payment-gateway";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      student_id,
      amount,
      payment_channel,
      payer_phone,
      notes,
      selected_fee_ids,
    } = body;

    if (!student_id || !amount || Number(amount) <= 0) {
      return NextResponse.json(
        { error: "বৈধ শিক্ষার্থী আইডি এবং টাকার পরিমাণ প্রয়োজন।" },
        { status: 400 }
      );
    }

    const result = await initiateOnlinePayment({
      student_id,
      amount: Number(amount),
      payment_channel: payment_channel || "bKash",
      payer_phone,
      notes,
      selected_fee_ids,
    });

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Payment initiate API error:", error);
    return NextResponse.json(
      { error: error.message || "পেমেন্ট শুরু করতে ব্যর্থ হয়েছে।" },
      { status: 500 }
    );
  }
}
