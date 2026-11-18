import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "../helpers/runner";
import { loadRouteHandler, readProjectFile } from "../helpers/module-loader";
import { verifySqlMigrationContract } from "../helpers/sql-verifier";
import {
  createTestHarness,
  type E2eTestHarness,
} from "../helpers/test-harness";
import {
  CLASSES_A,
  MADRASA_A_ID,
  SESSION_A_1447,
  STUDENTS_A,
} from "../helpers/fixtures";

describe("Tier 2 — Feature 2.1: Scheduled Cron & Automation Engine (Edge, Security & Bug Regression)", () => {
  let harness: E2eTestHarness;

  beforeEach(() => {
    harness = createTestHarness();
  });

  afterEach(() => {
    harness.dispose();
  });

  it("T2-2.1-01: All 4 /api/cron/* endpoints reject missing or invalid CRON_SECRET with 401", async () => {
    const endpoints = [
      "cron/monthly-fees",
      "cron/overdue-reminders",
      "cron/absence-alerts",
      "cron/process-queues",
    ];

    for (const ep of endpoints) {
      const handler = await loadRouteHandler(ep, "POST");
      const noAuth = await handler(
        harness.createRequest(`/api/${ep}`, { method: "POST", body: {} })
      );
      assert.equal(noAuth.status, 401, `${ep} must reject missing Authorization`);

      const badAuth = await handler(
        harness.createRequest(`/api/${ep}`, {
          method: "POST",
          headers: { authorization: "Bearer wrong-secret-token" },
          body: {},
        })
      );
      assert.equal(badAuth.status, 401, `${ep} must reject invalid CRON_SECRET`);
    }
  });

  it("T2-2.1-02: Anti-regression (totalDue: 1200 bug) — overdue-reminders computes real due_amount and skips PAID students", async () => {
    const overdueCron = await loadRouteHandler("cron/overdue-reminders", "POST");

    harness.db.seed("academic_sessions", SESSION_A_1447);
    harness.db.seed("classes", CLASSES_A.mizan);
    harness.db.seed("students", [STUDENTS_A.abdullah, STUDENTS_A.yusuf]);
    harness.db.seed("student_fees", [
      {
        id: "sf-real-due-1",
        madrasa_id: MADRASA_A_ID,
        session_id: SESSION_A_1447.id,
        student_id: STUDENTS_A.abdullah.id,
        student_name: "আব্দুল্লাহ আল মামুন",
        class_id: CLASSES_A.mizan.id,
        class_name: CLASSES_A.mizan.name,
        fee_type_id: "ft_monthly",
        fee_type_name: "মাসিক বেতন",
        billing_period: "2026-10",
        payable_amount: 2750,
        paid_amount: 0,
        due_amount: 2750,
        status: "OVERDUE",
      },
      {
        id: "sf-paid-zero-1",
        madrasa_id: MADRASA_A_ID,
        session_id: SESSION_A_1447.id,
        student_id: STUDENTS_A.yusuf.id,
        student_name: "মোহাম্মদ ইউসুফ",
        class_id: CLASSES_A.mizan.id,
        class_name: CLASSES_A.mizan.name,
        fee_type_id: "ft_monthly",
        fee_type_name: "মাসিক বেতন",
        billing_period: "2026-10",
        payable_amount: 1500,
        paid_amount: 1500,
        due_amount: 0,
        status: "PAID",
      },
    ]);

    const res = await overdueCron(
      harness.createRequest("/api/cron/overdue-reminders", {
        method: "POST",
        headers: { authorization: `Bearer ${harness.cronSecret}` },
        body: { madrasaId: MADRASA_A_ID },
      })
    );
    assert.equal(res.status, 200);
    await harness.flushAsync();

    const outboundPayloads = harness.http.requests
      .map((r) => r.body || "")
      .join("\n");
    const queuePayloads = JSON.stringify(harness.db.getRows("notification_queue"));
    const combined = outboundPayloads + "\n" + queuePayloads;

    assert.ok(
      !combined.includes("1200"),
      "Overdue reminder must NEVER emit hardcoded fake totalDue 1200"
    );
    assert.ok(
      !combined.includes(STUDENTS_A.yusuf.parent_phone),
      "PAID student with 0 due must NOT receive overdue reminder"
    );
  });

  it("T2-2.1-03: Friday / configured weekend_days skip sends 0 absence alerts", async () => {
    const absenceCron = await loadRouteHandler("cron/absence-alerts", "POST");

    harness.db.seed("classes", CLASSES_A.mizan);
    harness.db.seed("students", [STUDENTS_A.abdullah]);
    // 2026-11-13 is a Friday
    harness.db.seed("attendance", [
      {
        id: "att-fri-1",
        madrasa_id: MADRASA_A_ID,
        student_id: STUDENTS_A.abdullah.id,
        class_id: CLASSES_A.mizan.id,
        date: "2026-11-13",
        status: "Absent",
      },
    ]);

    const res = await absenceCron(
      harness.createRequest("/api/cron/absence-alerts", {
        method: "POST",
        headers: { authorization: `Bearer ${harness.cronSecret}` },
        body: { madrasaId: MADRASA_A_ID, date: "2026-11-13" },
      })
    );
    assert.equal(res.status, 200);
    const body = (await res.json()) as Record<string, unknown>;
    const sentCount = Number(
      body.sent ?? body.alertsSent ?? body.dispatched ?? 0
    );
    assert.equal(
      sentCount,
      0,
      "Friday (configured weekend_days) must send 0 absence alerts"
    );
  });

  it("T2-2.1-04: Monthly fee generation cron is idempotent for the same billing period", async () => {
    const monthlyCron = await loadRouteHandler("cron/monthly-fees", "POST");

    harness.db.seed("academic_sessions", SESSION_A_1447);
    harness.db.seed("classes", CLASSES_A.mizan);
    harness.db.seed("students", [STUDENTS_A.abdullah]);
    harness.db.seed("fee_structures", [
      {
        id: "fs-mizan-1",
        madrasa_id: MADRASA_A_ID,
        class_id: CLASSES_A.mizan.id,
        fee_type_id: "ft_monthly",
        fee_type_name: "মাসিক বেতন",
        amount: 1500,
        is_active: true,
      },
    ]);

    const reqInit = {
      method: "POST",
      headers: { authorization: `Bearer ${harness.cronSecret}` },
      body: { madrasaId: MADRASA_A_ID, billingPeriod: "2026-11" },
    };

    const res1 = await monthlyCron(
      harness.createRequest("/api/cron/monthly-fees", reqInit)
    );
    assert.equal(res1.status, 200);
    const countAfterFirst = harness.db.getRows(
      "student_fees",
      (r) => r.student_id === STUDENTS_A.abdullah.id && r.billing_period === "2026-11"
    ).length;

    const res2 = await monthlyCron(
      harness.createRequest("/api/cron/monthly-fees", reqInit)
    );
    assert.equal(res2.status, 200);
    const countAfterSecond = harness.db.getRows(
      "student_fees",
      (r) => r.student_id === STUDENTS_A.abdullah.id && r.billing_period === "2026-11"
    ).length;

    assert.equal(
      countAfterSecond,
      countAfterFirst,
      "Running monthly-fees cron twice for 2026-11 must not create duplicate invoices"
    );
  });

  it("T2-2.1-05: Missing automation_rules / job_execution_logs (42P01/PGRST205) falls back cleanly", async () => {
    const processCron = await loadRouteHandler("cron/process-queues", "POST");

    harness.db.markTableMissing("automation_rules", "42P01");
    harness.db.markTableMissing("job_execution_logs", "PGRST205");

    const res = await processCron(
      harness.createRequest("/api/cron/process-queues", {
        method: "POST",
        headers: { authorization: `Bearer ${harness.cronSecret}` },
        body: {},
      })
    );
    assert.equal(res.status, 200);
  });

  it("T2-2.1-06: Phase 2 SQL migration enforces RLS on automation tables and vercel.json registers cron routes", () => {
    verifySqlMigrationContract({
      filePath: "supabase_phase_2_automation_bi_migration.sql",
      tables: [
        { tableName: "automation_rules" },
        { tableName: "job_execution_logs" },
      ],
    });

    const vercelRaw = readProjectFile("vercel.json");
    const vercel = JSON.parse(vercelRaw) as {
      crons?: Array<{ path: string; schedule: string }>;
    };
    assert.ok(Array.isArray(vercel.crons) && vercel.crons.length >= 4);
    const paths = vercel.crons.map((c) => c.path);
    assert.ok(paths.some((p) => p.includes("/api/cron/")));
  });
});
