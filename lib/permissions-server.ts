import { cache } from "react";
import { cookies, headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { readJsonStore } from "@/lib/madrasa-store";
import {
  DEFAULT_SYSTEM_ROLES,
  PERMISSION_MAP,
  calculateEffectivePermissions,
  type EffectivePermissionSummary,
  type PermissionRiskLevel,
  type RoleDefinition,
  type UserAccountStatus,
  type UserSecurityProfile,
} from "@/lib/permissions";
import {
  STEP_UP_COOKIE_NAME,
  STEP_UP_HEADER_NAME,
  getTenantStepUpPolicy,
  verifyStepUpToken,
} from "@/lib/step-up-auth";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * সার্ভার-সাইড পারমিশন গার্ড (with Step-Up 2FA CRITICAL Enforcement)
 * ─────────────────────────────────────────────────────────────────────────────
 * আগে পুরো অ্যাপে authorization শুধু ক্লায়েন্ট কম্পোনেন্টে (`PermissionGuard`) হতো —
 * ফলে server action সরাসরি কল করলে লগইন করা যেকোনো ইউজার (এমনকি অভিভাবক/শিক্ষার্থীও)
 * ফি আদায়, খরচ তৈরি/ডিলিট বা ইউজার ব্যবস্থাপনা চালাতে পারত।
 *
 * এই মডিউল client `getCurrentUserPermissions()`-এর ঠিক একই ইঞ্জিন সার্ভারে চালায়
 * এবং `riskLevel === "CRITICAL"` বা `requireStepUp === true` হলে শর্ট-লিভড
 * Step-Up 2FA ভেরিফিকেশন টোকেন যাচাই করে।
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface ServerPermissionContext {
  userId: string;
  madrasaId: string;
  role: string;
  roles: string[];
  status: UserAccountStatus;
  summary: EffectivePermissionSummary;
  profile: UserSecurityProfile;
  allRoles: RoleDefinition[];
}

export interface PermissionResult {
  allowed: boolean;
  error?: string;
  errorCode?: "UNAUTHENTICATED" | "FORBIDDEN" | "STEP_UP_REQUIRED";
  stepUpRequired?: boolean;
  actionScope?: string;
  context?: ServerPermissionContext;
}

export interface RequirePermissionOptions {
  userId: string;
  madrasaId: string;
  permissions?: string[];
  roles?: string[];
  /** এই রোলগুলো থাকলে অন্য সব শর্ত পূরণ হলেও অনুমতি **নিষিদ্ধ** (পোর্টাল রোল ব্লক করতে) */
  denyRoles?: string[];
  errorMessage?: string;
  /** ঝুঁকির স্তর — "CRITICAL" হলে টেন্যান্ট নীতিমালা অনুযায়ী Step-Up 2FA বাধ্যতামূলক */
  riskLevel?: PermissionRiskLevel;
  /** true হলে যেকোনো রোলের জন্য (এমনকি super_admin) Step-Up 2FA টোকেন বাধ্যতামূলক */
  requireStepUp?: boolean;
  /** সরাসরি পাঠানো শর্ট-লিভড Step-Up টোকেন (না দিলে header/cookie থেকে পড়া হবে) */
  stepUpToken?: string | null;
  /** Step-Up অ্যাকশন স্কোপ (যেমন: "accounting_period.unlock", "student.delete") */
  actionScope?: string;
}

const loadRequestUserRow = cache(async (userId: string) => {
  const adminClient = await createAdminClient();
  const { data } = await adminClient
    .from("users")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  return data;
});

/**
 * Loads the effective permission context for a user on the server.
 * Status SUSPENDED/DISABLED হলে সব পারমিশন খালি হয়ে যায় (calculateEffectivePermissions ইতিমধ্যেই তা করে)।
 */
export async function loadServerPermissions(
  userId: string,
  madrasaId: string
): Promise<ServerPermissionContext | null> {
  if (!userId || !madrasaId) return null;

  try {
    const userRow = await loadRequestUserRow(userId);

    if (!userRow || userRow.madrasa_id !== madrasaId) return null;
    const role = userRow.role || "staff";

    const store = await readJsonStore(madrasaId, "security", true);
    const customRoles: RoleDefinition[] = store.custom_roles || [];
    const allRoles = [...DEFAULT_SYSTEM_ROLES, ...customRoles];

    const override: Partial<UserSecurityProfile> =
      store.user_security_profiles?.[userId] || {};

    const profile: UserSecurityProfile = {
      userId,
      madrasaId,
      fullName: (userRow as any)?.full_name || "",
      email: (userRow as any)?.email || "",
      phone: (userRow as any)?.phone || null,
      primaryRole: override.primaryRole || role,
      roles:
        override.roles && override.roles.length > 0
          ? override.roles
          : [override.primaryRole || role],
      status: (override.status as UserAccountStatus) || "ACTIVE",
      directPermissions: override.directPermissions || [],
      deniedPermissions: override.deniedPermissions || [],
      temporaryPermissions: override.temporaryPermissions || [],
      dataScopeOverrides: override.dataScopeOverrides || {},
      assignedClassIds: override.assignedClassIds || [],
      assignedSubjectIds: override.assignedSubjectIds || [],
      assignedStudentIds: override.assignedStudentIds || [],
      linkedStudentIds: override.linkedStudentIds || [],
      departmentId: override.departmentId,
    };

    const summary = calculateEffectivePermissions(profile, allRoles);

    return {
      userId,
      madrasaId,
      role,
      roles: [...new Set([role,profile.primaryRole,...profile.roles])],
      status: profile.status,
      summary,
      profile,
      allRoles,
    };
  } catch (err) {
    console.error("loadServerPermissions error:", err);
    return null;
  }
}

const ACCOUNT_DISABLED_ERROR =
  "আপনার অ্যাকাউন্টটি স্থগিত বা নিষ্ক্রিয় করা হয়েছে। মাদ্রাসা প্রশাসনের সাথে যোগাযোগ করুন।";
const NO_PERMISSION_ERROR = "আপনার এই কাজটি করার অনুমতি নেই।";
const STEP_UP_REQUIRED_ERROR =
  "এই সংবেদনশীল কাজটি সম্পন্ন করতে ২-ধাপ যাচাইকরণ (Step-Up OTP/2FA) প্রয়োজন।";

/** অ্যাকাউন্ট স্ট্যাটাস যাচাই (SUSPENDED/DISABLED হলে সব বন্ধ)। */
export async function assertActiveAccount(
  userId: string,
  madrasaId: string
): Promise<PermissionResult> {
  const ctx = await loadServerPermissions(userId, madrasaId);
  if (!ctx) return { allowed: false, error: NO_PERMISSION_ERROR, errorCode: "FORBIDDEN" };
  if (ctx.status !== "ACTIVE") {
    return {
      allowed: false,
      error: ACCOUNT_DISABLED_ERROR,
      errorCode: "FORBIDDEN",
      context: ctx,
    };
  }
  return { allowed: true, context: ctx };
}

/**
 * Resolves a Step-Up token from explicit option, request header (`x-step-up-token`),
 * or HTTP-only cookie (`qawmi_step_up_token`). Safe outside Next.js request context.
 */
async function resolveIncomingStepUpToken(explicitToken?: string | null): Promise<string | null> {
  if (explicitToken && typeof explicitToken === "string" && explicitToken.trim()) {
    return explicitToken.trim();
  }

  try {
    const hdrs = await headers();
    const fromHeader = hdrs.get(STEP_UP_HEADER_NAME);
    if (fromHeader && fromHeader.trim()) return fromHeader.trim();
  } catch {
    // Non-request context (e.g. unit test / background worker)
  }

  try {
    const cookieStore = await cookies();
    const fromCookie = cookieStore.get(STEP_UP_COOKIE_NAME)?.value;
    if (fromCookie && fromCookie.trim()) return fromCookie.trim();
  } catch {
    // Non-request context
  }

  return null;
}

/**
 * Determines whether Step-Up 2FA must be enforced for the given permission request.
 * Never breaks broad module OR-arrays that mix non-CRITICAL and CRITICAL permissions:
 * only infers CRITICAL automatically when ALL explicitly requested permissions are CRITICAL.
 */
export function shouldEnforceStepUp(
  opts: Pick<RequirePermissionOptions, "requireStepUp" | "riskLevel" | "permissions">,
  tenantEnforceCritical = true
): boolean {
  if (opts.requireStepUp === true) return true;
  if (opts.riskLevel === "CRITICAL") {
    return tenantEnforceCritical;
  }
  const perms = opts.permissions || [];
  if (
    perms.length > 0 &&
    tenantEnforceCritical &&
    perms.every((p) => PERMISSION_MAP[p]?.riskLevel === "CRITICAL")
  ) {
    return true;
  }
  return false;
}

/**
 * Core RBAC + Step-Up evaluator executed by `requirePermission()`.
 * Exported separately so unit tests can exercise the exact production logic deterministically.
 */
export async function evaluatePermissionAndStepUp(
  ctx: ServerPermissionContext,
  opts: RequirePermissionOptions,
  tenantEnforceCritical = true
): Promise<PermissionResult> {
  if (ctx.status !== "ACTIVE") {
    return {
      allowed: false,
      error: ACCOUNT_DISABLED_ERROR,
      errorCode: "FORBIDDEN",
      context: ctx,
    };
  }

  const wantedPermissions = opts.permissions || [];
  const wantedRoles = opts.roles || [];
  const deniedRoles = opts.denyRoles || [];

  // deny-list আগে: student/parent-এর মতো পোর্টাল রোল ড্যাশবোর্ড write path-এ ঢুকতে পারবে না
  if (deniedRoles.length > 0) {
    const holdingDeniedRole =
      deniedRoles.includes(ctx.role) ||
      ctx.roles.some((r) => deniedRoles.includes(r));
    if (holdingDeniedRole) {
      return {
        allowed: false,
        error: opts.errorMessage || NO_PERMISSION_ERROR,
        errorCode: "FORBIDDEN",
        context: ctx,
      };
    }
  }

  const hasRole =
    wantedRoles.length > 0 && ctx.roles.some((r) => wantedRoles.includes(r));
  const hasPermission =
    wantedPermissions.length > 0 &&
    ctx.summary.effectivePermissions.some((p) => wantedPermissions.includes(p));
  const isSuperAdmin = ctx.roles.includes("super_admin") || ctx.role === "super_admin";
  const hasNoConstraints = wantedRoles.length === 0 && wantedPermissions.length === 0;

  if (!(isSuperAdmin || hasRole || hasPermission || hasNoConstraints)) {
    return {
      allowed: false,
      error: opts.errorMessage || NO_PERMISSION_ERROR,
      errorCode: "FORBIDDEN",
      context: ctx,
    };
  }

  // Step-Up 2FA gate runs AFTER RBAC succeeds (applies even to super_admin!)
  if (shouldEnforceStepUp(opts, tenantEnforceCritical)) {
    const scope = opts.actionScope || "CRITICAL";
    const token = await resolveIncomingStepUpToken(opts.stepUpToken);
    const verified = await verifyStepUpToken({
      token,
      userId: opts.userId,
      madrasaId: opts.madrasaId,
      actionScope: scope,
    });

    if (!verified.valid) {
      return {
        allowed: false,
        stepUpRequired: true,
        errorCode: "STEP_UP_REQUIRED",
        actionScope: scope,
        error: STEP_UP_REQUIRED_ERROR,
        context: ctx,
      };
    }
  }

  return { allowed: true, context: ctx };
}

/**
 * প্রয়োজনীয় পারমিশন এবং (প্রযোজ্য হলে) Step-Up 2FA যাচাই।
 *
 * @param permissions — এগুলোর যেকোনো একটি থাকলেই অনুমতি (OR)
 * @param roles       — এই রোলগুলোর যেকোনো একটি থাকলেও অনুমতি (OR)
 */
export async function requirePermission(
  opts: RequirePermissionOptions
): Promise<PermissionResult> {
  const active = await assertActiveAccount(opts.userId, opts.madrasaId);
  if (!active.allowed || !active.context) return active;

  // Only fetch tenant policy when Step-Up could potentially apply
  let tenantEnforceCritical = true;
  if (
    opts.requireStepUp !== true &&
    (opts.riskLevel === "CRITICAL" ||
      ((opts.permissions || []).length > 0 &&
        (opts.permissions || []).every((p) => PERMISSION_MAP[p]?.riskLevel === "CRITICAL")))
  ) {
    try {
      const policy = await getTenantStepUpPolicy(opts.madrasaId);
      tenantEnforceCritical = policy.enforceCritical !== false;
    } catch {
      tenantEnforceCritical = true;
    }
  }

  return evaluatePermissionAndStepUp(active.context, opts, tenantEnforceCritical);
}

/** ইউজার ম্যানেজমেন্ট/রোল-নিরাপত্তা সংক্রান্ত কাজের জন্য স্ট্যান্ডার্ড প্রতিরক্ষা। */
export const USER_MANAGEMENT_ROLES = ["super_admin", "admin", "muhtamim"];
export const USER_MANAGEMENT_PERMISSIONS = [
  "user.create",
  "user.edit",
  "user.disable",
  "user.reset",
  "role.assign",
  "role.create",
  "role.edit",
];

/** আর্থিক (হিসাব) কাজের জন্য স্ট্যান্ডার্ড প্রতিরক্ষা। */
export const FINANCE_ROLES = [
  "super_admin",
  "admin",
  "muhtamim",
  "naib_muhtamim",
  "accountant",
];
export const FINANCE_CREATE_PERMISSIONS = ["finance.create", "fee.create"];
export const FINANCE_EDIT_PERMISSIONS = ["finance.edit", "fee.edit"];
export const FINANCE_DELETE_PERMISSIONS = ["finance.delete", "fee.edit"];
