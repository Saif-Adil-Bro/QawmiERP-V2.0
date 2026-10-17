"use server";

import { writeGuard } from "@/lib/action-authorization";
import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { getAuthMadrasaId, getStudents } from "@/app/actions/students";
import { getClasses } from "@/app/actions/classes";
import { getMadrasaMetadata, saveMadrasaMetadata } from "@/lib/sessions";
import { getMadrasaInfo } from "@/lib/getMadrasaInfo";
import {
  AmalTrackerTemplate,
  AmalEvaluationLog,
  ALL_DEFAULT_TEMPLATES,
  WEEKLY_GENERAL_TEMPLATE,
} from "@/lib/amal-tracker";
import { revalidatePath } from "next/cache";

/**
 * Fetch all necessary initial data for the Amal Tracker module
 */
export async function getAmalTrackerData() {
  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    let madrasaId = user ? await getAuthMadrasaId(supabase, user) : "";

    const [madrasaInfo, classesList, studentsList] = await Promise.all([
      getMadrasaInfo(),
      getClasses(),
      getStudents(),
    ]);

    if (!madrasaId && madrasaInfo?.id) {
      madrasaId = madrasaInfo.id;
    }
    if (!madrasaId && studentsList?.[0]?.madrasa_id) {
      madrasaId = studentsList[0].madrasa_id;
    }
    if (!madrasaId) {
      try {
        const adminClient = await createAdminClient();
        const { data: firstMadrasa } = await adminClient.from("madrasas").select("id").limit(1).maybeSingle();
        if (firstMadrasa?.id) {
          madrasaId = firstMadrasa.id;
        }
      } catch {}
    }

    let customTemplates: AmalTrackerTemplate[] = [];
    let evaluationLogs: AmalEvaluationLog[] = [];

    if (madrasaId) {
      const meta = await getMadrasaMetadata(madrasaId);
      customTemplates = meta.amal_templates || [];
      evaluationLogs = meta.amal_logs || [];
    }

    // Merge default templates and custom templates (custom ones take priority if matched by id)
    const templatesMap = new Map<string, AmalTrackerTemplate>();
    ALL_DEFAULT_TEMPLATES.forEach((tpl) => templatesMap.set(tpl.id, tpl));
    customTemplates.forEach((tpl) => templatesMap.set(tpl.id, tpl));

    const allTemplates = Array.from(templatesMap.values());

    return {
      success: true,
      madrasaInfo,
      classes: classesList || [],
      students: studentsList || [],
      templates: allTemplates,
      defaultTemplate: WEEKLY_GENERAL_TEMPLATE,
      evaluationLogs,
    };
  } catch (err: any) {
    console.error("Exception in getAmalTrackerData:", err);
    return {
      success: false,
      madrasaInfo: null,
      classes: [],
      students: [],
      templates: ALL_DEFAULT_TEMPLATES,
      defaultTemplate: WEEKLY_GENERAL_TEMPLATE,
      evaluationLogs: [],
      error: err?.message || String(err),
    };
  }
}

/**
 * Helper to reliably resolve current madrasa ID across user profile, metadata, or active records
 */
async function resolveEffectiveMadrasaId(supabase: any, user: any): Promise<string> {
  let madrasaId = user ? await getAuthMadrasaId(supabase, user) : "";
  if (!madrasaId) {
    try {
      const madrasaInfo = await getMadrasaInfo();
      madrasaId = madrasaInfo?.id || "";
    } catch {}
  }
  if (!madrasaId) {
    try {
      const adminClient = await createAdminClient();
      const { data: firstMadrasa } = await adminClient.from("madrasas").select("id").limit(1).maybeSingle();
      if (firstMadrasa?.id) {
        madrasaId = firstMadrasa.id;
      }
    } catch {}
  }
  return madrasaId;
}

/**
 * Save or update an Amal Tracker template
 */
