export const MADRASA_A_ID = "11111111-1111-4111-8111-111111111111";
export const MADRASA_B_ID = "22222222-2222-4222-8222-222222222222";

export const MADRASA_A = {
  id: MADRASA_A_ID,
  name: "জামিয়া ইসলামিয়া দারুল উলুম ঢাকা",
  contact_email: "info@jamia-dhaka.example.com",
  principal_name: "মাওলানা আব্দুর রহমান",
  registration_no: "QAWMI-DHK-1447",
  reg_no: "QAWMI-DHK-1447",
  address: "মিরপুর-১০, ঢাকা-১২১৬",
  phone: "01711000111",
  email: "info@jamia-dhaka.example.com",
  currency: "BDT",
  weekend_days: ["Friday"],
  subscription_plan: "enterprise",
  metadata: {},
  security_metadata: {},
};

export const MADRASA_B = {
  id: MADRASA_B_ID,
  name: "মাদ্রাসাতুল মদিনা চট্টগ্রাম",
  contact_email: "info@madina-ctg.example.com",
  principal_name: "মুফতি জাকারিয়া",
  registration_no: "QAWMI-CTG-1447",
  reg_no: "QAWMI-CTG-1447",
  address: "চকবাজার, চট্টগ্রাম",
  phone: "01811000222",
  email: "info@madina-ctg.example.com",
  currency: "BDT",
  weekend_days: ["Friday"],
  subscription_plan: "enterprise",
  metadata: {},
  security_metadata: {},
};

export interface FixtureUser {
  id: string;
  madrasaId: string;
  role: string;
  fullName: string;
  email: string;
  phone: string;
  status?: "ACTIVE" | "INVITED" | "SUSPENDED" | "DISABLED";
  roles?: string[];
  directPermissions?: string[];
  deniedPermissions?: string[];
}

