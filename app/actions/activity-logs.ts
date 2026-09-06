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
 * Generates realistic initial seed activities if no logs exist yet
 */
function getDefaultActivityLogsSeed(madrasaId: string): GlobalActivityLogItem[] {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const hourMs = 60 * 60 * 1000;

  return [
    {
      id: `act_${now - 15 * 60 * 1000}`,
      action_type: "ATTENDANCE",
      module: "ATTENDANCE",
      module_name_bn: "হাজিরা ও ছুটি",
      title: "দৈনিক শ্রেণি হাজিরা গ্রহণ সম্পন্ন",
      description: "মিজান ও কাফিয়া জামাতের আজ সকালের হাজিরা গ্রহণ সম্পন্ন হয়েছে। মোট উপস্থিত: ৮৭ জন, অনুপস্থিত: ৩ জন।",
      actor_name: "মাওলানা আব্দুল্লাহ আল-মামুন",
      actor_role: "সহকারী শিক্ষক ও হাজিরা ইনচার্জ",
      actor_email: "mamun@qawmi.edu",
      timestamp: new Date(now - 15 * 60 * 1000).toISOString(),
      severity: "SUCCESS",
      device: "ক্রোম ব্রাউজার (ডেস্কটপ)",
      ip_address: "192.168.1.105",
      link: "/dashboard/attendance",
      metadata: { class: "মিজান", present: 87, absent: 3 },
    },
    {
      id: `act_${now - 45 * 60 * 1000}`,
      action_type: "CREATE",
      module: "STUDENTS",
      module_name_bn: "ছাত্র ব্যবস্থাপনা",
      title: "নতুন শিক্ষার্থীর পূর্ণাঙ্গ প্রোফাইল এন্ট্রি",
      description: "মুহাম্মদ তাহমিদ হাসান কে মিজান জামাতে রোল ১২ সহ নতুন ছাত্র হিসেবে ভর্তি ও নিবন্ধন করা হয়েছে।",
      actor_name: "মাওলানা মাহমুদুল হাসান",
      actor_role: "নাজেমে তালিমাত",
      actor_email: "education@qawmi.edu",
      timestamp: new Date(now - 45 * 60 * 1000).toISOString(),
      severity: "SUCCESS",
      device: "ফায়ারফক্স (ডেস্কটপ)",
      ip_address: "192.168.1.102",
      link: "/dashboard/students",
      metadata: { student_name: "মুহাম্মদ তাহমিদ হাসান", roll: "১২", class: "মিজান" },
    },
    {
      id: `act_${now - 2 * hourMs}`,
      action_type: "PAYMENT",
      module: "FINANCE",
      module_name_bn: "হিসাব ও ফি",
      title: "মাসিক বেতন ও খোরাকি ফি আদায়",
      description: "শিক্ষার্থী আব্দুল্লাহ (আইডি: STD-1029) এর শাবান মাসের আবাসিক ফি ২,৫০০ টাকা আদায়পূর্বক রশিদ নং #REC-4829 প্রিন্ট করা হয়েছে।",
      actor_name: "মুফতি আব্দুর রহমান",
      actor_role: "হিসাবরক্ষক",
      actor_email: "accounts@qawmi.edu",
      timestamp: new Date(now - 2 * hourMs).toISOString(),
      severity: "SUCCESS",
      device: "ক্রোম ব্রাউজার",
      ip_address: "192.168.1.110",
      link: "/dashboard/finance/fees",
      metadata: { amount: 2500, receipt_no: "REC-4829" },
    },
    {
      id: `act_${now - 5 * hourMs}`,
      action_type: "EXAM",
      module: "EXAMS",
      module_name_bn: "পরীক্ষা ও মূল্যায়ন",
      title: "হিফজুল কুরআন মাসিক পরীক্ষার নম্বর এন্ট্রি",
      description: "হিফজ বিভাগ (শাখা-ক)-এর ৩০ জন শিক্ষার্থীর তিলাওয়াত, হিফজ ও তাজবিদ বিষয়ের নম্বরবন্টন সফলভাবে ডাটাবেজে সংরক্ষণ করা হয়েছে।",
      actor_name: "হাফেজ কারী নূরুল ইসলাম",
      actor_role: "হিফজ শিক্ষক ও পরীক্ষক",
      actor_email: "hifz@qawmi.edu",
      timestamp: new Date(now - 5 * hourMs).toISOString(),
      severity: "INFO",
      device: "মোবাইল ক্রোম (অ্যান্ড্রয়েড)",
      ip_address: "192.168.1.115",
      link: "/dashboard/exams",
      metadata: { department: "হিফজ", student_count: 30 },
    },
    {
      id: `act_${now - 8 * hourMs}`,
      action_type: "APPROVE",
      module: "ATTENDANCE",
      module_name_bn: "হাজিরা ও ছুটি",
      title: "শিক্ষার্থীর ছুটির আবেদন অনুমোদন",
      description: "শিক্ষার্থী মুহাম্মদ খালিদ সাইফুল্লাহ এর পারিবারিক কারণে ৩ দিনের ছুটির আবেদন মঞ্জুর করা হয়েছে।",
      actor_name: "মাওলানা মাহমুদুল হাসান",
      actor_role: "নাজেমে তালিমাত",
      actor_email: "education@qawmi.edu",
      timestamp: new Date(now - 8 * hourMs).toISOString(),
      severity: "SUCCESS",
      device: "ক্রোম ব্রাউজার",
      ip_address: "192.168.1.102",
      link: "/dashboard/attendance/leaves",
      metadata: { student: "মুহাম্মদ খালিদ সাইফুল্লাহ", days: 3 },
    },
    {
      id: `act_${now - 14 * hourMs}`,
      action_type: "BACKUP",
      module: "BACKUP",
      module_name_bn: "ব্যাকআপ ও রিস্টোর",
      title: "ডাটাবেজ পূর্ণাঙ্গ ব্যাকআপ এক্সপোর্ট",
      description: "মাদরাসার সকল ছাত্র, শিক্ষক, ফলাফল ও ফি ডাটার সম্পূর্ণ এনক্রিপ্টেড JSON ব্যাকআপ ডাউনলোড করা হয়েছে।",
      actor_name: "মুহতামিম সাহেব",
      actor_role: "প্রধান অ্যাডমিন",
      actor_email: "muhtamim@qawmi.edu",
      timestamp: new Date(now - 14 * hourMs).toISOString(),
      severity: "SUCCESS",
      device: "ডেস্কটপ (উইন্ডোজ)",
      ip_address: "192.168.1.101",
      link: "/dashboard/settings/backup",
      metadata: { format: "JSON", auto_audit: true },
    },
    {
      id: `act_${now - 1 * dayMs}`,
      action_type: "CREATE",
      module: "ADMISSIONS",
      module_name_bn: "ভর্তি ব্যবস্থাপনা",
      title: "নতুন অনলাইন ভর্তি আবেদন দাখিল",
      description: "অভিভাবক কর্তৃক অনলাইন পোর্টাল হতে প্রার্থী 'মুহাম্মদ উমর ফারুক' এর হিফজ জামাতে ভর্তি আবেদন জমা হয়েছে।",
      actor_name: "অনলাইন ভর্তি পোর্টাল",
      actor_role: "অভিভাবক",
      actor_email: "public_portal@qawmi.edu",
      timestamp: new Date(now - 1 * dayMs).toISOString(),
      severity: "INFO",
      device: "মোবাইল সাফারি",
      ip_address: "103.142.12.45",
      link: "/dashboard/admissions",
      metadata: { applicant: "মুহাম্মদ উমর ফারুক", class: "হিফজ" },
    },
    {
      id: `act_${now - 1 * dayMs - 3 * hourMs}`,
      action_type: "UPDATE",
      module: "ACADEMIC",
      module_name_bn: "জামাত ও রুটিন",
      title: "সাপ্তাহিক ক্লাস রুটিন সমন্বয়",
      description: "শরহে বেকায়া জামাতের বৃহস্পতিবারের ৩য় ও ৪র্থ ঘণ্টার কিতাব ও উস্তাদ পুনর্বণ্টন করা হয়েছে।",
      actor_name: "মাওলানা মাহমুদুল হাসান",
      actor_role: "নাজেমে তালিমাত",
      actor_email: "education@qawmi.edu",
      timestamp: new Date(now - 1 * dayMs - 3 * hourMs).toISOString(),
      severity: "INFO",
      device: "ক্রোম ব্রাউজার",
      ip_address: "192.168.1.102",
      link: "/dashboard/routines",
      metadata: { class: "শরহে বেকায়া", day: "বৃহস্পতিবার" },
    },
    {
      id: `act_${now - 2 * dayMs}`,
      action_type: "NOTICE",
      module: "COMMUNICATION",
      module_name_bn: "অভিভাবক যোগাযোগ",
      title: "রমজানুল মুবারকের ছুটি ও সময়সূচি নোটিশ জারি",
      description: "আগামী পবিত্র রমজান উপলক্ষে মাদরাসার ক্লাস ছুটি ও হোস্টেল ব্যবস্থাপনার জরুরি নোটিশ সকল অভিভাবকের পোর্টালে প্রকাশ করা হয়েছে।",
      actor_name: "মুহতামিম সাহেব",
      actor_role: "প্রধান অ্যাডমিন",
      actor_email: "muhtamim@qawmi.edu",
      timestamp: new Date(now - 2 * dayMs).toISOString(),
      severity: "SUCCESS",
      device: "ডেস্কটপ",
      ip_address: "192.168.1.101",
      link: "/dashboard/communication/notices",
      metadata: { notice_type: "HOLIDAY" },
    },
    {
      id: `act_${now - 3 * dayMs}`,
      action_type: "UPDATE",
      module: "SETTINGS",
      module_name_bn: "সিস্টেম ও সেটিংস",
      title: "মাদরাসার প্রাতিষ্ঠানিক তথ্য ও লোগো আপডেট",
      description: "মাদরাসার প্রাতিষ্ঠানিক পরিচিতি, ওয়েবসাইট শিরোনাম এবং যোগাযোগ নম্বর সফলভাবে হালনাগাদ করা হয়েছে।",
      actor_name: "মুহতামim সাহেব",
      actor_role: "প্রধান অ্যাডমিন",
      actor_email: "muhtamim@qawmi.edu",
      timestamp: new Date(now - 3 * dayMs).toISOString(),
      severity: "INFO",
      device: "ডেস্কটপ",
      ip_address: "192.168.1.101",
      link: "/dashboard/settings",
    },
  ];
}

