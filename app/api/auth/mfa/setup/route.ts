import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { loadServerPermissions } from "@/lib/permissions-server";
import {
  beginTotpEnrollment,
  confirmTotpEnrollment,
  disableTotp,
  getTenantMaskingPolicy,
  getTenantStepUpPolicy,
  getUserMfaSettings,
  saveTenantMaskingPolicy,
  saveTenantStepUpPolicy,
  updateMfaPreferences,
} from "@/lib/step-up-auth";

async function resolveMfaActor() {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);
  if (!authUser) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const admin = await createAdminClient();
  const { data: userRow } = await admin
    .from("users")
    .select("madrasa_id, full_name, email, phone, role")
    .eq("id", authUser.id)
    .maybeSingle();

  const madrasaId = String((userRow as any)?.madrasa_id || "");
  if (!madrasaId) {
    return { error: NextResponse.json({ error: "No madrasa linked" }, { status: 403 }) };
  }

  const permCtx = await loadServerPermissions(authUser.id, madrasaId);
  if (!permCtx || permCtx.status === "SUSPENDED" || permCtx.status === "DISABLED") {
    return { error: NextResponse.json({ error: "Account disabled" }, { status: 403 }) };
  }

  const canManageTenantPolicy =
    permCtx.roles.some((r) =>
      ["super_admin", "admin", "madrasa_admin", "muhtamim", "principal"].includes(r)
    ) ||
    permCtx.summary.effectivePermissions.includes("security.sessions.manage");

  return {
    actor: {
      userId: authUser.id,
      madrasaId,
      fullName: (userRow as any)?.full_name || authUser.email || "User",
      email: (userRow as any)?.email || authUser.email || "",
      phone: (userRow as any)?.phone || "",
      role: permCtx.role,
      canManageTenantPolicy,
    },
  };
}

export async function GET() {
  const resolved = await resolveMfaActor();
  if ("error" in resolved && resolved.error) return resolved.error;
  const { actor } = resolved;

  const [mfa, stepUpPolicy, maskingPolicy] = await Promise.all([
    getUserMfaSettings(actor.userId, actor.madrasaId),
    getTenantStepUpPolicy(actor.madrasaId),
    getTenantMaskingPolicy(actor.madrasaId),
  ]);

  return NextResponse.json({
    mfa: {
      totp_enabled: mfa.totp_enabled,
      sms_enabled: mfa.sms_otp_enabled,
      sms_phone: mfa.sms_phone || actor.phone || null,
      email_enabled: mfa.email_otp_enabled,
      email_address: mfa.email_address || actor.email || null,
      preferred_channel: mfa.preferred_channel,
      last_verified_at: mfa.last_verified_at || null,
      recovery_codes_remaining: Array.isArray(mfa.recovery_codes_hashes)
        ? mfa.recovery_codes_hashes.length
        : 0,
    },
    stepUpPolicy,
    maskingPolicy,
    canManageTenantPolicy: actor.canManageTenantPolicy,
  });
}

export async function POST(req: NextRequest) {
  const resolved = await resolveMfaActor();
  if ("error" in resolved && resolved.error) return resolved.error;
  const { actor } = resolved;

  let body: Record<string, any> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const action = String(body.action || "");

  if (action === "begin_totp") {
    const enrollment = await beginTotpEnrollment({
      userId: actor.userId,
      madrasaId: actor.madrasaId,
      accountName: actor.email || actor.fullName,
    });
    return NextResponse.json({
      success: true,
      secret: enrollment.secret,
      uri: enrollment.otpauthUri,
      qrDataUrl: enrollment.qrDataUrl,
    });
  }

  if (action === "confirm_totp") {
    const res = await confirmTotpEnrollment({
      userId: actor.userId,
      madrasaId: actor.madrasaId,
      code: String(body.code || ""),
    });
    return NextResponse.json(res, { status: res.success ? 200 : 400 });
  }

  if (action === "disable_totp") {
    const res = await disableTotp({
      userId: actor.userId,
      madrasaId: actor.madrasaId,
    });
    return NextResponse.json(res, { status: res.success ? 200 : 400 });
  }

  if (action === "update_preferences") {
    const result = await updateMfaPreferences({
      userId: actor.userId,
      madrasaId: actor.madrasaId,
      smsOtpEnabled: typeof body.smsEnabled === "boolean" ? body.smsEnabled : undefined,
      smsPhone: typeof body.smsPhone === "string" ? body.smsPhone : undefined,
      emailOtpEnabled: typeof body.emailEnabled === "boolean" ? body.emailEnabled : undefined,
      emailAddress: typeof body.emailAddress === "string" ? body.emailAddress : undefined,
      preferredChannel: body.preferredChannel,
    });
    const updated = result.settings;
    return NextResponse.json({
      success: result.success,
      mfa: updated
        ? {
            totp_enabled: updated.totp_enabled,
            sms_enabled: updated.sms_otp_enabled,
            sms_phone: updated.sms_phone || null,
            email_enabled: updated.email_otp_enabled,
            email_address: updated.email_address || null,
            preferred_channel: updated.preferred_channel,
          }
        : undefined,
    });
  }

  if (action === "update_tenant_policy") {
    if (!actor.canManageTenantPolicy) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const [stepUpPolicy, maskingPolicy] = await Promise.all([
      body.stepUpPolicy
        ? saveTenantStepUpPolicy(actor.madrasaId, body.stepUpPolicy)
        : getTenantStepUpPolicy(actor.madrasaId),
      body.maskingPolicy
        ? saveTenantMaskingPolicy(actor.madrasaId, body.maskingPolicy)
        : getTenantMaskingPolicy(actor.madrasaId),
    ]);
    return NextResponse.json({ success: true, stepUpPolicy, maskingPolicy });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
