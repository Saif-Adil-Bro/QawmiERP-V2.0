"use server";

import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getAuthMadrasaId } from "./students";

// ==========================================
// 1. MEAL ENTRIES
// ==========================================

export async function getStudentsForMeals(
  date: string,
  classId?: string,
  boardingFilter: "ALL" | "BOARDING" | "NON_BOARDING" = "ALL"
) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
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

  // 2. Fetch madrasa metadata for student residential/boarding status
  let meta: any = {};
  try {
    const { getMadrasaMetadata } = await import("@/lib/sessions");
    meta = await getMadrasaMetadata(finalMadrasaId);
  } catch (mErr) {
    console.warn("Could not load metadata in getStudentsForMeals:", mErr);
  }

  // 3. Fetch meal entries for this date
  const { data: mealEntries, error: mealError } = await supabase
    .from("meal_entries")
    .select("student_id, meal_status")
    .eq("madrasa_id", finalMadrasaId)
    .eq("entry_date", date);

  if (mealError) {
    console.error("Error fetching meal entries:", mealError);
  }

  const mealMap = new Map((mealEntries || []).map(m => [m.student_id, m.meal_status]));

  // 4. Map student meal status and residential profile
  const mapped = (students || []).map(student => {
    const profile = meta?.student_profiles?.[student.id] || {};
    const admission = (meta?.admissions || []).find((a: any) => a.confirmed_student_id === student.id);
    const residentialStatus = profile.residential_status !== undefined
      ? profile.residential_status
      : (admission?.residential_status || "অনাবাসিক");
    const isBoarding = profile.is_boarding !== undefined
      ? Boolean(profile.is_boarding)
      : (residentialStatus === "আবাসিক");

    // Existing entry has highest priority; otherwise, only students with active boarding default to "On", non-boarding default to "Off"
    let meal_status: "On" | "Off" = "Off";
    if (mealMap.has(student.id)) {
      meal_status = mealMap.get(student.id) as "On" | "Off";
    } else {
      meal_status = isBoarding ? "On" : "Off";
    }

    return {
      id: student.id,
      first_name: student.first_name,
      last_name: student.last_name,
      roll_number: student.roll_number,
      class_name: student.class_name,
      residential_status: residentialStatus,
      is_boarding: isBoarding,
      boarding_type: profile.boarding_type !== undefined ? profile.boarding_type : (isBoarding ? "সাধারণ পেইং" : "অনাবাসিক"),
      meal_status,
    };
  });

  if (boardingFilter === "BOARDING") {
    return mapped.filter(s => s.is_boarding);
  } else if (boardingFilter === "NON_BOARDING") {
    return mapped.filter(s => !s.is_boarding);
  }

  return mapped;
}

export async function saveMealEntries(date: string, mealData: { student_id: string; meal_status: "On" | "Off" }[]) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
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
// 2. BAZAR EXPENSES & VOUCHER SYSTEM
// ==========================================

export interface BazarExpenseItem {
  id: string;
  madrasa_id?: string;
  amount: number | string;
  expense_date: string;
  items_details: string;
  voucher_no: string;
  buyer_name?: string;
  payment_method?: string;
  fund_id?: string;
  fund_name?: string;
  created_at?: string;
}

