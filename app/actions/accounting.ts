"use server";
import {financeDeniedRoles} from '@/lib/finance/access';
import {writeGuard} from '@/lib/action-authorization';
import {receiptFunds} from '@/lib/finance/fee-portions';
import {bdtPoisha} from "@/lib/payment-gateway-engine";
import {expensePeriod} from "@/lib/finance/period";
import {changeVoucherStatus} from "@/lib/finance/voucher-status";
import { getMadrasaMetadata } from "@/lib/sessions";
import {readBooks} from "@/lib/finance/read-books";
import {ledgerEntries,money} from "@/lib/finance/entries";
import {reconcilePayments} from "@/lib/portal/ledger";
import {postExpense,nextExpenseNumber} from '@/lib/finance/expense';

import { toDhakaDateStringFrom, toDhakaDateString, getDhakaYear, toDhakaMonthString } from "@/lib/date-utils";
import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getAuthMadrasaId } from "./students";
import { requirePermission } from "@/lib/permissions-server";
import { periodLines } from "@/lib/finance/statement";
import { financeRows, fundCatalog, postingFund } from "@/lib/finance/funds";
import { collectionFund, storedFund, settlementIndex, unmatchedMahfil, REVIEW_FUND, type FundItem, parseExpenseFund, isVoidedExpense, isVoidDonation } from "@/lib/fund-utils";
import { getFeeMetadata, voidFeePayment } from "./fee-management";
import { logAuditEvent } from "@/lib/audit-log";
import { assertAccountingPeriodUnlocked } from "@/lib/lock-guards";
import { submitWorkflowHookApproval } from "@/lib/approval-workflow";

export async function getFees(filters?: { month?: string; year?: string; student_id?: string }) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return [];
  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return [];

  const gate=await writeGuard('financeRead');if(!gate.allowed || gate.madrasaId!==finalMadrasaId)throw Error('হিসাব দেখার অনুমতি নেই।');
  const db=await createAdminClient();
  const [meta,legacy]=await Promise.all([getFeeMetadata(finalMadrasaId),financeRows(db,finalMadrasaId,'fees')]);
  const {start,end}=expensePeriod(filters);
  const filtered=reconcilePayments(meta.payments||[],legacy).filter(p=>{
    const d=p.payment_date || (p.created_at?toDhakaDateStringFrom(p.created_at):'');
    return (!filters?.student_id || p.student_id===filters.student_id) && (!start || d>=start) && (!end || d<=end);
  });

  // Sort descending by payment date / creation
  filtered.sort((a, b) => {
    const dateA = a.payment_date || a.created_at || "";
    const dateB = b.payment_date || b.created_at || "";
    return dateB.localeCompare(dateA);
  });

  return filtered.map((p) => {
    const feeTypeName =
      p.allocations && p.allocations.length > 0
        ? p.allocations.map((a:any) => a.fee_type_name).join(", ")
        : "ফি কালেকশন";

    const billingPeriod = p.allocations?.[0]?.billing_period || "";
    const [bYear, bMonth] = billingPeriod.includes("-") ? billingPeriod.split("-") : ["", ""];

    return {
      id: p.id,
      madrasa_id: finalMadrasaId,
      receipt_no: p.receipt_no || "",
      payment_date: p.payment_date || (p.created_at ? toDhakaDateStringFrom(p.created_at) : ""),
      student_id: p.student_id,
      fee_type: feeTypeName,
      fee_month: bMonth || "",
      fee_year: bYear || "",
      amount: Number(p.total_amount_received || 0),
      total_amount_received: Number(p.total_amount_received || 0),
      discount_total: Number(p.discount_total || 0),
      fine_total: Number(p.fine_total || 0),
      advance_amount: Number(p.advance_amount || 0),
      payment_method: p.payment_method || "",
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
      created_at: p.created_at || p.payment_date || "",
    };
  });
}

