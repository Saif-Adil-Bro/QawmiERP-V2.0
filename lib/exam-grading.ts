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
    return "প্রযোজ্য নয়";
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

export interface ExamEvaluationOptions {
  failPolicy?: string; // "compulsory_subject_fail" | "any_subject_fail" | "percentage_only"
  examSubjects?: Array<{
    class_id?: string | null;
    subject_name: string;
    total_marks?: number | null;
    pass_marks?: number | null;
    is_compulsory?: boolean | null;
  }>;
  compulsorySubjects?: Record<string, boolean>;
  classId?: string | null;
}

export interface ComputedSubjectResult {
  id: string;
  subjectName: string;
  hasEntered: boolean;
  marksObtained: number;
  totalMarks: number;
  passMarks: number;
  isCompulsory: boolean;
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
  gradingConfigOrRules?: ExamGradingConfig | GradeRule[] | null,
  options?: ExamEvaluationOptions
): StudentExamSummary {
  const config = normalizeGradingConfig(gradingConfigOrRules);
  const rules = config.rules;
  const minPassPct = getMinPassPercentage(rules);
  const failPolicy = options?.failPolicy || "compulsory_subject_fail";
  const compulsoryMeta = options?.compulsorySubjects || {};
  const classId = options?.classId || null;

  // Build subject definition map from exam_subjects (prefer matching classId)
  const subjectDefMap = new Map<
    string,
    { total_marks?: number | null; pass_marks?: number | null; is_compulsory?: boolean | null }
  >();
  for (const subDef of options?.examSubjects || []) {
    if (!subDef?.subject_name) continue;
    if (classId && subDef.class_id && String(subDef.class_id) !== String(classId)) continue;
    subjectDefMap.set(subDef.subject_name.trim(), subDef);
  }

  const entered = new Map(rows.filter(r => r?.subject_name && r.marks_obtained != null && r.marks_obtained !== '').map(r=>[r.subject_name.trim(),r]));
  const names = Array.from(subjectDefMap.size ? subjectDefMap.keys() : entered.keys());
  const validRows = names.map(name => entered.get(name) ?? {subject_name:name,marks_obtained:null});
  const hasMarks = validRows.some(r=>r.marks_obtained != null);
  let totalObtained = 0;
  let totalMax = 0;
  let failedSubjectCount = 0;
  let failedCompulsoryCount = 0;

  const subjects: ComputedSubjectResult[] = validRows.map((r, idx) => {
    const subjectName = (
      r.subject_name ||
      (Array.isArray(r.subjects) ? r.subjects[0]?.name : r.subjects?.name) ||
      `বিষয় ${toBnDigits(idx + 1)}`
    ).trim();

    const subDef = subjectDefMap.get(subjectName);
    const maxM =
      Number(r.total_marks) > 0
        ? Number(r.total_marks)
        : Number(subDef?.total_marks) > 0
        ? Number(subDef?.total_marks)
        : 100;
    const obtM = Math.max(0, Number(r.marks_obtained) || 0);
    const pct = maxM > 0 ? (obtM / maxM) * 100 : 0;

    // Resolve per-subject pass mark & compulsory flag matching Admin ReportCardsClient
    const passMarks =
      subDef?.pass_marks !== undefined && subDef?.pass_marks !== null && Number(subDef.pass_marks) >= 0
        ? Number(subDef.pass_marks)
        : 33;

    const compKey = classId ? `${classId}:${subjectName}` : "";
    const isCompulsory =
      compKey && compulsoryMeta[compKey] !== undefined
        ? Boolean(compulsoryMeta[compKey])
        : subDef?.is_compulsory !== undefined && subDef?.is_compulsory !== null
        ? Boolean(subDef.is_compulsory)
        : true;

    const hasEntered = r.marks_obtained != null;
    const isSubFailed = hasEntered && obtM < passMarks;
    const rule = resolveGradeRule(pct, rules, isSubFailed);
    const isFailed = isSubFailed;
    const gpa = !hasEntered || isFailed ? 0 : rule.gpa;

    totalObtained += obtM;
    totalMax += maxM;
    if (isFailed) {
      failedSubjectCount += 1;
      if (isCompulsory) failedCompulsoryCount += 1;
    }

    return {
      id: String(r.id || `sub_${idx}`),
      hasEntered,
      subjectName,
      marksObtained: obtM,
      totalMarks: maxM,
      passMarks,
      isCompulsory,
      percentage: pct,
      gpa,
      gradeLabel: hasEntered ? rule.label : "—",
      gradeColor: rule.color,
      badgeClass: getGradeBadgeClass(rule.color),
      isFailed,
    };
  });

  const exactPct = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;
  const percentage = Number(exactPct.toFixed(2));

  // Determine overall pass/fail matching Admin ReportCardsClient fail_policy
  let isOverallFailed = false;
  if (failPolicy === "any_subject_fail") {
    isOverallFailed = failedSubjectCount > 0 || exactPct < minPassPct;
  } else if (failPolicy === "percentage_only") {
    isOverallFailed = exactPct < minPassPct;
  } else {
    // Default "compulsory_subject_fail"
    isOverallFailed = failedCompulsoryCount > 0 || exactPct < minPassPct;
  }
  const isPassed = hasMarks && !isOverallFailed;

  let gpa = 0;
  let overallRule: GradeRule;

  if (!isPassed) {
    gpa = 0;
    overallRule = getFailRule(rules);
  } else if (config.calculationMode === "average_percentage") {
    overallRule = resolveGradeRule(exactPct, rules, false);
    gpa = Math.round(overallRule.gpa * 100) / 100;
  } else {
    const compulsorySubs = subjects.filter((s) => s.isCompulsory);
    const optionalSubs = subjects.filter((s) => !s.isCompulsory);
    const compulsoryGpaSum = compulsorySubs.reduce((sum, s) => sum + s.gpa, 0);
    const optionalBonus = optionalSubs.reduce((sum, s) => sum + Math.max(0, s.gpa - 2.0), 0);
    const denom = compulsorySubs.length > 0 ? compulsorySubs.length : subjects.length;
    const rawGpa = denom > 0 ? Math.min(5.0, (compulsoryGpaSum + optionalBonus) / denom) : 0;
    gpa = Math.round(rawGpa * 100) / 100;
    overallRule = resolveGradeFromGpa(rawGpa, rules, false);
  }

  return {
    hasMarks,
    subjectCount: subjects.length,
    failedSubjectCount,
    totalObtained,
    totalMax,
    percentage,
    gpa,
    gradeLabel: hasMarks ? overallRule.label : "অপেক্ষমাণ",
    gradeColor: overallRule.color,
    badgeClass: getGradeBadgeClass(overallRule.color),
    isPassed,
    statusLabel: !hasMarks ? "অপেক্ষমাণ" : isPassed ? "উত্তীর্ণ" : "অকৃতকার্য",
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
export function rankSummaries(candidates: {id:string; summary:StudentExamSummary}[]) {
  const entered = candidates.filter(c=>c.summary.hasMarks);
  const passed = entered.filter(c=>c.summary.isPassed).sort((a,b)=>b.summary.percentage-a.summary.percentage || b.summary.totalObtained-a.summary.totalObtained);
  const ranks = new Map<string,number>();
  let rank = 0;
  passed.forEach(({id,summary},idx) => {
    if (!idx || summary.percentage !== passed[idx-1].summary.percentage || summary.totalObtained !== passed[idx-1].summary.totalObtained) rank = idx + 1;
    ranks.set(id,rank);
  });
  return {ranks, totalCandidates:entered.length};
}
