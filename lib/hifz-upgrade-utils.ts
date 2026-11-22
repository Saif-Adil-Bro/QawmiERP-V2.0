export type HifzCategory = "sabqi" | "khatmi";

export type ParaMistakeStatus = "perfect" | "good" | "weak";

export type SabinaListeningMode = "one_to_one" | "group_to_group" | "one_to_many";

export interface HifzStudentProfile {
  student_id: string;
  madrasa_id: string;
  hifz_category: HifzCategory;
  previously_memorized_paras: number[];
  total_khatams_completed: number;
  current_khatam_paras_done: number[];
  default_sabina_partner_id?: string | null;
  updated_at?: string;
}

export interface SabinaParaBreakdownItem {
  para: number;
  mistakes: number;
  status: ParaMistakeStatus;
}

export interface HifzWeeklySabinaRecord {
  id: string;
  madrasa_id: string;
  sabina_date: string;
  student_id: string;
  student_name?: string;
  listener_student_id?: string | null;
  listener_student_name?: string | null;
  verified_by_teacher_id?: string | null;
  assigned_para_from: number;
  assigned_para_to: number;
  para_breakdown: SabinaParaBreakdownItem[];
  total_paras_recited: number;
  total_mistakes: number;
  status: string;
  remarks?: string | null;
  created_at?: string;
}

export interface SpecialSabinaSessionLog {
  id: string;
  session_label: string;
  reciter_id: string;
  reciter_name?: string;
  listener_ids: string[];
  listener_names?: string[];
  para_from: number;
  para_to: number;
  para_wise_mistakes: SabinaParaBreakdownItem[];
  total_mistakes: number;
  timestamp: string;
}

export interface HifzSpecialSabinaRecord {
  id: string;
  madrasa_id: string;
  title: string;
  duration_days: number;
  start_date: string;
  end_date?: string | null;
  status: "ongoing" | "completed";
  listening_mode: SabinaListeningMode;
  participants: {
    pairs?: Array<{ studentAId: string; studentBId: string }>;
    reciter_group_ids?: string[];
    listener_group_ids?: string[];
    reciter_student_id?: string;
    listener_ids?: string[];
  };
  session_logs: SpecialSabinaSessionLog[];
  created_by?: string | null;
  created_at?: string;
}

export interface HifzDashboardSummary {
  sabqiCount: number;
  khatmiCount: number;
  todayEntriesCount: number;
  totalHifzStudents: number;
  monthlyKhatamsCount: number;
  thursdaySabinaCount: number;
  weakParasCount: number;
  ongoingSpecialSabinaTitle: string | null;
  ongoingSpecialSabinaCount: number;
}

export type ParaMapCellStatus =
  | "pre_memorized"
  | "completed"
  | "current"
  | "weak"
  | "pending";

export interface ParaMapCell {
  para: number;
  status: ParaMapCellStatus;
  lastMistakes?: number;
}

export function classifyParaMistakeStatus(mistakes: number): ParaMistakeStatus {
  const m = Math.max(0, Math.floor(Number(mistakes) || 0));
  if (m === 0) return "perfect";
  if (m <= 2) return "good";
  return "weak";
}

export function normalizeParaList(paras: unknown): number[] {
  if (!Array.isArray(paras)) return [];
  const set = new Set<number>();
  for (const p of paras) {
    const n = Number(p);
    if (Number.isInteger(n) && n >= 1 && n <= 30) {
      set.add(n);
    }
  }
  return Array.from(set).sort((a, b) => a - b);
}

export function expandParaRange(fromPara?: number | null, toPara?: number | null): number[] {
  const start = Math.max(1, Math.min(30, Number(fromPara) || 0));
  const end = Math.max(1, Math.min(30, Number(toPara || fromPara) || 0));
  if (!fromPara || start < 1) return [];
  const lo = Math.min(start, end);
  const hi = Math.max(start, end);
  const res: number[] = [];
  for (let p = lo; p <= hi; p++) {
    res.push(p);
  }
  return res;
}

export function buildParaBreakdown(
  fromPara: number,
  toPara: number,
  mistakeMap: Record<number, number>
): SabinaParaBreakdownItem[] {
  const paras = expandParaRange(fromPara, toPara);
  return paras.map((para) => {
    const mistakes = Math.max(0, Math.floor(Number(mistakeMap[para]) || 0));
    return {
      para,
      mistakes,
      status: classifyParaMistakeStatus(mistakes),
    };
  });
}

