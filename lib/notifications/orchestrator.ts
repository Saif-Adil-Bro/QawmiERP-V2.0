import { createAdminClient } from "@/lib/supabase/admin";
import { isMissingTableError, logAuditEvent } from "@/lib/audit-log";
import { getStructuredMadrasaSetting, saveStructuredMadrasaSetting } from "@/lib/structured-config";
import { renderNotificationTemplate } from "@/lib/notifications/template-renderer";
import {
  sendViaChannel,
  type ChannelSendResult,
  type NotificationChannel,
} from "@/lib/notifications/channels";

export interface NotificationDispatchPayload {
  madrasaId: string;
  templateId?: string | null;
  templateKey?: string | null;
  recipientUserId?: string | null;
  recipientStudentId?: string | null;
  recipientPhone?: string | null;
  recipientEmail?: string | null;
  recipientToken?: string | null;
  token?: string | null;
  deviceTokens?: string[] | null;
  subject?: string | null;
  body?: string | null;
  message?: string | null;
  text?: string | null;
  variables?: Record<string, string | number | null | undefined>;
  channels?: NotificationChannel[];
  fallbackChannels?: NotificationChannel[];
  /** Deliver inline without persisting sensitive message bodies, destinations or provider responses. No queue/retries. */
  confidential?: boolean;
  maxAttempts?: number;
  actorId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface NotificationDispatchResult {
  ok: boolean;
  status: "SENT" | "RETRYING" | "FAILED";
  deliveredChannel?: NotificationChannel;
  attemptedChannels: ChannelSendResult[];
  queueId?: string;
  renderedBody: string;
  error?: string;
}

export interface QueueProcessSummary {
  processed: number;
  sent: number;
  retrying: number;
  failed: number;
  source: "sql" | "fallback";
}

const DEFAULT_FALLBACK_CHAIN: NotificationChannel[] = ["push", "whatsapp", "sms", "email", "in_app"];
const FALLBACK_QUEUE_NAMESPACE = "notifications";
const FALLBACK_QUEUE_KEY = "notification_queue";

async function resolveTemplate(
  madrasaId: string,
  event: string,
  payload: NotificationDispatchPayload
): Promise<{ id?: string; subject?: string; body?: string } | null> {
  if (!madrasaId) return null;
  try {
    const admin = await createAdminClient();
    if (payload.templateId) {
      const { data, error } = await admin
        .from("notification_templates")
        .select("id, subject, body, madrasa_id")
        .eq("id", payload.templateId)
        .eq("madrasa_id", madrasaId)
        .maybeSingle();
      if (!error && data) return data;
    }

    if (payload.templateKey) {
      const { data, error } = await admin
        .from("notification_templates")
        .select("id, subject, body")
        .eq("madrasa_id", madrasaId)
        .eq("template_key", payload.templateKey)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      if (!error && data) return data;
    }

    const { data, error } = await admin
      .from("notification_templates")
      .select("id, subject, body")
      .eq("madrasa_id", madrasaId)
      .eq("event_name", event)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    if (!error && data) return data;
  } catch {
    // ignore missing table or query error
  }
  return null;
}

async function persistQueueEntry(entry: Record<string, any>): Promise<string | undefined> {
  try {
    const admin = await createAdminClient();
    const { data, error } = await admin
      .from("notification_queue")
      .insert(entry)
      .select("id")
      .maybeSingle();

    if (!error && data?.id) {
      return String(data.id);
    }

    if (error && !isMissingTableError(error)) {
      console.error("Failed to insert notification_queue:", error);
      return undefined;
    }
  } catch {
    // fall through to fallback
  }

  // Fallback to madrasa_settings when notification_queue table is missing
  const fallbackId = `nq_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const existing = await getStructuredMadrasaSetting<any[]>(
    entry.madrasa_id,
    FALLBACK_QUEUE_NAMESPACE,
    FALLBACK_QUEUE_KEY
  );
  const items = Array.isArray(existing.value) ? existing.value : [];
  await saveStructuredMadrasaSetting(
    entry.madrasa_id,
    FALLBACK_QUEUE_NAMESPACE,
    FALLBACK_QUEUE_KEY,
    [{ id: fallbackId, ...entry, created_at: new Date().toISOString() }, ...items].slice(0, 200)
  );
  return fallbackId;
}

export async function dispatchNotification(
  event: string,
  payload: NotificationDispatchPayload
): Promise<NotificationDispatchResult> {
  const madrasaId = payload.madrasaId;
  const tpl = payload.confidential ? null : await resolveTemplate(madrasaId, event, payload);

  const rawBody = payload.body || payload.message || payload.text || tpl?.body || "";
  const rawSubject = payload.subject || tpl?.subject || "কওমি ইআরপি নোটিফিকেশন";
  const vars = payload.variables || {};

  const renderedBody = payload.confidential ? rawBody : renderNotificationTemplate(rawBody, vars);
  const renderedSubject = renderNotificationTemplate(rawSubject, vars);

  const chain: NotificationChannel[] =
    payload.channels && payload.channels.length > 0
      ? payload.channels
      : payload.fallbackChannels && payload.fallbackChannels.length > 0
        ? payload.fallbackChannels
        : DEFAULT_FALLBACK_CHAIN;

  const attemptedChannels: ChannelSendResult[] = [];
  let deliveredChannel: NotificationChannel | undefined;

  for (const ch of chain) {
    const res = await sendViaChannel({
      madrasaId,
      channel: ch,
      recipientUserId: payload.recipientUserId,
      recipientStudentId: payload.recipientStudentId,
      recipientPhone: payload.recipientPhone,
      recipientEmail: payload.recipientEmail,
      recipientToken: payload.recipientToken || payload.token,
      recipientTokens: payload.deviceTokens,
      subject: renderedSubject,
      body: renderedBody,
      event,
      metadata: payload.metadata,
    });
    attemptedChannels.push(res);
    if (res.ok) {
      deliveredChannel = ch;
      break; // Stop immediately on first successful delivery
    }
  }

  if (payload.confidential) return { ok: !!deliveredChannel, status: deliveredChannel ? "SENT" : "FAILED", deliveredChannel, attemptedChannels, renderedBody };

  const maxAttempts = Math.max(1, payload.maxAttempts ?? 3);
  const lastError =
    attemptedChannels.length > 0
      ? attemptedChannels.map((a) => `${a.channel}: ${a.error || "failed"}`).join("; ")
      : "No channels attempted";

  const status: "SENT" | "RETRYING" | "FAILED" = deliveredChannel
    ? "SENT"
    : maxAttempts > 1
      ? "RETRYING"
      : "FAILED";

  const nowIso = new Date().toISOString();
  const nextRetryAt =
    status === "RETRYING" ? new Date(Date.now() + 5 * 60 * 1000).toISOString() : null;

  const queueId = await persistQueueEntry({
    madrasa_id: madrasaId,
    event_name: event,
    template_id: tpl?.id || payload.templateId || null,
    recipient_user_id: payload.recipientUserId || null,
    recipient_phone: payload.recipientPhone || null,
    recipient_email: payload.recipientEmail || null,
    recipient_token: payload.recipientToken || null,
    channel: deliveredChannel || chain[0] || "sms",
    fallback_channels: chain,
    subject: renderedSubject,
    body: renderedBody,
    payload: {
      variables: vars,
      metadata: payload.metadata || {},
      recipientStudentId: payload.recipientStudentId || null,
    },
    status,
    attempts: 1,
    max_attempts: maxAttempts,
    next_retry_at: nextRetryAt,
    last_error: deliveredChannel ? null : lastError,
    provider_response: attemptedChannels,
    sent_at: deliveredChannel ? nowIso : null,
    updated_at: nowIso,
  });

  // Non-blocking audit log
  logAuditEvent({
    madrasaId,
    actorId: payload.actorId || null,
    module: "notifications",
    action: deliveredChannel ? "NOTIFICATION_DISPATCHED" : "NOTIFICATION_FAILED",
    entityType: "notification_queue",
    entityId: queueId || null,
    summary: deliveredChannel
      ? `ইভেন্ট '${event}' এর নোটিফিকেশন ${deliveredChannel} চ্যানেলে পাঠানো হয়েছে`
      : `ইভেন্ট '${event}' এর নোটিফিকেশন সব চ্যানেলে ব্যর্থ হয়েছে (${status})`,
    metadata: {
      event,
      status,
      deliveredChannel: deliveredChannel || null,
      attemptedChannels: attemptedChannels.map((a) => ({
        channel: a.channel,
        ok: a.ok,
        error: a.error,
      })),
    },
    severity: deliveredChannel ? "INFO" : "WARNING",
  }).catch(() => {});

  return {
    ok: Boolean(deliveredChannel),
    status,
    deliveredChannel,
    attemptedChannels,
    queueId,
    renderedBody,
    error: deliveredChannel ? undefined : lastError,
  };
}

export async function processNotificationQueue(
  limit = 50,
  madrasaIdFilter?: string
): Promise<QueueProcessSummary> {
  const admin = await createAdminClient();
  const nowIso = new Date().toISOString();

  let query = admin
    .from("notification_queue")
    .select("*")
    .in("status", ["PENDING", "RETRYING"])
    .order("created_at", { ascending: true })
    .limit(limit);

  if (madrasaIdFilter) {
    query = query.eq("madrasa_id", madrasaIdFilter);
  }

  const { data: rows, error } = await query;

  if (error) {
    if (!isMissingTableError(error)) {
      console.error("Error reading notification_queue:", error);
    }
    // Fallback mode if table missing and madrasaIdFilter provided
    if (madrasaIdFilter) {
      const fb = await getStructuredMadrasaSetting<any[]>(
        madrasaIdFilter,
        FALLBACK_QUEUE_NAMESPACE,
        FALLBACK_QUEUE_KEY
      );
      const items = Array.isArray(fb.value) ? fb.value : [];
      let processed = 0;
      let sent = 0;
      let retrying = 0;
      let failed = 0;

      const updatedItems = [...items];
      for (let i = 0; i < updatedItems.length && processed < limit; i++) {
        const item = updatedItems[i];
        if (!["PENDING", "RETRYING"].includes(String(item.status))) continue;
        processed++;
        const chain: NotificationChannel[] =
          Array.isArray(item.fallback_channels) && item.fallback_channels.length > 0
            ? item.fallback_channels
            : [item.channel || "sms"];

        let delivered: NotificationChannel | undefined;
        let lastErr = "";
        for (const ch of chain) {
          const res = await sendViaChannel({
            madrasaId: item.madrasa_id,
            channel: ch,
            recipientUserId: item.recipient_user_id,
            recipientPhone: item.recipient_phone,
            recipientEmail: item.recipient_email,
            recipientToken: item.recipient_token,
            subject: item.subject,
            body: item.body,
            event: item.event_name,
          });
          if (res.ok) {
            delivered = ch;
            break;
          }
          lastErr = `${ch}: ${res.error || "failed"}`;
        }

        const nextAttempts = Number(item.attempts || 0) + 1;
        const maxAttempts = Number(item.max_attempts || 3);
        if (delivered) {
          sent++;
          updatedItems[i] = { ...item, status: "SENT", channel: delivered, attempts: nextAttempts, sent_at: nowIso };
        } else if (nextAttempts >= maxAttempts) {
          failed++;
          updatedItems[i] = { ...item, status: "FAILED", attempts: nextAttempts, last_error: lastErr };
        } else {
          retrying++;
          updatedItems[i] = { ...item, status: "RETRYING", attempts: nextAttempts, last_error: lastErr };
        }
      }

      if (processed > 0) {
        await saveStructuredMadrasaSetting(
          madrasaIdFilter,
          FALLBACK_QUEUE_NAMESPACE,
          FALLBACK_QUEUE_KEY,
          updatedItems
        );
      }
      return { processed, sent, retrying, failed, source: "fallback" };
    }

    return { processed: 0, sent: 0, retrying: 0, failed: 0, source: "fallback" };
  }

  let processed = 0;
  let sent = 0;
  let retrying = 0;
  let failed = 0;

  for (const row of rows || []) {
    if (row.next_retry_at && new Date(row.next_retry_at).getTime() > Date.now()) {
      continue;
    }

    processed++;
    const chain: NotificationChannel[] =
      Array.isArray(row.fallback_channels) && row.fallback_channels.length > 0
        ? row.fallback_channels
        : [row.channel || "sms"];

    const attemptsList: ChannelSendResult[] = [];
    let delivered: NotificationChannel | undefined;

    for (const ch of chain) {
      const res = await sendViaChannel({
        madrasaId: row.madrasa_id,
        channel: ch,
        recipientUserId: row.recipient_user_id,
        recipientStudentId: row.payload?.recipientStudentId || null,
        recipientPhone: row.recipient_phone,
        recipientEmail: row.recipient_email,
        recipientToken: row.recipient_token,
        subject: row.subject,
        body: row.body,
        event: row.event_name,
      });
      attemptsList.push(res);
      if (res.ok) {
        delivered = ch;
        break;
      }
    }

    const nextAttempts = Number(row.attempts || 0) + 1;
    const maxAttempts = Number(row.max_attempts || 3);
    const lastError = attemptsList.map((a) => `${a.channel}: ${a.error || "failed"}`).join("; ");

    if (delivered) {
      sent++;
      await admin
        .from("notification_queue")
        .update({
          status: "SENT",
          channel: delivered,
          attempts: nextAttempts,
          last_error: null,
          provider_response: attemptsList,
          sent_at: nowIso,
          updated_at: nowIso,
        })
        .eq("id", row.id)
        .eq("madrasa_id", row.madrasa_id);
    } else if (nextAttempts >= maxAttempts) {
      failed++;
      await admin
        .from("notification_queue")
        .update({
          status: "FAILED",
          attempts: nextAttempts,
          last_error: lastError,
          provider_response: attemptsList,
          updated_at: nowIso,
        })
        .eq("id", row.id)
        .eq("madrasa_id", row.madrasa_id);
    } else {
      retrying++;
      const backoffMs = Math.min(60 * 60 * 1000, Math.pow(2, nextAttempts) * 60 * 1000);
      await admin
        .from("notification_queue")
        .update({
          status: "RETRYING",
          attempts: nextAttempts,
          next_retry_at: new Date(Date.now() + backoffMs).toISOString(),
          last_error: lastError,
          provider_response: attemptsList,
          updated_at: nowIso,
        })
        .eq("id", row.id)
        .eq("madrasa_id", row.madrasa_id);
    }
  }

  return { processed, sent, retrying, failed, source: "sql" };
}
