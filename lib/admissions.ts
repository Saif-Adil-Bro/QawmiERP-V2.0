export interface AdmissionApplication {
  id: string;
  madrasa_id: string;
  application_no: string; // e.g. ADM-2026-001
  roll_number: string; // Exam Roll e.g. ET-1001
  session_name: string; // e.g. "১৪৪৭-৪৮ হিজরি (২০২৬-২৭)"
  academic_year: string; // "২০২৬-২৭"
  
  // Student Personal Details
  applicant_name_bn: string;
  applicant_name_en: string;
  date_of_birth: string;
  gender: "MALE" | "FEMALE";
  blood_group?: string;
  birth_reg_no?: string;
  photo_url?: string;

  // Guardian Details
  father_name: string;
  father_occupation?: string;
  mother_name: string;
  guardian_name: string;
  guardian_relation: string;
  guardian_phone: string;
  guardian_nid?: string;
  emergency_phone?: string;
  email?: string;

  // Address
  present_address: string;
  permanent_address: string;

  // Academic Interest
  target_class_id: string;
  target_class_name: string;
  residential_status: "আবাসিক" | "অনাবাসিক" | "ডে-কেয়ার";
  previous_institution?: string;
  previous_class_or_para?: string;

  // Status
  status: "PENDING" | "ADMIT_ISSUED" | "EXAM_TAKEN" | "MERIT_SELECTED" | "WAITING_LIST" | "CONFIRMED" | "REJECTED";
  
  // Entry Test Marks & Evaluation
  test_evaluation?: {
    written_marks?: number; // Out of 50
    oral_marks?: number; // Out of 30
    quran_tilawat_marks?: number; // Out of 20
    total_marks?: number; // Out of 100
    percentage?: number;
    merit_position?: number;
    is_passed?: boolean;
    evaluated_by?: string;
    evaluated_at?: string;
    remarks?: string;
  };

  // Exam Schedule for Admit Card
  exam_schedule: {
    exam_date: string;
    exam_time: string;
    venue: string;
    room_no: string;
    reporting_time: string;
    instructions: string[];
  };

  confirmed_student_id?: string;
  assigned_permanent_roll?: string;

  created_at: string;
  updated_at: string;
  is_archived?: boolean;
}

export const DEFAULT_EXAM_INSTRUCTIONS = [
  "ভর্তি পরীক্ষার দিন অবশ্যই এই প্রবেশপত্র (Admit Card) সাথে আনতে হবে।",
  "পরীক্ষা শুরুর অন্তত ৩০ মিনিট পূর্বে পরীক্ষার কক্ষে উপস্থিত হতে হবে।",
  "কলম, পেন্সিল ও প্রয়োজনীয় শিক্ষা উপকরণ সাথে রাখতে হবে।",
  "কুরআনুল কারীম ও হিফজের ক্ষেত্রে সহীহ তিলাওয়াত ও মাসায়েলের মৌখিক পরীক্ষা নেওয়া হবে।",
  "পরীক্ষাকক্ষে মোবাইল ফোন বা কোনো ধরণের ইলেকট্রনিক ডিভাইস আনা সম্পূর্ণ নিষিদ্ধ।"
];

export function generateApplicationNumber(sequence: number, year = 2026): string {
  return `ADM-${year}-${String(sequence).padStart(4, "0")}`;
}

export function generateExamRollNumber(sequence: number): string {
  return `ET-${String(1000 + sequence)}`;
}

