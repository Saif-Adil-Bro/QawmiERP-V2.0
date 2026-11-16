import { extractMadrasaPrefix, formatStudentIdWithPrefix } from "./madrasa-prefix";

/**
 * Centralized utilities for student calculations and formatting.
 * Single source of truth for student ID resolution across the entire system.
 */

export type IdYearFormat = "hijri" | "gregorian" | "auto";

let cachedClientMadrasaPrefix: string = "";
let cachedClientIdYearFormat: IdYearFormat = "hijri";

/**
 * Register or update the active madrasa prefix globally in memory & localStorage.
 */
export function setActiveMadrasaPrefix(prefix: string | null | undefined) {
  if (prefix && typeof prefix === "string") {
    const clean = prefix.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (clean) {
      cachedClientMadrasaPrefix = clean;
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("active_madrasa_prefix", clean);
        } catch {}
      }
    }
  }
}

/**
 * Retrieve the current active madrasa prefix.
 */
export function getActiveMadrasaPrefix(): string {
  if (cachedClientMadrasaPrefix) return cachedClientMadrasaPrefix;
  if (typeof window !== "undefined") {
    try {
      const stored =
        localStorage.getItem("active_madrasa_prefix") ||
        localStorage.getItem("pad_madrasa_prefix") ||
        localStorage.getItem("madrasa_prefix");
      if (stored) {
        cachedClientMadrasaPrefix = stored.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
        return cachedClientMadrasaPrefix;
      }
    } catch {}
  }
  return "";
}

/**
 * Register or update the active student ID year format ("hijri" | "gregorian" | "auto")
 */
export function setActiveIdYearFormat(format: IdYearFormat | string | null | undefined) {
  if (format && (format === "hijri" || format === "gregorian" || format === "auto")) {
    cachedClientIdYearFormat = format as IdYearFormat;
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("active_id_year_format", format);
      } catch {}
    }
  }
}

/**
 * Retrieve current active student ID year format
 */
export function getActiveIdYearFormat(): IdYearFormat {
  if (cachedClientIdYearFormat) return cachedClientIdYearFormat;
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem("active_id_year_format");
      if (stored === "hijri" || stored === "gregorian" || stored === "auto") {
        cachedClientIdYearFormat = stored as IdYearFormat;
        return cachedClientIdYearFormat;
      }
    } catch {}
  }
  return "hijri";
}

/**
 * Helper to identify UUIDs (32 hex characters with dashes, or 30+ char random hashes)
 */
export function isUuid(val: any): boolean {
  if (!val || typeof val !== "string") return false;
  const clean = val.trim();
  return (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean) ||
    clean.length >= 30
  );
}

/**
 * Resolves the student ID number prioritizing original/custom ID, admission number, or generated standard ID.
 * Always formats with the unified Madrasa prefix and hyphen (e.g. "AH-480001" or "AHH-260001").
 */
