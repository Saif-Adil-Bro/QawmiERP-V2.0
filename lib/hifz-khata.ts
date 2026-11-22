import {
  dailyFields,
  datePlus,
  parseHifzLogNotes,
  type HifzProfile,
  type WeeklySabina,
} from "@/lib/hifz-utils";
import { computeSabqiParaProgress } from "@/lib/hifz-mushaf";
import { toBanglaNumber } from "@/lib/numberToBangla";

export const WEEK_ORDINALS_BN = ["১ম", "২য়", "৩য়", "৪র্থ", "৫ম"] as const;

export const KHATA_WEEKDAYS_BN = [
  "শনিবার",
  "রবিবার",
  "সোমবার",
  "মঙ্গলবার",
  "বুধবার",
  "বৃহস্পতিবার",
  "শুক্রবার",
] as const;

const JS_DAY_TO_BN = [
  "রবিবার", // 0 Sun
  "সোমবার", // 1 Mon
  "মঙ্গলবার", // 2 Tue
  "বুধবার", // 3 Wed
  "বৃহস্পতিবার", // 4 Thu
  "শুক্রবার", // 5 Fri
  "শনিবার", // 6 Sat
] as const;

export const BANGLA_ENGLISH_MONTHS = [
  "জানুয়ারি",
  "ফেব্রুয়ারি",
  "মার্চ",
  "এপ্রিল",
  "মে",
  "জুন",
  "জুলাই",
  "আগস্ট",
  "সেপ্টেম্বর",
  "অক্টোবর",
  "নভেম্বর",
  "ডিসেম্বর",
] as const;

export const GROUP1_TIERS = [5, 10, 15] as const;
export const GROUP2_TIERS = [20, 25, 30] as const;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function getMonthLabelBn(monthKey: string): { monthName: string; yearBn: string } {
  const [yStr, mStr] = (monthKey || "").split("-");
  const m = Math.max(1, Math.min(12, Number(mStr) || 1));
  const y = Number(yStr) || new Date().getFullYear();
  return {
    monthName: BANGLA_ENGLISH_MONTHS[m - 1] || "",
    yearBn: toBanglaNumber(y),
  };
}

/**
 * Returns the YYYY-MM-DD date of the Nth Thursday (weekNumber 1..5) in monthKey (YYYY-MM).
 * If a 5th Thursday doesn't exist in that month, returns the last day of the month.
 */
