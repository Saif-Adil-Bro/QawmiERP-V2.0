"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeGuard } from "@/lib/action-authorization";
import { isMissingTableError } from "@/lib/audit-log";
import { getStructuredMadrasaSetting, saveStructuredMadrasaSetting } from "@/lib/structured-config";
import {
  dispatchNotification,
  processNotificationQueue,
} from "@/lib/notifications/orchestrator";
import type { NotificationChannel } from "@/lib/notifications/channels";

export interface NotificationTemplateInput {
  id?: string;
  template_key: string;
  event_name: string;
  title: string;
  title_bn?: string | null;
  channel: NotificationChannel;
  subject?: string | null;
  body: string;
  variables?: string[];
  is_active?: boolean;
}

const FALLBACK_TEMPLATES_KEY = "notification_templates";
const FALLBACK_QUEUE_KEY = "notification_queue";

export async function getNotificationTemplatesAction() {
  const authz = await writeGuard("communication");
  if (!authz.allowed) return { error: authz.error || "অনুমতি নেই", templates: [] };
  if (!authz.madrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি", templates: [] };

  const admin = await createAdminClient();
  const { data, error } = await admin
    .from("notification_templates")
    .select("*")
    .eq("madrasa_id", authz.madrasaId)
    .order("created_at", { ascending: false });

  if (!error) {
    return { templates: data || [], source: "sql" as const };
  }

  if (isMissingTableError(error)) {
    const fb = await getStructuredMadrasaSetting<any[]>(
      authz.madrasaId,
      "notifications",
      FALLBACK_TEMPLATES_KEY
    );
    return { templates: Array.isArray(fb.value) ? fb.value : [], source: "fallback" as const };
  }

  return { error: error.message, templates: [] };
}

export async function saveNotificationTemplateAction(input: NotificationTemplateInput) {
  const authz = await writeGuard("communication");
  if (!authz.allowed) return { error: authz.error || "অনুমতি নেই" };
  if (!authz.madrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি" };

  const templateKey = String(input.template_key || "").trim();
  const eventName = String(input.event_name || "").trim();
  const title = String(input.title || "").trim();
  const body = String(input.body || "").trim();

  if (!templateKey || !eventName || !title || !body) {
    return { error: "টেমপ্লেট কী, ইভেন্ট, শিরোনাম এবং বার্তা আবশ্যক।" };
  }

  const nowIso = new Date().toISOString();
  const record = {
    madrasa_id: authz.madrasaId,
    template_key: templateKey,
    event_name: eventName,
    title,
    title_bn: input.title_bn || title,
    channel: input.channel || "sms",
    subject: input.subject || title,
    body,
    variables: Array.isArray(input.variables) ? input.variables : [],
    is_active: input.is_active !== false,
    created_by: authz.userId || null,
    updated_at: nowIso,
  };

  const admin = await createAdminClient();
  const upsertPayload: Record<string, any> = input.id ? { id: input.id, ...record } : record;
  const { data, error } = await admin
    .from("notification_templates")
    .upsert(upsertPayload, { onConflict: "madrasa_id,template_key,channel" })
    .select()
    .maybeSingle();

  if (!error) {
    await authz.logAudit({
      module: "notifications",
      action: "NOTIFICATION_TEMPLATE_SAVED",
      entityType: "notification_templates",
      entityId: data?.id || input.id || templateKey,
      entityLabel: title,
      summary: `নোটিফিকেশন টেমপ্লেট '${title}' (${input.channel}) সংরক্ষণ করা হয়েছে`,
      newValue: record,
    });
    revalidatePath("/dashboard/communication/orchestrator");
    return { success: true, template: data };
  }

  if (isMissingTableError(error)) {
    const fb = await getStructuredMadrasaSetting<any[]>(
      authz.madrasaId,
      "notifications",
      FALLBACK_TEMPLATES_KEY
    );
    const list = Array.isArray(fb.value) ? fb.value : [];
    const idx = list.findIndex(
      (t) =>
        (input.id && t.id === input.id) ||
        (t.template_key === templateKey && t.channel === record.channel)
    );
    const saved = {
      id: input.id || `tpl_${Date.now()}`,
      ...record,
      created_at: idx >= 0 ? list[idx].created_at : nowIso,
    };
    if (idx >= 0) list[idx] = saved;
    else list.unshift(saved);

    await saveStructuredMadrasaSetting(
      authz.madrasaId,
      "notifications",
      FALLBACK_TEMPLATES_KEY,
      list,
      authz.userId
    );
    revalidatePath("/dashboard/communication/orchestrator");
    return { success: true, template: saved };
  }

  return { error: error.message };
}

export async function deleteNotificationTemplateAction(id: string) {
  const authz = await writeGuard("communication");
  if (!authz.allowed) return { error: authz.error || "অনুমতি নেই" };
  if (!authz.madrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি" };

  const admin = await createAdminClient();
  const { error } = await admin
    .from("notification_templates")
    .delete()
    .eq("id", id)
    .eq("madrasa_id", authz.madrasaId);

  if (!error) {
    revalidatePath("/dashboard/communication/orchestrator");
    return { success: true };
  }

  if (isMissingTableError(error)) {
    const fb = await getStructuredMadrasaSetting<any[]>(
      authz.madrasaId,
      "notifications",
      FALLBACK_TEMPLATES_KEY
    );
    const list = (Array.isArray(fb.value) ? fb.value : []).filter((t) => t.id !== id);
    await saveStructuredMadrasaSetting(
      authz.madrasaId,
      "notifications",
      FALLBACK_TEMPLATES_KEY,
      list,
      authz.userId
    );
    revalidatePath("/dashboard/communication/orchestrator");
    return { success: true };
  }

  return { error: error.message };
}

export async function getNotificationQueueAction(limit = 50) {
  const authz = await writeGuard("communication");
  if (!authz.allowed) return { error: authz.error || "অনুমতি নেই", items: [] };
  if (!authz.madrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি", items: [] };

  const admin = await createAdminClient();
  const { data, error } = await admin
    .from("notification_queue")
    .select("*")
    .eq("madrasa_id", authz.madrasaId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!error) {
    return { items: data || [], source: "sql" as const };
  }

  if (isMissingTableError(error)) {
    const fb = await getStructuredMadrasaSetting<any[]>(
      authz.madrasaId,
      "notifications",
      FALLBACK_QUEUE_KEY
    );
    return {
      items: (Array.isArray(fb.value) ? fb.value : []).slice(0, limit),
      source: "fallback" as const,
    };
  }

  return { error: error.message, items: [] };
}

export async function processNotificationQueueAction(limit = 50) {
  const authz = await writeGuard("communication");
  if (!authz.allowed) return { error: authz.error || "অনুমতি নেই" };
  if (!authz.madrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি" };

  const summary = await processNotificationQueue(limit, authz.madrasaId);
  revalidatePath("/dashboard/communication/orchestrator");
  return { success: true, summary };
}

export async function sendTestNotificationAction(input: {
  event: string;
  recipientPhone?: string;
  recipientEmail?: string;
  recipientToken?: string;
  channels?: NotificationChannel[];
  subject?: string;
  body: string;
  variables?: Record<string, string | number | null | undefined>;
}) {
  const authz = await writeGuard("communication");
  if (!authz.allowed) return { error: authz.error || "অনুমতি নেই" };
  if (!authz.madrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি" };

  const result = await dispatchNotification(input.event || "test.notification", {
    madrasaId: authz.madrasaId,
    recipientUserId: authz.userId,
    recipientPhone: input.recipientPhone,
    recipientEmail: input.recipientEmail,
    recipientToken: input.recipientToken,
    channels: input.channels,
    subject: input.subject,
    body: input.body,
    variables: input.variables,
    actorId: authz.userId,
  });

  revalidatePath("/dashboard/communication/orchestrator");
  return { success: result.ok, result };
}