export const USERS = {
  superAdminA: {
    id: "aaaaaaaa-0001-4000-8000-000000000001",
    madrasaId: MADRASA_A_ID,
    role: "super_admin",
    fullName: "সুপার অ্যাডমিন (জামিয়া ঢাকা)",
    email: "superadmin@jamia-dhaka.example.com",
    phone: "01711111101",
  } satisfies FixtureUser,
  muhtamimA: {
    id: "aaaaaaaa-0002-4000-8000-000000000002",
    madrasaId: MADRASA_A_ID,
    role: "muhtamim",
    fullName: "মাওলানা আব্দুর রহমান",
    email: "muhtamim@jamia-dhaka.example.com",
    phone: "01711111102",
  } satisfies FixtureUser,
  naibMuhtamimA: {
    id: "aaaaaaaa-0003-4000-8000-000000000003",
    madrasaId: MADRASA_A_ID,
    role: "naib_muhtamim",
    fullName: "মাওলানা ফজলুল হক",
    email: "naib@jamia-dhaka.example.com",
    phone: "01711111103",
    directPermissions: [
      "approval.view",
      "approval.approve",
      "finance.view",
      "finance.approve",
      "fee.view",
      "fee.approve",
      "analytics.early_warning",
      "anomaly.view",
    ],
  } satisfies FixtureUser,
  accountantA: {
    id: "aaaaaaaa-0004-4000-8000-000000000004",
    madrasaId: MADRASA_A_ID,
    role: "accountant",
    fullName: "মুহাম্মদ সালমান",
    email: "accountant@jamia-dhaka.example.com",
    phone: "01711111104",
  } satisfies FixtureUser,
  teacherA: {
    id: "aaaaaaaa-0005-4000-8000-000000000005",
    madrasaId: MADRASA_A_ID,
    role: "teacher",
    fullName: "মাওলানা ইব্রাহিম",
    email: "teacher@jamia-dhaka.example.com",
    phone: "01711111105",
  } satisfies FixtureUser,
  ustadA: {
    id: "aaaaaaaa-0006-4000-8000-000000000006",
    madrasaId: MADRASA_A_ID,
    role: "ustad",
    fullName: "উস্তাদ জাফর আহমেদ",
    email: "ustad@jamia-dhaka.example.com",
    phone: "01711111106",
    directPermissions: ["attendance.view", "analytics.early_warning"],
  } satisfies FixtureUser,
  hifzSupervisorA: {
    id: "aaaaaaaa-0007-4000-8000-000000000007",
    madrasaId: MADRASA_A_ID,
    role: "hifz_supervisor",
    fullName: "হাফেজ তারেক মাহমুদ",
    email: "hifz@jamia-dhaka.example.com",
    phone: "01711111107",
  } satisfies FixtureUser,
  examManagerA: {
    id: "aaaaaaaa-0008-4000-8000-000000000008",
    madrasaId: MADRASA_A_ID,
    role: "exam_manager",
    fullName: "মাওলানা নাজিম উদ্দিন",
    email: "exam@jamia-dhaka.example.com",
    phone: "01711111108",
  } satisfies FixtureUser,
  officeStaffA: {
    id: "aaaaaaaa-0009-4000-8000-000000000009",
    madrasaId: MADRASA_A_ID,
    role: "office_staff",
    fullName: "মোঃ করিম উদ্দিন",
    email: "office@jamia-dhaka.example.com",
    phone: "01711111109",
    directPermissions: ["student.view", "student.export"],
  } satisfies FixtureUser,
  librarianA: {
    id: "aaaaaaaa-0010-4000-8000-000000000010",
    madrasaId: MADRASA_A_ID,
    role: "librarian",
    fullName: "মোঃ জসিম উদ্দিন",
    email: "librarian@jamia-dhaka.example.com",
    phone: "01711111110",
  } satisfies FixtureUser,
  parentA: {
    id: "aaaaaaaa-0011-4000-8000-000000000011",
    madrasaId: MADRASA_A_ID,
    role: "parent",
    fullName: "আব্দুল্লাহ-এর অভিভাবক",
    email: "parent@jamia-dhaka.example.com",
    phone: "01712345890",
  } satisfies FixtureUser,
  studentA: {
    id: "aaaaaaaa-0012-4000-8000-000000000012",
    madrasaId: MADRASA_A_ID,
    role: "student",
    fullName: "আব্দুল্লাহ আল মামুন",
    email: "student@jamia-dhaka.example.com",
    phone: "01712345890",
  } satisfies FixtureUser,
  suspendedStaffA: {
    id: "aaaaaaaa-0013-4000-8000-000000000013",
    madrasaId: MADRASA_A_ID,
    role: "accountant",
    fullName: "স্থগিত হিসাবরক্ষক",
    email: "suspended@jamia-dhaka.example.com",
    phone: "01711111113",
    status: "SUSPENDED",
  } satisfies FixtureUser,
  viewOnlyStaffA: {
    id: "aaaaaaaa-0014-4000-8000-000000000014",
    madrasaId: MADRASA_A_ID,
    role: "custom_viewer",
    roles: ["custom_viewer"],
    fullName: "ভিউ-অনলি স্টাফ",
    email: "viewer@jamia-dhaka.example.com",
    phone: "01711111114",
    directPermissions: ["attendance.view", "notification.view"],
  } satisfies FixtureUser,
  muhtamimB: {
    id: "bbbbbbbb-0001-4000-8000-000000000001",
    madrasaId: MADRASA_B_ID,
    role: "muhtamim",
    fullName: "মুফতি জাকারিয়া",
    email: "muhtamim@madina-ctg.example.com",
    phone: "01822222201",
  } satisfies FixtureUser,
  accountantB: {
    id: "bbbbbbbb-0002-4000-8000-000000000002",
    madrasaId: MADRASA_B_ID,
    role: "accountant",
    fullName: "মোঃ রাশেদ (চট্টগ্রাম)",
    email: "accountant@madina-ctg.example.com",
    phone: "01822222202",
  } satisfies FixtureUser,
};

