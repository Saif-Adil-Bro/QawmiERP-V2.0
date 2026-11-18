"use server";

import { cookies, headers } from "next/headers";
import QRCode from "qrcode";
import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { loadServerPermissions } from "@/lib/permissions-server";
import { writeGuard } from "@/lib/action-authorization";
import {
  SESSION_COOKIE_NAME,
  listUserSessions,
  revokeUserSession,
  revokeOtherSessions,
  revokeAllUserSessions,
  type UserSessionRecord,
} from "@/lib/session-manager";
import {
  DEFAULT_STEP_UP_TTL_SECONDS,
  STEP_UP_COOKIE_NAME,
  beginTotpEnrollment,
  confirmTotpEnrollment,
  createStepUpChallenge,
  disableTotp,
  getTenantMaskingPolicy,
  getTenantStepUpPolicy,
  getUserMfaSettings,
  saveTenantMaskingPolicy,
  saveTenantStepUpPolicy,
  updateMfaPreferences,
  verifyStepUpChallenge,
  type StepUpChannel,
  type TenantMaskingPolicy,
  type TenantStepUpPolicy,
} from "@/lib/step-up-auth";

async function getAuthenticatedSecurityActor() {
  const supabase = await createClient();
  const authUser = await getAuthUser(supabase);
  if (!authUser) {
    return { error: "অননুমোদিত প্রবেশ। অনুগ্রহ করে লগইন করুন।" as const };
  }

  const admin = await createAdminClient();
  const { data: userRow } = await admin
    .from("users")
    .select("madrasa_id, full_name, email, phone, role")
    .eq("id", authUser.id)
    .maybeSingle();

  const madrasaId = String((userRow as any)?.madrasa_id || "");
  if (!madrasaId) {
    return { error: "মাদ্রাসা তথ্য পাওয়া যায়নি।" as const };
  }

  const permCtx = await loadServerPermissions(authUser.id, madrasaId);
  if (!permCtx || permCtx.status === "SUSPENDED" || permCtx.status === "DISABLED") {
    return { error: "আপনার অ্যাকাউন্টটি স্থগিত বা নিষ্ক্রিয় করা হয়েছে।" as const };
  }

  const canManageAllSessions =
    permCtx.roles.includes("super_admin") ||
    permCtx.roles.includes("admin") ||
    permCtx.roles.includes("muhtamim") ||
    permCtx.summary.effectivePermissions.includes("security.sessions.manage");

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
      canManageAllSessions,
      canManageTenantPolicy,
    },
  };
}

export async function getSecurityOverviewAction(scope: "self" | "madrasa" = "self"): Promise<{
  success: boolean;
  error?: string;
  sessions?: UserSessionRecord[];
  storage?: "sql" | "fallback";
  currentSessionId?: string | null;
  canManageAllSessions?: boolean;
  canManageTenantPolicy?: boolean;
  mfa?: {
    totp_enabled: boolean;
    sms_enabled: boolean;
    sms_phone: string | null;
    email_enabled: boolean;
    email_address: string | null;
    preferred_channel: StepUpChannel;
    last_verified_at: string | null;
    recovery_codes_remaining: number;
  };
  stepUpPolicy?: TenantStepUpPolicy;
  maskingPolicy?: TenantMaskingPolicy;
}> {
  const res = await getAuthenticatedSecurityActor();
  if ("error" in res && res.error) return { success: false, error: res.error };
  const { actor } = res;

  const filterUserId = actor.canManageAllSessions && scope === "madrasa" ? undefined : actor.userId;

  const [sessionsRes, mfa, stepUpPolicy, maskingPolicy, cookieStore] = await Promise.all([
    listUserSessions({
      madrasaId: actor.madrasaId,
      userId: filterUserId,
      includeRevoked: false,
      limit: 150,
    }),
    getUserMfaSettings(actor.userId, actor.madrasaId),
    getTenantStepUpPolicy(actor.madrasaId),
    getTenantMaskingPolicy(actor.madrasaId),
    cookies(),
  ]);

  return {
    success: true,
    sessions: sessionsRes.sessions,
    storage: sessionsRes.storage,
    currentSessionId: cookieStore.get(SESSION_COOKIE_NAME)?.value || null,
    canManageAllSessions: actor.canManageAllSessions,
    canManageTenantPolicy: actor.canManageTenantPolicy,
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
  };
}

