"use server";
import {
  getFeeMetadata as readFeeStore,
  saveFeeMetadata,
  generateNextReceiptNumber,
  readStudentFeeCollectionContext,
  saveSingleFeeCollection,
} from "@/lib/fee-store";
import { after } from "next/server";
import {rows} from '@/lib/portal/queries';
import {studentLedger,reconcilePayments} from '@/lib/portal/ledger';
import {webIdentity,hasRole,linkedStudents} from '@/lib/portal/identity';
import {studentRoles,teacherRoles} from '@/lib/portal/rules';

import { toDhakaDateStringFrom, toDhakaDateString, getDhakaYear, toDhakaMonthString } from "@/lib/date-utils";
import { writeGuard } from "@/lib/action-authorization";
import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getAuthMadrasaId } from "./students";
import { requirePermission } from "@/lib/permissions-server";
import { logAuditEvent } from "@/lib/audit-log";
import { assertAccountingPeriodUnlocked } from "@/lib/lock-guards";
import { submitWorkflowHookApproval } from "@/lib/approval-workflow";
import { getMadrasaMetadata, saveMadrasaMetadata, AcademicSession, StudentEnrollment } from "@/lib/sessions";
import {
  FeeType,
  FeeStructure,
  StudentFee,
  FeePayment,
  FeeDiscountWaiver,
  FeeAuditLog,
  FeeStatus,
  DEFAULT_FEE_TYPES,
  MadrasaFeeData,
  PaymentAllocation,
} from "@/lib/fee-management";

/**
 * Atomic Receipt Number Generator:
 * Queries the database for the max receipt number for this madrasa and year,
 * ensuring sequential, monotonic, collision-free receipt numbers.
 */
function canReadFinance(i:NonNullable<Awaited<ReturnType<typeof webIdentity>>>) {
  return !hasRole(i,[...teacherRoles,...studentRoles]) && (hasRole(i,['super_admin','muhtamim','admin','accountant']) || i.perms.summary.effectivePermissions.some(p=>['finance.view','fee.view','finance.manage'].includes(p)));
}
export async function getFeeMetadata(tenant:string):Promise<MadrasaFeeData> {
  const i=await webIdentity();
  if (!i || i.tenant!==tenant || !canReadFinance(i)) throw new Error('অনুমতি নেই।');
  return readFeeStore(tenant);
}

/**
 * 1. Get Fee Types
 */
