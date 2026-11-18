"use server";

import { revalidatePath } from "next/cache";
import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { getAuthMadrasaId } from "@/app/actions/students";
import { requirePermission } from "@/lib/permissions-server";
import { getMadrasaMetadata, saveMadrasaMetadata } from "@/lib/sessions";
import { saveStructuredMadrasaSetting, getStructuredMadrasaSetting } from "@/lib/structured-config";
import {
  LOCK_PRIVILEGED_ROLES,
  hasLockPrivilege,
  type AccountingPeriodRecord,
} from "@/lib/lock-guards";
import { logAuditEvent, isMissingTableError } from "@/lib/audit-log";

async function resolveLockActor() {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return { error: "অননুমোদিত অ্যাক্সেস। অনুগ্রহ করে লগইন করুন।" };

  const madrasaId = await getAuthMadrasaId(supabase, user);
  if (!madrasaId) return { error: "মাদরাসা আইডি পাওয়া যায়নি।" };

  const guard = await requirePermission({
    userId: user.id,
    madrasaId,
    roles: LOCK_PRIVILEGED_ROLES,
    errorMessage: "ডাটা লক বা আনলক করার অনুমতি কেবল মুহতামিম, অ্যাডমিন অথবা সুপার অ্যাডমিনের আছে।",
  });

  const canManage = Boolean(
    guard.allowed &&
      guard.context &&
      hasLockPrivilege(guard.context.roles, guard.context.role)
  );

  return {
    supabase,
    user,
    madrasaId,
    canManage,
    guardError: guard.error,
    actorName: guard.context?.profile?.fullName || user.email || "প্রশাসন",
    actorEmail: guard.context?.profile?.email || user.email || null,
    actorRole: guard.context?.role || null,
  };
}

export async function getCanManageLocks(): Promise<boolean> {
  const ctx = await resolveLockActor();
  if ("error" in ctx) return false;
  return ctx.canManage;
}

/**
 * Fetch all Accounting Periods (locked/unlocked records) for current madrasa.
 */
export async function getAccountingPeriods(): Promise<{
  periods: AccountingPeriodRecord[];
  storage: "sql" | "fallback";
  canManage: boolean;
}> {
  const ctx = await resolveLockActor();
  if ("error" in ctx) return { periods: [], storage: "fallback", canManage: false };

  try {
    const adminClient = await createAdminClient();
    const { data, error } = await adminClient
      .from("accounting_periods")
      .select("*")
      .eq("madrasa_id", ctx.madrasaId)
      .order("start_date", { ascending: false });

    if (!error && Array.isArray(data)) {
      return {
        periods: data as AccountingPeriodRecord[],
        storage: "sql",
        canManage: ctx.canManage,
      };
    }

    if (error && !isMissingTableError(error)) {
      console.warn("getAccountingPeriods error:", error.message);
    }
  } catch {
    // fallback below
  }

  const settingRes = await getStructuredMadrasaSetting<AccountingPeriodRecord[]>(
    ctx.madrasaId,
    "locks",
    "accounting_periods"
  );
  if (settingRes.found && Array.isArray(settingRes.value)) {
    return { periods: settingRes.value, storage: "fallback", canManage: ctx.canManage };
  }

  const meta: any = await getMadrasaMetadata(ctx.madrasaId);
  const list = Array.isArray(meta?.accounting_periods) ? meta.accounting_periods : [];
  return { periods: list, storage: "fallback", canManage: ctx.canManage };
}

/**
 * Lock or Unlock a Monthly / Annual Accounting Period.
 * Strictly restricted to Muhtamim, Admin, or Super Admin.
 */