// Parse metadata tag from items_details if stored there
function parseExpenseMetadata(rawDetails: string | null | undefined, fallbackId: string, expenseDate: string, index: number): {
  cleanDetails: string;
  voucherNo: string;
  buyerName: string;
  paymentMethod: string;
  fundId: string;
  fundName: string;
} {
  let cleanDetails = (rawDetails || "").trim();
  let voucherNo = "";
  let buyerName = "";
  let paymentMethod = "Cash";
  let fundId = "fund-lillah";
  let fundName = "লিল্লাহ বোর্ডিং ফান্ড";

  // Check [VOUCHER: ... | BUYER: ... | METHOD: ... | FUND: ... | FUND_NAME: ...]
  if (cleanDetails.includes("[VOUCHER:")) {
    const matchVoucher = cleanDetails.match(/\[VOUCHER:\s*([^\]|]+)/i);
    if (matchVoucher && matchVoucher[1]) {
      voucherNo = matchVoucher[1].trim();
    }
    const matchBuyer = cleanDetails.match(/BUYER:\s*([^\]|]+)/i);
    if (matchBuyer && matchBuyer[1]) {
      buyerName = matchBuyer[1].trim();
    }
    const matchMethod = cleanDetails.match(/METHOD:\s*([^\]|]+)/i);
    if (matchMethod && matchMethod[1]) {
      paymentMethod = matchMethod[1].trim();
    }
    const matchFund = cleanDetails.match(/FUND:\s*([^\]|]+)/i);
    if (matchFund && matchFund[1]) {
      fundId = matchFund[1].trim();
    }
    const matchFundName = cleanDetails.match(/FUND_NAME:\s*([^\]|]+)/i);
    if (matchFundName && matchFundName[1]) {
      fundName = matchFundName[1].trim();
    }
    // Remove the metadata tag from display details
    cleanDetails = cleanDetails.replace(/\[VOUCHER:[^\]]+\]\s*/i, "").trim();
  }

  // Fallback auto-generated voucher number if none found
  if (!voucherNo) {
    const d = expenseDate ? new Date(expenseDate) : new Date();
    const yy = String(d.getFullYear()).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const suffix = fallbackId ? fallbackId.replace(/-/g, "").substring(0, 4).toUpperCase() : String(index + 1).padStart(3, "0");
    voucherNo = `BV-${yy}${mm}${suffix}`;
  }

  return {
    cleanDetails,
    voucherNo,
    buyerName,
    paymentMethod,
    fundId,
    fundName,
  };
}

export async function getNextBazarVoucherNo(): Promise<string> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return `BV-${new Date().toISOString().slice(2, 7).replace("-", "")}001`;

    const finalMadrasaId = await getAuthMadrasaId(supabase, user);
    if (!finalMadrasaId) return `BV-${new Date().toISOString().slice(2, 7).replace("-", "")}001`;

    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const currentPrefix = `BV-${yy}${mm}`;

    // Get count of expenses in current month
    const startOfMonth = `${now.getFullYear()}-${mm}-01`;
    const { count } = await supabase
      .from("bazar_expenses")
      .select("id", { count: "exact", head: true })
      .eq("madrasa_id", finalMadrasaId)
      .gte("expense_date", startOfMonth);

    const nextSeq = String((count || 0) + 1).padStart(3, "0");
    return `${currentPrefix}${nextSeq}`;
  } catch (e) {
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    return `BV-${yy}${mm}001`;
  }
}

export async function getBazarExpenses(startDate?: string, endDate?: string): Promise<BazarExpenseItem[]> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
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

  return (data || []).map((row: any, index: number) => {
    const meta = parseExpenseMetadata(row.items_details, row.id, row.expense_date, index);
    return {
      id: row.id,
      madrasa_id: row.madrasa_id,
      amount: row.amount,
      expense_date: row.expense_date,
      items_details: meta.cleanDetails,
      voucher_no: row.voucher_no || meta.voucherNo,
      buyer_name: row.buyer_name || meta.buyerName,
      payment_method: row.payment_method || meta.paymentMethod,
      fund_id: row.fund_id || meta.fundId,
      fund_name: row.fund_name || meta.fundName,
      created_at: row.created_at,
    };
  });
}

