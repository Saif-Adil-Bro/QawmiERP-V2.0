import { describe, it, expect } from "vitest";
import {
  sanitizeSubParts,
  sumSubPartMaxMarks,
  extractSubPartMarks,
  validateAndSumSubPartMarks,
  formatSubPartBreakdown,
} from "@/lib/exam-subparts";
import { toBanglaNumber } from "@/lib/numberToBangla";

describe("Exam Subject Sub-Parts (উপবিভাগ) Engine", () => {
  it("sanitizes preset and custom sub-parts and sums total marks accurately", () => {
    const parts = sanitizeSubParts([
      { name: "লিখিত", max_marks: 60 },
      { name: "মৌখিক", max_marks: 20 },
      { name: "প্র্যাকটিক্যাল", max_marks: 20 },
      { name: "   ", max_marks: 10 }, // invalid empty name
      { name: "অতিরিক্ত", max_marks: 0 }, // invalid 0 max marks
    ]);

    expect(parts).toEqual([
      { key: "written", name: "লিখিত", max_marks: 60 },
      { key: "oral", name: "মৌখিক", max_marks: 20 },
      { key: "practical", name: "প্র্যাকটিক্যাল", max_marks: 20 },
    ]);
    expect(sumSubPartMaxMarks(parts)).toBe(100);
  });

  it("validates per-part max marks, computes combined total, and syncs legacy columns", () => {
    const parts = sanitizeSubParts([
      { key: "written", name: "লিখিত", max_marks: 60 },
      { key: "oral", name: "মৌখিক", max_marks: 20 },
      { key: "practical", name: "প্র্যাকটিক্যাল", max_marks: 20 },
    ]);

    const ok = validateAndSumSubPartMarks(parts, {
      written: "52",
      oral: "18",
      practical: "17",
    });
    expect(ok.valid).toBe(true);
    expect(ok.total).toBe(87);
    expect(ok.cleaned).toEqual({ written: 52, oral: 18, practical: 17 });
    expect(ok.legacyCols).toEqual({
      written_marks: 52,
      oral_marks: 18,
      tutorial_marks: null,
      attendance_marks: null,
    });

    // Exceeding a sub-part's max marks fails validation
    const invalid = validateAndSumSubPartMarks(parts, {
      written: "65",
      oral: "15",
      practical: "10",
    });
    expect(invalid.valid).toBe(false);
    expect(invalid.error).toContain("লিখিত");
  });

  it("extracts sub-part marks from structured map with legacy column fallback", () => {
    const parts = sanitizeSubParts([
      { key: "written", name: "লিখিত", max_marks: 60 },
      { key: "oral", name: "মৌখিক", max_marks: 20 },
      { key: "practical", name: "প্র্যাকটিক্যাল", max_marks: 20 },
    ]);

    const extracted = extractSubPartMarks(
      { written_marks: 50, oral_marks: 16 },
      parts,
      { practical: 18 },
    );
    expect(extracted).toEqual({
      written: "50",
      oral: "16",
      practical: "18",
    });
  });

  it("formats compact breakdown for Report Cards and returns empty string for subjects without sub-parts", () => {
    const parts = sanitizeSubParts([
      { key: "written", name: "লিখিত", max_marks: 60 },
      { key: "oral", name: "মৌখিক", max_marks: 20 },
      { key: "practical", name: "প্র্যাকটিক্যাল", max_marks: 20 },
    ]);

    const text = formatSubPartBreakdown(
      parts,
      { written: 52, oral: 18, practical: 17 },
      toBanglaNumber,
    );
    expect(text).toBe("লিখিত ৫২ + মৌখিক ১৮ + প্র্যাকটিক্যাল ১৭");

    // Subject without sub-parts -> empty breakdown
    expect(formatSubPartBreakdown([], { written: 52 }, toBanglaNumber)).toBe("");
  });
});
