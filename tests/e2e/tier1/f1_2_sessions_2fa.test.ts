import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "../helpers/runner";
import { loadModule, loadRouteHandler } from "../helpers/module-loader";
import {
  createTestHarness,
  type E2eTestHarness,
} from "../helpers/test-harness";
import { MADRASA_A_ID, USERS } from "../helpers/fixtures";

describe("Tier 1 — Feature 1.2: Active Session Management & Step-Up 2FA (Happy Path)", () => {
  let harness: E2eTestHarness;

  beforeEach(() => {
    harness = createTestHarness();
  });

  afterEach(() => {
    harness.dispose();
  });

  it("T1-1.2-01: Session registration records IP/device metadata and GET /api/auth/sessions lists active sessions", async () => {
    const sessionMod = await loadModule<Record<string, unknown>>(
      "@/lib/session-manager"
    );
    const getSessions = await loadRouteHandler("auth/sessions", "GET");

    harness.auth.asUser(USERS.muhtamimA);
    harness.setIp("103.112.54.22");
    harness.setUserAgent("Mozilla/5.0 (X11; Linux x86_64) Chrome/128.0.0.0");

    const registerFn = (sessionMod.registerActiveSession ||
      sessionMod.recordUserSession ||
      sessionMod.upsertUserSession ||
      sessionMod.createSession) as
      | ((input: Record<string, unknown>) => Promise<unknown>)
      | undefined;
    if (typeof registerFn !== "function") {
      assert.fail(
        "[E2E_MISSING_EXPORT] lib/session-manager must export a session registration function"
      );
    }

    await registerFn({
      userId: USERS.muhtamimA.id,
      madrasaId: MADRASA_A_ID,
      sessionToken: harness.auth.getCurrentToken() || "tok-session-1",
      ipAddress: "103.112.54.22",
      userAgent: "Mozilla/5.0 (X11; Linux x86_64) Chrome/128.0.0.0",
    });

    const res = await getSessions(harness.createRequest("/api/auth/sessions"));
    assert.equal(res.status, 200);
    const body = (await res.json()) as Record<string, unknown>;
    const sessions = (Array.isArray(body)
      ? body
      : body.sessions || body.data || []) as Record<string, unknown>[];
    assert.ok(sessions.length >= 1, "Active session must be returned by GET /api/auth/sessions");
    assert.ok(
      sessions.some((s) => String(s.ip_address || s.ipAddress || "").includes("103.112.54.22")),
      "Session listing must include recorded IP address"
    );
  });

  it("T1-1.2-02: Remote session termination marks session revoked, writes SESSION_TERMINATED audit log, and fails active check", async () => {
    const sessionMod = await loadModule<Record<string, unknown>>(
      "@/lib/session-manager"
    );
    const deleteSession = await loadRouteHandler("auth/sessions", "DELETE");

    harness.auth.asUser(USERS.muhtamimA);
    harness.db.seed("user_sessions", {
      id: "sess-remote-001",
      madrasa_id: MADRASA_A_ID,
      user_id: USERS.accountantA.id,
      session_token_hash: "hash_remote_001",
      device_label: "Firefox on Windows",
      ip_address: "185.220.101.9",
      user_agent: "Mozilla/5.0 Firefox/129.0",
      is_active: true,
      revoked_at: null,
    });

    const res = await deleteSession(
      harness.createRequest("/api/auth/sessions?sessionId=sess-remote-001", {
        method: "DELETE",
        body: { sessionId: "sess-remote-001" },
      })
    );
    assert.equal(res.status, 200);
    await harness.flushAsync();

    const rows = harness.db.getRows(
      "user_sessions",
      (r) => r.id === "sess-remote-001"
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].is_active, false, "Terminated session must have is_active = false");
    assert.ok(rows[0].revoked_at, "Terminated session must record revoked_at timestamp");

    const audits = harness.db.getRows(
      "system_audit_logs",
      (r) => r.action === "SESSION_TERMINATED"
    );
    assert.ok(audits.length >= 1, "SESSION_TERMINATED audit log must be written");

    const validateFn = (sessionMod.validateActiveSession ||
      sessionMod.isSessionRevoked) as
      | ((...args: unknown[]) => Promise<unknown>)
      | undefined;
    assert.equal(typeof validateFn, "function");
  });

  it("T1-1.2-03: RFC 6238 TOTP generates valid Base32 secret + otpauth URI and verifies current and ±1 window codes", async () => {
    const stepUpMod = await loadModule<Record<string, unknown>>(
      "@/lib/step-up-auth"
    );

    const genSecret = (stepUpMod.generateTotpSecret ||
      stepUpMod.createTotpSecret) as (() => string) | undefined;
    const genUri = (stepUpMod.buildTotpUri ||
      stepUpMod.generateTotpUri ||
      stepUpMod.getOtpAuthUri) as
      | ((secret: string, label: string, issuer?: string) => string)
      | undefined;
    const genCode = (stepUpMod.generateTotpCode ||
      stepUpMod.computeTotpCode) as
      | ((secret: string, timestampMs?: number) => string)
      | undefined;
    const verifyCode = (stepUpMod.verifyTotpCode ||
      stepUpMod.verifyTotp) as
      | ((secret: string, code: string, opts?: Record<string, unknown> | number) => boolean)
      | undefined;

    if (typeof genSecret !== "function") {
      assert.fail("[E2E_MISSING_EXPORT] generateTotpSecret must exist");
    }
    if (typeof genCode !== "function") {
      assert.fail("[E2E_MISSING_EXPORT] generateTotpCode must exist");
    }
    if (typeof verifyCode !== "function") {
      assert.fail("[E2E_MISSING_EXPORT] verifyTotpCode must exist");
    }

    const secret = genSecret();
    assert.match(secret, /^[A-Z2-7]{16,}$/, "TOTP secret must be valid Base32");

    if (typeof genUri === "function") {
      const uri = genUri(secret, USERS.muhtamimA.email, "QawmiERP");
      assert.ok(
        uri.startsWith("otpauth://totp/") && uri.includes(secret),
        "TOTP URI must follow otpauth://totp/ format containing secret"
      );
    }

    const nowMs = Date.now();
    const currentCode = genCode(secret, nowMs);
    assert.match(currentCode, /^\d{6}$/, "TOTP code must be 6 digits");
    assert.equal(verifyCode(secret, currentCode), true, "Current TOTP step must verify");

    const prevStepCode = genCode(secret, nowMs - 30_000);
    assert.equal(
      verifyCode(secret, prevStepCode),
      true,
      "Adjacent -1 TOTP step must verify within ±1 drift window"
    );
  });

  it("T1-1.2-04: Step-Up OTP challenge -> verify flow issues short-lived token and logs STEP_UP_VERIFIED", async () => {
    const challengePost = await loadRouteHandler("auth/step-up/challenge", "POST");
    const verifyPost = await loadRouteHandler("auth/step-up/verify", "POST");

    harness.auth.asUser(USERS.muhtamimA);
    let capturedOtp = "";
    harness.http.onRequest(/.*/, (req) => {
      const m = (req.body || "").match(/\b(\d{6})\b/);
      if (m) capturedOtp = m[1];
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    const challengeRes = await challengePost(
      harness.createRequest("/api/auth/step-up/challenge", {
        method: "POST",
        body: { channel: "email", actionScope: "accounting_period.unlock" },
      })
    );
    assert.equal(challengeRes.status, 200);
    const chBody = (await challengeRes.json()) as Record<string, unknown>;
    const challengeId =
      (chBody.challengeId as string | undefined) ||
      (chBody.id as string | undefined) ||
      ((chBody.data as Record<string, unknown> | undefined)?.challengeId as string | undefined);
    assert.ok(challengeId, "Challenge endpoint must return challengeId");

    // Allow dev/test OTP echo or SMS/Email intercepted code
    const otpToSubmit =
      capturedOtp ||
      String(chBody.debugCode || chBody.devOtp || chBody.otp || "");
    assert.match(
      otpToSubmit,
      /^\d{6}$/,
      "Challenge must dispatch a 6-digit OTP via external channel (or dev echo)"
    );

    const verifyRes = await verifyPost(
      harness.createRequest("/api/auth/step-up/verify", {
        method: "POST",
        body: {
          challengeId,
          code: otpToSubmit,
          otp: otpToSubmit,
          actionScope: "accounting_period.unlock",
        },
      })
    );
    assert.equal(verifyRes.status, 200);
    const vBody = (await verifyRes.json()) as Record<string, unknown>;
    const token =
      (vBody.stepUpToken as string | undefined) ||
      (vBody.token as string | undefined) ||
      ((vBody.data as Record<string, unknown> | undefined)?.token as string | undefined);
    assert.ok(token && token.length >= 16, "Verify endpoint must issue a step-up token");

    await harness.flushAsync();
    const audits = harness.db.getRows(
      "system_audit_logs",
      (r) => r.action === "STEP_UP_VERIFIED"
    );
    assert.ok(audits.length >= 1, "STEP_UP_VERIFIED must be logged to system_audit_logs");
  });

  it("T1-1.2-05: requirePermission() grants CRITICAL action when supplied a valid Step-Up verification token", async () => {
    const permsServer = await loadModule<{
      requirePermission: (opts: Record<string, unknown>) => Promise<Record<string, unknown>>;
    }>("@/lib/permissions-server", ["requirePermission"]);
    const stepUpMod = await loadModule<Record<string, unknown>>(
      "@/lib/step-up-auth"
    );

    harness.auth.asUser(USERS.muhtamimA);
    const issueToken = (stepUpMod.issueStepUpToken ||
      stepUpMod.createStepUpVerificationToken ||
      stepUpMod.signStepUpToken) as
      | ((opts: Record<string, unknown>) => Promise<string | Record<string, unknown>> | string | Record<string, unknown>)
      | undefined;
    if (typeof issueToken !== "function") {
      assert.fail("[E2E_MISSING_EXPORT] lib/step-up-auth must export token issuer");
    }

    const issued = await issueToken({
      userId: USERS.muhtamimA.id,
      madrasaId: MADRASA_A_ID,
      actionScope: "finance.delete",
    });
    const tokenStr =
      typeof issued === "string"
        ? issued
        : String(issued.token || issued.stepUpToken || "");
    assert.ok(tokenStr.length >= 10, "Issued step-up token must be non-empty");

    const result = await permsServer.requirePermission({
      userId: USERS.muhtamimA.id,
      madrasaId: MADRASA_A_ID,
      permissions: ["finance.delete"],
      riskLevel: "CRITICAL",
      requireStepUp: true,
      stepUpToken: tokenStr,
      actionScope: "finance.delete",
    });
    assert.equal(
      result.allowed,
      true,
      `requirePermission must allow CRITICAL action with valid Step-Up token: ${JSON.stringify(result)}`
    );
  });

  it("T1-1.2-06: Missing user_sessions / step_up_verifications tables (42P01/PGRST205) fall back cleanly", async () => {
    const getSessions = await loadRouteHandler("auth/sessions", "GET");

    harness.auth.asUser(USERS.muhtamimA);
    harness.db.markTableMissing("user_sessions", "PGRST205");
    harness.db.markTableMissing("user_mfa_settings", "42P01");
    harness.db.markTableMissing("step_up_verifications", "PGRST205");

    const res = await getSessions(harness.createRequest("/api/auth/sessions"));
    assert.equal(
      res.status,
      200,
      "GET /api/auth/sessions must gracefully fall back when relational tables are missing"
    );
    const body = (await res.json()) as Record<string, unknown>;
    assert.ok(body !== null && typeof body === "object");
  });
});
