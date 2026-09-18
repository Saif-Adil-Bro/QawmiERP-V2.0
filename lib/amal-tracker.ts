// Data structures and helper models for Qawmi Madrasa Daily Amal & Home Routine Tracker
import { toBanglaNumber } from "@/lib/numberToBangla";

export interface AmalCategory {
  id: string;
  name: string; // e.g., "ফরজ ও জামাত", "তা'লীম ও মুতালাআ", "সুন্নাত ও আদব", "বর্জনীয় কাজ"
  color?: string;
  iconName?: string;
}

export interface AmalItem {
  id: string;
  categoryId: string;
  name: string; // e.g., "ফজর (জামাতে)", "কুরআন তিলাওয়াত"
  subtitle?: string; // e.g., "১ পারা বা আধা ঘণ্টা"
  type: "checkbox" | "rating" | "number" | "text";
  targetCount?: number;
  weight?: number; // importance score
  isCustom?: boolean;
}

export interface AmalTrackerTemplate {
  id: string;
  title: string;
  code: string; // "weekly", "vacation_15days", "monthly", "ramadan", "hifz", "kitab", "custom"
  durationDays: number; // 7, 15, 30, etc.
  description: string;
  arabicSlogan: string;
  naseehatText: string;
  instructions: string[];
  evaluationGrades: {
    label: string;
    description: string;
  }[];
  categories: AmalCategory[];
  items: AmalItem[];
  headerStyle: "classical" | "modern" | "ornamental" | "minimal";
  borderStyle: "ornate" | "double" | "clean" | "solid";
  showWatermark: boolean;
  showGradeEvaluation: boolean;
  showParentSign: boolean;
  showTeacherSign: boolean;
  showImamSign?: boolean;
  showImamDailySignRow?: boolean;
  isDefault?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AmalStudentSnapshot {
  studentId: string;
  studentName: string;
  studentRoll?: string;
  studentIdCode?: string;
  className?: string;
  sectionName?: string;
  fatherName?: string;
  guardianPhone?: string;
  photoUrl?: string;
}

export interface AmalDayRecord {
  dateStr: string; // "YYYY-MM-DD"
  dayBangla: string; // "শনিবার", "রবিবার"
  dayIndex: number; // 1, 2, ...
  statusMap: Record<string, boolean | number | string>; // itemId -> value
  parentChecked?: boolean;
  note?: string;
}

export interface AmalEvaluationLog {
  id: string;
  templateId: string;
  templateTitle: string;
  studentId: string;
  studentName: string;
  studentRoll?: string;
  className?: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  completedDays: number;
  totalScorePercentage?: number;
  grade?: "মুমতাজ" | "জায়্যিদ জিদ্দান" | "জায়্যিদ" | "মাকবুল" | "মেহনত প্রয়োজন";
  parentSignatureCollected: boolean;
  parentPhone?: string;
  teacherRemarks?: string;
  evaluatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

// Default Amal Categories
export const DEFAULT_AMAL_CATEGORIES: AmalCategory[] = [
  { id: "ibadat", name: "ফরজ নামাজ ও জামাত (ইবাদত)" },
  { id: "talim", name: "কুরআন তিলাওয়াত ও মুতালাআ (তা'লীম)" },
  { id: "sunnah_adab", name: "সুন্নাত, মাসনুন দু‘আ ও আখলাক" },
  { id: "prohibition", name: "অনর্থক কাজ ও গুনাহ বর্জন" },
];

// Standard 7-Day Weekly Template
export const WEEKLY_GENERAL_TEMPLATE: AmalTrackerTemplate = {
  id: "template_weekly_general",
  title: "সাপ্তাহিক বাড়ির কর্মসূচি ও আমলনামা",
  code: "weekly",
  durationDays: 7,
  description: "সাপ্তাহিক ছুটি বা ছুটির দিনগুলোতে শিক্ষার্থীদের নামাজ ও বাড়ির পড়ার নিয়মিত ট্র্যাকার।",
  arabicSlogan: "مَنْ عَمِلَ صَالِحًا فَلِنَفْسِهِ ۖ وَمَنْ أَسَاءَ فَعَلَيْهَا",
  naseehatText:
    "শ্রদ্ধেয় অভিভাবক! আপনার সন্তান দ্বীনের একজন ভবিষ্যৎ আলেম/হাফেজ। ছুটি বা বাড়িতে অবস্থানের সময় সে যাতে দ্বীনি পরিবেশ বজায় রেখে পাঁচ ওয়াক্ত নামাজ জামাতে আদায় করে এবং নিয়মিত পড়াশোনার ধারাবাহিকতা রক্ষা করে, সেদিকে সজাগ দৃষ্টি রাখা আমাদের সকলের দায়িত্ব। প্রতিদিন রাতে সন্তান এই আমলগুলো সঠিকভাবে সম্পন্ন করেছে কিনা তা আন্তরিকভাবে দেখে টিক (✓) দিন এবং সপ্তাহ শেষে স্বাক্ষরসহ শিটটি মাদরাসায় জমা দিন।",
  instructions: [
    "প্রতিদিন ঘুমানোর পূর্বে সন্তানের সাথে খোশমেজাজে বসে আমলনামাটি যাচাই করুন।",
    "মসজিদে জামাতে আদায় করলে (✓) চিহ্ন এবং ওজরবশত ঘরে একাকী পড়লে (△) চিহ্ন দিন।",
    "কোনো আমল ছুটে গেলে বকাঝকা না করে বুঝিয়ে পরের দিন উৎসাহ প্রদান করুন।",
    "ছুটি শেষে মাদরাসায় আসার প্রথম দিনই সংশ্লিষ্ট উস্তাদের নিকট এই আমলনামা জমা দিতে হবে।",
  ],
  evaluationGrades: [
    { label: "মুমতাজ (অসাধারণ)", description: "সকল নামাজ জামাতে ও ১০০% আমল আদায়" },
    { label: "জায়্যিদ জিদ্দান (উত্তম)", description: "অধিকাংশ নামাজ জামাতে ও পড়ালেখা সম্পন্ন" },
    { label: "জায়্যিদ (ভালো)", description: "মোটামুটি নিয়মিত, কিছু ঘাটতি রয়েছে" },
    { label: "মেহনত প্রয়োজন", description: "নামাজ ও বাড়ির পড়ায় অলসতা দেখা গেছে" },
  ],
  categories: DEFAULT_AMAL_CATEGORIES,
  items: [
    { id: "fajr", categoryId: "ibadat", name: "ফজর নামাজ (মসজিদে জামাতে)", subtitle: "তাকবিরে উলার সাথে", type: "checkbox", weight: 10 },
    { id: "dhuhr", categoryId: "ibadat", name: "জোহর নামাজ (মসজিদে জামাতে)", type: "checkbox", weight: 10 },
    { id: "asr", categoryId: "ibadat", name: "আসর নামাজ (মসজিদে জামাতে)", type: "checkbox", weight: 10 },
    { id: "maghrib", categoryId: "ibadat", name: "মাগরিব নামাজ (মসজিদে জামাতে)", type: "checkbox", weight: 10 },
    { id: "isha", categoryId: "ibadat", name: "এশা নামাজ (মসজিদে জামাতে)", subtitle: "বিতরসহ", type: "checkbox", weight: 10 },
    { id: "quran_tilawat", categoryId: "talim", name: "কুরআন তিলাওয়াত / হিফজ ইয়াদ", subtitle: "কমপক্ষে ১ পারা / আধা ঘণ্টা", type: "checkbox", weight: 10 },
    { id: "mutalaa", categoryId: "talim", name: "কিতাব মুতালাআ / বাড়ির পড়া প্রস্তুতি", subtitle: "কমপক্ষে ২ ঘণ্টা অধ্যয়ন", type: "checkbox", weight: 10 },
    { id: "khat_practice", categoryId: "talim", name: "হাতে লেখা অনুশীলন (খত/ইমলা)", subtitle: "১ পৃষ্ঠা সুন্দর খত", type: "checkbox", weight: 5 },
    { id: "masnun_dua", categoryId: "sunnah_adab", name: "সকাল-সন্ধ্যার মাসনুন দু‘আ ও জিকির", subtitle: "১০০ বার ইস্তিগফার/দরূদ", type: "checkbox", weight: 5 },
    { id: "parents_service", categoryId: "sunnah_adab", name: "পিতামাতা ও মুরব্বিদের খেদমত ও সালাম", subtitle: "আদেশ পালন ও বিনম্র আচরণ", type: "checkbox", weight: 10 },
    { id: "no_screen_idle", categoryId: "prohibition", name: "মোবাইল/টিভি/অনর্থক আড্ডা বর্জন", subtitle: "অযথা সময় নষ্ট না করা", type: "checkbox", weight: 10 },
  ],
  headerStyle: "classical",
  borderStyle: "ornate",
  showWatermark: true,
  showGradeEvaluation: true,
  showParentSign: true,
  showTeacherSign: true,
  showImamSign: true,
  showImamDailySignRow: true,
  isDefault: true,
};

// 15-Day Vacation Template (ছুটির ১৫ দিনের আমল ট্র্যাকার)
export const VACATION_15DAYS_TEMPLATE: AmalTrackerTemplate = {
  id: "template_vacation_15days",
  title: "ছুটির বিশেষ কর্মসূচি ও আমল ট্র্যাকার (১৫ দিন)",
  code: "vacation_15days",
  durationDays: 15,
  description: "সাময়িক বা মধ্যবর্তী দীর্ঘ ছুটির ১৫ দিনের আমলনামা ও পড়ার শিট।",
  arabicSlogan: "وَاعْبُدْ رَبَّكَ حَتَّىٰ يَأْتِيَكَ الْيَقِينُ",
  naseehatText:
    "ছুটির প্রতিটি মুহূর্ত বরকতময় হোক। মাদরাসার বাইরে থাকলেও তালেবে ইলমের পরিচয় যেন সর্বদা প্রকাশ পায়। পাঁচ ওয়াক্ত নামাজ জামাতে আদায় করা এবং প্রতিদিন নির্ধারিত সবক/কিতাব রিভিশন করা আবশ্যক। সম্মানিত অভিভাবকগণ মেহেরবানি করে নিয়মিত তদারকি করবেন।",
  instructions: [
    "প্রতিদিনের আমল শেষ হওয়ার পর অভিভাবক স্বহস্তে মূল্যায়ন ঘরে টিক দিবেন।",
    "ছুটি চলাকালীন বাড়ির পড়া বা আমল সংক্রান্ত কোনো জটিলতা হলে মাদরাসার শিক্ষকের সাথে ফোনে যোগাযোগ করুন।",
    "ছুটি শেষে মাদরাসায় প্রত্যাবর্তনের দিনই এই চার্ট জমা দিয়ে নতুন ছবক শুরু করতে হবে।",
  ],
  evaluationGrades: [
    { label: "মুমতাজ (৯১-১০০%)", description: "ছুটি পূর্ণ দ্বীনি পরিবেশে অতিবাহিত হয়েছে" },
    { label: "জায়্যিদ জিদ্দান (৮১-৯০%)", description: "খুবই ভালো, নিয়মিত আমল হয়েছে" },
    { label: "জায়্যিদ (৭০-৮০%)", description: "সন্তোষজনক, আরও উন্নতি কাম্য" },
    { label: "মেহনত প্রয়োজন (৭০% এর নিচে)", description: "নিয়মানুবর্তিতার ঘাটতি ছিল" },
  ],
  categories: DEFAULT_AMAL_CATEGORIES,
  items: [
    { id: "fajr", categoryId: "ibadat", name: "ফজর (জামাতে)", type: "checkbox", weight: 10 },
    { id: "dhuhr", categoryId: "ibadat", name: "জোহর (জামাতে)", type: "checkbox", weight: 10 },
    { id: "asr", categoryId: "ibadat", name: "আসর (জামাতে)", type: "checkbox", weight: 10 },
    { id: "maghrib", categoryId: "ibadat", name: "মাগরিব (জামাতে)", type: "checkbox", weight: 10 },
    { id: "isha", categoryId: "ibadat", name: "এশা (জামাতে)", type: "checkbox", weight: 10 },
    { id: "tilawat", categoryId: "talim", name: "কুরআন তিলাওয়াত", subtitle: "১ পারা", type: "checkbox", weight: 10 },
    { id: "study", categoryId: "talim", name: "কিতাব মুতালাআ / ছবক রিভিশন", subtitle: "২ ঘণ্টা", type: "checkbox", weight: 15 },
    { id: "sunnah_dua", categoryId: "sunnah_adab", name: "মাসনুন জিকির ও আদব", type: "checkbox", weight: 10 },
    { id: "family_help", categoryId: "sunnah_adab", name: "পিতামাতার খেদমত", type: "checkbox", weight: 10 },
    { id: "avoid_bad", categoryId: "prohibition", name: "অনর্থক কাজ বর্জন", type: "checkbox", weight: 5 },
  ],
  headerStyle: "classical",
  borderStyle: "ornate",
  showWatermark: true,
  showGradeEvaluation: true,
  showParentSign: true,
  showTeacherSign: true,
  showImamSign: true,
  showImamDailySignRow: true,
  isDefault: true,
};

// Ramadan Special Amal Tracker
export const RAMADAN_SPECIAL_TEMPLATE: AmalTrackerTemplate = {
  id: "template_ramadan_special",
  title: "মাহে রমযানুল মুবারকের বিশেষ আমলনামা ও রুটিন",
  code: "ramadan",
  durationDays: 30,
  description: "রমযান মাসের সিয়াম, তারাবীহ, তাহাজ্জুদ, কুরআন খতম ও সদকার বিশেষ আমল ট্র্যাকার।",
  arabicSlogan: "شَهْرُ رَمَضَانَ الَّذِي أُنزِلَ فِيهِ الْقُرْآنُ هُدًى لِّلنَّاسِ",
  naseehatText:
    "রমযানুল মুবারক নেকি অর্জনের বসন্তকাল। এই বরকতময় মাসে প্রত্যেক ছাত্র যেন প্রতিটি রোজা নিষ্ঠার সাথে পালন করে, তারাবীহ ও তাহাজ্জুদে অভ্যস্ত হয় এবং প্রতিদিন কমপক্ষে ১ পারা কুরআন তিলাওয়াত সম্পন্ন করে। সম্মানিত অভিভাবকগণ তাদের নিয়মিত উৎসাহিত করবেন।",
  instructions: [
    "প্রতিটি রোজা রাখার পর রোজার ঘরে টিক দিন।",
    "২০ রাকাত তারাবীহ নামাজ সুন্নাত তরিকায় জামাতে আদায় করার চেষ্টা করতে হবে।",
    "প্রতিদিন শেষ রাতে সেহরির পূর্বে কমপক্ষে ২-৪ রাকাত তাহাজ্জুদ ও দোয়া করার বিশেষ তাগিদ দেওয়া হলো।",
  ],
  evaluationGrades: [
    { label: "মুমতাজ", description: "৩০ রোজা, তারাবীহ, তাহাজ্জুদ ও কুরআন খতম সম্পন্ন" },
    { label: "জায়্যিদ জিদ্দান", description: "সকল রোজা ও নিয়মিত তারাবীহ আদায়" },
    { label: "জায়্যিদ", description: "অধিকাংশ আমল সম্পন্ন হয়েছে" },
  ],
  categories: [
    { id: "ramadan_core", name: "সিয়াম ও রাতের কিয়াম" },
    { id: "ibadat", name: "ফরজ নামাজ (জামাতে)" },
    { id: "quran_zikr", name: "কুরআন ও বিশেষ জিকির" },
    { id: "good_deeds", name: "দান-সদকা ও উত্তম আচরণ" },
  ],
  items: [
    { id: "fasting", categoryId: "ramadan_core", name: "ফরজ সিয়াম (রোজা)", type: "checkbox", weight: 15 },
    { id: "tarawih", categoryId: "ramadan_core", name: "তারাবীহ নামাজ (২০ রাকাত)", type: "checkbox", weight: 15 },
    { id: "tahajjud", categoryId: "ramadan_core", name: "তাহাজ্জুদ নামাজ ও সাহরীর দু‘আ", type: "checkbox", weight: 10 },
    { id: "fajr", categoryId: "ibadat", name: "ফজর (জামাতে)", type: "checkbox", weight: 10 },
    { id: "dhuhr", categoryId: "ibadat", name: "জোহর (জামাতে)", type: "checkbox", weight: 10 },
    { id: "asr", categoryId: "ibadat", name: "আসর (জামাতে)", type: "checkbox", weight: 10 },
    { id: "maghrib", categoryId: "ibadat", name: "মাগরিব ও ইফতারের দু‘আ", type: "checkbox", weight: 10 },
    { id: "isha", categoryId: "ibadat", name: "এশা (জামাতে)", type: "checkbox", weight: 10 },
    { id: "quran_para", categoryId: "quran_zikr", name: "কুরআন তিলাওয়াত (১ পারা)", type: "checkbox", weight: 10 },
    { id: "sadqa", categoryId: "good_deeds", name: "সদকা ও অপরের ইফতার করানো", type: "checkbox", weight: 5 },
  ],
  headerStyle: "classical",
  borderStyle: "ornate",
  showWatermark: true,
  showGradeEvaluation: true,
  showParentSign: true,
  showTeacherSign: true,
  showImamSign: true,
  showImamDailySignRow: true,
  isDefault: true,
};

// Hifz Vacation / Home Routine Tracker (হিফজুল কুরআন বাড়ির কর্মসূচি)
export const HIFZ_HOME_TRACKER_TEMPLATE: AmalTrackerTemplate = {
  id: "template_hifz_home",
  title: "হিফজুল কুরআন বাড়ির কর্মসূচি ও দাওর ট্র্যাকার",
  code: "hifz",
  durationDays: 7,
  description: "হিফজ শিক্ষার্থীদের জন্য সবক, সবকী (পেছনের পড়া), আমুক্তা ও ইয়াদ ট্র্যাকার।",
  arabicSlogan: "خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ",
  naseehatText:
    "কুরআন হিফজ আল্লাহ তায়ালার বিশেষ নিয়ামত। বাড়িতে অবস্থানের সময় প্রতিদিন নিয়মিত সবকী ও আমুক্তা দাওর না করলে ইয়াদ দুর্বল হয়ে যায়। অভিভাবকগণ সন্তানকে প্রতিদিন নির্দিষ্ট সময়ে তিলাওয়াত শোনা এবং টেবিলে টিক চিহ্ন দেওয়ার অনুরোধ রইল।",
  instructions: [
    "প্রতিদিন নতুন পড়া (ছবক) অভিভাবক অথবা নিকটস্থ কোনো বিজ্ঞ ক্বারীর নিকট শুনিয়ে টিক দিন।",
    "সবকী (পেছনের ৭ দিনের পড়া) কমপক্ষে ৩ বার পাঠ করে ইয়াদ নিশ্চিত করুন।",
    "আমুক্তা (পূর্বের মুখস্থ পারা) থেকে প্রতিদিন কমপক্ষে আধা পারা / ১ পারা দাওর করুন।",
  ],
  evaluationGrades: [
    { label: "মুমতাজ", description: "প্রতিদিন ছবক ও ১ পারা আমুক্তা নির্ভেজাল ইয়াদ" },
    { label: "জায়্যিদ জিদ্দান", description: "নিয়মিত সবকী ও দাওর সম্পন্ন" },
    { label: "জায়্যিদ", description: "মোটামুটি পড়া হয়েছে, কিছু ভুল হয়েছে" },
  ],
  categories: [
    { id: "hifz_lessons", name: "হিফজুল কুরআন ছবক ও দাওর" },
    { id: "ibadat", name: "নামাজ ও তেলাওয়াত" },
    { id: "akhlaq", name: "আদব ও নিয়মানুবর্তিতা" },
  ],
  items: [
    { id: "sabaq", categoryId: "hifz_lessons", name: "নতুন ছবক ইয়াদ ও শোনানো", subtitle: "নির্ধারিত পৃষ্ঠা", type: "checkbox", weight: 20 },
    { id: "sabqi", categoryId: "hifz_lessons", name: "সবকী (পেছনের ৭ দিনের ছবক)", subtitle: "৩ বার পাঠ", type: "checkbox", weight: 20 },
    { id: "amukhta", categoryId: "hifz_lessons", name: "আমুক্তা দাওর (পূর্বের পারা)", subtitle: "আধা/১ পারা", type: "checkbox", weight: 20 },
    { id: "tajweed", categoryId: "hifz_lessons", name: "তাজভীদ ও সুর অনুশীলন", type: "checkbox", weight: 10 },
    { id: "namaz_5", categoryId: "ibadat", name: "৫ ওয়াক্ত নামাজ জামাতে", type: "checkbox", weight: 20 },
    { id: "adab_hifz", categoryId: "akhlaq", name: "কুরআনের তা'জীম ও ভালো সঙ্গ", type: "checkbox", weight: 10 },
  ],
  headerStyle: "classical",
  borderStyle: "ornate",
  showWatermark: true,
  showGradeEvaluation: true,
  showParentSign: true,
  showTeacherSign: true,
  showImamSign: true,
  showImamDailySignRow: true,
  isDefault: true,
};

// Kitab Study Tracker (কিতাব বিভাগ মুতালাআ ও কর্মসূচি)
export const KITAB_STUDY_TRACKER_TEMPLATE: AmalTrackerTemplate = {
  id: "template_kitab_study",
  title: "কিতাব বিভাগ বাড়ির মুতালাআ ও ইলমি কর্মসূচি",
  code: "kitab",
  durationDays: 7,
  description: "কিতাব বিভাগের ছাত্রদের এবারত পাঠ, শরাহ মুতালাআ, তাকরার ও আরবি লেখার ট্র্যাকার।",
  arabicSlogan: "طَلَبُ الْعِلْمِ فَرِيضَةٌ عَلَىٰ كُلِّ مُسْلِمٍ",
  naseehatText:
    "ইলম অর্জনের মূল চালিকাশক্তি হলো গভীর মুতালাআ ও নিরবচ্ছিন্ন অধ্যয়ন। ছুটির দিনগুলোতেও প্রতিদিনের কিতাবসমূহের মূল মতনের এবারত শুদ্ধ করা, শরাহ দেখা এবং তামরীন সম্পন্ন করা প্রত্যেক তালেবে ইলমের প্রধান দায়িত্ব।",
  instructions: [
    "প্রতিটি কিতাবের দরসের পূর্বেই আগামী দিনের পাঠ কমপক্ষে ২ বার মুতালাআ করুন।",
    "কঠিন শব্দার্থ ও তারকীব আলাদা খাতায় নোট করুন।",
    "সহপাঠীদের সাথে ফোনে বা সাক্ষাতে তাকরার (গ্রুপ স্টাডি) সম্পন্ন করে টিক দিন।",
  ],
  evaluationGrades: [
    { label: "মুমতাজ", description: "দৈনিক ৩+ ঘণ্টা মুতালাআ ও পূর্ণ প্রস্তুতি" },
    { label: "জায়্যিদ জিদ্দান", description: "নিয়মিত কিতাব পাঠ ও নোট গ্রহণ" },
    { label: "জায়্যিদ", description: "সাধারণ অধ্যয়ন সম্পন্ন" },
  ],
  categories: [
    { id: "dars_study", name: "দরসি কিতাব মুতালাআ ও প্রস্তুতি" },
    { id: "arabic_writing", name: "তামরীন ও খত অনুশীলন" },
    { id: "ibadat_akhlaq", name: "ইবাদত ও সুন্নাত অনুযায়ী জীবন" },
  ],
  items: [
    { id: "kitab_ebarat", categoryId: "dars_study", name: "কিতাবের মূল মতনের এবারত পাঠ", subtitle: "বিশুদ্ধ তিলাওয়াত ও অর্থ", type: "checkbox", weight: 20 },
    { id: "kitab_sharah", categoryId: "dars_study", name: "হাশিয়া ও শরাহ মুতালাআ", subtitle: "মাসায়েল তাহকিক", type: "checkbox", weight: 20 },
    { id: "takrar", categoryId: "dars_study", name: "তাকরার / গ্রুপ স্টাডি ও তামরীন", type: "checkbox", weight: 15 },
    { id: "arabic_khat", categoryId: "arabic_writing", name: "আরবি ক্যালিগ্রাফি / খত অনুশীলন", subtitle: "১ পৃষ্ঠা সুন্দর খত", type: "checkbox", weight: 10 },
    { id: "namaz_jamath", categoryId: "ibadat_akhlaq", name: "৫ ওয়াক্ত নামাজ তাকবিরে উলার সাথে", type: "checkbox", weight: 20 },
    { id: "mutalaa_non_dars", categoryId: "ibadat_akhlaq", name: "সিরাত ও আকাঈদ বিষয়ক বই পাঠ", subtitle: "আধা ঘণ্টা", type: "checkbox", weight: 15 },
  ],
  headerStyle: "classical",
  borderStyle: "ornate",
  showWatermark: true,
  showGradeEvaluation: true,
  showParentSign: true,
  showTeacherSign: true,
  showImamSign: true,
  showImamDailySignRow: true,
  isDefault: true,
};

export const ALL_DEFAULT_TEMPLATES: AmalTrackerTemplate[] = [
  WEEKLY_GENERAL_TEMPLATE,
  VACATION_15DAYS_TEMPLATE,
  RAMADAN_SPECIAL_TEMPLATE,
  HIFZ_HOME_TRACKER_TEMPLATE,
  KITAB_STUDY_TRACKER_TEMPLATE,
];

// Helper to generate dates for a range (e.g., 7 days starting from a date)
export function generateAmalDateDays(startDateStr: string, totalDays: number): {
  date: string;
  dayBangla: string;
  dayNumberBangla: string;
  formattedDateBangla: string;
}[] {
  const result = [];
  const start = startDateStr ? new Date(startDateStr) : new Date();
  
  const banglaDays = ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার"];
  const banglaMonths = [
    "জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন",
    "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর"
  ];

  for (let i = 0; i < totalDays; i++) {
    const current = new Date(start);
    current.setDate(start.getDate() + i);

    const dayName = banglaDays[current.getDay()];
    const dayNum = current.getDate();
    const monthName = banglaMonths[current.getMonth()];
    const year = current.getFullYear();

    const isoStr = current.toISOString().split("T")[0];
    const formatted = `${toBanglaNumber(dayNum)} ${monthName}`;

    result.push({
      date: isoStr,
      dayBangla: dayName,
      dayNumberBangla: toBanglaNumber(i + 1),
      formattedDateBangla: formatted,
    });
  }

  return result;
}

/**
 * Universal helper to extract student snapshot accurately from any Supabase student record
 */
export function buildAmalStudentSnapshot(s: any, classesList: any[] = []): AmalStudentSnapshot {
  if (!s || s === "blank" || s.studentId === "blank") {
    return {
      studentId: "blank",
      studentName: "",
      studentRoll: "",
      studentIdCode: "",
      className: "",
      fatherName: "",
      guardianPhone: "",
    };
  }

  // 1. Resolve Student Full Name
  const nameParts = [s.first_name, s.last_name].filter(Boolean).map((t) => String(t).trim());
  const fullName = nameParts.length > 0 ? nameParts.join(" ") : "";
  const studentName =
    fullName ||
    s.full_name ||
    s.name_bn ||
    s.name ||
    s.student_name ||
    s.bangla_name ||
    s.first_name ||
    "";

  // 2. Resolve Roll Number
  const rawRoll = s.roll_number ?? s.roll_no ?? s.roll ?? s.student_roll ?? "";
  const studentRoll =
    rawRoll !== "" && rawRoll !== null && rawRoll !== undefined ? String(rawRoll).trim() : "";

  // 3. Resolve Student ID / Admission Code
  const rawIdCode =
    s.student_id ||
    s.student_id_number ||
    s.student_id_code ||
    s.registration_no ||
    s.reg_no ||
    s.admission_number ||
    s.admission_no ||
    s.id_code;
  
  const studentIdCode = rawIdCode
    ? String(rawIdCode).trim()
    : (s.id && typeof s.id === "string" && s.id.length < 15 ? s.id : (studentRoll ? `রোল-${studentRoll}` : ""));

  // 4. Resolve Class / Jamat
  const classObjFromRelation = Array.isArray(s.classes) ? s.classes[0] : s.classes;
  const matchedClassObj = (classesList || []).find(
    (c: any) => String(c.id) === String(s.class_id || s.classId || classObjFromRelation?.id)
  );
  const className =
    classObjFromRelation?.name_bn ||
    classObjFromRelation?.name ||
    matchedClassObj?.name_bn ||
    matchedClassObj?.name ||
    s.class_name ||
    s.className ||
    "";

  // 5. Resolve Father's Name / Guardian
  const fatherName =
    s.father_name ||
    s.father_name_bn ||
    s.guardian_name ||
    s.parent_name ||
    s.fatherName ||
    "";

  // 6. Resolve Guardian Phone / Contact
  const rawPhone =
    s.parent_phone ||
    s.guardian_phone ||
    s.phone ||
    s.contact_number ||
    s.mobile ||
    s.phone_number ||
    s.guardianPhone ||
    s.guardian_mobile ||
    "";
  const guardianPhone =
    rawPhone !== "" && rawPhone !== null && rawPhone !== undefined ? String(rawPhone).trim() : "";

  return {
    studentId: String(s.id || ""),
    studentName: studentName.trim(),
    studentRoll,
    studentIdCode,
    className: className.trim(),
    fatherName: fatherName.trim(),
    guardianPhone,
    photoUrl: s.photo_url || s.photo || undefined,
  };
}

