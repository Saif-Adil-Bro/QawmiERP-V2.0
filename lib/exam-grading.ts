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

export type GradeCalculationMode = "average_percentage" | "subject_gpa";
export type HighestMarksScope = "class" | "exam";

export interface ExamGradingConfig {
  calculationMode: GradeCalculationMode; // "average_percentage" (মোট শতকরা থেকে বিভাগ) | "subject_gpa" (প্রতি সাবজেক্ট জিপিএ গড় থেকে বিভাগ)
  highestMarksScope: HighestMarksScope;  // "class" (শ্রেণি অনুযায়ী সর্বোচ্চ) | "exam" (পুরো পরীক্ষা অনুযায়ী সর্বোচ্চ)
  rules: GradeRule[];
}

export const DEFAULT_GRADING_CONFIG: ExamGradingConfig = {
  calculationMode: "subject_gpa",
  highestMarksScope: "class",
  rules: [
    { id: "grade_a_plus", label: "মুমতাজ (A+)", minPercentage: 80, gpa: 5.0, color: "emerald" },
    { id: "grade_a", label: "জায়্যিদ জিদ্দান (A)", minPercentage: 70, gpa: 4.0, color: "blue" },
    { id: "grade_b", label: "জায়্যিদ (B)", minPercentage: 60, gpa: 3.5, color: "indigo" },
    { id: "grade_c", label: "মাকবুল (C)", minPercentage: 45, gpa: 3.0, color: "amber" },
    { id: "grade_d", label: "উত্তীর্ণ (D)", minPercentage: 33, gpa: 1.0, color: "slate" },
    { id: "grade_f", label: "রাসিব (Fail)", minPercentage: 0, gpa: 0.0, color: "red", isFail: true },
  ],
};

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

