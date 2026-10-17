import { createAdminClient } from "@/lib/supabase/admin";
import { readJsonStore } from "@/lib/madrasa-store";
import {
  DEFAULT_SYSTEM_ROLES,
  calculateEffectivePermissions,
  type EffectivePermissionSummary,
  type RoleDefinition,
  type UserAccountStatus,
  type UserSecurityProfile,
} from "@/lib/permissions";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * সার্ভার-সাইড পারমিশন গার্ড
 * ─────────────────────────────────────────────────────────────────────────────
 * আগে seluruh অ্যাপে authorization শুধু ক্লায়েন্ট কম্পোনেন্টে (`PermissionGuard`) হতো —
 * ফলে server action সরাসরি কল করলে লগইন করা যেকোনো ইউজার (এমনকি অভিভাবক/শিক্ষার্থীও)
 * ফি আদায়, খরচ তৈরি/ডিলিট বা ইউজার ব্যবস্থাপনা চালাতে পারত।
 *
 * এই মডিউল client `getCurrentUserPermissions()`-এর ঠিক একই ইঞ্জিন সার্ভারে চালায়।
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
  context?: ServerPermissionContext;
}

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
    const adminClient = await createAdminClient();

    const { data: userRow } = await adminClient
      .from("users")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    const role = (userRow as any)?.role || "staff";

    const store = await readJsonStore(madrasaId, "security");
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
      roles: profile.roles,
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

/** অ্যাকাউন্ট স্ট্যাটাস যাচাই (SUSPENDED/DISABLED হলে সব বন্ধ)। */
export async function assertActiveAccount(
  userId: string,
  madrasaId: string
): Promise<PermissionResult> {
  const ctx = await loadServerPermissions(userId, madrasaId);
  if (!ctx) return { allowed: false, error: NO_PERMISSION_ERROR };
  if (ctx.status === "SUSPENDED" || ctx.status === "DISABLED") {
    return { allowed: false, error: ACCOUNT_DISABLED_ERROR, context: ctx };
  }
  return { allowed: true, context: ctx };
}

/**
 * প্রয়োজনীয় পারমিশন যাচাই।
 *
 * @param permissions — এগুলোর যেকোনো একটি থাকলেই অনুমতি (OR)
 * @param roles       — এই রোলগুলোর যেকোনো একটি থাকলেও অনুমতি (OR) — বিদ্যমান স্টাফ কার্যক্রম ভেঙে না ফেলতে
 */
export async function requirePermission(opts: {
  userId: string;
  madrasaId: string;
  permissions?: string[];
  roles?: string[];
  /** এই রোলগুলো থাকলে অন্য সব শর্ত পূরণ হলেও অনুমতি **নিষিদ্ধ** (পোর্টাল রোল ব্লক করতে) */
  denyRoles?: string[];
  errorMessage?: string;
}): Promise<PermissionResult> {
  const active = await assertActiveAccount(opts.userId, opts.madrasaId);
  if (!active.allowed) return active;

  const ctx = active.context!;
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
        context: ctx,
      };
    }
  }

  const hasRole =
    wantedRoles.length > 0 && ctx.roles.some((r) => wantedRoles.includes(r));
  const hasPermission =
    wantedPermissions.length > 0 &&
    ctx.summary.effectivePermissions.some((p) => wantedPermissions.includes(p));
  const isSuperAdmin = ctx.roles.includes("super_admin");

  if (isSuperAdmin || hasRole || hasPermission || ctx.role === "super_admin") {
    return { allowed: true, context: ctx };
  }

  return {
    allowed: false,
    error: opts.errorMessage || NO_PERMISSION_ERROR,
    context: ctx,
  };
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
