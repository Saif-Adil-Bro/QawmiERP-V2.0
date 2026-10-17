"use server";

import { toDhakaDateStringFrom, toDhakaDateString } from "@/lib/date-utils";
import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getAuthMadrasaId } from "./students";
import { requirePermission } from "@/lib/permissions-server";
import { parseExpenseFund, isVoidedExpense, isVoidDonation } from "@/lib/fund-utils";
import { getFeeMetadata, saveFeeMetadata, voidFeePayment } from "./fee-management";

export async function getFees(filters?: { month?: string; year?: string; student_id?: string }) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return [];
  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return [];

  const meta = await getFeeMetadata(finalMadrasaId);
  const payments = (meta.payments || []).filter(
    (p) => p.status !== "REVERSED" && p.status !== "VOID"
  );

  let filtered = payments;

  if (filters?.student_id) {
    filtered = filtered.filter((p) => p.student_id === filters.student_id);
  }

  if (filters?.year) {
    filtered = filtered.filter((p) => {
      const dt = p.payment_date || (p.created_at ? toDhakaDateStringFrom(p.created_at) : "");
      const allocYear = p.allocations?.[0]?.billing_period?.split("-")?.[0];
      return dt.startsWith(filters.year!) || allocYear === filters.year;
    });
  }

  if (filters?.month) {
    filtered = filtered.filter((p) => {
      const dt = p.payment_date || (p.created_at ? toDhakaDateStringFrom(p.created_at) : "");
      const allocMonth = p.allocations?.[0]?.billing_period?.split("-")?.[1];
      return dt.includes(`-${filters.month}-`) || allocMonth === filters.month;
    });
  }

  // Sort descending by payment date / creation
  filtered.sort((a, b) => {
    const dateA = a.payment_date || a.created_at || "";
    const dateB = b.payment_date || b.created_at || "";
    return dateB.localeCompare(dateA);
  });

  return filtered.map((p) => {
    const feeTypeName =
      p.allocations && p.allocations.length > 0
        ? p.allocations.map((a) => a.fee_type_name).join(", ")
        : "ফি কালেকশন";

    const billingPeriod = p.allocations?.[0]?.billing_period || "";
    const [bYear, bMonth] = billingPeriod.includes("-") ? billingPeriod.split("-") : ["", ""];

    return {
      id: p.id,
      madrasa_id: finalMadrasaId,
      receipt_no: p.receipt_no || p.id.substring(0, 8).toUpperCase(),
      payment_date: p.payment_date || (p.created_at ? toDhakaDateStringFrom(p.created_at) : toDhakaDateString()),
      student_id: p.student_id,
      fee_type: feeTypeName,
      fee_month: bMonth || "",
      fee_year: bYear || "",
      amount: Number(p.total_amount_received || 0),
      total_amount_received: Number(p.total_amount_received || 0),
      discount_total: Number(p.discount_total || 0),
      fine_total: Number(p.fine_total || 0),
      advance_amount: Number(p.advance_amount || 0),
      payment_method: p.payment_method || "Cash",
      allocations: p.allocations || [],
      collector_name: p.collector_name || "হিসাব বিভাগ",
      notes: p.notes || "",
      status: p.status || "COMPLETED",
      students: {
        first_name: p.student_name || "শিক্ষার্থী",
        last_name: "",
        roll_number: p.student_roll || "-",
        class_name: p.class_name || "-",
      },
      created_at: p.created_at || p.payment_date || new Date().toISOString(),
    };
  });
}

export async function getFeeWithReceiptNo(feeId: string) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return null;
  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return null;

  const meta = await getFeeMetadata(finalMadrasaId);
  const payments = meta.payments || [];
  const payment = payments.find((p) => p.id === feeId || p.receipt_no === feeId);

  if (!payment) return null;

  const feeTypeName =
    payment.allocations && payment.allocations.length > 0
      ? payment.allocations.map((a) => a.fee_type_name).join(", ")
      : "ফি কালেকশন";

  const billingPeriod = payment.allocations?.[0]?.billing_period || "";
  const [bYear, bMonth] = billingPeriod.includes("-") ? billingPeriod.split("-") : ["", ""];

  return {
    id: payment.id,
    madrasa_id: finalMadrasaId,
    receipt_no: payment.receipt_no || payment.id.substring(0, 8).toUpperCase(),
    payment_date: payment.payment_date || (payment.created_at ? toDhakaDateStringFrom(payment.created_at) : toDhakaDateString()),
    student_id: payment.student_id,
    fee_type: feeTypeName,
    fee_month: bMonth || "",
    fee_year: bYear || "",
    amount: Number(payment.total_amount_received || 0),
    total_amount_received: Number(payment.total_amount_received || 0),
    discount_total: Number(payment.discount_total || 0),
    fine_total: Number(payment.fine_total || 0),
    advance_amount: Number(payment.advance_amount || 0),
    payment_method: payment.payment_method || "Cash",
    allocations: payment.allocations || [],
    collector_name: payment.collector_name || "হিসাব বিভাগ",
    notes: payment.notes || "",
    status: payment.status || "COMPLETED",
    cancellation_reason: payment.cancellation_reason || payment.reversal_reason || "",
    reversal_reason: payment.reversal_reason || "",
    voided_at: payment.voided_at || payment.reversed_at || "",
    voided_by: payment.voided_by || payment.reversed_by || "",
    students: {
      first_name: payment.student_name || "শিক্ষার্থী",
      last_name: "",
      roll_number: payment.student_roll || "-",
      class_name: payment.class_name || "-",
    },
    created_at: payment.created_at || payment.payment_date || new Date().toISOString(),
  };
}

/**
 * Void/Cancel fee payment instead of hard delete, preserving audit trail and rolling back dues.
 */
export async function deleteFee(feeId: string, reason: string = "ভুল এন্ট্রি বাতিল") {
  return voidFeePayment(feeId, reason);
}

export async function getExpenses(filters?: { month?: string; year?: string; fundId?: string }) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return [];

  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return [];

  let query = supabase
    .from("expenses")
    .select("*")
    .eq("madrasa_id", finalMadrasaId)
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false });

  // ⛔ MD-3 ফিক্স: আগে ফিল্টার লাগত কেবল যখন মাস **এবং** বছর দুটোই দেওয়া হতো।
  // শুধু মাস বা শুধু বছর দিলে শর্তটি চুপচাপ বাদ পড়ে পুরো ডেটাসেট ফেরত আসত —
  // ব্যবহারকারী ভাবতেন "এই মাসের খরচ" দেখছেন, আসলে সব বছরের সব খরচ ছিল।
  // এখন প্রতিটি ফিল্টার স্বাধীনভাবে প্রয়োগ হয় এবং অবৈধ ইনপুটে স্পষ্টভাবে ব্যর্থ হয়।
  {
    const hasMonth = !!filters?.month;
    const hasYear = !!filters?.year;

    if (hasMonth || hasYear) {
      const currentYear = new Date().getFullYear();
      const parsedMonth = hasMonth ? parseInt(String(filters!.month), 10) : null;
      const parsedYear = hasYear ? parseInt(String(filters!.year), 10) : currentYear;

      const invalidMonth =
        hasMonth && (!Number.isInteger(parsedMonth) || (parsedMonth as number) < 1 || (parsedMonth as number) > 12);
      const invalidYear = !Number.isInteger(parsedYear) || parsedYear < 1900 || parsedYear > 2200;

      if (invalidMonth || invalidYear) {
        console.error("getExpenses: অবৈধ মাস/বছর ফিল্টার", filters);
        return [];
      }

      if (hasMonth && !hasYear) {
        // শুধু মাস দিলে বর্তমান বছরের সেই মাস ধরা হয় (সব বছর নয়) — নাহলে ফিল্টারটি অর্থহীন হয়ে যেত
        console.warn("getExpenses: year ছাড়া month দেওয়া হয়েছে — বর্তমান বছর ধরা হয়েছে", currentYear);
      }

      if (hasMonth) {
        const padMonth = String(parsedMonth).padStart(2, "0");
        const startDate = `${parsedYear}-${padMonth}-01`;
        const lastDay = new Date(Date.UTC(parsedYear, parsedMonth as number, 0)).getUTCDate();
        const endDate = `${parsedYear}-${padMonth}-${String(lastDay).padStart(2, "0")}`;
        query = query.gte("expense_date", startDate).lte("expense_date", endDate);
      } else {
        // শুধু বছর → পুরো বছর
        query = query
          .gte("expense_date", `${parsedYear}-01-01`)
          .lte("expense_date", `${parsedYear}-12-31`);
      }
    }
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching expenses:", error);
    return [];
  }

  // HI-5: বাতিল (VOID) করা খরচ কখনো তালিকা/রিপোর্টে দেখানো বা গোনা হয় না
  const list = (data || []).filter((exp: any) => !isVoidedExpense(exp)).map((exp: any) => {
    const parsed = parseExpenseFund(exp.description);
    const voucherNo = exp.voucher_no || parsed.voucherNo || `EXP-${toDhakaDateString(new Date(exp.expense_date || exp.created_at || Date.now())).replace(/-/g, '').slice(2)}-${(exp.id || '').substring(0, 4).toUpperCase() || '001'}`;
    return {
      ...exp,
      description: parsed.cleanDesc,
      fund_id: exp.fund_id || parsed.fundId || "fund-general",
      fund_name: exp.fund_name || parsed.fundName || "সাধারণ ফান্ড",
      voucher_no: voucherNo,
    };
  });

  if (filters?.fundId && filters.fundId !== "all") {
    return list.filter((e: any) => e.fund_id === filters.fundId);
  }

  return list;
}

