/**
 * তারিখের ইউটিলিটি — সব "আজকের তারিখ" হিসাব **এশিয়া/ঢাকা** টাইমজোনে।
 *
 * ⛔ কেন দরকার?
 * JavaScript-এর `Date#toISOString()` সর্বদা UTC-তে রূপান্তর করে। বাংলাদেশ UTC+৬,
 * তাই ঢাকার রাত ১২টা থেকে ভোর ৬টার মধ্যে `new Date().toISOString().split("T")[0]`
 * আগের দিনের তারিখ দেয়। ফলে:
 *   • ভোরে নেওয়া হাজিরা আগের দিনের রেকর্ড হিসেবে সেভ হতো (ওভাররাইট ঝুঁকি),
 *   • হিফজ/কিতাব লগ, ফি-রসিদ, খরচ ভাউচার, ব্যাকআপ ফাইলের নাম — সব এক দিন পিছিয়ে যেত,
 *   • মাসের ১ তারিখ ভোরে "চলতি মাস" ধরা হতো আগের মাস।
 *
 * এই ফাইলটি isomorphic — সার্ভার (server action / route handler) এবং ব্রাউজার
 * দুটোতেই নিরাপদে ব্যবহার করা যায় (`Intl.DateTimeFormat` দুটোতেই আছে)।
 */

export const DHAKA_TIME_ZONE = "Asia/Dhaka";

/** ঢাকা টাইমজোনে YYYY-MM-DD (ডিফল্ট: এখন) */
export function toDhakaDateString(date: Date = new Date()): string {
  const d = date instanceof Date ? date : new Date(date as any);
  if (isNaN(d.getTime())) return "";

  try {
    // en-CA লোকেলের fmt ইতিমধ্যেই YYYY-MM-DD দেয়
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: DHAKA_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  } catch {
    // ICU/Intl অনুপস্থিত হলে (বিরল) +৬ ঘণ্টা শিফট করে fallback
    return new Date(d.getTime() + 6 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }
}

/**
 * যেকোনো মান (ISO timestamp / date-only string / Date) থেকে ঢাকার তারিখ।
 *
 * • `"2026-10-17"` এর মতো date-only স্ট্রিং অপরিবর্তিত থাকে (কোনো টাইমজোন শিফট নয়)
 * • `"2026-10-17T19:30:00Z"` → ঢাকায় ১৮ অক্টোবর ২০২৬ → `"2026-10-18"`
 * • অবৈধ/খালি মান → `""`
 */
export function toDhakaDateStringFrom(
  value: string | number | Date | null | undefined
): string {
  if (value === null || value === undefined || value === "") return "";
  if (value instanceof Date) return toDhakaDateString(value);

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "";
    // ইতিমধ্যে date-only → টাইমজোন রূপান্তর দরকার নেই
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) return toDhakaDateString(parsed);
    return trimmed.slice(0, 10);
  }

  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? "" : toDhakaDateString(parsed);
}

/** ঢাকা টাইমজোনে YYYY-MM */
export function toDhakaMonthString(date: Date = new Date()): string {
  const full = toDhakaDateString(date);
  return full ? full.slice(0, 7) : "";
}

/** ঢাকা টাইমজোনে বছর */
export function getDhakaYear(date: Date = new Date()): number {
  const full = toDhakaDateString(date);
  return full ? Number(full.slice(0, 4)) : new Date().getFullYear();
}

/** ঢাকা টাইমজোনে ঘড়ির সময়ের অংশ (ঘণ্টা/মিনিট/সেকেন্ড), 24-ঘণ্টা ফরম্যাট */
export function getDhakaTimeParts(date: Date = new Date()): {
  hours: number;
  minutes: number;
  seconds: number;
} {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: DHAKA_TIME_ZONE,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);

    const pick = (type: string) =>
      Number(parts.find((p) => p.type === type)?.value || 0);

    return {
      hours: pick("hour") % 24,
      minutes: pick("minute"),
      seconds: pick("second"),
    };
  } catch {
    return {
      hours: (date.getUTCHours() + 6) % 24,
      minutes: date.getUTCMinutes(),
      seconds: date.getUTCSeconds(),
    };
  }
}

/** ঢাকার আজকের দিনের শুরু (UTC Date অবজেক্ট — DB তুলনার জন্য) */
export function startOfDhakaDay(date: Date = new Date()): Date {
  const dateStr = toDhakaDateString(date);
  // বাংলাদেশের অফসেট সবসময় +৬:০০ (ডিএসটি নেই)
  return new Date(`${dateStr}T00:00:00+06:00`);
}
