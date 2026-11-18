/**
 * Pure Sensitive PII Masking Utilities (Feature 1.3)
 *
 * Kept free of Next.js server-only imports (`next/headers`, `supabase/server`)
 * so both Client Components, Server Actions, API routes, and Node unit tests
 * can import it directly. Re-exported from `lib/data-access-guards.ts`.
 */

import type { EffectivePermissionSummary } from "@/lib/permissions";

const DIGIT_CHAR_REGEX = /[0-9০-৯]/;

/**
 * Returns true if the value already contains a masked placeholder (`***` or more).
 * Used to guarantee idempotent masking AND prevent edit forms from overwriting real DB values.
 */
export function isMaskedValue(value: unknown): boolean {
  return typeof value === "string" && /\*{3,}/.test(value);
}

function isEmptyOrPlaceholder(val: string | null | undefined): boolean {
  if (val === null || val === undefined) return true;
  const trimmed = String(val).trim();
  return trimmed.length === 0 || trimmed === "-" || trimmed.toUpperCase() === "N/A";
}

/**
 * Masks phone numbers while keeping prefix + last 3 digits:
 * - `"01712345890"`   -> `"017****890"`
 * - `"+8801712345890"` -> `"+88017****890"`
 * - `"8801712345890"`  -> `"88017****890"`
 * - `"০১৭১২৩৪৫৮৯০"`   -> `"০১৭****৮৯০"`
 * - Short strings (<=6 digits) -> safely masked without exposing full value
 * - Already masked -> returned as-is (idempotent)
 */
export function maskPhoneNumber(phone: string | null | undefined): string {
  if (phone === null || phone === undefined) return "";
  const trimmed = String(phone).trim();
  if (!trimmed) return "";
  if (trimmed === "-" || trimmed.toUpperCase() === "N/A") return trimmed;
  if (isMaskedValue(trimmed)) return trimmed;

  const hasPlus = trimmed.startsWith("+");
  const chars = Array.from(trimmed).filter((ch) => DIGIT_CHAR_REGEX.test(ch));

  // Fallback for non-digit strings
  if (chars.length === 0) {
    if (trimmed.length <= 2) return "****";
    return `${trimmed.slice(0, 1)}****${trimmed.slice(-1)}`;
  }

  if (chars.length <= 2) {
    return "****";
  }

  if (chars.length <= 6) {
    return `${hasPlus ? "+" : ""}${chars[0]}****${chars[chars.length - 1]}`;
  }

  // Detect Bangladesh country code 88 / ৮৮ (e.g. +8801712345890 or 8801712345890)
  const firstTwo = chars.slice(0, 2).join("");
  const isBdCountryCode =
    chars.length >= 12 && (firstTwo === "88" || firstTwo === "৮৮");

  const prefixLen = isBdCountryCode ? 5 : 3;
  const suffixLen = 3;

  const prefix = chars.slice(0, prefixLen).join("");
  const suffix = chars.slice(chars.length - suffixLen).join("");

  return `${hasPlus ? "+" : ""}${prefix}****${suffix}`;
}

/**
 * Masks NID / Birth Registration numbers:
 * - `"1995123456789"` -> `"19*******6789"`
 * - `"1234567890"`    -> `"12****7890"`
 * - Short strings     -> safely masked
 * - Already masked    -> returned as-is
 */
export function maskNidNumber(nid: string | null | undefined): string {
  if (nid === null || nid === undefined) return "";
  const trimmed = String(nid).trim();
  if (!trimmed) return "";
  if (trimmed === "-" || trimmed.toUpperCase() === "N/A") return trimmed;
  if (isMaskedValue(trimmed)) return trimmed;

  const compact = trimmed.replace(/[\s-]+/g, "");
  const chars = Array.from(compact);

  if (chars.length <= 4) {
    return "****";
  }
  if (chars.length <= 7) {
    return `${chars[0]}****${chars[chars.length - 1]}`;
  }

  const starCount = Math.max(4, Math.min(8, chars.length - 6));
  const prefix = chars.slice(0, 2).join("");
  const suffix = chars.slice(chars.length - 4).join("");
  return `${prefix}${"*".repeat(starCount)}${suffix}`;
}

/**
 * Masks email addresses:
 * - `"ahmed.karim@example.com"` -> `"ah***@example.com"`
 * - `"ab@example.com"`          -> `"a***@example.com"`
 * - Already masked              -> returned as-is
 */
