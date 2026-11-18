import { createHmac, timingSafeEqual } from "crypto";
import net from "net";

export interface WebhookSignatureResult {
  header: string;
  signature: string;
}

export interface WebhookUrlValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Signs a raw webhook payload using HMAC-SHA256 over `${timestampSec}.${rawBody}`.
 */
export function signWebhookPayload(
  secret: string,
  timestampSec: number,
  rawBody: string
): WebhookSignatureResult {
  const ts = Math.floor(Number(timestampSec) || 0);
  const signature = createHmac("sha256", String(secret || ""))
    .update(`${ts}.${rawBody}`)
    .digest("hex")
    .toLowerCase();

  return {
    header: `t=${ts},v1=${signature}`,
    signature,
  };
}

/**
 * Verifies an `X-Qawmi-Signature` header (`t=<ts>,v1=<hex>`) using constant-time comparison
 * and replay-window tolerance check.
 */
export function verifyWebhookSignature(
  secret: string,
  header: string,
  rawBody: string,
  toleranceSec = 300
): boolean {
  if (!secret || !header || typeof header !== "string") return false;

  let timestampSec: number | null = null;
  const v1Signatures: string[] = [];

  for (const part of header.split(",")) {
    const [k, v] = part.split("=").map((s) => s.trim());
    if (!k || !v) continue;
    if (k === "t") {
      const parsed = Number(v);
      if (Number.isFinite(parsed) && parsed > 0) timestampSec = Math.floor(parsed);
    } else if (k === "v1") {
      v1Signatures.push(v.toLowerCase());
    }
  }

  if (!timestampSec || v1Signatures.length === 0) return false;

  if (toleranceSec >= 0) {
    const nowSec = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSec - timestampSec) > toleranceSec) {
      return false;
    }
  }

  const expected = signWebhookPayload(secret, timestampSec, rawBody).signature;
  const expectedBuf = Buffer.from(expected, "utf8");

  for (const candidate of v1Signatures) {
    const candidateBuf = Buffer.from(candidate, "utf8");
    if (
      candidateBuf.length === expectedBuf.length &&
      timingSafeEqual(candidateBuf, expectedBuf)
    ) {
      return true;
    }
  }

  return false;
}

function isPrivateOrReservedIpv4(ip: string): boolean {
  const parts = ip.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = parts;
  // 0.0.0.0/8 ("this" network)
  if (a === 0) return true;
  // 10.0.0.0/8 (RFC1918)
  if (a === 10) return true;
  // 100.64.0.0/10 (CGNAT)
  if (a === 100 && b >= 64 && b <= 127) return true;
  // 127.0.0.0/8 (loopback)
  if (a === 127) return true;
  // 169.254.0.0/16 (link-local / cloud metadata)
  if (a === 169 && b === 254) return true;
  // 172.16.0.0/12 (RFC1918)
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16 (RFC1918)
  if (a === 192 && b === 168) return true;
  // 224.0.0.0/4 multicast & 240.0.0.0/4 reserved
  if (a >= 224) return true;
  return false;
}

function isPrivateOrReservedIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (normalized === "::" || normalized === "::1") return true;
  // IPv4-mapped IPv6 e.g. ::ffff:127.0.0.1 or ::ffff:7f00:1
  if (normalized.startsWith("::ffff:")) {
    const v4Part = normalized.slice(7);
    if (net.isIPv4(v4Part)) {
      return isPrivateOrReservedIpv4(v4Part);
    }
    return true;
  }
  // ULA fc00::/7 (fc.. or fd..)
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  // Link-local fe80::/10 (fe80.. through febf..)
  if (/^fe[89ab][0-9a-f]:/i.test(normalized) || /^fe[89ab][0-9a-f]$/i.test(normalized)) {
    return true;
  }
  return false;
}

/**
 * Validates a webhook destination URL against SSRF vectors.
 * Blocks non-HTTP(S), localhost/loopback, link-local/cloud metadata, RFC1918,
 * IPv6 ULA/link-local, and requires HTTPS unless `allowHttpInDev: true`.
 */
export function validateWebhookUrl(
  url: string,
  opts: { allowHttpInDev?: boolean } = {}
): WebhookUrlValidationResult {
  if (!url || typeof url !== "string") {
    return { valid: false, reason: "Webhook URL খালি হতে পারবে না।" };
  }

  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return { valid: false, reason: "অবৈধ Webhook URL ফরম্যাট।" };
  }

  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== "https:" && protocol !== "http:") {
    return { valid: false, reason: "শুধুমাত্র HTTP/HTTPS প্রোটোকল অনুমোদিত।" };
  }

  const allowHttp = opts.allowHttpInDev ?? false;
  if (protocol === "http:" && !allowHttp) {
    return { valid: false, reason: "নিরাপত্তার জন্য HTTPS URL ব্যবহার করা আবশ্যক।" };
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!hostname) {
    return { valid: false, reason: "URL-এ হোস্টনেম নেই।" };
  }

  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname === "metadata.google.internal"
  ) {
    return { valid: false, reason: "লোকালহোস্ট বা অভ্যন্তরীণ ডোমেইন অনুমোদিত নয় (SSRF সুরক্ষা)।" };
  }

  const ipVersion = net.isIP(hostname);
  if (ipVersion === 4 && isPrivateOrReservedIpv4(hostname)) {
    return { valid: false, reason: "প্রাইভেট বা লুপব্যাক IPv4 ঠিকানা অনুমোদিত নয় (SSRF সুরক্ষা)।" };
  }
  if (ipVersion === 6 && isPrivateOrReservedIpv6(hostname)) {
    return { valid: false, reason: "প্রাইভেট বা লুপব্যাক IPv6 ঠিকানা অনুমোদিত নয় (SSRF সুরক্ষা)।" };
  }

  return { valid: true };
}