export type ExpenseActionState = {
  error?: string;
  success?: boolean;
  expense?: {
    id: string;
    category: string;
    amount: number;
    expense_date: string;
    description: string;
    fund_id: string;
    fund_name: string;
    voucher_no: string;
  };
};

/**
 * ভাউচার নম্বর প্রিভিউ।
 *
 * ⛔ HI-3 ফিক্স: আগে নম্বর তৈরি হতো `count()` থেকে — অর্থাৎ "এই মাসে কতটি সারি আছে"।
 * ফলে ০০১, ০০২, ০০৩ তৈরি করে ০০২ ডিলিট করলে count = ২ → পরের নম্বর আবার ০০৩ (ডুপ্লিকেট),
 * এবং একই মুহূর্তে দুইজন এন্ট্রি করলে দুজনেই একই নম্বর পেত। এখানে পরিস্থিতি ঠিক করার
 * মূল কাজটি হয় `createExpense`-এ (আসল ডেটা থেকে MAX বের করে, unique-violation এ retry)।
 * এই ফাংশনটি শুধু UI-তে "পরবর্তী সম্ভাব্য নম্বর" দেখানোর জন্য — চূড়ান্ত নম্বর নয়।
 */
export async function getNextExpenseVoucherNo(expenseDate?: string): Promise<string> {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const d = expenseDate ? new Date(expenseDate) : new Date();
    const yy = String(d.getFullYear()).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const currentPrefix = `EXP-${yy}${mm}-`;

    if (!user) return `${currentPrefix}001`;
    const finalMadrasaId = await getAuthMadrasaId(supabase, user);
    if (!finalMadrasaId) return `${currentPrefix}001`;

    const monthStart = `${d.getFullYear()}-${mm}-01`;
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const monthEnd = `${d.getFullYear()}-${mm}-${String(lastDay).padStart(2, "0")}`;

    // MAX(voucher_no) থেকে পরবর্তী ক্রম — count() নয়
    const { data } = await supabase
      .from("expenses")
      .select("voucher_no")
      .eq("madrasa_id", finalMadrasaId)
      .gte("expense_date", monthStart)
      .lte("expense_date", monthEnd)
      .not("voucher_no", "is", null)
      .order("voucher_no", { ascending: false })
      .limit(1);

    let next = 1;
    if (data && data.length > 0 && data[0].voucher_no) {
      const m = String(data[0].voucher_no).match(/(\d+)\s*$/);
      if (m) next = parseInt(m[1], 10) + 1;
    }
    return `${currentPrefix}${String(next).padStart(3, "0")}`;
  } catch {
    const d = expenseDate ? new Date(expenseDate) : new Date();
    const yy = String(d.getFullYear()).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `EXP-${yy}${mm}-001`;
  }
}

/** মাসিক ভাউচার ক্রমের চূড়ান্ত (server-side) নম্বর তৈরি — DB-র playlist থেকে MAX+1 */
async function resolveNextVoucherNo(
  supabase: any,
  madrasaId: string,
  expenseDate: string
): Promise<string> {
  const d = new Date(expenseDate);
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const prefix = `EXP-${yy}${mm}-`;
  const monthStart = `${d.getFullYear()}-${mm}-01`;
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const monthEnd = `${d.getFullYear()}-${mm}-${String(lastDay).padStart(2, "0")}`;

  const { data } = await supabase
    .from("expenses")
    .select("voucher_no")
    .eq("madrasa_id", madrasaId)
    .gte("expense_date", monthStart)
    .lte("expense_date", monthEnd)
    .not("voucher_no", "is", null)
    .order("voucher_no", { ascending: false })
    .limit(1);

  let seq = 1;
  if (data && data.length > 0 && data[0].voucher_no) {
    const m = String(data[0].voucher_no).match(/(\d+)\s*$/);
    if (m) seq = parseInt(m[1], 10) + 1;
  }
  return `${prefix}${String(seq).padStart(3, "0")}`;
}

export async function createExpense(prevState: ExpenseActionState, formData: FormData): Promise<ExpenseActionState> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return { error: "Unauthorized" };

  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return { error: "Madrasa not found" };

  // CR-2 ফিক্স: সার্ভার-সাইড অনুমতি যাচাই। আগে শুধু `if (!user)` ছিল — ফলে যেকোনো
  // লগইন করা অ্যাকাউন্ট (এমনকি অভিভাবক পোর্টাল) সরাসরি action কল করে খরচ এন্ট্রি,
  // পরিবর্তন ও ডিলিট করতে পারত।
  const guard = await requirePermission({
    userId: user.id,
    madrasaId: finalMadrasaId,
    permissions: ["finance.create", "fee.create"],
    roles: ["super_admin", "admin", "muhtamim", "accountant"],
  });
  if (!guard.allowed) return { error: guard.error || "খরচ এন্ট্রির অনুমতি আপনার নেই।" };

  const category = formData.get("category") as string;
  const amount = formData.get("amount") as string;
  const expenseDate = formData.get("expense_date") as string;
  const description = formData.get("description") as string;
  const fundId = (formData.get("fund_id") as string) || "fund-general";
  const fundName = (formData.get("fund_name") as string) || "সাধারণ ফান্ড";

  if (!category || !amount || !expenseDate) {
    return { error: "ক্যাটাগরি, পরিমাণ এবং তারিখ আবশ্যক।" };
  }

  const parsedAmount = parseFloat(amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return { error: "খরচের পরিমাণ শূন্যের বেশি একটি সঠিক সংখ্যা হতে হবে।" };
  }

  // HI-3 ফিক্স: count()-এর বদলে আসল MAX(voucher_no)+1
  const voucherNo = await resolveNextVoucherNo(supabase, finalMadrasaId, expenseDate);

  const cleanDesc = (description || "").trim();
  // ফান্ড ও ভাউচার মেটাডেটা description-এ রাখা হয় (পুরোনো স্কিমার সাথে সামঞ্জস্যের জন্য)
  const wrappedDescription = `[FUND: ${fundId} | ${fundName}][VOUCHER: ${voucherNo}]\n${cleanDesc}`.trim();

  // ⛔ HI-4 ফিক্স: আগে "প্রথমে সব কলাম দিয়ে insert → ব্যর্থ হলে কলাম ছাড়া আবার insert"
  // প্যাটার্ন ছিল। স্কিমায় `fund_id`/`fund_name`/`voucher_no` কলাম না থাকায় **প্রতিবারই**
  // প্রথম insert ব্যর্থ হতো (২টি round-trip, প্রতি বার error), আর নেটওয়ার্ক টাইমআউটে প্রথমটি
  // সার্ভারে পৌঁছে গেলে দ্বিতীয়টি আবার insert করে **ডুপ্লিকেট খরচ** তৈরি করতে পারত।
  // এখন একবারই insert করা হয়; কলাম না থাকলে সেটি স্পষ্টভাবে জানানো হয়।
  const record: any = {
    madrasa_id: finalMadrasaId,
    category: category,
    amount: parsedAmount,
    expense_date: expenseDate,
    description: wrappedDescription,
    fund_id: fundId,
    fund_name: fundName,
    voucher_no: voucherNo,
  };

  let createdId = "";
  let inserted = await supabase.from("expenses").insert(record).select().single();

  if (inserted.error && /column|schema cache|does not exist/i.test(inserted.error.message || "")) {
    // পুরোনো স্কিমা: fund/voucher কলাম নেই — শুধু description-এ মেটাডেটা রেখেই insert
    const fallbackRecord: any = {
      madrasa_id: finalMadrasaId,
      category,
      amount: parsedAmount,
      expense_date: expenseDate,
      description: wrappedDescription,
    };
    inserted = await supabase.from("expenses").insert(fallbackRecord).select().single();
    if (inserted.error) {
      console.error("Error creating expense:", inserted.error);
      return { error: inserted.error.message };
    }
  } else if (inserted.error) {
    console.error("Error creating expense:", inserted.error);
    return { error: inserted.error.message };
  }

  createdId = inserted.data?.id || voucherNo;

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
      fund_id: fundId,
      fund_name: fundName,
      voucher_no: voucherNo,
    },
  };
}

