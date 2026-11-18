"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeGuard } from "@/lib/action-authorization";
import { isMissingTableError } from "@/lib/audit-log";
import { getStructuredMadrasaSetting, saveStructuredMadrasaSetting } from "@/lib/structured-config";
import {
  DEFAULT_AUTOMATION_RULES,
  executeAutomationJob,
  mergeRulesWithDefaults,
  type AutomationJobKey,
} from "@/lib/automation/master-dispatcher";
import {
  computeNextRunAt,
  DEFAULT_CRON_TIMEZONE,
  isValidCronExpression,
} from "@/lib/automation/schedule-evaluator";

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
    const fb = await getStructuredMadrasaSetting<any[]>(
      authz.madrasaId,
      "automation",
      FALLBACK_RULES_KEY
    );
    const list =
      Array.isArray(fb.value) && fb.value.length > 0
        ? [...fb.value]
        : [...DEFAULT_AUTOMATION_RULES];
    const idx = list.findIndex((r) => r.rule_key === record.rule_key);
    if (idx >= 0) list[idx] = { ...list[idx], ...record };
    else list.push(record);
    await saveStructuredMadrasaSetting(authz.madrasaId, "automation", FALLBACK_RULES_KEY, list);
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
  const { data, error } = await admin
    .from("job_execution_logs")
    .select("*")
    .eq("madrasa_id", authz.madrasaId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (!error) {
    return { logs: data || [] };
  }

  if (isMissingTableError(error)) {
    const fb = await getStructuredMadrasaSetting<any[]>(
      authz.madrasaId,
      "automation",
      FALLBACK_LOGS_KEY
    );
    return { logs: (Array.isArray(fb.value) ? fb.value : []).slice(0, limit) };
  }

  return { error: error.message, logs: [] };
}

export async function triggerAutomationJobAction(jobKey: AutomationJobKey) {
  const authz = await writeGuard("automation");
  if (!authz.allowed) return { error: authz.error || "অনুমতি নেই" };
  if (!authz.madrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি" };

  const res: any = await executeAutomationJob(jobKey, authz.madrasaId, "manual");
  revalidatePath("/dashboard/settings/automation");
  return { success: res?.ok !== false, result: res };
}
