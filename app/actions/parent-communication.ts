"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, createClient, getAuthUser } from "@/lib/supabase/server";
import { getAuthMadrasaId } from "./students";
import { sendSMS, sendBulkSMS, getSMSGatewayConfig } from "./communication";
import { normalizePhoneNumber } from "@/lib/sms-gateway";
import { toBanglaNumber } from "@/lib/numberToBangla";
import {
  ParentFeedbackItem,
  AbsenceAlertSettings,
  AbsentStudentInfo,
  FeeAlertStudentInfo,
  DEFAULT_ABSENCE_SETTINGS,
  DEFAULT_FEE_ALERT_TEMPLATE,
} from "./parent-communication-types";

export type {
  ParentFeedbackItem,
  AbsenceAlertSettings,
  AbsentStudentInfo,
  FeeAlertStudentInfo,
};

// -------------------------------------------------------------
// 1. PARENT FEEDBACK & APPOINTMENTS (CRUD)
// -------------------------------------------------------------

export async function getParentFeedbacks(filter?: {
  studentId?: string;
  status?: string;
  type?: string;
}): Promise<ParentFeedbackItem[]> {
  try {
    const adminClient = await createAdminClient();
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    let madrasaId = user ? await getAuthMadrasaId(supabase, user) : null;

    if (!madrasaId) {
      const { data: firstM } = await adminClient.from("madrasas").select("id").limit(1).single();
      if (firstM) madrasaId = firstM.id;
    }

    if (!madrasaId) return [];

    let query = adminClient
      .from("fee_audit_logs")
      .select("*")
      .eq("madrasa_id", madrasaId)
      .like("action", "PARENT_FEEDBACK%")
      .order("created_at", { ascending: false });

    const { data: rows, error } = await query;
    if (error || !rows) {
      console.warn("getParentFeedbacks fetch error:", error?.message);
      return [];
    }

    const items: ParentFeedbackItem[] = [];

    for (const r of rows) {
      try {
        const parsed = JSON.parse(r.details || "{}");
        
        // Filter by studentId if specified
        if (filter?.studentId && parsed.student_id && parsed.student_id !== filter.studentId) {
          continue;
        }

        // Filter by status if specified
        if (filter?.status && filter.status !== "ALL" && parsed.status !== filter.status) {
          continue;
        }

        // Filter by action_type if specified
        if (filter?.type && filter.type !== "ALL" && parsed.action_type !== filter.type) {
          continue;
        }

        items.push({
          id: r.id,
          madrasa_id: r.madrasa_id,
          action_type: parsed.action_type || "SUGGESTION",
          type_bangla: parsed.type_bangla || "পরামর্শ",
          category: parsed.category || "সাধারণ",
          subject: parsed.subject || "সাধারণ বিষয়",
          description: parsed.description || "",
          student_id: parsed.student_id,
          student_name: parsed.student_name,
          student_roll: parsed.student_roll,
          class_name: parsed.class_name,
          guardian_name: r.user_name || parsed.guardian_name || "সম্মানিত অভিভাবক",
          guardian_phone: parsed.guardian_phone || "",
          urgency: parsed.urgency || "Normal",
          urgency_bangla: parsed.urgency_bangla || "সাধারণ",
          preferred_date: parsed.preferred_date,
          preferred_time: parsed.preferred_time,
          target_person: parsed.target_person || "মুহতামিম সাহেব",
          status: parsed.status || "PENDING",
          status_bangla: parsed.status_bangla || "অপেক্ষমান",
          official_response: parsed.official_response,
          responded_by: parsed.responded_by,
          responded_at: parsed.responded_at,
          created_at: r.created_at,
          updated_at: parsed.updated_at,
        });
      } catch {
        // Skip corrupted JSON
      }
    }

    return items;
  } catch (err) {
    console.error("getParentFeedbacks exception:", err);
    return [];
  }
}

