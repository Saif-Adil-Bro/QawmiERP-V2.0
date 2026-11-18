import { randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMissingTableError, logAuditEvent } from "@/lib/audit-log";
import { maskEmailAddress, maskPhoneNumber } from "@/lib/data-access-guards";
import { getStructuredMadrasaSetting, saveStructuredMadrasaSetting } from "@/lib/structured-config";
import { signWebhookPayload, validateWebhookUrl } from "@/lib/webhooks/signer";

export interface WebhookDispatchSummary {
  eventType: string;
  matchedEndpoints: number;
  delivered: number;
  retrying: number;
  failed: number;
  skippedInvalidUrl: number;
}

export interface WebhookRetrySummary {
  processed: number;
  delivered: number;
  retrying: number;
  failed: number;
  source: "sql" | "fallback";
}

const FALLBACK_ENDPOINTS_KEY = "webhook_endpoints";
const FALLBACK_DELIVERIES_KEY = "webhook_deliveries";

const OMIT_PII_KEYS = new Set([
  "nid",
  "national_id",
  "nid_number",
  "birth_reg_no",
  "passport_no",
  "password",
  "password_hash",
  "secret",
  "signing_secret",
]);

const PHONE_KEY_REGEX = /(?:^|_)(phone|mobile|whatsapp|contact_no|parent_phone|guardian_phone|father_phone|mother_phone)$/i;
const EMAIL_KEY_REGEX = /(?:^|_)(email|parent_email|guardian_email)$/i;

/**
 * Recursively strips raw NID/secret fields and masks phone/email fields before
 * sending payloads to external webhook subscribers.
 */
export function sanitizeWebhookData(input: unknown): any {
  if (input === null || input === undefined) return input;
  if (Array.isArray(input)) {
    return input.map((item) => sanitizeWebhookData(item));
  }
  if (typeof input !== "object") return input;

  const out: Record<string, any> = {};
  for (const [key, val] of Object.entries(input as Record<string, any>)) {
    const normalizedKey = key.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
    if (OMIT_PII_KEYS.has(normalizedKey)) {
      continue;
    }
    if (typeof val === "string" && PHONE_KEY_REGEX.test(normalizedKey)) {
      out[key] = maskPhoneNumber(val);
      continue;
    }
    if (typeof val === "string" && EMAIL_KEY_REGEX.test(normalizedKey)) {
      out[key] = maskEmailAddress(val);
      continue;
    }
    if (val && typeof val === "object") {
      out[key] = sanitizeWebhookData(val);
    } else {
      out[key] = val;
    }
  }
  return out;
}

function normalizeEndpoint(raw: any) {
  return {
    id: String(raw.id),
    madrasa_id: String(raw.madrasa_id),
    name: String(raw.name || "Webhook Endpoint"),
    url: String(raw.url || ""),
    signing_secret: String(raw.signing_secret || raw.secret || ""),
    subscribed_events: Array.isArray(raw.subscribed_events)
      ? raw.subscribed_events
      : Array.isArray(raw.events)
        ? raw.events
        : [],
    headers: raw.headers && typeof raw.headers === "object" ? raw.headers : {},
    is_active: raw.is_active !== false,
    max_retries: Number(raw.max_retries ?? raw.max_attempts ?? 5),
    timeout_ms: Number(raw.timeout_ms ?? 10000),
  };
}

function endpointMatchesEvent(subscribedEvents: string[], eventType: string): boolean {
  if (!Array.isArray(subscribedEvents) || subscribedEvents.length === 0) return false;
  if (subscribedEvents.includes("*") || subscribedEvents.includes(eventType)) return true;
  const prefix = eventType.split(".")[0];
  return subscribedEvents.includes(`${prefix}.*`);
}

function computeBackoffMs(attemptCount: number): number {
  // 1m, 2m, 4m, 8m, 16m... capped at 1h
  return Math.min(60 * 60 * 1000, Math.pow(2, Math.max(0, attemptCount - 1)) * 60 * 1000);
}

