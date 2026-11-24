"use server";
import { boardingCharge, boardingGross } from '@/lib/finance/boarding-charges';
import {billPeriodKey} from '@/lib/finance/bill-period';
import {billingSession} from '@/lib/finance/billing-session';
import {rows} from '@/lib/portal/queries';
import {nextVoucherNumber} from "@/lib/finance/voucher-numbers";
import {bdtPoisha} from "@/lib/payment-gateway-engine";
import {changeVoucherStatus} from "@/lib/finance/voucher-status";
import {financeRows} from "@/lib/finance/funds";
import {bazarFund,isVoidedExpense,REVIEW_FUND} from "@/lib/fund-utils";
import { fundCatalog, postingFund } from "@/lib/finance/funds";

import { toDhakaDateString,toDhakaDateStringFrom, getDhakaYear, toDhakaMonthString } from "@/lib/date-utils";
import { writeGuard } from "@/lib/action-authorization";
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

  const rollSort = (a: any, b: any) => (parseInt(a.roll_number) || 999999) - (parseInt(b.roll_number) || 999999);

  if (boardingFilter === "BOARDING") {
    return mapped.filter(s => s.is_boarding).sort(rollSort);
  } else if (boardingFilter === "NON_BOARDING") {
    return mapped.filter(s => !s.is_boarding).sort(rollSort);
  }

  return mapped.sort(rollSort);
}

export async function saveMealEntries(date: string, mealData: { student_id: string; meal_status: "On" | "Off" }[]) {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("boarding");
    if (!__authz.allowed) return __authz.fallback;
  }

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
  if (!voucherNo) voucherNo = fallbackId || '—';

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
  const tenant=await getAuthMadrasaId();
  return nextVoucherNumber(tenant,toDhakaDateString(),'bazar');
}