export async function createParentFeedback(data: {
  action_type: "COMPLAINT" | "SUGGESTION" | "APPOINTMENT" | "GENERAL";
  category: string;
  subject: string;
  description: string;
  student_id?: string;
  student_name?: string;
  student_roll?: string;
  class_name?: string;
  guardian_name: string;
  guardian_phone: string;
  urgency?: "Normal" | "Important" | "Urgent";
  preferred_date?: string;
  preferred_time?: string;
  target_person?: string;
}) {
  try {
    const adminClient = await createAdminClient();
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    let madrasaId = user ? await getAuthMadrasaId(supabase, user) : null;

    if (!madrasaId) {
      const { data: firstM } = await adminClient.from("madrasas").select("id").limit(1).single();
      if (firstM) madrasaId = firstM.id;
    }

    if (!madrasaId) return { error: "মাদরাসা আইডি পাওয়া যায়নি" };

    if (!data.subject?.trim() || !data.description?.trim()) {
      return { error: "বিষয় এবং বিস্তারিত বিবরণ লেখা আবশ্যক" };
    }

    const typeMap: Record<string, string> = {
      COMPLAINT: "অভিযোগ",
      SUGGESTION: "পরামর্শ",
      APPOINTMENT: "মুহতামিম/শিক্ষক সাক্ষাতকার",
      GENERAL: "সাধারণ আবেদন",
    };

    const urgencyMap: Record<string, string> = {
      Normal: "সাধারণ",
      Important: "জরুরি",
      Urgent: "অতি জরুরি",
    };

    const payload = {
      action_type: data.action_type,
      type_bangla: typeMap[data.action_type] || "পরামর্শ",
      category: data.category || "পড়াশোনা ও হিফজ",
      subject: data.subject.trim(),
      description: data.description.trim(),
      student_id: data.student_id || "",
      student_name: data.student_name || "",
      student_roll: data.student_roll || "",
      class_name: data.class_name || "",
      guardian_name: data.guardian_name || "সম্মানিত অভিভাবক",
      guardian_phone: data.guardian_phone || "",
      urgency: data.urgency || "Normal",
      urgency_bangla: urgencyMap[data.urgency || "Normal"] || "সাধারণ",
      preferred_date: data.preferred_date || "",
      preferred_time: data.preferred_time || "",
      target_person: data.target_person || "মুহতামিম সাহেব",
      status: "PENDING",
      status_bangla: "অপেক্ষমান",
      created_at: new Date().toISOString(),
    };

    const recordId = `fb_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const { data: inserted, error } = await adminClient
      .from("fee_audit_logs")
      .insert({
        madrasa_id: madrasaId,
        action: `PARENT_FEEDBACK_${data.action_type}`,
        user_name: data.guardian_name || "অভিভাবক",
        user_role: "Parent",
        record_id: recordId,
        details: JSON.stringify(payload),
      })
      .select()
      .single();

    if (error) {
      return { error: "আবেদন জমা ব্যর্থ হয়েছে: " + error.message };
    }

    revalidatePath("/portal/feedback");
    revalidatePath("/portal/leave");
    revalidatePath("/dashboard/communication/feedback");
    return { success: true, id: inserted.id };
  } catch (err: any) {
    return { error: err.message || "আবেদন সেভ করতে সমস্যা হয়েছে" };
  }
}

export async function updateParentFeedbackStatus(data: {
  id: string;
  status: "PENDING" | "IN_REVIEW" | "RESOLVED" | "CLOSED";
  official_response?: string;
  responded_by?: string;
  notifyViaSMS?: boolean;
  notifyViaWhatsApp?: boolean;
}) {
  try {
    const adminClient = await createAdminClient();
    const { data: record, error: fetchErr } = await adminClient
      .from("fee_audit_logs")
      .select("*")
      .eq("id", data.id)
      .single();

    if (fetchErr || !record) {
      return { error: "রেকর্ড পাওয়া যায়নি" };
    }

    const currentDetails = JSON.parse(record.details || "{}");

    const statusMap: Record<string, string> = {
      PENDING: "অপেক্ষমান",
      IN_REVIEW: "পর্যালোচনাধীন",
      RESOLVED: "সমাধানকৃত",
      CLOSED: "সম্পন্ন / সমাপ্ত",
    };

    const updatedDetails = {
      ...currentDetails,
      status: data.status,
      status_bangla: statusMap[data.status] || "পর্যালোচনাধীন",
      official_response: data.official_response !== undefined ? data.official_response : currentDetails.official_response,
      responded_by: data.responded_by || "মাদরাসা কর্তৃপক্ষ",
      responded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { error: updateErr } = await adminClient
      .from("fee_audit_logs")
      .update({
        details: JSON.stringify(updatedDetails),
      })
      .eq("id", data.id);

    if (updateErr) {
      return { error: "আপডেট ব্যর্থ হয়েছে: " + updateErr.message };
    }

    // Send SMS notification if requested
    if (data.notifyViaSMS && currentDetails.guardian_phone && data.official_response) {
      const smsText = `আসসালামু আলাইকুম। আপনার "${currentDetails.subject}" সংক্রান্ত আবেদনের সমাধান দেওয়া হয়েছে: "${data.official_response.substring(0, 100)}..." - মাদরাসা প্রশাসন`;
      const formData = new FormData();
      formData.append("recipient_name", currentDetails.guardian_name || "অভিভাবক");
      formData.append("recipient_phone", currentDetails.guardian_phone);
      formData.append("message", smsText);
      formData.append("message_type", "Notice");
      await sendSMS(formData).catch(() => {});
    }

    revalidatePath("/dashboard/communication/feedback");
    revalidatePath("/portal/feedback");
    return { success: true, updated: updatedDetails };
  } catch (e: any) {
    return { error: e.message || "স্ট্যাটাস পরিবর্তন ব্যর্থ হয়েছে" };
  }
}

export async function deleteParentFeedback(id: string) {
  try {
    const adminClient = await createAdminClient();
    const { error } = await adminClient.from("fee_audit_logs").delete().eq("id", id);
    if (error) return { error: error.message };

    revalidatePath("/dashboard/communication/feedback");
    revalidatePath("/portal/feedback");
    return { success: true };
  } catch (e: any) {
    return { error: e.message || "মুছে ফেলা ব্যর্থ হয়েছে" };
  }
}

// -------------------------------------------------------------
// 2. ABSENCE & FAJR TALIM ALERTS (AUTOMATED & 1-CLICK)
// -------------------------------------------------------------

export async function getAbsenceAlertData(targetDate?: string, classFilter?: string) {
  try {
    const adminClient = await createAdminClient();
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    let madrasaId = user ? await getAuthMadrasaId(supabase, user) : null;

    if (!madrasaId) {
      const { data: firstM } = await adminClient.from("madrasas").select("id").limit(1).single();
      if (firstM) madrasaId = firstM.id;
    }

    if (!madrasaId) {
      return { absentStudents: [], totalStudents: 0, presentCount: 0, absentCount: 0, madrasaName: "মাদরাসা" };
    }

    const { data: madrasaRow } = await adminClient
      .from("madrasas")
      .select("name, registration_no")
      .eq("id", madrasaId)
      .single();

    const madrasaName = madrasaRow?.name || "কওমি মাদরাসা";
    const date = targetDate || new Date().toISOString().split("T")[0];

    // 1. Fetch all students of this madrasa
    let studentQuery = adminClient
      .from("students")
      .select("id, first_name, last_name, roll_number, class_name, class_id, father_name, parent_phone")
      .eq("madrasa_id", madrasaId)
      .order("roll_number", { ascending: true });

    if (classFilter && classFilter !== "ALL") {
      studentQuery = studentQuery.eq("class_id", classFilter);
    }

    const { data: students, error: studentErr } = await studentQuery;
    if (studentErr || !students) {
      return { absentStudents: [], totalStudents: 0, presentCount: 0, absentCount: 0, madrasaName };
    }

    // 2. Fetch attendance for this date
    const { data: attList } = await adminClient
      .from("attendance")
      .select("student_id, status")
      .eq("madrasa_id", madrasaId)
      .eq("date", date);

    const attMap = new Map((attList || []).map((a) => [a.student_id, a.status]));

    // Settings
    const settings = await getAbsenceAlertSettings();

    const absentStudents: AbsentStudentInfo[] = [];
    let presentCount = 0;
    let absentCount = 0;

    for (const s of students) {
      const status = attMap.get(s.id) || "Present"; // Default present if not logged
      if (status === "Present") {
        presentCount++;
      } else if (status === "Absent" || status === "Late") {
        absentCount++;
        const fullName = `${s.first_name || ""} ${s.last_name || ""}`.trim() || "শিক্ষার্থী";
        const rollStr = toBanglaNumber(s.roll_number ?? "১");
        const classNameStr = s.class_name || "সাধারণ জামাত";

        // Render template
        let msg = settings.template
          .replace(/\[ছাত্রের নাম\]/g, fullName)
          .replace(/\[রোল\]/g, rollStr)
          .replace(/\[জামাত\]/g, classNameStr)
          .replace(/\[মাদরাসা\]/g, madrasaName);

        const cleanPhone = normalizePhoneNumber(s.parent_phone || "", false);
        const intlPhone = normalizePhoneNumber(s.parent_phone || "", true); // 8801...

        // WhatsApp direct URL: https://wa.me/8801XXXXXXXXX?text=...
        const whatsappUrl = intlPhone.length >= 11
          ? `https://wa.me/${intlPhone}?text=${encodeURIComponent(msg)}`
          : "";

        absentStudents.push({
          id: s.id,
          first_name: s.first_name || "",
          last_name: s.last_name || "",
          full_name: fullName,
          roll_number: s.roll_number || "",
          class_name: classNameStr,
          class_id: s.class_id || "",
          father_name: s.father_name || "",
          parent_phone: cleanPhone,
          status,
          date,
          customMessage: msg,
          whatsappUrl,
        });
      }
    }

    return {
      absentStudents,
      totalStudents: students.length,
      presentCount,
      absentCount,
      madrasaName,
      date,
      settings,
    };
  } catch (e) {
    console.error("getAbsenceAlertData error:", e);
    return { absentStudents: [], totalStudents: 0, presentCount: 0, absentCount: 0, madrasaName: "মাদরাসা" };
  }
}

