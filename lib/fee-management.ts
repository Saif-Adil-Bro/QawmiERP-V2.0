import { createClient, createAdminClient, getAuthUser } from "@/lib/supabase/server";
import { getAuthMadrasaId } from "@/app/actions/students";
import { getMadrasaMetadata, saveMadrasaMetadata, AcademicSession, StudentEnrollment } from "@/lib/sessions";

export type FeeFrequency = "ONETIME" | "MONTHLY" | "TERM" | "YEARLY";
export type FeeCategory = "ACADEMIC" | "BOARDING" | "ADMINISTRATIVE" | "OTHER";
export type FeeStatus = "UNPAID" | "PARTIAL" | "PAID" | "OVERDUE" | "WAIVED";
export type PaymentMethod = "Cash" | "Bank" | "bKash" | "Nagad" | "Rocket" | "Other";
export type PaymentStatus = "COMPLETED" | "REVERSED" | "VOID";

export interface FeeType {
  id: string;
  name: string; // e.g. "মাসিক বেতন"
  code: string; // e.g. "MONTHLY"
  category: FeeCategory;
  frequency: FeeFrequency;
  default_amount: number;
  is_active: boolean;
  is_system?: boolean;
}

export interface FeeStructureItem {
  fee_type_id: string;
  fee_type_name: string;
  amount: number;
  frequency: FeeFrequency;
}

export interface FeeStructure {
  id: string;
  madrasa_id: string;
  session_id: string;
  class_id: string; // "ALL" or specific class_id
  class_name: string;
  student_category: "ALL" | "RESIDENTIAL" | "NON_RESIDENTIAL" | "ORPHAN" | "DAY_CARE";
  name: string;
  items: FeeStructureItem[];
  total_monthly_amount: number;
  total_onetime_amount: number;
  created_at: string;
  updated_at: string;
}

export interface StudentFee {
  id: string;
  madrasa_id: string;
  session_id: string;
  student_id: string;
  student_name?: string;
  student_roll?: string;
  class_id?: string;
  class_name?: string;
  fee_type_id: string;
  fee_type_name: string;
  billing_period: string; // e.g. "Muharram 1447" or "January 2026" or "Admission 1447"
  month_name?: string;
  year?: string;
  due_date: string;
  base_amount: number;
  discount_amount: number;
  discount_reason?: string;
  fine_amount: number;
  fine_reason?: string;
  payable_amount: number; // base_amount - discount_amount + fine_amount
  paid_amount: number;
  due_amount: number; // payable_amount - paid_amount
  status: FeeStatus;
  created_at: string;
  updated_at: string;
}

export interface PaymentAllocation {
  student_fee_id?: string;
  fee_type_id?: string;
  fee_type_name: string;
  billing_period?: string;
  allocated_amount: number;
  discount_applied?: number;
  fine_applied?: number;
}

export interface FeePayment {
  id: string;
  receipt_no: string; // e.g. "MR-2026-000125"
  madrasa_id: string;
  session_id: string;
  student_id: string;
  student_name: string;
  student_roll?: string;
  class_name?: string;
  total_amount_received: number;
  payment_date: string;
  payment_method: PaymentMethod;
  transaction_ref?: string;
  allocations: PaymentAllocation[];
  discount_total: number;
  fine_total: number;
  advance_amount: number;
  collector_name: string;
  notes?: string;
  status: PaymentStatus;
  reversal_reason?: string;
  reversed_at?: string;
  reversed_by?: string;
  idempotency_key?: string;
  created_at: string;
}

export interface FeeDiscountWaiver {
  id: string;
  madrasa_id: string;
  session_id: string;
  student_id: string;
  discount_type: "FIXED" | "PERCENTAGE" | "SCHOLARSHIP" | "FULL_WAIVER";
  value: number;
  fee_type_id?: string;
  reason: string;
  status: "APPROVED" | "PENDING" | "REJECTED";
  approved_by?: string;
  created_at: string;
}

export interface FeeAuditLog {
  id: string;
  madrasa_id: string;
  action: string;
  user_name: string;
  user_role: string;
  record_id?: string;
  details: string;
  created_at: string;
}

/**
 * Standard default Fee Types for Qawmi Madrasas
 */
