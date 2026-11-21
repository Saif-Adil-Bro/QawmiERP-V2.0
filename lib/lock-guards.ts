import { createAdminClient } from "@/lib/supabase/admin";
import { getMadrasaMetadata, type MadrasaMetaWithSessions } from "@/lib/sessions";
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

const LOCK_UNAVAILABLE = "পরীক্ষার লক অবস্থা যাচাই করা যায়নি। পরিবর্তন না করে আবার চেষ্টা করুন।";

/** Resolve only rows the caller already read in its tenant. SQL false is authoritative too.
 * Legacy schemas use the per-exam structured setting, then metadata. Never infer a lock from publication. */
export async function withExamLocks<T extends { id: string } & Partial<ExamLockState>>(
  tenant: string,
  exams: T[],
  meta?: MadrasaMetaWithSessions,
): Promise<(T & ExamLockState)[]> {
  const legacy = exams.filter((e) => typeof e.is_locked !== "boolean");
  let settings: Record<string, ExamLockState> = {};
  if (legacy.length) {
    const setting = await getStructuredMadrasaSetting<Record<string, ExamLockState>>(
      tenant,
      "locks",
      "exam_locks",
      true,
    );
    if (
      setting.found &&
      (!setting.value || typeof setting.value !== "object" || Array.isArray(setting.value))
    )
      throw new Error(LOCK_UNAVAILABLE);
    settings = setting.value ?? {};
    if (!meta && legacy.some((e) => !settings[e.id])) meta = await getMadrasaMetadata(tenant, true);
  }
  return exams.map((exam) => {
    const lock =
      typeof exam.is_locked === "boolean" ? exam : (settings[exam.id] ?? meta?.exam_locks?.[exam.id]);
    if (lock != null && typeof lock.is_locked !== "boolean") throw new Error(LOCK_UNAVAILABLE);
    return {
      ...exam,
      is_locked: lock?.is_locked ?? false,
      locked_by: lock?.locked_by ?? null,
      locked_by_name: lock?.locked_by_name ?? null,
      locked_at: lock?.locked_at ?? null,
      lock_reason: lock?.lock_reason ?? null,
    };
  });
}

export async function getExamLockState(
  madrasaId: string,
  examId: string,
  client?: Awaited<ReturnType<typeof createAdminClient>>,
): Promise<ExamLockState> {
  if (!madrasaId || !examId) throw new Error(LOCK_UNAVAILABLE);
  const db = client ?? (await createAdminClient());
  // '*' works with both pre-freeze schemas and partially migrated optional lock metadata.
  const { data, error } = await db
    .from("exams")
    .select("*")
    .eq("id", examId)
    .eq("madrasa_id", madrasaId)
    .maybeSingle();
  if (error || !data) throw new Error(LOCK_UNAVAILABLE);
  const [{ is_locked, locked_by, locked_by_name, locked_at, lock_reason }] = await withExamLocks(madrasaId, [
    data,
  ]);
  return { is_locked, locked_by, locked_by_name, locked_at, lock_reason };
}

export async function assertExamUnlocked(
  madrasaId: string,
  examId: string,
  actionLabel = "এই পরীক্ষার নম্বর বা তথ্য পরিবর্তন",
) {
  let lockState: ExamLockState;
  try {
    lockState = await getExamLockState(madrasaId, examId);
  } catch {
    return { locked: true, code: "EXAM_LOCK_UNAVAILABLE", error: LOCK_UNAVAILABLE } as const;
  }
  if (!lockState.is_locked) return { locked: false } as const;

  const lockedByInfo = lockState.locked_by_name ? ` (${lockState.locked_by_name} কর্তৃক লক করা)` : "";
  const reasonInfo = lockState.lock_reason ? ` কারণ: ${lockState.lock_reason}।` : "";

  return {
    locked: true,
    code: "EXAM_LOCKED",
    lockState,
    error: `🔒 পরীক্ষাটি লক/ফ্রিজ করা আছে${lockedByInfo}! ${actionLabel} করা সম্ভব নয়।${reasonInfo} পরিবর্তনের আগে অনুমোদিত প্রশাসককে পরীক্ষাটি আনলক করতে হবে।`,
  } as const;
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
