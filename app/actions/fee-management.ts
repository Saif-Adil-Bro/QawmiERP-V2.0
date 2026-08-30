"use server";

import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getAuthMadrasaId } from "./students";
import { getMadrasaMetadata, saveMadrasaMetadata, AcademicSession, StudentEnrollment } from "@/lib/sessions";
import {
  FeeType,
  FeeStructure,
  StudentFee,
  FeePayment,
  FeeDiscountWaiver,
  FeeAuditLog,
  DEFAULT_FEE_TYPES,
  MadrasaFeeData,
  PaymentAllocation,
} from "@/lib/fee-management";

/**
 * Helper to fetch fee metadata from madrasa record
 */
export async function getFeeMetadata(madrasaId: string): Promise<MadrasaFeeData> {
  const meta = await getMadrasaMetadata(madrasaId);
  return {
    fee_types: meta.fee_types || DEFAULT_FEE_TYPES,
    fee_structures: meta.fee_structures || [],
    student_fees: meta.student_fees || [],
    payments: meta.payments || [],
    discounts: meta.discounts || [],
    audit_logs: meta.audit_logs || [],
    receipt_counter: meta.receipt_counter || 100,
  };
}

/**
 * Helper to save fee metadata.
 * Returns true/false so callers can detect a silent DB write failure instead
 * of assuming success just because no exception was thrown (saveMadrasaMetadata
 * swallows its own errors and returns false rather than throwing).
 */
export async function saveFeeMetadata(madrasaId: string, feeData: Partial<MadrasaFeeData>): Promise<boolean> {
  const currentMeta = await getMadrasaMetadata(madrasaId);
  const updatedMeta = {
    ...currentMeta,
    ...feeData,
  };
  return await saveMadrasaMetadata(madrasaId, updatedMeta);
}

/**
 * 1. Get Fee Types
 */
export async function getFeeTypes(): Promise<FeeType[]> {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    let madrasaId = user ? await getAuthMadrasaId(supabase, user) : null;

    if (!madrasaId) {
      try {
        const adminClient = await createAdminClient();
        const { data: firstMadrasa } = await adminClient
          .from("madrasas")
          .select("id")
          .order("created_at", { ascending: true })
          .limit(1)
          .single();
        madrasaId = firstMadrasa?.id || null;
      } catch {}
    }

    if (!madrasaId) return DEFAULT_FEE_TYPES;

    const meta = await getFeeMetadata(madrasaId);
    return meta.fee_types && meta.fee_types.length > 0 ? meta.fee_types : DEFAULT_FEE_TYPES;
  } catch (err) {
    console.error("Error in getFeeTypes:", err);
    return DEFAULT_FEE_TYPES;
  }
}

/**
 * Save / Update Fee Type
 */
export async function saveFeeType(feeType: Partial<FeeType>) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    let madrasaId = user ? await getAuthMadrasaId(supabase, user) : null;

    if (!madrasaId) {
      try {
        const adminClient = await createAdminClient();
        const { data: firstMadrasa } = await adminClient
          .from("madrasas")
          .select("id")
          .order("created_at", { ascending: true })
          .limit(1)
          .single();
        madrasaId = firstMadrasa?.id || null;
      } catch {}
    }

    if (!madrasaId) return { error: "মাদরাসা পাওয়া যায়নি" };

    const meta = await getFeeMetadata(madrasaId);
    const feeTypes = [...(meta.fee_types || DEFAULT_FEE_TYPES)];

    if (feeType.id) {
      const idx = feeTypes.findIndex((f) => f.id === feeType.id);
      if (idx >= 0) {
        feeTypes[idx] = { ...feeTypes[idx], ...feeType } as FeeType;
      } else {
        feeTypes.push(feeType as FeeType);
      }
    } else {
      const newType: FeeType = {
        id: `ft_${Date.now()}`,
        name: feeType.name || "নতুন ফি",
        code: feeType.code || `FEE_${Date.now().toString().slice(-4)}`,
        category: feeType.category || "OTHER",
        frequency: feeType.frequency || "MONTHLY",
        default_amount: Number(feeType.default_amount) || 0,
        is_active: feeType.is_active ?? true,
      };
      feeTypes.push(newType);
    }

    const saved = await saveFeeMetadata(madrasaId, { fee_types: feeTypes });
    if (!saved) {
      return { error: "ফি টাইপ ডেটাবেজে সংরক্ষণ করা সম্ভব হয়নি। অনুগ্রহ করে আবার চেষ্টা করুন।" };
    }
    revalidatePath("/dashboard/accounting/structure");
    revalidatePath("/dashboard/accounting/generate");
    revalidatePath("/dashboard/accounting");

    return { success: true, message: "ফি টাইপ সফলভাবে সংরক্ষিত হয়েছে।" };
  } catch (err: any) {
    console.error("Error in saveFeeType:", err);
    return { error: err.message || "ফি টাইপ সংরক্ষণ ব্যর্থ হয়েছে।" };
  }
}

/**
 * Delete / Remove Fee Type
 */
