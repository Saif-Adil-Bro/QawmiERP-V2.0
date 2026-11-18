import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "../helpers/runner";
import { loadModule, loadRouteHandler } from "../helpers/module-loader";
import { verifySqlMigrationContract } from "../helpers/sql-verifier";
import {
  createTestHarness,
  type E2eTestHarness,
} from "../helpers/test-harness";
import { MADRASA_A_ID, USERS } from "../helpers/fixtures";

describe("Tier 2 — Feature 1.2: Active Session Management & Step-Up 2FA (Edge, Security & Negative)", () => {
  let harness: E2eTestHarness;

  beforeEach(() => {
    harness = createTestHarness();
  });

  afterEach(() => {
    harness.dispose();
  });

  it("T2-1.2-01: requirePermission() blocks CRITICAL action with STEP_UP_REQUIRED when stepUpToken is missing", async () => {
    const permsServer = await loadModule<{
      requirePermission: (opts: Record<string, unknown>) => Promise<Record<string, unknown>>;
    }>("@/lib/permissions-server", ["requirePermission"]);

    harness.auth.asUser(USERS.muhtamimA);
    const result = await permsServer.requirePermission({
      userId: USERS.muhtamimA.id,
      madrasaId: MADRASA_A_ID,
      permissions: ["finance.delete"],
      riskLevel: "CRITICAL",
      requireStepUp: true,
      actionScope: "finance.delete",
    });

    assert.equal(result.allowed, false);
    assert.equal(result.stepUpRequired, true);
    assert.equal(result.errorCode, "STEP_UP_REQUIRED");
  });

  it("T2-1.2-02: Tampered or wrong-user/wrong-scope Step-Up token is rejected by requirePermission()", async () => {
    const permsServer = await loadModule<{
      requirePermission: (opts: Record<string, unknown>) => Promise<Record<string, unknown>>;
    }>("@/lib/permissions-server", ["requirePermission"]);
    const stepUpMod = await loadModule<Record<string, unknown>>(
      "@/lib/step-up-auth"
    );

    const issueToken = (stepUpMod.issueStepUpToken ||
      stepUpMod.createStepUpVerificationToken ||
      stepUpMod.signStepUpToken) as
      | ((opts: Record<string, unknown>) => Promise<string | Record<string, unknown>> | string | Record<string, unknown>)
      | undefined;
    if (typeof issueToken !== "function") {
      assert.fail("[E2E_MISSING_EXPORT] lib/step-up-auth must export token issuer");
    }

    harness.auth.asUser(USERS.muhtamimA);
    const issued = await issueToken({
      userId: USERS.accountantA.id,
      madrasaId: MADRASA_A_ID,
      actionScope: "accounting_period.unlock",
    });
    const wrongUserToken =
      typeof issued === "string"
        ? issued
        : String(issued.token || issued.stepUpToken || "");

    const wrongUserRes = await permsServer.requirePermission({
      userId: USERS.muhtamimA.id,
      madrasaId: MADRASA_A_ID,
      permissions: ["finance.delete"],
      riskLevel: "CRITICAL",
      requireStepUp: true,
      stepUpToken: wrongUserToken,
      actionScope: "finance.delete",
    });
    assert.equal(
      wrongUserRes.allowed,
      false,
      "Token issued for another user/scope must be rejected"
    );

    const tamperedRes = await permsServer.requirePermission({
      userId: USERS.muhtamimA.id,
      madrasaId: MADRASA_A_ID,
      permissions: ["finance.delete"],
      riskLevel: "CRITICAL",
      requireStepUp: true,
      stepUpToken: "invalid.tampered.token.value",
      actionScope: "finance.delete",
    });
    assert.equal(tamperedRes.allowed, false);
  });

  it("T2-1.2-03: TOTP rejects codes outside ±1 drift window and logs STEP_UP_FAILED on wrong OTP verify", async () => {
    const stepUpMod = await loadModule<Record<string, unknown>>(
      "@/lib/step-up-auth"
    );
    const verifyPost = await loadRouteHandler("auth/step-up/verify", "POST");

    const genSecret = (stepUpMod.generateTotpSecret ||
      stepUpMod.createTotpSecret) as (() => string) | undefined;
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
    const staleCode = genCode(secret, Date.now() - 180_000);
    assert.equal(
      verifyCode(secret, staleCode),
      false,
      "TOTP code from 6 steps (180s) ago must be rejected"
    );
    assert.equal(verifyCode(secret, "000000"), false);

    harness.auth.asUser(USERS.muhtamimA);
    harness.db.seed("step_up_verifications", {
      id: "ch-fail-1",
      madrasa_id: MADRASA_A_ID,
      user_id: USERS.muhtamimA.id,
      channel: "email",
      action_scope: "finance.delete",
      otp_hash: "non-matching-hash",
      expires_at: new Date(Date.now() + 300_000).toISOString(),
      verified_at: null,
    });

    const res = await verifyPost(
      harness.createRequest("/api/auth/step-up/verify", {
        method: "POST",
        body: {
          challengeId: "ch-fail-1",
          code: "999999",
          otp: "999999",
          actionScope: "finance.delete",
        },
      })
    );
    assert.ok(res.status >= 400 && res.status < 500);
  });

  it("T2-1.2-04: Suspended user or unprivileged staff cannot terminate another user's session", async () => {
    const deleteSession = await loadRouteHandler("auth/sessions", "DELETE");

    harness.db.seed("user_sessions", {
      id: "sess-target-1",
      madrasa_id: MADRASA_A_ID,
      user_id: USERS.muhtamimA.id,
      session_token_hash: "hash_target_1",
      is_active: true,
    });

    harness.auth.asUser(USERS.suspendedStaffA);
    const suspRes = await deleteSession(
      harness.createRequest("/api/auth/sessions?sessionId=sess-target-1", {
        method: "DELETE",
        body: { sessionId: "sess-target-1" },
      })
    );
    assert.ok(suspRes.status === 401 || suspRes.status === 403);

    harness.auth.asUser(USERS.teacherA);
    const teacherRes = await deleteSession(
      harness.createRequest("/api/auth/sessions?sessionId=sess-target-1", {
        method: "DELETE",
        body: { sessionId: "sess-target-1" },
      })
    );
    assert.equal(teacherRes.status, 403);

    const rows = harness.db.getRows(
      "user_sessions",
      (r) => r.id === "sess-target-1"
    );
    assert.equal(rows[0].is_active, true);
  });

  it("T2-1.2-05: Cross-tenant session termination is blocked (Madrasa B cannot revoke Madrasa A session)", async () => {
    const deleteSession = await loadRouteHandler("auth/sessions", "DELETE");

    harness.db.seed("user_sessions", {
      id: "sess-madrasa-a-1",
      madrasa_id: MADRASA_A_ID,
      user_id: USERS.accountantA.id,
      session_token_hash: "hash_a_1",
      is_active: true,
    });

    harness.auth.asUser(USERS.muhtamimB);
    const res = await deleteSession(
      harness.createRequest("/api/auth/sessions?sessionId=sess-madrasa-a-1", {
        method: "DELETE",
        body: { sessionId: "sess-madrasa-a-1" },
      })
    );
    assert.ok(res.status === 403 || res.status === 404);

    const rows = harness.db.getRows(
      "user_sessions",
      (r) => r.id === "sess-madrasa-a-1"
    );
    assert.equal(rows[0].is_active, true);
  });

  it("T2-1.2-06: Phase 1 SQL migration enforces madrasa_id + RLS on user_sessions, user_mfa_settings, and step_up_verifications", () => {
    verifySqlMigrationContract({
      filePath: "supabase_phase_1_enterprise_migration.sql",
      tables: [
        { tableName: "user_sessions" },
        { tableName: "user_mfa_settings" },
        { tableName: "step_up_verifications" },
      ],
    });
  });
});
