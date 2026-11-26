"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeGuard } from "@/lib/action-authorization";
import { isMissingTableError } from "@/lib/audit-log";
import {changeAutomationList} from "@/lib/automation/setting-cas";
import { getStructuredMadrasaSetting } from "@/lib/structured-config";
import {
  executeAutomationJob,
  jobSucceeded, mergeRulesWithDefaults,
  recordManualRuleExecution,
  runMasterCronDispatch,
  type AutomationJobKey,
} from "@/lib/automation/master-dispatcher";
import {
  getInAppSchedulerStatus,
  getPersistedSchedulerHeartbeat,
  recordDispatchHeartbeat,
  startInAppAutomationScheduler,
} from "@/lib/automation/in-app-scheduler";
import {
  computeNextRunAt,
  DEFAULT_CRON_TIMEZONE,
  isValidCronExpression,
} from "@/lib/automation/schedule-evaluator";

export async function getAutomationHeartbeatAction(){
  const guard=await writeGuard('automation');
  if(!guard.allowed || !guard.madrasaId)return {heartbeat:null,error:'হার্টবিট দেখার অনুমতি নেই।'};
  try {
    const {getPersistedSchedulerHeartbeat}=await import('@/lib/automation/in-app-scheduler');
    return {heartbeat:await getPersistedSchedulerHeartbeat(guard.madrasaId)};
  }catch{return {heartbeat:null,error:'শিডিউলার হার্টবিট পড়া যায়নি।'};}
}

const FALLBACK_RULES_KEY = "automation_rules";
const FALLBACK_LOGS_KEY = "job_execution_logs";

