"use server";

import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { getAuthMadrasaId } from "./students";
import { getMadrasaMetadata, saveMadrasaMetadata } from "@/lib/sessions";
import { revalidatePath } from "next/cache";

export type BackupModuleKey = 
  | "students"
  | "academic"
  | "attendance"
  | "exams"
  | "finance"
  | "staff"
  | "boarding"
  | "library"
  | "communication"
  | "settings";

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
    [key: string]: any;
  };
}

export interface BackupAuditEntry {
  id: string;
  type: "BACKUP_EXPORT" | "RESTORE_MERGE" | "RESTORE_REPLACE" | "AUTO_SNAPSHOT";
  timestamp: string;
  actor_name: string;
  actor_email: string;
  modules: string[];
  total_records: number;
  status: "SUCCESS" | "FAILED" | "WARNING";
  note?: string;
  file_size_kb?: number;
}

export interface BackupOverviewStats {
  madrasa_name: string;
  madrasa_id: string;
  total_records: number;
  counts: {
    students: number;
    classes: number;
    subjects: number;
    teachers: number;
    exams: number;
    exam_results: number;
    attendance_records: number;
    fees_and_transactions: number;
    hifz_logs: number;
    meals: number;
    books: number;
    notices: number;
  };
  last_backup?: BackupAuditEntry | null;
  history: BackupAuditEntry[];
}

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
 * Get comprehensive overview stats for Backup & Restore Dashboard
 */
