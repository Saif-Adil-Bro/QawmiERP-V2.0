"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeGuard } from "@/lib/action-authorization";
import { isMissingTableError } from "@/lib/audit-log";
import {
  getStructuredMadrasaSetting,
  saveStructuredMadrasaSetting,
} from "@/lib/structured-config";
import {
  executeCustomReport,
  getExecutiveBiSnapshot,
  type BiCustomDataset,
  type CustomReportQuery,
} from "@/lib/bi/executive-bi-service";
import {
  dispatchScheduledDigestNotifications,
  generateAndAuditDigest,
  type DigestScheduleRecord,
} from "@/lib/bi/digest-generator";

const BI_NAMESPACE = "bi";
const CUSTOM_REPORTS_KEY = "custom_reports";
const DIGEST_SCHEDULES_KEY = "digest_schedules";

export interface SavedCustomReport {
  id: string;
  name: string;
  dataset: BiCustomDataset;
  groupBy: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  createdAt: string;
}

export async function getExecutiveBiDashboardDataAction(opts?: {
  months?: number;
  sessionId?: string | null;
}) {
  const authz = await writeGuard("bi");
  if (!authz.allowed) {
    return { error: authz.error || "অনুমতি নেই", snapshot: null };
  }
  if (!authz.madrasaId) {
    return { error: "মাদ্রাসা পাওয়া যায়নি", snapshot: null };
  }

  try {
    const snapshot = await getExecutiveBiSnapshot(authz.madrasaId, opts);
    return { snapshot };
  } catch (err: any) {
    return { error: err?.message || "বিআই ডেটা লোড করতে ব্যর্থ", snapshot: null };
  }
}

export async function runCustomBiReportAction(definition: CustomReportQuery) {
  const authz = await writeGuard("bi");
  if (!authz.allowed) {
    return { error: authz.error || "অনুমতি নেই", result: null };
  }
  if (!authz.madrasaId) {
    return { error: "মাদ্রাসা পাওয়া যায়নি", result: null };
  }

  try {
    const result = await executeCustomReport(authz.madrasaId, definition);
    return { result };
  } catch (err: any) {
    return { error: err?.message || "কাস্টম রিপোর্ট তৈরি করতে ব্যর্থ", result: null };
  }
}

export async function getSavedCustomReportsAction() {
  const authz = await writeGuard("bi");
  if (!authz.allowed) {
    return { error: authz.error || "অনুমতি নেই", reports: [] as SavedCustomReport[] };
  }
  if (!authz.madrasaId) {
    return { error: "মাদ্রাসা পাওয়া যায়নি", reports: [] as SavedCustomReport[] };
  }

  const res = await getStructuredMadrasaSetting<SavedCustomReport[]>(
    authz.madrasaId,
    BI_NAMESPACE,
    CUSTOM_REPORTS_KEY
  );
  return { reports: Array.isArray(res.value) ? res.value : [] };
}