export const CLASSES_A = {
  mizan: {
    id: "c1111111-0001-4000-8000-000000000001",
    madrasa_id: MADRASA_A_ID,
    name: "মিজান জামাত",
    description: "কিতাব বিভাগ — মিজান জামাত",
  },
  hifz: {
    id: "c1111111-0002-4000-8000-000000000002",
    madrasa_id: MADRASA_A_ID,
    name: "হিফজুল কুরআন",
    description: "হিফজ বিভাগ",
  },
  hidaya: {
    id: "c1111111-0003-4000-8000-000000000003",
    madrasa_id: MADRASA_A_ID,
    name: "হিদায়া জামাত",
    description: "উচ্চতর কিতাব বিভাগ",
  },
  nahbemir: {
    id: "c1111111-0004-4000-8000-000000000004",
    madrasa_id: MADRASA_A_ID,
    name: "নাহবেমীর",
    description: "আরবি ব্যাকরণ স্তর",
  },
  noorani: {
    id: "c1111111-0005-4000-8000-000000000005",
    madrasa_id: MADRASA_A_ID,
    name: "নূরানী",
    description: "প্রাথমিক নূরানী বিভাগ",
  },
};

export const CLASSES_B = {
  mizan: {
    id: "c2222222-0001-4000-8000-000000000001",
    madrasa_id: MADRASA_B_ID,
    name: "মিজান জামাত",
    description: "চট্টগ্রাম শাখা মিজান জামাত",
  },
};

export const STUDENTS_A = {
  abdullah: {
    id: "d1111111-0001-4000-8000-000000000001",
    madrasa_id: MADRASA_A_ID,
    first_name: "আব্দুল্লাহ",
    last_name: "আল মামুন",
    roll_number: "101",
    class_id: CLASSES_A.mizan.id,
    class_name: CLASSES_A.mizan.name,
    parent_phone: "01712345890",
    father_name: "মোঃ আব্দুর রহিম",
    address: "মিরপুর-১০, ঢাকা",
    nid_or_birth_cert: "1995123456789",
    parent_email: "rahim.guardian@example.com",
  },
  yusuf: {
    id: "d1111111-0002-4000-8000-000000000002",
    madrasa_id: MADRASA_A_ID,
    first_name: "মোহাম্মদ",
    last_name: "ইউসুফ",
    roll_number: "102",
    class_id: CLASSES_A.mizan.id,
    class_name: CLASSES_A.mizan.name,
    parent_phone: "01812345678",
    father_name: "মোঃ শফিকুল ইসলাম",
    address: "উত্তরা, ঢাকা",
    nid_or_birth_cert: "2008123456789",
    parent_email: "shafiq.guardian@example.com",
  },
  habibur: {
    id: "d1111111-0003-4000-8000-000000000003",
    madrasa_id: MADRASA_A_ID,
    first_name: "হাবিবুর",
    last_name: "রহমান",
    roll_number: "103",
    class_id: CLASSES_A.mizan.id,
    class_name: CLASSES_A.mizan.name,
    parent_phone: "01912345670",
    father_name: "মরহুম আব্দুল করিম",
    address: "যাত্রাবাড়ী, ঢাকা",
    nid_or_birth_cert: "2009123456780",
  },
  saifulHifz: {
    id: "d1111111-0004-4000-8000-000000000004",
    madrasa_id: MADRASA_A_ID,
    first_name: "সাইফুল",
    last_name: "ইসলাম",
    roll_number: "201",
    class_id: CLASSES_A.hifz.id,
    class_name: CLASSES_A.hifz.name,
    parent_phone: "01612345111",
    father_name: "মোঃ রফিকুল ইসলাম",
    address: "মোহাম্মদপুর, ঢাকা",
  },
  arifNoorani: {
    id: "d1111111-0005-4000-8000-000000000005",
    madrasa_id: MADRASA_A_ID,
    first_name: "আরিফ",
    last_name: "বিল্লাহ",
    roll_number: "301",
    class_id: CLASSES_A.noorani.id,
    class_name: CLASSES_A.noorani.name,
    parent_phone: "01512345222",
    father_name: "মোঃ নুরুল আমিন",
    address: "ধানমন্ডি, ঢাকা",
  },
};

export const STUDENTS_B = {
  tariq: {
    id: "d2222222-0001-4000-8000-000000000001",
    madrasa_id: MADRASA_B_ID,
    first_name: "তারেক",
    last_name: "জামিল",
    roll_number: "B-101",
    class_id: CLASSES_B.mizan.id,
    class_name: CLASSES_B.mizan.name,
    parent_phone: "01899887766",
    father_name: "মোঃ নাসির উদ্দিন",
    address: "চকবাজার, চট্টগ্রাম",
  },
};

