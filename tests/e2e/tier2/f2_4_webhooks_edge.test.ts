import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "../helpers/runner";
import { loadModule, loadRouteHandler } from "../helpers/module-loader";
import { verifySqlMigrationContract } from "../helpers/sql-verifier";
import {
  createTestHarness,
  type E2eTestHarness,
} from "../helpers/test-harness";
import { MADRASA_A_ID, USERS } from "../helpers/fixtures";

describe("Tier 2 — Feature 2.4: Webhook & External Integration Hub (Edge, SSRF, HMAC & Negative)", () => {
  let harness: E2eTestHarness;

  beforeEach(() => {
    harness = createTestHarness();
  });

  afterEach(() => {
    harness.dispose();
  });

  it("T2-2.4-01: SSRF URL guard blocks loopback, RFC1918 private IPs, AWS metadata, and non-HTTP schemes", async () => {
    const mod = await loadModule<{
      validateWebhookUrl: (
        url: string,
        opts?: { allowHttpInDev?: boolean }
      ) => { valid: boolean; reason?: string };
    }>("@/lib/webhooks/signer", ["validateWebhookUrl"]);

    const maliciousUrls = [
      "http://127.0.0.1:8080/hook",
      "http://localhost/admin",
      "http://169.254.169.254/latest/meta-data/",
      "https://10.0.0.5/internal",
      "https://192.168.1.10/router",
      "https://172.16.0.1/vpn",
      "http://[::1]/loopback",
      "file:///etc/passwd",
      "javascript:alert(1)",
    ];

    for (const u of maliciousUrls) {
      const check = mod.validateWebhookUrl(u, { allowHttpInDev: false });
      assert.equal(check.valid, false, `SSRF URL "${u}" MUST be blocked`);
    }

    const validHttps = mod.validateWebhookUrl(
      "https://accounting.jamia-dhaka.example.com/webhooks/qawmi",
      { allowHttpInDev: false }
    );
    assert.equal(validHttps.valid, true);
  });

  it("T2-2.4-02: HMAC-SHA256 verifier rejects tampered payload, wrong secret, malformed header, and stale timestamp", async () => {
    const mod = await loadModule<{
      signWebhookPayload: (
        secret: string,
        timestampSec: number,
        rawBody: string
      ) => { header: string; signature: string };
      verifyWebhookSignature: (
        secret: string,
        header: string,
        rawBody: string,
        toleranceSec?: number
      ) => boolean;
    }>("@/lib/webhooks/signer", [
      "signWebhookPayload",
      "verifyWebhookSignature",
    ]);

    const secret = "whsec_e2e_test_secret_123456";
    const nowSec = Math.floor(Date.now() / 1000);
    const body = JSON.stringify({ event: "payment.completed", amount: 5000 });
    const signed = mod.signWebhookPayload(secret, nowSec, body);

    assert.equal(
      mod.verifyWebhookSignature(secret, signed.header, body, 300),
      true
    );
    assert.equal(
      mod.verifyWebhookSignature(
        secret,
        signed.header,
        JSON.stringify({ event: "payment.completed", amount: 999999 }),
        300
      ),
      false,
      "Tampered payload must fail HMAC verification"
    );
    assert.equal(
      mod.verifyWebhookSignature("wrong_secret", signed.header, body, 300),
      false,
      "Wrong secret must fail HMAC verification"
    );
    assert.equal(
      mod.verifyWebhookSignature(secret, "malformed-header", body, 300),
      false
    );

    const stale = mod.signWebhookPayload(secret, nowSec - 3600, body);
    assert.equal(
      mod.verifyWebhookSignature(secret, stale.header, body, 300),
      false,
      "Timestamp outside tolerance window must be rejected (replay protection)"
    );
  });

  it("T2-2.4-03: Exponential backoff retry marks failed delivery for retry and exhausts to DEAD_LETTER/FAILED after max attempts", async () => {
    const mod = await loadModule<{
      retryPendingWebhookDeliveries: (
        limit?: number
      ) => Promise<Record<string, unknown>>;
    }>("@/lib/webhooks/dispatcher", ["retryPendingWebhookDeliveries"]);

    harness.db.seed("webhook_endpoints", {
      id: "wh-ep-fail-1",
      madrasa_id: MADRASA_A_ID,
      name: "Failing Endpoint",
      url: "https://external.example.com/hook-fail",
      secret: "whsec_retry_test",
      events: ["payment.completed"],
      is_active: true,
    });
    harness.db.seed("webhook_deliveries", {
      id: "wh-del-max-1",
      madrasa_id: MADRASA_A_ID,
      endpoint_id: "wh-ep-fail-1",
      event_type: "payment.completed",
      payload: { amount: 1000 },
      status: "RETRY",
      attempt_count: 5,
      max_attempts: 5,
      next_retry_at: new Date(Date.now() - 60_000).toISOString(),
    });

    harness.http.onRequest("https://external.example.com/hook-fail", () =>
      new Response("Internal Server Error", { status: 500 })
    );

    await mod.retryPendingWebhookDeliveries(10);
    const rows = harness.db.getRows(
      "webhook_deliveries",
      (r) => r.id === "wh-del-max-1"
    );
    const status = String(rows[0].status ?? "").toUpperCase();
    assert.ok(
      status === "FAILED" || status === "DEAD_LETTER" || status === "EXHAUSTED",
      `Exhausted retries must transition to FAILED/DEAD_LETTER, got ${status}`
    );
  });

  it("T2-2.4-04: POST /api/webhooks/endpoints rejects unauthenticated (401) and unauthorized roles (403)", async () => {
    const createEndpoint = await loadRouteHandler("webhooks/endpoints", "POST");

    harness.auth.asAnonymous();
    const anonRes = await createEndpoint(
      harness.createRequest("/api/webhooks/endpoints", {
        method: "POST",
        body: {
          name: "Test",
          url: "https://external.example.com/hook",
          events: ["payment.completed"],
        },
      })
    );
    assert.equal(anonRes.status, 401);

    harness.auth.asUser(USERS.teacherA);
    const teacherRes = await createEndpoint(
      harness.createRequest("/api/webhooks/endpoints", {
        method: "POST",
        body: {
          name: "Test",
          url: "https://external.example.com/hook",
          events: ["payment.completed"],
        },
      })
    );
    assert.equal(teacherRes.status, 403);
  });

  it("T2-2.4-05: Cross-tenant isolation prevents Madrasa B from reading or triggering Madrasa A webhook endpoints", async () => {
    const getEndpoints = await loadRouteHandler("webhooks/endpoints", "GET");

    harness.db.seed("webhook_endpoints", {
      id: "wh-ep-a-secret",
      madrasa_id: MADRASA_A_ID,
      name: "Madrasa A Accounting",
      url: "https://madrasa-a.example.com/hook",
      secret: "whsec_secret_a",
      events: ["payment.completed"],
      is_active: true,
    });

    harness.auth.asUser(USERS.muhtamimB);
    const res = await getEndpoints(
      harness.createRequest("/api/webhooks/endpoints", { method: "GET" })
    );
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.ok(
      !text.includes("wh-ep-a-secret") && !text.includes("whsec_secret_a"),
      "Madrasa B must never see Madrasa A webhook endpoints or secrets"
    );
  });

  it("T2-2.4-06: Missing webhook tables (42P01) fall back cleanly and Phase 2 SQL enforces RLS", async () => {
    verifySqlMigrationContract({
      filePath: "supabase_phase_2_automation_bi_migration.sql",
      tables: [
        { tableName: "webhook_endpoints" },
        { tableName: "webhook_deliveries" },
      ],
    });

    const mod = await loadModule<{
      dispatchWebhookEvent: (
        madrasaId: string,
        eventType: string,
        data: Record<string, unknown>
      ) => Promise<Record<string, unknown>>;
    }>("@/lib/webhooks/dispatcher", ["dispatchWebhookEvent"]);

    harness.db.markTableMissing("webhook_endpoints", "42P01");
    harness.db.markTableMissing("webhook_deliveries", "PGRST205");

    const res = await mod.dispatchWebhookEvent(
      MADRASA_A_ID,
      "payment.completed",
      { amount: 1500 }
    );
    assert.ok(res && typeof res === "object");
  });
});