export async function deleteFeeType(feeTypeId: string) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    let madrasaId = user ? await getAuthMadrasaId(supabase, user) : null;

    if (!madrasaId) {
      try {
        const adminClient = await createAdminClient();
        const { data: firstMadrasa } = await adminClient
          .from("madrasas")
          .select("id")
          .order("created_at", { ascending: true })
          .limit(1)
          .single();
        madrasaId = firstMadrasa?.id || null;
      } catch {}
    }

    if (!madrasaId) return { error: "মাদরাসা পাওয়া যায়নি" };

    const meta = await getFeeMetadata(madrasaId);
    const feeTypes = (meta.fee_types || DEFAULT_FEE_TYPES).filter((f) => f.id !== feeTypeId);

    const saved = await saveFeeMetadata(madrasaId, { fee_types: feeTypes });
    if (!saved) {
      return { error: "ফি টাইপ ডেটাবেজ থেকে মুছে ফেলা সম্ভব হয়নি। অনুগ্রহ করে আবার চেষ্টা করুন।" };
    }
    revalidatePath("/dashboard/accounting/structure");
    revalidatePath("/dashboard/accounting/generate");
    revalidatePath("/dashboard/accounting");

    return { success: true, message: "ফি টাইপ মুছে ফেলা হয়েছে।" };
  } catch (err: any) {
    console.error("Error in deleteFeeType:", err);
    return { error: err.message || "ফি টাইপ মুছে ফেলা ব্যর্থ হয়েছে।" };
  }
}

/**
 * 2. Get Fee Structures
 */
export async function getFeeStructures(sessionId?: string): Promise<FeeStructure[]> {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return [];

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return [];

    const meta = await getFeeMetadata(madrasaId);
    let structures = meta.fee_structures || [];

    if (sessionId && sessionId !== "ALL") {
      structures = structures.filter((s) => s.session_id === sessionId);
    }

    return structures;
  } catch (err) {
    console.error("Error in getFeeStructures:", err);
    return [];
  }
}

/**
 * Save / Update Fee Structure
 */
export async function saveFeeStructure(structure: Partial<FeeStructure>) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অননুমোদিত অ্যাক্সেস" };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "মাদরাসা পাওয়া যায়নি" };

    const meta = await getFeeMetadata(madrasaId);
    const structures = [...(meta.fee_structures || [])];

    let monthlyTotal = 0;
    let onetimeTotal = 0;
    (structure.items || []).forEach((item) => {
      if (item.frequency === "MONTHLY") monthlyTotal += Number(item.amount) || 0;
      else onetimeTotal += Number(item.amount) || 0;
    });

    if (structure.id) {
      const idx = structures.findIndex((s) => s.id === structure.id);
      if (idx >= 0) {
        structures[idx] = {
          ...structures[idx],
          ...structure,
          total_monthly_amount: monthlyTotal,
          total_onetime_amount: onetimeTotal,
          updated_at: new Date().toISOString(),
        } as FeeStructure;
      } else {
        structures.push(structure as FeeStructure);
      }
    } else {
      const newStruct: FeeStructure = {
        id: `struct_${Date.now()}`,
        madrasa_id: madrasaId,
        session_id: structure.session_id || "default",
        class_id: structure.class_id || "ALL",
        class_name: structure.class_name || "সকল জামাত",
        student_category: structure.student_category || "ALL",
        name: structure.name || "ফি কাঠামো",
        items: structure.items || [],
        total_monthly_amount: monthlyTotal,
        total_onetime_amount: onetimeTotal,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      structures.push(newStruct);
    }

    const saved = await saveFeeMetadata(madrasaId, { fee_structures: structures });
    if (!saved) {
      return { error: "ফি কাঠামো ডেটাবেজে সংরক্ষণ করা সম্ভব হয়নি। অনুগ্রহ করে আবার চেষ্টা করুন।" };
    }
    revalidatePath("/dashboard/accounting/structure");
    revalidatePath("/dashboard/accounting");

    return { success: true, message: "ফি কাঠামো সফলভাবে সংরক্ষিত হয়েছে!" };
  } catch (err: any) {
    console.error("Error in saveFeeStructure:", err);
    return { error: err.message || "ফি কাঠামো সংরক্ষণ ব্যর্থ হয়েছে" };
  }
}

/**
 * Delete Fee Structure
 */
export async function deleteFeeStructure(structureId: string) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অননুমোদিত অ্যাক্সেস" };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "মাদরাসা পাওয়া যায়নি" };

    const meta = await getFeeMetadata(madrasaId);
    const filtered = (meta.fee_structures || []).filter((s) => s.id !== structureId);

    const saved = await saveFeeMetadata(madrasaId, { fee_structures: filtered });
    if (!saved) {
      return { error: "ফি কাঠামো ডেটাবেজে মুছে ফেলা সম্ভব হয়নি। অনুগ্রহ করে আবার চেষ্টা করুন।" };
    }
    revalidatePath("/dashboard/accounting/structure");

    return { success: true, message: "ফি কাঠামো মুছে ফেলা হয়েছে।" };
  } catch (err: any) {
    console.error("Error in deleteFeeStructure:", err);
    return { error: err.message || "মুছে ফেলতে ব্যর্থ হয়েছে" };
  }
}

/**
 * 3. Generate Monthly Fees / Invoices for active students
 */
