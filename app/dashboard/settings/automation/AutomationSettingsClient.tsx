"use client";

import { useState, useTransition } from "react";
import {
  Clock,
  Play,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  CalendarClock,
  Save,
  X,
  ShieldCheck,
} from "lucide-react";
import {
  getAutomationRulesAction,
  getJobExecutionLogsAction,
  saveAutomationRuleAction,
  triggerAutomationJobAction,
} from "@/app/actions/automation";
import type { AutomationJobKey } from "@/lib/automation/master-dispatcher";
import {
  buildCronFromPreset,
  describeCronInBangla,
  type ScheduleFrequency,
} from "@/lib/automation/schedule-evaluator";
import { toBanglaNumber } from "@/lib/numberToBangla";

interface Props {
  initialRules: any[];
  initialLogs: any[];
}

const WEEKDAY_OPTIONS = [
  { value: 5, label: "শুক্রবার" },
  { value: 6, label: "শনিবার" },
  { value: 0, label: "রবিবার" },
  { value: 1, label: "সোমবার" },
  { value: 2, label: "মঙ্গলবার" },
  { value: 3, label: "বুধবার" },
  { value: 4, label: "বৃহস্পতিবার" },
];

function detectPresetFromCron(expr: string): {
  frequency: ScheduleFrequency;
  hour: number;
  minute: number;
  dayOfWeek: number;
  dayOfMonth: number;
  customCron: string;
} {
  const trimmed = String(expr || "0 9 * * *").trim();
  if (trimmed === "*/15 * * * *") {
    return { frequency: "every_15m", hour: 9, minute: 0, dayOfWeek: 5, dayOfMonth: 1, customCron: trimmed };
  }
  const parts = trimmed.split(/\s+/);
  if (parts.length === 5) {
    const [m, h, dom, mon, dow] = parts;
    const min = Number(m);
    const hr = Number(h);
    if (Number.isInteger(min) && Number.isInteger(hr) && mon === "*") {
      if (dom === "*" && dow === "*") {
        return { frequency: "daily", hour: hr, minute: min, dayOfWeek: 5, dayOfMonth: 1, customCron: trimmed };
      }
      if (dom === "*" && /^\d$/.test(dow)) {
        return {
          frequency: "weekly",
          hour: hr,
          minute: min,
          dayOfWeek: Number(dow) % 7,
          dayOfMonth: 1,
          customCron: trimmed,
        };
      }
      if (/^\d{1,2}$/.test(dom) && dow === "*") {
        return {
          frequency: "monthly",
          hour: hr,
          minute: min,
          dayOfWeek: 5,
          dayOfMonth: Math.min(28, Math.max(1, Number(dom))),
          customCron: trimmed,
        };
      }
    }
  }
  return { frequency: "custom", hour: 9, minute: 0, dayOfWeek: 5, dayOfMonth: 1, customCron: trimmed };
}

function formatBdtDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("bn-BD", {
    timeZone: "Asia/Dhaka",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function AutomationSettingsClient({ initialRules, initialLogs }: Props) {
  const [rules, setRules] = useState<any[]>(initialRules);
  const [logs, setLogs] = useState<any[]>(initialLogs);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [editingRuleKey, setEditingRuleKey] = useState<string | null>(null);
  const [frequency, setFrequency] = useState<ScheduleFrequency>("daily");
  const [hour, setHour] = useState<number>(9);
  const [minute, setMinute] = useState<number>(0);
  const [dayOfWeek, setDayOfWeek] = useState<number>(5);
  const [dayOfMonth, setDayOfMonth] = useState<number>(1);
  const [customCron, setCustomCron] = useState<string>("0 9 * * *");

  const reload = () => {
    startTransition(async () => {
      const [r, l] = await Promise.all([
        getAutomationRulesAction(),
        getJobExecutionLogsAction(50),
      ]);
      setRules(r.rules || []);
      setLogs(l.logs || []);
    });
  };

  const openScheduleEditor = (rule: any) => {
    const preset = detectPresetFromCron(rule.cron_expression);
    setFrequency(preset.frequency);
    setHour(preset.hour);
    setMinute(preset.minute);
    setDayOfWeek(preset.dayOfWeek);
    setDayOfMonth(preset.dayOfMonth);
    setCustomCron(preset.customCron);
    setEditingRuleKey(rule.rule_key);
    setFeedback(null);
  };

  const handleSaveSchedule = (rule: any) => {
    setFeedback(null);
    const nextCron = buildCronFromPreset({
      frequency,
      hour,
      minute,
      dayOfWeek,
      dayOfMonth,
      customCron,
    });

    startTransition(async () => {
      const res = await saveAutomationRuleAction({
        rule_key: rule.rule_key,
        name: rule.name,
        name_bn: rule.name_bn,
        description: rule.description,
        cron_expression: nextCron,
        is_enabled: rule.is_enabled !== false,
        config: { ...(rule.config || {}), timezone: "Asia/Dhaka" },
      });
      if (res.error) {
        setFeedback({ type: "err", text: res.error });
      } else {
        setFeedback({
          type: "ok",
          text: `'${rule.name_bn || rule.name}'-এর নতুন সময়সূচি (${describeCronInBangla(nextCron)}) সংরক্ষণ করা হয়েছে।`,
        });
        setEditingRuleKey(null);
        reload();
      }
    });
  };

  const handleToggle = (rule: any) => {
    setFeedback(null);
    startTransition(async () => {
      const res = await saveAutomationRuleAction({
        rule_key: rule.rule_key,
        name: rule.name,
        name_bn: rule.name_bn,
        description: rule.description,
        cron_expression: rule.cron_expression,
        is_enabled: !rule.is_enabled,
        config: rule.config,
      });
      if (res.error) {
        setFeedback({ type: "err", text: res.error });
      } else {
        setFeedback({
          type: "ok",
          text: `'${rule.name_bn || rule.name}' ${!rule.is_enabled ? "চালু" : "বন্ধ"} করা হয়েছে।`,
        });
        reload();
      }
    });
  };

  const handleRunNow = (jobKey: AutomationJobKey) => {
    setFeedback(null);
    startTransition(async () => {
      const res = await triggerAutomationJobAction(jobKey);
      if (res.error) {
        setFeedback({ type: "err", text: res.error });
      } else {
        setFeedback({ type: "ok", text: `জব '${jobKey}' সফলভাবে সম্পন্ন হয়েছে।` });
        reload();
      }
    });
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
            <Clock className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            শিডিউলড ক্রন ও অটোমেশন ইঞ্জিন
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            অ্যাপ থেকেই প্রতিটি অটোমেশন জবের সময়সূচি (বাংলাদেশ সময় BDT), চালু/বন্ধ ও ম্যানুয়াল রান নিয়ন্ত্রণ করুন
          </p>
        </div>
        <button
          type="button"
          onClick={reload}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
          রিফ্রেশ করুন
        </button>
      </div>

      {feedback && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            feedback.type === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* DEC-1 Scheduler & Monthly Fee Deduplication Guard Status */}
      <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50/90 to-teal-50/70 p-4 sm:p-5 shadow-xs dark:border-emerald-900/60 dark:from-emerald-950/40 dark:to-teal-950/30">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-emerald-600/10 p-2.5 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 shrink-0">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-emerald-950 dark:text-emerald-100">
                মাসিক ফি অটোমেশন ও ডুপ্লিকেট সুরক্ষা সক্রিয়
              </h2>
              <p className="mt-0.5 text-xs text-emerald-800/90 dark:text-emerald-300/90">
                একই শিক্ষার্থী, ফি-খাত ও বিলিং পিরিয়ডের (student + fee_type + billing_period) জন্য স্বয়ংক্রিয়ভাবে ডুপ্লিকেট ইনভয়েস ব্লক করা হয়।
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300/80 bg-white/80 px-2.5 py-1 text-emerald-900 dark:border-emerald-800 dark:bg-slate-900/70 dark:text-emerald-200">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              সক্রিয় রুল: {toBanglaNumber(rules.filter((r) => r.is_enabled !== false).length)} / {toBanglaNumber(rules.length)}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-teal-300/80 bg-white/80 px-2.5 py-1 text-teal-900 dark:border-teal-800 dark:bg-slate-900/70 dark:text-teal-200">
              <CalendarClock className="h-3.5 w-3.5 text-teal-600" />
              সময় অঞ্চল: Asia/Dhaka (BDT)
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {rules.map((rule) => {
          const isEditing = editingRuleKey === rule.rule_key;
          return (
            <div
              key={rule.rule_key}
              className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="font-semibold text-slate-900 dark:text-slate-100">
                      {rule.name_bn || rule.name}
                    </h2>
                    <p className="mt-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                      {describeCronInBangla(rule.cron_expression)}
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      {rule.rule_key} · cron: {rule.cron_expression}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggle(rule)}
                    disabled={isPending}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      rule.is_enabled
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                    }`}
                  >
                    {rule.is_enabled ? "চালু" : "বন্ধ"}
                  </button>
                </div>

                {rule.description && (
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                    {rule.description}
                  </p>
                )}

                <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-400">
                  <div>
                    <span className="block text-[11px] text-slate-400">সর্বশেষ চলেছে</span>
                    <span className="font-medium text-slate-700 dark:text-slate-200">
                      {formatBdtDateTime(rule.last_run_at)}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[11px] text-slate-400">পরবর্তী নির্ধারিত সময়</span>
                    <span className="font-medium text-slate-700 dark:text-slate-200">
                      {formatBdtDateTime(rule.next_run_at)}
                    </span>
                  </div>
                </div>

                {isEditing && (
                  <div className="mt-3 space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/40 p-3 dark:border-emerald-800/60 dark:bg-emerald-950/20">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                          ধরন (Frequency)
                        </label>
                        <select
                          value={frequency}
                          onChange={(e) => setFrequency(e.target.value as ScheduleFrequency)}
                          className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        >
                          <option value="every_15m">প্রতি ১৫ মিনিট পরপর</option>
                          <option value="daily">প্রতিদিন</option>
                          <option value="weekly">প্রতি সপ্তাহে</option>
                          <option value="monthly">প্রতি মাসে</option>
                          <option value="custom">কাস্টম Cron</option>
                        </select>
                      </div>

                      {frequency === "weekly" && (
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                            বার
                          </label>
                          <select
                            value={dayOfWeek}
                            onChange={(e) => setDayOfWeek(Number(e.target.value))}
                            className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                          >
                            {WEEKDAY_OPTIONS.map((w) => (
                              <option key={w.value} value={w.value}>
                                {w.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {frequency === "monthly" && (
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                            মাসের তারিখ (১–২৮)
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={28}
                            value={dayOfMonth}
                            onChange={(e) => setDayOfMonth(Number(e.target.value))}
                            className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                          />
                        </div>
                      )}
                    </div>

                    {(frequency === "daily" || frequency === "weekly" || frequency === "monthly") && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                            ঘণ্টা (BDT 0–23)
                          </label>
                          <select
                            value={hour}
                            onChange={(e) => setHour(Number(e.target.value))}
                            className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                          >
                            {Array.from({ length: 24 }, (_, i) => (
                              <option key={i} value={i}>
                                {String(i).padStart(2, "0")}:00 ({i % 12 === 0 ? 12 : i % 12}{" "}
                                {i >= 12 ? "PM" : "AM"})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                            মিনিট
                          </label>
                          <select
                            value={minute}
                            onChange={(e) => setMinute(Number(e.target.value))}
                            className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                          >
                            {[0, 15, 30, 45].map((m) => (
                              <option key={m} value={m}>
                                {String(m).padStart(2, "0")} মিনিট
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    {frequency === "custom" && (
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">
                          কাস্টম Cron Expression (BDT)
                        </label>
                        <input
                          type="text"
                          value={customCron}
                          onChange={(e) => setCustomCron(e.target.value)}
                          placeholder="0 9 * * *"
                          className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        />
                      </div>
                    )}

                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingRuleKey(null)}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      >
                        <X className="h-3.5 w-3.5" />
                        বাতিল
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveSchedule(rule)}
                        disabled={isPending}
                        className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                      >
                        <Save className="h-3.5 w-3.5" />
                        সময়সূচি সেভ করুন
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => (isEditing ? setEditingRuleKey(null) : openScheduleEditor(rule))}
                  disabled={isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <CalendarClock className="h-3.5 w-3.5" />
                  সময়সূচি পরিবর্তন
                </button>
                <button
                  type="button"
                  onClick={() => handleRunNow(rule.rule_key)}
                  disabled={isPending}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-700"
                >
                  <Play className="h-3.5 w-3.5" />
                  এখনই চালান
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">
          সাম্প্রতিক জব এক্সিকিউশন লগ ({toBanglaNumber(logs.length)})
        </h2>
        {logs.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">কোনো এক্সিকিউশন লগ নেই।</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                <tr>
                  <th className="py-2 pr-3">জব</th>
                  <th className="py-2 pr-3">উৎস</th>
                  <th className="py-2 pr-3">অবস্থা</th>
                  <th className="py-2 pr-3">প্রসেসড / সফল / ব্যর্থ</th>
                  <th className="py-2">সময়কাল</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="py-2 pr-3 font-medium text-slate-800 dark:text-slate-200">
                      {log.job_key}
                    </td>
                    <td className="py-2 pr-3 text-slate-600 dark:text-slate-300">
                      {log.trigger_source}
                    </td>
                    <td className="py-2 pr-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                          log.status === "SUCCESS"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                            : log.status === "FAILED"
                              ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                              : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                        }`}
                      >
                        {log.status === "SUCCESS" ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <AlertTriangle className="h-3 w-3" />
                        )}
                        {log.status}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-slate-600 dark:text-slate-300">
                      <div>
                        {toBanglaNumber(log.processed_count || 0)} /{" "}
                        {toBanglaNumber(log.success_count || 0)} /{" "}
                        {toBanglaNumber(log.failed_count || 0)}
                      </div>
                      {typeof log.summary?.skippedExisting === "number" && (
                        <div className="text-[11px] text-emerald-700 dark:text-emerald-400">
                          ডুপ্লিকেট স্কিপ: {toBanglaNumber(log.summary.skippedExisting)}
                        </div>
                      )}
                    </td>
                    <td className="py-2 text-xs text-slate-500 dark:text-slate-400">
                      {toBanglaNumber(log.duration_ms || 0)} ms
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