export function normalizeGradingConfig(raw?: any): ExamGradingConfig {
  if (!raw || typeof raw !== "object") {
    return DEFAULT_GRADING_CONFIG;
  }
  // raw could be an array of GradeRule directly (legacy schema)
  if (Array.isArray(raw)) {
    return {
      calculationMode: "average_percentage",
      highestMarksScope: "class",
      rules: normalizeGradeRules(raw)
    };
  }
  const rules = normalizeGradeRules(raw.rules || raw.grade_rules || raw);
  const calculationMode: GradeCalculationMode = 
    raw.calculationMode === "average_percentage" || raw.mode === "average_percentage"
      ? "average_percentage"
      : "subject_gpa";
  const highestMarksScope: HighestMarksScope = 
    raw.highestMarksScope === "exam" || raw.scope === "exam"
      ? "exam"
      : "class";

  return {
    calculationMode,
    highestMarksScope,
    rules
  };
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

const BANGLA_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

function toBnDigits(num: number): string {
  return String(Math.trunc(num)).replace(/\d/g, (d) => BANGLA_DIGITS[Number(d)] ?? d);
}

/**
 * Format positive integer rank into natural Bengali ordinal:
 * ১ম, ২য়, ৩য়, ৪র্থ, ৫ম, ৬ষ্ঠ, ৭ম, ৮ম, ৯ম, ১০ম, ১১তম, ১২তম...
 */
export function toBanglaOrdinal(rank?: number | null): string {
  if (rank === null || rank === undefined || !Number.isFinite(rank) || rank <= 0) {
    return "অপ্রযোজ্য";
  }
  const n = Math.trunc(rank);
  const specialMap: Record<number, string> = {
    1: "১ম",
    2: "২য়",
    3: "৩য়",
    4: "৪র্থ",
    5: "৫ম",
    6: "৬ষ্ঠ",
    7: "৭ম",
    8: "৮ম",
    9: "৯ম",
    10: "১০ম",
  };
  if (specialMap[n]) return specialMap[n];
  return `${toBnDigits(n)}তম`;
}

export interface ComputedSubjectResult {
  id: string;
  subjectName: string;
  marksObtained: number;
  totalMarks: number;
  percentage: number;
  gpa: number;
  gradeLabel: string;
  gradeColor: GradeBadgeColor;
  badgeClass: string;
  isFailed: boolean;
}

export interface StudentExamSummary {
  hasMarks: boolean;
  subjectCount: number;
  failedSubjectCount: number;
  totalObtained: number;
  totalMax: number;
  percentage: number;
  gpa: number;
  gradeLabel: string;
  gradeColor: GradeBadgeColor;
  badgeClass: string;
  isPassed: boolean;
  statusLabel: string;
  subjects: ComputedSubjectResult[];
}

export function computeStudentExamSummary(
  rows: Array<Record<string, any>>,
  gradingConfigOrRules?: ExamGradingConfig | GradeRule[] | null
): StudentExamSummary {
  const config = normalizeGradingConfig(gradingConfigOrRules);
  const rules = config.rules;
  const minPassPct = getMinPassPercentage(rules);

  const validRows = (rows || []).filter(
    (r) => r && (r.marks_obtained !== null && r.marks_obtained !== undefined && r.marks_obtained !== "")
  );

  if (validRows.length === 0) {
    return {
      hasMarks: false,
      subjectCount: 0,
      failedSubjectCount: 0,
      totalObtained: 0,
      totalMax: 0,
      percentage: 0,
      gpa: 0,
      gradeLabel: "অনির্ধারিত",
      gradeColor: "slate",
      badgeClass: getGradeBadgeClass("slate"),
      isPassed: false,
      statusLabel: "নম্বর এন্ট্রি হয়নি",
      subjects: [],
    };
  }

  let totalObtained = 0;
  let totalMax = 0;
  let gpaSum = 0;
  let failedSubjectCount = 0;

  const subjects: ComputedSubjectResult[] = validRows.map((r, idx) => {
    const maxM = Number(r.total_marks) > 0 ? Number(r.total_marks) : 100;
    const obtM = Math.max(0, Number(r.marks_obtained) || 0);
    const pct = maxM > 0 ? Math.round((obtM / maxM) * 100) : 0;
    const rule = resolveGradeRule(pct, rules, pct < minPassPct);
    const isFailed = Boolean(rule.isFail || pct < minPassPct);
    const gpa = isFailed ? 0 : rule.gpa;

    totalObtained += obtM;
    totalMax += maxM;
    gpaSum += gpa;
    if (isFailed) failedSubjectCount += 1;

    const subjectName =
      r.subject_name ||
      (Array.isArray(r.subjects) ? r.subjects[0]?.name : r.subjects?.name) ||
      `বিষয় ${toBnDigits(idx + 1)}`;

    return {
      id: String(r.id || `sub_${idx}`),
      subjectName,
      marksObtained: obtM,
      totalMarks: maxM,
      percentage: pct,
      gpa,
      gradeLabel: rule.label,
      gradeColor: rule.color,
      badgeClass: getGradeBadgeClass(rule.color),
      isFailed,
    };
  });

  const percentage = totalMax > 0 ? Math.round((totalObtained / totalMax) * 100) : 0;
  const isPassed = failedSubjectCount === 0;
  const rawGpa = isPassed && subjects.length > 0 ? gpaSum / subjects.length : 0;
  const gpa = Math.round(rawGpa * 100) / 100;

  const overallRule =
    config.calculationMode === "subject_gpa"
      ? resolveGradeFromGpa(gpa, rules, !isPassed)
      : resolveGradeRule(percentage, rules, !isPassed);

  return {
    hasMarks: true,
    subjectCount: subjects.length,
    failedSubjectCount,
    totalObtained,
    totalMax,
    percentage,
    gpa,
    gradeLabel: overallRule.label,
    gradeColor: overallRule.color,
    badgeClass: getGradeBadgeClass(overallRule.color),
    isPassed,
    statusLabel: isPassed ? "উত্তীর্ণ" : "অকৃতকার্য",
    subjects,
  };
}

export interface MeritPositionResult {
  meritPosition: number | null;
  totalCandidates: number;
  formattedPosition: string;
}

/**
 * Compute student's true merit position within their class for an exam.
 * Matches Admin ReportCardsClient ranking: passed students rank above failed,
 * then higher percentage, then higher total marks, with shared rank on ties.
 */
export function computeClassMeritPosition(
  targetStudentId: string,
  allClassExamRows: Array<Record<string, any>>,
  gradingConfigOrRules?: ExamGradingConfig | GradeRule[] | null
): MeritPositionResult {
  if (!targetStudentId || !Array.isArray(allClassExamRows) || allClassExamRows.length === 0) {
    return {
      meritPosition: null,
      totalCandidates: 0,
      formattedPosition: "অপ্রযোজ্য",
    };
  }

  const byStudent = new Map<string, Array<Record<string, any>>>();
  for (const row of allClassExamRows) {
    if (!row?.student_id) continue;
    const sid = String(row.student_id);
    const list = byStudent.get(sid) || [];
    list.push(row);
    byStudent.set(sid, list);
  }

  const candidates: Array<{
    studentId: string;
    isFailed: boolean;
    percentage: number;
    totalObtained: number;
  }> = [];

  for (const [sid, rows] of byStudent.entries()) {
    const summary = computeStudentExamSummary(rows, gradingConfigOrRules);
    if (!summary.hasMarks) continue;
    candidates.push({
      studentId: sid,
      isFailed: !summary.isPassed,
      percentage: summary.percentage,
      totalObtained: summary.totalObtained,
    });
  }

  if (candidates.length === 0) {
    return {
      meritPosition: null,
      totalCandidates: 0,
      formattedPosition: "অপ্রযোজ্য",
    };
  }

  candidates.sort((a, b) => {
    if (a.isFailed !== b.isFailed) return a.isFailed ? 1 : -1;
    if (b.percentage !== a.percentage) return b.percentage - a.percentage;
    return b.totalObtained - a.totalObtained;
  });

  let lastRank = 1;
  let targetRank: number | null = null;
  let targetFailed = false;

  candidates.forEach((cand, idx) => {
    if (idx > 0) {
      const prev = candidates[idx - 1];
      const isTie =
        cand.isFailed === prev.isFailed &&
        cand.percentage === prev.percentage &&
        cand.totalObtained === prev.totalObtained;
      if (!isTie) {
        lastRank = idx + 1;
      }
    } else {
      lastRank = 1;
    }

    if (cand.studentId === String(targetStudentId)) {
      targetRank = lastRank;
      targetFailed = cand.isFailed;
    }
  });

  if (targetRank === null || targetFailed) {
    return {
      meritPosition: null,
      totalCandidates: candidates.length,
      formattedPosition: targetFailed ? "অপ্রযোজ্য (অকৃতকার্য)" : "অপ্রযোজ্য",
    };
  }

  return {
    meritPosition: targetRank,
    totalCandidates: candidates.length,
    formattedPosition: toBanglaOrdinal(targetRank),
  };
}

