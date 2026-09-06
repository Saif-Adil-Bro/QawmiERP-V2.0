"use server";

import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { getAuthMadrasaId } from "@/app/actions/students";
import { getMadrasaMetadata, saveMadrasaMetadata } from "@/lib/sessions";
import { revalidatePath } from "next/cache";
import {
  ActivityActionType,
  ActivityModule,
  GlobalActivityLogItem,
  ActivityLogFilters,
  ActivityStats,
  MODULE_BANGLA_NAMES,
} from "@/types/activity-logs";

export type {
  ActivityActionType,
  ActivityModule,
  GlobalActivityLogItem,
  ActivityLogFilters,
  ActivityStats,
};

/**
 * Filter out legacy fake dummy seed logs that were previously generated
 */
function isRealLog(log: GlobalActivityLogItem): boolean {
  if (!log || !log.title) return false;
  const fakeActors = [
    "মাওলানা আব্দুল্লাহ আল-মামুন",
    "মাওলানা মাহমুদুল হাসান",
    "মুফতি আব্দুর রহমান",
    "হাফেজ কারী নূরুল ইসলাম",
    "মুহতামim সাহেব",
  ];
  if (fakeActors.includes(log.actor_name)) return false;
  if (
    log.id?.startsWith("act_") &&
    (log.title === "দৈনিক শ্রেণি হাজিরা গ্রহণ সম্পন্ন" ||
      log.title === "নতুন শিক্ষার্থীর পূর্ণাঙ্গ প্রোফাইল এন্ট্রি" ||
      log.title === "হিফজুল কুরআন মাসিক পরীক্ষার নম্বর এন্ট্রি" ||
      log.title === "সাপ্তাহিক ক্লাস রুটিন সমন্বয়" ||
      log.title === "রমজানুল মুবারকের ছুটি ও সময়সূচি নোটিশ জারি" ||
      log.title === "মাদরাসার প্রাতিষ্ঠানিক তথ্য ও লোগো আপডেট")
  ) {
    return false;
  }
  return true;
}

/**
 * Fetch all global activity history logs dynamically aggregated from
 * 100% REAL system events, database tables, and metadata audits.
 */
