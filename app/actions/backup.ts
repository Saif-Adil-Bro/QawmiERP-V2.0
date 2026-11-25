"use server";

import { createHash } from "node:crypto";
import { toDhakaDateString } from "@/lib/date-utils";
import { includesFinancialBooks, needsFinancialRecovery, safeWipeScope, selectiveRecoveryPlan, type RecoveryOperation, financialRecoveryHold } from "@/lib/finance/recovery";
import { salaryAccess } from "@/lib/finance/staff-access";
import { rows as readRows } from "@/lib/portal/queries";
import { writeGuard } from "@/lib/action-authorization";
import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { getAuthMadrasaId } from "./students";
import { getMadrasaMetadata } from "@/lib/sessions";
import { revalidatePath } from "next/cache";
import type { BackupModuleKey } from "@/lib/backup-modules";
import {
  ALL_BACKUP_MODULE_KEYS,resolveBackupSelection,
  isMetadataKeySelected,
  isTableSelected,
} from "@/lib/backup-modules";

export type { BackupModuleKey } from "@/lib/backup-modules";

export interface BackupManifest {
  app_name: string;
  version: string;
  format: "qawmi_cloud_backup_v2";
  generated_at: string;
  generated_by?: string;
  madrasa_id: string;
  madrasa_name: string;
  madrasa_code?: string;
  modules: BackupModuleKey[];
  total_records: number;
  stats: Record<string, number>;
  checksum: string;
  is_dynamic_universal_schema?: boolean;
  /**
   * ⛔ সিলেক্টিভ ব্যাকআপ ফিক্সের অংশ: ফাইলটি সম্পূর্ণ ব্যাকআপ না আংশিক
   * (শুধু কিছু মডিউল) — সেটি স্পষ্টভাবে রেকর্ড করা হয়, যাতে রিস্টোর ইঞ্জিন
   * অনুমান না করে ঠিক যা আছে তাই ফেরত দেয়।
   */
  is_selective?: boolean;
  included_tables?: string[];
  cold_backup_required_for?: string[];
  included_metadata_keys?: string[] | "ALL";
}

export interface BackupPayload {
  manifest: BackupManifest;
  data: {
    madrasa?: any;
    metadata?: any;
    classes?: any[];
    subjects?: any[];
    class_subjects?: any[];
    teacher_subjects?: any[];
    routines?: any[];
    students?: any[];
    student_enrollments?: any[];
    student_profiles?: Record<string, any>;
    admissions?: any[];
    hifz_logs?: any[];
    kitab_logs?: any[];
    attendance?: any[];
    teacher_attendance?: any[];
    exams?: any[];
    exam_subjects?: any[];
    exam_routines?: any[];
    exam_results?: any[];
    question_bank?: any[];
    exam_papers?: any[];
    fees?: any[];
    expenses?: any[];
    bazar_expenses?: any[];
    donors?: any[];
    donations?: any[];
    funds?: any[];
    zakat_funds?: any[];
    fee_types?: any[];
    fee_structures?: any[];
    student_fees?: any[];
    payments?: any[];
    discounts?: any[];
    mahfils?: any[];
    life_members?: any[];
    subscription_payments?: any[];
    qurbani_leathers?: any[];
    donation_boxes?: any[];
    box_collections?: any[];
    online_donations?: any[];
    online_settings?: any;
    gateways?: any[];
    id_cards?: any[];
    id_card_templates?: any[];
    certificates?: any[];
    certificate_templates?: any[];
    student_leaves?: any[];
    teacher_leaves?: any[];
    alumni?: any[];
    inventory?: any;
    parent_feedbacks?: any[];
    parent_appointments?: any[];
    syllabus?: any[];
    teachers?: any[];
    users?: any[];
    meal_entries?: any[];
    books?: any[];
    book_issues?: any[];
    notices?: any[];
    sms_templates?: any[];
    sms_logs?: any[];
    sessions?: any[];
    academic_holidays?: any[];
    audit_logs?: any[];
    [key: string]: any;
  };
}

export interface BackupAuditEntry {
  id: string;
  type: "BACKUP_EXPORT" | "RESTORE_MERGE" | "RESTORE_REPLACE" | "AUTO_SNAPSHOT" | "SCOPED_WIPE";
  timestamp: string;
  actor_name: string;
  actor_email: string;
  modules: string[];
  total_records: number;
  status: "SUCCESS" | "FAILED" | "WARNING";
  note?: string;
  file_size_kb?: number;
  // ⛔ P2-Fix: আসল snapshot সংরক্ষণের তথ্য (private `backups` storage bucket)
  storage_path?: string;
  checksum?: string;
}

export interface BackupOverviewStats {
  madrasa_name: string;
  madrasa_id: string;
  total_records: number;
  counts: {
    students: number;
    admissions: number;
    classes: number;
    subjects: number;
    routines: number;
    hifz_kitab: number;
    attendance_records: number;
    leaves: number;
    exams: number;
    exam_results: number;
    question_bank: number;
    fees: number;
    finance_transactions: number;
    expenses: number;
    zakat_donations: number;
    donors_funds: number;
    fundraising_special: number;
    payment_gateway: number;
    id_cards: number;
    certificates: number;
    boarding_meals: number;
    library_books: number;
    inventory_items: number;
    teachers_staff: number;
    parent_feedbacks: number;
    notices_sms: number;
    alumni: number;
    sessions_settings: number;
    audit_logs: number;
    dynamic_extensions: number;
    [key: string]: number;
  };
  last_backup?: BackupAuditEntry | null;
  history: BackupAuditEntry[];
}

/**
 * List of known Supabase relational tables.
 * The system automatically queries any table that exists in the database.
 */
const KNOWN_DB_TABLES = [
  "classes",
  "subjects",
  "class_subjects",
  "teacher_subjects",
  "routines",
  "teachers",
  "users",
  "students",
  "student_enrollments",
  "hifz_logs",
  "kitab_logs",
  "attendance",
  "teacher_attendance",
  "exams",
  "exam_subjects",
  "exam_routines",
  "exam_results",
  "question_bank",
  "exam_papers",
  "fees",
  "fee_types",
  "fee_structures",
  "fee_structure_items",
  "student_fees",
  "fee_payments",
  "fee_payment_allocations",
  "treasury_fee_tenders","treasury_journals","treasury_days","treasury_movements","treasury_heads","treasury_memo_index",
  "fee_discount_waivers",
  "fee_audit_logs",
  "expenses",
  "bazar_expenses",
  "donors",
  "donations",
  "funds",
  "zakat_funds",
  "meal_entries",
  "books",
  "book_issues",
  "notices",
  "sms_templates",
  "sms_logs",
  "alumni",
  "leaves",
  "inventory_items",
  "gateways",
  "system_audit_logs",
];

