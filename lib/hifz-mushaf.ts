import { toDhakaDateString } from "@/lib/date-utils";
import {
  dailyFields,
  getTotalPagesInPara,
  parseHifzLogNotes,
  type HifzProfile,
  type WeeklySabina,
} from "@/lib/hifz-utils";

/**
 * Standard Bangladesh Qawmi / Hafezi Mushaf (Nurani / Emdadia 610-page format):
 * - Para 1: 21 pages
 * - Para 2..28: 20 pages each (27 * 20 = 540 pages)
 * - Para 29: 24 pages
 * - Para 30: 25 pages
 * Total = 21 + 540 + 24 + 25 = 610 pages
 */
export const MUSHAF_TOTAL_PAGES = 610;

export type ParaRevisionRating = "perfect" | "good" | "needs_repeat";

export interface ParaRevisionRecord {
  para: number;
  revised: boolean;
  revision_date?: string;
  mistakes?: number;
  rating?: ParaRevisionRating;
  notes?: string;
  updated_at?: string;
}

export type HifzReportPeriod =
  | "this_week"
  | "this_month"
  | "last_month"
  | "this_year"
  | "last_year"
  | "all";

export interface MushafParaProgress {
  para: number;
  totalPages: number;
  mushafStartPage: number;
  mushafEndPage: number;
  completedPages: number;
  percent: number;
  isPreMemorized: boolean;
  isRunning: boolean;
  isCompleted: boolean;
  revisionPending: boolean;
  revision?: ParaRevisionRecord;
  latestSabinaStatus?: "perfect" | "good" | "weak";
  latestSabinaMistakes?: number;
}

export interface SabqiMushafSummary {
  runningPara: number | null;
  runningParaPagesDone: number;
  runningParaTotalPages: number;
  runningParaPercent: number;
  completedParasCount: number;
  totalPagesDone: number;
  overallPercent: number;
  pendingRevisionParas: number[];
  paras: MushafParaProgress[];
}

export interface KhatmiMushafSummary {
  totalKhatamsCompleted: number;
  currentCyclePagesDone: number;
  currentCyclePercent: number;
  completedParasInCycle: number[];
  partialParasInCycle: Array<{ para: number; pages: number; totalPages: number; percent: number }>;
  paras: MushafParaProgress[];
}

export interface PeriodHifzReport {
  period: HifzReportPeriod;
  periodLabel: string;
  startDate: string | null;
  endDate: string | null;
  logsCount: number;
  sabakPagesRead: number;
  sabakParasTouched: number[];
  sabakParasCompletedInPeriod: number[];
  amukhtaParasRecited: number[];
  amukhtaSessionsCount: number;
  khatmiPagesRecited: number;
  khatmiEquivalentParas: number;
  weeklySabinaCount: number;
  perfectParas: number[];
  weakParas: number[];
  totalMistakes: number;
  filteredLogs: any[];
  filteredWeeklySabinas: WeeklySabina[];
}

export const PERIOD_LABELS_BN: Record<HifzReportPeriod, string> = {
  this_week: "এই সপ্তাহ",
  this_month: "এই মাস",
  last_month: "গত মাস",
  this_year: "চলতি বছর",
  last_year: "বিগত বছর",
  all: "সর্বমোট",
};

/**
 * Returns the 1-indexed global Mushaf page range for a given Para (1..30).
 */
export function getParaPageIndexRange(para: number): {
  para: number;
  totalPages: number;
  mushafStartPage: number;
  mushafEndPage: number;
} {
  const safePara = Math.max(1, Math.min(30, Math.floor(para)));
  let start = 1;
  for (let p = 1; p < safePara; p++) {
    start += getTotalPagesInPara(p);
  }
  const totalPages = getTotalPagesInPara(safePara);
  return {
    para: safePara,
    totalPages,
    mushafStartPage: start,
    mushafEndPage: start + totalPages - 1,
  };
}

/**
 * Computes Sabqi Para-by-Para progress using Bangladesh Qawmi 610-page Mushaf rules:
 * - The latest logged sabak_para is automatically detected as the Running Para.
 * - Entering page N (e.g. 12) automatically marks pages 1..N completed.
 * - Reaching the last page of a Para (21 / 20 / 24 / 25) marks the Para completed
 *   and sets revisionPending = true until a ParaRevisionRecord with revised=true is saved.
 */
