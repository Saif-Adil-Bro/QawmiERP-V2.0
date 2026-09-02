"use server";

import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { getAuthMadrasaId } from "./students";
import {
  DEFAULT_SYSTEM_ROLES,
  PERMISSION_CATEGORIES,
  ALL_PERMISSION_IDS,
  RoleDefinition,
  UserSecurityProfile,
  EffectivePermissionSummary,
  calculateEffectivePermissions,
  ApprovalRequest,
  ApprovalRequestType,
  APPROVAL_REQUIRED_PERMISSIONS,
  SecurityAuditLog,
  AuditActionType,
  DataScope,
  UserAccountStatus,
  TemporaryPermission,
} from "@/lib/permissions";

// ─────────────────────────────────────────────────────────────────────────────
// HELPER: Read & Write Madrasa Security Store from Metadata
// ─────────────────────────────────────────────────────────────────────────────

interface MadrasaSecurityStore {
  custom_roles?: RoleDefinition[];
  user_security_profiles?: Record<string, Partial<UserSecurityProfile>>;
  approval_requests?: ApprovalRequest[];
  security_audit_logs?: SecurityAuditLog[];
}

async function getMadrasaSecurityStore(madrasaId: string): Promise<MadrasaSecurityStore> {
  const adminClient = await createAdminClient();
  const { data } = await adminClient
    .from("madrasas")
    .select("registration_no")
    .eq("id", madrasaId)
    .single();

  if (!data?.registration_no) return {};

  try {
    if (data.registration_no.startsWith("{")) {
      const parsed = JSON.parse(data.registration_no);
      return {
        custom_roles: parsed.custom_roles || [],
        user_security_profiles: parsed.user_security_profiles || {},
        approval_requests: parsed.approval_requests || [],
        security_audit_logs: parsed.security_audit_logs || [],
      };
    }
  } catch (err) {
    console.error("Error parsing madrasa security store:", err);
  }
  return {};
}

