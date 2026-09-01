export type IDCardStatus = "ACTIVE" | "EXPIRED" | "LOST" | "BLOCKED" | "REISSUED";

export interface IDCardSnapshot {
  student_name: string;
  student_id_code: string;
  roll_number?: string;
  class_name?: string;
  session_name?: string;
  father_name?: string;
  parent_phone?: string;
  blood_group?: string;
  date_of_birth?: string;
  address?: string;
  photo_url?: string;
}

export interface StudentIDCard {
  id: string;
  madrasa_id: string;
  student_id: string;
  session_id: string;
  card_number: string; // e.g. QM-26-000125
  student_number: string;
  issue_date: string; // YYYY-MM-DD
  expiry_date: string; // YYYY-MM-DD
  status: IDCardStatus;
  photo_url?: string;
  verification_id: string; // unique unguessable token for QR
  template_id: string; // e.g. "classic" | "minimal" | "modern"
  issued_by: string;
  status_reason?: string;
  snapshot: IDCardSnapshot;
  created_at: string;
  updated_at: string;
}

export interface IDCardFieldVisibility {
  photo: boolean;
  student_id: boolean;
  class: boolean;
  roll: boolean;
  session: boolean;
  father_name: boolean;
  phone: boolean;
  blood_group: boolean;
  dob: boolean;
  address: boolean;
  qr_code: boolean;
}

export interface IDCardTemplateConfig {
  id: string;
  name: string;
  layout: "classic_islamic" | "modern_minimal" | "premium_madrasa" | "modern" | "classic" | "minimal" | "custom";
  theme_color: string;
  field_visibility: IDCardFieldVisibility;
  custom_instructions: string[];
  terms_and_conditions: string;
}

export interface IDCardAuditLog {
  id: string;
  madrasa_id: string;
  action: "CREATED" | "REISSUED" | "MARKED_LOST" | "BLOCKED" | "UNBLOCKED" | "BULK_CREATED";
  user_name: string;
  student_id: string;
  card_number: string;
  details: string;
  created_at: string;
}

export interface MadrasaIDCardMetadata {
  id_cards?: StudentIDCard[];
  id_card_templates?: IDCardTemplateConfig[];
  id_card_audit_logs?: IDCardAuditLog[];
  id_card_counter?: number;
}

export const DEFAULT_IDCARD_TEMPLATES: IDCardTemplateConfig[] = [
  {
    id: "classic_islamic",
    name: "ক্লাসিক ইসলামিক (Classic Islamic)",
    layout: "classic_islamic",
    theme_color: "emerald",
    field_visibility: {
      photo: true,
      student_id: true,
      class: true,
      roll: true,
      session: true,
      father_name: true,
      phone: true,
      blood_group: true,
      dob: true,
      address: true,
      qr_code: true,
    },
    custom_instructions: [
      "মাদরাসায় অবস্থানকালীন সময়ে আইডি কার্ড ঝুলিয়ে রাখা বাধ্যতামূলক।",
      "আইডি কার্ডটি হারিয়ে গেলে বা নষ্ট হলে অবিলম্বে অফিসে জানান।",
      "এই কার্ডটি হস্তান্তরযোগ্য নয় এবং পাওয়া গেলে নিচের ঠিকানায় ফেরত দিন।",
    ],
    terms_and_conditions: "This card remains the property of the madrasa and must be returned if found.",
  },
  {
    id: "modern_minimal",
    name: "মডার্ন মিনিমাল (Modern Minimal)",
    layout: "modern_minimal",
    theme_color: "emerald",
    field_visibility: {
      photo: true,
      student_id: true,
      class: true,
      roll: true,
      session: true,
      father_name: true,
      phone: true,
      blood_group: true,
      dob: false,
      address: false,
      qr_code: true,
    },
    custom_instructions: [
      "মাদরাসার ভেতরে পরিচয়পত্র পরিধান বাধ্যতামূলক।",
      "কার্ডটি অন্য কাউকে হস্তান্তর করা দণ্ডনীয় অপরাধ।",
    ],
    terms_and_conditions: "Official Student Identity Card.",
  },
  {
    id: "premium_madrasa",
    name: "প্রিমিয়াম মাদরাসা (Premium Madrasa)",
    layout: "premium_madrasa",
    theme_color: "emerald",
    field_visibility: {
      photo: true,
      student_id: true,
      class: true,
      roll: true,
      session: true,
      father_name: true,
      phone: true,
      blood_group: true,
      dob: true,
      address: true,
      qr_code: true,
    },
    custom_instructions: [
      "কার্ডটি মাদরাসার সম্পত্তি এবং সর্বাবস্থায় সাথে রাখতে হবে।",
      "কার্ডটি হারিয়ে গেলে অবিলম্বে কর্তৃপক্ষকে অবহিত করুন।",
      "কার্ডটি পাওয়া গেলে দ্রুত নিচের নাম্বারে কল করে অফিসকে অবগত করুন।",
    ],
    terms_and_conditions: "Institutional Student Identity Card - Qawmi Madrasa System.",
  },
];

/**
 * Generate a unique random verification token for QR verification
 */
export function generateVerificationToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let token = "v_";
  for (let i = 0; i < 24; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

/**
 * Normalizes any student ID, roll number, or legacy card string into standard 6-digit student ID (e.g. 480001)
 */
export function normalizeStudentIdCode(rawInput?: any, fallbackCounter = 1): string {
  if (rawInput === undefined || rawInput === null) {
    const cnt = typeof fallbackCounter === "number" && fallbackCounter > 0 ? fallbackCounter : 1;
    return String(480000 + cnt);
  }

  const str = String(rawInput).trim();
  if (!str) {
    const cnt = typeof fallbackCounter === "number" && fallbackCounter > 0 ? fallbackCounter : 1;
    return String(480000 + cnt);
  }

  // Strip prefixes like QM-, CERT-, STU-, ID-, etc.
  const clean = str.replace(/^(QM-|CERT-|STU-|ID-)/i, "").trim();

  // If already exactly a 6-digit number starting with 480 (e.g. 480001, 480011)
  if (/^480\d+$/.test(clean)) {
    return clean;
  }

  // If format is like "26-000111" or "2026-000011" (old year-sequence format)
  const yearSeqMatch = clean.match(/^(?:\d{2,4}-)?0*(\d+)$/);
  if (yearSeqMatch && yearSeqMatch[1]) {
    const num = parseInt(yearSeqMatch[1], 10);
    if (!isNaN(num)) {
      if (num >= 480000) return String(num);
      if (num > 0) return String(480000 + num);
    }
  }

  // Extract all digits if any
  const digitsOnly = clean.replace(/\D/g, "");
  if (digitsOnly) {
    const num = parseInt(digitsOnly, 10);
    if (!isNaN(num)) {
      if (num >= 480000) return String(num);
      if (num > 0) return String(480000 + num);
    }
  }

  const cnt = typeof fallbackCounter === "number" && fallbackCounter > 0 ? fallbackCounter : 1;
  return String(480000 + cnt);
}

/**
 * Generate formatted Card Number (e.g. QM-480001)
 */
export function formatCardNumber(yearShort: string, counter: number, studentIdCode?: string): string {
  const stdCode = normalizeStudentIdCode(studentIdCode, counter);
  return `QM-${stdCode}`;
}
