// Staff Management Type Definitions, Constants & Helper Utilities

export type StaffCategoryCode = "teaching" | "administration" | "support" | "management" | "custom";

export interface StaffCategory {
  id: string;
  name: string;
  name_en: string;
  code: StaffCategoryCode;
  description?: string;
  is_system?: boolean;
}

export interface StaffDepartment {
  id: string;
  name: string;
  name_en: string;
  code: string;
  head_staff_id?: string;
  description?: string;
}

export interface StaffDesignation {
  id: string;
  name: string;
  category_id: string;
  department_id?: string;
  description?: string;
}

export type StaffStatus =
  | "ACTIVE"
  | "ON_LEAVE"
  | "INACTIVE"
  | "SUSPENDED"
  | "RESIGNED"
  | "TERMINATED";

export type EmploymentType =
  | "FULL_TIME"
  | "PART_TIME"
  | "CONTRACT"
  | "VOLUNTEER"
  | "TEMPORARY";

export interface StaffPersonalInfo {
  first_name: string;
  last_name: string;
  full_name_bn?: string;
  full_name_en?: string;
  full_name_ar?: string;
  photo_url?: string;
  father_name?: string;
  mother_name?: string;
  spouse_name?: string;
  date_of_birth?: string;
  gender?: "MALE" | "FEMALE";
  blood_group?: string;
  nationality?: string;
  nid_number?: string;
  marital_status?: "MARRIED" | "UNMARRIED" | "OTHER";
}

export interface StaffContactInfo {
  phone: string;
  alt_phone?: string;
  email?: string;
  present_address?: string;
  permanent_address?: string;
  emergency_contact_name?: string;
  emergency_contact_relation?: string;
  emergency_contact_phone?: string;
}

export interface StaffEmploymentInfo {
  staff_id_code: string; // e.g. STF-260001
  category_id: string;
  category_name?: string;
  department_id: string;
  department_name?: string;
  designation: string;
  joining_date: string;
  employment_type: EmploymentType;
  status: StaffStatus;
  reporting_to_id?: string;
  reporting_to_name?: string;
  resignation_date?: string;
  termination_date?: string;
  exit_reason?: string;
}

export interface StaffAcademicInfo {
  highest_qualification?: string;
  madrasa_or_university?: string;
  degree_or_sanad?: string;
  specialization?: string;
  hifz_completed?: boolean;
  qiraat_degree?: string;
  arabic_qualification?: string;
  teaching_experience_years?: number;
  previous_institution?: string;
}

export interface StaffSalaryStructure {
  basic_salary: number;
  allowances: {
    housing?: number;
    food?: number;
    transport?: number;
    medical?: number;
    other?: number;
  };
  deductions: {
    advance?: number;
    loan?: number;
    absence?: number;
    other?: number;
  };
  net_salary: number;
  payment_method?: "CASH" | "BANK" | "BKASH" | "NAGAD" | "OTHER";
  bank_account_no?: string;
  bank_name?: string;
  bank_branch?: string;
}

export interface StaffDocument {
  id: string;
  title: string;
  document_type: "NID" | "CERTIFICATE" | "EXPERIENCE" | "APPOINTMENT_LETTER" | "CONTRACT" | "PHOTO" | "OTHER";
  file_url: string;
  file_name?: string;
  issue_date?: string;
  expiry_date?: string;
  uploaded_at: string;
  notes?: string;
}

export interface StaffEmploymentHistoryRecord {
  id: string;
  type: "JOINED" | "PROMOTION" | "TRANSFER" | "STATUS_CHANGE" | "SALARY_REVISION" | "RESIGNATION" | "TERMINATION" | "REACTIVATED";
  previous_designation?: string;
  new_designation?: string;
  previous_department?: string;
  new_department?: string;
  previous_salary?: number;
  new_salary?: number;
  previous_status?: StaffStatus;
  new_status?: StaffStatus;
  effective_date: string;
  reason?: string;
  remarks?: string;
  changed_by?: string;
  created_at: string;
}

export interface StaffAuditLogRecord {
  id: string;
  action: string;
  details?: string;
  user_email?: string;
  created_at: string;
}

export interface StaffMember {
  id: string;
  madrasa_id: string;
  staff_id_code: string; // Unique, e.g. STF-260001
  personal: StaffPersonalInfo;
  contact: StaffContactInfo;
  employment: StaffEmploymentInfo;
  academic?: StaffAcademicInfo;
  responsibilities?: string[]; // e.g. ["ক্লাস টিচার", "হোস্টেল সুপারভাইজার", "পরীক্ষা নিয়ন্ত্রক"]
  assigned_subjects?: Array<{
    class_id: string;
    class_name: string;
    subject_id: string;
    subject_name: string;
  }>;
  salary: StaffSalaryStructure;
  documents?: StaffDocument[];
  employment_history?: StaffEmploymentHistoryRecord[];
  audit_logs?: StaffAuditLogRecord[];
  auth_user_id?: string | null;
  auth_role?: "teacher" | "admin" | "staff" | "none";
  id_card?: {
    card_number: string;
    issue_date: string;
    expiry_date: string;
    verification_token: string;
    is_revoked: boolean;
  };
  leave_balance?: {
    casual_allocated: number;
    casual_used: number;
    sick_allocated: number;
    sick_used: number;
    annual_allocated: number;
    annual_used: number;
  };
  created_at: string;
  updated_at: string;
}

