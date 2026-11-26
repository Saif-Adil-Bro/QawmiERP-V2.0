/**
 * Biometric & Fingerprint Attendance Management Types & Helpers
 * Supports ZKTeco (K40, IN01, MB20, uFace), Hikvision, Dahua, Realand, Anviz & Generic Cloud Push / USB logs
 */

import { toDhakaDateString } from "@/lib/date-utils";
import { toBanglaNumber } from "./numberToBangla";

export type BiometricBrand =
  | "ZKTeco_K40"
  | "ZKTeco_IN01"
  | "ZKTeco_MB20"
  | "ZKTeco_uFace"
  | "Hikvision"
  | "Dahua"
  | "Realand"
  | "Anviz"
  | "Generic_Cloud_Push"
  | "Custom";

export type BiometricProtocol =
  "cloud_push" | "lan_tcp" | "offline_usb" | "webhook";
export type TargetAudience = "all" | "students" | "teachers";
export type DeviceStatus = "active" | "offline" | "maintenance";

export interface BiometricDevice {
  id: string;
  madrasa_id: string;
  name: string; // e.g., "মেইন গেট পাঞ্চ মেশিন"
  device_model: BiometricBrand;
  serial_number: string; // Device SN / Cloud ID
  ip_address?: string; // e.g. "192.168.1.201"
  port?: number; // e.g. 4370
  protocol: BiometricProtocol;
  target_audience: TargetAudience;
  location?: string; // e.g., "প্রবেশদ্বার", "অফিস কক্ষ"
  status: DeviceStatus;
  secret_token: string; // Secure Token for Webhook / Push API
  last_sync_at?: string; // ISO datetime
  last_ping_at?: string;
  total_punches_count: number;
  unverified_history_count?: number;
  created_at: string;
  updated_at: string;
  notes?: string;
}

export interface BiometricUserMapping {
  id: string;
  madrasa_id: string;
  device_user_id: string; // User ID on the biometric machine (e.g. "101", "480001", "15")
  user_type: "student" | "teacher";
  target_id: string; // Student ID or Teacher ID
  target_name: string;
  target_identifier: string; // Roll number, Student ID Code, or Teacher Phone
  class_name?: string; // For students
  rfid_card_no?: string;
  fingerprint_registered?: boolean;
  face_registered?: boolean;
  created_at: string;
  updated_at?: string;
}

export interface BiometricPunchLog {
  id: string;
  madrasa_id: string;
  device_id: string;
  device_name: string;
  device_user_id: string;
  user_type: "student" | "teacher" | "unknown";
  target_id?: string;
  target_name?: string;
  target_identifier?: string;
  class_name?: string;
  punch_time: string; // ISO datetime (e.g. "2026-09-23T08:15:30Z")
  punch_date: string; // "YYYY-MM-DD"
  punch_type: "check_in" | "check_out" | "auto";
  status: "processed" | "unmapped" | "duplicate" | "error" | "pending";
  parser_version?: 2;
  issue?: string;
  sync_mode: "cloud_push" | "usb_import" | "manual_sync";
  raw_data?: string;
  created_at: string;
}

export interface ParsedPunchRecord {
  device_user_id: string;
  timestamp: string; // ISO string
  date: string; // YYYY-MM-DD
  time: string; // HH:mm:ss
  punch_type?: "check_in" | "check_out" | "auto";
  verify_mode?: string;
  raw_line?: string;
  line?: number;
}

/**
 * Parses raw ZKTeco attlog.dat, CSV, or Tab-separated punch files
 * Supported formats:
 * 1. ZKTeco standard attlog.dat: <UserID>\t<YYYY-MM-DD HH:mm:ss>\t<Status>\t<VerifyType>...
 * 2. Comma separated CSV: UserID, DateTime, Status
 * 3. Space/Tab separated: UserID DateTime
 */
export function parsePunch(
  pin: string,
  input: string,
): ParsedPunchRecord | null {
  if (!/^\d{1,32}$/.test(pin)) return null;
  const m =
    /^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?$/i.exec(
      input,
    );
  if (!m) return null;
  const day = new Date(`${m[1]}T00:00:00Z`);
  if (
    !Number.isFinite(+day) ||
    day.toISOString().slice(0, 10) !== m[1] ||
    +m[2] > 23 ||
    +m[3] > 59 ||
    +(m[4] || 0) > 59
  )
    return null;
  const time = `${m[2]}:${m[3]}:${m[4] || "00"}`;
  const instant = new Date(`${m[1]}T${time}${m[5] || ""}${m[6] || "+06:00"}`);
  if (!Number.isFinite(+instant)) return null;
  return {
    device_user_id: pin,
    timestamp: instant.toISOString(),
    date: toDhakaDateString(instant),
    time,
  };
}