export async function getFeeTypes(): Promise<FeeType[]> {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    let madrasaId = user ? await getAuthMadrasaId(supabase, user) : null;

    // ⛔ HI-14 ফিক্স: আগে মাদ্রাসা সনাক্ত না হলে ডেটাবেজের *প্রথম* মাদ্রাসাটি ধরে নেওয়া হতো
    // (`.order("created_at", { ascending: true }).limit(1).single()`), আর adminClient দিয়ে
    // সেই অন্য মাদ্রাসার student_fees / fee_types / academic sessions-এ ফি জেনারেট বা
    // আপডেট হয়ে যেত — অর্থাৎ cross-tenant ডেটা করাপশন। এখন মাদ্রাসা না পাওয়া গেলে
    // কিছুই করা হয় না এবং স্পষ্ট বার্তা দেওয়া হয়।
    if (!madrasaId) return DEFAULT_FEE_TYPES;

    const meta = await getFeeMetadata(madrasaId);
    const feeTypes = meta.fee_types && meta.fee_types.length > 0 ? meta.fee_types : DEFAULT_FEE_TYPES;
    return feeTypes.map((ft) => {
      if (!ft.fund_id || !ft.fund_name) {
        const isFood =
          ft.category === "BOARDING" ||
          ft.code === "HOSTEL" ||
          ft.name.includes("বোর্ডিং") ||
          ft.name.includes("খাবার") ||
          ft.name.includes("খোরাকি");
        return {
          ...ft,
          fund_id: ft.fund_id || (isFood ? "fund-lillah" : "fund-general"),
          fund_name: ft.fund_name || (isFood ? "লিল্লাহ বোর্ডিং ফান্ড (Lillah Fund)" : "সাধারণ ফান্ড (General Fund)"),
        };
      }
      return ft;
    });
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

    // ⛔ HI-14 ফিক্স: আগে মাদ্রাসা সনাক্ত না হলে ডেটাবেজের *প্রথম* মাদ্রাসাটি ধরে নেওয়া হতো
    // (`.order("created_at", { ascending: true }).limit(1).single()`), আর adminClient দিয়ে
    // সেই অন্য মাদ্রাসার student_fees / fee_types / academic sessions-এ ফি জেনারেট বা
    // আপডেট হয়ে যেত — অর্থাৎ cross-tenant ডেটা করাপশন। এখন মাদ্রাসা না পাওয়া গেলে
    // কিছুই করা হয় না এবং স্পষ্ট বার্তা দেওয়া হয়।
    if (!user || !madrasaId) return { error: "মাদ্রাসা সনাক্ত করা যায়নি। অনুগ্রহ করে আবার লগইন করুন।" };

    // CR-2 ফিক্স: সার্ভার-সাইড অনুমতি যাচাই (আগে শুধু `if (!user)` ছিল)
    const guard = await requirePermission({
      userId: user.id,
      madrasaId,
      permissions: ["fee.edit"],
      roles: ["super_admin", "admin", "muhtamim", "accountant"],
    });
    if (!guard.allowed) return { error: guard.error || "এই কাজটি করার অনুমতি নেই।" };

    const meta = await getFeeMetadata(madrasaId);
    const feeTypes = [...(meta.fee_types || DEFAULT_FEE_TYPES)];
    const isFood =
      feeType.category === "BOARDING" ||
      feeType.code === "HOSTEL" ||
      (feeType.name || "").includes("বোর্ডিং") ||
      (feeType.name || "").includes("খাবার") ||
      (feeType.name || "").includes("খোরাকি");

    const defaultFundId = feeType.fund_id || (isFood ? "fund-lillah" : "fund-general");
    const defaultFundName =
      feeType.fund_name || (isFood ? "লিল্লাহ বোর্ডিং ফান্ড (Lillah Fund)" : "সাধারণ ফান্ড (General Fund)");

    if (feeType.id) {
      const idx = feeTypes.findIndex((f) => f.id === feeType.id);
      if (idx >= 0) {
        feeTypes[idx] = {
          ...feeTypes[idx],
          ...feeType,
          fund_id: defaultFundId,
          fund_name: defaultFundName,
        } as FeeType;
      } else {
        feeTypes.push({
          ...feeType,
          fund_id: defaultFundId,
          fund_name: defaultFundName,
        } as FeeType);
      }
    } else {
      const newType: FeeType = {
        id: `ft_${Date.now()}`,
        name: feeType.name || "নতুন ফি",
        code: feeType.code || `FEE_${Date.now().toString().slice(-4)}`,
        category: feeType.category || "OTHER",
        frequency: feeType.frequency || "MONTHLY",
        default_amount: Number(feeType.default_amount) || 0,
        fund_id: defaultFundId,
        fund_name: defaultFundName,
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

    // ⛔ HI-14 ফিক্স: আগে মাদ্রাসা সনাক্ত না হলে ডেটাবেজের *প্রথম* মাদ্রাসাটি ধরে নেওয়া হতো
    // (`.order("created_at", { ascending: true }).limit(1).single()`), আর adminClient দিয়ে
    // সেই অন্য মাদ্রাসার student_fees / fee_types / academic sessions-এ ফি জেনারেট বা
    // আপডেট হয়ে যেত — অর্থাৎ cross-tenant ডেটা করাপশন। এখন মাদ্রাসা না পাওয়া গেলে
    // কিছুই করা হয় না এবং স্পষ্ট বার্তা দেওয়া হয়।
    if (!user || !madrasaId) return { error: "মাদ্রাসা সনাক্ত করা যায়নি। অনুগ্রহ করে আবার লগইন করুন।" };

    // CR-2 ফিক্স: সার্ভার-সাইড অনুমতি যাচাই (আগে শুধু `if (!user)` ছিল)
    const guard = await requirePermission({
      userId: user.id,
      madrasaId,
      permissions: ["fee.edit"],
      roles: ["super_admin", "admin", "muhtamim", "accountant"],
    });
    if (!guard.allowed) return { error: guard.error || "এই কাজটি করার অনুমতি নেই।" };

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

    // CR-2 ফিক্স: সার্ভার-সাইড অনুমতি যাচাই (আগে শুধু `if (!user)` ছিল)
    const guard = await requirePermission({
      userId: user.id,
      madrasaId,
      permissions: ["fee.edit"],
      roles: ["super_admin", "admin", "muhtamim", "accountant"],
      riskLevel: "CRITICAL",
      actionScope: "fee_structure.edit",
    });
    if (!guard.allowed) {
      return {
        error: guard.error || "এই কাজটি করার অনুমতি নেই।",
        stepUpRequired: guard.stepUpRequired,
        errorCode: guard.errorCode,
      };
    }

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

    // CR-2 ফিক্স: সার্ভার-সাইড অনুমতি যাচাই (আগে শুধু `if (!user)` ছিল)
    const guard = await requirePermission({
      userId: user.id,
      madrasaId,
      permissions: ["fee.edit"],
      roles: ["super_admin", "admin", "muhtamim", "accountant"],
      riskLevel: "CRITICAL",
      actionScope: "fee_structure.delete",
    });
    if (!guard.allowed) {
      return {
        error: guard.error || "এই কাজটি করার অনুমতি নেই।",
        stepUpRequired: guard.stepUpRequired,
        errorCode: guard.errorCode,
      };
    }

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
  syncStudentProfiles?: boolean;
  dueDate?: string;
}) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    let madrasaId = user ? await getAuthMadrasaId(supabase, user) : null;

    const adminClient = await createAdminClient();

    // ⛔ HI-14 ফিক্স: আগে মাদ্রাসা সনাক্ত না হলে ডেটাবেজের *প্রথম* মাদ্রাসাটি ধরে নেওয়া হতো
    // (`.order("created_at", { ascending: true }).limit(1).single()`), আর adminClient দিয়ে
    // সেই অন্য মাদ্রাসার student_fees / fee_types / academic sessions-এ ফি জেনারেট বা
    // আপডেট হয়ে যেত — অর্থাৎ cross-tenant ডেটা করাপশন। এখন মাদ্রাসা না পাওয়া গেলে
    // কিছুই করা হয় না এবং স্পষ্ট বার্তা দেওয়া হয়।
    if (!user || !madrasaId) return { error: "মাদ্রাসা সনাক্ত করা যায়নি। অনুগ্রহ করে আবার লগইন করুন।" };

    // CR-2 ফিক্স: সার্ভার-সাইড অনুমতি যাচাই (আগে শুধু `if (!user)` ছিল)
    const guard = await requirePermission({
      userId: user.id,
      madrasaId,
      permissions: ["fee.create", "finance.create"],
      roles: ["super_admin", "admin", "muhtamim", "accountant"],
    });
    if (!guard.allowed) return { error: guard.error || "এই কাজটি করার অনুমতি নেই।" };

    // Fetch students strictly belonging to this madrasa
    let students: any[] = [];
    try {
      const { data: stdData, error: stdErr } = await adminClient
        .from("students")
        .select("id, first_name, last_name, roll_number, class_name, class_id")
        .eq("madrasa_id", madrasaId);

      if (!stdErr && stdData && stdData.length > 0) {
        students = stdData;
      }
    } catch (stdFetchErr) {
      console.error("Error fetching students for monthly fees:", stdFetchErr);
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

    // Guard 3: Fetch existing student_fees for this billing period directly from relational database for strict anti-duplication
    let existingDbFees: any[] = [];
    try {
      const { data: dbFeeData } = await adminClient
        .from("student_fees")
        .select("id, student_id, fee_type_id, billing_period, paid_amount, due_amount, status")
        .eq("madrasa_id", madrasaId)
        .eq("billing_period", params.billingPeriod);
      if (dbFeeData) {
        existingDbFees = dbFeeData;
      }
    } catch (e) {
      console.warn("Could not fetch db existing student_fees:", e);
    }

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
      toDhakaDateString(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000));

    const shouldSyncProfiles = params.syncStudentProfiles !== false;

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

      // Student discounts/waivers from discounts array or individual student profile
      const studentProfile = meta.student_profiles?.[student.id];
      const studentDiscounts = (meta.discounts || []).filter(
        (d) => d.student_id === student.id && d.status === "APPROVED"
      );

      // Determine general discount pool (applied across fee types without double-discounting)
      const generalDiscount = studentDiscounts.find((d) => !d.fee_type_id);
      let isGeneralFullWaiver = false;
      let generalPercentage = 0;
      let remainingGeneralDiscount = 0;
      let generalDiscountReason = "";

      if (generalDiscount) {
        if (generalDiscount.discount_type === "FULL_WAIVER") {
          isGeneralFullWaiver = true;
          generalDiscountReason = generalDiscount.reason || "পূর্ণ মওকুফ";
        } else if (generalDiscount.discount_type === "PERCENTAGE") {
          generalPercentage = Number(generalDiscount.value || 0);
          generalDiscountReason = `${generalDiscount.value}% বিশেষ ছাড়`;
        } else if (generalDiscount.discount_type === "FIXED") {
          remainingGeneralDiscount = Number(generalDiscount.value || 0);
          generalDiscountReason = generalDiscount.reason || "নির্ধারিত মাসিক ছাড়";
        }
      } else if (shouldSyncProfiles && studentProfile) {
        const isFreeStudent =
          studentProfile.is_free === true ||
          studentProfile.student_status === "SCHOLARSHIP" ||
          (studentProfile.total_monthly_fee !== undefined &&
            Number(studentProfile.total_monthly_fee) === 0 &&
            Number(studentProfile.monthly_fee || 0) === 0 &&
            Number(studentProfile.khoraki_fee || 0) === 0);

        if (isFreeStudent) {
          isGeneralFullWaiver = true;
          generalDiscountReason = studentProfile.fee_discount_reason || "১০০% সম্পূর্ণ ফ্রি / ইয়ানতপ্রাপ্ত শিক্ষার্থী";
        } else if (studentProfile.fee_discount && Number(studentProfile.fee_discount) > 0) {
          remainingGeneralDiscount = Number(studentProfile.fee_discount);
          generalDiscountReason = studentProfile.fee_discount_reason || "শিক্ষার্থী প্রোফাইল ভিত্তিক ছাড় / মওকুফ";
        }
      }

      for (const ft of selectedFeeTypes) {
        let baseAmount = ft.default_amount || 0;
        const ftCode = (ft.code || "").toUpperCase();
        const ftCat = (ft.category || "").toUpperCase();
        const ftName = ft.name || "";

        const isTuition =
          ftCat === "TUITION" ||
          ftCode === "MONTHLY" ||
          ftName.includes("বেতন") ||
          ftName.includes("টিউশন");
        const isFood =
          ftCat === "BOARDING" ||
          ftCode === "HOSTEL" ||
          ftCode === "FOOD" ||
          ftName.includes("খাবার") ||
          ftName.includes("খোরাকি") ||
          ftName.includes("বোর্ডিং");
        const isHostel =
          ftCat === "HOSTEL" ||
          ftName.includes("আবাসন") ||
          ftName.includes("সিট") ||
          ftName.includes("হোস্টেল");
        const isTransport =
          ftCat === "TRANSPORT" ||
          ftCode === "TRANSPORT" ||
          ftName.includes("পরিবহন") ||
          ftName.includes("গাড়ি");
        const isAdmission =
          ftCat === "ADMISSION" ||
          ftCode === "ADMISSION" ||
          ftName.includes("ভর্তি");
        const isOther =
          ftCat === "OTHER" ||
          ftCode === "OTHER" ||
          ftName.includes("অন্যান্য") ||
          ftName.includes("বিবিধ");

        // 1. Check student individual profile agreed fee (from admission or student edit)
        let profileAgreedFee: number | undefined = undefined;
        if (shouldSyncProfiles && studentProfile) {
          if (isTuition && studentProfile.monthly_fee !== undefined && studentProfile.monthly_fee !== null) {
            profileAgreedFee = Number(studentProfile.monthly_fee);
          } else if (isFood && studentProfile.khoraki_fee !== undefined && studentProfile.khoraki_fee !== null) {
            profileAgreedFee = Number(studentProfile.khoraki_fee);
          } else if (isHostel && studentProfile.accommodation_fee !== undefined && studentProfile.accommodation_fee !== null) {
            profileAgreedFee = Number(studentProfile.accommodation_fee);
          } else if (isTransport && studentProfile.transport_fee !== undefined && studentProfile.transport_fee !== null) {
            profileAgreedFee = Number(studentProfile.transport_fee);
          } else if (isAdmission && studentProfile.admission_fee !== undefined && studentProfile.admission_fee !== null) {
            profileAgreedFee = Number(studentProfile.admission_fee);
          } else if (isOther && studentProfile.other_fee !== undefined && studentProfile.other_fee !== null) {
            profileAgreedFee = Number(studentProfile.other_fee);
          }
        }

        if (profileAgreedFee !== undefined && !isNaN(profileAgreedFee)) {
          // Individual contract takes precedence
          baseAmount = profileAgreedFee;
        } else if (
          params.customAmounts &&
          params.customAmounts[ft.id] !== undefined &&
          !isNaN(Number(params.customAmounts[ft.id]))
        ) {
          // Generator custom amount override
          baseAmount = Number(params.customAmounts[ft.id]);
        } else if (matchingStruct) {
          const sItem = matchingStruct.items.find((it) => it.fee_type_id === ft.id);
          if (sItem && sItem.amount >= 0) {
            baseAmount = sItem.amount;
          }
        }

        if (baseAmount < 0) baseAmount = 0;

        // 2. Calculate discount & waiver (মওকুফ / বিশেষ ছাড়)
        let discountAmount = 0;
        let discountReason = "";

        // Check if there is a specific discount for this exact fee type
        const specificDiscount = studentDiscounts.find((d) => d.fee_type_id === ft.id);

        if (specificDiscount) {
          if (specificDiscount.discount_type === "FULL_WAIVER") {
            discountAmount = baseAmount;
            discountReason = specificDiscount.reason || "পূর্ণ মওকুফ";
          } else if (specificDiscount.discount_type === "PERCENTAGE") {
            discountAmount = Math.round((baseAmount * Number(specificDiscount.value || 0)) / 100);
            discountReason = `${specificDiscount.value}% বিশেষ ছাড়`;
          } else if (specificDiscount.discount_type === "FIXED") {
            discountAmount = Math.min(baseAmount, Number(specificDiscount.value || 0));
            discountReason = specificDiscount.reason || "নির্ধারিত ছাড়";
          }
        } else if (isGeneralFullWaiver) {
          discountAmount = baseAmount;
          discountReason = generalDiscountReason || "পূর্ণ মওকুফ";
        } else if (generalPercentage > 0) {
          discountAmount = Math.round((baseAmount * generalPercentage) / 100);
          discountReason = generalDiscountReason || `${generalPercentage}% বিশেষ ছাড়`;
        } else if (remainingGeneralDiscount > 0) {
          // Apply pool-based discount without exceeding total student general discount
          discountAmount = Math.min(baseAmount, remainingGeneralDiscount);
          remainingGeneralDiscount -= discountAmount;
          discountReason = generalDiscountReason || "নির্ধারিত মাসিক ছাড়";
        }

        if (discountAmount > baseAmount) discountAmount = baseAmount;
        const payable = Math.max(0, baseAmount - discountAmount);

        // Guard 3 Idempotency: Check if already exists for this period in memory OR in database
        const existingInMemoryIdx = currentStudentFees.findIndex(
          (f) =>
            f.student_id === student.id &&
            f.fee_type_id === ft.id &&
            f.billing_period === params.billingPeriod
        );

        const existingDb = existingDbFees.find(
          (f: any) =>
            f.student_id === student.id &&
            f.fee_type_id === ft.id &&
            f.billing_period === params.billingPeriod
        );

        if (existingInMemoryIdx >= 0 || existingDb) {
          const targetFee = existingInMemoryIdx >= 0 ? currentStudentFees[existingInMemoryIdx] : existingDb;
          const isUnpaid = targetFee.status !== "PAID" && (Number(targetFee.paid_amount) || 0) === 0;

          if (params.forceUpdate && isUnpaid) {
            if (existingInMemoryIdx >= 0) {
              const oldFee = currentStudentFees[existingInMemoryIdx];
              currentStudentFees[existingInMemoryIdx] = {
                ...oldFee,
                base_amount: baseAmount,
                discount_amount: discountAmount,
                discount_reason: discountReason,
                payable_amount: payable,
                due_amount: payable,
                due_date: dueDate,
                status: payable === 0 ? "WAIVED" : "UNPAID",
                updated_at: now,
              };
            }

            try {
              await adminClient.from("student_fees").update({
                base_amount: baseAmount,
                discount_amount: discountAmount,
                discount_reason: discountReason,
                payable_amount: payable,
                due_amount: payable,
                due_date: dueDate,
                status: payable === 0 ? "WAIVED" : "UNPAID",
                updated_at: now,
              }).eq("id", targetFee.id).eq("madrasa_id", madrasaId);
            } catch (errDb) {
              console.warn("Direct update existing student_fees error:", errDb);
            }
            updatedCount++;
          } else {
            skippedCount++;
          }
          continue; // SKIP generating duplicate invoice!
        }

        const targetFundId = ft.fund_id || (isFood ? "fund-lillah" : "fund-general");
        const targetFundName =
          ft.fund_name || (isFood ? "লিল্লাহ বোর্ডিং ফান্ড (Lillah Fund)" : "সাধারণ ফান্ড (General Fund)");

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
          fund_id: targetFundId,
          fund_name: targetFundName,
          billing_period: params.billingPeriod,
          month_name: params.monthName || params.billingPeriod,
          year: params.year || String(getDhakaYear()),
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
    revalidatePath("/portal/fees");
    revalidatePath("/portal");
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
    const i = await webIdentity();
    if (!i || hasRole(i,teacherRoles)) return null;
    const madrasaId = i.tenant;
    if (hasRole(i,studentRoles) && !(await linkedStudents(i,studentId)).child) return null;
    if (!hasRole(i,studentRoles) && !canReadFinance(i)) return null;
    const ledger = await studentLedger(i.db,madrasaId,studentId,await getMadrasaMetadata(madrasaId,true),sessionId);

    let pendingApprovals: Array<{
      id: string;
      type: string;
      title: string;
      amount?: number;
      requested_at: string;
    }> = [];
    try {
      const adminClient = await createAdminClient();
      const { data: reqs, error: reqErr } = await adminClient
        .from("approval_requests")
        .select("id, type, title, payload, created_at")
        .eq("madrasa_id", madrasaId)
        .eq("target_id", studentId)
        .eq("status", "PENDING")
        .in("type", ["FEE_WAIVER", "FEE_DISCOUNT"])
        .order("created_at", { ascending: false })
        .limit(10);

      if (!reqErr && Array.isArray(reqs)) {
        pendingApprovals = reqs.map((r: any) => ({
          id: String(r.id),
          type: String(r.type),
          title: String(r.title || "ফি ছাড়/মওকুফ অনুমোদন"),
          amount: Number(r.payload?.paymentData?.discount_amount || r.payload?.amount || 0) || undefined,
          requested_at: String(r.created_at || new Date().toISOString()),
        }));
      }
    } catch {
      // ignore if approval_requests table is not migrated yet
    }

    return { ...ledger,
      pendingApprovals,
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
    discount_applied?: number;
    fund_id?: string;
    fund_name?: string;
  }[];
  notes?: string;
  billing_month?: string;
  billing_year?: string;
  fee_type?: string;
  fund_id?: string;
  /**
   * ⛔ HI-2: Duplicate-payment protection.
   * একটি সাবমিট চেষ্টার জন্য অনন্য key (ক্লায়েন্ট `crypto.randomUUID()` দেয়)।
   * একই key দ্বিতীয়বার এলে সার্ভার নতুন পেমেন্ট তৈরি করে না — বরং আগেরটিই ফেরত দেয়।
   */
  idempotency_key?: string;
  fund_name?: string;
  _approvalBypass?: boolean;
}) {
  try {
    const supabase = await createClient();
    const adminClient = await createAdminClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অননুমোদিত অ্যাক্সেস। অনুগ্রহ করে লগইন করুন।" };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "মাদরাসা আইডি পাওয়া যায়নি।" };

    // CR-2 ফিক্স: ফি আদায়ের জন্য সার্ভার-সাইড অনুমতি যাচাই। আগে শুধু `if (!user)` ছিল,
    // ফলে অভিভাবক/শিক্ষার্থী পোর্টাল অ্যাকাউন্ট থেকেও সরাসরি action কল করে ফি আদায় ও
    // রসিদ তৈরি করা যেত।
    const collectGuard = await requirePermission({
      userId: user.id,
      madrasaId,
      permissions: ["fee.create", "finance.create"],
      roles: ["super_admin", "admin", "muhtamim", "accountant"],
      errorMessage: "ফি আদায় ও রসিদ তৈরির অনুমতি আপনার নেই।",
    });
    if (!collectGuard.allowed) {
      return { error: collectGuard.error || "ফি আদায়ের অনুমতি আপনার নেই।" };
    }

    // 1.3 Granular Accounting Period Lock Guard
    const targetPayDate = paymentData.payment_date || toDhakaDateString();
    const periodLock = await assertAccountingPeriodUnlocked(
      madrasaId,
      targetPayDate,
      "ফি আদায় ও রসিদ তৈরি"
    );
    if (periodLock.locked) {
      return { error: periodLock.error };
    }

    if (!paymentData._approvalBypass && Number(paymentData.discount_amount || 0) > 0) {
      const discountAmt = Number(paymentData.discount_amount || 0);
      const primaryType = paymentData.total_amount === 0 ? "FEE_WAIVER" : "FEE_DISCOUNT";
      const hook = await submitWorkflowHookApproval({
        madrasaId,
        actorId: user.id,
        actorName: user.user_metadata?.full_name || user.email || "অফিসার",
        actorRole: user.user_metadata?.role || "staff",
        requestType: primaryType,
        amount: discountAmt,
        title: `ফি ছাড়/মওকুফ অনুমোদন (${discountAmt} টাকা)`,
        description: paymentData.discount_reason || paymentData.notes || "ফি আদায়ে ছাড়/মওকুফ",
        entityType: "fee_payment",
        targetId: paymentData.student_id,
        payload: { action: "collect_fee_payment", paymentData },
      });
      if (hook.matched) {
        return {
          success: true,
          pendingApproval: true,
          approvalRequestId: hook.approvalRequestId,
          message: "ফি ছাড়/মওকুফের জন্য অনুমোদনের আবেদন পাঠানো হয়েছে।",
        };
      }
      if (primaryType === "FEE_DISCOUNT") {
        const waiverHook = await submitWorkflowHookApproval({
          madrasaId,
          actorId: user.id,
          actorName: user.user_metadata?.full_name || user.email || "অফিসার",
          actorRole: user.user_metadata?.role || "staff",
          requestType: "FEE_WAIVER",
          amount: discountAmt,
          title: `ফি মওকুফ অনুমোদন (${discountAmt} টাকা)`,
          description: paymentData.discount_reason || paymentData.notes || "ফি মওকুফ",
          entityType: "fee_payment",
          targetId: paymentData.student_id,
          payload: { action: "collect_fee_payment", paymentData },
        });
        if (waiverHook.matched) {
          return {
            success: true,
            pendingApproval: true,
            approvalRequestId: waiverHook.approvalRequestId,
            message: "ফি মওকুফের জন্য অনুমোদনের আবেদন পাঠানো হয়েছে।",
          };
        }
      }
    }


    // ─────────────────────────────────────────────────────────────────────────
    // HI-2 ফিক্স — ডুপ্লিকেট প্রতিরোধ
    //
    // আগে "১৫ সেকেন্ডে একই শিক্ষার্থীর একই অঙ্কের পেমেন্ট" এলেই সেটি ডুপ্লিকেট ধরে
    // ফেলে পুরোনো রসিদ নম্বর ফিরিয়ে দেওয়া হতো। ফলে ১৫ সেকেন্ডের মধ্যে করা একটি
    // সম্পূর্ণ বৈধ দ্বিতীয় পেমেন্ট (দুই মাসের ফি, দুই ভাইয়ের ফি ইত্যাদি) চুপচাপ
    // হারিয়ে যেত — নগদ জমা হতো অথচ নতুন কোনো রসিদ বা রেকর্ড তৈরি হতো না।
    //
    // এখন ক্লায়েন্ট থেকে আসা `idempotencyKey` দিয়েই কেবল প্রতিরোধ করা হয়
    // (ডাবল-ক্লিক/ডাবল-সাবমিটে একই key পুনরাবৃত্তি হয়) — সময়/অঙ্ক-ভিত্তিক অনুমান নয়।
    // `fee_payments.idempotency_key` কলামটি স্কিমায় আগে থেকেই ছিল, কিন্তু ব্যবহার হতো না।
    // ─────────────────────────────────────────────────────────────────────────
    const idempotencyKey = (paymentData as any).idempotency_key || null;
    if (idempotencyKey) {
      try {
        const { data: existingByKey } = await adminClient
          .from("fee_payments")
          .select("*")
          .eq("madrasa_id", madrasaId)
          .eq("idempotency_key", idempotencyKey)
          .maybeSingle();

        if (existingByKey) {
          return {
            success: true,
            receipt_no: existingByKey.receipt_no,
            receiptNo: existingByKey.receipt_no,
            newPaymentId: existingByKey.id,
            payment: existingByKey,
            message: "পেমেন্টটি ইতিমধ্যে সফলভাবে গ্রহণ করা হয়েছে (ডুপ্লিকেট সাবমিশন প্রতিরোধ করা হয়েছে)।",
          };
        }
      } catch (keyErr) {
        console.warn("Idempotency key check unavailable:", keyErr);
      }
    }

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

    const ctx = await readStudentFeeCollectionContext(madrasaId, paymentData.student_id);
    const now = new Date().toISOString();
    const paymentDate = paymentData.payment_date || toDhakaDateStringFrom(now);

    const studentFees = [...(ctx.student_fees || [])];
    const modifiedFeeIds = new Set<string>();
    const feeTypesList = ctx.fee_types || DEFAULT_FEE_TYPES;

    // Guard 1B: Filter out allocations on invoices that are already fully PAID or due_amount === 0
    if (paymentData.fee_allocations && paymentData.fee_allocations.length > 0) {
      const activeAllocations = [];
      for (const alloc of paymentData.fee_allocations) {
        if (alloc.student_fee_id) {
          const sf = studentFees.find((f) => f.id === alloc.student_fee_id);
          if (sf) {
            const isFullyPaid = (Number(sf.due_amount) <= 0 || sf.status === "PAID" || sf.status === "WAIVED") && (Number(alloc.allocated_amount) > 0);
            if (isFullyPaid) {
              console.warn(`Skipping allocation for already paid invoice ${alloc.student_fee_id}`);
              continue; // Do not allocate on paid invoices
            }
          }
        }
        activeAllocations.push(alloc);
      }

      if (paymentData.fee_allocations.length > 0 && activeAllocations.length === 0 && Number(paymentData.total_amount) > 0) {
        const studentUnpaidFees = studentFees.filter((f) => f.student_id === paymentData.student_id && f.due_amount > 0);
        if (studentUnpaidFees.length === 0) {
          return { error: "এই শিক্ষার্থীর সকল বকেয়া ফি ইতিমধ্যে পরিশোধিত। নতুন কোনো ডুপ্লিকেট পেমেন্ট প্রয়োজন নেই।" };
        }
      }
      paymentData.fee_allocations = activeAllocations;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CR-9 ফিক্স — সার্ভার-সাইড আর্থিক যাচাই
    //
    // আগে `total_amount`, প্রতিটি `allocated_amount` এবং `discount_amount` ক্লায়েন্টের
    // পাঠানো মান হুবহু বিশ্বাস করা হতো। ফলে হাতে-বানানো request দিয়ে
    // total_amount = ১০০ কিন্তু allocated_amount = ৫০,০০০ পাঠালে invoice সম্পূর্ণ PAID
    // হয়ে যেত; আবার অনুমোদনহীন ছাড় বসিয়ে দেওয়া যেত (fee_discount_waivers বাইপাস)।
    // এখন সার্ভারেই যাচাই করা হয়: যোগফল মিলছে কি না এবং ছাড় দেওয়ার অনুমতি আছে কি না।
    // ─────────────────────────────────────────────────────────────────────────
    const requestedTotal = Number(paymentData.total_amount) || 0;
    if (!(requestedTotal > 0)) {
      return { error: "আদায়ের পরিমাণ শূন্যের বেশি হতে হবে।" };
    }

    if (paymentData.fee_allocations && paymentData.fee_allocations.length > 0) {
      const clientAllocSum = paymentData.fee_allocations.reduce(
        (sum, a) => sum + (Number(a.allocated_amount) || 0),
        0
      );
      if (Math.abs(clientAllocSum - requestedTotal) > 0.01) {
        return {
          error:
            `মোট আদায় (${requestedTotal}) ও খাতভিত্তিক বণ্টনের যোগফল (${clientAllocSum}) ` +
            "মিলছে না। পুনরায় যাচাই করে সাবমিট করুন।",
        };
      }
    }

    const requestedDiscount = Number(paymentData.discount_amount) || 0;
    if (requestedDiscount > 0) {
      const discountGuard = await requirePermission({
        userId: user.id,
        madrasaId,
        permissions: ["fee.discount", "fee.waiver", "fee.approve"],
        roles: ["super_admin", "admin", "muhtamim", "accountant"],
        errorMessage: "ফি ছাড় (Discount) দেওয়ার অনুমতি আপনার নেই।",
      });
      if (!discountGuard.allowed) {
        return {
          error:
            (discountGuard.error || "ফি ছাড় দেওয়ার অনুমতি আপনার নেই।") +
            " অনুগ্রহ করে মুহতামিম/হিসাবরক্ষকের অনুমোদন নিন।",
        };
      }
    }

    // Generate formatted unique serial receipt number atomically: MR-YYYY-XXXXX
    const currentYear = getDhakaYear();
    const receiptNo = await generateNextReceiptNumber(adminClient, madrasaId, currentYear);

    const resolveFund = (
      feeTypeId?: string,
      feeTypeName?: string,
      studentFeeId?: string,
      explicitFundId?: string,
      explicitFundName?: string
    ) => {
      if (explicitFundId && explicitFundName) {
        return { fund_id: explicitFundId, fund_name: explicitFundName };
      }
      if (studentFeeId) {
        const sf = studentFees.find((f) => f.id === studentFeeId);
        if (sf?.fund_id && sf?.fund_name) {
          return { fund_id: sf.fund_id, fund_name: sf.fund_name };
        }
      }
      if (feeTypeId) {
        const ft = feeTypesList.find((t: any) => t.id === feeTypeId);
        if (ft?.fund_id && ft?.fund_name) {
          return { fund_id: ft.fund_id, fund_name: ft.fund_name };
        }
      }
      const name = feeTypeName || "";
      const isFood =
        name.includes("বোর্ডিং") ||
        name.includes("খাবার") ||
        name.includes("খোরাকি") ||
        name.includes("hostel") ||
        name.includes("lillah");
      return {
        fund_id: isFood ? "fund-lillah" : "fund-general",
        fund_name: isFood ? "লিল্লাহ বোর্ডিং ফান্ড (Lillah Fund)" : "সাধারণ ফান্ড (General Fund)",
      };
    };

    let amountToDistribute = Number(paymentData.total_amount) || 0;
    const finalAllocations: PaymentAllocation[] = [];

    // Check if total discount was passed and if allocations need discount distribution
    const explicitAllocDiscountTotal = (paymentData.fee_allocations || []).reduce(
      (sum, a) => sum + (Number(a.discount_applied) || 0),
      0
    );
    let unallocatedDiscount = Math.max(0, (Number(paymentData.discount_amount) || 0) - explicitAllocDiscountTotal);

    // Apply allocations if provided, or auto-allocate to unpaid fees
    if (paymentData.fee_allocations && paymentData.fee_allocations.length > 0) {
      for (const alloc of paymentData.fee_allocations) {
        let allocDiscount = Number(alloc.discount_applied) || 0;
        const allocCash = Number(alloc.allocated_amount) || 0;

        // If top-level discount wasn't distributed to items, allocate remaining discount here
        if (allocDiscount === 0 && unallocatedDiscount > 0 && alloc.student_fee_id) {
          const sf = studentFees.find((f) => f.id === alloc.student_fee_id);
          if (sf) {
            const currentItemDue = Number(sf.due_amount) || 0;
            const itemNetRemaining = Math.max(0, currentItemDue - allocCash);
            const takeDiscount = Math.min(unallocatedDiscount, itemNetRemaining);
            if (takeDiscount > 0) {
              allocDiscount += takeDiscount;
              unallocatedDiscount -= takeDiscount;
            }
          }
        }

        if (allocCash > 0 || allocDiscount > 0) {
          const fundInfo = resolveFund(
            alloc.fee_type_id,
            alloc.fee_type_name,
            alloc.student_fee_id,
            alloc.fund_id || paymentData.fund_id,
            alloc.fund_name || paymentData.fund_name
          );

          finalAllocations.push({
            student_fee_id: alloc.student_fee_id,
            fee_type_id: alloc.fee_type_id,
            fee_type_name: alloc.fee_type_name,
            billing_period: alloc.billing_period,
            allocated_amount: allocCash,
            discount_applied: allocDiscount,
            fund_id: fundInfo.fund_id,
            fund_name: fundInfo.fund_name,
          });

          // Update student fee invoice record
          if (alloc.student_fee_id) {
            const feeIdx = studentFees.findIndex((f) => f.id === alloc.student_fee_id);
            if (feeIdx >= 0) {
              const target = studentFees[feeIdx];
              const newDiscount = Number(target.discount_amount || 0) + allocDiscount;
              const baseAmt = Number(target.base_amount || 0);
              const fineAmt = Number(target.fine_amount || 0);
              const newPayable = Math.max(0, baseAmt + fineAmt - newDiscount);
              const newPaid = Number(target.paid_amount || 0) + allocCash;
              const newDue = Math.max(0, newPayable - newPaid);
              let newStatus: FeeStatus = "PARTIAL";
              if (newDue === 0) {
                newStatus = (newPayable === 0 && newDiscount > 0) ? "WAIVED" : "PAID";
              } else if (newPaid === 0) {
                newStatus = "UNPAID";
              }

              studentFees[feeIdx] = {
                ...target,
                discount_amount: newDiscount,
                discount_reason: paymentData.discount_reason || target.discount_reason,
                payable_amount: newPayable,
                paid_amount: newPaid,
                due_amount: newDue,
                status: newStatus,
                updated_at: now,
              };
              modifiedFeeIds.add(target.id);
            }
          }
        }
      }
    } else {
      // Auto-allocate against student's unpaid dues
      const unpaidStudentFees = studentFees
        .filter((f) => f.student_id === paymentData.student_id && f.due_amount > 0)
        .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

      let remainingCash = amountToDistribute;
      let remainingDiscount = Number(paymentData.discount_amount) || 0;

      for (const fee of unpaidStudentFees) {
        if (remainingCash <= 0 && remainingDiscount <= 0) break;

        const feeDue = Number(fee.due_amount) || 0;
        const allocDiscount = Math.min(remainingDiscount, feeDue);
        const dueAfterDiscount = Math.max(0, feeDue - allocDiscount);
        const allocAmt = Math.min(remainingCash, dueAfterDiscount);

        const feeIdx = studentFees.findIndex((f) => f.id === fee.id);
        const newDiscount = Number(fee.discount_amount || 0) + allocDiscount;
        const baseAmt = Number(fee.base_amount || 0);
        const fineAmt = Number(fee.fine_amount || 0);
        const newPayable = Math.max(0, baseAmt + fineAmt - newDiscount);
        const newPaid = Number(fee.paid_amount || 0) + allocAmt;
        const newDue = Math.max(0, newPayable - newPaid);

        let newStatus: FeeStatus = "PARTIAL";
        if (newDue === 0) {
          newStatus = (newPayable === 0 && newDiscount > 0) ? "WAIVED" : "PAID";
        } else if (newPaid === 0) {
          newStatus = "UNPAID";
        }

        studentFees[feeIdx] = {
          ...fee,
          discount_amount: newDiscount,
          discount_reason: paymentData.discount_reason || fee.discount_reason,
          payable_amount: newPayable,
          paid_amount: newPaid,
          due_amount: newDue,
          status: newStatus,
          updated_at: now,
        };
        modifiedFeeIds.add(fee.id);

        const fundInfo = resolveFund(
          fee.fee_type_id,
          fee.fee_type_name,
          fee.id,
          paymentData.fund_id,
          paymentData.fund_name
        );

        finalAllocations.push({
          student_fee_id: fee.id,
          fee_type_id: fee.fee_type_id,
          fee_type_name: fee.fee_type_name,
          billing_period: fee.billing_period,
          allocated_amount: allocAmt,
          discount_applied: allocDiscount,
          fund_id: fundInfo.fund_id,
          fund_name: fundInfo.fund_name,
        });

        remainingDiscount -= allocDiscount;
        remainingCash -= allocAmt;
      }

      // If money left, record as Advance Payment
      if (remainingCash > 0) {
        const advFund = resolveFund(
          undefined,
          paymentData.fee_type || "অগ্রিম জমা (Advance Payment)",
          undefined,
          paymentData.fund_id,
          paymentData.fund_name
        );
        finalAllocations.push({
          fee_type_name: paymentData.fee_type || "অগ্রিম জমা (Advance Payment)",
          billing_period: paymentData.billing_month || "অগ্রিম",
          allocated_amount: remainingCash,
          discount_applied: 0,
          fund_id: advFund.fund_id,
          fund_name: advFund.fund_name,
        });
      }
    }

    if (finalAllocations.length === 0) {
      const defFund = resolveFund(
        undefined,
        paymentData.fee_type || "সাধারণ ফি",
        undefined,
        paymentData.fund_id,
        paymentData.fund_name
      );
      finalAllocations.push({
        fee_type_name: paymentData.fee_type || "সাধারণ ফি",
        billing_period: paymentData.billing_month || "হালনাগাদ",
        allocated_amount: amountToDistribute,
        fund_id: defFund.fund_id,
        fund_name: defFund.fund_name,
      });
    }

    const primaryFundId =
      paymentData.fund_id || finalAllocations[0]?.fund_id || "fund-general";
    const primaryFundName =
      paymentData.fund_name || finalAllocations[0]?.fund_name || "সাধারণ ফান্ড (General Fund)";

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
      fund_id: primaryFundId,
      fund_name: primaryFundName,
      total_amount_received: amountToDistribute,
      payment_date: paymentDate,
      payment_method: paymentData.payment_method || "Cash",
      transaction_ref: paymentData.transaction_ref,
      allocations: finalAllocations,
      discount_total: Math.max(
        Number(paymentData.discount_amount) || 0,
        finalAllocations.reduce((sum, a) => sum + (Number(a.discount_applied) || 0), 0)
      ),
      fine_total: Number(paymentData.fine_amount) || 0,
      advance_amount: finalAllocations
        .filter((a) => (a.billing_period || "").includes("অগ্রিম"))
        .reduce((sum, a) => sum + (Number(a.allocated_amount) || 0), 0),
      idempotency_key: idempotencyKey || undefined,
      collector_name: user.email?.split("@")[0] || "হিসাব বিভাগ",
      notes: paymentData.notes,
      status: "COMPLETED",
      created_at: now,
    };

    const auditLogEntry: FeeAuditLog = {
      id: `audit_${Date.now()}`,
      madrasa_id: madrasaId,
      action: "COLLECT_FEE_PAYMENT",
      user_name: user.email || "হিসাবরক্ষক",
      user_role: "accountant",
      record_id: newPayment.id,
      details: `${studentFullName} (${studentClass}, রোল: ${studentRoll})-এর কাছ থেকে ৳${amountToDistribute} ফি গ্রহণ করা হয়েছে। রিসিট নং: ${receiptNo}`,
      created_at: now,
    };

    const modifiedStudentFees = studentFees.filter((sf) => modifiedFeeIds.has(sf.id));

    const saved = await saveSingleFeeCollection(madrasaId, {
      modifiedStudentFees,
      newPayment,
      auditLogEntry,
    });
    if (!saved) {
      return { error: "পেমেন্ট গ্রহণের তথ্য ডেটাবেজে সংরক্ষণ করা সম্ভব হয়নি। অনুগ্রহ করে আবার চেষ্টা করুন। (টাকা জমা হিসেবে গণ্য হয়নি)" };
    }

    // Legacy `fees` টেবিলে ব্যাকওয়ার্ড-কম্প্যাটিবিলিটির জন্য row (best effort, কখনো ফ্যাটাল নয়)
    let legacyFeeId: string | undefined;
    try {
      const { data: dbFee } = await supabase
        .from("fees")
        .insert({
          madrasa_id: madrasaId,
          student_id: paymentData.student_id,
          fee_type:
            paymentData.fee_type ||
            (finalAllocations[0]?.fee_type_name.includes("Admission") ? "Admission" : "Monthly"),
          amount: amountToDistribute,
          payment_date: paymentDate,
          fee_month:
            paymentData.billing_month ||
            new Date(paymentDate).toLocaleString("en-US", { month: "long" }),
          fee_year: paymentData.billing_year ? parseInt(paymentData.billing_year) : currentYear,
          notes: `[রিসিট: ${receiptNo}] ${paymentData.notes || ""}`,
        })
        .select("id")
        .single();

      if (dbFee?.id) {
        legacyFeeId = dbFee.id;
        newPayment.db_fee_id = dbFee.id;
        // Targeted single-row update for db_fee_id instead of re-upserting all payments
        try {
          await adminClient
            .from("fee_payments")
            .update({ db_fee_id: dbFee.id })
            .eq("id", newPayment.id)
            .eq("madrasa_id", madrasaId);
        } catch (dbIdErr) {
          console.warn("db_fee_id relational update warning:", dbIdErr);
        }
      }
    } catch (legacyErr) {
      console.warn("Legacy fees table insert skipped:", legacyErr);
    }

    await logAuditEvent({
      madrasaId,
      actorId: user.id,
      actorName: collectGuard.context?.profile?.fullName || user.email || "হিসাব বিভাগ",
      actorEmail: user.email || null,
      actorRole: collectGuard.context?.role || null,
      module: "fees",
      action: "FEE_PAYMENT_COLLECTED",
      entityType: "fee_payment",
      entityId: newPayment.id,
      entityLabel: `${receiptNo} · ${newPayment.student_name}`,
      summary: `রসিদ নং ${receiptNo} — ${newPayment.student_name}-এর নিকট থেকে ৳${Number(newPayment.total_amount_received || 0)} ফি আদায় করা হয়েছে (${paymentData.payment_method})।`,
      newValue: {
        receipt_no: receiptNo,
        student_id: paymentData.student_id,
        student_name: newPayment.student_name,
        total_amount_received: newPayment.total_amount_received,
        discount_total: newPayment.discount_total,
        fine_total: newPayment.fine_total,
        payment_date: paymentDate,
        payment_method: paymentData.payment_method,
      },
      severity: Number(newPayment.discount_total || 0) > 0 ? "WARNING" : "INFO",
    });

    revalidatePath("/dashboard/accounting");
    revalidatePath("/dashboard/accounting/fees");
    revalidatePath("/portal/fees");
    revalidatePath("/portal");
    revalidatePath("/dashboard/accounting/due");
    revalidatePath("/dashboard/accounting/receipts");
    revalidatePath("/dashboard/accounting/payments");
    revalidatePath(`/dashboard/students/${paymentData.student_id}`);
    revalidatePath("/portal/fees");

    // Serverless-safe non-blocking webhook event for payment confirmation via Next.js after()
    const webhookPayload = {
      payment_id: newPayment.id,
      receipt_no: receiptNo,
      student_id: paymentData.student_id,
      student_name: newPayment.student_name,
      class_name: newPayment.class_name,
      amount: newPayment.total_amount_received,
      payment_method: newPayment.payment_method,
      payment_date: paymentDate,
      status: newPayment.status,
    };
    try {
      after(async () => {
        try {
          const { dispatchWebhookEvent } = await import("@/lib/webhooks/dispatcher");
          await dispatchWebhookEvent(madrasaId, "payment.confirmed", webhookPayload);
        } catch {
          // non-blocking webhook dispatch
        }
      });
    } catch {
      // Fallback if called outside a Next.js request scope (e.g. unit test runner)
      import("@/lib/webhooks/dispatcher")
        .then(({ dispatchWebhookEvent }) =>
          dispatchWebhookEvent(madrasaId, "payment.confirmed", webhookPayload)
        )
        .catch(() => {});
    }

    return {
      success: true,
      message: "ফি সফলভাবে আদায় করা হয়েছে এবং মানি রিসিট প্রস্তুত করা হয়েছে!",
      payment: newPayment,
      fee_id: legacyFeeId || newPayment.id,
      receipt_no: receiptNo,
    };
  } catch (err: any) {
    console.error("Error in collectFeePayment:", err);
    return { error: err.message || "ফি কালেকশন সম্পন্ন করতে সমস্যা হয়েছে।" };
  }
}

