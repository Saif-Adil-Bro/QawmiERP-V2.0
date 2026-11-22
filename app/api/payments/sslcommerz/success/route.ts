import { verifyPaymentCallback } from "@/lib/payment-callback";
import { paymentReturn } from "@/lib/payment-return";
export async function POST(req: Request) {
  try {
    const { path, params } = await verifyPaymentCallback(req);
    return paymentReturn(path, params);
  } catch {
    return paymentReturn("/portal/fees", { error: "verification_failed" });
  }
}
