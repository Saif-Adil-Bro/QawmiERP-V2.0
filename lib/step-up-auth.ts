/**
 * Step-Up 2FA & Multi-Factor Authentication Engine (Feature 1.2)
 *
 * Pure Node `crypto` RFC 6238 TOTP + Base32 + AES-256-GCM secret encryption +
 * 6-digit SHA-256 OTP challenge/verification with TTL & max-attempt lockout +
 * HMAC-SHA256 short-lived Step-Up verification tokens.
 *
 * Persists to `public.user_mfa_settings` and `public.step_up_verifications`
 * with full `isMissingTableError` fallback to `madrasas.security_metadata`.
 */

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import QRCode from "qrcode";
import { createAdminClient } from "@/lib/supabase/admin";
import { readJsonStore, mergeJsonStore } from "@/lib/madrasa-store";
import { isMissingTableError, logAuditEvent } from "@/lib/audit-log";
import { DEFAULT_SMS_GATEWAY_CONFIG, type SMSGatewayConfig } from "@/lib/sms-gateway";
import { maskEmailAddress, maskPhoneNumber } from "@/lib/pii-masking";

export type StepUpChannel = "totp" | "sms" | "email";

export const STEP_UP_COOKIE_NAME = "qawmi_step_up_token";
export const STEP_UP_HEADER_NAME = "x-step-up-token";
export const DEFAULT_STEP_UP_TTL_SECONDS = 300; // 5 minutes
export const DEFAULT_OTP_TTL_SECONDS = 300; // 5 minutes
export const DEFAULT_OTP_MAX_ATTEMPTS = 5;

export interface TenantStepUpPolicy {
  enforceCritical: boolean;
  tokenTtlSeconds: number;
  allowedChannels: StepUpChannel[];
}

export interface TenantMaskingPolicy {
  enforceMasking: boolean;
  watermarkExports: boolean;
  requireAuditOnExport: boolean;
}

export const DEFAULT_TENANT_STEP_UP_POLICY: TenantStepUpPolicy = {
  enforceCritical: true,
  tokenTtlSeconds: DEFAULT_STEP_UP_TTL_SECONDS,
  allowedChannels: ["totp", "sms", "email"],
};

export const DEFAULT_TENANT_MASKING_POLICY: TenantMaskingPolicy = {
  enforceMasking: true,
  watermarkExports: true,
  requireAuditOnExport: true,
};