export async function getBazarExpenses(startDate?: string, endDate?: string): Promise<BazarExpenseItem[]> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return [];

  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return [];

  const access=await writeGuard('financeRead');if(!access.allowed)throw Error('বোর্ডিং খাতা দেখার অনুমতি নেই।');
  const [data,funds]=await Promise.all([financeRows(await createAdminClient(),finalMadrasaId,'bazar_expenses','*',endDate,startDate),fundCatalog(finalMadrasaId,true)]);
  return data.filter(row=>!isVoidedExpense(row)).sort((a,b)=>b.expense_date.localeCompare(a.expense_date)).map((row,index)=>{
    const fund = bazarFund(funds,row) || REVIEW_FUND;
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
      fund_id: fund.id,
      fund_name: fund.name,
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
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("finance");
    if (!__authz.allowed) return __authz.fallback;
  }

  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return { error: "Unauthorized" };

  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return { error: "Madrasa not found" };

  if(!bdtPoisha(expense.amount)) return {error:"বাজারের অঙ্ক পয়সা পর্যন্ত দিন।"};
  // Determine or generate voucher number
  let voucherNo = (expense.voucher_no || "").trim();
  if (!voucherNo) {
    voucherNo=await nextVoucherNumber(finalMadrasaId,expense.expense_date,'bazar');
  }

  const buyerName = (expense.buyer_name || "").trim();
  const paymentMethod = (expense.payment_method || "Unknown").trim();
  const cleanItems = (expense.items_details || "").trim();
  let fund;
  try { fund = await postingFund(finalMadrasaId,expense.fund_id,"bazar","","",expense.fund_name); }
  catch (err: any) { return {error:err.message}; }
  const fundId = fund.id, fundName = fund.name;

  // Construct metadata wrapper for items_details (ensures 100% data persistence without schema changes)
  const wrappedDetails = `[VOUCHER: ${voucherNo} | BUYER: ${buyerName} | METHOD: ${paymentMethod} | FUND: ${fundId} | FUND_NAME: ${fundName}]\n${cleanItems}`.trim();

  const recordWithDirectCols: any = {
    ...(!expense.id ? {operator_id:user.id} : {}),
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

  const table = (await createAdminClient()).from("bazar_expenses");
  const write = expense.id ? table.update(recordWithDirectCols).eq("id",expense.id).eq("madrasa_id",finalMadrasaId) : table.insert(recordWithDirectCols);
  const {data:savedRow,error} = await write.select().single();
  if (error) return {error:error.message};

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

export async function deleteBazarExpense(id: string,reason:string) {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("finance");
    if (!__authz.allowed) return __authz.fallback;
  }

  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return { error: "Unauthorized" };

  const finalMadrasaId = await getAuthMadrasaId(supabase, user);
  if (!finalMadrasaId) return { error: "Madrasa not found" };

  try {
    if (!await changeVoucherStatus(finalMadrasaId,user.id,`bazar_${id}`,false,reason,true)) return {error:"ভাউচার পাওয়া যায়নি।"};
  } catch(e:any) {return {error:e.message};}
  revalidatePath("/dashboard/boarding/bazar");
  revalidatePath("/dashboard/boarding");
  return { success: true };
}

export async function getBoardingMadrasaInfo() {
  const { getMadrasaInfo,toPublicMadrasaInfo } = await import("@/lib/getMadrasaInfo");
  return toPublicMadrasaInfo(await getMadrasaInfo());
}

// ==========================================
// 3. MONTHLY MEAL REPORTS & BILLING
// ==========================================

export async function getMonthlyBoardingReport(year: string, month: string) {
  const access=await writeGuard("financeRead");if(!access.allowed || !access.madrasaId)throw Error("বোর্ডিং রিপোর্ট দেখার অনুমতি নেই।");
  const finalMadrasaId=access.madrasaId, adminClient=await createAdminClient();
  if(!/^\d{4}$/.test(year) || !/^(?:0?[1-9]|1[0-2])$/.test(month)) throw Error('বিলের বছর ও মাস যাচাই করুন।');
  const numYear=Number(year),numMonth=Number(month);
  const formattedMonth = String(numMonth).padStart(2, "0");
  const startDate = `${numYear}-${formattedMonth}-01`;

  let nextYear = numYear;
  let nextMonth = numMonth + 1;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear++;
  }
  const nextMonthStr = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;

  const endDate=`${numYear}-${formattedMonth}-${new Date(Date.UTC(numYear,numMonth,0)).getUTCDate()}`;
  const bazarData=await financeRows(adminClient,finalMadrasaId,'bazar_expenses','*',endDate,startDate);
  const costPoisha=bazarData.filter(b=>!isVoidedExpense(b)).reduce((sum,b)=>sum+Math.round(Number(b.amount)*100),0), totalBazarCost=costPoisha/100;

  const {getMadrasaMetadata}=await import('@/lib/sessions');
  const [students,mealsData,meta]=await Promise.all([
    rows(()=>adminClient.from('students').select('id,first_name,last_name,roll_number,class_name,classes(id,name)').eq('madrasa_id',finalMadrasaId)),
    rows(()=>adminClient.from('meal_entries').select('id,student_id,entry_date,meal_status').eq('madrasa_id',finalMadrasaId).eq('meal_status','On').gte('entry_date',startDate).lt('entry_date',nextMonthStr)),
    getMadrasaMetadata(finalMadrasaId,true),
  ]);

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
  const {data:monthKeys,error:monthError}=await adminClient.rpc('finance_boarding_months',{t:finalMadrasaId});
  if(monthError || !Array.isArray(monthKeys)) throw Error('বোর্ডিং খাতার মাসগুলো পড়া যায়নি।');
    const bengaliMonths: Record<string, string> = {
      "01": "জানুয়ারি", "02": "ফেব্রুয়ারি", "03": "মার্চ", "04": "এপ্রিল",
      "05": "মে", "06": "জুন", "07": "জুলাই", "08": "আগস্ট",
      "09": "সেপ্টেম্বর", "10": "অক্টোবর", "11": "নভেম্বর", "12": "ডিসেম্বর"
    };

  const monthsWithData = (monthKeys as string[]).map((ym) => {
      const [y, m] = ym.split("-");
      return {
        year: y,
        month: m,
        label: `${bengaliMonths[m] || m} ${y}`,
      };
    });
  const enrolled=new Set(students.map(s=>s.id));
  if([...studentMealsMap.keys()].some(id=>!enrolled.has(id))) throw Error('মিল হাজিরার ছাত্র এই প্রতিষ্ঠানের তালিকায় নেই।');
  const gross=boardingGross(costPoisha,studentMealsMap);
  let totalPayingBill = 0;
  let totalLillahSponsored = 0;
  let activeBoardingStudentsCount = 0;

  const studentsReport = (students || []).map((student: any) => {
    const studentMealsCount = studentMealsMap.get(student.id) || 0;


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

    const charge=boardingCharge(gross.get(student.id) ?? 0,boardingType);
    totalPayingBill+=Math.round(charge.bill_amount*100);
    totalLillahSponsored+=Math.round(charge.discount_amount*100);
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
      ...charge,
    };
  });

  const rollSort = (a: any, b: any) => (parseInt(a.roll_number) || 999999) - (parseInt(b.roll_number) || 999999);
  studentsReport.sort(rollSort);

  return {
    year,
    month,
    totalBazarCost,
    totalMealsCount,
    mealRate: Math.round(mealRate * 100) / 100, // round to 2 decimal places
    totalPayingBill: totalPayingBill / 100,
    totalLillahSponsored: totalLillahSponsored / 100,
    activeBoardingStudentsCount,
    monthsWithData,
    studentsReport,
  };
}