/**
 * Generate a simple hash/checksum for backup data integrity verification
 */
function generateSimpleChecksum(dataStr: string): string {
  let hash = 0;
  for (let i = 0; i < dataStr.length; i++) {
    const char = dataStr.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return "chk_" + Math.abs(hash).toString(16) + "_" + dataStr.length;
}

/**
 * ⛔ P2-Fix: backup/snapshot JSON-কে private `backups` Storage bucket-এ সংরক্ষণ।
 * Bucket না থাকলে স্বয়ংক্রিয়ভাবে বানানো হয় (tenant.ts-এর logos/signatures-এর
 * একই প্যাটার্ন)। ফাইল private — কোনো public URL-এ যায় না।
 */
async function uploadBackupSnapshotFile(
  madrasaId: string,
  json: string
): Promise<{ ok: boolean; storagePath?: string; error?: string }> {
  try {
    const admin = await createAdminClient();
    try {
      await admin.storage.createBucket("backups", { public: false });
    } catch {
      // Bucket আগে থেকেই আছে — স্বাভাবিক
    }
    const bucket=await admin.storage.getBucket('backups');
    if(bucket.error || bucket.data?.public!==false) return {ok:false,error:'Private backup storage unavailable'};
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const storagePath = `snapshots/${madrasaId}/snap_${stamp}_${crypto.randomUUID()}.json`;
    const { error } = await admin.storage
      .from("backups")
      .upload(storagePath, new Blob([json], { type: "application/json" }), {
        contentType: "application/json",
        upsert: false,
      });
    if (error) return { ok: false, error: error.message };
    const saved=await admin.storage.from('backups').download(storagePath);
    if(saved.error || !saved.data || await saved.data.text()!==json) return {ok:false,error:'Snapshot read-back failed'};
    return { ok: true, storagePath };
  } catch (err: any) {
    return { ok: false, error: err?.message || "storage error" };
  }
}

/**
 * Helper to count items in any arbitrary object/array value
 */
function countCollectionItems(val: any): number {
  if (!val) return 0;
  if (Array.isArray(val)) return val.length;
  if (typeof val === "object") {
    // If it's a dictionary of records (e.g. { "id1": {...}, "id2": {...} })
    const keys = Object.keys(val);
    if (keys.length === 0) return 0;
    // Check if values are objects or arrays
    const firstVal = val[keys[0]];
    if (Array.isArray(firstVal)) {
      return keys.reduce((acc, k) => acc + (Array.isArray(val[k]) ? val[k].length : 1), 0);
    }
    return keys.length;
  }
  return 1;
}

/**
 * Get comprehensive overview stats for Backup & Restore Dashboard
 * Self-healing: Scans both DB tables and all dynamic metadata keys!
 */
export async function getBackupOverviewStats(): Promise<{
  success: boolean;
  data?: BackupOverviewStats;
  error?: string;
}> {
  try {
    const backupAccess = await writeGuard("backup");
    if (!backupAccess.allowed) return { success:false, error:backupAccess.error };
    const access = await writeGuard("financeRead");
    if (!access.allowed) return { success:false, error:access.error };
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const madrasaId = await getAuthMadrasaId(supabase, user);
    const admin = await createAdminClient();

    // 1. Get Madrasa Info & Metadata
    const { data: madrasaData } = await admin
      .from("madrasas")
      .select("id, name, registration_no")
      .eq("id", madrasaId)
      .single();

    const madrasaName = madrasaData?.name || "কওমি মাদরাসা";
    const meta = await getMadrasaMetadata(madrasaId);

    // 2. Fetch primary DB counts in parallel
    const [
      studentsRes,
      classesRes,
      subjectsRes,
      teachersRes,
      examsRes,
      examResultsRes,
      attRes,
      feesRes,
      expRes,
      hifzRes,
      mealsRes,
      booksRes,
      noticesRes,
      studentFeesRes,
      feeStructuresRes,
      feeTypesRes,
      feeDiscountsRes,
      feePaymentsRes,
      routinesRes,
      kitabLogsRes,
      teacherAttRes,
      examSubjectsRes,
      bazarExpRes,
      donationsRes,
      donorsRes,
      fundsRes,
      zakatFundsRes,
      sysAuditLogsRes,
    ] = await Promise.all([
      admin.from("students").select("id", { count: "exact", head: true }).eq("madrasa_id", madrasaId),
      admin.from("classes").select("id", { count: "exact", head: true }).eq("madrasa_id", madrasaId),
      admin.from("subjects").select("id", { count: "exact", head: true }).eq("madrasa_id", madrasaId),
      admin.from("teachers").select("id", { count: "exact", head: true }).eq("madrasa_id", madrasaId),
      admin.from("exams").select("id", { count: "exact", head: true }).eq("madrasa_id", madrasaId),
      admin.from("exam_results").select("id", { count: "exact", head: true }).eq("madrasa_id", madrasaId),
      admin.from("attendance").select("id", { count: "exact", head: true }).eq("madrasa_id", madrasaId),
      admin.from("fees").select("id", { count: "exact", head: true }).eq("madrasa_id", madrasaId),
      admin.from("expenses").select("id", { count: "exact", head: true }).eq("madrasa_id", madrasaId),
      admin.from("hifz_logs").select("id", { count: "exact", head: true }).eq("madrasa_id", madrasaId),
      admin.from("meal_entries").select("id", { count: "exact", head: true }).eq("madrasa_id", madrasaId),
      admin.from("books").select("id", { count: "exact", head: true }).eq("madrasa_id", madrasaId),
      admin.from("notices").select("id", { count: "exact", head: true }).eq("madrasa_id", madrasaId),
      admin.from("student_fees").select("id", { count: "exact", head: true }).eq("madrasa_id", madrasaId),
      admin.from("fee_structures").select("id", { count: "exact", head: true }).eq("madrasa_id", madrasaId),
      admin.from("fee_types").select("id", { count: "exact", head: true }).eq("madrasa_id", madrasaId),
      admin.from("fee_discount_waivers").select("id", { count: "exact", head: true }).eq("madrasa_id", madrasaId),
      admin.from("fee_payments").select("id", { count: "exact", head: true }).eq("madrasa_id", madrasaId),
      admin.from("routines").select("id", { count: "exact", head: true }).eq("madrasa_id", madrasaId),
      admin.from("kitab_logs").select("id", { count: "exact", head: true }).eq("madrasa_id", madrasaId),
      admin.from("teacher_attendance").select("id", { count: "exact", head: true }).eq("madrasa_id", madrasaId),
      admin.from("exam_subjects").select("id", { count: "exact", head: true }).eq("madrasa_id", madrasaId),
      admin.from("bazar_expenses").select("id", { count: "exact", head: true }).eq("madrasa_id", madrasaId),
      admin.from("donations").select("id", { count: "exact", head: true }).eq("madrasa_id", madrasaId),
      admin.from("donors").select("id", { count: "exact", head: true }).eq("madrasa_id", madrasaId),
      admin.from("funds").select("id", { count: "exact", head: true }).eq("madrasa_id", madrasaId),
      admin.from("zakat_funds").select("id", { count: "exact", head: true }).eq("madrasa_id", madrasaId),
      admin.from("system_audit_logs").select("id", { count: "exact", head: true }).eq("madrasa_id", madrasaId),
    ]);

    // Student count: actual SQL student rows (do not double-count meta.student_profiles for existing students)
    const studentCount = Math.max(studentsRes.count || 0, countCollectionItems(meta.student_profiles));
    const admissionsCount = countCollectionItems(meta.admissions);
    const classCount = classesRes.count || 0;
    const subjectCount = (subjectsRes.count || 0) + countCollectionItems(meta.syllabus);
    const routinesCount =
      Math.max(routinesRes.count || 0, countCollectionItems(meta.routines)) +
      countCollectionItems(meta.exam_routines);
    const hifzKitabCount =
      (hifzRes.count || 0) +
      Math.max(kitabLogsRes.count || 0, countCollectionItems(meta.kitab_logs));
    const attCount =
      (attRes.count || 0) +
      Math.max(teacherAttRes.count || 0, countCollectionItems(meta.teacher_attendance));
    const leavesCount = countCollectionItems(meta.student_leaves) + countCollectionItems(meta.teacher_leaves);
    const examCount =
      (examsRes.count || 0) +
      Math.max(examSubjectsRes.count || 0, countCollectionItems(meta.exam_subjects));
    const examResultCount = (examResultsRes.count || 0) + countCollectionItems(meta.published_exams);
    const questionBankCount = countCollectionItems(meta.question_bank) + countCollectionItems(meta.exam_papers);
    
    // Fees ledger & setup (prefer relational table counts if present; fallback to metadata counts if 0)
    const relFeesCount =
      (studentFeesRes.count || 0) +
      (feeStructuresRes.count || 0) +
      (feeTypesRes.count || 0) +
      (feeDiscountsRes.count || 0);

    const metaFeesCount =
      countCollectionItems(meta.student_fees) +
      countCollectionItems(meta.fee_structures) +
      countCollectionItems(meta.fee_types) +
      countCollectionItems(meta.discounts);

    const feesCount = Math.max(relFeesCount, metaFeesCount);

    // Cash transactions & fee collection receipts
    const relFinanceTxCount = (feePaymentsRes.count || 0) + (feesRes.count || 0);
    const metaFinanceTxCount = countCollectionItems(meta.payments);

    const financeTransactionsCount = Math.max(relFinanceTxCount, metaFinanceTxCount);
    
    // Expenses and Bazar
    const expensesCount =
      (expRes.count || 0) +
      Math.max(bazarExpRes.count || 0, countCollectionItems(meta.bazar_expenses));
    
    // Zakat & General Donations (Zakat, General, Lillah, and online donations)
    const zakatDonationsCount =
      Math.max(donationsRes.count || 0, countCollectionItems(meta.donations)) +
      Math.max(zakatFundsRes.count || 0, countCollectionItems(meta.zakat_funds)) +
      countCollectionItems(meta.online_donations);
      
    // Donors Register & Fund Categories
    const donorsFundsCount =
      Math.max(donorsRes.count || 0, countCollectionItems(meta.donors)) +
      Math.max(fundsRes.count || 0, countCollectionItems(meta.funds));
      
    // Special Fundraising (Mahfil, Life members, Subscriptions, Leather, Donation boxes)
    const fundraisingSpecialCount =
      countCollectionItems(meta.mahfils) +
      countCollectionItems(meta.life_members) +
      countCollectionItems(meta.subscription_payments) +
      countCollectionItems(meta.qurbani_leathers) +
      countCollectionItems(meta.donation_boxes) +
      countCollectionItems(meta.box_collections);
      
    // Payment Gateway & API configs
    const paymentGatewayCount =
      countCollectionItems(meta.gateways) +
      (meta.online_settings || meta.payment_gateway_config ? 1 : 0);

    // ID Cards & Certificates
    const idCardsCount = countCollectionItems(meta.id_cards) + countCollectionItems(meta.id_card_templates);
    const certificatesCount = countCollectionItems(meta.certificates) + countCollectionItems(meta.certificate_templates);

    // Boarding, Library, Inventory
    const boardingMealsCount = Math.max(mealsRes.count || 0, countCollectionItems(meta.meal_entries));
    const libraryBooksCount = (booksRes.count || 0) + countCollectionItems(meta.book_issues);
    const inventoryCount = countCollectionItems(meta.inventory?.items || meta.inventory);

    // Staff & Users
    const teachersStaffCount =
      Math.max(teachersRes.count || 0, countCollectionItems(meta.staff_members)) +
      countCollectionItems(meta.users);

    // Parent communication & complaints
    const parentFeedbacksCount = countCollectionItems(meta.parent_feedbacks) + countCollectionItems(meta.parent_appointments);

    // Notices & SMS
    const noticesSmsCount = (noticesRes.count || 0) + countCollectionItems(meta.sms_templates) + countCollectionItems(meta.sms_logs);

    // Alumni
    const alumniCount = countCollectionItems(meta.alumni);

    // Sessions & Settings
    const sessionsSettingsCount =
      countCollectionItems(meta.sessions) +
      countCollectionItems(meta.academic_holidays) +
      1; // Madrasa profile settings

    // Audit logs (SQL system_audit_logs + fallback + backup_history)
    const auditLogsCount =
      (sysAuditLogsRes.count || 0) +
      countCollectionItems(meta.system_audit_logs_fallback) +
      countCollectionItems(meta.audit_logs) +
      countCollectionItems(meta.backup_history);

    // Dynamic extensions (any other custom keys in metadata that aren't specifically categorized above)
    const standardMetaKeys = new Set([
      "sessions", "academic_holidays", "backup_history", "student_profiles", "admissions",
      "student_enrollments", "student_fees", "payments", "fee_structures", "fee_types",
      "discounts", "audit_logs", "system_audit_logs_fallback", "receipt_counter", "mahfils", "life_members",
      "subscription_payments", "qurbani_leathers", "donation_boxes", "box_collections",
      "online_donations", "online_settings", "payment_gateway_config", "id_cards", "id_card_templates",
      "certificates", "certificate_templates", "student_leaves", "teacher_leaves",
      "alumni", "inventory", "parent_feedbacks", "parent_appointments", "absence_alert_settings",
      "fee_alert_settings", "syllabus", "published_exams", "kitab_logs", "sms_logs",
      "donors", "donations", "funds", "zakat_funds", "routines", "exam_routines", "question_bank",
      "exam_papers", "bazar_expenses", "gateways", "read_notification_ids", "staff_members"
    ]);

    let dynamicExtensionsCount = 0;
    for (const [key, val] of Object.entries(meta)) {
      if (!standardMetaKeys.has(key) && val) {
        dynamicExtensionsCount += countCollectionItems(val);
      }
    }

    const totalRecords =
      studentCount +
      admissionsCount +
      classCount +
      subjectCount +
      routinesCount +
      hifzKitabCount +
      attCount +
      leavesCount +
      examCount +
      examResultCount +
      questionBankCount +
      feesCount +
      financeTransactionsCount +
      expensesCount +
      zakatDonationsCount +
      donorsFundsCount +
      fundraisingSpecialCount +
      paymentGatewayCount +
      idCardsCount +
      certificatesCount +
      boardingMealsCount +
      libraryBooksCount +
      inventoryCount +
      teachersStaffCount +
      parentFeedbacksCount +
      noticesSmsCount +
      alumniCount +
      sessionsSettingsCount +
      auditLogsCount +
      dynamicExtensionsCount;

    const history: BackupAuditEntry[] = meta.backup_history || [];
    const lastBackup = history.find((h) => h.type === "BACKUP_EXPORT") || history[0] || null;

    return {
      success: true,
      data: {
        madrasa_name: madrasaName,
        madrasa_id: madrasaId,
        total_records: totalRecords,
        counts: {
          students: studentCount,
          admissions: admissionsCount,
          classes: classCount,
          subjects: subjectCount,
          routines: routinesCount,
          hifz_kitab: hifzKitabCount,
          attendance_records: attCount,
          leaves: leavesCount,
          exams: examCount,
          exam_results: examResultCount,
          question_bank: questionBankCount,
          fees: feesCount,
          finance_transactions: financeTransactionsCount,
          expenses: expensesCount,
          zakat_donations: zakatDonationsCount,
          donors_funds: donorsFundsCount,
          fundraising_special: fundraisingSpecialCount,
          payment_gateway: paymentGatewayCount,
          id_cards: idCardsCount,
          certificates: certificatesCount,
          boarding_meals: boardingMealsCount,
          library_books: libraryBooksCount,
          inventory_items: inventoryCount,
          teachers_staff: teachersStaffCount,
          parent_feedbacks: parentFeedbacksCount,
          notices_sms: noticesSmsCount,
          alumni: alumniCount,
          sessions_settings: sessionsSettingsCount,
          audit_logs: auditLogsCount,
          dynamic_extensions: dynamicExtensionsCount,
        },
        last_backup: lastBackup,
        history: history.slice(0, 30),
      },
    };
  } catch (err: any) {
    console.error("Error in getBackupOverviewStats:", err);
    return {
      success: false,
      error: err?.message || "পরিসংখ্যান লোড করতে ব্যর্থ হয়েছে।",
    };
  }
}

/**
 * Universal Dynamic Backup Generator
 * Export the selected books; private memo bytes require the separate database backup.
 */
export async function generateBackupExport(options?: {
  modules?: BackupModuleKey[];
  format?: "formatted" | "minified";
  includeMetadata?: boolean;
}): Promise<{
  success: boolean;
  backupPayload?: BackupPayload;
  backupJson?: string;
  filename?: string;
  error?: string;
}> {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("backup");
    if (!__authz.allowed) return __authz.fallback;
  }

  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const madrasaId = await getAuthMadrasaId(supabase, user);
    const admin = await createAdminClient();

    // 1. Get Madrasa Info & Complete Dynamic Metadata
    const selection = resolveBackupSelection(options?.modules);
    if (includesFinancialBooks(selection)) {
      const financial=await writeGuard('financeRead');
      if (!financial.allowed) return {success:false,error:financial.error};
      if ((selection.isFull || selection.modules.some(m => ["staff", "expenses", "audit_logs"].includes(m))) && !salaryAccess(financial,"read"))
        return {success:false,error:"বেতন-সংক্রান্ত নথিসহ সম্পূর্ণ কপি নেওয়ার অনুমতি নেই।"};
    }
    const { data: madrasaData, error: headerError } = await admin
      .from("madrasas")
      .select("id,name,contact_email,phone,address,logo_url")
      .eq("id", madrasaId)
      .single();

    if (headerError || !madrasaData) throw Error("প্রতিষ্ঠানের পরিচয় পড়া যায়নি।");
    const fullMeta = await getMadrasaMetadata(madrasaId, true);

    const payloadData: BackupPayload["data"] = {};
    const stats: Record<string, number> = {};
    let totalCount = 0;

    // ⛔ সিলেক্টিভ ব্যাকআপ ফিক্স — এখানেই আসল বাগটি ছিল।
    // আগে `options.modules` শুধু manifest-এ লেখা হতো; ডেটা সব ৪৪টি টেবিল ও সম্পূর্ণ
    // মেটাডেটা থেকে তোলা হতো। ফলে "শুধু শিক্ষার্থী" টিক দিলেও ফাইলে ফি/খরচ/যাকাত/
    // বেতন — সব চলে যেত, আর manifest মিথ্যা দাবি করত যে কিছু নির্দিষ্ট মডিউল আছে।
    // এখন নির্বাচনকে বাস্তব টেবিল/metadata-কী-তে রূপান্তর করে তারপরই কুয়েরি চালানো হয়।


    const tablesToFetch =
      selection.tables === "ALL"
        ? KNOWN_DB_TABLES
        : KNOWN_DB_TABLES.filter((table) => isTableSelected(table, selection));

    // Dynamic Helper to query any table safely
    const fetchTableSafe = async (tableName: string) => {
      if(tableName==='treasury_memo_index') {
        const out:any[]=[];for(let after:string|null=null;;){
          const {data,error}:{data:any;error:unknown}=await admin.rpc('treasury_memo_index',{t:madrasaId,after_id:after});
          if(error || !Array.isArray(data))throw Error('মেমোর সূচি পড়া যায়নি।');
          out.push(...data);if(data.length<500)return out;after=data.at(-1).expense_id;
        }
      }
      if(tableName==='treasury_days'||tableName==='treasury_fee_tenders') {
        const q=()=>admin.from(tableName).select('*').eq('madrasa_id',madrasaId);
        return tableName==='treasury_days'?readRows(()=>q().order('operator_id'),false,'cash_date'):readRows(q,false,'payment_id');
      }
      // These children have no tenant column of their own. Scope through the
      // owning receipt/structure, never return another school's allocations.
      if(['fee_payment_allocations','fee_structure_items'].includes(tableName)) {
        const out:any[]=[];
        for(let after:string|null=null;;){
          const {data,error}: {data:unknown;error:unknown}=await admin.rpc('finance_backup_children',{t:madrasaId,k:tableName,after_id:after});
          if(error || !Array.isArray(data)) throw Error('ব্যাকআপের আর্থিক রেকর্ড পড়া যায়নি।');
          out.push(...data);if(data.length<500) return out;after=data[data.length-1].id;
        }
      }
      // Some installations keep these optional modules only in metadata. Only
      // a known absent *optional table* is empty, never a denied or partial read.
      const optional=['kitab_logs','exam_routines','exam_papers','question_bank','book_issues','funds','sms_templates','sms_logs','alumni','leaves','gateways'];
      return readRows(()=>admin.from(tableName).select('*').eq('madrasa_id',madrasaId),optional.includes(tableName));
    };

    // Auto-probe only the tables that belong to the selected modules
    const tablePromises = tablesToFetch.map(async (table) => {
      const rows = await fetchTableSafe(table);
      return { table, rows };
    });

    const tableResults = await Promise.all(tablePromises);
    for (const { table, rows } of tableResults) {
      if (rows && rows.length > 0) {
        if (table === "users") {
          payloadData.users = rows.map((u: any) => ({
            id: u.id,
            role: u.role,
            full_name: u.full_name,
            email: u.email,
            phone: u.phone,
            created_at: u.created_at,
          }));
          stats[table] = payloadData.users.length;
          totalCount += payloadData.users.length;
        } else {
          payloadData[table] = rows;
          stats[table] = rows.length;
          totalCount += rows.length;
        }
      }
    }

    // 2. Metadata — কেবল নির্বাচিত মডিউলের কী (সম্পূর্ণ ব্যাকআপ হলে আগের মতোই সব)
    // আগে এখানে fullMeta হুবহু বসানো হতো, এমনকি আংশিক নির্বাচনেও।
    const filteredMeta: Record<string, any> = {};
    for (const [key, val] of Object.entries(fullMeta)) {
      if (val === undefined || val === null) continue;
      if (!isMetadataKeySelected(key, selection)) continue;
      filteredMeta[key] = val;
    }

    payloadData.metadata = filteredMeta;

    // মাদ্রাসা প্রোফাইল কেবল settings মডিউলে (বা সম্পূর্ণ ব্যাকআপে) — আংশিক ব্যাকআপে
    // ভুল করে মাদ্রাসার নাম/ঠিকানা বদলে যাওয়া ঠেকাতে।
    if (selection.includeMadrasaProfile) {
      payloadData.madrasa = madrasaData || {};
    }

    // Decompose selected metadata into top-level keys for easy access
    for (const [key, val] of Object.entries(filteredMeta)) {
      if (val !== undefined && val !== null) {
        // Expose top level key if not already populated by table
        if (!KNOWN_DB_TABLES.includes(key) && !payloadData[key]) {
          payloadData[key] = val;
        }
        const itemCount = countCollectionItems(val);
        if (itemCount > 0 && !stats[key]) {
          stats[key] = itemCount;
          // Count only if not already counted as a database table
          if (!KNOWN_DB_TABLES.includes(key)) {
            totalCount += itemCount;
          }
        }
      }
    }

    // Module grouping — নির্বাচন এখন আসলেই ডেটা নির্ধারণ করেছে
    const selectedModules: BackupModuleKey[] = selection.modules as BackupModuleKey[];

    const includedTables = Object.keys(payloadData).filter(
      (key) =>
        key !== "metadata" &&
        key !== "madrasa" &&
        KNOWN_DB_TABLES.includes(key) &&
        Array.isArray((payloadData as any)[key])
    );

    const now = new Date();
    const isoDate = now.toISOString();
    const dateFormatted = toDhakaDateString(now);
    const safeMadrasaName = (madrasaData?.name || "madrasa").replace(/[^a-zA-Z0-9\u0980-\u09FF]/g, "_");
    const filename = `Qawmi_Backup_${safeMadrasaName}_${dateFormatted}_${Math.floor(Date.now() / 1000)}.json`;

    // Stringify data to compute checksum
    const rawDataString = JSON.stringify(payloadData);
    const checksum = "sha256:"+createHash("sha256").update(rawDataString).digest("hex");

    const manifest: BackupManifest = {
      ...(stats.treasury_memo_index ? {cold_backup_required_for:["treasury_memos.image"]}:{}),
      app_name: "QawmiManager Pro",
      version: "3.0.0",
      format: "qawmi_cloud_backup_v2",
      generated_at: isoDate,
      generated_by: user?.email || "Admin",
      madrasa_id: madrasaId,
      madrasa_name: madrasaData?.name || "কওমি মাদরাসা",
      modules: selectedModules,
      total_records: totalCount,
      stats: stats,
      checksum: checksum,
      is_dynamic_universal_schema: true,
      // সিলেক্টিভ ব্যাকআপ — কোন টেবিল ও metadata key সত্যিই ফাইলে আছে
      is_selective: !selection.isFull,
      included_tables: includedTables,
      included_metadata_keys:
        selection.metadataKeys === "ALL"
          ? "ALL"
          : Object.keys(filteredMeta).sort(),
    };

    const finalPayload: BackupPayload = {
      manifest,
      data: payloadData,
    };

    const jsonOutput =
      options?.format === "minified"
        ? JSON.stringify(finalPayload)
        : JSON.stringify(finalPayload, null, 2);

    const sizeKb = Math.round((new Blob([jsonOutput]).size || jsonOutput.length) / 1024);

    // Save audit log to metadata
    const newLog: BackupAuditEntry = {
      id: "bk_" + Date.now(),
      type: "BACKUP_EXPORT",
      timestamp: isoDate,
      actor_name: user?.user_metadata?.full_name || "সুপার এডমিন",
      actor_email: user?.email || "admin@qawmi.edu",
      modules: selectedModules,
      total_records: totalCount,
      status: "SUCCESS",
      file_size_kb: sizeKb,
      note: selection.isFull
        ? `অ্যাপ এক্সপোর্ট তৈরি হয়েছে (${totalCount} টি রেকর্ড); এটি ডাটাবেজ স্ন্যাপশট নয়।`
        : `নির্বাচিত ${selectedModules.length} টি মডিউলের ব্যাকআপ তৈরি হয়েছে (সর্বমোট ${totalCount} টি রেকর্ড) — শুধুমাত্র নির্বাচিত ডেটাই অন্তর্ভুক্ত`,
    };

    const audit=await admin.rpc('finance_backup_note',{t:madrasaId,actor:user?.id,note:newLog});
    if(audit.error) throw Error('ব্যাকআপের অডিট সংরক্ষণ নিশ্চিত হয়নি।');

    return {
      success: true,
      backupPayload: finalPayload,
      backupJson: jsonOutput,
      filename: filename,
    };
  } catch (err: any) {
    console.error("Exception in generateBackupExport:", err);
    return {
      success: false,
      error: err?.message || "ব্যাকআপ তৈরিতে ত্রুটি দেখা দিয়েছে।",
    };
  }
}

