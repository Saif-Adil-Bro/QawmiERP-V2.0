"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getAuthMadrasaId } from "./students";

export async function getFees(filters?: { month?: string; year?: string; student_id?: string }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
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
  const { data: { user } } = await supabase.auth.getUser();
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
  const { data: { user } } = await supabase.auth.getUser();
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

// Helper to parse fund metadata from description if stored like [FUND: fund_id | name]
function parseExpenseFund(rawDesc: string | null | undefined): { cleanDesc: string; fundId?: string; fundName?: string } {
  const desc = (rawDesc || "").trim();
  if (!desc.includes("[FUND:")) {
    return { cleanDesc: desc };
  }
  const match = desc.match(/\[FUND:\s*([^\]|]+)(?:\|\s*([^\]]+))?\]/i);
  let fundId = undefined;
  let fundName = undefined;
  if (match) {
    fundId = match[1]?.trim();
    if (match[2]) {
      fundName = match[2]?.trim();
    }
  }
  const cleanDesc = desc.replace(/\[FUND:[^\]]+\]\s*/i, "").trim();
  return { cleanDesc, fundId, fundName };
}

export async function getExpenses(filters?: { month?: string; year?: string; fundId?: string }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
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
    const startDate = `${filters.year}-${filters.month.padStart(2, '0')}-01`;
    const endDate = new Date(parseInt(filters.year), parseInt(filters.month), 0).toISOString().split('T')[0];
    query = query.gte("expense_date", startDate).lte("expense_date", endDate);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching expenses:", error);
    return [];
  }

  const list = (data || []).map((exp: any) => {
    const parsed = parseExpenseFund(exp.description);
    return {
      ...exp,
      description: parsed.cleanDesc,
      fund_id: exp.fund_id || parsed.fundId || "fund-general",
      fund_name: exp.fund_name || parsed.fundName || "সাধারণ ফান্ড",
    };
  });

  if (filters?.fundId && filters.fundId !== "all") {
    return list.filter((e: any) => e.fund_id === filters.fundId);
  }

  return list;
}