export function getStudentIdNumber(
  student: any,
  allStudents?: any[],
  madrasaPrefix?: string,
  options?: { idYearFormat?: IdYearFormat | string }
): string {
  if (!student) return "";

  const prefix = (
    madrasaPrefix ||
    student.madrasa_prefix ||
    student.prefix ||
    (student.madrasas ? extractMadrasaPrefix(student.madrasas) : "") ||
    (student.madrasa ? extractMadrasaPrefix(student.madrasa) : "") ||
    getActiveMadrasaPrefix() ||
    ""
  ).trim().toUpperCase();

  // Keep cache up to date if a prefix is found
  if (prefix && typeof window !== "undefined") {
    setActiveMadrasaPrefix(prefix);
  }

  // 1. If student has an explicit custom / original student ID or admission number
  const candidateIds = [
    student.student_id_code,
    student.student_code,
    student.admission_no,
    student.admission_number,
    student.student_id_number,
    student.student_id,
    student.custom_id,
    student.registration_no,
    student.reg_no,
    student.id_number,
  ];

  const explicitId = candidateIds.find(
    (id) => typeof id === "string" && id.trim() !== "" && !isUuid(id) && id.trim().length < 25
  );

  const normalizeExplicit = (raw: string): string => {
    const cleanId = raw.trim().toUpperCase();
    if (prefix) {
      if (cleanId.startsWith(`${prefix}-`)) return cleanId;
      if (cleanId.startsWith(prefix)) {
        const remainder = cleanId.slice(prefix.length).replace(/^-+/, "");
        return remainder ? `${prefix}-${remainder}` : cleanId;
      }
      return `${prefix}-${cleanId.replace(/^-+/, "")}`;
    }
    return cleanId;
  };

  // Check if explicitId is duplicated by an earlier student in allStudents
  let isExplicitIdDuplicated = false;
  if (explicitId && allStudents && allStudents.length > 0) {
    const normTarget = normalizeExplicit(explicitId);
    const sortedAll = [...allStudents].sort((a, b) => {
      const aTime = a?.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b?.created_at ? new Date(b.created_at).getTime() : 0;
      if (aTime !== bTime) return aTime - bTime;
      return String(a?.id || "").localeCompare(String(b?.id || ""));
    });
    for (const other of sortedAll) {
      if (other?.id === student.id) break;
      const otherCand = [
        other?.student_id_code,
        other?.student_code,
        other?.admission_no,
        other?.admission_number,
        other?.student_id_number,
        other?.student_id,
        other?.custom_id,
        other?.registration_no,
        other?.reg_no,
        other?.id_number,
      ].find((v) => typeof v === "string" && v.trim() !== "" && !isUuid(v) && v.trim().length < 25);
      if (otherCand && normalizeExplicit(otherCand) === normTarget) {
        isExplicitIdDuplicated = true;
        break;
      }
    }
  }

  if (explicitId && !isExplicitIdDuplicated) {
    return normalizeExplicit(explicitId);
  }

  // 2. Resolve Year Format (hijri vs gregorian vs auto)
  const resolvedFormat: IdYearFormat = (
    options?.idYearFormat ||
    student.id_year_format ||
    student.madrasa?.id_year_format ||
    student.madrasas?.id_year_format ||
    student.madrasa?.metadata?.id_year_format ||
    student.metadata?.id_year_format ||
    getActiveIdYearFormat() ||
    "hijri"
  ) as IdYearFormat;

  if (resolvedFormat && typeof window !== "undefined") {
    setActiveIdYearFormat(resolvedFormat);
  }

  // Use student's custom created_at if exists, otherwise fallback to current date
  const dateObj = student.created_at ? new Date(student.created_at) : new Date();
  const gregYear = dateObj.getFullYear(); // e.g. 2026

  // Calculate Hijri Year using Intl API (reliable and standard)
  let hijriYear = 1448;
  try {
    const formatter = new Intl.DateTimeFormat("en-US-u-ca-islamic", { year: "numeric" });
    const hijriYearStr = formatter.format(dateObj); // e.g. "1448 AH"
    hijriYear = parseInt(hijriYearStr.replace(/[^0-9]/g, ""), 10);
  } catch (e) {
    // Gregorian to Hijri approximation fallback: (Gregorian Year - 622) * 1.0307 + 1
    hijriYear = Math.floor((gregYear - 622) * 1.0307) + 1;
  }

  // Determine effective 2-digit year code
  let firstTwoDigits = String(hijriYear).slice(-2); // default e.g. "48"

  if (resolvedFormat === "gregorian") {
    firstTwoDigits = String(gregYear).slice(-2); // e.g. "26"
  } else if (resolvedFormat === "auto") {
    const sessionName = String(
      student.session?.name ||
      student.session_name ||
      student.academic_session ||
      student.classes?.session_name ||
      ""
    );
    const isExplicitEnglish =
      (sessionName.includes("202") || sessionName.includes("২০২")) &&
      !sessionName.includes("হিজরি") &&
      !sessionName.includes("144") &&
      !sessionName.includes("১৪৪");

    if (isExplicitEnglish) {
      firstTwoDigits = String(gregYear).slice(-2); // "26"
    } else {
      firstTwoDigits = String(hijriYear).slice(-2); // "48"
    }
  }

  // If no students array is provided, check if student has a roll number to construct a deterministic ID
  if (!allStudents || allStudents.length === 0) {
    if (student.roll_number) {
      const cleanRoll = String(student.roll_number).replace(/[^0-9]/g, "");
      if (cleanRoll) {
        const code = `${firstTwoDigits}${cleanRoll.padStart(4, "0")}`;
        return formatStudentIdWithPrefix(prefix, code);
      }
    }
    const code = `${firstTwoDigits}0001`;
    return formatStudentIdWithPrefix(prefix, code);
  }

  // Group and sort students of the same target year code (deterministic tie-breaker on id)
  const sameYearStudents = allStudents
    .filter((s) => {
      const sDate = s.created_at ? new Date(s.created_at) : new Date();
      if (resolvedFormat === "gregorian") {
        return sDate.getFullYear() === gregYear;
      }
      let sHijriYear = 1448;
      try {
        const formatter = new Intl.DateTimeFormat("en-US-u-ca-islamic", { year: "numeric" });
        const sHijriYearStr = formatter.format(sDate);
        sHijriYear = parseInt(sHijriYearStr.replace(/[^0-9]/g, ""), 10);
      } catch (e) {
        sHijriYear = Math.floor((sDate.getFullYear() - 622) * 1.0307) + 1;
      }
      return sHijriYear === hijriYear;
    })
    .sort((a, b) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
      if (aTime !== bTime) return aTime - bTime;
      return String(a.id || "").localeCompare(String(b.id || ""));
    });

  // Collect IDs already claimed by earlier students in sameYearStudents to guarantee zero collisions
  const claimedIds = new Set<string>();
  for (const s of sameYearStudents) {
    if (s.id === student.id) break;
    const sCand = [
      s.student_id_code,
      s.student_code,
      s.admission_no,
      s.admission_number,
      s.student_id_number,
      s.student_id,
      s.custom_id,
      s.registration_no,
      s.reg_no,
      s.id_number,
    ].find((v) => typeof v === "string" && v.trim() !== "" && !isUuid(v) && v.trim().length < 25);
    if (sCand) {
      claimedIds.add(normalizeExplicit(sCand));
    }
  }

  const index = sameYearStudents.findIndex((s) => s.id === student.id);
  let seq = index !== -1 ? index + 1 : sameYearStudents.length + 1;
  let formatted = formatStudentIdWithPrefix(prefix, `${firstTwoDigits}${String(seq).padStart(4, "0")}`);
  while (claimedIds.has(formatted.toUpperCase())) {
    seq += 1;
    formatted = formatStudentIdWithPrefix(prefix, `${firstTwoDigits}${String(seq).padStart(4, "0")}`);
  }

  return formatted;
}