export function computeSabqiParaProgress(
  profile: HifzProfile | null | undefined,
  logs: any[],
  weeklySabinas: WeeklySabina[] = [],
  revisionsMap?: Record<number, ParaRevisionRecord>,
): SabqiMushafSummary {
  const preSet = new Set<number>(
    (profile?.previously_memorized_paras || []).filter((n) => n >= 1 && n <= 30),
  );
  const legacyCompletedSet = new Set<number>(
    (profile?.completed_hifz_paras || []).filter((n) => n >= 1 && n <= 30),
  );
  const revMap: Record<number, ParaRevisionRecord> = {
    ...(profile?.para_revisions || {}),
    ...(revisionsMap || {}),
  };

  // Latest Sabina status per Para
  const sabinaByPara = new Map<number, { status: "perfect" | "good" | "weak"; mistakes: number }>();
  const sortedSabinas = [...(weeklySabinas || [])].sort((a, b) =>
    String(a.sabina_date || "").localeCompare(String(b.sabina_date || "")),
  );
  for (const s of sortedSabinas) {
    for (const row of s.para_breakdown || []) {
      sabinaByPara.set(row.para, { status: row.status, mistakes: row.mistakes });
    }
  }

  // Sort logs newest first to detect Running Para
  const sortedLogs = [...(logs || [])].sort((a, b) =>
    String(b.log_date || "").localeCompare(String(a.log_date || "")),
  );

  let runningPara: number | null = null;
  const maxPageByPara = new Map<number, number>();

  for (const log of sortedLogs) {
    const df = dailyFields(log);
    if (df.student_category === "khatmi") continue;
    const para = Number(log.sabak_para);
    if (!Number.isInteger(para) || para < 1 || para > 30) continue;

    if (runningPara === null) {
      runningPara = para;
    }

    const { meta } = parseHifzLogNotes(log.notes);
    const totalInPara = getTotalPagesInPara(para);
    const rawPage = Number(meta.sabak_page_to ?? log.sabak_page ?? meta.sabak_page_from ?? 0);
    if (rawPage > 0) {
      const clamped = Math.min(totalInPara, Math.floor(rawPage));
      const prev = maxPageByPara.get(para) || 0;
      if (clamped > prev) maxPageByPara.set(para, clamped);
    }
  }

  const paras: MushafParaProgress[] = [];
  let completedParasCount = 0;
  let totalPagesDone = 0;
  const pendingRevisionParas: number[] = [];

  for (let p = 1; p <= 30; p++) {
    const range = getParaPageIndexRange(p);
    const isPreMemorized = preSet.has(p);
    const maxLoggedPage = maxPageByPara.get(p) || 0;
    const isCompleted =
      isPreMemorized || legacyCompletedSet.has(p) || maxLoggedPage >= range.totalPages;
    const completedPages = isCompleted ? range.totalPages : maxLoggedPage;
    const percent = Math.min(100, Math.round((completedPages / range.totalPages) * 100));
    const isRunning = runningPara === p && !isCompleted;
    const revision = revMap[p];
    const revisionPending = isCompleted && !isPreMemorized && !revision?.revised;

    if (isCompleted) completedParasCount += 1;
    if (revisionPending) pendingRevisionParas.push(p);
    totalPagesDone += completedPages;

    const sab = sabinaByPara.get(p);
    paras.push({
      para: p,
      totalPages: range.totalPages,
      mushafStartPage: range.mushafStartPage,
      mushafEndPage: range.mushafEndPage,
      completedPages,
      percent,
      isPreMemorized,
      isRunning,
      isCompleted,
      revisionPending,
      revision,
      latestSabinaStatus: sab?.status,
      latestSabinaMistakes: sab?.mistakes,
    });
  }

  const runningCell = runningPara ? paras[runningPara - 1] : null;

  return {
    runningPara,
    runningParaPagesDone: runningCell?.completedPages || 0,
    runningParaTotalPages: runningCell?.totalPages || 20,
    runningParaPercent: runningCell?.percent || 0,
    completedParasCount,
    totalPagesDone,
    overallPercent: Math.min(100, Math.round((totalPagesDone / MUSHAF_TOTAL_PAGES) * 1000) / 10),
    pendingRevisionParas,
    paras,
  };
}