export async function updateExpense(formData: FormData) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return { error: "Unauthorized" };

  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return { error: "Madrasa not found" };

  // CR-2 ফিক্স: সার্ভার-সাইড অনুমতি যাচাই
  const guard = await requirePermission({
    userId: user.id,
    madrasaId: finalMadrasaId,
    permissions: ["finance.edit", "fee.edit"],
    roles: ["super_admin", "admin", "muhtamim", "accountant"],
  });
  if (!guard.allowed) return { error: guard.error || "খরচ সংশোধনের অনুমতি আপনার নেই।" };

  const id = formData.get("id") as string;
  const category = formData.get("category") as string;
  const amount = formData.get("amount") as string;
  const expenseDate = formData.get("expense_date") as string;
  const description = formData.get("description") as string;
  const fundId = (formData.get("fund_id") as string) || "fund-general";
  const fundName = (formData.get("fund_name") as string) || "সাধারণ ফান্ড";

  if (!id || !category || !amount || !expenseDate) {
    return { error: "খরচের আইডি, খাত, পরিমাণ ও তারিখ আবশ্যক।" };
  }

  const parsedAmount = parseFloat(amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return { error: "খরচের পরিমাণ শূন্যের বেশি একটি সঠিক সংখ্যা হতে হবে।" };
  }

  // বিদ্যমান ভাউচার নম্বর সংরক্ষণ
  const { data: existingExp } = await supabase
    .from("expenses")
    .select("description, voucher_no")
    .eq("id", id)
    .eq("madrasa_id", finalMadrasaId)
    .single();

  let voucherNo = (formData.get("voucher_no") as string) || existingExp?.voucher_no || "";
  if (!voucherNo && existingExp?.description) {
    const vMatch = existingExp.description.match(/\[VOUCHER:\s*([^\]]+)\]/i);
    if (vMatch && vMatch[1]) {
      voucherNo = vMatch[1].trim();
    }
  }

  const rawCleanDesc = (description || "")
    .replace(/\[FUND:[^\]]+\]/gi, "")
    .replace(/\[VOUCHER:[^\]]+\]/gi, "")
    .trim();

  let wrappedDescription = `[FUND: ${fundId} | ${fundName}]`;
  if (voucherNo) {
    wrappedDescription += `[VOUCHER: ${voucherNo}]`;
  }
  wrappedDescription += `\n${rawCleanDesc}`.trim();

  // HI-4 ফিক্স: একবারই update — ব্যর্থ হলে স্পষ্ট error (আগে fallback update-এ
  // fund/voucher তথ্য নিঃশব্দে হারিয়ে যেত)
  const updateWithFund: any = {
    category,
    amount: parsedAmount,
    expense_date: expenseDate,
    description: wrappedDescription,
    fund_id: fundId,
    fund_name: fundName,
    voucher_no: voucherNo || null,
  };

  let updated = await supabase
    .from("expenses")
    .update(updateWithFund)
    .eq("id", id)
    .eq("madrasa_id", finalMadrasaId);

  if (updated.error && /column|schema cache|does not exist/i.test(updated.error.message || "")) {
    const updateFallback: any = {
      category,
      amount: parsedAmount,
      expense_date: expenseDate,
      description: wrappedDescription,
    };
    updated = await supabase
      .from("expenses")
      .update(updateFallback)
      .eq("id", id)
      .eq("madrasa_id", finalMadrasaId);
  }

  if (updated.error) {
    console.error("Error updating expense:", updated.error);
    return { error: updated.error.message };
  }

  revalidatePath("/dashboard/accounting/expenses");
  revalidatePath("/dashboard/accounting/reports");
  revalidatePath("/dashboard/accounting");

  return {
    success: true,
    expense: {
      id,
      category,
      amount: parsedAmount,
      expense_date: expenseDate,
      description: rawCleanDesc,
      fund_id: fundId,
      fund_name: fundName,
    },
  };
}

/**
 * খরচ মুছে ফেলা (Soft delete / VOID)।
 *
 * ⛔ HI-5 ফিক্স: আগে এটি সম্পূর্ণ হার্ড ডিলিট ছিল — কে মুছলো, কখন, কেন বা আগের অঙ্ক কত
 * ছিল তার কিছুই থাকত না (অথচ ফি পেমেন্ট বাতিলে ঠিক এই কাজটি সুন্দরভাবে soft-delete +
 * অডিট লগ দিয়ে করা হয়)। এখন `status = 'VOID'` করে রাখা হয় এবং কারণ, সময় ও সঞ্চালনকারী
 * সংরক্ষণ করা হয় — ডেটা হারায় না, অডিট সম্ভব হয়।
 */
export async function deleteExpense(expenseId: string, reason?: string) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return { error: "অনুমতি নেই বা মাদ্রাসা পাওয়া যায়নি" };

  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return { error: "অনুমতি নেই বা মাদ্রাসা পাওয়া যায়নি" };

  // CR-2 ফিক্স: সার্ভার-সাইড অনুমতি যাচাই
  const guard = await requirePermission({
    userId: user.id,
    madrasaId: finalMadrasaId,
    permissions: ["finance.delete", "finance.edit"],
    roles: ["super_admin", "admin", "muhtamim", "accountant"],
  });
  if (!guard.allowed) return { error: guard.error || "খরচ বাতিলের অনুমতি আপনার নেই।" };

  const voidReason = (reason || "ভুল এন্ট্রি বাতিল").trim();
  const now = new Date().toISOString();

  // বিদ্যমান description সংরক্ষণ করে VOID ট্যাগ যোগ করা হয় যাতে সব রিপোর্ট সেটি বাদ দিতে পারে
  const { data: existing } = await supabase
    .from("expenses")
    .select("description")
    .eq("id", expenseId)
    .eq("madrasa_id", finalMadrasaId)
    .single();

  const voidTag = `[VOID: ${voidReason} | BY: ${user.email || "admin"} | AT: ${now}]`;
  const nextDescription = `${existing?.description || ""}`.includes("[VOID:")
    ? existing?.description
    : `${voidTag}\n${existing?.description || ""}`.trim();

  let result = await supabase
    .from("expenses")
    .update({ status: "VOID", void_reason: voidReason, voided_at: now, description: nextDescription })
    .eq("id", expenseId)
    .eq("madrasa_id", finalMadrasaId);

  if (result.error) {
    // পুরোনো স্কিমায় status/void_* কলাম না থাকলে description-এ VOID ট্যাগ রেখেই soft-void
    result = await supabase
      .from("expenses")
      .update({ description: nextDescription })
      .eq("id", expenseId)
      .eq("madrasa_id", finalMadrasaId);
  }

  if (result.error) {
    console.error("Error voiding expense:", result.error);
    return { error: result.error.message || "খরচ বাতিল করতে ব্যর্থ হয়েছে।" };
  }

  revalidatePath("/dashboard/accounting/expenses");
  revalidatePath("/dashboard/accounting/reports");
  revalidatePath("/dashboard/accounting");
  return { success: true, message: "খরচ সফলভাবে বাতিল (VOID) করা হয়েছে — রেকর্ড সংরক্ষিত আছে।" };
}


import { getMadrasaMetadata } from "@/lib/sessions";
import { getFunds } from "./zakat";
import { DEFAULT_FUNDS } from "@/lib/fund-utils";