export async function saveCustomReportDefinitionAction(input: {
  id?: string;
  name: string;
  dataset: BiCustomDataset;
  groupBy: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}) {
  const authz = await writeGuard("bi");
  if (!authz.allowed) {
    return { error: authz.error || "অনুমতি নেই" };
  }
  if (!authz.madrasaId) {
    return { error: "মাদ্রাসা পাওয়া যায়নি" };
  }

  const name = String(input.name || "").trim();
  if (!name) {
    return { error: "রিপোর্টের নাম আবশ্যক" };
  }

  const existing = await getStructuredMadrasaSetting<SavedCustomReport[]>(
    authz.madrasaId,
    BI_NAMESPACE,
    CUSTOM_REPORTS_KEY
  );
  const list = Array.isArray(existing.value) ? [...existing.value] : [];
  const id = input.id || `rep_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const record: SavedCustomReport = {
    id,
    name,
    dataset: input.dataset,
    groupBy: input.groupBy,
    dateFrom: input.dateFrom || undefined,
    dateTo: input.dateTo || undefined,
    limit: input.limit || 50,
    createdAt: new Date().toISOString(),
  };

  const idx = list.findIndex((r) => r.id === id);
  if (idx >= 0) list[idx] = record;
  else list.unshift(record);

  await saveStructuredMadrasaSetting(
    authz.madrasaId,
    BI_NAMESPACE,
    CUSTOM_REPORTS_KEY,
    list.slice(0, 50),
    authz.userId
  );

  revalidatePath("/dashboard/analytics/executive-bi");
  return { ok: true, report: record };
}

export async function deleteCustomReportDefinitionAction(id: string) {
  const authz = await writeGuard("bi");
  if (!authz.allowed) return { error: authz.error || "অনুমতি নেই" };
  if (!authz.madrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি" };

  const existing = await getStructuredMadrasaSetting<SavedCustomReport[]>(
    authz.madrasaId,
    BI_NAMESPACE,
    CUSTOM_REPORTS_KEY
  );
  const list = (Array.isArray(existing.value) ? existing.value : []).filter(
    (r) => r.id !== id
  );

  await saveStructuredMadrasaSetting(
    authz.madrasaId,
    BI_NAMESPACE,
    CUSTOM_REPORTS_KEY,
    list,
    authz.userId
  );

  revalidatePath("/dashboard/analytics/executive-bi");
  return { ok: true };
}

export async function getDigestSchedulesAction() {
  const authz = await writeGuard("bi");
  if (!authz.allowed) {
    return { error: authz.error || "অনুমতি নেই", schedules: [] as DigestScheduleRecord[] };
  }
  if (!authz.madrasaId) {
    return { error: "মাদ্রাসা পাওয়া যায়নি", schedules: [] as DigestScheduleRecord[] };
  }

  try {
    const admin = await createAdminClient();
    const { data, error } = await admin
      .from("digest_schedules")
      .select("*")
      .eq("madrasa_id", authz.madrasaId)
      .order("created_at", { ascending: false });

    if (!error) {
      return {
        schedules: (data || []).map((d: any) => ({
          ...d,
          recipients: Array.isArray(d.recipients) ? d.recipients : [],
        })) as DigestScheduleRecord[],
      };
    }

    if (!isMissingTableError(error)) {
      return { error: error.message, schedules: [] as DigestScheduleRecord[] };
    }
  } catch {
    // fallback
  }

  const fb = await getStructuredMadrasaSetting<DigestScheduleRecord[]>(
    authz.madrasaId,
    BI_NAMESPACE,
    DIGEST_SCHEDULES_KEY
  );
  return { schedules: Array.isArray(fb.value) ? fb.value : [] };
}

export async function saveDigestScheduleAction(input: {
  id?: string;
  schedule_key?: string;
  name: string;
  frequency: "weekly" | "monthly";
  day_of_week?: number;
  day_of_month?: number;
  recipients: string[];
  format?: "html" | "xlsx";
  is_enabled: boolean;
}) {
  const authz = await writeGuard("bi");
  if (!authz.allowed) return { error: authz.error || "অনুমতি নেই" };
  if (!authz.madrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি" };

  const name = String(input.name || "").trim();
  if (!name) return { error: "ডাইজেস্ট শিডিউলের নাম আবশ্যক" };

  const nowIso = new Date().toISOString();
  const scheduleKey =
    input.schedule_key?.trim() ||
    `digest_${input.frequency}_${Date.now().toString(36)}`;

  const payload = {
    madrasa_id: authz.madrasaId,
    schedule_key: scheduleKey,
    name,
    frequency: input.frequency === "monthly" ? "monthly" : "weekly",
    day_of_week: input.day_of_week ?? 5,
    day_of_month: input.day_of_month ?? 1,
    recipients: Array.isArray(input.recipients) ? input.recipients.filter(Boolean) : [],
    include_sections: ["boarding", "funds", "dues", "exams"],
    format: input.format === "xlsx" ? "xlsx" : "html",
    is_enabled: Boolean(input.is_enabled),
    created_by: authz.userId || null,
    updated_at: nowIso,
  };

  try {
    const admin = await createAdminClient();
    if (input.id) {
      const { data, error } = await admin
        .from("digest_schedules")
        .update(payload)
        .eq("id", input.id)
        .eq("madrasa_id", authz.madrasaId)
        .select("*")
        .maybeSingle();

      if (!error && data) {
        revalidatePath("/dashboard/analytics/executive-bi");
        return { ok: true, schedule: data };
      }
      if (error && !isMissingTableError(error)) {
        return { error: error.message };
      }
    } else {
      const { data, error } = await admin
        .from("digest_schedules")
        .insert({ ...payload, created_at: nowIso })
        .select("*")
        .maybeSingle();

      if (!error && data) {
        revalidatePath("/dashboard/analytics/executive-bi");
        return { ok: true, schedule: data };
      }
      if (error && !isMissingTableError(error)) {
        return { error: error.message };
      }
    }
  } catch {
    // fall through
  }

  const fb = await getStructuredMadrasaSetting<DigestScheduleRecord[]>(
    authz.madrasaId,
    BI_NAMESPACE,
    DIGEST_SCHEDULES_KEY
  );
  const list = Array.isArray(fb.value) ? [...fb.value] : [];
  const id = input.id || `ds_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const record: DigestScheduleRecord = {
    id,
    ...payload,
    created_at: nowIso,
  };
  const idx = list.findIndex((r) => r.id === id);
  if (idx >= 0) list[idx] = record;
  else list.unshift(record);

  await saveStructuredMadrasaSetting(
    authz.madrasaId,
    BI_NAMESPACE,
    DIGEST_SCHEDULES_KEY,
    list,
    authz.userId
  );

  revalidatePath("/dashboard/analytics/executive-bi");
  return { ok: true, schedule: record };
}