/**
 * Universal Dynamic Backup File Analyzer
 * Detects all standard, new, and future custom extension data fields automatically.
 */
export async function analyzeBackupFile(fileContent: string): Promise<{
  isValid: boolean;
  manifest?: BackupManifest;
  moduleCounts?: Record<string, number>;
  totalRecords?: number;
  warnings?: string[];
  error?: string;
  parsedPayload?: BackupPayload;
}> {
  try {
    if (!fileContent || typeof fileContent !== "string") {
      return { isValid: false, error: "ব্যাকআপ ফাইলটি খালি বা অকার্যকর।" };
    }

    let parsed: any;
    try {
      parsed = JSON.parse(fileContent);
    } catch {
      return { isValid: false, error: "ফাইলটি বৈধ JSON ফরম্যাট নয়।" };
    }

    if (!parsed || typeof parsed !== "object") {
      return { isValid: false, error: "অবৈধ ব্যাকআপ স্ট্রাকচার।" };
    }

    let manifest: BackupManifest;
    let dataObj: any;

    if (parsed.manifest && parsed.data) {
      manifest = parsed.manifest;
      dataObj = parsed.data;
    } else if (parsed.data || parsed.students || parsed.classes) {
      dataObj = parsed.data || parsed;
      manifest = {
        app_name: parsed.app_name || "QawmiManager",
        version: parsed.version || "1.0.0",
        format: "qawmi_cloud_backup_v2",
        generated_at: parsed.generated_at || parsed.export_date || new Date().toISOString(),
        madrasa_id: parsed.madrasa_id || "portable",
        madrasa_name: parsed.madrasa_name || "কওমি মাদরাসা",
        modules: [
          "students",
          "academic",
          "attendance",
          "exams",
          "finance",
          "fundraising",
          "staff",
          "boarding",
          "library",
          "communication",
          "certificates",
          "leaves",
          "inventory",
          "settings",
          "all_metadata",
        ],
        total_records: 0,
        stats: {},
        checksum: "legacy_format",
        is_dynamic_universal_schema: true,
      };
    } else {
      return { isValid: false, error: "এই ফাইলে কোনো চেনার উপযোগী কওমি ব্যাকআপ ডেটা পাওয়া যায়নি।" };
    }

    // Dynamic Granular Category Calculation Engine
    const moduleCounts: Record<string, number> = {
      students: countCollectionItems(dataObj.students) + countCollectionItems(dataObj.student_enrollments) + countCollectionItems(dataObj.student_profiles),
      admissions: countCollectionItems(dataObj.admissions),
      academic: countCollectionItems(dataObj.classes) + countCollectionItems(dataObj.subjects) + countCollectionItems(dataObj.class_subjects) + countCollectionItems(dataObj.teacher_subjects) + countCollectionItems(dataObj.syllabus),
      routines: countCollectionItems(dataObj.routines) + countCollectionItems(dataObj.exam_routines),
      hifz_kitab: countCollectionItems(dataObj.hifz_logs) + countCollectionItems(dataObj.kitab_logs),
      attendance: countCollectionItems(dataObj.attendance) + countCollectionItems(dataObj.teacher_attendance),
      leaves: countCollectionItems(dataObj.student_leaves) + countCollectionItems(dataObj.teacher_leaves),
      exams: countCollectionItems(dataObj.exams) + countCollectionItems(dataObj.exam_subjects) + countCollectionItems(dataObj.exam_results) + countCollectionItems(dataObj.published_exams),
      question_bank: countCollectionItems(dataObj.question_bank) + countCollectionItems(dataObj.exam_papers),
      fees: countCollectionItems(dataObj.fee_structures) + countCollectionItems(dataObj.student_fees) + countCollectionItems(dataObj.discounts) + countCollectionItems(dataObj.fee_types) + countCollectionItems(dataObj.fee_structure_items) + countCollectionItems(dataObj.fee_discount_waivers),
      finance_transactions: countCollectionItems(dataObj.fees) + countCollectionItems(dataObj.payments) + countCollectionItems(dataObj.fee_payments) + countCollectionItems(dataObj.fee_payment_allocations),
      expenses: countCollectionItems(dataObj.expenses) + countCollectionItems(dataObj.bazar_expenses),
      zakat_donations: countCollectionItems(dataObj.donations) + countCollectionItems(dataObj.zakat_funds) + countCollectionItems(dataObj.online_donations),
      donors_funds: countCollectionItems(dataObj.donors) + countCollectionItems(dataObj.funds),
      fundraising_special: countCollectionItems(dataObj.mahfils) + countCollectionItems(dataObj.life_members) + countCollectionItems(dataObj.subscription_payments) + countCollectionItems(dataObj.qurbani_leathers) + countCollectionItems(dataObj.donation_boxes) + countCollectionItems(dataObj.box_collections),
      payment_gateway: countCollectionItems(dataObj.gateways) + (dataObj.online_settings ? 1 : 0),
      id_cards: countCollectionItems(dataObj.id_cards) + countCollectionItems(dataObj.id_card_templates),
      certificates: countCollectionItems(dataObj.certificates) + countCollectionItems(dataObj.certificate_templates),
      boarding: countCollectionItems(dataObj.meal_entries),
      library: countCollectionItems(dataObj.books) + countCollectionItems(dataObj.book_issues),
      inventory: countCollectionItems(dataObj.inventory?.items || dataObj.inventory),
      staff: countCollectionItems(dataObj.teachers) + countCollectionItems(dataObj.users),
      communication: countCollectionItems(dataObj.parent_feedbacks) + countCollectionItems(dataObj.parent_appointments),
      notices_sms: countCollectionItems(dataObj.notices) + countCollectionItems(dataObj.sms_templates) + countCollectionItems(dataObj.sms_logs),
      alumni: countCollectionItems(dataObj.alumni),
      settings: countCollectionItems(dataObj.sessions) + countCollectionItems(dataObj.academic_holidays) + (dataObj.madrasa ? 1 : 0),
      audit_logs: countCollectionItems(dataObj.audit_logs) + countCollectionItems(dataObj.backup_history) + countCollectionItems(dataObj.fee_audit_logs),
    };

    // Calculate dynamic unknown extension keys
    const knownKeys = new Set([
      "students", "admissions", "student_enrollments", "student_profiles", "classes", "subjects",
      "class_subjects", "teacher_subjects", "routines", "teachers", "users", "attendance",
      "teacher_attendance", "exams", "exam_subjects", "exam_routines", "exam_results",
      "question_bank", "exam_papers", "fees", "expenses", "bazar_expenses", "donations",
      "donors", "funds", "zakat_funds", "student_fees", "payments", "fee_structures",
      "fee_types", "discounts", "mahfils", "life_members", "subscription_payments",
      "qurbani_leathers", "donation_boxes", "box_collections", "online_donations",
      "online_settings", "id_cards", "id_card_templates", "certificates",
      "certificate_templates", "student_leaves", "teacher_leaves", "alumni", "inventory",
      "hifz_logs", "kitab_logs", "meal_entries", "books", "book_issues", "notices",
      "sms_templates", "sms_logs", "syllabus", "sessions", "academic_holidays",
      "madrasa", "metadata", "published_exams", "receipt_counter", "audit_logs", "backup_history",
      "fee_payments", "fee_payment_allocations", "fee_structure_items", "fee_discount_waivers", "fee_audit_logs"
    ]);

    let dynamicExtCount = 0;
    for (const [k, v] of Object.entries(dataObj)) {
      if (!knownKeys.has(k) && v) {
        const c = countCollectionItems(v);
        if (c > 0) {
          dynamicExtCount += c;
          moduleCounts[`ext_${k}`] = c;
        }
      }
    }

    if (dynamicExtCount > 0) {
      moduleCounts["dynamic_extensions"] = dynamicExtCount;
    }

    const totalRecords = Object.values(moduleCounts).reduce((acc, c) => acc + c, 0);
    manifest.total_records = totalRecords;

    const warnings: string[] = [];

    // Check target madrasa
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const currentMadrasaId = await getAuthMadrasaId(supabase, user);

    if (manifest.madrasa_id && manifest.madrasa_id !== "portable" && manifest.madrasa_id !== currentMadrasaId) {
      warnings.push(
        `সতর্কবার্তা: এই ব্যাকআপটি অন্য মাদরাসা ("${manifest.madrasa_name || manifest.madrasa_id}") থেকে তৈরি হয়েছিল। রিস্টোর করার সময় ডাটা স্বয়ংক্রিয়ভাবে আপনার বর্তমান মাদরাসায় নিরাপদে রি-ম্যাপ (Re-map) করা হবে।`
      );
    }

    if (totalRecords === 0) {
      warnings.push("ফাইলটিতে রিস্টোর করার মতো কোনো ডেটা রেকর্ড পাওয়া যায়নি।");
    }

    return {
      isValid: true,
      manifest,
      moduleCounts,
      totalRecords,
      warnings,
      parsedPayload: { manifest, data: dataObj },
    };
  } catch (err: any) {
    return {
      isValid: false,
      error: err?.message || "ফাইল বিশ্লেষণে সমস্যা হয়েছে।",
    };
  }
}

