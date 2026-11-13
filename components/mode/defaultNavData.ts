export interface SerializedNavItem {
  id: string;
  name: string;
  href: string;
  iconName: string;
  exact?: boolean;
  permission?: string;
  roles?: string[];
  badge?: string;
  badgeColor?: string;
  keywords?: string[];
  hidden?: boolean;
}

export interface SerializedNavGroup {
  id: string;
  title: string;
  iconName: string;
  hidden?: boolean;
  items: SerializedNavItem[];
}

export const INITIAL_NAV_GROUPS: SerializedNavGroup[] = [
  {
    id: "students",
    title: "শিক্ষার্থী ব্যবস্থাপনা",
    iconName: "Users",
    items: [
      {
        id: "student_list",
        name: "শিক্ষার্থী তালিকা ও প্রোফাইল",
        href: "/dashboard/students",
        iconName: "Users",
        permission: "student.view",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "admin", "office_staff", "teacher", "education_secretary"],
        keywords: ["student", "shikkharthi", "talika", "profile", "ছাত্র", "তালিকা"],
      },
      {
        id: "student_new",
        name: "নতুন শিক্ষার্থী যোগ (Add Student)",
        href: "/dashboard/students/new",
        iconName: "UserPlus",
        permission: "student.edit",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "admin", "office_staff", "education_secretary"],
        badge: "অ্যাডমিন এন্ট্রি",
        badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
        keywords: ["add student", "new student", "notun shatro", "ছাত্র যোগ", "নতুন ছাত্র", "ভর্তি"],
      },
      {
        id: "student_bulk",
        name: "বাল্ক শিক্ষার্থী যোগ (Excel/JSON)",
        href: "/dashboard/students/new?tab=bulk",
        iconName: "FileSpreadsheet",
        permission: "student.edit",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "admin", "office_staff", "education_secretary"],
        badge: "অটো-রোল",
        badgeColor: "bg-teal-500/20 text-teal-300 border-teal-500/30",
        keywords: ["bulk student", "excel import", "json", "বাল্ক ভর্তি", "এক্সেল", "আমদানি", "অটো রোল"],
      },
      {
        id: "admissions",
        name: "অনলাইন ভর্তি আবেদন ও যাচাই",
        href: "/dashboard/admissions",
        iconName: "GraduationCap",
        permission: "student.view",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "admin", "office_staff", "education_secretary"],
        badge: "অনলাইন পোর্টাল",
        badgeColor: "bg-blue-500/20 text-blue-300 border-blue-500/30",
        keywords: ["admission", "vorti", "abedon", "ভর্তি", "আবেদন", "অনলাইন ভর্তি"],
      },
      {
        id: "promotion",
        name: "শিক্ষার্থী প্রমোশন ও জামাত পরিবর্তন",
        href: "/dashboard/students/promotion",
        iconName: "ArrowUpRight",
        permission: "student.edit",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "admin", "education_secretary"],
        keywords: ["promotion", "upgrade", "প্রমোশন", "জামাত পরিবর্তন"],
      },
      {
        id: "id_cards",
        name: "আইডি কার্ড জেনারেটর",
        href: "/dashboard/academic/id-cards",
        iconName: "IdCard",
        permission: "id.view",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "office_staff", "admin"],
        keywords: ["id card", "card", "পরিচয়পত্র", "আইডি কার্ড"],
      },
      {
        id: "alumni",
        name: "ফারিগীন ও অ্যালামনাই",
        href: "/dashboard/alumni",
        iconName: "UserCheck",
        permission: "student.view",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "admin", "office_staff", "teacher", "education_secretary"],
        keywords: ["alumni", "farigin", "সমাবর্তন", "ফারিগীন", "প্রাক্তন"],
      },
    ],
  },
  {
    id: "staff",
    title: "শিক্ষক ও স্টাফ (HR)",
    iconName: "Users",
    items: [
      {
        id: "staff_list",
        name: "শিক্ষক ও স্টাফ তালিকা",
        href: "/dashboard/staff",
        iconName: "Users",
        permission: "staff.view",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "admin", "hr_manager", "education_secretary"],
        keywords: ["staff", "teacher", "hr", "উস্তাদ", "শিক্ষক", "স্টাফ"],
      },
      {
        id: "staff_new",
        name: "নতুন শিক্ষক ও স্টাফ যোগ",
        href: "/dashboard/staff?action=new",
        iconName: "UserCheck",
        permission: "staff.edit",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "admin", "hr_manager"],
        keywords: ["teacher add", "new staff", "নতুন শিক্ষক", "নিয়োগ"],
      },
    ],
  },
  {
    id: "academic",
    title: "একাডেমিক ও পাঠদান",
    iconName: "BookOpen",
    items: [
      {
        id: "sessions",
        name: "শিক্ষাবর্ষ ও সেশন (Sessions)",
        href: "/dashboard/academic/sessions",
        iconName: "CalendarDays",
        permission: "academic.manage",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "admin", "education_secretary"],
        keywords: ["session", "academic year", "শিক্ষাবর্ষ", "সেশন"],
      },
      {
        id: "classes",
        name: "জামাত ও শাখা (Classes)",
        href: "/dashboard/classes",
        iconName: "BookOpen",
        permission: "academic.view",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "admin", "education_secretary", "office_staff"],
        keywords: ["class", "jamat", "shakha", "ক্লাস", "জামাত", "শাখা"],
      },
      {
        id: "subjects",
        name: "কিতাব ও বিষয়সমূহ (Subjects)",
        href: "/dashboard/subjects",
        iconName: "BookOpen",
        permission: "academic.manage",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "admin", "education_secretary"],
        keywords: ["subject", "kitab", "bishoy", "কিতাব", "বিষয়"],
      },
      {
        id: "routine",
        name: "ক্লাস ও বিষয় রুটিন (Routine)",
        href: "/dashboard/academic/routine",
        iconName: "CalendarDays",
        permission: "routine.view",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "teacher", "admin", "education_secretary"],
        keywords: ["routine", "schedule", "ক্লাস রুটিন", "সময়সূচি"],
      },
      {
        id: "assignments",
        name: "দৈনিক পড়া ও অ্যাসাইনমেন্ট (Assignments)",
        href: "/dashboard/assignments",
        iconName: "FileText",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "admin", "office_staff", "teacher", "education_secretary"],
        badge: "অ্যাসাইনমেন্ট",
        badgeColor: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
        keywords: ["assignment", "assignments", "homework", "হোমওয়ার্ক", "অ্যাসাইনমেন্ট", "পড়া", "দৈনিক পড়া", "work", "task"],
      },
      {
        id: "kitab",
        name: "কিতাব ও দারস ট্র্যাকিং",
        href: "/dashboard/kitab",
        iconName: "Library",
        permission: "library.view",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "teacher", "librarian"],
        keywords: ["dars", "kitab tracking", "দরস", "দারস"],
      },
      {
        id: "syllabus",
        name: "সিলেবাস ও অগ্রগতি গোয়েন্দা ট্র্যাকার",
        href: "/dashboard/academic/syllabus",
        iconName: "Sparkles",
        permission: "academic.view",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "admin", "education_secretary", "teacher"],
        badge: "ইন্টেলিজেন্স",
        badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
        keywords: ["syllabus", "progress", "revision", "forecast", "সিলেবাস", "অগ্রগতি", "রিভিশন", "কর্মদিবস", "পড়া"],
      },
    ],
  },
  {
    id: "hifz",
    title: "হিফজুল কুরআন বিভাগ",
    iconName: "BookOpen",
    items: [
      {
        id: "hifz_dashboard",
        name: "হিফজ ড্যাশবোর্ড ও ট্র্যাকিং",
        href: "/dashboard/hifz",
        iconName: "BookOpen",
        permission: "hifz.view",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "hifz_supervisor", "hifz_teacher", "teacher", "admin"],
        badge: "হিফজ",
        badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/30",
        keywords: ["hifz", "quran", "হিফজ", "কুরআন", "পারা", "হাফেজ", "সবক", "আমুক্তা", "নাযেরা"],
      },
    ],
  },
  {
    id: "attendance",
    title: "হাজিরা ও ছুটি",
    iconName: "CheckSquare",
    items: [
      {
        id: "attendance_daily",
        name: "দৈনিক হাজিরা গ্রহণ",
        href: "/dashboard/attendance",
        iconName: "CheckSquare",
        permission: "attendance.view",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "teacher", "attendance_manager", "admin"],
        keywords: ["attendance", "hazira", "হাজিরা", "উপস্থিতি"],
      },
      {
        id: "attendance_reports",
        name: "হাজিরা রিপোর্ট ও শিট",
        href: "/dashboard/attendance/reports",
        iconName: "FileText",
        permission: "attendance.view",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "admin", "education_secretary", "teacher", "attendance_manager"],
        keywords: ["attendance report", "sheet", "হাজিরা রিপোর্ট"],
      },
      {
        id: "amal_tracker",
        name: "বাড়ির কর্মসূচি ও আমল ট্র্যাকার",
        href: "/dashboard/academic/amal-tracker",
        iconName: "ShieldCheck",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "admin", "office_staff", "teacher", "education_secretary"],
        badge: "আমলনামা A4",
        badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
        keywords: ["amal", "amal tracker", "home routine", "ছুটির আমল", "আমলনামা", "আমল ট্র্যাকার", "নামাজ ট্র্যাকার", "কর্মসূচি", "রোজা"],
      },
      {
        id: "attendance_leaves",
        name: "ছুটি অনুমোদন ও দরখাস্ত (Leaves)",
        href: "/dashboard/attendance/leaves",
        iconName: "CalendarDays",
        permission: "attendance.view",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "admin", "education_secretary", "teacher", "office_staff"],
        keywords: ["leave", "chuti", "ছুটি", "দরখাস্ত"],
      },
      {
        id: "attendance_holidays",
        name: "বার্ষিক ছুটি ও ক্যালেন্ডার (Holidays)",
        href: "/dashboard/attendance/holidays",
        iconName: "CalendarDays",
        permission: "attendance.view",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "admin", "education_secretary", "teacher", "office_staff"],
        keywords: ["holiday", "calendar", "অবকাশ", "ছুটির তালিকা"],
      },
    ],
  },
  {
    id: "exams",
    title: "পরীক্ষা ও মূল্যায়ন",
    iconName: "Award",
    items: [
      {
        id: "exams_list",
        name: "পরীক্ষা ও ফলাফল তালিকা",
        href: "/dashboard/exams",
        iconName: "Award",
        permission: "exam.view",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "teacher", "exam_manager", "admin", "education_secretary"],
        keywords: ["exam", "porikkha", "result", "ফলাফল", "পরীক্ষা"],
      },
      {
        id: "question_bank",
        name: "প্রশ্নব্যাংক ও প্রশ্নপত্র জেনারেটর",
        href: "/dashboard/exams/question-bank",
        iconName: "FileText",
        permission: "exam.view",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "teacher", "exam_manager", "admin"],
        badge: "স্পেশালাইজড",
        badgeColor: "bg-purple-500/20 text-purple-300 border-purple-500/30",
        keywords: ["question", "question bank", "builder", "proshno", "প্রশ্নব্যাংক", "প্রশ্নপত্র", "ইবারত", "তাহকীক"],
      },
      {
        id: "certificates",
        name: "সনদ ও মার্কশিট প্রিন্ট",
        href: "/dashboard/academic/certificates",
        iconName: "Award",
        permission: "certificate.view",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "exam_manager", "admin", "office_staff"],
        keywords: ["certificate", "marksheet", "সনদ", "নম্বরপত্র", "মার্কশিট"],
      },
      {
        id: "verification",
        name: "অনলাইন যাচাইকরণ ও সিকিউরিটি লগ",
        href: "/dashboard/academic/verification",
        iconName: "ShieldCheck",
        permission: "certificate.view",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "exam_manager", "admin", "office_staff"],
        badge: "সিকিউরিটি",
        badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
        keywords: ["verification", "verify", "audit", "log", "security", "যাচাইকরণ", "সনদ যাচাই", "আইডি যাচাই", "লগ", "নিরাপত্তা"],
      },
    ],
  },
  {
    id: "finance",
    title: "হিসাব ও তহবিল ব্যবস্থাপনা",
    iconName: "Wallet",
    items: [
      {
        id: "finance_main",
        name: "অর্থ ও ফি কালেকশন (Finance)",
        href: "/dashboard/accounting",
        iconName: "Wallet",
        permission: "finance.view",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "admin", "accountant"],
        keywords: ["finance", "fee", "collection", "হিসাব", "ফি"],
      },
      {
        id: "finance_due",
        name: "বকেয়া ফি ও তাগাদা",
        href: "/dashboard/accounting/due",
        iconName: "Wallet",
        permission: "finance.view",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "admin", "accountant"],
        keywords: ["due", "bokeya", "বকেয়া", "তাগাদা"],
      },
      {
        id: "finance_expenses",
        name: "দৈনিক খরচ ও ভাউচার",
        href: "/dashboard/accounting/expenses",
        iconName: "Wallet",
        permission: "finance.view",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "admin", "accountant"],
        keywords: ["expense", "voucher", "খরচ", "ভাউচার"],
      },
      {
        id: "finance_reports",
        name: "আর্থিক রিপোর্ট ও লেজার",
        href: "/dashboard/accounting/reports",
        iconName: "Scale",
        permission: "finance.view",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "admin", "accountant"],
        keywords: ["report", "ledger", "আর্থিক রিপোর্ট", "খতিয়ান"],
      },
      {
        id: "zakat_funds",
        name: "ফান্ড ক্যাটাগরি ও ব্যবস্থাপনা",
        href: "/dashboard/zakat/funds",
        iconName: "Layers",
        permission: "finance.view",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "accountant"],
        badge: "ফান্ড খাত",
        badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
        keywords: ["fund", "funds", "management", "ফান্ড", "তহবিল", "খাত ব্যবস্থাপনা", "জমা খরচ খাত"],
      },
      {
        id: "zakat_reports",
        name: "তহবিল অডিট ও ব্যালেন্স রিপোর্ট",
        href: "/dashboard/zakat/reports",
        iconName: "FileText",
        permission: "finance.view",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "accountant"],
        badge: "অডিট রিপোর্ট",
        badgeColor: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
        keywords: ["fund report", "audit", "balance", "তহবিল অডিট", "ফান্ড রিপোর্ট", "ব্যালেন্স"],
      },
      {
        id: "finance_audit",
        name: "বার্ষিক শুরা অডিট",
        href: "/dashboard/accounting/audit",
        iconName: "Scale",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "admin", "accountant"],
        keywords: ["audit", "shura", "অডিট", "শুরা"],
      },
    ],
  },
  {
    id: "fundraising",
    title: "কালেকশন, দাতা ও মাহফিল",
    iconName: "HeartHandshake",
    items: [
      {
        id: "zakat_collect",
        name: "যাকাত ও অনুদান সংগ্রহ",
        href: "/dashboard/zakat/collection",
        iconName: "HeartHandshake",
        permission: "finance.view",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "accountant"],
        badge: "তাৎক্ষণিক রসিদ",
        badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
        keywords: ["zakat collection", "donation", "দান", "যাকাত কালেকশন", "অনুদান সংগ্রহ", "রসিদ"],
      },
      {
        id: "zakat_register",
        name: "যাকাত ও অনুদান রেজিস্টার",
        href: "/dashboard/zakat",
        iconName: "HeartHandshake",
        permission: "finance.view",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "accountant"],
        badge: "হিস্ট্রি",
        badgeColor: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
        keywords: ["zakat register", "history", "যাকাত রেজিস্টার", "কালেকশন হিস্ট্রি"],
      },
      {
        id: "donors_register",
        name: "কেন্দ্রীয় সম্মানিত দাতা রেজিস্টার",
        href: "/dashboard/fundraising/donors",
        iconName: "Users",
        permission: "finance.view",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "admin", "accountant"],
        badge: "সকল দাতা",
        badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/30",
        keywords: ["donor", "master donor", "shuvosongkhi", "monthly donor", "life member", "দাতা", "আজীবন সদস্য", "মাসিক চাঁদা", "শুভাকাঙ্ক্ষী", "দাতা তালিকা"],
      },
      {
        id: "mahfil",
        name: "বার্ষিক মাহফিল ও মহাসম্মেলন",
        href: "/dashboard/fundraising/mahfil",
        iconName: "CalendarDays",
        permission: "finance.view",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "admin", "accountant"],
        badge: "মহাসম্মেলন",
        badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/30",
        keywords: ["mahfil", "sommelon", "biddut", "roshid", "মাহফিল", "সম্মেলন", "রসিদ বই", "বক্তা", "বক্তা শিডিউল"],
      },
      {
        id: "collections_qurbani",
        name: "কুরবানির চামড়া ও কালেকশন বক্স",
        href: "/dashboard/fundraising/collections",
        iconName: "Boxes",
        permission: "finance.view",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "admin", "accountant"],
        keywords: ["leather", "chamra", "box", "qurbani", "চামড়া", "কুরবানি", "কালেকশন বক্স", "দানবাক্স"],
      },
      {
        id: "online_donations",
        name: "অনলাইন ডোনেশন ও ভেরিফিকেশন",
        href: "/dashboard/fundraising/online-donations",
        iconName: "Wallet",
        permission: "finance.view",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "admin", "accountant"],
        badge: "ডিজিটাল রসিদ",
        badgeColor: "bg-blue-500/20 text-blue-300 border-blue-500/30",
        keywords: ["online donation", "digital receipt", "অনলাইন দান", "রসিদ", "টাকা প্রদান"],
      },
    ],
  },
  {
    id: "admin_assets",
    title: "হোস্টেল, পরিবহন ও সম্পত্তি",
    iconName: "Briefcase",
    items: [
      {
        id: "transport",
        name: "যানবাহন ও পরিবহন বহর (Transport)",
        href: "/dashboard/transport",
        iconName: "Bus",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "admin", "office_staff"],
        badge: "পরিবহন",
        badgeColor: "bg-blue-500/20 text-blue-300 border-blue-500/30",
        keywords: ["transport", "van", "bus", "gari", "driver", "যানবাহন", "ভ্যান", "বাস", "পরিবহন", "ড্রাইভার"],
      },
      {
        id: "boarding",
        name: "বোর্ডিং ও মিল ব্যবস্থাপনা",
        href: "/dashboard/boarding",
        iconName: "Utensils",
        permission: "staff.view",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "hostel_manager", "admin"],
        keywords: ["boarding", "meal", "hostel", "বোর্ডিং", "খাবার", "মিল"],
      },
      {
        id: "library",
        name: "কুতুবখানা (Library)",
        href: "/dashboard/library",
        iconName: "Library",
        permission: "library.view",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "librarian", "admin"],
        keywords: ["library", "kutubkhana", "বই", "লাইব্রেরি", "কুতুবখানা"],
      },
      {
        id: "inventory",
        name: "ইনভেন্টরি ও সম্পত্তি",
        href: "/dashboard/inventory",
        iconName: "Boxes",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "admin", "accountant", "hostel_manager"],
        keywords: ["inventory", "asset", "সম্পত্তি", "মালামাল"],
      },
    ],
  },
  {
    id: "communication",
    title: "যোগাযোগ ও এসএমএস",
    iconName: "Bell",
    items: [
      {
        id: "notifications",
        name: "বিজ্ঞপ্তি ও অ্যাক্টিভিটি লগ",
        href: "/dashboard/notifications",
        iconName: "Bell",
        permission: "notification.view",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "admin", "office_staff", "teacher"],
        keywords: ["notification", "notice", "নোটিশ", "বিজ্ঞপ্তি"],
      },
      {
        id: "feedback",
        name: "অভিভাবক মতামত ও অভিযোগ",
        href: "/dashboard/communication/feedback",
        iconName: "MessageSquare",
        permission: "notification.view",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "admin", "office_staff", "teacher"],
        keywords: ["feedback", "complaint", "অভিযোগ", "পরামর্শ"],
      },
      {
        id: "absence_alerts",
        name: "অনুপস্থিতির সতর্কতা এসএমএস",
        href: "/dashboard/communication/absence-alerts",
        iconName: "Bell",
        permission: "notification.view",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "admin", "office_staff", "teacher"],
        keywords: ["sms", "alert", "absence", "অনুপস্থিতি এসএমএস"],
      },
      {
        id: "communication_center",
        name: "নোটিশ ও যোগাযোগ কেন্দ্র",
        href: "/dashboard/communication",
        iconName: "MessageSquare",
        permission: "notification.view",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "admin", "office_staff", "teacher"],
        keywords: ["communication", "sms", "বার্তা", "মেসেজ"],
      },
    ],
  },
  {
    id: "print_hub",
    title: "প্রিন্ট ও ফরম হাব",
    iconName: "Printer",
    items: [
      {
        id: "print_hub_main",
        name: "ভর্তি ফরম, মানি রিসিট ও শিট প্রিন্ট",
        href: "/dashboard/print-hub",
        iconName: "Printer",
        badge: "প্রিন্ট হাব",
        badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
        roles: [
          "super_admin",
          "muhtamim",
          "naib_muhtamim",
          "admin",
          "office_staff",
          "teacher",
          "education_secretary",
          "accountant",
          "exam_manager",
        ],
        keywords: ["print", "hub", "form", "receipt", "sheet", "ভর্তি ফরম", "মানি রিসিট", "প্রিন্ট", "খালি শিট", "মূল্যায়ন শিট"],
      },
    ],
  },
  {
    id: "system",
    title: "সিস্টেম ও পোর্টাল",
    iconName: "Settings",
    items: [
      {
        id: "portal_teacher",
        name: "শিক্ষক পোর্টাল (Teacher)",
        href: "/teacher-portal",
        iconName: "GraduationCap",
        exact: true,
        roles: ["super_admin", "teacher", "hifz_teacher", "muhtamim", "naib_muhtamim"],
        keywords: ["teacher portal", "শিক্ষক পোর্টাল"],
      },
      {
        id: "portal_parent",
        name: "প্যারেন্ট পোর্টাল (Parent)",
        href: "/portal",
        iconName: "Users",
        exact: true,
        roles: ["super_admin", "parent", "muhtamim", "naib_muhtamim"],
        keywords: ["parent portal", "অভিভাবক পোর্টাল"],
      },
      {
        id: "system_users",
        name: "ইউজার আইডি ও একাউন্ট",
        href: "/dashboard/users",
        iconName: "ShieldCheck",
        permission: "user.view",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "admin"],
        keywords: ["user", "role", "permission", "ইউজার", "পারমিশন"],
      },
      {
        id: "system_backup",
        name: "ডাটা ব্যাকআপ ও রিস্টোর",
        href: "/dashboard/settings/backup",
        iconName: "Database",
        badge: "ক্লাউড ভল্ট",
        badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
        permission: "settings.view",
        roles: ["super_admin", "muhtamim", "admin"],
        keywords: ["backup", "restore", "export", "import", "ডাটা ব্যাকআপ", "রিস্টোর", "ক্লাউড ব্যাকআপ"],
      },
      {
        id: "system_settings",
        name: "মাদ্রাসা সেটিংস",
        href: "/dashboard/settings",
        iconName: "Settings",
        permission: "settings.view",
        roles: ["super_admin", "muhtamim", "naib_muhtamim", "admin"],
        keywords: ["settings", "setup", "মাদ্রাসা সেটিংস", "কনফিগ"],
      },
    ],
  },
];

