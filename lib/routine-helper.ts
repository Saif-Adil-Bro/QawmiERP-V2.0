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
  const parts = timeStr.split(":");
  if (parts.length >= 2) {
    return `${parts[0]}:${parts[1]}`;
  }
  return timeStr;
}
