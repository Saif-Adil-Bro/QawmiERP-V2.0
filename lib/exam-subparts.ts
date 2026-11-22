/**
 * Exam Subject Sub-Parts (উপবিভাগ) engine.
 * Allows optional custom sub-components per subject in an exam (e.g. লিখিত 60 + মৌখিক 20 + প্র্যাকটিক্যাল 20 = 100).
 * Subjects without sub-parts use a clean single obtained-marks input everywhere (Admin + Teacher Portal).
 */

export interface ExamSubjectSubPart {
  key: string;
  name: string;
  max_marks: number;
}

export const SUBPART_PRESETS: Array<{
  key: string;
  name: string;
  defaultMarks: number;
}> = [
  { key: "written", name: "লিখিত", defaultMarks: 60 },
  { key: "oral", name: "মৌখিক", defaultMarks: 20 },
  { key: "practical", name: "প্র্যাকটিক্যাল", defaultMarks: 20 },
  { key: "tilawat", name: "তিলাওয়াত", defaultMarks: 20 },
  { key: "tutorial", name: "টিউটোরিয়াল", defaultMarks: 10 },
  { key: "attendance", name: "উপস্থিতি", defaultMarks: 10 },
];

export const LEGACY_COLUMN_BY_KEY: Record<
  string,
  "written_marks" | "oral_marks" | "tutorial_marks" | "attendance_marks"
> = {
  written: "written_marks",
  oral: "oral_marks",
  tutorial: "tutorial_marks",
  attendance: "attendance_marks",
};

const NAME_TO_PRESET_KEY: Record<string, string> = {
  লিখিত: "written",
  written: "written",
  মৌখিক: "oral",
  oral: "oral",
  প্র্যাকটিক্যাল: "practical",
  প্রাক্টিক্যাল: "practical",
  practical: "practical",
  তিলাওয়াত: "tilawat",
  তিলাওয়াত: "tilawat",
  tilawat: "tilawat",
  টিউটোরিয়াল: "tutorial",
  টিউটোরিয়াল: "tutorial",
  tutorial: "tutorial",
  উপস্থিতি: "attendance",
  attendance: "attendance",
};

export function makeSubPartKey(name: string, index: number, usedKeys: Set<string>): string {
  const normalized = name.trim().toLowerCase();
  const presetKey = NAME_TO_PRESET_KEY[normalized];
  if (presetKey && !usedKeys.has(presetKey)) {
    return presetKey;
  }
  const ascii = normalized
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  let candidate = ascii || `part_${index + 1}`;
  let suffix = 2;
  while (usedKeys.has(candidate)) {
    candidate = `${ascii || "part"}_${suffix++}`;
  }
  return candidate;
}

/**
 * Validates and normalizes an array of subject sub-parts.
 */
export function sanitizeSubParts(raw: unknown): ExamSubjectSubPart[] {
  if (!Array.isArray(raw)) return [];
  const usedKeys = new Set<string>();
  const result: ExamSubjectSubPart[] = [];

  for (let i = 0; i < raw.length; i++) {
    const item = raw[i] as Record<string, unknown> | null | undefined;
    if (!item || typeof item !== "object") continue;
    const name = String(item.name || "").trim().slice(0, 60);
    const maxMarks = Number(item.max_marks);
    if (!name || !Number.isFinite(maxMarks) || maxMarks <= 0) continue;

    const rawKey = typeof item.key === "string" ? item.key.trim() : "";
    const key =
      rawKey && !usedKeys.has(rawKey)
        ? rawKey
        : makeSubPartKey(name, i, usedKeys);
    usedKeys.add(key);

    result.push({
      key,
      name,
      max_marks: Number(maxMarks.toFixed(2)),
    });
  }

  return result;
}

export function sumSubPartMaxMarks(parts: ExamSubjectSubPart[]): number {
  return Number(
    parts.reduce((sum, p) => sum + (Number(p.max_marks) || 0), 0).toFixed(2),
  );
}

