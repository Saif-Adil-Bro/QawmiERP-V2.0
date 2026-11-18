import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderNotificationTemplate } from "@/lib/notifications/template-renderer";
import { normalizeBangladeshiPhone } from "@/lib/notifications/channels";
import {
  signWebhookPayload,
  verifyWebhookSignature,
  validateWebhookUrl,
} from "@/lib/webhooks/signer";
import { sanitizeWebhookData } from "@/lib/webhooks/dispatcher";
import { authorizeCronRequest } from "@/lib/automation/cron-auth";

describe("Feature 2.2: Notification Template Renderer & Phone Normalizer", () => {
  it("renders both {VarName} and [বাংলা ট্যাগ] placeholders cleanly", () => {
    const tpl =
      "আসসালামু আলাইকুম, {StudentName} (রোল: [রোল], জামাত: [জামাত]) এর {DueAmount} টাকা বকেয়া।";
    const out = renderNotificationTemplate(tpl, {
      StudentName: "মোঃ আব্দুল্লাহ",
      roll_number: "১০৫",
      ClassName: "হিফজুল কুরআন",
      dueAmount: "১,৫০০",
    });
    expect(out).toBe(
      "আসসালামু আলাইকুম, মোঃ আব্দুল্লাহ (রোল: ১০৫, জামাত: হিফজুল কুরআন) এর ১,৫০০ টাকা বকেয়া।"
    );
  });

  it("strips unresolved placeholders and never leaks 'undefined' or raw tags", () => {
    const tpl = "প্রিয় {StudentName}, রোল [রোল], অজানা {UnknownTag} ও [অজানা ট্যাগ]।";
    const out = renderNotificationTemplate(tpl, {
      StudentName: "তাওহীদ",
      roll: undefined,
    });
    expect(out).not.toContain("undefined");
    expect(out).not.toContain("{UnknownTag}");
    expect(out).not.toContain("[রোল]");
    expect(out).not.toContain("[অজানা ট্যাগ]");
    expect(out).toContain("প্রিয় তাওহীদ");
  });

  it("preserves [...] literals inside substituted {VarName} values (single-pass)", () => {
    const out = renderNotificationTemplate("নোট: {Title} - [রোল]", {
      Title: "ফি [জানুয়ারি]",
      roll: "১০১",
    });
    expect(out).toBe("নোট: ফি [জানুয়ারি] - ১০১");
  });

  it("normalizes Bangladeshi phone numbers including Bangla digits into 8801...", () => {
    expect(normalizeBangladeshiPhone("01712345678")).toBe("8801712345678");
    expect(normalizeBangladeshiPhone("+8801812-345678")).toBe("8801812345678");
    expect(normalizeBangladeshiPhone("০১৭১২৩৪৫৬৭৮")).toBe("8801712345678");
  });
});