/**
 * Synchronize monthly boarding bills to Accounting student_fees table
 */
export async function syncBoardingBillsToAccounting(year: string, month: string, sessionId: string = "default") {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("finance");
    if (!__authz.allowed) return __authz.fallback;
  }

  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অননুমোদিত অ্যাক্সেস" };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "মাদরাসা আইডি পাওয়া যায়নি" };

    sessionId=await billingSession(await createAdminClient(),madrasaId,sessionId==='default'?undefined:sessionId);
    const report = await getMonthlyBoardingReport(year, month);
    if (!report || !report.studentsReport || report.studentsReport.length === 0) {
      return { error: "এই মাসের জন্য কোনো বোর্ডিং রিপোর্ট পাওয়া যায়নি।" };
    }

    const { getFeeMetadata, saveBillChanges } = await import("@/lib/fee-store");
    const meta = await getFeeMetadata(madrasaId);

    const feeTypes = meta.fee_types || [];
    const khorakiTypes=feeTypes.filter(f=>f.is_active!==false && (f.category==='BOARDING' || ['HOSTEL','FOOD'].includes(f.code) || /খোরাকি|বোর্ডিং/.test(f.name)));
    if(khorakiTypes.length!==1) return {error:'সুনির্দিষ্ট একটি সক্রিয় বোর্ডিং ফি খাত নির্ধারণ করুন।'};
    const [khorakiFeeType]=khorakiTypes;
    const {id:khorakiFeeTypeId,name:khorakiFeeTypeName}=khorakiFeeType;
    const billFund=await postingFund(madrasaId,khorakiFeeType.fund_id,'deposit','','',khorakiFeeType.fund_name);

    const monthPadded = month.padStart(2, "0");
    const billingPeriod = `${year}-${monthPadded}`;
    const bengaliMonths: Record<string, string> = {
      "01": "জানুয়ারি", "02": "ফেব্রুয়ারি", "03": "মার্চ", "04": "এপ্রিল",
      "05": "মে", "06": "জুন", "07": "জুলাই", "08": "আগস্ট",
      "09": "সেপ্টেম্বর", "10": "অক্টোবর", "11": "নভেম্বর", "12": "ডিসেম্বর"
    };
    const monthName = `${bengaliMonths[monthPadded] || monthPadded} ${year}`;
    const dueDate = `${year}-${monthPadded}-10`;

    const currentFees = [...(meta.student_fees || [])];
    let syncedCount = 0;
    const now = new Date().toISOString();

    if (report.totalBazarCost>0 && !report.totalMealsCount) return {error:'বাজার খরচ আছে, মিল হাজিরা নেই। বিল বদলানো হয়নি।'};
    const concession='বোর্ডিং প্রোফাইল অনুযায়ী ছাড়';
    for (const student of report.studentsReport) {
      const matches=currentFees.filter(f=>f.student_id===student.id && billPeriodKey(f.billing_period)===billingPeriod && f.session_id===sessionId && f.fee_type_id===khorakiFeeTypeId);
      const [old]=matches;
      if(!old && !student.gross_amount) continue;
      if(old && (!old.id.startsWith('fee_bdr_') || matches.length!==1 || (old.discount_amount>0 && old.discount_reason!==concession))) {
        return {error:'এই মাসে পৃথক বিল বা ছাড় রয়েছে। বোর্ডিং দিয়ে তা প্রতিস্থাপন না করে মূল বিল যাচাই করুন।'};
      }
      const amounts={base_amount:student.gross_amount,discount_amount:student.discount_amount,discount_reason:student.discount_amount?concession:'',
        payable_amount:(Math.round(student.bill_amount*100)+Math.round(Number(old?.fine_amount||0)*100))/100};
      if (old) {
        if(Number(old.base_amount)===amounts.base_amount && Number(old.discount_amount)===amounts.discount_amount && Number(old.payable_amount)===amounts.payable_amount) continue;
        // The RPC also refuses allocations (even subsequently voided receipts).
        if(Number(old.paid_amount)>0) return {error:'আদায়যুক্ত বিল বদলানো যাবে না।'};
        currentFees[currentFees.indexOf(old)]={...old,...amounts,due_amount:amounts.payable_amount,status:amounts.payable_amount===0?'WAIVED':'UNPAID',updated_at:now};
      } else {
        const newFee: any = {
          id: `fee_bdr_${crypto.randomUUID()}`,
          madrasa_id: madrasaId,
          session_id: sessionId,
          student_id: student.id,
          student_name: student.student_name || `${student.first_name || ""} ${student.last_name || ""}`.trim(),
          student_roll: String(student.roll_number || ""),
          class_id: "ALL",
          class_name: student.class_name || "সাধারণ",
          fee_type_id: khorakiFeeTypeId,
          fee_type_name: khorakiFeeTypeName,
          fund_id:billFund.id,
          fund_name:billFund.name,
          billing_period: billingPeriod,
          month_name: monthName,
          year: year,
          due_date: dueDate,
          ...amounts,
          fine_amount: 0,
          paid_amount: 0,
          due_amount: amounts.payable_amount,
          status: amounts.payable_amount===0?"WAIVED":"UNPAID",
          created_at: now,
          updated_at: now,
        };

        currentFees.push(newFee);
      }
      syncedCount++;
    }

    const saved = await saveBillChanges(madrasaId,meta.student_fees || [],currentFees);
    if (!saved) {
      return { error: "একাউন্টিং লেজারে বোর্ডিং বিল যুক্ত করা সম্ভব হয়নি। অনুগ্রহ করে আবার চেষ্টা করুন।" };
    }

    revalidatePath("/dashboard/accounting");
    revalidatePath("/dashboard/accounting/due");
    revalidatePath("/dashboard/boarding/reports");

    return {
      success: true,
      count: syncedCount,
      message: `আলহামদুলিল্লাহ! ${monthName} মাসের সর্বমোট ${syncedCount} জন আবাসিক ছাত্রের বোর্ডিং মিল ইনভয়েস একাউন্টিং লেজারে সিঙ্ক করা হয়েছে।`,
    };
  } catch (err: any) {
    console.error("Error in syncBoardingBillsToAccounting:", err);
    return { error: err?.message || "সিঙ্ক করতে ব্যর্থ হয়েছে" };
  }
}

