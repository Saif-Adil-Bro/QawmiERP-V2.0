import { getDhakaYear } from "@/lib/date-utils";

export function expensePeriod(filters?: { month?: string; year?: string }): {
  start?: string;
  end?: string;
} {
  if (!filters?.month && !filters?.year) return {};
  const year = filters.year ? Number(filters.year) : getDhakaYear(),
    month = filters.month ? Number(filters.month) : null;
  if (
    !Number.isInteger(year) ||
    year < 1900 ||
    year > 2200 ||
    (month !== null && (!Number.isInteger(month) || month < 1 || month > 12))
  )
    throw new Error("মাস বা বছর সঠিক নয়।");
  if (month === null) return { start: `${year}-01-01`, end: `${year}-12-31` };
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  return {
    start: `${prefix}-01`,
    end: `${prefix}-${new Date(Date.UTC(year, month, 0)).getUTCDate()}`,
  };
}
