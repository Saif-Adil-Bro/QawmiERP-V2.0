import { createAdminClient } from "@/lib/supabase/server";
import { getMadrasaMetadata, saveMadrasaMetadata, AcademicSession } from "@/lib/sessions";

export type CertificateStatus = "DRAFT" | "PENDING_APPROVAL" | "ISSUED" | "REVOKED" | "VOIDED" | "REISSUED";

export interface CertificateTypeConfig {
  id: string;
  code: string;
  title_bn: string;
  title_ar?: string;
  title_en?: string;
  category: "CHARACTER" | "STUDY" | "TESTIMONIAL" | "TRANSFER" | "LEAVING" | "HIFZ" | "ACADEMIC" | "OTHER";
  default_template_id: string;
  body_template: string;
  requires_approval: boolean;
  has_expiry: boolean;
}

export interface CertificateSnapshot {
  student_name: string;
  student_id_code: string;
  father_name: string;
  mother_name?: string;
  guardian_name?: string;
  class_name: string;
  roll_number?: string;
  section?: string;
  session_name: string;
  hijri_year?: string;
  academic_year?: string;
  admission_date?: string;
  leaving_date?: string;
  date_of_birth?: string;
  address?: string;
  madrasa_name: string;
  madrasa_address: string;
  madrasa_phone?: string;
  principal_name?: string;
  photo_url?: string;
}

export interface StudentCertificate {
  id: string;
  madrasa_id: string;
  student_id: string;
  session_id: string;
  certificate_type_id: string;
  certificate_type_title: string;
  template_id: string;
  certificate_number: string; // e.g. CERT-2026-000125 or QM/CERT/1447/000001
  verification_token: string; // unguessable random token for QR
  issue_date: string; // YYYY-MM-DD
  expiry_date?: string;
  status: CertificateStatus;
  purpose?: string;
  additional_statement?: string;
  
  // Special fields for Transfer / Conduct / Result
  dues_status?: "CLEARED" | "HAS_DUES";
  dues_amount?: number;
  library_status?: "CLEARED" | "PENDING";
  hostel_status?: "CLEARED" | "PENDING";
  conduct_grade?: string;
  reason_for_leaving?: string;
  last_attendance_date?: string;
  hifz_para_completed?: string;
  exam_result?: {
    exam_title?: string;
    gpa?: string;
    grade?: string;
    total_marks?: string;
    position?: string;
  };

  // Signature and Seal config
  mohtamim_signature: boolean;
  principal_signature: boolean;
  teacher_signature: boolean;
  show_seal: boolean;

  // Revocation / Reissue details
  revoked_reason?: string;
  revoked_at?: string;
  revoked_by?: string;
  reissued_from_id?: string;
  reissued_to_id?: string;

  issued_by: string;
  approved_by?: string;
  snapshot: CertificateSnapshot;
  created_at: string;
  updated_at: string;
}

export interface CertificateTemplateConfig {
  id: string;
  name: string;
  page_size: "A4";
  orientation: "portrait" | "landscape";
  border_style: "ornate" | "classic" | "minimal" | "none";
  font_family: "font-solaiman" | "font-shorif" | "font-hindsiliguri";
  arabic_font: "font-amiri" | "font-shahrazad";
  theme_color: "emerald" | "indigo" | "amber" | "slate" | "rose";
  header_title?: string;
  bismillah_text?: string;
  footer_text?: string;
  signatures: {
    mohtamim: boolean;
    principal: boolean;
    teacher: boolean;
  };
  show_qr: boolean;
  show_seal: boolean;
  seal_url?: string;
}

export interface CertificateAuditLog {
  id: string;
  madrasa_id: string;
  action: "CREATED" | "APPROVED" | "REISSUED" | "REVOKED" | "BULK_CREATED" | "TEMPLATE_UPDATED";
  user_name: string;
  certificate_id: string;
  certificate_number: string;
  student_name: string;
  details: string;
  created_at: string;
}

export interface MadrasaCertificateMetadata {
  certificates?: StudentCertificate[];
  certificate_types?: CertificateTypeConfig[];
  certificate_templates?: CertificateTemplateConfig[];
  certificate_audit_logs?: CertificateAuditLog[];
  certificate_counter?: number;
  certificate_prefix?: string;
}