/**
 * Computes Khatmi cumulative partial-Para page progress across sessions:
 * - If a student recites 10 pages of Para 5 today (50%) and 10 pages tomorrow (100%),
 *   Para 5 reaches 20/20 (100%).
 * - When all 30 Paras reach 100% (610/610 pages), totalKhatamsCompleted auto-increments
 *   and the active cycle resets cleanly.
 */
export function computeKhatmiProgress(
  profile: HifzProfile | null | undefined,
  logs: any[],
  weeklySabinas: WeeklySabina[] = [],
): KhatmiMushafSummary {
  const sabinaByPara = new Map<number, { status: "perfect" | "good" | "weak"; mistakes: number }>();
  const sortedSabinas = [...(weeklySabinas || [])].sort((a, b) =>
    String(a.sabina_date || "").localeCompare(String(b.sabina_date || "")),
  );
  for (const s of sortedSabinas) {
    for (const row of s.para_breakdown || []) {
      sabinaByPara.set(row.para, { status: row.status, mistakes: row.mistakes });
    }
  }

  // Chronological order (oldest -> newest) so Khatam cycles roll over accurately
  const chronological = [...(logs || [])].sort((a, b) =>
    String(a.log_date || "").localeCompare(String(b.log_date || "")),
  );

  let cyclePages: Record<number, number> = {};
  let totalKhatamsCompleted = 0;

  const addSessionPages = (fromRaw: any, toRaw: any, pagesRaw: any) => {
    const fromP = Number(fromRaw);
    if (!Number.isInteger(fromP) || fromP < 1 || fromP > 30) return;
    const toP = Number(toRaw) >= fromP && Number(toRaw) <= 30 ? Number(toRaw) : fromP;
    const explicitPages = Number(pagesRaw);

    if (fromP === toP && explicitPages > 0) {
      const cap = getTotalPagesInPara(fromP);
      cyclePages[fromP] = Math.min(cap, (cyclePages[fromP] || 0) + Math.floor(explicitPages));
    } else if (explicitPages > 0 && toP > fromP) {
      let remaining = Math.floor(explicitPages);
      for (let p = fromP; p <= toP && remaining > 0; p++) {
        const cap = getTotalPagesInPara(p);
        const already = cyclePages[p] || 0;
        const need = Math.max(0, cap - already);
        const take = Math.min(need, remaining);
        cyclePages[p] = already + take;
        remaining -= take;
      }
    } else {
      // Full Para range recited
      for (let p = fromP; p <= toP; p++) {
        cyclePages[p] = getTotalPagesInPara(p);
      }
    }

    // Check if all 30 Paras reached 100%
    let allComplete = true;
    for (let p = 1; p <= 30; p++) {
      if ((cyclePages[p] || 0) < getTotalPagesInPara(p)) {
        allComplete = false;
        break;
      }
    }
    if (allComplete) {
      totalKhatamsCompleted += 1;
      cyclePages = {};
    }
  };

  for (const log of chronological) {
    const df = dailyFields(log);
    if (df.student_category !== "khatmi") continue;
    if (df.morning_session_done) {
      addSessionPages(df.morning_para_from, df.morning_para_to, df.morning_pages);
    }
    if (df.afternoon_session_done) {
      addSessionPages(df.afternoon_para_from, df.afternoon_para_to, df.afternoon_pages);
    }
  }

  // Merge any persisted partial pages if logs were truncated
  if (profile?.current_khatam_para_pages) {
    for (const [k, v] of Object.entries(profile.current_khatam_para_pages)) {
      const p = Number(k);
      if (p >= 1 && p <= 30) {
        const cap = getTotalPagesInPara(p);
        cyclePages[p] = Math.min(cap, Math.max(cyclePages[p] || 0, Number(v) || 0));
      }
    }
  }

  const paras: MushafParaProgress[] = [];
  const completedParasInCycle: number[] = [];
  const partialParasInCycle: Array<{
    para: number;
    pages: number;
    totalPages: number;
    percent: number;
  }> = [];
  let currentCyclePagesDone = 0;

  for (let p = 1; p <= 30; p++) {
    const range = getParaPageIndexRange(p);
    const done = Math.min(range.totalPages, cyclePages[p] || 0);
    const percent = Math.min(100, Math.round((done / range.totalPages) * 100));
    const isCompleted = done >= range.totalPages;
    currentCyclePagesDone += done;

    if (isCompleted) completedParasInCycle.push(p);
    else if (done > 0) {
      partialParasInCycle.push({ para: p, pages: done, totalPages: range.totalPages, percent });
    }

    const sab = sabinaByPara.get(p);
    paras.push({
      para: p,
      totalPages: range.totalPages,
      mushafStartPage: range.mushafStartPage,
      mushafEndPage: range.mushafEndPage,
      completedPages: done,
      percent,
      isPreMemorized: false,
      isRunning: done > 0 && !isCompleted,
      isCompleted,
      revisionPending: false,
      latestSabinaStatus: sab?.status,
      latestSabinaMistakes: sab?.mistakes,
    });
  }

  return {
    totalKhatamsCompleted: Math.max(
      totalKhatamsCompleted,
      Number(profile?.total_khatams_completed) || 0,
    ),
    currentCyclePagesDone,
    currentCyclePercent:
      Math.min(100, Math.round((currentCyclePagesDone / MUSHAF_TOTAL_PAGES) * 1000) / 10),
    completedParasInCycle,
    partialParasInCycle,
    paras,
  };
}

