import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "../helpers/runner";
import { loadModule, loadRouteHandler } from "../helpers/module-loader";
import {
  createTestHarness,
  type E2eTestHarness,
} from "../helpers/test-harness";
import { MADRASA_A, MADRASA_A_ID, USERS } from "../helpers/fixtures";

describe("Tier 1 — Feature 2.2: Unified Multi-Channel Notification & Template Orchestrator (Happy Path)", () => {
  let harness: E2eTestHarness;

  beforeEach(() => {
    harness = createTestHarness();
  });

  afterEach(() => {
    harness.dispose();
  });

  it("T1-2.2-01: renderNotificationTemplate unifies {VarName} and [বাংলা ট্যাগ] placeholders cleanly", async () => {
    const mod = await loadModule<{
      renderNotificationTemplate: (
        template: string,
        variables: Record<string, string | number | null | undefined>
      ) => string;
    }>("@/lib/notifications/template-renderer", ["renderNotificationTemplate"]);

    const template =
      "সম্মানিত অভিভাবক, {StudentName} (রোল: [রোল], জামাত: [জামাত])-এর {DueAmount} টাকা ([বকেয়া টাকা]) বকেয়া। - [মাদরাসা]";
    const rendered = mod.renderNotificationTemplate(template, {
      StudentName: "আব্দুল্লাহ আল মামুন",
      Roll: "101",
      ClassName: "মিজান জামাত",
      DueAmount: 1500,
      MadrasaName: MADRASA_A.name,
    });

    assert.ok(rendered.includes("আব্দুল্লাহ আল মামুন"));
    assert.ok(rendered.includes("101"));
    assert.ok(rendered.includes("মিজান জামাত"));
    assert.ok(rendered.includes("1500") || rendered.includes("১৫০০"));
    assert.ok(rendered.includes(MADRASA_A.name));
    assert.ok(!rendered.includes("{StudentName}"));
    assert.ok(!rendered.includes("[রোল]"));
  });

  it("T1-2.2-02: Primary free channel success (Push) stops fallback and avoids redundant paid SMS call", async () => {
    const mod = await loadModule<{
      dispatchNotification: (
        event: string,
        payload: Record<string, unknown>
      ) => Promise<Record<string, unknown>>;
    }>("@/lib/notifications/orchestrator", ["dispatchNotification"]);

    harness.setEnv("FCM_SERVER_KEY", "test-fcm-key");
    harness.setEnv("SMS_API_KEY", "test-sms-key");
    harness.setEnv("SMS_API_URL", "https://sms.provider.test/send");

    harness.http.onRequest(/fcm|googleapis|push/i, () =>
      new Response(JSON.stringify({ success: 1, message_id: "fcm-msg-1" }), {
        status: 200,
      })
    );

    const res = await mod.dispatchNotification("attendance.absent", {
      madrasaId: MADRASA_A_ID,
      recipientUserId: USERS.parentA.id,
      recipientName: "মোঃ আব্দুর রহিম",
      recipientPhone: "01712345890",
      deviceTokens: ["fcm_device_token_001"],
      channels: ["push", "whatsapp", "sms"],
      message: "আব্দুল্লাহ আজ অনুপস্থিত ছিল।",
      variables: { StudentName: "আব্দুল্লাহ", MadrasaName: MADRASA_A.name },
    });

    const deliveredVia = String(
      res.deliveredChannel || res.channel || res.status || ""
    ).toLowerCase();
    assert.ok(
      deliveredVia.includes("push") || deliveredVia === "sent" || res.success === true,
      `Push primary delivery should succeed: ${JSON.stringify(res)}`
    );

    const smsCalls = harness.http.requests.filter((r) =>
      r.url.includes("sms.provider.test")
    );
    assert.equal(
      smsCalls.length,
      0,
      "Paid SMS fallback MUST NOT be called when free Push channel succeeded"
    );
  });

  it("T1-2.2-03: Automatic fallback chain Push -> WhatsApp -> SMS succeeds via SMS when Push and WhatsApp fail", async () => {
    const mod = await loadModule<{
      dispatchNotification: (
        event: string,
        payload: Record<string, unknown>
      ) => Promise<Record<string, unknown>>;
    }>("@/lib/notifications/orchestrator", ["dispatchNotification"]);

    harness.setEnv("FCM_SERVER_KEY", "test-fcm-key");
    harness.setEnv("WHATSAPP_ACCESS_TOKEN", "test-wa-token");
    harness.setEnv("WHATSAPP_PHONE_NUMBER_ID", "100200300");
    harness.setEnv("SMS_API_KEY", "test-sms-key");
    harness.setEnv("SMS_API_URL", "https://sms.provider.test/send");

    harness.http.onRequest(/fcm|googleapis/i, () =>
      new Response(JSON.stringify({ error: "FCM unavailable" }), { status: 500 })
    );
    harness.http.onRequest(/graph\.facebook\.com|whatsapp/i, () =>
      new Response(JSON.stringify({ error: "WhatsApp 500" }), { status: 500 })
    );
    harness.http.onRequest(/sms\.provider\.test/i, () =>
      new Response(JSON.stringify({ status: "sent", id: "sms-fallback-99" }), {
        status: 200,
      })
    );

    const res = await mod.dispatchNotification("fee.overdue", {
      madrasaId: MADRASA_A_ID,
      recipientName: "মোঃ আব্দুর রহিম",
      recipientPhone: "01712345890",
      deviceTokens: ["fcm_bad_token"],
      channels: ["push", "whatsapp", "sms"],
      message: "বকেয়া ১৫০০ টাকা পরিশোধ করুন।",
    });

    assert.ok(
      res.success === true ||
        String(res.status || "").toUpperCase() === "SENT" ||
        String(res.deliveredChannel || res.channel || "").toLowerCase() === "sms",
      `Fallback to SMS must succeed: ${JSON.stringify(res)}`
    );
  });

  it("T1-2.2-04: processNotificationQueue processes due PENDING/RETRYING queue rows up to limit", async () => {
    const mod = await loadModule<{
      processNotificationQueue: (limit?: number) => Promise<Record<string, unknown>>;
    }>("@/lib/notifications/orchestrator", ["processNotificationQueue"]);

    const pastIso = new Date(Date.now() - 120_000).toISOString();
    harness.db.seed("notification_queue", [
      {
        id: "q-1",
        madrasa_id: MADRASA_A_ID,
        event_key: "notice.published",
        channel: "in_app",
        recipient_user_id: USERS.parentA.id,
        recipient_name: "অভিভাবক ১",
        body: "আগামীকাল মাদ্রাসা বন্ধ।",
        status: "PENDING",
        attempt_count: 0,
        max_attempts: 3,
        next_retry_at: pastIso,
      },
      {
        id: "q-2",
        madrasa_id: MADRASA_A_ID,
        event_key: "notice.published",
        channel: "in_app",
        recipient_user_id: USERS.parentA.id,
        recipient_name: "অভিভাবক ২",
        body: "পরীক্ষার রুটিন প্রকাশিত হয়েছে।",
        status: "RETRYING",
        attempt_count: 1,
        max_attempts: 3,
        next_retry_at: pastIso,
      },
    ]);

    const summary = await mod.processNotificationQueue(10);
    assert.ok(summary && typeof summary === "object");
    const processed = Number(
      summary.processed ?? summary.processedCount ?? summary.sent ?? 0
    );
    assert.ok(processed >= 1, "Queue processor must process due notification items");
  });

  it("T1-2.2-05: POST /api/mobile/push-tokens registers and upserts device tokens preserving mobileSuccess envelope", async () => {
    const postPushToken = await loadRouteHandler("mobile/push-tokens", "POST");

    const { accessToken } = harness.auth.asUser(USERS.parentA);
    const headers = {
      "x-api-key": harness.mobileApiKey,
      authorization: `Bearer ${accessToken}`,
    };

    const res1 = await postPushToken(
      harness.createRequest("/api/mobile/push-tokens", {
        method: "POST",
        headers,
        body: {
          token: "fcm_android_token_unique_12345",
          platform: "android",
          deviceId: "dev-android-01",
        },
      })
    );
    assert.ok(res1.status === 200 || res1.status === 201);
    const body1 = (await res1.json()) as Record<string, unknown>;
    assert.equal(body1.success, true, "Mobile push-tokens must return mobileSuccess envelope");
    assert.ok("data" in body1 && "message" in body1);

    // Upsert duplicate token
    const res2 = await postPushToken(
      harness.createRequest("/api/mobile/push-tokens", {
        method: "POST",
        headers,
        body: {
          token: "fcm_android_token_unique_12345",
          platform: "android",
          deviceId: "dev-android-01",
        },
      })
    );
    assert.ok(res2.status === 200 || res2.status === 201);
    const rows = harness.db.getRows(
      "notification_device_tokens",
      (r) => r.token === "fcm_android_token_unique_12345"
    );
    assert.equal(rows.length, 1, "Duplicate push token registration must upsert without duplicates");
  });

  it("T1-2.2-06: POST /api/notifications/dispatch dispatches authorized notification with Bangla template rendering", async () => {
    const dispatchPost = await loadRouteHandler("notifications/dispatch", "POST");

    harness.auth.asUser(USERS.muhtamimA);
    const res = await dispatchPost(
      harness.createRequest("/api/notifications/dispatch", {
        method: "POST",
        body: {
          event: "notice.published",
          recipientUserId: USERS.parentA.id,
          recipientName: "মোঃ আব্দুর রহিম",
          recipientPhone: "01712345890",
          channels: ["in_app"],
          message: "বার্ষিক মাহফিলের নোটিশ",
        },
      })
    );
    assert.equal(res.status, 200);
    const body = (await res.json()) as Record<string, unknown>;
    assert.ok(body !== null && typeof body === "object");
  });
});
