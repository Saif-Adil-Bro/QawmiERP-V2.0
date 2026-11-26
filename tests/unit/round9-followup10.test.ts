import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  fetchCanonicalAuditLogsAndCount,
  mergeAndDeduplicateAuditLogs,
  type SystemAuditLogRecord,
} from "@/lib/audit-log";
import {
  computeUnifiedBiometricPunchCounters,
  type BiometricPunchLog,
} from "@/lib/biometric";
import { classifyExistingAttendanceForBiometric } from "@/lib/biometric-ingest";
import { DEMO_ADMIN_EMAIL, DEMO_MADRASA_NAME } from "@/lib/demo-data";

const ROOT = process.cwd();
const readSource = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");

describe("FOLLOWUP10 (Round 9) — Priority 0: Restored Audit Dedup, S2 beforeunload & Automation UI", () => {
  it("deduplicates SQL + fallback rows in fetchCanonicalAuditLogsAndCount (44 SQL + 44 legacy_id => 44, semantic dup => 1)", async () => {
    const fallback44: SystemAuditLogRecord[] = Array.from({ length: 44 }, (_, i) => ({
      id: `fb-${i + 1}`,
      madrasa_id: "m1",
      module: "fees",
      action: "MONTHLY_FEES_GENERATED",
      entity_id: `2026-12`,
      summary: `Fee batch #${i + 1}`,
      severity: "INFO",
      created_at: `2026-11-23T08:${String(i).padStart(2, "0")}:00.000Z`,
    }));

    const sql44: SystemAuditLogRecord[] = fallback44.map((fb, i) => ({
      ...fb,
      id: `30000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
      metadata: { legacy_id: fb.id },
    }));

    // Add 1 semantic duplicate WITHOUT legacy_id
    const semanticFallbackDup: SystemAuditLogRecord = {
      ...sql44[0],
      id: "fb-semantic-dup-no-legacy",
      metadata: {},
      created_at: "2026-11-23T08:00:00.550Z",
    };

    const fakeDb = {
      from() {
        const q = {
          select: () => q,
          eq: () => q,
          lte: () => q,
          order: () => q,
          range: (a: number, b: number) => Promise.resolve({ data: sql44.slice(a, b + 1) }),
        };
        return q;
      },
    } as any;

    const result = await fetchCanonicalAuditLogsAndCount(fakeDb, "m1", {
      fallbackLogs: [...fallback44, semanticFallbackDup],
      limit: 100,
    });

    expect(result.totalCount).toBe(44);
    expect(result.logs).toHaveLength(44);
    expect(
      mergeAndDeduplicateAuditLogs(sql44, [...fallback44, semanticFallbackDup], "m1"),
    ).toHaveLength(44);
  });

  it("registers real window.addEventListener('beforeunload', ...) in AssignTeacherSubjectForm, ClassSubjectsManager, and save-guard", () => {
    const assignSrc = readSource(
      "app/dashboard/teachers/[id]/subjects/AssignTeacherSubjectForm.tsx",
    );
    const classSrc = readSource(
      "app/dashboard/classes/[id]/subjects/ClassSubjectsManager.tsx",
    );
    const guardSrc = readSource("lib/save-guard.ts");

    expect(assignSrc).toContain('window.addEventListener("beforeunload"');
    expect(classSrc).toContain('window.addEventListener("beforeunload"');
    expect(guardSrc).toContain('window.addEventListener("beforeunload"');
  });

  it("exposes data-testid='scheduler-health-card' on AutomationSettingsClient", () => {
    const uiSrc = readSource(
      "app/dashboard/settings/automation/AutomationSettingsClient.tsx",
    );
    expect(uiSrc).toContain('data-testid="scheduler-health-card"');
  });
});

describe("FOLLOWUP10 (Round 9) — Priority 1: Biometric Unmapped Replay Attendance Creation & Upgrade", () => {
  it("classifies existing attendance rows accurately: upgrades pending/unmarked/absent, preserves present/late, protects approved leave", () => {
    expect(classifyExistingAttendanceForBiometric({ status: "Present" })).toBe(
      "already_present",
    );
    expect(classifyExistingAttendanceForBiometric({ status: "Late" })).toBe(
      "already_present",
    );
    expect(classifyExistingAttendanceForBiometric({ status: "Pending" })).toBe(
      "upgrade_to_present",
    );
    expect(classifyExistingAttendanceForBiometric({ status: "Unmarked" })).toBe(
      "upgrade_to_present",
    );
    expect(classifyExistingAttendanceForBiometric({ status: "Absent" })).toBe(
      "upgrade_to_present",
    );
    expect(classifyExistingAttendanceForBiometric({ status: "" })).toBe(
      "upgrade_to_present",
    );
    expect(classifyExistingAttendanceForBiometric({ status: null })).toBe(
      "upgrade_to_present",
    );
    expect(
      classifyExistingAttendanceForBiometric({
        status: "Leave",
      }),
    ).toBe("leave_protected");
    expect(
      classifyExistingAttendanceForBiometric({
        status: "Absent",
        leave_request_id: "leave-123",
      }),
    ).toBe("leave_protected");
  });

  it("ships Round 9 SQL migration upgrading pending/unmarked/absent rows and allowing replay after device deletion", () => {
    const sql = readSource("supabase_round9_biometric_rpc_migration.sql");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.biometric_apply_events");
    expect(sql).toContain("norm_status IN ('present', 'late')");
    expect(sql).toContain("norm_status IN ('', 'pending', 'unmarked', 'absent')");
    expect(sql).toContain("existing_att_leave IS NOT NULL OR norm_status = 'leave'");
    expect(sql).toContain("IF replay IS NULL THEN");
    expect(sql).toContain("NOTIFY pgrst, 'reload schema'");
  });
});

describe("FOLLOWUP10 (Round 9) — Priority 2: N9 Audit Events", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("attributes unknown LOGIN_FAILED safely when 1 real school + Demo Madrasa exist, and stays null across 2+ real schools", async () => {
    let madrasaRows: Array<{ id: string; name: string; email?: string | null }> = [];
    vi.doMock("@/lib/supabase/admin", () => ({
      createAdminClient: async () => ({
        from: (table: string) => {
          const empty = { data: [], error: null };
          const chain: any = {
            select: () => chain,
            ilike: () => chain,
            eq: () => chain,
            or: () => chain,
            limit: async () =>
              table === "madrasas" ? { data: madrasaRows, error: null } : empty,
          };
          return chain;
        },
      }),
    }));

    const { resolveFailedLoginMadrasaId } = await import("@/lib/failed-login-audit");

    // 1 real school + built-in Demo Madrasa => resolves to the single real school
    madrasaRows = [
      { id: "demo-id", name: DEMO_MADRASA_NAME, email: DEMO_ADMIN_EMAIL },
      { id: "real-school-1", name: "জামিয়া ইসলামিয়া", email: "admin@jamia.org" },
    ];
    expect(await resolveFailedLoginMadrasaId("unknown@wrong.test")).toBe(
      "real-school-1",
    );

    // 2 real schools + Demo Madrasa => multi-tenant instance, returns null (no cross-tenant leakage)
    madrasaRows = [
      { id: "demo-id", name: DEMO_MADRASA_NAME, email: DEMO_ADMIN_EMAIL },
      { id: "real-school-1", name: "জামিয়া ১", email: "a@one.org" },
      { id: "real-school-2", name: "জামিয়া ২", email: "b@two.org" },
    ];
    expect(await resolveFailedLoginMadrasaId("unknown@wrong.test")).toBeNull();
  });
});

describe("FOLLOWUP10 (Round 9) — Priority 3: Unified Biometric Punch Counters", () => {
  it("keeps device card totals and today's unique punch header in exact parity with the deduplicated Log stream", () => {
    const today = "2026-11-26";
    const mk = (overrides: Partial<BiometricPunchLog>): BiometricPunchLog => ({
      id: "log-id",
      madrasa_id: "m1",
      device_id: "dev-main",
      device_name: "মেইন গেট",
      device_user_id: "480004",
      user_type: "student",
      punch_time: "2026-11-26T02:00:00.000Z", // 08:00 BDT on 2026-11-26
      punch_date: "2026-11-26",
      punch_type: "check_in",
      status: "processed",
      parser_version: 2,
      sync_mode: "usb_import",
      created_at: "2026-11-26T02:01:00.000Z",
      ...overrides,
    });

    const pgLogs: BiometricPunchLog[] = [
      mk({ id: "pg-1", device_user_id: "480004", punch_time: "2026-11-26T02:00:00.000Z", punch_date: today }),
      mk({ id: "pg-2", device_user_id: "480006", punch_time: "2026-11-23T02:05:00.000Z", punch_date: "2026-11-23" }),
    ];

    // Legacy store has:
    // 1) Duplicate of pg-1 (must NOT double count)
    // 2) An unverified legacy row (no parser_version & invalid raw_data) on dev-main
    // 3) A separate device row on dev-other on today
    const legacyLogs: BiometricPunchLog[] = [
      mk({ id: "leg-dup-1", device_user_id: "480004", punch_time: "2026-11-26T02:00:00.000Z", punch_date: today, status: "unmapped" }),
      mk({
        id: "leg-unverified-1",
        device_id: "dev-main",
        device_user_id: "480009",
        parser_version: undefined,
        raw_data: "480009 23/11/2026 08:00",
        punch_time: "2026-11-23T08:00:00Z",
        punch_date: "2026-11-23",
        status: "unmapped",
      }),
      mk({
        id: "leg-other-today",
        device_id: "dev-other",
        device_user_id: "480010",
        punch_time: "2026-11-26T03:00:00.000Z",
        punch_date: today,
        status: "processed",
      }),
    ];

    const { unifiedLogs, deviceCounts, unverifiedCounts, totalPunchesToday } =
      computeUnifiedBiometricPunchCounters(pgLogs, legacyLogs, today);

    // Unified log table has 4 unique rows: 3 on dev-main (pg-1, pg-2, leg-unverified-1) + 1 on dev-other
    expect(unifiedLogs).toHaveLength(4);
    expect(deviceCounts.get("dev-main")).toBe(
      unifiedLogs.filter((l) => l.device_id === "dev-main").length,
    );
    expect(deviceCounts.get("dev-main")).toBe(3);
    expect(unverifiedCounts.get("dev-main")).toBe(1);
    expect(deviceCounts.get("dev-other")).toBe(1);
    // Today has 2 unique punches (pg-1 + leg-other-today), NOT 0 and NOT 3!
    expect(totalPunchesToday).toBe(2);
    expect(totalPunchesToday).toBe(
      unifiedLogs.filter((l) => l.punch_date === today).length,
    );
  });
});
