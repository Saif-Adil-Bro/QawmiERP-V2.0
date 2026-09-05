export interface AcademicHoliday {
  id: string;
  title: string;
  category: "exam_vacation" | "eid_vacation" | "ramadan" | "religious" | "national" | "general" | "emergency";
  start_date: string;
  end_date: string;
  total_days: number;
  reopen_date?: string;
  applicable_to?: string; // "all" | "hifz" | "kitab" | "nurani" | "najera"
  applicable_classes?: string[];
  description?: string;
  notice_number?: string;
  publish_to_portal?: boolean;
  created_at: string;
  updated_at?: string;
  created_by?: string;
  is_archived?: boolean;
}

export const HOLIDAY_CATEGORIES = {
  exam_vacation: { label: "পরীক্ষার ছুটি", color: "bg-purple-100 text-purple-800 border-purple-200" },
  eid_vacation: { label: "ঈদের ছুটি", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  ramadan: { label: "রমজানের অবকাশ", color: "bg-amber-100 text-amber-800 border-amber-200" },
  religious: { label: "ধর্মীয় ও বিশেষ ছুটি", color: "bg-teal-100 text-teal-800 border-teal-200" },
  national: { label: "জাতীয় দিবস", color: "bg-rose-100 text-rose-800 border-rose-200" },
  general: { label: "সাধারণ ছুটি", color: "bg-blue-100 text-blue-800 border-blue-200" },
  emergency: { label: "জরুরি / দুর্যোগকালীন বন্ধ", color: "bg-red-100 text-red-800 border-red-200" },
} as const;