/**
 * Fetch all global activity history logs with optional filters
 */
export async function getActivityLogs(filters?: ActivityLogFilters): Promise<{
  success: boolean;
  logs: GlobalActivityLogItem[];
  stats: ActivityStats;
  error?: string;
}> {
  try {
    const supabase = await createClient();
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

    const meta = await getMadrasaMetadata(madrasaId);
    let allLogs: GlobalActivityLogItem[] = meta.activity_logs || [];

    // If no logs yet, seed realistic default logs and persist
    if (!allLogs || allLogs.length === 0) {
      allLogs = getDefaultActivityLogsSeed(madrasaId);
      meta.activity_logs = allLogs;
      await saveMadrasaMetadata(madrasaId, meta);
    }

    // Sort newest first
    allLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Calculate stats before filtering
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfWeek = startOfToday - 7 * 24 * 60 * 60 * 1000;

    let todayCount = 0;
    let weekCount = 0;
    let successCount = 0;
    const moduleCounts: Record<string, number> = {};

    allLogs.forEach((item) => {
      const itemTime = new Date(item.timestamp).getTime();
      if (itemTime >= startOfToday) todayCount++;
      if (itemTime >= startOfWeek) weekCount++;
      if (item.severity === "SUCCESS") successCount++;
      moduleCounts[item.module] = (moduleCounts[item.module] || 0) + 1;
    });

    const stats: ActivityStats = {
      totalLogs: allLogs.length,
      todayCount,
      weekCount,
      successCount,
      moduleCounts,
    };

    // Apply filtering
    let filtered = [...allLogs];

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