export function getWeekThursdayDate(monthKey: string, weekNumber: number): string {
  const [yStr, mStr] = (monthKey || "").split("-");
  const year = Number(yStr) || new Date().getFullYear();
  const month = Math.max(1, Math.min(12, Number(mStr) || 1));
  const safeWeek = Math.max(1, Math.min(5, Math.floor(weekNumber) || 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const thursdays: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(Date.UTC(year, month - 1, d));
    if (dt.getUTCDay() === 4) {
      thursdays.push(`${year}-${pad2(month)}-${pad2(d)}`);
    }
  }

  if (thursdays[safeWeek - 1]) return thursdays[safeWeek - 1];
  return `${year}-${pad2(month)}-${pad2(daysInMonth)}`;
}

/**
 * Infers week number (1..5) inside the date's month by counting Thursdays up to its week.
 */
export function inferWeekNumberFromDate(dateStr: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return 1;
  const day = Number(dateStr.slice(8, 10)) || 1;
  return Math.min(5, Math.max(1, Math.ceil(day / 7)));
}

export interface KhataDaySlot {
  date: string; // YYYY-MM-DD
  dayBn: string; // শনিবার..শুক্রবার
  ddmmBn: string; // DD/MM in Bangla digits
}

/**
 * Returns the 7-day Saturday -> Friday Khata week centered on the Thursday of (monthKey, weekNumber).
 */
export function getKhataWeekDays(monthKey: string, weekNumber: number): {
  thursdayDate: string;
  saturdayDate: string;
  fridayDate: string;
  days: KhataDaySlot[];
} {
  const thursdayDate = getWeekThursdayDate(monthKey, weekNumber);
  // Find the Saturday on or before thursdayDate (Sat=6 -> 5 days before Thu=4)
  const dt = new Date(thursdayDate + "T00:00:00Z");
  const dow = dt.getUTCDay(); // 0=Sun..6=Sat
  const offsetToSat = (dow + 1) % 7; // Sat->0, Sun->1, ..., Thu->5, Fri->6
  const saturdayDate = datePlus(thursdayDate, -offsetToSat);

  const days: KhataDaySlot[] = [];
  for (let i = 0; i < 7; i++) {
    const dStr = datePlus(saturdayDate, i);
    const dd = dStr.slice(8, 10);
    const mm = dStr.slice(5, 7);
    days.push({
      date: dStr,
      dayBn: KHATA_WEEKDAYS_BN[i],
      ddmmBn: `${toBanglaNumber(dd)}/${toBanglaNumber(mm)}`,
    });
  }

  return {
    thursdayDate,
    saturdayDate,
    fridayDate: days[6].date,
    days,
  };
}

/**
 * Returns all days (28..31) in monthKey (YYYY-MM) for Monthly Full A4 Khata Report.
 */
export function getKhataMonthDays(monthKey: string): KhataDaySlot[] {
  const [yStr, mStr] = (monthKey || "").split("-");
  const year = Number(yStr) || new Date().getFullYear();
  const month = Math.max(1, Math.min(12, Number(mStr) || 1));
  const totalDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const out: KhataDaySlot[] = [];

  for (let d = 1; d <= totalDays; d++) {
    const dt = new Date(Date.UTC(year, month - 1, d));
    const date = `${year}-${pad2(month)}-${pad2(d)}`;
    out.push({
      date,
      dayBn: JS_DAY_TO_BN[dt.getUTCDay()],
      ddmmBn: `${toBanglaNumber(pad2(d))}/${toBanglaNumber(pad2(month))}`,
    });
  }
  return out;
}

export interface KhataDailyRowData {
  sabakPara: string;
  sabakPage: string;
  satPara: string;
  satPage: string;
  satAmount: string;
  satMistakes: string;
  amukhtaPara: string;
  amukhtaPage: string;
  amukhtaAmount: string;
  amukhtaMistakes: string;
  hasLog: boolean;
}

/**
 * Maps a raw hifz_logs entry (either Sabqi or Khatmi) into the exact Khata table cells.
 */
export function mapLogToKhataRow(log: any | undefined | null): KhataDailyRowData {
  if (!log) {
    return {
      sabakPara: "",
      sabakPage: "",
      satPara: "",
      satPage: "",
      satAmount: "",
      satMistakes: "",
      amukhtaPara: "",
      amukhtaPage: "",
      amukhtaAmount: "",
      amukhtaMistakes: "",
      hasLog: false,
    };
  }

  const df = dailyFields(log);
  const { meta } = parseHifzLogNotes(log.notes);

  if (df.student_category === "khatmi") {
    const mFrom = df.morning_para_from;
    const mTo = df.morning_para_to;
    const aFrom = df.afternoon_para_from;
    const aTo = df.afternoon_para_to;

    const mRange =
      df.morning_session_done && mFrom
        ? mTo && mTo !== mFrom
          ? `${toBanglaNumber(mFrom)}–${toBanglaNumber(mTo)}`
          : toBanglaNumber(mFrom)
        : "";
    const aRange =
      df.afternoon_session_done && aFrom
        ? aTo && aTo !== aFrom
          ? `${toBanglaNumber(aFrom)}–${toBanglaNumber(aTo)}`
          : toBanglaNumber(aFrom)
        : "";

    return {
      sabakPara: "খতমী",
      sabakPage: "",
      satPara: mRange,
      satPage: df.morning_session_done && df.morning_pages ? toBanglaNumber(df.morning_pages) : "",
      satAmount: df.morning_session_done ? "সকাল" : "",
      satMistakes: df.morning_session_done ? toBanglaNumber(df.morning_mistakes || 0) : "",
      amukhtaPara: aRange,
      amukhtaPage: df.afternoon_session_done && df.afternoon_pages ? toBanglaNumber(df.afternoon_pages) : "",
      amukhtaAmount: df.afternoon_session_done ? "বিকেল" : "",
      amukhtaMistakes: df.afternoon_session_done ? toBanglaNumber(df.afternoon_mistakes || 0) : "",
      hasLog: true,
    };
  }

  const sabakPageText =
    meta.is_sabak_paused
      ? "বন্ধ"
      : meta.sabak_page_from && meta.sabak_page_to && meta.sabak_page_from !== meta.sabak_page_to
        ? `${toBanglaNumber(meta.sabak_page_from)}–${toBanglaNumber(meta.sabak_page_to)}`
        : meta.sabak_page_to || log.sabak_page
          ? toBanglaNumber(meta.sabak_page_to || log.sabak_page)
          : "";

  return {
    sabakPara: log.sabak_para ? toBanglaNumber(log.sabak_para) : "",
    sabakPage: sabakPageText,
    satPara: log.saboki_para ? toBanglaNumber(log.saboki_para) : "",
    satPage: "",
    satAmount: meta.saboki_pages ? toBanglaNumber(meta.saboki_pages) : "",
    satMistakes:
      log.saboki_para || meta.saboki_pages || df.sat_sabak_mistakes > 0
        ? toBanglaNumber(df.sat_sabak_mistakes || 0)
        : "",
    amukhtaPara: log.amukhta_para ? toBanglaNumber(log.amukhta_para) : "",
    amukhtaPage: "",
    amukhtaAmount: meta.amukhta_amount ? toBanglaNumber(meta.amukhta_amount) : "",
    amukhtaMistakes:
      log.amukhta_para || meta.amukhta_amount || df.amukhta_mistakes > 0
        ? toBanglaNumber(df.amukhta_mistakes || 0)
        : "",
    hasLog: true,
  };
}

/**
 * Resolves the WeeklySabina record for a student matching (monthKey, weekNumber),
 * checking explicit week_number/month_key first, then date range fallback.
 */
export function findWeeklySabinaForWeek(
  weeklySabinas: WeeklySabina[],
  studentId: string,
  monthKey: string,
  weekNumber: number,
): WeeklySabina | undefined {
  const { saturdayDate, fridayDate } = getKhataWeekDays(monthKey, weekNumber);
  const mine = (weeklySabinas || []).filter((w) => w.student_id === studentId);

  const explicit = mine.find(
    (w) =>
      (w.month_key || w.sabina_date.slice(0, 7)) === monthKey &&
      w.week_number === weekNumber,
  );
  if (explicit) return explicit;

  return mine.find(
    (w) => w.sabina_date >= saturdayDate && w.sabina_date <= fridayDate,
  );
}

/**
 * Determines the active Para milestone tier (5, 10, 15, 20, 25, 30) for the top Khata header bar.
 */
export function getActiveParaGroupTier(
  profile: HifzProfile | null | undefined,
  logs: any[],
): number | null {
  if (!profile) return null;
  if (profile.hifz_category === "khatmi") return 30;
  const summary = computeSabqiParaProgress(profile, logs);
  const completed = summary.completedParasCount;
  if (completed <= 0) return null;
  if (completed <= 5) return 5;
  if (completed <= 10) return 10;
  if (completed <= 15) return 15;
  if (completed <= 20) return 20;
  if (completed <= 25) return 25;
  return 30;
}

export function formatSabinaParaRangeBn(from?: number | null, to?: number | null): string {
  if (!from) return "";
  if (!to || from === to) return `${toBanglaNumber(from)} নং পারা`;
  return `${toBanglaNumber(from)} – ${toBanglaNumber(to)} পারা`;
}

export function formatSabinaBreakdownBn(sabina?: WeeklySabina | null): string {
  if (!sabina || !sabina.para_breakdown?.length) return "";
  return sabina.para_breakdown
    .map((r) => `${toBanglaNumber(r.para)}নং (${toBanglaNumber(r.mistakes)} ভুল)`)
    .join(", ");
}