// Scope checks precede this helper. Never write financial books via import.
async function applySelectiveRecovery(madrasaId:string, user:{id:string;email?:string}, modules:string[], operation:RecoveryOperation, data:BackupPayload['data']) {
  const fail=(error:string,message:string)=>({success:false as const,error,message});
  const snapshot=await generateBackupExport({modules,format:'minified'});
  if(!snapshot.success || !snapshot.backupJson || !snapshot.backupPayload || snapshot.backupPayload.manifest.madrasa_id!==madrasaId)
    return fail('SNAPSHOT_INCOMPLETE','বর্তমান ডেটার সম্পূর্ণ কপি পড়া যায়নি। কোনো রেকর্ড পরিবর্তন করা হয়নি।');
  const plan=selectiveRecoveryPlan(resolveBackupSelection(modules),operation,snapshot.backupPayload.data,data);
  const upload=await uploadBackupSnapshotFile(madrasaId,snapshot.backupJson);
  if(!upload.ok || !upload.storagePath) return fail('SNAPSHOT_UNAVAILABLE','স্ন্যাপশট সংরক্ষণ ও যাচাই নিশ্চিত হয়নি। কোনো রেকর্ড পরিবর্তন করা হয়নি।');
  const note:BackupAuditEntry={id:crypto.randomUUID(),type:'AUTO_SNAPSHOT',timestamp:new Date().toISOString(),
    actor_email:user.email || '',actor_name:user.email || 'প্রশাসক',modules,total_records:snapshot.backupPayload.manifest.total_records,status:'SUCCESS',
    storage_path:upload.storagePath,checksum:snapshot.backupPayload.manifest.checksum};
  const admin=await createAdminClient();
  const saved=await admin.rpc('finance_backup_note',{t:madrasaId,actor:user.id,note});
  if(saved.error) return fail('SNAPSHOT_UNRECORDED','স্ন্যাপশটের রেফারেন্স সংরক্ষণ হয়নি। কোনো রেকর্ড পরিবর্তন করা হয়নি।');
  const audit:BackupAuditEntry={...note,id:crypto.randomUUID(),total_records:plan.total,type:operation==='wipe'?'SCOPED_WIPE':operation==='replace'?'RESTORE_REPLACE':'RESTORE_MERGE'};
  const {error}=await admin.rpc('finance_apply_recovery',{t:madrasaId,actor:user.id,plan:{...plan,snapshot_id:note.id,audit}});
  // On an interrupted HTTP response the caller may not know whether PostgreSQL
  // committed. Direct the operator to the exact snapshot/audit, not a blind retry.
  if(error) return fail('RECOVERY_NOT_CONFIRMED',`পরিবর্তন নিশ্চিত হয়নি। আবার চেষ্টা করার আগে হিস্ট্রিতে স্ন্যাপশট ${note.id} ও ফলাফল ${audit.id} যাচাই করুন।`);
  revalidatePath('/dashboard','layout');
  return {success:true as const,message:`নির্বাচিত মডিউলের কাজ সম্পন্ন হয়েছে (${plan.total} রেকর্ড)।`,stats:plan.stats,total:plan.total,backupJson:snapshot.backupJson};
}