export async function toggleAccountingPeriodLock(input: {
  periodKey: string;
  periodType: "MONTHLY" | "ANNUAL" | "SESSION";
  label: string;
  startDate: string;
  endDate: string;
  shouldLock: boolean;
  reason?: string;
}): Promise<{
  success?: boolean;
  period?: AccountingPeriodRecord;
  error?: string;
  stepUpRequired?: boolean;
  errorCode?: string;
}> {
  const ctx = await resolveLockActor();
  if ("error" in ctx) return { error: ctx.error };
  if (!ctx.canManage) {
    await logAuditEvent({
      madrasaId: ctx.madrasaId,
      actorId: ctx.user.id,
      actorName: ctx.actorName,
      actorEmail: ctx.actorEmail,
      actorRole: ctx.actorRole,
      module: "security",
      action: "UNAUTHORIZED_LOCK_ATTEMPT",
      entityType: "accounting_period",
      entityId: input.periodKey,
      entityLabel: input.label,
      summary: `অ্যাকাউন্টিং পিরিয়ড "${input.label}" লক/আনলক করার অননুমোদিত চেষ্টা ব্লক করা হয়েছে।`,
      severity: "CRITICAL",
    });
    return {
      error:
        ctx.guardError ||
        "হিসাব পিরিয়ড লক বা আনলক করার অনুমতি কেবল মুহতামিম বা সুপার অ্যাডমিনের আছে।",
    };
  }

  if (!input.shouldLock) {
    const stepUpGuard = await requirePermission({
      userId: ctx.user.id,
      madrasaId: ctx.madrasaId,
      roles: LOCK_PRIVILEGED_ROLES,
      riskLevel: "CRITICAL",
      actionScope: "accounting_period.unlock",
    });
    if (!stepUpGuard.allowed) {
      return {
        error: stepUpGuard.error || "হিসাব পিরিয়ড আনলক করতে ২-ধাপ যাচাইকরণ প্রয়োজন।",
        stepUpRequired: stepUpGuard.stepUpRequired,
        errorCode: stepUpGuard.errorCode,
      };
    }
  }

  const now = new Date().toISOString();
  const cleanReason = (input.reason || "").trim() || (input.shouldLock ? "অডিট ও মাসিক হিসাব ক্লোজিং" : "মুহতামিম কর্তৃক সংশোধনের জন্য আনলক");

  const payload = {
    madrasa_id: ctx.madrasaId,
    period_key: input.periodKey,
    period_type: input.periodType,
    label: input.label,
    start_date: input.startDate,
    end_date: input.endDate,
    is_locked: input.shouldLock,
    locked_by: input.shouldLock ? ctx.user.id : null,
    locked_by_name: input.shouldLock ? ctx.actorName : null,
    locked_at: input.shouldLock ? now : null,
    lock_reason: input.shouldLock ? cleanReason : null,
    unlocked_by: !input.shouldLock ? ctx.user.id : null,
    unlocked_by_name: !input.shouldLock ? ctx.actorName : null,
    unlocked_at: !input.shouldLock ? now : null,
    updated_at: now,
  };

  let savedRecord: AccountingPeriodRecord | null = null;
  let usedSql = false;

  try {
    const adminClient = await createAdminClient();
    const { data, error } = await adminClient
      .from("accounting_periods")
      .upsert(payload, { onConflict: "madrasa_id,period_key" })
      .select("*")
      .single();

    if (!error && data) {
      savedRecord = data as AccountingPeriodRecord;
      usedSql = true;
    } else if (error && !isMissingTableError(error)) {
      return { error: error.message };
    }
  } catch (err: any) {
    console.warn("toggleAccountingPeriodLock SQL error:", err);
  }

  if (!usedSql) {
    const existing = await getAccountingPeriods();
    const list = [...existing.periods];
    const idx = list.findIndex((p) => p.period_key === input.periodKey);
    const fallbackRec: AccountingPeriodRecord = {
      id: idx >= 0 ? list[idx].id : `period_${input.periodKey}`,
      ...payload,
      created_at: idx >= 0 ? list[idx].created_at : now,
    };
    if (idx >= 0) list[idx] = fallbackRec;
    else list.unshift(fallbackRec);

    const savedSetting = await saveStructuredMadrasaSetting(
      ctx.madrasaId,
      "locks",
      "accounting_periods",
      list,
      ctx.user.id
    );
    if (!savedSetting.ok) {
      const meta: any = await getMadrasaMetadata(ctx.madrasaId);
      meta.accounting_periods = list;
      await saveMadrasaMetadata(ctx.madrasaId, meta);
    }
    savedRecord = fallbackRec;
  }

  await logAuditEvent({
    madrasaId: ctx.madrasaId,
    actorId: ctx.user.id,
    actorName: ctx.actorName,
    actorEmail: ctx.actorEmail,
    actorRole: ctx.actorRole,
    module: "locks",
    action: input.shouldLock ? "ACCOUNTING_PERIOD_LOCKED" : "ACCOUNTING_PERIOD_UNLOCKED",
    entityType: "accounting_period",
    entityId: input.periodKey,
    entityLabel: input.label,
    summary: input.shouldLock
      ? `"${input.label}" (${input.startDate} থেকে ${input.endDate}) হিসাব পিরিয়ড লক/ফ্রিজ করা হয়েছে। কারণ: ${cleanReason}`
      : `"${input.label}" হিসাব পিরিয়ড আনলক করা হয়েছে। কারণ: ${cleanReason}`,
    oldValue: { is_locked: !input.shouldLock },
    newValue: { is_locked: input.shouldLock, lock_reason: cleanReason, start_date: input.startDate, end_date: input.endDate },
    severity: input.shouldLock ? "WARNING" : "CRITICAL",
  });

  revalidatePath("/dashboard/settings/data-governance");
  revalidatePath("/dashboard/accounting");
  revalidatePath("/dashboard/accounting/expenses");
  revalidatePath("/dashboard/accounting/fees");

  return { success: true, period: savedRecord || undefined };
}

