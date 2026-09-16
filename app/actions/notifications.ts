"use server";

import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { getAuthMadrasaId } from "@/app/actions/students";
import { getAllLeaveData, StudentLeaveApplication, TeacherLeaveApplication } from "@/app/actions/leaves";
import { getParentFeedbacks, ParentFeedbackItem } from "@/app/actions/parent-communication";
import { getAdmissionApplications } from "@/app/actions/admissions";
import { getMadrasaMetadata, saveMadrasaMetadata } from "@/lib/sessions";
import { toBanglaNumber } from "@/lib/numberToBangla";
import { revalidatePath } from "next/cache";

export type NotificationCategory =
  | "LEAVE"
  | "COMPLAINT"
  | "ADMISSION"
  | "ACADEMIC"
  | "FINANCE"
  | "PAYMENT"
  | "ATTENDANCE"
  | "LIBRARY"
  | "INVENTORY"
  | "SYSTEM";

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
  isRead?: boolean;
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
  pendingPayments: number;
  pendingDonations: number;
  pendingAlerts: number;
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
 * Aggregates all global notifications across all madrasa modules with persistent read tracking
 */
export async function getGlobalNotifications(limit = 60): Promise<{
  notifications: GlobalNotificationItem[];
  stats: NotificationStats;
  readIds: string[];
}> {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    let madrasaId = user ? await getAuthMadrasaId(supabase, user) : null;

    if (!madrasaId) {
      try {
        const adminClient = await createAdminClient();
        const { data: firstM } = await adminClient
          .from("madrasas")
          .select("id")
          .limit(1)
          .single();
        madrasaId = firstM?.id || null;
      } catch {}
    }

    const items: GlobalNotificationItem[] = [];
    let meta: any = {};
    let persistentReadIds: string[] = [];

    if (madrasaId) {
      try {
        meta = await getMadrasaMetadata(madrasaId);
        persistentReadIds = Array.isArray(meta.read_notification_ids) ? meta.read_notification_ids : [];
      } catch (err) {
        console.warn("Error fetching madrasa metadata for notifications:", err);
      }
    }

    const readSet = new Set(persistentReadIds);

    // 1. Fetch Leaves Data (Both Student and Teacher)
    try {
      const leaveResult = await getAllLeaveData();
      if (leaveResult && !leaveResult.error) {
        const studentLeaves: StudentLeaveApplication[] = leaveResult.studentLeaves || [];
        const teacherLeaves: TeacherLeaveApplication[] = leaveResult.teacherLeaves || [];

        studentLeaves.forEach((s) => {
          const isPending = s.status === "PENDING";
          items.push({
            id: `leave-student-${s.id}`,
            category: "LEAVE",
            title: `শিক্ষার্থীর ছুটির আবেদন: ${s.student_name}`,
            description: `${s.leave_type || "ছুটি"} • জামাত: ${s.class_name || "অনির্দিষ্ট"} • মেয়াদ: ${s.start_date} হতে ${s.end_date} (${toBanglaNumber(s.total_days)} দিন)। কারণ: ${s.reason}`,
            timestamp: s.created_at || new Date().toISOString(),
            link: "/dashboard/attendance/leaves",
            status: isPending ? "PENDING" : "RESOLVED",
            severity: isPending ? "WARNING" : "INFO",
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
          const isPending = t.status === "PENDING";
          items.push({
            id: `leave-teacher-${t.id}`,
            category: "LEAVE",
            title: `উস্তাদের ছুটির আবেদন: ${t.teacher_name}`,
            description: `${t.leave_type_name_bn || "ছুটি"} • পদবি: ${t.designation || "শিক্ষক"} • মেয়াদ: ${t.start_date} হতে ${t.end_date} (${toBanglaNumber(t.total_days)} দিন)। কারণ: ${t.reason}`,
            timestamp: t.created_at || new Date().toISOString(),
            link: "/dashboard/attendance/leaves",
            status: isPending ? "PENDING" : "RESOLVED",
            severity: isPending ? "WARNING" : "INFO",
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
        const isPending = f.status === "PENDING";
        items.push({
          id: `feedback-${f.id}`,
          category: "COMPLAINT",
          title: isComplaint ? `অভিযোগ: ${f.guardian_name || "অভিভাবক"}` : `মতামত/পরামর্শ: ${f.guardian_name || "অভিভাবক"}`,
          description: `বিষয়: ${f.subject} • শিক্ষার্থী: ${f.student_name || "অনির্দিষ্ট"} (${f.class_name || ""}) • বিবরণ: ${f.description?.slice(0, 90) || ""}`,
          timestamp: f.created_at || new Date().toISOString(),
          link: "/dashboard/communication/feedback",
          status: isPending ? "PENDING" : "RESOLVED",
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
          severity: isPending ? "INFO" : "SUCCESS",
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

    // 4. Fetch Online & Offline Fee Payments (New Payments)
    if (madrasaId) {
      try {
        // Online transactions (bKash, Nagad, etc.)
        const onlineTxns: any[] = meta.online_transactions || [];
        onlineTxns.forEach((txn) => {
          const isSuccess = txn.status === "SUCCESS" || txn.status === "PAID" || txn.status === "COMPLETED";
          items.push({
            id: `online-pay-${txn.id || txn.transaction_id}`,
            category: "PAYMENT",
            title: `অনলাইন পেমেন্ট: ${txn.student_name || "শিক্ষার্থী"} (৳${toBanglaNumber(txn.amount)})`,
            description: `গেটওয়ে: ${txn.payment_channel || "অনলাইন"} • ট্রানজেকশন আইডি: ${txn.transaction_id || txn.gateway_trx_id || "N/A"} • রোল: ${txn.student_roll || txn.roll_number || "অনির্দিষ্ট"}`,
            timestamp: txn.payment_date || txn.created_at || new Date().toISOString(),
            link: "/dashboard/accounting/gateway",
            status: isSuccess ? "PENDING" : "RESOLVED", // Pending review by accountant until acknowledged
            severity: "SUCCESS",
            sourceModule: "অনলাইন পেমেন্ট গেটওয়ে",
            senderName: txn.student_name,
            senderRole: "অভিভাবক / শিক্ষার্থী",
            metadata: {
              transaction_id: txn.transaction_id,
              amount: txn.amount,
              status: txn.status,
            },
          });
        });

        // General fee payments from fee management
        const feePayments: any[] = meta.payments || [];
        feePayments.slice(0, 30).forEach((pay) => {
          items.push({
            id: `fee-pay-${pay.id || pay.receipt_no}`,
            category: "FINANCE",
            title: `ফি আদায়: রসিদ নং #${toBanglaNumber(pay.receipt_no || "")} (৳${toBanglaNumber(pay.total_amount || pay.amount || 0)})`,
            description: `শিক্ষার্থী: ${pay.student_name || "শিক্ষার্থী"} • মাধ্যম: ${pay.payment_method || "নগদ"} • তারিখ: ${pay.payment_date || ""}`,
            timestamp: pay.created_at || (pay.payment_date ? `${pay.payment_date}T12:00:00.000Z` : new Date().toISOString()),
            link: "/dashboard/accounting/payments",
            status: "PENDING",
            severity: "INFO",
            sourceModule: "ফি ও হিসাব ব্যবস্থাপনা",
            senderName: pay.collected_by_name || "হিসাবরক্ষক",
            senderRole: "হিসাব বিভাগ",
            metadata: {
              payment_id: pay.id,
              receipt_no: pay.receipt_no,
              amount: pay.total_amount || pay.amount,
            },
          });
        });
      } catch (err) {
        console.warn("Notification error fetching fee payments:", err);
      }

      // 5. Fetch Online Donations & Fundraising Collections
      try {
        const onlineDonations: any[] = meta.online_donations || [];
        onlineDonations.slice(0, 20).forEach((don) => {
          const isVerified = don.status === "VERIFIED" || don.status === "COMPLETED";
          items.push({
            id: `donation-${don.id || don.trx_id}`,
            category: "FINANCE",
            title: `অনলাইন দান প্রাপ্তি: ৳${toBanglaNumber(don.amount)} (${don.donor_name || "নাম প্রকাশে অনিচ্ছুক"})`,
            description: `ফান্ড: ${don.fund_name || "সাধারণ ফান্ড"} • মাধ্যম: ${don.payment_method || "অনলাইন"} • ট্রানজেকশন: ${don.trx_id || "N/A"} • ফোন: ${don.donor_phone || "N/A"}`,
            timestamp: don.date || don.created_at || new Date().toISOString(),
            link: "/dashboard/fundraising/online-donations",
            status: isVerified ? "RESOLVED" : "PENDING",
            severity: "SUCCESS",
            sourceModule: "অনলাইন অনুদান ও তহবিল",
            senderName: don.donor_name,
            senderRole: "সম্মানিত দাতা",
            metadata: {
              donation_id: don.id,
              amount: don.amount,
              fund_id: don.fund_id,
            },
          });
        });
      } catch (err) {
        console.warn("Notification error fetching donations:", err);
      }

      // 6. Fetch Inventory Low Stock Alerts
      try {
        const invItems: any[] = meta.inventory?.items || [];
        invItems.forEach((item) => {
          const minStock = Number(item.min_stock_alert || 5);
          const currentQty = Number(item.quantity || 0);
          if (currentQty <= minStock) {
            items.push({
              id: `inv-low-${item.id}`,
              category: "INVENTORY",
              title: `মজুদ ঘাটতি সতর্কতা: ${item.name}`,
              description: `বর্তমান মজুদ: ${toBanglaNumber(currentQty)} ${item.unit || "টি"} (সর্বনিম্ন সতর্কতা সীমা: ${toBanglaNumber(minStock)} ${item.unit || "টি"}) • ক্যাটাগরি: ${item.category || "মালামাল"}`,
              timestamp: item.updated_at || item.created_at || new Date().toISOString(),
              link: "/dashboard/inventory",
              status: "PENDING",
              severity: "WARNING",
              sourceModule: "সম্পদ ও ইনভেন্টরি",
              senderName: "সিস্টেম ইনভেন্টরি মনিটর",
              senderRole: "অটোমেশন",
              metadata: {
                item_id: item.id,
                quantity: currentQty,
                min_stock: minStock,
              },
            });
          }
        });
      } catch (err) {
        console.warn("Notification error fetching inventory alerts:", err);
      }
    }

    // 7. Fetch Library Overdue Book Returns (Borrow Records)
    if (madrasaId) {
      try {
        const adminClient = await createAdminClient();
        const todayStr = new Date().toISOString().split("T")[0];
        const { data: overdues } = await adminClient
          .from("borrow_records")
          .select("id, book_id, student_id, due_date, status, books(title), students(first_name, last_name, roll_number)")
          .eq("madrasa_id", madrasaId)
          .eq("status", "BORROWED")
          .lt("due_date", todayStr)
          .limit(20);

        if (overdues && overdues.length > 0) {
          overdues.forEach((b: any) => {
            const bookTitle = b.books?.title || "কিতাব";
            const studentName = `${b.students?.first_name || ""} ${b.students?.last_name || ""}`.trim() || "শিক্ষার্থী";
            items.push({
              id: `lib-overdue-${b.id}`,
              category: "LIBRARY",
              title: `কিতাব ফেরত বিলম্ব: ${bookTitle}`,
              description: `গ্রহীতা: ${studentName} (রোল: ${toBanglaNumber(b.students?.roll_number || "")}) • নির্ধারিত শেষ তারিখ: ${b.due_date}`,
              timestamp: b.due_date ? `${b.due_date}T00:00:00.000Z` : new Date().toISOString(),
              link: "/dashboard/library",
              status: "PENDING",
              severity: "WARNING",
              sourceModule: "মাদরাসা গ্রন্থাগার",
              senderName: studentName,
              senderRole: "শিক্ষার্থী",
              metadata: {
                borrow_id: b.id,
                due_date: b.due_date,
              },
            });
          });
        }
      } catch (err) {
        // Table may not have all fields or is optional
      }
    }

    // 8. Fetch Custom System Notifications & Broadcasts
    if (madrasaId && meta.system_notifications) {
      try {
        const sysList: GlobalNotificationItem[] = meta.system_notifications || [];
        sysList.forEach((sys) => {
          items.push(sys);
        });
      } catch (err) {
        console.warn("Notification error fetching system notifications:", err);
      }
    }

    // Apply persistent read statuses
    items.forEach((item) => {
      const isRead = readSet.has(item.id);
      item.isRead = isRead;
      if (isRead) {
        item.status = "RESOLVED";
      }
    });

    // Sort by timestamp descending (newest first)
    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Calculate dynamic stats taking persistent read tracking into account
    const unreadItems = items.filter((i) => !readSet.has(i.id) && (i.status === "PENDING" || i.status === "UNREAD"));
    const pendingLeaves = items.filter((i) => i.category === "LEAVE" && !readSet.has(i.id) && i.status === "PENDING").length;
    const pendingComplaints = items.filter((i) => i.category === "COMPLAINT" && !readSet.has(i.id) && i.status === "PENDING").length;
    const pendingAdmissions = items.filter((i) => i.category === "ADMISSION" && !readSet.has(i.id) && i.status === "PENDING").length;
    const pendingPayments = items.filter((i) => (i.category === "PAYMENT" || i.category === "FINANCE") && !readSet.has(i.id) && i.status === "PENDING").length;
    const pendingDonations = items.filter((i) => i.id.startsWith("donation-") && !readSet.has(i.id) && i.status === "PENDING").length;
    const pendingAlerts = items.filter((i) => (i.category === "ATTENDANCE" || i.category === "LIBRARY" || i.category === "INVENTORY") && !readSet.has(i.id) && i.status === "PENDING").length;

    const stats: NotificationStats = {
      total: items.length,
      unread: unreadItems.length,
      pendingLeaves,
      pendingComplaints,
      pendingAdmissions,
      pendingPayments,
      pendingDonations,
      pendingAlerts,
    };

    return {
      notifications: items.slice(0, limit),
      stats,
      readIds: persistentReadIds,
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
        pendingPayments: 0,
        pendingDonations: 0,
        pendingAlerts: 0,
      },
      readIds: [],
    };
  }
}

/**
 * Persistently marks a notification as read in the database
 */
export async function markNotificationAsRead(notificationId: string): Promise<{
  success: boolean;
  readIds?: string[];
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    let madrasaId = user ? await getAuthMadrasaId(supabase, user) : null;

    if (!madrasaId) {
      const adminClient = await createAdminClient();
      const { data: firstM } = await adminClient
        .from("madrasas")
        .select("id")
        .limit(1)
        .single();
      madrasaId = firstM?.id || null;
    }

    if (!madrasaId) return { success: false, error: "মাদরাসা পাওয়া যায়নি।" };

    const meta = await getMadrasaMetadata(madrasaId);
    const existingReadIds: string[] = Array.isArray(meta.read_notification_ids) ? meta.read_notification_ids : [];

    if (!existingReadIds.includes(notificationId)) {
      existingReadIds.push(notificationId);
      // Keep up to 2500 IDs to avoid bloat
      if (existingReadIds.length > 2500) {
        existingReadIds.splice(0, existingReadIds.length - 2500);
      }
      meta.read_notification_ids = existingReadIds;
      await saveMadrasaMetadata(madrasaId, meta);
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/notifications");

    return { success: true, readIds: existingReadIds };
  } catch (err: any) {
    console.error("Error marking notification as read:", err);
    return { success: false, error: err.message || "পঠিত হিসেবে সংরক্ষণ ব্যর্থ।" };
  }
}

/**
 * Persistently marks all notifications (or a given category) as read in the database
 */
export async function markAllNotificationsAsRead(category?: NotificationCategory): Promise<{
  success: boolean;
  readIds?: string[];
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    let madrasaId = user ? await getAuthMadrasaId(supabase, user) : null;

    if (!madrasaId) {
      const adminClient = await createAdminClient();
      const { data: firstM } = await adminClient
        .from("madrasas")
        .select("id")
        .limit(1)
        .single();
      madrasaId = firstM?.id || null;
    }

    if (!madrasaId) return { success: false, error: "মাদরাসা পাওয়া যায়নি।" };

    // Fetch current notifications to gather all IDs
    const res = await getGlobalNotifications(150);
    const targetItems = category
      ? res.notifications.filter((n) => n.category === category)
      : res.notifications;

    const meta = await getMadrasaMetadata(madrasaId);
    const currentReadIds: string[] = Array.isArray(meta.read_notification_ids) ? meta.read_notification_ids : [];
    const readSet = new Set(currentReadIds);

    targetItems.forEach((item) => {
      readSet.add(item.id);
    });

    const updatedReadIds = Array.from(readSet);
    if (updatedReadIds.length > 2500) {
      updatedReadIds.splice(0, updatedReadIds.length - 2500);
    }

    meta.read_notification_ids = updatedReadIds;
    await saveMadrasaMetadata(madrasaId, meta);

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/notifications");

    return { success: true, readIds: updatedReadIds };
  } catch (err: any) {
    console.error("Error marking all notifications as read:", err);
    return { success: false, error: err.message || "সব পঠিত হিসেবে সংরক্ষণ ব্যর্থ।" };
  }
}

/**
 * Toggles or resets read status for a specific notification
 */
export async function toggleNotificationReadStatus(notificationId: string, isRead: boolean): Promise<{
  success: boolean;
  isRead: boolean;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    let madrasaId = user ? await getAuthMadrasaId(supabase, user) : null;

    if (!madrasaId) {
      const adminClient = await createAdminClient();
      const { data: firstM } = await adminClient
        .from("madrasas")
        .select("id")
        .limit(1)
        .single();
      madrasaId = firstM?.id || null;
    }

    if (!madrasaId) return { success: false, isRead: false, error: "মাদরাসা পাওয়া যায়নি।" };

    const meta = await getMadrasaMetadata(madrasaId);
    let readIds: string[] = Array.isArray(meta.read_notification_ids) ? meta.read_notification_ids : [];

    if (isRead) {
      if (!readIds.includes(notificationId)) {
        readIds.push(notificationId);
      }
    } else {
      readIds = readIds.filter((id) => id !== notificationId);
    }

    meta.read_notification_ids = readIds;
    await saveMadrasaMetadata(madrasaId, meta);

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/notifications");

    return { success: true, isRead };
  } catch (err: any) {
    console.error("Error toggling read status:", err);
    return { success: false, isRead, error: err.message };
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
    revalidatePath("/dashboard/notifications");
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
    revalidatePath("/dashboard/notifications");
    return { success: true };
  } catch (err) {
    return { error: "ক্লিয়ার করতে সমস্যা হয়েছে।" };
  }
}

