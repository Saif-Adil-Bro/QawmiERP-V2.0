import { getDhakaYear } from "@/lib/date-utils";
export type HifzCategory = "sabqi" | "khatmi";
export type SessionTime = "morning" | "afternoon";
export const sessionTimes = ["morning", "afternoon"] as const;
export const dailyDefaults = {
  student_category: "sabqi" as HifzCategory,
  sabak_mistakes: 0,
  sat_sabak_mistakes: 0,
  amukhta_mistakes: 0,
  morning_session_done: false,
  morning_para_from: null as number | null,
  morning_para_to: null as number | null,
  morning_pages: 0,
  morning_mistakes: 0,
  afternoon_session_done: false,
  afternoon_para_from: null as number | null,
  afternoon_para_to: null as number | null,
  afternoon_pages: 0,
  afternoon_mistakes: 0,
};
export type DailyFields = typeof dailyDefaults;
export interface HifzLogMeta extends Partial<DailyFields> {
  hifz_version?: 1;
  entry_revision?: string;
  stage?: "QAIDA" | "NAZERA" | "HIFZ" | "DAWR";
  sabak_page_from?: number | null;
  sabak_page_to?: number | null;
  sabak_lines?: string;
  is_sabak_paused?: boolean;
  saboki_pages?: string;
  amukhta_amount?: string;
  mistake_count?: number;
}

/**
 * Standard Quran Para page counts for Qawmi / Hafezi Quran (Nurani / Emdadia print):
 * Para 1: 21 pages
 * Para 2-28: 20 pages
 * Para 29: 24 pages
 * Para 30: 25 pages
 * Total = 610 pages
 */
export const QAWMI_PARA_PAGES: Record<number, number> = {
  1: 21,
  29: 24,
  30: 25,
};

export function getTotalPagesInPara(paraNo?: number | null): number {
  if (!paraNo || paraNo < 1 || paraNo > 30) return 20;
  return QAWMI_PARA_PAGES[paraNo] || 20;
}

export function parseAmukhtaParaAmount(
  text?: string | null,
  paraNo?: number | null,
): number {
  if (!text || typeof text !== "string") return 0;

  const trimmed = text.trim();
  if (!trimmed) return 0;

  // Convert Bangla digits (০-৯) to English digits (0-9)
  const banglaDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  let converted = trimmed;
  banglaDigits.forEach((bDigit, idx) => {
    converted = converted.replace(new RegExp(bDigit, "g"), idx.toString());
  });

  const lower = converted.toLowerCase();
  const isPage =
    lower.includes("পৃষ্ঠা") || lower.includes("page") || lower.includes("পৃ");

  let amount = 0;

  if (lower.includes("দেড়") || lower.includes("দের") || lower.includes("1.5")) {
    amount = 1.5;
  } else if (
    lower.includes("আধা") ||
    lower.includes("অর্ধ") ||
    lower.includes("1/2") ||
    lower.includes("0.5") ||
    lower.includes("অর্ধেক")
  ) {
    amount = 0.5;
  } else if (
    lower.includes("সোয়া") ||
    lower.includes("1.25") ||
    lower.includes("1 1/4")
  ) {
    amount = 1.25;
  } else if (
    lower.includes("পৌনে") ||
    lower.includes("0.75") ||
    lower.includes("3/4")
  ) {
    amount = 0.75;
  } else if (lower.includes("আড়াই") || lower.includes("2.5")) {
    amount = 2.5;
  } else {
    // Try fraction match e.g. 1/2 or 3/4
    const fractionMatch = lower.match(/(\d+)\s*\/\s*(\d+)/);
    if (fractionMatch) {
      const num = parseFloat(fractionMatch[1]);
      const den = parseFloat(fractionMatch[2]);
      if (den !== 0) amount = num / den;
    } else {
      // Extract numeric float/int
      const numberMatch = lower.match(/(\d+(?:\.\d+)?)/);
      if (numberMatch) {
        amount = parseFloat(numberMatch[1]);
      } else if (lower.includes("এক")) amount = 1;
      else if (lower.includes("দুই")) amount = 2;
      else if (lower.includes("তিন")) amount = 3;
      else if (lower.includes("চার")) amount = 4;
      else if (lower.includes("পাঁচ")) amount = 5;
    }
  }

  if (isNaN(amount) || amount < 0) return 0;

  // If page/পৃষ্ঠা specified, convert pages to paras using getTotalPagesInPara
  if (isPage) {
    const totalPages = getTotalPagesInPara(paraNo);
    return amount / totalPages;
  }

  return amount;
}

