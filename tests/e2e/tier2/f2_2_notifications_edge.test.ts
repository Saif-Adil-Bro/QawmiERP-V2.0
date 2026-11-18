import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "../helpers/runner";
import { loadModule, loadRouteHandler } from "../helpers/module-loader";
import { verifySqlMigrationContract } from "../helpers/sql-verifier";
import {
  createTestHarness,
  type E2eTestHarness,
} from "../helpers/test-harness";
import { MADRASA_A_ID, MADRASA_B_ID, USERS } from "../helpers/fixtures";

describe("Tier 2 — Feature 2.2: Unified Multi-Channel Notification & Template Orchestrator (Edge, Security & Negative)", () => {
  let harness: E2eTestHarness;

  beforeEach(() => {
    harness = createTestHarness();
  });

  afterEach(() => {
    harness.dispose();
  });

  it("T2-2.2-01: Template renderer handles missing variables, {VarName} and [বাংলা] placeholders without undefined leaks", async () => {
    const mod = await loadModule<{
      renderNotificationTemplate: (
        template: string,
        variables: Record<string, string | number | null | undefined>
      ) => string;
    }>("@/lib/notifications/template-renderer", [
      "renderNotificationTemplate",
    ]);

    const rendered = mod.renderNotificationTemplate(
      "প্রিয় {GuardianName}, [শিক্ষার্থীর নাম] এর বকেয়া ৳{DueAmount}। অতিরিক্ত: {MissingKey}",
      {
        GuardianName: "জনাব আব্দুর রহিম",
        "শিক্ষার্থীর নাম": "আব্দুল্লাহ",
        DueAmount: 1500,
      }
    );

    assert.ok(rendered.includes("জনাব আব্দুর রহিম"));
    assert.ok(rendered.includes("আব্দুল্লাহ"));
    assert.ok(rendered.includes("1500") || rendered.includes("১৫০০"));
    assert.ok(
      !rendered.includes("undefined"),
      "Missing template variables must never render literal 'undefined'"
    );
  });

  it("T2-2.2-02: When all fallback channels (WhatsApp/Push -> SMS) fail with HTTP 500, delivery is marked FAILED/RETRY (not SENT)", async () => {
    const mod = await loadModule<{
      dispatchNotification: (
        event: string,
        payload: Record<string, unknown>
      ) => Promise<Record<string, unknown>>;
    }>("@/lib/notifications/orchestrator", ["dispatchNotification"]);

    harness.http.onRequest(/.*/, () =>
      new Response(JSON.stringify({ error: "Gateway down" }), { status: 500 })
    );

    const res = await mod.dispatchNotification("FEE_OVERDUE", {
      madrasaId: MADRASA_A_ID,
      recipientPhone: "01712345890",
      recipientEmail: "rahim@example.com",
      message: "বকেয়া রিমাইন্ডার",
      channels: ["whatsapp", "sms"],
    });

    const status = String(res.status ?? res.finalStatus ?? "").toUpperCase();
    assert.notEqual(
      status,
      "SENT",
      "Total channel failure must NEVER report SENT"
    );
  });

  it("T2-2.2-03: POST /api/notifications/dispatch rejects unauthenticated (401) and unauthorized roles (403)", async () => {
    const dispatchPost = await loadRouteHandler("notifications/dispatch", "POST");

    harness.auth.asAnonymous();
    const anonRes = await dispatchPost(
      harness.createRequest("/api/notifications/dispatch", {
        method: "POST",
        body: { event: "GENERAL_NOTICE", message: "Test" },
      })
    );
    assert.equal(anonRes.status, 401);

    harness.auth.asUser(USERS.studentA);
    const studentRes = await dispatchPost(
      harness.createRequest("/api/notifications/dispatch", {
        method: "POST",
        body: { event: "GENERAL_NOTICE", message: "Test" },
      })
    );
    assert.equal(studentRes.status, 403);
  });

  it("T2-2.2-04: Cross-tenant isolation prevents Madrasa B from dispatching using Madrasa A template", async () => {
    const dispatchPost = await loadRouteHandler("notifications/dispatch", "POST");

    harness.db.seed("notification_templates", {
      id: "tpl-a-1",
      madrasa_id: MADRASA_A_ID,
      event_key: "CUSTOM_A_EVENT",
      title: "Madrasa A Only",
      body_bn: "শুধুমাত্র মাদ্রাসা ক",
      is_active: true,
    });

    harness.auth.asUser(USERS.muhtamimB);
    const res = await dispatchPost(
      harness.createRequest("/api/notifications/dispatch", {
        method: "POST",
        body: {
          templateId: "tpl-a-1",
          madrasaId: MADRASA_A_ID,
          event: "CUSTOM_A_EVENT",
          recipientPhone: "01822222201",
          message: "Cross-tenant test",
        },
      })
    );

    if (res.status === 200) {
      const queueA = harness.db.getRows(
        "notification_queue",
        (r) => r.madrasa_id === MADRASA_A_ID
      );
      assert.equal(
        queueA.length,
        0,
        "Madrasa B actor must never enqueue notifications under Madrasa A"
      );
    } else {
      assert.ok(res.status === 403 || res.status === 404);
    }
    assert.notEqual(MADRASA_A_ID, MADRASA_B_ID);
  });

  it("T2-2.2-05: /api/mobile/push-tokens rejects unauthenticated (401) and empty token payload (400)", async () => {
    const pushPost = await loadRouteHandler("mobile/push-tokens", "POST");

    harness.auth.asAnonymous();
    const anonRes = await pushPost(
      harness.createRequest("/api/mobile/push-tokens", {
        method: "POST",
        body: { token: "fcm-token-123", platform: "android" },
      })
    );
    assert.equal(anonRes.status, 401);

    harness.auth.asUser(USERS.parentA);
    const badRes = await pushPost(
      harness.createRequest("/api/mobile/push-tokens", {
        method: "POST",
        body: { token: "", platform: "android" },
      })
    );
    assert.equal(badRes.status, 400);
  });

  it("T2-2.2-06: Missing notification tables (PGRST205) fall back cleanly and Phase 2 SQL enforces RLS", async () => {
    verifySqlMigrationContract({
      filePath: "supabase_phase_2_automation_bi_migration.sql",
      tables: [
        { tableName: "notification_templates" },
        { tableName: "notification_queue" },
        { tableName: "notification_device_tokens" },
      ],
    });

    const mod = await loadModule<{
      dispatchNotification: (
        event: string,
        payload: Record<string, unknown>
      ) => Promise<Record<string, unknown>>;
    }>("@/lib/notifications/orchestrator", ["dispatchNotification"]);

    harness.db.markTableMissing("notification_templates", "PGRST205");
    harness.db.markTableMissing("notification_queue", "42P01");
    harness.http.onRequest(/.*/, () =>
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    const res = await mod.dispatchNotification("FEE_OVERDUE", {
      madrasaId: MADRASA_A_ID,
      recipientPhone: "01712345890",
      message: "Fallback test",
    });
    assert.ok(res && typeof res === "object");
  });
});