export function summarizeParaBreakdown(breakdown: SabinaParaBreakdownItem[]) {
  const perfectParas: number[] = [];
  const goodParas: number[] = [];
  const weakParas: number[] = [];
  let totalMistakes = 0;

  for (const item of breakdown) {
    totalMistakes += item.mistakes;
    if (item.status === "perfect") perfectParas.push(item.para);
    else if (item.status === "good") goodParas.push(item.para);
    else weakParas.push(item.para);
  }

  return {
    perfectParas,
    goodParas,
    weakParas,
    totalParas: breakdown.length,
    totalMistakes,
  };
}

/**
 * Adds newly completed paras to a Khatmi student's current cycle.
 * If all 30 paras (1..30) are completed, increments total_khatams_completed
 * and resets current_khatam_paras_done for the next cycle.
 */
export function applyKhatmiCycleProgress(
  profile: Pick<HifzStudentProfile, "total_khatams_completed" | "current_khatam_paras_done">,
  newlyCompletedParas: number[]
): {
  total_khatams_completed: number;
  current_khatam_paras_done: number[];
  khatamJustCompleted: boolean;
} {
  const merged = new Set<number>(normalizeParaList(profile.current_khatam_paras_done));
  for (const p of normalizeParaList(newlyCompletedParas)) {
    merged.add(p);
  }

  let totalKhatams = Math.max(0, Number(profile.total_khatams_completed) || 0);
  if (merged.size >= 30) {
    totalKhatams += 1;
    return {
      total_khatams_completed: totalKhatams,
      current_khatam_paras_done: [],
      khatamJustCompleted: true,
    };
  }

  return {
    total_khatams_completed: totalKhatams,
    current_khatam_paras_done: Array.from(merged).sort((a, b) => a - b),
    khatamJustCompleted: false,
  };
}

/**
 * Computes a 30-Para color-coded Hifz map for Student & Guardian Portal.
 */
export function computeStudent30ParaMap(
  profile: HifzStudentProfile | null,
  logs: Array<{ sabak_para?: number | null; saboki_para?: number | null; amukhta_para?: number | null }>,
  weeklySabinas: HifzWeeklySabinaRecord[]
): ParaMapCell[] {
  const preSet = new Set(normalizeParaList(profile?.previously_memorized_paras));
  const khatamDoneSet = new Set(normalizeParaList(profile?.current_khatam_paras_done));

  // Track latest Sabina mistake status per para
  const latestSabinaByPara = new Map<number, SabinaParaBreakdownItem>();
  const sortedSabinas = [...(weeklySabinas || [])].sort((a, b) =>
    String(a.sabina_date || "").localeCompare(String(b.sabina_date || ""))
  );
  for (const sab of sortedSabinas) {
    for (const item of sab.para_breakdown || []) {
      latestSabinaByPara.set(item.para, item);
    }
  }

  const latestSabakPara =
    logs.find((l) => Number(l.sabak_para) >= 1 && Number(l.sabak_para) <= 30)?.sabak_para ?? null;

  const loggedParas = new Set<number>();
  for (const l of logs) {
    if (l.sabak_para && l.sabak_para >= 1 && l.sabak_para <= 30) loggedParas.add(l.sabak_para);
    if (l.saboki_para && l.saboki_para >= 1 && l.saboki_para <= 30) loggedParas.add(l.saboki_para);
  }

  const cells: ParaMapCell[] = [];
  for (let para = 1; para <= 30; para++) {
    const sabItem = latestSabinaByPara.get(para);
    let status: ParaMapCellStatus = "pending";

    if (sabItem?.status === "weak") {
      status = "weak";
    } else if (profile?.hifz_category === "khatmi") {
      if (khatamDoneSet.has(para)) status = "completed";
      else if (preSet.has(para)) status = "pre_memorized";
      else status = "completed";
    } else {
      if (latestSabakPara === para) {
        status = "current";
      } else if (preSet.has(para)) {
        status = "pre_memorized";
      } else if (loggedParas.has(para) || (latestSabakPara && para < latestSabakPara)) {
        status = "completed";
      }
    }

    cells.push({
      para,
      status,
      lastMistakes: sabItem?.mistakes,
    });
  }

  return cells;
}

export const LISTENING_MODE_LABELS_BN: Record<SabinaListeningMode, string> = {
  one_to_one: "জোড়ায় (একে অপরকে শোনানো)",
  group_to_group: "গ্রুপ বনাম গ্রুপ",
  one_to_many: "প্যানেল শ্রবণ (একজন পড়বে, একাধিক শ্রোতা)",
};
