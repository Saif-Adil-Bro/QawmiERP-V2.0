"use server";

import { createClient, getAuthUser } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getAuthMadrasaId } from "./students";
import { parseExpenseFund } from "@/lib/fund-utils";
import { getFeeMetadata, saveFeeMetadata } from "./fee-management";

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
      const dt = p.payment_date || (p.created_at ? p.created_at.split("T")[0] : "");
      const allocYear = p.allocations?.[0]?.billing_period?.split("-")?.[0];
      return dt.startsWith(filters.year!) || allocYear === filters.year;
    });
  }

  if (filters?.month) {
    filtered = filtered.filter((p) => {
      const dt = p.payment_date || (p.created_at ? p.created_at.split("T")[0] : "");
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
      payment_date: p.payment_date || (p.created_at ? p.created_at.split("T")[0] : new Date().toISOString().split("T")[0]),
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
    payment_date: payment.payment_date || (payment.created_at ? payment.created_at.split("T")[0] : new Date().toISOString().split("T")[0]),
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
    students: {
      first_name: payment.student_name || "শিক্ষার্থী",
      last_name: "",
      roll_number: payment.student_roll || "-",
      class_name: payment.class_name || "-",
    },
    created_at: payment.created_at || payment.payment_date || new Date().toISOString(),
  };
}

export async function deleteFee(feeId: string) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অননুমোদিত অ্যাক্সেস" };

    const finalMadrasaId = await getAuthMadrasaId(supabase, user);
    if (!finalMadrasaId) return { error: "মাদ্রাসা সনাক্ত করা যায়নি" };

    const meta = await getFeeMetadata(finalMadrasaId);
    const payments = [...(meta.payments || [])];
    const studentFees = [...(meta.student_fees || [])];

    const payIdx = payments.findIndex((p) => p.id === feeId || p.receipt_no === feeId);

    if (payIdx >= 0) {
      const payment = payments[payIdx];
      const now = new Date().toISOString();

      // Roll back paid amounts and restore due balances in student_fees
      for (const alloc of payment.allocations || []) {
        if (alloc.student_fee_id) {
          const feeIdx = studentFees.findIndex((f) => f.id === alloc.student_fee_id);
          if (feeIdx >= 0) {
            const target = studentFees[feeIdx];
            const newPaid = Math.max(0, target.paid_amount - alloc.allocated_amount);
            const newDue = Math.max(0, target.payable_amount - newPaid);
            studentFees[feeIdx] = {
              ...target,
              paid_amount: newPaid,
              due_amount: newDue,
              status: newPaid === 0 ? "UNPAID" : "PARTIAL",
              updated_at: now,
            };
          }
        }
      }

      // Remove the payment from active list
      payments.splice(payIdx, 1);

      // Audit log
      const auditLogs = meta.audit_logs || [];
      auditLogs.unshift({
        id: `audit_${Date.now()}`,
        madrasa_id: finalMadrasaId,
        action: "DELETE_FEE_PAYMENT",
        user_name: user.email || "অ্যাডমিন",
        user_role: "admin",
        record_id: feeId,
        details: `রিসিট নং ${payment.receipt_no} (পরিমাণ: ৳${payment.total_amount_received}) ফি তালিকা থেকে ডিলিট করা হয়েছে এবং বকেয়া পুনর্স্থাপন করা হয়েছে।`,
        created_at: now,
      });

      await saveFeeMetadata(finalMadrasaId, {
        student_fees: studentFees,
        payments,
        audit_logs: auditLogs.slice(0, 100),
      });
    } else {
      // Also check if this is an unpaid fee invoice in student_fees
      const feeIdx = studentFees.findIndex((f) => f.id === feeId);
      if (feeIdx >= 0) {
        studentFees.splice(feeIdx, 1);
        await saveFeeMetadata(finalMadrasaId, {
          student_fees: studentFees,
        });
      }
    }

    // Attempt clean up in legacy fees table if present
    try {
      await supabase.from("fees").delete().eq("id", feeId).eq("madrasa_id", finalMadrasaId);
    } catch {}

    revalidatePath("/dashboard/accounting");
    revalidatePath("/dashboard/accounting/fees");
    revalidatePath("/dashboard/accounting/receipts");
    revalidatePath("/dashboard/accounting/due");

    return { success: true };
  } catch (err: any) {
    console.error("Error in deleteFee:", err);
    return { error: err.message || "ফি মুছতে সমস্যা হয়েছে।" };
  }
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

  // Month and year filtering
  if (filters?.month && filters?.year) {
    const parsedYear = parseInt(filters.year);
    const parsedMonth = parseInt(filters.month);
    const padMonth = String(parsedMonth).padStart(2, '0');
    const startDate = `${parsedYear}-${padMonth}-01`;
    const lastDay = new Date(Date.UTC(parsedYear, parsedMonth, 0)).getUTCDate();
    const endDate = `${parsedYear}-${padMonth}-${String(lastDay).padStart(2, '0')}`;
    query = query.gte("expense_date", startDate).lte("expense_date", endDate);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching expenses:", error);
    return [];
  }

  const list = (data || []).map((exp: any) => {
    const parsed = parseExpenseFund(exp.description);
    const voucherNo = exp.voucher_no || `EXP-${new Date(exp.expense_date || exp.created_at || Date.now()).toISOString().split('T')[0].replace(/-/g, '').slice(2)}-${(exp.id || '').substring(0, 4).toUpperCase() || '001'}`;
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

export async function createExpense(prevState: ExpenseActionState, formData: FormData): Promise<ExpenseActionState> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return { error: "Unauthorized" };

  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return { error: "Madrasa not found" };

  const category = formData.get("category") as string;
  const amount = formData.get("amount") as string;
  const expenseDate = formData.get("expense_date") as string;
  const description = formData.get("description") as string;
  const fundId = (formData.get("fund_id") as string) || "fund-general";
  const fundName = (formData.get("fund_name") as string) || "সাধারণ ফান্ড";

  if (!category || !amount || !expenseDate) {
    return { error: "ক্যাটাগরি, পরিমাণ এবং তারিখ আবশ্যক।" };
  }

  const cleanDesc = (description || "").trim();
  // Store fund metadata seamlessly inside description for guaranteed backwards/forward compatibility
  const wrappedDescription = `[FUND: ${fundId} | ${fundName}]\n${cleanDesc}`.trim();

  // Try direct column insertion if fund_id exists in schema, fallback to metadata wrapper
  const recordWithFundCol: any = {
    madrasa_id: finalMadrasaId,
    category: category,
    amount: parseFloat(amount),
    expense_date: expenseDate,
    description: wrappedDescription,
    fund_id: fundId,
    fund_name: fundName,
  };

  const fallbackRecord: any = {
    madrasa_id: finalMadrasaId,
    category: category,
    amount: parseFloat(amount),
    expense_date: expenseDate,
    description: wrappedDescription,
  };

  let createdId = "";
  const { data: directData, error: directError } = await supabase
    .from("expenses")
    .insert(recordWithFundCol)
    .select()
    .single();

  if (directError) {
    // Retry with plain table columns
    const { data: retryData, error: retryError } = await supabase
      .from("expenses")
      .insert(fallbackRecord)
      .select()
      .single();
    if (retryError) {
      console.error("Error creating expense:", retryError);
      return { error: retryError.message };
    }
    createdId = retryData?.id || `EXP-${Date.now()}`;
  } else {
    createdId = directData?.id || `EXP-${Date.now()}`;
  }

  revalidatePath("/dashboard/accounting/expenses");
  revalidatePath("/dashboard/accounting/reports");
  revalidatePath("/dashboard/accounting");

  const voucherNo = `EXP-${expenseDate.replace(/-/g, "").slice(2)}-${createdId.substring(0, 4).toUpperCase() || "001"}`;

  return { 
    success: true,
    expense: {
      id: createdId,
      category,
      amount: parseFloat(amount),
      expense_date: expenseDate,
      description: cleanDesc,
      fund_id: fundId,
      fund_name: fundName,
      voucher_no: voucherNo,
    }
  };
}

export async function updateExpense(formData: FormData) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return { error: "Unauthorized" };

  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return { error: "Madrasa not found" };

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

  const cleanDesc = (description || "").trim();
  const wrappedDescription = `[FUND: ${fundId} | ${fundName}]\n${cleanDesc}`.trim();

  const updateWithFund: any = {
    category,
    amount: parseFloat(amount),
    expense_date: expenseDate,
    description: wrappedDescription,
    fund_id: fundId,
    fund_name: fundName,
  };

  const updateFallback: any = {
    category,
    amount: parseFloat(amount),
    expense_date: expenseDate,
    description: wrappedDescription,
  };

  const { error: directError } = await supabase
    .from("expenses")
    .update(updateWithFund)
    .eq("id", id)
    .eq("madrasa_id", finalMadrasaId);

  if (directError) {
    const { error: retryError } = await supabase
      .from("expenses")
      .update(updateFallback)
      .eq("id", id)
      .eq("madrasa_id", finalMadrasaId);

    if (retryError) {
      console.error("Error updating expense:", retryError);
      return { error: retryError.message };
    }
  }

  revalidatePath("/dashboard/accounting/expenses");
  revalidatePath("/dashboard/accounting/reports");
  revalidatePath("/dashboard/accounting");

  return {
    success: true,
    expense: {
      id,
      category,
      amount: parseFloat(amount),
      expense_date: expenseDate,
      description: cleanDesc,
      fund_id: fundId,
      fund_name: fundName,
    }
  };
}