export const DEFAULT_CERTIFICATE_TYPES: CertificateTypeConfig[] = [
  {
    id: "char_cert",
    code: "CHARACTER",
    title_bn: "চারিত্রিক সনদপত্র",
    title_ar: "شهادة السيرة والسلوك",
    title_en: "Character Certificate",
    category: "CHARACTER",
    default_template_id: "classic",
    body_template: "এই মর্মে প্রত্যয়ন করা যাচ্ছে যে, {{student_name}}, পিতা: {{father_name}}, মাতা: {{mother_name}}, জামাত: {{class_name}}, রোল: {{roll}}, সেশন: {{session_name}}। আমাদের প্রতিষ্ঠানে অবস্থানকালে তার চরিত্র ও চাল-চলন অত্যন্ত সন্তোষজনক ছিল। তিনি কোনো অসামাজিক বা শৃঙ্খলাবিরোধী কর্মকাণ্ডে জড়িত ছিলেন না। আমরা তার উজ্জ্বল ভবিষ্যৎ কামনা করি।",
    requires_approval: false,
    has_expiry: false,
  },
  {
    id: "study_cert",
    code: "STUDY",
    title_bn: "অধ্যয়নরত প্রত্যয়নপত্র",
    title_ar: "شهادة الدراسة",
    title_en: "Study Certificate",
    category: "STUDY",
    default_template_id: "modern",
    body_template: "এই মর্মে প্রত্যয়ন করা যাচ্ছে যে, {{student_name}}, আইডি: {{student_id}}, পিতা: {{father_name}}, জামাত: {{class_name}}, রোল: {{roll}}, বর্তমান শিক্ষাবর্ষ {{session_name}}-এ আমাদের মাদরাসায় নিয়মিত শিক্ষার্থী হিসেবে অধ্যয়নরত আছেন।",
    requires_approval: false,
    has_expiry: true,
  },
  {
    id: "testimonial",
    code: "TESTIMONIAL",
    title_bn: "প্রশংসাপত্র",
    title_ar: "شهادة التقدير والثناء",
    title_en: "Testimonial",
    category: "TESTIMONIAL",
    default_template_id: "classic",
    body_template: "এই মর্মে প্রত্যয়ন করা যাচ্ছে যে, {{student_name}}, পিতা: {{father_name}}, মাতা: {{mother_name}}, গ্রাম/ঠিকানা: {{address}}, আমাদের মাদরাসার {{class_name}} জামাতের একজন সুনামী নিয়মিত শিক্ষার্থী ছিলেন। তিনি শিক্ষাবর্ষ {{session_name}}-এ সাফল্য ও সুনামের সাথে শিক্ষা জীবন অতিবাহিত করেছেন।",
    requires_approval: false,
    has_expiry: false,
  },
  {
    id: "transfer_cert",
    code: "TRANSFER",
    title_bn: "ছাড়পত্র (Transfer Certificate / TC)",
    title_ar: "شهادة المغادرة والترحيل",
    title_en: "Transfer Certificate",
    category: "TRANSFER",
    default_template_id: "classic",
    body_template: "এতদ্বারা জানানো যাচ্ছে যে, {{student_name}}, পিতা: {{father_name}}, জামাত: {{class_name}}, রোল: {{roll}}, ভর্তি তারিখ: {{admission_date}}, ছাড়পত্রের তারিখ: {{leaving_date}}। মাদরাসার যাবতীয় পাওনা ও বকেয়া পরিশোধ করা হয়েছে। তার আচরণ উত্তম ছিল। তাকে অন্য প্রতিষ্ঠানে ভর্তির সুবিধার্থে এই ছাড়পত্র প্রদান করা হলো।",
    requires_approval: true,
    has_expiry: false,
  },
  {
    id: "leaving_cert",
    code: "LEAVING",
    title_bn: "পরিত্যাগ পত্র",
    title_ar: "شهادة ترك الدراسة",
    title_en: "Leaving Certificate",
    category: "LEAVING",
    default_template_id: "minimal",
    body_template: "এতদ্বারা প্রত্যায়ন করা যাচ্ছে যে, {{student_name}}, পিতা: {{father_name}}, জামাত: {{class_name}}, রোল: {{roll}}, স্বইচ্ছায় আমাদের মাদরাসা ত্যাগ করেছেন। প্রতিষ্ঠানে অবস্থানকালে তার চাল-চলন ভালো ছিল।",
    requires_approval: true,
    has_expiry: false,
  },
  {
    id: "hifz_cert",
    code: "HIFZ",
    title_bn: "হিফজুল কুরআন সমাপ্তি সনদ",
    title_ar: "شهادة إتمام حفظ القرآن الكريم",
    title_en: "Hifz Completion Certificate",
    category: "HIFZ",
    default_template_id: "classic",
    body_template: "الحمد لله رب العالمين والصلوة والسلام على رسوله الكريم। এই মর্মে প্রত্যয়ন করা যাচ্ছে যে, {{student_name}}, পিতা: {{father_name}}, আমাদের মাদরাসার হিফজ বিভাগে অধ্যয়ন করে সম্পূর্ণ ৩০ পারা পবিত্র কুরআনুল কারীম হিফজ সম্পন্ন করার মহান গৌরব অর্জন করেছেন। আল্লাহ তাআলা তাকে কুরআনের খাদেম হিসেবে কবুল করুন।",
    requires_approval: true,
    has_expiry: false,
  },
  {
    id: "admission_cert",
    code: "ADMISSION",
    title_bn: "ভর্তি প্রত্যয়নপত্র",
    title_ar: "شهادة القبول",
    title_en: "Admission Certificate",
    category: "STUDY",
    default_template_id: "modern",
    body_template: "এই মর্মে প্রত্যয়ন করা যাচ্ছে যে, {{student_name}}, পিতা: {{father_name}}, শিক্ষা বর্ষ {{session_name}}-এ আমাদের মাদরাসার {{class_name}} জামাতে আনুষ্ঠানিকভাবে ভর্তি হয়েছেন।",
    requires_approval: false,
    has_expiry: false,
  },
  {
    id: "conduct_cert",
    code: "CONDUCT",
    title_bn: "শিক্ষার্থী আচরণ সনদপত্র",
    title_ar: "شهادة السلوك الطلابية",
    title_en: "Student Conduct Certificate",
    category: "CHARACTER",
    default_template_id: "minimal",
    body_template: "এই মর্মে প্রত্যয়ন করা যাচ্ছে যে, {{student_name}}, পিতা: {{father_name}}, জামাত: {{class_name}}, রোল: {{roll}}, আমাদের মাদরাসার একজন সুশৃঙ্খল ও আদর্শ শিক্ষার্থী। তার আচরণ ও নীতি-নৈতিকতা প্রশংসনীয়।",
    requires_approval: false,
    has_expiry: false,
  },
  {
    id: "completion_cert",
    code: "COMPLETION",
    title_bn: "কোর্স / কোর্স সমাপ্তি সনদ",
    title_ar: "شهادة إكمال الدورة",
    title_en: "Completion Certificate",
    category: "ACADEMIC",
    default_template_id: "classic",
    body_template: "এই মর্মে প্রত্যয়ন করা যাচ্ছে যে, {{student_name}}, পিতা: {{father_name}}, জামাত: {{class_name}}, শিক্ষাবর্ষ {{session_name}}-এ সফলভাবে শিক্ষা পাঠ্যক্রম ও কোর্স সমাপ্ত করেছেন।",
    requires_approval: true,
    has_expiry: false,
  },
  {
    id: "scholarship_cert",
    code: "SCHOLARSHIP",
    title_bn: "মেধা ও বৃত্তি সনদপত্র",
    title_ar: "شهادة المنحة والتميز",
    title_en: "Scholarship Certificate",
    category: "ACADEMIC",
    default_template_id: "classic",
    body_template: "এই মর্মে প্রত্যয়ন করা যাচ্ছে যে, {{student_name}}, পিতা: {{father_name}}, জামাত: {{class_name}}, রোল: {{roll}}, শিক্ষাবর্ষ {{session_name}}-এ অসামান্য মেধা ও ফলাফলের জন্য মাদরাসা বৃত্তি লাভ করেছেন।",
    requires_approval: true,
    has_expiry: false,
  },
];