/**
 * Helper to get all unified fee payments (merged from metadata and database fees table)
 */
export async function getUnifiedFeePayments(madrasaId: string): Promise<FeePayment[]> {
  try {
    const i=await webIdentity(); if (!i || i.tenant!==madrasaId || !canReadFinance(i)) return [];
    const [meta,legacy,students]=await Promise.all([readFeeStore(madrasaId),rows(()=>i.db.from('fees').select('*').eq('madrasa_id',madrasaId)),rows(()=>i.db.from('students').select('id,first_name,last_name,roll_number,class_name').eq('madrasa_id',madrasaId))]);
    const people=new Map(students.map(s=>[s.id,s]));
    return reconcilePayments(meta.payments || [],legacy,true).map(p=>{
      const student=people.get(p.student_id);
      return {...p,student_name:p.student_name || [student?.first_name,student?.last_name].filter(Boolean).join(' '),student_roll:p.student_roll || student?.roll_number,class_name:p.class_name || student?.class_name};
    });
  } catch (err) {
    console.error("Error in getUnifiedFeePayments:", err);
    return [];
  }
}

/**
 * Soft Delete / Void a Single Fee Payment safely with reason and audit trail
 */
export async function deleteSingleFeePayment(paymentId: string, reason: string = "ভুল এন্ট্রি বাতিল") {
  return voidFeePayment(paymentId, reason);
}

