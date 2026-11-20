export type RoutineItemType = "SUBJECT" | "BREAK" | "CUSTOM" | "OFFDAY";

export interface ParsedRoutineItem {
  id: string;
  madrasa_id?: string;
  class_id: string;
  subject_id: string | null;
  teacher_id: string | null;
  day_of_week: string;
  start_time: string;
  end_time: string;
  room_number: string;
  routine_type: string;
  created_at?: string;
  // Parsed fields
  item_type: RoutineItemType;
  display_title: string;
  display_subtitle?: string;
  clean_room?: string;
  classes?: any;
  subjects?: any;
  teachers?: any;
}

export const DAY_KEYS = [
  "Saturday",
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
] as const;

export const DAY_TRANSLATIONS: Record<string, string> = {
  Saturday: "শনিবার",
  Sunday: "রবিবার",
  Monday: "সোমবার",
  Tuesday: "মঙ্গলবার",
  Wednesday: "বুধবার",
  Thursday: "বৃহস্পতিবার",
  Friday: "শুক্রবার",
  "শনিবার": "শনিবার",
  "রবিবার": "রবিবার",
  "সোমবার": "সোমবার",
  "মঙ্গলবার": "মঙ্গলবার",
  "বুধবার": "বুধবার",
  "বৃহস্পতিবার": "বৃহস্পতিবার",
  "শুক্রবার": "শুক্রবার",
};

export const COMMON_BREAKS = [
  { label: "নামাজের বিরতি", desc: "জোহর / আসর / মাগরিবের নামাজ" },
  { label: "সকালের নাস্তা ও টিফিন", desc: "সকালের নাশতা" },
  { label: "দুপুরের খাবার ও বিশ্রাম", desc: "মধ্যাহ্ন ভোজ" },
  { label: "রাতের খাবার", desc: "নৈশভোজ" },
  { label: "বিকেলের চা ও নাস্তা", desc: "হালকা নাস্তা" },
  { label: "সাধারণ বিরতি", desc: "১০-১৫ মিনিট বিরতি" },
];

export const COMMON_CUSTOM_ACTIVITIES = [
  { label: "খেলাধুলা ও শরীরচর্চা", desc: "মাঠ ও খেলাধুলা" },
  { label: "কায়লুলা (দুপুরের ঘুম)", desc: "দুপুরের সুন্নতি বিশ্রাম" },
  { label: "রাতের ঘুম (শয়ন)", desc: "রাতের বিশ্রাম" },
  { label: "ব্যক্তিগত মুতালাআ ও তাকরার", desc: "পাঠ প্রস্তুতি ও রিভিশন" },
  { label: "কুরআন তিলাওয়াত ও আমল", desc: "দৈনন্দিন আমল ও মাসনুন দোয়া" },
  { label: "হিফজ ইয়াদ / শুনানী", desc: "হিফজ রিভিশন ও সবকী" },
  { label: "বক্তৃতা ও তারবিয়্যাতী মজলিস", desc: "সাপ্তাহিক মজলিস" },
  { label: "হাতের লেখা ও ক্যালিগ্রাফি", desc: "সুন্দর হস্তাক্ষর চর্চা" },
  { label: "পরিচ্ছন্নতা ও খিদমত", desc: "কক্ষ ও মাদরাসা পরিচ্ছন্নতা" },
];

export function encodeRoutineMeta(
  itemType: RoutineItemType,
  customTitle?: string,
  roomNumber?: string
): string {
  const room = (roomNumber || "").trim();
  const title = (customTitle || "").trim();

  if (itemType === "BREAK") {
    return `BREAK:${title}${room ? `|${room}` : ""}`;
  }
  if (itemType === "CUSTOM") {
    return `CUSTOM:${title}${room ? `|${room}` : ""}`;
  }
  if (itemType === "OFFDAY") {
    return `OFFDAY:${title || "সাপ্তাহিক ছুটি"}`;
  }
  return room;
}