export const DEFAULT_CERTIFICATE_TEMPLATES: CertificateTemplateConfig[] = [
  {
    id: "classic",
    name: "ক্লাসিক ট্র্যাডিশনাল (Classic Ornate)",
    page_size: "A4",
    orientation: "landscape",
    border_style: "ornate",
    font_family: "font-solaiman",
    arabic_font: "font-amiri",
    theme_color: "emerald",
    header_title: "বিসমিল্লাহির রাহমানির রাহিম",
    bismillah_text: "بسم الله الرحمن الرحيم",
    footer_text: "সততা, নিষ্ঠা ও আদর্শ শিক্ষার কেন্দ্রস্থল",
    signatures: {
      mohtamim: true,
      principal: true,
      teacher: true,
    },
    show_qr: true,
    show_seal: true,
  },
  {
    id: "modern",
    name: "মডার্ন অফিশিয়াল (Modern Official)",
    page_size: "A4",
    orientation: "portrait",
    border_style: "classic",
    font_family: "font-solaiman",
    arabic_font: "font-amiri",
    theme_color: "indigo",
    header_title: "অফিশিয়াল প্রশংসাপত্র ও প্রত্যয়ন",
    bismillah_text: "بسم الله الرحمن الرحيم",
    footer_text: "ডিজিটাল কিউআর কোড দ্বারা অনলাইনে সত্যতা যাচাইযোগ্য",
    signatures: {
      mohtamim: true,
      principal: true,
      teacher: false,
    },
    show_qr: true,
    show_seal: true,
  },
  {
    id: "minimal",
    name: "সিম্পল মিনিমাল (Simple Minimal)",
    page_size: "A4",
    orientation: "portrait",
    border_style: "minimal",
    font_family: "font-solaiman",
    arabic_font: "font-amiri",
    theme_color: "slate",
    header_title: "প্রত্যয়নপত্র",
    bismillah_text: "بسم الله الرحمن الرحيم",
    footer_text: "যেকোনো দাপ্তরিক প্রয়োজনে গ্রহণযোগ্য",
    signatures: {
      mohtamim: false,
      principal: true,
      teacher: false,
    },
    show_qr: true,
    show_seal: false,
  },
];