/**
 * Lock or Unlock an Academic Session.
 * Strictly restricted to Muhtamim, Admin, or Super Admin.
 */
export async function toggleAcademicSessionLock(
  sessionId: string,
  shouldLock: boolean,
  reason?: string
): Promise<{ success?: boolean; error?: string; stepUpRequired?: boolean; errorCode?: string }> {
  const ctx = await resolveLockActor();
  if ("error" in ctx) return { error: ctx.error };
  if (!ctx.canManage) {
    return {
      error:
        ctx.guardError ||
        "শিক্ষাবর্ষ লক বা আনলক করার অনুমতি কেবল মুহতামিম বা সুপার অ্যাডমিনের আছে।",
    };
  }

  if (!shouldLock) {
    const stepUpGuard = await requirePermission({
      userId: ctx.user.id,
      madrasaId: ctx.madrasaId,
      roles: LOCK_PRIVILEGED_ROLES,
      riskLevel: "CRITICAL",
      actionScope: "academic_session.unlock",
    });
    if (!stepUpGuard.allowed) {
      return {
        error: stepUpGuard.error || "শিক্ষাবর্ষ আনলক করতে ২-ধাপ যাচাইকরণ প্রয়োজন।",
        stepUpRequired: stepUpGuard.stepUpRequired,
        errorCode: stepUpGuard.errorCode,
      };
    }
  }

  const now = new Date().toISOString();
  const cleanReason =
    (reason || "").trim() ||
    (shouldLock ? "শিক্ষাবর্ষ ক্লোজিং ও ডেটা ফ্রিজ" : "মুহতামিম কর্তৃক আনলক");

  // 1. Update relational academic_sessions table if available
  try {
    const adminClient = await createAdminClient();
    await adminClient
      .from("academic_sessions")
      .update({
        is_locked: shouldLock,
        locked_by: shouldLock ? ctx.user.id : null,
        locked_by_name: shouldLock ? ctx.actorName : null,
        locked_at: shouldLock ? now : null,
        lock_reason: shouldLock ? cleanReason : null,
        updated_at: now,
      })
      .eq("id", sessionId)
      .eq("madrasa_id", ctx.madrasaId);
  } catch {
    // non-fatal if column/table not migrated yet
  }

  // 2. Sync into sessions metadata so getAcademicSessions reflects lock state everywhere
  const meta: any = await getMadrasaMetadata(ctx.madrasaId);
  let sessionName = sessionId;
  if (Array.isArray(meta.sessions)) {
    meta.sessions = meta.sessions.map((s: any) => {
      if (s.id === sessionId) {
        sessionName = s.name || sessionId;
        return {
          ...s,
          is_locked: shouldLock,
          locked_by: shouldLock ? ctx.user.id : null,
          locked_by_name: shouldLock ? ctx.actorName : null,
          locked_at: shouldLock ? now : null,
          lock_reason: shouldLock ? cleanReason : null,
          updated_at: now,
        };
      }
      return s;
    });
    await saveMadrasaMetadata(ctx.madrasaId, meta);
  }

  await logAuditEvent({
    madrasaId: ctx.madrasaId,
    actorId: ctx.user.id,
    actorName: ctx.actorName,
    actorEmail: ctx.actorEmail,
    actorRole: ctx.actorRole,
    module: "locks",
    action: shouldLock ? "SESSION_LOCKED" : "SESSION_UNLOCKED",
    entityType: "academic_session",
    entityId: sessionId,
    entityLabel: sessionName,
    summary: shouldLock
      ? `শিক্ষাবর্ষ "${sessionName}" লক/ফ্রিজ করা হয়েছে। কারণ: ${cleanReason}`
      : `শিক্ষাবর্ষ "${sessionName}" আনলক করা হয়েছে। কারণ: ${cleanReason}`,
    oldValue: { is_locked: !shouldLock },
    newValue: { is_locked: shouldLock, lock_reason: cleanReason },
    severity: shouldLock ? "WARNING" : "CRITICAL",
  });

  revalidatePath("/dashboard/settings/data-governance");
  revalidatePath("/dashboard/academic/sessions");

  return { success: true };
}
