import { describe, it, expect, vi } from "vitest";
import * as XLSX from "xlsx";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  base32Encode,
  base32Decode,
  generateTotpSecret,
  buildTotpUri,
  generateTotpCode,
  verifyTotpCode,
  encryptTotpSecret,
  decryptTotpSecret,
  generateSixDigitOtp,
  hashOtpCode,
  verifyOtpHash,
  evaluateOtpAttempt,
  evaluateTotpLockout,
  createSignedStepUpToken,
  verifySignedStepUpToken,
} from "@/lib/step-up-auth";
import {
  shouldEnforceStepUp,
  evaluatePermissionAndStepUp,
  type ServerPermissionContext,
} from "@/lib/permissions-server";
import {
  DEFAULT_SYSTEM_ROLES,
  PERMISSION_MAP,
  calculateEffectivePermissions,
  type UserSecurityProfile,
} from "@/lib/permissions";
import { AUDIT_MODULE_LABELS_BN } from "@/lib/audit-log";
import { MODULE_POLICIES } from "@/lib/action-authorization";
import {
  parseUserAgent,
  hashSessionToken,
  evaluateSessionRecordRevoked,
} from "@/lib/session-manager";
import {
  maskPhoneNumber,
  maskNidNumber,
  maskEmailAddress,
  maskBankAccount,
  canViewUnmaskedField,
  maskStudentSensitiveFields,
  maskDonorSensitiveFields,
  maskStaffSensitiveFields,
} from "@/lib/pii-masking";
import {
  buildExportWatermark,
  buildWatermarkedCsv,
  buildWatermarkedWorkbook,
  buildPrintWatermarkHtml,
  sanitizeSpreadsheetCell,
} from "@/lib/export-watermark";

describe("Phase 1 Security Core — F0 Pre-Registrations", () => {
  it("pre-registers all Phase 1–3 permissions, AuditModuleKeys, and ModulePolicies", () => {
    const requiredPerms = [
      "approval.view",
      "approval.manage",
      "approval.approve",
      "security.sessions.manage",
      "security.2fa.manage",
      "data.unmask",
      "automation.view",
      "automation.manage",
      "webhook.view",
      "webhook.manage",
      "analytics.early_warning",
      "analytics.early_warning.manage",
      "anomaly.view",
      "anomaly.manage",
    ];
    for (const p of requiredPerms) {
      expect(PERMISSION_MAP[p], `Missing permission ${p}`).toBeDefined();
    }

    for (const mod of [
      "boarding",
      "anomaly",
      "ai",
      "approvals",
      "automation",
      "notifications",
      "webhooks",
      "analytics",
      "security",
    ] as const) {
      expect(AUDIT_MODULE_LABELS_BN[mod], `Missing audit label ${mod}`).toBeTruthy();
    }

    for (const mod of [
      "approvals",
      "security",
      "automation",
      "webhooks",
      "analytics",
      "anomaly",
      "bi",
    ] as const) {
      expect(MODULE_POLICIES[mod], `Missing module policy ${mod}`).toBeDefined();
    }
  });
});

describe("Feature 1.2 — RFC 6238 TOTP & Secret Encryption", () => {
  it("encodes and decodes Base32 accurately", () => {
    const raw = Buffer.from("12345678901234567890", "utf8");
    const b32 = base32Encode(raw);
    expect(b32).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    expect(base32Decode(b32).equals(raw)).toBe(true);
  });

  it("generates and verifies RFC 6238 TOTP codes within +/-1 time-step window", () => {
    const secret = generateTotpSecret(20);
    const uri = buildTotpUri({
      secret,
      accountName: "muhtamim@madrasa.edu.bd",
      issuer: "QawmiERP",
    });
    expect(uri).toContain("otpauth://totp/");
    expect(uri).toContain(`secret=${secret}`);

    const nowMs = 1_700_000_000_000;
    const code = generateTotpCode(secret, nowMs);
    expect(code).toMatch(/^\d{6}$/);
    expect(verifyTotpCode(secret, code, nowMs)).toBe(true);
    expect(verifyTotpCode(secret, code, nowMs + 30_000)).toBe(true);
    expect(verifyTotpCode(secret, "000000", nowMs)).toBe(false);
  });

  it("encrypts and decrypts TOTP secrets symmetrically", () => {
    const secret = generateTotpSecret(20);
    const encrypted = encryptTotpSecret(secret);
    expect(encrypted).not.toContain(secret);
    expect(decryptTotpSecret(encrypted)).toBe(secret);
  });
});

