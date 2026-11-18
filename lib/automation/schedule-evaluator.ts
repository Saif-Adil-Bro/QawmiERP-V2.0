/**
 * App-Controlled Cron Schedule Evaluator (Asia/Dhaka BDT-aware)
 * Supports standard 5-field cron expressions: "minute hour dayOfMonth month dayOfWeek"
 * Allows admins to configure schedules from the UI without changing vercel.json or GitHub Actions.
 */

export const DEFAULT_CRON_TIMEZONE = "Asia/Dhaka";

export interface CronRuleLike {
  rule_key: string;
  cron_expression?: string | null;
  is_enabled?: boolean | null;
  last_run_at?: string | null;
  next_run_at?: string | null;
  config?: Record<string, unknown> | null;
}

interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  hour: number; // 0-23
  minute: number; // 0-59
  dayOfWeek: number; // 0 (Sun) - 6 (Sat)
}

const WEEKDAY_MAP: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timezone: string): Intl.DateTimeFormat {
  let fmt = formatterCache.get(timezone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      hour12: false,
    });
    formatterCache.set(timezone, fmt);
  }
  return fmt;
}

export function getZonedParts(date: Date, timezone = DEFAULT_CRON_TIMEZONE): ZonedParts {
  const parts = getFormatter(timezone).formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  const rawHour = Number(map.hour);
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: rawHour === 24 ? 0 : rawHour,
    minute: Number(map.minute),
    dayOfWeek: WEEKDAY_MAP[map.weekday] ?? 0,
  };
}

function parseFieldToken(token: string, min: number, max: number): Set<number> | null {
  const out = new Set<number>();
  const segments = token.split(",").map((s) => s.trim()).filter(Boolean);
  if (segments.length === 0) return null;

  for (const seg of segments) {
    const [rangePart, stepPart] = seg.split("/");
    const step = stepPart ? Number(stepPart) : 1;
    if (!Number.isInteger(step) || step <= 0) return null;

    let start = min;
    let end = max;

    if (rangePart === "*") {
      start = min;
      end = max;
    } else if (rangePart.includes("-")) {
      const [aStr, bStr] = rangePart.split("-");
      const a = Number(aStr);
      const b = Number(bStr);
      if (!Number.isInteger(a) || !Number.isInteger(b) || a < min || b > max || a > b) {
        return null;
      }
      start = a;
      end = b;
    } else {
      const val = Number(rangePart);
      if (!Number.isInteger(val) || val < min || val > max) return null;
      if (stepPart) {
        start = val;
        end = max;
      } else {
        out.add(val);
        continue;
      }
    }

    for (let v = start; v <= end; v += step) {
      out.add(v);
    }
  }

  return out.size > 0 ? out : null;
}

export interface ParsedCron {
  minutes: Set<number>;
  hours: Set<number>;
  daysOfMonth: Set<number>;
  months: Set<number>;
  daysOfWeek: Set<number>;
  domWildcard: boolean;
  dowWildcard: boolean;
}

export function parseCronExpression(expr: string): ParsedCron | null {
  const fields = String(expr || "").trim().split(/\s+/);
  if (fields.length !== 5) return null;

  const [mStr, hStr, domStr, monStr, dowStr] = fields;
  const minutes = parseFieldToken(mStr, 0, 59);
  const hours = parseFieldToken(hStr, 0, 23);
  const daysOfMonth = parseFieldToken(domStr, 1, 31);
  const months = parseFieldToken(monStr, 1, 12);
  // Allow 7 as Sunday alias
  const normalizedDow = dowStr.replace(/\b7\b/g, "0");
  const daysOfWeek = parseFieldToken(normalizedDow, 0, 6);

  if (!minutes || !hours || !daysOfMonth || !months || !daysOfWeek) return null;

  return {
    minutes,
    hours,
    daysOfMonth,
    months,
    daysOfWeek,
    domWildcard: domStr === "*",
    dowWildcard: dowStr === "*",
  };
}

export function isValidCronExpression(expr: string): boolean {
  return parseCronExpression(expr) !== null;
}

export function matchesCronAt(parsed: ParsedCron, parts: ZonedParts): boolean {
  if (!parsed.minutes.has(parts.minute)) return false;
  if (!parsed.hours.has(parts.hour)) return false;
  if (!parsed.months.has(parts.month)) return false;

  const domMatch = parsed.daysOfMonth.has(parts.day);
  const dowMatch = parsed.daysOfWeek.has(parts.dayOfWeek);

  if (parsed.domWildcard && parsed.dowWildcard) return true;
  if (parsed.domWildcard) return dowMatch;
  if (parsed.dowWildcard) return domMatch;
  return domMatch || dowMatch;
}

/**
 * Computes the next scheduled UTC Date strictly after `fromDate` in the given timezone.
 * Scans up to 35 days (50,400 minutes) — fast (< 3ms) when called on rule save or execution.
 */