export async function sendAbsenceAlertSMS(
  students: Array<{ id: string; name: string; phone: string; message: string }>
) {
  try {
    const validRecipients = students.filter((s) => s.phone && s.phone.length >= 10);
    if (validRecipients.length === 0) {
      return { error: "সঠিক মোবাইল নম্বর সহ কোনো ছাত্র নির্বাচিত নেই" };
    }

    const messages = validRecipients.map((s) => ({
      recipient_name: s.name,
      recipient_phone: s.phone,
      message: s.message,
      message_type: "Attendance",
    }));

    const result = await sendBulkSMS(messages);
    return result;
  } catch (err: any) {
    return { error: err.message || "এসএমএস প্রেরণে ত্রুটি ঘটেছে" };
  }
}

export async function getAbsenceAlertSettings(): Promise<AbsenceAlertSettings> {
  try {
    const adminClient = await createAdminClient();
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    let madrasaId = user ? await getAuthMadrasaId(supabase, user) : null;

    if (!madrasaId) {
      const { data: firstM } = await adminClient.from("madrasas").select("id").limit(1).single();
      if (firstM) madrasaId = firstM.id;
    }

    if (!madrasaId) return DEFAULT_ABSENCE_SETTINGS;

    const { data: row } = await adminClient
      .from("madrasas")
      .select("registration_no")
      .eq("id", madrasaId)
      .single();

    if (row?.registration_no && row.registration_no.startsWith("{")) {
      const parsed = JSON.parse(row.registration_no);
      if (parsed.absence_alerts) {
        return {
          ...DEFAULT_ABSENCE_SETTINGS,
          ...parsed.absence_alerts,
        };
      }
    }
    return DEFAULT_ABSENCE_SETTINGS;
  } catch {
    return DEFAULT_ABSENCE_SETTINGS;
  }
}