export function parseHifzLogNotes(rawNotes?: string | null): {
  cleanNotes: string;
  tilawatText: string;
  meta: HifzLogMeta;
} {
  if (!rawNotes) {
    return { cleanNotes: "", tilawatText: "", meta: {} };
  }

  let meta: HifzLogMeta = {};
  let tilawatText = "";
  let clean = rawNotes;

  // JSON strings and arrays can themselves contain `]`. Consume complete JSON
  // objects, not just the first closing bracket. Also accept the original bare JSON format.
  const tag = /\[HIFZ_META:/gi;
  let match: RegExpExecArray | null;
  while ((match = tag.exec(clean))) {
    const start = tag.lastIndex;
    let end = start,
      depth = 0,
      quoted = false,
      escaped = false;
    for (; end < clean.length; end++) {
      const ch = clean[end];
      if (quoted) {
        if (escaped) escaped = false;
        else if (ch === "\\") escaped = true;
        else if (ch === '"') quoted = false;
      } else if (ch === '"') quoted = true;
      else if (ch === "{") depth++;
      else if (ch === "}") depth--;
      else if (ch === "]" && depth <= 0) break;
    }
    try {
      const value = JSON.parse(clean.slice(start, end));
      if (value && typeof value === "object" && !Array.isArray(value))
        meta = value;
    } catch {
      /* malformed legacy tag, retain user text */
    }
    clean = clean.slice(0, match.index) + clean.slice(end + 1);
    tag.lastIndex = match.index;
  }
  if (clean.trim().startsWith("{") && clean.trim().endsWith("}"))
    try {
      const v = JSON.parse(clean.trim());
      if (v && typeof v === "object" && !Array.isArray(v)) {
        meta = v;
        clean = "";
      }
    } catch {
      /* ordinary note */
    }
  clean = clean.replace(/\[HIFZ_META/gi, "");
  // 3. Extract tilawat if present
  const tilawatMatch = clean.match(
    /(?:\[?তেলাওয়াত:\s*([^\]|\n]+)\]?|তেলাওয়াত:\s*([^|\n]+))/i,
  );
  if (tilawatMatch) {
    tilawatText = (tilawatMatch[1] || tilawatMatch[2] || "").trim();
  }

  // 4. Remove tilawat text from clean notes
  clean = clean.replace(
    /(?:\[?তেলাওয়াত:\s*[^\]|\n]+\]?|তেলাওয়াত:\s*[^|\n]+)/gi,
    "",
  );

  // 5. Clean up remaining separators like " | " or leading/trailing pipes
  clean = clean
    .replace(/^\s*\|\s*/, "")
    .replace(/\s*\|\s*$/, "")
    .replace(/\s*\|\s*/g, " ")
    .trim();

  return {
    cleanNotes: clean,
    tilawatText,
    meta,
  };
}

export function buildHifzLogNotes(params: {
  rawNotes?: string;
  dailyTilawat?: string;
  meta: HifzLogMeta;
}): string {
  // Strip existing meta tag and tilawat text from rawNotes to prevent duplicate tags on edit
  const cleanUserNotes = parseHifzLogNotes(params.rawNotes).cleanNotes;

  const metaTag = `[HIFZ_META:${JSON.stringify(params.meta)}]`;

  let parts: string[] = [];
  if (params.dailyTilawat && params.dailyTilawat.trim()) {
    parts.push(`তেলাওয়াত: ${params.dailyTilawat.trim()}`);
  }
  if (cleanUserNotes) {
    parts.push(cleanUserNotes);
  }

  const notesText = parts.join(" | ");
  return notesText ? `${notesText} ${metaTag}` : metaTag;
}

export function calculateHifzPages(
  startPage?: number | string | null,
  endPage?: number | string | null,
): number {
  if (startPage === undefined || startPage === null || startPage === "")
    return 0;
  if (endPage === undefined || endPage === null || endPage === "") return 1;
  const start = Number(startPage);
  const end = Number(endPage);
  if (isNaN(start) || isNaN(end)) return 1;
  return Math.abs(end - start) + 1;
}

