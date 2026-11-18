import { createAdminClient } from "@/lib/supabase/admin";
import { mergeJsonStore } from "@/lib/madrasa-store";
import { getStructuredMadrasaSetting } from "@/lib/structured-config";
import type { SMSGatewayConfig } from "@/lib/sms-gateway";

export type NotificationChannel = "push" | "whatsapp" | "sms" | "email" | "in_app";

export interface ChannelSendInput {
  madrasaId: string;
  channel: NotificationChannel;
  recipientUserId?: string | null;
  recipientStudentId?: string | null;
  recipientPhone?: string | null;
  recipientEmail?: string | null;
  recipientToken?: string | null;
  recipientTokens?: string[] | null;
  subject?: string | null;
  body: string;
  event?: string;
  metadata?: Record<string, unknown>;
}

export interface ChannelSendResult {
  ok: boolean;
  channel: NotificationChannel;
  provider: string;
  messageId?: string;
  error?: string;
  response?: unknown;
}

/**
 * Normalizes Bangladeshi mobile numbers into international `8801XXXXXXXXX` format
 * for WhatsApp Cloud API and SMS gateways.
 */
export function normalizeBangladeshiPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  // Convert Bangla digits to ASCII digits first
  const banglaDigits = "০১২৩৪৫৬৭৮৯";
  const ascii = String(phone).replace(/[০-৯]/g, (d) => String(banglaDigits.indexOf(d)));
  const digits = ascii.replace(/[^0-9]/g, "");
  if (!digits) return "";
  if (digits.startsWith("8801") && digits.length >= 13) return digits;
  if (digits.startsWith("01") && digits.length === 11) return `88${digits}`;
  if (digits.startsWith("1") && digits.length === 10) return `880${digits}`;
  if (digits.startsWith("88001")) return `880${digits.slice(4)}`;
  return digits;
}

async function resolveDeviceTokens(input: ChannelSendInput): Promise<string[]> {
  if (Array.isArray(input.recipientTokens) && input.recipientTokens.length > 0) {
    const cleaned = input.recipientTokens.map((t) => String(t || "").trim()).filter(Boolean);
    if (cleaned.length > 0) return cleaned;
  }
  if (input.recipientToken && input.recipientToken.trim()) {
    return [input.recipientToken.trim()];
  }
  if (!input.madrasaId || (!input.recipientUserId && !input.recipientStudentId)) {
    return [];
  }

  try {
    const admin = await createAdminClient();
    let query = admin
      .from("notification_device_tokens")
      .select("*")
      .eq("madrasa_id", input.madrasaId)
      .eq("is_active", true);

    if (input.recipientUserId) {
      query = query.eq("user_id", input.recipientUserId);
    } else if (input.recipientStudentId) {
      query = query.eq("student_id", input.recipientStudentId);
    }

    const { data, error } = await query;
    if (!error && Array.isArray(data)) {
      return data
        .map((r: any) => String(r.token || r.device_token || "").trim())
        .filter(Boolean);
    }
  } catch {
    // ignore missing table / lookup failure
  }
  return [];
}

export async function sendPushNotification(input: ChannelSendInput): Promise<ChannelSendResult> {
  const fcmKey = (process.env.FCM_SERVER_KEY || "").trim();
  if (!fcmKey) {
    return {
      ok: false,
      channel: "push",
      provider: "fcm",
      error: "FCM_SERVER_KEY is not configured",
    };
  }

  const tokens = await resolveDeviceTokens(input);
  if (tokens.length === 0) {
    return {
      ok: false,
      channel: "push",
      provider: "fcm",
      error: "No active device token for recipient",
    };
  }

  try {
    const res = await fetch("https://fcm.googleapis.com/fcm/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `key=${fcmKey}`,
      },
      body: JSON.stringify({
        registration_ids: tokens,
        notification: {
          title: input.subject || "কওমি ইআরপি নোটিফিকেশন",
          body: input.body,
        },
        data: {
          event: input.event || "notification",
          ...(input.metadata || {}),
        },
      }),
    });

    const text = await res.text();
    let parsed: any = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      // keep raw text
    }

    if (!res.ok) {
      return {
        ok: false,
        channel: "push",
        provider: "fcm",
        error: `FCM HTTP ${res.status}`,
        response: parsed,
      };
    }

    if (parsed && typeof parsed === "object" && Number(parsed.failure || 0) > 0 && Number(parsed.success || 0) === 0) {
      return {
        ok: false,
        channel: "push",
        provider: "fcm",
        error: "FCM delivery failed for all tokens",
        response: parsed,
      };
    }

    return {
      ok: true,
      channel: "push",
      provider: "fcm",
      messageId: parsed?.results?.[0]?.message_id || parsed?.multicast_id?.toString(),
      response: parsed,
    };
  } catch (err: any) {
    return {
      ok: false,
      channel: "push",
      provider: "fcm",
      error: err?.message || "FCM request failed",
    };
  }
}

