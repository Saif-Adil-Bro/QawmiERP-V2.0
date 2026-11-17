import { createAdminClient } from "@/lib/supabase/admin";
import { getMadrasaMetadata } from "@/lib/sessions";
import { getStructuredMadrasaSetting } from "@/lib/structured-config";
import { isMissingTableError } from "@/lib/audit-log";

/**
 * কেবল মুহতামিম, অ্যাডমিন অথবা সুপার অ্যাডমিন লক/আনলক করতে পারবেন।
 */
export const LOCK_PRIVILEGED_ROLES = ["super_admin", "muhtamim", "admin"];

export interface ExamLockState {
  is_locked: boolean;
  locked_by?: string | null;
  locked_by_name?: string | null;
  locked_at?: string | null;
  lock_reason?: string | null;
}

export interface AccountingPeriodRecord {
  id: string;
  madrasa_id: string;
  period_key: string;
  period_type: "MONTHLY" | "ANNUAL" | "SESSION";
  label: string;
  start_date: string;
  end_date: string;
  is_locked: boolean;
  locked_by?: string | null;
  locked_by_name?: string | null;
  locked_at?: string | null;
  lock_reason?: string | null;
  unlocked_by?: string | null;
  unlocked_by_name?: string | null;
  unlocked_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export function hasLockPrivilege(roles: string[], primaryRole?: string): boolean {
  const all = new Set([...(roles || []), ...(primaryRole ? [primaryRole] : [])]);
  return LOCK_PRIVILEGED_ROLES.some((r) => all.has(r));
}

/**
 * Checks whether a specific Exam is currently frozen/locked.
 * Reads `exams.is_locked` first; falls back to `madrasa_settings` / `madrasas.metadata.exam_locks`.
 */
export async function getExamLockState(
  madrasaId: string,
  examId: string
): Promise<ExamLockState> {
  if (!madrasaId || !examId) return { is_locked: false };

  try {
    const adminClient = await createAdminClient();
    const { data, error } = await adminClient
      .from("exams")
      .select("is_locked, locked_by, locked_by_name, locked_at, lock_reason")
      .eq("id", examId)
      .eq("madrasa_id", madrasaId)
      .maybeSingle();

    if (!error && data) {
      return {
        is_locked: Boolean(data.is_locked),
        locked_by: data.locked_by || null,
        locked_by_name: data.locked_by_name || null,
        locked_at: data.locked_at || null,
        lock_reason: data.lock_reason || null,
      };
    }

    // Column missing in old schema -> fallback to madrasa_settings or metadata
    const settingRes = await getStructuredMadrasaSetting<Record<string, ExamLockState>>(
      madrasaId,
      "locks",
      "exam_locks"
    );
    if (settingRes.found && settingRes.value?.[examId]) {
      return {
        is_locked: Boolean(settingRes.value[examId].is_locked),
        locked_by: settingRes.value[examId].locked_by || null,
        locked_by_name: settingRes.value[examId].locked_by_name || null,
        locked_at: settingRes.value[examId].locked_at || null,
        lock_reason: settingRes.value[examId].lock_reason || null,
      };
    }

    const meta: any = await getMadrasaMetadata(madrasaId);
    const fallbackLock = meta?.exam_locks?.[examId];
    if (fallbackLock) {
      return {
        is_locked: Boolean(fallbackLock.is_locked),
        locked_by: fallbackLock.locked_by || null,
        locked_by_name: fallbackLock.locked_by_name || null,
        locked_at: fallbackLock.locked_at || null,
        lock_reason: fallbackLock.lock_reason || null,
      };
    }
  } catch (err) {
    console.warn("getExamLockState error:", err);
  }

  return { is_locked: false };
}

/**
 * Server-side guard to prevent modifying marks/settings of a frozen exam.
 */
export async function assertExamUnlocked(
  madrasaId: string,
  examId: string,
  actionLabel = "এই পরীক্ষার নম্বর বা তথ্য পরিবর্তন"
): Promise<{ locked: false } | { locked: true; error: string; lockState: ExamLockState }> {
  const lockState = await getExamLockState(madrasaId, examId);
  if (!lockState.is_locked) return { locked: false };

  const lockedByInfo = lockState.locked_by_name
    ? ` (${lockState.locked_by_name} কর্তৃক লক করা)`
    : "";
  const reasonInfo = lockState.lock_reason ? ` কারণ: ${lockState.lock_reason}।` : "";

  return {
    locked: true,
    lockState,
    error: `🔒 পরীক্ষাটি লক/ফ্রিজ করা আছে${lockedByInfo}! ${actionLabel} করা সম্ভব নয়।${reasonInfo} পরিবর্তন করতে হলে মুহতামিম বা সুপার অ্যাডমিনকে পরীক্ষাটি আনলক করতে হবে।`,
  };
}

/**
 * Checks whether a given YYYY-MM-DD date falls within any locked accounting period.
 */
export async function findLockedAccountingPeriodForDate(
  madrasaId: string,
  dateStr?: string | null
): Promise<AccountingPeriodRecord | null> {
  if (!madrasaId || !dateStr) return null;
  const cleanDate = String(dateStr).split("T")[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) return null;

  try {
    const adminClient = await createAdminClient();
    const { data, error } = await adminClient
      .from("accounting_periods")
      .select("*")
      .eq("madrasa_id", madrasaId)
      .eq("is_locked", true)
      .lte("start_date", cleanDate)
      .gte("end_date", cleanDate)
      .limit(1);

    if (!error) {
      return data && data.length > 0 ? (data[0] as AccountingPeriodRecord) : null;
    }

    if (!isMissingTableError(error)) {
      console.warn("findLockedAccountingPeriodForDate error:", error.message);
    }
  } catch {
    // fallback below
  }

  // Fallback to madrasa_settings or madrasas.metadata.accounting_periods
  try {
    const settingRes = await getStructuredMadrasaSetting<AccountingPeriodRecord[]>(
      madrasaId,
      "locks",
      "accounting_periods"
    );
    let periods: AccountingPeriodRecord[] = [];
    if (settingRes.found && Array.isArray(settingRes.value)) {
      periods = settingRes.value;
    } else {
      const meta: any = await getMadrasaMetadata(madrasaId);
      periods = Array.isArray(meta?.accounting_periods) ? meta.accounting_periods : [];
    }

    const match = periods.find(
      (p) => p.is_locked && p.start_date <= cleanDate && p.end_date >= cleanDate
    );
    return match || null;
  } catch {
    return null;
  }
}

/**
 * Server-side guard to prevent creating/editing/voiding expenses or fees in a locked accounting period.
 */
export async function assertAccountingPeriodUnlocked(
  madrasaId: string,
  dateStr?: string | null,
  actionLabel = "হিসাব/ভাউচার এন্ট্রি বা পরিবর্তন"
): Promise<{ locked: false } | { locked: true; error: string; period: AccountingPeriodRecord }> {
  const lockedPeriod = await findLockedAccountingPeriodForDate(madrasaId, dateStr);
  if (!lockedPeriod) return { locked: false };

  const lockedByInfo = lockedPeriod.locked_by_name
    ? ` (${lockedPeriod.locked_by_name} কর্তৃক ক্লোজ করা)`
    : "";
  const reasonInfo = lockedPeriod.lock_reason ? ` কারণ: ${lockedPeriod.lock_reason}।` : "";

  return {
    locked: true,
    period: lockedPeriod,
    error: `🔒 "${lockedPeriod.label}" সময়কালের হিসাব লক করা আছে${lockedByInfo}! এই তারিখে (${String(dateStr).split("T")[0]}) ${actionLabel} করা যাবে না।${reasonInfo} প্রয়োজনে মুহতামিম বা সুপার অ্যাডমিনকে পিরিয়ডটি আনলক করতে হবে।`,
  };
}

/**
 * Checks whether an academic session is locked.
 */
export async function isAcademicSessionLocked(
  madrasaId: string,
  sessionId?: string | null
): Promise<{ is_locked: boolean; label?: string; lock_reason?: string | null }> {
  if (!madrasaId || !sessionId) return { is_locked: false };
  try {
    const adminClient = await createAdminClient();
    const { data, error } = await adminClient
      .from("academic_sessions")
      .select("name, is_locked, lock_reason")
      .eq("id", sessionId)
      .eq("madrasa_id", madrasaId)
      .maybeSingle();

    if (!error && data && typeof (data as any).is_locked === "boolean") {
      return {
        is_locked: Boolean((data as any).is_locked),
        label: data.name,
        lock_reason: (data as any).lock_reason || null,
      };
    }
  } catch {
    // fallback below
  }

  try {
    const meta: any = await getMadrasaMetadata(madrasaId);
    const found = (meta?.sessions || []).find((s: any) => s.id === sessionId);
    if (found) {
      return {
        is_locked: Boolean(found.is_locked),
        label: found.name,
        lock_reason: found.lock_reason || null,
      };
    }
  } catch {
    // ignore
  }
  return { is_locked: false };
}
