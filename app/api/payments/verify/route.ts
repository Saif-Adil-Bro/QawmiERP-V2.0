import { NextRequest, NextResponse } from "next/server";
import { verifyAndCompleteOnlinePayment } from "@/app/actions/payment-gateway";
import { createClient, getAuthUser } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const authUser = await getAuthUser(supabase);

    const body = await req.json();
    const { transaction_id, gateway_ref, bank_tran_id, payer_phone, is_simulated } = body;

    if (!transaction_id) {
      return NextResponse.json(
        { error: "ট্রানজেকশন আইডি প্রয়োজন।" },
        { status: 400 }
      );
    }

    // Block simulated payments if not authenticated
    if (is_simulated && !authUser) {
      return NextResponse.json(
        { error: "অননুমোদিত রিকোয়েস্ট: টেস্ট পেমেন্ট শুধুমাত্র লগইন করা অ্যাডমিনদের জন্য অনুমোদিত।" },
        { status: 401 }
      );
    }

    // If caller is unauthenticated, they MUST provide an external gateway validation token (val_id / gateway_ref)
    if (!authUser && !gateway_ref && !bank_tran_id) {
      return NextResponse.json(
        { error: "অবৈধ বা অনুপস্থিত গেটওয়ে ভেরিফিকেশন টোকেন।" },
        { status: 403 }
      );
    }

    const result = await verifyAndCompleteOnlinePayment({
      transaction_id,
      gateway_ref,
      bank_tran_id,
      payer_phone,
      is_simulated: Boolean(is_simulated),
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