export function getHifzLogPagesCount(
  startPage?: number | string | null,
  endPage?: number | string | null,
): number {
  return calculateHifzPages(startPage, endPage);
}

/**
 * Pure calculation function to compile a student's Hifz report from preloaded logs
 */
export function buildStudentHifzReportFromLogs(params: {
  student: any;
  allStudentLogs: any[];
  studentProfile: any;
  targetMonth?: string;
  targetYear?: string;
}) {
  const { student, allStudentLogs, studentProfile, targetMonth, targetYear } =
    params;

  const monthStr = targetMonth || new Date().toISOString().slice(5, 7);
  const yearStr = targetYear || String(getDhakaYear());

  const startDate = `${yearStr}-${monthStr.padStart(2, "0")}-01`;
  const endDate = new Date(Date.UTC(parseInt(yearStr), parseInt(monthStr), 0))
    .toISOString()
    .split("T")[0];

  // Map raw logs into parsed logs
  const parsedAllLogs = (allStudentLogs || []).map((log: any) => {
    const parsed = parseHifzLogNotes(log.notes);
    const upgraded = dailyFields(log, parsed.meta);
    return {
      ...log,
      clean_notes: parsed.cleanNotes,
      daily_tilawat: parsed.tilawatText,
      meta: parsed.meta,
      hifz_stage: parsed.meta.stage || "HIFZ",
      sabak_page_from: parsed.meta.sabak_page_from ?? log.sabak_page,
      sabak_page_to: parsed.meta.sabak_page_to ?? log.sabak_page,
      sabak_lines: parsed.meta.sabak_lines || "",
      is_sabak_paused: Boolean(parsed.meta.is_sabak_paused),
      saboki_pages: parsed.meta.saboki_pages || "",
      amukhta_amount: parsed.meta.amukhta_amount || "",
      mistake_count:
        upgraded.student_category === "khatmi"
          ? upgraded.morning_mistakes + upgraded.afternoon_mistakes
          : upgraded.sabak_mistakes +
            upgraded.sat_sabak_mistakes +
            upgraded.amukhta_mistakes,
    };
  });

  // Filter logs for the selected month
  const monthlyLogs = parsedAllLogs.filter(
    (log) =>
      log.log_date && log.log_date >= startDate && log.log_date <= endDate,
  );

  // 1. All-time progress tracking across all logs (outside monthly filter)
  const highestPageMap: Record<number, number> = {};
  const amukhtaSet = new Set<number>();
  const completedParaSet = new Set<number>();

  if (Array.isArray(studentProfile?.completed_hifz_paras)) {
    studentProfile.completed_hifz_paras.forEach((p: number) =>
      completedParaSet.add(Number(p)),
    );
  }

  for (const p of studentProfile?.previously_memorized_paras || [])
    completedParaSet.add(p);
  parsedAllLogs.forEach((log) => {
    const sabakPara = log.sabak_para ? Number(log.sabak_para) : null;
    const pageTo = log.sabak_page_to
      ? Number(log.sabak_page_to)
      : log.sabak_page
        ? Number(log.sabak_page)
        : null;

    if (sabakPara && sabakPara >= 1 && sabakPara <= 30) {
      if (pageTo) {
        highestPageMap[sabakPara] = Math.max(
          highestPageMap[sabakPara] || 0,
          pageTo,
        );
      }
    }

    const amukhtaPara = log.amukhta_para ? Number(log.amukhta_para) : null;
    if (amukhtaPara && amukhtaPara >= 1 && amukhtaPara <= 30) {
      amukhtaSet.add(amukhtaPara);
    }
  });

  // Build 30-para grid with COMPLETED vs RUNNING vs PENDING
  const paraGrid = Array.from({ length: 30 }, (_, i) => {
    const paraNo = i + 1;
    const maxPages = getTotalPagesInPara(paraNo);
    const highestPage = highestPageMap[paraNo] || 0;

    let status: "COMPLETED" | "RUNNING" | "PENDING" = "PENDING";
    let currentPage = 0;

    if (
      completedParaSet.has(paraNo) ||
      amukhtaSet.has(paraNo) ||
      highestPage >= maxPages
    ) {
      status = "COMPLETED";
      currentPage = maxPages;
    } else if (highestPage > 0) {
      status = "RUNNING";
      currentPage = Math.min(highestPage, maxPages);
    } else {
      status = "PENDING";
      currentPage = 0;
    }

    return {
      para: paraNo,
      status,
      current_page: currentPage,
      total_pages: maxPages,
      label: `পারা ${paraNo}`,
      progress_text:
        status === "COMPLETED"
          ? `${maxPages}/${maxPages} পৃষ্ঠা (সম্পূর্ণ)`
          : status === "RUNNING"
            ? `${currentPage}/${maxPages} পৃষ্ঠা (চলমান)`
            : `০/${maxPages} পৃষ্ঠা`,
    };
  });

  const completedParasCount = paraGrid.filter(
    (p) => p.status === "COMPLETED",
  ).length;
  const runningParasCount = paraGrid.filter(
    (p) => p.status === "RUNNING",
  ).length;
  const remainingParasCount = 30 - completedParasCount;
  const completionPercentage = Math.round((completedParasCount / 30) * 100);

  // 2. Monthly Stats Calculation
  const totalLogDays = monthlyLogs.length;
  let activeSabakDays = 0;
  let pausedSabakDays = 0;
  let totalPagesMemorized = 0;
  let totalAmukhtaParas = 0;
  let totalMistakes = 0;
  let ratingScores: number[] = [];

  const ratingMap: Record<string, number> = {
    Excellent: 5,
    Good: 4,
    Average: 3,
    Poor: 2,
    Needs_Attention: 1,
  };

  monthlyLogs.forEach((log) => {
    if (log.is_sabak_paused) {
      pausedSabakDays++;
    } else {
      if (log.sabak_para || log.sabak_page_from) {
        activeSabakDays++;
      }

      // ONLY calculate totalPagesMemorized if sabak was NOT paused
      if (log.sabak_page_from && log.sabak_page_to) {
        const pCount =
          Math.abs(Number(log.sabak_page_to) - Number(log.sabak_page_from)) + 1;
        totalPagesMemorized += pCount;
      } else if (log.sabak_page) {
        totalPagesMemorized += 1;
      }
    }

    // Amukhta parsing
    if (log.amukhta_amount) {
      totalAmukhtaParas += parseAmukhtaParaAmount(
        log.amukhta_amount,
        log.amukhta_para,
      );
    } else if (log.amukhta_para) {
      totalAmukhtaParas += 1;
    }

    if (log.mistake_count) {
      totalMistakes += Number(log.mistake_count);
    }

    if (log.performance_rating && ratingMap[log.performance_rating]) {
      ratingScores.push(ratingMap[log.performance_rating]);
    }
  });

  const avgScore =
    ratingScores.length > 0
      ? ratingScores.reduce((a, b) => a + b, 0) / ratingScores.length
      : 4;
  let qawmiGrade = "জায়্যিদ (ভালো)";
  let qawmiGradeShort = "Good";

  if (avgScore >= 4.5) {
    qawmiGrade = "মুমতাজ (অতি উত্তম)";
    qawmiGradeShort = "Excellent";
  } else if (avgScore >= 3.8) {
    qawmiGrade = "জায়্যিদ জিদ্দান (উত্তম)";
    qawmiGradeShort = "Very Good";
  } else if (avgScore >= 3.0) {
    qawmiGrade = "জায়্যিদ (ভালো)";
    qawmiGradeShort = "Good";
  } else if (avgScore >= 2.0) {
    qawmiGrade = "মুতাওয়াসসিত (মধ্যম)";
    qawmiGradeShort = "Average";
  } else {
    qawmiGrade = "তাকীদ (মনোযোগ প্রয়োজন)";
    qawmiGradeShort = "Poor";
  }

  const currentStage =
    studentProfile?.hifz_stage || parsedAllLogs[0]?.hifz_stage || "HIFZ";

  return {
    student: {
      id: student.id,
      name: `${student.first_name || ""} ${student.last_name || ""}`.trim(),
      roll_number: student.roll_number || "—",
      class_name:
        (student.classes as any)?.name || student.class_name || "হিফজ বিভাগ",
      hifz_stage: currentStage,
    },
    month: monthStr,
    year: yearStr,
    total_log_days: totalLogDays,
    active_sabak_days: activeSabakDays,
    paused_sabak_days: pausedSabakDays,
    total_pages_memorized: totalPagesMemorized,
    total_amukhta_paras: Number(totalAmukhtaParas.toFixed(1)),
    total_mistakes: totalMistakes,
    avg_mistakes:
      totalLogDays > 0 ? Number((totalMistakes / totalLogDays).toFixed(1)) : 0,
    completed_paras_count: completedParasCount,
    running_paras_count: runningParasCount,
    remaining_paras_count: remainingParasCount,
    completion_percentage: completionPercentage,
    para_grid: paraGrid,
    qawmi_grade: qawmiGrade,
    qawmi_grade_short: qawmiGradeShort,
    logs: monthlyLogs,
  };
}

