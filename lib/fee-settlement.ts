// Server-side fee posting. The public provider callback has its own entry point;
// a finance operator's browser cookie must never turn an IPN into manual approval.
import { revalidatePath } from "next/cache";
import { createAdminClient } from "./supabase/admin";
import { writeGuard } from "./action-authorization";
import { webIdentity, hasRole, linkedStudents } from "./portal/identity";
import { studentRoles, teacherRoles } from "./portal/rules";
import { getMadrasaMetadata } from "./sessions";
import { paymentTenant } from "./payment-return";
import type { OnlinePaymentTransaction, PaymentGatewayConfig } from "./payment-gateway";
import {
  bdtPoisha,
  matchesVerifiedPayment,
  sslCommerzAccount,
  validateSSLCommerzTransaction,
} from "./payment-gateway-engine";
import { toDhakaDateStringFrom } from "./date-utils";

export interface FeeVerificationInput {
  transaction_id: string;
  madrasa_id?: string;
  gateway_ref?: string;
  bank_tran_id?: string;
  payer_phone?: string;
  is_simulated?: boolean;
}
const refuse = (httpStatus: number, error: string) => ({ success: false as const, httpStatus, error });

export function verifySslFeeCallback(tenant: string, transactionId: string, validationId: string) {
  return complete(
    { madrasa_id: tenant, transaction_id: transactionId, gateway_ref: validationId },
    "ssl-callback",
  );
}
export function verifyInteractiveFee(input: FeeVerificationInput) {
  return complete(input, "interactive");
}
async function complete(input: FeeVerificationInput, source: "ssl-callback" | "interactive") {
  try {
    const identity = source === "interactive" ? await webIdentity() : null;
    if (
      source === "interactive" &&
      (!identity ||
        hasRole(identity, teacherRoles) ||
        (input.madrasa_id !== undefined && paymentTenant(input.madrasa_id) !== identity.tenant))
    ) {
      return refuse(403, "যাচাইয়ের অনুমতি নেই।");
    }
    const tenant = identity?.tenant ?? paymentTenant(input.madrasa_id);
    if (
      !tenant ||
      typeof input.transaction_id !== "string" ||
      !input.transaction_id ||
      input.transaction_id.length > 255
    )
      return refuse(400, "ট্রানজেকশনের প্রতিষ্ঠান বা রেফারেন্স নেই।");
    const family = identity && hasRole(identity, studentRoles);
    if (identity && !family) {
      const guard = await writeGuard("finance");
      if (!guard.allowed || guard.madrasaId !== tenant) return refuse(403, "যাচাইয়ের অনুমতি নেই।");
    }
    const meta = await getMadrasaMetadata(tenant, true);
    const matches: OnlinePaymentTransaction[] = (meta.online_transactions ?? []).filter(
      (t: OnlinePaymentTransaction) => t.transaction_id === input.transaction_id && t.madrasa_id === tenant,
    );
    if (matches.length !== 1) return refuse(400, "ট্রানজেকশন পাওয়া যায়নি।");
    const txn = matches[0];
    const ssl = txn.provider === "SSLCOMMERZ";
    const simulated = source === "interactive" && input.is_simulated === true;
    if (
      family &&
      (!ssl || simulated || (await linkedStudents(identity, txn.student_id)).child?.id !== txn.student_id)
    ) {
      return refuse(403, "এই শিক্ষার্থীর পেমেন্ট যাচাইয়ের অনুমতি নেই।");
    }
    if (!["PENDING", "SUCCESS"].includes(txn.status)) return refuse(409, "ট্রানজেকশনের অবস্থা মিলিয়ে দেখুন।");
    if (source === "ssl-callback" && !ssl) return refuse(400, "এটি SSLCommerz ফি পেমেন্ট নয়।");
    const config: PaymentGatewayConfig | undefined = meta.payment_gateway_config;
    let reference: string, bankReference: string | null;
    if (ssl) {
      // Compare the effective stored config, not the UI defaults. Unbound historical
      // pending intents require reconciliation. Already-posted receipts may be ACKed
      // only with the same verified reference and a matching completed SQL receipt.
      const account = sslCommerzAccount(config);
      if (simulated) return refuse(403, "গেটওয়েতে খোলা চেকআউটে সিমুলেশন দিয়ে ফি জমা হয় না।");
      const historicalReceipt = txn.status === "SUCCESS" && !txn.sslcommerz_scope;
      if (!account || (!historicalReceipt && txn.sslcommerz_scope !== account.scope)) {
        return refuse(409, "চেকআউটের মার্চেন্ট ও মোড যাচাই হয়নি। গেটওয়ে স্টেটমেন্ট মিলিয়ে দেখুন।");
      }
      const principal = bdtPoisha(txn.amount),
        fee = bdtPoisha(txn.convenience_fee ?? 0);
      if (
        principal === null ||
        principal <= 0 ||
        fee === null ||
        bdtPoisha(txn.total_payable) !== principal + fee
      ) {
        return refuse(409, "ফি ও গেটওয়ে চার্জের হিসাব মেলেনি।");
      }
      if (
        !config ||
        typeof input.gateway_ref !== "string" ||
        !input.gateway_ref ||
        input.gateway_ref.length > 255
      )
        return refuse(400, "গেটওয়ে ভ্যালিডেশন আইডি নেই।");
      const proof = await validateSSLCommerzTransaction(input.gateway_ref, config);
      if (proof.unavailable) return refuse(503, "গেটওয়ে যাচাই এখন করা যায়নি। নতুন পেমেন্ট করবেন না।");
      if (!matchesVerifiedPayment(proof, txn.transaction_id, txn.total_payable, input.gateway_ref)) {
        return refuse(400, "গেটওয়ে যাচাই, রেফারেন্স, মুদ্রা বা অঙ্ক মেলেনি।");
      }
      reference = proof.val_id!;
      bankReference = proof.bank_tran_id ?? null; // never bank_tran_id from the browser/notification
    } else {
      if (!identity || family) return refuse(403, "যাচাইয়ের অনুমতি নেই।");
      if (simulated && (config?.environment !== "SANDBOX" || config.sandbox_test_mode !== true))
        return refuse(403, "টেস্ট পেমেন্ট অনুমোদিত নয়।");
      reference = simulated ? `SIMULATED:${txn.transaction_id}` : input.gateway_ref || txn.transaction_id;
      bankReference = simulated ? null : input.bank_tran_id || null;
    }
    const db = await createAdminClient();
    const { data, error } = await db.rpc("settle_portal_fee_intent", {
      p_tenant: tenant,
      p_expected: txn,
      p_ref: reference,
      p_bank: bankReference,
    });
    if (error || !data?.receipt_no) {
      const conflict = ["P0001", "P0002", "P0003", "23505", "23503"].includes(error?.code ?? "");
      return refuse(
        conflict ? 409 : 503,
        "রসিদ নিশ্চিত হয়নি। আবার টাকা না দিয়ে বকেয়া ও গেটওয়ে স্টেটমেন্ট মিলিয়ে দেখুন।",
      );
    }
    const receipt: string = data.receipt_no;
    const confirmed = {
      success: true as const,
      receipt_no: receipt,
      transaction_id: txn.transaction_id,
      student_id: txn.student_id,
    };
    if (data.already_paid) return { ...confirmed, already_paid: true };
    const paymentDate = toDhakaDateStringFrom(new Date().toISOString());
    // Ancillary delivery cannot turn a committed receipt into a payment failure.
    try {
      for (const path of [
        "/dashboard/accounting",
        "/dashboard/accounting/fees",
        "/dashboard/accounting/payments",
        "/dashboard/accounting/due",
        "/portal/fees",
      ])
        revalidatePath(path);
    } catch {
      console.warn("Fee receipt committed; page revalidation unavailable.");
    }
    try {
      const { dispatchWebhookEvent } = await import("./webhooks/dispatcher");
      await dispatchWebhookEvent(tenant, "payment.confirmed", {
        receipt_no: receipt,
        transaction_id: txn.transaction_id,
        student_id: txn.student_id,
        student_name: txn.student_name,
        amount: txn.amount,
        payment_channel: txn.payment_channel,
        payment_date: paymentDate,
        status: "COMPLETED",
      });
    } catch {
      console.warn("Fee receipt committed; webhook dispatch unavailable.");
    }
    return {
      ...confirmed,
      amount: txn.amount,
      student_name: txn.student_name,
      payment_channel: txn.payment_channel,
      payment_date: paymentDate,
      message: "ফি পেমেন্টের রসিদ নিশ্চিত হয়েছে।",
    };
  } catch {
    return refuse(503, "ফি যাচাই সম্পন্ন হয়নি। নতুন পেমেন্ট না করে স্টেটমেন্ট মিলিয়ে দেখুন।");
  }
}