export async function terminateSessionAction(sessionId: string) {
  const res = await getAuthenticatedSecurityActor();
  if ("error" in res && res.error) return { success: false, error: res.error };
  const { actor } = res;

  if (!actor.canManageAllSessions) {
    const { sessions } = await listUserSessions({
      madrasaId: actor.madrasaId,
      userId: actor.userId,
      includeRevoked: true,
    });
    if (!sessions.some((s) => s.id === sessionId)) {
      return { success: false, error: "এই সেশনটি বাতিল করার অনুমতি আপনার নেই।" };
    }
  }

  return revokeUserSession({
    sessionId,
    madrasaId: actor.madrasaId,
    revokedBy: actor.userId,
    actorName: actor.fullName,
    actorEmail: actor.email,
    actorRole: actor.role,
    reason: "REMOTE_TERMINATED",
  });
}

export async function terminateOtherSessionsAction() {
  const res = await getAuthenticatedSecurityActor();
  if ("error" in res && res.error) return { success: false, count: 0, error: res.error };
  const { actor } = res;

  const cookieStore = await cookies();
  const currentSessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value || null;

  return revokeOtherSessions({
    madrasaId: actor.madrasaId,
    userId: actor.userId,
    currentSessionId,
    revokedBy: actor.userId,
    actorName: actor.fullName,
    actorEmail: actor.email,
    actorRole: actor.role,
  });
}

export async function terminateAllUserSessionsAction(targetUserId: string) {
  const res = await getAuthenticatedSecurityActor();
  if ("error" in res && res.error) return { success: false, count: 0, error: res.error };
  const { actor } = res;

  if (targetUserId !== actor.userId && !actor.canManageAllSessions) {
    return { success: false, count: 0, error: "অন্য ইউজারের সেশন বাতিল করার অনুমতি আপনার নেই।" };
  }

  return revokeAllUserSessions({
    madrasaId: actor.madrasaId,
    targetUserId,
    revokedBy: actor.userId,
    actorName: actor.fullName,
    actorEmail: actor.email,
    actorRole: actor.role,
  });
}

export async function beginTotpSetupAction() {
  const res = await getAuthenticatedSecurityActor();
  if ("error" in res && res.error) return { success: false, error: res.error };
  const { actor } = res;

  const enrollment = await beginTotpEnrollment({
    userId: actor.userId,
    madrasaId: actor.madrasaId,
    accountName: actor.email || actor.fullName,
  });

  return {
    success: true,
    secret: enrollment.secret,
    uri: enrollment.otpauthUri,
    qrDataUrl: enrollment.qrDataUrl,
  };
}

export async function confirmTotpSetupAction(code: string) {
  const res = await getAuthenticatedSecurityActor();
  if ("error" in res && res.error) return { success: false, error: res.error };
  const { actor } = res;

  return confirmTotpEnrollment({
    userId: actor.userId,
    madrasaId: actor.madrasaId,
    code,
  });
}

export async function disableTotpAction() {
  const res = await getAuthenticatedSecurityActor();
  if ("error" in res && res.error) return { success: false, error: res.error };
  const { actor } = res;

  return disableTotp({
    userId: actor.userId,
    madrasaId: actor.madrasaId,
  });
}

export async function updateMfaPreferencesAction(input: {
  smsEnabled?: boolean;
  smsPhone?: string;
  emailEnabled?: boolean;
  emailAddress?: string;
  preferredChannel?: StepUpChannel;
}) {
  const res = await getAuthenticatedSecurityActor();
  if ("error" in res && res.error) return { success: false, error: res.error };
  const { actor } = res;

  const result = await updateMfaPreferences({
    userId: actor.userId,
    madrasaId: actor.madrasaId,
    smsOtpEnabled: input.smsEnabled,
    smsPhone: input.smsPhone,
    emailOtpEnabled: input.emailEnabled,
    emailAddress: input.emailAddress,
    preferredChannel: input.preferredChannel,
  });

  const updated = result.settings;
  return {
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
  };
}

