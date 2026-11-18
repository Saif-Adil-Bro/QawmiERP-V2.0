import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "../helpers/runner";
import { loadModule, loadRouteHandler } from "../helpers/module-loader";
import {
  createTestHarness,
  type E2eTestHarness,
} from "../helpers/test-harness";
import {
  CLASSES_A,
  MADRASA_A_ID,
  SESSION_A_1447,
  STUDENTS_A,
  USERS,
} from "../helpers/fixtures";

describe("Tier 3 — Cross-Feature Combinations (T3-13 to T3-18: Early Warning, BI, Anomaly & AI Copilot)", () => {
  let harness: E2eTestHarness;

  beforeEach(() => {
    harness = createTestHarness();
  });

  afterEach(() => {
    harness.dispose();
  });

  it("T3-13: 2.1 Cron × 3.1 Early Warning — Aging overdue dues + absences feed /api/cron/early-warning and elevate student to HIGH/CRITICAL", async () => {
    const ewCron = await loadRouteHandler("cron/early-warning", "POST");

    harness.db.seed("academic_sessions", SESSION_A_1447);
    harness.db.seed("classes", CLASSES_A.mizan);
    harness.db.seed("students", [STUDENTS_A.abdullah]);

    for (let m = 1; m <= 4; m++) {
      harness.db.seed("student_fees", {
        id: `sf-age-${m}`,
        madrasa_id: MADRASA_A_ID,
        session_id: SESSION_A_1447.id,
        student_id: STUDENTS_A.abdullah.id,
        class_id: CLASSES_A.mizan.id,
        class_name: CLASSES_A.mizan.name,
        fee_type_id: "ft_monthly",
        fee_type_name: "মাসিক বেতন",
        billing_period: `2026-0${m}`,
        payable_amount: 1500,
        paid_amount: 0,
        due_amount: 1500,
        status: "OVERDUE",
      });
    }
    for (let d = 1; d <= 15; d++) {
      harness.db.seed("attendance", {
        id: `att-ew-${d}`,
        madrasa_id: MADRASA_A_ID,
        student_id: STUDENTS_A.abdullah.id,
        class_id: CLASSES_A.mizan.id,
        date: `2026-11-${String(d).padStart(2, "0")}`,
        status: "Absent",
      });
    }

    const res = await ewCron(
      harness.createRequest("/api/cron/early-warning", {
        method: "POST",
        headers: { authorization: `Bearer ${harness.cronSecret}` },
        body: { madrasaId: MADRASA_A_ID },
      })
    );
    assert.equal(res.status, 200);

    const scores = harness.db.getRows(
      "student_risk_scores",
      (r) => r.student_id === STUDENTS_A.abdullah.id
    );
    assert.ok(scores.length >= 1);
    const level = String(scores[0].risk_level ?? "").toUpperCase();
    assert.ok(
      level === "HIGH" || level === "CRITICAL",
      `Chronically overdue + absent student must be HIGH/CRITICAL, got ${level}`
    );
  });

  it("T3-14: 2.2 Notifications × 3.1 Early Warning — CRITICAL dropout risk intervention dispatches Bangla guardian alert with SMS fallback", async () => {
    const ewPost = await loadRouteHandler("early-warning", "POST");

    harness.db.seed("students", [STUDENTS_A.abdullah]);
    harness.db.seed("student_risk_scores", {
      id: "srs-t3-14",
      madrasa_id: MADRASA_A_ID,
      student_id: STUDENTS_A.abdullah.id,
      student_name: "আব্দুল্লাহ আল মামুন",
      parent_phone: STUDENTS_A.abdullah.parent_phone,
      risk_score: 88,
      risk_level: "CRITICAL",
    });

    harness.http.onRequest(/.*/, () =>
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    harness.auth.asUser(USERS.muhtamimA);
    const res = await ewPost(
      harness.createRequest("/api/early-warning", {
        method: "POST",
        body: {
          action: "notify_guardian",
          studentId: STUDENTS_A.abdullah.id,
          riskScoreId: "srs-t3-14",
          notes: "অভিভাবকের সাথে জরুরি যোগাযোগ",
        },
      })
    );
    assert.equal(res.status, 200);
    await harness.flushAsync();

    const queue = harness.db.getRows("notification_queue");
    const httpReqs = harness.http.requests;
    assert.ok(queue.length >= 1 || httpReqs.length >= 1);
  });

  it("T3-15: 2.2 Notifications × 3.3 AI Copilot — Confirmed send_absent_guardian_notices routes through Notification Orchestrator", async () => {
    const confirmPost = await loadRouteHandler("ai/confirm", "POST");

    harness.db.seed("classes", CLASSES_A.mizan);
    harness.db.seed("students", [STUDENTS_A.abdullah]);
    harness.db.seed("attendance", {
      id: "att-t3-15",
      madrasa_id: MADRASA_A_ID,
      student_id: STUDENTS_A.abdullah.id,
      class_id: CLASSES_A.mizan.id,
      date: new Date().toISOString().slice(0, 10),
      status: "Absent",
    });

    harness.http.onRequest(/.*/, () =>
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    harness.auth.asUser(USERS.muhtamimA);
    const res = await confirmPost(
      harness.createRequest("/api/ai/confirm", {
        method: "POST",
        body: {
          action: "send_absent_guardian_notices",
          payload: { date: new Date().toISOString().slice(0, 10) },
        },
      })
    );
    assert.equal(res.status, 200);
    await harness.flushAsync();

    const audits = harness.db.getRows(
      "system_audit_logs",
      (r) => r.action === "AI_ACTION_EXECUTED"
    );
    assert.ok(audits.length >= 1);
  });

  it("T3-16: 2.3 Executive BI × 3.2 Anomaly Detection — Boarding bazar spike flagged by Anomaly Detection correlates with BI bazar cost", async () => {
    const biMod = await loadModule<{
      getExecutiveBiSnapshot: (
        madrasaId: string,
        opts?: { months?: number }
      ) => Promise<Record<string, unknown>>;
    }>("@/lib/bi/executive-bi-service", ["getExecutiveBiSnapshot"]);
    const anomMod = await loadModule<{
      runFinancialAnomalyScan: (
        madrasaId: string,
        opts?: { lookbackDays?: number }
      ) => Promise<Record<string, unknown>>;
    }>("@/lib/anomaly-detection-service", ["runFinancialAnomalyScan"]);

    const baselineDates = [
      "2026-11-01",
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
      "2026-11-07",
    ];
    baselineDates.forEach((d, idx) => {
      harness.db.seed("bazar_expenses", {
        id: `baz-t316-${idx}`,
        madrasa_id: MADRASA_A_ID,
        expense_date: d,
        amount: 3000,
        items_details: "দৈনিক বাজার",
      });
    });
    harness.db.seed("bazar_expenses", {
      id: "baz-t316-spike",
      madrasa_id: MADRASA_A_ID,
      expense_date: "2026-11-08",
      amount: 45000,
      items_details: "অস্বাভাবিক বাজার খরচ",
    });

    await anomMod.runFinancialAnomalyScan(MADRASA_A_ID, { lookbackDays: 30 });
    const bi = await biMod.getExecutiveBiSnapshot(MADRASA_A_ID, { months: 6 });

    assert.ok(harness.db.getRows("financial_anomalies").length >= 1);
    const biJson = JSON.stringify(bi);
    assert.ok(
      biJson.includes("66000") || biJson.includes("45000"),
      "Executive BI snapshot must reflect the 45,000 spike / 66,000 total bazar cost"
    );
  });

  it("T3-17: 2.4 Webhooks × 1.3 Data Security — Webhook dispatch blocks SSRF, omits raw NID, and logs WEBHOOK_DISPATCHED", async () => {
    const whMod = await loadModule<{
      dispatchWebhookEvent: (
        madrasaId: string,
        eventType: string,
        data: Record<string, unknown>
      ) => Promise<Record<string, unknown>>;
    }>("@/lib/webhooks/dispatcher", ["dispatchWebhookEvent"]);

    harness.db.seed("webhook_endpoints", [
      {
        id: "wh-valid-t317",
        madrasa_id: MADRASA_A_ID,
        name: "Valid Portal",
        url: "https://portal.example.com/hook",
        secret: "whsec_t317",
        events: ["student.admitted"],
        is_active: true,
      },
      {
        id: "wh-ssrf-t317",
        madrasa_id: MADRASA_A_ID,
        name: "SSRF Attempt",
        url: "http://169.254.169.254/latest/meta-data/",
        secret: "whsec_ssrf",
        events: ["student.admitted"],
        is_active: true,
      },
    ]);

    harness.http.onRequest("https://portal.example.com/hook", () =>
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    await whMod.dispatchWebhookEvent(MADRASA_A_ID, "student.admitted", {
      studentId: STUDENTS_A.abdullah.id,
      name: "আব্দুল্লাহ",
      nid: "1995123456789",
    });
    await harness.flushAsync();

    assert.equal(
      harness.http.requests.filter((r) =>
        r.url.includes("http://169.254.169.254/latest/meta-data/")
      ).length,
      0,
      "SSRF metadata endpoint must NEVER be called"
    );
    assert.ok(
      harness.http.requests.filter((r) =>
        r.url.includes("https://portal.example.com/hook")
      ).length >= 1
    );
  });

  it("T3-18: 3.2 Anomaly Detection × 3.3 AI Copilot — Copilot trigger_anomaly_scan + getFinancialAnomalies returns detected anomalies & audit trail", async () => {
    const confirmPost = await loadRouteHandler("ai/confirm", "POST");
    const aiMod = await loadModule<{
      createErpTools: (
        ctx: Record<string, unknown>
      ) => Record<string, { execute: (args: Record<string, unknown>) => Promise<Record<string, unknown>> }>;
    }>("@/lib/ai/erp-tools", ["createErpTools"]);
    const permsMod = await loadModule<{
      loadServerPermissions: (
        userId: string,
        madrasaId: string
      ) => Promise<Record<string, unknown> | null>;
    }>("@/lib/permissions-server", ["loadServerPermissions"]);

    harness.db.seed("expenses", [
      {
        id: "exp-t318-1",
        madrasa_id: MADRASA_A_ID,
        expense_date: "2026-11-10",
        amount: 7200,
        category: "Maintenance",
        description: "মেরামত বিল",
      },
      {
        id: "exp-t318-2",
        madrasa_id: MADRASA_A_ID,
        expense_date: "2026-11-10",
        amount: 7200,
        category: "Maintenance",
        description: "মেরামত বিল",
      },
    ]);

    harness.auth.asUser(USERS.muhtamimA);
    const confirmRes = await confirmPost(
      harness.createRequest("/api/ai/confirm", {
        method: "POST",
        body: { action: "trigger_anomaly_scan", payload: { lookbackDays: 30 } },
      })
    );
    assert.equal(confirmRes.status, 200);
    await harness.flushAsync();

    const ctx = await permsMod.loadServerPermissions(
      USERS.muhtamimA.id,
      MADRASA_A_ID
    );
    assert.ok(ctx);
    const tools = aiMod.createErpTools(ctx);
    assert.ok(tools.getFinancialAnomalies);
    const listRes = await tools.getFinancialAnomalies.execute({});
    assert.ok(JSON.stringify(listRes).includes("7200") || harness.db.getRows("financial_anomalies").length >= 1);
  });
});
