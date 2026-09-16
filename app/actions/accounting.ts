"use server";

import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
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
      if (payIdx >= 0) {
        const payment = payments[payIdx];
        if (payment?.db_fee_id) {
          await supabase.from("fees").delete().eq("id", payment.db_fee_id).eq("madrasa_id", finalMadrasaId);
        }
        if (payment?.receipt_no) {
          await supabase.from("fees").delete().like("notes", `%${payment.receipt_no}%`).eq("madrasa_id", finalMadrasaId);
        }
      }
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
        const fundInfo = resolveDonationFund(d.fund_category || d.fund_name || d.purpose, d.notes);
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

    const [funds, meta, feeMeta, { data: dbDonations }] = await Promise.all([
      getFunds(),
      getMadrasaMetadata(finalMadrasaId),
      getFeeMetadata(finalMadrasaId),
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
        date: d.donation_date || (d.created_at ? d.created_at.split("T")[0] : ""),
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
        date: sp.payment_date || sp.date || (sp.created_at ? sp.created_at.split("T")[0] : ""),
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
          date: od.donation_date || (od.created_at ? od.created_at.split("T")[0] : ""),
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
        date: b.collection_date || b.date || (b.created_at ? b.created_at.split("T")[0] : ""),
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
        date: lr.sale_date || lr.collection_date || lr.date || (lr.created_at ? lr.created_at.split("T")[0] : ""),
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
    const feePayments = (feeMeta.payments || []).filter(
      (p: any) => p.status !== "REVERSED" && p.status !== "VOID"
    );

    for (const p of feePayments) {
      if ((p.receipt_no && existingReceiptNos.has(p.receipt_no)) || existingIds.has(p.id)) continue;
      const paymentDate = p.payment_date || (p.created_at ? p.created_at.split("T")[0] : "");
      const studentName = p.student_name || "শিক্ষার্থী";
      const studentClass = p.class_name ? `শ্রেণি: ${p.class_name}` : "";
      const studentRoll = p.student_roll ? `রোল: ${p.student_roll}` : "";
      const studentInfo = [studentClass, studentRoll].filter(Boolean).join(" | ");

      if (p.allocations && p.allocations.length > 0) {
        for (const alloc of p.allocations) {
          const amt = Number(alloc.allocated_amount || 0);
          if (amt <= 0) continue;

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
            id: `${p.id}_${alloc.fee_type_id || "alloc"}`,
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

    const totalIncome = funds.reduce((sum: number, f: any) => sum + Number(f.total_collected || 0), 0);

    return {
      totalIncome,
      totalTransactions: transactions.length,
      funds,
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