export async function updateTenantSecurityPolicyAction(input: {
  stepUpPolicy?: Partial<TenantStepUpPolicy>;
  maskingPolicy?: Partial<TenantMaskingPolicy>;
}) {
  const actorRes = await getAuthenticatedSecurityActor();
  if ("error" in actorRes && actorRes.error) {
    return { success: false, error: actorRes.error };
  }
  const { actor } = actorRes;
  if (!actor.canManageTenantPolicy) {
    return {
      success: false,
      error: "প্রতিষ্ঠানের নিরাপত্তা নীতিমালা পরিবর্তনের অনুমতি কেবল প্রশাসনের রয়েছে।",
    };
  }

  const guard = await writeGuard("security");
  if (!guard.allowed) {
    return {
      success: false,
      error: (guard.fallback as { error?: string } | undefined)?.error || "অনুমতি নেই।",
    };
  }
  if (!guard.madrasaId) {
    return { success: false, error: "মাদ্রাসা তথ্য পাওয়া যায়নি।" };
  }

  const [stepUpPolicy, maskingPolicy] = await Promise.all([
    input.stepUpPolicy
      ? saveTenantStepUpPolicy(guard.madrasaId, input.stepUpPolicy)
      : getTenantStepUpPolicy(guard.madrasaId),
    input.maskingPolicy
      ? saveTenantMaskingPolicy(guard.madrasaId, input.maskingPolicy)
      : getTenantMaskingPolicy(guard.madrasaId),
  ]);

  await guard.logAudit({
    module: "security",
    action: "ROLE_UPDATED",
    entityType: "security_policy",
    summary: "প্রতিষ্ঠানের Step-Up 2FA ও PII মাস্কিং নিরাপত্তা নীতিমালা আপডেট করা হয়েছে।",
    metadata: { stepUpPolicy, maskingPolicy },
    severity: "WARNING",
  });

  return { success: true, stepUpPolicy, maskingPolicy };
}

export async function createStepUpChallengeAction(channel: StepUpChannel, actionScope = "CRITICAL") {
  const res = await getAuthenticatedSecurityActor();
  if ("error" in res && res.error) return { success: false, channel, error: res.error };
  const { actor } = res;

  let ipAddress: string | null = null;
  let userAgent: string | null = null;
  try {
    const hdrs = await headers();
    ipAddress = hdrs.get("x-forwarded-for")?.split(",")[0].trim() || hdrs.get("x-real-ip");
    userAgent = hdrs.get("user-agent");
  } catch {
    // ignore
  }

  return createStepUpChallenge({
    userId: actor.userId,
    madrasaId: actor.madrasaId,
    channel,
    actionScope,
    ipAddress,
    userAgent,
  });
}

export async function verifyStepUpChallengeAction(input: {
  channel: StepUpChannel;
  code: string;
  challengeId?: string;
  actionScope?: string;
}) {
  const res = await getAuthenticatedSecurityActor();
  if ("error" in res && res.error) return { success: false, error: res.error };
  const { actor } = res;

  let ipAddress: string | null = null;
  let userAgent: string | null = null;
  try {
    const hdrs = await headers();
    ipAddress = hdrs.get("x-forwarded-for")?.split(",")[0].trim() || hdrs.get("x-real-ip");
    userAgent = hdrs.get("user-agent");
  } catch {
    // ignore
  }

  const verified = await verifyStepUpChallenge({
    userId: actor.userId,
    madrasaId: actor.madrasaId,
    channel: input.channel,
    code: input.code,
    challengeId: input.challengeId,
    actionScope: input.actionScope || "CRITICAL",
    actorName: actor.fullName,
    actorEmail: actor.email,
    actorRole: actor.role,
    ipAddress,
    userAgent,
  });

  if (verified.success && verified.token) {
    try {
      const cookieStore = await cookies();
      cookieStore.set(STEP_UP_COOKIE_NAME, verified.token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: DEFAULT_STEP_UP_TTL_SECONDS,
      });
    } catch {
      // ignore if cookie mutation not supported in current context
    }
  }

  return verified;
}