export function getDefaultAdmissionsSeed(madrasaId: string): AdmissionApplication[] {
  const now = new Date().toISOString();
  return [
    {
      id: `adm_${madrasaId.substring(0, 8)}_01`,
      madrasa_id: madrasaId,
      application_no: "ADM-2026-0001",
      roll_number: "ET-1001",
      session_name: "১৪৪৭-৪৮ হিজরি (২০২৬-২৭)",
      academic_year: "২০২৬-২৭",
      applicant_name_bn: "মুহাম্মদ তাহমিদ হাসান",
      applicant_name_en: "Muhammad Tahmid Hasan",
      date_of_birth: "2015-05-12",
      gender: "MALE",
      blood_group: "B+",
      birth_reg_no: "20151234567890123",
      photo_url: "https://images.unsplash.com/photo-1544717305-2782549b5136?w=200&auto=format&fit=crop&q=80",
      father_name: "মাওলানা আব্দুল করিম",
      father_occupation: "ইমাম ও খতীব",
      mother_name: "রাবেয়া খাতুন",
      guardian_name: "মাওলানা আব্দুল করিম",
      guardian_relation: "পিতা",
      guardian_phone: "01711002233",
      emergency_phone: "01811998877",
      present_address: "বাড়ি-১২, রোড-৪, মিরপুর-১০, ঢাকা",
      permanent_address: "গ্রাম: রসুলপুর, ডাকঘর: ফুলবাড়ীয়া, ময়মনসিংহ",
      target_class_id: "cls_hifz",
      target_class_name: "হিফজুল কুরআন বিভাগ",
      residential_status: "আবাসিক",
      previous_institution: "দারুল উলুম মাদানিয়া মাদরাসা",
      previous_class_or_para: "নাজেরা ৫ পারা সমাপ্ত",
      status: "MERIT_SELECTED",
      test_evaluation: {
        written_marks: 44,
        oral_marks: 28,
        quran_tilawat_marks: 19,
        total_marks: 91,
        percentage: 91,
        merit_position: 1,
        is_passed: true,
        evaluated_by: "মাওলানা ক্বারী ইলিয়াস আহমদ",
        evaluated_at: "2026-05-10",
        remarks: "মাশাআল্লাহ, সুন্দর কন্ঠ ও বিশুদ্ধ মাখরাজ। মেধা তালিকায় শীর্ষস্থান।"
      },
      exam_schedule: {
        exam_date: "২০২৬-০৫-১৫",
        exam_time: "সকাল ০৯:০০ ঘটিকা",
        venue: "মাদরাসা কেন্দ্রীয় অডিটোরিয়াম",
        room_no: "১০১ (নিচতলা)",
        reporting_time: "সকাল ০৮:৩০ ঘটিকা",
        instructions: DEFAULT_EXAM_INSTRUCTIONS
      },
      created_at: now,
      updated_at: now
    },
    {
      id: `adm_${madrasaId.substring(0, 8)}_02`,
      madrasa_id: madrasaId,
      application_no: "ADM-2026-0002",
      roll_number: "ET-1002",
      session_name: "১৪৪৭-৪৮ হিজরি (২০২৬-২৭)",
      academic_year: "২০২৬-২৭",
      applicant_name_bn: "আব্দুর রহমান নোমান",
      applicant_name_en: "Abdur Rahman Noman",
      date_of_birth: "2016-08-20",
      gender: "MALE",
      blood_group: "O+",
      birth_reg_no: "20164567890123456",
      photo_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80",
      father_name: "হাফেজ নূরুল ইসলাম",
      father_occupation: "ব্যবসায়ী",
      mother_name: "ফাতেমা বেগম",
      guardian_name: "হাফেজ নূরুল ইসলাম",
      guardian_relation: "পিতা",
      guardian_phone: "01819223344",
      present_address: "উত্তরা সেক্টর ৭, ঢাকা",
      permanent_address: "পীরগাছা, রংপুর",
      target_class_id: "cls_noorani",
      target_class_name: "নূরানী ৩য় জামাত",
      residential_status: "অনাবাসিক",
      previous_institution: "আল-ফালাহ নূরানী একাডেমি",
      previous_class_or_para: "নূরানী ২য় জামাত",
      status: "ADMIT_ISSUED",
      exam_schedule: {
        exam_date: "২০২৬-০৫-১৫",
        exam_time: "সকাল ১০:৩০ ঘটিকা",
        venue: "নূরানী একাডেমিক ভবন",
        room_no: "২০৩ (দোতলা)",
        reporting_time: "সকাল ১০:০০ ঘটিকা",
        instructions: DEFAULT_EXAM_INSTRUCTIONS
      },
      created_at: now,
      updated_at: now
    },
    {
      id: `adm_${madrasaId.substring(0, 8)}_03`,
      madrasa_id: madrasaId,
      application_no: "ADM-2026-0003",
      roll_number: "ET-1003",
      session_name: "১৪৪৭-৪৮ হিজরি (২০২৬-২৭)",
      academic_year: "২০২৬-২৭",
      applicant_name_bn: "মুহাম্মদ সালমান ফারসি",
      applicant_name_en: "Muhammad Salman Farsi",
      date_of_birth: "2012-03-10",
      gender: "MALE",
      blood_group: "A+",
      father_name: "আলহাজ্ব মোস্তফা কামাল",
      father_occupation: "শিক্ষক",
      mother_name: "আমেনা আক্তার",
      guardian_name: "আলহাজ্ব মোস্তফা কামাল",
      guardian_relation: "পিতা",
      guardian_phone: "01912334455",
      present_address: "যাত্রাবাড়ী, ঢাকা",
      permanent_address: "চরফ্যাশন, ভোলা",
      target_class_id: "cls_mizan",
      target_class_name: "মিযান জামাত (কিতাব বিভাগ)",
      residential_status: "আবাসিক",
      previous_institution: "জামিয়া কুরআনিয়া মাদরাসা",
      previous_class_or_para: "নাহবেমীর উত্তীর্ণ",
      status: "MERIT_SELECTED",
      test_evaluation: {
        written_marks: 40,
        oral_marks: 25,
        quran_tilawat_marks: 18,
        total_marks: 83,
        percentage: 83,
        merit_position: 2,
        is_passed: true,
        evaluated_by: "মুফতি জহিরুল ইসলাম",
        evaluated_at: "2026-05-10",
        remarks: "সারফ ও নাহুর ভিত্তি ভালো।"
      },
      exam_schedule: {
        exam_date: "২০২৬-০৫-১৫",
        exam_time: "সকাল ০৯:০০ ঘটিকা",
        venue: "মাদরাসা কেন্দ্রীয় অডিটোরিয়াম",
        room_no: "১০২ (নিচতলা)",
        reporting_time: "সকাল ০৮:৩০ ঘটিকা",
        instructions: DEFAULT_EXAM_INSTRUCTIONS
      },
      created_at: now,
      updated_at: now
    }
  ];
}