/** Compatibility entry point. Bill generation belongs to billing, never to a side effect
 * of a cash receipt. One exact billing period and configured fund, or ask for an invoice. */
export async function addBoardingMealPayment(params:{student_id:string;student_name?:string;amount:number;payment_date:string;month_name?:string;billing_period?:string;notes?:string;payment_method?:string;idempotency_key?:string;fund_id?:string;fund_name?:string}) {
  const guard=await writeGuard('finance');if (!guard.allowed) return guard.fallback;
  if (!guard.madrasaId) return {error:'প্রতিষ্ঠান মেলেনি।'};
  const {getFeeMetadata}=await import('@/lib/fee-store');
  const {cashierPayment}=await import('@/lib/finance/cashier');
  const date=params.payment_date || toDhakaDateString(), period=params.billing_period || date.slice(0,7);
  const meta=await getFeeMetadata(guard.madrasaId);
  const types=new Set((meta.fee_types||[]).filter(t=>t.category==='BOARDING' || ['FOOD','HOSTEL'].includes(t.code)).map(t=>t.id));
  const candidates=(meta.student_fees||[]).filter(b=>b.student_id===params.student_id && b.billing_period===period && types.has(b.fee_type_id));
  if (candidates.length!==1) return {error:'আগে এই মাসের বোর্ডিং বিল সিঙ্ক করুন অথবা ফি আদায় ফর্ম থেকে নির্দিষ্ট বিল নির্বাচন করুন।'};
  const bill=candidates[0];
  return cashierPayment({student_id:params.student_id,total_amount:params.amount,session_id:bill.session_id,payment_date:date,payment_method:params.payment_method||'Unknown',notes:params.notes,idempotency_key:params.idempotency_key,
    fee_allocations:[{student_fee_id:bill.id,fee_type_id:bill.fee_type_id,fee_type_name:bill.fee_type_name,allocated_amount:params.amount,fund_id:params.fund_id||bill.fund_id,fund_name:params.fund_name||bill.fund_name}]});
}
