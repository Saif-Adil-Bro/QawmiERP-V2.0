import nodemailer from "nodemailer";

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
  from?: string;
}

export interface SendEmailResult {
  ok: boolean;
  provider: "smtp" | "resend" | "none";
  messageId?: string;
  error?: string;
  response?: any;
}

export function isSmtpConfigured(): boolean {
  const user = (process.env.SMTP_USER || process.env.GMAIL_USER || "").trim();
  const pass = (process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || "").trim();
  return Boolean(user && pass);
}

export function isResendConfigured(): boolean {
  return Boolean((process.env.RESEND_API_KEY || "").trim());
}

export function isEmailGatewayConfigured(): boolean {
  return isSmtpConfigured() || isResendConfigured();
}

/**
 * Unified email sender supporting:
 * 1. Gmail / custom SMTP via Nodemailer (`SMTP_USER`/`GMAIL_USER` + `SMTP_PASS`/`GMAIL_APP_PASSWORD`)
 * 2. Resend HTTP API (`RESEND_API_KEY` + `RESEND_FROM_EMAIL`)
 */
export async function sendTransactionalEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const to = (input.to || "").trim();
  if (!to || !to.includes("@")) {
    return {
      ok: false,
      provider: "none",
      error: "সঠিক ইমেইল ঠিকানা পাওয়া যায়নি।",
    };
  }

  const smtpUser = (process.env.SMTP_USER || process.env.GMAIL_USER || "").trim();
  const smtpPass = (process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || "")
    .replace(/\s+/g, "")
    .trim();

  if (smtpUser && smtpPass) {
    const host = (process.env.SMTP_HOST || "smtp.gmail.com").trim();
    const port = Number(process.env.SMTP_PORT || 465);
    const secure = process.env.SMTP_SECURE
      ? process.env.SMTP_SECURE === "true"
      : port === 465;
    const from =
      input.from ||
      (process.env.SMTP_FROM || process.env.RESEND_FROM_EMAIL || `QawmiERP Security <${smtpUser}>`).trim();

    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
      });

      const info = await transporter.sendMail({
        from,
        to,
        subject: input.subject,
        text: input.text,
        ...(input.html ? { html: input.html } : {}),
      });

      return {
        ok: true,
        provider: "smtp",
        messageId: info.messageId,
        response: info.response,
      };
    } catch (err: any) {
      return {
        ok: false,
        provider: "smtp",
        error: `SMTP ইমেইল পাঠানো যায়নি: ${err?.message || "Unknown SMTP error"}`,
      };
    }
  }

  const resendApiKey = (process.env.RESEND_API_KEY || "").trim();
  if (!resendApiKey) {
    return {
      ok: false,
      provider: "none",
      error:
        "ইমেইল গেটওয়ে (SMTP/Gmail অথবা RESEND_API_KEY) কনফিগার করা নেই। Authenticator App অথবা SMS OTP ব্যবহার করুন।",
    };
  }

  try {
    const fromEmail = (
      input.from ||
      process.env.RESEND_FROM_EMAIL ||
      "QawmiERP Security <noreply@qawmimanager.com>"
    ).trim();

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [to],
        subject: input.subject,
        text: input.text,
        ...(input.html ? { html: input.html } : {}),
      }),
      signal: AbortSignal.timeout(10000),
    });

    const rawText = await response.text();
    let parsed: any = rawText;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      // keep raw text
    }

    if (!response.ok) {
      const detail = parsed?.message ? `: ${parsed.message}` : "";
      const isDomainNotVerified =
        response.status === 403 &&
        String(parsed?.message || "").toLowerCase().includes("domain");
      return {
        ok: false,
        provider: "resend",
        error: isDomainNotVerified
          ? `Email delivery failed (${response.status})${detail} — ইমেইল ডোমেইন ভেরিফাই করা নেই। Resend Dashboard > Domains-এ ডোমেইন ভেরিফাই করুন অথবা RESEND_FROM_EMAIL / SMTP_USER সেট করুন। আপাতত Authenticator App (TOTP) ব্যবহার করুন।`
          : `Email delivery failed (${response.status})${detail}`,
        response: parsed,
      };
    }

    return {
      ok: true,
      provider: "resend",
      messageId: parsed?.id,
      response: parsed,
    };
  } catch (err: any) {
    return {
      ok: false,
      provider: "resend",
      error: err?.message || "Email ডেলিভারি ত্রুটি।",
    };
  }
}