export async function getActivityLogs(filters?: ActivityLogFilters): Promise<{
  success: boolean;
  logs: GlobalActivityLogItem[];
  stats: ActivityStats;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const adminClient = await createAdminClient();
    const user = await getAuthUser(supabase);
    const madrasaId = await getAuthMadrasaId(supabase, user);

    if (!madrasaId) {
      return {
        success: false,
        logs: [],
        stats: {
          totalLogs: 0,
          todayCount: 0,
          weekCount: 0,
          successCount: 0,
          moduleCounts: {},
        },
        error: "মাদরাসা আইডি পাওয়া যায়নি।",
      };
    }

    const currentUserName =
      user?.user_metadata?.full_name ||
      user?.email?.split("@")[0] ||
      "সুপার অ্যাডমিন";

    // 1. Fetch Madrasa metadata
    const meta = await getMadrasaMetadata(madrasaId);

    const compiledLogs: GlobalActivityLogItem[] = [];

    // --- A. Runtime & Manual Activity Logs (Real only) ---
    if (Array.isArray(meta.activity_logs)) {
      const realRuntimeLogs = meta.activity_logs.filter(isRealLog);
      compiledLogs.push(...realRuntimeLogs);

      // Clean metadata if fake logs were present
      if (realRuntimeLogs.length !== meta.activity_logs.length) {
        meta.activity_logs = realRuntimeLogs;
        saveMadrasaMetadata(madrasaId, meta).catch((e) =>
          console.warn("Error purging fake logs from meta:", e)
        );
      }
    }

    // --- B. Real Backup History ---
    if (Array.isArray(meta.backup_history)) {
      meta.backup_history.forEach((b: any) => {
        const isRestore = b.type?.includes("RESTORE");
        compiledLogs.push({
          id: `bk_${b.id}`,
          action_type: isRestore ? "RESTORE" : "BACKUP",
          module: "BACKUP",
          module_name_bn: "ব্যাকআপ ও রিস্টোর",
          title: isRestore ? "ডাটাবেজ ব্যাকআপ রিস্টোর" : "ডাটাবেজ পূর্ণাঙ্গ ব্যাকআপ এক্সপোর্ট",
          description:
            b.note ||
            `মাদরাসার সম্পূর্ণ ডাটাবেজ ব্যাকআপ ${isRestore ? "রিস্টোর" : "এক্সপোর্ট"} সম্পন্ন (${b.total_records || 0} রেকর্ড${b.file_size_kb ? `, ${b.file_size_kb} KB` : ""})।`,
          actor_name: b.actor_name || b.actor_email || currentUserName,
          actor_role: "সুপার অ্যাডমিন",
          actor_email: b.actor_email || user?.email,
          timestamp: b.timestamp || new Date().toISOString(),
          severity: b.status === "FAILED" ? "CRITICAL" : "SUCCESS",
          link: "/dashboard/settings/backup",
          metadata: { total_records: b.total_records, modules: b.modules },
        });
      });
    }

    // --- C. Real Certificate Audit Logs ---
    if (Array.isArray(meta.certificate_audit_logs)) {
      meta.certificate_audit_logs.forEach((c: any) => {
        const actionType: ActivityActionType =
          c.action === "DELETED" ? "DELETE" : c.action === "REVOKED" ? "REJECT" : "CREATE";
        const title =
          c.action === "CREATED"
            ? "শিক্ষার্থীর প্রশংসাপত্র/সনদপত্র তৈরি"
            : c.action === "REVOKED"
            ? "সনদপত্র প্রত্যাহার/বাতিল"
            : "সনদপত্র রেকর্ড অপসারণ";
        compiledLogs.push({
          id: `cert_${c.id}`,
          action_type: actionType,
          module: "ACADEMIC",
          module_name_bn: "জামাত ও রুটিন",
          title,
          description: c.details || `সনদপত্র নং: ${c.certificate_number || ""}`,
          actor_name: c.user_name || currentUserName,
          actor_role: "সনদপত্র ইনচার্জ",
          timestamp: c.created_at || new Date().toISOString(),
          severity: c.action === "DELETED" ? "WARNING" : "SUCCESS",
          link: "/dashboard/certificates",
          metadata: { cert_no: c.certificate_number, student: c.student_name },
        });
      });
    }

    // --- D. Real ID Card Audit Logs ---
    if (Array.isArray(meta.id_card_audit_logs)) {
      meta.id_card_audit_logs.forEach((i: any) => {
        compiledLogs.push({
          id: `idcard_${i.id}`,
          action_type: "CREATE",
          module: "STUDENTS",
          module_name_bn: "ছাত্র ব্যবস্থাপনা",
          title: "শিক্ষার্থীর ডিজিটাল আইডি কার্ড জেনারেশন",
          description: i.details || "শিক্ষার্থীর ডিজিটাল পরিচয়পত্র তৈরি করা হয়েছে।",
          actor_name: i.user_name || currentUserName,
          actor_role: "আইডি কার্ড ইনচার্জ",
          timestamp: i.created_at || new Date().toISOString(),
          severity: "SUCCESS",
          link: "/dashboard/academic/id-cards",
          metadata: { card_number: i.card_number, student_id: i.student_id },
        });
      });
    }

    // --- E. Real Student Leave Applications ---
    if (Array.isArray(meta.student_leave_applications)) {
      meta.student_leave_applications.forEach((l: any) => {
        const isApproved = l.status === "APPROVED";
        const isRejected = l.status === "REJECTED";
        compiledLogs.push({
          id: `leave_${l.id}`,
          action_type: isApproved ? "APPROVE" : isRejected ? "REJECT" : "CREATE",
          module: "ATTENDANCE",
          module_name_bn: "হাজিরা ও ছুটি",
          title: isApproved
            ? "শিক্ষার্থীর ছুটির আবেদন মঞ্জুর"
            : isRejected
            ? "শিক্ষার্থীর ছুটির আবেদন বাতিল"
            : "নতুন ছুটির আবেদন দাখিল",
          description: `${l.guardian_name ? `অভিভাবক: ${l.guardian_name} | ` : ""}${
            l.student_name ? `শিক্ষার্থী: ${l.student_name}` : ""
          } এর ${l.total_days || 1} দিনের ছুটি (${l.leave_type || "ছুটি"})। ${
            l.admin_remarks ? `মন্তব্য: ${l.admin_remarks}` : ""
          }`.trim(),
          actor_name: l.reviewed_by || l.guardian_name || currentUserName,
          actor_role: l.reviewed_by ? "হাজিরা ইনচার্জ" : "অভিভাবক",
          timestamp: l.reviewed_at || l.created_at || new Date().toISOString(),
          severity: isApproved ? "SUCCESS" : isRejected ? "WARNING" : "INFO",
          link: "/dashboard/attendance/leaves",
          metadata: {
            leave_id: l.id,
            start: l.start_date,
            end: l.end_date,
            status: l.status,
          },
        });
      });
    }

    // --- F. Real Staff Audit Logs ---
    if (Array.isArray(meta.staff_audit_logs)) {
      meta.staff_audit_logs.forEach((s: any) => {
        compiledLogs.push({
          id: `stf_${s.id}`,
          action_type: s.action?.includes("নিয়োগ") ? "CREATE" : "UPDATE",
          module: "SETTINGS",
          module_name_bn: "সিস্টেম ও সেটিংস",
          title: s.action || "কর্মী ব্যবস্থাপনা ও পদবী হালনাগাদ",
          description: s.details || "স্টাফ রেকর্ড হালনাগাদ করা হয়েছে।",
          actor_name: s.user_email || currentUserName,
          actor_role: "মুহতামিম",
          timestamp: s.created_at || new Date().toISOString(),
          severity: "INFO",
          link: "/dashboard/staff",
        });
      });
    }

    // --- G. Real Finance & Fee Audit Logs ---
    if (Array.isArray(meta.audit_logs)) {
      meta.audit_logs.forEach((f: any) => {
        const isFeeCollect = f.action === "COLLECT_FEE_PAYMENT";
        compiledLogs.push({
          id: `fin_${f.id}`,
          action_type: "PAYMENT",
          module: "FINANCE",
          module_name_bn: "হিসাব ও ফি",
          title: isFeeCollect ? "শিক্ষার্থীর ফি আদায় ও রশিদ প্রদান" : "মাসিক বেতন ও ফি শিডিউল তৈরি",
          description: f.details || "ফি সংক্রান্ত হিসাব হালনাগাদ করা হয়েছে।",
          actor_name: f.user_name || currentUserName,
          actor_role: f.user_role === "accountant" ? "হিসাবরক্ষক" : "অ্যাডমিন",
          timestamp: f.created_at || new Date().toISOString(),
          severity: "SUCCESS",
          link: "/dashboard/accounting/fees",
        });
      });
    }

    // --- H. Real Online Admissions & Confirmations ---
    if (Array.isArray(meta.admissions)) {
      meta.admissions.forEach((adm: any) => {
        const isConfirmed = adm.status === "CONFIRMED" || adm.confirmed_student_id;
        const applicantName =
          adm.applicant_name_bn || adm.first_name || adm.applicant_name_en || "ভর্তি পরীক্ষার্থী";
        compiledLogs.push({
          id: `adm_${adm.id}`,
          action_type: isConfirmed ? "APPROVE" : "CREATE",
          module: "ADMISSIONS",
          module_name_bn: "ভর্তি ব্যবস্থাপনা",
          title: isConfirmed
            ? `শিক্ষার্থী ভর্তি চূড়ান্তকরণ: ${applicantName}`
            : `অনলাইন ভর্তি আবেদন দাখিল: ${applicantName}`,
          description: `${adm.target_class_name ? `জামাত: ${adm.target_class_name}` : ""}${
            adm.assigned_permanent_roll ? ` | স্থায়ী রোল: ${adm.assigned_permanent_roll}` : ""
          }${adm.application_no ? ` | আবেদন নং: ${adm.application_no}` : ""}${
            adm.test_evaluation?.total_marks ? ` | প্রাপ্ত নম্বর: ${adm.test_evaluation.total_marks}` : ""
          }`.trim(),
          actor_name: adm.test_evaluation?.evaluated_by || currentUserName,
          actor_role: "ভর্তি ইনচার্জ",
          timestamp: adm.updated_at || adm.created_at || new Date().toISOString(),
          severity: isConfirmed ? "SUCCESS" : "INFO",
          link: "/dashboard/admissions",
          metadata: {
            applicant: applicantName,
            status: adm.status,
            roll: adm.assigned_permanent_roll,
          },
        });
      });
    }

    // --- I. Real Students Table Records ---
    try {
      const { data: realStudents } = await adminClient
        .from("students")
        .select("id, first_name, last_name, roll_number, created_at, classes(name)")
        .eq("madrasa_id", madrasaId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (Array.isArray(realStudents)) {
        realStudents.forEach((st: any) => {
          const sName = `${st.first_name || ""} ${st.last_name || ""}`.trim() || "শিক্ষার্থী";
          const className = st.classes?.name || "";
          compiledLogs.push({
            id: `std_reg_${st.id}`,
            action_type: "CREATE",
            module: "STUDENTS",
            module_name_bn: "ছাত্র ব্যবস্থাপনা",
            title: `নতুন শিক্ষার্থী নিবন্ধন: ${sName}`,
            description: `শ্রেণি রোল ${st.roll_number || "অনির্ধারিত"}${
              className ? ` (${className})` : ""
            } সহ ছাত্র প্রোফাইল ডাটাবেজে সংরক্ষিত হয়েছে।`,
            actor_name: currentUserName,
            actor_role: "ছাত্র ইনচার্জ",
            timestamp: st.created_at,
            severity: "SUCCESS",
            link: `/dashboard/students/${st.id}`,
            metadata: { student_id: st.id, roll: st.roll_number },
          });
        });
      }
    } catch (stdErr) {
      console.warn("Error fetching real students for activity logs:", stdErr);
    }

    // --- J. Real Exams Table Records ---
    try {
      const { data: realExams } = await adminClient
        .from("exams")
        .select("id, title, status, start_date, created_at")
        .eq("madrasa_id", madrasaId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (Array.isArray(realExams)) {
        realExams.forEach((ex: any) => {
          compiledLogs.push({
            id: `exam_reg_${ex.id}`,
            action_type: "EXAM",
            module: "EXAMS",
            module_name_bn: "পরীক্ষা ও মূল্যায়ন",
            title: `পরীক্ষা শিডিউল: ${ex.title}`,
            description: `স্ট্যাটাস: ${ex.status || "চলমান"}${
              ex.start_date ? ` | শুরুর তারিখ: ${ex.start_date}` : ""
            }`,
            actor_name: currentUserName,
            actor_role: "পরীক্ষা নিয়ন্ত্রক",
            timestamp: ex.created_at,
            severity: "INFO",
            link: "/dashboard/exams",
            metadata: { exam_id: ex.id, status: ex.status },
          });
        });
      }
    } catch (examErr) {
      console.warn("Error fetching real exams for activity logs:", examErr);
    }

    // --- K. Real Notices Table Records ---
    try {
      const { data: realNotices } = await adminClient
        .from("notices")
        .select("id, title, content, created_at")
        .eq("madrasa_id", madrasaId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (Array.isArray(realNotices)) {
        realNotices.forEach((nt: any) => {
          compiledLogs.push({
            id: `nt_reg_${nt.id}`,
            action_type: "NOTICE",
            module: "COMMUNICATION",
            module_name_bn: "অভিভাবক যোগাযোগ",
            title: `বিজ্ঞপ্তি প্রকাশ: ${nt.title?.trim()}`,
            description: nt.content
              ? nt.content.substring(0, 100) + (nt.content.length > 100 ? "..." : "")
              : "মাদরাসার অফিশিয়াল নোটিশ জারি করা হয়েছে।",
            actor_name: currentUserName,
            actor_role: "প্রধান অ্যাডমিন",
            timestamp: nt.created_at,
            severity: "INFO",
            link: "/dashboard/communication/notices",
          });
        });
      }
    } catch (noticeErr) {
      console.warn("Error fetching real notices for activity logs:", noticeErr);
    }

    // --- L. Real Attendance Grouped Records ---
    try {
      const { data: attRows } = await adminClient
        .from("attendance")
        .select("date, created_at")
        .eq("madrasa_id", madrasaId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (Array.isArray(attRows) && attRows.length > 0) {
        const attByDate: Record<string, { count: number; timestamp: string }> = {};
        attRows.forEach((r: any) => {
          if (!r.date) return;
          if (!attByDate[r.date]) {
            attByDate[r.date] = { count: 0, timestamp: r.created_at };
          }
          attByDate[r.date].count += 1;
        });

        Object.entries(attByDate).forEach(([dateStr, info]) => {
          compiledLogs.push({
            id: `att_day_${dateStr}`,
            action_type: "ATTENDANCE",
            module: "ATTENDANCE",
            module_name_bn: "হাজিরা ও ছুটি",
            title: `দৈনিক শ্রেণি উপস্থিতি গ্রহণ (${dateStr})`,
            description: `তারিখ ${dateStr}-এ শিক্ষার্থীদের উপস্থিতি গ্রহণ সম্পন্ন হয়েছে।`,
            actor_name: currentUserName,
            actor_role: "হাজিরা ইনচার্জ",
            timestamp: info.timestamp,
            severity: "SUCCESS",
            link: "/dashboard/attendance",
          });
        });
      }
    } catch (attErr) {
      console.warn("Error fetching real attendance for activity logs:", attErr);
    }

    // Deduplicate by unique id
    const seenIds = new Set<string>();
    const uniqueLogs: GlobalActivityLogItem[] = [];
    for (const log of compiledLogs) {
      if (!seenIds.has(log.id)) {
        seenIds.add(log.id);
        uniqueLogs.push(log);
      }
    }

    // Sort strictly chronological (newest first)
    uniqueLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Compute accurate stats
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfWeek = startOfToday - 7 * 24 * 60 * 60 * 1000;

    let todayCount = 0;
    let weekCount = 0;
    let successCount = 0;
    const moduleCounts: Record<string, number> = {};

    uniqueLogs.forEach((item) => {
      const itemTime = new Date(item.timestamp).getTime();
      if (itemTime >= startOfToday) todayCount++;
      if (itemTime >= startOfWeek) weekCount++;
      if (item.severity === "SUCCESS") successCount++;
      moduleCounts[item.module] = (moduleCounts[item.module] || 0) + 1;
    });

    const stats: ActivityStats = {
      totalLogs: uniqueLogs.length,
      todayCount,
      weekCount,
      successCount,
      moduleCounts,
    };

    // Apply filters
    let filtered = [...uniqueLogs];

    if (filters?.module && filters.module !== "ALL") {
      filtered = filtered.filter((l) => l.module === filters.module);
    }

    if (filters?.action_type && filters.action_type !== "ALL") {
      filtered = filtered.filter((l) => l.action_type === filters.action_type);
    }

    if (filters?.severity && filters.severity !== "ALL") {
      filtered = filtered.filter((l) => l.severity === filters.severity);
    }

    if (filters?.timeRange && filters.timeRange !== "all") {
      const curTime = Date.now();
      if (filters.timeRange === "today") {
        filtered = filtered.filter((l) => new Date(l.timestamp).getTime() >= startOfToday);
      } else if (filters.timeRange === "week") {
        filtered = filtered.filter((l) => new Date(l.timestamp).getTime() >= startOfWeek);
      } else if (filters.timeRange === "month") {
        const startOfMonth = curTime - 30 * 24 * 60 * 60 * 1000;
        filtered = filtered.filter((l) => new Date(l.timestamp).getTime() >= startOfMonth);
      }
    }

    if (filters?.search && filters.search.trim()) {
      const q = filters.search.toLowerCase().trim();
      filtered = filtered.filter((l) => {
        return (
          l.title.toLowerCase().includes(q) ||
          l.description.toLowerCase().includes(q) ||
          l.actor_name.toLowerCase().includes(q) ||
          l.module_name_bn.toLowerCase().includes(q) ||
          (l.metadata && JSON.stringify(l.metadata).toLowerCase().includes(q))
        );
      });
    }

    const limit = filters?.limit || 150;

    return {
      success: true,
      logs: filtered.slice(0, limit),
      stats,
    };
  } catch (err: any) {
    console.error("getActivityLogs error:", err);
    return {
      success: false,
      logs: [],
      stats: {
        totalLogs: 0,
        todayCount: 0,
        weekCount: 0,
        successCount: 0,
        moduleCounts: {},
      },
      error: err?.message || "অ্যাক্টিভিটি লগ লোড করতে সমস্যা হয়েছে।",
    };
  }
}

/**
 * Record a new global activity log entry
 */
export async function recordActivityLog(entry: {
  action_type: ActivityActionType;
  module: ActivityModule;
  title: string;
  description: string;
  actor_name?: string;
  actor_role?: string;
  severity?: "SUCCESS" | "INFO" | "WARNING" | "CRITICAL";
  link?: string;
  metadata?: Record<string, any>;
  device?: string;
  ip_address?: string;
  entity_id?: string;
  entity_type?: string;
}): Promise<{ success: boolean; log?: GlobalActivityLogItem; error?: string }> {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const madrasaId = await getAuthMadrasaId(supabase, user);

    if (!madrasaId) {
      return { success: false, error: "মাদরাসা আইডি পাওয়া যায়নি।" };
    }

    const meta = await getMadrasaMetadata(madrasaId);
    if (!meta.activity_logs) {
      meta.activity_logs = [];
    }

    const newLog: GlobalActivityLogItem = {
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      action_type: entry.action_type,
      module: entry.module,
      module_name_bn: MODULE_BANGLA_NAMES[entry.module] || entry.module,
      title: entry.title,
      description: entry.description,
      actor_name:
        entry.actor_name ||
        user?.user_metadata?.full_name ||
        user?.email?.split("@")[0] ||
        "প্রধান অ্যাডমিন",
      actor_role: entry.actor_role || "মুহতামিম / অ্যাডমিন",
      actor_email: user?.email || undefined,
      timestamp: new Date().toISOString(),
      severity: entry.severity || "SUCCESS",
      link: entry.link,
      metadata: entry.metadata,
      device: entry.device || "ওয়েব ড্যাশবোর্ড",
      ip_address: entry.ip_address || "লোকাল ক্লায়েন্ট",
      entity_id: entry.entity_id,
      entity_type: entry.entity_type,
    };

    meta.activity_logs.unshift(newLog);

    // Keep up to 500 recent logs to maintain clean performance
    if (meta.activity_logs.length > 500) {
      meta.activity_logs = meta.activity_logs.slice(0, 500);
    }

    await saveMadrasaMetadata(madrasaId, meta);
    revalidatePath("/dashboard/notifications");

    return { success: true, log: newLog };
  } catch (err: any) {
    console.error("recordActivityLog error:", err);
    return { success: false, error: err?.message || "লগ রেকর্ড করতে সমস্যা হয়েছে।" };
  }
}

/**
 * Clear old activity logs (for audit log maintenance)
 */
export async function clearOldActivityLogs(olderThanDays = 30): Promise<{
  success: boolean;
  clearedCount?: number;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const madrasaId = await getAuthMadrasaId(supabase, user);

    if (!madrasaId) return { success: false, error: "মাদরাসা পাওয়া যায়নি।" };

    const meta = await getMadrasaMetadata(madrasaId);
    const existingLogs: GlobalActivityLogItem[] = meta.activity_logs || [];

    const cutoffTime = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
    const remainingLogs = existingLogs.filter(
      (log) => new Date(log.timestamp).getTime() > cutoffTime
    );

    const clearedCount = existingLogs.length - remainingLogs.length;
    meta.activity_logs = remainingLogs;

    // Record audit of this clear action
    const clearAuditLog: GlobalActivityLogItem = {
      id: `act_${Date.now()}`,
      action_type: "SETTINGS",
      module: "SETTINGS",
      module_name_bn: "সিস্টেম ও সেটিংস",
      title: "পুরোনো অডিট ও অ্যাক্টিভিটি লগ ক্লিনআপ",
      description: `${olderThanDays} দিনের পুরোনো মোট ${clearedCount} টি লগ সফলভাবে আর্কাইভ ও ক্লিনআপ করা হয়েছে।`,
      actor_name: user?.user_metadata?.full_name || "প্রধান অ্যাডমিন",
      actor_role: "মুহতামিম / অ্যাডমিন",
      actor_email: user?.email,
      timestamp: new Date().toISOString(),
      severity: "INFO",
      device: "ওয়েব ব্রাউজার",
    };

    meta.activity_logs.unshift(clearAuditLog);

    await saveMadrasaMetadata(madrasaId, meta);
    revalidatePath("/dashboard/notifications");

    return { success: true, clearedCount };
  } catch (err: any) {
    console.error("clearOldActivityLogs error:", err);
    return { success: false, error: err?.message || "লগ ক্লিয়ার করতে ব্যর্থ হয়েছে।" };
  }
}