export async function generateMonthlyFees(params: {
  sessionId: string;
  billingPeriod: string;
  monthName?: string;
  year?: string;
  classId?: string;
  feeTypeIds?: string[];
  customAmounts?: Record<string, number>;
  forceUpdate?: boolean;
  dueDate?: string;
}) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    let madrasaId = user ? await getAuthMadrasaId(supabase, user) : null;

    const adminClient = await createAdminClient();

    if (!madrasaId) {
      try {
        const { data: firstMadrasa } = await adminClient
          .from("madrasas")
          .select("id")
          .order("created_at", { ascending: true })
          .limit(1)
          .single();
        madrasaId = firstMadrasa?.id || null;
      } catch {}
    }

    if (!madrasaId) return { error: "মাদরাসা তথ্য পাওয়া যায়নি।" };

    // Fetch students using adminClient with fallback
    let students: any[] = [];
    try {
      const { data: stdData, error: stdErr } = await adminClient
        .from("students")
        .select("id, first_name, last_name, roll_number, class_name, class_id")
        .eq("madrasa_id", madrasaId);

      if (!stdErr && stdData && stdData.length > 0) {
        students = stdData;
      }
    } catch {}

    if (students.length === 0) {
      try {
        const { data: allStd } = await adminClient
          .from("students")
          .select("id, first_name, last_name, roll_number, class_name, class_id");
        students = allStd || [];
      } catch {}
    }

    if (params.classId && params.classId !== "ALL") {
      students = students.filter(
        (s) => s.class_id === params.classId || s.class_name === params.classId
      );
    }

    if (students.length === 0) {
      return {
        error:
          "কোনো শিক্ষার্থী পাওয়া যায়নি। অনুগ্রহ করে 'ছাত্র ব্যবস্থাপনা' বা 'ভর্তি' মডিউল থেকে শিক্ষার্থী যুক্ত আছে কিনা নিশ্চিত করুন।",
      };
    }

    const meta = await getFeeMetadata(madrasaId);
    const feeTypes = meta.fee_types && meta.fee_types.length > 0 ? meta.fee_types : DEFAULT_FEE_TYPES;
    const feeStructures = meta.fee_structures || [];
    const currentStudentFees = [...(meta.student_fees || [])];

    // Determine target fee types
    const targetFeeTypeIds = params.feeTypeIds && params.feeTypeIds.length > 0
      ? params.feeTypeIds
      : feeTypes.filter((f) => f.frequency === "MONTHLY" || f.code === "MONTHLY").map((f) => f.id);

    const selectedFeeTypes = feeTypes.filter((ft) => targetFeeTypeIds.includes(ft.id));

    if (selectedFeeTypes.length === 0) {
      return { error: "অন্তত একটি ফি'র খাত নির্বাচন করুন।" };
    }

    let generatedCount = 0;
    let skippedCount = 0;
    let updatedCount = 0;
    const now = new Date().toISOString();
    const dueDate =
      params.dueDate ||
      new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    for (const student of students) {
      const studentClassId = student.class_id || params.classId || "ALL";
      const studentClassName = student.class_name || "সাধারণ";

      // Find matching fee structure if any
      const matchingStruct =
        feeStructures.find(
          (s) => s.session_id === params.sessionId && s.class_id === studentClassId
        ) ||
        feeStructures.find(
          (s) => s.session_id === params.sessionId && s.class_id === "ALL"
        );

      // Student discounts/waivers
      const studentDiscounts = (meta.discounts || []).filter(
        (d) => d.student_id === student.id && d.status === "APPROVED"
      );

      for (const ft of selectedFeeTypes) {
        // Calculate base amount: custom override > structure item amount > fee type default
        let baseAmount = ft.default_amount || 0;
        if (
          params.customAmounts &&
          params.customAmounts[ft.id] !== undefined &&
          !isNaN(Number(params.customAmounts[ft.id]))
        ) {
          baseAmount = Number(params.customAmounts[ft.id]);
        } else if (matchingStruct) {
          const sItem = matchingStruct.items.find((it) => it.fee_type_id === ft.id);
          if (sItem && sItem.amount > 0) {
            baseAmount = sItem.amount;
          }
        }

        if (baseAmount < 0) baseAmount = 0;

        // Idempotency: Check if already exists for this period
        const existingIdx = currentStudentFees.findIndex(
          (f) =>
            f.session_id === params.sessionId &&
            f.student_id === student.id &&
            f.fee_type_id === ft.id &&
            f.billing_period === params.billingPeriod
        );

        if (existingIdx >= 0) {
          if (params.forceUpdate && currentStudentFees[existingIdx].status === "UNPAID") {
            const oldFee = currentStudentFees[existingIdx];
            const discountAmt = oldFee.discount_amount || 0;
            const newPayable = Math.max(0, baseAmount - discountAmt);
            currentStudentFees[existingIdx] = {
              ...oldFee,
              base_amount: baseAmount,
              payable_amount: newPayable,
              due_amount: newPayable,
              due_date: dueDate,
              status: newPayable === 0 ? "WAIVED" : "UNPAID",
              updated_at: now,
            };
            updatedCount++;
          } else {
            skippedCount++;
          }
          continue;
        }

        // Calculate discount if applicable
        let discountAmount = 0;
        let discountReason = "";
        const applicableDiscount = studentDiscounts.find(
          (d) => !d.fee_type_id || d.fee_type_id === ft.id
        );

        if (applicableDiscount) {
          if (applicableDiscount.discount_type === "FULL_WAIVER") {
            discountAmount = baseAmount;
            discountReason = applicableDiscount.reason || "পূর্ণ মওকুফ";
          } else if (applicableDiscount.discount_type === "PERCENTAGE") {
            discountAmount = Math.round((baseAmount * applicableDiscount.value) / 100);
            discountReason = `${applicableDiscount.value}% বিশেষ ছাড়`;
          } else if (applicableDiscount.discount_type === "FIXED") {
            discountAmount = Math.min(baseAmount, applicableDiscount.value);
            discountReason = applicableDiscount.reason || "নির্ধারিত ছাড়";
          }
        }

        const payable = Math.max(0, baseAmount - discountAmount);

        const newFee: StudentFee = {
          id: `fee_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          madrasa_id: madrasaId,
          session_id: params.sessionId,
          student_id: student.id,
          student_name: `${student.first_name || ""} ${student.last_name || ""}`.trim() || "শিক্ষার্থী",
          student_roll: student.roll_number ? String(student.roll_number) : "",
          class_id: studentClassId,
          class_name: studentClassName,
          fee_type_id: ft.id,
          fee_type_name: ft.name,
          billing_period: params.billingPeriod,
          month_name: params.monthName || params.billingPeriod,
          year: params.year || new Date().getFullYear().toString(),
          due_date: dueDate,
          base_amount: baseAmount,
          discount_amount: discountAmount,
          discount_reason: discountReason,
          fine_amount: 0,
          payable_amount: payable,
          paid_amount: 0,
          due_amount: payable,
          status: payable === 0 ? "WAIVED" : "UNPAID",
          created_at: now,
          updated_at: now,
        };

        currentStudentFees.push(newFee);
        generatedCount++;
      }
    }

    // Record audit log
    const auditLogs = meta.audit_logs || [];
    auditLogs.unshift({
      id: `audit_${Date.now()}`,
      madrasa_id: madrasaId,
      action: "GENERATE_MONTHLY_FEES",
      user_name: user?.email || "হিসাবরক্ষক",
      user_role: "accountant",
      details: `${params.billingPeriod} সেশনের জন্য মোট ${generatedCount} টি নতুন ফি তৈরি করা হয়েছে (${skippedCount} টি পূর্বেই বিদ্যমান ছিল, ${updatedCount} টি আপডেট করা হয়েছে)।`,
      created_at: now,
    });

    const saved = await saveFeeMetadata(madrasaId, {
      student_fees: currentStudentFees,
      audit_logs: auditLogs.slice(0, 100),
    });
    if (!saved) {
      return { error: "তৈরি হওয়া ফি ইনভয়েসগুলো ডেটাবেজে সংরক্ষণ করা সম্ভব হয়নি। অনুগ্রহ করে আবার চেষ্টা করুন। (কোনো পরিবর্তন প্রয়োগ হয়নি)" };
    }

    revalidatePath("/dashboard/accounting");
    revalidatePath("/dashboard/accounting/due");
    revalidatePath("/dashboard/accounting/generate");
    revalidatePath("/dashboard/accounting/reports");

    const message = updatedCount > 0
      ? `সফলভাবে ${generatedCount} টি নতুন ফি তৈরি এবং ${updatedCount} টি ফি আপডেট করা হয়েছে (${skippedCount} টি স্কিপ হয়েছে)।`
      : `সফলভাবে ${generatedCount} জন শিক্ষার্থীর জন্য ${params.billingPeriod} ফি তৈরি করা হয়েছে (${skippedCount} টি পূর্বেই বিদ্যমান ছিল)।`;

    return {
      success: true,
      generatedCount,
      skippedCount,
      updatedCount,
      message,
    };
  } catch (err: any) {
    console.error("Error in generateMonthlyFees:", err);
    return { error: err.message || "ফি তৈরি করতে সমস্যা হয়েছে।" };
  }
}

/**
 * 4. Get Student Fee Profile (for Student Details page & Collect Payment)
 */
export async function getStudentFeeProfile(studentId: string, sessionId?: string) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return null;

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return null;

    const meta = await getFeeMetadata(madrasaId);

    let fees = (meta.student_fees || []).filter((f) => f.student_id === studentId);
    let payments = (meta.payments || []).filter(
      (p) => p.student_id === studentId && p.status === "COMPLETED"
    );

    if (sessionId && sessionId !== "ALL") {
      fees = fees.filter((f) => f.session_id === sessionId);
      payments = payments.filter((p) => p.session_id === sessionId);
    }

    const totalPayable = fees.reduce((sum, f) => sum + f.payable_amount, 0);
    const totalPaid = payments.reduce((sum, p) => sum + p.total_amount_received, 0);
    const totalDue = fees.reduce((sum, f) => sum + f.due_amount, 0);

    const currentMonth = new Date().getMonth() + 1;
    const currentMonthDue = fees
      .filter((f) => f.due_amount > 0)
      .slice(0, 1)
      .reduce((sum, f) => sum + f.due_amount, 0);

    return {
      student_id: studentId,
      total_payable: totalPayable,
      total_paid: totalPaid,
      total_due: totalDue,
      current_month_due: currentMonthDue,
      fees,
      payments,
      discounts: (meta.discounts || []).filter((d) => d.student_id === studentId),
    };
  } catch (err) {
    console.error("Error in getStudentFeeProfile:", err);
    return null;
  }
}

/**
 * 5. Collect Fee Payment (Handles Partial, Advance, Discount, Fine, and Generates Money Receipt)
 */
export async function collectFeePayment(paymentData: {
  student_id: string;
  session_id?: string;
  payment_date?: string;
  payment_method: "Cash" | "Bank" | "bKash" | "Nagad" | "Rocket" | "Other";
  transaction_ref?: string;
  total_amount: number;
  discount_amount?: number;
  discount_reason?: string;
  fine_amount?: number;
  fine_reason?: string;
  fee_allocations?: {
    student_fee_id?: string;
    fee_type_id?: string;
    fee_type_name: string;
    billing_period?: string;
    allocated_amount: number;
  }[];
  notes?: string;
  billing_month?: string;
  billing_year?: string;
  fee_type?: string;
}) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অননুমোদিত অ্যাক্সেস। অনুগ্রহ করে লগইন করুন।" };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "মাদরাসা আইডি পাওয়া যায়নি।" };

    // Fetch Student Info
    let student: any = null;
    const { data: stdData, error: stdErr } = await supabase
      .from("students")
      .select("id, first_name, last_name, roll_number, class_name, classes(id, name)")
      .eq("id", paymentData.student_id)
      .single();

    if (!stdErr && stdData) {
      student = stdData;
    } else {
      const { data: fallbackStd } = await supabase
        .from("students")
        .select("id, first_name, last_name, roll_number, class_name")
        .eq("id", paymentData.student_id)
        .single();
      student = fallbackStd;
    }

    if (!student) {
      return { error: "শিক্ষার্থী পাওয়া যায়নি।" };
    }

    const clsObj: any = Array.isArray(student.classes) ? student.classes[0] : student.classes;
    const studentFullName = `${student.first_name || ""} ${student.last_name || ""}`.trim();
    const studentClass = student.class_name || clsObj?.name || "সাধারণ";
    const studentRoll = student.roll_number ? String(student.roll_number) : "";

    const meta = await getFeeMetadata(madrasaId);
    const now = new Date().toISOString();
    const paymentDate = paymentData.payment_date || now.split("T")[0];

    // Generate formatted unique serial receipt number: MR-YYYY-XXXXX
    const currentYear = new Date().getFullYear();
    const newCounter = (meta.receipt_counter || 100) + 1;
    const receiptNo = `MR-${currentYear}-${String(newCounter).padStart(5, "0")}`;

    const studentFees = [...(meta.student_fees || [])];
    const payments = [...(meta.payments || [])];

    let amountToDistribute = Number(paymentData.total_amount) || 0;
    const finalAllocations: PaymentAllocation[] = [];

    // Apply allocations if provided, or auto-allocate to unpaid fees
    if (paymentData.fee_allocations && paymentData.fee_allocations.length > 0) {
      for (const alloc of paymentData.fee_allocations) {
        if (alloc.allocated_amount > 0) {
          finalAllocations.push({
            student_fee_id: alloc.student_fee_id,
            fee_type_id: alloc.fee_type_id,
            fee_type_name: alloc.fee_type_name,
            billing_period: alloc.billing_period,
            allocated_amount: alloc.allocated_amount,
          });

          // Update student fee invoice record
          if (alloc.student_fee_id) {
            const feeIdx = studentFees.findIndex((f) => f.id === alloc.student_fee_id);
            if (feeIdx >= 0) {
              const target = studentFees[feeIdx];
              const newPaid = target.paid_amount + alloc.allocated_amount;
              const newDue = Math.max(0, target.payable_amount - newPaid);
              studentFees[feeIdx] = {
                ...target,
                paid_amount: newPaid,
                due_amount: newDue,
                status: newDue === 0 ? "PAID" : "PARTIAL",
                updated_at: now,
              };
            }
          }
        }
      }
    } else {
      // Auto-allocate against student's unpaid dues
      const unpaidStudentFees = studentFees
        .filter((f) => f.student_id === paymentData.student_id && f.due_amount > 0)
        .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

      let remaining = amountToDistribute;
      for (const fee of unpaidStudentFees) {
        if (remaining <= 0) break;
        const allocAmt = Math.min(remaining, fee.due_amount);
        const feeIdx = studentFees.findIndex((f) => f.id === fee.id);
        const newPaid = fee.paid_amount + allocAmt;
        const newDue = Math.max(0, fee.payable_amount - newPaid);

        studentFees[feeIdx] = {
          ...fee,
          paid_amount: newPaid,
          due_amount: newDue,
          status: newDue === 0 ? "PAID" : "PARTIAL",
          updated_at: now,
        };

        finalAllocations.push({
          student_fee_id: fee.id,
          fee_type_id: fee.fee_type_id,
          fee_type_name: fee.fee_type_name,
          billing_period: fee.billing_period,
          allocated_amount: allocAmt,
        });

        remaining -= allocAmt;
      }

      // If money left, record as Advance Payment
      if (remaining > 0) {
        finalAllocations.push({
          fee_type_name: paymentData.fee_type || "অগ্রিম জমা (Advance Payment)",
          billing_period: paymentData.billing_month || "অগ্রিম",
          allocated_amount: remaining,
        });
      }
    }

    if (finalAllocations.length === 0) {
      finalAllocations.push({
        fee_type_name: paymentData.fee_type || "সাধারণ ফি",
        billing_period: paymentData.billing_month || "হালনাগাদ",
        allocated_amount: amountToDistribute,
      });
    }

    // Create New Payment Record
    const newPayment: FeePayment = {
      id: `pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      receipt_no: receiptNo,
      madrasa_id: madrasaId,
      session_id: paymentData.session_id || "default",
      student_id: paymentData.student_id,
      student_name: studentFullName,
      student_roll: studentRoll,
      class_name: studentClass,
      total_amount_received: amountToDistribute,
      payment_date: paymentDate,
      payment_method: paymentData.payment_method || "Cash",
      transaction_ref: paymentData.transaction_ref,
      allocations: finalAllocations,
      discount_total: Number(paymentData.discount_amount) || 0,
      fine_total: Number(paymentData.fine_amount) || 0,
      advance_amount: 0,
      collector_name: user.email?.split("@")[0] || "হিসাব বিভাগ",
      notes: paymentData.notes,
      status: "COMPLETED",
      created_at: now,
    };

    payments.unshift(newPayment);

    // Write to Supabase `fees` table for backwards compatibility
    const feeTypeDesc =
      finalAllocations.map((a) => a.fee_type_name).join(", ") ||
      paymentData.fee_type ||
      "Monthly";

    const { data: dbFee, error: dbFeeErr } = await supabase
      .from("fees")
      .insert({
        madrasa_id: madrasaId,
        student_id: paymentData.student_id,
        fee_type: paymentData.fee_type || (finalAllocations[0]?.fee_type_name.includes("Admission") ? "Admission" : "Monthly"),
        amount: amountToDistribute,
        payment_date: paymentDate,
        fee_month: paymentData.billing_month || new Date(paymentDate).toLocaleString("en-US", { month: "long" }),
        fee_year: paymentData.billing_year ? parseInt(paymentData.billing_year) : currentYear,
        notes: `[রিসিট: ${receiptNo}] ${paymentData.notes || ""}`,
      })
      .select("id")
      .single();

    // Record audit log
    const auditLogs = meta.audit_logs || [];
    auditLogs.unshift({
      id: `audit_${Date.now()}`,
      madrasa_id: madrasaId,
      action: "COLLECT_FEE_PAYMENT",
      user_name: user.email || "হিসাবরক্ষক",
      user_role: "accountant",
      record_id: newPayment.id,
      details: `${studentFullName} (${studentClass}, রোল: ${studentRoll})-এর কাছ থেকে ৳${amountToDistribute} ফি গ্রহণ করা হয়েছে। রিসিট নং: ${receiptNo}`,
      created_at: now,
    });

    const saved = await saveFeeMetadata(madrasaId, {
      student_fees: studentFees,
      payments: payments.slice(0, 500),
      receipt_counter: newCounter,
      audit_logs: auditLogs.slice(0, 100),
    });
    if (!saved) {
      return { error: "পেমেন্ট গ্রহণের তথ্য ডেটাবেজে সংরক্ষণ করা সম্ভব হয়নি। অনুগ্রহ করে আবার চেষ্টা করুন। (টাকা জমা হিসেবে গণ্য হয়নি)" };
    }

    revalidatePath("/dashboard/accounting");
    revalidatePath("/dashboard/accounting/fees");
    revalidatePath("/dashboard/accounting/due");
    revalidatePath("/dashboard/accounting/receipts");
    revalidatePath("/dashboard/accounting/payments");
    revalidatePath(`/dashboard/students/${paymentData.student_id}`);
    revalidatePath("/portal/fees");

    return {
      success: true,
      message: "ফি সফলভাবে আদায় করা হয়েছে এবং মানি রিসিট প্রস্তুত করা হয়েছে!",
      payment: newPayment,
      fee_id: dbFee?.id || newPayment.id,
      receipt_no: receiptNo,
    };
  } catch (err: any) {
    console.error("Error in collectFeePayment:", err);
    return { error: err.message || "ফি কালেকশন সম্পন্ন করতে সমস্যা হয়েছে।" };
  }
}

