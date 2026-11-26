// Manual generation used e.g. “নভেম্বর (November) 2026”; cron uses YYYY-MM.
// Match the exact historical Gregorian format, never guess a Hijri conversion.
const months =
  "january february march april may june july august september october november december".split(
    " ",
  );
export function billPeriodKey(period: string) {
  const value = period.trim();
  if (/^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(value)) return value.slice(0,7);
  const match = /^(?:[^()]+\()?([A-Za-z]+)\)?\s+(\d{4})$/.exec(value);
  const n = match ? months.indexOf(match[1].toLowerCase()) + 1 : 0;
  return match && n ? `${match[2]}-${String(n).padStart(2, "0")}` : value;
}
