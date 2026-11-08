/**
 * QawmiERP Demo Profile Data Generator
 * দারুল উলূম আল-ইসলামিয়া মডেল মাদরাসা — একটি সম্পূর্ণ ও বাস্তবসম্মত ডেমো ডেটাসেট
 */

import type { AcademicSession } from "./sessions";
import { getDefaultInventorySeed } from "./inventory";

export const DEMO_MADRASA_NAME = "মাদ্রাসাতুল মুসলিমিন";
export const DEMO_MADRASA_PREFIX = "MM";
export const DEMO_ADMIN_EMAIL = "demo@qawmierp.com";
export const DEMO_ADMIN_PASSWORD = "demo@qawmierp.com";
export const DEMO_ADMIN_NAME = "মাওলানা আহমাদ ওসামা (মুহতামিম)";

export function getFullDemoDataset(madrasaId: string, adminUserId: string) {
  const now = new Date().toISOString();
  const todayStr = new Date().toISOString().split("T")[0];

  // 1. Classes
  const classes = [
    { id: "cls_noorani", madrasa_id: madrasaId, name: "নূরানী ও নাজেরা", code: "NOOR", order_index: 1 },
    { id: "cls_hifz", madrasa_id: madrasaId, name: "হিফজুল কুরআন বিভাগ", code: "HIFZ", order_index: 2 },
    { id: "cls_ibtedayi", madrasa_id: madrasaId, name: "ইবতেদায়ি ১ম বর্ষ", code: "IBT-1", order_index: 3 },
    { id: "cls_mizan", madrasa_id: madrasaId, name: "মিজান জামাত", code: "MIZAN", order_index: 4 },
    { id: "cls_nahbemir", madrasa_id: madrasaId, name: "নাহবেমীর জামাত", code: "NAHB", order_index: 5 },
    { id: "cls_hedayah", madrasa_id: madrasaId, name: "হেদায়াতুন্নাহব জামাত", code: "HEDAYAH", order_index: 6 },
    { id: "cls_jalalain", madrasa_id: madrasaId, name: "জালালাইন জামাত", code: "JALAL", order_index: 7 },
    { id: "cls_dawrah", madrasa_id: madrasaId, name: "দাওরায়ে হাদিস (তাকমীল)", code: "DAWRAH", order_index: 8 },
  ];

  // 2. Subjects
  const subjects = [
    { id: "sub_quran", madrasa_id: madrasaId, name: "কুরআন মাজিদ ও তাজবীদ", code: "QUR", full_marks: 100 },
    { id: "sub_urdu", madrasa_id: madrasaId, name: "উর্দু ও ফার্সি", code: "URDU", full_marks: 100 },
    { id: "sub_mizan", madrasa_id: madrasaId, name: "মিযানুস সরফ ও মুনশাইব", code: "MIZ", full_marks: 100 },
    { id: "sub_nahb", madrasa_id: madrasaId, name: "নাহবেমীর ও কাফিয়া", code: "NAH", full_marks: 100 },
    { id: "sub_fiqh", madrasa_id: madrasaId, name: "ফিকহ (আল-হিদায়াহ ও কুদূরী)", code: "FQH", full_marks: 100 },
    { id: "sub_tafsir", madrasa_id: madrasaId, name: "তাফসীরে জালালাইন শরীফ", code: "TAF", full_marks: 100 },
    { id: "sub_bukhari", madrasa_id: madrasaId, name: "সহীহ বুখারী শরীফ", code: "BUK", full_marks: 100 },
    { id: "sub_bangla", madrasa_id: madrasaId, name: "বাংলা ব্যাকরণ ও সাহিত্য", code: "BEN", full_marks: 100 },
    { id: "sub_math", madrasa_id: madrasaId, name: "সাধারণ গণিত", code: "MTH", full_marks: 100 },
    { id: "sub_eng", madrasa_id: madrasaId, name: "বেসিক ইংলিশ", code: "ENG", full_marks: 100 },
  ];

  // 3. Teachers & Staff
  const teachers = [
    {
      id: "tch_muhtamim",
      madrasa_id: madrasaId,
      first_name: "মাওলানা আহমাদ",
      last_name: "ওসামা",
      phone: "01711-987654",
      email: "demo@qawmierp.com",
      designation: "মুহতামিম ও শায়খুল হাদিস",
    },
    {
      id: "tch_naib",
      madrasa_id: madrasaId,
      first_name: "মাওলানা মুশতাক",
      last_name: "আহমদ",
      phone: "01712-112233",
      email: "mushtaq@qawmi.app",
      designation: "নায়েবে মুহতামিম ও শিক্ষাসচিব",
    },
    {
      id: "tch_hifz1",
      madrasa_id: madrasaId,
      first_name: "হাফেজ ক্বারী সাঈদ",
      last_name: "হাসান",
      phone: "01819-223344",
      email: "sayeed.hifz@qawmi.app",
      designation: "প্রধান হিফজ শিক্ষক",
    },
    {
      id: "tch_hifz2",
      madrasa_id: madrasaId,
      first_name: "হাফেজ ইমরান",
      last_name: "বিন কাসেম",
      phone: "01911-334455",
      email: "imran.hifz@qawmi.app",
      designation: "সহকারী হিফজ শিক্ষক",
    },
    {
      id: "tch_kitab",
      madrasa_id: madrasaId,
      first_name: "মাওলানা হাবিবুর",
      last_name: "রহমান",
      phone: "01611-445566",
      email: "habib.kitab@qawmi.app",
      designation: "সিনিয়র কিতাব শিক্ষক",
    },
    {
      id: "tch_accountant",
      madrasa_id: madrasaId,
      first_name: "মুহাম্মদ শরিফুল",
      last_name: "ইসলাম",
      phone: "01511-556677",
      email: "accounts@qawmi.app",
      designation: "প্রধান হিসাবরক্ষক",
    },
  ];

  // 4. Students
  const students = [
    {
      id: "std_01",
      madrasa_id: madrasaId,
      student_id: `${DEMO_MADRASA_PREFIX}-480001`,
      first_name: "আহমেদ",
      last_name: "আবদুল্লাহ",
      roll_number: "১",
      class_name: "হিফজুল কুরআন বিভাগ",
      father_name: "আলহাজ্ব মোজাম্মেল হক",
      parent_phone: "01711-220011",
      address: "ইসলামপুর, ঢাকা",
    },
    {
      id: "std_02",
      madrasa_id: madrasaId,
      student_id: `${DEMO_MADRASA_PREFIX}-480002`,
      first_name: "মাহমুদ",
      last_name: "হাসান",
      roll_number: "২",
      class_name: "হিফজুল কুরআন বিভাগ",
      father_name: "মাওলানা রফিকুল ইসলাম",
      parent_phone: "01811-220022",
      address: "কেরানীগঞ্জ, ঢাকা",
    },
    {
      id: "std_03",
      madrasa_id: madrasaId,
      student_id: `${DEMO_MADRASA_PREFIX}-480003`,
      first_name: "আব্দুর",
      last_name: "রহমান",
      roll_number: "৩",
      class_name: "হিফজুল কুরআন বিভাগ",
      father_name: "মোঃ শহিদুল্লাহ",
      parent_phone: "01911-220033",
      address: "সোনারগাঁও, নারায়ণগঞ্জ",
    },
    {
      id: "std_04",
      madrasa_id: madrasaId,
      student_id: `${DEMO_MADRASA_PREFIX}-480004`,
      first_name: "মুয়াজ",
      last_name: "বিন জাহিদ",
      roll_number: "৪",
      class_name: "হিফজুল কুরআন বিভাগ",
      father_name: "জাহিদুল ইসলাম",
      parent_phone: "01611-220044",
      address: "মিরপুর-১, ঢাকা",
    },
    {
      id: "std_05",
      madrasa_id: madrasaId,
      student_id: `${DEMO_MADRASA_PREFIX}-480005`,
      first_name: "সাজিদুর",
      last_name: "রহমান",
      roll_number: "১",
      class_name: "নাহবেমীর জামাত",
      father_name: "হাফেজ নুর মোহাম্মদ",
      parent_phone: "01511-220055",
      address: "যাত্রাবাড়ী, ঢাকা",
    },
    {
      id: "std_06",
      madrasa_id: madrasaId,
      student_id: `${DEMO_MADRASA_PREFIX}-480006`,
      first_name: "তৌহিদুল",
      last_name: "ইসলাম",
      roll_number: "২",
      class_name: "হেদায়াতুন্নাহব জামাত",
      father_name: "মোঃ আনোয়ার হোসেন",
      parent_phone: "01722-330066",
      address: "গাজীপুর সদর",
    },
    {
      id: "std_07",
      madrasa_id: madrasaId,
      student_id: `${DEMO_MADRASA_PREFIX}-480007`,
      first_name: "আনাস ইবনে",
      last_name: "মালিক",
      roll_number: "১",
      class_name: "জালালাইন জামাত",
      father_name: "মাওলানা ফজলুল করীম",
      parent_phone: "01822-330077",
      address: "টঙ্গী, গাজীপুর",
    },
    {
      id: "std_08",
      madrasa_id: madrasaId,
      student_id: `${DEMO_MADRASA_PREFIX}-480008`,
      first_name: "জুবায়ের",
      last_name: "আহমেদ",
      roll_number: "১",
      class_name: "দাওরায়ে হাদিস (তাকমীল)",
      father_name: "মাওলানা মনসুরুল হক",
      parent_phone: "01922-330088",
      address: "লালবাগ, ঢাকা",
    },
    {
      id: "std_09",
      madrasa_id: madrasaId,
      student_id: `${DEMO_MADRASA_PREFIX}-480009`,
      first_name: "তালহা",
      last_name: "জুবায়ের",
      roll_number: "৫",
      class_name: "মিজান জামাত",
      father_name: "মোঃ হারুনুর রশিদ",
      parent_phone: "01622-330099",
      address: "উত্তরা, ঢাকা",
    },
    {
      id: "std_10",
      madrasa_id: madrasaId,
      student_id: `${DEMO_MADRASA_PREFIX}-480010`,
      first_name: "খালিদ",
      last_name: "সাইফুল্লাহ",
      roll_number: "৩",
      class_name: "ইবতেদায়ি ১ম বর্ষ",
      father_name: "মোঃ এনামুল হক",
      parent_phone: "01733-440010",
      address: "ধানমন্ডি, ঢাকা",
    },
  ];

  // 5. Extended Student Profiles (Residential, Fees, Discounts)
  const student_profiles: Record<string, any> = {
    std_01: {
      student_id: `${DEMO_MADRASA_PREFIX}-480001`,
      residential_status: "আবাসিক",
      boarding_type: "সাধারণ পেইং",
      is_boarding: true,
      hifz_stage: "HIFZ",
      blood_group: "B+",
      monthly_fee: 1500,
      khoraki_fee: 2500,
      total_monthly_fee: 4000,
      completed_hifz_paras: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
    },
    std_02: {
      student_id: `${DEMO_MADRASA_PREFIX}-480002`,
      residential_status: "আবাসিক",
      boarding_type: "হাফ-ফ্রি",
      is_boarding: true,
      hifz_stage: "HIFZ",
      blood_group: "O+",
      monthly_fee: 1500,
      khoraki_fee: 1250,
      total_monthly_fee: 2750,
      completed_hifz_paras: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    },
    std_03: {
      student_id: `${DEMO_MADRASA_PREFIX}-480003`,
      residential_status: "আবাসিক",
      boarding_type: "লিল্লাহ",
      is_boarding: true,
      hifz_stage: "HIFZ",
      blood_group: "A+",
      monthly_fee: 0,
      khoraki_fee: 0,
      fee_discount: 4000,
      fee_discount_reason: "এতিম ও অসচ্ছল মেধাবী শিক্ষার্থী (যাকাত লিল্লাহ ফান্ড)",
      total_monthly_fee: 0,
      completed_hifz_paras: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24],
    },
    std_04: {
      student_id: `${DEMO_MADRASA_PREFIX}-480004`,
      residential_status: "অনাবাসিক",
      boarding_type: "অনাবাসিক",
      is_boarding: false,
      hifz_stage: "HIFZ",
      blood_group: "AB+",
      monthly_fee: 1500,
      khoraki_fee: 0,
      total_monthly_fee: 1500,
      completed_hifz_paras: [1, 2, 3, 4, 5, 6, 7],
    },
    std_05: {
      student_id: `${DEMO_MADRASA_PREFIX}-480005`,
      residential_status: "আবাসিক",
      boarding_type: "সাধারণ পেইং",
      is_boarding: true,
      monthly_fee: 1800,
      khoraki_fee: 2500,
      total_monthly_fee: 4300,
    },
    std_06: {
      student_id: `${DEMO_MADRASA_PREFIX}-480006`,
      residential_status: "আবাসিক",
      boarding_type: "সাধারণ পেইং",
      is_boarding: true,
      monthly_fee: 2000,
      khoraki_fee: 2500,
      total_monthly_fee: 4500,
    },
    std_07: {
      student_id: `${DEMO_MADRASA_PREFIX}-480007`,
      residential_status: "আবাসিক",
      boarding_type: "হাফ-ফ্রি",
      is_boarding: true,
      monthly_fee: 2200,
      khoraki_fee: 1500,
      total_monthly_fee: 3700,
    },
    std_08: {
      student_id: `${DEMO_MADRASA_PREFIX}-480008`,
      residential_status: "আবাসিক",
      boarding_type: "সাধারণ পেইং",
      is_boarding: true,
      monthly_fee: 2500,
      khoraki_fee: 2500,
      total_monthly_fee: 5000,
    },
    std_09: {
      student_id: `${DEMO_MADRASA_PREFIX}-480009`,
      residential_status: "অনাবাসিক",
      boarding_type: "অনাবাসিক",
      is_boarding: false,
      monthly_fee: 1600,
      khoraki_fee: 0,
      total_monthly_fee: 1600,
    },
    std_10: {
      student_id: `${DEMO_MADRASA_PREFIX}-480010`,
      residential_status: "অনাবাসিক",
      boarding_type: "অনাবাসিক",
      is_boarding: false,
      monthly_fee: 1200,
      khoraki_fee: 0,
      total_monthly_fee: 1200,
    },
  };

  // 6. Hifz Daily Logs
  const hifz_logs = [
    {
      id: "hifz_log_01",
      madrasa_id: madrasaId,
      student_id: "std_01",
      teacher_id: "tch_hifz1",
      log_date: todayStr,
      sabak_para: 19,
      sabak_page: 4,
      saboki_para: 18,
      amukhta_para: 10,
      performance_rating: "Excellent",
      notes: "মাশাআল্লাহ, অত্যন্ত সুন্দর মাখরাজ ও সাবলীল তেলাওয়াত।",
    },
    {
      id: "hifz_log_02",
      madrasa_id: madrasaId,
      student_id: "std_02",
      teacher_id: "tch_hifz1",
      log_date: todayStr,
      sabak_para: 13,
      sabak_page: 8,
      saboki_para: 12,
      amukhta_para: 5,
      performance_rating: "Good",
      notes: "তাজবীদের গুন্নাহগুলো আরও শক্ত করতে হবে।",
    },
    {
      id: "hifz_log_03",
      madrasa_id: madrasaId,
      student_id: "std_03",
      teacher_id: "tch_hifz2",
      log_date: todayStr,
      sabak_para: 25,
      sabak_page: 2,
      saboki_para: 24,
      amukhta_para: 15,
      performance_rating: "Excellent",
      notes: "দ্রুততম সময়ে কুরআন হেফজ সমাপ্তির দিকে অগ্রসর হচ্ছে।",
    },
    {
      id: "hifz_log_04",
      madrasa_id: madrasaId,
      student_id: "std_04",
      teacher_id: "tch_hifz2",
      log_date: todayStr,
      sabak_para: 8,
      sabak_page: 1,
      saboki_para: 7,
      amukhta_para: 3,
      performance_rating: "Good",
      notes: "সবকি নিয়মিত মুখস্থ শোনাচ্ছে।",
    },
  ];

  // 7. Attendance (বাস্তবসম্মত উপস্থিতি, অনুপস্থিতি ও ছুটি রেজিস্ট্রি)
  const attendance = [
    { id: "att_01", madrasa_id: madrasaId, student_id: "std_01", date: todayStr, status: "Present", notes: "হাজির" },
    { id: "att_02", madrasa_id: madrasaId, student_id: "std_02", date: todayStr, status: "Present", notes: "হাজির" },
    { id: "att_03", madrasa_id: madrasaId, student_id: "std_03", date: todayStr, status: "Absent", notes: "অনুপস্থিত (জ্বর ও অসুস্থতা)" },
    { id: "att_04", madrasa_id: madrasaId, student_id: "std_04", date: todayStr, status: "Present", notes: "হাজির" },
    { id: "att_05", madrasa_id: madrasaId, student_id: "std_05", date: todayStr, status: "Present", notes: "হাজির" },
    { id: "att_06", madrasa_id: madrasaId, student_id: "std_06", date: todayStr, status: "Present", notes: "হাজির" },
    { id: "att_07", madrasa_id: madrasaId, student_id: "std_07", date: todayStr, status: "Absent", notes: "অনুপস্থিত (দেরিতে আগমন/অনুপস্থিত)" },
    { id: "att_08", madrasa_id: madrasaId, student_id: "std_08", date: todayStr, status: "Present", notes: "হাজির" },
    { id: "att_09", madrasa_id: madrasaId, student_id: "std_09", date: todayStr, status: "Leave", notes: "অনুমোদিত পারিবারিক ছুটি" },
    { id: "att_10", madrasa_id: madrasaId, student_id: "std_10", date: todayStr, status: "Present", notes: "হাজির" },
  ];

  // 8. Academic Session
  const sessions: AcademicSession[] = [
    {
      id: "sess_1447",
      madrasa_id: madrasaId,
      name: "১৪৪৭-৪৮ হিজরি শিক্ষাবর্ষ",
      academic_year: "২০২৬-২৭",
      hijri_year: "১৪৪৭-৪৮",
      start_date: "2026-01-01",
      end_date: "2026-12-31",
      status: "ACTIVE",
      is_current: true,
      description: "চলতি কেন্দ্রীয় শিক্ষাবর্ষ",
      created_at: now,
      updated_at: now,
    },
  ];

  // 9. Funds
  const funds = [
    { id: "fund_general", name: "সাধারণ সাধারণ তহবিল (General Fund)", code: "GEN", balance: 145000 },
    { id: "fund_lillah", name: "লিল্লাহ বোর্ডিং ও যাকাত তহবিল (Zakat / Lillah)", code: "ZAKAT", balance: 380000 },
    { id: "fund_construction", name: "মাদরাসা ভবন নির্মাণ ও উন্নয়ন তহবিল", code: "BLD", balance: 250000 },
    { id: "fund_mahfil", name: "বার্ষিক ওয়াজ মাহফিল ও সম্মেলন তহবিল", code: "MHF", balance: 85000 },
  ];

  // 10. Expenses (ব্যয় খাত)
  const expenses = [
    {
      id: "exp_01",
      madrasa_id: madrasaId,
      voucher_no: "V-2026-0001",
      category: "Salary",
      title: "শিক্ষক ও খাদেমবৃন্দের শাওয়াল মাসের বেতনভাতা",
      amount: 145000,
      fund_id: "fund_general",
      fund_name: "সাধারণ তহবিল",
      expense_date: todayStr,
      description: "৬ জন শিক্ষক ও ২ জন স্টাফের মাসিক বেতন ব্যাংক ট্রান্সফার ও ক্যাশ প্রদান",
    },
    {
      id: "exp_02",
      madrasa_id: madrasaId,
      voucher_no: "V-2026-0002",
      category: "Food",
      title: "ছাত্রাবাস মেস বাজার ও চাল-ডাল ক্রয়",
      amount: 48500,
      fund_id: "fund_lillah",
      fund_name: "লিল্লাহ বোর্ডিং ও যাকাত তহবিল",
      expense_date: todayStr,
      description: "৫০ বস্তা মিনিকেট চাল, ডাল, সয়াবিন তেল ও মসলা বাজার",
    },
    {
      id: "exp_03",
      madrasa_id: madrasaId,
      voucher_no: "V-2026-0003",
      category: "Utility",
      title: "ডেসকো বিদ্যুৎ বিল ও পানির পাম্প বিল",
      amount: 12800,
      fund_id: "fund_general",
      fund_name: "সাধারণ তহবিল",
      expense_date: todayStr,
      description: "মাদরাসা মূল ভবন ও ছাত্রাবাসের মাসিক বিদ্যুৎ বিল পরিশোধ",
    },
    {
      id: "exp_04",
      madrasa_id: madrasaId,
      voucher_no: "V-2026-0004",
      category: "Maintenance",
      title: "হিফজখানার সিলিং ফ্যান ও লাইট ওয়্যারিং মেরামত",
      amount: 6500,
      fund_id: "fund_construction",
      fund_name: "মাদরাসা ভবন উন্নয়ন তহবিল",
      expense_date: todayStr,
      description: "নতুন ৪টি ফ্যান ও এলইডি টিউবলাইট স্থাপন",
    },
    {
      id: "exp_05",
      madrasa_id: madrasaId,
      voucher_no: "V-2026-0005",
      category: "Academic",
      title: "১ম সাময়িক পরীক্ষার খাতা ও প্রশ্নপত্র প্রিন্টিং",
      amount: 18200,
      fund_id: "fund_general",
      fund_name: "সাধারণ তহবিল",
      expense_date: todayStr,
      description: "সকল জামাতের পরীক্ষার উত্তরপত্র ও প্রশ্ন ফটোকপি বিল",
    },
  ];

  // 11. Donations & Zakat (আয় খাত)
  const donations = [
    {
      id: "don_01",
      receipt_no: "DON-2026-0001",
      donor_name: "আলহাজ্ব হারুনুর রশিদ",
      donor_phone: "01711-554433",
      amount: 100000,
      fund_id: "fund_lillah",
      fund_name: "লিল্লাহ বোর্ডিং ও যাকাত তহবিল",
      donation_date: todayStr,
      type: "ZAKAT",
      payment_method: "Bank",
      notes: "ব্যবসায়ী সমিতির বার্ষিক যাকাত ফান্ড থেকে এতিম ছাত্রদের জন্য",
    },
    {
      id: "don_02",
      receipt_no: "DON-2026-0002",
      donor_name: "মোঃ আকতারুজ্জামান (প্রবাসী, দুবাই)",
      donor_phone: "01811-998877",
      amount: 50000,
      fund_id: "fund_construction",
      fund_name: "মাদরাসা ভবন উন্নয়ন তহবিল",
      donation_date: todayStr,
      type: "GENERAL",
      payment_method: "bKash",
      notes: "৩য় তলা সম্প্রসারণের জন্য অনুদান",
    },
    {
      id: "don_03",
      receipt_no: "DON-2026-0003",
      donor_name: "হাফেজ মাওলানা আবুল বাশার",
      donor_phone: "01911-776655",
      amount: 25000,
      fund_id: "fund_general",
      fund_name: "সাধারণ তহবিল",
      donation_date: todayStr,
      type: "SADAQAH",
      payment_method: "Cash",
      notes: "পিতার ইছালে সাওয়াবের নিয়তে মাদরাসায় সাধারণ সদকা",
    },
    {
      id: "don_04",
      receipt_no: "DON-2026-0004",
      donor_name: "মসজিদ ও মাদরাসা কেন্দ্রীয় দানবাক্স",
      donor_phone: "01700-000000",
      amount: 34500,
      fund_id: "fund_general",
      fund_name: "সাধারণ তহবিল",
      donation_date: todayStr,
      type: "BOX",
      payment_method: "Cash",
      notes: "জুমার নামাজের পর প্রধান ফটকের দানবাক্স উন্মুক্তকরণ",
    },
  ];

  // 12. Fee Payments (ছাত্রদের ফি আদায়)
  const fee_types = [
    { id: "ft_monthly", name: "মাসিক পড়াশোনা ফি (Tuition)", default_amount: 1500, fund_id: "fund_general", fund_name: "সাধারণ তহবিল" },
    { id: "ft_khoraki", name: "ছাত্রাবাস খোরাকি ও মেস ফি", default_amount: 2500, fund_id: "fund_lillah", fund_name: "লিল্লাহ বোর্ডিং ও যাকাত তহবিল" },
    { id: "ft_exam", name: "১ম সাময়িক পরীক্ষা ফি", default_amount: 500, fund_id: "fund_general", fund_name: "সাধারণ তহবিল" },
  ];

  const student_fees = [
    {
      id: "fee_inv_01",
      student_id: "std_01",
      student_name: "আহমেদ আবদুল্লাহ",
      student_roll: "১",
      class_name: "হিফজুল কুরআন বিভাগ",
      fee_type_id: "ft_monthly",
      fee_type_name: "মাসিক বেতন",
      billing_period: "শাওয়াল ১৪৪৭",
      payable_amount: 1500,
      paid_amount: 1500,
      due_amount: 0,
      status: "PAID",
      due_date: todayStr,
    },
    {
      id: "fee_inv_02",
      student_id: "std_01",
      student_name: "আহমেদ আবদুল্লাহ",
      student_roll: "১",
      class_name: "হিফজুল কুরআন বিভাগ",
      fee_type_id: "ft_khoraki",
      fee_type_name: "খোরাকি ফি",
      billing_period: "শাওয়াল ১৪৪৭",
      payable_amount: 2500,
      paid_amount: 2500,
      due_amount: 0,
      status: "PAID",
      due_date: todayStr,
    },
    {
      id: "fee_inv_03",
      student_id: "std_05",
      student_name: "সাজিদুর রহমান",
      student_roll: "১",
      class_name: "নাহবেমীর জামাত",
      fee_type_id: "ft_monthly",
      fee_type_name: "মাসিক বেতন",
      billing_period: "শাওয়াল ১৪৪৭",
      payable_amount: 1800,
      paid_amount: 1800,
      due_amount: 0,
      status: "PAID",
      due_date: todayStr,
    },
    {
      id: "fee_inv_04",
      student_id: "std_06",
      student_name: "তৌহিদুল ইসলাম",
      student_roll: "২",
      class_name: "হেদায়াতুন্নাহব জামাত",
      fee_type_id: "ft_monthly",
      fee_type_name: "মাসিক বেতন",
      billing_period: "শাওয়াল ১৪৪৭",
      payable_amount: 2000,
      paid_amount: 1000,
      due_amount: 1000,
      status: "PARTIAL",
      due_date: todayStr,
    },
  ];

  const fee_payments = [
    {
      id: "pay_01",
      receipt_no: "MR-2026-0001",
      student_id: "std_01",
      student_name: "আহমেদ আবদুল্লাহ",
      class_name: "হিফজুল কুরআন বিভাগ",
      total_amount: 4000,
      payment_date: todayStr,
      payment_method: "Cash",
      collected_by: "মুহাম্মদ শরিফুল ইসলাম",
      allocations: [
        { fee_id: "fee_inv_01", fee_type_name: "মাসিক বেতন", allocated_amount: 1500, fund_name: "সাধারণ তহবিল" },
        { fee_id: "fee_inv_02", fee_type_name: "খোরাকি ফি", allocated_amount: 2500, fund_name: "লিল্লাহ বোর্ডিং ও যাকাত তহবিল" },
      ],
    },
    {
      id: "pay_02",
      receipt_no: "MR-2026-0002",
      student_id: "std_05",
      student_name: "সাজিদুর রহমান",
      class_name: "নাহবেমীর জামাত",
      total_amount: 1800,
      payment_date: todayStr,
      payment_method: "bKash",
      collected_by: "মুহাম্মদ শরিফুল ইসলাম",
      allocations: [
        { fee_id: "fee_inv_03", fee_type_name: "মাসিক বেতন", allocated_amount: 1800, fund_name: "সাধারণ তহবিল" },
      ],
    },
  ];

  // 13. Exams & Marks
  const exams = [
    {
      id: "ex_sem1",
      madrasa_id: madrasaId,
      title: "১ম সাময়িক পরীক্ষা ১৪৪৭ হিজরি",
      year: "১৪৪৭",
      status: "Completed",
    },
  ];

  const exam_results = [
    {
      id: "res_01",
      madrasa_id: madrasaId,
      exam_id: "ex_sem1",
      student_id: "std_05",
      subject_name: "নাহবেমীর ও কাফিয়া",
      marks_obtained: 95,
      grade: "মুমতাজ (A+)",
      is_absent: false,
    },
    {
      id: "res_02",
      madrasa_id: madrasaId,
      exam_id: "ex_sem1",
      student_id: "std_05",
      subject_name: "মিযানুস সরফ ও মুনশাইব",
      marks_obtained: 92,
      grade: "মুমতাজ (A+)",
      is_absent: false,
    },
    {
      id: "res_03",
      madrasa_id: madrasaId,
      exam_id: "ex_sem1",
      student_id: "std_06",
      subject_name: "ফিকহ (আল-হিদায়াহ ও কুদূরী)",
      marks_obtained: 88,
      grade: "জিয়্যিদ জিদ্দান (A)",
      is_absent: false,
    },
    {
      id: "res_04",
      madrasa_id: madrasaId,
      exam_id: "ex_sem1",
      student_id: "std_07",
      subject_name: "তাফসীরে জালালাইন শরীফ",
      marks_obtained: 94,
      grade: "মুমতাজ (A+)",
      is_absent: false,
    },
    {
      id: "res_05",
      madrasa_id: madrasaId,
      exam_id: "ex_sem1",
      student_id: "std_08",
      subject_name: "সহীহ বুখারী শরীফ",
      marks_obtained: 98,
      grade: "মুমতাজ (A+)",
      is_absent: false,
    },
  ];

  // 14. Boarding & Bazar
  const bazar_expenses = [
    {
      id: "bz_01",
      bazar_date: todayStr,
      item_name: "মিনিকেট চাল ৫০ কেজি ২ বস্তা ও মসুর ডাল ১০ কেজি",
      buyer_name: "হাফেজ ইমরান বিন কাসেম",
      cost_amount: 8600,
      meal_session: "রাত ও সকাল",
    },
    {
      id: "bz_02",
      bazar_date: todayStr,
      item_name: "রুই মাছ ১২ কেজি, আলু, কাঁচামরিচ ও শাকসবজি",
      buyer_name: "হাফেজ ইমরান বিন কাসেম",
      cost_amount: 5400,
      meal_session: "দুপুর",
    },
  ];

  // 15. Fundraising Special (Mahfil & Donation Box)
  const mahfils = [
    {
      id: "mhf_2026",
      title: "৩১তম ঐতিহাসিক বার্ষিক ইসলামী মহাসম্মেলন ও ওয়াজ মাহফিল",
      hijri_year: "১৪৪৭",
      gregorian_date: "২০২৬-১২-২৫",
      total_target: 500000,
      collected_amount: 315000,
      status: "COMPLETED",
    },
  ];

  const donation_boxes = [
    { id: "box_01", location_name: "মাদরাসা প্রধান ফটক (Main Gate)", custodian_name: "মুহাম্মদ শরিফুল ইসলাম", total_collection: 42500 },
    { id: "box_02", location_name: "কেন্দ্রীয় জামে মসজিদ বারান্দা", custodian_name: "মাওলানা মুশতাক আহমদ", total_collection: 28000 },
  ];

  // 16. Full Inventory Data (আসবাবপত্র, সাউন্ড সিস্টেম, কিচেন, ইলেকট্রনিক্স ও মেইনটেন্যান্স)
  const inventoryData = getDefaultInventorySeed(madrasaId);

  // 17. Library Books (কিতাব স্টক)
  const library_books = [
    { id: "bk_01", title: "সহীহুল বুখারী (পূর্ণাঙ্গ মাকতাবাতুল বুশরা)", author: "ইমাম বুখারী (রহ.)", isbn: "978-01", stock: 10, available: 8 },
    { id: "bk_02", title: "তাফসীরে ইবনে কাসীর (ইসলামিক ফাউন্ডেশন)", author: "আল্লামা ইবনে কাসীর (রহ.)", isbn: "978-02", stock: 6, available: 5 },
    { id: "bk_03", title: "আল-হিদায়াহ শরহুল বিদায়াহ", author: "ইমাম মারগিনানী (রহ.)", isbn: "978-03", stock: 15, available: 12 },
    { id: "bk_04", title: "মিরকাতুল মাফাতীহ শরহে মিশকাতুল মাসাবীহ", author: "মোল্লা আলী কারী (রহ.)", isbn: "978-04", stock: 8, available: 7 },
  ];

  // 18. Teacher Attendance (শিক্ষক উপস্থিতি রেজিস্ট্রি)
  const teacher_attendance = [
    { id: "tatt_01", teacher_id: "tch_muhtamim", teacher_name: "মাওলানা আহমাদ ওসামা", date: todayStr, status: "Present", check_in: "08:15 AM", notes: "হাজির" },
    { id: "tatt_02", teacher_id: "tch_naib", teacher_name: "মাওলানা মুশতাক আহমদ", date: todayStr, status: "Present", check_in: "08:30 AM", notes: "হাজির" },
    { id: "tatt_03", teacher_id: "tch_hifz1", teacher_name: "হাফেজ ক্বারী সাঈদ হাসান", date: todayStr, status: "Present", check_in: "07:30 AM", notes: "হাজির" },
    { id: "tatt_04", teacher_id: "tch_hifz2", teacher_name: "হাফেজ মুহাম্মদ ইকবাল", date: todayStr, status: "Leave", check_in: "-", notes: "অনুমোদিত ছুটি" },
    { id: "tatt_05", teacher_id: "tch_accountant", teacher_name: "মুহাম্মদ শরিফুল ইসলাম", date: todayStr, status: "Present", check_in: "08:50 AM", notes: "হাজির" },
  ];

  // 19. Institutional Notices (নোটিশ বোর্ড)
  const notices = [
    {
      id: "not_01",
      title: "১৪৪৭ হিজরি শিক্ষাবর্ষের ১ম সাময়িক পরীক্ষার ফলাফল প্রকাশ প্রসঙ্গে",
      content: "মাদ্রাসাতুল মুসলিমিন-এর সকল অভিভাবক ও শিক্ষার্থীদের আনন্দের সাথে জানানো যাচ্ছে যে, ১ম সাময়িক পরীক্ষার ফলাফল প্রকাশিত হয়েছে। রেজাল্ট কার্ড অনলাইন পোর্টাল ও মাদরাসা অফিস থেকে সংগ্রহ করা যাবে।",
      category: "ACADEMIC",
      published_by: "মাওলানা আহমাদ ওসামা (মুহতামিম)",
      created_at: now,
      is_pinned: true,
    },
    {
      id: "not_02",
      title: "মাসিক লিল্লাহ বোর্ডিং ও বেতন পরিশোধ সংক্রান্ত নোটিশ",
      content: "সকল অভিভাবককে চলতি মাসের ১০ তারিখের মধ্যে মাদরাসার হিসাব বিভাগে অথবা অনলাইন পোর্টালের মাধ্যমে বেতন ও বোর্ডিং ফি পরিশোধের জন্য বিনীত অনুরোধ করা হচ্ছে।",
      category: "ACCOUNTS",
      published_by: "হিসাব বিভাগ",
      created_at: now,
      is_pinned: false,
    },
  ];

  // 20. Routines (ক্লাস ও দরস রুটিন)
  const routines = [
    {
      id: "rt_01",
      class_id: "cls_hifz",
      class_name: "হিফজুল কুরআন বিভাগ",
      day: "শনিবার",
      period: 1,
      time: "০৭:০০ - ০৮:৩০",
      subject: "কুরআন মাজিদ সবক ও তাসমী",
      teacher_name: "হাফেজ ক্বারী সাঈদ হাসান",
    },
    {
      id: "rt_02",
      class_id: "cls_hedayah",
      class_name: "হেদায়াতুন্নাহব জামাত",
      day: "শনিবার",
      period: 2,
      time: "০৯:০০ - ১০:০০",
      subject: "ফিকহ (আল-হিদায়াহ)",
      teacher_name: "মাওলানা আহমাদ ওসামা (মুহতামিম)",
    },
    {
      id: "rt_03",
      class_id: "cls_dawrah",
      class_name: "দাওরায়ে হাদিস (তাকমীল)",
      day: "শনিবার",
      period: 3,
      time: "১০:১৫ - ১১:১৫",
      subject: "সহীহ বুখারী শরীফ",
      teacher_name: "মাওলানা আহমাদ ওসামা (মুহতামিম)",
    },
  ];

  // Root metadata object to be merged into madrasas.metadata / registration_no
  const metadata = {
    prefix: DEMO_MADRASA_PREFIX,
    short_code: DEMO_MADRASA_PREFIX,
    sessions,
    student_profiles,
    funds,
    fee_types,
    student_fees,
    fee_payments,
    bazar_expenses,
    donations,
    mahfils,
    donation_boxes,
    inventory: inventoryData,
    inventory_items: inventoryData.items,
    library_books,
    teacher_attendance,
    notices,
    routines,
    published_exams: {
      ex_sem1: {
        is_published: true,
        published_at: now,
        published_by: "মাওলানা আহমাদ ওসামা (মুহতামিম)",
        note: "সকল অভিভাবক ও ছাত্রদের দৃষ্টি আকর্ষণ: ১ম সাময়িক পরীক্ষার ফলাফল প্রকাশিত হয়েছে।",
      },
    },
    receipt_counter: {
      DON: 5,
      MR: 3,
      V: 6,
    },
  };

  return {
    classes,
    subjects,
    teachers,
    students,
    hifz_logs,
    attendance,
    expenses,
    exams,
    exam_results,
    metadata,
  };
}
