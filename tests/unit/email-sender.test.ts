import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { sendMailMock, createTransportMock } = vi.hoisted(() => {
  const sendMailMock = vi.fn().mockResolvedValue({ messageId: "smtp-msg-1", response: "250 OK" });
  const createTransportMock = vi.fn(() => ({ sendMail: sendMailMock }));
  return { sendMailMock, createTransportMock };
});

vi.mock("nodemailer", () => ({
  default: {
    createTransport: createTransportMock,
  },
}));

import {
  isSmtpConfigured,
  isResendConfigured,
  isEmailGatewayConfigured,
  sendTransactionalEmail,
} from "@/lib/email-sender";

describe("Transactional Email Sender (lib/email-sender.ts)", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.GMAIL_USER;
    delete process.env.GMAIL_APP_PASSWORD;
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM_EMAIL;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllGlobals();
  });

  it("detects SMTP and Resend configuration correctly", () => {
    expect(isEmailGatewayConfigured()).toBe(false);
    process.env.GMAIL_USER = "madrasa@gmail.com";
    process.env.GMAIL_APP_PASSWORD = "abcd efgh ijkl mnop";
    expect(isSmtpConfigured()).toBe(true);
    expect(isEmailGatewayConfigured()).toBe(true);
    process.env.RESEND_API_KEY = "re_test_123";
    expect(isResendConfigured()).toBe(true);
  });

  it("sends via Gmail SMTP (Nodemailer) and strips spaces from App Password", async () => {
    process.env.GMAIL_USER = "madrasa@gmail.com";
    process.env.GMAIL_APP_PASSWORD = "abcd efgh ijkl mnop";

    const res = await sendTransactionalEmail({
      to: "user@example.com",
      subject: "OTP",
      text: "Code: 123456",
    });

    expect(res.ok).toBe(true);
    expect(res.provider).toBe("smtp");
    expect(createTransportMock).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: {
          user: "madrasa@gmail.com",
          pass: "abcdefghijklmnop",
        },
      })
    );
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "user@example.com",
        subject: "OTP",
        text: "Code: 123456",
      })
    );
  });

  it("parses detailed Resend error message on 403 when SMTP is not configured", async () => {
    process.env.RESEND_API_KEY = "re_test_123";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: async () => JSON.stringify({ message: "The qawmimanager.com domain is not verified." }),
      })
    );

    const res = await sendTransactionalEmail({
      to: "user@example.com",
      subject: "OTP",
      text: "Code: 123456",
    });

    expect(res.ok).toBe(false);
    expect(res.provider).toBe("resend");
    expect(res.error).toContain("Email delivery failed (403)");
    expect(res.error).toContain("domain is not verified");
  });
});
