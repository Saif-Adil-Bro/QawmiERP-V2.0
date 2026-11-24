import {
  mobileError,
  mobileSuccess,
  type MobileWriteCheck,
} from "@/lib/mobile-api";
import { getFeeMetadata } from "@/lib/fee-store";
import { billingSession } from "./billing-session";
import { saveUnpaidBill, InvoiceConflict } from "./invoice";
import { collectSingleFee } from "./fee-api";

export const feeReceiptWrite: MobileWriteCheck = async ({
  db,
  tenant,
  actor,
  id,
  operation,
  payload,
}) => {
  try {
    if (!id)
      return mobileSuccess(
        await collectSingleFee(db, tenant, actor, payload),
        "Posted",
        undefined,
        201,
      );
    const status = operation === "delete" ? "VOID" : payload.status;
    if (
      !["VOID", "COMPLETED"].includes(String(status)) ||
      Object.keys(payload).some((k) => !["reason", "status"].includes(k)) ||
      typeof payload.reason !== "string" ||
      !payload.reason.trim()
    )
      return mobileError(
        "Only a reasoned void or restoration is allowed",
        400,
        "INVALID_VOUCHER_CHANGE",
      );
    const { error } = await db.rpc("finance_fee_status", {
      p_tenant: tenant,
      p_actor: actor,
      p_id: id,
      p_status: status,
      p_reason: payload.reason.trim(),
    });
    return error
      ? mobileError(error.message, 409, "FEE_STATUS_ERROR")
      : mobileSuccess({ id, status }, "Saved");
  } catch (e: any) {
    return mobileError(e.message, 400, "INVALID_FEE_RECEIPT");
  }
};
// A compatibility mirror is not a second payment API. A legacy-only receipt needs manual review.
export const legacyFeeWrite: MobileWriteCheck = async (ctx) =>
  ctx.id
    ? mobileError(
        "Use the identified fee payment; legacy mirrors are read only",
        409,
        "LEGACY_RECEIPT",
      )
    : feeReceiptWrite(ctx);

// The invoice API can generate/amend an unpaid charge, but cannot accept cash,
// grant waivers, reassign pupils, or remove a bill with any receipt history.
export const mobileInvoice: MobileWriteCheck = async ({
  db,
  tenant,
  id,
  payload,
  operation,
}) => {
  try {
    const prior = id
      ? (await getFeeMetadata(tenant)).student_fees?.find((b) => b.id === id)
      : null;
    if (id && !prior) return mobileError("Bill not found", 404, "NOT_FOUND");
    if (operation === "delete") {
      const { error } = await db.rpc("finance_edit_bills", {
        p_tenant: tenant,
        p_changes: [{ id, before: prior, after: null }],
        p_audit: null,
      });
      return error
        ? mobileError(error.message, 409, "BILL_CONFLICT")
        : mobileSuccess({ id, deleted: true }, "Saved");
    }
    const allowed = [
      "madrasa_id",
      "student_id",
      "fee_type_id",
      "session_id",
      "billing_period",
      "amount",
      "base_amount",
      "due_date",
      "fund_id",
      "fund_name",
    ];
    if (Object.keys(payload).some((k) => !allowed.includes(k)))
      throw Error(
        "Use the cashier or approval workflow to change paid amounts or discounts",
      );
    if (payload.session_id != null && typeof payload.session_id !== "string")
      throw Error("Invalid session");
    if (!prior)
      payload.session_id = await billingSession(
        db,
        tenant,
        payload.session_id as string | undefined,
        true,
      );
    const after = await saveUnpaidBill(db, tenant, payload, prior);
    return mobileSuccess(after, "Saved", undefined, id ? 200 : 201);
  } catch (e: any) {
    return e instanceof InvoiceConflict
      ? mobileError(e.message, 409, "BILL_CONFLICT")
      : mobileError(e.message, 400, "INVALID_BILL");
  }
};