/**
 * Reset / Clean All Fee Data (Payments and/or Invoices)
 */
export async function resetAllFeeData(options: {
  deletePayments?: boolean;
  resetInvoices?: boolean;
  resetReceiptCounter?: boolean;
}) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অননুমোদিত অ্যাক্সেস" };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "মাদরাসা পাওয়া যায়নি" };

    // CR-2 ফিক্স: সার্ভার-সাইড অনুমতি যাচাই (আগে শুধু `if (!user)` ছিল)
    const guard = await requirePermission({
      userId: user.id,
      madrasaId,
      permissions: ["finance.delete", "fee.edit"],
      roles: ["super_admin", "admin", "muhtamim"],
      riskLevel: "CRITICAL",
      actionScope: "fee_data.bulk_reset",
    });
    if (!guard.allowed) {
      return {
        error: guard.error || "এই কাজটি করার অনুমতি নেই।",
        stepUpRequired: guard.stepUpRequired,
        errorCode: guard.errorCode,
      };
    }

    const meta = await getFeeMetadata(madrasaId);
    let currentStudentFees = [...(meta.student_fees || [])];
    let currentPayments = [...(meta.payments || [])];
    let currentReceiptCounter = meta.receipt_counter || 100;

    let clearedPaymentsCount = currentPayments.length;

    // 1. Delete all payments
    if (options.deletePayments) {
      currentPayments = [];

      // Delete from SQL fees table
      try {
        const adminClient = await createAdminClient();
        const { count } = await adminClient
          .from("fees")
          .delete({ count: "exact" })
          .eq("madrasa_id", madrasaId);
        if (count) clearedPaymentsCount += count;
      } catch (e) {
        console.warn("Could not delete from fees table:", e);
      }

      // Reset student fees paid amounts back to unpaid if invoices are kept
      if (!options.resetInvoices) {
        currentStudentFees = currentStudentFees.map((f) => ({
          ...f,
          paid_amount: 0,
          due_amount: f.payable_amount,
          status: f.payable_amount === 0 ? "WAIVED" : "UNPAID",
          updated_at: new Date().toISOString(),
        }));
      }
    }

    // 2. Reset or delete all student fee invoices
    if (options.resetInvoices) {
      currentStudentFees = [];
    }

    if (options.resetReceiptCounter) {
      currentReceiptCounter = 100;
    }

    const auditLogs = meta.audit_logs || [];
    auditLogs.unshift({
      id: `audit_${Date.now()}`,
      madrasa_id: madrasaId,
      action: "RESET_ALL_FEE_DATA",
      user_name: user.email || "সুপার অ্যাডমিন",
      user_role: "super_admin",
      details: `ফি কালেকশন ডাটা রিসেট সম্পন্ন হয়েছে। (পেমেন্ট মুছে ফেলা হয়েছে: ${options.deletePayments ? "হ্যাঁ" : "না"}, ইনভয়েস রিসেট: ${options.resetInvoices ? "হ্যাঁ" : "না"})`,
      created_at: new Date().toISOString(),
    });

    await saveFeeMetadata(madrasaId, {
      student_fees: currentStudentFees,
      payments: currentPayments,
      receipt_counter: currentReceiptCounter,
      audit_logs: auditLogs.slice(0, 100),
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/accounting");
    revalidatePath("/dashboard/accounting/payments");
    revalidatePath("/portal/fees");
    revalidatePath("/portal");
    revalidatePath("/dashboard/accounting/due");
    revalidatePath("/dashboard/accounting/income");
    revalidatePath("/dashboard/accounting/fees");
    revalidatePath("/dashboard/accounting/generate");
    revalidatePath("/dashboard/zakat");

    return {
      success: true,
      message: "ফি ও কালেকশন ডাটা সফলভাবে রিসেট ও ক্লিনআপ করা হয়েছে।",
      clearedPaymentsCount,
    };
  } catch (err: any) {
    console.error("Error in resetAllFeeData:", err);
    return { error: err.message || "ফি ডাটা রিসেট করতে সমস্যা হয়েছে।" };
  }
}

