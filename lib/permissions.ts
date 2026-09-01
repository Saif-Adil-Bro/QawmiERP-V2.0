/**
 * QawmiManager - Advanced Role & Permission System (RBAC + ABAC Data Scope + Approval Engine)
 * Comprehensive authorization architecture for Qawmi Madrasa Management.
 */

export type DataScope = "ALL" | "OWN" | "ASSIGNED" | "DEPARTMENT" | "CLASS" | "LINKED" | "SELF";

export type UserAccountStatus = "ACTIVE" | "INVITED" | "SUSPENDED" | "DISABLED";

export type PermissionRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface PermissionDefinition {
  id: string; // e.g. "student.view"
  module: string; // e.g. "students"
  action: string; // e.g. "view"
  title: string; // e.g. "শিক্ষার্থী তালিকা দেখা"
  titleEn: string;
  description: string;
  riskLevel: PermissionRiskLevel;
  supportedScopes: DataScope[];
  defaultScope: DataScope;
}

export interface PermissionCategory {
  id: string;
  title: string;
  titleEn: string;
  iconName: string;
  permissions: PermissionDefinition[];
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. FULL PERMISSION CATALOG
// ─────────────────────────────────────────────────────────────────────────────

export const PERMISSION_CATEGORIES: PermissionCategory[] = [
  {
    id: "dashboard",
    title: "ড্যাশবোর্ড ও বিশ্লেষণ",
    titleEn: "Dashboard & Analytics",
    iconName: "LayoutDashboard",
    permissions: [
      {
        id: "dashboard.view",
        module: "dashboard",
        action: "view",
        title: "ড্যাশবোর্ড প্রবেশ",
        titleEn: "View Dashboard",
        description: "মাদ্রাসার সাধারণ ড্যাশবোর্ড দেখা",
        riskLevel: "LOW",
        supportedScopes: ["ALL", "ASSIGNED", "SELF"],
        defaultScope: "ALL",
      },
      {
        id: "dashboard.analytics",
        module: "dashboard",
        action: "analytics",
        title: "উন্নত পরিসংখ্যান ও গ্রাফ দেখা",
        titleEn: "View Analytics",
        description: "ভর্তি, উপস্থিতি ও আর্থিক পরিসংখ্যান দেখা",
        riskLevel: "MEDIUM",
        supportedScopes: ["ALL"],
        defaultScope: "ALL",
      },
    ],
  },
  {
    id: "students",
    title: "শিক্ষার্থী ব্যবস্থাপনা",
    titleEn: "Student Management",
    iconName: "Users",
    permissions: [
      {
        id: "student.view",
        module: "students",
        action: "view",
        title: "শিক্ষার্থী তালিকা ও প্রোফাইল দেখা",
        titleEn: "View Students",
        description: "শিক্ষার্থীদের তালিকা এবং মৌলিক প্রোফাইল দেখা",
        riskLevel: "LOW",
        supportedScopes: ["ALL", "ASSIGNED", "CLASS", "LINKED", "SELF"],
        defaultScope: "ALL",
      },
      {
        id: "student.create",
        module: "students",
        action: "create",
        title: "নতুন শিক্ষার্থী ভর্তি ও যোগ",
        titleEn: "Create / Admit Student",
        description: "নতুন শিক্ষার্থী ভর্তি ফরম পূরণ ও ডেটা এন্ট্রি",
        riskLevel: "MEDIUM",
        supportedScopes: ["ALL"],
        defaultScope: "ALL",
      },
      {
        id: "student.edit",
        module: "students",
        action: "edit",
        title: "শিক্ষার্থীর তথ্য সংশোধন",
        titleEn: "Edit Student",
        description: "নাম, রোল, জামাত, রক্তের গ্রুপ ও ঠিকানা পরিবর্তন",
        riskLevel: "MEDIUM",
        supportedScopes: ["ALL", "ASSIGNED"],
        defaultScope: "ALL",
      },
      {
        id: "student.archive",
        module: "students",
        action: "archive",
        title: "শিক্ষার্থী আর্কাইভ / নিষ্ক্রিয়",
        titleEn: "Archive Student",
        description: "মাদ্রাসা ত্যাগকারী শিক্ষার্থী আর্কাইভ করা",
        riskLevel: "HIGH",
        supportedScopes: ["ALL"],
        defaultScope: "ALL",
      },
      {
        id: "student.delete",
        module: "students",
        action: "delete",
        title: "শিক্ষার্থী সম্পূর্ণ মুছে ফেলা",
        titleEn: "Delete Student",
        description: "ডাটাবেজ থেকে শিক্ষার্থীর রেকর্ড চিরতরে মুছে ফেলা",
        riskLevel: "CRITICAL",
        supportedScopes: ["ALL"],
        defaultScope: "ALL",
      },
      {
        id: "student.export",
        module: "students",
        action: "export",
        title: "শিক্ষার্থী তালিকা এক্সপোর্ট ও ডাউনলোড",
        titleEn: "Export Students",
        description: "এক্সেল, সিএসভি বা পিডিএফ আকারে তালিকা নামানো",
        riskLevel: "HIGH",
        supportedScopes: ["ALL", "ASSIGNED"],
        defaultScope: "ALL",
      },
      {
        id: "student.documents.view",
        module: "students",
        action: "documents.view",
        title: "শিক্ষার্থীর ব্যক্তিগত ও গোপনীয় নথি দেখা",
        titleEn: "View Student Documents",
        description: "জন্মসনদ, জাতীয় পরিচয়পত্র ও প্রত্যয়নপত্র দেখা",
        riskLevel: "MEDIUM",
        supportedScopes: ["ALL", "ASSIGNED", "LINKED", "SELF"],
        defaultScope: "ALL",
      },
      {
        id: "student.documents.manage",
        module: "students",
        action: "documents.manage",
        title: "শিক্ষার্থীর নথি আপলোড ও পরিবর্তন",
        titleEn: "Manage Student Documents",
        description: "নথি আপলোড, রিপ্লেস এবং মুছে ফেলা",
        riskLevel: "HIGH",
        supportedScopes: ["ALL"],
        defaultScope: "ALL",
      },
      {
        id: "student.profile.approve",
        module: "students",
        action: "profile.approve",
        title: "প্রোফাইল সংশোধন আবেদন অনুমোদন",
        titleEn: "Approve Student Profile Edits",
        description: "শিক্ষার্থী বা অভিভাবকের প্রেরিত তথ্য সংশোধন অনুমোদন",
        riskLevel: "HIGH",
        supportedScopes: ["ALL"],
        defaultScope: "ALL",
      },
    ],
  },
  {
    id: "guardians",
    title: "অভিভাবক ব্যবস্থাপনা",
    titleEn: "Guardian Management",
    iconName: "UserCheck",
    permissions: [
      {
        id: "guardian.view",
        module: "guardians",
        action: "view",
        title: "অভিভাবকের তথ্য দেখা",
        titleEn: "View Guardians",
        description: "পিতা-মাতা বা স্থানীয় অভিভাবকের নাম, পেশা ও যোগাযোগ",
        riskLevel: "LOW",
        supportedScopes: ["ALL", "ASSIGNED", "LINKED"],
        defaultScope: "ALL",
      },
      {
        id: "guardian.create",
        module: "guardians",
        action: "create",
        title: "নতুন অভিভাবক যুক্ত করা",
        titleEn: "Create Guardian",
        description: "নতুন অভিভাবক প্রোফাইল তৈরি ও লিঙ্ক করা",
        riskLevel: "MEDIUM",
        supportedScopes: ["ALL"],
        defaultScope: "ALL",
      },
      {
        id: "guardian.edit",
        module: "guardians",
        action: "edit",
        title: "অভিভাবকের তথ্য সংশোধন",
        titleEn: "Edit Guardian",
        description: "অভিভাবকের ফোন নম্বর, ঠিকানা ও তথ্য আপডেট",
        riskLevel: "MEDIUM",
        supportedScopes: ["ALL"],
        defaultScope: "ALL",
      },
      {
        id: "guardian.archive",
        module: "guardians",
        action: "archive",
        title: "অভিভাবক আর্কাইভ করা",
        titleEn: "Archive Guardian",
        description: "নিষ্ক্রিয় অভিভাবক আর্কাইভ করা",
        riskLevel: "HIGH",
        supportedScopes: ["ALL"],
        defaultScope: "ALL",
      },
    ],
  },
  {
    id: "teachers",
    title: "শিক্ষক ও ওস্তাদবৃন্দ",
    titleEn: "Teacher Management",
    iconName: "GraduationCap",
    permissions: [
      {
        id: "teacher.view",
        module: "teachers",
        action: "view",
        title: "শিক্ষক তালিকা ও মৌলিক পরিচিতি দেখা",
        titleEn: "View Teachers",
        description: "ওস্তাদগণের নাম, পদবী ও ক্লাস দায়িত্ব দেখা",
        riskLevel: "LOW",
        supportedScopes: ["ALL", "DEPARTMENT", "SELF"],
        defaultScope: "ALL",
      },
      {
        id: "teacher.create",
        module: "teachers",
        action: "create",
        title: "নতুন শিক্ষক যুক্ত করা",
        titleEn: "Create Teacher",
        description: "নতুন শিক্ষক প্রোফাইল তৈরি ও নিয়োগ তথ্য",
        riskLevel: "HIGH",
        supportedScopes: ["ALL"],
        defaultScope: "ALL",
      },
      {
        id: "teacher.edit",
        module: "teachers",
        action: "edit",
        title: "শিক্ষকের তথ্য ও বিষয় নির্ধারণ আপডেট",
        titleEn: "Edit Teacher",
        description: "শিক্ষকের বিষয় বরাদ্দ, পদবী ও ব্যক্তিগত তথ্য আপডেট",
        riskLevel: "HIGH",
        supportedScopes: ["ALL"],
        defaultScope: "ALL",
      },
      {
        id: "teacher.archive",
        module: "teachers",
        action: "archive",
        title: "শিক্ষক প্রোফাইল আর্কাইভ / অব্যাহতি",
        titleEn: "Archive Teacher",
        description: "অব্যাহতিপ্রাপ্ত শিক্ষক আর্কাইভ করা",
        riskLevel: "HIGH",
        supportedScopes: ["ALL"],
        defaultScope: "ALL",
      },
    ],
  },
  {
    id: "staff",
    title: "স্টাফ ও মানবসম্পদ (HR)",
    titleEn: "Staff & HR Management",
    iconName: "Briefcase",
    permissions: [
      {
        id: "staff.view",
        module: "staff",
        action: "view",
        title: "স্টাফ তালিকা ও প্রোফাইল দেখা",
        titleEn: "View Staff",
        description: "সকল কর্মকর্তা ও কর্মচারীদের তথ্য দেখা",
        riskLevel: "LOW",
        supportedScopes: ["ALL", "DEPARTMENT", "SELF"],
        defaultScope: "ALL",
      },
      {
        id: "staff.create",
        module: "staff",
        action: "create",
        title: "নতুন স্টাফ নিয়োগ ও নিবন্ধন",
        titleEn: "Create Staff",
        description: "নতুন কর্মকর্তা বা কর্মচারী নিবন্ধন",
        riskLevel: "HIGH",
        supportedScopes: ["ALL"],
        defaultScope: "ALL",
      },
      {
        id: "staff.edit",
        module: "staff",
        action: "edit",
        title: "স্টাফ তথ্য ও পদবী আপডেট",
        titleEn: "Edit Staff",
        description: "স্টাফের বিভাগ, পদবী ও বায়োডাটা সংশোধন",
        riskLevel: "HIGH",
        supportedScopes: ["ALL"],
        defaultScope: "ALL",
      },
      {
        id: "staff.archive",
        module: "staff",
        action: "archive",
        title: "স্টাফ অব্যাহতি ও আর্কাইভ",
        titleEn: "Archive / Terminate Staff",
        description: "স্টাফ সদস্যকে অব্যাহতি বা বরখাস্ত করা",
        riskLevel: "CRITICAL",
        supportedScopes: ["ALL"],
        defaultScope: "ALL",
      },
      {
        id: "staff.attendance",
        module: "staff",
        action: "attendance",
        title: "স্টাফ হাজিরা পরিচালনা",
        titleEn: "Manage Staff Attendance",
        description: "কর্মচারীদের উপস্থিতি ও ছুটি হিসাব করা",
        riskLevel: "MEDIUM",
        supportedScopes: ["ALL", "DEPARTMENT"],
        defaultScope: "ALL",
      },
      {
        id: "staff.leave",
        module: "staff",
        action: "leave",
        title: "ছুটির আবেদন তৈরি ও দেখা",
        titleEn: "Submit / View Leave",
        description: "ছুটির আবেদন করা ও স্ট্যাটাস দেখা",
        riskLevel: "LOW",
        supportedScopes: ["ALL", "DEPARTMENT", "SELF"],
        defaultScope: "ALL",
      },
      {
        id: "staff.leave.approve",
        module: "staff",
        action: "leave.approve",
        title: "ছুটির আবেদন অনুমোদন বা প্রত্যাখ্যান",
        titleEn: "Approve / Reject Leave",
        description: "স্টাফদের ছুটির আবেদন মঞ্জুর করা",
        riskLevel: "HIGH",
        supportedScopes: ["ALL", "DEPARTMENT"],
        defaultScope: "ALL",
      },
      {
        id: "staff.salary.view",
        module: "staff",
        action: "salary.view",
        title: "স্টাফ বেতন ও পেরোল দেখা",
        titleEn: "View Staff Salaries",
        description: "স্টাফদের মূল বেতন, ভাতা ও কর্তনের হিসাব দেখা",
        riskLevel: "HIGH",
        supportedScopes: ["ALL", "SELF"],
        defaultScope: "ALL",
      },
      {
        id: "staff.salary.manage",
        module: "staff",
        action: "salary.manage",
        title: "বেতন নির্ধারণ ও পরিশোধ পরিচালনা",
        titleEn: "Manage / Pay Salaries",
        description: "বেতন শীট তৈরি ও পরিশোধের লেনদেন সম্পাদন",
        riskLevel: "CRITICAL",
        supportedScopes: ["ALL"],
        defaultScope: "ALL",
      },
      {
        id: "staff.documents.view",
        module: "staff",
        action: "documents.view",
        title: "স্টাফ ব্যক্তিগত দলিল ও নিয়োগপত্র দেখা",
        titleEn: "View Staff Documents",
        description: "চুক্তিপত্র, জাতীয় পরিচয়পত্র ও সার্টিফিকেট দেখা",
        riskLevel: "MEDIUM",
        supportedScopes: ["ALL", "SELF"],
        defaultScope: "ALL",
      },
      {
        id: "staff.documents.manage",
        module: "staff",
        action: "documents.manage",
        title: "স্টাফ দলিল আপলোড ও পরিচালনা",
        titleEn: "Manage Staff Documents",
        description: "নিয়োগপত্র ও প্রত্যয়নপত্র আপলোড বা পরিবর্তন",
        riskLevel: "HIGH",
        supportedScopes: ["ALL"],
        defaultScope: "ALL",
      },
    ],
  },
  {
    id: "attendance",
    title: "হাজিরা ও উপস্থিতি",
    titleEn: "Attendance Management",
    iconName: "CheckSquare",
    permissions: [
      {
        id: "attendance.view",
        module: "attendance",
        action: "view",
        title: "উপস্থিতির খাতা ও রিপোর্ট দেখা",
        titleEn: "View Attendance",
        description: "দৈনিক এবং মাসিক উপস্থিতি বিবরণী দেখা",
        riskLevel: "LOW",
        supportedScopes: ["ALL", "ASSIGNED", "CLASS", "LINKED", "SELF"],
        defaultScope: "ALL",
      },
      {
        id: "attendance.create",
        module: "attendance",
        action: "create",
        title: "দৈনিক হাজিরা নেওয়া",
        titleEn: "Mark Attendance",
        description: "ক্লাস বা বিভাগের শিক্ষার্থীদের উপস্থিতি ও অনুপস্থিতি গ্রহণ",
        riskLevel: "MEDIUM",
        supportedScopes: ["ALL", "ASSIGNED", "CLASS"],
        defaultScope: "ASSIGNED",
      },
      {
        id: "attendance.edit",
        module: "attendance",
        action: "edit",
        title: "পূর্ববর্তী হাজিরা সংশোধন",
        titleEn: "Edit Attendance",
        description: "ভুলবশত নেওয়া হাজিরা বা ছুটির স্ট্যাটাস পরিবর্তন",
        riskLevel: "HIGH",
        supportedScopes: ["ALL", "ASSIGNED"],
        defaultScope: "ALL",
      },
      {
        id: "attendance.approve",
        module: "attendance",
        action: "approve",
        title: "মাসিক হাজিরা শীট লক ও অনুমোদন",
        titleEn: "Approve / Lock Attendance",
        description: "মাসিক হাজিরা রিপোর্ট অফিসিয়ালভাবে অনুমোদন",
        riskLevel: "HIGH",
        supportedScopes: ["ALL"],
        defaultScope: "ALL",
      },
      {
        id: "attendance.export",
        module: "attendance",
        action: "export",
        title: "হাজিরা রিপোর্ট ডাউনলোড / প্রিন্ট",
        titleEn: "Export Attendance",
        description: "হাজিরা শিট পিডিএফ বা এক্সেলে প্রিন্ট ও ডাউনলোড",
        riskLevel: "MEDIUM",
        supportedScopes: ["ALL", "ASSIGNED"],
        defaultScope: "ALL",
      },
    ],
  },
  {
    id: "academic",
    title: "জামাত ও শিক্ষাবর্ষ",
    titleEn: "Academic Structure",
    iconName: "BookOpen",
    permissions: [
      {
        id: "academic.view",
        module: "academic",
        action: "view",
        title: "জামাত ও শিক্ষাবর্ষ দেখা",
        titleEn: "View Classes & Sessions",
        description: "মাদ্রাসার সকল জামাত, বিভাগ ও শিক্ষাবর্ষ দেখা",
        riskLevel: "LOW",
        supportedScopes: ["ALL", "ASSIGNED"],
        defaultScope: "ALL",
      },
      {
        id: "academic.manage",
        module: "academic",
        action: "manage",
        title: "জামাত ও শিক্ষাবর্ষ তৈরি / পরিচালনা",
        titleEn: "Manage Classes & Sessions",
        description: "নতুন জামাত খোলা, ফি নির্ধারণ ও শিক্ষাবর্ষ সুইচ করা",
        riskLevel: "HIGH",
        supportedScopes: ["ALL"],
        defaultScope: "ALL",
      },
    ],
  },
  {
    id: "routine",
    title: "ক্লাস ও পরীক্ষার রুটিন",
    titleEn: "Routine Management",
    iconName: "CalendarDays",
    permissions: [
      {
        id: "routine.view",
        module: "routine",
        action: "view",
        title: "ক্লাস রুটিন দেখা",
        titleEn: "View Routine",
        description: "দৈনিক ঘণ্টার রুটিন এবং শিক্ষক বন্টন দেখা",
        riskLevel: "LOW",
        supportedScopes: ["ALL", "ASSIGNED", "LINKED", "SELF"],
        defaultScope: "ALL",
      },
      {
        id: "routine.create",
        module: "routine",
        action: "create",
        title: "নতুন রুটিন প্রণয়ন",
        titleEn: "Create Routine",
        description: "নতুন ঘণ্টার সূচি ও ওস্তাদ নির্ধারণ",
        riskLevel: "MEDIUM",
        supportedScopes: ["ALL"],
        defaultScope: "ALL",
      },
      {
        id: "routine.edit",
        module: "routine",
        action: "edit",
        title: "রুটিন পরিবর্তন ও প্রতিস্থাপন",
        titleEn: "Edit Routine",
        description: "ঘণ্টার সময়সূচি বা বদলি ওস্তাদ পরিবর্তন",
        riskLevel: "MEDIUM",
        supportedScopes: ["ALL"],
        defaultScope: "ALL",
      },
      {
        id: "routine.delete",
        module: "routine",
        action: "delete",
        title: "রুটিন মুছে ফেলা",
        titleEn: "Delete Routine",
        description: "অপ্রয়োজনীয় রুটিন মুছে ফেলা",
        riskLevel: "HIGH",
        supportedScopes: ["ALL"],
        defaultScope: "ALL",
      },
      {
        id: "routine.publish",
        module: "routine",
        action: "publish",
        title: "রুটিন প্রকাশ ও নোটিশ জারি",
        titleEn: "Publish Routine",
        description: "শিক্ষার্থী ও অভিভাবকদের জন্য রুটিন উন্মুক্তকরণ",
        riskLevel: "MEDIUM",
        supportedScopes: ["ALL"],
        defaultScope: "ALL",
      },
    ],
  },
  {
    id: "exam",
    title: "পরীক্ষা ও ফলাফল",
    titleEn: "Examinations & Results",
    iconName: "Award",
    permissions: [
      {
        id: "exam.view",
        module: "exam",
        action: "view",
        title: "পরীক্ষার তালিকা ও ফলাফল দেখা",
        titleEn: "View Exams & Results",
        description: "পরীক্ষার তালিকা, নম্বরপত্র ও মেধা তালিকা দেখা",
        riskLevel: "LOW",
        supportedScopes: ["ALL", "ASSIGNED", "LINKED", "SELF"],
        defaultScope: "ALL",
      },
      {
        id: "exam.create",
        module: "exam",
        action: "create",
        title: "নতুন পরীক্ষা তৈরি ও সেটআপ",
        titleEn: "Create Exam",
        description: "ত্রৈমাসিক, ষাণ্মাসিক বা বার্ষিক পরীক্ষা তৈরি",
        riskLevel: "HIGH",
        supportedScopes: ["ALL"],
        defaultScope: "ALL",
      },
      {
        id: "exam.edit",
        module: "exam",
        action: "edit",
        title: "পরীক্ষার নিয়ম ও সময়সূচি পরিবর্তন",
        titleEn: "Edit Exam Setup",
        description: "পাশ মার্কস, গ্রেডিং ও পরীক্ষার তারিখ পরিবর্তন",
        riskLevel: "HIGH",
        supportedScopes: ["ALL"],
        defaultScope: "ALL",
      },
      {
        id: "exam.delete",
        module: "exam",
        action: "delete",
        title: "পরীক্ষা মুছে ফেলা",
        titleEn: "Delete Exam",
        description: "সম্পূর্ণ পরীক্ষার রেকর্ড ও ফলাফল মুছে ফেলা",
        riskLevel: "CRITICAL",
        supportedScopes: ["ALL"],
        defaultScope: "ALL",
      },
      {
        id: "exam.marks.enter",
        module: "exam",
        action: "marks.enter",
        title: "বিষয়ের নম্বর এন্ট্রি",
        titleEn: "Enter Marks",
        description: "নিজের নির্ধারিত বিষয়ের প্রাপ্ত নম্বর খাতায় তোলা",
        riskLevel: "MEDIUM",
        supportedScopes: ["ALL", "ASSIGNED"],
        defaultScope: "ASSIGNED",
      },
      {
        id: "exam.marks.edit",
        module: "exam",
        action: "marks.edit",
        title: "প্রবেশকৃত নম্বর সংশোধন",
        titleEn: "Edit Entered Marks",
        description: "পূর্বে দেওয়া নম্বর সংশোধন বা পূর্ণমূল্যায়ন",
        riskLevel: "HIGH",
        supportedScopes: ["ALL", "ASSIGNED"],
        defaultScope: "ALL",
      },
      {
        id: "exam.result.publish",
        module: "exam",
        action: "result.publish",
        title: "ফলাফল ও মার্কশিট প্রকাশ",
        titleEn: "Publish Results",
        description: "ফলাফল অভিভাবক ও শিক্ষার্থীদের জন্য উন্মুক্ত করা",
        riskLevel: "HIGH",
        supportedScopes: ["ALL"],
        defaultScope: "ALL",
      },
      {
        id: "exam.result.approve",
        module: "exam",
        action: "result.approve",
        title: "ফলাফল নিরীক্ষা ও চূড়ান্ত অনুমোদন",
        titleEn: "Approve Results",
        description: "পরীক্ষা নিয়ন্ত্রক হিসেবে ফলাফল চূড়ান্ত সত্যায়ন",
        riskLevel: "CRITICAL",
        supportedScopes: ["ALL"],
        defaultScope: "ALL",
      },
      {
        id: "exam.export",
        module: "exam",
        action: "export",
        title: "তাবলিস শীট ও ফলাফল ডাউনলোড",
        titleEn: "Export Results & Tabulation",
        description: "তাবলিস শীট ও মার্কশিট প্রিন্ট ও ডাউনলোড",
        riskLevel: "MEDIUM",
        supportedScopes: ["ALL", "ASSIGNED"],
        defaultScope: "ALL",
      },
    ],
  },
  {
    id: "hifz",
    title: "হিফজুল কুরআন ট্র্যাকিং",
    titleEn: "Hifz Progress Tracking",
    iconName: "BookOpen",
    permissions: [
      {
        id: "hifz.view",
        module: "hifz",
        action: "view",
        title: "হিফজ প্রগ্রেস ও দৈনিক ছবক দেখা",
        titleEn: "View Hifz Progress",
        description: "ছবক, ৭ ছবকি ও আমপারা অগ্রগতি দেখা",
        riskLevel: "LOW",
        supportedScopes: ["ALL", "ASSIGNED", "LINKED", "SELF"],
        defaultScope: "ALL",
      },
      {
        id: "hifz.create",
        module: "hifz",
        action: "create",
        title: "দৈনিক ছবক ও তিলাওয়াত এন্ট্রি",
        titleEn: "Record Daily Hifz Progress",
        description: "শিক্ষার্থীর ছবক ও শুনানি রেজিস্ট্রি করা",
        riskLevel: "MEDIUM",
        supportedScopes: ["ALL", "ASSIGNED"],
        defaultScope: "ASSIGNED",
      },
      {
        id: "hifz.edit",
        module: "hifz",
        action: "edit",
        title: "হিফজ ছবক সংশোধন",
        titleEn: "Edit Hifz Record",
        description: "ভুল ছবকের পৃষ্ঠা বা মূল্যায়ন পরিবর্তন",
        riskLevel: "MEDIUM",
        supportedScopes: ["ALL", "ASSIGNED"],
        defaultScope: "ALL",
      },
      {
        id: "hifz.approve",
        module: "hifz",
        action: "approve",
        title: "পারা সমাপ্তি ও খতম অনুমোদন",
        titleEn: "Approve Para Completion",
        description: "১ পারা বা পূর্ণ ৩০ পারা হিফজ সমাপ্তি সত্যায়ন",
        riskLevel: "HIGH",
        supportedScopes: ["ALL"],
        defaultScope: "ALL",
      },
      {
        id: "hifz.report",
        module: "hifz",
        action: "report",
        title: "হিফজ প্রগ্রেস কার্ড ডাউনলোড",
        titleEn: "Export Hifz Reports",
        description: "হিফজ কার্ড ও সাপ্তাহিক মূল্যায়ন পত্র প্রিন্ট",
        riskLevel: "LOW",
        supportedScopes: ["ALL", "ASSIGNED", "LINKED"],
        defaultScope: "ALL",
      },
    ],
  },
  {
    id: "finance",
    title: "অর্থ ও হিসাব (Accounting)",
    titleEn: "Finance & Accounts",
    iconName: "Wallet",
    permissions: [
      {
        id: "finance.view",
        module: "finance",
        action: "view",
        title: "আয়-ব্যয় ও হিসাব বিবরণী দেখা",
        titleEn: "View Accounts",
        description: "মাদ্রাসার ক্যাশ বুক, ব্যাংক ব্যালেন্স ও লেজার দেখা",
        riskLevel: "HIGH",
        supportedScopes: ["ALL"],
        defaultScope: "ALL",
      },
      {
        id: "finance.create",
        module: "finance",
        action: "create",
        title: "আয় বা ব্যয়ের ভাউচার তৈরি",
        titleEn: "Create Transaction",
        description: "নগদ বা ব্যাংক লেনদেনের ভাউচার লিপিবদ্ধ করা",
        riskLevel: "HIGH",
        supportedScopes: ["ALL"],
        defaultScope: "ALL",
      },
      {
        id: "finance.edit",
        module: "finance",
        action: "edit",
        title: "লেনদেন ও ভাউচার সংশোধন",
        titleEn: "Edit Transaction",
        description: "ভুল ভাউচারের খাত বা টাকার পরিমাণ পরিবর্তন",
        riskLevel: "CRITICAL",
        supportedScopes: ["ALL"],
        defaultScope: "ALL",
      },
      {
        id: "finance.delete",
        module: "finance",
        action: "delete",
        title: "ভাউচার বাতিল বা মুছে ফেলা",
        titleEn: "Delete Transaction",
        description: "অযাচিত বা ভুল লেনদেন হিসাব থেকে মুছে ফেলা",
        riskLevel: "CRITICAL",
        supportedScopes: ["ALL"],
        defaultScope: "ALL",
      },
      {
        id: "finance.approve",
        module: "finance",
        action: "approve",
        title: "ব্যয় ও উত্তোলন অনুমোদন",
        titleEn: "Approve Expenses",
        description: "বড় অঙ্কের মাদ্রাসা ব্যয় ভাউচার মুহতামিম কর্তৃক অনুমোদন",
        riskLevel: "CRITICAL",
        supportedScopes: ["ALL"],
        defaultScope: "ALL",
      },
      {
        id: "finance.export",
        module: "finance",
        action: "export",
        title: "আর্থিক অডিট ও ব্যালেন্স শীট ডাউনলোড",
        titleEn: "Export Financial Reports",
        description: "মাসিক অডিট ও বাৎসরিক আয়-ব্যয় রিপোর্ট এক্সপোর্ট",
        riskLevel: "HIGH",
        supportedScopes: ["ALL"],
        defaultScope: "ALL",
      },
    ],
  },
  {
    id: "fees",
    title: "ফি ও মাসিক বেতন আদায়",
    titleEn: "Student Fees & Collections",
    iconName: "CreditCard",
    permissions: [
      {
        id: "fee.view",
        module: "fees",
        action: "view",
        title: "শিক্ষার্থীর ফি ও বকেয়া দেখা",
        titleEn: "View Fees",
        description: "মাসিক বেতন, ভর্তি ফি ও বকেয়া তালিকা দেখা",
        riskLevel: "LOW",
        supportedScopes: ["ALL", "ASSIGNED", "LINKED", "SELF"],
        defaultScope: "ALL",
      },
      {
        id: "fee.create",
        module: "fees",
        action: "create",
        title: "ফি আদায় ও মানি রিসিট প্রদান",
        titleEn: "Collect Fees / Issue Receipt",
        description: "নগদ বা অনলাইনে ফি গ্রহণ ও রসিদ তৈরি",
        riskLevel: "MEDIUM",
        supportedScopes: ["ALL"],
        defaultScope: "ALL",
      },
      {
        id: "fee.edit",
        module: "fees",
        action: "edit",
        title: "রসিদ ও ফি স্ট্রাকচার পরিবর্তন",
        titleEn: "Edit Fee Record",
        description: "আদায়কৃত রসিদের তথ্য ও ভুলের সংশোধন",
        riskLevel: "HIGH",
        supportedScopes: ["ALL"],
        defaultScope: "ALL",
      },
      {
        id: "fee.discount",
        module: "fees",
        action: "discount",
        title: "ফি ছাড় ও বিশেষ ছাড়ের আবেদন",
        titleEn: "Apply Fee Discount",
        description: "অসহায় বা দরিদ্র শিক্ষার্থীর ফি ছাড় দেওয়া বা আবেদন",
        riskLevel: "HIGH",
        supportedScopes: ["ALL"],
        defaultScope: "ALL",
      },
      {
        id: "fee.waiver",
        module: "fees",
        action: "waiver",
        title: "সম্পূর্ণ মওকুফ ও ফ্রি শিক্ষা নির্ধারণ",
        titleEn: "Fee Waiver",
        description: "শিক্ষার্থীর সম্পূর্ণ ফি মওকুফ করা",
        riskLevel: "CRITICAL",
        supportedScopes: ["ALL"],
        defaultScope: "ALL",
      },
      {
        id: "fee.approve",
        module: "fees",
        action: "approve",
        title: "ফি ছাড় ও মওকুফ চূড়ান্ত অনুমোদন",
        titleEn: "Approve Fee Discounts",
        description: "মুহতামিম হিসেবে ফি ছাড়ের আবেদন মঞ্জুর করা",
        riskLevel: "CRITICAL",
        supportedScopes: ["ALL"],
        defaultScope: "ALL",
      },
      {
        id: "fee.export",
        module: "fees",
        action: "export",
        title: "বকেয়া ও কালেকশন রিপোর্ট ডাউনলোড",
        titleEn: "Export Fee Reports",
        description: "বকেয়ার তালিকা ও ক্যাশ রসিদ প্রিন্ট",
        riskLevel: "MEDIUM",
        supportedScopes: ["ALL"],
        defaultScope: "ALL",
      },
    ],
  },
  {
    id: "library",
    title: "কুতুবখানা (Library)",
    titleEn: "Library Management",
    iconName: "Library",
    permissions: [
      {
        id: "library.view",
        module: "library",
        action: "view",
        title: "কিতাব তালিকা ও প্রাপ্যতা দেখা",
        titleEn: "View Library Catalog",
        description: "কুতুবখানার কিতাব ও ধার তালিকার তথ্য",
        riskLevel: "LOW",
        supportedScopes: ["ALL", "SELF"],
        defaultScope: "ALL",
      },
      {
        id: "library.create",
        module: "library",
        action: "create",
        title: "নতুন কিতাব যোগ",
        titleEn: "Add Books",
        description: "নতুন কিতাব বা ভলিউম ক্যাটালগ ভুক্ত করা",
        riskLevel: "MEDIUM",
        supportedScopes: ["ALL"],
        defaultScope: "ALL",
      },
      {
        id: "library.edit",
        module: "library",
        action: "edit",
        title: "কিতাবের তথ্য আপডেট",
        titleEn: "Edit Books",
        description: "কিতাবের র্যাক নম্বর, লেখক বা অবস্থা পরিবর্তন",
        riskLevel: "MEDIUM",
        supportedScopes: ["ALL"],
        defaultScope: "ALL",
      },
      {
        id: "library.issue",
        module: "library",
        action: "issue",
        title: "কিতাব ইস্যু ও ধার প্রদান",
        titleEn: "Issue Books",
        description: "শিক্ষার্থী বা ওস্তাদকে কিতাব ধার দেওয়া",
        riskLevel: "MEDIUM",
        supportedScopes: ["ALL"],
        defaultScope: "ALL",
      },
      {
        id: "library.return",
        module: "library",
        action: "return",
        title: "কিতাব ফেরত গ্রহণ ও জরিমানা",
        titleEn: "Return Books",
        description: "ধার দেওয়া কিতাব ফেরত গ্রহণ ও নথিবদ্ধকরণ",
        riskLevel: "MEDIUM",
        supportedScopes: ["ALL"],
        defaultScope: "ALL",
      },
      {
        id: "library.report",
        module: "library",
        action: "report",
        title: "কুতুবখানা রিপোর্ট ডাউনলোড",
        titleEn: "Library Reports",
        description: "অনুপস্থিত ও ধার করা কিতাবের তালিকা",
        riskLevel: "LOW",
        supportedScopes: ["ALL"],
        defaultScope: "ALL",
      },
    ],
  },
  {
    id: "documents",
    title: "নথি ও প্রত্যয়নপত্র (Certificates)",
    titleEn: "Documents & Certificates",
    iconName: "FileText",
    permissions: [
      {
        id: "document.view",
        module: "documents",
        action: "view",
        title: "ডকুমেন্টস ও ফাইল দেখা",
        titleEn: "View Documents",
        description: "মাদ্রাসার সাধারণ নোটিশ ও ফাইল দেখা",
        riskLevel: "LOW",
        supportedScopes: ["ALL", "ASSIGNED", "LINKED", "SELF"],
        defaultScope: "ALL",
      },
      {
        id: "document.create",
        module: "documents",
        action: "create",
        title: "ডকুমেন্ট আপলোড ও সংরক্ষণ",
        titleEn: "Create / Upload Documents",
        description: "নতুন রেজুলেশন বা প্রাতিষ্ঠানিক ফাইল রাখা",
        riskLevel: "MEDIUM",
        supportedScopes: ["ALL"],
        defaultScope: "ALL",
      },
      {
        id: "document.edit",
        module: "documents",
        action: "edit",
        title: "ডকুমেন্টের শিরোনাম ও তথ্য পরিবর্তন",
        titleEn: "Edit Documents",
        description: "ফাইলের নাম ও এক্সেস লেভেল পরিবর্তন",
        riskLevel: "MEDIUM",
        supportedScopes: ["ALL"],
        defaultScope: "ALL",
      },
      {
        id: "document.delete",
        module: "documents",
        action: "delete",
        title: "ডকুমেন্ট মুছে ফেলা",
        titleEn: "Delete Documents",
        description: "ফাইল চিরতরে মুছে ফেলা",
        riskLevel: "HIGH",
        supportedScopes: ["ALL"],
        defaultScope: "ALL",
      },
      {
        id: "document.print",
        module: "documents",
        action: "print",
        title: "ডকুমেন্ট প্রিন্ট করা",
        titleEn: "Print Documents",
        description: "মাদ্রাসার প্যাডে নথি প্রিন্ট নেওয়া",
        riskLevel: "LOW",
        supportedScopes: ["ALL", "ASSIGNED", "LINKED", "SELF"],
        defaultScope: "ALL",
      },
      {
        id: "certificate.view",
        module: "documents",
        action: "certificate.view",
        title: "সনদপত্র ও প্রত্যয়ন দেখা",
        titleEn: "View Certificates",
        description: "ইস্যুকৃত প্রশংসাপত্র ও চারিত্রিক সনদ দেখা",
        riskLevel: "LOW",
        supportedScopes: ["ALL", "LINKED", "SELF"],
        defaultScope: "ALL",
      },
      {
        id: "certificate.create",
        module: "documents",
        action: "certificate.create",
        title: "সনদপত্র জেনারেট ও ডিজাইন",
        titleEn: "Generate Certificates",
        description: "হিফজ সমাপ্তি বা দাওরায়ে হাদিস সনদ তৈরি",
        riskLevel: "HIGH",
        supportedScopes: ["ALL"],
        defaultScope: "ALL",
      },
      {
        id: "certificate.issue",
        module: "documents",
        action: "certificate.issue",
        title: "সনদপত্র চূড়ান্ত ইস্যু ও স্বাক্ষর",
        titleEn: "Issue Official Certificate",
        description: "মুহতামিমের স্বাক্ষরযুক্ত সনদ শিক্ষার্থীকে দেওয়া",
        riskLevel: "CRITICAL",
        supportedScopes: ["ALL"],
        defaultScope: "ALL",
      },
      {
        id: "certificate.revoke",
        module: "documents",
        action: "certificate.revoke",
        title: "সনদপত্র বাতিল (Revoke)",
        titleEn: "Revoke Certificate",
        description: "প্রতারণা বা ভুলের কারণে পূর্বে প্রদত্ত সনদ বাতিল",
        riskLevel: "CRITICAL",
        supportedScopes: ["ALL"],
        defaultScope: "ALL",
      },
      {
        id: "certificate.export",
        module: "documents",
        action: "certificate.export",
        title: "সনদপত্র হাই-রেজুলিউশন প্রিন্ট ও ডাউনলোড",
        titleEn: "Export Certificate PDF",
        description: "সনদের ভেক্টর বা পিডিএফ ডাউনলোড",
        riskLevel: "MEDIUM",
        supportedScopes: ["ALL", "LINKED", "SELF"],
        defaultScope: "ALL",
      },
    ],
  },
  {
    id: "id_cards",
    title: "ডিজিটাল আইডি কার্ড",
    titleEn: "Digital ID Cards",
    iconName: "IdCard",
    permissions: [
      {
        id: "id.view",
        module: "id_cards",
        action: "view",
        title: "আইডি কার্ড দেখা ও প্রিভিউ",
        titleEn: "View ID Cards",
        description: "শিক্ষার্থী ও স্টাফের ডিজিটাল আইডি কার্ড দেখা",
        riskLevel: "LOW",
        supportedScopes: ["ALL", "ASSIGNED", "LINKED", "SELF"],
        defaultScope: "ALL",
      },
      {
        id: "id.generate",
        module: "id_cards",
        action: "generate",
        title: "আইডি কার্ড জেনারেট ও কিউআর কোড তৈরি",
        titleEn: "Generate ID Cards",
        description: "এক ক্লিকে সম্পূর্ণ ক্লাসের আইডি কার্ড তৈরি",
        riskLevel: "MEDIUM",
        supportedScopes: ["ALL"],
        defaultScope: "ALL",
      },
      {
        id: "id.issue",
        module: "id_cards",
        action: "issue",
        title: "আইডি কার্ড প্রিন্ট ও বিতরণ",
        titleEn: "Print / Issue ID Cards",
        description: "আইডি কার্ড পিভিসি কার্ড আকারে প্রিন্ট নেওয়া",
        riskLevel: "LOW",
        supportedScopes: ["ALL", "ASSIGNED", "LINKED", "SELF"],
        defaultScope: "ALL",
      },
      {
        id: "id.revoke",
        module: "id_cards",
        action: "revoke",
        title: "আইডি কার্ড নিষ্ক্রিয় বা বাতিল",
        titleEn: "Revoke ID Card",
        description: "হারিয়ে যাওয়া বা মাদ্রাসা ত্যাগে কিউআর ভেরিফিকেশন ব্লক",
        riskLevel: "HIGH",
        supportedScopes: ["ALL"],
        defaultScope: "ALL",
      },
    ],
  },
  {
    id: "communication",
    title: "নোটিশ ও এসএমএস",
    titleEn: "Communication & Notices",
    iconName: "MessageSquare",
    permissions: [
      {
        id: "notification.view",
        module: "communication",
        action: "view",
        title: "নোটিশ ও বার্তা দেখা",
        titleEn: "View Notices",
        description: "মাদ্রাসার সাধারণ নোটিশ ও বার্তা দেখা",
        riskLevel: "LOW",
        supportedScopes: ["ALL", "ASSIGNED", "LINKED", "SELF"],
        defaultScope: "ALL",
      },
      {
        id: "notification.create",
        module: "communication",
        action: "create",
        title: "নোটিশ তৈরি ও প্রকাশ",
        titleEn: "Create Notices",
        description: "নোটিশ বোর্ডে সাধারণ বা জরুরি নোটিশ লাগানো",
        riskLevel: "MEDIUM",
        supportedScopes: ["ALL"],
        defaultScope: "ALL",
      },
      {
        id: "notification.send",
        module: "communication",
        action: "send",
        title: "এসএমএস ও পুশ বার্তা প্রেরণ",
        titleEn: "Send SMS Alerts",
        description: "অনুপস্থিতি বা বেতন বকেয়ার এসএমএস পাঠানো",
        riskLevel: "HIGH",
        supportedScopes: ["ALL", "ASSIGNED"],
        defaultScope: "ALL",
      },
      {
        id: "notification.broadcast",
        module: "communication",
        action: "broadcast",
        title: "গণ-এসএমএস (Bulk SMS) সম্প্রচার",
        titleEn: "Broadcast SMS",
        description: "মাদ্রাসার সকল অভিভাবক ও শুভাকাঙ্ক্ষীদের একসাথে এসএমএস",
        riskLevel: "CRITICAL",
        supportedScopes: ["ALL"],
        defaultScope: "ALL",
      },
    ],
  },
  {
    id: "users_roles",
    title: "ইউজার ও রোল নিয়ন্ত্রণ (Security)",
    titleEn: "User & Role Management",
    iconName: "ShieldCheck",
    permissions: [
      {
        id: "user.view",
        module: "users_roles",
        action: "user.view",
        title: "ইউজার একাউন্ট তালিকা দেখা",
        titleEn: "View Users",
        description: "মাদ্রাসার সকল লগইন ইউজার ও স্ট্যাটাস দেখা",
        riskLevel: "MEDIUM",
        supportedScopes: ["ALL"],
        defaultScope: "ALL",
      },
      {
        id: "user.create",
        module: "users_roles",
        action: "user.create",
        title: "নতুন ইউজার একাউন্ট তৈরি",
        titleEn: "Create User Accounts",
        description: "শিক্ষক, অভিভাবক ও স্টাফদের লগইন পাসওয়ার্ড প্রদান",
        riskLevel: "HIGH",
        supportedScopes: ["ALL"],
        defaultScope: "ALL",
      },
      {
        id: "user.edit",
        module: "users_roles",
        action: "user.edit",
        title: "ইউজার তথ্য ও ভূমিকা পরিবর্তন",
        titleEn: "Edit User Account",
        description: "ইউজারের নাম, ফোন ও রোল পরিবর্তন",
        riskLevel: "HIGH",
        supportedScopes: ["ALL"],
        defaultScope: "ALL",
      },
      {
        id: "user.disable",
        module: "users_roles",
        action: "user.disable",
        title: "ইউজার সাসপেন্ড বা ব্লক করা",
        titleEn: "Suspend / Disable User",
        description: "সাময়িকভাবে ইউজারের লগইন ক্ষমতা বন্ধ করা",
        riskLevel: "CRITICAL",
        supportedScopes: ["ALL"],
        defaultScope: "ALL",
      },
      {
        id: "user.reset",
        module: "users_roles",
        action: "user.reset",
        title: "পাসওয়ার্ড রিসেট বা পিন পরিবর্তন",
        titleEn: "Reset User Password",
        description: "ইউজারের নতুন পাসওয়ার্ড সেট করা",
        riskLevel: "HIGH",
        supportedScopes: ["ALL"],
        defaultScope: "ALL",
      },
      {
        id: "role.view",
        module: "users_roles",
        action: "role.view",
        title: "রোল ও পারমিশন তালিকা দেখা",
        titleEn: "View Roles & Permissions",
        description: "সিস্টেম এবং কাস্টম রোলসমূহের অধিকারসমূহ দেখা",
        riskLevel: "LOW",
        supportedScopes: ["ALL"],
        defaultScope: "ALL",
      },
      {
        id: "role.create",
        module: "users_roles",
        action: "role.create",
        title: "নতুন কাস্টম রোল তৈরি",
        titleEn: "Create Custom Role",
        description: "নির্দিষ্ট পারমিশন ও ডাটা স্কোপসহ নতুন রোল তৈরি",
        riskLevel: "CRITICAL",
        supportedScopes: ["ALL"],
        defaultScope: "ALL",
      },
      {
        id: "role.edit",
        module: "users_roles",
        action: "role.edit",
        title: "রোল পারমিশন পরিবর্তন",
        titleEn: "Edit Role Permissions",
        description: "বিদ্যমান রোলের পারমিশন তালিকা আপডেট করা",
        riskLevel: "CRITICAL",
        supportedScopes: ["ALL"],
        defaultScope: "ALL",
      },
      {
        id: "role.delete",
        module: "users_roles",
        action: "role.delete",
        title: "কাস্টম রোল মুছে ফেলা",
        titleEn: "Delete Custom Role",
        description: "অব্যবহৃত কাস্টম রোল মুছে ফেলা",
        riskLevel: "CRITICAL",
        supportedScopes: ["ALL"],
        defaultScope: "ALL",
      },
      {
        id: "role.assign",
        module: "users_roles",
        action: "role.assign",
        title: "ইউজারকে রোল বরাদ্দ ও সরাসরি পারমিশন প্রদান",
        titleEn: "Assign Roles & Overrides",
        description: "ইউজারকে পদাধিকার বলে ক্ষমতা বা প্রত্যক্ষ অধিকার প্রদান",
        riskLevel: "CRITICAL",
        supportedScopes: ["ALL"],
        defaultScope: "ALL",
      },
      {
        id: "audit.view",
        module: "users_roles",
        action: "audit.view",
        title: "নিরাপত্তা ও অডিট লগ দেখা",
        titleEn: "View Security Audit Trail",
        description: "কারা কখন কোন তথ্য পরিবর্তন বা ডিলিট করেছে তার হিস্ট্রি",
        riskLevel: "HIGH",
        supportedScopes: ["ALL"],
        defaultScope: "ALL",
      },
      {
        id: "audit.export",
        module: "users_roles",
        action: "audit.export",
        title: "অডিট লগ ডাউনলোড ও এক্সপোর্ট",
        titleEn: "Export Audit Log",
        description: "নিরাপত্তা লগ রিপোর্ট নামানো",
        riskLevel: "CRITICAL",
        supportedScopes: ["ALL"],
        defaultScope: "ALL",
      },
      {
        id: "settings.view",
        module: "users_roles",
        action: "settings.view",
        title: "মাদ্রাসার সেটিংস ও প্রোফাইল দেখা",
        titleEn: "View Madrasa Settings",
        description: "প্রতিষ্ঠানের নাম, লোগো ও সাধারণ তথ্য দেখা",
        riskLevel: "LOW",
        supportedScopes: ["ALL"],
        defaultScope: "ALL",
      },
      {
        id: "settings.edit",
        module: "users_roles",
        action: "settings.edit",
        title: "মাদ্রাসার মূল সেটিংস ও কনফিগারেশন পরিবর্তন",
        titleEn: "Edit Madrasa Settings",
        description: "লোগো, প্রধানের স্বাক্ষর ও মাদ্রাসার মূল তথ্য আপডেট",
        riskLevel: "CRITICAL",
        supportedScopes: ["ALL"],
        defaultScope: "ALL",
      },
    ],
  },
];

// Flat list of all permission IDs
export const ALL_PERMISSION_IDS: string[] = PERMISSION_CATEGORIES.flatMap((c) =>
  c.permissions.map((p) => p.id)
);

export const PERMISSION_MAP: Record<string, PermissionDefinition> = Object.fromEntries(
  PERMISSION_CATEGORIES.flatMap((c) => c.permissions.map((p) => [p.id, p]))
);

// ─────────────────────────────────────────────────────────────────────────────
// 2. DEFAULT SYSTEM ROLES DEFINITION
// ─────────────────────────────────────────────────────────────────────────────

export interface RoleDefinition {
  id: string; // e.g. "super_admin", "teacher", "custom_123"
  name: string; // Bengali Name e.g. "সুপার অ্যাডমিন"
  nameEn: string;
  description: string;
  isSystem: boolean; // System roles cannot be deleted
  isCustom?: boolean;
  colorBg: string;
  colorText: string;
  defaultDataScope: DataScope;
  permissions: string[]; // List of permission IDs
  deniedPermissions?: string[]; // Explicit deny
  createdAt?: string;
  updatedAt?: string;
}

export const DEFAULT_SYSTEM_ROLES: RoleDefinition[] = [
  {
    id: "super_admin",
    name: "সুপার অ্যাডমিন",
    nameEn: "Super Admin",
    description: "মাদ্রাসার সর্বোচ্চ প্রশাসনিক ক্ষমতা, সকল মডিউল, সেটিংস, ইউজার ও রোলে পূর্ণ এক্সেস।",
    isSystem: true,
    colorBg: "bg-purple-100",
    colorText: "text-purple-800",
    defaultDataScope: "ALL",
    permissions: [...ALL_PERMISSION_IDS], // Full Access
  },
  {
    id: "muhtamim",
    name: "মুহতামিম / প্রধান",
    nameEn: "Mohtamim / Principal",
    description: "মাদ্রাসার প্রশাসনিক ও একাডেমিক প্রধান। সকল ছাত্র, শিক্ষক, হাজিরা, পরীক্ষা ও অনুমোদন পরিচালনা।",
    isSystem: true,
    colorBg: "bg-amber-100",
    colorText: "text-amber-800",
    defaultDataScope: "ALL",
    permissions: [
      "dashboard.view",
      "dashboard.analytics",
      "student.view",
      "student.create",
      "student.edit",
      "student.archive",
      "student.export",
      "student.documents.view",
      "student.documents.manage",
      "student.profile.approve",
      "guardian.view",
      "guardian.create",
      "guardian.edit",
      "guardian.archive",
      "teacher.view",
      "teacher.create",
      "teacher.edit",
      "teacher.archive",
      "staff.view",
      "staff.create",
      "staff.edit",
      "staff.archive",
      "staff.attendance",
      "staff.leave",
      "staff.leave.approve",
      "staff.salary.view",
      "staff.salary.manage",
      "staff.documents.view",
      "staff.documents.manage",
      "attendance.view",
      "attendance.create",
      "attendance.edit",
      "attendance.approve",
      "attendance.export",
      "academic.view",
      "academic.manage",
      "routine.view",
      "routine.create",
      "routine.edit",
      "routine.delete",
      "routine.publish",
      "exam.view",
      "exam.create",
      "exam.edit",
      "exam.marks.enter",
      "exam.marks.edit",
      "exam.result.publish",
      "exam.result.approve",
      "exam.export",
      "hifz.view",
      "hifz.create",
      "hifz.edit",
      "hifz.approve",
      "hifz.report",
      "finance.view",
      "finance.create",
      "finance.edit",
      "finance.approve",
      "finance.export",
      "fee.view",
      "fee.create",
      "fee.edit",
      "fee.discount",
      "fee.waiver",
      "fee.approve",
      "fee.export",
      "library.view",
      "library.create",
      "library.edit",
      "library.issue",
      "library.return",
      "library.report",
      "document.view",
      "document.create",
      "document.edit",
      "document.print",
      "certificate.view",
      "certificate.create",
      "certificate.edit",
      "certificate.issue",
      "certificate.revoke",
      "certificate.export",
      "id.view",
      "id.generate",
      "id.issue",
      "id.revoke",
      "notification.view",
      "notification.create",
      "notification.send",
      "notification.broadcast",
      "user.view",
      "user.create",
      "user.edit",
      "user.disable",
      "user.reset",
      "role.view",
      "role.assign",
      "audit.view",
      "settings.view",
      "settings.edit",
    ],
  },
  {
    id: "admin",
    name: "অ্যাডমিন (General Admin)",
    nameEn: "Administrator",
    description: "সাধারণ প্রশাসনিক ও একাডেমিক ব্যবস্থাপনা।",
    isSystem: true,
    colorBg: "bg-indigo-100",
    colorText: "text-indigo-800",
    defaultDataScope: "ALL",
    permissions: [
      "dashboard.view",
      "student.view",
      "student.create",
      "student.edit",
      "student.export",
      "student.documents.view",
      "guardian.view",
      "guardian.create",
      "guardian.edit",
      "teacher.view",
      "staff.view",
      "staff.attendance",
      "attendance.view",
      "attendance.create",
      "attendance.edit",
      "attendance.export",
      "academic.view",
      "routine.view",
      "routine.create",
      "routine.edit",
      "routine.publish",
      "exam.view",
      "exam.create",
      "exam.edit",
      "exam.marks.enter",
      "exam.marks.edit",
      "exam.export",
      "hifz.view",
      "fee.view",
      "fee.create",
      "library.view",
      "library.issue",
      "library.return",
      "document.view",
      "document.create",
      "document.print",
      "certificate.view",
      "certificate.create",
      "certificate.export",
      "id.view",
      "id.generate",
      "id.issue",
      "notification.view",
      "notification.create",
      "notification.send",
      "settings.view",
    ],
  },
  {
    id: "teacher",
    name: "শিক্ষক / ওস্তাদ",
    nameEn: "Teacher",
    description: "নির্ধারিত ক্লাসের শিক্ষার্থী দেখা, হাজিরা গ্রহণ, রুটিন, বিষয়ের নম্বর প্রদান ও হিফজ ট্র্যাকিং।",
    isSystem: true,
    colorBg: "bg-emerald-100",
    colorText: "text-emerald-800",
    defaultDataScope: "ASSIGNED",
    permissions: [
      "dashboard.view",
      "student.view",
      "attendance.view",
      "attendance.create",
      "academic.view",
      "routine.view",
      "exam.view",
      "exam.marks.enter",
      "hifz.view",
      "hifz.create",
      "hifz.edit",
      "hifz.report",
      "library.view",
      "document.view",
      "document.print",
      "notification.view",
      "id.view",
    ],
  },
  {
    id: "accountant",
    name: "হিসাবরক্ষক (Accountant)",
    nameEn: "Accountant",
    description: "অর্থ, ফি আদায়, ভাউচার তৈরি, ব্যয় ও আর্থিক রিপোর্ট ব্যবস্থাপনা।",
    isSystem: true,
    colorBg: "bg-orange-100",
    colorText: "text-orange-800",
    defaultDataScope: "ALL",
    permissions: [
      "dashboard.view",
      "student.view",
      "guardian.view",
      "staff.view",
      "staff.salary.view",
      "staff.salary.manage",
      "finance.view",
      "finance.create",
      "finance.edit",
      "finance.export",
      "fee.view",
      "fee.create",
      "fee.edit",
      "fee.discount",
      "fee.export",
      "notification.view",
      "notification.send",
    ],
  },
  {
    id: "office_staff",
    name: "অফিস সহকারী",
    nameEn: "Office Staff",
    description: "ভর্তি ফরম গ্রহণ, ছাত্র তথ্য এন্ট্রি, সাধারণ নোটিশ ও সার্টিফিকেট তৈরি।",
    isSystem: true,
    colorBg: "bg-sky-100",
    colorText: "text-sky-800",
    defaultDataScope: "ALL",
    permissions: [
      "dashboard.view",
      "student.view",
      "student.create",
      "student.edit",
      "student.export",
      "student.documents.view",
      "guardian.view",
      "guardian.create",
      "guardian.edit",
      "teacher.view",
      "staff.view",
      "attendance.view",
      "academic.view",
      "routine.view",
      "document.view",
      "document.create",
      "document.print",
      "certificate.view",
      "certificate.create",
      "certificate.export",
      "id.view",
      "id.generate",
      "id.issue",
      "notification.view",
      "notification.create",
    ],
  },
  {
    id: "hifz_supervisor",
    name: "হিফজ তত্ত্বাবধায়ক",
    nameEn: "Hifz Supervisor",
    description: "হিফজ ছাত্রদের অগ্রগতি ট্র্যাকিং, ছবক মূল্যায়ন, পারা সমাপ্তি ও রিপোর্ট তৈরি।",
    isSystem: true,
    colorBg: "bg-teal-100",
    colorText: "text-teal-800",
    defaultDataScope: "ASSIGNED",
    permissions: [
      "dashboard.view",
      "student.view",
      "attendance.view",
      "attendance.create",
      "hifz.view",
      "hifz.create",
      "hifz.edit",
      "hifz.approve",
      "hifz.report",
      "notification.view",
      "notification.send",
    ],
  },
  {
    id: "exam_manager",
    name: "পরীক্ষা নিয়ন্ত্রক",
    nameEn: "Exam Controller",
    description: "পরীক্ষা শিডিউল, প্রশ্নব্যাংক, নম্বর এন্ট্রি নিরীক্ষা, তাবলিস শিট ও ফলাফল প্রকাশ।",
    isSystem: true,
    colorBg: "bg-rose-100",
    colorText: "text-rose-800",
    defaultDataScope: "ALL",
    permissions: [
      "dashboard.view",
      "student.view",
      "academic.view",
      "routine.view",
      "exam.view",
      "exam.create",
      "exam.edit",
      "exam.marks.enter",
      "exam.marks.edit",
      "exam.result.publish",
      "exam.result.approve",
      "exam.export",
      "certificate.view",
      "certificate.create",
      "certificate.export",
      "notification.view",
      "notification.create",
    ],
  },
  {
    id: "librarian",
    name: "গ্রন্থাগারিক (Librarian)",
    nameEn: "Librarian",
    description: "কুতুবখানার কিতাব সংরক্ষণ, ইস্যু, ফেরত গ্রহণ ও ক্যাটালগ ব্যবস্থাপনা।",
    isSystem: true,
    colorBg: "bg-cyan-100",
    colorText: "text-cyan-800",
    defaultDataScope: "ALL",
    permissions: [
      "dashboard.view",
      "student.view",
      "teacher.view",
      "staff.view",
      "library.view",
      "library.create",
      "library.edit",
      "library.issue",
      "library.return",
      "library.report",
      "notification.view",
    ],
  },
  {
    id: "attendance_manager",
    name: "হাজিরা ইনচার্জ",
    nameEn: "Attendance Incharge",
    description: "মাদ্রাসার সকল ক্লাস ও কর্মচারীদের দৈনন্দিন উপস্থিতি ও রিপোর্ট মনিটরিং।",
    isSystem: true,
    colorBg: "bg-lime-100",
    colorText: "text-lime-800",
    defaultDataScope: "ALL",
    permissions: [
      "dashboard.view",
      "student.view",
      "attendance.view",
      "attendance.create",
      "attendance.edit",
      "attendance.approve",
      "attendance.export",
      "staff.view",
      "staff.attendance",
      "notification.view",
      "notification.send",
    ],
  },
  {
    id: "hr_manager",
    name: "মানবসম্পদ ইনচার্জ (HR)",
    nameEn: "HR Manager",
    description: "স্টাফ নিয়োগ, পদবী, বায়োডাটা, হাজিরা, ছুটির আবেদন ও প্রত্যয়নপত্র পরিচালনা।",
    isSystem: true,
    colorBg: "bg-violet-100",
    colorText: "text-violet-800",
    defaultDataScope: "ALL",
    permissions: [
      "dashboard.view",
      "teacher.view",
      "teacher.create",
      "teacher.edit",
      "staff.view",
      "staff.create",
      "staff.edit",
      "staff.archive",
      "staff.attendance",
      "staff.leave",
      "staff.leave.approve",
      "staff.documents.view",
      "staff.documents.manage",
      "document.view",
      "document.create",
      "notification.view",
      "notification.send",
    ],
  },
  {
    id: "student",
    name: "শিক্ষার্থী (Student Portal)",
    nameEn: "Student",
    description: "নিজ প্রোফাইল, উপস্থিতি, ফলাফল, রুটিন, সনদ ও ডিজিটাল আইডি কার্ড দেখা।",
    isSystem: true,
    colorBg: "bg-teal-100",
    colorText: "text-teal-800",
    defaultDataScope: "SELF",
    permissions: [
      "dashboard.view",
      "student.view",
      "student.documents.view",
      "attendance.view",
      "routine.view",
      "exam.view",
      "hifz.view",
      "fee.view",
      "certificate.view",
      "certificate.export",
      "id.view",
      "notification.view",
    ],
  },
  {
    id: "parent",
    name: "অভিভাবক (Parent Portal)",
    nameEn: "Parent / Guardian",
    description: "সন্তানের প্রোফাইল, উপস্থিতি, ফলাফল, ফি পরিশোধ ও নোটিশ দেখা।",
    isSystem: true,
    colorBg: "bg-blue-100",
    colorText: "text-blue-800",
    defaultDataScope: "LINKED",
    permissions: [
      "dashboard.view",
      "student.view",
      "student.documents.view",
      "attendance.view",
      "routine.view",
      "exam.view",
      "hifz.view",
      "fee.view",
      "certificate.view",
      "certificate.export",
      "id.view",
      "notification.view",
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// 3. USER SECURITY PROFILE & EFFECTIVE PERMISSION ENGINE
// ─────────────────────────────────────────────────────────────────────────────

export interface TemporaryPermission {
  permission: string;
  grantedAt: string;
  expiresAt: string; // ISO String
  grantedBy: string; // User ID
  reason?: string;
}

export interface UserSecurityProfile {
  userId: string;
  madrasaId: string;
  fullName: string;
  email: string;
  phone?: string | null;
  primaryRole: string; // e.g. "teacher"
  roles: string[]; // Support multi-role
  status: UserAccountStatus;
  directPermissions: string[]; // Direct allow overrides
  deniedPermissions: string[]; // Explicit deny overrides
  temporaryPermissions: TemporaryPermission[];
  dataScopeOverrides?: Record<string, DataScope>;
  assignedClassIds?: string[];
  assignedSubjectIds?: string[];
  assignedStudentIds?: string[];
  linkedStudentIds?: string[];
  departmentId?: string;
}

export interface EffectivePermissionSummary {
  userId: string;
  madrasaId: string;
  status: UserAccountStatus;
  primaryRole: string;
  roles: string[];
  effectivePermissions: string[];
  permissionSources: Record<string, { source: "ROLE" | "DIRECT" | "TEMPORARY"; roleName?: string; expiresAt?: string }>;
  deniedPermissions: string[];
  effectiveScopes: Record<string, DataScope>;
}

/**
 * Deterministic Permission Resolver Order:
 * 1. System Security: Non-active users get NO permissions (except login/self profile view).
 * 2. Explicit User Deny: If denied directly on user -> DENIED.
 * 3. Role Deny: If denied in any assigned role -> DENIED.
 * 4. Active Temporary Permissions (if valid and not expired) -> ALLOWED.
 * 5. Direct User Allow Permissions -> ALLOWED.
 * 6. Role(s) Permissions -> Union of permissions from all assigned roles -> ALLOWED.
 * 7. Default -> DENIED.
 */
export function calculateEffectivePermissions(
  userProfile: UserSecurityProfile,
  allRoles: RoleDefinition[] = DEFAULT_SYSTEM_ROLES
): EffectivePermissionSummary {
  const rolesMap = new Map<string, RoleDefinition>();
  for (const r of allRoles) {
    rolesMap.set(r.id, r);
  }

  const assignedRoleIds = userProfile.roles && userProfile.roles.length > 0
    ? userProfile.roles
    : [userProfile.primaryRole];

  // If user is suspended or disabled, strip all active permissions
  if (userProfile.status === "SUSPENDED" || userProfile.status === "DISABLED") {
    return {
      userId: userProfile.userId,
      madrasaId: userProfile.madrasaId,
      status: userProfile.status,
      primaryRole: userProfile.primaryRole,
      roles: assignedRoleIds,
      effectivePermissions: [],
      permissionSources: {},
      deniedPermissions: ALL_PERMISSION_IDS,
      effectiveScopes: {},
    };
  }

  // 1. Collect all explicit denials
  const explicitDenials = new Set<string>(userProfile.deniedPermissions || []);
  for (const rId of assignedRoleIds) {
    const roleDef = rolesMap.get(rId);
    if (roleDef?.deniedPermissions) {
      for (const d of roleDef.deniedPermissions) {
        explicitDenials.add(d);
      }
    }
  }

  const effectivePermissionsSet = new Set<string>();
  const permissionSources: Record<string, { source: "ROLE" | "DIRECT" | "TEMPORARY"; roleName?: string; expiresAt?: string }> = {};
  const effectiveScopes: Record<string, DataScope> = {};

  // 2. Add Role-based permissions
  for (const rId of assignedRoleIds) {
    const roleDef = rolesMap.get(rId);
    if (!roleDef) continue;

    for (const perm of roleDef.permissions) {
      if (explicitDenials.has(perm)) continue;

      effectivePermissionsSet.add(perm);
      if (!permissionSources[perm]) {
        permissionSources[perm] = {
          source: "ROLE",
          roleName: roleDef.name,
        };
      }

      // Default scope for this module from role
      const permDef = PERMISSION_MAP[perm];
      const moduleKey = permDef?.module || "default";
      if (!effectiveScopes[moduleKey]) {
        effectiveScopes[moduleKey] = roleDef.defaultDataScope;
      }
    }
  }

  // 3. Add Direct user permissions
  if (userProfile.directPermissions) {
    for (const perm of userProfile.directPermissions) {
      if (explicitDenials.has(perm)) continue;

      effectivePermissionsSet.add(perm);
      permissionSources[perm] = { source: "DIRECT" };
    }
  }

  // 4. Add Active Temporary Permissions
  const now = new Date().getTime();
  if (userProfile.temporaryPermissions) {
    for (const temp of userProfile.temporaryPermissions) {
      if (explicitDenials.has(temp.permission)) continue;

      const expiry = new Date(temp.expiresAt).getTime();
      if (expiry > now) {
        effectivePermissionsSet.add(temp.permission);
        permissionSources[temp.permission] = {
          source: "TEMPORARY",
          expiresAt: temp.expiresAt,
        };
      }
    }
  }

  // 5. Apply User Data Scope Overrides
  if (userProfile.dataScopeOverrides) {
    for (const [mod, scope] of Object.entries(userProfile.dataScopeOverrides)) {
      effectiveScopes[mod] = scope;
    }
  }

  return {
    userId: userProfile.userId,
    madrasaId: userProfile.madrasaId,
    status: userProfile.status || "ACTIVE",
    primaryRole: userProfile.primaryRole,
    roles: assignedRoleIds,
    effectivePermissions: Array.from(effectivePermissionsSet),
    permissionSources,
    deniedPermissions: Array.from(explicitDenials),
    effectiveScopes,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. DATA SCOPE & RECORD ACCESS CHECKER
// ─────────────────────────────────────────────────────────────────────────────

export interface AccessCheckContext {
  studentId?: string;
  classId?: string;
  subjectId?: string;
  departmentId?: string;
  creatorId?: string;
  guardianStudentIds?: string[];
}

/**
 * Verify whether a user can access a specific record given their effective permissions and scope.
 */
export function canUserAccessRecord(
  summary: EffectivePermissionSummary,
  userProfile: UserSecurityProfile,
  permissionId: string,
  context: AccessCheckContext = {}
): boolean {
  // Check permission
  if (!summary.effectivePermissions.includes(permissionId)) {
    return false;
  }

  // If Super Admin, bypass data scope bounds
  if (summary.roles.includes("super_admin")) {
    return true;
  }

  const permDef = PERMISSION_MAP[permissionId];
  const moduleKey = permDef?.module || "default";
  const scope = summary.effectiveScopes[moduleKey] || permDef?.defaultScope || "ALL";

  switch (scope) {
    case "ALL":
      return true;

    case "OWN":
      return Boolean(context.creatorId && context.creatorId === summary.userId);

    case "ASSIGNED":
    case "CLASS":
      if (context.classId && userProfile.assignedClassIds?.includes(context.classId)) {
        return true;
      }
      if (context.studentId && userProfile.assignedStudentIds?.includes(context.studentId)) {
        return true;
      }
      if (context.subjectId && userProfile.assignedSubjectIds?.includes(context.subjectId)) {
        return true;
      }
      return false;

    case "DEPARTMENT":
      return Boolean(
        context.departmentId &&
        userProfile.departmentId &&
        context.departmentId === userProfile.departmentId
      );

    case "LINKED":
      if (context.studentId && userProfile.linkedStudentIds?.includes(context.studentId)) {
        return true;
      }
      return false;

    case "SELF":
      if (context.studentId && userProfile.userId === context.studentId) {
        return true;
      }
      return false;

    default:
      return true;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. SENSITIVE FIELD ACCESS CHECKER
// ─────────────────────────────────────────────────────────────────────────────

export function canAccessField(
  summary: EffectivePermissionSummary,
  module: "staff" | "student" | "finance",
  field: "salary" | "bank_account" | "nid" | "medical" | "fee_discount"
): boolean {
  if (summary.roles.includes("super_admin") || summary.roles.includes("muhtamim")) {
    return true;
  }

  if (module === "staff" && (field === "salary" || field === "bank_account")) {
    return summary.effectivePermissions.includes("staff.salary.view");
  }

  if (module === "student" && (field === "nid" || field === "medical")) {
    return summary.effectivePermissions.includes("student.documents.view");
  }

  if (field === "fee_discount") {
    return summary.effectivePermissions.includes("fee.discount");
  }

  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. APPROVAL ENGINE DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

export type ApprovalRequestType =
  | "FEE_DISCOUNT"
  | "FEE_WAIVER"
  | "SALARY_CHANGE"
  | "RESULT_PUBLISH"
  | "CERTIFICATE_ISSUE"
  | "CERTIFICATE_REVOKE"
  | "STUDENT_ARCHIVE"
  | "STAFF_TERMINATION";

export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export interface ApprovalRequest {
  id: string;
  madrasa_id: string;
  type: ApprovalRequestType;
  title: string;
  description: string;
  target_id: string; // e.g. student_id, staff_id, cert_id
  target_name?: string;
  payload: Record<string, any>;
  requested_by: {
    user_id: string;
    name: string;
    role: string;
  };
  requested_at: string;
  status: ApprovalStatus;
  reviewed_by?: {
    user_id: string;
    name: string;
    role: string;
  };
  reviewed_at?: string;
  review_notes?: string;
}

export const APPROVAL_REQUIRED_PERMISSIONS: Record<ApprovalRequestType, string> = {
  FEE_DISCOUNT: "fee.approve",
  FEE_WAIVER: "fee.approve",
  SALARY_CHANGE: "staff.salary.manage",
  RESULT_PUBLISH: "exam.result.approve",
  CERTIFICATE_ISSUE: "certificate.issue",
  CERTIFICATE_REVOKE: "certificate.revoke",
  STUDENT_ARCHIVE: "student.archive",
  STAFF_TERMINATION: "staff.archive",
};

// ─────────────────────────────────────────────────────────────────────────────
// 7. SECURITY AUDIT LOG DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

export type AuditActionType =
  | "USER_LOGIN"
  | "USER_LOGOUT"
  | "ROLE_CREATED"
  | "ROLE_UPDATED"
  | "ROLE_DELETED"
  | "ROLE_ASSIGNED"
  | "PERMISSION_GRANTED"
  | "PERMISSION_REVOKED"
  | "USER_SUSPENDED"
  | "USER_ACTIVATED"
  | "PASSWORD_RESET"
  | "APPROVAL_REQUESTED"
  | "APPROVAL_COMPLETED"
  | "SENSITIVE_DATA_EXPORTED"
  | "CERTIFICATE_REVOKED"
  | "RECORD_DELETED";

export interface SecurityAuditLog {
  id: string;
  madrasa_id: string;
  action: AuditActionType;
  module: string;
  actor_id: string;
  actor_name: string;
  actor_role: string;
  target_user_id?: string;
  target_user_name?: string;
  details: string;
  ip_address?: string;
  created_at: string;
}