export function parseRoutineItem(r: any): ParsedRoutineItem {
  const rawRoom = String(r.room_number || "").trim();
  const rawType = String(r.routine_type || "Class");

  let item_type: RoutineItemType = "SUBJECT";
  let display_title = "";
  let clean_room = "";

  if (rawRoom.startsWith("BREAK:")) {
    item_type = "BREAK";
    const payload = rawRoom.substring(6);
    if (payload.includes("|")) {
      const parts = payload.split("|");
      display_title = parts[0];
      clean_room = parts.slice(1).join("|");
    } else {
      display_title = payload;
    }
  } else if (rawRoom.startsWith("CUSTOM:")) {
    item_type = "CUSTOM";
    const payload = rawRoom.substring(7);
    if (payload.includes("|")) {
      const parts = payload.split("|");
      display_title = parts[0];
      clean_room = parts.slice(1).join("|");
    } else {
      display_title = payload;
    }
  } else if (rawRoom.startsWith("OFFDAY:") || rawType === "OffDay") {
    item_type = "OFFDAY";
    display_title = rawRoom.startsWith("OFFDAY:") ? rawRoom.substring(7) : "সাপ্তাহিক ছুটি";
  } else {
    item_type = "SUBJECT";
    const subName = Array.isArray(r.subjects) ? r.subjects[0]?.name : r.subjects?.name;
    display_title = subName || r.subject_name || "বিষয় নির্ধারিত নয়";
    clean_room = rawRoom;
  }

  // Teacher name resolution
  let display_subtitle = "";
  const teacher = Array.isArray(r.teachers) ? r.teachers[0] : r.teachers;
  if (teacher) {
    display_subtitle = `${teacher.first_name || ""} ${teacher.last_name || ""}`.trim();
  }

  return {
    ...r,
    item_type,
    display_title: display_title || (item_type === "BREAK" ? "বিরতি" : "সাধারণ পিরিয়ড"),
    display_subtitle,
    clean_room,
  };
}

export function formatTimeString(timeStr?: string): string {
  if (!timeStr) return "";
  const trimmed = String(timeStr).trim();
  if (!trimmed) return "";

  // If already formatted with AM/PM, return directly
  if (/\b(AM|PM|am|pm)\b/i.test(trimmed)) {
    return trimmed;
  }

  const parts = trimmed.split(":");
  if (parts.length >= 2) {
    let hours = parseInt(parts[0], 10);
    const minutes = parts[1].slice(0, 2).padStart(2, "0");
    if (isNaN(hours)) return trimmed;

    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    if (hours === 0) hours = 12;
    const hoursStr = String(hours).padStart(2, "0");

    return `${hoursStr}:${minutes} ${ampm}`;
  }
  return trimmed;
}

export function timeStringToMinutes(timeStr?: string): number {
  if (!timeStr) return -1;
  const trimmed = String(timeStr).trim();
  if (!trimmed) return -1;

  // Handle 12-hour AM/PM format (e.g. "08:30 AM", "02:15 PM")
  const ampmMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10);
    const minutes = parseInt(ampmMatch[2], 10);
    const ampm = ampmMatch[3]?.toUpperCase();

    if (ampm === "PM" && hours < 12) hours += 12;
    if (ampm === "AM" && hours === 12) hours = 0;
    return hours * 60 + minutes;
  }

  // Handle 24-hour format (e.g. "08:30:00", "14:15")
  const parts = trimmed.split(":");
  if (parts.length >= 2) {
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    if (!isNaN(hours) && !isNaN(minutes)) {
      return hours * 60 + minutes;
    }
  }
  return -1;
}

export interface DhakaClockParts {
  dateStr: string;
  dayOfWeekIndex: number;
  englishDay: string;
  banglaDay: string;
  hours: number;
  minutes: number;
  totalMinutes: number;
}

const ENGLISH_DAYS_BY_JS_INDEX = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const BN_DIGIT_CHARS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
function toBnTimeDigits(val: string | number): string {
  return String(val).replace(/\d/g, (d) => BN_DIGIT_CHARS[Number(d)] ?? d);
}

