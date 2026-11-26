import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  parsePunchReport,
  uniquePunchLogs,
  getDeviceConnectionStatus,
  type BiometricDevice,
  type BiometricPunchLog,
} from "@/lib/biometric";
import { isBiometricStorageMissingError } from "@/lib/biometric-ingest";
import { billPeriodKey } from "@/lib/finance/bill-period";
import { buildMonthlyFeeDedupKey } from "@/lib/automation/fee-cron-service";
import { mergeRulesWithDefaults } from "@/lib/automation/master-dispatcher";
import { isRuleDue } from "@/lib/automation/schedule-evaluator";
import { AUDIT_MODULE_LABELS_BN } from "@/lib/audit-log";

describe("Round 8 regression suite", () => {
  it("P1: parses valid Dhaka punches, rejects non-numeric IDs & bad dates, and deduplicates repeat imports", () => {
    const fixture = [
      "UserID\tDateTime\tStatus",
      "480004\t2026-11-23 07:55:00\t0",
      "480006\t2026-11-23 08:05:00\t0",
      "999999\t2026-11-23 08:10:00\t0",
      "ABC\t2026-11-23 08:12:00\t0",
      "480004\t23/11/2026 08:15\t0",
      "480004\t2026-11-23 00:05:00\t0",
    ].join("\n");

    const { records, rejected } = parsePunchReport(fixture);
    expect(records).toHaveLength(4);
    expect(rejected.map((r) => r.line)).toEqual([5, 6]);
    // 07:55 Asia/Dhaka (+06:00) == 01:55 UTC (no +6h shift!)
    expect(records[0].timestamp).toBe("2026-11-23T01:55:00.000Z");
    expect(records[0].date).toBe("2026-11-23");
    // 00:05 Asia/Dhaka stays 2026-11-23 in Dhaka date even though UTC is 2026-11-22T18:05:00.000Z
    expect(records[3].timestamp).toBe("2026-11-22T18:05:00.000Z");
    expect(records[3].date).toBe("2026-11-23");

    const duplicateLog: BiometricPunchLog = {
      id: "log-1",
      madrasa_id: "m1",
      device_id: "dev-1",
      device_name: "Main Gate",
      device_user_id: "480004",
      user_type: "unknown",
      punch_time: records[0].timestamp,
      punch_date: records[0].date,
      punch_type: "check_in",
      status: "unmapped",
      parser_version: 2,
      sync_mode: "usb_import",
      created_at: new Date().toISOString(),
    };
    const deduped = uniquePunchLogs([
      duplicateLog,
      { ...duplicateLog, id: "log-2" },
      { ...duplicateLog, id: "log-3", status: "processed" },
    ]);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].status).toBe("processed");
  });

  it("P1: device with only USB last_sync_at (no last_ping_at) stays waiting, never Live", () => {
    const dev: BiometricDevice = {
      id: "d1",
      madrasa_id: "m1",
      name: "মেইন গেট বায়োমেট্রিক পাঞ্চ মেশিন",
      device_model: "ZKTeco_K40",
      serial_number: "ZK-1001",
      protocol: "offline_usb",
      target_audience: "all",
      status: "active",
      secret_token: "bio_TEST",
      last_sync_at: new Date().toISOString(),
      total_punches_count: 5,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const status = getDeviceConnectionStatus(dev);
    expect(status.status).toBe("waiting");
  });

  it("P1: recognizes missing PG table/RPC errors cleanly for graceful fallback", () => {
    expect(isBiometricStorageMissingError({ code: "42P01" })).toBe(true);
    expect(isBiometricStorageMissingError({ code: "42883" })).toBe(true);
    expect(isBiometricStorageMissingError({ code: "PGRST202" })).toBe(true);
    expect(isBiometricStorageMissingError({ code: "PGRST205" })).toBe(true);
    expect(
      isBiometricStorageMissingError({
        code: "400",
        message: "Could not find the function public.biometric_event_counts in the schema cache",
      }),
    ).toBe(true);
    expect(
      isBiometricStorageMissingError({ code: "23505", message: "duplicate key" }),
    ).toBe(false);
  });

  it("P2 (DEC-1): normalizes all Bengali & English December period formats to 2026-12 for zero-duplicate billing", () => {
    const formats = [
      "2026-12",
      "2026-12-01",
      "ডিসেম্বর (December) 2026",
      "December 2026",
      "Dec 2026",
      "ডিসেম্বর ২০২৬",
      "ডিসেম্বর 2026",
    ];
    for (const fmt of formats) {
      expect(billPeriodKey(fmt)).toBe("2026-12");
    }

    const existing = new Set<string>();
    const students = ["s1", "s2", "s3", "s4", "s5", "s6"];
    students.forEach((sid, idx) => {
      existing.add(
        buildMonthlyFeeDedupKey(sid, "tuition-1", formats[idx % formats.length]),
      );
    });
    // Automated Dec 1 cron checking "2026-12" must match all 6 students (0 duplicates)
    const duplicatesCreated = students.filter(
      (sid) => !existing.has(buildMonthlyFeeDedupKey(sid, "tuition-1", "2026-12")),
    );
    expect(duplicatesCreated).toHaveLength(0);
  });

  it("P2 (DEC-1): default process_queues rule is due on 15-minute schedule", () => {
    const rules = mergeRulesWithDefaults("m1", [], false);
    const queueRule = rules.find((r) => r.rule_key === "process_queues");
    expect(queueRule).toBeDefined();
    expect(queueRule?.is_enabled).toBe(true);
    const due = isRuleDue(
      queueRule!,
      new Date("2026-11-30T18:00:00.000Z"),
    );
    expect(due).toBe(true);
  });

  it("P3: audit module labels include attendance and biometric modules", () => {
    expect(AUDIT_MODULE_LABELS_BN.attendance).toBeTruthy();
    expect(AUDIT_MODULE_LABELS_BN.biometric).toBeTruthy();
  });

  it("P4 (S2) & P1 hygiene: unsaved-selection guards wired without window.confirm/alert", () => {
    const classSubjects = fs.readFileSync(
      path.join(process.cwd(), "app/dashboard/classes/[id]/subjects/ClassSubjectsManager.tsx"),
      "utf8",
    );
    const teacherSubjects = fs.readFileSync(
      path.join(process.cwd(), "app/dashboard/teachers/[id]/subjects/AssignTeacherSubjectForm.tsx"),
      "utf8",
    );
    const biometricUi = fs.readFileSync(
      path.join(process.cwd(), "app/dashboard/attendance/devices/BiometricDevicesClient.tsx"),
      "utf8",
    );

    expect(classSubjects).toContain("unsaved-selection-banner");
    expect(classSubjects).toContain("acquireSaveGuard");
    expect(teacherSubjects).toContain("unsaved-selection-banner");
    expect(teacherSubjects).toContain("acquireSaveGuard");
    expect(biometricUi).not.toMatch(/window\.(confirm|alert|open)\(/);
    expect(biometricUi).toContain("পুরোনো আনম্যাপড পাঞ্চ পুনঃপ্রক্রিয়া");
  });
});
