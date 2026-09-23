/**
 * Biometric & Fingerprint Attendance Management Types & Helpers
 * Supports ZKTeco (K40, IN01, MB20, uFace), Hikvision, Dahua, Realand, Anviz & Generic Cloud Push / USB logs
 */

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

export type BiometricProtocol = "cloud_push" | "lan_tcp" | "offline_usb" | "webhook";
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
  status: "processed" | "unmapped" | "duplicate" | "error";
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
}

/**
 * Parses raw ZKTeco attlog.dat, CSV, or Tab-separated punch files
 * Supported formats:
 * 1. ZKTeco standard attlog.dat: <UserID>\t<YYYY-MM-DD HH:mm:ss>\t<Status>\t<VerifyType>...
 * 2. Comma separated CSV: UserID, DateTime, Status
 * 3. Space/Tab separated: UserID DateTime
 */
export function parseBiometricPunchFile(rawText: string): ParsedPunchRecord[] {
  if (!rawText || typeof rawText !== "string") return [];

  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const results: ParsedPunchRecord[] = [];

  for (const line of lines) {
    // Ignore header lines if present
    if (
      line.toLowerCase().includes("user") ||
      line.toLowerCase().includes("datetime") ||
      line.toLowerCase().includes("timestamp") ||
      line.startsWith("#")
    ) {
      continue;
    }

    // Try tab/space/comma separation
    const parts = line.split(/[\t,;]+/).map((p) => p.trim());
    if (parts.length < 2) continue;

    let userId = parts[0];
    let dateTimeStr = parts[1];

    // Some files format like: "101 2026-09-23 08:30:15 1 1"
    if (parts.length >= 3 && /^\d{4}-\d{2}-\d{2}$/.test(parts[1]) && /^\d{2}:\d{2}/.test(parts[2])) {
      dateTimeStr = `${parts[1]} ${parts[2]}`;
    }

    // If userId contains quotes, strip them
    userId = userId.replace(/["']/g, "").trim();
    dateTimeStr = dateTimeStr.replace(/["']/g, "").trim();

    if (!userId || !dateTimeStr) continue;

    // Extract exact date YYYY-MM-DD from string to avoid timezone drift
    let dateStr = "";
    const dateMatch = dateTimeStr.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (dateMatch) {
      const y = dateMatch[1];
      const m = dateMatch[2].padStart(2, "0");
      const d = dateMatch[3].padStart(2, "0");
      dateStr = `${y}-${m}-${d}`;
    }

    // Extract time
    let timeStr = "08:00:00";
    const timeMatch = dateTimeStr.match(/(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
    if (timeMatch) {
      const hh = timeMatch[1].padStart(2, "0");
      const mm = timeMatch[2].padStart(2, "0");
      const ss = (timeMatch[3] || "00").padStart(2, "0");
      timeStr = `${hh}:${mm}:${ss}`;
    }

    if (!dateStr) {
      const parsedDate = new Date(dateTimeStr.replace(/-/g, "/"));
      const validDate = !isNaN(parsedDate.getTime()) ? parsedDate : new Date();
      dateStr = validDate.toISOString().split("T")[0];
    }

    const isoTimestamp = `${dateStr}T${timeStr}Z`;

    results.push({
      device_user_id: userId,
      timestamp: isoTimestamp,
      date: dateStr,
      time: timeStr,
      punch_type: parts[2] === "1" ? "check_out" : "check_in",
      raw_line: line,
    });
  }

  return results;
}

/**
 * Generate a random secure token for device authentication
 */
export function generateDeviceToken(prefix: string = "bio"): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let token = "";
  for (let i = 0; i < 16; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
    if (i === 3 || i === 7 || i === 11) token += "-";
  }
  return `${prefix}_${token}`;
}

export const BIOMETRIC_BRANDS_LIST: { id: BiometricBrand; label: string; description: string }[] = [
  {
    id: "ZKTeco_K40",
    label: "ZKTeco K40 (ফিঙ্গারপ্রিন্ট ও RFID)",
    description: "সবচেয়ে জনপ্রিয় মডেল, ক্লাউড পুশ (ADMS) এবং ইউএসবি এক্সপোর্ট সমর্থিত।",
  },
  {
    id: "ZKTeco_IN01",
    label: "ZKTeco IN01 / iClock Series",
    description: "হাই-ক্যাপাসিটি বায়োমেট্রিক টার্মিনাল, ব্যাটারি ব্যাকআপ ও ওয়াইফাই/ল্যান পুশ।",
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
