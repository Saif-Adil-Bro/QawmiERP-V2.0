"use server";
import {billPeriodKey} from '@/lib/finance/bill-period';
import {billingSession} from '@/lib/finance/billing-session';
import {monthlyCharges} from '@/lib/finance/monthly-charges';
import {financeDeniedRoles} from '@/lib/finance/access';
import {postingError,postingFund} from "@/lib/finance/funds";
import {getFeeMetadata as readFeeStore,saveFeeMetadata,saveBillChanges} from '@/lib/fee-store';
import {rows} from '@/lib/portal/queries';
import {studentLedger,reconcilePayments} from '@/lib/portal/ledger';
import {webIdentity,hasRole,linkedStudents} from '@/lib/portal/identity';
import {studentRoles,teacherRoles} from '@/lib/portal/rules';

import { toDhakaDateStringFrom, toDhakaDateString, getDhakaYear, toDhakaMonthString } from "@/lib/date-utils";
import { canReadSchoolFinance, writeGuard } from "@/lib/action-authorization";
import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getAuthMadrasaId } from "./students";
import { requirePermission } from "@/lib/permissions-server";
import { logAuditEvent } from "@/lib/audit-log";
import {cashierPayment} from "@/lib/finance/cashier";
import type {CashierInput} from "@/lib/finance/fee-plan";
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

