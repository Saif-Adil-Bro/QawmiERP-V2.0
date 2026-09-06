import { ExamPaperSection } from "./examPaperTypes";

export type BlueprintCategoryType = 
  | "broad"           // রচনামূলক প্রশ্ন
  | "short"           // সংক্ষিপ্ত প্রশ্ন
  | "irab_tahqeeq"    // এরাব ও তাহকীক (إعراب وتحقيق)
  | "translation"     // অনুবাদ ও তাশরীহ (ترجمة وتوضيح)
  | "masala"          // ফিকহি মাসআলা (مسألة فقهية)
  | "sher"            // নযম ও শের (شعر وتوضيح)
  | "mcq"             // বহুনির্বাচনী
  | "any";            // যেকোনো প্রশ্ন

export interface BlueprintCategoryItem {
  id: string;
  category: BlueprintCategoryType;
  label: string;
  count: number;               // কয়টি প্রশ্ন নির্বাচন করবে
  marksPerQuestion: number;    // প্রতিটির আনুমানিক মান
  totalMarks: number;          // মোট নম্বর (count * marksPerQuestion)
  sectionKey?: string;         // 'sec-1' | 'sec-2' ইত্যাদি অথবা স্বয়ংক্রিয়
  sectionName?: string;        // যেমন: 'ক-বিভাগ: রচনামূলক'
  instruction?: string;        // যেমন: 'যেকোনো ৪টি প্রশ্নের উত্তর দাও'
}

export interface AutoPaperBlueprint {
  id: string;
  name: string;
  description: string;
  totalMarks: number;
  time: string;
  paperInstructions: string;
  items: BlueprintCategoryItem[];
  isSectioned: boolean;
}

