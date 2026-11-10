/**
 * Child Safety, Authorized Pick-up & Kids Health Profile Data Models
 * Designed specifically for Islamic Kids Institutions, Kindergartens & Noorani Maktabs
 */

export interface AuthorizedPickupPerson {
  id: string;
  name: string;
  relation: string; // "পিতা" | "মাতা" | "মামা" | "চাচা" | "ড্রাইভার" | "গৃহকর্মী" | "অন্যান্য"
  phone: string;
  nidOrId?: string;
  photoUrl?: string;
  isPrimaryEmergency?: boolean;
  notes?: string;
}

export interface KidsHealthProfile {
  bloodGroup?: string;
  foodAllergies: string[]; // e.g. "ডিম (Eggs)", "বাদাম (Peanuts)", "দুধ (Milk)", "চিংড়ি (Shrimp)"
  regularMedications?: string; // e.g. "অ্যাজমা ইনহেলার, অ্যান্টিহিস্টামিন ড্রপ"
  chronicConditions: string[]; // e.g. "শ্বাসকষ্ট / অ্যাজমা", "ধূলাবালির অ্যালার্জি", "ঠান্ডাজনিত সমস্যা"
  emergencyDoctorPhone?: string;
  dietaryRestrictions?: string; // e.g. "অতিরিক্ত মিষ্টি নিষেধ"
  lastUpdated?: string;
}

export interface StudentGatePassRecord {
  id: string;
  studentId: string;
  studentName: string;
  studentRoll?: string;
  className: string;
  date: string; // YYYY-MM-DD
  passCode: string; // e.g. "GP-7429"
  pickupPersonName: string;
  pickupPersonRelation: string;
  pickupPersonPhone: string;
  pickupPersonPhoto?: string;
  status: "WAITING" | "PICKED_UP" | "CANCELLED";
  pickedUpAt?: string;
  verifiedByTeacher?: string;
  notes?: string;
}

export const COMMON_FOOD_ALLERGIES = [
  "ডিম (Eggs)",
  "চিনাবাদাম ও বাদাম (Peanuts/Nuts)",
  "দুধ ও ডেইরি (Milk / Dairy)",
  "চিংড়ি ও সামুদ্রিক খাবার (Shrimp)",
  "গ্লুটেন বা আটা (Gluten)",
  "সয়া বা সয়াবিন (Soy)",
  "নির্দিষ্ট কৃত্রিম রং বা ফ্লেভার",
];

export const COMMON_CHILD_CONDITIONS = [
  "শ্বাসকষ্ট / অ্যাজমা (Asthma)",
  "ধূলাবালি বা ঋতুজনিত অ্যালার্জি (Dust Allergy)",
  "ফেব্রাইল সিজার / জ্বরে খিঁচুনি (Febrile Seizure)",
  "চর্ম অ্যালার্জি বা র‍্যাশ (Skin Rash / Eczema)",
  "ঠান্ডা লাগার দ্রুত প্রবণতা",
];
