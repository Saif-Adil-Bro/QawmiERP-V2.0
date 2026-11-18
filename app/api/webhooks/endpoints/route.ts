import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMissingTableError, logAuditEvent } from "@/lib/audit-log";
import { getStructuredMadrasaSetting, saveStructuredMadrasaSetting } from "@/lib/structured-config";
import { validateWebhookUrl } from "@/lib/webhooks/signer";

const FALLBACK_ENDPOINTS_KEY = "webhook_endpoints";

function maskSecret(secret: string): string {
  if (!secret) return "";
  if (secret.length <= 8) return "****";
  return `${secret.slice(0, 6)}...${secret.slice(-4)}`;
}

export async function GET() {
  const auth = await authorizeApi("webhooks");
  if (!auth.ok) return auth.response;

  const admin = await createAdminClient();
  const { data, error } = await admin
    .from("webhook_endpoints")
    .select("*")
    .eq("madrasa_id", auth.ctx.madrasaId)
    .order("created_at", { ascending: false });

  if (!error) {
    return NextResponse.json({
      endpoints: (data || []).map((ep: any) => ({
        ...ep,
        signing_secret_masked: maskSecret(String(ep.signing_secret || "")),
        signing_secret: undefined,
      })),
    });
  }

  if (isMissingTableError(error)) {
    const fb = await getStructuredMadrasaSetting<any[]>(
      auth.ctx.madrasaId,
      "webhooks",
      FALLBACK_ENDPOINTS_KEY
    );
    return NextResponse.json({
      endpoints: (Array.isArray(fb.value) ? fb.value : []).map((ep: any) => ({
        ...ep,
        signing_secret_masked: maskSecret(String(ep.signing_secret || "")),
        signing_secret: undefined,
      })),
    });
  }

  return NextResponse.json({ error: error.message }, { status: 500 });
}

export async function POST(req: Request) {
  const auth = await authorizeApi("webhooks");
  if (!auth.ok) return auth.response;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "অবৈধ JSON পেলোড।" }, { status: 400 });
  }

  if (body.madrasaId && String(body.madrasaId) !== auth.ctx.madrasaId) {
    return NextResponse.json(
      { error: "অন্য মাদ্রাসার জন্য ওয়েবহুক তৈরি করার অনুমতি নেই।", code: "FORBIDDEN" },
      { status: 403 }
    );
  }

  const url = String(body.url || "").trim();
  const allowHttpInDev = process.env.NODE_ENV !== "production";
  const urlCheck = validateWebhookUrl(url, { allowHttpInDev });
  if (!urlCheck.valid) {
    return NextResponse.json(
      { error: urlCheck.reason || "অবৈধ Webhook URL।" },
      { status: 400 }
    );
  }

  const name = String(body.name || "External Integration").trim();
  const events = Array.isArray(body.subscribed_events)
    ? body.subscribed_events
    : Array.isArray(body.events)
      ? body.events
      : ["*"];

  const signingSecret = body.signing_secret
    ? String(body.signing_secret)
    : `whsec_${randomBytes(24).toString("hex")}`;

  const nowIso = new Date().toISOString();
  const record = {
    madrasa_id: auth.ctx.madrasaId,
    name,
    url,
    signing_secret: signingSecret,
    subscribed_events: events,
    headers: body.headers && typeof body.headers === "object" ? body.headers : {},
    is_active: body.is_active !== false,
    max_retries: Math.max(1, Math.min(10, Number(body.max_retries ?? 5))),
    timeout_ms: Math.max(2000, Math.min(15000, Number(body.timeout_ms ?? 10000))),
    description: body.description || null,
    created_by: auth.ctx.userId,
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
    logAuditEvent({
      madrasaId: auth.ctx.madrasaId,
      actorId: auth.ctx.userId,
      module: "webhooks",
      action: "WEBHOOK_ENDPOINT_CREATED",
      entityType: "webhook_endpoints",
      entityId: data?.id || null,
      entityLabel: name,
      summary: `নতুন ওয়েবহুক এন্ডপয়েন্ট '${name}' তৈরি করা হয়েছে`,
    }).catch(() => {});

    return NextResponse.json(
      {
        endpoint: data,
        signing_secret: signingSecret,
      },
      { status: 201 }
    );
  }

  if (isMissingTableError(error)) {
    const fb = await getStructuredMadrasaSetting<any[]>(
      auth.ctx.madrasaId,
      "webhooks",
      FALLBACK_ENDPOINTS_KEY
    );
    const list = Array.isArray(fb.value) ? fb.value : [];
    const saved = { id: `wh_${Date.now()}`, ...record };
    list.unshift(saved);
    await saveStructuredMadrasaSetting(
      auth.ctx.madrasaId,
      "webhooks",
      FALLBACK_ENDPOINTS_KEY,
      list,
      auth.ctx.userId
    );
    return NextResponse.json({ endpoint: saved, signing_secret: signingSecret }, { status: 201 });
  }

  return NextResponse.json({ error: error.message }, { status: 500 });
}
