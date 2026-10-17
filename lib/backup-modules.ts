/**
 * ব্যাকআপ ও রিস্টোরের মডিউল-ম্যাপিং।
 *
 * ⛔ এখানে কেন আলাদা ফাইল? কারণ এই ম্যাপিংটি **দুই জায়গায়** (export ও restore)
 * ব্যবহার হয়, এবং ক্লায়েন্ট UI-ও একই তালিকা দেখায়। এক জায়গায় রাখলে ব্যাকআপ ও
 * রিস্টোর কখনো অসামঞ্জস্যপূর্ণ হয়ে যাওয়ার ঝুঁকি থাকে না।
 *
 * "use server" ফাইলে শুধু async function export করা যায় — তাই বিশুদ্ধ টাইপ/কনস্ট্যান্ট
 * ও রিজলভার এখানে রাখা হয়েছে।
 */

export type BackupModuleKey = 
  | "students"               // শিক্ষার্থী ও প্রোফাইল
  | "admissions"             // ভর্তি ব্যবস্থাপনা
  | "academic"               // জামাত, বিষয় ও সিলেবাস
  | "routines"               // ক্লাস ও পরীক্ষার রুটিন
  | "hifz_kitab"             // হিফজুল কুরআন ও কিতাব লগ
  | "attendance"             // হাজিরা ও বায়োমেট্রিক
  | "leaves"                 // শিক্ষার্থী ও শিক্ষক ছুটি
  | "exams"                  // পরীক্ষা ও মেধা মূল্যায়ন
  | "question_bank"          // প্রশ্নব্যাংক ও প্রশ্নপত্র
  | "fees"                   // শিক্ষার্থী ফি ও বকেয়া
  | "finance_transactions"   // ফি আদায়, রসিদ ও ক্যাশবুক
  | "expenses"               // সাধারণ ব্যয় ও মেস বাজার
  | "zakat_donations"        // যাকাত, অনুদান ও রসিদ
  | "donors_funds"           // কেন্দ্রীয় দাতা রেজিস্টার ও ফান্ড
  | "fundraising_special"    // বিশেষ তহবিল (মাহফিল, চামড়া, দান বাক্স)
  | "payment_gateway"        // অনলাইন পেমেন্ট গেটওয়ে ও ট্রানজেকশন
  | "id_cards"               // ডিজিটাল স্মার্ট আইডি কার্ড
  | "certificates"           // সনদপত্র ও প্রশংসাপত্র
  | "boarding"               // বোর্ডিং, মেস ও মিল রেজিস্টার
  | "library"                // গ্রন্থাগার ও কিতাব ইস্যু
  | "inventory"              // সম্পদ ও ইনভেন্টরি মজুদ
  | "staff"                  // শিক্ষক, স্টাফ ও একাউন্টস
  | "communication"          // অভিভাবক যোগাযোগ ও অভিযোগ
  | "notices_sms"            // নোটিশ বোর্ড ও বাল্ক এসএমএস
  | "alumni"                 // কওমি অ্যালামনাই নেটওয়ার্ক
  | "settings"               // শিক্ষাবর্ষ, সেশন ও সেটিংস
  | "audit_logs"             // অডিট ট্রেইল ও সিস্টেম লগ
  | "all_metadata"
  | string;

/**
 * ============================================================================
 * মডিউল → ডেটা ম্যাপিং (সিলেক্টিভ ব্যাকআপ/রিস্টোরের মূল ভিত্তি)
 * ============================================================================
 *
 * ⛔ আগের বাগ: UI-তে মডিউল টিক দেওয়া হলেও `generateBackupExport` সব ৪৪টি টেবিল
 * এবং *সম্পূর্ণ* মেটাডেটা তুলে নিত। `options.modules` শুধু manifest ও অডিট-লগে
 * লেখা হতো — অর্থাৎ "শুধু শিক্ষার্থী" টিক দিলেও ফাইলে ফি, খরচ, যাকাত, বেতন সব
 * চলে যেত (প্রাইভেসি ও ফাইল-সাইজ দুই দিকেই ক্ষতি)।
 *
 * এখন প্রতিটি মডিউল কোন টেবিল ও কোন metadata key-এর মালিক তা এখানে স্পষ্ট।
 * ব্যাকআপ এবং রিস্টোর — দুই পথেই এই একই ম্যাপ ব্যবহার হয়, তাই দুই দিকের আচরণ
 * সবসময় মিলে যায়।
 */
interface BackupModuleSpec {
  tables: string[];
  metadataKeys: string[];
}