export function parsePunchReport(text: string) {
  const records: ParsedPunchRecord[] = [];
  const rejected: { line: number; reason: string }[] = [];
  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (
      !line ||
      line.startsWith("#") ||
      /^(user(?:[ _]?id)?|pin)[,;\s]/i.test(line)
    )
      return;
    const parts = line
      .split(/[,;\t]+/)
      .map((v) => v.trim().replace(/^"(.*)"$/, "$1"));
    if (parts.length === 1) parts.splice(0, 1, ...line.split(/\s+/));
    const splitTime = /^\d{4}-\d{2}-\d{2}$/.test(parts[1] || "");
    const record = parsePunch(
      parts[0],
      splitTime ? `${parts[1]} ${parts[2] || ""}` : parts[1] || "",
    );
    if (!record)
      rejected.push({
        line: index + 1,
        reason: /^\d{1,32}$/.test(parts[0])
          ? "তারিখ বা সময় অবৈধ (YYYY-MM-DD HH:mm[:ss] আবশ্যক)"
          : "মেশিন ID সংখ্যায় হতে হবে",
      });
    else
      records.push({
        ...record,
        raw_line: line,
        line: index + 1,
        punch_type: parts[splitTime ? 3 : 2] === "1" ? "check_out" : "check_in",
      });
  });
  return { records, rejected };
}

export function parseBiometricPunchFile(text: string) {
  return parsePunchReport(text).records;
}

export const punchKey = (device: string, pin: string, instant: string) =>
  JSON.stringify([device, pin, instant]);

// Legacy USB logs stamped local time with Z, and some even fabricated today's
// date. Trust a surviving, valid source line, never a blanket six-hour shift.
export function historicalPunch(log: BiometricPunchLog) {
  if (!log.parser_version) {
    // Both the old iClock and USB paths used this parser. Old JSON push
    // fabricated a time on bad input without retaining the raw timestamp.
    const parsed = log.raw_data && parsePunchReport(log.raw_data).records[0];
    return parsed && parsed.device_user_id === log.device_user_id
      ? parsed
      : null;
  }
  // Postgres may render timestamptz as "2026-11-23 01:55:00+00".
  // This field is a stored instant, not an unzoned device wall clock.
  const stored = String(log.punch_time).replace(/([+-]\d{2})$/, "$1:00");
  return /(?:Z|[+-]\d{2}:\d{2})$/i.test(stored)
    ? parsePunch(log.device_user_id, stored)
    : null;
}

export function uniquePunchLogs(logs: BiometricPunchLog[]) {
  const byKey = new Map<string, BiometricPunchLog>();
  for (const log of logs) {
    const punch = historicalPunch(log);
    const key = punch
      ? punchKey(log.device_id, log.device_user_id, punch.timestamp)
      : log.id;
    // A second copy must never be replayed when its sibling already posted.
    if (
      !byKey.has(key) ||
      (log.status === "processed" && byKey.get(key)?.status !== "processed")
    ) {
      byKey.set(
        key,
        punch
          ? { ...log, punch_time: punch.timestamp, punch_date: punch.date }
          : { ...log, issue: "মূল লাইন যাচাই করা যায়নি — পর্যালোচনা প্রয়োজন" },
      );
    }
  }
  return Array.from(byKey.values());
}

/**
 * Generate a random secure token for device authentication
 */
export function generateDeviceToken(prefix: string = "bio"): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let token = "";
  for (let i = 0; i < 16; i++) {
    token += chars.charAt(
      crypto.getRandomValues(new Uint8Array(1))[0] % chars.length,
    );
    if (i === 3 || i === 7 || i === 11) token += "-";
  }
  return `${prefix}_${token}`;
}