/**
 * 6. Reverse / Void Payment (Audit-compliant, doesn't delete, restores dues)
 */
export async function reverseFeePayment(paymentId: string, reason: string) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অননুমোদিত অ্যাক্সেস" };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "মাদরাসা পাওয়া যায়নি" };

    if (!reason || reason.trim().length < 5) {
      return { error: "পেমেন্ট রিভার্স করার সুনির্দিষ্ট কারণ উল্লেখ করুন (কমপক্ষে ৫ অক্ষর)।" };
    }

    const meta = await getFeeMetadata(madrasaId);
    const payments = [...(meta.payments || [])];
    const studentFees = [...(meta.student_fees || [])];

    const payIdx = payments.findIndex((p) => p.id === paymentId);
    if (payIdx < 0) {
      return { error: "পেমেন্ট রেকর্ড পাওয়া যায়নি।" };
    }

    const payment = payments[payIdx];
    if (payment.status === "REVERSED" || payment.status === "VOID") {
      return { error: "এই পেমেন্টটি ইতিপূর্বেই বাতিল বা রিভার্স করা হয়েছে।" };
    }

    const now = new Date().toISOString();

    // Rollback allocations from student fees
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

    // Mark payment as REVERSED
    payments[payIdx] = {
      ...payment,
      status: "REVERSED",
      reversal_reason: reason,
      reversed_at: now,
      reversed_by: user.email || "অ্যাডমিন",
    };

    // Audit log
    const auditLogs = meta.audit_logs || [];
    auditLogs.unshift({
      id: `audit_${Date.now()}`,
      madrasa_id: madrasaId,
      action: "REVERSE_PAYMENT",
      user_name: user.email || "অ্যাডমিন",
      user_role: "admin",
      record_id: paymentId,
      details: `রিসিট নং ${payment.receipt_no} (পরিমাণ: ৳${payment.total_amount_received}) রিভার্স করা হয়েছে। কারণ: ${reason}`,
      created_at: now,
    });

    const saved = await saveFeeMetadata(madrasaId, {
      student_fees: studentFees,
      payments,
      audit_logs: auditLogs.slice(0, 100),
    });
    if (!saved) {
      return { error: "পেমেন্ট বাতিল করার তথ্য ডেটাবেজে সংরক্ষণ করা সম্ভব হয়নি। অনুগ্রহ করে আবার চেষ্টা করুন।" };
    }

    revalidatePath("/dashboard/accounting");
    revalidatePath("/dashboard/accounting/payments");
    revalidatePath("/dashboard/accounting/due");

    return { success: true, message: "পেমেন্ট সফলভাবে রিভার্স করা হয়েছে এবং বকেয়া পুনর্স্থাপন করা হয়েছে।" };
  } catch (err: any) {
    console.error("Error in reverseFeePayment:", err);
    return { error: err.message || "পেমেন্ট রিভার্স করতে সমস্যা হয়েছে।" };
  }
}