/** UI-তে থাকা সব মডিউল — এগুলোর সবগুলো নির্বাচিত হলে ফলাফল "সম্পূর্ণ ব্যাকআপ"। */
export const ALL_BACKUP_MODULE_KEYS: BackupModuleKey[] = [
  "students",
  "admissions",
  "id_cards",
  "certificates",
  "leaves",
  "alumni",
  "academic",
  "routines",
  "hifz_kitab",
  "attendance",
  "exams",
  "question_bank",
  "fees",
  "finance_transactions",
  "expenses",
  "zakat_donations",
  "donors_funds",
  "fundraising_special",
  "payment_gateway",
  "boarding",
  "library",
  "inventory",
  "staff",
  "communication",
  "notices_sms",
  "settings",
  "audit_logs",
];

const BACKUP_MODULE_SPECS: Record<string, BackupModuleSpec> = {
  students: {
    tables: ["students", "student_enrollments"],
    metadataKeys: ["student_profiles", "enrollments", "student_enrollments", "student_records"],
  },
  admissions: {
    tables: [],
    metadataKeys: ["admissions", "admission_records"],
  },
  id_cards: {
    tables: [],
    metadataKeys: [
      "id_cards",
      "id_card_templates",
      "id_card_counter",
      "id_card_builder_config",
      "id_card_audit_logs",
    ],
  },
  certificates: {
    tables: [],
    metadataKeys: [
      "certificates",
      "certificate_templates",
      "certificate_audit_logs",
      "certificate_counter",
      "certificate_types",
      "certificate_prefix",
      "verification_logs",
    ],
  },
  leaves: {
    tables: ["leaves"],
    metadataKeys: [
      "student_leaves",
      "teacher_leaves",
      "student_leave_applications",
      "teacher_leave_applications",
      "leaves",
    ],
  },
  alumni: {
    tables: ["alumni"],
    metadataKeys: ["alumni"],
  },
  academic: {
    tables: ["classes", "subjects", "class_subjects", "teacher_subjects"],
    metadataKeys: [
      "syllabus",
      "assignments",
      "amal_templates",
      "amal_logs",
      "class_teachers",
    ],
  },
  routines: {
    tables: ["routines", "exam_routines"],
    metadataKeys: ["routines", "exam_routines"],
  },
  hifz_kitab: {
    tables: ["hifz_logs", "kitab_logs"],
    metadataKeys: ["hifz_logs", "kitab_logs", "hifz_records"],
  },
  attendance: {
    tables: ["attendance", "teacher_attendance"],
    metadataKeys: ["biometric_devices", "biometric_mappings", "biometric_logs", "teacher_attendance"],
  },
  exams: {
    tables: ["exams", "exam_subjects", "exam_results"],
    metadataKeys: ["published_exams", "exam_end_dates", "exam_subjects"],
  },
  question_bank: {
    tables: ["question_bank", "exam_papers"],
    metadataKeys: ["question_bank", "exam_papers", "exam_papers_data"],
  },
  fees: {
    tables: [
      "fee_types",
      "fee_structures",
      "fee_structure_items",
      "student_fees",
      "fee_discount_waivers",
    ],
    metadataKeys: [
      "fee_types",
      "fee_structures",
      "student_fees",
      "discounts",
      "receipt_counter",
    ],
  },
  finance_transactions: {
    tables: ["fees", "fee_payments", "fee_payment_allocations"],
    metadataKeys: ["payments", "fee_payments", "fee_payment_allocations"],
  },
  expenses: {
    tables: ["expenses", "bazar_expenses"],
    metadataKeys: ["bazar_expenses"],
  },
  zakat_donations: {
    tables: ["donations", "zakat_funds"],
    metadataKeys: ["donations", "zakat_funds", "online_donations"],
  },
  donors_funds: {
    tables: ["donors", "funds"],
    metadataKeys: ["donors", "funds", "custom_funds"],
  },
  fundraising_special: {
    tables: [],
    metadataKeys: [
      "mahfils",
      "life_members",
      "life_member_donors",
      "subscription_payments",
      "donor_subscription_payments",
      "qurbani_leathers",
      "qurbani_leather_records",
      "leather_batches",
      "donation_boxes",
      "box_collections",
      "donation_box_logs",
    ],
  },
  payment_gateway: {
    tables: ["gateways"],
    metadataKeys: [
      "gateways",
      "online_settings",
      "online_donation_settings",
      "payment_gateway_config",
      "online_transactions",
    ],
  },
  boarding: {
    tables: ["meal_entries"],
    metadataKeys: ["meal_entries", "boarding_bazar_logs"],
  },
  library: {
    tables: ["books", "book_issues"],
    metadataKeys: ["books", "book_issues", "library_books"],
  },
  inventory: {
    tables: ["inventory_items"],
    metadataKeys: ["inventory"],
  },
  staff: {
    tables: ["teachers", "users"],
    metadataKeys: [
      "users",
      "staff_members",
      "staff_departments",
      "staff_categories",
      "staff_designations",
      "staff_leave_requests",
      "staff_salary_records",
      "staff_audit_logs",
      "staff_id_prefix",
      "staff_id_serial_counter",
    ],
  },
  communication: {
    tables: [],
    metadataKeys: ["parent_feedbacks", "parent_appointments", "absence_alerts"],
  },
  notices_sms: {
    tables: ["notices", "sms_templates", "sms_logs"],
    metadataKeys: [
      "notices",
      "sms_templates",
      "sms_logs",
      "sms_gateway",
      "system_notifications",
      "read_notification_ids",
    ],
  },
  settings: {
    tables: [],
    metadataKeys: [
      "sessions",
      "academic_sessions",
      "academic_holidays",
      "weekend_days",
      "prefix",
      "short_code",
      "madrasas",
      "logo_url",
      "website",
      "slogan",
      "principal_name",
      "established_year",
      "eiin_code",
      "signature_url",
      "reg_no",
      "audit_settings",
      "id_year_format",
      "mohtamim_name",
    ],
  },
  audit_logs: {
    tables: ["fee_audit_logs"],
    metadataKeys: ["audit_logs", "backup_history", "system_audit_logs", "activity_logs"],
  },
};