export async function sendWhatsAppNotification(input: ChannelSendInput): Promise<ChannelSendResult> {
  const token = (process.env.WHATSAPP_ACCESS_TOKEN || "").trim();
  const phoneNumberId = (process.env.WHATSAPP_PHONE_NUMBER_ID || "").trim();
  const apiVersion = (process.env.WHATSAPP_API_VERSION || "v20.0").trim() || "v20.0";

  if (!token || !phoneNumberId) {
    return {
      ok: false,
      channel: "whatsapp",
      provider: "meta-whatsapp",
      error: "WhatsApp Cloud API credentials are not configured",
    };
  }

  const toPhone = normalizeBangladeshiPhone(input.recipientPhone);
  if (!toPhone || toPhone.length < 11) {
    return {
      ok: false,
      channel: "whatsapp",
      provider: "meta-whatsapp",
      error: "Invalid or missing recipient phone number",
    };
  }

  try {
    const endpoint = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: toPhone,
        type: "text",
        text: {
          preview_url: false,
          body: input.body,
        },
      }),
    });

    const text = await res.text();
    let parsed: any = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      // keep raw text
    }

    if (!res.ok) {
      return {
        ok: false,
        channel: "whatsapp",
        provider: "meta-whatsapp",
        error: parsed?.error?.message || `WhatsApp HTTP ${res.status}`,
        response: parsed,
      };
    }

    return {
      ok: true,
      channel: "whatsapp",
      provider: "meta-whatsapp",
      messageId: parsed?.messages?.[0]?.id,
      response: parsed,
    };
  } catch (err: any) {
    return {
      ok: false,
      channel: "whatsapp",
      provider: "meta-whatsapp",
      error: err?.message || "WhatsApp request failed",
    };
  }
}

async function resolveSmsConfig(madrasaId: string): Promise<{
  apiUrl: string;
  apiKey: string;
  senderId: string;
  httpMethod: "GET" | "POST_JSON" | "POST_FORM";
  apiKeyParamName: string;
  phoneParamName: string;
  messageParamName: string;
  senderIdParamName: string;
} | null> {
  // 1. Check madrasa_settings structured config
  try {
    const setting = await getStructuredMadrasaSetting<Partial<SMSGatewayConfig>>(
      madrasaId,
      "communication",
      "sms_gateway"
    );
    const cfg = setting.found ? setting.value : null;
    if (cfg && cfg.isEnabled !== false && cfg.apiEndpoint && cfg.apiKey) {
      return {
        apiUrl: cfg.apiEndpoint,
        apiKey: cfg.apiKey,
        senderId: cfg.senderId || "",
        httpMethod: cfg.httpMethod || "GET",
        apiKeyParamName: cfg.apiKeyParamName || "api_key",
        phoneParamName: cfg.phoneParamName || "contacts",
        messageParamName: cfg.messageParamName || "msg",
        senderIdParamName: cfg.senderIdParamName || "senderid",
      };
    }
  } catch {
    // fallback to env
  }

  // 2. Fallback to environment variables
  const envUrl = (process.env.SMS_API_URL || "").trim();
  const envKey = (process.env.SMS_API_KEY || "").trim();
  const envSender = (process.env.SMS_SENDER_ID || "").trim();

  if (envUrl && envKey) {
    return {
      apiUrl: envUrl,
      apiKey: envKey,
      senderId: envSender,
      httpMethod: "POST_JSON",
      apiKeyParamName: "api_key",
      phoneParamName: "to",
      messageParamName: "message",
      senderIdParamName: "sender_id",
    };
  }

  return null;
}

