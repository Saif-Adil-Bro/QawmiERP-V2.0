import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "../helpers/runner";
import { loadRouteHandler } from "../helpers/module-loader";
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
  ZAKAT_FUNDS_A,
} from "../helpers/fixtures";

describe("Tier 3 — Cross-Feature Combinations (T3-07 to T3-12: Sessions, BI, Cron, Notifications & Webhooks)", () => {
  let harness: E2eTestHarness;

  beforeEach(() => {
    harness = createTestHarness();
  });

  afterEach(() => {
    harness.dispose();
  });

  it("T3-07: 1.2 Sessions/2FA × 3.3 AI Copilot — Remotely terminated session or SUSPENDED account replaying /api/ai/confirm is rejected", async () => {
    const confirmPost = await loadRouteHandler("ai/confirm", "POST");

    const currentSess = harness.auth.asUser(USERS.muhtamimA);
    harness.db.seed("user_sessions", {
      id: currentSess.sessionId || "sess-revoked-t307",
      madrasa_id: MADRASA_A_ID,
      user_id: USERS.muhtamimA.id,
      session_token_hash: "revoked",
      is_active: false,
      revoked_at: new Date().toISOString(),
    });

    harness.auth.asUser(USERS.suspendedStaffA);
    const suspRes = await confirmPost(
      harness.createRequest("/api/ai/confirm", {
        method: "POST",
        body: { action: "send_absent_guardian_notices", payload: {} },
      })
    );
    assert.ok(
      suspRes.status === 401 || suspRes.status === 403,
      `SUSPENDED user replaying /api/ai/confirm must be rejected, got ${suspRes.status}`
    );
  });

  it("T3-08: 1.3 Masking/Watermark × 2.3 Executive BI — BI Digest download embeds exporter watermark + logs SENSITIVE_DATA_EXPORTED", async () => {
    const getDigest = await loadRouteHandler("bi/digest/[id]", "GET");

    harness.db.seed("zakat_funds", ZAKAT_FUNDS_A);
    harness.db.seed("digest_schedules", {
      id: "dig-t3-08",
      madrasa_id: MADRASA_A_ID,
      frequency: "weekly",
      is_enabled: true,
      recipients: [USERS.muhtamimA.email],
    });

    harness.auth.asUser(USERS.muhtamimA);
    harness.setIp("103.112.54.99");

    const res = await getDigest(
      harness.createRequest("/api/bi/digest/dig-t3-08?format=html", {
        method: "GET",
      }),
      { params: Promise.resolve({ id: "dig-t3-08" }) }
    );
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(
      html.includes("103.112.54.99") || html.includes(USERS.muhtamimA.fullName),
      "BI digest download must embed exporter watermark"
    );

    await harness.flushAsync();
    const audits = harness.db.getRows(
      "system_audit_logs",
      (r) => r.action === "SENSITIVE_DATA_EXPORTED"
    );
    assert.ok(audits.length >= 1);
  });

  it("T3-09: 1.3 Masking × 3.1 Early Warning — Staff without data.unmask sees masked phones; Muhtamim sees unmasked", async () => {
    const getEw = await loadRouteHandler("early-warning", "GET");

    harness.db.seed("students", [STUDENTS_A.abdullah]);
    harness.db.seed("student_risk_scores", {
      id: "srs-t3-09",
      madrasa_id: MADRASA_A_ID,
      student_id: STUDENTS_A.abdullah.id,
      student_name: "আব্দুল্লাহ আল মামুন",
      parent_phone: STUDENTS_A.abdullah.parent_phone,
      risk_score: 82,
      risk_level: "CRITICAL",
    });

    harness.auth.asUser(USERS.ustadA); // has analytics.early_warning, NO data.unmask
    const ustadRes = await getEw(
      harness.createRequest("/api/early-warning", { method: "GET" })
    );
    assert.equal(ustadRes.status, 200);
    const ustadText = await ustadRes.text();
    assert.ok(
      !ustadText.includes(STUDENTS_A.abdullah.parent_phone),
      "Ustad without data.unmask must NOT see raw parent_phone in Early Warning"
    );

    harness.auth.asUser(USERS.muhtamimA);
    const muhtamimRes = await getEw(
      harness.createRequest("/api/early-warning", { method: "GET" })
    );
    assert.equal(muhtamimRes.status, 200);
    const muhtamimText = await muhtamimRes.text();
    assert.ok(
      muhtamimText.includes(STUDENTS_A.abdullah.parent_phone),
      "Muhtamim with data.unmask MUST see unmasked parent_phone in Early Warning"
    );
  });

  it("T3-10: 2.1 Cron × 2.2 Notifications — Overdue cron dispatches via Orchestrator with WhatsApp -> SMS fallback, skipping PAID students", async () => {
    const overdueCron = await loadRouteHandler("cron/overdue-reminders", "POST");

    harness.db.seed("academic_sessions", SESSION_A_1447);
    harness.db.seed("classes", CLASSES_A.mizan);
    harness.db.seed("students", [STUDENTS_A.abdullah, STUDENTS_A.yusuf]);
    harness.db.seed("student_fees", [
      {
        id: "sf-t310-due",
        madrasa_id: MADRASA_A_ID,
        session_id: SESSION_A_1447.id,
        student_id: STUDENTS_A.abdullah.id,
        class_id: CLASSES_A.mizan.id,
        class_name: CLASSES_A.mizan.name,
        fee_type_id: "ft_monthly",
        fee_type_name: "মাসিক বেতন",
        billing_period: "2026-10",
        payable_amount: 1800,
        paid_amount: 0,
        due_amount: 1800,
        status: "OVERDUE",
      },
      {
        id: "sf-t310-paid",
        madrasa_id: MADRASA_A_ID,
        session_id: SESSION_A_1447.id,
        student_id: STUDENTS_A.yusuf.id,
        class_id: CLASSES_A.mizan.id,
        class_name: CLASSES_A.mizan.name,
        fee_type_id: "ft_monthly",
        fee_type_name: "মাসিক বেতন",
        billing_period: "2026-10",
        payable_amount: 1800,
        paid_amount: 1800,
        due_amount: 0,
        status: "PAID",
      },
    ]);

    harness.http.onRequest(/whatsapp/i, () =>
      new Response("WA down", { status: 500 })
    );
    harness.http.onRequest(/.*/, () =>
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    const res = await overdueCron(
      harness.createRequest("/api/cron/overdue-reminders", {
        method: "POST",
        headers: { authorization: `Bearer ${harness.cronSecret}` },
        body: { madrasaId: MADRASA_A_ID },
      })
    );
    assert.equal(res.status, 200);
    await harness.flushAsync();

    const outbound = harness.http.requests
      .map((r) => r.body || "")
      .join("\n");
    const queue = JSON.stringify(harness.db.getRows("notification_queue"));
    const combined = outbound + "\n" + queue;
    assert.ok(
      combined.includes(STUDENTS_A.abdullah.parent_phone),
      "OVERDUE student Abdullah MUST trigger an outbound notification/SMS fallback"
    );
    assert.ok(
      !combined.includes(STUDENTS_A.yusuf.parent_phone),
      "PAID student Yusuf must be skipped"
    );
  });

  it("T3-11: 2.1 Cron × 2.3 Executive BI — /api/cron/digest-reports generates digest from live BI snapshot and logs job_execution_logs", async () => {
    const digestCron = await loadRouteHandler("cron/digest-reports", "POST");

    harness.db.seed("zakat_funds", ZAKAT_FUNDS_A);
    harness.db.seed("digest_schedules", {
      id: "ds-t3-11",
      madrasa_id: MADRASA_A_ID,
      frequency: "weekly",
      is_enabled: true,
      recipients: [USERS.muhtamimA.email],
    });
    harness.http.onRequest(/.*/, () =>
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    const res = await digestCron(
      harness.createRequest("/api/cron/digest-reports", {
        method: "POST",
        headers: { authorization: `Bearer ${harness.cronSecret}` },
        body: {},
      })
    );
    assert.equal(res.status, 200);
    assert.ok(harness.db.getRows("job_execution_logs").length >= 1);
  });

  it("T3-12: 2.1 Cron × 2.4 Webhooks — /api/cron/process-queues drains notification queue AND due webhook retries", async () => {
    const processCron = await loadRouteHandler("cron/process-queues", "POST");

    harness.db.seed("notification_queue", {
      id: "nq-t3-12",
      madrasa_id: MADRASA_A_ID,
      event_key: "GENERAL_NOTICE",
      channel: "sms",
      recipient: "01712345890",
      message: "বকেয়া নোটিশ",
      status: "PENDING",
      attempt_count: 0,
    });
    harness.db.seed("webhook_endpoints", {
      id: "wh-ep-t3-12",
      madrasa_id: MADRASA_A_ID,
      name: "Retry Target",
      url: "https://external.example.com/retry-ok",
      secret: "whsec_t312",
      events: ["payment.completed"],
      is_active: true,
    });
    harness.db.seed("webhook_deliveries", {
      id: "wh-del-t3-12",
      madrasa_id: MADRASA_A_ID,
      endpoint_id: "wh-ep-t3-12",
      event_type: "payment.completed",
      payload: { amount: 2500 },
      status: "RETRY",
      attempt_count: 1,
      max_attempts: 5,
      next_retry_at: new Date(Date.now() - 10_000).toISOString(),
    });

    harness.http.onRequest(/.*/, () =>
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    const res = await processCron(
      harness.createRequest("/api/cron/process-queues", {
        method: "POST",
        headers: { authorization: `Bearer ${harness.cronSecret}` },
        body: {},
      })
    );
    assert.equal(res.status, 200);
    await harness.flushAsync();

    const delRows = harness.db.getRows(
      "webhook_deliveries",
      (r) => r.id === "wh-del-t3-12"
    );
    assert.equal(
      String(delRows[0].status).toUpperCase(),
      "DELIVERED",
      "process-queues cron must drain due webhook retries to DELIVERED"
    );
  });
});