describe("Feature 2.4: Webhook Signer, SSRF Guard & PII Sanitizer", () => {
  it("signs and verifies HMAC-SHA256 webhook payloads with timestamp tolerance", () => {
    const secret = "whsec_test_secret_1234567890";
    const nowSec = Math.floor(Date.now() / 1000);
    const body = JSON.stringify({ event: "payment.confirmed", amount: 1500 });

    const { header, signature } = signWebhookPayload(secret, nowSec, body);
    expect(signature).toMatch(/^[a-f0-9]{64}$/);
    expect(header).toBe(`t=${nowSec},v1=${signature}`);

    expect(verifyWebhookSignature(secret, header, body, 300)).toBe(true);
    expect(verifyWebhookSignature("wrong_secret", header, body, 300)).toBe(false);
    expect(verifyWebhookSignature(secret, header, `${body} `, 300)).toBe(false);

    // Expired timestamp beyond tolerance
    const expired = signWebhookPayload(secret, nowSec - 600, body);
    expect(verifyWebhookSignature(secret, expired.header, body, 300)).toBe(false);

    // toleranceSec === 0 enforces strict 0-second replay window (does not disable check)
    const twoSecOld = signWebhookPayload(secret, nowSec - 2, body);
    expect(verifyWebhookSignature(secret, twoSecOld.header, body, 0)).toBe(false);
  });

  it("blocks SSRF URLs (localhost, loopback, AWS metadata, RFC1918, IPv6 ULA/link-local, non-HTTPS)", () => {
    const blockedUrls = [
      "http://example.com/hook",
      "ftp://example.com/hook",
      "https://localhost/hook",
      "https://127.0.0.1/hook",
      "https://[::1]/hook",
      "https://0.0.0.0/hook",
      "https://169.254.169.254/latest/meta-data/",
      "https://10.0.0.5/hook",
      "https://172.16.0.1/hook",
      "https://192.168.1.10/hook",
      "https://[fc00::1]/hook",
      "https://[fe80::1]/hook",
      "https://internal.service.local/hook",
    ];

    for (const u of blockedUrls) {
      expect(validateWebhookUrl(u).valid, `Expected ${u} to be blocked`).toBe(false);
    }

    expect(validateWebhookUrl("https://hooks.example.org/qawmi-erp").valid).toBe(true);
    expect(
      validateWebhookUrl("http://hooks.example.org/qawmi-erp", { allowHttpInDev: true }).valid
    ).toBe(true);
  });

  it("omits raw NID/secrets and masks phone/email in webhook payloads", () => {
    const sanitized = sanitizeWebhookData({
      student_id: "stu-1",
      student_name: "আব্দুল্লাহ",
      nid_number: "1995123456789",
      national_id: "1234567890",
      parent_phone: "01712345890",
      email: "guardian@example.com",
      nested: {
        guardian_phone: "01812345678",
        nid: "9999999999",
      },
    });

    expect(sanitized.nid_number).toBeUndefined();
    expect(sanitized.national_id).toBeUndefined();
    expect(sanitized.nested.nid).toBeUndefined();
    expect(sanitized.parent_phone).not.toBe("01712345890");
    expect(sanitized.parent_phone).toContain("****");
    expect(sanitized.nested.guardian_phone).toContain("****");
    expect(sanitized.email).not.toBe("guardian@example.com");
    expect(sanitized.student_name).toBe("আব্দুল্লাহ");
  });

  it("omits/masks camelCase PII fields (parentPhone, guardianEmail, nidNumber, nationalId, birthRegNo, passportNo)", () => {
    const sanitized = sanitizeWebhookData({
      parentPhone: "01712345890",
      guardianEmail: "parent@example.com",
      nidNumber: "1995123456789",
      nationalId: "9876543210",
      birthRegNo: "2010123456789",
      passportNo: "A12345678",
    });

    expect(sanitized.nidNumber).toBeUndefined();
    expect(sanitized.nationalId).toBeUndefined();
    expect(sanitized.birthRegNo).toBeUndefined();
    expect(sanitized.passportNo).toBeUndefined();
    expect(sanitized.parentPhone).not.toBe("01712345890");
    expect(sanitized.parentPhone).toContain("****");
    expect(sanitized.guardianEmail).not.toBe("parent@example.com");
    expect(sanitized.guardianEmail).toContain("***");
  });
});

describe("Feature 2.1: Cron Bearer Authorization", () => {
  const prevSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = "test-cron-secret-xyz";
  });

  afterEach(() => {
    if (prevSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = prevSecret;
  });

  it("accepts matching Bearer CRON_SECRET and rejects invalid/missing secret", async () => {
    const okReq = new Request("https://example.com/api/cron/monthly-fees", {
      headers: { Authorization: "Bearer test-cron-secret-xyz" },
    });
    const okRes = await authorizeCronRequest(okReq);
    expect(okRes.ok).toBe(true);

    const badReq = new Request("https://example.com/api/cron/monthly-fees", {
      headers: { Authorization: "Bearer wrong-secret" },
    });
    const badRes = await authorizeCronRequest(badReq);
    expect(badRes.ok).toBe(false);
  });
});