export async function createExpense(prevState: any, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
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

  const { error: directError } = await supabase.from("expenses").insert(recordWithFundCol);

  if (directError) {
    // Retry with plain table columns
    const { error: retryError } = await supabase.from("expenses").insert(fallbackRecord);
    if (retryError) {
      console.error("Error creating expense:", retryError);
      return { error: retryError.message };
    }
  }

  revalidatePath("/dashboard/accounting/expenses");
  revalidatePath("/dashboard/accounting/reports");
  revalidatePath("/dashboard/accounting");
  return { success: true };
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

export async function getAccountingReport(month: string, year: string, fundId?: string) {
  const startDate = `${year}-${month.padStart(2, '0')}-01`;
  const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];
  
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { totalIncome: 0, totalExpense: 0, netBalance: 0, fundStats: [] };
  
  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return { totalIncome: 0, totalExpense: 0, netBalance: 0, fundStats: [] };

  const { data: feesData } = await supabase
    .from("fees")
    .select("amount, created_at, payment_date")
    .eq('madrasa_id', finalMadrasaId)
    .gte('payment_date', startDate)
    .lte('payment_date', endDate);

  // Also fetch zakat / general donations for accurate total madrasa fund income
  const { data: donationsData } = await supabase
    .from("donations")
    .select("amount, fund_id, donation_type, donation_date")
    .eq('madrasa_id', finalMadrasaId)
    .gte('donation_date', startDate)
    .lte('donation_date', endDate);

  const { data: expensesData } = await supabase
    .from("expenses")
    .select("amount, description, category, expense_date")
    .eq('madrasa_id', finalMadrasaId)
    .gte('expense_date', startDate)
    .lte('expense_date', endDate);

  const { data: bazarData } = await supabase
    .from("bazar_expenses")
    .select("amount, items_details, expense_date")
    .eq('madrasa_id', finalMadrasaId)
    .gte('expense_date', startDate)
    .lte('expense_date', endDate);

  // Parse expenses with their selected fund
  const parsedExpenses = (expensesData || []).map((exp: any) => {
    const parsed = parseExpenseFund(exp.description);
    return {
      ...exp,
      fund_id: parsed.fundId || "fund-general",
      fund_name: parsed.fundName || "সাধারণ ফান্ড",
      amount: Number(exp.amount || 0),
    };
  });

  // Parse bazar expenses with fund (default to Lillah boarding fund or selected fund)
  const parsedBazar = (bazarData || []).map((b: any) => {
    const details = b.items_details || "";
    let fundId = "fund-lillah"; // Default boarding bazar fund
    let fundName = "লিল্লাহ বোর্ডিং ফান্ড";
    if (details.includes("[FUND:")) {
      const match = details.match(/\[FUND:\s*([^\]|]+)(?:\|\s*([^\]]+))?\]/i);
      if (match && match[1]) {
        fundId = match[1].trim();
        fundName = match[2]?.trim() || fundName;
      }
    }
    return {
      amount: Number(b.amount || 0),
      fund_id: fundId,
      fund_name: fundName,
      category: "Food",
    };
  });

  const allExpenses = [...parsedExpenses, ...parsedBazar];

  // Group by Fund for income vs expense reconciliation
  const fundMap = new Map<string, { fund_id: string; fund_name: string; income: number; expense: number }>();

  // Initialize standard funds
  const defaultFundKeys = [
    { id: "fund-general", name: "সাধারণ ফান্ড (General Fund)" },
    { id: "fund-lillah", name: "লিল্লাহ বোর্ডিং ফান্ড (Lillah Fund)" },
    { id: "fund-zakat", name: "যাকাত ফান্ড (Zakat Fund)" },
    { id: "fund-fitra", name: "ফিতরা ও সদকা ফান্ড" },
    { id: "fund-dev", name: "মসজিদ ও উন্নয়ন ফান্ড" },
    { id: "fund-orphan", name: "এতিম কল্যাণ ফান্ড" },
  ];

  defaultFundKeys.forEach(f => {
    fundMap.set(f.id, { fund_id: f.id, fund_name: f.name, income: 0, expense: 0 });
  });

  // Add Fees income to General fund
  const totalFees = feesData?.reduce((sum, item) => sum + Number(item.amount || 0), 0) || 0;
  if (fundMap.has("fund-general")) {
    fundMap.get("fund-general")!.income += totalFees;
  }

  // Add Donations to their respective funds
  (donationsData || []).forEach((don: any) => {
    const fId = don.fund_id || (don.donation_type === "Zakat" ? "fund-zakat" : don.donation_type === "Lillah" ? "fund-lillah" : "fund-general");
    const current = fundMap.get(fId) || { fund_id: fId, fund_name: don.donation_type || "অন্যান্য ফান্ড", income: 0, expense: 0 };
    current.income += Number(don.amount || 0);
    fundMap.set(fId, current);
  });

  // Add Expenses to their respective funds
  allExpenses.forEach((exp: any) => {
    const fId = exp.fund_id || "fund-general";
    const current = fundMap.get(fId) || { fund_id: fId, fund_name: exp.fund_name || "অন্যান্য ফান্ড", income: 0, expense: 0 };
    current.expense += exp.amount;
    fundMap.set(fId, current);
  });

  const totalDonations = donationsData?.reduce((sum, item) => sum + Number(item.amount || 0), 0) || 0;
  const totalIncome = totalFees + totalDonations;
  const totalExpenses = allExpenses.reduce((sum, item) => sum + item.amount, 0);

  const fundStats = Array.from(fundMap.values()).map(f => ({
    ...f,
    balance: f.income - f.expense,
  }));

  // If specific fund filtered
  if (fundId && fundId !== "all") {
    const target = fundMap.get(fundId) || { fund_id: fundId, fund_name: "ফান্ড", income: 0, expense: 0 };
    return {
      totalIncome: target.income,
      totalExpense: target.expense,
      netBalance: target.income - target.expense,
      fundStats,
    };
  }

  return {
    totalIncome: totalIncome,
    totalExpense: totalExpenses,
    netBalance: totalIncome - totalExpenses,
    fundStats,
  };
}