/**
 * Extracts sub-part marks from an exam_results row + optional structured map,
 * falling back to legacy written/oral/tutorial/attendance columns if applicable.
 */
export function extractSubPartMarks(
  row: Record<string, any> | null | undefined,
  subParts: ExamSubjectSubPart[],
  storedMap?: Record<string, number> | null,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!subParts.length) return out;

  const rowMap =
    row?.sub_part_marks && typeof row.sub_part_marks === "object"
      ? (row.sub_part_marks as Record<string, unknown>)
      : null;

  for (const part of subParts) {
    let val: unknown =
      storedMap?.[part.key] ??
      rowMap?.[part.key];

    if (val == null) {
      const legacyCol = LEGACY_COLUMN_BY_KEY[part.key];
      if (legacyCol && row?.[legacyCol] != null && row[legacyCol] !== "") {
        val = row[legacyCol];
      }
    }

    out[part.key] = val == null || val === "" ? "" : String(val);
  }

  return out;
}

/**
 * Validates entered sub-part marks against each part's max_marks, computes combined total,
 * and maps standard keys back to legacy columns for backward compatibility.
 */
export function validateAndSumSubPartMarks(
  subParts: ExamSubjectSubPart[],
  inputMarks: Record<string, number | string | null | undefined> | null | undefined,
): {
  valid: boolean;
  error?: string;
  total: number | null;
  cleaned: Record<string, number>;
  legacyCols: {
    written_marks: number | null;
    oral_marks: number | null;
    tutorial_marks: number | null;
    attendance_marks: number | null;
  };
} {
  const legacyCols = {
    written_marks: null as number | null,
    oral_marks: null as number | null,
    tutorial_marks: null as number | null,
    attendance_marks: null as number | null,
  };
  const cleaned: Record<string, number> = {};

  if (!subParts.length || !inputMarks || typeof inputMarks !== "object") {
    return { valid: true, total: null, cleaned, legacyCols };
  }

  let hasAny = false;
  let sum = 0;

  for (const part of subParts) {
    const raw = inputMarks[part.key];
    if (raw === "" || raw === null || raw === undefined) continue;
    const num = Number(raw);
    if (!Number.isFinite(num) || num < 0) {
      return {
        valid: false,
        error: `"${part.name}" অংশের নম্বর সঠিক নয়।`,
        total: null,
        cleaned,
        legacyCols,
      };
    }
    if (num > part.max_marks + 0.000001) {
      return {
        valid: false,
        error: `"${part.name}" অংশের প্রাপ্ত নম্বর পূর্ণমান (${part.max_marks})-এর চেয়ে বেশি হতে পারে না।`,
        total: null,
        cleaned,
        legacyCols,
      };
    }

    hasAny = true;
    const rounded = Number(num.toFixed(2));
    cleaned[part.key] = rounded;
    sum += rounded;

    const legacyCol = LEGACY_COLUMN_BY_KEY[part.key];
    if (legacyCol) {
      legacyCols[legacyCol] = rounded;
    }
  }

  return {
    valid: true,
    total: hasAny ? Number(sum.toFixed(2)) : null,
    cleaned,
    legacyCols,
  };
}

/**
 * Formats a compact breakdown string for Report Cards, Results, and Student/Guardian Portal.
 * Example: "লিখিত ৫২ + মৌখিক ১৮ + প্র্যাকটিক্যাল ১৭"
 */
export function formatSubPartBreakdown(
  subParts: ExamSubjectSubPart[] | null | undefined,
  subPartMarks: Record<string, number | string | null | undefined> | null | undefined,
  formatNum: (v: number | string) => string = (v) => String(v),
): string {
  if (!subParts?.length || !subPartMarks) return "";
  const pieces: string[] = [];
  for (const part of subParts) {
    const val = subPartMarks[part.key];
    if (val === undefined || val === null || val === "") continue;
    pieces.push(`${part.name} ${formatNum(val)}`);
  }
  return pieces.join(" + ");
}
