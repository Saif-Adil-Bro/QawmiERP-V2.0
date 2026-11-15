export type GradeBadgeColor =
  | "emerald"
  | "blue"
  | "indigo"
  | "amber"
  | "orange"
  | "slate"
  | "red"
  | "purple";

export interface GradeRule {
  id: string;
  label: string;
  minPercentage: number;
  gpa: number;
  color: GradeBadgeColor;
  isFail?: boolean;
}

export const DEFAULT_GRADE_RULES: GradeRule[] = [
  { id: "grade_a_plus", label: "মুমতাজ (A+)", minPercentage: 80, gpa: 5.0, color: "emerald" },
  { id: "grade_a", label: "জায়্যিদ জিদ্দান (A)", minPercentage: 70, gpa: 4.0, color: "blue" },
  { id: "grade_b", label: "জায়্যিদ (B)", minPercentage: 60, gpa: 3.5, color: "indigo" },
  { id: "grade_c", label: "মাকবুল (C)", minPercentage: 45, gpa: 3.0, color: "amber" },
  { id: "grade_d", label: "উত্তীর্ণ (D)", minPercentage: 33, gpa: 1.0, color: "slate" },
  { id: "grade_f", label: "রাসিব (Fail)", minPercentage: 0, gpa: 0.0, color: "red", isFail: true },
];

export const GRADE_PRESETS: {
  key: string;
  name: string;
  description: string;
  rules: GradeRule[];
}[] = [
  {
    key: "qawmi_standard",
    name: "কওমি আদর্শ মানদণ্ড (Qawmi Standard)",
    description: "মুমতাজ (৮০%+), জায়্যিদ জিদ্দান (৭০%+), জায়্যিদ (৬০%+), মাকবুল (৪৫%+), উত্তীর্ণ (৩৩%+)",
    rules: DEFAULT_GRADE_RULES,
  },
  {
    key: "board_gpa_standard",
    name: "সাধারণ / আলিয়া বোর্ড মানদণ্ড (GPA 5.0)",
    description: "A+ (৮০%+), A (৭০%+), A- (৬০%+), B (৫০%+), C (৪০%+), D (৩৩%+)",
    rules: [
      { id: "board_aplus", label: "মুমতাজ (A+)", minPercentage: 80, gpa: 5.0, color: "emerald" },
      { id: "board_a", label: "জায়্যিদ জিদ্দান (A)", minPercentage: 70, gpa: 4.0, color: "blue" },
      { id: "board_aminus", label: "জায়্যিদ (A-)", minPercentage: 60, gpa: 3.5, color: "indigo" },
      { id: "board_b", label: "মাকবুল (B)", minPercentage: 50, gpa: 3.0, color: "amber" },
      { id: "board_c", label: "মুতাওয়াসসিত (C)", minPercentage: 40, gpa: 2.0, color: "orange" },
      { id: "board_d", label: "উত্তীর্ণ (D)", minPercentage: 33, gpa: 1.0, color: "slate" },
      { id: "board_f", label: "রাসিব (F)", minPercentage: 0, gpa: 0.0, color: "red", isFail: true },
    ],
  },
  {
    key: "befaq_division",
    name: "বেফাক বিভাগ ভিত্তিক (Befaq Division)",
    description: "মুমতাজ (৮০%+), জায়্যিদ জিদ্দান (৬৫%+), জায়্যিদ (৫০%+), মাকবুল (৩৫%+)",
    rules: [
      { id: "befaq_mumtaz", label: "মুমতাজ (১ম বিভাগ - স্টার)", minPercentage: 80, gpa: 5.0, color: "emerald" },
      { id: "befaq_jayyid_jiddan", label: "জায়্যিদ জিদ্দান (১ম বিভাগ)", minPercentage: 65, gpa: 4.0, color: "blue" },
      { id: "befaq_jayyid", label: "জায়্যিদ (২য় বিভাগ)", minPercentage: 50, gpa: 3.0, color: "indigo" },
      { id: "befaq_maqbul", label: "মাকবুল (৩য় বিভাগ)", minPercentage: 35, gpa: 2.0, color: "amber" },
      { id: "befaq_rasib", label: "রাসিব (অকৃতকার্য)", minPercentage: 0, gpa: 0.0, color: "red", isFail: true },
    ],
  },
];

