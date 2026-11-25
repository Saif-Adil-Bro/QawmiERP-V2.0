/**
 * Shared Bengali Unicode search normalization and student URL filter parameter normalization.
 */

export function normalizeBengaliSearchText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFC")
    // Unify decomposed vs precomposed Bengali nukta letters (য়/য়, ড়/ড়, ঢ়/ঢ়)
    .replace(/\u09AF\u09BC/g, "\u09DF")
    .replace(/\u09A1\u09BC/g, "\u09DC")
    .replace(/\u09A2\u09BC/g, "\u09DD")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export type CanonicalStudentFeeFilter = "ALL" | "FREE" | "DISCOUNTED" | "PAYING";

export interface NormalizedFeeFilterResult {
  value: CanonicalStudentFeeFilter;
  isUnknown: boolean;
  rawValue: string | null;
}

const FEE_FILTER_ALIASES: Record<string, CanonicalStudentFeeFilter> = {
  ALL: "ALL",
  FREE: "FREE",
  LILLAH: "FREE",
  LILLAH_FREE: "FREE",
  "লিল্লাহ": "FREE",
  "ফ্রি": "FREE",
  DISCOUNTED: "DISCOUNTED",
  WAIVED: "DISCOUNTED",
  WAIVER: "DISCOUNTED",
  EXEMPT: "DISCOUNTED",
  EXEMPTED: "DISCOUNTED",
  SCHOLARSHIP: "DISCOUNTED",
  DISCOUNT: "DISCOUNTED",
  "মওকুফ": "DISCOUNTED",
  "মওকুফপ্রাপ্ত": "DISCOUNTED",
  PAYING: "PAYING",
  REGULAR: "PAYING",
  FULL: "PAYING",
  "পেইং": "PAYING",
};

export function normalizeStudentFeeFilterParam(
  raw: string | null | undefined,
): NormalizedFeeFilterResult {
  if (!raw || !raw.trim()) {
    return { value: "ALL", isUnknown: false, rawValue: null };
  }
  const trimmed = raw.trim();
  const upper = trimmed.toUpperCase();
  const mapped = FEE_FILTER_ALIASES[upper] || FEE_FILTER_ALIASES[trimmed];
  if (mapped) {
    return { value: mapped, isUnknown: false, rawValue: trimmed };
  }
  return { value: "ALL", isUnknown: true, rawValue: trimmed };
}
