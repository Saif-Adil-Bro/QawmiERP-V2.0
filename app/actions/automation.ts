"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeGuard } from "@/lib/action-authorization";
import { isMissingTableError } from "@/lib/audit-log";
import { getStructuredMadrasaSetting, saveStructuredMadrasaSetting } from "@/lib/structured-config";
import {
  runMonthlyFeeGenerationCron,
  runOverdueRemindersCron,
} from "@/lib/automation/fee-cron-service";
import { runAbsenceAlertsCron } from "@/lib/automation/attendance-cron-service";
import { processNotificationQueue } from "@/lib/notifications/orchestrator";
import { retryPendingWebhookDeliveries } from "@/lib/webhooks/dispatcher";
import { runTrackedCronJob } from "@/lib/automation/cron-auth";

const FALLBACK_RULES_KEY = "automation_rules";
const FALLBACK_LOGS_KEY = "job_execution_logs";

const DEFAULT_RULES = [
  {
    rule_key: "monthly_fee_generation",
    name: "Monthly Fee Invoice Generation",
    name_bn: "মাসিক ফি ইনভয়েস অটো-জেনারেশন",
    description: "প্রতি মাসের ১ তারিখে সকল সক্রিয় শিক্ষার্থীর মাসিক ফি ইনভয়েস তৈরি করে।",
    cron_expression: "0 1 1 * *",
    is_enabled: true,
  },
  {
    rule_key: "overdue_reminders",
    name: "Overdue Fee Reminders",
    name_bn: "বকেয়া ফি রিমাইন্ডার",
    description: "প্রকৃত বকেয়া থাকা শিক্ষার্থীদের অভিভাবকদের মাল্টি-চ্যানেল রিমাইন্ডার পাঠায়।",
    cron_expression: "0 4 * * *",
    is_enabled: true,
  },
  {
    rule_key: "absence_alerts",
    name: "Daily Absence Alerts",
    name_bn: "দৈনিক অনুপস্থিতি অ্যালার্ট",
    description: "ছুটির দিন ও সাপ্তাহিক ছুটি বাদ দিয়ে অনুপস্থিত শিক্ষার্থীদের অভিভাবকদের অ্যালার্ট পাঠায়।",
    cron_expression: "0 10 * * *",
    is_enabled: true,
  },
  {
    rule_key: "process_queues",
    name: "Queue & Webhook Retry Processor",
    name_bn: "নোটিফিকেশন ও ওয়েবহুক রিট্রাই প্রসেসর",
    description: "পেন্ডিং নোটিফিকেশন ও ওয়েবহুক ডেলিভারি কিউ প্রসেস করে।",
    cron_expression: "*/15 * * * *",
    is_enabled: true,
  },
];

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
    if (data && data.length > 0) return { rules: data };
    return { rules: DEFAULT_RULES.map((r) => ({ ...r, madrasa_id: authz.madrasaId })) };
  }

  if (isMissingTableError(error)) {
    const fb = await getStructuredMadrasaSetting<any[]>(
      authz.madrasaId,
      "automation",
      FALLBACK_RULES_KEY
    );
    const rules = Array.isArray(fb.value) && fb.value.length > 0 ? fb.value : DEFAULT_RULES;
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

  const nowIso = new Date().toISOString();
  const record = {
    madrasa_id: authz.madrasaId,
    rule_key: String(input.rule_key).trim(),
    name: String(input.name || input.rule_key).trim(),
    name_bn: input.name_bn || input.name,
    description: input.description || null,
    cron_expression: input.cron_expression || "0 6 * * *",
    is_enabled: input.is_enabled,
    config: input.config || {},
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
      summary: `অটোমেশন রুল '${record.name_bn || record.name}' ${record.is_enabled ? "চালু" : "বন্ধ"} করা হয়েছে`,
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
    const list = Array.isArray(fb.value) && fb.value.length > 0 ? [...fb.value] : [...DEFAULT_RULES];
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

export async function triggerAutomationJobAction(
  jobKey: "monthly_fee_generation" | "overdue_reminders" | "absence_alerts" | "process_queues"
) {
  const authz = await writeGuard("automation");
  if (!authz.allowed) return { error: authz.error || "অনুমতি নেই" };
  if (!authz.madrasaId) return { error: "মাদ্রাসা পাওয়া যায়নি" };

  if (jobKey === "monthly_fee_generation") {
    const res = await runMonthlyFeeGenerationCron({
      madrasaId: authz.madrasaId,
      triggerSource: "manual",
    });
    revalidatePath("/dashboard/settings/automation");
    return { success: true, result: res };
  }

  if (jobKey === "overdue_reminders") {
    const res = await runOverdueRemindersCron({
      madrasaId: authz.madrasaId,
      triggerSource: "manual",
    });
    revalidatePath("/dashboard/settings/automation");
    return { success: true, result: res };
  }

  if (jobKey === "absence_alerts") {
    const res = await runAbsenceAlertsCron({
      madrasaId: authz.madrasaId,
      triggerSource: "manual",
    });
    revalidatePath("/dashboard/settings/automation");
    return { success: true, result: res };
  }

  const tracked = await runTrackedCronJob("process_queues", authz.madrasaId, "manual", async () => {
    const [notifSummary, webhookSummary] = await Promise.all([
      processNotificationQueue(50, authz.madrasaId),
      retryPendingWebhookDeliveries(50, authz.madrasaId),
    ]);
    return {
      processedCount: notifSummary.processed + webhookSummary.processed,
      successCount: notifSummary.sent + webhookSummary.delivered,
      failedCount: notifSummary.failed + webhookSummary.failed,
      summary: { notifications: notifSummary, webhooks: webhookSummary },
    };
  });

  revalidatePath("/dashboard/settings/automation");
  return { success: tracked.ok, result: tracked };
}