describe("Feature 1.2 — OTP Challenge Expiry, Lockout & Step-Up Token", () => {
  it("evaluates OTP attempts, enforces expiry and max-attempt lockout", () => {
    const challengeId = "chal-001";
    const otp = generateSixDigitOtp();
    expect(otp).toMatch(/^\d{6}$/);
    const hash = hashOtpCode(otp, challengeId);
    expect(verifyOtpHash(otp, hash, challengeId)).toBe(true);

    const nowMs = 1_700_000_000_000;
    const baseState = {
      otpHash: hash,
      attemptCount: 0,
      maxAttempts: 3,
      expiresAt: new Date(nowMs + 300_000).toISOString(),
      status: "PENDING",
    };

    // Wrong attempts until lockout
    const fail1 = evaluateOtpAttempt(baseState, "999999", nowMs + 1000, challengeId);
    expect(fail1.valid).toBe(false);
    expect(fail1.nextStatus).toBe("PENDING");
    expect(fail1.nextAttemptCount).toBe(1);
    expect(fail1.reason).toBe("INVALID_CODE");

    const fail3 = evaluateOtpAttempt({ ...baseState, attemptCount: 2 }, "999999", nowMs + 2000, challengeId);
    expect(fail3.valid).toBe(false);
    expect(fail3.nextStatus).toBe("LOCKED");
    expect(fail3.reason).toBe("LOCKED");

    // Expired OTP
    const expired = evaluateOtpAttempt(baseState, otp, nowMs + 305_000, challengeId);
    expect(expired.valid).toBe(false);
    expect(expired.nextStatus).toBe("EXPIRED");
    expect(expired.reason).toBe("EXPIRED");

    // Valid OTP
    const ok = evaluateOtpAttempt(baseState, otp, nowMs + 5000, challengeId);
    expect(ok.valid).toBe(true);
    expect(ok.nextStatus).toBe("VERIFIED");

    // Replay on VERIFIED or CONSUMED challenge must be rejected
    const replayVerified = evaluateOtpAttempt(
      { ...baseState, status: "VERIFIED", attemptCount: 1 },
      otp,
      nowMs + 6000,
      challengeId
    );
    expect(replayVerified.valid).toBe(false);
    expect(replayVerified.nextStatus).toBe("VERIFIED");
    expect(replayVerified.reason).toBe("ALREADY_USED");

    const replayConsumed = evaluateOtpAttempt(
      { ...baseState, status: "CONSUMED", attemptCount: 1 },
      otp,
      nowMs + 7000,
      challengeId
    );
    expect(replayConsumed.valid).toBe(false);
    expect(replayConsumed.nextStatus).toBe("CONSUMED");
    expect(replayConsumed.reason).toBe("ALREADY_USED");
  });

  it("enforces TOTP brute-force lockout, cooldown expiry, and reset on success", () => {
    const nowMs = 1_700_000_000_000;
    const fail4 = evaluateTotpLockout({ failedAttempts: 3, maxAttempts: 5, lockoutSeconds: 300 }, false, nowMs);
    expect(fail4.locked).toBe(false);
    expect(fail4.nextFailedAttempts).toBe(4);
    expect(fail4.remainingAttempts).toBe(1);

    const fail5 = evaluateTotpLockout({ failedAttempts: 4, maxAttempts: 5, lockoutSeconds: 300 }, false, nowMs);
    expect(fail5.locked).toBe(true);
    expect(fail5.remainingAttempts).toBe(0);
    expect(fail5.nextLockedUntil).toBe(new Date(nowMs + 300_000).toISOString());

    // During lockout window, even a valid code is rejected
    const duringLock = evaluateTotpLockout(
      { failedAttempts: 5, lockedUntil: fail5.nextLockedUntil, maxAttempts: 5 },
      true,
      nowMs + 60_000
    );
    expect(duringLock.allowed).toBe(false);
    expect(duringLock.locked).toBe(true);

    // After cooldown expires, valid code succeeds and resets counter
    const afterCooldown = evaluateTotpLockout(
      { failedAttempts: 5, lockedUntil: fail5.nextLockedUntil, maxAttempts: 5 },
      true,
      nowMs + 301_000
    );
    expect(afterCooldown.allowed).toBe(true);
    expect(afterCooldown.locked).toBe(false);
    expect(afterCooldown.nextFailedAttempts).toBe(0);
    expect(afterCooldown.nextLockedUntil).toBeNull();
  });

  it("issues and verifies short-lived signed Step-Up tokens", () => {
    const nowMs = 1_700_000_000_000;
    const { token } = createSignedStepUpToken({
      userId: "user-1",
      madrasaId: "madrasa-1",
      actionScope: "student.delete",
      ttlSeconds: 300,
      nowMs,
    });

    const valid = verifySignedStepUpToken(token, {
      userId: "user-1",
      madrasaId: "madrasa-1",
      actionScope: "student.delete",
      nowMs: nowMs + 60_000,
    });
    expect(valid.valid).toBe(true);

    const wrongUser = verifySignedStepUpToken(token, {
      userId: "user-2",
      madrasaId: "madrasa-1",
      nowMs: nowMs + 60_000,
    });
    expect(wrongUser.valid).toBe(false);

    const expired = verifySignedStepUpToken(token, {
      userId: "user-1",
      madrasaId: "madrasa-1",
      nowMs: nowMs + 400_000,
    });
    expect(expired.valid).toBe(false);
  });

  it("rejects empty actionScope tokens when an actionScope is expected and does not escalate '' to CRITICAL", () => {
    const nowMs = 1_700_000_000_000;
    const { token } = createSignedStepUpToken({
      userId: "user-1",
      madrasaId: "madrasa-1",
      actionScope: "",
      ttlSeconds: 300,
      nowMs,
    });

    const verified = verifySignedStepUpToken(token, {
      userId: "user-1",
      madrasaId: "madrasa-1",
      actionScope: "approval.decide",
      nowMs: nowMs + 10_000,
    });
    expect(verified.valid).toBe(false);
    expect(verified.reason).toBe("SCOPE_MISMATCH");
  });
});