export function computeNextRunAt(
  cronExpression: string,
  fromDate: Date = new Date(),
  timezone = DEFAULT_CRON_TIMEZONE
): Date | null {
  const parsed = parseCronExpression(cronExpression);
  if (!parsed) return null;

  // Start from the next whole minute
  const startMs = Math.floor(fromDate.getTime() / 60000) * 60000 + 60000;
  const maxMinutes = 35 * 24 * 60;

  for (let i = 0; i < maxMinutes; i++) {
    const candidate = new Date(startMs + i * 60000);
    const parts = getZonedParts(candidate, timezone);
    if (matchesCronAt(parsed, parts)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Determines whether an automation rule is due to run at `now`.
 * Uses a 15-minute sliding window fallback if `next_run_at` is not yet stored,
 * and enforces a cooldown so a rule never double-fires within the same 10-minute window.
 */
export function isRuleDue(
  rule: CronRuleLike,
  now: Date = new Date(),
  timezone = DEFAULT_CRON_TIMEZONE
): boolean {
  if (rule.is_enabled === false) return false;

  const nowMs = now.getTime();
  const lastRunMs = rule.last_run_at ? new Date(rule.last_run_at).getTime() : 0;

  // Cooldown guard: never run the same rule twice within 10 minutes
  if (lastRunMs && !Number.isNaN(lastRunMs) && nowMs - lastRunMs < 10 * 60 * 1000) {
    return false;
  }

  if (rule.next_run_at) {
    const nextMs = new Date(rule.next_run_at).getTime();
    if (!Number.isNaN(nextMs)) {
      return nextMs <= nowMs;
    }
  }

  // Fallback for rules without next_run_at: check if any slot in the last 15 minutes matched
  const expr = String(rule.cron_expression || "").trim();
  const parsed = parseCronExpression(expr);
  if (!parsed) return false;

  const baseMinMs = Math.floor(nowMs / 60000) * 60000;
  for (let offset = 0; offset < 15; offset++) {
    const slotMs = baseMinMs - offset * 60000;
    if (lastRunMs && slotMs <= lastRunMs) {
      break;
    }
    const parts = getZonedParts(new Date(slotMs), timezone);
    if (matchesCronAt(parsed, parts)) {
      return true;
    }
  }

  return false;
}

export type ScheduleFrequency = "every_15m" | "daily" | "weekly" | "monthly" | "custom";

export function buildCronFromPreset(input: {
  frequency: ScheduleFrequency;
  hour?: number;
  minute?: number;
  dayOfWeek?: number; // 0-6
  dayOfMonth?: number; // 1-28
  customCron?: string;
}): string {
  const minute = Math.min(59, Math.max(0, Math.floor(input.minute ?? 0)));
  const hour = Math.min(23, Math.max(0, Math.floor(input.hour ?? 9)));

  switch (input.frequency) {
    case "every_15m":
      return "*/15 * * * *";
    case "daily":
      return `${minute} ${hour} * * *`;
    case "weekly": {
      const dow = Math.min(6, Math.max(0, Math.floor(input.dayOfWeek ?? 5)));
      return `${minute} ${hour} * * ${dow}`;
    }
    case "monthly": {
      const dom = Math.min(28, Math.max(1, Math.floor(input.dayOfMonth ?? 1)));
      return `${minute} ${hour} ${dom} * *`;
    }
    case "custom":
      return String(input.customCron || "0 9 * * *").trim();
  }
}

const BANGLA_DAYS = ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার"];

export function describeCronInBangla(expr: string): string {
  const trimmed = String(expr || "").trim();
  if (trimmed === "*/15 * * * *") return "প্রতি ১৫ মিনিট পরপর";
  const fields = trimmed.split(/\s+/);
  if (fields.length !== 5) return trimmed;

  const [m, h, dom, mon, dow] = fields;
  const minNum = Number(m);
  const hourNum = Number(h);

  if (m.startsWith("*/") && h === "*" && dom === "*" && mon === "*" && dow === "*") {
    return `প্রতি ${m.slice(2)} মিনিট পরপর`;
  }

  if (Number.isInteger(minNum) && Number.isInteger(hourNum) && mon === "*") {
    const period = hourNum >= 12 ? "PM" : "AM";
    const h12 = hourNum % 12 === 0 ? 12 : hourNum % 12;
    const timeStr = `${String(h12).padStart(2, "0")}:${String(minNum).padStart(2, "0")} ${period} (BDT)`;

    if (dom === "*" && dow === "*") return `প্রতিদিন ${timeStr}`;
    if (dom === "*" && /^\d$/.test(dow)) {
      const dayName = BANGLA_DAYS[Number(dow) % 7] || dow;
      return `প্রতি ${dayName} ${timeStr}`;
    }
    if (/^\d{1,2}$/.test(dom) && dow === "*") {
      return `প্রতি মাসের ${dom} তারিখ ${timeStr}`;
    }
  }

  return `কাস্টম (${trimmed})`;
}