/**
 * 1-Click Sync Fees with Funds
 */
export async function syncFeesWithFunds(): Promise<{
  success?: boolean;
  error?: string;
  message?: string;
  report?: {
    payments: number;
    allocations: number;
    mismatchedPayments: number;
    duplicateAllocations: number;
    orphanAllocations: number;
  };
}> {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অননুমোদিত অ্যাক্সেস। অনুগ্রহ করে লগইন করুন।" };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "মাদ্রাসা সনাক্ত করা যায়নি।" };

    // CR-2 ফিক্স: সার্ভার-সাইড অনুমতি যাচাই
    const guard = await requirePermission({
      userId: user.id,
      madrasaId,
      permissions: ["fee.edit", "finance.edit", "finance.approve"],
      roles: ["super_admin", "admin", "muhtamim", "accountant"],
    });
    if (!guard.allowed) return { error: guard.error || "এই কাজটি করার অনুমতি নেই।" };

    // ⛔ L-4 ফিক্স: আগে এই ফাংশনটি **কিছুই করত না** — শুধু কয়েকটি revalidatePath
    // কল করে "সকল ফি কালেকশন ও ফান্ড ব্যালেন্স সফলভাবে রিক্যালকুলেট ও সিঙ্ক করা হয়েছে!"
    // মেসেজ দেখাত। ফান্ড ব্যালেন্স আসলে লাইভ ডেটা (fee_payments + allocations) থেকে
    // হিসাব হয়, তাই "রিক্যালকুলেশন" নামের কোনো কাজই ছিল না — ব্যবহারকারী ভাবতেন কিছু
    // ঠিক হয়ে গেল, অথচ ডুপ্লিকেট অ্যালোকেশন/অসম পেমেন্ট রয়ে যেত।
    //
    // এখন এটি একটি প্রকৃত যাচাই (integrity audit) চালায় এবং সত্যি ফলাফল জানায়:
    //   • প্রতি পেমেন্টের allocations-এর যোগফল payment-এর মোট অঙ্কের সাথে মেলে কি না
    //   • একই পেমেন্টে একই fee_type + billing_period বারবার আছে কি না (CR-7-এর ক্ষতি)
    //   • কোনো পেমেন্ট ছাড়া পড়ে থাকা orphan allocation আছে কি না
    // কিছু অমিল পাওয়া গেলে message-এ সেটি স্পষ্টভাবে বলা হয়।
    const adminClient = await createAdminClient();

    const [{ data: paymentRows }, { data: allocationRows }] = await Promise.all([
      adminClient
        .from("fee_payments")
        .select("id, total_amount_received, status")
        .eq("madrasa_id", madrasaId)
        .limit(10000),
      adminClient
        .from("fee_payment_allocations")
        .select("payment_id, fee_type_id, billing_period, allocated_amount")
        .eq("madrasa_id", madrasaId)
        .limit(20000),
    ]);

    const payments = paymentRows || [];
    const allocations = allocationRows || [];

    const allocationsByPayment = new Map<string, { sum: number; keys: Map<string, number> }>();
    for (const a of allocations as any[]) {
      const pid = String(a.payment_id || "");
      if (!pid) continue;
      const bucket = allocationsByPayment.get(pid) || { sum: 0, keys: new Map<string, number>() };
      bucket.sum += Number(a.allocated_amount) || 0;
      const dedupeKey = `${a.fee_type_id || "?"}|${a.billing_period || "?"}`;
      bucket.keys.set(dedupeKey, (bucket.keys.get(dedupeKey) || 0) + 1);
      allocationsByPayment.set(pid, bucket);
    }

    let mismatchedPayments = 0;
    let duplicateAllocations = 0;

    for (const p of payments as any[]) {
      if (String(p.status || "").toUpperCase() !== "COMPLETED") continue;
      const bucket = allocationsByPayment.get(String(p.id));
      if (!bucket) continue;
      const received = Number(p.total_amount_received) || 0;
      if (Math.abs(bucket.sum - received) > 0.01) mismatchedPayments++;
    }

    allocationsByPayment.forEach((bucket) => {
      bucket.keys.forEach((count, key) => {
        // একই fee_type + billing_period একাধিক বার = ঐতিহাসিক ডুপ্লিকেট (আয় ফুলে ওঠার কারণ)
        if (count > 1) duplicateAllocations += count - 1;
        void key;
      });
    });

    const paymentIds = new Set(payments.map((p: any) => String(p.id)));
    const orphanAllocations = (allocations as any[]).filter(
      (a) => a.payment_id && !paymentIds.has(String(a.payment_id))
    ).length;

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/accounting");
    revalidatePath("/dashboard/accounting/payments");
    revalidatePath("/dashboard/accounting/income");
    revalidatePath("/dashboard/zakat");
    revalidatePath("/dashboard/funds");

    const report = {
      payments: payments.length,
      allocations: allocations.length,
      mismatchedPayments,
      duplicateAllocations,
      orphanAllocations,
    };

    const problems = mismatchedPayments + duplicateAllocations + orphanAllocations;
    if (problems > 0) {
      return {
        success: true,
        report,
        message:
          `যাচাই সম্পন্ন: ${payments.length} টি পেমেন্ট ও ${allocations.length} টি অ্যালোকেশন পরীক্ষা করা হয়েছে। ` +
          `⚠️ ${duplicateAllocations} টি ডুপ্লিকেট অ্যালোকেশন, ${mismatchedPayments} টি অমিল পেমেন্ট এবং ` +
          `${orphanAllocations} টি অনাথ অ্যালোকেশন পাওয়া গেছে — বিস্তারিত দেখতে "পেমেন্ট ইতিহাস" ও রিপোর্ট ব্যবহার করুন।`,
      };
    }

    return {
      success: true,
      report,
      message:
        `যাচাই সম্পন্ন: ${payments.length} টি পেমেন্ট ও ${allocations.length} টি অ্যালোকেশন — ` +
        `কোনো ডুপ্লিকেট, অমিল বা অনাথ রেকর্ড পাওয়া যায়নি। ফান্ডের ব্যালেন্স লাইভ ডেটা থেকেই হিসাব হচ্ছে।`,
    };
  } catch (err: any) {
    return { error: err.message || "যাচাই করতে ব্যর্থ হয়েছে।" };
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

    // CR-2 ফিক্স: সার্ভার-সাইড অনুমতি যাচাই (আগে শুধু `if (!user)` ছিল)
    const guard = await requirePermission({
      userId: user.id,
      madrasaId,
      permissions: ["fee.edit", "finance.edit"],
      roles: ["super_admin", "admin", "muhtamim", "accountant"],
    });
    if (!guard.allowed) return { error: guard.error || "এই কাজটি করার অনুমতি নেই।" };

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
          // ⛔ HI-1 ফিক্স: আগে শুধু paid_amount ফেরানো হতো, discount_amount ফেরানো
          // হতো না। অথচ আদায়ের সময় ডিসকাউন্ট invoice-এর payable_amount-এ স্থায়ীভাবে
          // বসে যেত — ফলে রসিদ বাতিল করলে ছাড়ও স্থায়ী থেকে যেত এবং বকেয়া কম ধরা পড়ত
          // (যেমন base ১০০০, ছাড় ২০০, পরিশোধ ৮০০ → বাতিলের পর বকেয়া ৮০০ দেখাত, ১০০০ নয়)।
          // এখন paid_amount ও discount_amount দুটোই ফেরানো হয়।
          const revertedDiscount = Number((alloc as any).discount_applied || 0);
          const baseAmt = Number((target as any).base_amount || 0);
          const fineAmt = Number((target as any).fine_amount || 0);
          const newDiscount = Math.max(0, Number(target.discount_amount || 0) - revertedDiscount);
          const newPayable = Math.max(0, baseAmt + fineAmt - newDiscount);
          const newPaid = Math.max(0, Number(target.paid_amount || 0) - Number(alloc.allocated_amount || 0));
          const newDue = Math.max(0, newPayable - newPaid);
          let newStatus: FeeStatus = "PARTIAL";
          if (newPayable === 0 && newDiscount > 0) {
            newStatus = "WAIVED";
          } else if (newDue === 0 && newPaid > 0) {
            newStatus = "PAID";
          } else if (newPaid === 0) {
            newStatus = "UNPAID";
          } else {
            newStatus = "PARTIAL";
          }

          studentFees[feeIdx] = {
            ...target,
            paid_amount: newPaid,
            due_amount: newDue,
            status: newStatus,
            updated_at: now,
          };

          try {
            const adminClient = await createAdminClient();
            await adminClient.from("student_fees").update({
              paid_amount: newPaid,
              // HI-1: ডিসকাউন্ট ও পুনঃগণিত payable-ও ফেরত লিখতে হবে
              discount_amount: newDiscount,
              payable_amount: newPayable,
              due_amount: newDue,
              status: newStatus,
              updated_at: now,
            }).eq("id", target.id).eq("madrasa_id", madrasaId);
          } catch (sfErr) {
            console.warn("Direct student_fees update err on reverse:", sfErr);
          }
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

    // Update in relational fee_payments table
    try {
      const adminClient = await createAdminClient();
      await adminClient.from("fee_payments").update({
        status: "REVERSED",
        notes: `[REVERSED: ${reason}] ${payment.notes || ""}`,
      }).eq("id", payment.id).eq("madrasa_id", madrasaId);
      if (payment.receipt_no) {
        await adminClient.from("fee_payments").update({
          status: "REVERSED",
          notes: `[REVERSED: ${reason}] ${payment.notes || ""}`,
        }).eq("receipt_no", payment.receipt_no).eq("madrasa_id", madrasaId);
      }
    } catch (eRel) {
      console.warn("Relational fee_payments update status err on reverse:", eRel);
    }

    // Clean up legacy fees table row if present
    try {
      if (payment.db_fee_id) {
        await supabase.from("fees").delete().eq("id", payment.db_fee_id).eq("madrasa_id", madrasaId);
      }
      if (payment.receipt_no) {
        await supabase.from("fees").delete().like("notes", `%${payment.receipt_no}%`).eq("madrasa_id", madrasaId);
      }
      await supabase.from("fees").delete().eq("id", payment.id).eq("madrasa_id", madrasaId);
    } catch (e) {
      console.warn("Could not delete from legacy fees table:", e);
    }

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
    revalidatePath("/portal/fees");
    revalidatePath("/portal");
    revalidatePath("/dashboard/accounting/due");

    return { success: true, message: "পেমেন্ট সফলভাবে রিভার্স করা হয়েছে এবং বকেয়া পুনর্স্থাপন করা হয়েছে।" };
  } catch (err: any) {
    console.error("Error in reverseFeePayment:", err);
    return { error: err.message || "পেমেন্ট রিভার্স করতে সমস্যা হয়েছে।" };
  }
}