export async function saveBazarExpense(expense: {
  id?: string;
  amount: number;
  expense_date: string;
  items_details: string;
  voucher_no?: string;
  buyer_name?: string;
  payment_method?: string;
  fund_id?: string;
  fund_name?: string;
}) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return { error: "Unauthorized" };

  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return { error: "Madrasa not found" };

  // Determine or generate voucher number
  let voucherNo = (expense.voucher_no || "").trim();
  if (!voucherNo) {
    const d = expense.expense_date ? new Date(expense.expense_date) : new Date();
    const yy = String(d.getFullYear()).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const rand = Math.floor(100 + Math.random() * 900);
    voucherNo = `BV-${yy}${mm}${rand}`;
  }

  const buyerName = (expense.buyer_name || "").trim();
  const paymentMethod = (expense.payment_method || "Cash").trim();
  const cleanItems = (expense.items_details || "").trim();
  const fundId = (expense.fund_id || "fund-lillah").trim();
  const fundName = (expense.fund_name || "লিল্লাহ বোর্ডিং ফান্ড").trim();

  // Construct metadata wrapper for items_details (ensures 100% data persistence without schema changes)
  const wrappedDetails = `[VOUCHER: ${voucherNo} | BUYER: ${buyerName} | METHOD: ${paymentMethod} | FUND: ${fundId} | FUND_NAME: ${fundName}]\n${cleanItems}`.trim();

  const recordWithDirectCols: any = {
    madrasa_id: finalMadrasaId,
    amount: expense.amount,
    expense_date: expense.expense_date,
    items_details: wrappedDetails,
    voucher_no: voucherNo,
    buyer_name: buyerName,
    payment_method: paymentMethod,
    fund_id: fundId,
    fund_name: fundName,
  };

  const fallbackRecord: any = {
    madrasa_id: finalMadrasaId,
    amount: expense.amount,
    expense_date: expense.expense_date,
    items_details: wrappedDetails,
  };

  let savedRow: any = null;

  if (expense.id) {
    // Try updating with direct columns
    const { data: updatedData, error: updateError } = await supabase
      .from("bazar_expenses")
      .update(recordWithDirectCols)
      .eq("id", expense.id)
      .eq("madrasa_id", finalMadrasaId)
      .select()
      .single();

    if (updateError) {
      // Retry with plain schema
      const { data: retryData, error: retryError } = await supabase
        .from("bazar_expenses")
        .update(fallbackRecord)
        .eq("id", expense.id)
        .eq("madrasa_id", finalMadrasaId)
        .select()
        .single();

      if (retryError) {
        console.error("Error updating bazar expense:", retryError);
        return { error: retryError.message };
      }
      savedRow = retryData;
    } else {
      savedRow = updatedData;
    }
  } else {
    // Try inserting with direct columns
    const { data: insertedData, error: insertError } = await supabase
      .from("bazar_expenses")
      .insert([recordWithDirectCols])
      .select()
      .single();

    if (insertError) {
      // Retry with plain schema
      const { data: retryData, error: retryError } = await supabase
        .from("bazar_expenses")
        .insert([fallbackRecord])
        .select()
        .single();

      if (retryError) {
        console.error("Error inserting bazar expense:", retryError);
        return { error: retryError.message };
      }
      savedRow = retryData;
    } else {
      savedRow = insertedData;
    }
  }

  revalidatePath("/dashboard/boarding/bazar");
  revalidatePath("/dashboard/boarding");
  revalidatePath("/dashboard/accounting");
  revalidatePath("/dashboard/accounting/reports");

  return {
    success: true,
    expense: {
      id: savedRow?.id || expense.id || "",
      amount: expense.amount,
      expense_date: expense.expense_date,
      items_details: cleanItems,
      voucher_no: voucherNo,
      buyer_name: buyerName,
      payment_method: paymentMethod,
      fund_id: fundId,
      fund_name: fundName,
    } as BazarExpenseItem,
  };
}

export async function deleteBazarExpense(id: string) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
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
  revalidatePath("/dashboard/boarding");
  return { success: true };
}

export async function getBoardingMadrasaInfo() {
  const { getMadrasaInfo } = await import("@/lib/getMadrasaInfo");
  return await getMadrasaInfo();
}

// ==========================================
// 3. MONTHLY MEAL REPORTS & BILLING
// ==========================================

