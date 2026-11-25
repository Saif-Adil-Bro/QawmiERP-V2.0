import { createAdminClient } from "@/lib/supabase/admin";
import { isMissingTableError } from "@/lib/audit-log";
import { getStructuredMadrasaSetting, saveStructuredMadrasaSetting } from "@/lib/structured-config";
import { runTrackedCronJob } from "@/lib/automation/cron-auth";
import {
  runMonthlyFeeGenerationCron,
  runOverdueRemindersCron,
} from "@/lib/automation/fee-cron-service";
import { runAbsenceAlertsCron } from "@/lib/automation/attendance-cron-service";
import { processNotificationQueue } from "@/lib/notifications/orchestrator";
import { retryPendingWebhookDeliveries } from "@/lib/webhooks/dispatcher";
import { recalculateStudentRiskScores } from "@/lib/early-warning-service";
import { runFinancialAnomalyScan } from "@/lib/anomaly-detection-service";
import { getExecutiveBiSnapshot } from "@/lib/bi/executive-bi-service";
import {
  dispatchScheduledDigestNotifications,
  type DigestScheduleRecord,
} from "@/lib/bi/digest-generator";
import {
  computeNextRunAt,
  DEFAULT_CRON_TIMEZONE,
  isRuleDue,
  type CronRuleLike,
} from "@/lib/automation/schedule-evaluator";

export type AutomationJobKey =
  | "monthly_fee_generation"
  | "overdue_reminders"
  | "absence_alerts"
  | "process_queues"
  | "digest_reports"
  | "early_warning"
  | "anomalies";

export interface DefaultAutomationRule {
  rule_key: AutomationJobKey;
  name: string;
  name_bn: string;
  description: string;
  cron_expression: string;
  is_enabled: boolean;
  config?: Record<string, any>;
}

const FALLBACK_RULES_KEY = "automation_rules";

/**
 * Default schedules are expressed in Asia/Dhaka (BDT = UTC+6) so madrasa admins
 * can read and edit them directly in local Bangladesh time.
 */
export const DEFAULT_AUTOMATION_RULES: DefaultAutomationRule[] = [
  {
    rule_key: "monthly_fee_generation",
    name: "Monthly Fee Invoice Generation",
    name_bn: "মাসিক ফি ইনভয়েস অটো-জেনারেশন",
    description: "নির্ধারিত দিনে ডুপ্লিকেট ইনভয়েস সুরক্ষাসহ সকল সক্রিয় শিক্ষার্থীর মাসিক ফি ইনভয়েস তৈরি করে।",
    cron_expression: "0 7 1 * *", // মাসের ১ তারিখ সকাল ০৭:০০ BDT
    is_enabled: true,
    config: {
      timezone: "Asia/Dhaka",
      dedup_enabled: true,
      dedup_window: "billing_period",
    },
  },
  {
    rule_key: "overdue_reminders",
    name: "Overdue Fee Reminders",
    name_bn: "বকেয়া ফি রিমাইন্ডার",
    description: "প্রকৃত বকেয়া থাকা শিক্ষার্থীদের অভিভাবকদের মাল্টি-চ্যানেল রিমাইন্ডার পাঠায়।",
    cron_expression: "0 10 * * *", // প্রতিদিন সকাল ১০:০০ BDT
    is_enabled: true,
  },
  {
    rule_key: "absence_alerts",
    name: "Daily Absence Alerts",
    name_bn: "দৈনিক অনুপস্থিতি অ্যালার্ট",
    description: "ছুটির দিন ও সাপ্তাহিক ছুটি বাদ দিয়ে অনুপস্থিত শিক্ষার্থীদের অভিভাবকদের অ্যালার্ট পাঠায়।",
    cron_expression: "0 16 * * *", // প্রতিদিন বিকাল ০৪:০০ BDT
    is_enabled: true,
  },
  {
    rule_key: "process_queues",
    name: "Queue & Webhook Retry Processor",
    name_bn: "নোটিফিকেশন ও ওয়েবহুক রিট্রাই প্রসেসর",
    description: "পেন্ডিং নোটিফিকেশন ও ওয়েবহুক ডেলিভারি কিউ প্রসেস করে।",
    cron_expression: "*/15 * * * *", // প্রতি ১৫ মিনিট পরপর
    is_enabled: true,
  },
  {
    rule_key: "digest_reports",
    name: "Executive BI Digest Reports",
    name_bn: "সাপ্তাহিক/মাসিক BI ডাইজেস্ট রিপোর্ট",
    description: "নির্ধারিত সময়ে মুহতামিম ও ম্যানেজমেন্টের কাছে সামগ্রিক আর্থিক ও একাডেমিক রিপোর্ট পাঠায়।",
    cron_expression: "0 8 * * 5", // প্রতি শুক্রবার সকাল ০৮:০০ BDT
    is_enabled: true,
  },
  {
    rule_key: "early_warning",
    name: "AI Dropout & Fee Risk Scan",
    name_bn: "AI আর্লি ওয়ার্নিং ও ঝুঁকি স্ক্যান",
    description: "শিক্ষার্থীদের অনুপস্থিতি, পরীক্ষা ও বকেয়ার ঝুঁকি স্কোর (Risk Score) পুনর্গণনা করে।",
    cron_expression: "0 2 * * *", // প্রতিদিন রাত ০২:০০ BDT
    is_enabled: true,
  },
  {
    rule_key: "anomalies",
    name: "Financial & Boarding Anomaly Scan",
    name_bn: "আর্থিক ও বোর্ডিং অসঙ্গতি স্ক্যান",
    description: "বোর্ডিং বাজার খরচ, ডুপ্লিকেট ভাউচার ও অস্বাভাবিক ফি মওকুফ শনাক্ত করে।",
    cron_expression: "0 3 * * *", // প্রতিদিন রাত ০৩:০০ BDT
    is_enabled: true,
  },
];