export const BIOMETRIC_BRANDS_LIST: {
  id: BiometricBrand;
  label: string;
  description: string;
}[] = [
  {
    id: "ZKTeco_K40",
    label: "ZKTeco K40 (ফিঙ্গারপ্রিন্ট ও RFID)",
    description:
      "সবচেয়ে জনপ্রিয় মডেল, ক্লাউড পুশ (ADMS) এবং ইউএসবি এক্সপোর্ট সমর্থিত।",
  },
  {
    id: "ZKTeco_IN01",
    label: "ZKTeco IN01 / iClock Series",
    description:
      "হাই-ক্যাপাসিটি বায়োমেট্রিক টার্মিনাল, ব্যাটারি ব্যাকআপ ও ওয়াইফাই/ল্যান পুশ।",
  },
  {
    id: "ZKTeco_MB20",
    label: "ZKTeco MB20 / MB160 (ফেস ও ফিঙ্গার)",
    description: "চেহারা ও আঙুলের ছাপ উভয় সমর্থিত স্মার্ট বায়োমেট্রিক মেশিন।",
  },
  {
    id: "ZKTeco_uFace",
    label: "ZKTeco uFace Series (ফেস রিকগনিশন)",
    description: "স্পর্শহীন ফেস রিকগনিশন ও হাই-স্পিড পাঞ্চ সুবিধা।",
  },
  {
    id: "Hikvision",
    label: "Hikvision Biometric / Face Terminal",
    description: "হিকভিশন ক্লাউড পুশ ও ল্যান কানেকশন টার্মিনাল।",
  },
  {
    id: "Dahua",
    label: "Dahua Time Attendance Terminal",
    description: "দাহুয়া ফিঙ্গারপ্রিন্ট ও কার্ড পাঞ্চ সিস্টেম।",
  },
  {
    id: "Realand",
    label: "Realand / Anviz Biometric",
    description: "সাশ্রয়ী ফিঙ্গারপ্রিন্ট ও কার্ড পাঞ্চ ডিভাইস।",
  },
  {
    id: "Generic_Cloud_Push",
    label: "Generic Webhook / ADMS Cloud Push",
    description: "যেকোনো স্ট্যান্ডার্ড ক্লাউড পুশ সমর্থিত পাঞ্চ মেশিন বা কাস্টম গেটওয়ে।",
  },
];

/**
 * Determine the real-time connectivity status of a biometric device
 */
export function getDeviceConnectionStatus(device: BiometricDevice): {
  status: "online" | "waiting" | "offline";
  label: string;
  badgeClass: string;
  dotClass: string;
  lastSeenText: string;
} {
  const lastActive = device.last_ping_at;

  if (!lastActive) {
    return {
      status: "waiting",
      label: "কানেক্ট হয়নি (অপেক্ষমাণ)",
      badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
      dotClass: "bg-amber-500 animate-pulse",
      lastSeenText: "ডিভাইস থেকে এখনও কোনো পিং বা পাঞ্চ আসেনি",
    };
  }

  const lastTime = new Date(lastActive).getTime();
  const now = Date.now();
  const diffMinutes = Math.floor((now - lastTime) / (1000 * 60));

  if (isNaN(diffMinutes) || diffMinutes < 0) {
    return {
      status: "waiting",
      label: "কানেক্ট হয়নি (অপেক্ষমাণ)",
      badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
      dotClass: "bg-amber-500 animate-pulse",
      lastSeenText: "ডিভাইস থেকে এখনও কোনো পিং বা পাঞ্চ আসেনি",
    };
  }

  if (diffMinutes <= 15) {
    return {
      status: "online",
      label: "অনলাইন (Live)",
      badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
      dotClass: "bg-emerald-500 shadow-sm shadow-emerald-500/50",
      lastSeenText:
        diffMinutes <= 1
          ? "এইমাত্র সক্রিয়"
          : `${toBanglaNumber(diffMinutes)} মিনিট আগে`,
    };
  } else if (diffMinutes <= 60 * 24) {
    const hours = Math.floor(diffMinutes / 60);
    return {
      status: "offline",
      label: "অফলাইন",
      badgeClass: "bg-slate-100 text-slate-600 border-slate-200",
      dotClass: "bg-slate-400",
      lastSeenText:
        hours <= 1 ? "১ ঘণ্টা আগে" : `${toBanglaNumber(hours)} ঘণ্টা আগে`,
    };
  } else {
    const days = Math.floor(diffMinutes / (60 * 24));
    return {
      status: "offline",
      label: "অফলাইন",
      badgeClass: "bg-slate-100 text-slate-600 border-slate-200",
      dotClass: "bg-slate-400",
      lastSeenText: `${toBanglaNumber(days)} দিন আগে`,
    };
  }
}