export const DONOR_A = {
  id: "e1111111-0001-4000-8000-000000000001",
  madrasa_id: MADRASA_A_ID,
  name: "হাজী আব্দুস সালাম",
  phone: "01911223344",
  email: "salam.donor@example.com",
  nid: "19801234567890123",
  bank_account: "2050123456789012",
  address: "গুলশান-২, ঢাকা",
  donor_type: "Zakat",
};

export const SESSION_A_1447 = {
  id: "sess_a_1447",
  madrasa_id: MADRASA_A_ID,
  name: "শিক্ষাবর্ষ ১৪৪৬-৪৭ হিজরি",
  code: "1446-47",
  hijri_year: "1447",
  start_date: "2026-01-01",
  end_date: "2026-12-31",
  is_active: true,
  status: "ACTIVE",
  is_locked: false,
};

export const SESSION_A_1446 = {
  id: "sess_a_1446",
  madrasa_id: MADRASA_A_ID,
  name: "শিক্ষাবর্ষ ১৪৪৫-৪৬ হিজরি",
  code: "1445-46",
  hijri_year: "1446",
  start_date: "2025-01-01",
  end_date: "2025-12-31",
  is_active: false,
  status: "ARCHIVED",
  is_locked: true,
};

export const ZAKAT_FUNDS_A = [
  {
    id: "fund-zakat",
    madrasa_id: MADRASA_A_ID,
    name: "যাকাত ফান্ড",
    code: "ZKT",
    category: "Zakat",
    target_amount: 500000,
    current_balance: 250000,
    is_active: true,
  },
  {
    id: "fund-lillah",
    madrasa_id: MADRASA_A_ID,
    name: "লিল্লাহ বোর্ডিং ফান্ড",
    code: "LIL",
    category: "Lillah",
    target_amount: 400000,
    current_balance: 120000,
    is_active: true,
  },
  {
    id: "fund-general",
    madrasa_id: MADRASA_A_ID,
    name: "সাধারণ ফান্ড",
    code: "GEN",
    category: "General",
    target_amount: 300000,
    current_balance: 90000,
    is_active: true,
  },
];

export const ZAKAT_FUNDS_B = [
  {
    id: "fund-zakat-b",
    madrasa_id: MADRASA_B_ID,
    name: "যাকাত ফান্ড (চট্টগ্রাম)",
    code: "ZKT-B",
    category: "Zakat",
    target_amount: 200000,
    current_balance: 80000,
    is_active: true,
  },
];

export function makeLargeExpenseWorkflow(madrasaId: string = MADRASA_A_ID) {
  return {
    id: "wf-large-expense-a",
    madrasa_id: madrasaId,
    name: "বড় অঙ্কের খরচ অনুমোদন",
    request_type: "LARGE_EXPENSE",
    min_amount_threshold: 10000,
    threshold_amount: 10000,
    is_active: true,
    steps: [
      {
        id: "wfs-1",
        workflow_id: "wf-large-expense-a",
        madrasa_id: madrasaId,
        step_order: 1,
        approver_role: "accountant",
        required_permission: "finance.approve",
        sla_hours: 24,
        require_step_up: false,
      },
      {
        id: "wfs-2",
        workflow_id: "wf-large-expense-a",
        madrasa_id: madrasaId,
        step_order: 2,
        approver_role: "naib_muhtamim",
        required_permission: "approval.approve",
        sla_hours: 24,
        require_step_up: false,
      },
      {
        id: "wfs-3",
        workflow_id: "wf-large-expense-a",
        madrasa_id: madrasaId,
        step_order: 3,
        approver_role: "muhtamim",
        required_permission: "finance.approve",
        sla_hours: 48,
        require_step_up: true,
      },
    ],
  };
}

export const WATERMARK_CTX_A = {
  exportedBy: "মাওলানা আব্দুর রহমান",
  actorRole: "muhtamim",
  ipAddress: "103.112.54.22",
  madrasaName: MADRASA_A.name,
  dataset: "students",
  exportId: "exp_test_001",
};