export async function getMonthlyBoardingReport(year: string, month: string) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return null;

  const adminClient = await createAdminClient();
  const clientToUse = user ? supabase : adminClient;

  // Format month and build date range boundaries
  // E.g., year = "2026", month = "08" (August)
  const numYear = parseInt(year, 10) || new Date().getFullYear();
  const numMonth = parseInt(month, 10) || (new Date().getMonth() + 1);
  const formattedMonth = String(numMonth).padStart(2, "0");
  const startDate = `${numYear}-${formattedMonth}-01`;

  let nextYear = numYear;
  let nextMonth = numMonth + 1;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear++;
  }
  const nextMonthStr = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;

  // 1. Fetch Bazar expenses in this month (with adminClient fallback)
  let { data: bazarData, error: bazarError } = await clientToUse
    .from("bazar_expenses")
    .select("amount, expense_date")
    .eq("madrasa_id", finalMadrasaId)
    .gte("expense_date", startDate)
    .lt("expense_date", nextMonthStr);

  if (bazarError) {
    console.warn("Retrying bazar query with adminClient:", bazarError.message);
    const res = await adminClient
      .from("bazar_expenses")
      .select("amount, expense_date")
      .eq("madrasa_id", finalMadrasaId)
      .gte("expense_date", startDate)
      .lt("expense_date", nextMonthStr);
    bazarData = res.data;
  }

  const totalBazarCost = (bazarData || []).reduce((acc: number, curr: any) => acc + Number(curr.amount || 0), 0);

  // 2. Fetch all students with class joins (with adminClient fallback)
  let { data: students, error: studentsError } = await clientToUse
    .from("students")
    .select("id, first_name, last_name, roll_number, class_name, classes(id, name)")
    .eq("madrasa_id", finalMadrasaId)
    .order("roll_number");

  if (studentsError || !students) {
    console.warn("Retrying students query with adminClient:", studentsError?.message);
    const res = await adminClient
      .from("students")
      .select("id, first_name, last_name, roll_number, class_name, classes(id, name)")
      .eq("madrasa_id", finalMadrasaId)
      .order("roll_number");
    students = res.data || [];
  }

  // 3. Fetch all active ("On") meal entries in this month
  let { data: mealsData, error: mealsError } = await clientToUse
    .from("meal_entries")
    .select("student_id, meal_status, entry_date")
    .eq("madrasa_id", finalMadrasaId)
    .eq("meal_status", "On")
    .gte("entry_date", startDate)
    .lt("entry_date", nextMonthStr);

  if (mealsError) {
    console.warn("Retrying meals query with adminClient:", mealsError.message);
    const res = await adminClient
      .from("meal_entries")
      .select("student_id, meal_status, entry_date")
      .eq("madrasa_id", finalMadrasaId)
      .eq("meal_status", "On")
      .gte("entry_date", startDate)
      .lt("entry_date", nextMonthStr);
    mealsData = res.data;
  }

  // 4. Fetch metadata for extended student residential and boarding profiles
  let meta: any = {};
  try {
    const { getMadrasaMetadata } = await import("@/lib/sessions");
    meta = await getMadrasaMetadata(finalMadrasaId);
  } catch (mErr) {
    console.warn("Could not load metadata in getMonthlyBoardingReport:", mErr);
  }

  // 5. Calculate total active meals across all students
  const totalMealsCount = mealsData?.length || 0;

  // 6. Calculate meal rate
  const mealRate = totalMealsCount > 0 ? (totalBazarCost / totalMealsCount) : 0;

  // 7. Calculate meal count per student
  const studentMealsMap = new Map<string, number>();
  (mealsData || []).forEach((entry: any) => {
    const current = studentMealsMap.get(entry.student_id) || 0;
    studentMealsMap.set(entry.student_id, current + 1);
  });

  // 8. Enumerate months with recorded activity in DB
  let monthsWithData: { year: string; month: string; label: string }[] = [];
  try {
    const { data: allMeals } = await adminClient
      .from("meal_entries")
      .select("entry_date")
      .eq("madrasa_id", finalMadrasaId)
      .order("entry_date", { ascending: false });

    const monthSet = new Set<string>();
    (allMeals || []).forEach((m: any) => {
      if (m.entry_date) {
        monthSet.add(m.entry_date.substring(0, 7)); // YYYY-MM
      }
    });

    const { data: allBazar } = await adminClient
      .from("bazar_expenses")
      .select("expense_date")
      .eq("madrasa_id", finalMadrasaId);

    (allBazar || []).forEach((b: any) => {
      if (b.expense_date) {
        monthSet.add(b.expense_date.substring(0, 7));
      }
    });

    const bengaliMonths: Record<string, string> = {
      "01": "জানুয়ারি", "02": "ফেব্রুয়ারি", "03": "মার্চ", "04": "এপ্রিল",
      "05": "মে", "06": "জুন", "07": "জুলাই", "08": "আগস্ট",
      "09": "সেপ্টেম্বর", "10": "অক্টোবর", "11": "নভেম্বর", "12": "ডিসেম্বর"
    };

    monthsWithData = Array.from(monthSet).sort().reverse().map((ym) => {
      const [y, m] = ym.split("-");
      return {
        year: y,
        month: m,
        label: `${bengaliMonths[m] || m} ${y}`,
      };
    });
  } catch (mListErr) {
    console.warn("Could not load monthsWithData:", mListErr);
  }

  // 9. Map students to their meals, profiles and dynamic bills
  let totalPayingBill = 0;
  let totalLillahSponsored = 0;
  let activeBoardingStudentsCount = 0;

  const studentsReport = (students || []).map((student: any) => {
    const studentMealsCount = studentMealsMap.get(student.id) || 0;
    const grossCost = studentMealsCount * mealRate;

    const profile = meta?.student_profiles?.[student.id] || {};
    const admission = (meta?.admissions || []).find((a: any) => a.confirmed_student_id === student.id);
    const residentialStatus = profile.residential_status !== undefined
      ? profile.residential_status
      : (admission?.residential_status || "অনাবাসিক");
    const isBoarding = profile.is_boarding !== undefined
      ? Boolean(profile.is_boarding)
      : (residentialStatus === "আবাসিক");
    const boardingType = profile.boarding_type !== undefined
      ? profile.boarding_type
      : (isBoarding ? "সাধারণ পেইং" : "অনাবাসিক");

    if (isBoarding) {
      activeBoardingStudentsCount++;
    }

    let discount = 0;
    if (boardingType === "লিল্লাহ বোর্ডিং (ফ্রি)") {
      discount = grossCost; // 100% Free / Sponsored
      totalLillahSponsored += grossCost;
    } else if (boardingType === "হাফ-ফ্রি") {
      discount = grossCost * 0.5; // 50% discount
      totalLillahSponsored += discount;
      totalPayingBill += (grossCost - discount);
    } else if (isBoarding || grossCost > 0) {
      totalPayingBill += grossCost;
    }

    const netPayable = Math.max(0, grossCost - discount);
    const className = Array.isArray(student.classes)
      ? (student.classes[0] as any)?.name
      : (student.classes as any)?.name || student.class_name || "—";

    return {
      id: student.id,
      first_name: student.first_name,
      last_name: student.last_name,
      student_name: `${student.first_name || ""} ${student.last_name || ""}`.trim(),
      roll_number: student.roll_number || "-",
      class_name: className,
      residential_status: residentialStatus,
      is_boarding: isBoarding,
      boarding_type: boardingType,
      room_no: profile.room_no || "",
      meals_count: studentMealsCount,
      gross_amount: Math.round(grossCost * 100) / 100,
      discount_amount: Math.round(discount * 100) / 100,
      bill_amount: Math.round(netPayable * 100) / 100, // round to 2 decimal places
    };
  });

  return {
    year,
    month,
    totalBazarCost,
    totalMealsCount,
    mealRate: Math.round(mealRate * 100) / 100, // round to 2 decimal places
    totalPayingBill: Math.round(totalPayingBill * 100) / 100,
    totalLillahSponsored: Math.round(totalLillahSponsored * 100) / 100,
    activeBoardingStudentsCount,
    monthsWithData,
    studentsReport,
  };
}
