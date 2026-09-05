"use server";

import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { getAuthMadrasaId } from "@/app/actions/students";
import { getAllLeaveData, StudentLeaveApplication, TeacherLeaveApplication } from "@/app/actions/leaves";
import { getParentFeedbacks, ParentFeedbackItem } from "@/app/actions/parent-communication";
import { getAdmissionApplications } from "@/app/actions/admissions";
import { getMadrasaMetadata, saveMadrasaMetadata } from "@/lib/sessions";
import { toBanglaNumber } from "@/lib/numberToBangla";
import { revalidatePath } from "next/cache";

export type NotificationCategory = "LEAVE" | "COMPLAINT" | "ADMISSION" | "ACADEMIC" | "FINANCE" | "SYSTEM";
export type NotificationSeverity = "INFO" | "WARNING" | "SUCCESS" | "CRITICAL";

export interface GlobalNotificationItem {
  id: string;
  category: NotificationCategory;
  title: string;
  description: string;
  timestamp: string; // ISO string
  relativeTime?: string;
  link: string;
  status: "UNREAD" | "READ" | "PENDING" | "RESOLVED";
  severity: NotificationSeverity;
  metadata?: Record<string, any>;
  sourceModule: string;
  senderName?: string;
  senderRole?: string;
}

export interface NotificationStats {
  total: number;
  unread: number;
  pendingLeaves: number;
  pendingComplaints: number;
  pendingAdmissions: number;
}

/**
 * Format relative time in Bengali
 */
export async function getRelativeTimeBangla(dateStr: string): Promise<string> {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMin < 1) return "এইমাত্র";
    if (diffMin < 60) return `${toBanglaNumber(diffMin)} মিনিট আগে`;
    if (diffHours < 24) return `${toBanglaNumber(diffHours)} ঘণ্টা আগে`;
    if (diffDays === 1) return "গতকাল";
    if (diffDays < 7) return `${toBanglaNumber(diffDays)} দিন আগে`;
    return d.toLocaleDateString("bn-BD");
  } catch {
    return dateStr;
  }
}

/**
 * Aggregates all global notifications across leaves, feedbacks, admissions, and system events
 */
