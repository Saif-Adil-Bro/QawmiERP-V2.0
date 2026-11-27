import { describe, it, expect } from "vitest";
import {
  resolveMadrasaPrefix,
  extractSavedMadrasaPrefix,
  normalizeStudentIdWithPrefix,
  parseStudentIdentifier,
} from "@/lib/madrasa-prefix";
import {
  getStudentIdNumber,
  setActiveMadrasaPrefix,
  getActiveMadrasaPrefix,
} from "@/lib/student-utils";
import {
  normalizeStudentIdCode as normalizeIdCardCode,
  formatCardNumber,
} from "@/lib/id-card-management";
import {
  normalizeStudentIdCode as normalizeCertCode,
  formatCertificateNumber,
} from "@/lib/certificates";
import { resolveCanonicalStudentCode } from "@/lib/student-auth";

describe("Cross-tenant student ID prefix resolution & single-prefix normalization", () => {
  describe("resolveMadrasaPrefix priority order", () => {
    it("1) uses saved prefix from metadata/registration_no first", () => {
      expect(resolveMadrasaPrefix({ id_prefix: "AHM", name: "Some Other Name" })).toBe("AHM");
      expect(resolveMadrasaPrefix({ prefix: "ahm", name: "Darul Uloom" })).toBe("AHM");
      expect(resolveMadrasaPrefix({ short_code: "DUD", name: "Darul Uloom" })).toBe("DUD");
      expect(
        resolveMadrasaPrefix({
          metadata: { madrasa_info: { prefix: "KJM" } },
          name: "Darul Uloom",
        })
      ).toBe("KJM");
      expect(
        resolveMadrasaPrefix({
          registration_no: JSON.stringify({ prefix: "JIA" }),
          name: "Darul Uloom",
        })
      ).toBe("JIA");
    });

    it("2) derives prefix from the madrasah's own name when no saved prefix exists", () => {
      expect(extractSavedMadrasaPrefix({ name: "Darul Uloom Dhaka" })).toBe("");
      expect(resolveMadrasaPrefix({ name: "Darul Uloom Dhaka" })).toBe("DUD");
      expect(resolveMadrasaPrefix({ name: "দারুল উলুম" })).toBe("DU");
    });

    it("3) falls back to neutral generic 'QM' when neither prefix nor name exists (never MUSE/AHM/AHH)", () => {
      expect(resolveMadrasaPrefix({})).toBe("QM");
      expect(resolveMadrasaPrefix(null)).toBe("QM");
      expect(resolveMadrasaPrefix({ name: "" })).toBe("QM");
    });
  });

  describe("normalizeStudentIdWithPrefix & getStudentIdNumber single-prefix invariant", () => {
    it("never double-prepends when a stored ID already carries another tenant's prefix", () => {
      expect(normalizeStudentIdWithPrefix("MUSE-480025", "AHM")).toBe("AHM-480025");
      expect(normalizeStudentIdWithPrefix("AHM-MUSE-480025", "AHM")).toBe("AHM-480025");
      expect(normalizeStudentIdWithPrefix("MUSE480025", "AHM")).toBe("AHM-480025");
      expect(normalizeStudentIdWithPrefix("480025", "AHM")).toBe("AHM-480025");
      expect(normalizeStudentIdWithPrefix("AHM-480025", "AHM")).toBe("AHM-480025");
      expect(normalizeStudentIdWithPrefix("MUSE-480004", "MUSE")).toBe("MUSE-480004");
    });

    it("normalizes student_id in getStudentIdNumber to exactly one prefix for another tenant", () => {
      const student = {
        id: "stu-1",
        student_id: "MUSE-480025",
        student_id_formatted: "MUSE-480025",
        created_at: "2026-01-01T00:00:00Z",
      };
      expect(getStudentIdNumber(student, [student], "AHM")).toBe("AHM-480025");
    });

    it("normalizes already double-prefixed stored IDs cleanly", () => {
      const student = {
        id: "stu-2",
        student_id: "AHM-MUSE-480004",
        created_at: "2026-01-01T00:00:00Z",
      };
      expect(getStudentIdNumber(student, [student], "AHM")).toBe("AHM-480004");
    });

    it("does not leak tenant prefix via server-side module cache", () => {
      // In vitest Node environment (typeof window === 'undefined'), client cache must be a no-op
      setActiveMadrasaPrefix("MUSE");
      expect(getActiveMadrasaPrefix()).toBe("");
      const otherTenantStudent = {
        id: "stu-3",
        roll_number: "5",
        created_at: "2026-01-01T00:00:00Z",
      };
      const idWithoutExplicitPrefix = getStudentIdNumber(otherTenantStudent, undefined, "AHM");
      expect(idWithoutExplicitPrefix).toMatch(/^AHM-\d+$/);
      expect(idWithoutExplicitPrefix).not.toContain("MUSE");
    });
  });

  describe("parseStudentIdentifier, ID cards, certificates, and auth fallback", () => {
    it("parses single-prefixed, compact, numeric, and accidentally double-prefixed identifiers", () => {
      expect(parseStudentIdentifier("AHM-480025")).toMatchObject({ prefix: "AHM", numericCode: "480025" });
      expect(parseStudentIdentifier("MUSE-480004")).toMatchObject({ prefix: "MUSE", numericCode: "480004" });
      expect(parseStudentIdentifier("AHM-MUSE-480025")).toMatchObject({ prefix: "AHM", numericCode: "480025" });
      expect(parseStudentIdentifier("480025")).toMatchObject({ prefix: null, numericCode: "480025" });
    });

    it("strips single and chained prefixes in ID card and certificate formatters", () => {
      expect(normalizeIdCardCode("AHM-MUSE-480025", 1, "48")).toBe("480025");
      expect(formatCardNumber("48", 1, "AHM-MUSE-480025", "AHM")).toBe("AHM-480025");
      expect(formatCardNumber("48", 1, "480025")).toBe("QM-480025");
      expect(normalizeCertCode("AHM-MUSE-480025", 1)).toBe("480025");
      expect(formatCertificateNumber("CERT", "48", 1, "AHM-MUSE-480025")).toBe("CERT-480025");
    });

    it("resolveCanonicalStudentCode falls back to neutral QM instead of hardcoded tenant prefix", () => {
      expect(resolveCanonicalStudentCode({ id: "s1" }, 4)).toBe("QM480004");
      expect(resolveCanonicalStudentCode({ id: "s1" }, 4, "AHM")).toBe("AHM480004");
    });
  });
});
