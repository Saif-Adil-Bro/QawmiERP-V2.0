import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeSuperAdminOrCron } from "@/lib/api-auth";
import { isMissingTableError, logAuditEvent } from "@/lib/audit-log";
import { getStructuredMadrasaSetting, saveStructuredMadrasaSetting } from "@/lib/structured-config";

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

  try {
    const admin = await createAdminClient();
    const { data, error } = await admin
      .from("job_execution_logs")
      .insert({ madrasa_id: madrasaId, ...record })
      .select("id")
      .maybeSingle();

    if (!error && data?.id) {
      return String(data.id);
    }

    if (error && !isMissingTableError(error)) {
      console.error("Failed to persist job_execution_logs:", error);
      return undefined;
    }
  } catch {
    // fall through to fallback
  }

  // Fallback to madrasa_settings when job_execution_logs table is missing
  const fallbackId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const fb = await getStructuredMadrasaSetting<any[]>(
    madrasaId,
    "automation",
    FALLBACK_LOGS_KEY
  );
  const list = Array.isArray(fb.value) ? fb.value : [];
  await saveStructuredMadrasaSetting(
    madrasaId,
    "automation",
    FALLBACK_LOGS_KEY,
    [{ id: fallbackId, madrasa_id: madrasaId, ...record, created_at: new Date().toISOString() }, ...list].slice(0, 200)
  );
  return fallbackId;
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

  try {
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
      logAuditEvent({
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
      ok: status !== "FAILED",
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
      logAuditEvent({
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