/**
 * 7. Get Due Management Summary and Student Due List
 */
export async function getDueManagementData(filters?: {
  sessionId?: string;
  classId?: string;
  searchQuery?: string;
  agingCategory?: "ALL" | "0_30" | "31_60" | "61_90" | "90_PLUS";
}) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return null;

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return null;

    const [meta, studentsRes] = await Promise.all([
      getFeeMetadata(madrasaId),
      supabase
        .from("students")
        .select("id, first_name, last_name, roll_number, student_id, phone, parent_phone, class_name")
        .eq("madrasa_id", madrasaId),
    ]);

    let students = studentsRes.data || [];
    if (students.length === 0) {
      try {
        const adminClient = await createAdminClient();
        const { data: adminStudents } = await adminClient
          .from("students")
          .select("id, first_name, last_name, roll_number, student_id, phone, parent_phone, class_name")
          .eq("madrasa_id", madrasaId);
        if (adminStudents && adminStudents.length > 0) {
          students = adminStudents;
        }
      } catch {}
    }
    let fees = meta.student_fees || [];

    if (filters?.sessionId && filters.sessionId !== "ALL") {
      fees = fees.filter((f) => f.session_id === filters.sessionId);
    }

    // Group dues by student
    const studentDueMap = new Map<
      string,
      {
        student: any;
        totalDue: number;
        unpaidCount: number;
        feeItems: StudentFee[];
        maxOverdueDays: number;
      }
    >();

    const today = new Date();

    for (const f of fees) {
      if (f.due_amount > 0) {
        const student = students.find((s) => s.id === f.student_id);
        const existing = studentDueMap.get(f.student_id) || {
          student: student || {
            id: f.student_id,
            first_name: f.student_name || "শিক্ষার্থী",
            last_name: "",
            roll_number: f.student_roll || "-",
            class_name: f.class_name || "সাধারণ",
          },
          totalDue: 0,
          unpaidCount: 0,
          feeItems: [],
          maxOverdueDays: 0,
        };

        const dueDate = new Date(f.due_date);
        const diffTime = today.getTime() - dueDate.getTime();
        const overdueDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

        existing.totalDue += f.due_amount;
        existing.unpaidCount += 1;
        existing.feeItems.push(f);
        if (overdueDays > existing.maxOverdueDays) {
          existing.maxOverdueDays = overdueDays;
        }

        studentDueMap.set(f.student_id, existing);
      }
    }

    let studentDueList = Array.from(studentDueMap.values());

    // Apply class filter
    if (filters?.classId && filters.classId !== "ALL") {
      studentDueList = studentDueList.filter((item) => {
        const cls: any = Array.isArray(item.student.classes)
          ? item.student.classes[0]
          : item.student.classes;
        return cls?.id === filters.classId || item.student.class_name === filters.classId;
      });
    }

    // Apply search filter
    if (filters?.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      studentDueList = studentDueList.filter(
        (item) =>
          item.student.first_name?.toLowerCase().includes(q) ||
          item.student.last_name?.toLowerCase().includes(q) ||
          String(item.student.roll_number || "").includes(q) ||
          item.student.parent_phone?.includes(q)
      );
    }

    // Aging Buckets Calculation
    let aging_0_30 = 0;
    let aging_31_60 = 0;
    let aging_61_90 = 0;
    let aging_90_plus = 0;

    studentDueList.forEach((item) => {
      if (item.maxOverdueDays <= 30) aging_0_30 += item.totalDue;
      else if (item.maxOverdueDays <= 60) aging_31_60 += item.totalDue;
      else if (item.maxOverdueDays <= 90) aging_61_90 += item.totalDue;
      else aging_90_plus += item.totalDue;
    });

    // Apply Aging category filter
    if (filters?.agingCategory && filters.agingCategory !== "ALL") {
      if (filters.agingCategory === "0_30") {
        studentDueList = studentDueList.filter((i) => i.maxOverdueDays <= 30);
      } else if (filters.agingCategory === "31_60") {
        studentDueList = studentDueList.filter((i) => i.maxOverdueDays > 30 && i.maxOverdueDays <= 60);
      } else if (filters.agingCategory === "61_90") {
        studentDueList = studentDueList.filter((i) => i.maxOverdueDays > 60 && i.maxOverdueDays <= 90);
      } else if (filters.agingCategory === "90_PLUS") {
        studentDueList = studentDueList.filter((i) => i.maxOverdueDays > 90);
      }
    }

    // Sort by largest due amount
    studentDueList.sort((a, b) => b.totalDue - a.totalDue);

    const totalDueSum = studentDueList.reduce((sum, i) => sum + i.totalDue, 0);

    return {
      totalDue: totalDueSum,
      totalStudentsWithDue: studentDueList.length,
      aging: {
        aging_0_30,
        aging_31_60,
        aging_61_90,
        aging_90_plus,
      },
      studentDueList,
    };
  } catch (err) {
    console.error("Error in getDueManagementData:", err);
    return null;
  }
}

