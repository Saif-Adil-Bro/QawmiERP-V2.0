import { describe, it, expect, vi } from "vitest";
import {
  parsePunchReport,
  parsePunch,
  historicalPunch,
  uniquePunchLogs,
  type BiometricPunchLog,
} from "@/lib/biometric";
import { resolveTeacherIdentity } from "@/lib/teacher-identity";
import { isRuleDue } from "@/lib/automation/schedule-evaluator";
import { mergeRulesWithDefaults } from "@/lib/automation/master-dispatcher";

describe("Round 7 acceptance boundaries", () => {
  it("rejects invalid input by source line; no guess at today; Dhaka wall time is not UTC", () => {
    const report = parsePunchReport(
      "PIN,DateTime\r\n0009\t2026-11-23 07:55\r\n999999,2026-11-23T01:55:00Z\r\nABC,2026-11-23 07:55\r\n480001,23/11/2026 08:15\r\n480001,2026-02-29 01:00\r\n0009,2026-01-01 24:00",
    );
    expect(report.rejected.map((r) => r.line)).toEqual([4, 5, 6, 7]);
    expect(report.records.map((r) => r.timestamp)).toEqual(
      Array(2).fill("2026-11-23T01:55:00.000Z"),
    );
    expect(report.records[0].device_user_id).toBe("0009");
    expect(parsePunch("1", "2024-02-29 00:05")).toMatchObject({
      date: "2024-02-29",
      timestamp: "2024-02-28T18:05:00.000Z",
    });
    expect(parsePunch("1", "2026-11-23T07:55:00+06:00")?.timestamp).toBe(
      report.records[0].timestamp,
    );
  });
  it("only merges historical USB keys backed by the source line; retains processed sibling", () => {
    const old = {
      id: "original",
      device_id: "D",
      device_user_id: "1",
      sync_mode: "usb_import",
      status: "unmapped",
      punch_time: "2026-11-23T07:55:00Z",
      raw_data: "1 2026-11-23 07:55",
    } as BiometricPunchLog;
    expect(
      historicalPunch({
        ...old,
        parser_version: 2,
        raw_data: undefined,
        punch_time: "2026-11-23 01:55:00+00",
      })?.timestamp,
    ).toBe("2026-11-23T01:55:00.000Z");
    expect(
      historicalPunch({ ...old, raw_data: "1 23/11/2026 07:55" }),
    ).toBeNull();
    expect(
      uniquePunchLogs([old, { ...old, id: "already", status: "processed" }]),
    ).toMatchObject([
      { id: "already", punch_time: "2026-11-23T01:55:00.000Z" },
    ]);
  });
  it("does not merge an independently bound teacher into the staff profile or self scope", () => {
    const teacher = {
        id: "t1",
        auth_user_id: "u1",
        first_name: "Nurul",
        phone: "01711223344",
      },
      foreign = { ...teacher, id: "t2", auth_user_id: "u2" };
    const staff = {
      id: "s",
      legacy_id: "t1",
      auth_user_id: "u1",
      personal: { first_name: "Nurul" },
    };
    expect(
      resolveTeacherIdentity([teacher, foreign], [staff], { linkedId: "s" })
        .keys,
    ).not.toContain("t2");
    expect(
      resolveTeacherIdentity([teacher, foreign], [staff], {
        linkedId: "s",
        authUserId: "u2",
      }).keys,
    ).toEqual([]);
  });
  it("07:00 BDT December 1 is due for the dispatcher even though the UI forecasts January", () => {
    vi.useFakeTimers();
    try {
      const at = new Date("2026-12-01T01:00:00.000Z");
      vi.setSystemTime(at);
      const forecast = mergeRulesWithDefaults("fixture", [])[0],
        dispatch = mergeRulesWithDefaults("fixture", [], false)[0];
      expect(forecast.next_run_at).toBe("2027-01-01T01:00:00.000Z");
      expect(isRuleDue(forecast, at)).toBe(false);
      expect(dispatch.next_run_at).toBeUndefined();
      expect(isRuleDue(dispatch, at)).toBe(true);
      expect(
        isRuleDue(
          { ...dispatch, next_run_at: at.toISOString() },
          new Date(+at + 90 * 60_000),
        ),
      ).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