export async function getGlobalNotifications(limit = 40): Promise<{
  notifications: GlobalNotificationItem[];
  stats: NotificationStats;
}> {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const madrasaId = await getAuthMadrasaId(supabase, user);

    const items: GlobalNotificationItem[] = [];

    // 1. Fetch Leaves Data (Both Student and Teacher)
    try {
      const leaveResult = await getAllLeaveData();
      if (leaveResult && !leaveResult.error) {
        const studentLeaves: StudentLeaveApplication[] = leaveResult.studentLeaves || [];
        const teacherLeaves: TeacherLeaveApplication[] = leaveResult.teacherLeaves || [];

        studentLeaves.forEach((s) => {
          items.push({
            id: `leave-student-${s.id}`,
            category: "LEAVE",
            title: `শিক্ষার্থীর ছুটির আবেদন: ${s.student_name}`,
            description: `${s.leave_type || "ছুটি"} • জামাত: ${s.class_name || "অনির্দিষ্ট"} • মেয়াদ: ${s.start_date} হতে ${s.end_date} (${toBanglaNumber(s.total_days)} দিন)। কারণ: ${s.reason}`,
            timestamp: s.created_at || new Date().toISOString(),
            link: "/dashboard/attendance/leaves",
            status: s.status === "PENDING" ? "PENDING" : "RESOLVED",
            severity: s.status === "PENDING" ? "WARNING" : "INFO",
            sourceModule: "হাজিরা ও ছুটি",
            senderName: s.student_name,
            senderRole: "শিক্ষার্থী",
            metadata: {
              leave_id: s.id,
              type: "student",
              status: s.status,
            },
          });
        });

        teacherLeaves.forEach((t) => {
          items.push({
            id: `leave-teacher-${t.id}`,
            category: "LEAVE",
            title: `উস্তাদের ছুটির আবেদন: ${t.teacher_name}`,
            description: `${t.leave_type_name_bn || "ছুটি"} • পদবি: ${t.designation || "শিক্ষক"} • মেয়াদ: ${t.start_date} হতে ${t.end_date} (${toBanglaNumber(t.total_days)} দিন)। কারণ: ${t.reason}`,
            timestamp: t.created_at || new Date().toISOString(),
            link: "/dashboard/attendance/leaves",
            status: t.status === "PENDING" ? "PENDING" : "RESOLVED",
            severity: t.status === "PENDING" ? "WARNING" : "INFO",
            sourceModule: "হাজিরা ও ছুটি",
            senderName: t.teacher_name,
            senderRole: "শিক্ষক/স্টাফ",
            metadata: {
              leave_id: t.id,
              type: "teacher",
              status: t.status,
            },
          });
        });
      }
    } catch (err) {
      console.warn("Notification error fetching leaves:", err);
    }

    // 2. Fetch Parent Feedbacks & Complaints
    try {
      const feedbacks: ParentFeedbackItem[] = await getParentFeedbacks();
      feedbacks.forEach((f) => {
        const isComplaint = f.action_type === "COMPLAINT";
        items.push({
          id: `feedback-${f.id}`,
          category: "COMPLAINT",
          title: isComplaint ? `অভিযোগ: ${f.guardian_name || "অভিভাবক"}` : `মতামত/পরামর্শ: ${f.guardian_name || "অভিভাবক"}`,
          description: `বিষয়: ${f.subject} • শিক্ষার্থী: ${f.student_name || "অনির্দিষ্ট"} (${f.class_name || ""}) • বিবরণ: ${f.description?.slice(0, 90) || ""}`,
          timestamp: f.created_at || new Date().toISOString(),
          link: "/dashboard/communication/feedback",
          status: f.status === "PENDING" ? "PENDING" : "RESOLVED",
          severity: isComplaint ? "CRITICAL" : "INFO",
          sourceModule: "অভিভাবক যোগাযোগ",
          senderName: f.guardian_name,
          senderRole: "অভিভাবক",
          metadata: {
            feedback_id: f.id,
            action_type: f.action_type,
            status: f.status,
          },
        });
      });
    } catch (err) {
      console.warn("Notification error fetching feedbacks:", err);
    }

    // 3. Fetch Online Admissions Applications
    try {
      const admissions = await getAdmissionApplications();
      admissions.forEach((a) => {
        const isPending = a.status === "PENDING";
        items.push({
          id: `admission-${a.id}`,
          category: "ADMISSION",
          title: `নতুন ভর্তি আবেদন: ${a.applicant_name_bn}`,
          description: `আবেদন নং: ${a.application_no} • শ্রেণি: ${a.target_class_name || "অনির্দিষ্ট"} • অভিভাবকের ফোন: ${a.guardian_phone}`,
          timestamp: a.created_at || new Date().toISOString(),
          link: "/dashboard/admissions",
          status: isPending ? "PENDING" : "RESOLVED",
          severity: "INFO",
          sourceModule: "ভর্তি ব্যবস্থাপনা",
          senderName: a.applicant_name_bn,
          senderRole: "ভর্তিচ্ছু শিক্ষার্থী",
          metadata: {
            admission_id: a.id,
            status: a.status,
          },
        });
      });
    } catch (err) {
      console.warn("Notification error fetching admissions:", err);
    }

    // 4. Fetch Custom System Notifications & Broadcasts
    if (madrasaId) {
      try {
        const meta = await getMadrasaMetadata(madrasaId);
        const sysList: GlobalNotificationItem[] = meta.system_notifications || [];
        sysList.forEach((sys) => {
          items.push(sys);
        });
      } catch (err) {
        console.warn("Notification error fetching system notifications:", err);
      }
    }

    // Sort by timestamp descending (newest first)
    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Calculate stats
    const pendingLeaves = items.filter((i) => i.category === "LEAVE" && i.status === "PENDING").length;
    const pendingComplaints = items.filter((i) => i.category === "COMPLAINT" && i.status === "PENDING").length;
    const pendingAdmissions = items.filter((i) => i.category === "ADMISSION" && i.status === "PENDING").length;
    const totalPending = pendingLeaves + pendingComplaints + pendingAdmissions;

    const stats: NotificationStats = {
      total: items.length,
      unread: totalPending,
      pendingLeaves,
      pendingComplaints,
      pendingAdmissions,
    };

    return {
      notifications: items.slice(0, limit),
      stats,
    };
  } catch (err) {
    console.error("getGlobalNotifications error:", err);
    return {
      notifications: [],
      stats: {
        total: 0,
        unread: 0,
        pendingLeaves: 0,
        pendingComplaints: 0,
        pendingAdmissions: 0,
      },
    };
  }
}

/**
 * Creates a custom system broadcast or alert notification
 */
export async function createSystemNotification(data: {
  title: string;
  description: string;
  category?: NotificationCategory;
  severity?: NotificationSeverity;
  link?: string;
  sourceModule?: string;
}) {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "মাদরাসা পাওয়া যায়নি।" };

    const meta = await getMadrasaMetadata(madrasaId);
    if (!meta.system_notifications) {
      meta.system_notifications = [];
    }

    const newNotification: GlobalNotificationItem = {
      id: `sys-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      category: data.category || "SYSTEM",
      title: data.title,
      description: data.description,
      timestamp: new Date().toISOString(),
      link: data.link || "/dashboard",
      status: "PENDING",
      severity: data.severity || "INFO",
      sourceModule: data.sourceModule || "সিস্টেম নোটিশ",
      senderName: user?.email || "অ্যাডমিন",
    };

    meta.system_notifications.unshift(newNotification);
    if (meta.system_notifications.length > 100) {
      meta.system_notifications = meta.system_notifications.slice(0, 100);
    }

    await saveMadrasaMetadata(madrasaId, meta);
    revalidatePath("/dashboard");
    return { success: true, notification: newNotification };
  } catch (err) {
    console.error("createSystemNotification error:", err);
    return { error: "নোটিফিকেশন তৈরি করতে সমস্যা হয়েছে।" };
  }
}

/**
 * Clears or marks all custom system notifications as read
 */
export async function clearSystemNotifications() {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    const madrasaId = await getAuthMadrasaId(supabase, user);
    if (!madrasaId) return { error: "মাদরাসা পাওয়া যায়নি।" };

    const meta = await getMadrasaMetadata(madrasaId);
    meta.system_notifications = [];
    await saveMadrasaMetadata(madrasaId, meta);
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    return { error: "ক্লিয়ার করতে সমস্যা হয়েছে।" };
  }
}