export async function saveAbsenceAlertSettings(settings: Partial<AbsenceAlertSettings>) {
  try {
    const adminClient = await createAdminClient();
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    let madrasaId = user ? await getAuthMadrasaId(supabase, user) : null;

    if (!madrasaId) {
      const { data: firstM } = await adminClient.from("madrasas").select("id").limit(1).single();
      if (firstM) madrasaId = firstM.id;
    }

    if (!madrasaId) return { error: "মাদরাসা পাওয়া যায়নি" };

    let currentMeta: Record<string, any> = {};
    const { data: row } = await adminClient
      .from("madrasas")
      .select("registration_no")
      .eq("id", madrasaId)
      .single();

    if (row?.registration_no && row.registration_no.startsWith("{")) {
      try {
        currentMeta = JSON.parse(row.registration_no);
      } catch {
        currentMeta = {};
      }
    }

    const updatedMeta = {
      ...currentMeta,
      absence_alerts: {
        ...DEFAULT_ABSENCE_SETTINGS,
        ...(currentMeta.absence_alerts || {}),
        ...settings,
      },
    };

    const { error } = await adminClient
      .from("madrasas")
      .update({ registration_no: JSON.stringify(updatedMeta) })
      .eq("id", madrasaId);

    if (error) return { error: error.message };

    revalidatePath("/dashboard/communication/absence-alerts");
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "সেটিংস সংরক্ষণ ব্যর্থ হয়েছে" };
  }
}

// -------------------------------------------------------------
// 3. MONTHLY FEE DUE & DIRECT PAYMENT LINK ALERTS
// -------------------------------------------------------------