export async function deleteExpense(expenseId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("expenses").delete().eq("id", expenseId);

  if (error) {
    console.error("Error deleting expense:", error);
    return { error: error.message };
  }

  revalidatePath("/dashboard/accounting/expenses");
  revalidatePath("/dashboard/accounting/reports");
  return { success: true };
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
    const cleanDate = dateStr.includes("T") ? dateStr.split("T")[0] : dateStr.trim();
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

  // 2. Fetch Donations (Zakat, Mahfil, Leather, Donation Box, General)
  // NOTE: donations table does NOT have a fund_id column; select valid columns
  const { data: donationsData, error: donErr } = await supabase
    .from("donations")
    .select("id, amount, donation_type, donation_date, notes, created_at")
    .eq('madrasa_id', finalMadrasaId);

  if (donErr) {
    console.error("Error fetching donations for report:", donErr);
  }

  // Filter donations by target month and year
  const monthlyDonations = (donationsData || []).filter((d: any) => {
    const dateStr = d.donation_date || (d.created_at ? d.created_at.split("T")[0] : "");
    return isWithinRange(dateStr);
  });

  // 3. Fetch Fee Payments & Metadata (Fee Payments, Mahfils, Donors, Boxes, Leather, Online)
  let meta: any = {};
  let metaPayments: any[] = [];
  try {
    meta = await getMadrasaMetadata(finalMadrasaId);
    metaPayments = (meta.payments || []).filter((p: any) => {
      const dateStr = p.payment_date || (p.created_at ? p.created_at.split("T")[0] : "");
      return (
        isWithinRange(dateStr) &&
        p.status !== "REVERSED" &&
        p.status !== "VOID"
      );
    });
  } catch (e) {
    console.warn("Could not fetch madrasa metadata for report:", e);
  }

  // 5. Fetch General Expenses
  const { data: expensesData } = await supabase
    .from("expenses")
    .select("id, amount, description, category, expense_date, created_at")
    .eq('madrasa_id', finalMadrasaId);

  const monthlyExpenses = (expensesData || []).filter((e: any) => {
    const dateStr = e.expense_date || (e.created_at ? e.created_at.split("T")[0] : "");
    return isWithinRange(dateStr);
  });

  // 6. Fetch Bazar Expenses
  const { data: bazarData } = await supabase
    .from("bazar_expenses")
    .select("id, amount, items_details, expense_date, created_at")
    .eq('madrasa_id', finalMadrasaId);

  const monthlyBazar = (bazarData || []).filter((b: any) => {
    const dateStr = b.expense_date || (b.created_at ? b.created_at.split("T")[0] : "");
    return isWithinRange(dateStr);
  });

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
    if (!fundMap.has(fId)) {
      fundMap.set(fId, { fund_id: fId, fund_name: fName, income: 0, expense: 0 });
    }
    fundMap.get(fId)!.income += amt;
  }

  // Helper to safely add expense to fundMap
  function addExpenseToFund(fId: string, fName: string, amt: number) {
    if (amt <= 0) return;
    if (!fundMap.has(fId)) {
      fundMap.set(fId, { fund_id: fId, fund_name: fName, income: 0, expense: 0 });
    }
    fundMap.get(fId)!.expense += amt;
  }

  // Helper to map a donation type or label to a Fund ID & Name
  function resolveDonationFund(typeStr?: string, notesStr?: string): { id: string; name: string } {
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
    const { id: fId, name: fName } = resolveDonationFund(don.donation_type, don.notes);
    addIncomeToFund(fId, fName, amt);
  });

  // B. Add Fee Payments to General Fund or Lillah/Boarding Fund based on fee allocations
  metaPayments.forEach((p: any) => {
    if (p.allocations && p.allocations.length > 0) {
      p.allocations.forEach((alloc: any) => {
        const amt = Number(alloc.allocated_amount || 0);
        if (amt <= 0) return;
        const name = alloc.fee_type_name || "মাসিক বেতন";
        const combined = `${name} ${p.notes || ""}`.toLowerCase();
        if (combined.includes("বোর্ডিং") || combined.includes("খাবার") || combined.includes("hostel") || combined.includes("lillah")) {
          addIncomeToFund("fund-lillah", "লিল্লাহ বোর্ডিং ফান্ড (Lillah Fund)", amt);
        } else {
          addIncomeToFund("fund-general", "সাধারণ ফান্ড (General Fund)", amt);
        }
      });
    } else {
      const amt = Number(p.total_amount_received || 0);
      const combined = `${p.notes || ""}`.toLowerCase();
      if (combined.includes("বোর্ডিং") || combined.includes("খাবার") || combined.includes("hostel") || combined.includes("lillah")) {
        addIncomeToFund("fund-lillah", "লিল্লাহ বোর্ডিং ফান্ড (Lillah Fund)", amt);
      } else {
        addIncomeToFund("fund-general", "সাধারণ ফান্ড (General Fund)", amt);
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
    const d = p.payment_date || p.date || (p.created_at ? p.created_at.split("T")[0] : "");
    const pKey = p.id || p.receipt_no;
    if (isWithinRange(d) && !trackedDonationKeys.has(pKey)) {
      const fundInfo = resolveDonationFund(p.fund_name || p.fund_category, p.notes);
      addIncomeToFund(fundInfo.id, fundInfo.name, Number(p.amount || 0));
    }
  });

  // F. Add Donation Box Collections from Metadata (untracked)
  const boxLogs = meta.donation_box_logs || [];
  boxLogs.forEach((l: any) => {
    const d = l.collection_date || l.date || (l.created_at ? l.created_at.split("T")[0] : "");
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
      const dt = d.payment_date || (d.created_at ? d.created_at.split("T")[0] : "");
      const dKey = d.receipt_no || d.transaction_id || d.id;
      if (isWithinRange(dt) && !trackedDonationKeys.has(dKey)) {
        const fundInfo = resolveDonationFund(d.fund_name || d.purpose, d.notes);
        addIncomeToFund(fundInfo.id, fundInfo.name, Number(d.amount || 0));
      }
    }
  });

  // H. Add Qurbani Leather Records from Metadata (untracked)
  const leatherRecords = meta.qurbani_leather_records || meta.leather_batches || [];
  leatherRecords.forEach((r: any) => {
    const d = r.collection_date || r.sale_date || r.date || (r.created_at ? r.created_at.split("T")[0] : "");
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
    const parsed = parseExpenseFund(exp.description);
    const fId = parsed.fundId || "fund-general";
    const fName = parsed.fundName || "সাধারণ ফান্ড";
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
    const target = fundMap.get(fundId) || {
      fund_id: fundId,
      fund_name: registeredFunds.find(f => f.id === fundId)?.name || "ফান্ড",
      income: 0,
      expense: 0,
    };
    return {
      totalIncome: target.income,
      totalExpense: target.expense,
      netBalance: target.income - target.expense,
      fundStats,
    };
  }

  return {
    totalIncome,
    totalExpense,
    netBalance,
    fundStats,
  };
}