export const paraNumbers = Array.from({ length: 30 }, (_, i) => i + 1);
export const modes = {
  one_to_one: "জোড়ায় শোনানো",
  group_to_group: "গ্রুপ বনাম গ্রুপ",
  one_to_many: "প্যানেল শ্রবণ",
} as const;
export type ListeningMode = keyof typeof modes;
export type ParaResult = {
  para: number;
  mistakes: number;
  status: "perfect" | "good" | "weak";
};
export type HifzProfile = {
  tracked?: boolean;
  student_id: string;
  madrasa_id: string;
  hifz_category: HifzCategory;
  previously_memorized_paras: number[];
  completed_hifz_paras?: number[];
  total_khatams_completed: number;
  current_khatam_paras_done: number[];
  current_khatam_para_pages?: Record<number, number>;
  para_revisions?: Record<
    number,
    {
      para: number;
      revised: boolean;
      revision_date?: string;
      mistakes?: number;
      rating?: "perfect" | "good" | "needs_repeat";
      notes?: string;
      updated_at?: string;
    }
  >;
  khatam_completion_dates: string[];
  default_sabina_partner_id: string | null;
  updated_at?: string;
};
export type WeeklySabina = {
  id: string;
  madrasa_id: string;
  student_id: string;
  sabina_date: string;
  listener_student_id: string | null;
  listener_name?: string;
  verified_by_teacher_id: string | null;
  assigned_para_from: number;
  assigned_para_to: number;
  para_breakdown: ParaResult[];
  total_paras_recited: number;
  total_mistakes: number;
  status: "assigned" | "completed";
  remarks: string;
};
export type Participants = {
  reciter_group_ids: string[];
  listener_group_ids: string[];
  teacher_listener_ids: string[];
  names?: Record<string, string>;
};
export type Sitting = {
  id: string;
  session_label: string;
  reciter_id: string;
  listener_ids: string[];
  listener_names?: string[];
  para_from: number;
  para_to: number;
  para_wise_mistakes: ParaResult[];
  total_mistakes: number;
  timestamp: string;
};
export type SpecialSabina = {
  id: string;
  madrasa_id: string;
  title: string;
  duration_days: number;
  start_date: string;
  end_date: string;
  status: "ongoing" | "completed";
  listening_mode: ListeningMode;
  participants: Participants;
  session_logs: Sitting[];
  revision: string;
  student_id?: string;
  group_label?: string;
  heard_sittings?: {
    session_label: string;
    timestamp: string;
    partner: string;
  }[];
};
export type HifzBundle = {
  hifz_logs: any[];
  hifz_profiles: HifzProfile[];
  hifz_weekly_sabina: WeeklySabina[];
  hifz_special_sabina: SpecialSabina[];
};
export type HifzSummary = {
  sabqi: number;
  khatmi: number;
  entries: number;
  rate: number;
  khatams: number;
  thursday: string;
  weekly: number;
  weekly_rate: number;
  weak: { para: number; count: number }[];
  events: { id: string; title: string }[];
};
export const emptyProfile = (
  student_id: string,
  madrasa_id: string,
): HifzProfile => ({
  student_id,
  madrasa_id,
  hifz_category: "sabqi",
  previously_memorized_paras: [],
  total_khatams_completed: 0,
  current_khatam_paras_done: [],
  khatam_completion_dates: [],
  default_sabina_partner_id: null,
});
export function mistakeStatus(n: number): ParaResult["status"] {
  return n === 0 ? "perfect" : n <= 2 ? "good" : "weak";
}
export const marksLabel = {
  perfect: "নির্ভুল",
  good: "উত্তম",
  weak: "দুর্বল · পুনরায় শোনাতে হবে",
};
export const rangeParas = (from: number, to: number) =>
  paraNumbers.filter((p) => p >= from && p <= to);