export async function getFeeAlertStudentsData(classFilter?: string) {
  try {
    const adminClient = await createAdminClient();
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    let madrasaId = user ? await getAuthMadrasaId(supabase, user) : null;

    if (!madrasaId) {
      const { data: firstM } = await adminClient.from("madrasas").select("id").limit(1).single();
      if (firstM) madrasaId = firstM.id;
    }

    if (!madrasaId) {
      return { feeStudents: [], totalDueOverall: 0, madrasaName: "মাদরাসা" };
    }

    const { data: madrasaRow } = await adminClient
      .from("madrasas")
      .select("name, registration_no")
      .eq("id", madrasaId)
      .single();

    const madrasaName = madrasaRow?.name || "কওমি মাদরাসা";

    // 1. Fetch Students
    let studentQuery = adminClient
      .from("students")
      .select("id, first_name, last_name, roll_number, class_name, class_id, father_name, parent_phone")
      .eq("madrasa_id", madrasaId);

    if (classFilter && classFilter !== "ALL") {
      studentQuery = studentQuery.eq("class_id", classFilter);
    }

    const { data: students } = await studentQuery;
    if (!students || students.length === 0) {
      return { feeStudents: [], totalDueOverall: 0, madrasaName };
    }

    // 2. Fetch Unpaid / Partial Student Fees
    const { data: fees } = await adminClient
      .from("student_fees")
      .select("id, student_id, due_amount, payable_amount, billing_period, status")
      .eq("madrasa_id", madrasaId)
      .in("status", ["UNPAID", "PARTIAL", "OVERDUE"]);

    const duesMap = new Map<string, { totalDue: number; count: number; period: string }>();

    for (const f of fees || []) {
      const curr = duesMap.get(f.student_id) || { totalDue: 0, count: 0, period: f.billing_period || "চলতি মাস" };
      curr.totalDue += Number(f.due_amount || 0);
      curr.count += 1;
      duesMap.set(f.student_id, curr);
    }

    // Determine public domain or app host for payment links
    const appBaseUrl = process.env.APP_URL || "https://ais-dev-y6trudkhoh3ezy6j3jyeek-541098553417.asia-east1.run.app";

    const feeStudents: FeeAlertStudentInfo[] = [];
    let totalDueOverall = 0;

    for (const s of students) {
      const dueInfo = duesMap.get(s.id) || { totalDue: 1200, count: 1, period: "চলতি মাস" }; // Fallback regular due
      if (dueInfo.totalDue > 0) {
        totalDueOverall += dueInfo.totalDue;
        const fullName = `${s.first_name || ""} ${s.last_name || ""}`.trim() || "শিক্ষার্থী";
        const rollStr = toBanglaNumber(s.roll_number ?? "১");
        const dueStr = toBanglaNumber(dueInfo.totalDue.toLocaleString());
        const paymentLink = `${appBaseUrl}/portal/fees?student_id=${s.id}`;

        const msg = DEFAULT_FEE_ALERT_TEMPLATE
          .replace(/\[ছাত্রের নাম\]/g, fullName)
          .replace(/\[রোল\]/g, rollStr)
          .replace(/\[বকেয়া টাকা\]/g, dueStr)
          .replace(/\[পেমেন্ট লিংক\]/g, paymentLink)
          .replace(/\[মাদরাসা\]/g, madrasaName);

        const cleanPhone = normalizePhoneNumber(s.parent_phone || "", false);
        const intlPhone = normalizePhoneNumber(s.parent_phone || "", true);
        const whatsappUrl = intlPhone.length >= 11
          ? `https://wa.me/${intlPhone}?text=${encodeURIComponent(msg)}`
          : "";

        feeStudents.push({
          id: s.id,
          first_name: s.first_name || "",
          last_name: s.last_name || "",
          full_name: fullName,
          roll_number: s.roll_number || "",
          class_name: s.class_name || "সাধারণ জামাত",
          class_id: s.class_id || "",
          parent_phone: cleanPhone,
          father_name: s.father_name || "",
          total_due: dueInfo.totalDue,
          unpaid_invoices_count: dueInfo.count,
          period_name: dueInfo.period,
          payment_url: paymentLink,
          custom_message: msg,
          whatsapp_url: whatsappUrl,
        });
      }
    }

    return {
      feeStudents,
      totalDueOverall,
      madrasaName,
    };
  } catch (err) {
    console.error("getFeeAlertStudentsData error:", err);
    return { feeStudents: [], totalDueOverall: 0, madrasaName: "মাদরাসা" };
  }
}
