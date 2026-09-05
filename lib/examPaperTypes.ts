export interface ExamPaperSection {
  id: string;
  name: string;
  instruction: string;
  targetMarks: number;
  questions: any[];
}

export interface ExamPaperPayload {
  is_sectioned: boolean;
  numbering_scheme: "continuous" | "per_section";
  sections: ExamPaperSection[];
  questions?: any[];
}

export const INSTRUCTION_PRESETS = [
  "যেকোনো ৫টি প্রশ্নের উত্তর দাও।",
  "১ নং প্রশ্নসহ যেকোনো ৪টি প্রশ্নের উত্তর দাও।",
  "১ নং প্রশ্ন বাধ্যতামূলক এবং অবশিষ্ট থেকে যেকোনো ৪টি লিখ।",
  "যেকোনো ৩টি প্রশ্নের উত্তর দাও (১০ × ৩ = ৩০)।",
  "সকল প্রশ্নের উত্তর দেওয়া আবশ্যক। ডান পাশের সংখ্যা পূর্ণমান জ্ঞাপক।",
  "যেকোনো ৮টি প্রশ্নের সংক্ষিপ্ত উত্তর দাও।",
  "সঠিক উত্তরের পাশে টিক (✓) চিহ্ন দাও।",
  "أجب عن خمسة أسئلة فقط.",
  "أجب عن أربعة أسئلة مع السؤال الأول إجبارياً.",
  "أجب عن جميع الأسئلة الآتية.",
  "أجب عن ثلاثة أسئلة من الآتي."
];

export const DEFAULT_SECTION_PRESETS = {
  bengali_two: [
    {
      id: "sec-1",
      name: "ক-বিভাগ: কুরআন ও হাদিস",
      instruction: "যেকোনো ৫টি প্রশ্নের উত্তর দাও",
      targetMarks: 50,
      questions: []
    },
    {
      id: "sec-2",
      name: "খ-বিভাগ: ফিকহ ও ফতোয়া",
      instruction: "১ নং প্রশ্নসহ যেকোনো ৪টি প্রশ্নের উত্তর দাও",
      targetMarks: 50,
      questions: []
    }
  ],
  arabic_two: [
    {
      id: "sec-1",
      name: "القسم الأول: التفسير والحديث",
      instruction: "أجب عن خمسة أسئلة فقط",
      targetMarks: 50,
      questions: []
    },
    {
      id: "sec-2",
      name: "القسم الثاني: الفقه وأصوله",
      instruction: "أجب عن أربعة أسئلة مع السؤال الأول إجبارياً",
      targetMarks: 50,
      questions: []
    }
  ],
  bengali_three: [
    {
      id: "sec-1",
      name: "ক-বিভাগ (রচনামূলক প্রশ্ন)",
      instruction: "যেকোনো ৪টি প্রশ্নের উত্তর দাও",
      targetMarks: 40,
      questions: []
    },
    {
      id: "sec-2",
      name: "খ-বিভাগ (সংক্ষিপ্ত প্রশ্ন)",
      instruction: "যেকোনো ৮টি প্রশ্নের উত্তর দাও",
      targetMarks: 40,
      questions: []
    },
    {
      id: "sec-3",
      name: "গ-বিভাগ (বহুনির্বাচনী / নৈর্ব্যক্তিক)",
      instruction: "সকল প্রশ্নের উত্তর দেওয়া আবশ্যক",
      targetMarks: 20,
      questions: []
    }
  ]
};