function canReadFinance(i:NonNullable<Awaited<ReturnType<typeof webIdentity>>>) {
  return canReadSchoolFinance([i.userRow.role,i.perms.profile.primaryRole,...i.perms.roles],i.perms.summary.effectivePermissions);
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
    if (!madrasaId) throw Error("প্রতিষ্ঠান সনাক্ত করা যায়নি।");

    const meta = await getFeeMetadata(madrasaId);
    const feeTypes = meta.fee_types && meta.fee_types.length > 0 ? meta.fee_types : DEFAULT_FEE_TYPES;
    return feeTypes;
  } catch (err) {
    console.error("Error in getFeeTypes:", err);
    throw Error("ফি খাত পড়া যায়নি।");
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
    const guard = await requirePermission({denyRoles:financeDeniedRoles,
      userId: user.id,
      madrasaId,
      permissions: ["fee.edit"],
      roles: ["super_admin", "admin", "muhtamim", "accountant"],
    });
    if (!guard.allowed) return { error: guard.error || "এই কাজটি করার অনুমতি নেই।" };

    const meta = await getFeeMetadata(madrasaId);
    const feeTypes = [...(meta.fee_types || DEFAULT_FEE_TYPES)];
    const fund=await postingFund(madrasaId,feeType.fund_id,'deposit','','',feeType.fund_name);
    const defaultFundId=fund.id,defaultFundName=fund.name;

    const savedId=feeType.id || crypto.randomUUID();
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
        id: savedId,
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

    const saved = await saveFeeMetadata(madrasaId,"fee_types",meta.fee_types || [],feeTypes);
    if (!saved) {
      return { error: "ফি টাইপ ডেটাবেজে সংরক্ষণ করা সম্ভব হয়নি। অনুগ্রহ করে আবার চেষ্টা করুন।" };
    }
    await logAuditEvent({
      madrasaId,
      actorId: user.id,
      module: "fees",
      action: feeType.id ? "FEE_TYPE_UPDATED" : "FEE_TYPE_CREATED",
      entityType: "fee_type",
      entityId: savedId,
      entityLabel: feeType.name || savedId,
      summary: `ফি খাত "${feeType.name || savedId}" সংরক্ষিত হয়েছে`,
      newValue: feeTypes.find((f) => f.id === savedId),
    });
    revalidatePath("/dashboard/accounting/structure");
    revalidatePath("/dashboard/accounting/generate");
    revalidatePath("/dashboard/accounting");

    return { success: true, feeType:feeTypes.find(f=>f.id===savedId)!, message: "ফি টাইপ সফলভাবে সংরক্ষিত হয়েছে।" };
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
    const guard = await requirePermission({denyRoles:financeDeniedRoles,
      userId: user.id,
      madrasaId,
      permissions: ["fee.edit"],
      roles: ["super_admin", "admin", "muhtamim", "accountant"],
    });
    if (!guard.allowed) return { error: guard.error || "এই কাজটি করার অনুমতি নেই।" };

    const meta = await getFeeMetadata(madrasaId);
    const feeTypes = (meta.fee_types || DEFAULT_FEE_TYPES).filter((f) => f.id !== feeTypeId);

    const saved = await saveFeeMetadata(madrasaId,"fee_types",meta.fee_types || [],feeTypes);
    if (!saved) {
      return { error: "ফি টাইপ ডেটাবেজ থেকে মুছে ফেলা সম্ভব হয়নি। অনুগ্রহ করে আবার চেষ্টা করুন।" };
    }
    await logAuditEvent({
      madrasaId,
      actorId: user.id,
      module: "fees",
      action: "FEE_TYPE_DELETED",
      entityType: "fee_type",
      entityId: feeTypeId,
      summary: `ফি খাত মুছে ফেলা হয়েছে (${feeTypeId})`,
    });
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
    const guard = await requirePermission({denyRoles:financeDeniedRoles,
      userId: user.id,
      madrasaId,
      permissions: ["fee.edit"],
      roles: ["super_admin", "admin", "muhtamim", "accountant"],
      riskLevel: "CRITICAL",
      requireStepUp: true,
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
    structure={...structure,session_id:await billingSession(await createAdminClient(),madrasaId,structure.session_id,true)};

    let monthlyTotal = 0;
    let onetimeTotal = 0;
    (structure.items || []).forEach((item) => {
      if (item.frequency === "MONTHLY") monthlyTotal += Math.round(Number(item.amount)*100);
      else if (item.frequency === "ONETIME") onetimeTotal += Math.round(Number(item.amount)*100);
    });

    monthlyTotal /= 100; onetimeTotal /= 100;
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

    const saved = await saveFeeMetadata(madrasaId,"fee_structures",meta.fee_structures || [],structures);
    if (!saved) {
      return { error: "ফি কাঠামো ডেটাবেজে সংরক্ষণ করা সম্ভব হয়নি। অনুগ্রহ করে আবার চেষ্টা করুন।" };
    }
    await logAuditEvent({
      madrasaId,
      actorId: user.id,
      module: "fees",
      action: structure.id ? "FEE_STRUCTURE_UPDATED" : "FEE_STRUCTURE_CREATED",
      entityType: "fee_structure",
      entityId: structure.id || "new",
      entityLabel: structure.name || structure.class_name || "ফি কাঠামো",
      summary: `ফি কাঠামো "${structure.name || structure.class_name || "ফি কাঠামো"}" সংরক্ষিত হয়েছে`,
      newValue: { class_id: structure.class_id, total_monthly_amount: monthlyTotal, total_onetime_amount: onetimeTotal },
    });
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
    const guard = await requirePermission({denyRoles:financeDeniedRoles,
      userId: user.id,
      madrasaId,
      permissions: ["fee.edit"],
      roles: ["super_admin", "admin", "muhtamim", "accountant"],
      riskLevel: "CRITICAL",
      requireStepUp: true,
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

    const saved = await saveFeeMetadata(madrasaId,"fee_structures",meta.fee_structures || [],filtered);
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
    const guard = await requirePermission({denyRoles:financeDeniedRoles,
      userId: user.id,
      madrasaId,
      permissions: ["fee.create", "finance.create"],
      roles: ["super_admin", "admin", "muhtamim", "accountant"],
    });
    if (!guard.allowed) return { error: guard.error || "এই কাজটি করার অনুমতি নেই।" };

    params={...params,billingPeriod:billPeriodKey(params.billingPeriod),sessionId:await billingSession(adminClient,madrasaId,params.sessionId)};
    // Fetch students strictly belonging to this madrasa (with classes join so class_name is accurate - B23)
    let students=await rows(()=>adminClient.from("students").select("*, classes(id, name)").eq('madrasa_id',madrasaId));
    students=students.filter(s=>!s.status || String(s.status).toUpperCase()==='ACTIVE');

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

    const [meta,legacy]=await Promise.all([getFeeMetadata(madrasaId),getMadrasaMetadata(madrasaId,true)]);
    const key=(student:string,type:string,period:string)=>JSON.stringify([student,type,billPeriodKey(period)]);
    const historical=new Set((legacy.student_fees || []).filter((f:any)=>f?.billing_period).map((f:any)=>key(f.student_id,f.fee_type_id,f.billing_period)));
    const feeTypes = meta.fee_types && meta.fee_types.length > 0 ? meta.fee_types : DEFAULT_FEE_TYPES;
    const currentStudentFees = [...(meta.student_fees || [])];

    // Determine target fee types
    const targetFeeTypeIds = params.feeTypeIds && params.feeTypeIds.length > 0
      ? params.feeTypeIds
      : feeTypes.filter((f) => f.frequency === "MONTHLY" || f.code === "MONTHLY").map((f) => f.id);

    const selectedFeeTypes = feeTypes.filter((ft) => ft.is_active!==false && targetFeeTypeIds.includes(ft.id));

    if (selectedFeeTypes.length === 0) {
      return { error: "অন্তত একটি ফি'র খাত নির্বাচন করুন।" };
    }

    let generatedCount = 0;
    let skippedCount = 0;
    let updatedCount = 0;
    const generatedStudentIds = new Set<string>();
    const updatedStudentIds = new Set<string>();
    const skippedNoStructureStudents: Array<{ id: string; name: string; className: string }> = [];
    const now = new Date().toISOString();
    const dueDate =
      params.dueDate ||
      toDhakaDateString(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000));


    for (const student of students) {
      const studentClassId = student.class_id || params.classId || "ALL";
      const clsObj: any = Array.isArray(student.classes) ? student.classes[0] : student.classes;
      const prof: any = meta.student_profiles?.[student.id];
      const studentClassName = clsObj?.name || prof?.class_name || student.class_name || "সাধারণ";
      const studentFullName = `${student.first_name || ""} ${student.last_name || ""}`.trim() || "শিক্ষার্থী";

      const charges = monthlyCharges(meta,student,{...params,auto:!params.feeTypeIds?.length});
      if (charges.length === 0) {
        skippedNoStructureStudents.push({
          id: student.id,
          name: studentFullName,
          className: studentClassName,
        });
        continue;
      }

      for(const {ft,baseAmount,discountAmount,discountReason,payable} of charges) {
        // Guard 3 Idempotency: Check if already exists for this period in memory OR in database
        const existingInMemoryIdx = currentStudentFees.findIndex(
          (f) =>
            f.student_id === student.id &&
            f.fee_type_id === ft.id &&
            billPeriodKey(f.billing_period) === billPeriodKey(params.billingPeriod)
        );

        if (existingInMemoryIdx >= 0) {
          const targetFee = currentStudentFees[existingInMemoryIdx];
          const isUnpaid = targetFee.status !== "PAID" && (Number(targetFee.paid_amount) || 0) === 0;

          if (params.forceUpdate && isUnpaid && targetFee.session_id === params.sessionId) {
            if (existingInMemoryIdx >= 0) {
              const oldFee = currentStudentFees[existingInMemoryIdx];
              currentStudentFees[existingInMemoryIdx] = {
                ...oldFee,
                base_amount: baseAmount,
                discount_amount: discountAmount,
                discount_reason: discountReason,
                payable_amount: payable + Number(oldFee.fine_amount || 0),
                due_amount: payable + Number(oldFee.fine_amount || 0),
                due_date: dueDate,
                status: payable + Number(oldFee.fine_amount || 0) === 0 ? "WAIVED" : "UNPAID",
                updated_at: now,
              };
            }

            updatedCount++;
            updatedStudentIds.add(student.id);
          } else {
            skippedCount++;
          }
          continue; // SKIP generating duplicate invoice!
        }

        // A partially migrated school may still have this invoice in the
        // read-only legacy book. Never copy it into the writable book.
        if(historical.has(key(student.id,ft.id,params.billingPeriod))) {skippedCount++;continue;}
        const targetFundId = ft.fund_id;
        const targetFundName =
          ft.fund_name;

        const newFee: StudentFee = {
          id: `fee_${Date.now()}_${crypto.randomUUID()}`,
          madrasa_id: madrasaId,
          session_id: params.sessionId,
          student_id: student.id,
          student_name: studentFullName,
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
        generatedStudentIds.add(student.id);
      }
    }

    const affectedStudentCount = new Set([...generatedStudentIds, ...updatedStudentIds]).size;
    const skippedClasses = Array.from(new Set(skippedNoStructureStudents.map((s) => s.className)));

    // Record audit log
    const auditLogs = meta.audit_logs || [];
    auditLogs.unshift({
      id: `audit_${Date.now()}`,
      madrasa_id: madrasaId,
      action: "GENERATE_MONTHLY_FEES",
      user_name: user?.email || "হিসাবরক্ষক",
      user_role: "accountant",
      details: `${params.billingPeriod} সেশনের জন্য ${affectedStudentCount} জন শিক্ষার্থীর মোট ${generatedCount} টি নতুন ফি লাইন তৈরি করা হয়েছে (${skippedCount} টি পূর্বেই বিদ্যমান, ${updatedCount} টি আপডেট, ${skippedNoStructureStudents.length} জন স্ট্রাকচারহীন বাদ পড়েছে)।`,
      created_at: now,
    });

    const saved = await saveBillChanges(madrasaId,meta.student_fees || [],currentStudentFees,auditLogs[0]);
    if (!saved) {
      return { error: "তৈরি হওয়া ফি ইনভয়েসগুলো ডেটাবেজে সংরক্ষণ করা সম্ভব হয়নি। অনুগ্রহ করে আবার চেষ্টা করুন। (কোনো পরিবর্তন প্রয়োগ হয়নি)" };
    }

    const auditWrite = await logAuditEvent({
      madrasaId,
      actorId: user?.id || null,
      actorEmail: user?.email || null,
      module: "fees",
      action: "MONTHLY_FEES_GENERATED",
      entityType: "student_fees",
      entityId: params.billingPeriod,
      entityLabel: params.billingPeriod,
      summary: `${params.billingPeriod} সেশনের জন্য ${affectedStudentCount} জন শিক্ষার্থীর ${generatedCount}টি নতুন ফি ইনভয়েস তৈরি করা হয়েছে (${skippedCount}টি স্কিপ, ${updatedCount}টি আপডেট)`,
      newValue: {
        billing_period: params.billingPeriod,
        generated_count: generatedCount,
        updated_count: updatedCount,
        skipped_count: skippedCount,
        affected_students: affectedStudentCount,
      },
    });

    revalidatePath("/dashboard/accounting");
    revalidatePath("/portal/fees");
    revalidatePath("/portal");
    revalidatePath("/dashboard/accounting/due");
    revalidatePath("/dashboard/accounting/generate");
    revalidatePath("/dashboard/accounting/reports");

    const skippedNotice =
      skippedNoStructureStudents.length > 0
        ? ` সতর্কতা: ফি স্ট্রাকচার না থাকায় ${skippedNoStructureStudents.length} জন শিক্ষার্থী (${skippedClasses.join(", ")}) বাদ পড়েছে।`
        : "";

    const message = updatedCount > 0
      ? `সফলভাবে ${affectedStudentCount} জন শিক্ষার্থীর জন্য ${generatedCount} টি নতুন ফি লাইন তৈরি এবং ${updatedCount} টি আপডেট করা হয়েছে (${skippedCount} টি স্কিপ হয়েছে)।${skippedNotice}`
      : `সফলভাবে ${generatedStudentIds.size} জন শিক্ষার্থীর জন্য ${params.billingPeriod} মাসের মোট ${generatedCount} টি ফি লাইন তৈরি করা হয়েছে (${skippedCount} টি পূর্বেই বিদ্যমান ছিল)।${skippedNotice}`;

    return {
      success: true,
      generatedCount,
      affectedStudentCount,
      skippedCount,
      updatedCount,
      skippedNoStructureStudents,
      skippedClasses,
      message: message + (auditWrite?.success ? "" : " ফি সংরক্ষিত; অডিট লগ যাচাই করুন, আবার জেনারেট করবেন না।"),
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
        .select("id, request_type, title, amount, created_at")
        .eq("madrasa_id", madrasaId)
        .eq("target_id", studentId)
        .in("status", ["PENDING","IN_REVIEW"])
        .in("request_type", ["FEE_WAIVER", "FEE_DISCOUNT"])
        .order("created_at", { ascending: false })
        .limit(10);

      if (!reqErr && Array.isArray(reqs)) {
        pendingApprovals = reqs.map((r: any) => ({
          id: String(r.id),
          type: String(r.request_type),
          title: String(r.title || "ফি ছাড়/মওকুফ অনুমোদন"),
          amount: Number(r.amount || 0) || undefined,
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
export async function collectFeePayment(paymentData:CashierInput) {
  return cashierPayment(paymentData);
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
    console.error("Error in getUnifiedFeePayments:",err);
    throw new Error("সম্পূর্ণ ফি হিসাব পড়া যায়নি।");
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
    const guard = await requirePermission({denyRoles:financeDeniedRoles,
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

    return {error:'রসিদ, বকেয়া ও সিরিজ গণহারে রিসেট করা যায় না। মূল রসিদে কারণসহ বাতিল অথবা অপরিশোধিত বিল অপসারণ ব্যবহার করুন।'};
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
    const guard = await requirePermission({denyRoles:financeDeniedRoles,
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

    // Child rows have no madrasa_id. Bind them to the tenant's identified parent.
    const payments=await rows(()=>adminClient.from('fee_payments').select('id,total_amount_received,status,fee_payment_allocations(*)').eq('madrasa_id',madrasaId));
    const allocations=payments.flatMap(p=>p.fee_payment_allocations || []);

    const allocationsByPayment = new Map<string, { sum: number; keys: Map<string, number> }>();
    for (const a of allocations as any[]) {
      const pid = String(a.payment_id || "");
      if (!pid) continue;
      const bucket = allocationsByPayment.get(pid) || { sum: 0, keys: new Map<string, number>() };
      bucket.sum += Number(a.allocated_amount) || 0;
      const dedupeKey=JSON.stringify([a.student_fee_id,a.fee_type_id,a.billing_period,a.fund_id,Number(a.allocated_amount),Number(a.discount_applied)]);
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
export async function reverseFeePayment(id:string,reason:string) {return changeFeeReceipt(id,reason,'REVERSED');}
export async function voidFeePayment(id:string,reason:string) {return changeFeeReceipt(id,reason,'VOID');}
export async function unvoidFeePayment(id:string,reason:string) {return changeFeeReceipt(id,reason,'COMPLETED');}
async function changeFeeReceipt(id:string,reason:string,status:'REVERSED'|'VOID'|'COMPLETED') {
  try {
    const client=await createClient(),user=await getAuthUser(client),tenant=await getAuthMadrasaId();
    if (!user || !tenant || !id) return {error:'অনুমতি নেই।'};
    if (!reason?.trim() || reason.trim().length>(500) || (status==='REVERSED' && reason.trim().length<5)) return {error:'রসিদ সংশোধনের সুনির্দিষ্ট কারণ লিখুন।'};
    const guard=await requirePermission({denyRoles:financeDeniedRoles,userId:user.id,madrasaId:tenant,
      permissions:status==='COMPLETED'?['finance.delete','fee.edit']:['fee.edit','finance.edit'],
      roles:status==='COMPLETED'?['super_admin','admin','muhtamim']:['super_admin','admin','muhtamim','accountant']});
    if (!guard.allowed) return {error:guard.error || 'অনুমতি নেই।'};
    const db=await createAdminClient();
    const {error}=await db.rpc('finance_fee_status',{p_tenant:tenant,p_actor:user.id,p_id:id,p_status:status,p_reason:reason.trim()});
    if (error) return {error:postingError(error)};
    await logAuditEvent({madrasaId:tenant,actorId:user.id,actorEmail:user.email || null,actorRole:guard.context?.role || null,module:'fees',action:`FEE_PAYMENT_${status==='COMPLETED'?'RESTORED':status==='VOID'?'VOIDED':'REVERSED'}`,
      entityType:'fee_payment',entityId:id,summary:reason.trim(),newValue:{status},severity:'CRITICAL'});
    for (const path of ['','/accounting','/accounting/payments','/accounting/due','/accounting/income','/accounting/receipts','/zakat/funds']) revalidatePath(`/dashboard${path}`);
    revalidatePath('/portal','layout');
    return {success:true,message:status==='COMPLETED'?'ফি রসিদ পুনরায় সক্রিয় হয়েছে।':'ফি রসিদ বাতিল হয়েছে।'};
  } catch(e:any) {return {error:e.message || 'ফি রসিদ পরিবর্তন হয়নি।'};}
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
        .select("id, first_name, last_name, roll_number, parent_phone, class_id, class_name, classes(id, name)")
        .eq("madrasa_id", madrasaId),
    ]);

    let students: any[] = studentsRes.data || [];
    if (students.length === 0) {
      try {
        const adminClient = await createAdminClient();
        const { data: adminStudents } = await adminClient
          .from("students")
          .select("id, first_name, last_name, roll_number, parent_phone, class_id, class_name, classes(id, name)")
          .eq("madrasa_id", madrasaId);
        if (adminStudents && adminStudents.length > 0) {
          students = adminStudents;
        }
      } catch {}
    }
    const studentMap = new Map(students.map((s) => [s.id, s]));
    const studentProfiles = meta.student_profiles || {};
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
        const rawStudent = studentMap.get(f.student_id);
        const prof: any = studentProfiles[f.student_id];
        const clsObj: any = rawStudent
          ? Array.isArray(rawStudent.classes)
            ? rawStudent.classes[0]
            : rawStudent.classes
          : null;
        const resolvedClassName =
          clsObj?.name || prof?.class_name || rawStudent?.class_name || f.class_name || "সাধারণ";
        const resolvedParentPhone =
          rawStudent?.parent_phone ||
          prof?.guardian_phone ||
          prof?.father_phone ||
          prof?.parent_phone ||
          prof?.phone ||
          "";

        const hydratedStudent = rawStudent
          ? {
              ...rawStudent,
              parent_phone: resolvedParentPhone,
              phone: resolvedParentPhone,
              class_name: resolvedClassName,
              classes: clsObj || (rawStudent.class_id ? { id: rawStudent.class_id, name: resolvedClassName } : null),
            }
          : {
              id: f.student_id,
              first_name: f.student_name || "শিক্ষার্থী",
              last_name: "",
              roll_number: f.student_roll || "-",
              parent_phone: resolvedParentPhone,
              phone: resolvedParentPhone,
              class_name: resolvedClassName,
              classes: f.class_id ? { id: f.class_id, name: resolvedClassName } : null,
            };

        const existing = studentDueMap.get(f.student_id) || {
          student: hydratedStudent,
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

    const db=await createAdminClient();
    const [meta,legacy,students]=await Promise.all([getFeeMetadata(madrasaId),rows(()=>db.from('fees').select('*').eq('madrasa_id',madrasaId)),rows(()=>supabase.from('students').select('id,first_name,last_name,class_name,roll_number').eq('madrasa_id',madrasaId))]);
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
    const guard = await requirePermission({denyRoles:financeDeniedRoles,
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

    const success = await saveBillChanges(madrasaId,studentFees,updatedFees,auditLogs[0]);

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
    const guard = await requirePermission({denyRoles:financeDeniedRoles,
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

    const success = await saveBillChanges(madrasaId,studentFees,remainingFees,auditLogs[0]);

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
      dueStudents: Set<string>;
      paidStudents: Set<string>;
      waivedStudents: Set<string>;
      invoiceCount: number;
      totalPayable: number;
      totalPaid: number;
      totalDue: number;
      unpaidCount: number;
      paidCount: number;
      waivedCount: number;
      createdAt: string;
    }>();

    studentFees.forEach((f) => {
      if (!f?.student_id || !f?.billing_period) return;
      const key = `${f.session_id}_${f.billing_period}`;
      let batch = batchMap.get(key);
      if (!batch) {
        batch = {
          billingPeriod: f.billing_period,
          sessionId: f.session_id,
          feeTypeNames: new Set(),
          feeTypeIds: new Set(),
          totalStudents: new Set(),
          dueStudents: new Set(),
          paidStudents: new Set(),
          waivedStudents: new Set(),
          invoiceCount: 0,
          totalPayable: 0,
          totalPaid: 0,
          totalDue: 0,
          unpaidCount: 0,
          paidCount: 0,
          waivedCount: 0,
          createdAt: f.created_at || new Date().toISOString(),
        };
        batchMap.set(key, batch);
      }

      const payable = Number(f.payable_amount || 0);
      const paid = Number(f.paid_amount || 0);
      const due = Number(f.due_amount || 0);
      const isWaived = String(f.status || "").toUpperCase() === "WAIVED" || (payable === 0 && due === 0 && paid === 0);

      batch.feeTypeNames.add(f.fee_type_name);
      batch.feeTypeIds.add(f.fee_type_id);
      batch.totalStudents.add(f.student_id);
      batch.invoiceCount += 1;
      batch.totalPayable += payable;
      batch.totalPaid += paid;
      batch.totalDue += due;
      if (paid > 0) {
        batch.paidCount++;
        batch.paidStudents.add(f.student_id);
      }
      if (due > 0) {
        batch.unpaidCount++;
        batch.dueStudents.add(f.student_id);
      }
      if (isWaived) {
        batch.waivedCount++;
        batch.waivedStudents.add(f.student_id);
      }
    });

    return Array.from(batchMap.values()).map((b) => {
      // A student who has ANY unpaid invoice is counted in dueStudents;
      // students whose entire batch is waived (no due, no paid) are counted in waivedOnlyStudents.
      const waivedOnlyStudents = Array.from(b.waivedStudents).filter(
        (sid) => !b.dueStudents.has(sid) && !b.paidStudents.has(sid)
      ).length;
      const fullyPaidOnlyStudents = Array.from(b.paidStudents).filter(
        (sid) => !b.dueStudents.has(sid)
      ).length;

      return {
        billingPeriod: b.billingPeriod,
        sessionId: b.sessionId,
        feeTypeNames: Array.from(b.feeTypeNames),
        studentCount: b.totalStudents.size,
        dueStudentCount: b.dueStudents.size,
        waivedStudentCount: waivedOnlyStudents,
        paidStudentCount: fullyPaidOnlyStudents,
        invoiceCount: b.invoiceCount,
        totalPayable: b.totalPayable,
        totalPaid: b.totalPaid,
        totalDue: b.totalDue,
        unpaidCount: b.unpaidCount,
        paidCount: b.paidCount,
        waivedCount: b.waivedCount,
        createdAt: b.createdAt,
      };
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    console.error("Error in getGeneratedFeeBatches:", err);
    return [];
  }
}
