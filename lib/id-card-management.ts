import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { getAuthMadrasaId } from "@/app/actions/students";
import { getMadrasaMetadata, saveMadrasaMetadata, AcademicSession } from "@/lib/sessions";

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
  layout: "modern" | "classic" | "minimal" | "custom";
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
    id: "modern",
    name: "মডার্ন নক্সা (Modern)",
    layout: "modern",
    theme_color: "blue",
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
      address: false,
      qr_code: true,
    },
    custom_instructions: [
      "মাদরাসায় অবস্থানকালীন সময়ে কার্ডটি পরিধান করা বাধ্যতামূলক।",
      "এই কার্ডটি মাদরাসার সম্পত্তি এবং এটি হস্তান্তরযোগ্য নয়।",
      "কার্ড হারিয়ে গেলে কর্তৃপক্ষকে অবিলম্বে অবহিত করতে হবে।",
      "কার্ডটি পাওয়া গেলে নিচের ঠিকানায় ফেরত দিন।",
    ],
    terms_and_conditions: "This identity card is non-transferable and must be returned if found.",
  },
  {
    id: "classic",
    name: "ক্লাসিক ট্র্যাডিশনাল (Classic)",
    layout: "classic",
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
      "মাদরাসায় অবস্থানকালে আইডি কার্ড ঝুলিয়ে রাখতে হবে।",
      "কার্ডটি হারিয়ে গেলে বা নষ্ট হলে ৫০ টাকা ফি প্রদানপূর্বক রি-ইস্যু করতে হবে।",
      "কার্ডটি অন্য কাউকে হস্তান্তর করা দণ্ডনীয় অপরাধ।",
    ],
    terms_and_conditions: "Property of the Madrasa. If found please return to office.",
  },
  {
    id: "minimal",
    name: "সিম্পল মিনিমাল (Minimal)",
    layout: "minimal",
    theme_color: "slate",
    field_visibility: {
      photo: true,
      student_id: true,
      class: true,
      roll: true,
      session: true,
      father_name: false,
      phone: false,
      blood_group: true,
      dob: false,
      address: false,
      qr_code: true,
    },
    custom_instructions: [
      "মাদরাসা আইডি কার্ড সর্বদা সাথে রাখুন।",
    ],
    terms_and_conditions: "This card remains the property of the issuing institution.",
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
 * Generate formatted Card Number (QM-26-000125)
 */
export function formatCardNumber(yearShort: string, counter: number): string {
  const padded = String(counter).padStart(6, "0");
  return `QM-${yearShort}-${padded}`;
}