describe("Feature 1.2 — requirePermission CRITICAL Step-Up Gating", () => {
  function makeCtx(role = "super_admin", status: "ACTIVE" | "SUSPENDED" = "ACTIVE"): ServerPermissionContext {
    const profile: UserSecurityProfile = {
      userId: "user-admin",
      madrasaId: "madrasa-1",
      fullName: "Muhtamim",
      email: "admin@madrasa.edu.bd",
      phone: "01712345678",
      primaryRole: role,
      roles: [role],
      status,
      directPermissions: [],
      deniedPermissions: [],
      temporaryPermissions: [],
      dataScopeOverrides: {},
      assignedClassIds: [],
      assignedSubjectIds: [],
      assignedStudentIds: [],
      linkedStudentIds: [],
    };
    return {
      userId: "user-admin",
      madrasaId: "madrasa-1",
      role,
      roles: [role],
      status,
      summary: calculateEffectivePermissions(profile, DEFAULT_SYSTEM_ROLES),
      profile,
      allRoles: DEFAULT_SYSTEM_ROLES,
    };
  }

  it("blocks CRITICAL operations without a valid Step-Up token and allows with valid token", async () => {
    expect(shouldEnforceStepUp({ riskLevel: "CRITICAL" }, true)).toBe(true);
    expect(shouldEnforceStepUp({ permissions: ["student.delete"] }, true)).toBe(true);
    expect(shouldEnforceStepUp({ permissions: ["student.view"] }, true)).toBe(false);

    const ctx = makeCtx("super_admin");
    const denied = await evaluatePermissionAndStepUp(
      ctx,
      {
        userId: ctx.userId,
        madrasaId: ctx.madrasaId,
        roles: ["super_admin"],
        riskLevel: "CRITICAL",
        actionScope: "accounting_period.unlock",
      },
      true
    );
    expect(denied.allowed).toBe(false);
    expect(denied.stepUpRequired).toBe(true);
    expect(denied.errorCode).toBe("STEP_UP_REQUIRED");

    const { token } = createSignedStepUpToken({
      userId: ctx.userId,
      madrasaId: ctx.madrasaId,
      actionScope: "accounting_period.unlock",
    });

    const allowed = await evaluatePermissionAndStepUp(
      ctx,
      {
        userId: ctx.userId,
        madrasaId: ctx.madrasaId,
        roles: ["super_admin"],
        riskLevel: "CRITICAL",
        actionScope: "accounting_period.unlock",
        stepUpToken: token,
      },
      true
    );
    expect(allowed.allowed).toBe(true);
  });

  it("blocks suspended users and denied portal roles", async () => {
    const suspended = makeCtx("super_admin", "SUSPENDED");
    const res1 = await evaluatePermissionAndStepUp(suspended, {
      userId: suspended.userId,
      madrasaId: suspended.madrasaId,
      roles: ["super_admin"],
    });
    expect(res1.allowed).toBe(false);
    expect(res1.errorCode).toBe("FORBIDDEN");

    const parent = makeCtx("parent", "ACTIVE");
    const res2 = await evaluatePermissionAndStepUp(parent, {
      userId: parent.userId,
      madrasaId: parent.madrasaId,
      denyRoles: ["parent", "student"],
    });
    expect(res2.allowed).toBe(false);
  });

  it("restricts tenant security policy management away from non-admin teacher roles", () => {
    const teacherCtx = makeCtx("teacher", "ACTIVE");
    expect(teacherCtx.roles).not.toContain("super_admin");
    expect(teacherCtx.summary.effectivePermissions).not.toContain("security.sessions.manage");

    const mfaRouteSource = readFileSync(
      resolve(process.cwd(), "app/api/auth/mfa/setup/route.ts"),
      "utf8"
    );
    expect(mfaRouteSource).not.toContain('effectivePermissions.includes("security.2fa.manage")');
  });
});