/**
 * Format 24h or 12h time strings into natural Bengali time labels:
 * e.g. "08:30" -> "সকাল ০৮:৩০", "14:15" -> "দুপুর ০২:১৫"
 */
export function formatBanglaTime(timeStr?: string): string {
  const mins = timeStringToMinutes(timeStr);
  if (mins < 0) return formatTimeString(timeStr);

  const hour24 = Math.floor(mins / 60) % 24;
  const minute = mins % 60;
  let periodLabel = "রাত";
  if (hour24 >= 4 && hour24 < 6) periodLabel = "ভোর";
  else if (hour24 >= 6 && hour24 < 12) periodLabel = "সকাল";
  else if (hour24 >= 12 && hour24 < 15) periodLabel = "দুপুর";
  else if (hour24 >= 15 && hour24 < 18) periodLabel = "বিকাল";
  else if (hour24 >= 18 && hour24 < 20) periodLabel = "সন্ধ্যা";

  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const hStr = String(hour12).padStart(2, "0");
  const mStr = String(minute).padStart(2, "0");
  return `${periodLabel} ${toBnTimeDigits(hStr)}:${toBnTimeDigits(mStr)}`;
}

/**
 * Deterministically resolve current Asia/Dhaka date, day-of-week, and minutes-since-midnight.
 * Safe across UTC servers and client devices in any timezone.
 */
export function getDhakaClockParts(now: Date = new Date()): DhakaClockParts {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Dhaka",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    const parts = formatter.formatToParts(now);
    const getPart = (type: string) => parts.find((p) => p.type === type)?.value || "";
    const year = getPart("year");
    const month = getPart("month");
    const day = getPart("day");
    const weekday = getPart("weekday") || ENGLISH_DAYS_BY_JS_INDEX[now.getDay()];
    const hours = parseInt(getPart("hour"), 10) % 24;
    const minutes = parseInt(getPart("minute"), 10);
    const dayOfWeekIndex = ENGLISH_DAYS_BY_JS_INDEX.indexOf(weekday as any);

    return {
      dateStr: `${year}-${month}-${day}`,
      dayOfWeekIndex: dayOfWeekIndex >= 0 ? dayOfWeekIndex : now.getDay(),
      englishDay: weekday,
      banglaDay: DAY_TRANSLATIONS[weekday] || weekday,
      hours: Number.isNaN(hours) ? now.getHours() : hours,
      minutes: Number.isNaN(minutes) ? now.getMinutes() : minutes,
      totalMinutes:
        (Number.isNaN(hours) ? now.getHours() : hours) * 60 +
        (Number.isNaN(minutes) ? now.getMinutes() : minutes),
    };
  } catch {
    const englishDay = ENGLISH_DAYS_BY_JS_INDEX[now.getDay()];
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return {
      dateStr: `${y}-${m}-${d}`,
      dayOfWeekIndex: now.getDay(),
      englishDay,
      banglaDay: DAY_TRANSLATIONS[englishDay] || englishDay,
      hours: now.getHours(),
      minutes: now.getMinutes(),
      totalMinutes: now.getHours() * 60 + now.getMinutes(),
    };
  }
}

export function getTodayDayKeys(now: Date = new Date()): { english: string; bangla: string } {
  const dhaka = getDhakaClockParts(now);
  return { english: dhaka.englishDay, bangla: dhaka.banglaDay };
}

export interface HolidayRangeLike {
  id?: string;
  title?: string;
  name?: string;
  start_date?: string;
  end_date?: string;
  date?: string;
}

export interface RoutineLiveStatus {
  todayDateStr: string;
  todayEnglish: string;
  todayBangla: string;
  nowMinutes: number;
  todayClasses: any[];
  currentClass: any | null;
  nextClass: any | null;
  minutesLeft: number;
  minutesUntilNext: number;
  isOffDay: boolean;
  offDayTitle: string | null;
  isHoliday: boolean;
  holidayTitle: string | null;
  isToday: (dayStr: string) => boolean;
  isCurrent: (routine: any) => boolean;
  isNext: (routine: any) => boolean;
}