export async function getAutomationRulesAction() {
  const authz = await writeGuard("automation");
  if (!authz.allowed) return { error: authz.error || "অনুমতি নেই", rules: [] };
  if (!authz.madrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি", rules: [] };

  const admin = await createAdminClient();
  const { data, error } = await admin
    .from("automation_rules")
    .select("*")
    .eq("madrasa_id", authz.madrasaId)
    .order("created_at", { ascending: true });

  if (!error) {
    return { rules: mergeRulesWithDefaults(authz.madrasaId, data || []) };
  }

  if (isMissingTableError(error)) {
    const fb = await getStructuredMadrasaSetting<any[]>(
      authz.madrasaId,
      "automation",
      FALLBACK_RULES_KEY
    );
    const rules = mergeRulesWithDefaults(
      authz.madrasaId,
      Array.isArray(fb.value) ? fb.value : []
    );
    return { rules };
  }

  return { error: error.message, rules: [] };
}

export async function saveAutomationRuleAction(input: {
  rule_key: string;
  name: string;
  name_bn?: string;
  description?: string;
  cron_expression?: string;
  is_enabled: boolean;
  config?: Record<string, unknown>;
}) {
  const authz = await writeGuard("automation");
  if (!authz.allowed) return { error: authz.error || "অনুমতি নেই" };
  if (!authz.madrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি" };

  const cronExpr = String(input.cron_expression || "0 9 * * *").trim();
  if (!isValidCronExpression(cronExpr)) {
    return { error: `সঠিক Cron ফরম্যাট নয়: "${cronExpr}" (উদাহরণ: 0 9 * * *)` };
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const tz = String((input.config as any)?.timezone || DEFAULT_CRON_TIMEZONE);
  const nextRun = input.is_enabled ? computeNextRunAt(cronExpr, now, tz) : null;

  const record = {
    madrasa_id: authz.madrasaId,
    rule_key: String(input.rule_key).trim(),
    name: String(input.name || input.rule_key).trim(),
    name_bn: input.name_bn || input.name,
    description: input.description || null,
    cron_expression: cronExpr,
    is_enabled: input.is_enabled,
    config: { ...(input.config || {}), timezone: tz },
    next_run_at: nextRun ? nextRun.toISOString() : null,
    created_by: authz.userId || null,
    updated_at: nowIso,
  };

  const admin = await createAdminClient();
  const { data, error } = await admin
    .from("automation_rules")
    .upsert(record, { onConflict: "madrasa_id,rule_key" })
    .select()
    .maybeSingle();

  if (!error) {
    await authz.logAudit({
      module: "automation",
      action: "AUTOMATION_RULE_UPDATED",
      entityType: "automation_rules",
      entityId: data?.id || record.rule_key,
      entityLabel: record.name_bn || record.name,
      summary: `অটোমেশন রুল '${record.name_bn || record.name}' আপডেট (${record.is_enabled ? "চালু" : "বন্ধ"}, সময়সূচি: ${cronExpr})`,
    });
    revalidatePath("/dashboard/settings/automation");
    return { success: true, rule: data };
  }

  if (isMissingTableError(error)) {
    await changeAutomationList(authz.madrasaId,FALLBACK_RULES_KEY,stored=>{
      const list=[...stored],idx=list.findIndex(r=>r.rule_key===record.rule_key);
      if(idx<0)list.push(record);else list[idx]={...list[idx],...record};
      return list;
    });
    revalidatePath("/dashboard/settings/automation");
    return { success: true, rule: record };
  }

  return { error: error.message };
}

export async function getJobExecutionLogsAction(limit = 50) {
  const authz = await writeGuard("automation");
  if (!authz.allowed) return { error: authz.error || "অনুমতি নেই", logs: [] };
  if (!authz.madrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি", logs: [] };

  const admin = await createAdminClient();
  const [sqlRes, fbRes] = await Promise.all([
    admin
      .from("job_execution_logs")
      .select("*")
      .eq("madrasa_id", authz.madrasaId)
      .order("created_at", { ascending: false })
      .limit(limit),
    getStructuredMadrasaSetting<any[]>(
      authz.madrasaId,
      "automation",
      FALLBACK_LOGS_KEY
    ).catch(() => ({ value: [] as any[] })),
  ]);

  const fbLogs = Array.isArray(fbRes?.value) ? fbRes.value : [];

  if (!sqlRes.error) {
    const byId = new Map<string, any>();
    for (const row of fbLogs) {
      if (row?.id) byId.set(String(row.id), row);
    }
    for (const row of sqlRes.data || []) {
      if (row?.id) byId.set(String(row.id), row);
    }
    const merged = Array.from(byId.values()).sort((a, b) =>
      String(b.started_at || b.created_at || "").localeCompare(
        String(a.started_at || a.created_at || "")
      )
    );
    return { logs: merged.slice(0, limit) };
  }

  if (isMissingTableError(sqlRes.error)) {
    return { logs: fbLogs.slice(0, limit) };
  }

  if (fbLogs.length > 0) {
    return { logs: fbLogs.slice(0, limit) };
  }

  return { error: sqlRes.error.message, logs: [] };
}

export async function triggerAutomationJobAction(jobKey: AutomationJobKey) {
  const authz = await writeGuard("automation");
  if (!authz.allowed) return { error: authz.error || "অনুমতি নেই" };
  if (!authz.madrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি" };

  const res: any = await executeAutomationJob(jobKey, authz.madrasaId, "manual");
  const ok=jobSucceeded(res);
  if(ok)await recordManualRuleExecution(authz.madrasaId,jobKey);
  revalidatePath("/dashboard/settings/automation");
  return { success:ok, result:res, ...(ok?{}:{error:"কাজ সম্পূর্ণ হয়নি। এক্সিকিউশন লগ যাচাই করুন।"}) };
}

export interface SchedulerHealthPayload {
  isActive: boolean;
  isTickRunning: boolean;
  inAppDisabled: boolean;
  startedAt: string | null;
  intervalMinutes: number;
  lastTickAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  lastDispatchedCount: number;
  tickCount: number;
  lastTriggerSource: "in-app" | "cron" | "manual" | null;
  cronSecretConfigured: boolean;
  externalCronProvider: string;
  externalCronEndpoint: string;
  externalCronSchedule: string;
}

export async function getSchedulerHealthAction(): Promise<{
  error?: string;
  health: SchedulerHealthPayload | null;
}> {
  const authz = await writeGuard("automation");
  if (!authz.allowed) return { error: authz.error || "অনুমতি নেই", health: null };
  if (!authz.madrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি", health: null };

  const inAppDisabled = process.env.DISABLE_IN_APP_SCHEDULER === "true";
  let live = getInAppSchedulerStatus();

  if (!live.isActive && !inAppDisabled && process.env.NODE_ENV !== "test") {
    live = startInAppAutomationScheduler();
  }

  const persisted = await getPersistedSchedulerHeartbeat(authz.madrasaId);

  const pickLatestIso = (a: string | null, b: string | null): string | null => {
    if (!a) return b;
    if (!b) return a;
    return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
  };

  const latestTickAt = pickLatestIso(live.lastTickAt, persisted?.lastTickAt || null);
  const usePersisted =
    Boolean(persisted?.lastTickAt) &&
    (!live.lastTickAt ||
      new Date(persisted!.lastTickAt!).getTime() > new Date(live.lastTickAt).getTime());

  const health: SchedulerHealthPayload = {
    isActive: live.isActive,
    isTickRunning: live.isTickRunning,
    inAppDisabled,
    startedAt: live.startedAt,
    intervalMinutes: Math.max(1, Math.round(live.intervalMs / 60_000)),
    lastTickAt: latestTickAt,
    lastSuccessAt: pickLatestIso(live.lastSuccessAt, persisted?.lastSuccessAt || null),
    lastError: usePersisted ? persisted?.lastError || null : live.lastError,
    lastDispatchedCount: usePersisted
      ? persisted?.lastDispatchedCount || 0
      : live.lastDispatchedCount,
    tickCount: live.tickCount,
    lastTriggerSource: usePersisted
      ? persisted?.lastTriggerSource || null
      : live.lastTriggerSource,
    cronSecretConfigured: Boolean(process.env.CRON_SECRET && process.env.CRON_SECRET.trim()),
    externalCronProvider: "GitHub Actions (.github/workflows/cron-jobs.yml)",
    externalCronEndpoint: "/api/cron/dispatch",
    externalCronSchedule: "*/15 * * * *",
  };

  return { health };
}

export async function runMasterDispatcherNowAction() {
  const authz = await writeGuard("automation");
  if (!authz.allowed) return { error: authz.error || "অনুমতি নেই" };
  if (!authz.madrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি" };

  try {
    const dispatchRes = await runMasterCronDispatch({
      madrasaId: authz.madrasaId,
      triggerSource: "manual",
    });

    const tenantResult = (dispatchRes.results || []).find(
      (r) => r.madrasaId === authz.madrasaId
    );
    const executedList = tenantResult?.executed || [];
    const skippedCount = tenantResult?.skippedCount || 0;

    await recordDispatchHeartbeat(dispatchRes, "manual").catch(() => {});

    await authz.logAudit({
      module: "automation",
      action: "AUTOMATION_DISPATCHER_TRIGGERED",
      entityType: "automation_rules",
      entityId: authz.madrasaId,
      entityLabel: "Master Cron Dispatcher",
      summary: `শিডিউলার ম্যানুয়াল চেক সম্পন্ন: ${executedList.length}টি নির্ধারিত জব চলেছে, ${skippedCount}টি পরবর্তী সময়ের জন্য অপেক্ষমাণ`,
      metadata: {
        executed_rules: executedList.map((e) => e.ruleKey),
        skipped_count: skippedCount,
      },
    });

    revalidatePath("/dashboard/settings/automation");

    return {
      success: true,
      dispatchedAt: dispatchRes.dispatchedAt,
      totalExecuted: executedList.length,
      skippedCount,
      executedRuleKeys: executedList.map((e) => e.ruleKey),
    };
  } catch (err: any) {
    const message = String(err?.message || "শিডিউলার চেক চালানো যায়নি").slice(0, 300);
    return { error: message };
  }
}