export function maskEmailAddress(email: string | null | undefined): string {
  if (email === null || email === undefined) return "";
  const trimmed = String(email).trim();
  if (!trimmed) return "";
  if (trimmed === "-" || trimmed.toUpperCase() === "N/A") return trimmed;
  if (isMaskedValue(trimmed)) return trimmed;

  const atIndex = trimmed.indexOf("@");
  if (atIndex === -1) {
    if (trimmed.length <= 4) return "****";
    return `${trimmed.slice(0, 2)}****${trimmed.slice(-2)}`;
  }

  const local = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex + 1);
  if (!domain) return "****";

  if (local.length <= 1) {
    return `***@${domain}`;
  }
  if (local.length === 2) {
    return `${local.slice(0, 1)}***@${domain}`;
  }
  return `${local.slice(0, 2)}***@${domain}`;
}

/**
 * Masks bank account / mobile banking account numbers:
 * - `"20501234567890"` -> `"**********7890"`
 * - `"1234"`           -> `"****"`
 * - Already masked     -> returned as-is
 */
export function maskBankAccount(account: string | null | undefined): string {
  if (account === null || account === undefined) return "";
  const trimmed = String(account).trim();
  if (!trimmed) return "";
  if (trimmed === "-" || trimmed.toUpperCase() === "N/A") return trimmed;
  if (isMaskedValue(trimmed)) return trimmed;

  const compact = trimmed.replace(/\s+/g, "");
  const chars = Array.from(compact);
  if (chars.length <= 4) return "****";

  const starCount = Math.max(4, chars.length - 4);
  const suffix = chars.slice(chars.length - 4).join("");
  return `${"*".repeat(starCount)}${suffix}`;
}

/**
 * RBAC check for whether the actor can view unmasked PII fields.
 * Fail-closed: returns false if summary is missing, account is suspended/disabled,
 * or `data.unmask` is explicitly denied.
 * Returns true for `super_admin`, `muhtamim`, or actors granted `data.unmask`.
 */
export function canViewUnmaskedField(
  summary: EffectivePermissionSummary | null | undefined,
  _module?: string,
  _field?: string
): boolean {
  if (!summary) return false;
  if (summary.status === "SUSPENDED" || summary.status === "DISABLED") return false;

  // Explicit deny always wins
  if (Array.isArray(summary.deniedPermissions) && summary.deniedPermissions.includes("data.unmask")) {
    return false;
  }

  const roles = Array.isArray(summary.roles) ? summary.roles : [];
  if (
    summary.primaryRole === "super_admin" ||
    summary.primaryRole === "muhtamim" ||
    roles.includes("super_admin") ||
    roles.includes("muhtamim")
  ) {
    return true;
  }

  if (
    Array.isArray(summary.effectivePermissions) &&
    summary.effectivePermissions.includes("data.unmask")
  ) {
    return true;
  }

  return false;
}

const STUDENT_PHONE_FIELDS = [
  "parent_phone",
  "emergency_contact",
  "phone",
  "guardian_phone",
  "father_phone",
  "mother_phone",
] as const;

const STUDENT_NID_FIELDS = [
  "nid_or_birth_cert",
  "birth_certificate_no",
  "nid_number",
] as const;

const STUDENT_EMAIL_FIELDS = [
  "parent_email",
  "email",
  "guardian_email",
] as const;

/**
 * Returns a shallow clone of a student record with PII fields masked when `allowUnmasked` is false.
 * Never mutates the original input object.
 */
export function maskStudentSensitiveFields<T extends Record<string, any>>(
  student: T,
  allowUnmasked: boolean,
  options?: { preserveParentPhone?: boolean }
): T {
  if (!student || typeof student !== "object") return student;
  if (allowUnmasked) return { ...student };

  const clone: Record<string, any> = { ...student };

  for (const key of STUDENT_PHONE_FIELDS) {
    if (options?.preserveParentPhone && key === "parent_phone") continue;
    if (key in clone && !isEmptyOrPlaceholder(clone[key])) {
      clone[key] = maskPhoneNumber(clone[key]);
    }
  }
  for (const key of STUDENT_NID_FIELDS) {
    if (key in clone && !isEmptyOrPlaceholder(clone[key])) {
      clone[key] = maskNidNumber(clone[key]);
    }
  }
  for (const key of STUDENT_EMAIL_FIELDS) {
    if (key in clone && !isEmptyOrPlaceholder(clone[key])) {
      clone[key] = maskEmailAddress(clone[key]);
    }
  }

  return clone as T;
}

/**
 * Returns a cloned donor/donation record with PII fields masked when `allowUnmasked` is false.
 * Handles nested `donors` object (e.g. on donation rows) without mutating inputs.
 */