function isRoutineOffDay(r: any): boolean {
  if (!r) return false;
  if (r.item_type === "OFFDAY") return true;
  if (String(r.routine_type || "").toLowerCase() === "offday") return true;
  if (String(r.room_number || "").startsWith("OFFDAY:")) return true;
  return false;
}

function isWithinPeriod(nowMinutes: number, startM: number, endM: number): boolean {
  if (startM < 0 || endM < 0) return false;
  if (endM >= startM) {
    return nowMinutes >= startM && nowMinutes <= endM;
  }
  // Overnight period crossing midnight (e.g., 22:30 - 01:00)
  return nowMinutes >= startM || nowMinutes <= endM;
}

function computeMinutesRemaining(nowMinutes: number, startM: number, endM: number): number {
  if (startM < 0 || endM < 0) return 0;
  if (endM >= startM) {
    return Math.max(0, endM - nowMinutes);
  }
  // Overnight crossing midnight
  if (nowMinutes >= startM) {
    return 24 * 60 - nowMinutes + endM;
  }
  return Math.max(0, endM - nowMinutes);
}

export function getRoutineLiveStatus(
  routines: any[],
  now: Date = new Date(),
  holidays: HolidayRangeLike[] = []
): RoutineLiveStatus {
  const dhaka = getDhakaClockParts(now);
  const todayEnglish = dhaka.englishDay;
  const todayBangla = dhaka.banglaDay;
  const todayDateStr = dhaka.dateStr;
  const nowMinutes = dhaka.totalMinutes;

  const isToday = (dayStr: string) => {
    return dayStr === todayEnglish || dayStr === todayBangla || DAY_TRANSLATIONS[dayStr] === todayBangla;
  };

  // Detect active academic calendar holiday
  const matchingHoliday = (holidays || []).find((h) => {
    const start = String(h?.start_date || h?.date || "").slice(0, 10);
    const end = String(h?.end_date || h?.start_date || h?.date || "").slice(0, 10);
    if (!start) return false;
    return todayDateStr >= start && todayDateStr <= end;
  });
  const isHoliday = Boolean(matchingHoliday);
  const holidayTitle = matchingHoliday?.title || matchingHoliday?.name || null;

  const rawTodayItems = (routines || []).filter((r) => isToday(r.day_of_week));
  const offDayItem = rawTodayItems.find(isRoutineOffDay);
  const isOffDay = Boolean(offDayItem);
  const offDayTitle = offDayItem
    ? offDayItem.display_title ||
      (String(offDayItem.room_number || "").startsWith("OFFDAY:")
        ? String(offDayItem.room_number).substring(7)
        : "সাপ্তাহিক ছুটি")
    : null;

  const activePeriods = rawTodayItems.filter((r) => !isRoutineOffDay(r));

  // Sort today's classes chronologically
  const sortedToday = [...activePeriods].sort((a, b) => {
    const startA = timeStringToMinutes(a.start_time);
    const startB = timeStringToMinutes(b.start_time);
    return startA - startB;
  });

  let currentClass: any | null = null;
  let nextClass: any | null = null;
  let minutesLeft = 0;
  let minutesUntilNext = 0;

  if (!isHoliday && !isOffDay) {
    for (const r of sortedToday) {
      const startM = timeStringToMinutes(r.start_time);
      const endM = timeStringToMinutes(r.end_time);

      if (startM >= 0 && endM >= 0) {
        if (!currentClass && isWithinPeriod(nowMinutes, startM, endM)) {
          currentClass = r;
          minutesLeft = computeMinutesRemaining(nowMinutes, startM, endM);
        } else if (nowMinutes < startM && !nextClass) {
          nextClass = r;
          minutesUntilNext = startM - nowMinutes;
        }
      }
    }
  }

  const isCurrent = (routine: any) => {
    if (isHoliday || isOffDay || !routine || isRoutineOffDay(routine) || !isToday(routine.day_of_week)) {
      return false;
    }
    if (currentClass && routine.id && currentClass.id === routine.id) return true;
    const startM = timeStringToMinutes(routine.start_time);
    const endM = timeStringToMinutes(routine.end_time);
    return isWithinPeriod(nowMinutes, startM, endM);
  };

  const isNext = (routine: any) => {
    return Boolean(!isHoliday && !isOffDay && nextClass && routine && nextClass.id === routine.id);
  };

  return {
    todayDateStr,
    todayEnglish,
    todayBangla,
    nowMinutes,
    todayClasses: sortedToday,
    currentClass,
    nextClass,
    minutesLeft,
    minutesUntilNext,
    isOffDay,
    offDayTitle,
    isHoliday,
    holidayTitle,
    isToday,
    isCurrent,
    isNext,
  };
}

