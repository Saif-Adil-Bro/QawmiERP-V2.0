export interface HifzLogMeta {
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
export const QAWMI_PARA_PAGES: Record<number, number> = { 1: 21, 29: 24, 30: 25 };

export function getTotalPagesInPara(paraNo?: number | null): number {
  if (!paraNo || paraNo < 1 || paraNo > 30) return 20;
  return QAWMI_PARA_PAGES[paraNo] || 20;
}

export function parseAmukhtaParaAmount(text?: string | null, paraNo?: number | null): number {
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
  const isPage = lower.includes("পৃষ্ঠা") || lower.includes("page") || lower.includes("পৃ");

  let amount = 0;

  if (lower.includes("দেড়") || lower.includes("দের") || lower.includes("1.5")) {
    amount = 1.5;
  } else if (lower.includes("আধা") || lower.includes("অর্ধ") || lower.includes("1/2") || lower.includes("0.5") || lower.includes("অর্ধেক")) {
    amount = 0.5;
  } else if (lower.includes("সোয়া") || lower.includes("1.25") || lower.includes("1 1/4")) {
    amount = 1.25;
  } else if (lower.includes("পৌনে") || lower.includes("0.75") || lower.includes("3/4")) {
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

  // Extract JSON meta tag if present
  const metaMatch = clean.match(/\[HIFZ_META:([^\]]+)\]/);
  if (metaMatch && metaMatch[1]) {
    try {
      meta = JSON.parse(metaMatch[1]);
    } catch (e) {
      console.warn("Failed to parse HIFZ_META:", e);
    }
    clean = clean.replace(/\[HIFZ_META:[^\]]+\]\s*/g, "");
  }

  // Extract tilawat if present
  const tilawatMatch = clean.match(/(?:\[?তেলাওয়াত:\s*([^\]|\n]+)\]?|তেলাওয়াত:\s*([^|\n]+))/i);
  if (tilawatMatch) {
    tilawatText = (tilawatMatch[1] || tilawatMatch[2] || "").trim();
  }

  return {
    cleanNotes: clean.trim(),
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
  let cleanUserNotes = (params.rawNotes || "")
    .replace(/\[HIFZ_META:[^\]]*\]/g, "")
    .replace(/(?:\[?তেলাওয়াত:\s*[^\]|\n]+\]?|তেলাওয়াত:\s*[^|\n]+)\s*\|?\s*/gi, "")
    .trim();

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

export function calculateHifzPages(startPage?: number | string | null, endPage?: number | string | null): number {
  if (startPage === undefined || startPage === null || startPage === "") return 0;
  if (endPage === undefined || endPage === null || endPage === "") return 1;
  const start = Number(startPage);
  const end = Number(endPage);
  if (isNaN(start) || isNaN(end)) return 1;
  return Math.abs(end - start) + 1;
}

export function getHifzLogPagesCount(startPage?: number | string | null, endPage?: number | string | null): number {
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
  const { student, allStudentLogs, studentProfile, targetMonth, targetYear } = params;

  const monthStr = targetMonth || new Date().toISOString().slice(5, 7);
  const yearStr = targetYear || new Date().getFullYear().toString();

  const startDate = `${yearStr}-${monthStr.padStart(2, "0")}-01`;
  const endDate = new Date(Date.UTC(parseInt(yearStr), parseInt(monthStr), 0)).toISOString().split("T")[0];

  // Map raw logs into parsed logs
  const parsedAllLogs = (allStudentLogs || []).map((log: any) => {
    const parsed = parseHifzLogNotes(log.notes);
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
      mistake_count: parsed.meta.mistake_count ?? 0,
    };
  });

  // Filter logs for the selected month
  const monthlyLogs = parsedAllLogs.filter(
    (log) => log.log_date && log.log_date >= startDate && log.log_date <= endDate
  );

  // 1. All-time progress tracking across all logs (outside monthly filter)
  const highestPageMap: Record<number, number> = {};
  const amukhtaSet = new Set<number>();
  const completedParaSet = new Set<number>();

  if (Array.isArray(studentProfile?.completed_hifz_paras)) {
    studentProfile.completed_hifz_paras.forEach((p: number) => completedParaSet.add(Number(p)));
  }

  parsedAllLogs.forEach((log) => {
    const sabakPara = log.sabak_para ? Number(log.sabak_para) : null;
    const pageTo = log.sabak_page_to ? Number(log.sabak_page_to) : (log.sabak_page ? Number(log.sabak_page) : null);

    if (sabakPara && sabakPara >= 1 && sabakPara <= 30) {
      if (pageTo) {
        highestPageMap[sabakPara] = Math.max(highestPageMap[sabakPara] || 0, pageTo);
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

  const completedParasCount = paraGrid.filter((p) => p.status === "COMPLETED").length;
  const runningParasCount = paraGrid.filter((p) => p.status === "RUNNING").length;
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
        const pCount = Math.abs(Number(log.sabak_page_to) - Number(log.sabak_page_from)) + 1;
        totalPagesMemorized += pCount;
      } else if (log.sabak_page) {
        totalPagesMemorized += 1;
      }
    }

    // Amukhta parsing
    if (log.amukhta_amount) {
      totalAmukhtaParas += parseAmukhtaParaAmount(log.amukhta_amount, log.amukhta_para);
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

  const avgScore = ratingScores.length > 0 ? ratingScores.reduce((a, b) => a + b, 0) / ratingScores.length : 4;
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

  const currentStage = studentProfile?.hifz_stage || (parsedAllLogs[0]?.hifz_stage || "HIFZ");

  return {
    student: {
      id: student.id,
      name: `${student.first_name || ""} ${student.last_name || ""}`.trim(),
      roll_number: student.roll_number || "—",
      class_name: (student.classes as any)?.name || student.class_name || "হিফজ বিভাগ",
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
    avg_mistakes: totalLogDays > 0 ? Number((totalMistakes / totalLogDays).toFixed(1)) : 0,
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
