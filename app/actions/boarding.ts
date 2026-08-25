"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getAuthMadrasaId } from "./students";

// ==========================================
// 1. MEAL ENTRIES
// ==========================================

export async function getStudentsForMeals(date: string, classId?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return [];

  // 1. Fetch classes to display filters
  let query = supabase
    .from("students")
    .select("id, first_name, last_name, roll_number, class_id, class_name")
    .eq("madrasa_id", finalMadrasaId)
    .order("roll_number");

  if (classId && classId !== "All") {
    query = query.eq("class_id", classId);
  }

  const { data: students, error: studentsError } = await query;
  if (studentsError) {
    console.error("Error fetching students for meals:", studentsError);
    return [];
  }

  // 2. Fetch meal entries for this date
  const { data: mealEntries, error: mealError } = await supabase
    .from("meal_entries")
    .select("student_id, meal_status")
    .eq("madrasa_id", finalMadrasaId)
    .eq("entry_date", date);

  if (mealError) {
    console.error("Error fetching meal entries:", mealError);
  }

  const mealMap = new Map((mealEntries || []).map(m => [m.student_id, m.meal_status]));

  // Map student meal status. Default is "On" if not registered.
  return students.map(student => ({
    id: student.id,
    first_name: student.first_name,
    last_name: student.last_name,
    roll_number: student.roll_number,
    class_name: student.class_name,
    meal_status: mealMap.get(student.id) || "On"
  }));
}

export async function saveMealEntries(date: string, mealData: { student_id: string; meal_status: "On" | "Off" }[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return { error: "Madrasa not found" };

  const recordsToUpsert = mealData.map(record => ({
    madrasa_id: finalMadrasaId,
    student_id: record.student_id,
    entry_date: date,
    meal_status: record.meal_status
  }));

  const { error } = await supabase
    .from("meal_entries")
    .upsert(recordsToUpsert, { onConflict: "student_id, entry_date" });

  if (error) {
    console.error("Error saving meal entries:", error);
    return { error: error.message };
  }

  revalidatePath("/dashboard/boarding/meals");
  return { success: true };
}

// ==========================================
// 2. BAZAR EXPENSES
// ==========================================

export async function getBazarExpenses(startDate?: string, endDate?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return [];

  let query = supabase
    .from("bazar_expenses")
    .select("*")
    .eq("madrasa_id", finalMadrasaId)
    .order("expense_date", { ascending: false });

  if (startDate) {
    query = query.gte("expense_date", startDate);
  }
  if (endDate) {
    query = query.lte("expense_date", endDate);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching bazar expenses:", error);
    return [];
  }
  return data;
}

export async function saveBazarExpense(expense: { id?: string; amount: number; expense_date: string; items_details: string }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return { error: "Madrasa not found" };

  const record: any = {
    madrasa_id: finalMadrasaId,
    amount: expense.amount,
    expense_date: expense.expense_date,
    items_details: expense.items_details
  };

  if (expense.id) {
    const { error } = await supabase
      .from("bazar_expenses")
      .update(record)
      .eq("id", expense.id)
      .eq("madrasa_id", finalMadrasaId);

    if (error) {
      console.error("Error updating bazar expense:", error);
      return { error: error.message };
    }
  } else {
    const { error } = await supabase
      .from("bazar_expenses")
      .insert([record]);

    if (error) {
      console.error("Error inserting bazar expense:", error);
      return { error: error.message };
    }
  }

  revalidatePath("/dashboard/boarding/bazar");
  return { success: true };
}

export async function deleteBazarExpense(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return { error: "Madrasa not found" };

  const { error } = await supabase
    .from("bazar_expenses")
    .delete()
    .eq("id", id)
    .eq("madrasa_id", finalMadrasaId);

  if (error) {
    console.error("Error deleting bazar expense:", error);
    return { error: error.message };
  }

  revalidatePath("/dashboard/boarding/bazar");
  return { success: true };
}

// ==========================================
// 3. MONTHLY MEAL REPORTS & BILLING
// ==========================================

export async function getMonthlyBoardingReport(year: string, month: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return null;

  // Format month and build date range boundaries
  // E.g., year = "2026", month = "07" (July)
  const formattedMonth = month.padStart(2, "0");
  const startDate = `${year}-${formattedMonth}-01`;
  const endDate = `${year}-${formattedMonth}-31`; // SQL/Supabase gte/lte handles date matching nicely or we can compute accurately

  // 1. Fetch Bazar expenses in this month
  const { data: bazarData, error: bazarError } = await supabase
    .from("bazar_expenses")
    .select("amount")
    .eq("madrasa_id", finalMadrasaId)
    .gte("expense_date", startDate)
    .lte("expense_date", endDate);

  if (bazarError) {
    console.error("Error fetching bazar for report:", bazarError);
  }

  const totalBazarCost = (bazarData || []).reduce((acc, curr) => acc + Number(curr.amount), 0);

  // 2. Fetch all students to match meal entries
  const { data: students, error: studentsError } = await supabase
    .from("students")
    .select("id, first_name, last_name, roll_number, class_name")
    .eq("madrasa_id", finalMadrasaId)
    .order("class_name")
    .order("roll_number");

  if (studentsError) {
    console.error("Error fetching students for report:", studentsError);
    return null;
  }

  // 3. Fetch all active ("On") meal entries in this month
  const { data: mealsData, error: mealsError } = await supabase
    .from("meal_entries")
    .select("student_id, meal_status")
    .eq("madrasa_id", finalMadrasaId)
    .eq("meal_status", "On")
    .gte("entry_date", startDate)
    .lte("entry_date", endDate);

  if (mealsError) {
    console.error("Error fetching meals for report:", mealsError);
  }

  // 4. Calculate total active meals across all students
  const totalMealsCount = mealsData?.length || 0;

  // 5. Calculate meal rate
  const mealRate = totalMealsCount > 0 ? (totalBazarCost / totalMealsCount) : 0;

  // 6. Calculate meal count per student
  const studentMealsMap = new Map<string, number>();
  (mealsData || []).forEach(entry => {
    const current = studentMealsMap.get(entry.student_id) || 0;
    studentMealsMap.set(entry.student_id, current + 1);
  });

  // 7. Map students to their meals and bills
  const studentsReport = students.map(student => {
    const studentMealsCount = studentMealsMap.get(student.id) || 0;
    const studentBill = studentMealsCount * mealRate;
    return {
      id: student.id,
      first_name: student.first_name,
      last_name: student.last_name,
      roll_number: student.roll_number,
      class_name: student.class_name,
      meals_count: studentMealsCount,
      bill_amount: Math.round(studentBill * 100) / 100 // round to 2 decimal places
    };
  });

  return {
    totalBazarCost,
    totalMealsCount,
    mealRate: Math.round(mealRate * 100) / 100, // round to 2 decimal places
    studentsReport
  };
}
