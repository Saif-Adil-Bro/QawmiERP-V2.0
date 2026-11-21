import { createAdminClient } from "./supabase/admin";
import { matchesVerifiedPayment, validateSSLCommerzTransaction } from "./payment-gateway-engine";
import { getMadrasaMetadata } from "./sessions";
import { verifySslFeeCallback } from "./fee-settlement";
import { paymentForm, paymentTenant } from "./payment-return";
import type { OnlineDonation } from "./fundraising-types";

type Outcome = {
  ok: boolean;
  httpStatus: number;
  path: "/portal/fees" | "/donate";
  params: Record<string, string>;
};
/** Both the browser return and IPN must verify the same tenant's pending transaction. */
export async function verifyPaymentCallback(req: Request): Promise<Outcome> {
  const { id, validationId: valId, path } = await paymentForm(req);
  const fail = (error: string, httpStatus = 400): Outcome => ({
    ok: false,
    httpStatus,
    path,
    params: { error },
  });
  const tenants = new URL(req.url).searchParams.getAll("tenant");
  const tenant = tenants.length === 1 && paymentTenant(tenants[0]);
  if (!tenant || !id || !valId) return fail("প্রতিষ্ঠান বা ট্রানজেকশন যাচাইয়ের তথ্য অসম্পূর্ণ।");
  if (path === "/portal/fees") {
    const result = await verifySslFeeCallback(tenant, id, valId);
    if (!result.success) return fail(result.error, result.httpStatus);
    return {
      ok: true,
      httpStatus: 200,
      path,
      params: {
        student_id: result.student_id,
        receipt: result.receipt_no,
        success: "true",
        txn: id,
      },
    };
  }
  const meta = await getMadrasaMetadata(tenant, true);
  const matches = (meta.online_donations || []).filter(
    (d: OnlineDonation) =>
      d.madrasa_id === tenant &&
      d.trx_id === id &&
      d.gateway_provider === "SSLCOMMERZ" &&
      ["PENDING", "VERIFIED"].includes(d.status),
  );
  if (matches.length !== 1) return fail("অনুদান পাওয়া যায়নি।");
  const d = matches[0],
    config = meta.payment_gateway_config;
  if (!config) return fail("গেটওয়ে কনফিগারেশন মেলেনি।", 409);
  const verified = await validateSSLCommerzTransaction(valId, config);
  if (verified.unavailable) return fail("গেটওয়ে যাচাই এখন করা যায়নি।", 503);
  if (!matchesVerifiedPayment(verified, id, d.amount, valId)) return fail("অনুদান যাচাই হয়নি।");
  const db = await createAdminClient();
  const { data: receipt, error } = await db.rpc("confirm_portal_donation_return", {
    p_tenant: tenant,
    p_expected: d,
    p_ref: valId,
  });
  if (error || !receipt) return fail("অনুদানের অবস্থা নিশ্চিত হয়নি।", error?.code === "P0001" ? 409 : 503);
  return { ok: true, httpStatus: 200, path, params: { receipt, success: "true", txn: id } };
}
