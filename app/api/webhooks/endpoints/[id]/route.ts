import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMissingTableError } from "@/lib/audit-log";
import { getStructuredMadrasaSetting, saveStructuredMadrasaSetting } from "@/lib/structured-config";
import { validateWebhookUrl } from "@/lib/webhooks/signer";

const FALLBACK_ENDPOINTS_KEY = "webhook_endpoints";

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeApi("webhooks");
  if (!auth.ok) return auth.response;
  const { id } = await context.params;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "অবৈধ JSON পেলোড।" }, { status: 400 });
  }

  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  if (typeof body.name === "string") updates.name = body.name.trim();
  if (typeof body.is_active === "boolean") updates.is_active = body.is_active;
  if (typeof body.description === "string") updates.description = body.description;
  if (Array.isArray(body.subscribed_events)) updates.subscribed_events = body.subscribed_events;
  if (Array.isArray(body.events)) updates.subscribed_events = body.events;
  if (typeof body.max_retries === "number") {
    updates.max_retries = Math.max(1, Math.min(10, Math.floor(body.max_retries)));
  }
  if (typeof body.url === "string") {
    const check = validateWebhookUrl(body.url, {
      allowHttpInDev: process.env.NODE_ENV !== "production",
    });
    if (!check.valid) {
      return NextResponse.json({ error: check.reason || "অবৈধ URL" }, { status: 400 });
    }
    updates.url = body.url.trim();
  }

  const admin = await createAdminClient();
  const { data, error } = await admin
    .from("webhook_endpoints")
    .update(updates)
    .eq("id", id)
    .eq("madrasa_id", auth.ctx.madrasaId)
    .select("*")
    .maybeSingle();

  if (!error) {
    if (!data) {
      return NextResponse.json({ error: "এন্ডপয়েন্ট পাওয়া যায়নি।" }, { status: 404 });
    }
    return NextResponse.json({ endpoint: { ...data, signing_secret: undefined } });
  }

  if (isMissingTableError(error)) {
    const fb = await getStructuredMadrasaSetting<any[]>(
      auth.ctx.madrasaId,
      "webhooks",
      FALLBACK_ENDPOINTS_KEY
    );
    const list = Array.isArray(fb.value) ? fb.value : [];
    const idx = list.findIndex((e) => e.id === id);
    if (idx < 0) {
      return NextResponse.json({ error: "এন্ডপয়েন্ট পাওয়া যায়নি।" }, { status: 404 });
    }
    list[idx] = { ...list[idx], ...updates };
    await saveStructuredMadrasaSetting(auth.ctx.madrasaId, "webhooks", FALLBACK_ENDPOINTS_KEY, list);
    return NextResponse.json({ endpoint: { ...list[idx], signing_secret: undefined } });
  }

  return NextResponse.json({ error: error.message }, { status: 500 });
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeApi("webhooks");
  if (!auth.ok) return auth.response;
  const { id } = await context.params;

  const admin = await createAdminClient();
  const { data, error } = await admin
    .from("webhook_endpoints")
    .delete()
    .eq("id", id)
    .eq("madrasa_id", auth.ctx.madrasaId)
    .select("id")
    .maybeSingle();

  if (!error) {
    if (!data) {
      return NextResponse.json({ error: "এন্ডপয়েন্ট পাওয়া যায়নি।" }, { status: 404 });
    }
    return NextResponse.json({ deleted: true, id });
  }

  if (isMissingTableError(error)) {
    const fb = await getStructuredMadrasaSetting<any[]>(
      auth.ctx.madrasaId,
      "webhooks",
      FALLBACK_ENDPOINTS_KEY
    );
    const list = (Array.isArray(fb.value) ? fb.value : []).filter((e) => e.id !== id);
    await saveStructuredMadrasaSetting(auth.ctx.madrasaId, "webhooks", FALLBACK_ENDPOINTS_KEY, list);
    return NextResponse.json({ deleted: true, id });
  }

  return NextResponse.json({ error: error.message }, { status: 500 });
}