export async function deleteDigestScheduleAction(id: string) {
  const authz = await writeGuard("bi");
  if (!authz.allowed) return { error: authz.error || "অনুমতি নেই" };
  if (!authz.madrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি" };

  try {
    const admin = await createAdminClient();
    const { error } = await admin
      .from("digest_schedules")
      .delete()
      .eq("id", id)
      .eq("madrasa_id", authz.madrasaId);

    if (!error) {
      revalidatePath("/dashboard/analytics/executive-bi");
      return { ok: true };
    }
    if (!isMissingTableError(error)) {
      return { error: error.message };
    }
  } catch {
    // fallback
  }

  const fb = await getStructuredMadrasaSetting<DigestScheduleRecord[]>(
    authz.madrasaId,
    BI_NAMESPACE,
    DIGEST_SCHEDULES_KEY
  );
  const list = (Array.isArray(fb.value) ? fb.value : []).filter((r) => r.id !== id);
  await saveStructuredMadrasaSetting(
    authz.madrasaId,
    BI_NAMESPACE,
    DIGEST_SCHEDULES_KEY,
    list,
    authz.userId
  );

  revalidatePath("/dashboard/analytics/executive-bi");
  return { ok: true };
}

export async function generateDigestNowAction(input?: {
  scheduleId?: string;
  format?: "html" | "xlsx";
  sendNotification?: boolean;
}) {
  const authz = await writeGuard("bi");
  if (!authz.allowed) return { error: authz.error || "অনুমতি নেই" };
  if (!authz.madrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি" };

  try {
    const result = await generateAndAuditDigest({
      madrasaId: authz.madrasaId,
      actorId: authz.userId,
      actorName: authz.actorName || authz.actorEmail || "Admin",
      actorRole: authz.actorRole || "muhtamim",
      ipAddress: "server-action",
      scheduleId: input?.scheduleId,
      format: input?.format || "html",
    });

    if (input?.sendNotification) {
      await dispatchScheduledDigestNotifications(
        authz.madrasaId,
        {
          id: input.scheduleId || result.watermark.exportId,
          madrasa_id: authz.madrasaId,
          name: "তাৎক্ষণিক নির্বাহী বিআই ডাইজেস্ট",
          frequency: "weekly",
          recipients: authz.actorEmail ? [authz.actorEmail] : [],
          is_enabled: true,
        },
        result.snapshot
      );
    }

    return {
      ok: true,
      exportId: result.watermark.exportId,
      filename: result.filename,
      format: result.format,
      html: result.html,
      xlsxBase64: result.workbook ? result.workbook.toString("base64") : undefined,
    };
  } catch (err: any) {
    return { error: err?.message || "ডাইজেস্ট তৈরি করতে ব্যর্থ" };
  }
}