export interface StaffLeaveRequest {
  id: string;
  madrasa_id: string;
  staff_id: string;
  staff_name: string;
  staff_id_code: string;
  leave_type: "CASUAL" | "SICK" | "ANNUAL" | "EMERGENCY" | "HAJJ_UMRAH" | "MATERNITY" | "UNPAID" | "OTHER";
  leave_type_name_bn: string;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewed_by?: string;
  review_reason?: string;
  reviewed_at?: string;
  created_at: string;
}

export interface StaffSalaryPaymentRecord {
  id: string;
  madrasa_id: string;
  staff_id: string;
  staff_name: string;
  staff_id_code: string;
  designation: string;
  department: string;
  month: string; // e.g. "08"
  year: string; // e.g. "2026"
  basic_salary: number;
  allowances: number;
  deductions: number;
  net_salary: number;
  status: "PENDING" | "PAID";
  payment_date?: string;
  payment_method?: string;
  transaction_ref?: string;
  processed_by?: string;
  expense_id?: string; // Linked to madrasa accounting expenses
  remarks?: string;
  created_at: string;
}

// ----------------- DEFAULT PRESETS -----------------

export const DEFAULT_STAFF_CATEGORIES: StaffCategory[] = [
  {
    id: "cat-teaching",
    name: "শিক্ষক মণ্ডলী (Teaching Staff)",
    name_en: "Teaching Staff",
    code: "teaching",
    description: "কিতাব বিভাগ, হিফজ ও সাধারণ বিষয়ের সকল শিক্ষকবৃন্দ",
    is_system: true,
  },
  {
    id: "cat-admin",
    name: "প্রশাসনিক স্টাফ (Administrative Staff)",
    name_en: "Administrative Staff",
    code: "administration",
    description: "অফিস কর্মকর্তা, হিসাবরক্ষক, আইটি ও সহকারী প্রশাসনিক কর্মী",
    is_system: true,
  },
  {
    id: "cat-support",
    name: "সহায়ক ও পরিষেবা কর্মী (Support Staff)",
    name_en: "Support Staff",
    code: "support",
    description: "বাবুর্চি, লাইব্রেরিয়ান, সিকিউরিটি গার্ড, ক্লিনার ও হোস্টেল কর্মী",
    is_system: true,
  },
  {
    id: "cat-management",
    name: "ব্যবস্থাপনা ও মুহতামিম (Management)",
    name_en: "Management",
    code: "management",
    description: "মুহতামিম, নায়েবে মুহতামিম, প্রিন্সিপাল ও পরিচালনা পর্ষদ",
    is_system: true,
  },
];

/**
 * Robust helper to check if a staff member or category ID belongs to Teaching Staff
 */
export function isTeachingStaff(memberOrCategory: StaffMember | string | undefined | null): boolean {
  if (!memberOrCategory) return true; // Default to teaching for unassigned madrasa staff
  const catId = typeof memberOrCategory === "string"
    ? memberOrCategory
    : memberOrCategory.employment?.category_id;

  if (!catId) return true;
  const lower = catId.toLowerCase();
  return (
    lower === "cat-teaching" ||
    lower === "cat_teaching" ||
    lower === "teaching" ||
    lower.includes("teach") ||
    lower.includes("shikkhok")
  );
}

/**
 * Robust helper to match category IDs against core categories (supports both hyphen and underscore formats)
 */
export function isCategory(
  catId: string | undefined | null,
  target: "teaching" | "admin" | "support" | "management"
): boolean {
  if (!catId) return target === "teaching";
  const c = catId.toLowerCase();
  if (target === "teaching") {
    return (
      c === "cat-teaching" ||
      c === "cat_teaching" ||
      c === "teaching" ||
      c.includes("teach") ||
      c.includes("shikkhok")
    );
  }
  if (target === "admin") {
    return (
      c === "cat-admin" ||
      c === "cat_admin" ||
      c === "administration" ||
      c === "admin" ||
      c.includes("admin")
    );
  }
  if (target === "support") {
    return c === "cat-support" || c === "cat_support" || c === "support" || c.includes("support");
  }
  if (target === "management") {
    return (
      c === "cat-management" ||
      c === "cat_management" ||
      c === "management" ||
      c.includes("manage")
    );
  }
  return false;
}