export function maskDonorSensitiveFields<T extends Record<string, any>>(
  donor: T,
  allowUnmasked: boolean
): T {
  if (!donor || typeof donor !== "object") return donor;
  if (allowUnmasked) return { ...donor };

  const clone: Record<string, any> = { ...donor };

  for (const key of ["phone", "donor_phone", "mobile", "contact_phone"]) {
    if (key in clone && !isEmptyOrPlaceholder(clone[key])) {
      clone[key] = maskPhoneNumber(clone[key]);
    }
  }
  for (const key of ["email", "donor_email"]) {
    if (key in clone && !isEmptyOrPlaceholder(clone[key])) {
      clone[key] = maskEmailAddress(clone[key]);
    }
  }
  for (const key of ["nid", "nid_number"]) {
    if (key in clone && !isEmptyOrPlaceholder(clone[key])) {
      clone[key] = maskNidNumber(clone[key]);
    }
  }
  for (const key of ["account_or_trx_no", "bank_account_no", "bank_account"]) {
    if (key in clone && !isEmptyOrPlaceholder(clone[key])) {
      clone[key] = maskBankAccount(clone[key]);
    }
  }

  if (clone.donors && typeof clone.donors === "object" && !Array.isArray(clone.donors)) {
    clone.donors = maskDonorSensitiveFields(clone.donors, false);
  }

  return clone as T;
}

/**
 * Returns a cloned staff record (including nested `personal`, `contact`, `salary`)
 * with PII fields masked when `allowUnmasked` is false. Never mutates inputs.
 */
export function maskStaffSensitiveFields<T extends Record<string, any>>(
  staff: T,
  allowUnmasked: boolean
): T {
  if (!staff || typeof staff !== "object") return staff;
  if (allowUnmasked) return { ...staff };

  const clone: Record<string, any> = { ...staff };

  if (clone.personal && typeof clone.personal === "object") {
    clone.personal = { ...clone.personal };
    if (!isEmptyOrPlaceholder(clone.personal.nid_number)) {
      clone.personal.nid_number = maskNidNumber(clone.personal.nid_number);
    }
  }

  if (clone.contact && typeof clone.contact === "object") {
    clone.contact = { ...clone.contact };
    if (!isEmptyOrPlaceholder(clone.contact.phone)) {
      clone.contact.phone = maskPhoneNumber(clone.contact.phone);
    }
    if (!isEmptyOrPlaceholder(clone.contact.alt_phone)) {
      clone.contact.alt_phone = maskPhoneNumber(clone.contact.alt_phone);
    }
    if (!isEmptyOrPlaceholder(clone.contact.emergency_contact_phone)) {
      clone.contact.emergency_contact_phone = maskPhoneNumber(
        clone.contact.emergency_contact_phone
      );
    }
    if (!isEmptyOrPlaceholder(clone.contact.email)) {
      clone.contact.email = maskEmailAddress(clone.contact.email);
    }
  }

  if (clone.salary && typeof clone.salary === "object") {
    clone.salary = { ...clone.salary };
    if (!isEmptyOrPlaceholder(clone.salary.bank_account_no)) {
      clone.salary.bank_account_no = maskBankAccount(clone.salary.bank_account_no);
    }
  }

  // Flat fallback fields (legacy / mobile endpoints)
  for (const key of ["phone", "alt_phone", "emergency_contact_phone"]) {
    if (key in clone && !isEmptyOrPlaceholder(clone[key])) {
      clone[key] = maskPhoneNumber(clone[key]);
    }
  }
  if ("email" in clone && !isEmptyOrPlaceholder(clone.email)) {
    clone.email = maskEmailAddress(clone.email);
  }
  if ("nid_number" in clone && !isEmptyOrPlaceholder(clone.nid_number)) {
    clone.nid_number = maskNidNumber(clone.nid_number);
  }
  if ("bank_account_no" in clone && !isEmptyOrPlaceholder(clone.bank_account_no)) {
    clone.bank_account_no = maskBankAccount(clone.bank_account_no);
  }

  return clone as T;
}

/**
 * Returns a cloned alumni record with phone & email masked when `allowUnmasked` is false.
 */
export function maskAlumniSensitiveFields<T extends Record<string, any>>(
  alumni: T,
  allowUnmasked: boolean
): T {
  if (!alumni || typeof alumni !== "object") return alumni;
  if (allowUnmasked) return { ...alumni };

  const clone: Record<string, any> = { ...alumni };

  for (const key of ["phone", "alternative_phone"]) {
    if (key in clone && !isEmptyOrPlaceholder(clone[key])) {
      clone[key] = maskPhoneNumber(clone[key]);
    }
  }
  if ("email" in clone && !isEmptyOrPlaceholder(clone.email)) {
    clone.email = maskEmailAddress(clone.email);
  }

  return clone as T;
}
