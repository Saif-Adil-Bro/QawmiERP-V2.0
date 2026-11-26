// Manual generation used e.g. “নভেম্বর (November) 2026” or “ডিসেম্বর ২০২৬”; cron uses YYYY-MM.
// Match Gregorian month names in English (full/3-letter) or Bengali; never guess a Hijri conversion.
const MONTH_ALIASES: Record<string, number> = {
  jan: 1, january: 1, "জানুয়ারি": 1, "জানুয়ারি": 1, "জানুয়ারী": 1, "জানুয়ারী": 1,
  feb: 2, february: 2, "ফেব্রুয়ারি": 2, "ফেব্রুয়ারি": 2, "ফেব্রুয়ারী": 2, "ফেব্রুয়ারী": 2,
  mar: 3, march: 3, "মার্চ": 3,
  apr: 4, april: 4, "এপ্রিল": 4,
  may: 5, "মে": 5,
  jun: 6, june: 6, "জুন": 6,
  jul: 7, july: 7, "জুলাই": 7,
  aug: 8, august: 8, "আগস্ট": 8, "অগাস্ট": 8,
  sep: 9, sept: 9, september: 9, "সেপ্টেম্বর": 9,
  oct: 10, october: 10, "অক্টোবর": 10,
  nov: 11, november: 11, "নভেম্বর": 11,
  dec: 12, december: 12, "ডিসেম্বর": 12,
};

function bnToEnDigits(str: string): string {
  return str.replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d)));
}

export function billPeriodKey(period: string) {
  const value = bnToEnDigits(String(period || "").trim());
  if (!value) return "";
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return value;
  if (/^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(value)) return value.slice(0, 7);

  // Formats like "ডিসেম্বর (December) 2026", "December 2026", "Dec 2026", "ডিসেম্বর 2026"
  const parensOrEng = /^(?:[^()]+\()?([A-Za-z]+)\)?\s+(\d{4})$/.exec(value);
  if (parensOrEng) {
    const n = MONTH_ALIASES[parensOrEng[1].toLowerCase()];
    if (n) return `${parensOrEng[2]}-${String(n).padStart(2, "0")}`;
  }

  const bnMatch = /^([^\s()]+)\s+(\d{4})$/.exec(value);
  if (bnMatch) {
    const n = MONTH_ALIASES[bnMatch[1].toLowerCase()] || MONTH_ALIASES[bnMatch[1]];
    if (n) return `${bnMatch[2]}-${String(n).padStart(2, "0")}`;
  }

  return value;
}