/**
 * Void a Fee Payment (Soft Cancellation with Reason, Rollback of Dues, Immutable Audit Log)
 */
export async function voidFeePayment(paymentId: string, reason: string) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অননুমোদিত অ্যাক্সেস" };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "মাদরাসা পাওয়া যায়নি" };

    // CR-2 ফিক্স: সার্ভার-সাইড অনুমতি যাচাই (আগে শুধু `if (!user)` ছিল)
    const guard = await requirePermission({
      userId: user.id,
      madrasaId,
      permissions: ["fee.edit", "finance.edit"],
      roles: ["super_admin", "admin", "muhtamim", "accountant"],
    });
    if (!guard.allowed) return { error: guard.error || "এই কাজটি করার অনুমতি নেই।" };

    if (!reason || !reason.trim()) {
      return { error: "রসিদ বাতিলের সুনির্দিষ্ট কারণ লেখা আবশ্যক।" };
    }

    const meta = await getFeeMetadata(madrasaId);
    const payments = [...(meta.payments || [])];
    const studentFees = [...(meta.student_fees || [])];

    const payIdx = payments.findIndex((p) => p.id === paymentId || p.receipt_no === paymentId);
    if (payIdx === -1) {
      return { error: "পেমেন্ট রেকর্ড পাওয়া যায়নি।" };
    }

    const payment = payments[payIdx];
    if (payment.status === "VOID" || payment.status === "REVERSED") {
      return { error: "এই রসিদটি ইতিপূর্বেই বাতিল করা হয়েছে।" };
    }

    const periodLock = await assertAccountingPeriodUnlocked(
      madrasaId,
      payment.payment_date || payment.created_at,
      "রসিদ বাতিল (VOID)"
    );
    if (periodLock.locked) {
      return { error: periodLock.error };
    }

    const now = new Date().toISOString();

    // 1. Rollback allocations from student fees
    for (const alloc of payment.allocations || []) {
      if (alloc.student_fee_id) {
        const feeIdx = studentFees.findIndex((f) => f.id === alloc.student_fee_id);
        if (feeIdx >= 0) {
          const target = studentFees[feeIdx];
          // ⛔ HI-1 ফিক্স: void করার সময়ও ডিসকাউন্ট ফেরানো হয় (reverse path-এর মতোই)
          const revertedDiscount = Number((alloc as any).discount_applied || 0);
          const baseAmt = Number((target as any).base_amount || 0);
          const fineAmt = Number((target as any).fine_amount || 0);
          const newDiscount = Math.max(0, Number(target.discount_amount || 0) - revertedDiscount);
          const newPayable = Math.max(0, baseAmt + fineAmt - newDiscount);
          const newPaid = Math.max(0, Number(target.paid_amount || 0) - Number(alloc.allocated_amount || 0));
          const newDue = Math.max(0, newPayable - newPaid);
          let newStatus: FeeStatus = "PARTIAL";
          if (newPayable === 0 && newDiscount > 0) {
            newStatus = "WAIVED";
          } else if (newDue === 0 && newPaid > 0) {
            newStatus = "PAID";
          } else if (newPaid === 0) {
            newStatus = "UNPAID";
          } else {
            newStatus = "PARTIAL";
          }

          studentFees[feeIdx] = {
            ...target,
            paid_amount: newPaid,
            due_amount: newDue,
            status: newStatus,
            updated_at: now,
          };

          try {
            const adminClient = await createAdminClient();
            await adminClient.from("student_fees").update({
              paid_amount: newPaid,
              discount_amount: newDiscount,
              payable_amount: newPayable,
              due_amount: newDue,
              status: newStatus,
              updated_at: now,
            }).eq("id", target.id).eq("madrasa_id", madrasaId);
          } catch (sfErr) {
            console.warn("Direct student_fees update err on void:", sfErr);
          }
        }
      }
    }

    // 2. Mark payment as VOID
    payments[payIdx] = {
      ...payment,
      status: "VOID",
      cancellation_reason: reason.trim(),
      reversal_reason: reason.trim(),
      voided_at: now,
      voided_by: user.email || "অ্যাডমিন",
    };

    // 3. Update relational fee_payments table
    try {
      const adminClient = await createAdminClient();
      await adminClient.from("fee_payments").update({
        status: "VOID",
        notes: `[VOID: ${reason.trim()}] ${payment.notes || ""}`,
      }).eq("id", payment.id).eq("madrasa_id", madrasaId);
      if (payment.receipt_no) {
        await adminClient.from("fee_payments").update({
          status: "VOID",
          notes: `[VOID: ${reason.trim()}] ${payment.notes || ""}`,
        }).eq("receipt_no", payment.receipt_no).eq("madrasa_id", madrasaId);
      }
    } catch (eRel) {
      console.warn("Relational fee_payments update status err on void:", eRel);
    }

    // 4. Update legacy fees table so it doesn't count towards income
    try {
      if (payment.db_fee_id) {
        await supabase.from("fees").delete().eq("id", payment.db_fee_id).eq("madrasa_id", madrasaId);
      }
      if (payment.receipt_no) {
        await supabase.from("fees").delete().like("notes", `%${payment.receipt_no}%`).eq("madrasa_id", madrasaId);
      }
      await supabase.from("fees").delete().eq("id", payment.id).eq("madrasa_id", madrasaId);
    } catch (e) {
      console.warn("Could not delete from legacy fees table:", e);
    }

    // 5. Immutable audit log
    const auditLogs = meta.audit_logs || [];
    auditLogs.unshift({
      id: `audit_${Date.now()}`,
      madrasa_id: madrasaId,
      action: "VOID_FEE_PAYMENT",
      user_name: user.email || "অ্যাডমিন",
      user_role: "admin",
      record_id: payment.id,
      details: `রসিদ নং ${payment.receipt_no} (পরিমাণ: ৳${payment.total_amount_received}) বাতিল (VOID) করা হয়েছে। কারণ: ${reason.trim()}`,
      created_at: now,
    });

    const saved = await saveFeeMetadata(madrasaId, {
      student_fees: studentFees,
      payments,
      audit_logs: auditLogs.slice(0, 100),
    });
    if (!saved) {
      return { error: "রসিদ বাতিল করার তথ্য ডেটাবেজে সংরক্ষণ করা সম্ভব হয়নি। অনুগ্রহ করে আবার চেষ্টা করুন।" };
    }

    await logAuditEvent({
      madrasaId,
      actorId: user.id,
      actorEmail: user.email || null,
      actorName: user.user_metadata?.full_name || user.email || "অ্যাডমিন",
      actorRole: guard.context?.role || "admin",
      module: "fees",
      action: "FEE_PAYMENT_VOIDED",
      entityType: "fee_payment",
      entityId: payment.id,
      entityLabel: payment.receipt_no || payment.id,
      summary: `রসিদ নং ${payment.receipt_no || payment.id} (৳${payment.total_amount_received}) বাতিল (VOID) করা হয়েছে। কারণ: ${reason.trim()}`,
      oldValue: {
        status: payment.status,
        total_amount_received: payment.total_amount_received,
        payment_date: payment.payment_date,
        student_id: payment.student_id,
      },
      newValue: {
        status: "VOID",
        cancellation_reason: reason.trim(),
        voided_at: now,
      },
      severity: "CRITICAL",
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/accounting");
    revalidatePath("/dashboard/accounting/payments");
    revalidatePath("/portal/fees");
    revalidatePath("/portal");
    revalidatePath("/dashboard/accounting/due");
    revalidatePath("/dashboard/accounting/income");
    revalidatePath("/dashboard/accounting/receipts");

    return {
      success: true,
      message: `রসিদ নং ${payment.receipt_no} সফলভাবে বাতিল (VOID) করা হয়েছে এবং বকেয়া পুনর্বহাল করা হয়েছে।`,
      payment: payments[payIdx],
    };
  } catch (err: any) {
    console.error("Error in voidFeePayment:", err);
    return { error: err.message || "রসিদ বাতিল করতে সমস্যা হয়েছে।" };
  }
}