export const DEFAULT_STAFF_DEPARTMENTS: StaffDepartment[] = [
  {
    id: "dept-academic",
    name: "একাডেমিক ও পাঠদান বিভাগ",
    name_en: "Academic Department",
    code: "academic",
    description: "হিফজ, কিতাব ও নুরানী ক্লাসের পাঠদান কার্যক্রম",
  },
  {
    id: "dept-admin",
    name: "সাধারণ প্রশাসন ও দপ্তর",
    name_en: "Administration & Office",
    code: "admin",
    description: "অফিস ব্যবস্থাপনা, নোটিশ ও ভর্তি কার্যক্রম",
  },
  {
    id: "dept-accounts",
    name: "হিসাব ও অর্থ বিভাগ",
    name_en: "Accounts & Finance",
    code: "accounts",
    description: "ফি আদায়, বেতন-ভাতা ও মাদ্রাসার আয়-ব্যয়",
  },
  {
    id: "dept-library",
    name: "কুতুবখানা (লাইব্রেরি)",
    name_en: "Library",
    code: "library",
    description: "কিতাব সংরক্ষণ ও পাঠক সেবা",
  },
  {
    id: "dept-hostel",
    name: "বোর্ডিং ও ছাত্রাবাস",
    name_en: "Hostel & Boarding",
    code: "hostel",
    description: "ছাত্রদের আবাসন, খাবার ও দৈনন্দিন শৃঙ্খলা",
  },
  {
    id: "dept-maintenance",
    name: "রক্ষণাবেক্ষণ ও নিরাপত্তা",
    name_en: "Maintenance & Security",
    code: "maintenance",
    description: "ভবন পরিচর্যা, বিদ্যুৎ ও নিরাপত্তা পাহারা",
  },
  {
    id: "dept-other",
    name: "অন্যান্য সেবা",
    name_en: "Other Services",
    code: "other",
    description: "সাধারণ আনুষঙ্গিক সেবা",
  },
];

export const DEFAULT_STAFF_DESIGNATIONS: StaffDesignation[] = [
  // Teaching
  { id: "des-principal", name: "শাইখুল হাদিস ও প্রিন্সিপাল", category_id: "cat-teaching", department_id: "dept-academic" },
  { id: "des-senior-teacher", name: "উস্তাদুল আসাতাজা / সিনিয়র শিক্ষক", category_id: "cat-teaching", department_id: "dept-academic" },
  { id: "des-teacher", name: "সহকারী শিক্ষক (মুদাররিস)", category_id: "cat-teaching", department_id: "dept-academic" },
  { id: "des-hifz-teacher", name: "হাফেজ শিক্ষক (হিফজুল কুরআন)", category_id: "cat-teaching", department_id: "dept-academic" },
  { id: "des-qari", name: "ক্বারী সাহেব (তাজবীদ ও ক্বিরাআত)", category_id: "cat-teaching", department_id: "dept-academic" },
  { id: "des-arabic-teacher", name: "আরবি ভাষা শিক্ষক (আদব ও কাওয়ায়েদ)", category_id: "cat-teaching", department_id: "dept-academic" },
  { id: "des-general-teacher", name: "সাধারণ বিষয় শিক্ষক (বাংলা/ইংরেজি/গণিত)", category_id: "cat-teaching", department_id: "dept-academic" },
  { id: "des-imam", name: "ইমাম ও খতিব", category_id: "cat-teaching", department_id: "dept-academic" },
  { id: "des-muazzin", name: "মুয়াজ্জিন সাহেব", category_id: "cat-teaching", department_id: "dept-academic" },

  // Admin
  { id: "des-admin-officer", name: "প্রশাসনিক কর্মকর্তা (Office Admin)", category_id: "cat-admin", department_id: "dept-admin" },
  { id: "des-accountant", name: "প্রধান হিসাবরক্ষক (Chief Accountant)", category_id: "cat-admin", department_id: "dept-accounts" },
  { id: "des-accounts-assistant", name: "সহকারী হিসাবরক্ষক", category_id: "cat-admin", department_id: "dept-accounts" },
  { id: "des-receptionist", name: "রিসিপশনিস্ট ও তথ্য সহকারী", category_id: "cat-admin", department_id: "dept-admin" },
  { id: "des-admission-incharge", name: "ভর্তি ইনচার্জ", category_id: "cat-admin", department_id: "dept-admin" },

  // Support
  { id: "des-librarian", name: "গ্রন্থাগারিক (লাইব্রেরিয়ান)", category_id: "cat-support", department_id: "dept-library" },
  { id: "des-cook", name: "প্রধান বাবুর্চি (বোর্ডিং)", category_id: "cat-support", department_id: "dept-hostel" },
  { id: "des-asst-cook", name: "সহকারী বাবুর্চি", category_id: "cat-support", department_id: "dept-hostel" },
  { id: "des-cleaner", name: "পরিচ্ছন্নতাকর্মী (ক্লিনার)", category_id: "cat-support", department_id: "dept-maintenance" },
  { id: "des-guard", name: "নিরাপত্তা প্রহরী (গার্ড)", category_id: "cat-support", department_id: "dept-maintenance" },
  { id: "des-hostel-supervisor", name: "হোস্টেল সুপারভাইজার", category_id: "cat-support", department_id: "dept-hostel" },
  { id: "des-driver", name: "গাড়ী চালক (ড্রাইভার)", category_id: "cat-support", department_id: "dept-other" },

  // Management
  { id: "des-mohtamim", name: "মুহতামিম / মহাপরিচালক", category_id: "cat-management", department_id: "dept-admin" },
  { id: "des-naib-mohtamim", name: "নায়েবে মুহতামিম / উপ-পরিচালক", category_id: "cat-management", department_id: "dept-admin" },
  { id: "des-director", name: "শিক্ষা পরিচালক (নাজেমে তালিমাত)", category_id: "cat-management", department_id: "dept-academic" },
];