async function saveMadrasaSecurityStore(
  madrasaId: string,
  updater: (store: MadrasaSecurityStore) => MadrasaSecurityStore
): Promise<boolean> {
  const adminClient = await createAdminClient();
  const { data: existingRow } = await adminClient
    .from("madrasas")
    .select("registration_no")
    .eq("id", madrasaId)
    .single();

  let meta: Record<string, any> = {};
  if (existingRow?.registration_no && existingRow.registration_no.startsWith("{")) {
    try {
      meta = JSON.parse(existingRow.registration_no);
    } catch {
      meta = {};
    }
  }

  const currentStore: MadrasaSecurityStore = {
    custom_roles: meta.custom_roles || [],
    user_security_profiles: meta.user_security_profiles || {},
    approval_requests: meta.approval_requests || [],
    security_audit_logs: meta.security_audit_logs || [],
  };

  const updatedStore = updater(currentStore);

  const newMeta = {
    ...meta,
    custom_roles: updatedStore.custom_roles || [],
    user_security_profiles: updatedStore.user_security_profiles || {},
    approval_requests: (updatedStore.approval_requests || []).slice(0, 150), // keep latest 150
    security_audit_logs: (updatedStore.security_audit_logs || []).slice(0, 250), // keep latest 250
  };

  const { error } = await adminClient
    .from("madrasas")
    .update({ registration_no: JSON.stringify(newMeta) })
    .eq("id", madrasaId);

  if (error) {
    console.error("Error saving madrasa security store:", error);
    return false;
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET CURRENT USER PERMISSIONS & PROFILE
// ─────────────────────────────────────────────────────────────────────────────

export async function getCurrentUserPermissions(): Promise<{
  summary: EffectivePermissionSummary | null;
  profile: UserSecurityProfile | null;
  allRoles: RoleDefinition[];
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const authUser = await getAuthUser(supabase);
    if (!authUser) {
      return { summary: null, profile: null, allRoles: DEFAULT_SYSTEM_ROLES, error: "লগইন করা নেই" };
    }

    const adminClient = await createAdminClient();
    const { data: userRow } = await adminClient
      .from("users")
      .select("*")
      .eq("id", authUser.id)
      .maybeSingle();

    let madrasaId = userRow?.madrasa_id || authUser.user_metadata?.madrasa_id;
    if (!madrasaId) {
      madrasaId = await getAuthMadrasaId(supabase, authUser);
    }

    const store = madrasaId ? await getMadrasaSecurityStore(madrasaId) : {};
    const customRoles = store.custom_roles || [];
    const allRoles = [...DEFAULT_SYSTEM_ROLES, ...customRoles];

    const userOverride = store.user_security_profiles?.[authUser.id] || {};
    const defaultRole = userRow?.role || authUser.user_metadata?.role || "super_admin";

    const profile: UserSecurityProfile = {
      userId: authUser.id,
      madrasaId: madrasaId || "",
      fullName: userRow?.full_name || authUser.user_metadata?.full_name || "ব্যবহারকারী",
      email: userRow?.email || authUser.email || "",
      phone: userRow?.phone || authUser.user_metadata?.phone || null,
      primaryRole: userOverride.primaryRole || defaultRole,
      roles: userOverride.roles && userOverride.roles.length > 0 ? userOverride.roles : [userOverride.primaryRole || defaultRole],
      status: (userOverride.status as UserAccountStatus) || "ACTIVE",
      directPermissions: userOverride.directPermissions || [],
      deniedPermissions: userOverride.deniedPermissions || [],
      temporaryPermissions: userOverride.temporaryPermissions || [],
      dataScopeOverrides: userOverride.dataScopeOverrides || {},
      assignedClassIds: userOverride.assignedClassIds || [],
      assignedSubjectIds: userOverride.assignedSubjectIds || [],
      assignedStudentIds: userOverride.assignedStudentIds || [],
      linkedStudentIds: userOverride.linkedStudentIds || [],
      departmentId: userOverride.departmentId,
    };

    const summary = calculateEffectivePermissions(profile, allRoles);

    return { summary, profile, allRoles };
  } catch (err: any) {
    console.error("getCurrentUserPermissions error:", err);
    return { summary: null, profile: null, allRoles: DEFAULT_SYSTEM_ROLES, error: err.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. GET MADRASA ROLES, PERMISSION CATALOG & AUDIT TRAIL
// ─────────────────────────────────────────────────────────────────────────────

export async function getMadrasaRolesAndPermissions(): Promise<{
  systemRoles: RoleDefinition[];
  customRoles: RoleDefinition[];
  allRoles: RoleDefinition[];
  categories: typeof PERMISSION_CATEGORIES;
  auditLogs: SecurityAuditLog[];
  approvalRequests: ApprovalRequest[];
  userSecurityProfiles: Record<string, Partial<UserSecurityProfile>>;
  error?: string | null;
}> {
  try {
    const supabase = await createClient();
    const authUser = await getAuthUser(supabase);
    if (!authUser) {
      return {
        systemRoles: DEFAULT_SYSTEM_ROLES,
        customRoles: [],
        allRoles: DEFAULT_SYSTEM_ROLES,
        categories: PERMISSION_CATEGORIES,
        auditLogs: [],
        approvalRequests: [],
        userSecurityProfiles: {},
        error: "অননুমোদিত অ্যাক্সেস",
      };
    }

    const madrasaId = await getAuthMadrasaId(supabase, authUser);
    if (!madrasaId) {
      return {
        systemRoles: DEFAULT_SYSTEM_ROLES,
        customRoles: [],
        allRoles: DEFAULT_SYSTEM_ROLES,
        categories: PERMISSION_CATEGORIES,
        auditLogs: [],
        approvalRequests: [],
        userSecurityProfiles: {},
        error: "মাদরাসা আইডি পাওয়া যায়নি",
      };
    }

    const store = await getMadrasaSecurityStore(madrasaId);
    const customRoles = store.custom_roles || [];
    const allRoles = [...DEFAULT_SYSTEM_ROLES, ...customRoles];

    return {
      systemRoles: DEFAULT_SYSTEM_ROLES,
      customRoles,
      allRoles,
      categories: PERMISSION_CATEGORIES,
      auditLogs: store.security_audit_logs || [],
      approvalRequests: store.approval_requests || [],
      userSecurityProfiles: store.user_security_profiles || {},
      error: null,
    };
  } catch (err: any) {
    console.error("getMadrasaRolesAndPermissions error:", err);
    return {
      systemRoles: DEFAULT_SYSTEM_ROLES,
      customRoles: [],
      allRoles: DEFAULT_SYSTEM_ROLES,
      categories: PERMISSION_CATEGORIES,
      auditLogs: [],
      approvalRequests: [],
      userSecurityProfiles: {},
      error: err.message || "তথ্য লোড করতে ত্রুটি হয়েছে",
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. CREATE CUSTOM ROLE
// ─────────────────────────────────────────────────────────────────────────────

export async function createCustomRole(payload: {
  name: string;
  nameEn?: string;
  description: string;
  permissions: string[];
  deniedPermissions?: string[];
  defaultDataScope?: DataScope;
  colorBg?: string;
  colorText?: string;
}) {
  try {
    const supabase = await createClient();
    const authUser = await getAuthUser(supabase);
    if (!authUser) return { error: "অননুমোদিত অ্যাক্সেস" };

    const madrasaId = await getAuthMadrasaId(supabase, authUser);
    if (!madrasaId) return { error: "মাদরাসা আইডি পাওয়া যায়নি" };

    const roleName = payload.name.trim();
    if (!roleName) return { error: "রোলের নাম দেওয়া আবশ্যক।" };

    if (!payload.permissions || payload.permissions.length === 0) {
      return { error: "কমপক্ষে একটি পারমিশন সিলেক্ট করতে হবে।" };
    }

    const roleId = `custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newRole: RoleDefinition = {
      id: roleId,
      name: roleName,
      nameEn: payload.nameEn?.trim() || roleName,
      description: payload.description.trim() || "কাস্টম নির্ধারিত দায়িত্ব ও পারমিশন",
      isSystem: false,
      isCustom: true,
      colorBg: payload.colorBg || "bg-emerald-100",
      colorText: payload.colorText || "text-emerald-800",
      defaultDataScope: payload.defaultDataScope || "ALL",
      permissions: payload.permissions,
      deniedPermissions: payload.deniedPermissions || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const auditEntry: SecurityAuditLog = {
      id: `audit_${Date.now()}`,
      madrasa_id: madrasaId,
      action: "ROLE_CREATED",
      module: "users_roles",
      actor_id: authUser.id,
      actor_name: authUser.user_metadata?.full_name || "অ্যাডমিন",
      actor_role: authUser.user_metadata?.role || "super_admin",
      details: `নতুন কাস্টম রোল তৈরি করা হয়েছে: ${roleName} (${payload.permissions.length} টি পারমিশন সহ)`,
      created_at: new Date().toISOString(),
    };

    const saved = await saveMadrasaSecurityStore(madrasaId, (store) => {
      const existing = store.custom_roles || [];
      return {
        ...store,
        custom_roles: [...existing, newRole],
        security_audit_logs: [auditEntry, ...(store.security_audit_logs || [])],
      };
    });

    if (!saved) {
      return { error: "কাস্টম রোল সেভ করতে সমস্যা হয়েছে।" };
    }

    revalidatePath("/dashboard/users");
    revalidatePath("/dashboard/settings");

    return { success: true, message: `"${roleName}" রোল সফলভাবে তৈরি হয়েছে!`, role: newRole };
  } catch (err: any) {
    console.error("createCustomRole catch:", err);
    return { error: err.message || "কাস্টম রোল তৈরিতে ত্রুটি ঘটেছে" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. UPDATE CUSTOM ROLE
// ─────────────────────────────────────────────────────────────────────────────

export async function updateCustomRole(
  roleId: string,
  payload: {
    name: string;
    nameEn?: string;
    description: string;
    permissions: string[];
    deniedPermissions?: string[];
    defaultDataScope?: DataScope;
    colorBg?: string;
    colorText?: string;
  }
) {
  try {
    const supabase = await createClient();
    const authUser = await getAuthUser(supabase);
    if (!authUser) return { error: "অননুমোদিত অ্যাক্সেস" };

    const madrasaId = await getAuthMadrasaId(supabase, authUser);
    if (!madrasaId) return { error: "মাদরাসা আইডি পাওয়া যায়নি" };

    const roleName = payload.name.trim();
    if (!roleName) return { error: "রোলের নাম দেওয়া আবশ্যক।" };

    const auditEntry: SecurityAuditLog = {
      id: `audit_${Date.now()}`,
      madrasa_id: madrasaId,
      action: "ROLE_UPDATED",
      module: "users_roles",
      actor_id: authUser.id,
      actor_name: authUser.user_metadata?.full_name || "অ্যাডমিন",
      actor_role: authUser.user_metadata?.role || "super_admin",
      details: `রোল আপডেট করা হয়েছে: ${roleName} (পারমিশন সংখ্যা: ${payload.permissions.length})`,
      created_at: new Date().toISOString(),
    };

    const saved = await saveMadrasaSecurityStore(madrasaId, (store) => {
      const existing = store.custom_roles || [];
      const updated = existing.map((r) => {
        if (r.id === roleId) {
          return {
            ...r,
            name: roleName,
            nameEn: payload.nameEn?.trim() || roleName,
            description: payload.description.trim() || r.description,
            permissions: payload.permissions,
            deniedPermissions: payload.deniedPermissions || [],
            defaultDataScope: payload.defaultDataScope || r.defaultDataScope,
            colorBg: payload.colorBg || r.colorBg,
            colorText: payload.colorText || r.colorText,
            updatedAt: new Date().toISOString(),
          };
        }
        return r;
      });

      return {
        ...store,
        custom_roles: updated,
        security_audit_logs: [auditEntry, ...(store.security_audit_logs || [])],
      };
    });

    if (!saved) return { error: "রোল আপডেট ব্যর্থ হয়েছে।" };

    revalidatePath("/dashboard/users");
    revalidatePath("/dashboard/settings");

    return { success: true, message: `"${roleName}" রোল সফলভাবে আপডেট হয়েছে!` };
  } catch (err: any) {
    console.error("updateCustomRole catch:", err);
    return { error: err.message || "রোল আপডেটে ত্রুটি ঘটেছে" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. DELETE CUSTOM ROLE (WITH ASSIGNMENT PROTECTION)
// ─────────────────────────────────────────────────────────────────────────────

export async function deleteCustomRole(roleId: string) {
  try {
    const supabase = await createClient();
    const authUser = await getAuthUser(supabase);
    if (!authUser) return { error: "অননুমোদিত অ্যাক্সেস" };

    const madrasaId = await getAuthMadrasaId(supabase, authUser);
    if (!madrasaId) return { error: "মাদরাসা আইডি পাওয়া যায়নি" };

    // 1. Check if it is a system role
    const isSystemRole = DEFAULT_SYSTEM_ROLES.some((r) => r.id === roleId);
    if (isSystemRole) {
      return { error: "সিস্টেম ডিফল্ট রোল মুছে ফেলা যাবে না।" };
    }

    // 2. Check if any user is currently assigned this role
    const adminClient = await createAdminClient();
    const { data: assignedUsers } = await adminClient
      .from("users")
      .select("id, full_name, role")
      .eq("madrasa_id", madrasaId)
      .eq("role", roleId);

    if (assignedUsers && assignedUsers.length > 0) {
      return {
        error: `এই রোলে ${assignedUsers.length} জন সক্রিয় ইউজার যুক্ত রয়েছেন। রোল মুছে ফেলার আগে অনুগ্রহ করে তাদের অন্য রোলে স্থানান্তর করুন।`,
      };
    }

    const auditEntry: SecurityAuditLog = {
      id: `audit_${Date.now()}`,
      madrasa_id: madrasaId,
      action: "ROLE_DELETED",
      module: "users_roles",
      actor_id: authUser.id,
      actor_name: authUser.user_metadata?.full_name || "অ্যাডমিন",
      actor_role: authUser.user_metadata?.role || "super_admin",
      details: `কাস্টম রোল মুছে ফেলা হয়েছে: ${roleId}`,
      created_at: new Date().toISOString(),
    };

    const saved = await saveMadrasaSecurityStore(madrasaId, (store) => {
      const existing = store.custom_roles || [];
      return {
        ...store,
        custom_roles: existing.filter((r) => r.id !== roleId),
        security_audit_logs: [auditEntry, ...(store.security_audit_logs || [])],
      };
    });

    if (!saved) return { error: "রোল মুছে ফেলতে সমস্যা হয়েছে।" };

    revalidatePath("/dashboard/users");
    revalidatePath("/dashboard/settings");

    return { success: true, message: "কাস্টম রোল সফলভাবে মুছে ফেলা হয়েছে।" };
  } catch (err: any) {
    console.error("deleteCustomRole error:", err);
    return { error: err.message || "রোল মোছায় ত্রুটি ঘটেছে" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. ASSIGN USER SECURITY PROFILE (ROLES, DIRECT PERMS, TEMPORARY & SCOPES)
// ─────────────────────────────────────────────────────────────────────────────

export async function assignUserSecurityProfile(
  targetUserId: string,
  payload: {
    primaryRole: string;
    roles?: string[];
    status?: UserAccountStatus;
    directPermissions?: string[];
    deniedPermissions?: string[];
    temporaryPermissions?: TemporaryPermission[];
    dataScopeOverrides?: Record<string, DataScope>;
    assignedClassIds?: string[];
    assignedSubjectIds?: string[];
    assignedStudentIds?: string[];
    linkedStudentIds?: string[];
    departmentId?: string;
  }
) {
  try {
    const supabase = await createClient();
    const authUser = await getAuthUser(supabase);
    if (!authUser) return { error: "অননুমোদিত অ্যাক্সেস" };

    const madrasaId = await getAuthMadrasaId(supabase, authUser);
    if (!madrasaId) return { error: "মাদরাসা আইডি পাওয়া যায়নি" };

    const adminClient = await createAdminClient();

    // 1. Fetch Target User info
    const { data: targetUser } = await adminClient
      .from("users")
      .select("id, full_name, email, role")
      .eq("id", targetUserId)
      .eq("madrasa_id", madrasaId)
      .single();

    if (!targetUser) return { error: "টার্গেট ইউজার পাওয়া যায়নি।" };

    // 2. Update Primary Role in `users` table for DB consistency & backward compatibility
    if (payload.primaryRole && payload.primaryRole !== targetUser.role) {
      await adminClient
        .from("users")
        .update({ role: payload.primaryRole })
        .eq("id", targetUserId)
        .eq("madrasa_id", madrasaId);
    }

    // 3. Construct user security overrides record
    const userOverride: Partial<UserSecurityProfile> = {
      userId: targetUserId,
      madrasaId,
      fullName: targetUser.full_name,
      email: targetUser.email,
      primaryRole: payload.primaryRole || targetUser.role,
      roles: payload.roles && payload.roles.length > 0 ? payload.roles : [payload.primaryRole || targetUser.role],
      status: payload.status || "ACTIVE",
      directPermissions: payload.directPermissions || [],
      deniedPermissions: payload.deniedPermissions || [],
      temporaryPermissions: payload.temporaryPermissions || [],
      dataScopeOverrides: payload.dataScopeOverrides || {},
      assignedClassIds: payload.assignedClassIds || [],
      assignedSubjectIds: payload.assignedSubjectIds || [],
      assignedStudentIds: payload.assignedStudentIds || [],
      linkedStudentIds: payload.linkedStudentIds || [],
      departmentId: payload.departmentId,
    };

    const auditEntry: SecurityAuditLog = {
      id: `audit_${Date.now()}`,
      madrasa_id: madrasaId,
      action: "ROLE_ASSIGNED",
      module: "users_roles",
      actor_id: authUser.id,
      actor_name: authUser.user_metadata?.full_name || "অ্যাডমিন",
      actor_role: authUser.user_metadata?.role || "super_admin",
      target_user_id: targetUserId,
      target_user_name: targetUser.full_name,
      details: `ইউজার "${targetUser.full_name}" এর রোল ও পারমিশন প্রোফাইল আপডেট করা হয়েছে (মূল রোল: ${payload.primaryRole}, স্ট্যাটাস: ${payload.status || "ACTIVE"})`,
      created_at: new Date().toISOString(),
    };

    const saved = await saveMadrasaSecurityStore(madrasaId, (store) => {
      const existingProfiles = store.user_security_profiles || {};
      return {
        ...store,
        user_security_profiles: {
          ...existingProfiles,
          [targetUserId]: userOverride,
        },
        security_audit_logs: [auditEntry, ...(store.security_audit_logs || [])],
      };
    });

    if (!saved) return { error: "ইউজার পারমিশন সেভ করতে সমস্যা হয়েছে।" };

    revalidatePath("/dashboard/users");
    revalidatePath("/dashboard/settings");

    return {
      success: true,
      message: `"${targetUser.full_name}" এর নিরাপত্তা প্রোফাইল সফলভাবে আপডেট করা হয়েছে!`,
    };
  } catch (err: any) {
    console.error("assignUserSecurityProfile error:", err);
    return { error: err.message || "ইউজার পারমিশন আপডেটে ত্রুটি ঘটেছে" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. APPROVAL WORKFLOW ENGINE (MAKER -> REVIEWER / 2-PERSON APPROVAL)
// ─────────────────────────────────────────────────────────────────────────────

export async function createApprovalRequest(payload: {
  type: ApprovalRequestType;
  title: string;
  description: string;
  target_id: string;
  target_name?: string;
  payloadData: Record<string, any>;
}) {
  try {
    const supabase = await createClient();
    const authUser = await getAuthUser(supabase);
    if (!authUser) return { error: "অননুমোদিত অ্যাক্সেস" };

    const madrasaId = await getAuthMadrasaId(supabase, authUser);
    if (!madrasaId) return { error: "মাদরাসা আইডি পাওয়া যায়নি" };

    const reqId = `appr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newRequest: ApprovalRequest = {
      id: reqId,
      madrasa_id: madrasaId,
      type: payload.type,
      title: payload.title.trim(),
      description: payload.description.trim(),
      target_id: payload.target_id,
      target_name: payload.target_name,
      payload: payload.payloadData,
      requested_by: {
        user_id: authUser.id,
        name: authUser.user_metadata?.full_name || "অফিসার",
        role: authUser.user_metadata?.role || "staff",
      },
      requested_at: new Date().toISOString(),
      status: "PENDING",
    };

    const auditEntry: SecurityAuditLog = {
      id: `audit_${Date.now()}`,
      madrasa_id: madrasaId,
      action: "APPROVAL_REQUESTED",
      module: "approval",
      actor_id: authUser.id,
      actor_name: authUser.user_metadata?.full_name || "অফিসার",
      actor_role: authUser.user_metadata?.role || "staff",
      details: `অনুমোদনের আবেদন পেশ করা হয়েছে: ${payload.title} (${payload.type})`,
      created_at: new Date().toISOString(),
    };

    const saved = await saveMadrasaSecurityStore(madrasaId, (store) => {
      const existing = store.approval_requests || [];
      return {
        ...store,
        approval_requests: [newRequest, ...existing],
        security_audit_logs: [auditEntry, ...(store.security_audit_logs || [])],
      };
    });

    if (!saved) return { error: "অনুমোদন আবেদন জমা দেওয়া সম্ভব হয়নি।" };

    revalidatePath("/dashboard/users");
    return { success: true, message: "অনুমোদনের আবেদন সফলভাবে দাখিল করা হয়েছে!", request: newRequest };
  } catch (err: any) {
    console.error("createApprovalRequest error:", err);
    return { error: err.message || "অনুমোদন আবেদনে ত্রুটি ঘটেছে" };
  }
}

export async function reviewApprovalRequest(
  requestId: string,
  decision: "APPROVED" | "REJECTED",
  reviewNotes: string = ""
) {
  try {
    const supabase = await createClient();
    const authUser = await getAuthUser(supabase);
    if (!authUser) return { error: "অননুমোদিত অ্যাক্সেস" };

    const madrasaId = await getAuthMadrasaId(supabase, authUser);
    if (!madrasaId) return { error: "মাদরাসা আইডি পাওয়া যায়নি" };

    const store = await getMadrasaSecurityStore(madrasaId);
    const request = store.approval_requests?.find((r) => r.id === requestId);
    if (!request) return { error: "আবেদনটি খুঁজে পাওয়া যায়নি।" };

    if (request.status !== "PENDING") {
      return { error: `এই আবেদনটি ইতিমধ্যে "${request.status}" করা হয়েছে।` };
    }

    // 1. Check Reviewer's Effective Permission
    const { summary } = await getCurrentUserPermissions();
    if (!summary) return { error: "অনুমোদনকারী যাচাই করা যায়নি।" };

    const requiredPerm = APPROVAL_REQUIRED_PERMISSIONS[request.type];
    const isSuperAdmin = summary.roles.includes("super_admin") || summary.roles.includes("muhtamim");

    if (!isSuperAdmin && requiredPerm && !summary.effectivePermissions.includes(requiredPerm)) {
      return { error: `আপনার এই আবেদনটি পর্যালোচনা করার অনুমতি নেই (প্রয়োজনীয় অনুমতি: ${requiredPerm})` };
    }

    // 2. Two-Person Integrity Check: Maker cannot be Reviewer unless Super Admin
    if (!isSuperAdmin && request.requested_by.user_id === authUser.id) {
      return { error: "নিরাপত্তা নীতি: যিনি আবেদন করেছেন তিনি নিজেই নিজের আবেদন অনুমোদন করতে পারবেন না।" };
    }

    const auditEntry: SecurityAuditLog = {
      id: `audit_${Date.now()}`,
      madrasa_id: madrasaId,
      action: "APPROVAL_COMPLETED",
      module: "approval",
      actor_id: authUser.id,
      actor_name: authUser.user_metadata?.full_name || "মুহতামিম",
      actor_role: authUser.user_metadata?.role || "super_admin",
      details: `আবেদন #${requestId} (${request.title}) এর সিদ্ধান্ত: ${decision} (${reviewNotes || "মন্তব্য নেই"})`,
      created_at: new Date().toISOString(),
    };

    const saved = await saveMadrasaSecurityStore(madrasaId, (store) => {
      const existing = store.approval_requests || [];
      const updated = existing.map((r) => {
        if (r.id === requestId) {
          return {
            ...r,
            status: decision,
            reviewed_by: {
              user_id: authUser.id,
              name: authUser.user_metadata?.full_name || "মুহতামিম",
              role: authUser.user_metadata?.role || "super_admin",
            },
            reviewed_at: new Date().toISOString(),
            review_notes: reviewNotes.trim(),
          };
        }
        return r;
      });

      return {
        ...store,
        approval_requests: updated,
        security_audit_logs: [auditEntry, ...(store.security_audit_logs || [])],
      };
    });

    if (!saved) return { error: "সিদ্ধান্ত সংরক্ষণ করতে ব্যর্থ হয়েছে।" };

    revalidatePath("/dashboard/users");
    return { success: true, message: `আবেদনটি সফলভাবে "${decision === "APPROVED" ? "অনুমোদিত" : "প্রত্যাখ্যান"}" হয়েছে!` };
  } catch (err: any) {
    console.error("reviewApprovalRequest error:", err);
    return { error: err.message || "সিদ্ধান্ত প্রক্রিয়ায় ত্রুটি ঘটেছে" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. LOG SECURITY AUDIT ACTION
// ─────────────────────────────────────────────────────────────────────────────

export async function logSecurityAudit(
  action: AuditActionType,
  module: string,
  details: string,
  targetUserId?: string,
  targetUserName?: string
) {
  try {
    const supabase = await createClient();
    const authUser = await getAuthUser(supabase);
    if (!authUser) return;

    const madrasaId = await getAuthMadrasaId(supabase, authUser);
    if (!madrasaId) return;

    const auditEntry: SecurityAuditLog = {
      id: `audit_${Date.now()}`,
      madrasa_id: madrasaId,
      action,
      module,
      actor_id: authUser.id,
      actor_name: authUser.user_metadata?.full_name || "অফিসার",
      actor_role: authUser.user_metadata?.role || "staff",
      target_user_id: targetUserId,
      target_user_name: targetUserName,
      details,
      created_at: new Date().toISOString(),
    };

    await saveMadrasaSecurityStore(madrasaId, (store) => ({
      ...store,
      security_audit_logs: [auditEntry, ...(store.security_audit_logs || [])],
    }));
  } catch (err) {
    console.warn("Audit logging warning:", err);
  }
}
