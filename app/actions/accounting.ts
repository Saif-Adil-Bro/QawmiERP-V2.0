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

export async function getExpenses(filters?: { month?: string; year?: string }) {
  const supabase = await createClient();
  let query = supabase
    .from("expenses")
    .select("*")
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false });

  // Note: For expenses, month and year filtering would typically be done by parsing expense_date
  // We can do it in code if necessary, or pass date ranges. Let's do simple date ranges for month.
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
  return data;
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

  if (!category || !amount || !expenseDate) {
    return { error: "ক্যাটাগরি, পরিমাণ এবং তারিখ আবশ্যক।" };
  }

  const { error } = await supabase.from("expenses").insert({
    madrasa_id: finalMadrasaId,
    category: category,
    amount: parseFloat(amount),
    expense_date: expenseDate,
    description: description || null,
  });

  if (error) {
    console.error("Error creating expense:", error);
    return { error: error.message };
  }

  revalidatePath("/dashboard/accounting/expenses");
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
  return { success: true };
}

export async function getAccountingReport(month: string, year: string) {
  const startDate = `${year}-${month.padStart(2, '0')}-01`;
  const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];
  
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { totalIncome: 0, totalExpense: 0, netBalance: 0 };
  
  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return { totalIncome: 0, totalExpense: 0, netBalance: 0 };

  const { data: feesData } = await supabase
    .from("fees")
    .select("amount")
    .eq('madrasa_id', finalMadrasaId)
    .gte('payment_date', startDate)
    .lte('payment_date', endDate);

  const { data: expensesData } = await supabase
    .from("expenses")
    .select("amount")
    .eq('madrasa_id', finalMadrasaId)
    .gte('expense_date', startDate)
    .lte('expense_date', endDate);

  const totalFees = feesData?.reduce((sum, item) => sum + Number(item.amount), 0) || 0;
  const totalExpenses = expensesData?.reduce((sum, item) => sum + Number(item.amount), 0) || 0;

  return {
    totalIncome: totalFees,
    totalExpense: totalExpenses,
    netBalance: totalFees - totalExpenses
  };
}