export interface ResolvedBackupSelection {
  isFull: boolean;
  modules: string[];
  tables: Set<string> | "ALL";
  metadataKeys: Set<string> | "ALL";
  includeMadrasaProfile: boolean;
}

/**
 * নির্দিষ্ট মডিউল-তালিকাকে বাস্তবসম্মত "কী কী ডেটা নিতে হবে"-তে রূপান্তর করে।
 *
 * - কোনো মডিউল দেওয়া না হলে / সব মডিউল দেওয়া হলে / `all_metadata` থাকলে → সম্পূর্ণ ব্যাকআপ
 *   (পুরোনো আচরণ অপরিবর্তিত, backward-compatible)
 * - অন্যথায় কেবল নির্বাচিত মডিউলগুলোর টেবিল ও metadata key
 * - `madrasa` প্রোফাইল কেবল `settings` নির্বাচিত থাকলে (নাহলে শুধু ছাত্র-ব্যাকআপে
 *   মাদ্রাসার নাম/ঠিকানা বদলে যাওয়ার ঝুঁকি)
 */
export function resolveBackupSelection(modules?: BackupModuleKey[]): ResolvedBackupSelection {
  const requested = Array.isArray(modules)
    ? modules.filter(Boolean).map((m) => String(m))
    : [];

  const hasAllMetadata = requested.includes("all_metadata");
  // পুরোনো ক্লায়েন্ট/ফাইল থেকে আসা "ALL" সেন্টিনেলও সম্পূর্ণ ব্যাকআপ হিসেবে ধরা হয়
  const hasAllSentinel = requested.includes("ALL");
  const everyModuleSelected =
    ALL_BACKUP_MODULE_KEYS.length > 0 &&
    ALL_BACKUP_MODULE_KEYS.every((key) => requested.includes(key));
  const isFull = requested.length === 0 || hasAllMetadata || hasAllSentinel || everyModuleSelected;

  if (isFull) {
    return {
      isFull: true,
      modules: requested.length > 0 ? requested : [...ALL_BACKUP_MODULE_KEYS],
      tables: "ALL",
      metadataKeys: "ALL",
      includeMadrasaProfile: true,
    };
  }

  const tables = new Set<string>();
  const metadataKeys = new Set<string>();

  for (const key of requested) {
    const spec = BACKUP_MODULE_SPECS[key];
    if (!spec) continue;
    spec.tables.forEach((t) => tables.add(t));
    spec.metadataKeys.forEach((k) => metadataKeys.add(k));
  }

  return {
    isFull: false,
    modules: requested,
    tables,
    metadataKeys,
    includeMadrasaProfile: requested.includes("settings"),
  };
}

export function isMetadataKeySelected(
  key: string,
  selection: ResolvedBackupSelection
): boolean {
  return selection.metadataKeys === "ALL" || selection.metadataKeys.has(key);
}

export function isTableSelected(table: string, selection: ResolvedBackupSelection): boolean {
  return selection.tables === "ALL" || selection.tables.has(table);
}
