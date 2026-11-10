export type AssignmentType =
  | "TODAY_LESSON"     // আজকের পড়া
  | "TOMORROW_LESSON"  // আগামীকালের পড়া
  | "HOMEWORK"         // হোমওয়ার্ক
  | "MEMORIZATION"     // হিফজ / সবক / মুখস্থ
  | "EXAM_REVISION"    // পরীক্ষার রিভিশন
  | "KIDS_DIARY"       // ছোটদের দৈনিক ডায়েরি ও কেয়ার
  | "OTHER";           // অন্যান্য

export type AssignmentTargetType = "CLASS" | "STUDENT";

export interface KidsCareDetails {
  meal_status?: "FULL" | "PARTIAL" | "MINIMAL" | "SKIPPED";
  nap_status?: "SLEPT_WELL" | "RESTLESS" | "NO_NAP";
  mood_status?: "HAPPY" | "CALM" | "CRYING" | "PLAYFUL";
  hygiene_notes?: string;
  handwriting_rating?: "EXCELLENT" | "GOOD" | "NEEDS_PRACTICE";
  quran_qaida_page?: string;
  teacher_remarks?: string;
}

export interface AssignmentItem {
  id: string;
  madrasa_id: string;
  title: string;
  type: AssignmentType;
  type_bangla: string;
  target_type: AssignmentTargetType;
  class_id: string;
  class_name: string;
  student_id?: string | null;
  student_name?: string | null;
  student_roll?: string | null;
  subject_name?: string;
  description: string;
  image_urls: string[];
  assigned_date: string; // YYYY-MM-DD
  due_date?: string | null; // YYYY-MM-DD
  teacher_id?: string | null;
  teacher_name: string;
  created_by_role: "ADMIN" | "TEACHER" | "SUPER_ADMIN";
  created_at: string;
  updated_at?: string;
  status: "ACTIVE" | "COMPLETED" | "ARCHIVED";
  syllabus_id?: string | null;
  syllabus_book_name?: string | null;
  syllabus_topic_id?: string | null;
  syllabus_topic_ids?: string[] | null;
  is_syllabus_synced?: boolean;
  page_from?: string | null;
  page_to?: string | null;
  kids_care?: KidsCareDetails;
}

export const ASSIGNMENT_TYPE_MAP: Record<AssignmentType, string> = {
  TODAY_LESSON: "আজকের পড়া",
  TOMORROW_LESSON: "আগামীকালের পড়া",
  HOMEWORK: "হোমওয়ার্ক",
  MEMORIZATION: "হিফজ সবক ও মুখস্থ",
  EXAM_REVISION: "পরীক্ষার প্রস্তুতি ও রিভিশন",
  KIDS_DIARY: "ছোটদের দৈনিক ডায়েরি ও কেয়ার",
  OTHER: "সাধারণ অ্যাসাইনমেন্ট",
};