describe("Feature 1.2 — Session Parsing & Revocation Evaluation", () => {
  it("parses web and mobile User-Agent strings and evaluates revocation states", () => {
    const winChrome = parseUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36"
    );
    expect(winChrome.deviceType).toBe("desktop");
    expect(winChrome.browser).toBe("Chrome");
    expect(winChrome.os).toBe("Windows 10/11");

    const mobileApp = parseUserAgent("QawmiERP/2.0 Capacitor Android 14 Mobile");
    expect(mobileApp.deviceType).toBe("mobile");
    expect(mobileApp.browser).toBe("QawmiERP Mobile App");

    expect(hashSessionToken("tok-123")).toHaveLength(64);

    const now = 1_700_000_000_000;
    expect(
      evaluateSessionRecordRevoked(
        { is_active: true, revoked_at: null, expires_at: new Date(now + 60_000).toISOString() },
        now
      ).revoked
    ).toBe(false);

    expect(
      evaluateSessionRecordRevoked(
        { is_active: false, revoked_at: new Date(now - 1000).toISOString(), expires_at: null },
        now
      )
    ).toEqual({ revoked: true, reason: "REVOKED" });

    expect(
      evaluateSessionRecordRevoked(
        { is_active: true, revoked_at: null, expires_at: new Date(now - 1000).toISOString() },
        now
      )
    ).toEqual({ revoked: true, reason: "EXPIRED" });
  });
});

