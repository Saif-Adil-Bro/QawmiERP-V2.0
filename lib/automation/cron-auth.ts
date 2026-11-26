import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeSuperAdminOrCron } from "@/lib/api-auth";
import { isMissingTableError, logAuditEvent } from "@/lib/audit-log";
import {changeAutomationList} from "./setting-cas";

export interface CronJobOutcome<T = Record<string, unknown>> {
  processedCount: number;
  successCount: number;
  failedCount: number;
  summary: T;
}

export interface TrackedCronResult<T = Record<string, unknown>> {
  ok: boolean;
  jobKey: string;
  status: "SUCCESS" | "PARTIAL" | "FAILED";
  durationMs: number;
  processedCount: number;
  successCount: number;
  failedCount: number;
  summary: T;
  logId?: string;
  error?: string;
}

const FALLBACK_LOGS_KEY = "job_execution_logs";

/**
 * Wraps `authorizeSuperAdminOrCron` for `/api/cron/*` endpoints.
 */
export async function authorizeCronRequest(req: Request) {
  return authorizeSuperAdminOrCron(req);
}

/**
 * Cron-এ টার্গেট tenant নির্ধারণ। সেশন-ভিত্তিক caller হলে সবসময় তার নিজের
 * মাদ্রাসা (অনুরোধের madrasaId উপেক্ষিত); CRON_SECRET হলে অনুরোধ অনুযায়ী
 * (null = সব tenant)।
 */
export function resolveCronTenant(
  auth: { ok: true; scopedMadrasaId?: string },
  requested: string | null | undefined
): string | null {
  if (auth.scopedMadrasaId) return auth.scopedMadrasaId;
  return requested || null;
}

async function persistJobLog(
  madrasaId: string | null,
  record: Record<string, any>
): Promise<string | undefined> {
  if (!madrasaId) return undefined;

  const normalizedRecord = {
    duration_ms: 0,
    processed_count: 0,
    success_count: 0,
    failed_count: 0,
    summary: {},
    error_message: null,
    ...record,
  };

  try {
    const admin = await createAdminClient();
    const { data, error } = await admin
      .from("job_execution_logs")
      .upsert({ madrasa_id: madrasaId, ...normalizedRecord }, { onConflict: "id" })
      .select("id")
      .maybeSingle();

    if (!error && data?.id) {
      return String(data.id);
    }

    if (error && !isMissingTableError(error)) {
      console.warn(
        "job_execution_logs SQL upsert failed, falling back to structured setting:",
        error.code,
        error.message,
      );
    }
  } catch (err) {
    console.warn("job_execution_logs SQL exception, falling back:", err);
  }

  // Fallback to madrasa_settings whenever SQL table is missing or rejects the row (e.g. CHECK constraint on RUNNING)
  try {
    const stored = await changeAutomationList(madrasaId, FALLBACK_LOGS_KEY, (list) => [
      {
        madrasa_id: madrasaId,
        ...normalizedRecord,
        created_at: normalizedRecord.started_at || new Date().toISOString(),
      },
      ...list.filter((r) => r.id !== normalizedRecord.id),
    ].slice(0, 200));
    return stored ? String(normalizedRecord.id) : undefined;
  } catch (err) {
    console.error("Could not record cron attempt", err);
    return undefined;
  }
}

/**
 * Executes a cron job and records its execution log in `job_execution_logs`
 * (with `isMissingTableError` fallback) and `system_audit_logs` (`CRON_EXECUTED`).
 */
export async function runTrackedCronJob<T = Record<string, unknown>>(
  jobKey: string,
  madrasaId: string | null,
  triggerSource: "cron" | "manual" | "retry",
  fn: () => Promise<CronJobOutcome<T>>
): Promise<TrackedCronResult<T>> {
  const startedAt = new Date();
  const startMs = Date.now();
  const id=crypto.randomUUID();

  try {
    if (madrasaId && !await persistJobLog(madrasaId,{id,job_key:jobKey,trigger_source:triggerSource,status:"RUNNING",started_at:startedAt.toISOString()})) throw Error("ক্রন শুরুর লগ সংরক্ষণ হয়নি; কাজ চালানো হয়নি।");
    const outcome = await fn();
    const finishedAt = new Date();
    const durationMs = Math.max(0, Date.now() - startMs);
    const status: "SUCCESS" | "PARTIAL" | "FAILED" =
      outcome.failedCount > 0 && outcome.successCount > 0
        ? "PARTIAL"
        : outcome.failedCount > 0 && outcome.successCount === 0
          ? "FAILED"
          : "SUCCESS";

    const logId = await persistJobLog(madrasaId, {
      id,
      job_key: jobKey,
      trigger_source: triggerSource,
      status,
      started_at: startedAt.toISOString(),
      finished_at: finishedAt.toISOString(),
      duration_ms: durationMs,
      processed_count: outcome.processedCount,
      success_count: outcome.successCount,
      failed_count: outcome.failedCount,
      summary: outcome.summary || {},
      error_message: null,
    });

    if (madrasaId) {
      await logAuditEvent({
        madrasaId,
        module: "automation",
        action: "CRON_EXECUTED",
        entityType: "job_execution_logs",
        entityId: logId || jobKey,
        summary: `ক্রন জব '${jobKey}' সম্পন্ন (${status}): প্রসেসড ${outcome.processedCount}, সফল ${outcome.successCount}, ব্যর্থ ${outcome.failedCount}`,
        metadata: {
          jobKey,
          triggerSource,
          status,
          durationMs,
          processedCount: outcome.processedCount,
          successCount: outcome.successCount,
          failedCount: outcome.failedCount,
        },
        severity: status === "FAILED" ? "WARNING" : "INFO",
      }).catch(() => {});
    }

    return {
      ok: status === "SUCCESS" && !!logId,
      jobKey,
      status,
      durationMs,
      processedCount: outcome.processedCount,
      successCount: outcome.successCount,
      failedCount: outcome.failedCount,
      summary: outcome.summary,
      logId,
    };
  } catch (err: any) {
    const finishedAt = new Date();
    const durationMs = Math.max(0, Date.now() - startMs);
    const errorMessage = err?.message || "Unknown cron execution error";

    const logId = await persistJobLog(madrasaId, {
      id,
      job_key: jobKey,
      trigger_source: triggerSource,
      status: "FAILED",
      started_at: startedAt.toISOString(),
      finished_at: finishedAt.toISOString(),
      duration_ms: durationMs,
      processed_count: 0,
      success_count: 0,
      failed_count: 1,
      summary: {},
      error_message: errorMessage,
    });

    if (madrasaId) {
      await logAuditEvent({
        madrasaId,
        module: "automation",
        action: "CRON_EXECUTED",
        entityType: "job_execution_logs",
        entityId: logId || jobKey,
        summary: `ক্রন জব '${jobKey}' ব্যর্থ হয়েছে: ${errorMessage}`,
        metadata: { jobKey, triggerSource, status: "FAILED", errorMessage },
        severity: "WARNING",
      }).catch(() => {});
    }

    return {
      ok: false,
      jobKey,
      status: "FAILED",
      durationMs,
      processedCount: 0,
      successCount: 0,
      failedCount: 1,
      summary: {} as T,
      logId,
      error: errorMessage,
    };
  }
}