/**
 * Generate a unique verification token for certificate QR codes
 */
export function generateCertificateToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let token = "cert_";
  for (let i = 0; i < 28; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

/**
 * Format Certificate Number (e.g. CERT-2026-000125)
 */
export function formatCertificateNumber(prefix: string, year: string, counter: number): string {
  const padded = String(counter).padStart(6, "0");
  const p = prefix ? prefix.trim().toUpperCase() : "CERT";
  return `${p}-${year}-${padded}`;
}

/**
 * Replace dynamic placeholders in body text
 */
export function interpolateCertificateBody(
  templateText: string,
  snapshot: CertificateSnapshot,
  cert: Partial<StudentCertificate>
): string {
  let text = templateText || "";

  const map: Record<string, string> = {
    "{{student_name}}": snapshot.student_name || "—",
    "{{student_id}}": snapshot.student_id_code || "—",
    "{{father_name}}": snapshot.father_name || "—",
    "{{mother_name}}": snapshot.mother_name || "—",
    "{{guardian_name}}": snapshot.guardian_name || snapshot.father_name || "—",
    "{{class_name}}": snapshot.class_name || "—",
    "{{roll}}": snapshot.roll_number || "—",
    "{{section}}": snapshot.section || "—",
    "{{session_name}}": snapshot.session_name || "—",
    "{{academic_year}}": snapshot.academic_year || "—",
    "{{admission_date}}": snapshot.admission_date || "—",
    "{{leaving_date}}": snapshot.leaving_date || cert.issue_date || "—",
    "{{date_of_birth}}": snapshot.date_of_birth || "—",
    "{{result}}": cert.exam_result?.grade || cert.exam_result?.gpa || "—",
    "{{grade}}": cert.exam_result?.grade || "—",
    "{{gpa}}": cert.exam_result?.gpa || "—",
    "{{certificate_number}}": cert.certificate_number || "—",
    "{{issue_date}}": cert.issue_date || "—",
    "{{expiry_date}}": cert.expiry_date || "—",
    "{{madrasa_name}}": snapshot.madrasa_name || "—",
    "{{madrasa_address}}": snapshot.madrasa_address || "—",
    "{{madrasa_phone}}": snapshot.madrasa_phone || "—",
    "{{principal_name}}": snapshot.principal_name || "—",
  };

  Object.keys(map).forEach((key) => {
    const val = map[key];
    text = text.replaceAll(key, val);
  });

  return text;
}
