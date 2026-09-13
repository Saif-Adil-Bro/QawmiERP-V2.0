import { NextRequest, NextResponse } from "next/server";
import {
  getPaymentGatewayConfig,
  verifyAndCompleteOnlinePayment,
  getSafeMadrasaId,
} from "@/app/actions/payment-gateway";
import { validateSSLCommerzTransaction } from "@/lib/payment-gateway-engine";
import { getMadrasaMetadata, saveMadrasaMetadata } from "@/lib/sessions";
import { createAdminClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData().catch(async () => {
      const text = await req.text();
      return new URLSearchParams(text);
    });

    const val_id = formData.get("val_id") as string;
    const tran_id = formData.get("tran_id") as string;
    const amount = formData.get("amount") as string;
    const card_type = formData.get("card_type") as string;
    const bank_tran_id = formData.get("bank_tran_id") as string;
    const status = formData.get("status") as string;

    const baseUrl = req.nextUrl.origin;

    if (!val_id || !tran_id) {
      return NextResponse.redirect(`${baseUrl}/portal/fees?error=missing_transaction_parameters`, 303);
    }

    const config = await getPaymentGatewayConfig();

    // 1. Validate transaction directly with SSLCommerz Server
    const validation = await validateSSLCommerzTransaction(val_id, config);

    if (!validation.is_valid) {
      return NextResponse.redirect(
        `${baseUrl}/portal/fees?error=${encodeURIComponent(validation.error_message || "পেমেন্ট ভ্যালিডেশন ব্যর্থ হয়েছে।")}`,
        303
      );
    }

    // 2. Check if this is a donation or a student fee payment
    if (tran_id.startsWith("DON-") || tran_id.startsWith("DONATION-")) {
      // It's a donation
      const madrasaId = await getSafeMadrasaId();
      if (madrasaId) {
        const meta = await getMadrasaMetadata(madrasaId);
        const donations = meta.online_donations || [];
        const dIdx = donations.findIndex((d: any) => d.trx_id === tran_id || d.id === tran_id);
        if (dIdx >= 0) {
          donations[dIdx].status = "VERIFIED";
          donations[dIdx].verified_at = new Date().toISOString();
          donations[dIdx].verified_by = `SSLCommerz (${card_type || "Gateway"})`;
          meta.online_donations = donations;
          await saveMadrasaMetadata(madrasaId, meta);
          return NextResponse.redirect(
            `${baseUrl}/portal/donate?receipt=${donations[dIdx].receipt_no}&success=true`,
            303
          );
        }
      }
      return NextResponse.redirect(`${baseUrl}/portal/donate?success=true`, 303);
    }

    // Otherwise, it's a student fee payment
    const verifyRes = await verifyAndCompleteOnlinePayment({
      transaction_id: tran_id,
      gateway_ref: val_id,
      bank_tran_id: bank_tran_id || val_id,
      is_simulated: false,
    });

    if (verifyRes.error) {
      return NextResponse.redirect(
        `${baseUrl}/portal/fees?error=${encodeURIComponent(verifyRes.error)}`,
        303
      );
    }

    return NextResponse.redirect(
      `${baseUrl}/portal/fees?receipt=${verifyRes.receipt_no}&success=true&txn=${tran_id}`,
      303
    );
  } catch (err: any) {
    console.error("SSLCommerz Success Callback Error:", err);
    return NextResponse.redirect(
      `${req.nextUrl.origin}/portal/fees?error=${encodeURIComponent(err.message || "পেমেন্ট প্রসেসিং এরর")}`,
      303
    );
  }
}