export function mergeRulesWithDefaults(
  madrasaId: string,
  stored: any[]
): (CronRuleLike & {
  madrasa_id: string;
  name: string;
  name_bn: string;
  description: string;
  cron_expression: string;
  is_enabled: boolean;
})[] {
  const byKey = new Map<string, any>();
  for (const r of stored || []) {
    if (r?.rule_key) byKey.set(String(r.rule_key), r);
  }

  const merged = DEFAULT_AUTOMATION_RULES.map((def) => {
    const existing = byKey.get(def.rule_key);
    if (existing) {
      byKey.delete(def.rule_key);
      return {
        ...def,
        ...existing,
        madrasa_id: madrasaId,
      };
    }
    return {
      ...def,
      madrasa_id: madrasaId,
    };
  });

  // Preserve any custom rules stored beyond defaults
  for (const extra of byKey.values()) {
    merged.push({ ...extra, madrasa_id: madrasaId });
  }

  const now = new Date();
  return merged.map((rule: any) => {
    if (!rule.next_run_at && rule.is_enabled !== false && rule.cron_expression) {
      const tz = String((rule.config as any)?.timezone || DEFAULT_CRON_TIMEZONE);
      const next = computeNextRunAt(String(rule.cron_expression), now, tz);
      if (next) {
        return { ...rule, next_run_at: next.toISOString() };
      }
    }
    return rule;
  });
}

async function runDigestForMadrasa(madrasaId: string) {
  const admin = await createAdminClient();
  let schedules: DigestScheduleRecord[] = [];

  try {
    const { data, error } = await admin
      .from("digest_schedules")
      .select("*")
      .eq("madrasa_id", madrasaId)
      .eq("is_enabled", true);
    if (!error && Array.isArray(data)) {
      schedules = data as DigestScheduleRecord[];
    } else if (error && isMissingTableError(error)) {
      const fb = await getStructuredMadrasaSetting<DigestScheduleRecord[]>(
        madrasaId,
        "bi",
        "digest_schedules"
      );
      schedules = (Array.isArray(fb.value) ? fb.value : []).filter((s) => s.is_enabled);
    }
  } catch {
    schedules = [];
  }

  if (schedules.length === 0) {
    return {
      processedCount: 0,
      successCount: 0,
      failedCount: 0,
      summary: { madrasaId, schedulesChecked: 0, sent: 0, failed: 0 },
    };
  }

  const snapshot = await getExecutiveBiSnapshot(madrasaId, { months: 6 });
  let sent = 0;
  let failed = 0;

  for (const sched of schedules) {
    try {
      await dispatchScheduledDigestNotifications(madrasaId, sched, snapshot);
      sent++;
    } catch {
      failed++;
    }
  }

  return {
    processedCount: schedules.length,
    successCount: sent,
    failedCount: failed,
    summary: { madrasaId, schedulesChecked: schedules.length, sent, failed },
  };
}