export async function saveAmalTrackerTemplate(template: Partial<AmalTrackerTemplate>) {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("generic");
    if (!__authz.allowed) return __authz.fallback;
  }

  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) {
      return { success: false, message: "অননুমোদিত অনুরোধ। লগইন করুন।" };
    }

    const madrasaId = await resolveEffectiveMadrasaId(supabase, user);
    if (!madrasaId) {
      return { success: false, message: "মাদরাসা আইডি পাওয়া যায়নি।" };
    }

    const meta = await getMadrasaMetadata(madrasaId);
    const existingList: AmalTrackerTemplate[] = meta.amal_templates || [];

    const templateId = template.id || `custom_amal_${Date.now()}`;
    const now = new Date().toISOString();

    const completeTemplate: AmalTrackerTemplate = {
      id: templateId,
      title: template.title?.trim() || "কাস্টম আমল ট্র্যাকার",
      code: template.code || "custom",
      durationDays: template.durationDays || 7,
      description: template.description || "",
      arabicSlogan: template.arabicSlogan || "مَنْ عَمِلَ صَالِحًا فَلِنَفْسِهِ",
      naseehatText: template.naseehatText || "",
      instructions: template.instructions || [],
      evaluationGrades: template.evaluationGrades || [],
      categories: template.categories || [],
      items: template.items || [],
      headerStyle: template.headerStyle || "classical",
      borderStyle: template.borderStyle || "ornate",
      showWatermark: template.showWatermark ?? true,
      showGradeEvaluation: template.showGradeEvaluation ?? true,
      showParentSign: template.showParentSign ?? true,
      showTeacherSign: template.showTeacherSign ?? true,
      showImamDailySignRow: (template as any).showImamDailySignRow ?? false,
      showImamSign: (template as any).showImamSign ?? false,
      dateHeaderMode: (template as any).dateHeaderMode || "auto",
      isDefault: false,
      createdAt: template.createdAt || now,
      updatedAt: now,
    };

    const index = existingList.findIndex((t) => t.id === templateId);
    if (index >= 0) {
      existingList[index] = completeTemplate;
    } else {
      existingList.unshift(completeTemplate);
    }

    meta.amal_templates = existingList;
    await saveMadrasaMetadata(madrasaId, meta);

    // Audit log
    try {
      const { recordActivityLog } = await import("@/app/actions/activity-logs");
      await recordActivityLog({
        action_type: index >= 0 ? "UPDATE" : "CREATE",
        module: "ACADEMIC",
        title: `আমল ট্র্যাকার টেমপ্লেট ${index >= 0 ? "হালনাগাদ" : "তৈরি"} করা হয়েছে`,
        description: `টেমপ্লেটের নাম: ${completeTemplate.title}`,
        severity: "INFO",
        link: "/dashboard/academic/amal-tracker",
      });
    } catch {}

    revalidatePath("/dashboard/academic/amal-tracker");

    return {
      success: true,
      message: "আমল ট্র্যাকার টেমপ্লেট সফলভাবে সংরক্ষিত হয়েছে।",
      template: completeTemplate,
    };
  } catch (err: any) {
    console.error("Exception in saveAmalTrackerTemplate:", err);
    return {
      success: false,
      message: "টেমপ্লেট সংরক্ষণে ত্রুটি ঘটেছে।",
      error: err?.message || String(err),
    };
  }
}

/**
 * Delete a custom template
 */
export async function deleteAmalTrackerTemplate(templateId: string) {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("generic");
    if (!__authz.allowed) return __authz.fallback;
  }

  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) {
      return { success: false, message: "অননুমোদিত অনুরোধ।" };
    }

    const madrasaId = await resolveEffectiveMadrasaId(supabase, user);
    if (!madrasaId) {
      return { success: false, message: "মাদরাসা আইডি পাওয়া যায়নি।" };
    }

    const meta = await getMadrasaMetadata(madrasaId);
    const existingList: AmalTrackerTemplate[] = meta.amal_templates || [];

    const updated = existingList.filter((t) => t.id !== templateId);
    meta.amal_templates = updated;
    await saveMadrasaMetadata(madrasaId, meta);

    revalidatePath("/dashboard/academic/amal-tracker");

    return {
      success: true,
      message: "আমল ট্র্যাকার টেমপ্লেট মুছে ফেলা হয়েছে।",
    };
  } catch (err: any) {
    console.error("Exception in deleteAmalTrackerTemplate:", err);
    return {
      success: false,
      message: "টেমপ্লেট মুছতে ত্রুটি ঘটেছে।",
      error: err?.message || String(err),
    };
  }
}

