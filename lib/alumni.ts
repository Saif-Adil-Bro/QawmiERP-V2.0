export interface AlumniMember {
  id: string;
  madrasa_id: string;
  name_bn: string;
  name_en?: string;
  graduation_type: "HIFZ_COMPLETION" | "DAWRA_HADITH" | "FAZILAT" | "SANWIYA" | "MUTAWASSITA" | "OTHER";
  graduation_year_hijri?: string; // e.g. "১৪৪৫ হিজরি"
  graduation_year_ce: string; // e.g. "২০২৪"
  student_id?: string; // Link to original student if available
  photo_url?: string;
  phone: string;
  alternative_phone?: string;
  email?: string;
  blood_group?: string;

  // Address
  present_address: string;
  permanent_address: string;
  district?: string;

  // Current Profession / Khedmat
  current_occupation_type: "IMAM_KHATIB" | "MUHADDIS_TEACHER" | "HAFIZ_TEACHER" | "BUSINESS" | "HIGHER_ISLAMIC_STUDIES" | "ABROAD_KHEDMAT" | "OTHER";
  designation_title: string; // e.g. "ইমাম ও খতীব", "মুহাদ্দিস ও শাইখুল হাদিস", "প্রতিষ্ঠাতা পরিচালক"
  institution_or_org: string; // e.g. "বায়তুল আমান জামে মসজিদ, গুলশান", "দারুল উলুম মাদানিয়া মাদরাসা"
  workplace_address?: string;

  // Madrasa Engagement & Support
  is_active_donor: boolean;
  mahfil_invite_preferred: boolean; // বার্ষিক মাহফিলে আমন্ত্রণ তালিকাভুক্ত
  willing_to_mentor: boolean; // বর্তমান শিক্ষার্থীদের দিকনির্দেশনা ও তালিম প্রদানে আগ্রহী
  notes_or_achievements?: string;
  is_archived?: boolean; // আর্কাইভ স্ট্যাটাস

  // Timestamps
  created_at: string;
  updated_at: string;
}

export function getDefaultAlumniSeed(madrasaId: string): AlumniMember[] {
  const now = new Date().toISOString();
  return [
    {
      id: `alm_${madrasaId.substring(0, 6)}_01`,
      madrasa_id: madrasaId,
      name_bn: "মাওলানা মুফতি আব্দুল্লাহ আল-মামুন",
      name_en: "Mufti Abdullah Al Mamun",
      graduation_type: "DAWRA_HADITH",
      graduation_year_hijri: "১৪৪৩ হিজরি",
      graduation_year_ce: "২০২২",
      phone: "01711223344",
      email: "mamun.qawmi@gmail.com",
      blood_group: "O+",
      present_address: "মিরপুর-১, ঢাকা",
      permanent_address: "চর শর্শদী, ফেনী সদর, ফেনী",
      district: "ফেনী",
      current_occupation_type: "IMAM_KHATIB",
      designation_title: "সিনিয়র খতীব ও মুফতি",
      institution_or_org: "বায়তুল মোকাররম কেন্দ্রীয় মডেল জামে মসজিদ, মিরপুর",
      workplace_address: "মিরপুর-১, ঢাকা-১২১৬",
      is_active_donor: true,
      mahfil_invite_preferred: true,
      willing_to_mentor: true,
      notes_or_achievements: "দাওরায়ে হাদিসে কেন্দ্রীয় পরীক্ষায় ১ম বিভাগে মেধা তালিকায় উত্তীর্ণ। প্রতি বছর মাদরাসার মাহফিলে ওয়াজ ও বিশেষ বয়ান করেন।",
      created_at: now,
      updated_at: now,
    },
    {
      id: `alm_${madrasaId.substring(0, 6)}_02`,
      madrasa_id: madrasaId,
      name_bn: "হাফেজ ক্বারী যুবায়ের আহমদ",
      name_en: "Hafiz Qari Zubair Ahmed",
      graduation_type: "HIFZ_COMPLETION",
      graduation_year_hijri: "১৪৪০ হিজরি",
      graduation_year_ce: "২০১৯",
      phone: "01819887766",
      blood_group: "A+",
      present_address: "উত্তরা সেক্টর-৪, ঢাকা",
      permanent_address: "লাকসাম, কুমিল্লা",
      district: "কুমিল্লা",
      current_occupation_type: "HAFIZ_TEACHER",
      designation_title: "প্রধান হিফজ শিক্ষক ও তারাবীহ ইমাম",
      institution_or_org: "দারুল উলুম ইসলামিয়া হিফজ মাদরাসা, উত্তরা",
      workplace_address: "সেক্টর ৪, রোড ৭, উত্তরা, ঢাকা",
      is_active_donor: true,
      mahfil_invite_preferred: true,
      willing_to_mentor: true,
      notes_or_achievements: "আন্তর্জাতিক হিফজুল কুরআন প্রতিযোগিতায় জাতীয় পর্যায়ে রানারআপ। প্রতি রমজানে বিশেষ খতমে তারাবীহ পরিচালনা করেন।",
      created_at: now,
      updated_at: now,
    },
    {
      id: `alm_${madrasaId.substring(0, 6)}_03`,
      madrasa_id: madrasaId,
      name_bn: "মাওলানা তাওহীদুল ইসলাম",
      name_en: "Maulana Tawhidul Islam",
      graduation_type: "DAWRA_HADITH",
      graduation_year_hijri: "১৪৪৫ হিজরি",
      graduation_year_ce: "২০২৪",
      phone: "01923456789",
      blood_group: "B+",
      present_address: "যাত্রাবাড়ী, ঢাকা",
      permanent_address: "গফরগাঁও, ময়মনসিংহ",
      district: "ময়মনসিংহ",
      current_occupation_type: "MUHADDIS_TEACHER",
      designation_title: "উস্তাদুল হাদিস ও আরবি প্রভাষক",
      institution_or_org: "জামিয়া কুরআনিয়া আরাবিয়া, যাত্রাবাড়ী",
      workplace_address: "যাত্রাবাড়ী মোড়, ঢাকা",
      is_active_donor: false,
      mahfil_invite_preferred: true,
      willing_to_mentor: true,
      notes_or_achievements: "আরবি ভাষা ও সাহিত্যে উচ্চতর ডিপ্লোমা সমাপ্তকারী।",
      created_at: now,
      updated_at: now,
    }
  ];
}
