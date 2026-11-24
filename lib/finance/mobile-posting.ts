import { postExpenseForActor } from "./expense";
import { bdtPoisha } from "@/lib/payment-gateway-engine";
import { nextVoucherNumber } from "./voucher-numbers";
import { toDhakaDateString } from "@/lib/date-utils";
import { changeVoucherStatus } from "./voucher-status";
import { getMadrasaMetadata } from "@/lib/sessions";
import {
  mobileSuccess,
  mobileError,
  type MobileWriteCheck,
} from "@/lib/mobile-api";
import { postingFund, type FundUse } from "./funds";

export function validateMobilePosting(use: FundUse): MobileWriteCheck {
  return async ({ db, tenant, actor, id, payload, operation }) => {
    try {
      if (operation === "delete" && id) {
        const done = await changeVoucherStatus(
          tenant,
          actor,
          use === "bazar" ? `bazar_${id}` : id,
          use === "deposit",
          String(payload.reason || ""),
          true,
        );
        return done
          ? mobileSuccess(
              { id, status: "VOID", deleted: false },
              "Posting voided",
            )
          : mobileError("Posting not found", 404, "NOT_FOUND");
      }
      if ('operator_id' in payload || 'head_name' in payload) throw Error('Operator and head label are server assigned');
      if(!id && use!=='expense') {payload.operator_id=actor;payload.payment_method=payload.payment_method||'Unknown';}
      if (payload.amount != null && !bdtPoisha(payload.amount))
        throw Error("Invalid posting amount");
      if (!id && use === "expense") {
        if ("status" in payload || "payroll_record_id" in payload)
          throw Error("Use the source voucher workflow");
        if (!payload.amount || !payload.category || !payload.fund_id)
          throw Error("Amount, category and fund are required");
        const form = new FormData();
        for (const k of [
          "fund_id",
          "fund_name",
          "restricted_beneficiary",
          "category",
          "amount",
          "description", "head_id", "student_id", "staff_id", "payment_method",
          "voucher_no",
        ])
          if (payload[k] != null) form.set(k, String(payload[k]));
        if(payload.line_items!=null) form.set("line_items",JSON.stringify(payload.line_items));
        form.set(
          "expense_date",
          String(payload.expense_date || toDhakaDateString()),
        );
        const r = await postExpenseForActor(tenant, actor, form);
        return r.error
          ? mobileError(r.error, 400, "EXPENSE_NOT_POSTED")
          : mobileSuccess(
              r.pendingApproval
                ? {
                    pendingApproval: true,
                    approvalRequestId: r.approvalRequestId,
                  }
                : r.expense,
              r.message || "Posted",
              undefined,
              r.pendingApproval ? 202 : 201,
            );
      }
      if (!id && use === "bazar" && !payload.voucher_no)
        payload.voucher_no = await nextVoucherNumber(
          tenant,
          String(payload.expense_date || toDhakaDateString()),
          "bazar",
        );
      let current: any;
      if (id) {
        const table =
          use === "expense"
            ? "expenses"
            : use === "bazar"
              ? "bazar_expenses"
              : "donations";
        const { data, error } = await db
          .from(table)
          .select("*")
          .eq("madrasa_id", tenant)
          .eq("id", id)
          .single();
        if (error || !data)
          return mobileError("Posting not found", 404, "NOT_FOUND");
        current = data;
        if (use === "deposit") {
          const meta = await getMadrasaMetadata(tenant, true);
          if (
            [
              "donor_subscription_payments",
              "donation_box_logs",
              "qurbani_leather_records",
              "leather_batches",
              "online_donations",
            ].some((k) =>
              (meta[k] || []).some(
                (r: any) =>
                  r.id === data.id ||
                  r.accounting_record_id === data.id ||
                  (data.receipt_no &&
                    [r.receipt_no, r.trx_id].includes(data.receipt_no)),
              ),
            )
          )
            return mobileError(
              "Change a linked posting in its source workflow",
              409,
              "SOURCE_VOUCHER",
            );
        }
      }
      if (
        "status" in payload ||
        "voided_at" in payload ||
        "void_reason" in payload
      )
        throw new Error("Use the voucher cancellation or restoration workflow");
      const fund = await postingFund(
        tenant,
        payload.fund_id ?? current?.fund_id,
        use,
        String(payload.category ?? current?.category ?? ""),
        String(
          payload.restricted_beneficiary ??
            current?.restricted_beneficiary ??
            "",
        ),
      );
      if (
        (payload.fund_name && payload.fund_name !== fund.name) ||
        (use === "deposit" &&
          payload.donation_type &&
          payload.donation_type !== fund.name &&
          payload.donation_type !== fund.code)
      )
        throw new Error("Fund label does not match the selected fund");
      payload.fund_name = fund.name;
      if (use === "deposit") payload.donation_type = fund.name;
      if ("payroll_record_id" in payload)
        throw new Error("Use the payroll payment action");
    } catch (e: any) {
      return mobileError(e.message, 400, "INVALID_FUND");
    }
  };
}