export async function executeDataRestore({
  backupPayload,
  restoreMode,
  selectedModules,
  createAutoSnapshot = true,
}: {
  backupPayload: BackupPayload;
  restoreMode: "merge" | "replace";
  selectedModules?: BackupModuleKey[];
  createAutoSnapshot?: boolean;
}): Promise<{
  success: boolean;
  message: string;
  restoredStats?: Record<string, number>;
  totalRestored?: number;
  error?: string;
}> {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("backup");
    if (!__authz.allowed) return __authz.fallback;
  }

  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!backupPayload || !backupPayload.data) {
      return { success: false, message: "অবৈধ ব্যাকআপ ডেটা লোড হয়েছে।", error: "Missing data payload" };
    }

    // ⛔ P2-Fix: রিস্টোরের আগে checksum verify — নষ্ট/পরিবর্তিত ফাইল DB-তে
    // লেখা যাবে না। (legacy format ফাইল-এর checksum "legacy_format" হলে skip)
    const declaredChecksum = (backupPayload as any)?.manifest?.checksum;
    if (declaredChecksum && declaredChecksum !== "legacy_format") {
      const raw=JSON.stringify(backupPayload.data);
      const recomputed = String(declaredChecksum).startsWith("sha256:") ? "sha256:"+createHash("sha256").update(raw).digest("hex") : generateSimpleChecksum(raw);
      if (declaredChecksum !== recomputed) {
        return {
          success: false,
          message:
            "ব্যাকআপ ফাইলের checksum মেলে না — ফাইলটি নষ্ট বা পরিবর্তিত হতে পারে। নতুন ব্যাকআপ ফাইল ডাউনলোড করে আবার চেষ্টা করুন।",
          error: "CHECKSUM_MISMATCH",
        };
      }
    }

    if(!user) return {success:false,message:"অনুমতি নেই।"};
    const dataObj = backupPayload.data;
    if (!madrasaId || backupPayload.manifest?.madrasa_id!==madrasaId) {
      return {success:false,message:"অন্য প্রতিষ্ঠানের ব্যাকআপ এখানে রিস্টোর করা যাবে না।",error:"TENANT_MISMATCH"};
    }

    // ⛔ সিলেক্টিভ রিস্টোর ফিক্স: আগে `selectedModules` শুধু অডিট-লগে লেখা হতো —
    // ফাইলে যা ছিল সবই রিস্টোর হয়ে যেত। ফলে "শুধু শিক্ষার্থী" রিস্টোর করতে চাইলেও
    // ফি/খরচ/যাকাত সব ঢুকে পড়ত (replace মোডে অন্য মডিউলের ডেটাও মুছে যেত)।
    // এখন ব্যাকআপের মতো একই ম্যাপ দিয়ে রিস্টোরও সীমাবদ্ধ করা হয়।
    //
    // ⛔ দ্বিতীয় স্তর: স্কোপ কেবল ক্লায়েন্টের পাঠানো `selectedModules`-এর উপর
    // নির্ভর করে না। ফাইলের manifest যদি নিজেকে সিলেক্টিভ বলে (`is_selective: true`),
    // তাহলে manifest-এর তালিকাই চূড়ান্ত — কেউ ভুলে/ইচ্ছে করে বেশি মডিউল পাঠালেও
    // আংশিক ফাইল "সম্পূর্ণ" হিসেবে রিস্টোর হতে পারবে না, এবং Replace-এর CASCADE
    // গার্ডও বাইপাস হবে না।
    const declaredManifest = (backupPayload as any)?.manifest;
    const manifestScope =
      declaredManifest?.is_selective === true &&
      Array.isArray(declaredManifest?.modules) &&
      declaredManifest.modules.length > 0
        ? (declaredManifest.modules as BackupModuleKey[])
        : null;
    const effectiveModules = manifestScope && selectedModules?.length ? selectedModules.filter(m=>manifestScope.includes(m)) : manifestScope ?? selectedModules;
    if(effectiveModules && (!effectiveModules.length || effectiveModules.some(m=>!ALL_BACKUP_MODULE_KEYS.includes(m) && !['all_metadata','ALL'].includes(m)))) return {success:false,message:'ব্যাকআপের মডিউল মেলেনি।'};
    const selection = resolveBackupSelection(effectiveModules);
    if (needsFinancialRecovery(selection)) return financialRecoveryHold;
    if(!createAutoSnapshot || !['merge','replace'].includes(restoreMode)) return {success:false,message:'রিস্টোরের আগে যাচাইকৃত স্ন্যাপশট আবশ্যক।',error:'SNAPSHOT_REQUIRED'};
    if (restoreMode==='replace' && Array.from(selection.tables).length) return {success:false,message:'সম্পর্কযুক্ত টেবিলের সিলেক্টিভ রিস্টোর কেবল Merge মোডে করা যাবে।',error:'PARTIAL_REPLACE_BLOCKED'};

    const result=await applySelectiveRecovery(madrasaId,user,selection.modules,restoreMode,dataObj);
    if(!result.success) return result;
    return {success:true,message:result.message,restoredStats:result.stats,totalRestored:result.total};
  } catch (err: any) {
    console.error("Exception in executeDataRestore:", err);
    return {
      success: false,
      message: "রিস্টোর প্রক্রিয়ায় আকস্মিক ত্রুটি দেখা দিয়েছে।",
      error: err?.message || String(err),
    };
  }
}