/**
 * Generates a strictly unique sequential student ID on the server using a Set of already-used IDs.
 */
export function generateNextUniqueStudentId(
  allStudents: any[],
  targetStudent: any,
  madrasaPrefix: string,
  usedIds: Set<string>,
  options?: { idYearFormat?: IdYearFormat | string }
): string {
  const cleanStudent = {
    id: targetStudent?.id,
    created_at: targetStudent?.created_at || new Date().toISOString(),
  };
  const candidate = getStudentIdNumber(cleanStudent, allStudents, madrasaPrefix, options);
  const match = candidate.match(/^(.*?)(\d{2})(\d{4,})$/);
  if (!usedIds.has(candidate.toUpperCase())) {
    usedIds.add(candidate.toUpperCase());
    return candidate;
  }
  const yearPart = match ? match[2] : candidate.replace(/[^0-9]/g, "").slice(0, 2) || "48";
  let seq = match ? parseInt(match[3], 10) : 1;
  let nextId = formatStudentIdWithPrefix(madrasaPrefix, `${yearPart}${String(seq).padStart(4, "0")}`);
  while (usedIds.has(nextId.toUpperCase())) {
    seq += 1;
    nextId = formatStudentIdWithPrefix(madrasaPrefix, `${yearPart}${String(seq).padStart(4, "0")}`);
  }
  usedIds.add(nextId.toUpperCase());
  return nextId;
}

/**
 * Returns formatted student ID in English alphanumeric format (e.g., AHA480001 or AHA260001) as required globally
 */
export function resolveStudentIdBn(
  student: any,
  allStudents?: any[],
  madrasaPrefix?: string,
  options?: { idYearFormat?: IdYearFormat | string }
): string {
  return getStudentIdNumber(student, allStudents, madrasaPrefix, options);
}

/**
 * Converts any number or numeric string from English digits to Bengali digits.
 * e.g., 480001 -> ৪৮০০০১, 260001 -> ২৬০০০১
 */
export function convertToBanglaNumber(num: string | number | null | undefined): string {
  if (num === null || num === undefined) return "";
  const banglaDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return String(num).replace(/[0-9]/g, (digit) => banglaDigits[parseInt(digit, 10)]);
}

/**
 * Accurately sorts an array of student objects ascending by roll number (1, 2, 3 ... 10, 11).
 * Seamlessly handles Bengali digits (১, ২, ৩ ...), English digits (1, 2, 3 ...), and alphanumeric rolls.
 */
export function sortStudentsByRoll<T extends Record<string, any>>(list: T[]): T[] {
  if (!Array.isArray(list) || list.length <= 1) return list ? [...list] : [];

  return [...list].sort((a, b) => {
    const rawA = a?.roll_number ?? a?.roll ?? a?.subLabel ?? a?.student_roll ?? a?.assigned_permanent_roll ?? "";
    const rawB = b?.roll_number ?? b?.roll ?? b?.subLabel ?? b?.student_roll ?? b?.assigned_permanent_roll ?? "";

    const strA = String(rawA).trim();
    const strB = String(rawB).trim();

    // Convert Bengali digits to standard integer
    const numA = parseInt(
      strA.replace(/[০-৯]/g, (d) => "০১২৩৪৫৬৭৮৯".indexOf(d).toString()).replace(/[^0-9]/g, ""),
      10
    );
    const numB = parseInt(
      strB.replace(/[০-৯]/g, (d) => "০১২৩৪৫৬৭৮৯".indexOf(d).toString()).replace(/[^0-9]/g, ""),
      10
    );

    const hasNumA = !isNaN(numA) && numA > 0;
    const hasNumB = !isNaN(numB) && numB > 0;

    if (hasNumA && hasNumB) {
      return numA - numB;
    }
    if (hasNumA) return -1;
    if (hasNumB) return 1;

    return strA.localeCompare(strB, "bn");
  });
}