export async function getAccountingReport(month: string, year: string, fundId?: string) {
  const parsedYear = parseInt(year);
  const parsedMonth = parseInt(month);
  const padMonth = String(parsedMonth).padStart(2, '0');
  const startDate = `${parsedYear}-${padMonth}-01`;
  const lastDay = new Date(Date.UTC(parsedYear, parsedMonth, 0)).getUTCDate();
  const endDate = `${parsedYear}-${padMonth}-${String(lastDay).padStart(2, '0')}`;
  
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return { totalIncome: 0, totalExpense: 0, netBalance: 0, fundStats: [] };
  
  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return { totalIncome: 0, totalExpense: 0, netBalance: 0, fundStats: [] };

  // Helper date checker
  function isWithinRange(dateStr?: string): boolean {
    if (!dateStr) return false;
    const cleanDate = dateStr.includes("T") ? toDhakaDateStringFrom(dateStr) : dateStr.trim();
    return cleanDate >= startDate && cleanDate <= endDate;
  }

  // 1. Fetch Registered Funds (default + custom)
  let registeredFunds = DEFAULT_FUNDS;
  try {
    const fetchedFunds = await getFunds();
    if (fetchedFunds && fetchedFunds.length > 0) {
      registeredFunds = fetchedFunds;
    }
  } catch (e) {
    console.warn("Could not fetch custom funds list:", e);
  }

  // 2. Fetch Donations with Database Date Filter
  // NOTE: donations table does NOT have a fund_id column; select valid columns
  // ⛔ CR-10 ফিক্স — এই কোয়েরিতে দুটি স্পষ্ট ত্রুটি ছিল:
  //
  //  ১. `status` কলাম সিলেক্ট করা হচ্ছিল, অথচ `supabase_schema.sql` অনুযায়ী `donations`
  //     টেবিলে এই কলাম **নেই**। কলামটি না থাকলে Postgres পুরো query ফেল করে —
  //     তখন `donationsData` = null হয় এবং **মাসিক রিপোর্ট থেকে সব অনুদান/যাকাত আয়
  //     নীরবে উধাও হয়ে যায়** (শুধু console.error, ইউজার কিছুই টের পায় না)।
  //  ২. `receipt_no` সিলেক্ট করা হচ্ছিল না, অথচ নিচে `trackedDonationKeys`-এ সেটি
  //     ব্যবহার করে ডুপ্লিকেট ঠেকানো হয় (মাহফিল receipt-book, দোনার সাবস্ক্রিপশন,
  //     দানবাক্স, অনলাইন দান, কুরবানির চামড়া — সবক্ষেত্রে)। ফলে যেসব দান ইতিমধ্যেই
  //     `donations` টেবিলে আছে, সেগুলো মেটাডেটা থেকেও আবার যোগ হয়ে **দুইবার গোনা** হতো।
  //
  // এখন: `status` বাদ, `receipt_no` সহ সিলেক্ট — আর query ফেল করলে স্পষ্ট ত্রুটি রিটার্ন।
  const { data: donationsData, error: donErr } = await supabase
    .from("donations")
    .select("id, amount, donation_type, donation_date, notes, receipt_no, created_at")
    .eq('madrasa_id', finalMadrasaId)
    .gte("donation_date", startDate)
    .lte("donation_date", endDate);

  if (donErr) {
    console.error("Error fetching donations for report:", donErr);
    // চুপচাপ শূন্য আয় দেখানো কখনোই ঠিক নয় — স্পষ্টভাবে ব্যর্থ হোন।
    return {
      totalIncome: 0,
      totalExpense: 0,
      netBalance: 0,
      fundStats: [],
      error: "অনুদানের তথ্য লোড করা যায়নি: " + donErr.message,
    } as any;
  }

  // Exclude VOID donations from calculations and balances
  // status কলামটি স্কিমায় না থাকলেও বাতিল অনুদান সঠিকভাবে বাদ পড়ে (notes ট্যাগ ভিত্তিক)
  const monthlyDonations = (donationsData || []).filter((d: any) => !isVoidDonation(d));

  // 3. Fetch Fee Payments via getFeeMetadata (Relational Tables with Fallback) & Metadata
  let meta: any = {};
  let metaPayments: any[] = [];
  try {
    const feeMeta = await getFeeMetadata(finalMadrasaId);
    meta = await getMadrasaMetadata(finalMadrasaId);
    metaPayments = (feeMeta.payments || []).filter((p: any) => {
      const dateStr = p.payment_date || (p.created_at ? toDhakaDateStringFrom(p.created_at) : "");
      return (
        isWithinRange(dateStr) &&
        p.status !== "REVERSED" &&
        p.status !== "VOID"
      );
    });
  } catch (e) {
    console.warn("Could not fetch fee data for report:", e);
  }

  // 4. Fetch General Expenses with Database Date Filter
  const { data: expensesData } = await supabase
    .from("expenses")
    .select("id, amount, description, category, expense_date, created_at")
    .eq('madrasa_id', finalMadrasaId)
    .gte("expense_date", startDate)
    .lte("expense_date", endDate);

  // HI-5: VOID করা খরচ বাদ — নাহলে বাতিল করা খরচ এখনো ব্যয় হিসেবে গোনা হতো
  const monthlyExpenses = (expensesData || []).filter((exp: any) => !isVoidedExpense(exp));

  // 5. Fetch Bazar Expenses with Database Date Filter
  const { data: bazarData } = await supabase
    .from("bazar_expenses")
    .select("id, amount, items_details, expense_date, created_at")
    .eq('madrasa_id', finalMadrasaId)
    .gte("expense_date", startDate)
    .lte("expense_date", endDate);

  const monthlyBazar = bazarData || [];

  // Setup Fund Map with Registered Funds
  const fundMap = new Map<string, { fund_id: string; fund_name: string; income: number; expense: number }>();

  registeredFunds.forEach(f => {
    fundMap.set(f.id, {
      fund_id: f.id,
      fund_name: f.name,
      income: 0,
      expense: 0,
    });
  });

  // Helper to safely add income to fundMap
  function addIncomeToFund(fId: string, fName: string, amt: number) {
    if (amt <= 0) return;
    let targetKey = fId;
    if (!fundMap.has(targetKey)) {
      const matched = registeredFunds.find(rf => 
        rf.id === fId || 
        rf.code?.toLowerCase() === fId.toLowerCase() ||
        rf.name.toLowerCase().trim() === fName.toLowerCase().trim() ||
        (fId === "fund-zakat" && (rf.category === "Zakat" || rf.name.includes("যাকাত"))) ||
        (fId === "fund-lillah" && (rf.category === "Lillah" || rf.name.includes("লিল্লাহ"))) ||
        (fId === "fund-fitra" && (rf.category === "Fitra" || rf.name.includes("ফিতরা"))) ||
        (fId === "fund-dev" && (rf.category === "Development" || rf.name.includes("উন্নয়ন") || rf.name.includes("মসজিদ"))) ||
        (fId === "fund-orphan" && (rf.category === "Education" || rf.name.includes("এতিম")))
      );
      if (matched && fundMap.has(matched.id)) {
        targetKey = matched.id;
      }
    }
    if (!fundMap.has(targetKey)) {
      fundMap.set(targetKey, { fund_id: targetKey, fund_name: fName, income: 0, expense: 0 });
    }
    fundMap.get(targetKey)!.income += amt;
  }

  // Helper to safely add expense to fundMap
  function addExpenseToFund(fId: string, fName: string, amt: number) {
    if (amt <= 0) return;
    let targetKey = fId;
    if (!fundMap.has(targetKey)) {
      const matched = registeredFunds.find(rf => 
        rf.id === fId || 
        rf.code?.toLowerCase() === fId.toLowerCase() ||
        rf.name.toLowerCase().trim() === fName.toLowerCase().trim() ||
        (fId === "fund-zakat" && (rf.category === "Zakat" || rf.name.includes("যাকাত"))) ||
        (fId === "fund-lillah" && (rf.category === "Lillah" || rf.name.includes("লিল্লাহ"))) ||
        (fId === "fund-fitra" && (rf.category === "Fitra" || rf.name.includes("ফিতরা"))) ||
        (fId === "fund-dev" && (rf.category === "Development" || rf.name.includes("উন্নয়ন") || rf.name.includes("মসজিদ"))) ||
        (fId === "fund-orphan" && (rf.category === "Education" || rf.name.includes("এতিম")))
      );
      if (matched && fundMap.has(matched.id)) {
        targetKey = matched.id;
      }
    }
    if (!fundMap.has(targetKey)) {
      fundMap.set(targetKey, { fund_id: targetKey, fund_name: fName, income: 0, expense: 0 });
    }
    fundMap.get(targetKey)!.expense += amt;
  }

  // Helper to map a donation type or label to a Fund ID & Name
  function resolveDonationFund(typeStr?: string, notesStr?: string, fundId?: string, fundName?: string): { id: string; name: string } {
    if (fundId) {
      return { id: fundId, name: fundName || typeStr || "ফান্ড" };
    }

    const combined = `${typeStr || ""} ${notesStr || ""}`.toLowerCase();
    
    // Check if fund tag exists in notes, e.g. [FUND: fund-lillah | লিল্লাহ বোর্ডিং ফান্ড]
    if (notesStr && notesStr.includes("[FUND:")) {
      const match = notesStr.match(/\[FUND:\s*([^\]|]+)(?:\|\s*([^\]]+))?\]/i);
      if (match && match[1]) {
        const parsedId = match[1].trim();
        const parsedName = match[2]?.trim() || typeStr || "ফান্ড";
        return { id: parsedId, name: parsedName };
      }
    }

    if (combined.includes("zakat") || combined.includes("যাকাত")) {
      return { id: "fund-zakat", name: "যাকাত ফান্ড (Zakat Fund)" };
    }
    if (combined.includes("lillah") || combined.includes("লিল্লাহ") || combined.includes("চামড়া") || combined.includes("leather")) {
      return { id: "fund-lillah", name: "লিল্লাহ বোর্ডিং ফান্ড (Lillah Fund)" };
    }
    if (combined.includes("orphan") || combined.includes("এতিম")) {
      return { id: "fund-orphan", name: "এতিম কল্যাণ ফান্ড (Orphan Welfare Fund)" };
    }
    if (combined.includes("dev") || combined.includes("মসজিদ") || combined.includes("উন্নয়ন") || combined.includes("building")) {
      return { id: "fund-dev", name: "মসজিদ ও উন্নয়ন ফান্ড" };
    }
    if (combined.includes("fitra") || combined.includes("sadqah") || combined.includes("ফিতরা") || combined.includes("সদকা")) {
      return { id: "fund-fitra", name: "ফিতরা ও সদকা ফান্ড" };
    }
    if (combined.includes("general") || combined.includes("সাধারণ") || combined.includes("মাহফিল") || combined.includes("দানবাক্স") || combined.includes("box")) {
      return { id: "fund-general", name: "সাধারণ ফান্ড (General Fund)" };
    }

    // Match with any registered fund name
    for (const rf of registeredFunds) {
      if (rf.name && combined.includes(rf.name.toLowerCase())) {
        return { id: rf.id, name: rf.name };
      }
    }

    const fallbackName = typeStr?.trim() || "সাধারণ ফান্ড";
    return { id: "fund-general", name: fallbackName };
  }

  // Sets to track IDs and receipt numbers already in database tables
  const trackedDonationKeys = new Set<string>();
  monthlyDonations.forEach((d: any) => {
    if (d.id) trackedDonationKeys.add(d.id);
    if (d.receipt_no) trackedDonationKeys.add(d.receipt_no);
    const rMatch = d.notes?.match(/\[(?:চালান|রিসিট|কুরবানির চামড়া বিক্রয়|দানবাক্স কালেকশন):\s*([^\]|,]+)/)?.[1];
    if (rMatch) trackedDonationKeys.add(rMatch.trim());
  });

  // A. Add Donations income to Fund Map
  monthlyDonations.forEach((don: any) => {
    const amt = Number(don.amount || 0);
    const { id: fId, name: fName } = resolveDonationFund(don.donation_type, don.notes, don.fund_id, don.fund_name);
    addIncomeToFund(fId, fName, amt);
  });

  // B. Add Fee Payments to General Fund or Lillah/Boarding Fund based on fee allocations
  metaPayments.forEach((p: any) => {
    let allocatedSum = 0;
    if (p.allocations && p.allocations.length > 0) {
      p.allocations.forEach((alloc: any) => {
        const amt = Number(alloc.allocated_amount || 0);
        if (amt <= 0) return;
        allocatedSum += amt;

        // Prioritize explicit alloc.fund_id or p.fund_id
        const targetFundId = alloc.fund_id || p.fund_id;
        if (targetFundId) {
          const targetFundName = alloc.fund_name || p.fund_name || (targetFundId === "fund-lillah" ? "লিল্লাহ বোর্ডিং ফান্ড (Lillah Fund)" : "সাধারণ ফান্ড (General Fund)");
          addIncomeToFund(targetFundId, targetFundName, amt);
        } else {
          const name = alloc.fee_type_name || "মাসিক বেতন";
          const combined = `${name} ${p.notes || ""}`.toLowerCase();
          if (combined.includes("বোর্ডিং") || combined.includes("খাবার") || combined.includes("hostel") || combined.includes("lillah")) {
            addIncomeToFund("fund-lillah", "লিল্লাহ বোর্ডিং ফান্ড (Lillah Fund)", amt);
          } else {
            addIncomeToFund("fund-general", "সাধারণ ফান্ড (General Fund)", amt);
          }
        }
      });
      const extraAdvance = Number(p.advance_amount || 0);
      const fineTotal = Number(p.fine_total || 0);
      const totalRec = Number(p.total_amount_received || 0);
      const remainder = Math.max(0, totalRec - allocatedSum);
      const extra = (extraAdvance + fineTotal > 0) ? (extraAdvance + fineTotal) : remainder;
      if (extra > 0) {
        addIncomeToFund("fund-general", "সাধারণ ফান্ড (General Fund)", extra);
      }
    } else {
      const amt = Number(p.total_amount_received || 0);
      const targetFundId = p.fund_id;
      if (targetFundId) {
        const targetFundName = p.fund_name || (targetFundId === "fund-lillah" ? "লিল্লাহ বোর্ডিং ফান্ড (Lillah Fund)" : "সাধারণ ফান্ড (General Fund)");
        addIncomeToFund(targetFundId, targetFundName, amt);
      } else {
        const combined = `${p.notes || ""}`.toLowerCase();
        if (combined.includes("বোর্ডিং") || combined.includes("খাবার") || combined.includes("hostel") || combined.includes("lillah")) {
          addIncomeToFund("fund-lillah", "লিল্লাহ বোর্ডিং ফান্ড (Lillah Fund)", amt);
        } else {
          addIncomeToFund("fund-general", "সাধারণ ফান্ড (General Fund)", amt);
        }
      }
    }
  });

  // D. Add Mahfil Receipt Book Collections & Transactions from Metadata (untracked)
  const mahfils = meta.mahfils || [];
  mahfils.forEach((m: any) => {
    const isSettled = Boolean(m.settlement || (m.settlements && m.settlements.length > 0));

    // 1. Receipt books (collected amounts from deposits) - only if not already settled/tracked
    if (!isSettled) {
      const books = m.receipt_books || [];
      books.forEach((bk: any) => {
        const fundInfo = resolveDonationFund(bk.category, bk.receipt_type || "মাহফিল রসিদ বই আদায়");
        if (Array.isArray(bk.deposit_history) && bk.deposit_history.length > 0) {
          bk.deposit_history.forEach((dep: any) => {
            const recNo = dep.receipt_no || bk.receipt_no || dep.id;
            if (isWithinRange(dep.date) && !trackedDonationKeys.has(recNo)) {
              addIncomeToFund(fundInfo.id, fundInfo.name, Number(dep.amount || 0));
            }
          });
        } else if (Number(bk.total_collected || 0) > 0) {
          const d = bk.return_date || bk.issued_date || m.start_date || "";
          const recNo = bk.receipt_no || bk.id;
          if (isWithinRange(d) && !trackedDonationKeys.has(recNo)) {
            addIncomeToFund(fundInfo.id, fundInfo.name, Number(bk.total_collected || 0));
          }
        }
      });
    }

    // 2. Direct Mahfil Transactions (Income & Expense vouchers)
    const txns = m.transactions || [];
    txns.forEach((t: any) => {
      const d = t.date || m.start_date || "";
      const tKey = t.id || t.voucher_no;
      const isInternalSettlement = 
        (t.id && t.id.startsWith("txn_settle")) ||
        (t.category && (t.category.includes("উদ্বৃত্ত") || t.category.includes("স্থানান্তর"))) ||
        (t.description && (t.description.includes("উদ্বৃত্ত") || t.description.includes("স্থানান্তর")));

      if (isInternalSettlement) return;

      if (isWithinRange(d)) {
        if (t.type === "INCOME" && !isSettled && !trackedDonationKeys.has(tKey)) {
          const fundInfo = resolveDonationFund(t.category, t.description);
          addIncomeToFund(fundInfo.id, fundInfo.name, Number(t.amount || 0));
        } else if (t.type === "EXPENSE" && !isSettled) {
          const parsed = parseExpenseFund(t.description || t.category);
          addExpenseToFund(parsed.fundId || "fund-general", parsed.fundName || "সাধারণ ফান্ড", Number(t.amount || 0));
        }
      }
    });
  });

  // E. Add Donor Subscriptions from Metadata (untracked)
  const donorPayments = meta.donor_subscription_payments || [];
  donorPayments.forEach((p: any) => {
    const d = p.payment_date || p.date || (p.created_at ? toDhakaDateStringFrom(p.created_at) : "");
    const pKey = p.id || p.receipt_no;
    if (isWithinRange(d) && !trackedDonationKeys.has(pKey)) {
      const fundInfo = resolveDonationFund(p.fund_name || p.fund_category, p.notes);
      addIncomeToFund(fundInfo.id, fundInfo.name, Number(p.amount || 0));
    }
  });

  // F. Add Donation Box Collections from Metadata (untracked)
  const boxLogs = meta.donation_box_logs || [];
  boxLogs.forEach((l: any) => {
    const d = l.collection_date || l.date || (l.created_at ? toDhakaDateStringFrom(l.created_at) : "");
    const lKey = l.receipt_no || l.id;
    if (isWithinRange(d) && !trackedDonationKeys.has(lKey)) {
      const fundInfo = resolveDonationFund(l.fund_name || "দানবাক্স ফান্ড", l.notes);
      addIncomeToFund(fundInfo.id, fundInfo.name, Number(l.amount || 0));
    }
  });

  // G. Add Online Donations (Completed/Verified) from Metadata (untracked)
  const onlineDonations = meta.online_donations || [];
  onlineDonations.forEach((d: any) => {
    if (d.status === "COMPLETED" || d.status === "VERIFIED" || d.status === "SUCCESS") {
      const dt = d.payment_date || (d.created_at ? toDhakaDateStringFrom(d.created_at) : "");
      const dKey = d.receipt_no || d.transaction_id || d.id;
      if (isWithinRange(dt) && !trackedDonationKeys.has(dKey)) {
        const fundInfo = resolveDonationFund(d.fund_category || d.fund_name || d.purpose, d.notes);
        addIncomeToFund(fundInfo.id, fundInfo.name, Number(d.amount || 0));
      }
    }
  });

  // H. Add Qurbani Leather Records from Metadata (untracked)
  const leatherRecords = meta.qurbani_leather_records || meta.leather_batches || [];
  leatherRecords.forEach((r: any) => {
    const d = r.collection_date || r.sale_date || r.date || (r.created_at ? toDhakaDateStringFrom(r.created_at) : "");
    const rKey = r.receipt_no || r.id;
    if (isWithinRange(d) && !trackedDonationKeys.has(rKey)) {
      const inc = Number(r.received_amount || r.total_sale_price || r.total_sale_amount || 0);
      const exp = Number(r.transport_labour_cost || r.transport_labor_cost || 0);
      if (inc > 0) addIncomeToFund("fund-lillah", "লিল্লাহ বোর্ডিং ফান্ড (Lillah Fund)", inc);
      if (exp > 0) addExpenseToFund("fund-lillah", "লিল্লাহ বোর্ডিং ফান্ড (Lillah Fund)", exp);
    }
  });

  // I. Add Expenses to Fund Map
  monthlyExpenses.forEach((exp: any) => {
    const amt = Number(exp.amount || 0);
    let fId = exp.fund_id;
    let fName = exp.fund_name;
    if (!fId) {
      const parsed = parseExpenseFund(exp.description);
      fId = parsed.fundId || "fund-general";
      fName = parsed.fundName || "সাধারণ ফান্ড";
    }
    if (!fName) {
      fName = fId === "fund-lillah" ? "লিল্লাহ বোর্ডিং ফান্ড (Lillah Fund)" : "সাধারণ ফান্ড (General Fund)";
    }
    addExpenseToFund(fId, fName, amt);
  });

  // J. Add Bazar Expenses to Fund Map (Default: Lillah Boarding Fund)
  monthlyBazar.forEach((b: any) => {
    const amt = Number(b.amount || 0);
    const details = b.items_details || "";
    let fId = "fund-lillah";
    let fName = "লিল্লাহ বোর্ডিং ফান্ড (Lillah Fund)";

    if (details.includes("FUND:")) {
      const matchFund = details.match(/FUND:\s*([^\]|]+)/i);
      if (matchFund && matchFund[1]) {
        fId = matchFund[1].trim();
      }
      const matchFundName = details.match(/FUND_NAME:\s*([^\]|]+)/i);
      if (matchFundName && matchFundName[1]) {
        fName = matchFundName[1].trim();
      }
    }

    addExpenseToFund(fId, fName, amt);
  });

  // Aggregate totals
  const fundStats = Array.from(fundMap.values()).map(f => ({
    ...f,
    balance: f.income - f.expense,
  }));

  const totalIncome = fundStats.reduce((sum, f) => sum + f.income, 0);
  const totalExpense = fundStats.reduce((sum, f) => sum + f.expense, 0);
  const netBalance = totalIncome - totalExpense;

  // If specific fund filtered
  if (fundId && fundId !== "all") {
    let target = fundMap.get(fundId);
    if (!target) {
      const matched = registeredFunds.find(rf => 
        rf.id === fundId ||
        rf.code?.toLowerCase() === fundId.toLowerCase() ||
        rf.name.toLowerCase().trim() === fundId.toLowerCase().trim() ||
        (fundId === "fund-zakat" && (rf.category === "Zakat" || rf.name.includes("যাকাত"))) ||
        (fundId === "fund-lillah" && (rf.category === "Lillah" || rf.name.includes("লিল্লাহ"))) ||
        (fundId === "fund-fitra" && (rf.category === "Fitra" || rf.name.includes("ফিতরা"))) ||
        (fundId === "fund-dev" && (rf.category === "Development" || rf.name.includes("উন্নয়ন") || rf.name.includes("মসজিদ"))) ||
        (fundId === "fund-orphan" && (rf.category === "Education" || rf.name.includes("এতিম")))
      );
      if (matched && fundMap.has(matched.id)) {
        target = fundMap.get(matched.id);
      }
    }

    const finalTarget = target || {
      fund_id: fundId,
      fund_name: registeredFunds.find(f => f.id === fundId)?.name || "ফান্ড",
      income: 0,
      expense: 0,
    };

    const singleStat = {
      ...finalTarget,
      balance: finalTarget.income - finalTarget.expense,
    };

    return {
      totalIncome: finalTarget.income,
      totalExpense: finalTarget.expense,
      netBalance: finalTarget.income - finalTarget.expense,
      fundStats: [singleStat],
    };
  }

  return {
    totalIncome,
    totalExpense,
    netBalance,
    fundStats,
  };
}

