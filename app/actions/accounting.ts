"use server";

import { createClient, getAuthUser } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getAuthMadrasaId } from "./students";
import { parseExpenseFund } from "@/lib/fund-utils";

export async function getFees(filters?: { month?: string; year?: string; student_id?: string }) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return [];
  const finalMadrasaId = await getAuthMadrasaId(supabase, user);

  // Get all fees to calculate serial receipt numbers
  const { data: allFees } = await supabase
    .from("fees")
    .select("id")
    .eq("madrasa_id", finalMadrasaId)
    .order("created_at", { ascending: true });

  const receiptNoMap = new Map();
  allFees?.forEach((f, index) => {
    receiptNoMap.set(f.id, `RN${String(index + 1).padStart(4, '0')}`);
  });

  let query = supabase
    .from("fees")
    .select(`
      *,
      students (first_name, last_name, roll_number, class_name)
    `)
    .eq("madrasa_id", finalMadrasaId)
    .order("created_at", { ascending: false });

  if (filters?.month) query = query.eq("fee_month", filters.month);
  if (filters?.year) query = query.eq("fee_year", filters.year);
  if (filters?.student_id) query = query.eq("student_id", filters.student_id);

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching fees:", error);
    return [];
  }

  return data.map(fee => ({
    ...fee,
    receipt_no: receiptNoMap.get(fee.id) || fee.id.substring(0, 8).toUpperCase()
  }));
}

export async function getFeeWithReceiptNo(feeId: string) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return null;
  const finalMadrasaId = await getAuthMadrasaId(supabase, user);

  const { data: allFees } = await supabase
    .from("fees")
    .select("id")
    .eq("madrasa_id", finalMadrasaId)
    .order("created_at", { ascending: true });

  const receiptNoMap = new Map();
  allFees?.forEach((f, index) => {
    receiptNoMap.set(f.id, `RN${String(index + 1).padStart(4, '0')}`);
  });

  const { data: fee, error } = await supabase
    .from("fees")
    .select(`
      *,
      students (first_name, last_name, roll_number, class_name)
    `)
    .eq("id", feeId)
    .single();

  if (error || !fee) return null;

  return {
    ...fee,
    receipt_no: receiptNoMap.get(fee.id) || fee.id.substring(0, 8).toUpperCase()
  };
}

export async function createFee(prevState: any, formData: FormData) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return { error: "Unauthorized" };

  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return { error: "Madrasa not found" };

  const studentId = formData.get("student_id") as string;
  const feeType = formData.get("fee_type") as string;
  const amount = formData.get("amount") as string;
  const paymentDate = formData.get("payment_date") as string;
  const feeMonth = formData.get("fee_month") as string;
  const feeYear = formData.get("fee_year") as string;
  const notes = formData.get("notes") as string;

  if (!studentId || !feeType || !amount || !paymentDate) {
    return { error: "শিক্ষার্থী, ফি'র ধরন, পরিমাণ এবং তারিখ আবশ্যক।" };
  }

  const { data, error } = await supabase.from("fees").insert({

    madrasa_id: finalMadrasaId,
    student_id: studentId,
    fee_type: feeType,
    amount: parseFloat(amount),
    payment_date: paymentDate,
    fee_month: feeMonth || null,
    fee_year: feeYear || null,
    notes: notes || null,
  
  }).select().single();

  if (error) {
    console.error("Error creating fee:", error);
    return { error: error.message };
  }

  revalidatePath("/dashboard/accounting/fees");
  
  // Calculate receipt_no for the newly created fee
  const { count } = await supabase
    .from("fees")
    .select("*", { count: "exact", head: true })
    .eq("madrasa_id", finalMadrasaId);
  
  const receiptNo = `RN${String(count || 1).padStart(4, '0')}`;
  data.receipt_no = receiptNo;

  return { success: true, fee: data };
}