export async function executeAutomationJob(
  jobKey: AutomationJobKey | string,
  madrasaId: string,
  triggerSource: "cron" | "manual" | "retry" = "cron"
) {
  switch (jobKey) {
    case "monthly_fee_generation":
      return runMonthlyFeeGenerationCron({ madrasaId, triggerSource });

    case "overdue_reminders":
      return runOverdueRemindersCron({ madrasaId, triggerSource });

    case "absence_alerts":
      return runAbsenceAlertsCron({ madrasaId, triggerSource });

    case "process_queues":
      return runTrackedCronJob("process_queues", madrasaId, triggerSource, async () => {
        const [notifSummary, webhookSummary] = await Promise.all([
          processNotificationQueue(50, madrasaId),
          retryPendingWebhookDeliveries(50, madrasaId),
        ]);
        return {
          processedCount: notifSummary.processed + webhookSummary.processed,
          successCount: notifSummary.sent + webhookSummary.delivered,
          failedCount: notifSummary.failed + webhookSummary.failed,
          summary: { notifications: notifSummary, webhooks: webhookSummary },
        };
      });

    case "digest_reports":
      return runTrackedCronJob("digest_reports", madrasaId, triggerSource, async () =>
        runDigestForMadrasa(madrasaId)
      );

    case "early_warning":
      return runTrackedCronJob("early_warning", madrasaId, triggerSource, async () => {
        const summary = await recalculateStudentRiskScores(madrasaId);
        const totalStudents = summary.risk_scores?.length || 0;
        return {
          processedCount: totalStudents,
          successCount: totalStudents,
          failedCount: 0,
          summary: {
            madrasaId,
            totalStudents,
            criticalCount: summary.risk_distribution?.CRITICAL || 0,
            highCount: summary.risk_distribution?.HIGH || 0,
          },
        };
      });

    case "anomalies":
      return runTrackedCronJob("anomalies", madrasaId, triggerSource, async () => {
        const scan = await runFinancialAnomalyScan(madrasaId, { lookbackDays: 60 });
        return {
          processedCount: scan.detectedCount,
          successCount: scan.newlyCreatedCount,
          failedCount: 0,
          summary: {
            madrasaId,
            detectedCount: scan.detectedCount,
            newlyCreatedCount: scan.newlyCreatedCount,
            deduplicatedCount: scan.deduplicatedCount,
          },
        };
      });

    default:
      return {
        ok: false,
        jobKey,
        status: "FAILED" as const,
        error: `Unknown automation jobKey: ${jobKey}`,
      };
  }
}

async function loadMadrasaRules(madrasaId: string) {
  const admin = await createAdminClient();
  const { data, error } = await admin
    .from("automation_rules")
    .select("*")
    .eq("madrasa_id", madrasaId);

  if (!error) {
    return {
      usingSql: true,
      rules: mergeRulesWithDefaults(madrasaId, data || []),
    };
  }

  if (isMissingTableError(error)) {
    const fb = await getStructuredMadrasaSetting<any[]>(
      madrasaId,
      "automation",
      FALLBACK_RULES_KEY
    );
    return {
      usingSql: false,
      rules: mergeRulesWithDefaults(madrasaId, Array.isArray(fb.value) ? fb.value : []),
    };
  }

  return { usingSql: true, rules: mergeRulesWithDefaults(madrasaId, []) };
}