export async function getFeeWithReceiptNo(feeId: string) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return null;
  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return null;

  const gate=await writeGuard('financeRead');if(!gate.allowed || gate.madrasaId!==finalMadrasaId)throw Error('হিসাব দেখার অনুমতি নেই।');
  const db=await createAdminClient();
  const [meta,legacy]=await Promise.all([getFeeMetadata(finalMadrasaId),financeRows(db,finalMadrasaId,'fees')]);
  const matches=reconcilePayments(meta.payments || [],legacy,true).filter(p=>p.id===feeId || p.db_fee_id===feeId || p.receipt_no===feeId);
  const payment=matches.length===1?matches[0]:null;

  if (!payment || payment.finance_review_reason) return null;

  const feeTypeName =
    payment.allocations && payment.allocations.length > 0
      ? payment.allocations.map((a:any) => a.fee_type_name).join(", ")
      : "ফি কালেকশন";

  const billingPeriod = payment.allocations?.[0]?.billing_period || "";
  const [bYear, bMonth] = billingPeriod.includes("-") ? billingPeriod.split("-") : ["", ""];

  return {
    id: payment.id,
    madrasa_id: finalMadrasaId,
    receipt_no: payment.receipt_no || "",
    payment_date: payment.payment_date || (payment.created_at ? toDhakaDateStringFrom(payment.created_at) : ""),
    student_id: payment.student_id,
    fee_type: feeTypeName,
    fee_month: bMonth || "",
    fee_year: bYear || "",
    amount: Number(payment.total_amount_received || 0),
    total_amount_received: Number(payment.total_amount_received || 0),
    discount_total: Number(payment.discount_total || 0),
    fine_total: Number(payment.fine_total || 0),
    advance_amount: Number(payment.advance_amount || 0),
    payment_method: payment.payment_method || "",
    allocations: payment.allocations || [],
    fund_totals:receiptFunds(payment,await fundCatalog(finalMadrasaId,true)),
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
    created_at: payment.created_at || payment.payment_date || "",
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

  const permission=await writeGuard('financeRead');
  if(!permission.allowed || permission.madrasaId!==finalMadrasaId)throw Error('হিসাব দেখার অনুমতি নেই।');
  const {start,end}=expensePeriod(filters);
  const data=await financeRows(await createAdminClient(),finalMadrasaId,'expenses','*',end,start);
  data.sort((a,b)=>b.expense_date.localeCompare(a.expense_date) || String(b.created_at).localeCompare(String(a.created_at)));

  // HI-5: বাতিল (VOID) করা খরচ কখনো তালিকা/রিপোর্টে দেখানো বা গোনা হয় না
  const [catalog,meta] = await Promise.all([fundCatalog(finalMadrasaId,true),getMadrasaMetadata(finalMadrasaId,true)]);
  const linked = settlementIndex(meta.mahfils);
  const list = (data || []).filter((exp: any) => !isVoidedExpense(exp)).map((exp: any) => {
    const parsed = parseExpenseFund(exp.description);
    const fund = unmatchedMahfil(exp,linked) ? REVIEW_FUND : storedFund(catalog,exp) || REVIEW_FUND;
    const voucherNo = exp.voucher_no || parsed.voucherNo || exp.id;
    return {
      ...exp,
      description: parsed.cleanDesc,
      fund_id: fund.id,
      fund_name: fund.name,
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
  pendingApproval?: boolean;
  approvalRequestId?: string;
  message?: string;
  expense?: {
    id: string;
    category: string;
    amount: number;
    expense_date: string;
    description: string;
    restricted_beneficiary?: string;
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
export async function getNextExpenseVoucherNo(expenseDate?:string) {
  const tenant=await getAuthMadrasaId();if (!tenant) throw new Error('প্রতিষ্ঠান মেলেনি।');
  return nextExpenseNumber(tenant,expenseDate || toDhakaDateString());
}
export async function createExpense(_prevState:ExpenseActionState,formData:FormData) {
  return postExpense(formData);
}

export async function updateExpense(formData: FormData) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return { error: "Unauthorized" };

  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return { error: "Madrasa not found" };

  // CR-2 ফিক্স: সার্ভার-সাইড অনুমতি যাচাই
  const guard = await requirePermission({denyRoles:financeDeniedRoles,
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
  const beneficiary = String(formData.get("restricted_beneficiary") || "").trim();
  let fund: FundItem;
  try { fund = await postingFund(finalMadrasaId,formData.get("fund_id"),"expense",category,beneficiary,formData.get("fund_name")); }
  catch (err: any) { return {error: err.message}; }
  const fundId = fund.id, fundName = fund.name;

  if (!id || !category || !amount || !expenseDate) {
    return { error: "খরচের আইডি, খাত, পরিমাণ ও তারিখ আবশ্যক।" };
  }

  const parsedAmount = Number(amount);
  if (!bdtPoisha(amount)) {
    return { error: "খরচের পরিমাণ শূন্যের বেশি একটি সঠিক সংখ্যা হতে হবে।" };
  }

  // বিদ্যমান ভাউচার নম্বর ও পূর্বের মান সংরক্ষণ
  const db=await createAdminClient();
  const { data: existingExp } = await db
    .from("expenses")
    .select("*")
    .eq("id", id)
    .eq("madrasa_id", finalMadrasaId)
    .single();

  if (!existingExp || storedFund(await fundCatalog(finalMadrasaId),existingExp)?.id !== fund.id) return {error:"মূল ভাউচারের ফান্ড মিলছে না। ম্যানুয়াল যাচাই প্রয়োজন।"};
  // 1.3 Granular Accounting Period Lock Guard (check BOTH existing date and new target date)
  if (existingExp?.expense_date) {
    const oldPeriodLock = await assertAccountingPeriodUnlocked(
      finalMadrasaId,
      existingExp.expense_date,
      "পূর্ববর্তী খরচের ভাউচার সংশোধন"
    );
    if (oldPeriodLock.locked) return { error: oldPeriodLock.error };
  }
  const newPeriodLock = await assertAccountingPeriodUnlocked(
    finalMadrasaId,
    expenseDate,
    "খরচের ভাউচার সংশোধন"
  );
  if (newPeriodLock.locked) return { error: newPeriodLock.error };

  let voucherNo = (formData.get("voucher_no") as string) || "";
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
    restricted_beneficiary: beneficiary || null,
    fund_id: fundId,
    fund_name: fundName,
    voucher_no: voucherNo || null,
  };

  const updated = await db
    .from("expenses")
    .update(updateWithFund)
    .eq("id", id)
    .eq("madrasa_id", finalMadrasaId).select("id").single();

  if (updated.error) {
    console.error("Error updating expense:", updated.error);
    return { error: updated.error.message };
  }

  await logAuditEvent({
    madrasaId: finalMadrasaId,
    actorId: user.id,
    actorName: guard.context?.profile?.fullName || user.email || "হিসাবরক্ষক",
    actorEmail: user.email || null,
    actorRole: guard.context?.role || null,
    module: "finance",
    action: "EXPENSE_UPDATED",
    entityType: "expense",
    entityId: id,
    entityLabel: `${voucherNo || id} · ${category}`,
    summary: `খরচের ভাউচার (${voucherNo || id}) সংশোধন করা হয়েছে: ৳${Number(existingExp?.amount || 0)} → ৳${parsedAmount}।`,
    oldValue: existingExp
      ? {
          category: existingExp.category,
          amount: Number(existingExp.amount),
          expense_date: existingExp.expense_date,
        }
      : null,
    newValue: {
      category,
      amount: parsedAmount,
      expense_date: expenseDate,
      fund_name: fundName,
      description: rawCleanDesc,
    },
    severity: "WARNING",
  });

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
      restricted_beneficiary: beneficiary,
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
  const guard = await requirePermission({denyRoles:financeDeniedRoles,
    userId: user.id,
    madrasaId: finalMadrasaId,
    permissions: ["finance.delete", "finance.edit"],
    roles: ["super_admin", "admin", "muhtamim", "accountant"],
  });
  if (!guard.allowed) return { error: guard.error || "খরচ বাতিলের অনুমতি আপনার নেই।" };

  const voidReason = (reason || "ভুল এন্ট্রি বাতিল").trim();
  try {
    if (!await changeVoucherStatus(finalMadrasaId,user.id,expenseId,false,voidReason,true)) return {error:'মূল ভাউচার পাওয়া যায়নি।'};
  } catch (e:any) {return {error:e.message};}
  revalidatePath("/dashboard/accounting/expenses");
  revalidatePath("/dashboard/accounting/reports");
  revalidatePath("/dashboard/accounting");
  return { success: true, message: "খরচ সফলভাবে বাতিল (VOID) করা হয়েছে — রেকর্ড সংরক্ষিত আছে।" };
}



export async function getAccountingReport(month: string, year: string, fundId?: string) {
  const {start:startDate,end:endDate}=expensePeriod({month,year});
  if (!startDate || !endDate) throw new Error('মাস ও বছর নির্বাচন করুন।');
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) throw new Error("অনুমতি নেই।");
  
  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) throw new Error("প্রতিষ্ঠান মেলেনি।");

  const gate=await writeGuard('financeRead');if(!gate.allowed || gate.madrasaId!==finalMadrasaId)throw Error('হিসাব দেখার অনুমতি নেই।');
  const db=await createAdminClient();
  const [catalog,donations,expenses,bazar,meta,feeMeta,legacyFees] = await Promise.all([
    fundCatalog(finalMadrasaId,true),financeRows(db,finalMadrasaId,"donations","*",endDate),financeRows(db,finalMadrasaId,"expenses","*",endDate),
    financeRows(db,finalMadrasaId,"bazar_expenses","*",endDate),getMadrasaMetadata(finalMadrasaId,true),getFeeMetadata(finalMadrasaId),financeRows(db,finalMadrasaId,"fees","*",endDate),
  ]);
  const fundStats = periodLines({funds:catalog,start:startDate,end:endDate,donations,expenses,bazar,meta,payments:reconcilePayments(feeMeta.payments || [],legacyFees,true)})
    .filter(f => !fundId || fundId === "all" || f.fundId === fundId)
    .map(f => ({fund_id:f.fundId,fund_name:f.fundName,previousBalance:f.openingBalance,income:f.totalIncome,expense:f.totalExpense,
      balance:f.totalIncome-f.totalExpense,closingBalance:f.closingBalance}));
  const totalIncome = fundStats.reduce((a,f) => a+f.income,0), totalExpense = fundStats.reduce((a,f) => a+f.expense,0);
  const previousBalance = fundStats.reduce((a,f) => a+f.previousBalance,0), netBalance = totalIncome-totalExpense;
  return {totalIncome,totalExpense,netBalance,previousBalance,isDebt:previousBalance<0,adjustedClosingBalance:previousBalance+netBalance,fundStats};
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
    const tenant=await getAuthMadrasaId();
    const books=await readBooks(tenant,getFeeMetadata,true),funds=books.funds;
    const breakdown={fee:['studentFees','STUDENT_FEE','শিক্ষার্থী ফি'],donation:['donations','DONATION','অনুদান ও যাকাত'],
      mahfil:['mahfils','MAHFIL','মাহফিল উদ্বৃত্ত'],online_donations:['onlineDonations','ONLINE','অনলাইন অনুদান'],
      donation_box_logs:['donationBoxes','DONATION_BOX','দানবাক্স কালেকশন'],donor_subscription_payments:['subscriptions','SUBSCRIPTION','সদস্য চাঁদা'],
      qurbani_leather_records:['leatherSales','LEATHER_SALE','চামড়া বিক্রয়']} as const;
    const {getCurrentUserMaskingContext}=await import('@/lib/data-access-guards');
    const {allowUnmasked}=await getCurrentUserMaskingContext('finance','phone');
    const sourceBreakdown={studentFees:0,donations:0,mahfils:0,onlineDonations:0,donationBoxes:0,subscriptions:0,leatherSales:0};
    const transactions:UnifiedIncomeTransaction[]=[];
    for (const e of ledgerEntries(books)) {
      if (!e.income || e.status==='VOID' || e.source==='expense' || e.source==='bazar') continue;
      const [bucket,type,label]=breakdown[e.source];
      sourceBreakdown[bucket]=money(sourceBreakdown[bucket]+e.amount);
      transactions.push({id:e.id,date:e.date,receipt_no:e.voucher_no,source_type:type,source_type_label:label,source_name:e.source_or_recipient,
        source_details:allowUnmasked?e.donor_phone:undefined,category:e.category || label,fund_id:e.fund_id,fund_name:e.fund_name,payment_method:e.payment_method || '',amount:e.amount,
        notes:allowUnmasked?e.notes:undefined,receipt_url:e.receiptUrl || `/dashboard/zakat/collection/${e.id}/receipt`});
    }
    transactions.sort((a, b) => new Date(b.date || "1970-01-01").getTime() - new Date(a.date || "1970-01-01").getTime());

    // Calculate totalIncome directly from transactions list sum
    const totalIncome = transactions.reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0);

    // Update funds with live collected total and transaction count from transactions
    const fundTotals: Record<string, number> = {};
    const fundCounts: Record<string, number> = {};
    for (const t of transactions) {
      fundTotals[t.fund_id] = (fundTotals[t.fund_id] || 0) + Number(t.amount || 0);
      fundCounts[t.fund_id] = (fundCounts[t.fund_id] || 0) + 1;
    }
    const updatedFunds = [...funds,...(fundCounts[REVIEW_FUND.id] ? [REVIEW_FUND] : [])].map((f: any) => ({
      ...f,
      total_collected: fundTotals[f.id] || 0,
      donations_count: fundCounts[f.id] || 0,
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
    throw new Error("পূর্ণ আয়ের হিসাব পড়া যায়নি। আবার চেষ্টা করুন।");
  }
}