async function deliverToEndpoint(
  endpoint: ReturnType<typeof normalizeEndpoint>,
  eventType: string,
  envelope: Record<string, unknown>
): Promise<{
  ok: boolean;
  signatureHeader: string;
  responseStatus: number | null;
  responseBody: string | null;
  errorMessage: string | null;
}> {
  const allowHttpInDev = process.env.NODE_ENV !== "production";
  const urlCheck = validateWebhookUrl(endpoint.url, { allowHttpInDev });
  if (!urlCheck.valid) {
    return {
      ok: false,
      signatureHeader: "",
      responseStatus: null,
      responseBody: null,
      errorMessage: urlCheck.reason || "Blocked by SSRF guard",
    };
  }

  const rawBody = JSON.stringify(envelope);
  const timestampSec = Math.floor(Date.now() / 1000);
  const secret = endpoint.signing_secret || randomBytes(16).toString("hex");
  const { header: signatureHeader } = signWebhookPayload(secret, timestampSec, rawBody);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(15000, Math.max(2000, endpoint.timeout_ms)));

    const res = await fetch(endpoint.url, {
      method: "POST",
      redirect: "error",
      headers: {
        ...(endpoint.headers || {}),
        "Content-Type": "application/json",
        "X-Qawmi-Signature": signatureHeader,
        "X-Qawmi-Event": eventType,
      },
      body: rawBody,
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    const text = await res.text().catch(() => "");
    if (!res.ok) {
      return {
        ok: false,
        signatureHeader,
        responseStatus: res.status,
        responseBody: text.slice(0, 1000),
        errorMessage: `Webhook HTTP ${res.status}`,
      };
    }

    return {
      ok: true,
      signatureHeader,
      responseStatus: res.status,
      responseBody: text.slice(0, 1000),
      errorMessage: null,
    };
  } catch (err: any) {
    return {
      ok: false,
      signatureHeader,
      responseStatus: null,
      responseBody: null,
      errorMessage: err?.message || "Webhook fetch error",
    };
  }
}

async function loadActiveEndpoints(madrasaId: string) {
  try {
    const admin = await createAdminClient();
    const { data, error } = await admin
      .from("webhook_endpoints")
      .select("*")
      .eq("madrasa_id", madrasaId)
      .eq("is_active", true);

    if (!error) {
      return { endpoints: (data || []).map(normalizeEndpoint), source: "sql" as const };
    }
    if (!isMissingTableError(error)) {
      console.error("Error loading webhook_endpoints:", error);
      return { endpoints: [], source: "sql" as const };
    }
  } catch {
    // fallback
  }

  const fb = await getStructuredMadrasaSetting<any[]>(
    madrasaId,
    "webhooks",
    FALLBACK_ENDPOINTS_KEY
  );
  const list = (Array.isArray(fb.value) ? fb.value : [])
    .map(normalizeEndpoint)
    .filter((e) => e.is_active);
  return { endpoints: list, source: "fallback" as const };
}