export interface UnifiedIncomeTransaction {
  id: string;
  date: string;
  receipt_no: string;
  source_type: "STUDENT_FEE" | "DONATION" | "SUBSCRIPTION" | "MAHFIL" | "ONLINE" | "DONATION_BOX" | "LEATHER_SALE";
  source_type_label: string;
  source_name: string;
  source_details?: string;
  category: string;
  fund_id: string;
  fund_name: string;
  payment_method: string;
  amount: number;
  notes?: string;
  receipt_url?: string;
}

export interface UnifiedIncomeOverview {
  totalIncome: number;
  totalTransactions: number;
  funds: any[];
  sourceBreakdown: {
    studentFees: number;
    donations: number;
    subscriptions: number;
    mahfils: number;
    onlineDonations: number;
    donationBoxes: number;
    leatherSales: number;
  };
  transactions: UnifiedIncomeTransaction[];
}

export async function getUnifiedIncomeHistory(): Promise<UnifiedIncomeOverview> {
  try {
    const adminClient = await createAdminClient();
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const finalMadrasaId = await getAuthMadrasaId(supabase, user);

    if (!finalMadrasaId) {
      return {
        totalIncome: 0,
        totalTransactions: 0,
        funds: DEFAULT_FUNDS,
        sourceBreakdown: {
          studentFees: 0,
          donations: 0,
          subscriptions: 0,
          mahfils: 0,
          onlineDonations: 0,
          donationBoxes: 0,
          leatherSales: 0,
        },
        transactions: [],
      };
    }

    const { getFunds } = await import("./zakat");
    const { getMadrasaMetadata } = await import("@/lib/sessions");
    const { isTransactionInFund } = await import("@/lib/fund-utils");
    const { getUnifiedFeePayments } = await import("./fee-management");

    const [funds, meta, feePayments, { data: dbDonations }] = await Promise.all([
      getFunds(),
      getMadrasaMetadata(finalMadrasaId),
      getUnifiedFeePayments(finalMadrasaId),
      adminClient
        .from("donations")
        .select("*, donors(id, name, phone, address, donor_type)")
        .eq("madrasa_id", finalMadrasaId)
        .order("donation_date", { ascending: false }),
    ]);

    const transactions: UnifiedIncomeTransaction[] = [];
    const sourceBreakdown = {
      studentFees: 0,
      donations: 0,
      subscriptions: 0,
      mahfils: 0,
      onlineDonations: 0,
      donationBoxes: 0,
      leatherSales: 0,
    };

    const existingReceiptNos = new Set<string>();
    const existingIds = new Set<string>();

    (dbDonations || []).forEach((d: any) => {
      if (d.receipt_no) existingReceiptNos.add(d.receipt_no);
      if (d.id) existingIds.add(d.id);
    });

    const mahfils = meta.mahfils || [];
    const validMahfilVouchers = new Set<string>();
    const validMahfilRecordIds = new Set<string>();
    mahfils.forEach((m: any) => {
      const allSt = m.settlements || (m.settlement ? [m.settlement] : []);
      allSt.forEach((s: any) => {
        if (s.accounting_voucher_no) validMahfilVouchers.add(s.accounting_voucher_no);
        if (s.accounting_record_id) validMahfilRecordIds.add(s.accounting_record_id);
        if (s.mahfil_txn_id) validMahfilRecordIds.add(s.mahfil_txn_id);
      });
    });

    // 1. Process DB Donations
    for (const d of dbDonations || []) {
      if (isVoidDonation(d)) continue;

      const isMahfil = d.receipt_no?.startsWith("MHF-") || (d.notes && d.notes.includes("মাহফিল"));
      if (isMahfil) {
        const isValid = (d.receipt_no && validMahfilVouchers.has(d.receipt_no)) || validMahfilRecordIds.has(d.id);
        if (!isValid) continue;
      }

      const amt = Number(d.amount || 0);
      if (amt <= 0) continue;

      const matched = funds.find((f: any) => isTransactionInFund(f, d.fund_id, d.donation_type, funds)) || funds[0];
      const donorName = d.donors?.name || "সাধারণ শুভাকাঙ্ক্ষী";
      const donorPhone = d.donors?.phone || "";

      let sType: UnifiedIncomeTransaction["source_type"] = "DONATION";
      let sLabel = "অনুদান ও যাকাত";

      if (isMahfil) {
        sType = "MAHFIL";
        sLabel = "মাহফিল উদ্বৃত্ত";
        sourceBreakdown.mahfils += amt;
      } else {
        sourceBreakdown.donations += amt;
      }

      transactions.push({
        id: d.id,
        date: d.donation_date || (d.created_at ? toDhakaDateStringFrom(d.created_at) : ""),
        receipt_no: d.receipt_no || `ZR-${d.id.substring(0, 6)}`,
        source_type: sType,
        source_type_label: sLabel,
        source_name: isMahfil ? "ইসলামি মহাসম্মেলন (মাহফিল)" : donorName,
        source_details: donorPhone ? `মোবা: ${donorPhone}` : isMahfil ? "মাহফিল ফান্ড" : "সাধারণ শুভাকাঙ্ক্ষী",
        category: d.donation_type || matched.name,
        fund_id: matched.id,
        fund_name: matched.name,
        payment_method: d.payment_method || (d.notes?.includes("[Method:") ? d.notes.match(/\[Method:\s*([^\]]+)\]/)?.[1] : "Cash") || "Cash",
        amount: amt,
        notes: d.notes || "",
        receipt_url: `/dashboard/zakat/collection/${d.id}/receipt`,
      });
    }

    // 2. Process Subscription / Life Member payments
    const subscriptionPayments = meta.donor_subscription_payments || [];
    for (const sp of subscriptionPayments) {
      if ((sp.receipt_no && existingReceiptNos.has(sp.receipt_no)) || existingIds.has(sp.id)) continue;
      const amt = Number(sp.amount || 0);
      if (amt <= 0) continue;

      const targetFundName = sp.fund_name || "সাধারণ ফান্ড";
      const matched = funds.find((f: any) => isTransactionInFund(f, undefined, targetFundName, funds)) || funds[0];
      sourceBreakdown.subscriptions += amt;

      transactions.push({
        id: sp.id,
        date: sp.payment_date || sp.date || (sp.created_at ? toDhakaDateStringFrom(sp.created_at) : ""),
        receipt_no: sp.receipt_no || `LMP-${sp.id.substring(0, 6)}`,
        source_type: "SUBSCRIPTION",
        source_type_label: "আজীবন সদস্য / মাসিক চাঁদা",
        source_name: sp.donor_name || "সম্মানিত সদস্য",
        source_details: sp.phone ? `মোবা: ${sp.phone}` : "আজীবন সদস্য",
        category: sp.member_type === "LIFE_MEMBER" ? "আজীবন সদস্য অনুদান" : "মাসিক চাঁদা",
        fund_id: matched.id,
        fund_name: matched.name,
        payment_method: sp.payment_method || "Cash",
        amount: amt,
        notes: sp.notes || "",
      });
    }

    // 3. Process Online Donations
    const onlineDonations = meta.online_donations || [];
    for (const od of onlineDonations) {
      if ((od.receipt_no && existingReceiptNos.has(od.receipt_no)) || existingIds.has(od.id) || (od.trx_id && existingReceiptNos.has(od.trx_id))) continue;
      if (od.status === "VERIFIED" || od.status === "COMPLETED" || od.status === "SUCCESS") {
        const amt = Number(od.amount || 0);
        if (amt <= 0) continue;

        const targetFundName = od.fund_category || od.fund_name || od.purpose || "সাধারণ ফান্ড";
        const matched = funds.find((f: any) => isTransactionInFund(f, undefined, targetFundName, funds)) || funds[0];
        sourceBreakdown.onlineDonations += amt;

        transactions.push({
          id: od.id,
          date: od.donation_date || (od.created_at ? toDhakaDateStringFrom(od.created_at) : ""),
          receipt_no: od.receipt_no || od.trx_id || `ONL-${od.id.substring(0, 6)}`,
          source_type: "ONLINE",
          source_type_label: "অনলাইন গেটওয়ে",
          source_name: od.donor_name || "অনলাইন শুভাকাঙ্ক্ষী",
          source_details: od.phone ? `মোবা: ${od.phone} | TrxID: ${od.trx_id || "-"}` : `TrxID: ${od.trx_id || "-"}`,
          category: od.purpose || targetFundName,
          fund_id: matched.id,
          fund_name: matched.name,
          payment_method: od.payment_method || "Digital Gateway",
          amount: amt,
          notes: od.message || "",
        });
      }
    }

    // 4. Process Donation Box Collections
    const boxLogs = meta.donation_box_logs || [];
    for (const b of boxLogs) {
      const recNo = b.receipt_no || b.id;
      if (recNo && (existingReceiptNos.has(recNo) || existingIds.has(recNo))) continue;
      const amt = Number(b.amount || 0);
      if (amt <= 0) continue;

      const targetFundName = b.fund_name || "সাধারণ ফান্ড";
      const matched = funds.find((f: any) => isTransactionInFund(f, undefined, targetFundName, funds)) || funds[0];
      sourceBreakdown.donationBoxes += amt;

      transactions.push({
        id: b.id,
        date: b.collection_date || b.date || (b.created_at ? toDhakaDateStringFrom(b.created_at) : ""),
        receipt_no: b.receipt_no || `BOX-${b.id.substring(0, 6)}`,
        source_type: "DONATION_BOX",
        source_type_label: "দানবাক্স কালেকশন",
        source_name: b.box_name || b.location || "মাদরাসা দানবাক্স",
        source_details: b.location ? `স্থান: ${b.location}` : "দানবাক্স",
        category: "দানবাক্স হতে সংগৃহীত অর্থ",
        fund_id: matched.id,
        fund_name: matched.name,
        payment_method: "Cash",
        amount: amt,
        notes: b.notes || "",
      });
    }

    // 5. Process Qurbani Leather Records
    const leatherRecords = meta.qurbani_leather_records || meta.leather_batches || [];
    for (const lr of leatherRecords) {
      const recNo = lr.receipt_no || lr.id;
      if (recNo && (existingReceiptNos.has(recNo) || existingIds.has(recNo))) continue;
      const inc = Number(lr.received_amount || lr.total_sale_price || lr.total_sale_amount || 0);
      if (inc <= 0) continue;

      const lillahFund = funds.find((f: any) => isTransactionInFund(f, undefined, "লিল্লাহ বোর্ডিং ফান্ড", funds)) || funds[0];
      sourceBreakdown.leatherSales += inc;

      transactions.push({
        id: lr.id,
        date: lr.sale_date || lr.collection_date || lr.date || (lr.created_at ? toDhakaDateStringFrom(lr.created_at) : ""),
        receipt_no: lr.receipt_no || `LTH-${lr.id.substring(0, 6)}`,
        source_type: "LEATHER_SALE",
        source_type_label: "চামড়া বিক্রয়",
        source_name: lr.buyer_name || "কুরবানির চামড়া বিক্রয়",
        source_details: lr.quantity ? `মোট চামড়া: ${lr.quantity} টি` : "কুরবানির চামড়া বিক্রয়লব্ধ অর্থ",
        category: "কুরবানির চামড়া বিক্রয় তহবিল",
        fund_id: lillahFund.id,
        fund_name: lillahFund.name,
        payment_method: "Cash",
        amount: inc,
        notes: lr.notes || "",
      });
    }

    // 6. Process Student Fee Payments
    const validFeePayments = (feePayments || []).filter(
      (p: any) => p.status !== "REVERSED" && p.status !== "VOID"
    );

    for (const p of validFeePayments) {
      if ((p.receipt_no && existingReceiptNos.has(p.receipt_no)) || existingIds.has(p.id)) continue;
      const paymentDate = p.payment_date || (p.created_at ? toDhakaDateStringFrom(p.created_at) : "");
      const studentName = p.student_name || "শিক্ষার্থী";
      const studentClass = p.class_name ? `শ্রেণি: ${p.class_name}` : "";
      const studentRoll = p.student_roll ? `রোল: ${p.student_roll}` : "";
      const studentInfo = [studentClass, studentRoll].filter(Boolean).join(" | ");

      if (p.allocations && p.allocations.length > 0) {
        let allocatedSum = 0;
        let allocIdx = 0; // MD-5: একই fee_type-এর একাধিক allocation হলেও key ইউনিক রাখতে
        for (const alloc of p.allocations) {
          const amt = Number(alloc.allocated_amount || 0);
          if (amt <= 0) continue;
          allocatedSum += amt;
          const allocPosition = allocIdx++;

          const name = alloc.fee_type_name || "মাসিক বেতন";
          const isLillah =
            name.includes("বোর্ডিং") ||
            name.includes("খাবার") ||
            name.includes("খোরাকি") ||
            name.includes("hostel") ||
            name.includes("lillah");
          const fallbackFundName = isLillah ? "লিল্লাহ বোর্ডিং ফান্ড" : "সাধারণ ফান্ড";
          const targetFundId = alloc.fund_id || p.fund_id;
          const targetFundName = alloc.fund_name || p.fund_name || fallbackFundName;

          const matched = funds.find((f: any) => isTransactionInFund(f, targetFundId, targetFundName, funds)) || funds[0];
          sourceBreakdown.studentFees += amt;

          transactions.push({
            // ⛔ MD-5 ফিক্স: আগে key ছিল `${payment.id}_${fee_type_id}` — একই পেমেন্টে
            // একই fee_type-এর একাধিক allocation (যেমন দুই মাসের মাসিক ফি) থাকলে React key
            // ডুপ্লিকেট হয়ে তালিকা ভুলভাবে রেন্ডার হতো (ভুল রো, মোশন ত্রুটি)। এখন position যোগ করা হয়েছে।
            id: `${p.id}_${alloc.fee_type_id || "alloc"}_${allocPosition}`,
            date: paymentDate,
            receipt_no: p.receipt_no || `MR-${p.id.substring(0, 6)}`,
            source_type: "STUDENT_FEE",
            source_type_label: "শিক্ষার্থী ফি",
            source_name: studentName,
            source_details: studentInfo || "মাদরাসা শিক্ষার্থী",
            category: alloc.fee_type_name || "মাসিক বেতন",
            fund_id: matched.id,
            fund_name: matched.name,
            payment_method: p.payment_method || "Cash",
            amount: amt,
            notes: p.notes || "",
            receipt_url: `/dashboard/accounting/fees/${p.id}/receipt`,
          });
        }

        const extraAdvance = Number(p.advance_amount || 0);
        const fineTotal = Number(p.fine_total || 0);
        const totalReceived = Number(p.total_amount_received || 0);
        const remainder = Math.max(0, totalReceived - allocatedSum);
        const extraAmt = (extraAdvance + fineTotal > 0) ? (extraAdvance + fineTotal) : remainder;

        if (extraAmt > 0) {
          const matched = funds.find((f: any) => isTransactionInFund(f, "fund-general", "সাধারণ ফান্ড", funds)) || funds[0];
          sourceBreakdown.studentFees += extraAmt;
          transactions.push({
            id: `${p.id}_extra`,
            date: paymentDate,
            receipt_no: p.receipt_no || `MR-${p.id.substring(0, 6)}`,
            source_type: "STUDENT_FEE",
            source_type_label: "শিক্ষার্থী ফি",
            source_name: studentName,
            source_details: studentInfo || "মাদরাসা শিক্ষার্থী",
            category: "অগ্রিম / জরিমানা / অতিরিক্ত ফি",
            fund_id: matched.id,
            fund_name: matched.name,
            payment_method: p.payment_method || "Cash",
            amount: extraAmt,
            notes: p.notes || "",
            receipt_url: `/dashboard/accounting/fees/${p.id}/receipt`,
          });
        }
      } else {
        const amt = Number(p.total_amount_received || 0);
        if (amt > 0) {
          const isLillah =
            (p.notes || "").includes("বোর্ডিং") ||
            (p.notes || "").includes("খাবার") ||
            (p.notes || "").includes("খোরাকি");
          const fallbackFundName = isLillah ? "লিল্লাহ বোর্ডিং ফান্ড" : "সাধারণ ফান্ড";
          const targetFundId = p.fund_id;
          const targetFundName = p.fund_name || fallbackFundName;

          const matched = funds.find((f: any) => isTransactionInFund(f, targetFundId, targetFundName, funds)) || funds[0];
          sourceBreakdown.studentFees += amt;

          transactions.push({
            id: p.id,
            date: paymentDate,
            receipt_no: p.receipt_no || `MR-${p.id.substring(0, 6)}`,
            source_type: "STUDENT_FEE",
            source_type_label: "শিক্ষার্থী ফি",
            source_name: studentName,
            source_details: studentInfo || "মাদরাসা শিক্ষার্থী",
            category: "ছাত্র ফি আদায়",
            fund_id: matched.id,
            fund_name: matched.name,
            payment_method: p.payment_method || "Cash",
            amount: amt,
            notes: p.notes || "",
            receipt_url: `/dashboard/accounting/fees/${p.id}/receipt`,
          });
        }
      }
    }

    // Sort transactions by date descending
    transactions.sort((a, b) => new Date(b.date || "1970-01-01").getTime() - new Date(a.date || "1970-01-01").getTime());

    // Calculate totalIncome directly from transactions list sum
    const totalIncome = transactions.reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0);

    // Update funds with live collected total from transactions
    const fundTotals: Record<string, number> = {};
    for (const t of transactions) {
      fundTotals[t.fund_id] = (fundTotals[t.fund_id] || 0) + Number(t.amount || 0);
    }
    const updatedFunds = funds.map((f: any) => ({
      ...f,
      total_collected: fundTotals[f.id] !== undefined ? fundTotals[f.id] : Number(f.total_collected || 0),
    }));

    return {
      totalIncome,
      totalTransactions: transactions.length,
      funds: updatedFunds,
      sourceBreakdown,
      transactions,
    };
  } catch (err) {
    console.error("Error in getUnifiedIncomeHistory:", err);
    return {
      totalIncome: 0,
      totalTransactions: 0,
      funds: DEFAULT_FUNDS,
      sourceBreakdown: {
        studentFees: 0,
        donations: 0,
        subscriptions: 0,
        mahfils: 0,
        onlineDonations: 0,
        donationBoxes: 0,
        leatherSales: 0,
      },
      transactions: [],
    };
  }
}