/**
 * Save an Amal Evaluation Record for a student
 */
export async function saveAmalEvaluationLog(log: Partial<AmalEvaluationLog>) {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("generic");
    if (!__authz.allowed) return __authz.fallback;
  }

  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) {
      return { success: false, message: "অননুমোদিত অনুরোধ।" };
    }

    const madrasaId = await resolveEffectiveMadrasaId(supabase, user);
    if (!madrasaId) {
      return { success: false, message: "মাদরাসা আইডি পাওয়া যায়নি।" };
    }

    const meta = await getMadrasaMetadata(madrasaId);
    const logs: AmalEvaluationLog[] = meta.amal_logs || [];

    const logId = log.id || `eval_${Date.now()}`;
    const now = new Date().toISOString();

    const fullLog: AmalEvaluationLog = {
      id: logId,
      templateId: log.templateId || "weekly",
      templateTitle: log.templateTitle || "সাপ্তাহিক আমল ট্র্যাকার",
      studentId: log.studentId || "",
      studentName: log.studentName || "",
      studentRoll: log.studentRoll || "",
      className: log.className || "",
      startDate: log.startDate || new Date().toISOString().split("T")[0],
      endDate: log.endDate || new Date().toISOString().split("T")[0],
      totalDays: log.totalDays || 7,
      completedDays: log.completedDays || 0,
      totalScorePercentage: log.totalScorePercentage || 0,
      grade: log.grade || "মুমতাজ",
      parentSignatureCollected: log.parentSignatureCollected ?? true,
      parentPhone: log.parentPhone || "",
      teacherRemarks: log.teacherRemarks || "",
      evaluatedBy: user.user_metadata?.full_name || "মুহতারাম শিক্ষক",
      createdAt: log.createdAt || now,
      updatedAt: now,
    };

    const index = logs.findIndex((l) => l.id === logId);
    if (index >= 0) {
      logs[index] = fullLog;
    } else {
      logs.unshift(fullLog);
    }

    meta.amal_logs = logs;
    await saveMadrasaMetadata(madrasaId, meta);

    revalidatePath("/dashboard/academic/amal-tracker");

    return {
      success: true,
      message: "আমল মূল্যায়ন ফলাফল সফলভাবে সংরক্ষিত হয়েছে।",
      log: fullLog,
    };
  } catch (err: any) {
    console.error("Exception in saveAmalEvaluationLog:", err);
    return {
      success: false,
      message: "মূল্যায়ন রেকর্ড সংরক্ষণে ত্রুটি ঘটেছে।",
      error: err?.message || String(err),
    };
  }
}

/**
 * Delete an Amal Evaluation Record
 */
export async function deleteAmalEvaluationLog(logId: string) {
  // ⛔ CR-2: সার্ভার-সাইড authorization guard — লগইন, অ্যাকাউন্ট স্ট্যাটাস,
  // টেন্যান্ট (মাদ্রাসা) ও মডিউল-পারমিশন যাচাই। আগে এখানে কেবল `if (!user)` ছিল।
  {
    const __authz = await writeGuard("generic");
    if (!__authz.allowed) return __authz.fallback;
  }

  try {
    const supabase = await createClient();
    const user = await getAuthUser(supabase);
    if (!user) return { success: false, message: "অননুমোদিত অনুরোধ।" };

    const madrasaId = await resolveEffectiveMadrasaId(supabase, user);
    if (!madrasaId) return { success: false, message: "মাদরাসা আইডি পাওয়া যায়নি।" };

    const meta = await getMadrasaMetadata(madrasaId);
    const logs: AmalEvaluationLog[] = meta.amal_logs || [];

    meta.amal_logs = logs.filter((l) => l.id !== logId);
    await saveMadrasaMetadata(madrasaId, meta);

    revalidatePath("/dashboard/academic/amal-tracker");

    return {
      success: true,
      message: "মূল্যায়ন রেকর্ড সফলভাবে মুছে ফেলা হয়েছে।",
    };
  } catch (err: any) {
    return {
      success: false,
      message: "রেকর্ড মুছতে ত্রুটি ঘটেছে।",
      error: err?.message || String(err),
    };
  }
}
