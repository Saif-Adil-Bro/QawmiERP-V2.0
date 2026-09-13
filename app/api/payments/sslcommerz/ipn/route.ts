import { NextRequest, NextResponse } from "next/server";
import {
  getPaymentGatewayConfig,
  verifyAndCompleteOnlinePayment,
  getSafeMadrasaId,
} from "@/app/actions/payment-gateway";
import { validateSSLCommerzTransaction } from "@/lib/payment-gateway-engine";
import { getMadrasaMetadata, saveMadrasaMetadata } from "@/lib/sessions";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData().catch(async () => {
      const text = await req.text();
      return new URLSearchParams(text);
    });

    const val_id = formData.get("val_id") as string;
    const tran_id = formData.get("tran_id") as string;
    const card_type = formData.get("card_type") as string;
    const bank_tran_id = formData.get("bank_tran_id") as string;

    if (!val_id || !tran_id) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    const config = await getPaymentGatewayConfig();
    const validation = await validateSSLCommerzTransaction(val_id, config);

    if (!validation.is_valid) {
      return NextResponse.json({ error: "Validation failed" }, { status: 400 });
    }

    if (tran_id.startsWith("DON-") || tran_id.startsWith("DONATION-")) {
      const madrasaId = await getSafeMadrasaId();
      if (madrasaId) {
        const meta = await getMadrasaMetadata(madrasaId);
        const donations = meta.online_donations || [];
        const dIdx = donations.findIndex((d: any) => d.trx_id === tran_id || d.id === tran_id);
        if (dIdx >= 0) {
          donations[dIdx].status = "VERIFIED";
          donations[dIdx].verified_at = new Date().toISOString();
          donations[dIdx].verified_by = `SSLCommerz IPN (${card_type || "Gateway"})`;
          meta.online_donations = donations;
          await saveMadrasaMetadata(madrasaId, meta);
        }
      }
      return NextResponse.json({ success: true, message: "Donation verified via IPN" });
    }

    const verifyRes = await verifyAndCompleteOnlinePayment({
      transaction_id: tran_id,
      gateway_ref: val_id,
      bank_tran_id: bank_tran_id || val_id,
      is_simulated: false,
    });

    return NextResponse.json({ success: true, verifyRes });
  } catch (err: any) {
    console.error("IPN Error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