/**
 * Resolves inclusive YYYY-MM-DD date boundaries for a given period relative to referenceDate.
 */
export function getPeriodDateRange(
  period: HifzReportPeriod,
  referenceDate = toDhakaDateString(),
): { startDate: string | null; endDate: string | null } {
  if (period === "all") return { startDate: null, endDate: null };

  const [yStr, mStr, dStr] = referenceDate.split("-");
  const year = Number(yStr) || new Date().getFullYear();
  const month = Number(mStr) || 1; // 1..12
  const day = Number(dStr) || 1;

  const pad = (n: number) => String(n).padStart(2, "0");
  const lastDayOfMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

  if (period === "this_week") {
    const dt = new Date(Date.UTC(year, month - 1, day));
    const startDt = new Date(dt.getTime() - 6 * 24 * 60 * 60 * 1000);
    return {
      startDate: `${startDt.getUTCFullYear()}-${pad(startDt.getUTCMonth() + 1)}-${pad(startDt.getUTCDate())}`,
      endDate: referenceDate,
    };
  }

  if (period === "this_month") {
    return {
      startDate: `${year}-${pad(month)}-01`,
      endDate: `${year}-${pad(month)}-${pad(lastDayOfMonth(year, month))}`,
    };
  }

  if (period === "last_month") {
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    return {
      startDate: `${prevYear}-${pad(prevMonth)}-01`,
      endDate: `${prevYear}-${pad(prevMonth)}-${pad(lastDayOfMonth(prevYear, prevMonth))}`,
    };
  }

  if (period === "this_year") {
    return {
      startDate: `${year}-01-01`,
      endDate: `${year}-12-31`,
    };
  }

  // last_year
  return {
    startDate: `${year - 1}-01-01`,
    endDate: `${year - 1}-12-31`,
  };
}

/**
 * Computes a live period-filtered Hifz report (Weekly, Monthly, Last Month, Current Year, Previous Year, All).
 */
