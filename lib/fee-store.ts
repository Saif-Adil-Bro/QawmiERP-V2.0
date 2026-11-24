import { mergeWaivers, receiptAllocations } from "./portal/ledger";
// Server-only persistence; not a callable Next.js Server Action. Payment callbacks already validate their transaction/tenant.
import { createAdminClient } from "./supabase/admin";
import { getMadrasaMetadata, saveMadrasaMetadata } from "./sessions";
import { getDhakaYear, toDhakaDateString } from "./date-utils";
import {
  DEFAULT_FEE_TYPES,
  type FeeStructure,
  type FeePayment,
  type FeeType,
  type FeeAuditLog,
  type StudentFee,
  type MadrasaFeeData,
} from "./fee-management";
import { rows } from "./portal/queries";
/**
 * Fetch fee data directly from relational PostgreSQL tables
 * with fallback to JSON metadata for unmigrated data.
 */
export async function getFeeMetadata(
  madrasaId: string,
): Promise<MadrasaFeeData> {
  try {
    const adminClient = await createAdminClient();

    // 1. Fetch from relational tables
    const [ftRes, fsRes, sfRes, fpRes, alRes] = await Promise.all([
      rows(()=>adminClient.from('fee_types').select('*').eq('madrasa_id',madrasaId).order('created_at'),true).then(data=>({data})),
      rows(()=>adminClient.from('fee_structures').select('*, fee_structure_items(*)').eq('madrasa_id',madrasaId),true).then(data=>({data})),
      rows(
        () =>
          adminClient
            .from("student_fees")
            .select("*")
            .eq("madrasa_id", madrasaId)
            .order("created_at", { ascending: false }),
        true,
      ).then((data) => ({ data })),
      rows(
        () =>
          adminClient
            .from("fee_payments")
            .select("*, fee_payment_allocations(*)")
            .eq("madrasa_id", madrasaId)
            .order("created_at", { ascending: false }),
        true,
      ).then((data) => ({ data })),
      adminClient
        .from("fee_audit_logs")
        .select("*")
        .eq("madrasa_id", madrasaId)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    if (alRes.error && !['42P01','PGRST205'].includes(alRes.error.code)) throw new Error(alRes.error.message);
    const feeStructures: FeeStructure[] = (fsRes.data || []).map((fs: any) => ({
      id: fs.id,
      madrasa_id: fs.madrasa_id,
      session_id: fs.session_id,
      class_id: fs.class_id,
      class_name: fs.class_name,
      student_category: fs.student_category,
      name: fs.name,
      items: (fs.fee_structure_items || []).map((item: any) => ({
        fee_type_id: item.fee_type_id,
        fee_type_name: item.fee_type_name,
        amount: Number(item.amount) || 0,
        frequency: item.frequency,
      })),
      total_monthly_amount: Number(fs.total_monthly_amount) || 0,
      total_onetime_amount: Number(fs.total_onetime_amount) || 0,
      created_at: fs.created_at,
      updated_at: fs.updated_at,
    }));

    const payments: FeePayment[] = (fpRes.data || []).map((p: any) => ({
      id: p.id,
      receipt_no: p.receipt_no,
      db_fee_id: p.db_fee_id,
      madrasa_id: p.madrasa_id,
      session_id: p.session_id,
      student_id: p.student_id,
      student_name: p.student_name,
      student_roll: p.student_roll,
      class_name: p.class_name,
      fund_id: p.fund_id || undefined,
      fund_name: p.fund_name || undefined,
      total_amount_received: Number(p.total_amount_received) || 0,
      payment_date: p.payment_date,
      payment_method: p.payment_method,
      transaction_ref: p.transaction_ref,
      // CR-8 ফিক্স: ফান্ড ম্যাপিং (fund_id/fund_name) এখন পড়া হয় — আগে এই দুটি ফিল্ড
      // বাদ পড়ত, ফলে রিপোর্টে `alloc.fund_id || p.fund_id` সর্বদা undefined হয়ে
      // ফি-প্রকারের নাম দেখে অনুমান করে ফান্ড ঠিক করা হতো (সব ফি General/Lillah-এ যেত)।
      allocations: receiptAllocations(p),
      discount_total: Number(p.discount_total) || 0,
      fine_total: Number(p.fine_total) || 0,
      advance_amount: Number(p.advance_amount) || 0,
      collector_name: p.collector_name,
      notes: p.notes,
      status: p.status,
      // void/reverse মেটাডেটা আগে পড়া হতো না — ফলে বাতিল রসিদের কারণ ও সময় UI-তে ও
      // রিপোর্টে হারিয়ে যেত (getFeeWithReceiptNo-তে যেগুলো দেখানোর কথা)।
      cancellation_reason:
        p.cancellation_reason || p.reversal_reason || undefined,
      reversal_reason: p.reversal_reason || undefined,
      reversed_at: p.reversed_at ? String(p.reversed_at) : undefined,
      reversed_by: p.reversed_by || undefined,
      voided_at: p.voided_at ? String(p.voided_at) : undefined,
      voided_by: p.voided_by || undefined,
      idempotency_key: p.idempotency_key || undefined,
      created_at: p.created_at,
    }));

    const studentFees: StudentFee[] = (sfRes.data || []).map((sf: any) => ({
      ...sf,
      base_amount: Number(sf.base_amount) || 0,
      discount_amount: Number(sf.discount_amount) || 0,
      fine_amount: Number(sf.fine_amount) || 0,
      payable_amount: Number(sf.payable_amount) || 0,
      paid_amount: Number(sf.paid_amount) || 0,
      due_amount: Number(sf.due_amount) || 0,
    }));

    let receiptCounter = 100;
    if (payments.length > 0) {
      for (const p of payments) {
        if (p.receipt_no) {
          const parts = p.receipt_no.split("-");
          const n = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(n) && n > receiptCounter) {
            receiptCounter = n;
          }
        }
      }
    }

    const feeTypes: FeeType[] =
      ftRes.data && ftRes.data.length > 0
        ? ftRes.data.map((ft: any) => ({
            ...ft,
            default_amount: Number(ft.default_amount) || 0,
          }))
        : DEFAULT_FEE_TYPES;

    const auditLogs: FeeAuditLog[] = (alRes.data || []).map((al: any) => ({
      ...al,
    }));

    const meta = await getMadrasaMetadata(madrasaId, true);
    const discounts = mergeWaivers(
      meta.discounts,
      await rows(
        () =>
          adminClient
            .from("fee_discount_waivers")
            .select("*")
            .eq("madrasa_id", madrasaId),
        true,
      ),
    );

    // If relational data exists, prefer it as the single source of truth
    if (
      studentFees.length > 0 ||
      payments.length > 0 ||
      feeStructures.length > 0
    ) {
      return {
        fee_types: feeTypes,
        fee_structures: feeStructures,
        student_fees: studentFees,
        payments,
        discounts,
        audit_logs: auditLogs,
        receipt_counter: receiptCounter,
        student_profiles: meta.student_profiles || {},
      };
    }

    // Fallback if relational has no rows yet
    return {
      fee_types:
        meta.fee_types && meta.fee_types.length > 0 ? meta.fee_types : feeTypes,
      fee_structures:
        meta.fee_structures && meta.fee_structures.length > 0
          ? meta.fee_structures
          : feeStructures,
      student_fees: meta.student_fees || [],
      payments: meta.payments || [],
      discounts,
      audit_logs:
        meta.audit_logs && meta.audit_logs.length > 0
          ? meta.audit_logs
          : auditLogs,
      receipt_counter: meta.receipt_counter || receiptCounter,
      student_profiles: meta.student_profiles || {},
    };
  } catch (err) {
    throw err;
  }
}

/** Generate a minimal set of create/update/delete operations; never upsert unrelated receipts or dues. */
function changes<T extends {id:string}>(before:T[],after:T[]) {
  const old=new Map(before.map(r=>[r.id,r])),next=new Map(after.map(r=>[r.id,r]));
  if (old.size!==before.length || next.size!==after.length) throw new Error('খাতার আইডি একাধিকবার আছে।');
  return [...new Set([...old.keys(),...next.keys()])].filter(id=>JSON.stringify(old.get(id))!==JSON.stringify(next.get(id))).map(id=>({id,before:old.get(id)??null,after:next.get(id)??null}));
}
export async function saveBillChanges(tenant:string,before:StudentFee[],after:StudentFee[],audit?:FeeAuditLog) {
  const db=await createAdminClient();const {error}=await db.rpc('finance_edit_bills',{p_tenant:tenant,p_changes:changes(before,after),p_audit:audit??null});
  if (error) throw new Error(error.message);return true;
}
export async function saveFeeMetadata<T extends FeeType|FeeStructure>(tenant:string,key:'fee_types'|'fee_structures',before:T[],after:T[]) {
  const db=await createAdminClient();const {error}=await db.rpc('finance_fee_config',{p_tenant:tenant,p_key:key,p_changes:changes(before,after),p_base:before});
  if (error) throw new Error(error.message);return true;
}

/**
 * Targeted reader for single-student fee collection (`collectFeePayment`).
 * Loads only `fee_types`, the target student's `student_fees`, and lightweight madrasa metadata,
 * avoiding a full-tenant scan of thousands of `student_fees` and `fee_payments`.
 */
export async function readStudentFeeCollectionContext(
  madrasaId: string,
  studentId: string,
): Promise<{
  fee_types: FeeType[];
  student_fees: StudentFee[];
  audit_logs: FeeAuditLog[];
  idempotent_payment: FeePayment | null;
}> {
  const adminClient = await createAdminClient();
  const [ftRes, sfData, meta] = await Promise.all([
    adminClient
      .from("fee_types")
      .select("*")
      .eq("madrasa_id", madrasaId)
      .order("created_at", { ascending: true }),
    rows(
      () =>
        adminClient
          .from("student_fees")
          .select("*")
          .eq("madrasa_id", madrasaId)
          .eq("student_id", studentId)
          .order("created_at", { ascending: false }),
      true,
    ),
    getMadrasaMetadata(madrasaId),
  ]);

  const feeTypes: FeeType[] =
    ftRes.data && ftRes.data.length > 0
      ? ftRes.data.map((ft: any) => ({
          ...ft,
          default_amount: Number(ft.default_amount) || 0,
        }))
      : Array.isArray(meta.fee_types) && meta.fee_types.length > 0
        ? meta.fee_types
        : DEFAULT_FEE_TYPES;

  let studentFees: StudentFee[] = (sfData || []).map((sf: any) => ({
    ...sf,
    base_amount: Number(sf.base_amount) || 0,
    discount_amount: Number(sf.discount_amount) || 0,
    fine_amount: Number(sf.fine_amount) || 0,
    payable_amount: Number(sf.payable_amount) || 0,
    paid_amount: Number(sf.paid_amount) || 0,
    due_amount: Number(sf.due_amount) || 0,
  }));

  if (studentFees.length === 0 && Array.isArray(meta.student_fees)) {
    studentFees = meta.student_fees.filter(
      (sf: any) => sf?.student_id === studentId,
    );
  }

  return {
    fee_types: feeTypes,
    student_fees: studentFees,
    audit_logs: Array.isArray(meta.audit_logs) ? meta.audit_logs : [],
    idempotent_payment: null,
  };
}

/**
 * Targeted writer for a single fee collection (`collectFeePayment`).
 * Upserts only the modified `student_fees` rows, the new `fee_payment`, and its
 * `fee_payment_allocations`, plus lightweight audit log metadata.
 */
export async function saveSingleFeeCollection(
  madrasaId: string,
  params: {
    modifiedStudentFees: StudentFee[];
    newPayment: FeePayment;
    auditLogEntry?: FeeAuditLog;
  },
): Promise<boolean> {
  return saveFeeMetadata(madrasaId, {
    student_fees: params.modifiedStudentFees,
    payments: [params.newPayment],
    ...(params.auditLogEntry
      ? {
          audit_logs: [
            params.auditLogEntry,
            ...((await getMadrasaMetadata(madrasaId)).audit_logs || []),
          ].slice(0, 100),
        }
      : {}),
  });
}
