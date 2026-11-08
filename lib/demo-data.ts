/**
 * QawmiERP Demo Profile Data Generator
 * মাদ্রাসাতুল মুসলিমিন — একটি সম্পূর্ণ ও বাস্তবসম্মত ডেমো ডেটাসেট
 */

import { toDhakaDateString } from "./date-utils";
import type { AcademicSession } from "./sessions";
import { getDefaultInventorySeed } from "./inventory";

export const DEMO_MADRASA_NAME = "মাদ্রাসাতুল মুসলিমিন";
export const DEMO_MADRASA_PREFIX = "MM";
export const DEMO_ADMIN_EMAIL = "demo@qawmierp.com";
export const DEMO_ADMIN_PASSWORD = "demo@qawmierp.com";
export const DEMO_ADMIN_NAME = "মাওলানা আহমাদ ওসামা (মুহতামিম)";

/**
 * Valid RFC4122 v4 deterministic UUID generator for stable demo records
 */
export function makeDemoUuid(prefix: number, index: number): string {
  const pStr = String(prefix).padStart(8, "0");
  const iStr = String(index).padStart(12, "0");
  return `${pStr}-0000-4000-8000-${iStr}`;
}

export function getFullDemoDataset(madrasaId: string, adminUserId: string) {
  const now = new Date().toISOString();
  const todayStr = toDhakaDateString(new Date());

  // Past dates in YYYY-MM-DD for attendance history
  const d1 = new Date();
  d1.setDate(d1.getDate() - 1);
  const dayMinus1 = toDhakaDateString(d1);

  const d2 = new Date();
  d2.setDate(d2.getDate() - 2);
  const dayMinus2 = toDhakaDateString(d2);

  const d3 = new Date();
  d3.setDate(d3.getDate() - 3);
  const dayMinus3 = toDhakaDateString(d3);

  // 1. Classes (UUIDs & standard SQL columns: id, madrasa_id, name, description)
  const classNooraniId = makeDemoUuid(1, 1);
  const classHifzId = makeDemoUuid(1, 2);
  const classIbtedayiId = makeDemoUuid(1, 3);
  const classMizanId = makeDemoUuid(1, 4);
  const classNahbemirId = makeDemoUuid(1, 5);
  const classHedayahId = makeDemoUuid(1, 6);
  const classJalalainId = makeDemoUuid(1, 7);
  const classDawrahId = makeDemoUuid(1, 8);

  const classes = [
    { id: classNooraniId, madrasa_id: madrasaId, name: "নূরানী ও নাজেরা", description: "নূরানী ও নাজেরা কুরআন প্রশিক্ষণ বিভাগ" },
    { id: classHifzId, madrasa_id: madrasaId, name: "হিফজুল কুরআন বিভাগ", description: "হিফজুল কুরআন ও হুসনে সওত বিভাগ" },
    { id: classIbtedayiId, madrasa_id: madrasaId, name: "ইবতেদায়ি ১ম বর্ষ", description: "কওমি ইবতেদায়ি প্রাথমিক শিক্ষা বিভাগ" },
    { id: classMizanId, madrasa_id: madrasaId, name: "মিজান জামাত", description: "আরবি ব্যাকরণ ও সরফ প্রাথমিক" },
    { id: classNahbemirId, madrasa_id: madrasaId, name: "নাহবেমীর জামাত", description: "আরবি নাহু ও ব্যাকরণ বিভাগ" },
    { id: classHedayahId, madrasa_id: madrasaId, name: "হেদায়াতুন্নাহব জামাত", description: "উচ্চতর আরবি নাহু ও সাহিত্য" },
    { id: classJalalainId, madrasa_id: madrasaId, name: "জালালাইন জামাত", description: "তাফসির ও উসুলুল হাদিস বিভাগ" },
    { id: classDawrahId, madrasa_id: madrasaId, name: "দাওরায়ে হাদিস (তাকমীল)", description: "মাস্টার্স সমমান সর্বোচ্চ হাদিস গবেষণা বিভাগ" },
  ];

  // 2. Subjects (UUIDs & standard SQL columns: id, madrasa_id, name, code, description)
  const subjects = [
    { id: makeDemoUuid(2, 1), madrasa_id: madrasaId, name: "কুরআন মাজিদ ও তাজবীদ", code: "QUR", description: "তাজবীদসহ পূর্ণাঙ্গ কুরআন মাজিদ তেলাওয়াত" },
    { id: makeDemoUuid(2, 2), madrasa_id: madrasaId, name: "উর্দু ও ফার্সি", code: "URDU", description: "উর্দু কি পহেলি কিতাব ও ফার্সি সাহিত্য" },
    { id: makeDemoUuid(2, 3), madrasa_id: madrasaId, name: "মিযানুস সরফ ও মুনশাইব", code: "MIZ", description: "ইলমুস সরফ ও সিগাহ গবেষণা" },
    { id: makeDemoUuid(2, 4), madrasa_id: madrasaId, name: "নাহবেমীর ও কাফিয়া", code: "NAH", description: "ইলমুন নাহু ও বাক্য বিশ্লেষণ" },
    { id: makeDemoUuid(2, 5), madrasa_id: madrasaId, name: "ফিকহ (আল-হিদায়াহ ও কুদূরী)", code: "FQH", description: "হানাফি ফিকহ ও মাসায়েল বিশ্লেষণ" },
    { id: makeDemoUuid(2, 6), madrasa_id: madrasaId, name: "তাফসীরে জালালাইন শরীফ", code: "TAF", description: "উচ্চতর তাফসীর ও শানে নুযুল" },
    { id: makeDemoUuid(2, 7), madrasa_id: madrasaId, name: "সহীহ বুখারী শরীফ", code: "BUK", description: "সিহাহ সিত্তাহ এর প্রধান কিতাব হাদিস পাঠ" },
    { id: makeDemoUuid(2, 8), madrasa_id: madrasaId, name: "বাংলা ব্যাকরণ ও সাহিত্য", code: "BEN", description: "মাতৃভাষা বাংলা রচনা ও ব্যাকরণ" },
    { id: makeDemoUuid(2, 9), madrasa_id: madrasaId, name: "সাধারণ গণিত", code: "MTH", description: "পাটীগণিত ও হিসাবরক্ষণ শিক্ষা" },
    { id: makeDemoUuid(2, 10), madrasa_id: madrasaId, name: "বেসিক ইংলিশ", code: "ENG", description: "দৈনন্দিন স্পোকেন ও মৌলিক ইংরেজি গ্রামার" },
  ];

  // 3. Teachers & Staff (UUIDs & standard SQL columns: id, madrasa_id, first_name, last_name, phone, email, designation)
  const teacherMuhtamimId = makeDemoUuid(3, 1);
  const teacherNaibId = makeDemoUuid(3, 2);
  const teacherHifz1Id = makeDemoUuid(3, 3);
  const teacherHifz2Id = makeDemoUuid(3, 4);
  const teacherKitabId = makeDemoUuid(3, 5);
  const teacherAccId = makeDemoUuid(3, 6);

  const teachers = [
    {
      id: teacherMuhtamimId,
      madrasa_id: madrasaId,
      first_name: "মাওলানা আহমাদ",
      last_name: "ওসামা",
      phone: "01711-987654",
      email: "demo@qawmierp.com",
      designation: "মুহতামিম ও শায়খুল হাদিস",
    },
    {
      id: teacherNaibId,
      madrasa_id: madrasaId,
      first_name: "মাওলানা মুশতাক",
      last_name: "আহমদ",
      phone: "01712-112233",
      email: "mushtaq@qawmi.app",
      designation: "নায়েবে মুহতামিম ও শিক্ষাসচিব",
    },
    {
      id: teacherHifz1Id,
      madrasa_id: madrasaId,
      first_name: "হাফেজ ক্বারী সাঈদ",
      last_name: "হাসান",
      phone: "01819-223344",
      email: "sayeed.hifz@qawmi.app",
      designation: "প্রধান হিফজ শিক্ষক",
    },
    {
      id: teacherHifz2Id,
      madrasa_id: madrasaId,
      first_name: "হাফেজ ইমরান",
      last_name: "বিন কাসেম",
      phone: "01911-334455",
      email: "imran.hifz@qawmi.app",
      designation: "সহকারী হিফজ শিক্ষক",
    },
    {
      id: teacherKitabId,
      madrasa_id: madrasaId,
      first_name: "মাওলানা হাবিবুর",
      last_name: "রহমান",
      phone: "01611-445566",
      email: "habib.kitab@qawmi.app",
      designation: "সিনিয়র কিতাব শিক্ষক",
    },
    {
      id: teacherAccId,
      madrasa_id: madrasaId,
      first_name: "মুহাম্মদ শরিফুল",
      last_name: "ইসলাম",
      phone: "01511-556677",
      email: "accounts@qawmi.app",
      designation: "প্রধান হিসাবরক্ষক",
    },
  ];

  // 4. Students (UUIDs & standard SQL columns: id, madrasa_id, first_name, last_name, roll_number, class_name, class_id, parent_phone, father_name, address)
  const studentIds = Array.from({ length: 10 }, (_, i) => makeDemoUuid(4, i + 1));

  const students = [
    {
      id: studentIds[0],
      madrasa_id: madrasaId,
      first_name: "আহমেদ",
      last_name: "আবদুল্লাহ",
      roll_number: "১",
      class_name: "হিফজুল কুরআন বিভাগ",
      class_id: classHifzId,
      father_name: "আলহাজ্ব মোজাম্মেল হক",
      parent_phone: "01711-220011",
      address: "ইসলামপুর, ঢাকা",
    },
    {
      id: studentIds[1],
      madrasa_id: madrasaId,
      first_name: "মাহমুদ",
      last_name: "হাসান",
      roll_number: "২",
      class_name: "হিফজুল কুরআন বিভাগ",
      class_id: classHifzId,
      father_name: "মাওলানা রফিকুল ইসলাম",
      parent_phone: "01811-220022",
      address: "কেরানীগঞ্জ, ঢাকা",
    },
    {
      id: studentIds[2],
      madrasa_id: madrasaId,
      first_name: "আব্দুর",
      last_name: "রহমান",
      roll_number: "৩",
      class_name: "হিফজুল কুরআন বিভাগ",
      class_id: classHifzId,
      father_name: "মোঃ শহিদুল্লাহ",
      parent_phone: "01911-220033",
      address: "সোনারগাঁও, নারায়ণগঞ্জ",
    },
    {
      id: studentIds[3],
      madrasa_id: madrasaId,
      first_name: "মুয়াজ",
      last_name: "বিন জাহিদ",
      roll_number: "৪",
      class_name: "হিফজুল কুরআন বিভাগ",
      class_id: classHifzId,
      father_name: "জাহিদুল ইসলাম",
      parent_phone: "01611-220044",
      address: "মিরপুর-১, ঢাকা",
    },
    {
      id: studentIds[4],
      madrasa_id: madrasaId,
      first_name: "সাজিদুর",
      last_name: "রহমান",
      roll_number: "১",
      class_name: "নাহবেমীর জামাত",
      class_id: classNahbemirId,
      father_name: "হাফেজ নুর মোহাম্মদ",
      parent_phone: "01511-220055",
      address: "যাত্রাবাড়ী, ঢাকা",
    },
    {
      id: studentIds[5],
      madrasa_id: madrasaId,
      first_name: "তৌহিদুল",
      last_name: "ইসলাম",
      roll_number: "২",
      class_name: "হেদায়াতুন্নাহব জামাত",
      class_id: classHedayahId,
      father_name: "মোঃ আনোয়ার হোসেন",
      parent_phone: "01722-330066",
      address: "গাজীপুর সদর",
    },
    {
      id: studentIds[6],
      madrasa_id: madrasaId,
      first_name: "আনাস ইবনে",
      last_name: "মালিক",
      roll_number: "১",
      class_name: "জালালাইন জামাত",
      class_id: classJalalainId,
      father_name: "মাওলানা ফজলুল করীম",
      parent_phone: "01822-330077",
      address: "টঙ্গী, গাজীপুর",
    },
    {
      id: studentIds[7],
      madrasa_id: madrasaId,
      first_name: "জুবায়ের",
      last_name: "আহমেদ",
      roll_number: "১",
      class_name: "দাওরায়ে হাদিস (তাকমীল)",
      class_id: classDawrahId,
      father_name: "মাওলানা মনসুরুল হক",
      parent_phone: "01922-330088",
      address: "লালবাগ, ঢাকা",
    },
    {
      id: studentIds[8],
      madrasa_id: madrasaId,
      first_name: "তালহা",
      last_name: "জুবায়ের",
      roll_number: "৫",
      class_name: "মিজান জামাত",
      class_id: classMizanId,
      father_name: "মোঃ হারুনুর রশিদ",
      parent_phone: "01622-330099",
      address: "উত্তরা, ঢাকা",
    },
    {
      id: studentIds[9],
      madrasa_id: madrasaId,
      first_name: "খালিদ",
      last_name: "সাইফুল্লাহ",
      roll_number: "৩",
      class_name: "ইবতেদায়ি ১ম বর্ষ",
      class_id: classIbtedayiId,
      father_name: "মোঃ এনামুল হক",
      parent_phone: "01733-440010",
      address: "ধানমন্ডি, ঢাকা",
    },
  ];

  // 5. Extended Student Profiles (Mapped both by UUID and by MM-48000x code)
  const rawProfiles = [
    {
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
    {
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
    {
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
    {
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
    {
      student_id: `${DEMO_MADRASA_PREFIX}-480005`,
      residential_status: "আবাসিক",
      boarding_type: "সাধারণ পেইং",
      is_boarding: true,
      monthly_fee: 1800,
      khoraki_fee: 2500,
      total_monthly_fee: 4300,
    },
    {
      student_id: `${DEMO_MADRASA_PREFIX}-480006`,
      residential_status: "আবাসিক",
      boarding_type: "সাধারণ পেইং",
      is_boarding: true,
      monthly_fee: 2000,
      khoraki_fee: 2500,
      total_monthly_fee: 4500,
    },
    {
      student_id: `${DEMO_MADRASA_PREFIX}-480007`,
      residential_status: "আবাসিক",
      boarding_type: "হাফ-ফ্রি",
      is_boarding: true,
      monthly_fee: 2200,
      khoraki_fee: 1500,
      total_monthly_fee: 3700,
    },
    {
      student_id: `${DEMO_MADRASA_PREFIX}-480008`,
      residential_status: "আবাসিক",
      boarding_type: "সাধারণ পেইং",
      is_boarding: true,
      monthly_fee: 2500,
      khoraki_fee: 2500,
      total_monthly_fee: 5000,
    },
    {
      student_id: `${DEMO_MADRASA_PREFIX}-480009`,
      residential_status: "অনাবাসিক",
      boarding_type: "অনাবাসিক",
      is_boarding: false,
      monthly_fee: 1600,
      khoraki_fee: 0,
      total_monthly_fee: 1600,
    },
    {
      student_id: `${DEMO_MADRASA_PREFIX}-480010`,
      residential_status: "অনাবাসিক",
      boarding_type: "অনাবাসিক",
      is_boarding: false,
      monthly_fee: 1200,
      khoraki_fee: 0,
      total_monthly_fee: 1200,
    },
  ];

  const student_profiles: Record<string, any> = {};
  rawProfiles.forEach((p, idx) => {
    const uuid = studentIds[idx];
    student_profiles[uuid] = { ...p, id: uuid };
    student_profiles[p.student_id] = { ...p, id: uuid };
  });

  // 6. Hifz Daily Logs
  const hifz_logs = [
    {
      id: makeDemoUuid(6, 1),
      madrasa_id: madrasaId,
      student_id: studentIds[0],
      teacher_id: teacherHifz1Id,
      log_date: todayStr,
      sabak_para: 19,
      sabak_page: 4,
      saboki_para: 18,
      amukhta_para: 10,
      performance_rating: "Excellent",
      notes: "মাশাআল্লাহ, অত্যন্ত সুন্দর মাখরাজ ও সাবলীল তেলাওয়াত।",
    },
    {
      id: makeDemoUuid(6, 2),
      madrasa_id: madrasaId,
      student_id: studentIds[1],
      teacher_id: teacherHifz1Id,
      log_date: todayStr,
      sabak_para: 13,
      sabak_page: 10,
      saboki_para: 12,
      amukhta_para: 6,
      performance_rating: "Good",
      notes: "তাজবীদ ও গুন্নায় মনোযোগ বৃদ্ধি করতে হবে।",
    },
    {
      id: makeDemoUuid(6, 3),
      madrasa_id: madrasaId,
      student_id: studentIds[2],
      teacher_id: teacherHifz1Id,
      log_date: todayStr,
      sabak_para: 25,
      sabak_page: 2,
      saboki_para: 24,
      amukhta_para: 15,
      performance_rating: "Excellent",
      notes: "দ্রুততম সময়ে কুরআন হেফজ সমাপ্তির দিকে অগ্রসর হচ্ছে।",
    },
    {
      id: makeDemoUuid(6, 4),
      madrasa_id: madrasaId,
      student_id: studentIds[3],
      teacher_id: teacherHifz2Id,
      log_date: todayStr,
      sabak_para: 8,
      sabak_page: 1,
      saboki_para: 7,
      amukhta_para: 3,
      performance_rating: "Good",
      notes: "সবকি নিয়মিত মুখস্থ শোনাচ্ছে।",
    },
  ];

  // 7. Attendance (Today + recent days history)
  const attendance = [
    // Today
    { id: makeDemoUuid(5, 1), madrasa_id: madrasaId, student_id: studentIds[0], date: todayStr, status: "Present", notes: "হাজির" },
    { id: makeDemoUuid(5, 2), madrasa_id: madrasaId, student_id: studentIds[1], date: todayStr, status: "Present", notes: "হাজির" },
    { id: makeDemoUuid(5, 3), madrasa_id: madrasaId, student_id: studentIds[2], date: todayStr, status: "Absent", notes: "অনুপস্থিত (জ্বর ও অসুস্থতা)" },
    { id: makeDemoUuid(5, 4), madrasa_id: madrasaId, student_id: studentIds[3], date: todayStr, status: "Present", notes: "হাজির" },
    { id: makeDemoUuid(5, 5), madrasa_id: madrasaId, student_id: studentIds[4], date: todayStr, status: "Present", notes: "হাজির" },
    { id: makeDemoUuid(5, 6), madrasa_id: madrasaId, student_id: studentIds[5], date: todayStr, status: "Present", notes: "হাজির" },
    { id: makeDemoUuid(5, 7), madrasa_id: madrasaId, student_id: studentIds[6], date: todayStr, status: "Absent", notes: "অনুপস্থিত (ছুটি ব্যতিরেকে)" },
    { id: makeDemoUuid(5, 8), madrasa_id: madrasaId, student_id: studentIds[7], date: todayStr, status: "Present", notes: "হাজির" },
    { id: makeDemoUuid(5, 9), madrasa_id: madrasaId, student_id: studentIds[8], date: todayStr, status: "Leave", notes: "অনুমোদিত পারিবারিক ছুটি" },
    { id: makeDemoUuid(5, 10), madrasa_id: madrasaId, student_id: studentIds[9], date: todayStr, status: "Late", notes: "দেরিতে উপস্থিত" },

    // Day Minus 1
    { id: makeDemoUuid(5, 11), madrasa_id: madrasaId, student_id: studentIds[0], date: dayMinus1, status: "Present", notes: "হাজির" },
    { id: makeDemoUuid(5, 12), madrasa_id: madrasaId, student_id: studentIds[1], date: dayMinus1, status: "Present", notes: "হাজির" },
    { id: makeDemoUuid(5, 13), madrasa_id: madrasaId, student_id: studentIds[2], date: dayMinus1, status: "Present", notes: "হাজির" },
    { id: makeDemoUuid(5, 14), madrasa_id: madrasaId, student_id: studentIds[3], date: dayMinus1, status: "Present", notes: "হাজির" },
    { id: makeDemoUuid(5, 15), madrasa_id: madrasaId, student_id: studentIds[4], date: dayMinus1, status: "Present", notes: "হাজির" },
    { id: makeDemoUuid(5, 16), madrasa_id: madrasaId, student_id: studentIds[5], date: dayMinus1, status: "Present", notes: "হাজির" },
    { id: makeDemoUuid(5, 17), madrasa_id: madrasaId, student_id: studentIds[6], date: dayMinus1, status: "Present", notes: "হাজির" },
    { id: makeDemoUuid(5, 18), madrasa_id: madrasaId, student_id: studentIds[7], date: dayMinus1, status: "Present", notes: "হাজির" },
    { id: makeDemoUuid(5, 19), madrasa_id: madrasaId, student_id: studentIds[8], date: dayMinus1, status: "Present", notes: "হাজির" },
    { id: makeDemoUuid(5, 20), madrasa_id: madrasaId, student_id: studentIds[9], date: dayMinus1, status: "Present", notes: "হাজির" },

    // Day Minus 2
    { id: makeDemoUuid(5, 21), madrasa_id: madrasaId, student_id: studentIds[0], date: dayMinus2, status: "Present", notes: "হাজির" },
    { id: makeDemoUuid(5, 22), madrasa_id: madrasaId, student_id: studentIds[1], date: dayMinus2, status: "Present", notes: "হাজির" },
    { id: makeDemoUuid(5, 23), madrasa_id: madrasaId, student_id: studentIds[2], date: dayMinus2, status: "Present", notes: "হাজির" },
    { id: makeDemoUuid(5, 24), madrasa_id: madrasaId, student_id: studentIds[3], date: dayMinus2, status: "Absent", notes: "অনুপস্থিত" },
    { id: makeDemoUuid(5, 25), madrasa_id: madrasaId, student_id: studentIds[4], date: dayMinus2, status: "Present", notes: "হাজির" },
    { id: makeDemoUuid(5, 26), madrasa_id: madrasaId, student_id: studentIds[5], date: dayMinus2, status: "Present", notes: "হাজির" },
    { id: makeDemoUuid(5, 27), madrasa_id: madrasaId, student_id: studentIds[6], date: dayMinus2, status: "Present", notes: "হাজির" },
    { id: makeDemoUuid(5, 28), madrasa_id: madrasaId, student_id: studentIds[7], date: dayMinus2, status: "Present", notes: "হাজির" },
    { id: makeDemoUuid(5, 29), madrasa_id: madrasaId, student_id: studentIds[8], date: dayMinus2, status: "Present", notes: "হাজির" },
    { id: makeDemoUuid(5, 30), madrasa_id: madrasaId, student_id: studentIds[9], date: dayMinus2, status: "Present", notes: "হাজির" },
  ];

  // 8. Academic Session
  const sessionId = makeDemoUuid(14, 1);
  const sessions: AcademicSession[] = [
    {
      id: sessionId,
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

  const academic_sessions = [
    {
      id: sessionId,
      madrasa_id: madrasaId,
      name: "১৪৪৭-৪৮ হিজরি শিক্ষাবর্ষ",
      code: "1447-48",
      hijri_year: "১৪৪৭-৪৮",
      start_date: "2026-01-01",
      end_date: "2026-12-31",
      is_active: true,
      status: "ACTIVE",
    },
  ];

  // 9. Funds
  const fundGenId = makeDemoUuid(16, 1);
  const fundLillahId = makeDemoUuid(16, 2);
  const fundBldId = makeDemoUuid(16, 3);
  const fundMhfId = makeDemoUuid(16, 4);

  const funds = [
    { id: fundGenId, name: "সাধারণ তহবিল (General Fund)", code: "GEN", balance: 145000, total_collected: 185000 },
    { id: fundLillahId, name: "লিল্লাহ বোর্ডিং ও যাকাত তহবিল (Zakat / Lillah)", code: "ZAKAT", balance: 380000, total_collected: 380000 },
    { id: fundBldId, name: "মাদরাসা ভবন নির্মাণ ও উন্নয়ন তহবিল", code: "BLD", balance: 250000, total_collected: 250000 },
    { id: fundMhfId, name: "বার্ষিক ওয়াজ মাহফিল ও সম্মেলন তহবিল", code: "MHF", balance: 85000, total_collected: 85000 },
  ];

  // 10. Expenses (Standard SQL columns: id, madrasa_id, category, amount, expense_date, description)
  const expenses = [
    {
      id: makeDemoUuid(7, 1),
      madrasa_id: madrasaId,
      category: "Salary",
      amount: 145000,
      expense_date: todayStr,
      description: "[ভাউচার: V-2026-0001 | সাধারণ তহবিল] শিক্ষক ও খাদেমবৃন্দের শাওয়াল মাসের বেতনভাতা ব্যাংক ও ক্যাশে পরিশোধ",
    },
    {
      id: makeDemoUuid(7, 2),
      madrasa_id: madrasaId,
      category: "Food",
      amount: 48500,
      expense_date: todayStr,
      description: "[ভাউচার: V-2026-0002 | লিল্লাহ বোর্ডিং ফান্ড] ছাত্রাবাস মেস বাজার ও ৫০ বস্তা চাল-ডাল ক্রয়",
    },
    {
      id: makeDemoUuid(7, 3),
      madrasa_id: madrasaId,
      category: "Utility",
      amount: 12800,
      expense_date: todayStr,
      description: "[ভাউচার: V-2026-0003 | সাধারণ তহবিল] ডেসকো বিদ্যুৎ বিল ও পানির পাম্প বিল পরিশোধ",
    },
    {
      id: makeDemoUuid(7, 4),
      madrasa_id: madrasaId,
      category: "Maintenance",
      amount: 6500,
      expense_date: todayStr,
      description: "[ভাউচার: V-2026-0004 | ভবন উন্নয়ন তহবিল] হিফজখানা ও মাদরাসা কক্ষের সিলিং ফ্যান ও লাইট ওয়্যারিং",
    },
    {
      id: makeDemoUuid(7, 5),
      madrasa_id: madrasaId,
      category: "Other",
      amount: 18200,
      expense_date: todayStr,
      description: "[ভাউচার: V-2026-0005 | সাধারণ তহবিল] ১ম সাময়িক পরীক্ষার খাতা ও প্রশ্নপত্র প্রিন্টিং বিল",
    },
  ];

  // 11. Donors & Donations (Relational SQL tables: donors & donations)
  const donor1Id = makeDemoUuid(8, 1);
  const donor2Id = makeDemoUuid(8, 2);
  const donor3Id = makeDemoUuid(8, 3);
  const donor4Id = makeDemoUuid(8, 4);

  const donors = [
    { id: donor1Id, madrasa_id: madrasaId, name: "আলহাজ্ব হারুনুর রশিদ", phone: "01711-554433", address: "চকবাজার, ঢাকা", donor_type: "Zakat" },
    { id: donor2Id, madrasa_id: madrasaId, name: "মোঃ আকতারুজ্জামান (প্রবাসী)", phone: "01811-998877", address: "দুবাই / মিরপুর, ঢাকা", donor_type: "General" },
    { id: donor3Id, madrasa_id: madrasaId, name: "হাফেজ মাওলানা আবুল বাশার", phone: "01911-776655", address: "উত্তরা, ঢাকা", donor_type: "Lillah" },
    { id: donor4Id, madrasa_id: madrasaId, name: "কেন্দ্রীয় দানবাক্স কালেকশন", phone: "01700-000000", address: "মাদরাসা ফটক", donor_type: "General" },
  ];

  const donations = [
    {
      id: makeDemoUuid(9, 1),
      madrasa_id: madrasaId,
      donor_id: donor1Id,
      amount: 100000,
      donation_type: "Zakat",
      donation_date: todayStr,
      receipt_no: "DON-2026-0001",
      notes: "[রিসিট: DON-2026-0001 | ব্যাংক ট্রান্সফার] ব্যবসায়ী সমিতির বার্ষিক যাকাত ফান্ড থেকে লিল্লাহ বোর্ডিং",
    },
    {
      id: makeDemoUuid(9, 2),
      madrasa_id: madrasaId,
      donor_id: donor2Id,
      amount: 50000,
      donation_type: "General",
      donation_date: todayStr,
      receipt_no: "DON-2026-0002",
      notes: "[রিসিট: DON-2026-0002 | bKash] মাদরাসা ৩য় তলা সম্প্রসারণের জন্য নির্মাণ অনুদান",
    },
    {
      id: makeDemoUuid(9, 3),
      madrasa_id: madrasaId,
      donor_id: donor3Id,
      amount: 25000,
      donation_type: "Lillah",
      donation_date: todayStr,
      receipt_no: "DON-2026-0003",
      notes: "[রিসিট: DON-2026-0003 | ক্যাশ] পিতার ইছালে সাওয়াবের নিয়তে মাদরাসায় সাধারণ সদকা",
    },
    {
      id: makeDemoUuid(9, 4),
      madrasa_id: madrasaId,
      donor_id: donor4Id,
      amount: 34500,
      donation_type: "General",
      donation_date: todayStr,
      receipt_no: "DON-2026-0004",
      notes: "[দানবাক্স কালেকশন: DON-2026-0004] জুমার নামাজের পর প্রধান ফটকের দানবাক্স উন্মুক্তকরণ",
    },
  ];

  // 12. Student Fees (Relational SQL table: fees)
  const fees = [
    {
      id: makeDemoUuid(10, 1),
      madrasa_id: madrasaId,
      student_id: studentIds[0],
      fee_type: "Monthly",
      amount: 1500,
      payment_date: todayStr,
      fee_month: "শাওয়াল",
      fee_year: "১৪৪৭",
      notes: "[রিসিট: MR-2026-0001] মাসিক পড়াশোনা বেতন",
    },
    {
      id: makeDemoUuid(10, 2),
      madrasa_id: madrasaId,
      student_id: studentIds[0],
      fee_type: "Monthly",
      amount: 2500,
      payment_date: todayStr,
      fee_month: "শাওয়াল",
      fee_year: "১৪৪৭",
      notes: "[রিসিট: MR-2026-0001] ছাত্রাবাস খোরাকি ফি",
    },
    {
      id: makeDemoUuid(10, 3),
      madrasa_id: madrasaId,
      student_id: studentIds[4],
      fee_type: "Monthly",
      amount: 1800,
      payment_date: todayStr,
      fee_month: "শাওয়াল",
      fee_year: "১৪৪৭",
      notes: "[রিসিট: MR-2026-0002] মাসিক পড়াশোনা ফি",
    },
    {
      id: makeDemoUuid(10, 4),
      madrasa_id: madrasaId,
      student_id: studentIds[5],
      fee_type: "Monthly",
      amount: 1000,
      payment_date: todayStr,
      fee_month: "শাওয়াল",
      fee_year: "১৪৪৭",
      notes: "[রিসিট: MR-2026-0003] মাসিক ফি আংশিক পরিশোধ",
    },
  ];

  // 13. Bazar Expenses (Relational SQL table: bazar_expenses)
  const bazar_expenses = [
    {
      id: makeDemoUuid(11, 1),
      madrasa_id: madrasaId,
      amount: 8600,
      expense_date: todayStr,
      items_details: "মিনিকেট চাল ৫০ কেজি ২ বস্তা ও মসুর ডাল ১০ কেজি (ক্রেতা: হাফেজ ইমরান বিন কাসেম)",
    },
    {
      id: makeDemoUuid(11, 2),
      madrasa_id: madrasaId,
      amount: 5400,
      expense_date: todayStr,
      items_details: "রুই মাছ ১২ কেজি, আলু, পেঁয়াজ, কাঁচামরিচ ও শাকসবজি (ক্রেতা: হাফেজ ইমরান বিন কাসেম)",
    },
  ];

  // 14. Boarding Meals (Relational SQL table: meal_entries)
  const meal_entries = [
    studentIds[0],
    studentIds[1],
    studentIds[2],
    studentIds[4],
    studentIds[5],
    studentIds[6],
    studentIds[7],
  ].map((sid, idx) => ({
    id: makeDemoUuid(15, idx + 1),
    madrasa_id: madrasaId,
    student_id: sid,
    entry_date: todayStr,
    meal_status: "On",
  }));

  // 15. Exams & Results (Relational SQL tables: exams, exam_results)
  const examId = makeDemoUuid(12, 1);
  const exams = [
    {
      id: examId,
      madrasa_id: madrasaId,
      title: "১ম সাময়িক পরীক্ষা ১৪৪৭ হিজরি",
      year: "১৪৪৭",
      start_date: todayStr,
      status: "Completed",
    },
  ];

  const exam_results = [
    {
      id: makeDemoUuid(13, 1),
      madrasa_id: madrasaId,
      exam_id: examId,
      student_id: studentIds[4],
      subject_name: "নাহবেমীর ও কাফিয়া",
      marks_obtained: 95,
      total_marks: 100,
    },
    {
      id: makeDemoUuid(13, 2),
      madrasa_id: madrasaId,
      exam_id: examId,
      student_id: studentIds[4],
      subject_name: "মিযানুস সরফ ও মুনশাইব",
      marks_obtained: 92,
      total_marks: 100,
    },
    {
      id: makeDemoUuid(13, 3),
      madrasa_id: madrasaId,
      exam_id: examId,
      student_id: studentIds[5],
      subject_name: "ফিকহ (আল-হিদায়াহ ও কুদূরী)",
      marks_obtained: 88,
      total_marks: 100,
    },
    {
      id: makeDemoUuid(13, 4),
      madrasa_id: madrasaId,
      exam_id: examId,
      student_id: studentIds[6],
      subject_name: "তাফসীরে জালালাইন শরীফ",
      marks_obtained: 94,
      total_marks: 100,
    },
    {
      id: makeDemoUuid(13, 5),
      madrasa_id: madrasaId,
      exam_id: examId,
      student_id: studentIds[7],
      subject_name: "সহীহ বুখারী শরীফ",
      marks_obtained: 98,
      total_marks: 100,
    },
  ];

  // 16. Fee Types & Invoices for Metadata
  const fee_types = [
    { id: "ft_monthly", name: "মাসিক পড়াশোনা ফি (Tuition)", default_amount: 1500, fund_id: fundGenId, fund_name: "সাধারণ তহবিল" },
    { id: "ft_khoraki", name: "ছাত্রাবাস খোরাকি ও মেস ফি", default_amount: 2500, fund_id: fundLillahId, fund_name: "লিল্লাহ বোর্ডিং ও যাকাত তহবিল" },
    { id: "ft_exam", name: "১ম সাময়িক পরীক্ষা ফি", default_amount: 500, fund_id: fundGenId, fund_name: "সাধারণ তহবিল" },
  ];

  const student_fees = [
    {
      id: makeDemoUuid(17, 1),
      student_id: studentIds[0],
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
      id: makeDemoUuid(17, 2),
      student_id: studentIds[0],
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
      id: makeDemoUuid(17, 3),
      student_id: studentIds[4],
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
      id: makeDemoUuid(17, 4),
      student_id: studentIds[5],
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
      id: makeDemoUuid(18, 1),
      receipt_no: "MR-2026-0001",
      student_id: studentIds[0],
      student_name: "আহমেদ আবদুল্লাহ",
      class_name: "হিফজুল কুরআন বিভাগ",
      total_amount: 4000,
      payment_date: todayStr,
      payment_method: "Cash",
      collected_by: "মুহাম্মদ শরিফুল ইসলাম",
      allocations: [
        { fee_id: makeDemoUuid(17, 1), fee_type_name: "মাসিক বেতন", allocated_amount: 1500, fund_name: "সাধারণ তহবিল" },
        { fee_id: makeDemoUuid(17, 2), fee_type_name: "খোরাকি ফি", allocated_amount: 2500, fund_name: "লিল্লাহ বোর্ডিং ও যাকাত তহবিল" },
      ],
    },
    {
      id: makeDemoUuid(18, 2),
      receipt_no: "MR-2026-0002",
      student_id: studentIds[4],
      student_name: "সাজিদুর রহমান",
      class_name: "নাহবেমীর জামাত",
      total_amount: 1800,
      payment_date: todayStr,
      payment_method: "bKash",
      collected_by: "মুহাম্মদ শরিফুল ইসলাম",
      allocations: [
        { fee_id: makeDemoUuid(17, 3), fee_type_name: "মাসিক বেতন", allocated_amount: 1800, fund_name: "সাধারণ তহবিল" },
      ],
    },
  ];

  // 17. Staff Members Metadata (For /dashboard/staff full HR module)
  const staff_members = [
    {
      id: teacherMuhtamimId,
      madrasa_id: madrasaId,
      staff_id_code: `${DEMO_MADRASA_PREFIX}-STF-001`,
      verification_token: "STF-TOK-001",
      personal_info: {
        first_name: "মাওলানা আহমাদ",
        last_name: "ওসামা",
        full_name_bn: "মাওলানা আহমাদ ওসামা",
        gender: "MALE" as const,
        phone: "01711-987654",
        email: "demo@qawmierp.com",
        father_name: "মুহাম্মদ মুস্তাফিজুর রহমান",
        address: "ঢাকা, বাংলাদেশ",
      },
      employment_info: {
        status: "ACTIVE" as const,
        employment_type: "FULL_TIME" as const,
        joining_date: "2020-01-01",
        category_code: "teaching" as const,
        category_name: "শিক্ষক / ওস্তাদ",
        designation_name: "মুহতামিম ও শায়খুল হাদিস",
        department_name: "শিক্ষা ও প্রশাসন",
      },
      financial_info: {
        basic_salary: 45000,
        gross_salary: 50000,
        payment_method: "BANK_TRANSFER" as const,
      },
    },
    {
      id: teacherNaibId,
      madrasa_id: madrasaId,
      staff_id_code: `${DEMO_MADRASA_PREFIX}-STF-002`,
      verification_token: "STF-TOK-002",
      personal_info: {
        first_name: "মাওলানা মুশতাক",
        last_name: "আহমদ",
        full_name_bn: "মাওলানা মুশতাক আহমদ",
        gender: "MALE" as const,
        phone: "01712-112233",
        email: "mushtaq@qawmi.app",
        father_name: "মুহাম্মদ সামিউল্লাহ",
        address: "ঢাকা",
      },
      employment_info: {
        status: "ACTIVE" as const,
        employment_type: "FULL_TIME" as const,
        joining_date: "2021-03-01",
        category_code: "teaching" as const,
        category_name: "শিক্ষক / ওস্তাদ",
        designation_name: "নায়েবে মুহতামিম ও শিক্ষাসচিব",
        department_name: "শিক্ষা বিভাগ",
      },
      financial_info: {
        basic_salary: 35000,
        gross_salary: 38000,
        payment_method: "BANK_TRANSFER" as const,
      },
    },
    {
      id: teacherHifz1Id,
      madrasa_id: madrasaId,
      staff_id_code: `${DEMO_MADRASA_PREFIX}-STF-003`,
      verification_token: "STF-TOK-003",
      personal_info: {
        first_name: "হাফেজ ক্বারী সাঈদ",
        last_name: "হাসান",
        full_name_bn: "হাফেজ ক্বারী সাঈদ হাসান",
        gender: "MALE" as const,
        phone: "01819-223344",
        email: "sayeed.hifz@qawmi.app",
        father_name: "হাফেজ আব্দুল ওয়াহহাব",
        address: "ঢাকা",
      },
      employment_info: {
        status: "ACTIVE" as const,
        employment_type: "FULL_TIME" as const,
        joining_date: "2022-01-15",
        category_code: "teaching" as const,
        category_name: "শিক্ষক / ওস্তাদ",
        designation_name: "প্রধান হিফজ শিক্ষক",
        department_name: "হিফজুল কুরআন বিভাগ",
      },
      financial_info: {
        basic_salary: 22000,
        gross_salary: 25000,
        payment_method: "CASH" as const,
      },
    },
    {
      id: teacherHifz2Id,
      madrasa_id: madrasaId,
      staff_id_code: `${DEMO_MADRASA_PREFIX}-STF-004`,
      verification_token: "STF-TOK-004",
      personal_info: {
        first_name: "হাফেজ ইমরান",
        last_name: "বিন কাসেম",
        full_name_bn: "হাফেজ ইমরান বিন কাসেম",
        gender: "MALE" as const,
        phone: "01911-334455",
        email: "imran.hifz@qawmi.app",
        father_name: "কাসেম আলী",
        address: "ঢাকা",
      },
      employment_info: {
        status: "ACTIVE" as const,
        employment_type: "FULL_TIME" as const,
        joining_date: "2023-05-01",
        category_code: "teaching" as const,
        category_name: "শিক্ষক / ওস্তাদ",
        designation_name: "সহকারী হিফজ শিক্ষক",
        department_name: "হিফজুল কুরআন বিভাগ",
      },
      financial_info: {
        basic_salary: 18000,
        gross_salary: 20000,
        payment_method: "CASH" as const,
      },
    },
    {
      id: teacherKitabId,
      madrasa_id: madrasaId,
      staff_id_code: `${DEMO_MADRASA_PREFIX}-STF-005`,
      verification_token: "STF-TOK-005",
      personal_info: {
        first_name: "মাওলানা হাবিবুর",
        last_name: "রহমান",
        full_name_bn: "মাওলানা হাবিবুর রহমান",
        gender: "MALE" as const,
        phone: "01611-445566",
        email: "habib.kitab@qawmi.app",
        father_name: "মাওলানা নুরুল্লাহ",
        address: "ঢাকা",
      },
      employment_info: {
        status: "ACTIVE" as const,
        employment_type: "FULL_TIME" as const,
        joining_date: "2021-08-01",
        category_code: "teaching" as const,
        category_name: "শিক্ষক / ওস্তাদ",
        designation_name: "সিনিয়র কিতাব শিক্ষক",
        department_name: "কিতাব বিভাগ",
      },
      financial_info: {
        basic_salary: 25000,
        gross_salary: 28000,
        payment_method: "BANK_TRANSFER" as const,
      },
    },
    {
      id: teacherAccId,
      madrasa_id: madrasaId,
      staff_id_code: `${DEMO_MADRASA_PREFIX}-STF-006`,
      verification_token: "STF-TOK-006",
      personal_info: {
        first_name: "মুহাম্মদ শরিফুল",
        last_name: "ইসলাম",
        full_name_bn: "মুহাম্মদ শরিফুল ইসলাম",
        gender: "MALE" as const,
        phone: "01511-556677",
        email: "accounts@qawmi.app",
        father_name: "মোহাম্মদ গোলাম মোস্তফা",
        address: "ঢাকা",
      },
      employment_info: {
        status: "ACTIVE" as const,
        employment_type: "FULL_TIME" as const,
        joining_date: "2022-02-01",
        category_code: "administration" as const,
        category_name: "প্রশাসন ও কর্মকর্তা",
        designation_name: "প্রধান হিসাবরক্ষক",
        department_name: "হিসাব বিভাগ",
      },
      financial_info: {
        basic_salary: 24000,
        gross_salary: 26000,
        payment_method: "BANK_TRANSFER" as const,
      },
    },
  ];

  // 18. Fundraising Special (Mahfil & Donation Box)
  const mahfils = [
    {
      id: makeDemoUuid(19, 1),
      title: "৩১তম ঐতিহাসিক বার্ষিক ইসলামী মহাসম্মেলন ও ওয়াজ মাহফিল",
      hijri_year: "১৪৪৭",
      gregorian_date: "২০২৬-১২-২৫",
      total_target: 500000,
      collected_amount: 315000,
      status: "COMPLETED",
    },
  ];

  const donation_boxes = [
    { id: makeDemoUuid(20, 1), location_name: "মাদরাসা প্রধান ফটক (Main Gate)", custodian_name: "মুহাম্মদ শরিফুল ইসলাম", total_collection: 42500 },
    { id: makeDemoUuid(20, 2), location_name: "কেন্দ্রীয় জামে মসজিদ বারান্দা", custodian_name: "মাওলানা মুশতাক আহমদ", total_collection: 28000 },
  ];

  // 19. Inventory Data
  const inventoryData = getDefaultInventorySeed(madrasaId);

  // 20. Library Books
  const library_books = [
    { id: makeDemoUuid(21, 1), title: "সহীহুল বুখারী (পূর্ণাঙ্গ মাকতাবাতুল বুশরা)", author: "ইমাম বুখারী (রহ.)", isbn: "978-01", stock: 10, available: 8 },
    { id: makeDemoUuid(21, 2), title: "তাফসীরে ইবনে কাসীর (ইসলামিক ফাউন্ডেশন)", author: "আল্লামা ইবনে কাসীর (রহ.)", isbn: "978-02", stock: 6, available: 5 },
    { id: makeDemoUuid(21, 3), title: "আল-হিদায়াহ শরহুল বিদায়াহ", author: "ইমাম মারগিনানী (রহ.)", isbn: "978-03", stock: 15, available: 12 },
    { id: makeDemoUuid(21, 4), title: "মিরকাতুল মাফাতীহ শরহে মিশকাতুল মাসাবীহ", author: "মোল্লা আলী কারী (রহ.)", isbn: "978-04", stock: 8, available: 7 },
  ];

  // 21. Teacher Attendance
  const teacher_attendance = [
    { id: makeDemoUuid(22, 1), teacher_id: teacherMuhtamimId, teacher_name: "মাওলানা আহমাদ ওসামা", date: todayStr, status: "Present", check_in: "08:15 AM", notes: "হাজির" },
    { id: makeDemoUuid(22, 2), teacher_id: teacherNaibId, teacher_name: "মাওলানা মুশতাক আহমদ", date: todayStr, status: "Present", check_in: "08:30 AM", notes: "হাজির" },
    { id: makeDemoUuid(22, 3), teacher_id: teacherHifz1Id, teacher_name: "হাফেজ ক্বারী সাঈদ হাসান", date: todayStr, status: "Present", check_in: "07:30 AM", notes: "হাজির" },
    { id: makeDemoUuid(22, 4), teacher_id: teacherHifz2Id, teacher_name: "হাফেজ ইমরান বিন কাসেম", date: todayStr, status: "Present", check_in: "07:45 AM", notes: "হাজির" },
    { id: makeDemoUuid(22, 5), teacher_id: teacherKitabId, teacher_name: "মাওলানা হাবিবুর রহমান", date: todayStr, status: "Present", check_in: "08:45 AM", notes: "হাজির" },
    { id: makeDemoUuid(22, 6), teacher_id: teacherAccId, teacher_name: "মুহাম্মদ শরিফুল ইসলাম", date: todayStr, status: "Present", check_in: "08:50 AM", notes: "হাজির" },
  ];

  // 22. Institutional Notices
  const notices = [
    {
      id: makeDemoUuid(23, 1),
      title: "১৪৪৭ হিজরি শিক্ষাবর্ষের ১ম সাময়িক পরীক্ষার ফলাফল প্রকাশ প্রসঙ্গে",
      content: "মাদ্রাসাতুল মুসলিমিন-এর সকল অভিভাবক ও শিক্ষার্থীদের আনন্দের সাথে জানানো যাচ্ছে যে, ১ম সাময়িক পরীক্ষার ফলাফল প্রকাশিত হয়েছে। রেজাল্ট কার্ড অনলাইন পোর্টাল ও মাদরাসা অফিস থেকে সংগ্রহ করা যাবে।",
      category: "ACADEMIC",
      published_by: "মাওলানা আহমাদ ওসামা (মুহতামিম)",
      created_at: now,
      is_pinned: true,
    },
    {
      id: makeDemoUuid(23, 2),
      title: "মাসিক লিল্লাহ বোর্ডিং ও বেতন পরিশোধ সংক্রান্ত নোটিশ",
      content: "সকল অভিভাবককে চলতি মাসের ১০ তারিখের মধ্যে মাদরাসার হিসাব বিভাগে অথবা অনলাইন পোর্টালের মাধ্যমে বেতন ও বোর্ডিং ফি পরিশোধের জন্য বিনীত অনুরোধ করা হচ্ছে।",
      category: "ACCOUNTS",
      published_by: "হিসাব বিভাগ",
      created_at: now,
      is_pinned: false,
    },
  ];

  // 23. Routines
  const routines = [
    {
      id: makeDemoUuid(24, 1),
      class_id: classHifzId,
      class_name: "হিফজুল কুরআন বিভাগ",
      day: "শনিবার",
      period: 1,
      time: "০৭:০০ - ০৮:৩০",
      subject: "কুরআন মাজিদ সবক ও তাসমী",
      teacher_name: "হাফেজ ক্বারী সাঈদ হাসান",
    },
    {
      id: makeDemoUuid(24, 2),
      class_id: classHedayahId,
      class_name: "হেদায়াতুন্নাহব জামাত",
      day: "শনিবার",
      period: 2,
      time: "০৯:০০ - ১০:০০",
      subject: "ফিকহ (আল-হিদায়াহ)",
      teacher_name: "মাওলানা আহমাদ ওসামা (মুহতামিম)",
    },
    {
      id: makeDemoUuid(24, 3),
      class_id: classDawrahId,
      class_name: "দাওরায়ে হাদিস (তাকমীল)",
      day: "শনিবার",
      period: 3,
      time: "১০:১৫ - ১১:১৫",
      subject: "সহীহ বুখারী শরীফ",
      teacher_name: "মাওলানা আহমাদ ওসামা (মুহতামিম)",
    },
  ];

  // Root metadata object to be merged into madrasas registration_no
  const metadata = {
    prefix: DEMO_MADRASA_PREFIX,
    short_code: DEMO_MADRASA_PREFIX,
    sessions,
    student_profiles,
    staff_members,
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
      [examId]: {
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
    attendance,
    hifz_logs,
    expenses,
    donors,
    donations,
    fees,
    bazar_expenses,
    meal_entries,
    exams,
    exam_results,
    academic_sessions,
    metadata,
  };
}