export function computePeriodHifzReport(
  profile: HifzProfile | null | undefined,
  logs: any[],
  weeklySabinas: WeeklySabina[],
  period: HifzReportPeriod,
  referenceDate = toDhakaDateString(),
): PeriodHifzReport {
  const { startDate, endDate } = getPeriodDateRange(period, referenceDate);

  const inRange = (dateStr?: string | null) => {
    if (!dateStr) return false;
    const d = String(dateStr).slice(0, 10);
    if (startDate && d < startDate) return false;
    if (endDate && d > endDate) return false;
    return true;
  };

  const filteredLogs = (logs || []).filter((l) => inRange(l.log_date));
  const filteredWeeklySabinas = (weeklySabinas || []).filter((w) => inRange(w.sabina_date));

  const sabakParasTouchedSet = new Set<number>();
  const sabakParasCompletedSet = new Set<number>();
  const amukhtaParasSet = new Set<number>();
  let sabakPagesRead = 0;
  let amukhtaSessionsCount = 0;
  let khatmiPagesRecited = 0;
  let totalMistakes = 0;

  for (const log of filteredLogs) {
    const df = dailyFields(log);
    const { meta } = parseHifzLogNotes(log.notes);

    if (df.student_category === "khatmi") {
      if (df.morning_session_done) {
        const pFrom = Number(df.morning_para_from) || 0;
        const pTo = Number(df.morning_para_to) || pFrom;
        const explicitPages = Number(df.morning_pages) || 0;
        if (explicitPages > 0) {
          khatmiPagesRecited += explicitPages;
        } else if (pFrom >= 1 && pFrom <= 30) {
          for (let p = pFrom; p <= Math.min(30, pTo); p++) {
            khatmiPagesRecited += getTotalPagesInPara(p);
          }
        }
        totalMistakes += Number(df.morning_mistakes) || 0;
      }
      if (df.afternoon_session_done) {
        const pFrom = Number(df.afternoon_para_from) || 0;
        const pTo = Number(df.afternoon_para_to) || pFrom;
        const explicitPages = Number(df.afternoon_pages) || 0;
        if (explicitPages > 0) {
          khatmiPagesRecited += explicitPages;
        } else if (pFrom >= 1 && pFrom <= 30) {
          for (let p = pFrom; p <= Math.min(30, pTo); p++) {
            khatmiPagesRecited += getTotalPagesInPara(p);
          }
        }
        totalMistakes += Number(df.afternoon_mistakes) || 0;
      }
    } else {
      const sPara = Number(log.sabak_para);
      if (Number.isInteger(sPara) && sPara >= 1 && sPara <= 30) {
        sabakParasTouchedSet.add(sPara);
        const fromPg = Number(meta.sabak_page_from ?? log.sabak_page ?? 0);
        const toPg = Number(meta.sabak_page_to ?? log.sabak_page ?? fromPg);
        if (toPg > 0) {
          const pagesToday = fromPg > 0 && toPg >= fromPg ? toPg - fromPg + 1 : 1;
          sabakPagesRead += pagesToday;
          if (toPg >= getTotalPagesInPara(sPara)) {
            sabakParasCompletedSet.add(sPara);
          }
        }
      }

      const aPara = Number(log.amukhta_para);
      if (Number.isInteger(aPara) && aPara >= 1 && aPara <= 30) {
        amukhtaParasSet.add(aPara);
        amukhtaSessionsCount += 1;
      }

      totalMistakes +=
        (Number(df.sabak_mistakes) || 0) +
        (Number(df.sat_sabak_mistakes) || 0) +
        (Number(df.amukhta_mistakes) || 0);
    }
  }

  const perfectSet = new Set<number>();
  const weakSet = new Set<number>();
  for (const w of filteredWeeklySabinas) {
    totalMistakes += Number(w.total_mistakes) || 0;
    for (const item of w.para_breakdown || []) {
      if (item.status === "perfect") perfectSet.add(item.para);
      else if (item.status === "weak") weakSet.add(item.para);
    }
  }

  return {
    period,
    periodLabel: PERIOD_LABELS_BN[period],
    startDate,
    endDate,
    logsCount: filteredLogs.length,
    sabakPagesRead,
    sabakParasTouched: Array.from(sabakParasTouchedSet).sort((a, b) => a - b),
    sabakParasCompletedInPeriod: Array.from(sabakParasCompletedSet).sort((a, b) => a - b),
    amukhtaParasRecited: Array.from(amukhtaParasSet).sort((a, b) => a - b),
    amukhtaSessionsCount,
    khatmiPagesRecited,
    khatmiEquivalentParas: Math.round((khatmiPagesRecited / 20) * 100) / 100,
    weeklySabinaCount: filteredWeeklySabinas.length,
    perfectParas: Array.from(perfectSet).sort((a, b) => a - b),
    weakParas: Array.from(weakSet).sort((a, b) => a - b),
    totalMistakes,
    filteredLogs,
    filteredWeeklySabinas,
  };
}