async function markRuleExecuted(
  madrasaId: string,
  rule: any,
  usingSql: boolean,
  now: Date
) {
  const tz = String((rule.config as any)?.timezone || DEFAULT_CRON_TIMEZONE);
  const nextRun = computeNextRunAt(String(rule.cron_expression || ""), now, tz);
  const lastRunIso = now.toISOString();
  const nextRunIso = nextRun ? nextRun.toISOString() : null;

  if (usingSql) {
    const admin = await createAdminClient();
    await admin.from("automation_rules").upsert(
      {
        madrasa_id: madrasaId,
        rule_key: rule.rule_key,
        name: rule.name || rule.rule_key,
        name_bn: rule.name_bn || rule.name || rule.rule_key,
        description: rule.description || null,
        cron_expression: rule.cron_expression,
        is_enabled: rule.is_enabled !== false,
        config: rule.config || {},
        last_run_at: lastRunIso,
        next_run_at: nextRunIso,
        updated_at: lastRunIso,
      },
      { onConflict: "madrasa_id,rule_key" }
    );
    return;
  }

  const fb = await getStructuredMadrasaSetting<any[]>(
    madrasaId,
    "automation",
    FALLBACK_RULES_KEY
  );
  const list = mergeRulesWithDefaults(madrasaId, Array.isArray(fb.value) ? fb.value : []);
  const updated = list.map((r) =>
    r.rule_key === rule.rule_key
      ? { ...r, last_run_at: lastRunIso, next_run_at: nextRunIso, updated_at: lastRunIso }
      : r
  );
  await saveStructuredMadrasaSetting(madrasaId, "automation", FALLBACK_RULES_KEY, updated);
}

/**
 * Records `last_run_at` & `next_run_at` when an admin triggers a job manually
 * from `/dashboard/settings/automation` ("এখনই চালান").
 */
export async function recordManualRuleExecution(
  madrasaId: string,
  jobKey: AutomationJobKey | string,
  now: Date = new Date()
) {
  const { usingSql, rules } = await loadMadrasaRules(madrasaId);
  const rule = rules.find((r) => r.rule_key === jobKey);
  if (!rule) return;
  await markRuleExecuted(madrasaId, rule, usingSql, now);
}

/**
 * Master Dispatcher: evaluates every madrasa's app-configured `automation_rules`
 * in Asia/Dhaka (BDT) timezone and runs any jobs that are due.
 */
export async function runMasterCronDispatch(opts: {
  madrasaId?: string | null;
  triggerSource?: "cron" | "manual";
  now?: Date;
} = {}) {
  const now = opts.now || new Date();
  const triggerSource = opts.triggerSource || "cron";
  const admin = await createAdminClient();

  let madrasaIds: string[] = [];
  if (opts.madrasaId) {
    madrasaIds = [opts.madrasaId];
  } else {
    const { data: madrasas } = await admin.from("madrasas").select("id");
    madrasaIds = (madrasas || []).map((m: any) => String(m.id));
  }

  const perTenantResults: Array<{
    madrasaId: string;
    executed: Array<{ ruleKey: string; ok: boolean }>;
    skippedCount: number;
  }> = [];

  for (const madrasaId of madrasaIds) {
    const { usingSql, rules } = await loadMadrasaRules(madrasaId);
    const executed: Array<{ ruleKey: string; ok: boolean }> = [];
    let skippedCount = 0;

    for (const rule of rules) {
      const tz = String((rule.config as any)?.timezone || DEFAULT_CRON_TIMEZONE);
      if (!isRuleDue(rule, now, tz)) {
        skippedCount++;
        continue;
      }

      const outcome: any = await executeAutomationJob(rule.rule_key, madrasaId, triggerSource);
      await markRuleExecuted(madrasaId, rule, usingSql, now);
      executed.push({
        ruleKey: rule.rule_key,
        ok: outcome?.ok !== false,
      });
    }

    perTenantResults.push({ madrasaId, executed, skippedCount });
  }

  return {
    ok: true,
    dispatchedAt: now.toISOString(),
    tenantsChecked: madrasaIds.length,
    totalExecuted: perTenantResults.reduce((sum, t) => sum + t.executed.length, 0),
    results: perTenantResults,
  };
}