/**
 * Robust sanitizer function that heals any missing, corrupt or legacy navigation group data.
 * Guarantees every group has valid id, title, iconName, hidden boolean and an array of valid items.
 */
export function sanitizeNavGroups(raw: any): SerializedNavGroup[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return JSON.parse(JSON.stringify(INITIAL_NAV_GROUPS));
  }

  // Create a fallback dictionary of default items by href and id for recovering metadata
  const defaultItemsMap = new Map<string, SerializedNavItem>();
  for (const group of INITIAL_NAV_GROUPS) {
    for (const item of group.items) {
      if (item.id) defaultItemsMap.set(item.id, item);
      if (item.href) defaultItemsMap.set(item.href, item);
    }
  }

  const sanitized: SerializedNavGroup[] = [];

  for (let gIdx = 0; gIdx < raw.length; gIdx++) {
    const rawG = raw[gIdx];
    if (!rawG || typeof rawG !== "object") continue;

    const groupId = typeof rawG.id === "string" && rawG.id.trim() ? rawG.id.trim() : `group_${gIdx}`;
    const groupTitle = typeof rawG.title === "string" && rawG.title.trim() ? rawG.title.trim() : `গ্রুপ ${gIdx + 1}`;
    const groupIconName = typeof rawG.iconName === "string" && rawG.iconName.trim() ? rawG.iconName.trim() : "FolderOpen";
    const groupHidden = Boolean(rawG.hidden);

    const rawItems = Array.isArray(rawG.items) ? rawG.items : [];
    const sanitizedItems: SerializedNavItem[] = [];

    for (let itIdx = 0; itIdx < rawItems.length; itIdx++) {
      const rawItem = rawItems[itIdx];
      if (!rawItem || typeof rawItem !== "object") continue;

      const href = typeof rawItem.href === "string" && rawItem.href.trim() ? rawItem.href.trim() : "";
      const id = typeof rawItem.id === "string" && rawItem.id.trim()
        ? rawItem.id.trim()
        : href ? href.replace(/\//g, "_").replace(/[^a-zA-Z0-9_]/g, "") : `item_${groupId}_${itIdx}`;

      const fallbackDefaults = (id ? defaultItemsMap.get(id) : null) || (href ? defaultItemsMap.get(href) : null);

      const name = typeof rawItem.name === "string" && rawItem.name.trim()
        ? rawItem.name.trim()
        : (fallbackDefaults?.name || `মেনু ${itIdx + 1}`);

      const iconName = typeof rawItem.iconName === "string" && rawItem.iconName.trim()
        ? rawItem.iconName.trim()
        : (fallbackDefaults?.iconName || "FileText");

      const item: SerializedNavItem = {
        id,
        name,
        href: href || (fallbackDefaults?.href || "/dashboard"),
        iconName,
        hidden: Boolean(rawItem.hidden),
        permission: typeof rawItem.permission === "string" ? rawItem.permission : fallbackDefaults?.permission,
        roles: Array.isArray(rawItem.roles) ? rawItem.roles : fallbackDefaults?.roles,
        badge: typeof rawItem.badge === "string" ? rawItem.badge : fallbackDefaults?.badge,
        badgeColor: typeof rawItem.badgeColor === "string" ? rawItem.badgeColor : fallbackDefaults?.badgeColor,
        keywords: Array.isArray(rawItem.keywords)
          ? rawItem.keywords.filter((k: any): k is string => typeof k === "string")
          : (fallbackDefaults?.keywords || []),
        exact: Boolean(rawItem.exact ?? fallbackDefaults?.exact),
      };

      sanitizedItems.push(item);
    }

    sanitized.push({
      id: groupId,
      title: groupTitle,
      iconName: groupIconName,
      hidden: groupHidden,
      items: sanitizedItems,
    });
  }

  // If after sanitization no valid groups remain, fallback to INITIAL_NAV_GROUPS
  if (sanitized.length === 0) {
    return JSON.parse(JSON.stringify(INITIAL_NAV_GROUPS));
  }

  return sanitized;
}