export async function deleteFee(feeId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("fees").delete().eq("id", feeId);

  if (error) {
    console.error("Error deleting fee:", error);
    return { error: error.message };
  }

  revalidatePath("/dashboard/accounting/fees");
  return { success: true };
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

  // 3. Fetch Student Fees (from fees table)
  const { data: feesData } = await supabase
    .from("fees")
    .select("id, amount, payment_date, fee_month, fee_year, fee_type, notes, created_at")
    .eq('madrasa_id', finalMadrasaId);

  const monthlyFees = (feesData || []).filter((f: any) => {
    const dateStr = f.payment_date || (f.created_at ? f.created_at.split("T")[0] : "");
    return isWithinRange(dateStr);
  });

  // 4. Fetch Metadata (Fee Payments, Mahfils, Donors, Boxes, Leather, Online)
  let meta: any = {};
  let metaPayments: any[] = [];
  try {
    meta = await getMadrasaMetadata(finalMadrasaId);
    const trackedFeeIds = new Set(monthlyFees.map((f: any) => f.id));
    metaPayments = (meta.payments || []).filter((p: any) => {
      const dateStr = p.payment_date || (p.created_at ? p.created_at.split("T")[0] : "");
      return (
        isWithinRange(dateStr) &&
        p.status === "COMPLETED" &&
        !trackedFeeIds.has(p.id) &&
        !trackedFeeIds.has(p.db_fee_id)
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

  // A. Add Donations income to Fund Map
  monthlyDonations.forEach((don: any) => {
    const amt = Number(don.amount || 0);
    const { id: fId, name: fName } = resolveDonationFund(don.donation_type, don.notes);
    addIncomeToFund(fId, fName, amt);
  });

  // B. Add Fees income to General Fund (or designated fund)
  monthlyFees.forEach((fee: any) => {
    const amt = Number(fee.amount || 0);
    addIncomeToFund("fund-general", "সাধারণ ফান্ড (General Fund)", amt);
  });

  // C. Add Meta Fee Payments to General Fund
  metaPayments.forEach((p: any) => {
    const amt = Number(p.total_amount_received || 0);
    addIncomeToFund("fund-general", "সাধারণ ফান্ড (General Fund)", amt);
  });

  // D. Add Mahfil Receipt Book Collections & Transactions from Metadata
  const mahfils = meta.mahfils || [];
  mahfils.forEach((m: any) => {
    // 1. Receipt books (collected amounts from deposits)
    const books = m.receipt_books || [];
    books.forEach((bk: any) => {
      const fundInfo = resolveDonationFund(bk.category, bk.receipt_type || "মাহফিল রসিদ বই আদায়");
      if (Array.isArray(bk.deposit_history) && bk.deposit_history.length > 0) {
        bk.deposit_history.forEach((dep: any) => {
          if (isWithinRange(dep.date)) {
            addIncomeToFund(fundInfo.id, fundInfo.name, Number(dep.amount || 0));
          }
        });
      } else if (Number(bk.total_collected || 0) > 0) {
        const d = bk.return_date || bk.issued_date || m.start_date || "";
        if (isWithinRange(d)) {
          addIncomeToFund(fundInfo.id, fundInfo.name, Number(bk.total_collected || 0));
        }
      }
    });

    // 2. Direct Mahfil Transactions (Income & Expense vouchers)
    const txns = m.transactions || [];
    txns.forEach((t: any) => {
      const d = t.date || m.start_date || "";
      if (isWithinRange(d)) {
        if (t.type === "INCOME") {
          const fundInfo = resolveDonationFund(t.category, t.description);
          addIncomeToFund(fundInfo.id, fundInfo.name, Number(t.amount || 0));
        } else if (t.type === "EXPENSE") {
          const parsed = parseExpenseFund(t.description || t.category);
          addExpenseToFund(parsed.fundId || "fund-general", parsed.fundName || "সাধারণ ফান্ড", Number(t.amount || 0));
        }
      }
    });
  });

  // E. Add Donor Subscriptions from Metadata
  const donorPayments = meta.donor_subscription_payments || [];
  donorPayments.forEach((p: any) => {
    const d = p.payment_date || p.date || (p.created_at ? p.created_at.split("T")[0] : "");
    if (isWithinRange(d)) {
      const fundInfo = resolveDonationFund(p.fund_name || p.fund_category, p.notes);
      addIncomeToFund(fundInfo.id, fundInfo.name, Number(p.amount || 0));
    }
  });

  // F. Add Donation Box Collections from Metadata
  const boxLogs = meta.donation_box_logs || [];
  boxLogs.forEach((l: any) => {
    const d = l.collection_date || l.date || (l.created_at ? l.created_at.split("T")[0] : "");
    if (isWithinRange(d)) {
      const fundInfo = resolveDonationFund(l.fund_name || "দানবাক্স ফান্ড", l.notes);
      addIncomeToFund(fundInfo.id, fundInfo.name, Number(l.amount || 0));
    }
  });

  // G. Add Online Donations (Completed/Verified) from Metadata
  const onlineDonations = meta.online_donations || [];
  onlineDonations.forEach((d: any) => {
    if (d.status === "COMPLETED" || d.status === "VERIFIED" || d.status === "SUCCESS") {
      const dt = d.payment_date || (d.created_at ? d.created_at.split("T")[0] : "");
      if (isWithinRange(dt)) {
        const fundInfo = resolveDonationFund(d.fund_name || d.purpose, d.notes);
        addIncomeToFund(fundInfo.id, fundInfo.name, Number(d.amount || 0));
      }
    }
  });

  // H. Add Qurbani Leather Records from Metadata
  const leatherRecords = meta.qurbani_leather_records || meta.leather_batches || [];
  leatherRecords.forEach((r: any) => {
    const d = r.collection_date || r.sale_date || r.date || (r.created_at ? r.created_at.split("T")[0] : "");
    if (isWithinRange(d)) {
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

    if (details.includes("[FUND:")) {
      const match = details.match(/\[FUND:\s*([^\]|]+)(?:\|\s*([^\]]+))?\]/i);
      if (match && match[1]) {
        fId = match[1].trim();
        fName = match[2]?.trim() || fName;
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