/**
 * Super Admin Unvoid / Reactivate a previously voided payment
 */
export async function unvoidFeePayment(paymentId: string, reason: string) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অননুমোদিত অ্যাক্সেস" };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "মাদরাসা পাওয়া যায়নি" };

    // CR-2 ফিক্স: সার্ভার-সাইড অনুমতি যাচাই (আগে শুধু `if (!user)` ছিল)
    const guard = await requirePermission({
      userId: user.id,
      madrasaId,
      permissions: ["finance.delete", "fee.edit"],
      roles: ["super_admin", "admin", "muhtamim"],
    });
    if (!guard.allowed) return { error: guard.error || "এই কাজটি করার অনুমতি নেই।" };

    const meta = await getFeeMetadata(madrasaId);
    const payments = [...(meta.payments || [])];
    const studentFees = [...(meta.student_fees || [])];

    const payIdx = payments.findIndex((p) => p.id === paymentId || p.receipt_no === paymentId);
    if (payIdx === -1) return { error: "পেমেন্ট রেকর্ড পাওয়া যায়নি।" };

    const payment = payments[payIdx];
    if (payment.status !== "VOID" && payment.status !== "REVERSED") {
      return { error: "এই রসিদটি ইতিমধ্যে সক্রিয় রয়েছে।" };
    }

    const now = new Date().toISOString();

    // Re-apply allocations to student fees
    for (const alloc of payment.allocations || []) {
      if (alloc.student_fee_id) {
        const feeIdx = studentFees.findIndex((f) => f.id === alloc.student_fee_id);
        if (feeIdx >= 0) {
          const target = studentFees[feeIdx];
          const newPaid = Number(target.paid_amount || 0) + Number(alloc.allocated_amount || 0);
          const newDue = Math.max(0, Number(target.payable_amount || 0) - newPaid);
          let newStatus: FeeStatus = "PARTIAL";
          if (newDue === 0) {
            newStatus = "PAID";
          } else if (newPaid === 0) {
            newStatus = "UNPAID";
          }

          studentFees[feeIdx] = {
            ...target,
            paid_amount: newPaid,
            due_amount: newDue,
            status: newStatus,
            updated_at: now,
          };

          try {
            const adminClient = await createAdminClient();
            await adminClient.from("student_fees").update({
              paid_amount: newPaid,
              due_amount: newDue,
              status: newStatus,
              updated_at: now,
            }).eq("id", target.id).eq("madrasa_id", madrasaId);
          } catch (sfErr) {
            console.warn("Direct student_fees update err on unvoid:", sfErr);
          }
        }
      }
    }

    // Set payment back to COMPLETED
    payments[payIdx] = {
      ...payment,
      status: "COMPLETED",
      notes: `${payment.notes || ""} [UNVOIDED: ${reason.trim() || "পুনরায় সক্রিয়"}]`,
    };

    // Update relational fee_payments table
    try {
      const adminClient = await createAdminClient();
      await adminClient.from("fee_payments").update({
        status: "COMPLETED",
        notes: payments[payIdx].notes,
      }).eq("id", payment.id).eq("madrasa_id", madrasaId);
    } catch (eRel) {
      console.warn("Relational fee_payments update status err on unvoid:", eRel);
    }

    // Audit log
    const auditLogs = meta.audit_logs || [];
    auditLogs.unshift({
      id: `audit_${Date.now()}`,
      madrasa_id: madrasaId,
      action: "UNVOID_FEE_PAYMENT",
      user_name: user.email || "অ্যাডমিন",
      user_role: "admin",
      record_id: payment.id,
      details: `রসিদ নং ${payment.receipt_no} পুনরায় সক্রিয় করা হয়েছে। কারণ: ${reason.trim()}`,
      created_at: now,
    });

    await saveFeeMetadata(madrasaId, {
      student_fees: studentFees,
      payments,
      audit_logs: auditLogs.slice(0, 100),
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/accounting");
    revalidatePath("/dashboard/accounting/payments");
    revalidatePath("/portal/fees");
    revalidatePath("/portal");
    revalidatePath("/dashboard/accounting/due");
    revalidatePath("/dashboard/accounting/income");

    return {
      success: true,
      message: `রসিদ নং ${payment.receipt_no} সফলভাবে পুনরায় সক্রিয় করা হয়েছে।`,
      payment: payments[payIdx],
    };
  } catch (err: any) {
    console.error("Error in unvoidFeePayment:", err);
    return { error: err.message || "রসিদ পুনরায় সক্রিয় করতে সমস্যা হয়েছে।" };
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
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("finance");
    if (!__authz.allowed) return __authz.fallback;
  }

  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return null;

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return null;

    const [meta,legacy,students]=await Promise.all([getFeeMetadata(madrasaId),rows(()=>supabase.from('fees').select('*').eq('madrasa_id',madrasaId)),rows(()=>supabase.from('students').select('id,first_name,last_name,class_name,roll_number').eq('madrasa_id',madrasaId))]);
    const studentFees = meta.student_fees || [];
    const people=new Map(students.map(s=>[s.id,s]));
    const unifiedPayments = reconcilePayments(meta.payments || [],legacy).map(p=>({...p,student_name:p.student_name || [people.get(p.student_id)?.first_name,people.get(p.student_id)?.last_name].filter(Boolean).join(' ')}));
    // Dates for current month and today
    const now = new Date();
    // P2-Fix: চলতি বছর/মাস ঢাকা টাইমজোনে
    const currentMonthStr = toDhakaMonthString(now); // "YYYY-MM"
    const currentYear = Number(currentMonthStr.slice(0, 4));
    const currentMonthNum = Number(currentMonthStr.slice(5, 7));
    const todayStr = toDhakaDateString(now);

    // Total Collection
    const totalCollected = unifiedPayments.reduce((sum, p) => sum + (Number(p.total_amount_received) || 0), 0);
    const totalDue = studentFees.reduce((sum, f) => sum + (Number(f.due_amount) || 0), 0);

    // ⛔ MD-4 ফিক্স: "আদায় হার" KPI-এর জন্য ডেটা।
    //
    // আগে ড্যাশবোর্ডে হার হিসাব হতো এভাবে: আদায় = *আজীবনের সব পেমেন্ট*,
    // বকেয়া = *সব সেশনের student_fees.due_amount*। দুই পাশ ভিন্ন সময়-পরিসরের ডেটা
    // হওয়ায় অনুপাত অর্থহীন হয়ে যেত — ১০০%-এর বেশি বা অসম্ভব কম দেখাতে পারত।
    //
    // এখন একই ডেটাসেট (student_fees = একই সেশন/বিলিং রেকর্ড) থেকেই তিনটি মান
    // বের করা হয়: মোট চার্জ (payable), আদায়কৃত (paid) ও বকেয়া (due)।
    // ফলে collectible = paid + due = payable এবং হার কখনো ১০০%-এর উপরে যায় না।
    const sessionPayable = studentFees.reduce(
      (sum, f) => sum + (Number(f.payable_amount) || 0),
      0
    );
    const sessionCollected = studentFees.reduce((sum, f) => {
      const payable = Number(f.payable_amount) || 0;
      const due = Number(f.due_amount) || 0;
      const paidFromFields = Number((f as any).paid_amount);
      if (Number.isFinite(paidFromFields) && paidFromFields > 0) return sum + paidFromFields;
      return sum + Math.max(0, payable - due);
    }, 0);
    const sessionDue = studentFees.reduce((sum, f) => sum + (Number(f.due_amount) || 0), 0);

    // Current month collection
    const thisMonthCollection = unifiedPayments
      .filter((p) => {
        const pDate = p.payment_date || (p.created_at ? toDhakaDateStringFrom(p.created_at) : "");
        return Boolean(pDate && pDate.startsWith(currentMonthStr));
      })
      .reduce((sum, p) => sum + (Number(p.total_amount_received) || 0), 0);

    // Today's collection
    const todayCollection = unifiedPayments
      .filter((p) => {
        const pDate = p.payment_date || (p.created_at ? toDhakaDateStringFrom(p.created_at) : "");
        return pDate === todayStr;
      })
      .reduce((sum, p) => sum + (Number(p.total_amount_received) || 0), 0);

    // Fee Type breakdown
    const typeBreakdown: Record<string, number> = {};
    unifiedPayments.forEach((p) => {
      if (p.allocations && p.allocations.length > 0) {
        p.allocations.forEach((a:any) => {
          typeBreakdown[a.fee_type_name] = (typeBreakdown[a.fee_type_name] || 0) + (Number(a.allocated_amount) || 0);
        });
      } else {
        const defaultType = "মাসিক ফি";
        typeBreakdown[defaultType] = (typeBreakdown[defaultType] || 0) + (Number(p.total_amount_received) || 0);
      }
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
    unifiedPayments.forEach((p) => {
      const method = p.payment_method || "Cash";
      methodBreakdown[method] = (methodBreakdown[method] || 0) + (Number(p.total_amount_received) || 0);
    });

    return {
      totalCollected,
      totalDue,
      // MD-4: একই সেশন-পরিসরের সংখ্যা — "আদায় হার" KPI এখন এগুলো থেকেই হিসাব হয়
      sessionPayable,
      sessionCollected,
      sessionDue,
      thisMonthCollection,
      todayCollection,
      totalPaymentsCount: unifiedPayments.length,
      totalStudentsCount: students.length,
      recentPayments: unifiedPayments.slice(0, 10),
      typeBreakdown,
      methodBreakdown,
      auditLogs: (meta.audit_logs || []).slice(0, 5),
    };
  } catch (err) {
    console.error("Error in getFeeDashboardOverview:", err);
    return null;
  }
}

/**
 * 9. Delete an individual student fee record (Audit-compliant, only if unpaid)
 */
export async function deleteStudentFee(feeId: string): Promise<{ success?: boolean; error?: string; message?: string }> {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অননুমোদিত অ্যাক্সেস। অনুগ্রহ করে লগইন করুন।" };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "মাদ্রাসা সনাক্ত করা যায়নি।" };

    // CR-2 ফিক্স: সার্ভার-সাইড অনুমতি যাচাই (আগে শুধু `if (!user)` ছিল)
    const guard = await requirePermission({
      userId: user.id,
      madrasaId,
      permissions: ["fee.edit", "finance.delete"],
      roles: ["super_admin", "admin", "muhtamim", "accountant"],
    });
    if (!guard.allowed) return { error: guard.error || "এই কাজটি করার অনুমতি নেই।" };

    const meta = await getFeeMetadata(madrasaId);
    const studentFees = meta.student_fees || [];
    const targetFee = studentFees.find((f) => f.id === feeId);

    if (!targetFee) {
      return { error: "ফি রেকর্ডটি পাওয়া যায়নি বা ইতিমধ্যে মুছে ফেলা হয়েছে।" };
    }

    // Protection: If payment was received for this fee, do not allow direct deletion
    if (targetFee.paid_amount > 0) {
      return {
        error: `এই ফি বাবদ ৳${targetFee.paid_amount} আদায় করা হয়েছে। ডিলিট করার আগে অনুগ্রহ করে 'ফি ও পেমেন্ট তালিকা' থেকে পেমেন্ট রিভার্স/বাতিল করুন।`,
      };
    }

    const updatedFees = studentFees.filter((f) => f.id !== feeId);
    const auditLogs = meta.audit_logs || [];
    auditLogs.unshift({
      id: `audit_${Date.now()}`,
      madrasa_id: madrasaId,
      action: "DELETE_STUDENT_FEE",
      user_name: user?.email || "হিসাবরক্ষক",
      user_role: "accountant",
      details: `${targetFee.student_name || "শিক্ষার্থী"} (${targetFee.class_name || ""})-এর ${targetFee.billing_period} সেশনের ${targetFee.fee_type_name} (৳${targetFee.payable_amount}) মুছে ফেলা হয়েছে।`,
      created_at: new Date().toISOString(),
    });

    const success = await saveFeeMetadata(madrasaId, {
      student_fees: updatedFees,
      audit_logs: auditLogs,
    });

    if (!success) {
      return { error: "ডাটাবেজে পরিবর্তন সংরক্ষণ করা যায়নি।" };
    }

    revalidatePath("/portal/fees");
    revalidatePath("/portal");
    revalidatePath("/dashboard/accounting/due");
    revalidatePath("/dashboard/accounting/fees");
    revalidatePath("/dashboard/accounting/generate");
    revalidatePath("/dashboard/accounting");

    return { success: true, message: "ফি ইনভয়েসটি সফলভাবে মুছে ফেলা হয়েছে।" };
  } catch (err: any) {
    console.error("Error in deleteStudentFee:", err);
    return { error: err?.message || "ফি মুছতে সমস্যা হয়েছে।" };
  }
}