export function breakdown(
  from: number,
  to: number,
  counts: Record<number, number>,
): ParaResult[] {
  return rangeParas(from, to).map((para) => {
    const mistakes = counts[para] ?? 0;
    return { para, mistakes, status: mistakeStatus(mistakes) };
  });
}
export function dailyFields(
  log: any,
  meta: HifzLogMeta = parseHifzLogNotes(log?.notes).meta,
): DailyFields {
  const fields = { ...dailyDefaults };
  for (const k of Object.keys(fields) as (keyof DailyFields)[]) {
    const v = log?.[k] ?? meta[k];
    if (v != null) Object.assign(fields, { [k]: v });
  }
  if (
    !meta.hifz_version &&
    !fields.sabak_mistakes &&
    !fields.sat_sabak_mistakes &&
    !fields.amukhta_mistakes
  )
    fields.sabak_mistakes = meta.mistake_count ?? 0;
  return fields;
}
/** Daily rows are facts, not increments. Replaying, editing, backdating or deleting
 * a row recomputes the same chronological cycles as the database trigger. */
export function khatamCycles(logs: any[]) {
  const byDate = new Map<string, any>();
  for (const l of logs) byDate.set(l.log_date, l);
  const pending = new Set<number>(),
    dates: string[] = [];
  for (const date of [...byDate.keys()].sort()) {
    const r = dailyFields(byDate.get(date));
    if (r.student_category !== "khatmi") continue;
    for (const time of sessionTimes)
      if (r[`${time}_session_done`])
        for (const p of rangeParas(
          r[`${time}_para_from`] ?? 31,
          r[`${time}_para_to`] ?? 0,
        )) {
          pending.add(p);
          if (pending.size === 30) {
            dates.push(date);
            pending.clear();
          }
        }
  }
  return {
    total_khatams_completed: dates.length,
    current_khatam_paras_done: [...pending].sort((a, b) => a - b),
    khatam_completion_dates: dates,
  };
}
export function latestThursday(iso: string) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 3) % 7));
  return d.toISOString().slice(0, 10);
}
export function datePlus(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function memorizedParas(profile: HifzProfile, logs: any[]) {
  return buildStudentHifzReportFromLogs({
    student: { id: profile.student_id },
    studentProfile: profile,
    allStudentLogs: logs,
  })
    .para_grid.filter((p) => p.status === "COMPLETED")
    .map((p) => p.para);
}
export const participantIds = (p: Participants) => [
  ...p.reciter_group_ids,
  ...p.listener_group_ids,
];
export function personalEvent(e: SpecialSabina, child: string): SpecialSabina {
  const recites =
    e.participants.reciter_group_ids.includes(child) ||
    e.listening_mode === "one_to_one";
  const names = e.participants.names || {};
  return {
    id: e.id,
    madrasa_id: e.madrasa_id,
    title: e.title,
    duration_days: e.duration_days,
    start_date: e.start_date,
    end_date: e.end_date,
    status: e.status,
    listening_mode: e.listening_mode,
    revision: e.revision,
    student_id: child,
    group_label:
      e.listening_mode === "one_to_one"
        ? "সঙ্গী: " +
          participantIds(e.participants)
            .filter((id) => id !== child)
            .map((id) => names[id] || "শ্রোতা")
            .join(", ")
        : recites
          ? "পাঠকারী দল"
          : "শ্রোতা দল",
    // For a listening child show attendance/partner, not the other child's marks.
    heard_sittings: e.session_logs
      .filter((s) => s.listener_ids.includes(child))
      .map((s) => ({
        session_label: s.session_label,
        timestamp: s.timestamp,
        partner: names[s.reciter_id] || "পাঠকারী",
      })),
    participants: {
      reciter_group_ids: recites ? [child] : [],
      listener_group_ids: recites ? [] : [child],
      teacher_listener_ids: [],
    },
    session_logs: e.session_logs
      .filter((v) => v.reciter_id === child)
      .map((v) => ({
        ...v,
        listener_names: v.listener_ids.map((id) => names[id] || "শ্রোতা"),
        listener_ids: [],
      })),
  };
}