describe("Feature 1.3 — PII Masking (+880, Bangla Digits, RBAC Override)", () => {
  it("masks phone numbers including +880 international and Bangla digits", () => {
    expect(maskPhoneNumber("01712345890")).toBe("017****890");
    expect(maskPhoneNumber("+8801712345890")).toBe("+88017****890");
    expect(maskPhoneNumber("০১৭১২৩৪৫৮৯০")).toBe("০১৭****৮৯০");
  });

  it("masks NID, email, and bank accounts", () => {
    expect(maskNidNumber("1995123456789")).toBe("19*******6789");
    expect(maskEmailAddress("rahim@madrasa.edu.bd")).toBe("ra***@madrasa.edu.bd");
    expect(maskBankAccount("12345678901234")).toBe("**********1234");
  });

  it("enforces RBAC unmasking and clones student/donor/staff records safely", () => {
    const adminProfile: UserSecurityProfile = {
      userId: "u1",
      madrasaId: "m1",
      fullName: "Admin",
      email: "a@b.com",
      primaryRole: "muhtamim",
      roles: ["muhtamim"],
      status: "ACTIVE",
      directPermissions: [],
      deniedPermissions: [],
      temporaryPermissions: [],
      dataScopeOverrides: {},
      assignedClassIds: [],
      assignedSubjectIds: [],
      assignedStudentIds: [],
      linkedStudentIds: [],
    };
    const teacherProfile: UserSecurityProfile = {
      ...adminProfile,
      userId: "u2",
      primaryRole: "teacher",
      roles: ["teacher"],
    };

    expect(
      canViewUnmaskedField(calculateEffectivePermissions(adminProfile, DEFAULT_SYSTEM_ROLES), "students", "phone")
    ).toBe(true);
    expect(
      canViewUnmaskedField(calculateEffectivePermissions(teacherProfile, DEFAULT_SYSTEM_ROLES), "students", "phone")
    ).toBe(false);

    const student = { id: "s1", parent_phone: "01712345890", nid_number: "1995123456789" };
    const maskedStudent = maskStudentSensitiveFields(student, false);
    expect(maskedStudent.parent_phone).toBe("017****890");
    expect(student.parent_phone).toBe("01712345890"); // non-mutating

    const donor = { id: "d1", phone: "01811223344", email: "donor@example.com" };
    const maskedDonor = maskDonorSensitiveFields(donor, false);
    expect(maskedDonor.phone).toBe("018****344");
    expect(maskedDonor.email).toBe("do***@example.com");

    const staff = {
      id: "st1",
      contact: { phone: "01911223344", email: "ustad@madrasa.edu.bd" },
      personal: { nid_number: "1988123456789" },
      salary: { bank_account_no: "987654321098" },
    };
    const maskedStaff = maskStaffSensitiveFields(staff, false);
    expect(maskedStaff.contact.phone).toBe("019****344");
    expect(maskedStaff.personal.nid_number).toContain("****");
    expect(maskedStaff.salary.bank_account_no).toBe("********1098");
  });
});

