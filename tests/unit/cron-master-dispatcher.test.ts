import { describe, expect, it } from "vitest";
import {
  buildCronFromPreset,
  computeNextRunAt,
  describeCronInBangla,
  isRuleDue,
  isValidCronExpression,
} from "@/lib/automation/schedule-evaluator";

describe("App-Controlled Cron Schedule Evaluator (Asia/Dhaka BDT)", () => {
  it("validates standard 5-field cron expressions", () => {
    expect(isValidCronExpression("0 7 1 * *")).toBe(true);
    expect(isValidCronExpression("*/15 * * * *")).toBe(true);
    expect(isValidCronExpression("0 8 * * 5")).toBe(true);
    expect(isValidCronExpression("invalid")).toBe(false);
    expect(isValidCronExpression("99 99 * * *")).toBe(false);
  });

  it("builds valid cron expressions from UI presets and formats Bangla descriptions", () => {
    const daily = buildCronFromPreset({ frequency: "daily", hour: 10, minute: 30 });
    expect(daily).toBe("30 10 * * *");
    expect(describeCronInBangla(daily)).toContain("10:30 AM (BDT)");

    const weekly = buildCronFromPreset({ frequency: "weekly", hour: 8, minute: 0, dayOfWeek: 5 });
    expect(weekly).toBe("0 8 * * 5");
    expect(describeCronInBangla(weekly)).toContain("শুক্রবার");

    const monthly = buildCronFromPreset({ frequency: "monthly", hour: 7, minute: 0, dayOfMonth: 1 });
    expect(monthly).toBe("0 7 1 * *");
    expect(describeCronInBangla(monthly)).toContain("1 তারিখ");

    expect(buildCronFromPreset({ frequency: "every_15m" })).toBe("*/15 * * * *");
  });

  it("computes next_run_at accurately in Asia/Dhaka (UTC+6)", () => {
    // 2026-11-18T03:50:00Z = 2026-11-18 09:50 BDT -> next 10:00 BDT is 04:00Z
    const now = new Date("2026-11-18T03:50:00.000Z");
    const next = computeNextRunAt("0 10 * * *", now, "Asia/Dhaka");
    expect(next?.toISOString()).toBe("2026-11-18T04:00:00.000Z");
  });

  it("respects is_enabled, next_run_at, and 10-minute cooldown in isRuleDue", () => {
    const now = new Date("2026-11-18T04:05:00.000Z"); // 10:05 BDT

    expect(
      isRuleDue({ rule_key: "overdue_reminders", is_enabled: false, next_run_at: "2026-11-18T04:00:00.000Z" }, now)
    ).toBe(false);

    expect(
      isRuleDue({ rule_key: "overdue_reminders", is_enabled: true, next_run_at: "2026-11-18T04:00:00.000Z" }, now)
    ).toBe(true);

    // Ran 3 minutes ago -> cooldown blocks double-run
    expect(
      isRuleDue(
        {
          rule_key: "overdue_reminders",
          is_enabled: true,
          next_run_at: "2026-11-18T04:00:00.000Z",
          last_run_at: "2026-11-18T04:02:00.000Z",
        },
        now
      )
    ).toBe(false);

    // Fallback without next_run_at: 10:00 BDT was 5 minutes ago -> due
    expect(
      isRuleDue({ rule_key: "overdue_reminders", is_enabled: true, cron_expression: "0 10 * * *" }, now)
    ).toBe(true);
  });
});
