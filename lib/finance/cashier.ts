// Server-only implementation: only the approval executor can supply an approved tenant.
import { financeDeniedRoles } from "@/lib/finance/access";
import {
  createAdminClient,
  createClient,
  getAuthUser,
} from "@/lib/supabase/server";
import { getAuthMadrasaId } from "@/app/actions/students";
import { getFeeMetadata } from "@/lib/fee-store";
import { assertAccountingPeriodUnlocked } from "@/lib/lock-guards";
import { requirePermission } from "@/lib/permissions-server";
import { submitWorkflowHookApproval } from "@/lib/approval-workflow";
import { logAuditEvent } from "@/lib/audit-log";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { postingError } from "./funds";
import { planReceipt, type CashierInput } from "./fee-plan";
import { toDhakaDateString } from "@/lib/date-utils";
export async function cashierPayment(
  paymentData: CashierInput,
  approvedTenant?: string,
  approvedPlan?: ReturnType<typeof planReceipt>,
  approvedOperator?: string,
) {
  try {
    const supabase = await createClient();
    const adminClient = await createAdminClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অননুমোদিত অ্যাক্সেস। অনুগ্রহ করে লগইন করুন।" };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId || (approvedTenant && approvedTenant !== madrasaId))
      return { error: "মাদরাসা আইডি পাওয়া যায়নি।" };

    // CR-2 ফিক্স: ফি আদায়ের জন্য সার্ভার-সাইড অনুমতি যাচাই। আগে শুধু `if (!user)` ছিল,
    // ফলে অভিভাবক/শিক্ষার্থী পোর্টাল অ্যাকাউন্ট থেকেও সরাসরি action কল করে ফি আদায় ও
    // রসিদ তৈরি করা যেত।
    const collectGuard = await requirePermission({
      denyRoles: financeDeniedRoles,
      userId: user.id,
      madrasaId,
      permissions: ["fee.create", "finance.create"],
      roles: ["super_admin", "admin", "muhtamim", "accountant"],
      errorMessage: "ফি আদায় ও রসিদ তৈরির অনুমতি আপনার নেই।",
    });
    if (!collectGuard.allowed) {
      return { error: collectGuard.error || "ফি আদায়ের অনুমতি আপনার নেই।" };
    }

    // 1.3 Granular Accounting Period Lock Guard
    const targetPayDate = paymentData.payment_date || toDhakaDateString();
    const periodLock = await assertAccountingPeriodUnlocked(
      madrasaId,
      targetPayDate,
      "ফি আদায় ও রসিদ তৈরি",
    );
    if (periodLock.locked) {
      return { error: periodLock.error };
    }

    // Fetch Student Info
    let student: any = null;
    const { data: stdData, error: stdErr } = await supabase
      .from("students")
      .select(
        "id, first_name, last_name, roll_number, class_name, classes(id, name)",
      )
      .eq("madrasa_id", madrasaId)
      .eq("id", paymentData.student_id)
      .single();

    if (!stdErr && stdData) {
      student = stdData;
    } else {
      const { data: fallbackStd } = await supabase
        .from("students")
        .select("id, first_name, last_name, roll_number, class_name")
        .eq("madrasa_id", madrasaId)
        .eq("id", paymentData.student_id)
        .single();
      student = fallbackStd;
    }

    if (!student) {
      return { error: "শিক্ষার্থী পাওয়া যায়নি।" };
    }

    const clsObj: any = Array.isArray(student.classes)
      ? student.classes[0]
      : student.classes;
    const studentFullName =
      `${student.first_name || ""} ${student.last_name || ""}`.trim();
    const studentClass = student.class_name || clsObj?.name || "সাধারণ";
    const studentRoll = student.roll_number ? String(student.roll_number) : "";

    const meta = await getFeeMetadata(madrasaId);
    const plan = planReceipt(paymentData, meta.student_fees || []);
    if (approvedTenant) {
      // JSONB object key order is not stable: compare normalized line terms, not raw JSON strings.
      const terms = (p: typeof plan) =>
        p.allocations.map((a) => [
          a.student_fee_id,
          a.fee_type_id,
          a.billing_period,
          a.allocated_amount,
          a.discount_applied,
          a.fund_id,
          a.fund_name,
        ]);
      if (
        !approvedPlan ||
        JSON.stringify(terms(plan)) !== JSON.stringify(terms(approvedPlan))
      )
        return { error: "অনুমোদনের পর বিলের বণ্টন বদলেছে। নতুন আবেদন করুন।" };
    }
    if (!approvedTenant && plan.discount_total > 0) {
      const discountAmt = plan.discount_total;
      const primaryType =
        paymentData.total_amount === 0 ? "FEE_WAIVER" : "FEE_DISCOUNT";
      const hook = await submitWorkflowHookApproval({
        madrasaId,
        actorId: user.id,
        actorName: user.user_metadata?.full_name || user.email || "অফিসার",
        actorRole: user.user_metadata?.role || "staff",
        requestType: primaryType,
        amount: discountAmt,
        title: `ফি ছাড়/মওকুফ অনুমোদন (${discountAmt} টাকা)`,
        description:
          paymentData.discount_reason ||
          paymentData.notes ||
          "ফি আদায়ে ছাড়/মওকুফ",
        entityType: "fee_payment",
        targetId: paymentData.student_id,
        payload: {
          action: "collect_fee_payment",
          paymentData: {
            ...paymentData,
            payment_date: targetPayDate,
            discount_amount: plan.discount_total,
          },
          approvedPlan: plan,
        },
      });
      if (hook.matched) {
        return {
          success: true,
          pendingApproval: true,
          approvalRequestId: hook.approvalRequestId,
          message: "ফি ছাড়/মওকুফের জন্য অনুমোদনের আবেদন পাঠানো হয়েছে।",
        };
      }
      if (primaryType === "FEE_DISCOUNT") {
        const waiverHook = await submitWorkflowHookApproval({
          madrasaId,
          actorId: user.id,
          actorName: user.user_metadata?.full_name || user.email || "অফিসার",
          actorRole: user.user_metadata?.role || "staff",
          requestType: "FEE_WAIVER",
          amount: discountAmt,
          title: `ফি মওকুফ অনুমোদন (${discountAmt} টাকা)`,
          description:
            paymentData.discount_reason || paymentData.notes || "ফি মওকুফ",
          entityType: "fee_payment",
          targetId: paymentData.student_id,
          payload: {
            action: "collect_fee_payment",
            paymentData: {
              ...paymentData,
              payment_date: targetPayDate,
              discount_amount: plan.discount_total,
            },
            approvedPlan: plan,
          },
        });
        if (waiverHook.matched) {
          return {
            success: true,
            pendingApproval: true,
            approvalRequestId: waiverHook.approvalRequestId,
            message: "ফি মওকুফের জন্য অনুমোদনের আবেদন পাঠানো হয়েছে।",
          };
        }
      }
    }

    if (plan.discount_total > 0) {
      const discountGuard = await requirePermission({
        denyRoles: financeDeniedRoles,
        userId: user.id,
        madrasaId,
        permissions: ["fee.discount", "fee.waiver", "fee.approve"],
        roles: ["super_admin", "admin", "muhtamim", "accountant"],
        errorMessage: "ফি ছাড় (Discount) দেওয়ার অনুমতি আপনার নেই।",
      });
      if (!discountGuard.allowed) {
        return {
          error:
            (discountGuard.error || "ফি ছাড় দেওয়ার অনুমতি আপনার নেই।") +
            " অনুগ্রহ করে মুহতামিম/হিসাবরক্ষকের অনুমোদন নিন।",
        };
      }
    }

    const { expected, ...totals } = plan;
    const paymentDate = targetPayDate,
      first = plan.allocations[0];
    const candidate = {
      id: crypto.randomUUID(),
      madrasa_id: madrasaId,
      session_id: paymentData.session_id || "default",
      student_id: student.id,
      student_name: studentFullName,
      student_roll: studentRoll,
      class_name: studentClass,
      payment_date: paymentDate,
      payment_method: paymentData.payment_method,
      transaction_ref: paymentData.transaction_ref,
      notes: paymentData.notes,
      fee_type: paymentData.fee_type,
      discount_reason: paymentData.discount_reason,
      idempotency_key: paymentData.idempotency_key,
      fund_id: paymentData.fund_id || first.fund_id,
      fund_name: paymentData.fund_name || first.fund_name,
      ...totals,
    };
    const { data: newPayment, error } = await adminClient.rpc(
      "finance_collect_fee",
      {
        p_tenant: madrasaId,
        p_actor: user.id,
        p_operator: approvedTenant ? approvedOperator || user.id : user.id,
        p: candidate,
        p_expected: approvedTenant ? approvedPlan!.expected : expected,
      },
    );
    if (
      error ||
      !newPayment?.receipt_no ||
      (newPayment.id !== candidate.id && !newPayment.already_posted)
    )
      return {
        error: error
          ? postingError(error)
          : "মূল রসিদ নিশ্চিত হয়নি। তালিকা যাচাই করুন।",
      };
    const receiptNo = newPayment.receipt_no,
      legacyFeeId = newPayment.db_fee_id;
    if (newPayment.already_posted)
      return {
        success: true,
        payment: newPayment,
        newPaymentId: newPayment.id,
        fee_id: legacyFeeId || newPayment.id,
        receipt_no: receiptNo,
        receiptNo,
        message: "অনুরোধের রসিদ ইতিমধ্যে সংরক্ষিত আছে।",
      };
    await logAuditEvent({
      madrasaId,
      actorId: user.id,
      actorName:
        collectGuard.context?.profile?.fullName || user.email || "হিসাব বিভাগ",
      actorEmail: user.email || null,
      actorRole: collectGuard.context?.role || null,
      module: "fees",
      action: "FEE_PAYMENT_COLLECTED",
      entityType: "fee_payment",
      entityId: newPayment.id,
      entityLabel: `${receiptNo} · ${newPayment.student_name}`,
      summary: `রসিদ নং ${receiptNo} — ${newPayment.student_name}-এর নিকট থেকে ৳${Number(newPayment.total_amount_received || 0)} ফি আদায় করা হয়েছে (${paymentData.payment_method})।`,
      newValue: {
        receipt_no: receiptNo,
        student_id: paymentData.student_id,
        student_name: newPayment.student_name,
        total_amount_received: newPayment.total_amount_received,
        discount_total: newPayment.discount_total,
        fine_total: newPayment.fine_total,
        payment_date: paymentDate,
        payment_method: paymentData.payment_method,
      },
      severity: Number(newPayment.discount_total || 0) > 0 ? "WARNING" : "INFO",
    });

    revalidatePath("/dashboard/accounting");
    revalidatePath("/dashboard/accounting/fees");
    revalidatePath("/portal");
    revalidatePath("/dashboard/accounting/due");
    revalidatePath("/dashboard/accounting/receipts");
    revalidatePath("/dashboard/accounting/payments");
    revalidatePath(`/dashboard/students/${paymentData.student_id}`);
    revalidatePath("/portal/fees");

    // Non-blocking webhook event for payment confirmation (Feature 2.4)
    const sendWebhook = async () => {
      try {
        const { dispatchWebhookEvent } =
          await import("@/lib/webhooks/dispatcher");
        await dispatchWebhookEvent(madrasaId, "payment.confirmed", {
          payment_id: newPayment.id,
          receipt_no: receiptNo,
          student_id: paymentData.student_id,
          student_name: newPayment.student_name,
          class_name: newPayment.class_name,
          amount: newPayment.total_amount_received,
          payment_method: newPayment.payment_method,
          payment_date: paymentDate,
          status: newPayment.status,
        });
      } catch {
        // non-blocking webhook dispatch
      }
    };
    try {
      after(sendWebhook);
    } catch {
      void sendWebhook();
    }

    return {
      success: true,
      message: "ফি সফলভাবে আদায় করা হয়েছে এবং মানি রিসিট প্রস্তুত করা হয়েছে!",
      payment: newPayment,
      fee_id: legacyFeeId || newPayment.id,
      receipt_no: receiptNo,
    };
  } catch (err: any) {
    console.error("Error in collectFeePayment:", err);
    return { error: err.message || "ফি কালেকশন সম্পন্ন করতে সমস্যা হয়েছে।" };
  }
}