async function saveDeliveryRecord(
  madrasaId: string,
  record: Record<string, any>,
  source: "sql" | "fallback"
) {
  if (source === "sql") {
    try {
      const admin = await createAdminClient();
      const { error } = await admin.from("webhook_deliveries").insert(record);
      if (!error) return;
      if (!isMissingTableError(error)) {
        console.error("Failed to insert webhook_deliveries:", error);
        return;
      }
    } catch {
      // fall through
    }
  }

  const fb = await getStructuredMadrasaSetting<any[]>(
    madrasaId,
    "webhooks",
    FALLBACK_DELIVERIES_KEY
  );
  const list = Array.isArray(fb.value) ? fb.value : [];
  await saveStructuredMadrasaSetting(
    madrasaId,
    "webhooks",
    FALLBACK_DELIVERIES_KEY,
    [{ id: `whd_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, ...record }, ...list].slice(0, 200)
  );
}

export async function dispatchWebhookEvent(
  madrasaId: string,
  eventType: string,
  data: Record<string, unknown>
): Promise<WebhookDispatchSummary> {
  if (!madrasaId || !eventType) {
    return {
      eventType,
      matchedEndpoints: 0,
      delivered: 0,
      retrying: 0,
      failed: 0,
      skippedInvalidUrl: 0,
    };
  }

  const { endpoints, source } = await loadActiveEndpoints(madrasaId);
  const matched = endpoints.filter((ep) => endpointMatchesEvent(ep.subscribed_events, eventType));

  if (matched.length === 0) {
    return {
      eventType,
      matchedEndpoints: 0,
      delivered: 0,
      retrying: 0,
      failed: 0,
      skippedInvalidUrl: 0,
    };
  }

  const sanitizedData = sanitizeWebhookData(data);
  const envelope = {
    event: eventType,
    madrasa_id: madrasaId,
    timestamp: new Date().toISOString(),
    data: sanitizedData,
  };

  let delivered = 0;
  let retrying = 0;
  let failed = 0;
  let skippedInvalidUrl = 0;

  for (const ep of matched) {
    const allowHttpInDev = process.env.NODE_ENV !== "production";
    const urlCheck = validateWebhookUrl(ep.url, { allowHttpInDev });
    const nowIso = new Date().toISOString();

    if (!urlCheck.valid) {
      skippedInvalidUrl++;
      failed++;
      await saveDeliveryRecord(
        madrasaId,
        {
          madrasa_id: madrasaId,
          endpoint_id: ep.id,
          event_type: eventType,
          payload: envelope,
          signature_header: null,
          status: "FAILED",
          attempt_count: 1,
          max_attempts: ep.max_retries,
          error_message: urlCheck.reason || "SSRF URL rejected",
          created_at: nowIso,
          updated_at: nowIso,
        },
        source
      );
      continue;
    }

    const res = await deliverToEndpoint(ep, eventType, envelope);
    const maxAttempts = Math.max(1, ep.max_retries);

    let status: "DELIVERED" | "RETRYING" | "FAILED" = "DELIVERED";
    let nextRetryAt: string | null = null;
    if (res.ok) {
      delivered++;
    } else if (maxAttempts > 1) {
      status = "RETRYING";
      retrying++;
      nextRetryAt = new Date(Date.now() + computeBackoffMs(1)).toISOString();
    } else {
      status = "FAILED";
      failed++;
    }

    await saveDeliveryRecord(
      madrasaId,
      {
        madrasa_id: madrasaId,
        endpoint_id: ep.id,
        event_type: eventType,
        payload: envelope,
        signature_header: res.signatureHeader,
        status,
        attempt_count: 1,
        max_attempts: maxAttempts,
        next_retry_at: nextRetryAt,
        response_status: res.responseStatus,
        response_body: res.responseBody,
        error_message: res.errorMessage,
        delivered_at: res.ok ? nowIso : null,
        created_at: nowIso,
        updated_at: nowIso,
      },
      source
    );
  }

  logAuditEvent({
    madrasaId,
    module: "webhooks",
    action: "WEBHOOK_DISPATCHED",
    entityType: "webhook_deliveries",
    summary: `ওয়েবহুক ইভেন্ট '${eventType}' ডিসপ্যাচ: ${delivered} সফল, ${retrying} রিট্রাই, ${failed} ব্যর্থ`,
    metadata: {
      eventType,
      matchedEndpoints: matched.length,
      delivered,
      retrying,
      failed,
    },
    severity: failed > 0 && delivered === 0 ? "WARNING" : "INFO",
  }).catch(() => {});

  return {
    eventType,
    matchedEndpoints: matched.length,
    delivered,
    retrying,
    failed,
    skippedInvalidUrl,
  };
}

export async function retryPendingWebhookDeliveries(
  limit = 50,
  madrasaIdFilter?: string
): Promise<WebhookRetrySummary> {
  const admin = await createAdminClient();
  const nowIso = new Date().toISOString();

  let query = admin
    .from("webhook_deliveries")
    .select("*")
    .in("status", ["RETRYING", "RETRY", "PENDING"])
    .order("created_at", { ascending: true })
    .limit(limit);

  if (madrasaIdFilter) {
    query = query.eq("madrasa_id", madrasaIdFilter);
  }

  const { data: deliveries, error } = await query;
  if (error) {
    if (!isMissingTableError(error)) {
      console.error("Error fetching webhook_deliveries:", error);
      return { processed: 0, delivered: 0, retrying: 0, failed: 0, source: "sql" };
    }

    if (madrasaIdFilter) {
      const [fbDel, fbEp] = await Promise.all([
        getStructuredMadrasaSetting<any[]>(madrasaIdFilter, "webhooks", FALLBACK_DELIVERIES_KEY),
        getStructuredMadrasaSetting<any[]>(madrasaIdFilter, "webhooks", FALLBACK_ENDPOINTS_KEY),
      ]);
      const items = Array.isArray(fbDel.value) ? [...fbDel.value] : [];
      const endpointsList = (Array.isArray(fbEp.value) ? fbEp.value : []).map(normalizeEndpoint);
      const epMap = new Map(endpointsList.map((e) => [e.id, e]));

      let processed = 0;
      let delivered = 0;
      let retrying = 0;
      let failed = 0;

      for (let i = 0; i < items.length && processed < limit; i++) {
        const row = items[i];
        if (!["RETRYING", "RETRY", "PENDING"].includes(String(row.status))) continue;
        if (row.next_retry_at && new Date(row.next_retry_at).getTime() > Date.now()) continue;

        processed++;
        const endpoint = epMap.get(String(row.endpoint_id)) || null;
        const nextAttempts = Number(row.attempt_count || 0) + 1;
        const maxAttempts = Number(row.max_attempts ?? endpoint?.max_retries ?? 5);

        if (!endpoint || !endpoint.is_active) {
          failed++;
          items[i] = {
            ...row,
            status: "FAILED",
            attempt_count: nextAttempts,
            error_message: "Endpoint not found or inactive",
            updated_at: nowIso,
          };
          continue;
        }

        const res = await deliverToEndpoint(endpoint, row.event_type, row.payload || {});
        if (res.ok) {
          delivered++;
          items[i] = {
            ...row,
            status: "DELIVERED",
            attempt_count: nextAttempts,
            signature_header: res.signatureHeader,
            response_status: res.responseStatus,
            response_body: res.responseBody,
            error_message: null,
            delivered_at: nowIso,
            updated_at: nowIso,
          };
        } else if (nextAttempts >= maxAttempts) {
          failed++;
          items[i] = {
            ...row,
            status: "FAILED",
            attempt_count: nextAttempts,
            signature_header: res.signatureHeader,
            response_status: res.responseStatus,
            response_body: res.responseBody,
            error_message: res.errorMessage,
            updated_at: nowIso,
          };
        } else {
          retrying++;
          items[i] = {
            ...row,
            status: "RETRYING",
            attempt_count: nextAttempts,
            next_retry_at: new Date(Date.now() + computeBackoffMs(nextAttempts)).toISOString(),
            signature_header: res.signatureHeader,
            response_status: res.responseStatus,
            response_body: res.responseBody,
            error_message: res.errorMessage,
            updated_at: nowIso,
          };
        }
      }

      if (processed > 0) {
        await saveStructuredMadrasaSetting(
          madrasaIdFilter,
          "webhooks",
          FALLBACK_DELIVERIES_KEY,
          items
        );
      }

      return { processed, delivered, retrying, failed, source: "fallback" };
    }

    return { processed: 0, delivered: 0, retrying: 0, failed: 0, source: "fallback" };
  }

  let processed = 0;
  let delivered = 0;
  let retrying = 0;
  let failed = 0;

  // Cache endpoints by id
  const endpointCache = new Map<string, ReturnType<typeof normalizeEndpoint> | null>();

  for (const row of deliveries || []) {
    if (row.next_retry_at && new Date(row.next_retry_at).getTime() > Date.now()) {
      continue;
    }

    let endpoint = endpointCache.get(String(row.endpoint_id));
    if (endpoint === undefined) {
      const { data: epRow } = await admin
        .from("webhook_endpoints")
        .select("*")
        .eq("id", row.endpoint_id)
        .eq("madrasa_id", row.madrasa_id)
        .maybeSingle();
      endpoint = epRow ? normalizeEndpoint(epRow) : null;
      endpointCache.set(String(row.endpoint_id), endpoint);
    }

    processed++;
    const nextAttempts = Number(row.attempt_count || 0) + 1;
    const maxAttempts = Number(row.max_attempts ?? endpoint?.max_retries ?? 5);

    if (!endpoint || !endpoint.is_active) {
      failed++;
      await admin
        .from("webhook_deliveries")
        .update({
          status: "FAILED",
          attempt_count: nextAttempts,
          error_message: "Endpoint not found or inactive",
          updated_at: nowIso,
        })
        .eq("id", row.id)
        .eq("madrasa_id", row.madrasa_id);
      continue;
    }

    const res = await deliverToEndpoint(endpoint, row.event_type, row.payload || {});
    if (res.ok) {
      delivered++;
      await admin
        .from("webhook_deliveries")
        .update({
          status: "DELIVERED",
          attempt_count: nextAttempts,
          signature_header: res.signatureHeader,
          response_status: res.responseStatus,
          response_body: res.responseBody,
          error_message: null,
          delivered_at: nowIso,
          updated_at: nowIso,
        })
        .eq("id", row.id)
        .eq("madrasa_id", row.madrasa_id);
    } else if (nextAttempts >= maxAttempts) {
      failed++;
      await admin
        .from("webhook_deliveries")
        .update({
          status: "FAILED",
          attempt_count: nextAttempts,
          signature_header: res.signatureHeader,
          response_status: res.responseStatus,
          response_body: res.responseBody,
          error_message: res.errorMessage,
          updated_at: nowIso,
        })
        .eq("id", row.id)
        .eq("madrasa_id", row.madrasa_id);
    } else {
      retrying++;
      await admin
        .from("webhook_deliveries")
        .update({
          status: "RETRYING",
          attempt_count: nextAttempts,
          next_retry_at: new Date(Date.now() + computeBackoffMs(nextAttempts)).toISOString(),
          signature_header: res.signatureHeader,
          response_status: res.responseStatus,
          response_body: res.responseBody,
          error_message: res.errorMessage,
          updated_at: nowIso,
        })
        .eq("id", row.id)
        .eq("madrasa_id", row.madrasa_id);
    }
  }

  return { processed, delivered, retrying, failed, source: "sql" };
}

export async function sendWebhookTestPing(madrasaId: string, endpointId: string) {
  const { endpoints, source } = await loadActiveEndpoints(madrasaId);
  const ep = endpoints.find((e) => e.id === endpointId);
  if (!ep) {
    return { ok: false, error: "ওয়েবহুক এন্ডপয়েন্ট পাওয়া যায়নি।" };
  }

  const envelope = {
    event: "webhook.test_ping",
    madrasa_id: madrasaId,
    timestamp: new Date().toISOString(),
    data: {
      message: "QawmiERP Webhook Test Ping",
      endpoint_id: ep.id,
      endpoint_name: ep.name,
    },
  };

  const res = await deliverToEndpoint(ep, "webhook.test_ping", envelope);
  const nowIso = new Date().toISOString();

  await saveDeliveryRecord(
    madrasaId,
    {
      madrasa_id: madrasaId,
      endpoint_id: ep.id,
      event_type: "webhook.test_ping",
      payload: envelope,
      signature_header: res.signatureHeader,
      status: res.ok ? "DELIVERED" : "FAILED",
      attempt_count: 1,
      max_attempts: 1,
      response_status: res.responseStatus,
      response_body: res.responseBody,
      error_message: res.errorMessage,
      delivered_at: res.ok ? nowIso : null,
      created_at: nowIso,
      updated_at: nowIso,
    },
    source
  );

  return {
    ok: res.ok,
    responseStatus: res.responseStatus,
    error: res.errorMessage,
  };
}