export async function sendSmsNotification(input: ChannelSendInput): Promise<ChannelSendResult> {
  const toPhone = normalizeBangladeshiPhone(input.recipientPhone);
  if (!toPhone || toPhone.length < 11) {
    return {
      ok: false,
      channel: "sms",
      provider: "sms-gateway",
      error: "Invalid or missing recipient phone number",
    };
  }

  const config = await resolveSmsConfig(input.madrasaId);
  if (!config) {
    return {
      ok: false,
      channel: "sms",
      provider: "sms-gateway",
      error: "SMS gateway is not configured",
    };
  }

  try {
    let res: Response;
    if (config.httpMethod === "GET") {
      const url = new URL(config.apiUrl);
      url.searchParams.set(config.apiKeyParamName, config.apiKey);
      url.searchParams.set(config.phoneParamName, toPhone);
      url.searchParams.set(config.messageParamName, input.body);
      if (config.senderId) {
        url.searchParams.set(config.senderIdParamName, config.senderId);
      }
      res = await fetch(url.toString(), { method: "GET" });
    } else if (config.httpMethod === "POST_FORM") {
      const form = new URLSearchParams();
      form.set(config.apiKeyParamName, config.apiKey);
      form.set(config.phoneParamName, toPhone);
      form.set(config.messageParamName, input.body);
      if (config.senderId) {
        form.set(config.senderIdParamName, config.senderId);
      }
      res = await fetch(config.apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString(),
      });
    } else {
      res = await fetch(config.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          [config.apiKeyParamName]: config.apiKey,
          [config.phoneParamName]: toPhone,
          [config.messageParamName]: input.body,
          ...(config.senderId ? { [config.senderIdParamName]: config.senderId } : {}),
        }),
      });
    }

    const text = await res.text();
    if (!res.ok) {
      return {
        ok: false,
        channel: "sms",
        provider: "sms-gateway",
        error: `SMS HTTP ${res.status}`,
        response: text,
      };
    }

    return {
      ok: true,
      channel: "sms",
      provider: "sms-gateway",
      response: text,
    };
  } catch (err: any) {
    return {
      ok: false,
      channel: "sms",
      provider: "sms-gateway",
      error: err?.message || "SMS request failed",
    };
  }
}

export async function sendEmailNotification(input: ChannelSendInput): Promise<ChannelSendResult> {
  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  const fromEmail = (process.env.RESEND_FROM_EMAIL || "noreply@qawmierp.com").trim();
  if (!apiKey) {
    return {
      ok: false,
      channel: "email",
      provider: "resend",
      error: "RESEND_API_KEY is not configured",
    };
  }

  const toEmail = (input.recipientEmail || "").trim();
  if (!toEmail || !toEmail.includes("@")) {
    return {
      ok: false,
      channel: "email",
      provider: "resend",
      error: "Invalid or missing recipient email address",
    };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        subject: input.subject || "QawmiERP নোটিফিকেশন",
        text: input.body,
      }),
    });

    const text = await res.text();
    let parsed: any = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      // keep raw
    }

    if (!res.ok) {
      return {
        ok: false,
        channel: "email",
        provider: "resend",
        error: parsed?.message || `Resend HTTP ${res.status}`,
        response: parsed,
      };
    }

    return {
      ok: true,
      channel: "email",
      provider: "resend",
      messageId: parsed?.id,
      response: parsed,
    };
  } catch (err: any) {
    return {
      ok: false,
      channel: "email",
      provider: "resend",
      error: err?.message || "Email request failed",
    };
  }
}

export async function sendInAppNotification(input: ChannelSendInput): Promise<ChannelSendResult> {
  if (!input.madrasaId) {
    return {
      ok: false,
      channel: "in_app",
      provider: "madrasa-store",
      error: "Missing madrasaId for in_app notification",
    };
  }

  try {
    const id = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const record = {
      id,
      event: input.event || "notification",
      recipient_user_id: input.recipientUserId || null,
      recipient_student_id: input.recipientStudentId || null,
      subject: input.subject || "নোটিফিকেশন",
      body: input.body,
      read: false,
      created_at: new Date().toISOString(),
      metadata: input.metadata || {},
    };

    const updated = await mergeJsonStore(input.madrasaId, "meta", (current) => {
      const existing = Array.isArray(current.system_notifications)
        ? current.system_notifications
        : [];
      return {
        ...current,
        system_notifications: [record, ...existing].slice(0, 200),
      };
    });

    if (!updated) {
      return {
        ok: false,
        channel: "in_app",
        provider: "madrasa-store",
        error: "Failed to persist in-app notification",
      };
    }

    return {
      ok: true,
      channel: "in_app",
      provider: "madrasa-store",
      messageId: id,
    };
  } catch (err: any) {
    return {
      ok: false,
      channel: "in_app",
      provider: "madrasa-store",
      error: err?.message || "In-app notification failed",
    };
  }
}

export async function sendViaChannel(input: ChannelSendInput): Promise<ChannelSendResult> {
  switch (input.channel) {
    case "push":
      return sendPushNotification(input);
    case "whatsapp":
      return sendWhatsAppNotification(input);
    case "sms":
      return sendSmsNotification(input);
    case "email":
      return sendEmailNotification(input);
    case "in_app":
      return sendInAppNotification(input);
    default:
      return {
        ok: false,
        channel: input.channel,
        provider: "unknown",
        error: `Unsupported channel: ${String(input.channel)}`,
      };
  }
}