describe("Feature 1.3 — Export Watermarking (CSV, XLSX Round-Trip & Audit Logging)", () => {
  it("builds Asia/Dhaka watermarked CSV with formula-injection neutralization", () => {
    const wm = buildExportWatermark({
      exportedBy: "মাওলানা আব্দুর রহমান",
      actorRole: "muhtamim",
      ipAddress: "103.45.67.89",
      madrasaName: "জামিয়া ইসলামিয়া",
      dataset: "students",
      rowCount: 1,
      exportedAt: new Date("2026-05-01T06:00:00Z"),
    });

    expect(wm.exportedAtDhaka).toContain("2026-05-01 12:00:00 (+06:00)");
    expect(sanitizeSpreadsheetCell("=CMD('calc')")).toBe("'=CMD('calc')");

    const csv = buildWatermarkedCsv(["Name", "Phone"], [["=SUM(A1)", "017*****890"]], wm);
    expect(csv.startsWith("\uFEFF# CONFIDENTIAL")).toBe(true);
    expect(csv).toContain("মাওলানা আব্দুর রহমান");
    expect(csv).toContain("103.45.67.89");
    expect(csv).toContain(`"'=SUM(A1)"`);
    expect(csv).toContain("# FOOTER |");

    // CR/LF injection in dataset/exportedBy must not break out of # comment lines
    const injectedWm = buildExportWatermark({
      exportedBy: "Attacker\r\n=CMD('calc')",
      actorRole: "staff\n=HYPERLINK()",
      ipAddress: "1.2.3.4",
      dataset: "students\r\nEvilRow",
      rowCount: 1,
    });
    expect(injectedWm.watermarkLine).not.toMatch(/[\r\n]/);
    const injectedCsv = buildWatermarkedCsv(["A"], [["1"]], injectedWm);
    const commentLines = injectedCsv.replace(/^\uFEFF/, "").split("\n").slice(0, 3);
    expect(commentLines.every((line) => line.startsWith("# "))).toBe(true);
  });

  it("builds XLSX workbook and verifies watermark round-trip via XLSX.read", () => {
    const wm = buildExportWatermark({
      exportedBy: "Md. Tariqul Islam",
      actorRole: "accountant",
      ipAddress: "192.168.10.25",
      madrasaName: "Darul Uloom",
      dataset: "donors",
      exportId: "EXP-TEST-001",
      rowCount: 1,
      exportedAt: new Date("2026-05-01T06:00:00Z"),
    });

    const buf = buildWatermarkedWorkbook("Donors", ["Name", "Phone"], [["Karim", "017*****890"]], wm);
    const wb = XLSX.read(buf, { type: "buffer" });

    expect(wb.SheetNames).toContain("Donors");
    expect(wb.SheetNames).toContain("_Audit_Watermark");

    const dataRows = XLSX.utils.sheet_to_json<string[]>(wb.Sheets["Donors"], { header: 1 });
    expect(String(dataRows[0][0])).toContain("EXP-TEST-001");
    expect(String(dataRows[0][0])).toContain("Md. Tariqul Islam");

    const auditRows = XLSX.utils.sheet_to_json<string[]>(wb.Sheets["_Audit_Watermark"], { header: 1 });
    const flatAudit = auditRows.flat().map(String).join(" | ");
    expect(flatAudit).toContain("EXP-TEST-001");
    expect(flatAudit).toContain("192.168.10.25");
    expect(flatAudit).toContain("(+06:00)");
  });

  it("generates XSS-safe print watermark HTML and enforces SENSITIVE_DATA_EXPORTED in /api/exports", () => {
    const wm = buildExportWatermark({
      exportedBy: "<script>alert(1)</script>",
      actorRole: "admin",
      ipAddress: "10.0.0.1",
      dataset: "students",
    });
    const html = buildPrintWatermarkHtml(wm);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");

    const exportRouteSource = readFileSync(
      resolve(process.cwd(), "app/api/exports/route.ts"),
      "utf8"
    );
    expect(exportRouteSource).toContain("SENSITIVE_DATA_EXPORTED");
    expect(exportRouteSource).toContain("logAuditEvent");
  });
});

