import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMissingTableError, logAuditEvent } from "@/lib/audit-log";
import { getStructuredMadrasaSetting, saveStructuredMadrasaSetting } from "@/lib/structured-config";

const FALLBACK_ENDPOINTS_KEY = "webhook_endpoints";

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeApi("webhooks");
  if (!auth.ok) return auth.response;
  const { id } = await context.params;

  const newSecret = `whsec_${randomBytes(24).toString("hex")}`;
  const nowIso = new Date().toISOString();

  const admin = await createAdminClient();
  const { data, error } = await admin
    .from("webhook_endpoints")
    .update({ signing_secret: newSecret, updated_at: nowIso })
    .eq("id", id)
    .eq("madrasa_id", auth.ctx.madrasaId)
    .select("id, name")
    .maybeSingle();

  if (!error) {
    if (!data) {
      return NextResponse.json({ error: "এন্ডপয়েন্ট পাওয়া যায়নি।" }, { status: 404 });
    }

    await logAuditEvent({
      madrasaId: auth.ctx.madrasaId,
      actorId: auth.ctx.userId,
      module: "webhooks",
      action: "WEBHOOK_SECRET_ROTATED",
      entityType: "webhook_endpoints",
      entityId: id,
      entityLabel: data.name || id,
      summary: `ওয়েবহুক এন্ডপয়েন্ট '${data.name || id}' এর সাইনিং সিক্রেট পরিবর্তন করা হয়েছে`,
      severity: "WARNING",
    });

    return NextResponse.json({
      rotated: true,
      id,
      signing_secret: newSecret,
    });
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
    list[idx] = { ...list[idx], signing_secret: newSecret, updated_at: nowIso };
    await saveStructuredMadrasaSetting(auth.ctx.madrasaId, "webhooks", FALLBACK_ENDPOINTS_KEY, list);
    await logAuditEvent({
      madrasaId: auth.ctx.madrasaId,
      actorId: auth.ctx.userId,
      module: "webhooks",
      action: "WEBHOOK_SECRET_ROTATED",
      entityType: "webhook_endpoints",
      entityId: id,
      summary: `ওয়েবহুক এন্ডপয়েন্ট '${id}' এর সাইনিং সিক্রেট পরিবর্তন করা হয়েছে`,
      severity: "WARNING",
    });
    return NextResponse.json({ rotated: true, id, signing_secret: newSecret });
  }

  return NextResponse.json({ error: error.message }, { status: 500 });
}
