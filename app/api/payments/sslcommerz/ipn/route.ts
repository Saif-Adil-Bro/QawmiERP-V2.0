import { verifyPaymentCallback } from "@/lib/payment-callback";
import { privateResponseHeaders as headers } from "@/lib/private-response";
export async function POST(req: Request) {
  try {
    const result = await verifyPaymentCallback(req);
    return Response.json({ success: result.ok }, { status: result.httpStatus, headers });
  } catch {
    return Response.json({ success: false }, { status: 503, headers });
  }
}