/**
 * 8. Get Comprehensive Fee & Finance Overview Data (for Dashboard)
 */
export async function getFeeDashboardOverview() {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return null;

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return null;

    const [meta, dbFeesRes, studentsRes] = await Promise.all([
      getFeeMetadata(madrasaId),
      supabase.from("fees").select("*").eq("madrasa_id", madrasaId),
      supabase.from("students").select("id, first_name, last_name, roll_number, class_name").eq("madrasa_id", madrasaId),
    ]);

    const payments = (meta.payments || []).filter((p) => p.status === "COMPLETED");
    const studentFees = meta.student_fees || [];
    const dbFees = dbFeesRes.data || [];
    let students = studentsRes.data || [];

    if (students.length === 0) {
      try {
        const adminClient = await createAdminClient();
        const { data: adminStudents } = await adminClient
          .from("students")
          .select("id, first_name, last_name, roll_number, class_name")
          .eq("madrasa_id", madrasaId);
        if (adminStudents && adminStudents.length > 0) {
          students = adminStudents;
        }
      } catch {}
    }

    // Calculate Collection
    const totalCollected = payments.reduce((sum, p) => sum + p.total_amount_received, 0) || dbFees.reduce((sum, f) => sum + (Number(f.amount) || 0), 0);
    const totalDue = studentFees.reduce((sum, f) => sum + f.due_amount, 0);

    // Current month collection
    const currentMonthStr = new Date().toISOString().substring(0, 7); // YYYY-MM
    const thisMonthCollection = payments
      .filter((p) => p.payment_date?.startsWith(currentMonthStr))
      .reduce((sum, p) => sum + p.total_amount_received, 0);

    // Today's collection
    const todayStr = new Date().toISOString().split("T")[0];
    const todayCollection = payments
      .filter((p) => p.payment_date === todayStr)
      .reduce((sum, p) => sum + p.total_amount_received, 0);

    // Fee Type breakdown
    const typeBreakdown: Record<string, number> = {};
    payments.forEach((p) => {
      p.allocations?.forEach((a) => {
        typeBreakdown[a.fee_type_name] = (typeBreakdown[a.fee_type_name] || 0) + a.allocated_amount;
      });
    });

    // Payment Method breakdown
    const methodBreakdown: Record<string, number> = {
      Cash: 0,
      Bank: 0,
      bKash: 0,
      Nagad: 0,
      Rocket: 0,
      Other: 0,
    };
    payments.forEach((p) => {
      methodBreakdown[p.payment_method] = (methodBreakdown[p.payment_method] || 0) + p.total_amount_received;
    });

    return {
      totalCollected,
      totalDue,
      thisMonthCollection,
      todayCollection,
      totalPaymentsCount: payments.length || dbFees.length,
      totalStudentsCount: students.length,
      recentPayments: payments.slice(0, 10),
      typeBreakdown,
      methodBreakdown,
      auditLogs: (meta.audit_logs || []).slice(0, 5),
    };
  } catch (err) {
    console.error("Error in getFeeDashboardOverview:", err);
    return null;
  }
}