export type RoutinePeriodState = "live" | "next" | "completed" | "upcoming";

/**
 * Classify a single routine item on today's schedule into live, next, completed, or upcoming.
 */
export function getRoutinePeriodState(
  routine: any,
  liveStatus: RoutineLiveStatus
): RoutinePeriodState {
  if (!routine) return "upcoming";
  if (liveStatus.isCurrent(routine)) return "live";
  if (liveStatus.isNext(routine)) return "next";

  const startM = timeStringToMinutes(routine.start_time);
  const endM = timeStringToMinutes(routine.end_time);
  const nowM = liveStatus.nowMinutes;

  if (startM >= 0 && endM >= 0) {
    if (endM >= startM) {
      if (nowM > endM) return "completed";
    } else {
      // Overnight class crossing midnight: completed only after endM and before startM
      if (nowM > endM && nowM < startM) return "completed";
    }
  }

  return "upcoming";
}

export interface NextAcademicDayPreview {
  daysAhead: number;
  isTomorrow: boolean;
  dateStr: string;
  dayEnglish: string;
  dayBangla: string;
  firstClass: any;
  totalClasses: number;
}

/**
 * Scan the upcoming 1..7 days (Asia/Dhaka) to find the next active academic day
 * that is neither an academic holiday nor a weekly off-day and has at least one class.
 */
export function getNextActiveAcademicDay(
  routines: any[],
  now: Date = new Date(),
  holidays: HolidayRangeLike[] = []
): NextAcademicDayPreview | null {
  if (!Array.isArray(routines) || routines.length === 0) return null;

  for (let offset = 1; offset <= 7; offset++) {
    const candidateDate = new Date(now.getTime() + offset * 24 * 60 * 60 * 1000);
    const dhaka = getDhakaClockParts(candidateDate);

    // Skip academic holidays
    const onHoliday = (holidays || []).some((h) => {
      const start = String(h?.start_date || h?.date || "").slice(0, 10);
      const end = String(h?.end_date || h?.start_date || h?.date || "").slice(0, 10);
      if (!start) return false;
      return dhaka.dateStr >= start && dhaka.dateStr <= end;
    });
    if (onHoliday) continue;

    const dayItems = routines.filter((r) => {
      const d = String(r?.day_of_week || "");
      return (
        d === dhaka.englishDay ||
        d === dhaka.banglaDay ||
        DAY_TRANSLATIONS[d] === dhaka.banglaDay
      );
    });

    if (dayItems.length === 0) continue;
    if (dayItems.some(isRoutineOffDay)) continue;

    const activePeriods = dayItems
      .filter((r) => !isRoutineOffDay(r))
      .sort(
        (a, b) => timeStringToMinutes(a.start_time) - timeStringToMinutes(b.start_time)
      );

    if (activePeriods.length > 0) {
      return {
        daysAhead: offset,
        isTomorrow: offset === 1,
        dateStr: dhaka.dateStr,
        dayEnglish: dhaka.englishDay,
        dayBangla: dhaka.banglaDay,
        firstClass: activePeriods[0],
        totalClasses: activePeriods.length,
      };
    }
  }

  return null;
}



