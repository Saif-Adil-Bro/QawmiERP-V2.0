/**
 * Centralized utilities for student calculations and formatting.
 */

/**
 * Generates an automatic 6-digit student ID starting with the last two digits of the Hijri year.
 * e.g., Hijri year 1448 -> 480001, 480002 etc.
 * 
 * @param student The student object
 * @param allStudents List of all students in the same madrasa, sorted by created_at ascending
 */
export function getStudentIdNumber(student: any, allStudents: any[]): string {
  if (!student) return "480000";

  // Use student's custom created_at if exists, otherwise fallback to current date
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

  // If no students array is provided, or the current student is not found, fallback to sequential 1
  if (!allStudents || allStudents.length === 0) {
    return `${firstTwoDigits}0001`;
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
  const sequenceNum = index !== -1 ? index + 1 : sameYearStudents.length + 1;
  const sequenceStr = String(sequenceNum).padStart(4, '0'); // Pad with leading zeros to make 4 digits

  return `${firstTwoDigits}${sequenceStr}`;
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