describe("Feature 1.2 — End-to-End TOTP Lockout Persistence in verifyStepUpChallenge", () => {
  it("persists totp_failed_attempts, locks at 5 failures, and resets on valid TOTP verification", async () => {
    vi.resetModules();

    const jsonStores = new Map<string, Record<string, any>>();
    vi.doMock("@/lib/supabase/admin", () => {
      const q: any = {
        select: () => q,
        eq: () => q,
        upsert: () => q,
        maybeSingle: async () => ({
          data: null,
          error: { code: "42P01", message: "relation does not exist" },
        }),
        insert: async () => ({ error: { code: "42P01", message: "relation does not exist" } }),
      };
      return {
        createAdminClient: async () => ({
          from: () => q,
        }),
      };
    });

    vi.doMock("@/lib/madrasa-store", () => ({
      readJsonStore: async (madrasaId: string, scope: string) =>
        jsonStores.get(`${madrasaId}:${scope}`) || {},
      mergeJsonStore: async (
        madrasaId: string,
        scope: string,
        updater: (cur: Record<string, any>) => Record<string, any>
      ) => {
        const key = `${madrasaId}:${scope}`;
        const next = updater(jsonStores.get(key) || {});
        jsonStores.set(key, next);
        return next;
      },
    }));

    vi.doMock("@/lib/audit-log", () => ({
      logAuditEvent: async () => {},
      isMissingTableError: (err: any) => err?.code === "42P01",
    }));

    const mod = await import("@/lib/step-up-auth");
    const enrollment = await mod.beginTotpEnrollment({
      userId: "user-lock-test",
      madrasaId: "madrasa-lock-test",
      accountName: "locktest@madrasa.edu.bd",
    });
    const secret = enrollment.secret;
    const confirmRes = await mod.confirmTotpEnrollment({
      userId: "user-lock-test",
      madrasaId: "madrasa-lock-test",
      code: mod.generateTotpCode(secret),
    });
    expect(confirmRes.success).toBe(true);

    // 4 wrong attempts -> increments persisted totp_failed_attempts 1..4 without locking
    for (let i = 1; i <= 4; i++) {
      const failRes = await mod.verifyStepUpChallenge({
        userId: "user-lock-test",
        madrasaId: "madrasa-lock-test",
        channel: "totp",
        code: "000000",
      });
      expect(failRes.success).toBe(false);
      expect(failRes.locked).toBe(false);
      expect(failRes.remainingAttempts).toBe(5 - i);

      const saved = await mod.getUserMfaSettings("user-lock-test", "madrasa-lock-test");
      expect(saved.totp_failed_attempts).toBe(i);
      expect(saved.totp_locked_until).toBeNull();
    }

    // 5th wrong attempt -> persists totp_failed_attempts = 5 and totp_locked_until
    const lockRes = await mod.verifyStepUpChallenge({
      userId: "user-lock-test",
      madrasaId: "madrasa-lock-test",
      channel: "totp",
      code: "000000",
    });
    expect(lockRes.success).toBe(false);
    expect(lockRes.locked).toBe(true);
    expect(lockRes.remainingAttempts).toBe(0);

    const lockedSaved = await mod.getUserMfaSettings("user-lock-test", "madrasa-lock-test");
    expect(lockedSaved.totp_failed_attempts).toBe(5);
    expect(lockedSaved.totp_locked_until).toBeTruthy();

    // Even a valid TOTP code is blocked while totp_locked_until is in the future
    const validCode = mod.generateTotpCode(secret);
    const blockedValid = await mod.verifyStepUpChallenge({
      userId: "user-lock-test",
      madrasaId: "madrasa-lock-test",
      channel: "totp",
      code: validCode,
    });
    expect(blockedValid.success).toBe(false);
    expect(blockedValid.locked).toBe(true);

    // Expire the lock and verify a valid TOTP code resets totp_failed_attempts to 0 & totp_locked_until to null
    const store = jsonStores.get("madrasa-lock-test:security")!;
    store.user_mfa_settings_fallback["user-lock-test"].totp_locked_until = new Date(
      Date.now() - 1000
    ).toISOString();

    const successRes = await mod.verifyStepUpChallenge({
      userId: "user-lock-test",
      madrasaId: "madrasa-lock-test",
      channel: "totp",
      code: validCode,
    });
    expect(successRes.success).toBe(true);
    expect(successRes.token).toBeTruthy();

    const resetSaved = await mod.getUserMfaSettings("user-lock-test", "madrasa-lock-test");
    expect(resetSaved.totp_failed_attempts).toBe(0);
    expect(resetSaved.totp_locked_until).toBeNull();
  });
});