export interface WipeMadrasaOptions {
  scope: "all" | "academics" | "finance" | "custom";
  confirmationPhrase: string;
  selectedModules?: string[];
  preserveTeachersAndStaff?: boolean;
  preserveSessions?: boolean;
}

/**
 * Enterprise-Grade Safe Madrasa Data Wipe / Factory Reset Engine
 * Fully resets/erases selected or all operational data for this madrasa tenant.
 */
export async function executeMadrasaDataWipe(options: WipeMadrasaOptions): Promise<{
  success: boolean;
  message: string;
  wipedStats?: Record<string, number>;
  totalWiped?: number;
  preWipeBackupJson?: string;
  error?: string;
}> {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("backup");
    if (!__authz.allowed) return __authz.fallback;
  }

  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) {
      return { success: false, message: "অননুমোদিত অ্যাক্সেস। অনুগ্রহ করে পুনরায় লগইন করুন।" };
    }

    const madrasaId = await getAuthMadrasaId(supabase, user);
    // 1. Strict Passphrase Verification
    const phrase = (options.confirmationPhrase || "").trim().toUpperCase();
    const validPhrases = ["DELETE ALL DATA", "মুছে ফেলুন", "DELETE", "WIPE", "RESET", "রিসেট"];
    const isValidPhrase = validPhrases.some((vp) => phrase === vp.toUpperCase() || phrase === vp);

    if (!isValidPhrase) {
      return {
        success: false,
        message: "নিশ্চিতকরণ টেক্সট মেলেনি। অনুগ্রহ করে 'মুছে ফেলুন' বা 'DELETE' সঠিকভাবে লিখুন।",
      };
    }

    if (!safeWipeScope(options.scope, options.selectedModules)) return financialRecoveryHold;

    const result=await applySelectiveRecovery(madrasaId,user,options.selectedModules!,'wipe',{});
    if(!result.success) return result;
    return {success:true,message:result.message,wipedStats:result.stats,totalWiped:result.total,preWipeBackupJson:result.backupJson};
  } catch (err: any) {
    console.error("Exception in executeMadrasaDataWipe:", err);
    return {
      success: false,
      message: "ডাটা মোছার প্রক্রিয়ায় অপ্রত্যাশিত ত্রুটি ঘটেছে।",
      error: err?.message || String(err),
    };
  }
}