export const CATEGORY_LABELS: Record<BlueprintCategoryType, { name: string; badge: string; color: string }> = {
  broad: { name: "রচনামূলক প্রশ্ন (Broad)", badge: "রচনামূলক", color: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  short: { name: "সংক্ষিপ্ত প্রশ্ন (Short)", badge: "সংক্ষিপ্ত", color: "bg-slate-100 text-slate-800 border-slate-300" },
  irab_tahqeeq: { name: "এরাব ও তাহকীক (إعراب وتحقيق)", badge: "এরাব/তাহকীক", color: "bg-amber-100 text-amber-800 border-amber-300" },
  translation: { name: "অনুবাদ ও তরজমা (ترجمة)", badge: "অনুবাদ", color: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  masala: { name: "ফিকহি মাসআলা (مسألة فقهية)", badge: "মাসআলা", color: "bg-teal-100 text-teal-800 border-teal-300" },
  sher: { name: "নযম ও শের (شعر وتوضيح)", badge: "শের ও নযম", color: "bg-purple-100 text-purple-800 border-purple-300" },
  mcq: { name: "বহুনির্বাচনী (MCQ)", badge: "MCQ", color: "bg-cyan-100 text-cyan-800 border-cyan-300" },
  any: { name: "যেকোনো সাধারণ প্রশ্ন", badge: "সাধারণ", color: "bg-gray-100 text-gray-800 border-gray-300" },
};

export const BUILT_IN_BLUEPRINTS: AutoPaperBlueprint[] = [
  {
    id: "standard_qawmi_100",
    name: "কওমি বেফাক স্ট্যান্ডার্ড (১০০ নম্বর)",
    description: "রচনামূলক ৪টি (৪০), সংক্ষিপ্ত ৫টি (২৫), এরাব ও তাহকীক ২টি (১৫), অনুবাদ ২টি (২০)",
    totalMarks: 100,
    time: "৩ ঘণ্টা",
    paperInstructions: "সকল প্রশ্নের উত্তর দেওয়া আবশ্যক। ডান পাশের সংখ্যা পূর্ণমান জ্ঞাপক।",
    isSectioned: true,
    items: [
      {
        id: "item-1",
        category: "broad",
        label: "রচনামূলক প্রশ্ন",
        count: 4,
        marksPerQuestion: 10,
        totalMarks: 40,
        sectionName: "ক-বিভাগ: রচনামূলক প্রশ্ন",
        instruction: "যেকোনো ৪টি প্রশ্নের উত্তর দাও। (১০ × ৪ = ৪০)",
      },
      {
        id: "item-2",
        category: "short",
        label: "সংক্ষিপ্ত প্রশ্ন",
        count: 5,
        marksPerQuestion: 5,
        totalMarks: 25,
        sectionName: "খ-বিভাগ: সংক্ষিপ্ত প্রশ্ন",
        instruction: "যেকোনো ৫টি প্রশ্নের সংক্ষিপ্ত উত্তর দাও। (৫ × ৫ = ২৫)",
      },
      {
        id: "item-3",
        category: "irab_tahqeeq",
        label: "এরাব ও তাহকীক",
        count: 2,
        marksPerQuestion: 7.5,
        totalMarks: 15,
        sectionName: "গ-বিভাগ: এরাব ও তাহকীক",
        instruction: "প্রদত্ত ইবারত ও শব্দসমূহের এরাব ও তাহকীক কর।",
      },
      {
        id: "item-4",
        category: "translation",
        label: "অনুবাদ ও তরজমা",
        count: 2,
        marksPerQuestion: 10,
        totalMarks: 20,
        sectionName: "ঘ-বিভাগ: তরজমা ও ব্যাখ্যা",
        instruction: "নিম্নোক্ত নসসমূহের প্রাঞ্জল বঙ্গানুবাদ ও ব্যাখ্যা লেখ। (১০ × ২ = ২০)",
      },
    ],
  },
  {
    id: "quran_hadith_100",
    name: "কুরআন ও হাদিস স্পেশাল (১০০ নম্বর)",
    description: "অনুবাদ ও ব্যাখ্যা ৩টি (৩০), তাহকীক ও এরাব ২টি (২০), হাদিসের মূল বক্তব্য ও মাসায়েল ৩টি (৩০), সংক্ষিপ্ত ৪টি (২০)",
    totalMarks: 100,
    time: "৩ ঘণ্টা",
    paperInstructions: "১ নং প্রশ্ন বাধ্যতামূলক। ডান পাশের সংখ্যা প্রশ্নের মান নির্দেশ করে।",
    isSectioned: true,
    items: [
      {
        id: "qh-1",
        category: "translation",
        label: "অনুবাদ ও তাশরীহ",
        count: 3,
        marksPerQuestion: 10,
        totalMarks: 30,
        sectionName: "ক-বিভাগ: অনুবাদ ও তাশরীহ",
        instruction: "যেকোনো ৩টি আয়াতাংশ/হাদিসের সরল ও প্রাঞ্জল বঙ্গানুবাদ কর।",
      },
      {
        id: "qh-2",
        category: "irab_tahqeeq",
        label: "তাহকীক ও তারকীব",
        count: 2,
        marksPerQuestion: 10,
        totalMarks: 20,
        sectionName: "খ-বিভাগ: তাহকীক ও তারকীব",
        instruction: "চিহ্নিত শব্দাবলীর ছরফী তাহকীক ও নহবী তারকীব কর।",
      },
      {
        id: "qh-3",
        category: "broad",
        label: "হাদিসের ব্যাখ্যা ও শিক্ষা",
        count: 3,
        marksPerQuestion: 10,
        totalMarks: 30,
        sectionName: "গ-বিভাগ: হাদিসের শিক্ষা ও মাসায়েল",
        instruction: "হাদিসের পটভূমি ও ফিকহি শিক্ষা বিস্তারিত বর্ণনা কর।",
      },
      {
        id: "qh-4",
        category: "short",
        label: "সংক্ষিপ্ত প্রশ্ন ও রাবি পরিচিতি",
        count: 4,
        marksPerQuestion: 5,
        totalMarks: 20,
        sectionName: "ঘ-বিভাগ: সংক্ষিপ্ত প্রশ্নোত্তর",
        instruction: "সংক্ষেপে উত্তর দাও।",
      },
    ],
  },
  {
    id: "nahw_sarf_100",
    name: "নাহু-ছরফ ও আরবি ব্যাকরণ (১০০ নম্বর)",
    description: "এরাবুল ইবারাহ ২টি (২০), ছরফ ও তাহকীক ৪টি (২০), কাওয়ায়েদ ও মূলনীতি ৪টি (৪০), সংক্ষিপ্ত ও সংজ্ঞা ৪টি (২০)",
    totalMarks: 100,
    time: "৩ ঘণ্টা",
    paperInstructions: "ইবারত সহ স্পষ্ট ও সুন্দর হস্তাক্ষরে উত্তর লিখবে।",
    isSectioned: true,
    items: [
      {
        id: "ns-1",
        category: "irab_tahqeeq",
        label: "ইবারত ও এরাব প্রদান",
        count: 2,
        marksPerQuestion: 10,
        totalMarks: 20,
        sectionName: "القسم الأول: إعراب العبارة",
        instruction: "أعرب ما تحته خط مع الضبط التام بالشكل.",
      },
      {
        id: "ns-2",
        category: "irab_tahqeeq",
        label: "তাহকীক ও সীগাহ বিশ্লেষণ",
        count: 4,
        marksPerQuestion: 5,
        totalMarks: 20,
        sectionName: "القسم الثاني: تحقيق الكلمات والصرف",
        instruction: "حقق الكلمات الآتية ببيان الصيغة والباب والمادة.",
      },
      {
        id: "ns-3",
        category: "broad",
        label: "নাহবী ও ছরফি কাওয়ায়েদ",
        count: 4,
        marksPerQuestion: 10,
        totalMarks: 40,
        sectionName: "القسم الثالث: القواعد النحوية والصرفية",
        instruction: "مثّل لما يأتي واشرح القاعدة بالتفصيل.",
      },
      {
        id: "ns-4",
        category: "short",
        label: "সংক্ষিপ্ত প্রশ্নোত্তর ও সংজ্ঞা",
        count: 4,
        marksPerQuestion: 5,
        totalMarks: 20,
        sectionName: "القسم الرابع: أسئلة موجزة",
        instruction: "عرف المصطلحات الآتية بإيجاز.",
      },
    ],
  },
  {
    id: "fiqh_fatwa_100",
    name: "ফিকহ ও ফতোয়া (১০০ নম্বর)",
    description: "ফিকহি সুরতহাল ও মাসআলা ৪টি (৪০), ইবারত হল ও দলিল ৩টি (৩০), সংক্ষিপ্ত প্রশ্ন ও পরিভাষা ৬টি (৩০)",
    totalMarks: 100,
    time: "৩ ঘণ্টা",
    paperInstructions: "প্রত্যেকটি মাসআলার ক্ষেত্রে মুতামাদ কিতাবের হাওয়ালা ও দলিল উল্লেখ করা বাঞ্ছনীয়।",
    isSectioned: true,
    items: [
      {
        id: "ff-1",
        category: "masala",
        label: "সুরতহাল ও ফিকহি সমাধান",
        count: 4,
        marksPerQuestion: 10,
        totalMarks: 40,
        sectionName: "ক-বিভাগ: বাস্তব সুরতহাল ও মাসআলা",
        instruction: "নিম্নোক্ত সুরতহালের ফিকহি সমাধান ও করণীয় দলিলসহ লেখ।",
      },
      {
        id: "ff-2",
        category: "broad",
        label: "ইবারত হল ও দলিলের পর্যালোচনা",
        count: 3,
        marksPerQuestion: 10,
        totalMarks: 30,
        sectionName: "খ-বিভাগ: মূল কিতাবের ইবারত ও দলীল",
        instruction: "ইবারতের অর্থ স্পষ্ট কর এবং ইমামগণের ইখতিলাফ ও দলীল পেশ কর।",
      },
      {
        id: "ff-3",
        category: "short",
        label: "ফিকহি পরিভাষা ও সংক্ষিপ্ত প্রশ্ন",
        count: 6,
        marksPerQuestion: 5,
        totalMarks: 30,
        sectionName: "গ-বিভাগ: পরিভাষা ও সংক্ষিপ্ত প্রশ্ন",
        instruction: "যেকোনো ৬টি প্রশ্নের স্পষ্ট সংক্ষিপ্ত উত্তর দাও।",
      },
    ],
  },
  {
    id: "half_yearly_50",
    name: "সাময়িক / অর্ধ-বার্ষিক পরীক্ষা (৫০ নম্বর)",
    description: "রচনামূলক ২টি (২০), সংক্ষিপ্ত ৩টি (১৫), এরাব ও তাহকীক ১টি (৮), অনুবাদ ১টি (৭)",
    totalMarks: 50,
    time: "১ ঘণ্টা ৪৫ মিনিট",
    paperInstructions: "সকল প্রশ্নের উত্তর দেওয়া আবশ্যক। ডান পাশের সংখ্যা মান জ্ঞাপক।",
    isSectioned: true,
    items: [
      {
        id: "hy-1",
        category: "broad",
        label: "রচনামূলক প্রশ্ন",
        count: 2,
        marksPerQuestion: 10,
        totalMarks: 20,
        sectionName: "ক-বিভাগ: রচনামূলক প্রশ্ন",
        instruction: "যেকোনো ২টি প্রশ্নের উত্তর দাও। (১০ × ২ = ২০)",
      },
      {
        id: "hy-2",
        category: "short",
        label: "সংক্ষিপ্ত প্রশ্ন",
        count: 3,
        marksPerQuestion: 5,
        totalMarks: 15,
        sectionName: "খ-বিভাগ: সংক্ষিপ্ত প্রশ্ন",
        instruction: "যেকোনো ৩টি প্রশ্নের সংক্ষিপ্ত উত্তর দাও। (৫ × ৩ = ১৫)",
      },
      {
        id: "hy-3",
        category: "irab_tahqeeq",
        label: "এরাব ও তাহকীক",
        count: 1,
        marksPerQuestion: 8,
        totalMarks: 8,
        sectionName: "গ-বিভাগ: এরাব ও তাহকীক",
        instruction: "প্রদত্ত বাক্যের এরাব ও তাহকীক কর।",
      },
      {
        id: "hy-4",
        category: "translation",
        label: "অনুবাদ ও ব্যাখ্যা",
        count: 1,
        marksPerQuestion: 7,
        totalMarks: 7,
        sectionName: "ঘ-বিভাগ: বঙ্গানুবাদ",
        instruction: "নিম্নোক্ত নসের প্রাঞ্জল বঙ্গানুবাদ কর।",
      },
    ],
  },
];

/**
 * Intelligent Question Categorizer
 * Detects whether a question matches a requested category based on:
 * - question_type
 * - options (irab_text, tahqeeq_words, scenario, verses, etc.)
 * - marks
 * - question_text contents
 */
export function questionMatchesCategory(q: any, category: BlueprintCategoryType): boolean {
  if (category === "any") return true;

  const type = (q.question_type || "").toLowerCase();
  const text = (q.question_text || "").toLowerCase();
  const opts = q.options || {};

  switch (category) {
    case "irab_tahqeeq":
      if (
        type.includes("irab") || 
        type.includes("tahqeeq") || 
        type.includes("إعراب") || 
        type.includes("تحقيق") ||
        opts.irab_text ||
        (opts.tahqeeq_words && opts.tahqeeq_words.length > 0) ||
        text.includes("এরাব") || 
        text.includes("তাহকীক") || 
        text.includes("إعراب") || 
        text.includes("তারকীব") ||
        text.includes("حقق") ||
        text.includes("صيغة")
      ) {
        return true;
      }
      return false;

    case "translation":
      if (
        text.includes("অনুবাদ") ||
        text.includes("তরজমা") ||
        text.includes("বঙ্গানুবাদ") ||
        text.includes("অর্থ লেখ") ||
        text.includes("ترجم") ||
        text.includes("الترجمة") ||
        text.includes("তাশরীহ")
      ) {
        return true;
      }
      return false;

    case "masala":
      if (
        type.includes("masala") || 
        type.includes("مسألة") || 
        opts.scenario || 
        text.includes("মাসআলা") || 
        text.includes("সুরতহাল") || 
        text.includes("ফিকহ") ||
        text.includes("مسألة")
      ) {
        return true;
      }
      return false;

    case "sher":
      if (
        type.includes("sher") || 
        type.includes("شعر") || 
        (opts.verses && opts.verses.length > 0) || 
        text.includes("শের") || 
        text.includes("নযম") || 
        text.includes("شعر") ||
        text.includes("بيت")
      ) {
        return true;
      }
      return false;

    case "mcq":
      if (type === "mcq" || (Array.isArray(opts.mcq_options) && opts.mcq_options.length > 0)) {
        return true;
      }
      return false;

    case "short":
      if (
        type.includes("short") || 
        (q.marks && q.marks <= 5 && !type.includes("mcq")) ||
        text.includes("সংক্ষেপে") || 
        text.includes("সংজ্ঞা") || 
        text.includes("কাকে বলে") || 
        text.includes("কয়টি") ||
        text.includes("কয় প্রকার") ||
        text.includes("عرف")
      ) {
        return true;
      }
      return false;

    case "broad":
    default:
      if (
        type.includes("broad") || 
        (q.marks && q.marks >= 8) ||
        text.includes("রচনামূলক") || 
        text.includes("বিস্তারিত") || 
        text.includes("আলোচনা কর") || 
        text.includes("ব্যাখ্যা কর") ||
        text.includes("اشرح")
      ) {
        return true;
      }
      return false;
  }
}

/**
 * Shuffles an array with Fisher-Yates algorithm
 */
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export interface AutoGenerationResult {
  success: boolean;
  sections: ExamPaperSection[];
  flatQuestions: any[];
  totalQuestions: number;
  totalMarks: number;
  warnings: string[];
}

/**
 * 1-Click Auto Paper Generation Algorithm
 * Balances question types, marks, sections, and selects questions with zero overlap
 */
export function generatePaperFromBlueprint(
  blueprint: AutoPaperBlueprint,
  availableQuestions: any[]
): AutoGenerationResult {
  const warnings: string[] = [];
  const usedQuestionIds = new Set<string>();

  // If sectioned, group items by their section target
  const sectionMap = new Map<string, {
    name: string;
    instruction: string;
    targetMarks: number;
    items: BlueprintCategoryItem[];
    questions: any[];
  }>();

  if (blueprint.isSectioned) {
    blueprint.items.forEach((item, idx) => {
      const secKey = item.sectionName || `বিভাগ ${idx + 1}`;
      if (!sectionMap.has(secKey)) {
        sectionMap.set(secKey, {
          name: item.sectionName || `বিভাগ ${idx + 1}`,
          instruction: item.instruction || "সকল প্রশ্নের উত্তর দাও।",
          targetMarks: 0,
          items: [],
          questions: [],
        });
      }
      const sec = sectionMap.get(secKey)!;
      sec.items.push(item);
      sec.targetMarks += item.totalMarks;
      if (item.instruction && (!sec.instruction || sec.instruction === "সকল প্রশ্নের উত্তর দাও।")) {
        sec.instruction = item.instruction;
      }
    });
  }

  const generatedSections: ExamPaperSection[] = [];
  const allPickedQuestions: any[] = [];

  // Shuffle available pool for randomized variety
  const shuffledAvailable = shuffleArray(availableQuestions);

  // Helper to pick candidates
  const pickForCategory = (category: BlueprintCategoryType, count: number): any[] => {
    const matched = shuffledAvailable.filter(
      q => !usedQuestionIds.has(q.id) && questionMatchesCategory(q, category)
    );

    const picked: any[] = [];
    for (let i = 0; i < Math.min(count, matched.length); i++) {
      picked.push(matched[i]);
      usedQuestionIds.add(matched[i].id);
    }

    // Fallback: If not enough exact matches, pick closest available unused questions
    if (picked.length < count) {
      const remainingUnused = shuffledAvailable.filter(q => !usedQuestionIds.has(q.id));
      const needed = count - picked.length;
      for (let i = 0; i < Math.min(needed, remainingUnused.length); i++) {
        picked.push(remainingUnused[i]);
        usedQuestionIds.add(remainingUnused[i].id);
      }

      if (picked.length < count) {
        const catName = CATEGORY_LABELS[category]?.name || category;
        warnings.push(`"${catName}"-এর জন্য প্রশ্নব্যাংকে প্রয়োজনীয় সংখ্যক (${count}টি) প্রশ্ন পাওয়া যায়নি। বর্তমানে ${picked.length}টি যুক্ত হয়েছে।`);
      }
    }

    return picked;
  };

  if (blueprint.isSectioned && sectionMap.size > 0) {
    let sIdx = 1;
    sectionMap.forEach((secData, secKey) => {
      const secQuestions: any[] = [];
      secData.items.forEach(item => {
        const picked = pickForCategory(item.category, item.count);
        secQuestions.push(...picked);
      });

      generatedSections.push({
        id: `sec-${sIdx++}-${Date.now()}`,
        name: secData.name,
        instruction: secData.instruction,
        targetMarks: secData.targetMarks,
        questions: secQuestions,
      });
      allPickedQuestions.push(...secQuestions);
    });
  } else {
    // Unsectioned mode
    blueprint.items.forEach(item => {
      const picked = pickForCategory(item.category, item.count);
      allPickedQuestions.push(...picked);
    });
  }

  const calculatedTotalMarks = allPickedQuestions.reduce(
    (sum, q) => sum + (q.marks || 0), 0
  );

  return {
    success: allPickedQuestions.length > 0,
    sections: generatedSections,
    flatQuestions: allPickedQuestions,
    totalQuestions: allPickedQuestions.length,
    totalMarks: calculatedTotalMarks,
    warnings,
  };
}

/**
 * Finds alternative replacement questions from the bank for question swapping
 * Sorts candidates: same type + close marks first, followed by others
 */
export function findAlternativeQuestions(
  currentQuestion: any,
  availableQuestions: any[],
  currentlyUsedIds: Set<string>
): Array<{ question: any; matchScore: number; matchReason: string }> {
  const currentId = currentQuestion?.id;
  const currentType = (currentQuestion?.question_type || "").toLowerCase();
  const currentMarks = currentQuestion?.marks || 0;

  const unused = availableQuestions.filter(
    q => q.id !== currentId && !currentlyUsedIds.has(q.id)
  );

  return unused.map(q => {
    let score = 0;
    const reasons: string[] = [];

    const qType = (q.question_type || "").toLowerCase();
    const qMarks = q.marks || 0;

    // Type match
    if (qType === currentType) {
      score += 50;
      reasons.push("একই ধরণের প্রশ্ন");
    } else if (
      (qType.includes("irab") || qType.includes("tahqeeq")) &&
      (currentType.includes("irab") || currentType.includes("tahqeeq"))
    ) {
      score += 40;
      reasons.push("সমগোত্রীয় এরাব/তাহকীক");
    }

    // Marks match
    if (qMarks === currentMarks) {
      score += 30;
      reasons.push(`সমান নম্বর (${qMarks})`);
    } else if (Math.abs(qMarks - currentMarks) <= 2) {
      score += 15;
      reasons.push(`কাছাকাছি নম্বর (${qMarks})`);
    }

    return {
      question: q,
      matchScore: score,
      matchReason: reasons.join(" • ") || "অন্যান্য প্রশ্ন",
    };
  }).sort((a, b) => b.matchScore - a.matchScore);
}