export const DEFAULT_FEE_TYPES: FeeType[] = [
  { id: "ft_admission", name: "ভর্তি ফি (Admission Fee)", code: "ADMISSION", category: "ACADEMIC", frequency: "ONETIME", default_amount: 2000, is_active: true, is_system: true },
  { id: "ft_monthly", name: "মাসিক বেতন (Monthly Tuition)", code: "MONTHLY", category: "ACADEMIC", frequency: "MONTHLY", default_amount: 1500, is_active: true, is_system: true },
  { id: "ft_exam", name: "পরীক্ষার ফি (Exam Fee)", code: "EXAM", category: "ACADEMIC", frequency: "TERM", default_amount: 300, is_active: true, is_system: true },
  { id: "ft_hostel", name: "বোর্ডিং ও খাবার ফি (Hostel/Food)", code: "HOSTEL", category: "BOARDING", frequency: "MONTHLY", default_amount: 2000, is_active: true, is_system: true },
  { id: "ft_books", name: "কিতাব ও পাঠ্যপুস্তক ফি (Books)", code: "BOOKS", category: "ACADEMIC", frequency: "ONETIME", default_amount: 1000, is_active: true, is_system: true },
  { id: "ft_library", name: "কুতুবখানা / লাইব্রেরি ফি", code: "LIBRARY", category: "ACADEMIC", frequency: "YEARLY", default_amount: 200, is_active: true, is_system: true },
  { id: "ft_idcard", name: "আইডি কার্ড ও ব্যাজ ফি", code: "IDCARD", category: "ADMINISTRATIVE", frequency: "ONETIME", default_amount: 150, is_active: true, is_system: true },
  { id: "ft_transport", name: "যাতায়াত / পরিবহন ফি", code: "TRANSPORT", category: "OTHER", frequency: "MONTHLY", default_amount: 800, is_active: true, is_system: true },
  { id: "ft_uniform", name: "পোশাক / ইউনিফর্ম ফি", code: "UNIFORM", category: "ADMINISTRATIVE", frequency: "ONETIME", default_amount: 600, is_active: true, is_system: true },
  { id: "ft_certificate", name: "সনদ ও প্রশংসাপত্র ফি", code: "CERTIFICATE", category: "ADMINISTRATIVE", frequency: "ONETIME", default_amount: 300, is_active: true, is_system: true },
  { id: "ft_other", name: "বিবিধ / অন্যান্য ফি", code: "OTHER", category: "OTHER", frequency: "ONETIME", default_amount: 100, is_active: true, is_system: true },
];

/**
 * Months list (Hijri and Gregorian)
 */
export const HIJRI_MONTHS = [
  { id: "Muharram", name: "মুহাররম (Muharram)" },
  { id: "Safar", name: "সফর (Safar)" },
  { id: "Rabi-ul-Awwal", name: "রবিউল আউয়াল (Rabi' al-Awwal)" },
  { id: "Rabi-uth-Thani", name: "রবিউস সানি (Rabi' al-Thani)" },
  { id: "Jumada-al-Awwal", name: "জমাদিউল আউয়াল (Jumada al-Awwal)" },
  { id: "Jumada-uth-Thani", name: "জমাদিউস সানি (Jumada al-Thani)" },
  { id: "Rajab", name: "রজব (Rajab)" },
  { id: "Shaban", name: "শাবান (Sha'ban)" },
  { id: "Ramadan", name: "রমজান (Ramadan)" },
  { id: "Shawwal", name: "শাওয়াল (Shawwal)" },
  { id: "Dhul-Qadah", name: "জিলকদ (Dhu al-Qi'dah)" },
  { id: "Dhul-Hijjah", name: "জিলহজ (Dhu al-Hijjah)" },
];

export const GREGORIAN_MONTHS = [
  { id: "January", name: "জানুয়ারি (January)" },
  { id: "February", name: "ফেব্রুয়ারি (February)" },
  { id: "March", name: "মার্চ (March)" },
  { id: "April", name: "এপ্রিল (April)" },
  { id: "May", name: "মে (May)" },
  { id: "June", name: "জুন (June)" },
  { id: "July", name: "জুলাই (July)" },
  { id: "August", name: "আগস্ট (August)" },
  { id: "September", name: "সেপ্টেম্বর (September)" },
  { id: "October", name: "অক্টোবর (October)" },
  { id: "November", name: "নভেম্বর (November)" },
  { id: "December", name: "ডিসেম্বর (December)" },
];

export interface MadrasaFeeData {
  fee_types?: FeeType[];
  fee_structures?: FeeStructure[];
  student_fees?: StudentFee[];
  payments?: FeePayment[];
  discounts?: FeeDiscountWaiver[];
  audit_logs?: FeeAuditLog[];
  receipt_counter?: number;
  student_profiles?: Record<string, any>;
}