export function normalizeGradeRules(rules?: GradeRule[] | null): GradeRule[] {
  if (!Array.isArray(rules) || rules.length === 0) {
    return DEFAULT_GRADE_RULES;
  }
  const cleaned = rules
    .filter((r) => r && typeof r.label === "string" && r.label.trim().length > 0)
    .map((r, idx) => ({
      id: r.id || `grade_${idx}_${Date.now()}`,
      label: r.label.trim(),
      minPercentage: Math.max(0, Math.min(100, Number(r.minPercentage) || 0)),
      gpa: Math.max(0, Math.min(5, Number(r.gpa) || 0)),
      color: (r.color || "slate") as GradeBadgeColor,
      isFail: Boolean(r.isFail),
    }))
    .sort((a, b) => b.minPercentage - a.minPercentage);

  return cleaned.length > 0 ? cleaned : DEFAULT_GRADE_RULES;
}

export function getFailRule(rules?: GradeRule[] | null): GradeRule {
  const normalized = normalizeGradeRules(rules);
  return (
    normalized.find((r) => r.isFail) ||
    normalized[normalized.length - 1] ||
    DEFAULT_GRADE_RULES[DEFAULT_GRADE_RULES.length - 1]
  );
}

export function getMinPassPercentage(rules?: GradeRule[] | null): number {
  const normalized = normalizeGradeRules(rules);
  const passingRules = normalized.filter((r) => !r.isFail && r.minPercentage > 0);
  if (passingRules.length === 0) return 33;
  return passingRules[passingRules.length - 1].minPercentage;
}

export function resolveGradeRule(
  percentage: number,
  rules?: GradeRule[] | null,
  isFailed?: boolean
): GradeRule {
  const normalized = normalizeGradeRules(rules);
  if (isFailed) {
    return getFailRule(normalized);
  }
  const pct = Number.isFinite(percentage) ? percentage : 0;
  for (const rule of normalized) {
    if (pct >= rule.minPercentage) {
      return rule;
    }
  }
  return getFailRule(normalized);
}

export function resolveGradeFromGpa(
  gpa: number,
  rules?: GradeRule[] | null,
  isFailed?: boolean
): GradeRule {
  const normalized = normalizeGradeRules(rules);
  if (isFailed) {
    return getFailRule(normalized);
  }
  const byGpa = [...normalized].sort((a, b) => b.gpa - a.gpa);
  for (const rule of byGpa) {
    if (!rule.isFail && gpa >= rule.gpa) {
      return rule;
    }
  }
  return getFailRule(normalized);
}

export function resolveSubjectGpa(
  m: {
    marks_obtained: number;
    total_marks: number;
    is_failed: boolean;
    has_entered_marks: boolean;
  },
  rules?: GradeRule[] | null
): number {
  if (!m.has_entered_marks || m.is_failed) return 0;
  const pct = m.total_marks > 0 ? (m.marks_obtained / m.total_marks) * 100 : 0;
  const rule = resolveGradeRule(pct, rules, m.is_failed);
  return rule.isFail ? 0 : rule.gpa;
}

export function getGradeBadgeClass(color?: GradeBadgeColor | string): string {
  switch (color) {
    case "emerald":
      return "text-emerald-700 bg-emerald-50 border-emerald-200";
    case "blue":
      return "text-blue-700 bg-blue-50 border-blue-200";
    case "indigo":
      return "text-indigo-700 bg-indigo-50 border-indigo-200";
    case "amber":
      return "text-amber-700 bg-amber-50 border-amber-200";
    case "orange":
      return "text-orange-700 bg-orange-50 border-orange-200";
    case "purple":
      return "text-purple-700 bg-purple-50 border-purple-200";
    case "red":
      return "text-red-700 bg-red-50 border-red-200";
    default:
      return "text-slate-700 bg-slate-100 border-slate-200";
  }
}