export interface UserMfaSettingsRecord {
  id?: string;
  madrasa_id: string;
  user_id: string;
  totp_enabled: boolean;
  totp_secret_encrypted?: string | null;
  totp_verified_at?: string | null;
  sms_otp_enabled: boolean;
  email_otp_enabled: boolean;
  preferred_channel: StepUpChannel;
  sms_phone?: string | null;
  email_address?: string | null;
  recovery_codes_hashes?: string[];
  totp_failed_attempts?: number;
  totp_locked_until?: string | null;
  enforce_step_up: boolean;
  enrolled_at?: string | null;
  last_verified_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface StepUpVerificationRecord {
  id: string;
  madrasa_id: string;
  user_id: string;
  channel: StepUpChannel;
  action_scope: string;
  otp_hash: string | null;
  verification_token_hash: string | null;
  attempt_count: number;
  max_attempts: number;
  status: "PENDING" | "VERIFIED" | "EXPIRED" | "LOCKED" | "CONSUMED";
  ip_address: string | null;
  user_agent: string | null;
  expires_at: string;
  verified_at: string | null;
  token_expires_at: string | null;
  created_at: string;
}

export interface StepUpTokenPayload {
  userId: string;
  madrasaId: string;
  actionScope: string;
  iat: number;
  exp: number;
  jti: string;
}

const MFA_FALLBACK_KEY = "user_mfa_settings_fallback";
const VERIFICATIONS_FALLBACK_KEY = "step_up_verifications_fallback";
const STEP_UP_POLICY_KEY = "step_up_policy";
const MASKING_POLICY_KEY = "masking_policy";

// ─────────────────────────────────────────────────────────────────────────────
// 1. PURE CRYPTOGRAPHIC PRIMITIVES (Base32, RFC 6238 TOTP, AES-256-GCM, OTP, HMAC)
// ─────────────────────────────────────────────────────────────────────────────

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/**
 * Encodes a Buffer to an RFC 4648 Base32 string (no padding).
 */
export function base32Encode(buffer: Buffer | Uint8Array): string {
  const bytes = Buffer.from(buffer);
  let bits = 0;
  let value = 0;
  let output = "";

  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

/**
 * Decodes an RFC 4648 Base32 string (case-insensitive, ignores spaces/hyphens/`=`).
 */
export function base32Decode(input: string): Buffer {
  const cleaned = String(input || "")
    .toUpperCase()
    .replace(/[\s=-]+/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];

  for (let i = 0; i < cleaned.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(cleaned[i]);
    if (idx === -1) {
      throw new Error(`Invalid Base32 character: ${cleaned[i]}`);
    }
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/**
 * Generates a cryptographically random Base32-encoded TOTP secret (default 160-bit / 20 bytes).
 */
export function generateTotpSecret(byteLength = 20): string {
  return base32Encode(randomBytes(byteLength));
}

/**
 * Builds an `otpauth://totp/...` URI compatible with Google Authenticator / Authy / Microsoft Authenticator.
 */
export function buildTotpUri(params: {
  secret: string;
  accountName: string;
  issuer?: string;
  digits?: number;
  period?: number;
}): string;
export function buildTotpUri(
  secret: string,
  accountName: string,
  issuer?: string,
  digits?: number,
  period?: number
): string;
export function buildTotpUri(
  paramsOrSecret:
    | string
    | {
        secret: string;
        accountName: string;
        issuer?: string;
        digits?: number;
        period?: number;
      },
  accountNameArg?: string,
  issuerArg?: string,
  digitsArg?: number,
  periodArg?: number
): string {
  const params =
    typeof paramsOrSecret === "string"
      ? {
          secret: paramsOrSecret,
          accountName: accountNameArg || "user@qawmierp",
          issuer: issuerArg,
          digits: digitsArg,
          period: periodArg,
        }
      : paramsOrSecret;
  const issuer = params.issuer || "QawmiERP";
  const account = params.accountName || "user@qawmierp";
  const digits = params.digits || 6;
  const period = params.period || 30;
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  const query = new URLSearchParams({
    secret: params.secret.replace(/[\s=-]+/g, "").toUpperCase(),
    issuer,
    algorithm: "SHA1",
    digits: String(digits),
    period: String(period),
  });
  return `otpauth://totp/${label}?${query.toString()}`;
}

/**
 * Generates an RFC 6238 TOTP code (HMAC-SHA1, 30s period, 6 digits by default).
 */
export function generateTotpCode(
  secret: string,
  timestampMs: number = Date.now(),
  opts?: { periodSec?: number; digits?: number }
): string {
  const periodSec = opts?.periodSec ?? 30;
  const digits = opts?.digits ?? 6;
  const counter = Math.floor(timestampMs / 1000 / periodSec);

  const counterBuf = Buffer.alloc(8);
  const high = Math.floor(counter / 0x100000000);
  const low = counter >>> 0;
  counterBuf.writeUInt32BE(high, 0);
  counterBuf.writeUInt32BE(low, 4);

  const key = base32Decode(secret);
  const hmac = createHmac("sha1", key).update(counterBuf).digest();

  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const mod = 10 ** digits;
  return String(binary % mod).padStart(digits, "0");
}

function constantTimeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Verifies an RFC 6238 TOTP code within `±windowSteps` (default ±1 step = ±30s)
 * using constant-time comparison (`crypto.timingSafeEqual`).
 */
export function verifyTotpCode(
  secret: string,
  code: string,
  timestampMs: number = Date.now(),
  windowSteps = 1,
  opts?: { periodSec?: number; digits?: number }
): boolean {
  const digits = opts?.digits ?? 6;
  const periodSec = opts?.periodSec ?? 30;
  const normalized = String(code || "").replace(/\s+/g, "");
  if (!new RegExp(`^\\d{${digits}}$`).test(normalized)) return false;

  for (let offset = -windowSteps; offset <= windowSteps; offset++) {
    const candidateMs = timestampMs + offset * periodSec * 1000;
    const expected = generateTotpCode(secret, candidateMs, { periodSec, digits });
    if (constantTimeStringEqual(normalized, expected)) {
      return true;
    }
  }
  return false;
}

function getMasterSecretKey(): Buffer {
  const raw =
    process.env.STEP_UP_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "qawmi-erp-v2-step-up-dev-secret-key";
  return createHash("sha256").update(raw).digest();
}

/**
 * Encrypts a TOTP secret using AES-256-GCM (`v1:<ivHex>:<tagHex>:<cipherHex>`).
 */
export function encryptTotpSecret(plainSecret: string): string {
  const key = getMasterSecretKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plainSecret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypts a TOTP secret produced by `encryptTotpSecret`.
 */
export function decryptTotpSecret(encryptedPayload: string): string {
  const parts = String(encryptedPayload || "").split(":");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("Invalid encrypted TOTP secret format");
  }
  const [, ivHex, tagHex, cipherHex] = parts;
  const key = getMasterSecretKey();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(cipherHex, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

/**
 * Generates a cryptographically secure 6-digit numeric OTP.
 */
export function generateSixDigitOtp(): string {
  return String(randomInt(100000, 1000000));
}

/**
 * Hashes an OTP code (or recovery code) using SHA-256 with optional salt/scope binding.
 */
export function hashOtpCode(code: string, salt = ""): string {
  const normalized = String(code || "").trim();
  return createHash("sha256").update(`${salt}:${normalized}`).digest("hex");
}

/**
 * Verifies an OTP code against its stored SHA-256 hash using `timingSafeEqual`.
 */
export function verifyOtpHash(code: string, storedHash: string, salt = ""): boolean {
  if (!code || !storedHash) return false;
  const computed = hashOtpCode(code, salt);
  return constantTimeStringEqual(computed, storedHash);
}

/**
 * Pure OTP challenge state machine enforcing expiry, max-attempt lockout, and hash matching.
 */
export function evaluateOtpAttempt(
  state: {
    otpHash: string;
    attemptCount: number;
    maxAttempts: number;
    expiresAt: string;
    status: string;
  },
  inputCode: string,
  nowMs: number = Date.now(),
  salt = ""
): {
  valid: boolean;
  nextStatus: "VERIFIED" | "PENDING" | "EXPIRED" | "LOCKED" | "CONSUMED";
  nextAttemptCount: number;
  reason?: "EXPIRED" | "LOCKED" | "INVALID_CODE" | "ALREADY_USED";
} {
  if (state.status === "VERIFIED" || state.status === "CONSUMED") {
    return {
      valid: false,
      nextStatus: state.status,
      nextAttemptCount: state.attemptCount,
      reason: "ALREADY_USED",
    };
  }

  if (state.status === "LOCKED" || state.attemptCount >= state.maxAttempts) {
    return {
      valid: false,
      nextStatus: "LOCKED",
      nextAttemptCount: state.attemptCount,
      reason: "LOCKED",
    };
  }

  const expMs = new Date(state.expiresAt).getTime();
  if (state.status === "EXPIRED" || Number.isNaN(expMs) || expMs <= nowMs) {
    return {
      valid: false,
      nextStatus: "EXPIRED",
      nextAttemptCount: state.attemptCount,
      reason: "EXPIRED",
    };
  }

  const nextAttemptCount = state.attemptCount + 1;
  if (verifyOtpHash(inputCode, state.otpHash, salt)) {
    return {
      valid: true,
      nextStatus: "VERIFIED",
      nextAttemptCount,
    };
  }

  if (nextAttemptCount >= state.maxAttempts) {
    return {
      valid: false,
      nextStatus: "LOCKED",
      nextAttemptCount,
      reason: "LOCKED",
    };
  }

  return {
    valid: false,
    nextStatus: "PENDING",
    nextAttemptCount,
    reason: "INVALID_CODE",
  };
}

export const DEFAULT_TOTP_LOCKOUT_SECONDS = 300; // 5 minutes

export function evaluateTotpLockout(
  state: {
    failedAttempts?: number;
    lockedUntil?: string | null;
    maxAttempts?: number;
    lockoutSeconds?: number;
  },
  isValidCode: boolean,
  nowMs: number = Date.now()
): {
  allowed: boolean;
  locked: boolean;
  nextFailedAttempts: number;
  nextLockedUntil: string | null;
  remainingAttempts: number;
} {
  const maxAttempts = state.maxAttempts ?? DEFAULT_OTP_MAX_ATTEMPTS;
  const lockoutSeconds = state.lockoutSeconds ?? DEFAULT_TOTP_LOCKOUT_SECONDS;
  const lockedUntilMs = state.lockedUntil ? new Date(state.lockedUntil).getTime() : NaN;
  const isCurrentlyLocked = !Number.isNaN(lockedUntilMs) && lockedUntilMs > nowMs;

  if (isCurrentlyLocked) {
    return {
      allowed: false,
      locked: true,
      nextFailedAttempts: state.failedAttempts ?? maxAttempts,
      nextLockedUntil: state.lockedUntil || null,
      remainingAttempts: 0,
    };
  }

  // Previous lock expired -> reset baseline counter if it had hit maxAttempts
  const currentAttempts =
    !Number.isNaN(lockedUntilMs) && lockedUntilMs <= nowMs ? 0 : Math.max(0, state.failedAttempts ?? 0);

  if (isValidCode) {
    return {
      allowed: true,
      locked: false,
      nextFailedAttempts: 0,
      nextLockedUntil: null,
      remainingAttempts: maxAttempts,
    };
  }

  const nextFailedAttempts = currentAttempts + 1;
  if (nextFailedAttempts >= maxAttempts) {
    return {
      allowed: false,
      locked: true,
      nextFailedAttempts,
      nextLockedUntil: new Date(nowMs + lockoutSeconds * 1000).toISOString(),
      remainingAttempts: 0,
    };
  }

  return {
    allowed: false,
    locked: false,
    nextFailedAttempts,
    nextLockedUntil: null,
    remainingAttempts: Math.max(0, maxAttempts - nextFailedAttempts),
  };
}

/**
 * Creates a short-lived HMAC-SHA256 signed Step-Up verification token.
 */
export function createSignedStepUpToken(params: {
  userId: string;
  madrasaId: string;
  actionScope?: string;
  ttlSeconds?: number;
  nowMs?: number;
}): { token: string; tokenHash: string; expiresAt: string; jti: string } {
  const nowMs = params.nowMs ?? Date.now();
  const ttlSeconds = Math.max(30, params.ttlSeconds ?? DEFAULT_STEP_UP_TTL_SECONDS);
  const iat = Math.floor(nowMs / 1000);
  const exp = iat + ttlSeconds;
  const jti = randomUUID();

  const payload: StepUpTokenPayload = {
    userId: params.userId,
    madrasaId: params.madrasaId,
    actionScope: params.actionScope !== undefined ? params.actionScope : "CRITICAL",
    iat,
    exp,
    jti,
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", getMasterSecretKey()).update(payloadB64).digest("base64url");
  const token = `${payloadB64}.${sig}`;
  const tokenHash = createHash("sha256").update(token).digest("hex");

  return {
    token,
    tokenHash,
    expiresAt: new Date(exp * 1000).toISOString(),
    jti,
  };
}

export const issueStepUpToken = createSignedStepUpToken;
export const signStepUpToken = createSignedStepUpToken;

/**
 * Verifies a signed Step-Up token's HMAC-SHA256 signature, expiration, userId, madrasaId, and actionScope.
 */
export function verifySignedStepUpToken(
  token: string | null | undefined,
  expected: {
    userId: string;
    madrasaId: string;
    actionScope?: string;
    nowMs?: number;
  }
): { valid: boolean; reason?: string; payload?: StepUpTokenPayload } {
  if (!token || typeof token !== "string") {
    return { valid: false, reason: "MISSING_TOKEN" };
  }

  const parts = token.trim().split(".");
  if (parts.length !== 2) {
    return { valid: false, reason: "MALFORMED_TOKEN" };
  }

  const [payloadB64, providedSig] = parts;
  const expectedSig = createHmac("sha256", getMasterSecretKey())
    .update(payloadB64)
    .digest("base64url");

  if (!constantTimeStringEqual(providedSig, expectedSig)) {
    return { valid: false, reason: "INVALID_SIGNATURE" };
  }

  let payload: StepUpTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    return { valid: false, reason: "INVALID_PAYLOAD" };
  }

  const nowSec = Math.floor((expected.nowMs ?? Date.now()) / 1000);
  if (typeof payload.exp !== "number" || payload.exp <= nowSec) {
    return { valid: false, reason: "TOKEN_EXPIRED" };
  }

  if (payload.userId !== expected.userId) {
    return { valid: false, reason: "USER_MISMATCH" };
  }

  if (payload.madrasaId !== expected.madrasaId) {
    return { valid: false, reason: "MADRASA_MISMATCH" };
  }

  // A token issued for "CRITICAL" (wildcard), exact match, or hierarchical parent prefix (e.g. "approval.decide" -> "approval.decide.large_expense") is accepted
  if (expected.actionScope) {
    if (!payload.actionScope) {
      return { valid: false, reason: "SCOPE_MISMATCH" };
    }
    const scopeMatches =
      payload.actionScope === "CRITICAL" ||
      payload.actionScope === "*" ||
      payload.actionScope === expected.actionScope ||
      expected.actionScope.startsWith(`${payload.actionScope}.`);
    if (!scopeMatches) {
      return { valid: false, reason: "SCOPE_MISMATCH" };
    }
  }

  return { valid: true, payload };
}

/**
 * Verifies a Step-Up token (async wrapper used by `requirePermission`).
 */
export async function verifyStepUpToken(params: {
  token: string | null | undefined;
  userId: string;
  madrasaId: string;
  actionScope?: string;
}): Promise<{ valid: boolean; reason?: string; payload?: StepUpTokenPayload }> {
  return verifySignedStepUpToken(params.token, {
    userId: params.userId,
    madrasaId: params.madrasaId,
    actionScope: params.actionScope,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. TENANT SECURITY POLICIES (Step-Up & Masking Policy)
// ─────────────────────────────────────────────────────────────────────────────

export async function getTenantStepUpPolicy(madrasaId: string): Promise<TenantStepUpPolicy> {
  if (!madrasaId) return { ...DEFAULT_TENANT_STEP_UP_POLICY };
  try {
    const store = await readJsonStore(madrasaId, "security");
    const raw = store?.[STEP_UP_POLICY_KEY];
    if (!raw || typeof raw !== "object") return { ...DEFAULT_TENANT_STEP_UP_POLICY };
    return {
      enforceCritical:
        typeof raw.enforceCritical === "boolean"
          ? raw.enforceCritical
          : DEFAULT_TENANT_STEP_UP_POLICY.enforceCritical,
      tokenTtlSeconds:
        typeof raw.tokenTtlSeconds === "number" && raw.tokenTtlSeconds >= 60 && raw.tokenTtlSeconds <= 3600
          ? raw.tokenTtlSeconds
          : DEFAULT_TENANT_STEP_UP_POLICY.tokenTtlSeconds,
      allowedChannels:
        Array.isArray(raw.allowedChannels) && raw.allowedChannels.length > 0
          ? raw.allowedChannels
          : DEFAULT_TENANT_STEP_UP_POLICY.allowedChannels,
    };
  } catch {
    return { ...DEFAULT_TENANT_STEP_UP_POLICY };
  }
}

export async function saveTenantStepUpPolicy(
  madrasaId: string,
  policy: Partial<TenantStepUpPolicy>
): Promise<TenantStepUpPolicy> {
  const currentPolicy = await getTenantStepUpPolicy(madrasaId);
  const next: TenantStepUpPolicy = {
    enforceCritical:
      typeof policy.enforceCritical === "boolean"
        ? policy.enforceCritical
        : currentPolicy.enforceCritical,
    tokenTtlSeconds:
      typeof policy.tokenTtlSeconds === "number" && policy.tokenTtlSeconds >= 60 && policy.tokenTtlSeconds <= 3600
        ? policy.tokenTtlSeconds
        : currentPolicy.tokenTtlSeconds,
    allowedChannels:
      Array.isArray(policy.allowedChannels) && policy.allowedChannels.length > 0
        ? policy.allowedChannels
        : currentPolicy.allowedChannels,
  };

  await mergeJsonStore(madrasaId, "security", (store) => ({
    ...store,
    [STEP_UP_POLICY_KEY]: next,
  }));

  return next;
}

export async function getTenantMaskingPolicy(madrasaId: string): Promise<TenantMaskingPolicy> {
  if (!madrasaId) return { ...DEFAULT_TENANT_MASKING_POLICY };
  try {
    const store = await readJsonStore(madrasaId, "security");
    const raw = store?.[MASKING_POLICY_KEY];
    if (!raw || typeof raw !== "object") return { ...DEFAULT_TENANT_MASKING_POLICY };
    return {
      enforceMasking:
        typeof raw.enforceMasking === "boolean"
          ? raw.enforceMasking
          : DEFAULT_TENANT_MASKING_POLICY.enforceMasking,
      watermarkExports:
        typeof raw.watermarkExports === "boolean"
          ? raw.watermarkExports
          : DEFAULT_TENANT_MASKING_POLICY.watermarkExports,
      requireAuditOnExport:
        typeof raw.requireAuditOnExport === "boolean"
          ? raw.requireAuditOnExport
          : DEFAULT_TENANT_MASKING_POLICY.requireAuditOnExport,
    };
  } catch {
    return { ...DEFAULT_TENANT_MASKING_POLICY };
  }
}

export async function saveTenantMaskingPolicy(
  madrasaId: string,
  policy: Partial<TenantMaskingPolicy>
): Promise<TenantMaskingPolicy> {
  const currentPolicy = await getTenantMaskingPolicy(madrasaId);
  const next: TenantMaskingPolicy = {
    enforceMasking:
      typeof policy.enforceMasking === "boolean"
        ? policy.enforceMasking
        : currentPolicy.enforceMasking,
    watermarkExports:
      typeof policy.watermarkExports === "boolean"
        ? policy.watermarkExports
        : currentPolicy.watermarkExports,
    requireAuditOnExport:
      typeof policy.requireAuditOnExport === "boolean"
        ? policy.requireAuditOnExport
        : currentPolicy.requireAuditOnExport,
  };

  await mergeJsonStore(madrasaId, "security", (store) => ({
    ...store,
    [MASKING_POLICY_KEY]: next,
  }));

  return next;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. USER MFA SETTINGS (DB + GRACEFUL FALLBACK)
// ─────────────────────────────────────────────────────────────────────────────

function buildDefaultMfaSettings(userId: string, madrasaId: string): UserMfaSettingsRecord {
  return {
    madrasa_id: madrasaId,
    user_id: userId,
    totp_enabled: false,
    totp_secret_encrypted: null,
    totp_verified_at: null,
    sms_otp_enabled: false,
    email_otp_enabled: true,
    preferred_channel: "email",
    sms_phone: null,
    email_address: null,
    recovery_codes_hashes: [],
    totp_failed_attempts: 0,
    totp_locked_until: null,
    enforce_step_up: true,
    enrolled_at: null,
    last_verified_at: null,
  };
}

export async function getUserMfaSettings(
  userId: string,
  madrasaId: string
): Promise<UserMfaSettingsRecord> {
  const defaults = buildDefaultMfaSettings(userId, madrasaId);

  try {
    const admin = await createAdminClient();
    const { data, error } = await admin
      .from("user_mfa_settings")
      .select("*")
      .eq("madrasa_id", madrasaId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!error) {
      if (data) return { ...defaults, ...(data as any) };
      return defaults;
    }

    if (!isMissingTableError(error)) {
      console.error("getUserMfaSettings error:", error);
      return defaults;
    }
  } catch {
    // fallback below
  }

  try {
    const store = await readJsonStore(madrasaId, "security");
    const map = store?.[MFA_FALLBACK_KEY] || {};
    if (map[userId]) {
      return { ...defaults, ...map[userId] };
    }
  } catch {
    // ignore
  }

  return defaults;
}

async function upsertUserMfaSettings(
  record: UserMfaSettingsRecord
): Promise<UserMfaSettingsRecord> {
  const nowIso = new Date().toISOString();
  const payload = {
    madrasa_id: record.madrasa_id,
    user_id: record.user_id,
    totp_enabled: record.totp_enabled,
    totp_secret_encrypted: record.totp_secret_encrypted ?? null,
    totp_verified_at: record.totp_verified_at ?? null,
    sms_otp_enabled: record.sms_otp_enabled,
    email_otp_enabled: record.email_otp_enabled,
    preferred_channel: record.preferred_channel,
    sms_phone: record.sms_phone ?? null,
    email_address: record.email_address ?? null,
    recovery_codes_hashes: record.recovery_codes_hashes ?? [],
    totp_failed_attempts: record.totp_failed_attempts ?? 0,
    totp_locked_until: record.totp_locked_until ?? null,
    enforce_step_up: record.enforce_step_up ?? true,
    enrolled_at: record.enrolled_at ?? null,
    last_verified_at: record.last_verified_at ?? null,
    updated_at: nowIso,
  };

  try {
    const admin = await createAdminClient();
    const { data, error } = await admin
      .from("user_mfa_settings")
      .upsert(payload, { onConflict: "madrasa_id,user_id" })
      .select("*")
      .maybeSingle();

    if (!error && data) {
      return data as UserMfaSettingsRecord;
    }
    if (error && !isMissingTableError(error)) {
      console.error("upsertUserMfaSettings error:", error);
    }
  } catch {
    // fallback below
  }

  await mergeJsonStore(record.madrasa_id, "security", (store) => {
    const map = { ...(store?.[MFA_FALLBACK_KEY] || {}) };
    map[record.user_id] = {
      ...payload,
      id: record.id || randomUUID(),
      created_at: record.created_at || nowIso,
    };
    return { ...store, [MFA_FALLBACK_KEY]: map };
  });

  return payload;
}

/**
 * Generates a fresh TOTP secret, encrypts and stores it (unenabled until confirmed),
 * and returns the secret, `otpauth://` URI, and QR code PNG data URL.
 */
export async function beginTotpEnrollment(params: {
  userId: string;
  madrasaId: string;
  accountName: string;
  issuer?: string;
}): Promise<{ secret: string; otpauthUri: string; qrDataUrl: string }> {
  const secret = generateTotpSecret(20);
  const otpauthUri = buildTotpUri({
    secret,
    accountName: params.accountName,
    issuer: params.issuer || "QawmiERP",
  });
  const qrDataUrl = await QRCode.toDataURL(otpauthUri, { width: 220, margin: 1 });

  const existing = await getUserMfaSettings(params.userId, params.madrasaId);
  await upsertUserMfaSettings({
    ...existing,
    totp_secret_encrypted: encryptTotpSecret(secret),
  });

  return { secret, otpauthUri, qrDataUrl };
}

/**
 * Confirms TOTP enrollment by validating a 6-digit Authenticator code,
 * enables TOTP, and generates 8 single-use recovery codes (stored hashed).
 */
export async function confirmTotpEnrollment(params: {
  userId: string;
  madrasaId: string;
  code: string;
}): Promise<{ success: boolean; recoveryCodes?: string[]; error?: string }> {
  const existing = await getUserMfaSettings(params.userId, params.madrasaId);
  if (!existing.totp_secret_encrypted) {
    return {
      success: false,
      error: "প্রথমে Authenticator QR কোড তৈরি করুন।",
    };
  }

  let secret: string;
  try {
    secret = decryptTotpSecret(existing.totp_secret_encrypted);
  } catch {
    return {
      success: false,
      error: "TOTP সিক্রেট ডিক্রিপ্ট করা যায়নি। পুনরায় সেটআপ শুরু করুন।",
    };
  }

  if (!verifyTotpCode(secret, params.code)) {
    return {
      success: false,
      error: "কোডটি সঠিক নয়। Authenticator অ্যাপের বর্তমান ৬-অঙ্কের কোড দিন।",
    };
  }

  const recoveryCodes: string[] = Array.from({ length: 8 }, () =>
    `${randomBytes(2).toString("hex").toUpperCase()}-${randomBytes(2).toString("hex").toUpperCase()}`
  );
  const recoveryHashes = recoveryCodes.map((c) => hashOtpCode(c, params.userId));
  const nowIso = new Date().toISOString();

  await upsertUserMfaSettings({
    ...existing,
    totp_enabled: true,
    totp_verified_at: nowIso,
    enrolled_at: existing.enrolled_at || nowIso,
    preferred_channel: "totp",
    recovery_codes_hashes: recoveryHashes,
    last_verified_at: nowIso,
  });

  await logAuditEvent({
    madrasaId: params.madrasaId,
    actorId: params.userId,
    module: "security",
    action: "STEP_UP_VERIFIED",
    entityType: "user_mfa_settings",
    entityId: params.userId,
    summary: "ব্যবহারকারী Authenticator App (TOTP 2FA) সফলভাবে সক্রিয় করেছেন।",
    metadata: { channel: "totp", event: "totp_enrolled" },
    severity: "INFO",
  });

  return { success: true, recoveryCodes };
}

/**
 * Disables TOTP Authenticator for a user.
 */
export async function disableTotp(params: {
  userId: string;
  madrasaId: string;
}): Promise<{ success: boolean; error?: string }> {
  const existing = await getUserMfaSettings(params.userId, params.madrasaId);
  await upsertUserMfaSettings({
    ...existing,
    totp_enabled: false,
    totp_secret_encrypted: null,
    totp_verified_at: null,
    recovery_codes_hashes: [],
    preferred_channel: existing.sms_otp_enabled ? "sms" : "email",
  });

  await logAuditEvent({
    madrasaId: params.madrasaId,
    actorId: params.userId,
    module: "security",
    action: "STEP_UP_VERIFIED",
    entityType: "user_mfa_settings",
    entityId: params.userId,
    summary: "ব্যবহারকারী Authenticator App (TOTP 2FA) নিষ্ক্রিয় করেছেন।",
    metadata: { channel: "totp", event: "totp_disabled" },
    severity: "WARNING",
  });

  return { success: true };
}

/**
 * Updates user MFA preferences (SMS/Email toggles, preferred channel, contact overrides).
 */
export async function updateMfaPreferences(params: {
  userId: string;
  madrasaId: string;
  preferredChannel?: StepUpChannel;
  smsOtpEnabled?: boolean;
  emailOtpEnabled?: boolean;
  smsPhone?: string | null;
  emailAddress?: string | null;
  enforceStepUp?: boolean;
}): Promise<{ success: boolean; settings?: UserMfaSettingsRecord; error?: string }> {
  const existing = await getUserMfaSettings(params.userId, params.madrasaId);
  const updated = await upsertUserMfaSettings({
    ...existing,
    preferred_channel: params.preferredChannel || existing.preferred_channel,
    sms_otp_enabled:
      typeof params.smsOtpEnabled === "boolean" ? params.smsOtpEnabled : existing.sms_otp_enabled,
    email_otp_enabled:
      typeof params.emailOtpEnabled === "boolean"
        ? params.emailOtpEnabled
        : existing.email_otp_enabled,
    sms_phone: params.smsPhone !== undefined ? params.smsPhone : existing.sms_phone,
    email_address:
      params.emailAddress !== undefined ? params.emailAddress : existing.email_address,
    enforce_step_up:
      typeof params.enforceStepUp === "boolean" ? params.enforceStepUp : existing.enforce_step_up,
  });

  return { success: true, settings: updated };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. STEP-UP OTP CHALLENGE & VERIFICATION (SMS / EMAIL / TOTP)
// ─────────────────────────────────────────────────────────────────────────────

async function saveVerificationRecord(record: StepUpVerificationRecord): Promise<void> {
  try {
    const admin = await createAdminClient();
    const { error } = await admin.from("step_up_verifications").insert(record);
    if (!error) return;
    if (!isMissingTableError(error)) {
      console.error("saveVerificationRecord SQL error:", error);
    }
  } catch {
    // fallback below
  }

  await mergeJsonStore(record.madrasa_id, "security", (store) => {
    const existing: StepUpVerificationRecord[] = Array.isArray(store?.[VERIFICATIONS_FALLBACK_KEY])
      ? store[VERIFICATIONS_FALLBACK_KEY]
      : [];
    const next = [record, ...existing].slice(0, 100);
    return { ...store, [VERIFICATIONS_FALLBACK_KEY]: next };
  });
}

async function loadLatestPendingChallenge(params: {
  userId: string;
  madrasaId: string;
  challengeId?: string;
  channel?: StepUpChannel;
}): Promise<{ record: StepUpVerificationRecord | null; storage: "sql" | "fallback" }> {
  try {
    const admin = await createAdminClient();
    let query = admin
      .from("step_up_verifications")
      .select("*")
      .eq("madrasa_id", params.madrasaId)
      .eq("user_id", params.userId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (params.channel) {
      query = query.eq("channel", params.channel);
    }

    if (params.challengeId) {
      query = query.eq("id", params.challengeId);
    } else {
      query = query.eq("status", "PENDING");
    }

    const { data, error } = await query.maybeSingle();
    if (!error) {
      return { record: (data as StepUpVerificationRecord) || null, storage: "sql" };
    }
    if (!isMissingTableError(error)) {
      return { record: null, storage: "sql" };
    }
  } catch {
    // fallback
  }

  try {
    const store = await readJsonStore(params.madrasaId, "security");
    const list: StepUpVerificationRecord[] = Array.isArray(store?.[VERIFICATIONS_FALLBACK_KEY])
      ? store[VERIFICATIONS_FALLBACK_KEY]
      : [];
    const found = list.find(
      (r) =>
        r.user_id === params.userId &&
        (!params.channel || r.channel === params.channel) &&
        (params.challengeId ? r.id === params.challengeId : r.status === "PENDING")
    );
    return { record: found || null, storage: "fallback" };
  } catch {
    return { record: null, storage: "fallback" };
  }
}

async function updateVerificationRecord(
  recordId: string,
  madrasaId: string,
  storage: "sql" | "fallback",
  patch: Partial<StepUpVerificationRecord>
): Promise<void> {
  if (storage === "sql") {
    try {
      const admin = await createAdminClient();
      const { error } = await admin
        .from("step_up_verifications")
        .update(patch)
        .eq("id", recordId)
        .eq("madrasa_id", madrasaId);
      if (!error) return;
    } catch {
      // fall through
    }
  }

  await mergeJsonStore(madrasaId, "security", (store) => {
    const list: StepUpVerificationRecord[] = Array.isArray(store?.[VERIFICATIONS_FALLBACK_KEY])
      ? store[VERIFICATIONS_FALLBACK_KEY]
      : [];
    const next = list.map((r) => (r.id === recordId ? { ...r, ...patch } : r));
    return { ...store, [VERIFICATIONS_FALLBACK_KEY]: next };
  });
}

async function deliverSmsOtp(
  madrasaId: string,
  phone: string,
  otpCode: string
): Promise<{ delivered: boolean; note?: string }> {
  try {
    const meta = await readJsonStore(madrasaId, "meta");
    const config: SMSGatewayConfig = {
      ...DEFAULT_SMS_GATEWAY_CONFIG,
      ...(meta?.sms_gateway || {}),
    };

    if (!config.isEnabled || !config.apiKey) {
      return {
        delivered: false,
        note: "SMS গেটওয়ে কনফিগার করা নেই। অ্যাডমিন প্যানেল থেকে SMS গেটওয়ে চালু করুন অথবা Authenticator App ব্যবহার করুন।",
      };
    }

    // Dynamic import prevents circular dependency with lib/action-authorization -> lib/permissions-server
    const { dispatchSMSGatewayRequest } = await import("@/app/actions/communication");
    const msg = `QawmiERP নিরাপত্তা যাচাইকরণ কোড: ${otpCode}। এই কোডটি ৫ মিনিট পর্যন্ত কার্যকর থাকবে।`;
    const res = await dispatchSMSGatewayRequest(config, phone, msg);
    return {
      delivered: Boolean(res?.success),
      note: res?.success ? undefined : res?.error || "SMS পাঠানো যায়নি।",
    };
  } catch (err: any) {
    return { delivered: false, note: err?.message || "SMS ডেলিভারি ত্রুটি।" };
  }
}

async function deliverEmailOtp(
  email: string,
  otpCode: string
): Promise<{ delivered: boolean; note?: string }> {
  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  if (!apiKey) {
    return {
      delivered: false,
      note: "ইমেইল গেটওয়ে (RESEND_API_KEY) কনফিগার করা নেই। Authenticator App অথবা SMS OTP ব্যবহার করুন।",
    };
  }

  try {
    const fromEmail =
      process.env.RESEND_FROM_EMAIL || "QawmiERP Security <noreply@qawmimanager.com>";
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [email],
        subject: "QawmiERP ২-ধাপ যাচাইকরণ কোড (Step-Up OTP)",
        text: `আপনার QawmiERP নিরাপত্তা যাচাইকরণ কোড হলো: ${otpCode}। এই কোডটি আগামী ৫ মিনিটের জন্য কার্যকর থাকবে। আপনি এই অনুরোধ না করে থাকলে অবিলম্বে পাসওয়ার্ড পরিবর্তন করুন।`,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return { delivered: false, note: `Email delivery failed (${response.status})` };
    }
    return { delivered: true };
  } catch (err: any) {
    return { delivered: false, note: err?.message || "Email ডেলিভারি ত্রুটি।" };
  }
}

/**
 * Initiates a Step-Up 2FA challenge for SMS, Email, or TOTP.
 * Never logs raw OTP codes and never returns raw OTP codes in production responses.
 */
export async function createStepUpChallenge(params: {
  userId: string;
  madrasaId: string;
  channel: StepUpChannel;
  actionScope?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<{
  success: boolean;
  challengeId?: string;
  channel: StepUpChannel;
  expiresAt?: string;
  delivered?: boolean;
  deliveryMode?: "sms" | "email" | "totp" | "simulated";
  destinationHint?: string;
  debugCode?: string;
  message?: string;
  error?: string;
}> {
  const channel = params.channel;
  const actionScope = params.actionScope || "CRITICAL";
  const mfa = await getUserMfaSettings(params.userId, params.madrasaId);

  if (channel === "totp") {
    if (!mfa.totp_enabled || !mfa.totp_secret_encrypted) {
      return {
        success: false,
        channel,
        error: "আপনার অ্যাকাউন্টে Authenticator App (TOTP) চালু করা নেই।",
      };
    }
    return {
      success: true,
      channel: "totp",
      delivered: true,
      deliveryMode: "totp",
      message: "আপনার Authenticator অ্যাপ থেকে ৬-অঙ্কের কোড প্রবেশ করান।",
    };
  }

  // Resolve recipient contact from MFA settings or users table
  let phone = mfa.sms_phone || "";
  let email = mfa.email_address || "";
  try {
    const admin = await createAdminClient();
    const { data: userRow } = await admin
      .from("users")
      .select("phone, email")
      .eq("id", params.userId)
      .maybeSingle();
    if (!phone && (userRow as any)?.phone) phone = String((userRow as any).phone);
    if (!email && (userRow as any)?.email) email = String((userRow as any).email);
  } catch {
    // ignore
  }

  if (channel === "sms" && !phone) {
    return {
      success: false,
      channel,
      error: "আপনার প্রোফাইল বা নিরাপত্তা সেটিংসে কোনো মোবাইল নম্বর যুক্ত নেই।",
    };
  }
  if (channel === "email" && !email) {
    return {
      success: false,
      channel,
      error: "আপনার প্রোফাইলে কোনো ইমেইল ঠিকানা যুক্ত নেই।",
    };
  }

  const otpCode = generateSixDigitOtp();
  const challengeId = randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + DEFAULT_OTP_TTL_SECONDS * 1000).toISOString();

  const record: StepUpVerificationRecord = {
    id: challengeId,
    madrasa_id: params.madrasaId,
    user_id: params.userId,
    channel,
    action_scope: actionScope,
    otp_hash: hashOtpCode(otpCode, challengeId),
    verification_token_hash: null,
    attempt_count: 0,
    max_attempts: DEFAULT_OTP_MAX_ATTEMPTS,
    status: "PENDING",
    ip_address: params.ipAddress || null,
    user_agent: params.userAgent ? String(params.userAgent).slice(0, 512) : null,
    expires_at: expiresAt,
    verified_at: null,
    token_expires_at: null,
    created_at: now.toISOString(),
  };

  await saveVerificationRecord(record);

  const allowDebugEcho = process.env.NODE_ENV !== "production";

  if (channel === "sms") {
    const res = await deliverSmsOtp(params.madrasaId, phone, otpCode);
    return {
      success: true,
      challengeId,
      channel,
      expiresAt,
      delivered: res.delivered,
      deliveryMode: res.delivered ? "sms" : "simulated",
      destinationHint: maskPhoneNumber(phone),
      ...(!res.delivered && allowDebugEcho ? { debugCode: otpCode } : {}),
      message: res.delivered
        ? `${maskPhoneNumber(phone)} নম্বরে ৬-অঙ্কের যাচাইকরণ কোড পাঠানো হয়েছে।`
        : res.note || "SMS গেটওয়ে কনফিগার না থাকায় কোড পাঠানো যায়নি।",
    };
  }

  const res = await deliverEmailOtp(email, otpCode);
  return {
    success: true,
    challengeId,
    channel,
    expiresAt,
    delivered: res.delivered,
    deliveryMode: res.delivered ? "email" : "simulated",
    destinationHint: maskEmailAddress(email),
    ...(!res.delivered && allowDebugEcho ? { debugCode: otpCode } : {}),
    message: res.delivered
      ? `${maskEmailAddress(email)} ঠিকানায় ৬-অঙ্কের যাচাইকরণ কোড পাঠানো হয়েছে।`
      : res.note || "ইমেইল গেটওয়ে কনফিগার না থাকায় কোড পাঠানো যায়নি।",
  };
}

/**
 * Verifies a Step-Up 2FA code (TOTP, SMS OTP, or Email OTP), updates verification state,
 * logs `STEP_UP_VERIFIED` or `STEP_UP_FAILED` (never logging raw codes or tokens),
 * and issues a short-lived signed Step-Up verification token.
 */
export async function verifyStepUpChallenge(params: {
  userId: string;
  madrasaId: string;
  channel?: StepUpChannel;
  code: string;
  challengeId?: string;
  actionScope?: string;
  actorName?: string;
  actorEmail?: string;
  actorRole?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<{
  success: boolean;
  token?: string;
  expiresAt?: string;
  error?: string;
  locked?: boolean;
  remainingAttempts?: number;
}> {
  const code = String(params.code || "").trim();
  const actionScope = params.actionScope || "CRITICAL";
  const policy = await getTenantStepUpPolicy(params.madrasaId);

  if (!code) {
    return { success: false, error: "যাচাইকরণ কোড দিন।" };
  }

  let effectiveChannel: StepUpChannel = params.channel || "totp";
  let preloadedChallenge: { record: StepUpVerificationRecord | null; storage: "sql" | "fallback" } | null = null;
  if (params.challengeId && params.channel !== "totp") {
    preloadedChallenge = await loadLatestPendingChallenge({
      userId: params.userId,
      madrasaId: params.madrasaId,
      challengeId: params.challengeId,
      channel: params.channel,
    });
    if (!preloadedChallenge.record) {
      return {
        success: false,
        error: "কোনো সক্রিয় OTP পাওয়া যায়নি। অনুগ্রহ করে নতুন কোড পাঠান।",
      };
    }
    if (preloadedChallenge.record.channel === "totp") {
      return {
        success: false,
        error: "এই OTP কোডটি ইতিমধ্যে ব্যবহার করা হয়েছে। অনুগ্রহ করে নতুন কোড পাঠান।",
      };
    }
    effectiveChannel = preloadedChallenge.record.channel;
  }

  if (effectiveChannel === "totp") {
    const mfa = await getUserMfaSettings(params.userId, params.madrasaId);
    if (!mfa.totp_enabled || !mfa.totp_secret_encrypted) {
      return { success: false, error: "Authenticator App (TOTP) চালু করা নেই।" };
    }

    const preCheck = evaluateTotpLockout(
      {
        failedAttempts: mfa.totp_failed_attempts,
        lockedUntil: mfa.totp_locked_until,
      },
      false
    );
    if (
      mfa.totp_locked_until &&
      new Date(mfa.totp_locked_until).getTime() > Date.now() &&
      preCheck.locked
    ) {
      await logAuditEvent({
        madrasaId: params.madrasaId,
        actorId: params.userId,
        actorName: params.actorName,
        actorEmail: params.actorEmail,
        actorRole: params.actorRole,
        module: "security",
        action: "STEP_UP_FAILED",
        entityType: "step_up_verification",
        summary: `Authenticator (TOTP) অতিরিক্ত ভুল চেষ্টার কারণে লক অবস্থায় (${actionScope})।`,
        metadata: { channel: "totp", action_scope: actionScope, reason: "TOTP_LOCKED" },
        severity: "WARNING",
      });
      return {
        success: false,
        locked: true,
        remainingAttempts: 0,
        error: "অতিরিক্ত ভুল কোডের কারণে Authenticator যাচাইকরণ সাময়িকভাবে লক করা হয়েছে। ৫ মিনিট পর আবার চেষ্টা করুন।",
      };
    }

    let valid = false;
    let usedRecovery = false;
    try {
      const secret = decryptTotpSecret(mfa.totp_secret_encrypted);
      valid = verifyTotpCode(secret, code);
    } catch {
      valid = false;
    }

    // Also allow single-use recovery code if TOTP did not match
    if (!valid && Array.isArray(mfa.recovery_codes_hashes) && mfa.recovery_codes_hashes.length > 0) {
      const candidateHash = hashOtpCode(code.toUpperCase(), params.userId);
      const matchIdx = mfa.recovery_codes_hashes.findIndex((h) =>
        constantTimeStringEqual(h, candidateHash)
      );
      if (matchIdx !== -1) {
        valid = true;
        usedRecovery = true;
        const remaining = mfa.recovery_codes_hashes.filter((_, idx) => idx !== matchIdx);
        await upsertUserMfaSettings({
          ...mfa,
          recovery_codes_hashes: remaining,
          totp_failed_attempts: 0,
          totp_locked_until: null,
          last_verified_at: new Date().toISOString(),
        });
      }
    }

    const evalRes = evaluateTotpLockout(
      {
        failedAttempts: mfa.totp_failed_attempts,
        lockedUntil: mfa.totp_locked_until,
      },
      valid
    );

    if (!valid) {
      await upsertUserMfaSettings({
        ...mfa,
        totp_failed_attempts: evalRes.nextFailedAttempts,
        totp_locked_until: evalRes.nextLockedUntil,
      });
      await logAuditEvent({
        madrasaId: params.madrasaId,
        actorId: params.userId,
        actorName: params.actorName,
        actorEmail: params.actorEmail,
        actorRole: params.actorRole,
        module: "security",
        action: "STEP_UP_FAILED",
        entityType: "step_up_verification",
        summary: `Authenticator (TOTP) Step-Up যাচাইকরণ ব্যর্থ হয়েছে (${actionScope})।`,
        metadata: {
          channel: "totp",
          action_scope: actionScope,
          reason: evalRes.locked ? "TOTP_LOCKED" : "INVALID_TOTP",
          failed_attempts: evalRes.nextFailedAttempts,
        },
        severity: "WARNING",
      });
      return {
        success: false,
        locked: evalRes.locked,
        remainingAttempts: evalRes.remainingAttempts,
        error: evalRes.locked
          ? "অতিরিক্ত ভুল কোডের কারণে Authenticator যাচাইকরণ সাময়িকভাবে লক করা হয়েছে। ৫ মিনিট পর আবার চেষ্টা করুন।"
          : `ভুল Authenticator কোড। আর ${evalRes.remainingAttempts} বার চেষ্টা করতে পারবেন।`,
      };
    }

    const issued = createSignedStepUpToken({
      userId: params.userId,
      madrasaId: params.madrasaId,
      actionScope,
      ttlSeconds: policy.tokenTtlSeconds,
    });

    const nowIso = new Date().toISOString();
    await saveVerificationRecord({
      id: randomUUID(),
      madrasa_id: params.madrasaId,
      user_id: params.userId,
      channel: "totp",
      action_scope: actionScope,
      otp_hash: null,
      verification_token_hash: issued.tokenHash,
      attempt_count: 1,
      max_attempts: DEFAULT_OTP_MAX_ATTEMPTS,
      status: "VERIFIED",
      ip_address: params.ipAddress || null,
      user_agent: params.userAgent ? String(params.userAgent).slice(0, 512) : null,
      expires_at: issued.expiresAt,
      verified_at: nowIso,
      token_expires_at: issued.expiresAt,
      created_at: nowIso,
    });

    if (!usedRecovery) {
      await upsertUserMfaSettings({
        ...mfa,
        totp_failed_attempts: 0,
        totp_locked_until: null,
        last_verified_at: nowIso,
      });
    }

    await logAuditEvent({
      madrasaId: params.madrasaId,
      actorId: params.userId,
      actorName: params.actorName,
      actorEmail: params.actorEmail,
      actorRole: params.actorRole,
      module: "security",
      action: "STEP_UP_VERIFIED",
      entityType: "step_up_verification",
      summary: `Step-Up 2FA (TOTP) সফলভাবে যাচাই হয়েছে (${actionScope})।`,
      metadata: {
        channel: "totp",
        action_scope: actionScope,
        used_recovery_code: usedRecovery,
      },
      severity: "INFO",
    });

    return { success: true, token: issued.token, expiresAt: issued.expiresAt };
  }

  // SMS or Email OTP verification
  const { record, storage } =
    preloadedChallenge ??
    (await loadLatestPendingChallenge({
      userId: params.userId,
      madrasaId: params.madrasaId,
      challengeId: params.challengeId,
      channel: effectiveChannel,
    }));

  if (!record || !record.otp_hash) {
    return {
      success: false,
      error: "কোনো সক্রিয় OTP পাওয়া যায়নি। অনুগ্রহ করে নতুন কোড পাঠান।",
    };
  }

  const evalRes = evaluateOtpAttempt(
    {
      otpHash: record.otp_hash,
      attemptCount: record.attempt_count,
      maxAttempts: record.max_attempts || DEFAULT_OTP_MAX_ATTEMPTS,
      expiresAt: record.expires_at,
      status: record.status,
    },
    code,
    Date.now(),
    record.id
  );

  if (!evalRes.valid) {
    if (evalRes.reason !== "ALREADY_USED") {
      await updateVerificationRecord(record.id, params.madrasaId, storage, {
        attempt_count: evalRes.nextAttemptCount,
        status: evalRes.nextStatus,
      });
    }

    await logAuditEvent({
      madrasaId: params.madrasaId,
      actorId: params.userId,
      actorName: params.actorName,
      actorEmail: params.actorEmail,
      actorRole: params.actorRole,
      module: "security",
      action: "STEP_UP_FAILED",
      entityType: "step_up_verification",
      entityId: record.id,
      summary: `Step-Up OTP (${effectiveChannel}) যাচাইকরণ ব্যর্থ হয়েছে (${evalRes.reason})।`,
      metadata: {
        channel: effectiveChannel,
        action_scope: record.action_scope,
        reason: evalRes.reason,
        attempt_count: evalRes.nextAttemptCount,
      },
      severity: evalRes.reason === "LOCKED" ? "CRITICAL" : "WARNING",
    });

    if (evalRes.reason === "ALREADY_USED") {
      return {
        success: false,
        error: "এই OTP কোডটি ইতিমধ্যে ব্যবহার করা হয়েছে। অনুগ্রহ করে নতুন কোড পাঠান।",
      };
    }

    const remainingAttempts = Math.max(
      0,
      (record.max_attempts || DEFAULT_OTP_MAX_ATTEMPTS) - evalRes.nextAttemptCount
    );

    if (evalRes.reason === "EXPIRED") {
      return {
        success: false,
        error: "OTP কোডের মেয়াদ শেষ হয়ে গেছে। নতুন কোড পাঠান।",
      };
    }
    if (evalRes.reason === "LOCKED") {
      return {
        success: false,
        locked: true,
        remainingAttempts: 0,
        error: "সর্বোচ্চ ভুল চেষ্টার কারণে এই কোডটি লক হয়ে গেছে। নতুন কোড পাঠান।",
      };
    }
    return {
      success: false,
      remainingAttempts,
      error: "ভুল OTP কোড। অনুগ্রহ করে সঠিক কোড দিন।",
    };
  }

  const issued = createSignedStepUpToken({
    userId: params.userId,
    madrasaId: params.madrasaId,
    actionScope: record.action_scope || actionScope,
    ttlSeconds: policy.tokenTtlSeconds,
  });

  const nowIso = new Date().toISOString();
  await updateVerificationRecord(record.id, params.madrasaId, storage, {
    attempt_count: evalRes.nextAttemptCount,
    status: "VERIFIED",
    verified_at: nowIso,
    verification_token_hash: issued.tokenHash,
    token_expires_at: issued.expiresAt,
  });

  await logAuditEvent({
    madrasaId: params.madrasaId,
    actorId: params.userId,
    actorName: params.actorName,
    actorEmail: params.actorEmail,
    actorRole: params.actorRole,
    module: "security",
    action: "STEP_UP_VERIFIED",
    entityType: "step_up_verification",
    entityId: record.id,
    summary: `Step-Up 2FA (${effectiveChannel}) সফলভাবে যাচাই হয়েছে (${record.action_scope})।`,
    metadata: {
      channel: effectiveChannel,
      action_scope: record.action_scope,
    },
    severity: "INFO",
  });

  return {
    success: true,
    token: issued.token,
    expiresAt: issued.expiresAt,
  };
}
