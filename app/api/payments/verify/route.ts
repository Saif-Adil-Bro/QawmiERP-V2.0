import { verifyInteractiveFee, verifySslFeeCallback } from "@/lib/fee-settlement";
import { privateResponseHeaders as headers } from "@/lib/private-response";
import { createClient, getAuthUser } from "@/lib/supabase/server";

const json = (data: unknown, status: number) => Response.json(data, { status, headers });

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body.transaction_id !== "string" || !body.transaction_id) {
      return json({ error: "ট্রানজেকশন আইডি প্রয়োজন।" }, 400);
    }
    const user = await getAuthUser(await createClient());
    if (!user && body.is_simulated) return json({ error: "টেস্ট পেমেন্ট অনুমোদিত নয়।" }, 401);
    if (!user && !body.gateway_ref) return json({ error: "গেটওয়ে ভ্যালিডেশন আইডি নেই।" }, 403);

    // Compatibility endpoint: an anonymous caller can present a real provider proof,
    // never a manual bank reference. Staff/families are scoped again by the action.
    const result = user
      ? await verifyInteractiveFee({
          transaction_id: body.transaction_id,
          madrasa_id: body.madrasa_id,
          gateway_ref: body.gateway_ref,
          bank_tran_id: body.bank_tran_id,
          is_simulated: body.is_simulated === true,
        })
      : await verifySslFeeCallback(body.madrasa_id, body.transaction_id, body.gateway_ref);
    if (!result.success) return json({ error: result.error }, result.httpStatus);
    return json(
      user ? result : { success: true, receipt_no: result.receipt_no, transaction_id: result.transaction_id },
      200,
    );
  } catch {
    return json({ error: "পেমেন্ট যাচাই করা যায়নি। নতুন পেমেন্ট না করে স্টেটমেন্ট মিলিয়ে দেখুন।" }, 503);
  }
}
