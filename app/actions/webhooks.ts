"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeGuard } from "@/lib/action-authorization";
import { isMissingTableError } from "@/lib/audit-log";
import { getStructuredMadrasaSetting, saveStructuredMadrasaSetting } from "@/lib/structured-config";
import { validateWebhookUrl } from "@/lib/webhooks/signer";
import { sendWebhookTestPing, retryPendingWebhookDeliveries } from "@/lib/webhooks/dispatcher";

const FALLBACK_ENDPOINTS_KEY = "webhook_endpoints";
const FALLBACK_DELIVERIES_KEY = "webhook_deliveries";

function maskSecret(secret: string): string {
  if (!secret) return "";
  if (secret.length <= 8) return "****";
  return `${secret.slice(0, 6)}...${secret.slice(-4)}`;
}

export async function getWebhookEndpointsAction() {
  const authz = await writeGuard("webhooks");
  if (!authz.allowed) return { error: authz.error || "অনুমতি নেই", endpoints: [] };
  if (!authz.madrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি", endpoints: [] };

  const admin = await createAdminClient();
  const { data, error } = await admin
    .from("webhook_endpoints")
    .select("*")
    .eq("madrasa_id", authz.madrasaId)
    .order("created_at", { ascending: false });

  if (!error) {
    return {
      endpoints: (data || []).map((ep: any) => ({
        ...ep,
        signing_secret_masked: maskSecret(String(ep.signing_secret || "")),
        signing_secret: undefined,
      })),
    };
  }

  if (isMissingTableError(error)) {
    const fb = await getStructuredMadrasaSetting<any[]>(
      authz.madrasaId,
      "webhooks",
      FALLBACK_ENDPOINTS_KEY
    );
    return {
      endpoints: (Array.isArray(fb.value) ? fb.value : []).map((ep: any) => ({
        ...ep,
        signing_secret_masked: maskSecret(String(ep.signing_secret || "")),
        signing_secret: undefined,
      })),
    };
  }

  return { error: error.message, endpoints: [] };
}

export async function createWebhookEndpointAction(input: {
  name: string;
  url: string;
  subscribed_events: string[];
  description?: string;
  max_retries?: number;
}) {
  const authz = await writeGuard("webhooks");
  if (!authz.allowed) return { error: authz.error || "অনুমতি নেই" };
  if (!authz.madrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি" };

  const allowHttpInDev = process.env.NODE_ENV !== "production";
  const check = validateWebhookUrl(input.url, { allowHttpInDev });
  if (!check.valid) {
    return { error: check.reason || "অবৈধ Webhook URL" };
  }

  const signingSecret = `whsec_${randomBytes(24).toString("hex")}`;
  const nowIso = new Date().toISOString();
  const record = {
    madrasa_id: authz.madrasaId,
    name: String(input.name || "External Webhook").trim(),
    url: String(input.url).trim(),
    signing_secret: signingSecret,
    subscribed_events: Array.isArray(input.subscribed_events) ? input.subscribed_events : ["*"],
    is_active: true,
    max_retries: Math.max(1, Math.min(10, Number(input.max_retries ?? 5))),
    description: input.description || null,
    created_by: authz.userId || null,
    created_at: nowIso,
    updated_at: nowIso,
  };

  const admin = await createAdminClient();
  const { data, error } = await admin
    .from("webhook_endpoints")
    .insert(record)
    .select("*")
    .maybeSingle();

  if (!error) {
    await authz.logAudit({
      module: "webhooks",
      action: "WEBHOOK_ENDPOINT_CREATED",
      entityType: "webhook_endpoints",
      entityId: data?.id || null,
      entityLabel: record.name,
      summary: `নতুন ওয়েবহুক এন্ডপয়েন্ট '${record.name}' যুক্ত করা হয়েছে`,
    });
    revalidatePath("/dashboard/settings/webhooks");
    return { success: true, endpoint: data, signingSecret };
  }

  if (isMissingTableError(error)) {
    const fb = await getStructuredMadrasaSetting<any[]>(
      authz.madrasaId,
      "webhooks",
      FALLBACK_ENDPOINTS_KEY
    );
    const list = Array.isArray(fb.value) ? fb.value : [];
    const saved = { id: `wh_${Date.now()}`, ...record };
    list.unshift(saved);
    await saveStructuredMadrasaSetting(
      authz.madrasaId,
      "webhooks",
      FALLBACK_ENDPOINTS_KEY,
      list,
      authz.userId
    );
    revalidatePath("/dashboard/settings/webhooks");
    return { success: true, endpoint: saved, signingSecret };
  }

  return { error: error.message };
}

export async function toggleWebhookEndpointAction(id: string, isActive: boolean) {
  const authz = await writeGuard("webhooks");
  if (!authz.allowed) return { error: authz.error || "অনুমতি নেই" };
  if (!authz.madrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি" };

  const admin = await createAdminClient();
  const { error } = await admin
    .from("webhook_endpoints")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("madrasa_id", authz.madrasaId);

  if (!error) {
    revalidatePath("/dashboard/settings/webhooks");
    return { success: true };
  }

  if (isMissingTableError(error)) {
    const fb = await getStructuredMadrasaSetting<any[]>(
      authz.madrasaId,
      "webhooks",
      FALLBACK_ENDPOINTS_KEY
    );
    const list = (Array.isArray(fb.value) ? fb.value : []).map((e) =>
      e.id === id ? { ...e, is_active: isActive } : e
    );
    await saveStructuredMadrasaSetting(authz.madrasaId, "webhooks", FALLBACK_ENDPOINTS_KEY, list);
    revalidatePath("/dashboard/settings/webhooks");
    return { success: true };
  }

  return { error: error.message };
}

export async function rotateWebhookSecretAction(id: string) {
  const authz = await writeGuard("webhooks");
  if (!authz.allowed) return { error: authz.error || "অনুমতি নেই" };
  if (!authz.madrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি" };

  const newSecret = `whsec_${randomBytes(24).toString("hex")}`;
  const admin = await createAdminClient();
  const { data, error } = await admin
    .from("webhook_endpoints")
    .update({ signing_secret: newSecret, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("madrasa_id", authz.madrasaId)
    .select("id, name")
    .maybeSingle();

  if (!error && !data) {
    return { error: "এন্ডপয়েন্ট পাওয়া যায়নি।" };
  }

  if (!error) {
    await authz.logAudit({
      module: "webhooks",
      action: "WEBHOOK_SECRET_ROTATED",
      entityType: "webhook_endpoints",
      entityId: id,
      entityLabel: data?.name || id,
      summary: `ওয়েবহুক এন্ডপয়েন্ট '${data?.name || id}' এর সাইনিং সিক্রেট রোটেশন করা হয়েছে`,
      severity: "WARNING",
    });
    revalidatePath("/dashboard/settings/webhooks");
    return { success: true, signingSecret: newSecret };
  }

  return { error: error.message };
}

export async function deleteWebhookEndpointAction(id: string) {
  const authz = await writeGuard("webhooks");
  if (!authz.allowed) return { error: authz.error || "অনুমতি নেই" };
  if (!authz.madrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি" };

  const admin = await createAdminClient();
  const { error } = await admin
    .from("webhook_endpoints")
    .delete()
    .eq("id", id)
    .eq("madrasa_id", authz.madrasaId);

  if (!error) {
    revalidatePath("/dashboard/settings/webhooks");
    return { success: true };
  }

  if (isMissingTableError(error)) {
    const fb = await getStructuredMadrasaSetting<any[]>(
      authz.madrasaId,
      "webhooks",
      FALLBACK_ENDPOINTS_KEY
    );
    const list = (Array.isArray(fb.value) ? fb.value : []).filter((e) => e.id !== id);
    await saveStructuredMadrasaSetting(authz.madrasaId, "webhooks", FALLBACK_ENDPOINTS_KEY, list);
    revalidatePath("/dashboard/settings/webhooks");
    return { success: true };
  }

  return { error: error.message };
}

export async function testWebhookEndpointAction(id: string) {
  const authz = await writeGuard("webhooks");
  if (!authz.allowed) return { ok: false, responseStatus: null, error: authz.error || "অনুমতি নেই" };
  if (!authz.madrasaId) return { ok: false, responseStatus: null, error: "মাদ্রাসা পাওয়া যায়নি" };
  const res = await sendWebhookTestPing(authz.madrasaId, id);
  revalidatePath("/dashboard/settings/webhooks");
  return res;
}

export async function getWebhookDeliveriesAction(limit = 50) {
  const authz = await writeGuard("webhooks");
  if (!authz.allowed) return { error: authz.error || "অনুমতি নেই", deliveries: [] };
  if (!authz.madrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি", deliveries: [] };

  const admin = await createAdminClient();
  const { data, error } = await admin
    .from("webhook_deliveries")
    .select("*")
    .eq("madrasa_id", authz.madrasaId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!error) {
    return { deliveries: data || [] };
  }

  if (isMissingTableError(error)) {
    const fb = await getStructuredMadrasaSetting<any[]>(
      authz.madrasaId,
      "webhooks",
      FALLBACK_DELIVERIES_KEY
    );
    return { deliveries: (Array.isArray(fb.value) ? fb.value : []).slice(0, limit) };
  }

  return { error: error.message, deliveries: [] };
}

export async function retryWebhookDeliveriesAction() {
  const authz = await writeGuard("webhooks");
  if (!authz.allowed) return { error: authz.error || "অনুমতি নেই" };
  if (!authz.madrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি" };
  const summary = await retryPendingWebhookDeliveries(50, authz.madrasaId);
  revalidatePath("/dashboard/settings/webhooks");
  return { success: true, summary };
}
