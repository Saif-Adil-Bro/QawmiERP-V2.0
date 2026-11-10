/**
 * Tarbiyah, Akhlaq & Sunnah Badges for Islamic Kids Education
 * Gamified reward system to encourage Sunnah habits and moral excellence
 */

export interface TarbiyahBadge {
  id: string;
  name: string;
  category: "SUNNAH" | "AKHLAQ" | "TALIM" | "CLEANLINESS";
  icon: string;
  description: string;
  starPoints: number;
}

export const TARBIYAH_BADGES: TarbiyahBadge[] = [
  {
    id: "salam_star",
    name: "সালামের অগ্রদূত স্টার",
    category: "SUNNAH",
    icon: "🤝",
    description: "আগে সালাম দেওয়া ও হাসিমুখে মুসাফাহার সুন্নাত পালনের জন্য।",
    starPoints: 10,
  },
  {
    id: "bismillah_eating",
    name: "খাওয়ার আদব ও বিসমিল্লাহ স্টার",
    category: "SUNNAH",
    icon: "🍽️",
    description: "ডান হাতে খাওয়া, বিসমিল্লাহ বলা ও খাওয়ার শেষে আলহামদুলিল্লাহ পড়ার জন্য।",
    starPoints: 10,
  },
  {
    id: "taharah_wudu",
    name: "পবিত্রতা ও সুন্দর অজু ব্যাজ",
    category: "CLEANLINESS",
    icon: "💧",
    description: "পরিচ্ছন্ন পোশাক ও নিয়ম মেনে সুন্দর অজু সম্পাদনের জন্য।",
    starPoints: 15,
  },
  {
    id: "truth_honesty",
    name: "সত্যবাদিতা ও সততা মেডেল",
    category: "AKHLAQ",
    icon: "💎",
    description: "সবসময় সত্য কথা বলা ও ইনসাফপূর্ণ আচরণের জন্য।",
    starPoints: 20,
  },
  {
    id: "respect_elders",
    name: "উস্তাদ ও সহপাঠী সম্মাননা",
    category: "AKHLAQ",
    icon: "🌸",
    description: "উস্তাদদের সম্মান ও সহপাঠীদের সাথে সৌহার্দ্যপূর্ণ আচরণের জন্য।",
    starPoints: 15,
  },
  {
    id: "quran_lover",
    name: "কুরআন ও দোআ অনুরাগী স্টার",
    category: "TALIM",
    icon: "📖",
    description: "কুরআন তিলাওয়াত ও মাসনুন দোআ আগ্রহ নিয়ে মুখস্থের জন্য।",
    starPoints: 20,
  },
  {
    id: "mosque_adab",
    name: "মসজিদ ও নামাজের আদব ব্যাজ",
    category: "SUNNAH",
    icon: "🕌",
    description: "মসজিদের নীরবতা ও জামাতে শান্ত ও সুন্দর অবস্থানের জন্য।",
    starPoints: 15,
  },
];

export interface StudentBadgeAward {
  id: string;
  studentId: string;
  studentName: string;
  className: string;
  badgeId: string;
  badgeName: string;
  badgeIcon: string;
  starPoints: number;
  awardedDate: string; // YYYY-MM-DD
  teacherName: string;
  notes?: string;
}