/**
 * 10. Delete a generated fee batch (e.g. all unpaid fees for a month or class)
 */
export async function deleteGeneratedFeeBatch(params: {
  sessionId?: string;
  billingPeriod: string;
  feeTypeId?: string;
  classId?: string;
}): Promise<{
  success?: boolean;
  error?: string;
  count?: number;
  message?: string;
  stepUpRequired?: boolean;
  errorCode?: string;
}> {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { error: "অননুমোদিত অ্যাক্সেস। অনুগ্রহ করে লগইন করুন।" };

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "মাদ্রাসা সনাক্ত করা যায়নি।" };

    // CR-2 ফিক্স: সার্ভার-সাইড অনুমতি যাচাই (আগে শুধু `if (!user)` ছিল)
    const guard = await requirePermission({
      userId: user.id,
      madrasaId,
      permissions: ["fee.edit", "finance.delete"],
      roles: ["super_admin", "admin", "muhtamim", "accountant"],
      riskLevel: "CRITICAL",
      actionScope: "fee_batch.delete",
    });
    if (!guard.allowed) {
      return {
        error: guard.error || "এই কাজটি করার অনুমতি নেই।",
        stepUpRequired: guard.stepUpRequired,
        errorCode: guard.errorCode,
      };
    }

    const meta = await getFeeMetadata(madrasaId);
    const studentFees = meta.student_fees || [];

    let deletedCount = 0;
    let paidBlockedCount = 0;

    const remainingFees = studentFees.filter((f) => {
      // Check match
      const matchPeriod = f.billing_period === params.billingPeriod;
      const matchSession = !params.sessionId || params.sessionId === "ALL" || f.session_id === params.sessionId;
      const matchFeeType = !params.feeTypeId || params.feeTypeId === "ALL" || f.fee_type_id === params.feeTypeId;
      const matchClass = !params.classId || params.classId === "ALL" || f.class_id === params.classId || f.class_name === params.classId;

      if (matchPeriod && matchSession && matchFeeType && matchClass) {
        // If fee has been paid, do NOT delete it
        if (f.paid_amount > 0) {
          paidBlockedCount++;
          return true; // keep
        }
        deletedCount++;
        return false; // remove
      }
      return true; // keep
    });

    if (deletedCount === 0) {
      if (paidBlockedCount > 0) {
        return {
          error: `এই ব্যাচের সকল ফি ইতিমধ্যে আদায় বা আংশিক পরিশোধিত থাকায় কোনো ফি মুছে ফেলা যায়নি।`,
        };
      }
      return { error: "মুছে ফেলার মতো কোনো ফি ইনভয়েস পাওয়া যায়নি।" };
    }

    const auditLogs = meta.audit_logs || [];
    auditLogs.unshift({
      id: `audit_${Date.now()}`,
      madrasa_id: madrasaId,
      action: "DELETE_FEE_BATCH",
      user_name: user?.email || "হিসাবরক্ষক",
      user_role: "accountant",
      details: `${params.billingPeriod} সময়ের জন্য জেনারেটকৃত ${deletedCount} টি অপরিশোধিত ফি রেকর্ড সম্পূর্ণ মুছে ফেলা হয়েছে${paidBlockedCount > 0 ? ` (${paidBlockedCount} টি পরিশোধিত ফি সুরক্ষিত রাখা হয়েছে)` : ""}।`,
      created_at: new Date().toISOString(),
    });

    const success = await saveFeeMetadata(madrasaId, {
      student_fees: remainingFees,
      audit_logs: auditLogs,
    });

    if (!success) {
      return { error: "ডাটাবেজে পরিবর্তন সংরক্ষণ করা যায়নি।" };
    }

    revalidatePath("/portal/fees");
    revalidatePath("/portal");
    revalidatePath("/dashboard/accounting/due");
    revalidatePath("/dashboard/accounting/fees");
    revalidatePath("/dashboard/accounting/generate");
    revalidatePath("/dashboard/accounting");

    return {
      success: true,
      count: deletedCount,
      message: `সফলভাবে ${deletedCount} টি জেনারেটকৃত ফি মুছে ফেলা হয়েছে${paidBlockedCount > 0 ? ` (${paidBlockedCount} টি পরিশোধিত ফি সুরক্ষিত রাখা হয়েছে)` : ""}।`,
    };
  } catch (err: any) {
    console.error("Error in deleteGeneratedFeeBatch:", err);
    return { error: err?.message || "ফি ব্যাচ মুছতে সমস্যা হয়েছে।" };
  }
}

/**
 * 11. Get summary list of all generated fee batches to display on the Generator page
 */
export async function getGeneratedFeeBatches() {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return [];

    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return [];

    const meta = await getFeeMetadata(madrasaId);
    const studentFees = meta.student_fees || [];

    // Group by billing_period
    const batchMap = new Map<string, {
      billingPeriod: string;
      sessionId: string;
      feeTypeNames: Set<string>;
      feeTypeIds: Set<string>;
      totalStudents: Set<string>;
      totalPayable: number;
      totalPaid: number;
      totalDue: number;
      unpaidCount: number;
      paidCount: number;
      createdAt: string;
    }>();

    studentFees.forEach((f) => {
      const key = `${f.session_id}_${f.billing_period}`;
      let batch = batchMap.get(key);
      if (!batch) {
        batch = {
          billingPeriod: f.billing_period,
          sessionId: f.session_id,
          feeTypeNames: new Set(),
          feeTypeIds: new Set(),
          totalStudents: new Set(),
          totalPayable: 0,
          totalPaid: 0,
          totalDue: 0,
          unpaidCount: 0,
          paidCount: 0,
          createdAt: f.created_at || new Date().toISOString(),
        };
        batchMap.set(key, batch);
      }

      batch.feeTypeNames.add(f.fee_type_name);
      batch.feeTypeIds.add(f.fee_type_id);
      batch.totalStudents.add(f.student_id);
      batch.totalPayable += f.payable_amount || 0;
      batch.totalPaid += f.paid_amount || 0;
      batch.totalDue += f.due_amount || 0;
      if (f.paid_amount > 0) batch.paidCount++;
      else batch.unpaidCount++;
    });

    return Array.from(batchMap.values()).map((b) => ({
      billingPeriod: b.billingPeriod,
      sessionId: b.sessionId,
      feeTypeNames: Array.from(b.feeTypeNames),
      studentCount: b.totalStudents.size,
      totalPayable: b.totalPayable,
      totalPaid: b.totalPaid,
      totalDue: b.totalDue,
      unpaidCount: b.unpaidCount,
      paidCount: b.paidCount,
      createdAt: b.createdAt,
    })).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    console.error("Error in getGeneratedFeeBatches:", err);
    return [];
  }
}
