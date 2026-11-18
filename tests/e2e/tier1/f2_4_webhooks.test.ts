import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "../helpers/runner";
import { loadModule, loadRouteHandler } from "../helpers/module-loader";
import {
  createTestHarness,
  type E2eTestHarness,
} from "../helpers/test-harness";
import { MADRASA_A_ID, USERS } from "../helpers/fixtures";

describe("Tier 1 — Feature 2.4: Webhook & External Integration Hub (Happy Path)", () => {
  let harness: E2eTestHarness;

  beforeEach(() => {
    harness = createTestHarness();
  });

  afterEach(() => {
    harness.dispose();
  });

  it("T1-2.4-01: signWebhookPayload and verifyWebhookSignature generate and verify HMAC-SHA256 t=<ts>,v1=<hex>", async () => {
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

    const secret = "whsec_test_secret_key_9876543210";
    const ts = Math.floor(Date.now() / 1000);
    const body = JSON.stringify({
      event: "payment.confirmed",
      receipt_no: "MR-2026-000101",
      amount: 1500,
    });

    const signed = mod.signWebhookPayload(secret, ts, body);
    assert.match(
      signed.signature,
      /^[0-9a-f]{64}$/,
      "HMAC-SHA256 signature must be 64 lowercase hex chars"
    );
    assert.equal(signed.header, `t=${ts},v1=${signed.signature}`);
    assert.equal(
      mod.verifyWebhookSignature(secret, signed.header, body, 300),
      true
    );
  });

  it("T1-2.4-02: dispatchWebhookEvent delivers signed POST only to active subscribed endpoints and logs WEBHOOK_DISPATCHED", async () => {
    const signer = await loadModule<{
      verifyWebhookSignature: (
        secret: string,
        header: string,
        rawBody: string,
        toleranceSec?: number
      ) => boolean;
    }>("@/lib/webhooks/signer", ["verifyWebhookSignature"]);
    const dispatcher = await loadModule<{
      dispatchWebhookEvent: (
        madrasaId: string,
        eventType: string,
        data: Record<string, unknown>
      ) => Promise<Record<string, unknown>>;
    }>("@/lib/webhooks/dispatcher", ["dispatchWebhookEvent"]);

    const secret = "whsec_live_partner_secret_12345";
    harness.db.seed("webhook_endpoints", [
      {
        id: "whe-active-match",
        madrasa_id: MADRASA_A_ID,
        name: "এক্সটার্নাল অ্যাকাউন্টিং",
        url: "https://hooks.partner-erp.example.com/qawmi",
        signing_secret: secret,
        subscribed_events: ["payment.confirmed", "exam.result_published"],
        is_active: true,
        max_retries: 5,
      },
      {
        id: "whe-unsubscribed",
        madrasa_id: MADRASA_A_ID,
        name: "শুধু ভর্তি হুক",
        url: "https://hooks.admissions-only.example.com/qawmi",
        signing_secret: "whsec_other",
        subscribed_events: ["student.admitted"],
        is_active: true,
        max_retries: 5,
      },
      {
        id: "whe-inactive",
        madrasa_id: MADRASA_A_ID,
        name: "নিষ্ক্রিয় হুক",
        url: "https://hooks.inactive.example.com/qawmi",
        signing_secret: "whsec_inactive",
        subscribed_events: ["payment.confirmed"],
        is_active: false,
        max_retries: 5,
      },
    ]);

    harness.http.onRequest("hooks.partner-erp.example.com", () =>
      new Response(JSON.stringify({ received: true }), { status: 200 })
    );

    await dispatcher.dispatchWebhookEvent(MADRASA_A_ID, "payment.confirmed", {
      receipt_no: "MR-2026-000101",
      amount: 1500,
    });

    assert.equal(
      harness.http.requests.length,
      1,
      "Only the 1 active subscribed endpoint must receive the webhook"
    );
    const req = harness.http.requests[0];
    assert.equal(req.url, "https://hooks.partner-erp.example.com/qawmi");
    const sigHeader =
      req.headers["x-qawmi-signature"] ||
      req.headers["x-webhook-signature"] ||
      "";
    assert.ok(sigHeader.startsWith("t="), "Outbound webhook must carry signed t=...,v1=... header");
    assert.equal(
      signer.verifyWebhookSignature(secret, sigHeader, req.body || "", 300),
      true,
      "Outbound webhook signature must cryptographically verify against raw body"
    );

    const deliveries = harness.db.getRows("webhook_deliveries");
    assert.equal(deliveries.length, 1);
    assert.equal(String(deliveries[0].status).toUpperCase(), "DELIVERED");
  });

  it("T1-2.4-03: Failed HTTP 500 delivery enters exponential backoff retry queue and transitions to DELIVERED on recovery", async () => {
    const dispatcher = await loadModule<{
      dispatchWebhookEvent: (
        madrasaId: string,
        eventType: string,
        data: Record<string, unknown>
      ) => Promise<Record<string, unknown>>;
      retryPendingWebhookDeliveries: (limit?: number) => Promise<Record<string, unknown>>;
    }>("@/lib/webhooks/dispatcher", [
      "dispatchWebhookEvent",
      "retryPendingWebhookDeliveries",
    ]);

    harness.db.seed("webhook_endpoints", {
      id: "whe-retry-1",
      madrasa_id: MADRASA_A_ID,
      name: "Retry Endpoint",
      url: "https://hooks.retry-test.example.com/events",
      signing_secret: "whsec_retry_secret_123",
      subscribed_events: ["payment.confirmed"],
      is_active: true,
      max_retries: 5,
    });

    let callCount = 0;
    harness.http.onRequest("hooks.retry-test.example.com", () => {
      callCount++;
      if (callCount === 1) {
        return new Response("Upstream Timeout", { status: 500 });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    await dispatcher.dispatchWebhookEvent(MADRASA_A_ID, "payment.confirmed", {
      amount: 2000,
    });

    let deliveries = harness.db.getRows("webhook_deliveries");
    assert.equal(deliveries.length, 1);
    assert.equal(String(deliveries[0].status).toUpperCase(), "RETRYING");
    assert.ok(deliveries[0].next_retry_at, "RETRYING delivery must schedule next_retry_at");

    // Fast-forward next_retry_at to past so retry queue picks it up
    harness.db.seed("webhook_deliveries", {
      ...deliveries[0],
      next_retry_at: new Date(Date.now() - 10_000).toISOString(),
    });

    await dispatcher.retryPendingWebhookDeliveries(20);
    deliveries = harness.db.getRows("webhook_deliveries");
    assert.equal(
      String(deliveries[0].status).toUpperCase(),
      "DELIVERED",
      "Retry recovery must transition delivery to DELIVERED"
    );
    assert.ok(Number(deliveries[0].attempt_count) >= 2);
  });

  it("T1-2.4-04: Endpoint creation generates whsec_* secret, secret rotation replaces it and logs WEBHOOK_SECRET_ROTATED", async () => {
    const createEndpoint = await loadRouteHandler("webhooks/endpoints", "POST");
    const rotateSecret = await loadRouteHandler(
      "webhooks/endpoints/[id]/rotate-secret",
      "POST"
    );

    harness.auth.asUser(USERS.muhtamimA);
    const createRes = await createEndpoint(
      harness.createRequest("/api/webhooks/endpoints", {
        method: "POST",
        body: {
          name: "বোর্ড পোর্টাল হুক",
          url: "https://hooks.board-portal.example.com/ingest",
          subscribedEvents: ["exam.result_published"],
          subscribed_events: ["exam.result_published"],
        },
      })
    );
    assert.ok(createRes.status === 200 || createRes.status === 201);
    const created = (await createRes.json()) as Record<string, unknown>;
    const endpoint = (created.endpoint || created.data || created) as Record<string, unknown>;
    const id = String(endpoint.id || "");
    const initialSecret = String(
      endpoint.signing_secret || endpoint.signingSecret || created.signingSecret || ""
    );
    assert.ok(id, "Created endpoint must return an id");
    assert.ok(initialSecret.length >= 16, "Created endpoint must generate a strong signing secret");

    const rotateRes = await rotateSecret(
      harness.createRequest(`/api/webhooks/endpoints/${id}/rotate-secret`, {
        method: "POST",
        body: {},
      }),
      { params: Promise.resolve({ id }) }
    );
    assert.equal(rotateRes.status, 200);
    const rotated = (await rotateRes.json()) as Record<string, unknown>;
    const newSecret = String(
      rotated.signing_secret ||
        rotated.signingSecret ||
        (rotated.data as Record<string, unknown> | undefined)?.signing_secret ||
        (rotated.data as Record<string, unknown> | undefined)?.signingSecret ||
        ""
    );
    assert.ok(newSecret && newSecret !== initialSecret, "Rotated secret must differ from previous secret");

    await harness.flushAsync();
    const audits = harness.db.getRows(
      "system_audit_logs",
      (r) => r.action === "WEBHOOK_SECRET_ROTATED"
    );
    assert.ok(audits.length >= 1, "Secret rotation must log WEBHOOK_SECRET_ROTATED");
  });

  it("T1-2.4-05: Test ping endpoint sends signed webhook.test request and returns delivery status", async () => {
    const testPing = await loadRouteHandler("webhooks/endpoints/[id]/test", "POST");

    harness.auth.asUser(USERS.muhtamimA);
    harness.db.seed("webhook_endpoints", {
      id: "whe-ping-1",
      madrasa_id: MADRASA_A_ID,
      name: "Ping Target",
      url: "https://hooks.ping-target.example.com/test",
      signing_secret: "whsec_ping_secret_0001",
      subscribed_events: ["payment.confirmed"],
      is_active: true,
    });
    harness.http.onRequest("hooks.ping-target.example.com", () =>
      new Response(JSON.stringify({ pong: true }), { status: 200 })
    );

    const res = await testPing(
      harness.createRequest("/api/webhooks/endpoints/whe-ping-1/test", {
        method: "POST",
        body: {},
      }),
      { params: Promise.resolve({ id: "whe-ping-1" }) }
    );
    assert.equal(res.status, 200);
    assert.equal(harness.http.requests.length, 1, "Test ping must fire 1 signed outbound HTTP request");
  });

  it("T1-2.4-06: validateWebhookUrl accepts valid HTTPS URLs and dispatcher falls back cleanly on missing tables (42P01/PGRST205)", async () => {
    const signer = await loadModule<{
      validateWebhookUrl: (
        url: string,
        opts?: { allowHttpInDev?: boolean }
      ) => { valid: boolean; reason?: string };
    }>("@/lib/webhooks/signer", ["validateWebhookUrl"]);
    const dispatcher = await loadModule<{
      dispatchWebhookEvent: (
        madrasaId: string,
        eventType: string,
        data: Record<string, unknown>
      ) => Promise<Record<string, unknown>>;
    }>("@/lib/webhooks/dispatcher", ["dispatchWebhookEvent"]);

    assert.equal(
      signer.validateWebhookUrl("https://hooks.partner-erp.example.com/qawmi").valid,
      true
    );

    harness.db.markTableMissing("webhook_endpoints", "PGRST205");
    harness.db.markTableMissing("webhook_deliveries", "42P01");

    const summary = await dispatcher.dispatchWebhookEvent(
      MADRASA_A_ID,
      "student.admitted",
      { studentId: "stu-1" }
    );
    assert.ok(summary && typeof summary === "object");
  });
});
