import { financeDeniedRoles } from "@/lib/finance/access";
import {
  createClient,
  getAuthUser,
  createAdminClient,
} from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions-server";
import { getAuthMadrasaId } from "@/app/actions/students";
import type { ExpenseActionState } from "@/app/actions/accounting";
import { parseExpenseFund, type FundItem } from "@/lib/fund-utils";
import { assertAccountingPeriodUnlocked } from "@/lib/lock-guards";
import { submitWorkflowHookApproval } from "@/lib/approval-workflow";
import { logAuditEvent } from "@/lib/audit-log";
import { revalidatePath } from "next/cache";
import { bdtPoisha } from "@/lib/payment-gateway-engine";
import { nextVoucherNumber } from "./voucher-numbers";
import { postingFund } from "./funds";
export async function nextExpenseNumber(tenant: string, date: string) {
  return nextVoucherNumber(tenant, date, "expense");
}
export async function postExpense(
  formData: FormData,
  approved?: { tenant: string; requestId: string },
): Promise<ExpenseActionState> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return { error: "Unauthorized" };

  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId || (approved && approved.tenant !== finalMadrasaId))
    return { error: "Madrasa not found" };

  return postExpenseForActor(finalMadrasaId, user.id, formData, approved);
}
// Internal only: mobile/web/AI must resolve the actor from the current session.
export async function postExpenseForActor(
  finalMadrasaId: string,
  actor: string,
  formData: FormData,
  approved?: { tenant: string; requestId: string },
): Promise<ExpenseActionState> {
  if (approved && approved.tenant !== finalMadrasaId)
    return { error: "প্রতিষ্ঠান মেলেনি।" };
  const guard = await requirePermission({
    denyRoles: financeDeniedRoles,
    userId: actor,
    madrasaId: finalMadrasaId,
    permissions: ["finance.create", "fee.create"],
    roles: ["super_admin", "admin", "muhtamim", "accountant"],
  });
  if (!guard.allowed)
    return { error: guard.error || "খরচ এন্ট্রির অনুমতি আপনার নেই।" };

  const category = formData.get("category") as string;
  const amount = formData.get("amount") as string;
  const expenseDate = formData.get("expense_date") as string;
  const description = formData.get("description") as string;
  const beneficiary = String(
    formData.get("restricted_beneficiary") || "",
  ).trim();
  let fund: FundItem;
  try {
    fund = await postingFund(
      finalMadrasaId,
      formData.get("fund_id"),
      "expense",
      category,
      beneficiary,
      formData.get("fund_name"),
    );
  } catch (err: any) {
    return { error: err.message };
  }
  const fundId = fund.id,
    fundName = fund.name;

  if (!category || !amount || !expenseDate) {
    return { error: "ক্যাটাগরি, পরিমাণ এবং তারিখ আবশ্যক।" };
  }

  const parsedAmount = Number(amount);
  if (!bdtPoisha(amount)) {
    return { error: "খরচের পরিমাণ শূন্যের বেশি একটি সঠিক সংখ্যা হতে হবে।" };
  }

  // 1.3 Granular Accounting Period Lock Guard
  const periodLock = await assertAccountingPeriodUnlocked(
    finalMadrasaId,
    expenseDate,
    "নতুন খরচ এন্ট্রি",
  );
  if (periodLock.locked) return { error: periodLock.error };

  const cleanDesc = parseExpenseFund(description).cleanDesc;
  if (!approved) {
    const hook = await submitWorkflowHookApproval({
      madrasaId: finalMadrasaId,
      actorId: actor,
      actorName: guard.context?.profile?.fullName || "অফিসার",
      actorRole: guard.context?.role || "staff",
      requestType: "LARGE_EXPENSE",
      amount: parsedAmount,
      title: `বড় অঙ্কের খরচ অনুমোদন: ${category} (${parsedAmount} টাকা)`,
      description: cleanDesc || `${fundName} থেকে খরচ`,
      entityType: "expense",
      targetId: fundId,
      targetName: fundName,
      payload: {
        action: "create_expense",
        expenseData: {
          category,
          amount: parsedAmount,
          expense_date: expenseDate,
          description: cleanDesc,
          restricted_beneficiary: beneficiary,
          fund_id: fundId,
          fund_name: fundName,
          voucher_no: formData.get("voucher_no") || undefined,
        },
      },
    });
    if (hook.matched) {
      return {
        success: true,
        pendingApproval: true,
        approvalRequestId: hook.approvalRequestId,
        message: "বড় অঙ্কের খরচের জন্য অনুমোদনের আবেদন পাঠানো হয়েছে।",
      };
    }
  }

  // HI-3 ফিক্স: count()-এর বদলে আসল MAX(voucher_no)+1
  const voucherNo =
    String(formData.get("voucher_no") || "").trim() ||
    (await nextExpenseNumber(finalMadrasaId, expenseDate));
  // ফান্ড ও ভাউচার মেটাডেটা description-এ রাখা হয় (পুরোনো স্কিমার সাথে সামঞ্জস্যের জন্য)
  const wrappedDescription =
    `[FUND: ${fundId} | ${fundName}][VOUCHER: ${voucherNo}]\n${cleanDesc}`.trim();

  // ⛔ HI-4 ফিক্স: আগে "প্রথমে সব কলাম দিয়ে insert → ব্যর্থ হলে কলাম ছাড়া আবার insert"
  // প্যাটার্ন ছিল। স্কিমায় `fund_id`/`fund_name`/`voucher_no` কলাম না থাকায় **প্রতিবারই**
  // প্রথম insert ব্যর্থ হতো (২টি round-trip, প্রতি বার error), আর নেটওয়ার্ক টাইমআউটে প্রথমটি
  // সার্ভারে পৌঁছে গেলে দ্বিতীয়টি আবার insert করে **ডুপ্লিকেট খরচ** তৈরি করতে পারত।
  // এখন একবারই insert করা হয়; কলাম না থাকলে সেটি স্পষ্টভাবে জানানো হয়।
  const record: any = {
    ...(approved ? { id: approved.requestId } : {}),
    madrasa_id: finalMadrasaId,
    category: category,
    amount: parsedAmount,
    expense_date: expenseDate,
    description: wrappedDescription,
    restricted_beneficiary: beneficiary || null,
    fund_id: fundId,
    fund_name: fundName,
    voucher_no: voucherNo,
  };

  let createdId = "";
  const inserted = await (
    await createAdminClient()
  )
    .from("expenses")
    .insert(record)
    .select()
    .single();
  if (inserted.error) return { error: inserted.error.message };

  if (!inserted.data?.id)
    return { error: "মূল ভাউচার নিশ্চিত হয়নি। হিসাব যাচাই করুন।" };
  createdId = inserted.data.id;

  await logAuditEvent({
    madrasaId: finalMadrasaId,
    actorId: actor,
    actorName: guard.context?.profile?.fullName || "হিসাবরক্ষক",

    actorRole: guard.context?.role || null,
    module: "finance",
    action: "EXPENSE_CREATED",
    entityType: "expense",
    entityId: createdId,
    entityLabel: `${voucherNo} · ${category}`,
    summary: `নতুন খরচের ভাউচার (${voucherNo}) যুক্ত করা হয়েছে: ${category} — ৳${parsedAmount.toLocaleString("en-US")} (${fundName})।`,
    newValue: {
      id: createdId,
      voucher_no: voucherNo,
      category,
      amount: parsedAmount,
      expense_date: expenseDate,
      fund_name: fundName,
      description: cleanDesc,
    },
    severity: parsedAmount >= 50000 ? "WARNING" : "INFO",
  });

  revalidatePath("/dashboard/accounting/expenses");
  revalidatePath("/dashboard/accounting/reports");
  revalidatePath("/dashboard/accounting");

  return {
    success: true,
    expense: {
      id: createdId,
      category,
      amount: parsedAmount,
      expense_date: expenseDate,
      description: cleanDesc,
      restricted_beneficiary: beneficiary,
      fund_id: fundId,
      fund_name: fundName,
      voucher_no: voucherNo,
    },
  };
}
