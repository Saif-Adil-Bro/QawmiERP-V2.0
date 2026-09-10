/**
 * Centralized utilities for student calculations and formatting.
 */

/**
 * Resolves the student ID number prioritizing original/custom ID, admission number, or generated standard ID.
 * Supports optional madrasa prefix formatting (e.g. "AHH480001" without hyphen).
 */
export function getStudentIdNumber(student: any, allStudents?: any[], madrasaPrefix?: string): string {
  if (!student) return "";

  const prefix = (madrasaPrefix || student.madrasa_prefix || student.prefix || "").trim().toUpperCase();

  // 1. If student has an explicit custom / original student ID or admission number
  const explicitId = student.student_id || student.admission_no || student.student_code || student.custom_id || student.registration_no;
  if (explicitId && typeof explicitId === "string" && explicitId.trim() !== "" && !explicitId.includes("-") && explicitId.length < 20) {
    const cleanId = explicitId.trim();
    if (prefix && !cleanId.toUpperCase().startsWith(prefix)) {
      return `${prefix}${cleanId}`;
    }
    return cleanId;
  }

  // 2. Use student's custom created_at if exists, otherwise fallback to current date
  const dateObj = student.created_at ? new Date(student.created_at) : new Date();

  // Calculate Hijri Year using Intl API (reliable and standard)
  let hijriYear = 1448;
  try {
    const formatter = new Intl.DateTimeFormat('en-US-u-ca-islamic', { year: 'numeric' });
    const hijriYearStr = formatter.format(dateObj); // e.g. "1448 AH"
    hijriYear = parseInt(hijriYearStr.replace(/[^0-9]/g, ''), 10);
  } catch (e) {
    // Gregorian to Hijri approximation fallback: (Gregorian Year - 622) * 1.0307 + 1
    const gregYear = dateObj.getFullYear();
    hijriYear = Math.floor((gregYear - 622) * 1.0307) + 1;
  }

  const firstTwoDigits = String(hijriYear).slice(-2); // e.g., "48"

  // If no students array is provided, check if student has a roll number to construct a deterministic ID
  if (!allStudents || allStudents.length === 0) {
    if (student.roll_number) {
      const cleanRoll = String(student.roll_number).replace(/[^0-9]/g, '');
      if (cleanRoll) {
        const code = `${firstTwoDigits}${cleanRoll.padStart(4, '0')}`;
        return prefix ? `${prefix}${code}` : code;
      }
    }
    const code = `${firstTwoDigits}0001`;
    return prefix ? `${prefix}${code}` : code;
  }

  // Group and sort students of the same Hijri year
  const sameYearStudents = allStudents
    .filter(s => {
      const sDate = s.created_at ? new Date(s.created_at) : new Date();
      let sHijriYear = 1448;
      try {
        const formatter = new Intl.DateTimeFormat('en-US-u-ca-islamic', { year: 'numeric' });
        const sHijriYearStr = formatter.format(sDate);
        sHijriYear = parseInt(sHijriYearStr.replace(/[^0-9]/g, ''), 10);
      } catch (e) {
        const gregYear = sDate.getFullYear();
        sHijriYear = Math.floor((gregYear - 622) * 1.0307) + 1;
      }
      return sHijriYear === hijriYear;
    })
    .sort((a, b) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
      return aTime - bTime;
    });

  // Find index of current student in the sorted list of same-year students
  const index = sameYearStudents.findIndex(s => s.id === student.id);
  const sequenceNum = index !== -1 ? index + 1 : (parseInt(student.roll_number, 10) || sameYearStudents.length + 1);
  const sequenceStr = String(sequenceNum).padStart(4, '0'); // Pad with leading zeros to make 4 digits
  const code = `${firstTwoDigits}${sequenceStr}`;

  return prefix ? `${prefix}${code}` : code;
}

/**
 * Returns formatted Bangla student ID
 */
export function resolveStudentIdBn(student: any, allStudents?: any[], madrasaPrefix?: string): string {
  const idStr = getStudentIdNumber(student, allStudents, madrasaPrefix);
  return convertToBanglaNumber(idStr);
}

/**
 * Converts any number or numeric string from English digits to Bengali digits.
 * e.g., 480001 -> ৪৮০০০১
 */
export function convertToBanglaNumber(num: string | number | null | undefined): string {
  if (num === null || num === undefined) return "";
  const banglaDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return String(num).replace(/[0-9]/g, (digit) => banglaDigits[parseInt(digit, 10)]);
}