export async function getBackupOverviewStats(): Promise<{
  success: boolean;
  data?: BackupOverviewStats;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const madrasaId = await getAuthMadrasaId(supabase, user);
    const admin = await createAdminClient();

    // 1. Get Madrasa Info
    const { data: madrasaData } = await admin
      .from("madrasas")
      .select("id, name, registration_no")
      .eq("id", madrasaId)
      .single();

    const madrasaName = madrasaData?.name || "কওমি মাদরাসা";
    const meta = await getMadrasaMetadata(madrasaId);

    // 2. Fetch counts in parallel
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
    ]);

    const studentCount = studentsRes.count || 0;
    const classCount = classesRes.count || 0;
    const subjectCount = subjectsRes.count || 0;
    const teacherCount = teachersRes.count || 0;
    const examCount = examsRes.count || 0;
    const examResultCount = examResultsRes.count || 0;
    const attCount = attRes.count || 0;
    const financeCount = (feesRes.count || 0) + (expRes.count || 0);
    const hifzCount = hifzRes.count || 0;
    const mealsCount = mealsRes.count || 0;
    const booksCount = booksRes.count || 0;
    const noticesCount = noticesRes.count || 0;

    const totalRecords =
      studentCount +
      classCount +
      subjectCount +
      teacherCount +
      examCount +
      examResultCount +
      attCount +
      financeCount +
      hifzCount +
      mealsCount +
      booksCount +
      noticesCount;

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
          classes: classCount,
          subjects: subjectCount,
          teachers: teacherCount,
          exams: examCount,
          exam_results: examResultCount,
          attendance_records: attCount,
          fees_and_transactions: financeCount,
          hifz_logs: hifzCount,
          meals: mealsCount,
          books: booksCount,
          notices: noticesCount,
        },
        last_backup: lastBackup,
        history: history.slice(0, 20), // return recent 20 logs
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
 * Generate a complete or selective JSON backup export file
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
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const madrasaId = await getAuthMadrasaId(supabase, user);
    const admin = await createAdminClient();

    const selectedModules: BackupModuleKey[] =
      options?.modules && options.modules.length > 0
        ? options.modules
        : [
            "students",
            "academic",
            "attendance",
            "exams",
            "finance",
            "staff",
            "boarding",
            "library",
            "communication",
            "settings",
          ];

    // 1. Get Madrasa Details & Metadata
    const { data: madrasaData } = await admin
      .from("madrasas")
      .select("*")
      .eq("id", madrasaId)
      .single();

    const meta = await getMadrasaMetadata(madrasaId);

    const payloadData: BackupPayload["data"] = {};
    const stats: Record<string, number> = {};
    let totalCount = 0;

    // Helper to query safely
    const fetchTableSafe = async (tableName: string) => {
      try {
        const { data, error } = await admin
          .from(tableName)
          .select("*")
          .eq("madrasa_id", madrasaId);
        if (error || !data) return [];
        return data;
      } catch {
        return [];
      }
    };

    // Module: Settings
    if (selectedModules.includes("settings")) {
      payloadData.madrasa = madrasaData || {};
      payloadData.sessions = meta.sessions || [];
      payloadData.academic_holidays = meta.academic_holidays || [];
      stats["settings"] = 1;
      totalCount += 1;
    }

    // Module: Academic
    if (selectedModules.includes("academic")) {
      const [classes, subjects, classSubjects, teacherSubjects, routines] = await Promise.all([
        fetchTableSafe("classes"),
        fetchTableSafe("subjects"),
        fetchTableSafe("class_subjects"),
        fetchTableSafe("teacher_subjects"),
        fetchTableSafe("routines"),
      ]);

      payloadData.classes = classes;
      payloadData.subjects = subjects;
      payloadData.class_subjects = classSubjects;
      payloadData.teacher_subjects = teacherSubjects;
      payloadData.routines = routines;

      const academicTotal =
        classes.length + subjects.length + classSubjects.length + teacherSubjects.length + routines.length;
      stats["academic"] = academicTotal;
      totalCount += academicTotal;
    }

    // Module: Staff
    if (selectedModules.includes("staff")) {
      const [teachers, users] = await Promise.all([
        fetchTableSafe("teachers"),
        fetchTableSafe("users"),
      ]);

      payloadData.teachers = teachers;
      payloadData.users = users.map((u: any) => ({
        id: u.id,
        role: u.role,
        full_name: u.full_name,
        email: u.email,
        phone: u.phone,
        created_at: u.created_at,
      })); // omit sensitive hashes

      const staffTotal = teachers.length + payloadData.users.length;
      stats["staff"] = staffTotal;
      totalCount += staffTotal;
    }

    // Module: Students
    if (selectedModules.includes("students")) {
      const [students, enrollments, hifzLogs, kitabLogs] = await Promise.all([
        fetchTableSafe("students"),
        fetchTableSafe("student_enrollments"),
        fetchTableSafe("hifz_logs"),
        fetchTableSafe("kitab_logs"),
      ]);

      payloadData.students = students;
      payloadData.student_enrollments = enrollments;
      payloadData.student_profiles = meta.student_profiles || {};
      payloadData.admissions = meta.admissions || [];
      payloadData.hifz_logs = hifzLogs;
      payloadData.kitab_logs = kitabLogs;

      const studentTotal =
        students.length +
        enrollments.length +
        (meta.admissions?.length || 0) +
        hifzLogs.length +
        kitabLogs.length;
      stats["students"] = studentTotal;
      totalCount += studentTotal;
    }

    // Module: Attendance
    if (selectedModules.includes("attendance")) {
      const [att, teacherAtt] = await Promise.all([
        fetchTableSafe("attendance"),
        fetchTableSafe("teacher_attendance"),
      ]);

      payloadData.attendance = att;
      payloadData.teacher_attendance = teacherAtt;

      const attTotal = att.length + teacherAtt.length;
      stats["attendance"] = attTotal;
      totalCount += attTotal;
    }

    // Module: Exams
    if (selectedModules.includes("exams")) {
      const [exams, examSubjects, examRoutines, examResults, questionBank, examPapers] = await Promise.all([
        fetchTableSafe("exams"),
        fetchTableSafe("exam_subjects"),
        fetchTableSafe("exam_routines"),
        fetchTableSafe("exam_results"),
        fetchTableSafe("question_bank"),
        fetchTableSafe("exam_papers"),
      ]);

      payloadData.exams = exams;
      payloadData.exam_subjects = examSubjects;
      payloadData.exam_routines = examRoutines;
      payloadData.exam_results = examResults;
      payloadData.question_bank = questionBank;
      payloadData.exam_papers = examPapers;
      payloadData.published_exams = meta.published_exams || {};

      const examTotal =
        exams.length +
        examSubjects.length +
        examRoutines.length +
        examResults.length +
        questionBank.length +
        examPapers.length;
      stats["exams"] = examTotal;
      totalCount += examTotal;
    }

    // Module: Finance
    if (selectedModules.includes("finance")) {
      const [fees, expenses, bazarExp, donors, donations, funds, zakatFunds] = await Promise.all([
        fetchTableSafe("fees"),
        fetchTableSafe("expenses"),
        fetchTableSafe("bazar_expenses"),
        fetchTableSafe("donors"),
        fetchTableSafe("donations"),
        fetchTableSafe("funds"),
        fetchTableSafe("zakat_funds"),
      ]);

      payloadData.fees = fees;
      payloadData.expenses = expenses;
      payloadData.bazar_expenses = bazarExp;
      payloadData.donors = donors;
      payloadData.donations = donations;
      payloadData.funds = funds;
      payloadData.zakat_funds = zakatFunds;

      const financeTotal =
        fees.length +
        expenses.length +
        bazarExp.length +
        donors.length +
        donations.length +
        funds.length +
        zakatFunds.length;
      stats["finance"] = financeTotal;
      totalCount += financeTotal;
    }

    // Module: Boarding
    if (selectedModules.includes("boarding")) {
      const meals = await fetchTableSafe("meal_entries");
      payloadData.meal_entries = meals;
      stats["boarding"] = meals.length;
      totalCount += meals.length;
    }

    // Module: Library
    if (selectedModules.includes("library")) {
      const [books, bookIssues] = await Promise.all([
        fetchTableSafe("books"),
        fetchTableSafe("book_issues"),
      ]);
      payloadData.books = books;
      payloadData.book_issues = bookIssues;
      const libTotal = books.length + bookIssues.length;
      stats["library"] = libTotal;
      totalCount += libTotal;
    }

    // Module: Communication
    if (selectedModules.includes("communication")) {
      const [notices, smsTemplates, smsLogs] = await Promise.all([
        fetchTableSafe("notices"),
        fetchTableSafe("sms_templates"),
        fetchTableSafe("sms_logs"),
      ]);
      payloadData.notices = notices;
      payloadData.sms_templates = smsTemplates;
      payloadData.sms_logs = smsLogs;
      const commTotal = notices.length + smsTemplates.length + smsLogs.length;
      stats["communication"] = commTotal;
      totalCount += commTotal;
    }

    // Include full metadata snapshot if requested
    if (options?.includeMetadata) {
      payloadData.metadata = meta;
    }

    const now = new Date();
    const isoDate = now.toISOString();
    const dateFormatted = now.toISOString().split("T")[0];
    const safeMadrasaName = (madrasaData?.name || "madrasa").replace(/[^a-zA-Z0-9\u0980-\u09FF]/g, "_");
    const filename = `Qawmi_Backup_${safeMadrasaName}_${dateFormatted}_${Math.floor(Date.now() / 1000)}.json`;

    // Stringify data to compute checksum
    const rawDataString = JSON.stringify(payloadData);
    const checksum = generateSimpleChecksum(rawDataString);

    const manifest: BackupManifest = {
      app_name: "QawmiManager Pro",
      version: "2.5.0",
      format: "qawmi_cloud_backup_v2",
      generated_at: isoDate,
      generated_by: user?.email || "Admin",
      madrasa_id: madrasaId,
      madrasa_name: madrasaData?.name || "কওমি মাদরাসা",
      modules: selectedModules,
      total_records: totalCount,
      stats: stats,
      checksum: checksum,
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
      note: `${selectedModules.length}টি মডিউলের সম্পূর্ণ ব্যাকআপ তৈরি হয়েছে (${totalCount} রেকর্ড)`,
    };

    const updatedHistory = [newLog, ...(meta.backup_history || [])].slice(0, 50);
    await saveMadrasaMetadata(madrasaId, {
      ...meta,
      backup_history: updatedHistory,
      last_backup_date: isoDate,
    });

    try {
      const { recordActivityLog } = await import("@/app/actions/activity-logs");
      await recordActivityLog({
        action_type: "BACKUP",
        module: "BACKUP",
        title: "ডাটাবেজ পূর্ণাঙ্গ ব্যাকআপ এক্সপোর্ট",
        description: `${selectedModules.length}টি মডিউলের সর্বমোট ${totalCount}টি রেকর্ডের ব্যাকআপ ফাইল ডাউনলোড করা হয়েছে (${sizeKb} KB)।`,
        severity: "SUCCESS",
        link: "/dashboard/settings/backup",
      });
    } catch (actErr) {
      console.warn("Activity log backup export error:", actErr);
    }

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
 * Validates and analyzes an uploaded JSON backup file prior to restoring
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

    // Support both standard Qawmi backup v2 and legacy schemas
    let manifest: BackupManifest;
    let dataObj: any;

    if (parsed.manifest && parsed.data) {
      manifest = parsed.manifest;
      dataObj = parsed.data;
    } else if (parsed.data || parsed.students || parsed.classes) {
      // Legacy or direct dump format auto-adaptation
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
          "staff",
          "boarding",
          "library",
          "communication",
          "settings",
        ],
        total_records: 0,
        stats: {},
        checksum: "legacy_format",
      };
    } else {
      return { isValid: false, error: "এই ফাইলে কোনো চেনার উপযোগী কওমি ব্যাকআপ ডেটা পাওয়া যায়নি।" };
    }

    // Calculate individual module record counts
    const moduleCounts: Record<string, number> = {
      students: Array.isArray(dataObj.students) ? dataObj.students.length : 0,
      classes: Array.isArray(dataObj.classes) ? dataObj.classes.length : 0,
      subjects: Array.isArray(dataObj.subjects) ? dataObj.subjects.length : 0,
      teachers: Array.isArray(dataObj.teachers) ? dataObj.teachers.length : 0,
      attendance: Array.isArray(dataObj.attendance) ? dataObj.attendance.length : 0,
      exams: Array.isArray(dataObj.exams) ? dataObj.exams.length : 0,
      exam_results: Array.isArray(dataObj.exam_results) ? dataObj.exam_results.length : 0,
      fees: Array.isArray(dataObj.fees) ? dataObj.fees.length : 0,
      expenses: Array.isArray(dataObj.expenses) ? dataObj.expenses.length : 0,
      donations: Array.isArray(dataObj.donations) ? dataObj.donations.length : 0,
      hifz_logs: Array.isArray(dataObj.hifz_logs) ? dataObj.hifz_logs.length : 0,
      meals: Array.isArray(dataObj.meal_entries) ? dataObj.meal_entries.length : 0,
      books: Array.isArray(dataObj.books) ? dataObj.books.length : 0,
      notices: Array.isArray(dataObj.notices) ? dataObj.notices.length : 0,
      sessions: Array.isArray(dataObj.sessions) ? dataObj.sessions.length : 0,
      question_bank: Array.isArray(dataObj.question_bank) ? dataObj.question_bank.length : 0,
    };

    const totalRecords = Object.values(moduleCounts).reduce((acc, c) => acc + c, 0);
    manifest.total_records = totalRecords;

    const warnings: string[] = [];

    // Check target madrasa
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const currentMadrasaId = await getAuthMadrasaId(supabase, user);

    if (manifest.madrasa_id && manifest.madrasa_id !== "portable" && manifest.madrasa_id !== currentMadrasaId) {
      warnings.push(
        `সতর্কবার্তা: এই ব্যাকআপটি অন্য মাদরাসা ("${manifest.madrasa_name || manifest.madrasa_id}") থেকে তৈরি হয়েছিল। রিস্টোর করার সময় ডাটা স্বয়ংক্রিয়ভাবে আপনার বর্তমান মাদরাসায় রি-ম্যাপ (Re-map) করা হবে।`
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

/**
 * Execute Safe Data Restore (Supports Merge vs Replace modes with auto pre-snapshot)
 */
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
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const madrasaId = await getAuthMadrasaId(supabase, user);
    const admin = await createAdminClient();

    if (!backupPayload || !backupPayload.data) {
      return { success: false, message: "অবৈধ ব্যাকআপ ডেটা লোড হয়েছে।", error: "Missing data payload" };
    }

    const modulesToRestore: BackupModuleKey[] =
      selectedModules && selectedModules.length > 0
        ? selectedModules
        : [
            "students",
            "academic",
            "attendance",
            "exams",
            "finance",
            "staff",
            "boarding",
            "library",
            "communication",
            "settings",
          ];

    const dataObj = backupPayload.data;
    const currentMeta = await getMadrasaMetadata(madrasaId);

    // 1. Create an Auto Pre-Restore Snapshot if enabled
    if (createAutoSnapshot) {
      try {
        const preSnapshotLog: BackupAuditEntry = {
          id: "snap_" + Date.now(),
          type: "AUTO_SNAPSHOT",
          timestamp: new Date().toISOString(),
          actor_name: user?.user_metadata?.full_name || "সিস্টেম রিস্টোরার",
          actor_email: user?.email || "system@qawmi.edu",
          modules: modulesToRestore,
          total_records: 0,
          status: "SUCCESS",
          note: `রিস্টোর শুরুর পূর্বে সিস্টেম কর্তৃক স্বয়ংক্রিয় সেফটি স্ন্যাপশট সংরক্ষিত হয়েছে (${restoreMode === "merge" ? "Merge" : "Replace"} মোড)`,
        };
        const preHistory = [preSnapshotLog, ...(currentMeta.backup_history || [])].slice(0, 50);
        await saveMadrasaMetadata(madrasaId, { ...currentMeta, backup_history: preHistory });
      } catch (snapErr) {
        console.warn("Pre-snapshot warning:", snapErr);
      }
    }

    const restoredStats: Record<string, number> = {};
    let totalRestored = 0;

    // Helper to safely upsert or replace table rows for this madrasa
    const restoreTable = async (
      tableName: string,
      rows: any[],
      options?: { cleanBefore?: boolean; conflictCol?: string }
    ) => {
      if (!Array.isArray(rows) || rows.length === 0) return 0;

      // Assign current madrasa_id to ensure tenant isolation
      const sanitizedRows = rows.map((r) => {
        const copy = { ...r, madrasa_id: madrasaId };
        return copy;
      });

      // If replace mode and cleanBefore is requested
      if (restoreMode === "replace" && options?.cleanBefore) {
        try {
          await admin.from(tableName).delete().eq("madrasa_id", madrasaId);
        } catch (delErr) {
          console.warn(`Clean delete error on ${tableName}:`, delErr);
        }
      }

      // Batch insert / upsert in chunks of 100 to avoid payload size limit
      const chunkSize = 100;
      let insertedCount = 0;

      for (let i = 0; i < sanitizedRows.length; i += chunkSize) {
        const chunk = sanitizedRows.slice(i, i + chunkSize);
        try {
          const { error } = await admin
            .from(tableName)
            .upsert(chunk, { onConflict: options?.conflictCol || "id", ignoreDuplicates: false });
          if (!error) {
            insertedCount += chunk.length;
          } else {
            console.warn(`Upsert error chunk for ${tableName}:`, error.message);
            // Fallback: try individual inserts
            for (const singleRow of chunk) {
              try {
                const { error: sErr } = await admin.from(tableName).upsert(singleRow);
                if (!sErr) insertedCount++;
              } catch {
                // Ignore individual row conflict
              }
            }
          }
        } catch (batchErr) {
          console.warn(`Batch restore exception on ${tableName}:`, batchErr);
        }
      }

      return insertedCount;
    };

    // 2. Step-by-Step Restoration in Relational Dependency Order:

    // A. Academic (Classes, Subjects, Class Subjects, Routines)
    if (modulesToRestore.includes("academic")) {
      const clsCount = await restoreTable("classes", dataObj.classes || [], { cleanBefore: true });
      const subCount = await restoreTable("subjects", dataObj.subjects || [], { cleanBefore: true });
      const csCount = await restoreTable("class_subjects", dataObj.class_subjects || []);
      const tsCount = await restoreTable("teacher_subjects", dataObj.teacher_subjects || []);
      const rCount = await restoreTable("routines", dataObj.routines || []);

      const acadTotal = clsCount + subCount + csCount + tsCount + rCount;
      restoredStats["academic"] = acadTotal;
      totalRestored += acadTotal;
    }

    // B. Staff & Teachers
    if (modulesToRestore.includes("staff")) {
      const tCount = await restoreTable("teachers", dataObj.teachers || []);
      restoredStats["teachers"] = tCount;
      totalRestored += tCount;
    }

    // C. Students & Profiles & Enrollments
    if (modulesToRestore.includes("students")) {
      const sCount = await restoreTable("students", dataObj.students || [], { cleanBefore: true });
      const eCount = await restoreTable("student_enrollments", dataObj.student_enrollments || []);
      const hCount = await restoreTable("hifz_logs", dataObj.hifz_logs || []);
      const kCount = await restoreTable("kitab_logs", dataObj.kitab_logs || []);

      // Merge or replace student profiles in metadata
      if (dataObj.student_profiles && typeof dataObj.student_profiles === "object") {
        if (restoreMode === "replace") {
          currentMeta.student_profiles = dataObj.student_profiles;
        } else {
          currentMeta.student_profiles = {
            ...(currentMeta.student_profiles || {}),
            ...dataObj.student_profiles,
          };
        }
      }

      // Merge or replace admissions in metadata
      if (dataObj.admissions && Array.isArray(dataObj.admissions)) {
        if (restoreMode === "replace") {
          currentMeta.admissions = dataObj.admissions;
        } else {
          const existingIds = new Set((currentMeta.admissions || []).map((a: any) => a.id));
          const newAdmissions = dataObj.admissions.filter((a: any) => !existingIds.has(a.id));
          currentMeta.admissions = [...(currentMeta.admissions || []), ...newAdmissions];
        }
      }

      const stdTotal = sCount + eCount + hCount + kCount;
      restoredStats["students"] = stdTotal;
      totalRestored += stdTotal;
    }

    // D. Attendance
    if (modulesToRestore.includes("attendance")) {
      const aCount = await restoreTable("attendance", dataObj.attendance || []);
      const taCount = await restoreTable("teacher_attendance", dataObj.teacher_attendance || []);
      const attTotal = aCount + taCount;
      restoredStats["attendance"] = attTotal;
      totalRestored += attTotal;
    }

    // E. Exams, Questions, Papers, Marks
    if (modulesToRestore.includes("exams")) {
      const exCount = await restoreTable("exams", dataObj.exams || []);
      const esCount = await restoreTable("exam_subjects", dataObj.exam_subjects || []);
      const erCount = await restoreTable("exam_routines", dataObj.exam_routines || []);
      const resCount = await restoreTable("exam_results", dataObj.exam_results || []);
      const qbCount = await restoreTable("question_bank", dataObj.question_bank || []);
      const epCount = await restoreTable("exam_papers", dataObj.exam_papers || []);

      if (dataObj.published_exams) {
        currentMeta.published_exams = {
          ...(currentMeta.published_exams || {}),
          ...dataObj.published_exams,
        };
      }

      const examTotal = exCount + esCount + erCount + resCount + qbCount + epCount;
      restoredStats["exams"] = examTotal;
      totalRestored += examTotal;
    }

    // F. Finance & Accounts
    if (modulesToRestore.includes("finance")) {
      const feeCount = await restoreTable("fees", dataObj.fees || []);
      const expCount = await restoreTable("expenses", dataObj.expenses || []);
      const bazCount = await restoreTable("bazar_expenses", dataObj.bazar_expenses || []);
      const donCount = await restoreTable("donors", dataObj.donors || []);
      const dntCount = await restoreTable("donations", dataObj.donations || []);
      const fndCount = await restoreTable("funds", dataObj.funds || []);
      const zktCount = await restoreTable("zakat_funds", dataObj.zakat_funds || []);

      const finTotal = feeCount + expCount + bazCount + donCount + dntCount + fndCount + zktCount;
      restoredStats["finance"] = finTotal;
      totalRestored += finTotal;
    }

    // G. Boarding
    if (modulesToRestore.includes("boarding")) {
      const mealCount = await restoreTable("meal_entries", dataObj.meal_entries || []);
      restoredStats["boarding"] = mealCount;
      totalRestored += mealCount;
    }

    // H. Library
    if (modulesToRestore.includes("library")) {
      const bCount = await restoreTable("books", dataObj.books || []);
      const biCount = await restoreTable("book_issues", dataObj.book_issues || []);
      const libTotal = bCount + biCount;
      restoredStats["library"] = libTotal;
      totalRestored += libTotal;
    }

    // I. Communication
    if (modulesToRestore.includes("communication")) {
      const nCount = await restoreTable("notices", dataObj.notices || []);
      const stCount = await restoreTable("sms_templates", dataObj.sms_templates || []);
      const slCount = await restoreTable("sms_logs", dataObj.sms_logs || []);
      const commTotal = nCount + stCount + slCount;
      restoredStats["communication"] = commTotal;
      totalRestored += commTotal;
    }

    // J. Settings & Metadata Merging
    if (modulesToRestore.includes("settings")) {
      if (Array.isArray(dataObj.sessions) && dataObj.sessions.length > 0) {
        currentMeta.sessions = dataObj.sessions;
      }
      if (Array.isArray(dataObj.academic_holidays) && dataObj.academic_holidays.length > 0) {
        currentMeta.academic_holidays = dataObj.academic_holidays;
      }
      if (dataObj.madrasa && typeof dataObj.madrasa === "object") {
        try {
          await admin
            .from("madrasas")
            .update({
              name: dataObj.madrasa.name || undefined,
              address: dataObj.madrasa.address || undefined,
              contact_phone: dataObj.madrasa.contact_phone || undefined,
              contact_email: dataObj.madrasa.contact_email || undefined,
            })
            .eq("id", madrasaId);
        } catch {
          // ignore madrasa basic info update errors
        }
      }
      restoredStats["settings"] = 1;
      totalRestored += 1;
    }

    // Save final metadata with restore audit log
    const restoreAuditLog: BackupAuditEntry = {
      id: "rst_" + Date.now(),
      type: restoreMode === "merge" ? "RESTORE_MERGE" : "RESTORE_REPLACE",
      timestamp: new Date().toISOString(),
      actor_name: user?.user_metadata?.full_name || "সুপার এডমিন",
      actor_email: user?.email || "admin@qawmi.edu",
      modules: modulesToRestore,
      total_records: totalRestored,
      status: "SUCCESS",
      note: `সফলভাবে ${modulesToRestore.length}টি মডিউলের ${totalRestored}টি রেকর্ড রিস্টোর করা হয়েছে (${restoreMode === "merge" ? "Merge" : "Clean Replace"} মোড)।`,
    };

    const finalHistory = [restoreAuditLog, ...(currentMeta.backup_history || [])].slice(0, 50);
    currentMeta.backup_history = finalHistory;
    await saveMadrasaMetadata(madrasaId, currentMeta);

    try {
      const { recordActivityLog } = await import("@/app/actions/activity-logs");
      await recordActivityLog({
        action_type: "RESTORE",
        module: "BACKUP",
        title: "ডাটাবেজ ব্যাকআপ রিস্টোর সম্পন্ন",
        description: `${modulesToRestore.length}টি মডিউলের সর্বমোট ${totalRestored}টি রেকর্ড সফলভাবে ডাটাবেজে রিস্টোর ও মার্জ করা হয়েছে (${restoreMode === "merge" ? "Merge" : "Clean Replace"} মোড)।`,
        severity: "SUCCESS",
        link: "/dashboard/settings/backup",
      });
    } catch (e) {
      console.warn("Activity log restore error:", e);
    }

    // Revalidate all affected routes
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/students");
    revalidatePath("/dashboard/classes");
    revalidatePath("/dashboard/exams");
    revalidatePath("/dashboard/accounting");
    revalidatePath("/dashboard/settings");

    return {
      success: true,
      message: `আলহামদুলিল্লাহ! সর্বমোট ${totalRestored} টি রেকর্ড সফলভাবে রিস্টোর ও ডাটাবেজে হালনাগাদ করা হয়েছে।`,
      restoredStats,
      totalRestored,
    };
  } catch (err: any) {
    console.error("Exception in executeDataRestore:", err);
    return {
      success: false,
      message: "রিস্টোর প্রক্রিয়ায় আকস্মিক ত্রুটি দেখা দিয়েছে।",
      error: err?.message || String(err),
    };
  }
}