export const DEFAULT_RESPONSIBILITIES = [
  "ক্লাস টিচার (শ্রেণি শিক্ষক)",
  "শিক্ষা ইনচার্জ (নাজেমে তালিমাত)",
  "হোস্টেল সুপারভাইজার",
  "কুতুবখানা তত্ত্বাবধায়ক",
  "পরীক্ষা ও ফলাফল নিয়ন্ত্রক",
  "হাজিরা ও শৃঙ্খলা ইনচার্জ",
  "ভর্তি ও রেজিস্ট্রেশন দায়িত্বপ্রাপ্ত",
  "বোর্ডিং ও খানা ইনচার্জ",
  "তথ্যপ্রযুক্তি ও যোগাযোগ কর্মকর্তা",
  "যাকাত ও ফান্ড কালেকশন সহকারী",
];

export const LEAVE_TYPE_LABELS: Record<string, string> = {
  CASUAL: "নৈমিত্তিক ছুটি (Casual Leave)",
  SICK: "অসুস্থতাজনিত ছুটি (Sick Leave)",
  ANNUAL: "বার্ষিক ছুটি (Annual Leave)",
  EMERGENCY: "জরুরি পারিবারিক ছুটি (Emergency Leave)",
  HAJJ_UMRAH: "হজ্ব ও ওমরাহ ছুটি (Hajj/Umrah Leave)",
  MATERNITY: "মাতৃত্বকালীন ছুটি (Maternity Leave)",
  UNPAID: "অবৈতনিক ছুটি (Unpaid Leave)",
  OTHER: "অন্যান্য ছুটি (Other Leave)",
};

export const STAFF_STATUS_LABELS: Record<StaffStatus, { label: string; bg: string; text: string; border: string }> = {
  ACTIVE: { label: "সক্রিয় (Active)", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  ON_LEAVE: { label: "ছুটিতে আছেন (On Leave)", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  INACTIVE: { label: "নিষ্ক্রিয় (Inactive)", bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-200" },
  SUSPENDED: { label: "স্থগিত (Suspended)", bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
  RESIGNED: { label: "ইস্তফাপ্রাপ্ত (Resigned)", bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  TERMINATED: { label: "অব্যাহতিপ্রাপ্ত (Terminated)", bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
};

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  FULL_TIME: "ফুল টাইম (Full Time)",
  PART_TIME: "পার্ট টাইম (Part Time)",
  CONTRACT: "চুক্তিভিত্তিক (Contract)",
  VOLUNTEER: "স্বেচ্ছাসেবী (Volunteer)",
  TEMPORARY: "অস্থায়ী (Temporary)",
};

/**
 * Generates a unique secure verification token for staff ID cards
 */
export function generateStaffVerificationToken(madrasaId: string, staffId: string): string {
  const ts = Date.now().toString(36);
  const rnd = Math.random().toString(36).substring(2, 8);
  const mid = madrasaId.replace(/[^a-zA-Z0-9]/g, "").substring(0, 6);
  const sid = staffId.replace(/[^a-zA-Z0-9]/g, "").substring(0, 6);
  return `QM-STF-${mid}-${sid}-${ts}-${rnd}`.toUpperCase();
}

/**
 * Format sequential unique Staff ID (e.g. STF-260001)
 * Format: [PREFIX]-[YY][XXXX] where YY is the last 2 digits of the current English year,
 * and XXXX is a 4-digit auto-generated sequential number.
 */
export function formatStaffIdCode(prefix: string = "STF", year: number = new Date().getFullYear(), serial: number): string {
  const shortYear = String(year).slice(-2);
  const padSerial = String(serial).padStart(4, "0");
  return `${prefix}-${shortYear}${padSerial}`;
}
