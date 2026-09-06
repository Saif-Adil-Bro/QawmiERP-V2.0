"use client";

import { useState, useEffect, useMemo } from "react";
import { getExamPaper, saveExamPaper, seedSampleQuestionsForSubject, saveQuestion } from "@/app/actions/questions";
import { 
  Plus, Trash2, Printer, Loader2, Save, FileSignature, CheckCircle2, 
  BookOpen, ArrowUp, ArrowDown, Layers, Sparkles, Check, 
  Image as ImageIcon, Upload, FileText, Settings2, Eye, LayoutTemplate,
  Columns, Palette, RotateCw, ArrowLeftRight, Sliders, AlertCircle, AlertTriangle,
  History, Copy
} from "lucide-react";
import SpecializedQuestionView, { getQuestionTypeBadge } from "@/components/exams/SpecializedQuestionView";
import AutoPaperBlueprintModal from "@/components/exams/AutoPaperBlueprintModal";
import QuestionSwapModal from "@/components/exams/QuestionSwapModal";
import CloneFromPastModal from "@/components/exams/CloneFromPastModal";
import { 
  AutoPaperBlueprint, 
  BUILT_IN_BLUEPRINTS, 
  generatePaperFromBlueprint 
} from "@/lib/autoPaperEngine";
import { 
  ExamPaperSection, 
  INSTRUCTION_PRESETS, 
  DEFAULT_SECTION_PRESETS 
} from "@/lib/examPaperTypes";
import { 
  ColumnLayout, 
  ColumnDivider, 
  CalligraphyStyle, 
  BorderStyle, 
  PaperSize, 
  PaperOrientation, 
  LogoPosition,
  DEFAULT_PAPER_DESIGN 
} from "@/lib/examPaperTemplates";
import { 
  IslamicCalligraphyHeader, 
  PaperFrameWrapper, 
  MadrasaPaperHeader 
} from "@/components/exams/IslamicPaperDecorations";

// Helper function to detect Arabic script in text
function isArabicText(text: string): boolean {
  if (!text) return false;
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
}

function toBengaliNumerals(num: number): string {
  const digits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return num.toString().split("").map(d => digits[parseInt(d)] || d).join("");
}

function toArabicNumerals(num: number): string {
  const digits = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  return num.toString().split("").map(d => digits[parseInt(d)] || d).join("");
}

export default function PaperGeneratorClient({
  examId,
  classes,
  subjects,
  questions,
  exam,
  madrasa
}: {
  examId: string;
  classes: any[];
  subjects: any[];
  questions: any[];
  exam: any;
  madrasa: any;
}) {
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [customMadrasaName, setCustomMadrasaName] = useState(madrasa?.name || "মাদ্রাসাতুল মুসলিমীন");
  const [paperTitle, setPaperTitle] = useState("বার্ষিক পরীক্ষা - ২০২৬");
  const [examName, setExamName] = useState(exam?.title || "");
  const [examTime, setExamTime] = useState("২ ঘণ্টা ৩০ মিনিট");
  const [totalMarks, setTotalMarks] = useState(100);
  const [paperInstructions, setPaperInstructions] = useState("সকল প্রশ্নের উত্তর দেওয়া আবশ্যক। ডান পাশের সংখ্যা পূর্ণমান জ্ঞাপক।");
  
  // Right Panel Tab: sections (content), design (templates & layout), preview (live sheet)
  const [activeTab, setActiveTab] = useState<"sections" | "design" | "preview">("sections");

  // Section / Group Wise Exam Paper States
  const [isSectioned, setIsSectioned] = useState(true);
  const [numberingScheme, setNumberingScheme] = useState<"continuous" | "per_section">("continuous");
  const [sections, setSections] = useState<ExamPaperSection[]>([
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
      instruction: "১ নং প্রশ্নসহ যেকোনো ৪টি লিখ",
      targetMarks: 50,
      questions: []
    }
  ]);
  const [activeSectionId, setActiveSectionId] = useState<string>("sec-1");

  // Fallback for unsectioned mode
  const [unsectionedQuestions, setUnsectionedQuestions] = useState<any[]>([]);

  // =========================================================================
  // Paper Design & Print Layout Settings
  // =========================================================================
  const [columnLayout, setColumnLayout] = useState<ColumnLayout>("2_column");
  const [columnDivider, setColumnDivider] = useState<ColumnDivider>("solid");
  const [calligraphyStyle, setCalligraphyStyle] = useState<CalligraphyStyle>("ornate_frame");
  const [showLogo, setShowLogo] = useState<boolean>(true);
  const [logoUrl, setLogoUrl] = useState<string>(madrasa?.logo_url || "");
  const [logoPosition, setLogoPosition] = useState<LogoPosition>("left");
  const [logoSize, setLogoSize] = useState<"sm" | "md" | "lg">("md");
  const [borderStyle, setBorderStyle] = useState<BorderStyle>("double_classic");
  const [paperSize, setPaperSize] = useState<PaperSize>("a4");
  const [paperOrientation, setPaperOrientation] = useState<PaperOrientation>("portrait");
  const [compactSpacing, setCompactSpacing] = useState<boolean>(true);

  // Typography & Script Settings
  const [selectedFont, setSelectedFont] = useState("font-solaiman");
  const [textDirectionMode, setTextDirectionMode] = useState<"auto" | "rtl" | "ltr">("auto");
  const [arabicNumbering, setArabicNumbering] = useState<"auto" | "bengali" | "arabic" | "english">("auto");
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  // Local copy of questions to allow dynamic updates when seeding or adding
  const [localQuestions, setLocalQuestions] = useState<any[]>(questions);
  useEffect(() => {
    setLocalQuestions(questions);
  }, [questions]);

  // Available questions for selected class and subject
  const availableQuestions = useMemo(() => {
    return localQuestions.filter(
      (q) => q.class_id === classId && q.subject_id === subjectId
    );
  }, [localQuestions, classId, subjectId]);

  // 1-Click Auto Paper Blueprint & Question Swap states
  const [isAutoBlueprintModalOpen, setIsAutoBlueprintModalOpen] = useState(false);
  const [isCloneFromPastModalOpen, setIsCloneFromPastModalOpen] = useState(false);
  const [lastGeneratedBlueprint, setLastGeneratedBlueprint] = useState<AutoPaperBlueprint | null>(null);
  const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
  const [swapTargetQuestion, setSwapTargetQuestion] = useState<any | null>(null);
  const [swapTargetSectionName, setSwapTargetSectionName] = useState<string | undefined>(undefined);

  const handleApplyPastPaper = (pastPaper: any) => {
    if (!pastPaper) return;

    // Update metadata
    if (pastPaper.title) setPaperTitle(pastPaper.title);
    if (pastPaper.exam_time) setExamTime(pastPaper.exam_time);
    if (pastPaper.total_marks) setTotalMarks(Number(pastPaper.total_marks));
    if (pastPaper.exam_name) setExamName(pastPaper.exam_name);
    
    // If different class/subject was chosen in past paper, switch to it
    if (pastPaper.class_id && pastPaper.class_id !== classId) {
      setClassId(pastPaper.class_id);
    }
    if (pastPaper.subject_id && pastPaper.subject_id !== subjectId) {
      setSubjectId(pastPaper.subject_id);
    }

    const qData = pastPaper.questions;
    if (qData) {
      if (qData.is_sectioned && Array.isArray(qData.sections)) {
        setIsSectioned(true);
        setSections(qData.sections.map((sec: any, sIdx: number) => ({
          ...sec,
          id: `cloned-sec-${Date.now()}-${sIdx}`,
          questions: (sec.questions || []).map((q: any, qIdx: number) => ({
            ...q,
            id: `cloned-q-${Date.now()}-${sIdx}-${qIdx}`,
          }))
        })));
        if (qData.numbering_scheme) {
          setNumberingScheme(qData.numbering_scheme);
        }
      } else if (Array.isArray(qData)) {
        setIsSectioned(false);
        setUnsectionedQuestions(qData.map((q: any, qIdx: number) => ({
          ...q,
          id: `cloned-q-${Date.now()}-${qIdx}`,
        })));
      } else if (Array.isArray(qData.questions)) {
        setIsSectioned(false);
        setUnsectionedQuestions(qData.questions.map((q: any, qIdx: number) => ({
          ...q,
          id: `cloned-q-${Date.now()}-${qIdx}`,
        })));
      }

      // Design config restoration if present
      if (qData.design_config) {
        const dc = qData.design_config;
        if (dc.columnLayout) setColumnLayout(dc.columnLayout);
        if (dc.columnDivider) setColumnDivider(dc.columnDivider);
        if (dc.calligraphyStyle) setCalligraphyStyle(dc.calligraphyStyle);
        if (dc.borderStyle) setBorderStyle(dc.borderStyle);
        if (dc.paperSize) setPaperSize(dc.paperSize);
        if (dc.paperOrientation) setPaperOrientation(dc.paperOrientation);
        if (dc.selectedFont) setSelectedFont(dc.selectedFont);
        if (dc.customMadrasaName) setCustomMadrasaName(dc.customMadrasaName);
      }
    }

    setActiveTab("sections");
    alert("বিগত বছরের প্রশ্নপত্রটি সফলভাবে বর্তমান এডিটরে লোড করা হয়েছে! প্রয়োজন অনুযায়ী পরিবর্তন করে সংরক্ষণ করুন।");
  };

  const currentlyUsedQuestionIds = useMemo(() => {
    if (isSectioned) {
      return new Set<string>(sections.flatMap(s => s.questions.map(q => String(q.id))));
    }
    return new Set<string>(unsectionedQuestions.map(q => String(q.id)));
  }, [isSectioned, sections, unsectionedQuestions]);

  const ensureQuestionsInBank = async (): Promise<any[]> => {
    if (availableQuestions.length > 0) return availableQuestions;

    const confirmSeed = window.confirm(
      "নির্বাচিত শ্রেণি ও বিষয়ের প্রশ্নব্যাংক বর্তমানে খালি আছে। আপনি কি কওমি মাদ্রাসার প্রমিত নমুনা প্রশ্নাবলী (রচনামূলক, সংক্ষিপ্ত, এরাব, তাহকীক, অনুবাদ, ফিকহ) স্বয়ংক্রিয়ভাবে প্রশ্নব্যাংকে যুক্ত করে প্রশ্নপত্র তৈরি করতে চান?"
    );
    if (!confirmSeed) return [];

    setSeeding(true);
    try {
      const res = await seedSampleQuestionsForSubject(classId, subjectId);
      if (res?.success && res.questions) {
        const addedQuestions = res.questions;
        setLocalQuestions(prev => [...prev, ...addedQuestions]);
        return addedQuestions;
      } else {
        alert(res?.error || "নমুনা প্রশ্ন যোগ করা যায়নি।");
        return [];
      }
    } catch (err) {
      console.error("Seed error:", err);
      return [];
    } finally {
      setSeeding(false);
    }
  };

  const handleOpenAutoBlueprintModal = async () => {
    if (!classId || !subjectId) {
      alert("অনুগ্রহ করে প্রথমে শ্রেণি ও বিষয় নির্বাচন করুন।");
      return;
    }
    if (availableQuestions.length === 0) {
      await ensureQuestionsInBank();
    }
    setIsAutoBlueprintModalOpen(true);
  };

  const executeBlueprintGeneration = (bp: AutoPaperBlueprint, pool: any[]) => {
    const result = generatePaperFromBlueprint(bp, pool);
    if (!result.success && result.totalQuestions === 0) {
      alert("ব্লুপ্রিন্ট অনুযায়ী প্রশ্ন নির্বাচন করা সম্ভব হয়নি। প্রশ্নব্যাংকে পর্যাপ্ত প্রশ্ন আছে কি না তা যাচাই করুন।");
      return;
    }

    if (bp.isSectioned) {
      setIsSectioned(true);
      setSections(result.sections);
      if (result.sections.length > 0) {
        setActiveSectionId(result.sections[0].id);
      }
    } else {
      setIsSectioned(false);
      setUnsectionedQuestions(result.flatQuestions);
    }

    setTotalMarks(bp.totalMarks);
    setExamTime(bp.time);
    if (bp.paperInstructions) {
      setPaperInstructions(bp.paperInstructions);
    }
    setLastGeneratedBlueprint(bp);
    setIsAutoBlueprintModalOpen(false);
    setActiveTab("sections");

    if (result.warnings && result.warnings.length > 0) {
      alert(`অটো-প্রশ্নপত্র তৈরি সম্পন্ন হয়েছে!\n\nবিশেষ দ্রষ্টব্য:\n${result.warnings.join("\n")}`);
    }
  };

  const handleQuickApplyBlueprint = async (bp: AutoPaperBlueprint) => {
    if (!classId || !subjectId) {
      alert("অনুগ্রহ করে প্রথমে শ্রেণি ও বিষয় নির্বাচন করুন।");
      return;
    }
    let pool = availableQuestions;
    if (pool.length === 0) {
      pool = await ensureQuestionsInBank();
      if (pool.length === 0) return;
    }
    executeBlueprintGeneration(bp, pool);
  };

  const handleReshufflePaper = () => {
    if (!lastGeneratedBlueprint) return;
    executeBlueprintGeneration(lastGeneratedBlueprint, availableQuestions);
  };

  const handleOpenSwapModal = (question: any, sectionName?: string) => {
    setSwapTargetQuestion(question);
    setSwapTargetSectionName(sectionName);
    setIsSwapModalOpen(true);
  };

  const handleSwapQuestion = (oldQuestionId: string, newQuestion: any) => {
    if (isSectioned) {
      setSections(prevSections => prevSections.map(sec => {
        const idx = sec.questions.findIndex(q => q.id === oldQuestionId);
        if (idx !== -1) {
          const updated = [...sec.questions];
          updated[idx] = newQuestion;
          return { ...sec, questions: updated };
        }
        return sec;
      }));
    } else {
      setUnsectionedQuestions(prev => {
        const idx = prev.findIndex(q => q.id === oldQuestionId);
        if (idx !== -1) {
          const updated = [...prev];
          updated[idx] = newQuestion;
          return updated;
        }
        return prev;
      });
    }
    setIsSwapModalOpen(false);
    setSwapTargetQuestion(null);
  };

  const handleQuickAddAndSwap = async (newQuestionData: any) => {
    if (!swapTargetQuestion || !classId || !subjectId) return;
    const oldId = swapTargetQuestion.id;
    const res = await saveQuestion({
      ...newQuestionData,
      class_id: classId,
      subject_id: subjectId,
    });
    if (res?.error) {
      alert(res.error);
      return;
    }
    const newQ = {
      id: `custom-q-${Date.now()}`,
      class_id: classId,
      subject_id: subjectId,
      ...newQuestionData,
    };
    setLocalQuestions(prev => [newQ, ...prev]);
    handleSwapQuestion(oldId, newQ);
  };

  useEffect(() => {
    if (classId && subjectId) {
      loadPaper();
    } else {
      setSections([
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
          instruction: "১ নং প্রশ্নসহ যেকোনো ৪টি লিখ",
          targetMarks: 50,
          questions: []
        }
      ]);
      setUnsectionedQuestions([]);
    }
  }, [classId, subjectId]);

  const loadPaper = async () => {
    setLoading(true);
    const paper = await getExamPaper(examId, classId, subjectId);
    if (paper) {
      setPaperTitle(paper.title);
      setTotalMarks(paper.total_marks);
      setExamName(paper.exam_name || exam.title || "");
      setExamTime(paper.exam_time || "");

      const qData = paper.questions;
      if (qData && typeof qData === "object" && !Array.isArray(qData)) {
        if (qData.is_sectioned) {
          setIsSectioned(true);
          setNumberingScheme(qData.numbering_scheme || "continuous");
          const loadedSections = qData.sections || [];
          setSections(loadedSections);
          if (loadedSections.length > 0) {
            setActiveSectionId(loadedSections[0].id);
          }
        }

        // Restore design config if saved previously
        if (qData.design_config) {
          const cfg = qData.design_config;
          if (cfg.columnLayout) setColumnLayout(cfg.columnLayout);
          if (cfg.columnDivider) setColumnDivider(cfg.columnDivider);
          if (cfg.calligraphyStyle) setCalligraphyStyle(cfg.calligraphyStyle);
          if (typeof cfg.showLogo === "boolean") setShowLogo(cfg.showLogo);
          if (cfg.logoUrl !== undefined) setLogoUrl(cfg.logoUrl);
          if (cfg.logoPosition) setLogoPosition(cfg.logoPosition);
          if (cfg.logoSize) setLogoSize(cfg.logoSize);
          if (cfg.borderStyle) setBorderStyle(cfg.borderStyle);
          if (cfg.paperSize) setPaperSize(cfg.paperSize);
          if (cfg.paperOrientation) setPaperOrientation(cfg.paperOrientation);
          if (typeof cfg.compactSpacing === "boolean") setCompactSpacing(cfg.compactSpacing);
          if (cfg.selectedFont) setSelectedFont(cfg.selectedFont);
          if (cfg.customMadrasaName) setCustomMadrasaName(cfg.customMadrasaName);
        }

        if (qData.last_blueprint) {
          setLastGeneratedBlueprint(qData.last_blueprint);
        }
      } else if (Array.isArray(qData)) {
        // Legacy array of questions
        setUnsectionedQuestions(qData);
        const half = Math.ceil(qData.length / 2);
        const sec1Questions = qData.slice(0, half);
        const sec2Questions = qData.slice(half);
        setSections([
          {
            id: "sec-1",
            name: "ক-বিভাগ: কুরআন ও হাদিস",
            instruction: "যেকোনো ৫টি প্রশ্নের উত্তর দাও",
            targetMarks: Math.round(paper.total_marks / 2),
            questions: sec1Questions
          },
          {
            id: "sec-2",
            name: "খ-বিভাগ: ফিকহ ও ফতোয়া",
            instruction: "১ নং প্রশ্নসহ যেকোনো ৪টি লিখ",
            targetMarks: Math.round(paper.total_marks / 2),
            questions: sec2Questions
          }
        ]);
        setActiveSectionId("sec-1");
      }
    } else {
      setPaperTitle(`${exam.title} - প্রশ্নপত্র`);
      setTotalMarks(100);
      setExamTime("২ ঘণ্টা ৩০ মিনিট");
      setSections([
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
          instruction: "১ নং প্রশ্নসহ যেকোনো ৪টি লিখ",
          targetMarks: 50,
          questions: []
        }
      ]);
      setUnsectionedQuestions([]);
      setActiveSectionId("sec-1");
    }
    setLoading(false);
  };

  // Section Management Handlers
  const handleAddSection = () => {
    const letters = ["ক", "খ", "গ", "ঘ", "ঙ", "চ"];
    const nextIndex = sections.length;
    const nextLetter = letters[nextIndex] || `${nextIndex + 1}`;
    const newSec: ExamPaperSection = {
      id: `sec-${Date.now()}`,
      name: `${nextLetter}-বিভাগ: নতুন বিভাগ`,
      instruction: "যেকোনো ৫টি প্রশ্নের উত্তর দাও",
      targetMarks: 50,
      questions: []
    };
    setSections([...sections, newSec]);
    setActiveSectionId(newSec.id);
  };

  const handleRemoveSection = (sectionId: string) => {
    if (sections.length <= 1) {
      alert("কমপক্ষে একটি বিভাগ থাকা আবশ্যক। আপনি চাইলে সাধারণ (একক) মোডে পরিবর্তন করতে পারেন।");
      return;
    }
    const targetSection = sections.find(s => s.id === sectionId);
    if (targetSection && targetSection.questions.length > 0) {
      if (!confirm(`"${targetSection.name}"-এ ${targetSection.questions.length}টি প্রশ্ন রয়েছে। বিভাগটি মুছে ফেললে প্রশ্নগুলো প্রথম বিভাগে স্থানান্তরিত হবে। আপনি কি নিশ্চিত?`)) {
        return;
      }
    }
    const remaining = sections.filter(s => s.id !== sectionId);
    if (targetSection && targetSection.questions.length > 0 && remaining.length > 0) {
      remaining[0].questions = [...remaining[0].questions, ...targetSection.questions];
    }
    setSections(remaining);
    if (activeSectionId === sectionId && remaining.length > 0) {
      setActiveSectionId(remaining[0].id);
    }
  };

  const handleUpdateSection = (sectionId: string, field: keyof ExamPaperSection, value: any) => {
    setSections(prev => prev.map(sec => {
      if (sec.id === sectionId) {
        return { ...sec, [field]: value };
      }
      return sec;
    }));
  };

  const handleMoveSection = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === sections.length - 1) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    const newSections = [...sections];
    const temp = newSections[index];
    newSections[index] = newSections[targetIndex];
    newSections[targetIndex] = temp;
    setSections(newSections);
  };

  const applyPreset = (presetKey: "bengali_two" | "arabic_two" | "bengali_three") => {
    const preset = DEFAULT_SECTION_PRESETS[presetKey];
    if (!preset) return;

    const allExistingQuestions = sections.flatMap(s => s.questions);
    const count = preset.length;
    const chunkSize = Math.ceil(allExistingQuestions.length / count);

    const newSections: ExamPaperSection[] = preset.map((p, idx) => ({
      ...p,
      id: `sec-${idx + 1}-${Date.now()}`,
      questions: allExistingQuestions.slice(idx * chunkSize, (idx + 1) * chunkSize)
    }));

    setSections(newSections);
    if (newSections.length > 0) {
      setActiveSectionId(newSections[0].id);
    }
  };

  // Question selection & toggle
  const findQuestionSection = (questionId: string) => {
    return sections.find(s => s.questions.some(q => q.id === questionId));
  };

  const handleToggleQuestion = (question: any) => {
    if (!isSectioned) {
      const isSelected = unsectionedQuestions.some(q => q.id === question.id);
      if (isSelected) {
        setUnsectionedQuestions(unsectionedQuestions.filter(q => q.id !== question.id));
      } else {
        setUnsectionedQuestions([...unsectionedQuestions, question]);
      }
      return;
    }

    const currentSection = findQuestionSection(question.id);
    if (currentSection) {
      if (currentSection.id === activeSectionId) {
        setSections(sections.map(s => {
          if (s.id === currentSection.id) {
            return { ...s, questions: s.questions.filter(q => q.id !== question.id) };
          }
          return s;
        }));
      } else {
        setSections(sections.map(s => {
          if (s.id === currentSection.id) {
            return { ...s, questions: s.questions.filter(q => q.id !== question.id) };
          }
          if (s.id === activeSectionId) {
            return { ...s, questions: [...s.questions, question] };
          }
          return s;
        }));
      }
    } else {
      setSections(sections.map(s => {
        if (s.id === activeSectionId) {
          return { ...s, questions: [...s.questions, question] };
        }
        return s;
      }));
    }
  };

  const handleMoveQuestionBetweenSections = (questionId: string, fromSectionId: string, toSectionId: string) => {
    if (fromSectionId === toSectionId) return;
    const fromSec = sections.find(s => s.id === fromSectionId);
    if (!fromSec) return;
    const question = fromSec.questions.find(q => q.id === questionId);
    if (!question) return;

    setSections(sections.map(s => {
      if (s.id === fromSectionId) {
        return { ...s, questions: s.questions.filter(q => q.id !== questionId) };
      }
      if (s.id === toSectionId) {
        return { ...s, questions: [...s.questions, question] };
      }
      return s;
    }));
  };

  const handleMoveQuestionInSec = (sectionId: string, index: number, direction: "up" | "down") => {
    setSections(sections.map(s => {
      if (s.id !== sectionId) return s;
      if (direction === "up" && index === 0) return s;
      if (direction === "down" && index === s.questions.length - 1) return s;
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      const newQuestions = [...s.questions];
      const temp = newQuestions[index];
      newQuestions[index] = newQuestions[targetIndex];
      newQuestions[targetIndex] = temp;
      return { ...s, questions: newQuestions };
    }));
  };

  const handleRemoveQuestionFromSec = (sectionId: string, questionId: string) => {
    setSections(sections.map(s => {
      if (s.id === sectionId) {
        return { ...s, questions: s.questions.filter(q => q.id !== questionId) };
      }
      return s;
    }));
  };

  // Logo file upload handler
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setLogoUrl(event.target.result as string);
          setShowLogo(true);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Marks Calculations
  const totalSelectedQuestions = isSectioned
    ? sections.reduce((sum, s) => sum + s.questions.length, 0)
    : unsectionedQuestions.length;

  const currentTotalMarks = isSectioned
    ? sections.reduce((sum, s) => sum + s.questions.reduce((m, q) => m + (q.marks || 0), 0), 0)
    : unsectionedQuestions.reduce((sum, q) => sum + (q.marks || 0), 0);

  const handleSave = async () => {
    if (!classId || !subjectId) {
      alert("অনুগ্রহ করে প্রথমে শ্রেণি এবং বিষয় নির্বাচন করুন।");
      return;
    }
    if (totalSelectedQuestions === 0) {
      alert("অনুগ্রহ করে প্রশ্নপত্রে অন্তত একটি প্রশ্ন যোগ করুন।");
      return;
    }

    setSaving(true);
    try {
      const designConfig = {
        columnLayout,
        columnDivider,
        calligraphyStyle,
        showLogo,
        logoUrl,
        logoPosition,
        logoSize,
        borderStyle,
        paperSize,
        paperOrientation,
        compactSpacing,
        selectedFont,
        customMadrasaName,
      };

      const questionsPayload = isSectioned
        ? {
            is_sectioned: true,
            numbering_scheme: numberingScheme,
            sections: sections,
            flat_questions: sections.flatMap(s => s.questions),
            design_config: designConfig,
            last_blueprint: lastGeneratedBlueprint
          }
        : {
            is_sectioned: false,
            questions: unsectionedQuestions,
            design_config: designConfig,
            last_blueprint: lastGeneratedBlueprint
          };

      const result = await saveExamPaper({
        exam_id: examId,
        class_id: classId,
        subject_id: subjectId,
        title: paperTitle,
        total_marks: totalMarks,
        exam_time: examTime,
        exam_name: examName,
        questions: questionsPayload
      });

      if (result?.error) {
        alert(result.error);
      } else {
        alert("কওমি স্টাইল ডিজাইন ও বিভাগভিত্তিক প্রশ্নপত্রটি সফলভাবে সংরক্ষণ করা হয়েছে!");
      }
    } catch (err) {
      console.error("saveExamPaper failed:", err);
      alert("একটি অপ্রত্যাশিত সমস্যা হয়েছে। অনুগ্রহ করে পেজ রিফ্রেশ করে আবার চেষ্টা করুন।");
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getQuestionDir = (text: string): "rtl" | "ltr" => {
    if (textDirectionMode === "rtl") return "rtl";
    if (textDirectionMode === "ltr") return "ltr";
    return isArabicText(text) ? "rtl" : "ltr";
  };

  const formatQuestionNumber = (idx: number, isRTL: boolean): string => {
    const num = idx + 1;
    if (arabicNumbering === "arabic" || (isRTL && arabicNumbering === "auto")) {
      return `${toArabicNumerals(num)}.`;
    }
    if (arabicNumbering === "english") {
      return `${num}.`;
    }
    return `${toBengaliNumerals(num)}.`;
  };

  const selectedClassName = classes.find((c) => c.id === classId)?.name || "";
  const selectedSubjectName = subjects.find((s) => s.id === subjectId)?.name || "";

  // Dynamic CSS helper classes for column layout & dividers
  const columnClasses = columnLayout === "2_column" ? "qawmi-columns-2" : "qawmi-columns-1";
  const dividerClasses = 
    columnDivider === "solid" ? "qawmi-col-divider-solid" :
    columnDivider === "dashed" ? "qawmi-col-divider-dashed" :
    columnDivider === "double" ? "qawmi-col-divider-double" : "qawmi-col-divider-none";

  return (
    <div>
      {/* Dynamic Print Size & Column CSS Injection */}
      <style jsx global>{`
        .qawmi-columns-2 {
          column-count: 2 !important;
          -webkit-column-count: 2 !important;
          column-gap: 24px !important;
          -webkit-column-gap: 24px !important;
        }
        .qawmi-columns-1 {
          column-count: 1 !important;
          -webkit-column-count: 1 !important;
          column-gap: 0 !important;
        }
        .qawmi-col-divider-solid {
          column-rule: 1.5px solid #000000 !important;
          -webkit-column-rule: 1.5px solid #000000 !important;
        }
        .qawmi-col-divider-dashed {
          column-rule: 1.5px dashed #444444 !important;
          -webkit-column-rule: 1.5px dashed #444444 !important;
        }
        .qawmi-col-divider-double {
          column-rule: 3.5px double #000000 !important;
          -webkit-column-rule: 3.5px double #000000 !important;
        }
        .qawmi-col-divider-none {
          column-rule: none !important;
          -webkit-column-rule: none !important;
        }
        .qawmi-section-header {
          column-span: all !important;
          -webkit-column-span: all !important;
          break-inside: avoid !important;
          page-break-inside: avoid !important;
          -webkit-column-break-inside: avoid !important;
        }
        .qawmi-question-item {
          break-inside: avoid !important;
          page-break-inside: avoid !important;
          -webkit-column-break-inside: avoid !important;
          margin-bottom: ${compactSpacing ? "0.75rem" : "1.25rem"} !important;
        }

        @media print {
          @page {
            size: ${
              paperSize === "legal" 
                ? "8.5in 14in" 
                : paperSize === "folio" 
                  ? "8.5in 13in" 
                  : "A4"
            } ${paperOrientation};
            margin: ${compactSpacing ? "6mm 8mm" : "10mm 12mm"};
          }
          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          body * {
            visibility: hidden !important;
          }
          #exam-paper-print-view, #exam-paper-print-view * {
            visibility: visible !important;
          }
          #exam-paper-print-view {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            display: block !important;
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
          }
        }
      `}</style>

      {/* Interactive Layout: Hidden when printing */}
      <div className="space-y-6 print:hidden">
        {/* Top Controls: Class, Subject, Save & Print */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 justify-between items-end">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full md:w-1/2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">শ্রেণি / জামাত (Class)</label>
              <select
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none text-sm text-slate-800 bg-white"
              >
                <option value="">শ্রেণি নির্বাচন করুন</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">বিষয় (Subject)</label>
              <select
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none text-sm text-slate-800 bg-white"
              >
                <option value="">বিষয় নির্বাচন করুন</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <button
              type="button"
              onClick={() => setIsCloneFromPastModalOpen(true)}
              className="flex items-center space-x-2 px-3.5 py-2.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg hover:bg-indigo-100 transition flex-1 md:flex-none justify-center cursor-pointer font-semibold text-sm shadow-2xs"
              title="বিগত সেমিস্টার বা বছরের প্রশ্নপত্র থেকে সরাসরি বর্তমান এডিটরে লোড করুন"
            >
              <History className="w-4 h-4 text-indigo-600" />
              <span>বিগত প্রশ্ন ক্লোন</span>
            </button>
            <button
              onClick={handleSave}
              disabled={saving || loading || !classId || !subjectId}
              className="flex items-center space-x-2 px-4 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition disabled:opacity-50 flex-1 md:flex-none justify-center cursor-pointer font-semibold text-sm shadow-sm"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>প্রশ্নপত্র সংরক্ষণ</span>
            </button>
            <button
              onClick={handlePrint}
              disabled={totalSelectedQuestions === 0}
              className="flex items-center space-x-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 flex-1 md:flex-none justify-center cursor-pointer font-semibold text-sm shadow-sm"
            >
              <Printer className="w-4 h-4" />
              <span>প্রিন্ট প্রশ্নপত্র ({paperSize.toUpperCase()})</span>
            </button>
          </div>
        </div>

        {/* 1-Click Smart Auto-Paper Generator Banner */}
        <div className="bg-gradient-to-r from-emerald-950 via-teal-950 to-slate-950 text-white p-4 sm:p-5 rounded-2xl shadow-md border border-emerald-500/40 relative overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shrink-0 shadow-inner">
                <Sparkles className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-base sm:text-lg text-white font-solaiman">
                    ১-ক্লিকে অটো প্রশ্নপত্র জেনারেটর (Smart Auto-Paper Generator)
                  </h3>
                  <span className="text-[11px] bg-emerald-400/20 text-emerald-300 font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-400/30">
                    ১-ক্লিক ব্লুপ্রিন্ট
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-emerald-100/80 mt-0.5 max-w-2xl font-solaiman">
                  শিক্ষক শুধু ব্লুপ্রিন্ট দেবেন: <span className="text-emerald-200 font-semibold">"মোট ১০০ নম্বর: রচনামূলক ৪টি (৪০), সংক্ষিপ্ত ৫টি (২৫), এরাব ও তাহকীক ২টি (১৫), অনুবাদ ২টি (২০)"</span>। সিস্টেম স্বয়ংক্রিয়ভাবে প্রশ্নব্যাংক থেকে ব্যালান্সড প্রশ্নপত্র সাজিয়ে দেবে।
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
              <button
                type="button"
                onClick={handleOpenAutoBlueprintModal}
                disabled={!classId || !subjectId || seeding}
                className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95"
              >
                {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-emerald-200" />}
                <span>ব্লুপ্রিন্ট কনফিগার ও অটো তৈরি করুন</span>
              </button>

              {lastGeneratedBlueprint && (
                <button
                  type="button"
                  onClick={handleReshufflePaper}
                  disabled={!classId || !subjectId}
                  className="px-3 py-2.5 bg-slate-800/90 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold rounded-xl border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
                  title="একই ব্লুপ্রিন্ট দিয়ে নতুনভাবে প্রশ্ন অদলবদল (Reshuffle) করুন"
                >
                  <RotateCw className="w-3.5 h-3.5 text-emerald-400" />
                  <span>পুনরায় শাফেল</span>
                </button>
              )}
            </div>
          </div>

          {/* Quick Preset Badges below */}
          <div className="mt-3.5 pt-3 border-t border-emerald-500/20 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-emerald-300 font-bold text-[11px] flex items-center gap-1">
              <span>১-ক্লিক দ্রুত প্রিসেট:</span>
            </span>
            {BUILT_IN_BLUEPRINTS.slice(0, 5).map(bp => (
              <button
                key={bp.id}
                type="button"
                onClick={() => handleQuickApplyBlueprint(bp)}
                disabled={!classId || !subjectId || seeding}
                className="px-2.5 py-1 bg-emerald-950/70 hover:bg-emerald-800/90 text-emerald-200 hover:text-white text-[11px] font-medium rounded-lg border border-emerald-600/40 transition cursor-pointer disabled:opacity-40"
              >
                ⚡ {bp.name}
              </button>
            ))}
          </div>

          {/* Active Blueprint Feedback Bar */}
          {lastGeneratedBlueprint && (
            <div className="bg-emerald-900/40 border border-emerald-500/30 px-3 py-2 rounded-xl flex items-center justify-between text-xs mt-3">
              <div className="flex items-center gap-2 text-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>সক্রিয় ব্লুপ্রিন্ট: <strong className="text-white font-bold">{lastGeneratedBlueprint.name}</strong> ({toBengaliNumerals(lastGeneratedBlueprint.totalMarks)} নম্বর)</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleReshufflePaper}
                  className="text-emerald-300 hover:text-white flex items-center gap-1 font-bold underline cursor-pointer"
                >
                  <RotateCw className="w-3 h-3" />
                  <span>অন্য প্রশ্ন বাছাই করুন</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsAutoBlueprintModalOpen(true)}
                  className="text-slate-300 hover:text-white flex items-center gap-1 font-medium cursor-pointer"
                >
                  <Sliders className="w-3 h-3" />
                  <span>ব্লুপ্রিন্ট পরিবর্তন</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Section Management Toolbar */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4 rounded-xl shadow-sm border border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-base text-white">বিভাগভিত্তিক প্রশ্নপত্র বিন্যাস (Section Mode)</h2>
                <span className="text-[11px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                  ক-বিভাগ / খ-বিভাগ
                </span>
              </div>
              <p className="text-xs text-slate-300">
                প্রশ্নপত্রকে গ্রুপে বিভক্ত করুন এবং প্রতিটি বিভাগের শর্তযুক্ত নির্দেশনা ও নম্বর বণ্টন সেট করুন
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsSectioned(!isSectioned)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${
                isSectioned 
                  ? "bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-500" 
                  : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{isSectioned ? "বিভাগ মোড সক্রিয় (ON)" : "একক তালিকা মোড (OFF)"}</span>
            </button>

            {isSectioned && (
              <>
                <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-lg border border-slate-700">
                  <span className="text-[11px] font-semibold text-slate-400 px-1.5">প্রিসেট:</span>
                  <button
                    type="button"
                    onClick={() => applyPreset("bengali_two")}
                    className="px-2 py-1 text-xs bg-slate-700/80 hover:bg-slate-700 text-slate-200 rounded font-medium transition cursor-pointer"
                    title="ক ও খ বিভাগ (৫০ + ৫০ নম্বর)"
                  >
                    ক/খ বিভাগ (বাংলা)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset("arabic_two")}
                    className="px-2 py-1 text-xs bg-slate-700/80 hover:bg-slate-700 text-slate-200 rounded font-medium transition cursor-pointer font-amiri"
                    title="القسم الأول والقسم الثاني"
                  >
                    القسم الأول/الثاني
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset("bengali_three")}
                    className="px-2 py-1 text-xs bg-slate-700/80 hover:bg-slate-700 text-slate-200 rounded font-medium transition cursor-pointer"
                    title="ক, খ ও গ বিভাগ"
                  >
                    ৩টি বিভাগ (ক, খ, গ)
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleAddSection}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>নতুন বিভাগ যোগ করুন</span>
                </button>
              </>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-slate-900" />
          </div>
        ) : classId && subjectId ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Side: Question Bank Selection */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-[780px]">
              <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row justify-between sm:items-center gap-3 shrink-0">
                <div>
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-emerald-600" />
                    <span>প্রশ্ন ব্যাংক থেকে নির্বাচন করুন</span>
                  </h3>
                  <span className="text-xs text-slate-500 font-medium">
                    {availableQuestions.length}টি প্রশ্ন সংরক্ষিত আছে
                  </span>
                </div>

                {/* Active Section Target Selector for adding questions */}
                {isSectioned && sections.length > 0 && (
                  <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-300 px-3 py-1.5 rounded-lg shadow-xs">
                    <span className="text-[11px] font-bold text-emerald-950 whitespace-nowrap">যোগ হবে:</span>
                    <select
                      value={activeSectionId}
                      onChange={(e) => setActiveSectionId(e.target.value)}
                      className="bg-white text-xs font-bold text-emerald-800 border border-emerald-300 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                    >
                      {sections.map((s, idx) => (
                        <option key={s.id} value={s.id}>
                          {s.name || `বিভাগ ${idx + 1}`} ({s.questions.length}টি)
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="p-4 overflow-y-auto flex-1 space-y-3">
                {availableQuestions.map((q) => {
                  const containingSection = isSectioned ? findQuestionSection(q.id) : null;
                  const isSelectedInUnsectioned = !isSectioned && unsectionedQuestions.some(sq => sq.id === q.id);
                  const isSelected = isSectioned ? !!containingSection : isSelectedInUnsectioned;

                  return (
                    <div
                      key={q.id}
                      onClick={() => handleToggleQuestion(q)}
                      className={`p-3.5 rounded-lg border cursor-pointer transition ${
                        isSelected 
                          ? "border-emerald-500 bg-emerald-50/50 shadow-xs" 
                          : "border-slate-200 hover:border-slate-400 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                          {(() => {
                            const badge = getQuestionTypeBadge(q.question_type);
                            return (
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${badge.color}`}>
                                {badge.label}
                              </span>
                            );
                          })()}
                          {q.options?.has_or && (
                            <span className="text-[10px] font-bold text-orange-800 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200">
                              + বা (أو)
                            </span>
                          )}

                          {isSectioned && containingSection && (
                            <span className="text-[11px] font-extrabold text-emerald-900 bg-emerald-200/80 px-2 py-0.5 rounded border border-emerald-300">
                              {containingSection.name.split(":")[0] || containingSection.name}
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                          {toBengaliNumerals(q.marks)} নম্বর
                        </span>
                      </div>
                      <SpecializedQuestionView question={q} hideMarks={true} isPrint={false} />
                    </div>
                  );
                })}

                {availableQuestions.length === 0 && (
                  <div className="text-center p-12 text-slate-500 text-sm">
                    এই শ্রেণি ও বিষয়ের কোনো প্রশ্ন প্রশ্নব্যাংকে পাওয়া যায়নি।
                  </div>
                )}
              </div>
            </div>

            {/* Right Side: Tabbed Workspace */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-[780px]">
              {/* Tab Switcher Header */}
              <div className="p-3 border-b border-slate-200 bg-slate-50 shrink-0">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1 bg-slate-200/80 p-1 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setActiveTab("sections")}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                        activeTab === "sections" 
                          ? "bg-white text-slate-900 shadow-xs" 
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5 text-indigo-600" />
                      <span>বিভাগ ও প্রশ্নসমূহ</span>
                      <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded font-bold border border-slate-200">
                        {toBengaliNumerals(totalSelectedQuestions)}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab("design")}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                        activeTab === "design" 
                          ? "bg-white text-slate-900 shadow-xs" 
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <Palette className="w-3.5 h-3.5 text-emerald-600" />
                      <span>ডিজাইন ও কওমি লেআউট</span>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded font-bold">
                        {columnLayout === "2_column" ? "২-কলাম" : "১-কলাম"} • {paperSize.toUpperCase()}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab("preview")}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                        activeTab === "preview" 
                          ? "bg-white text-slate-900 shadow-xs" 
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      <Eye className="w-3.5 h-3.5 text-blue-600" />
                      <span>লাইভ শিট প্রিভিউ</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                      currentTotalMarks > totalMarks 
                        ? 'bg-rose-100 text-rose-700 border border-rose-200' 
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    }`}>
                      মোট: {toBengaliNumerals(currentTotalMarks)} / {toBengaliNumerals(totalMarks)}
                    </div>
                  </div>
                </div>

                {/* Subheader Quick Info */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">মাদরাসার নাম</label>
                    <input
                      type="text"
                      value={customMadrasaName}
                      onChange={(e) => setCustomMadrasaName(e.target.value)}
                      className="p-1 border border-slate-300 rounded text-xs w-full bg-white text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">পরীক্ষার নাম</label>
                    <input
                      type="text"
                      value={examName}
                      onChange={(e) => setExamName(e.target.value)}
                      className="p-1 border border-slate-300 rounded text-xs w-full bg-white text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">সময়</label>
                    <input
                      type="text"
                      value={examTime}
                      onChange={(e) => setExamTime(e.target.value)}
                      className="p-1 border border-slate-300 rounded text-xs w-full bg-white text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">পূর্ণমান (Marks)</label>
                    <input
                      type="number"
                      value={totalMarks}
                      onChange={(e) => setTotalMarks(Number(e.target.value))}
                      className="p-1 border border-slate-300 rounded text-xs w-full bg-white text-slate-800"
                    />
                  </div>
                </div>
              </div>

              {/* Tab Contents */}
              <div className="flex-1 overflow-y-auto p-4 bg-slate-100/70">
                {/* TAB 1: Sections & Questions Manager */}
                {activeTab === "sections" && (
                  <div className="space-y-6">
                    {/* General Settings for Paper */}
                    <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">সাধারণ সার্বিক নির্দেশনা</label>
                          <input
                            type="text"
                            value={paperInstructions}
                            onChange={(e) => setPaperInstructions(e.target.value)}
                            className="p-2 border border-slate-300 rounded-lg outline-none text-xs w-full text-slate-800 bg-white"
                            placeholder="যেমন: সকল প্রশ্নের উত্তর দেওয়া আবশ্যক..."
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">প্রশ্নের নাম্বারিং পদ্ধতি</label>
                          <select
                            value={numberingScheme}
                            onChange={(e) => setNumberingScheme(e.target.value as any)}
                            className="p-2 border border-slate-300 rounded-lg outline-none text-xs w-full text-slate-800 bg-white font-medium"
                          >
                            <option value="continuous">ধারাবাহিক নম্বর (ক-বিভাগে ১, ২... খ-বিভাগে ৬, ৭...)</option>
                            <option value="per_section">প্রতি বিভাগে নতুন করে (প্রতি বিভাগে ১, ২, ৩...)</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {isSectioned ? (
                      sections.map((section, secIndex) => {
                        const secSelectedMarks = section.questions.reduce((sum, q) => sum + (q.marks || 0), 0);
                        let questionOffset = 0;
                        if (numberingScheme === "continuous") {
                          for (let i = 0; i < secIndex; i++) {
                            questionOffset += sections[i].questions.length;
                          }
                        }

                        return (
                          <div 
                            key={section.id} 
                            className="bg-white border-2 border-slate-200 rounded-xl p-4 shadow-xs space-y-3"
                          >
                            {/* Section Header Controls Box */}
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                              <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold">
                                  {toBengaliNumerals(secIndex + 1)}
                                </span>
                                <span className="font-extrabold text-sm text-slate-900">
                                  {section.name || `বিভাগ ${secIndex + 1}`}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <span className={`text-xs font-bold px-2 py-0.5 rounded border ${
                                  secSelectedMarks > section.targetMarks 
                                    ? "bg-rose-50 text-rose-700 border-rose-200" 
                                    : "bg-emerald-50 text-emerald-800 border-emerald-200"
                                }`}>
                                  নম্বর: {toBengaliNumerals(secSelectedMarks)} / {toBengaliNumerals(section.targetMarks)}
                                </span>

                                <button
                                  type="button"
                                  onClick={() => handleMoveSection(secIndex, "up")}
                                  disabled={secIndex === 0}
                                  className="p-1 hover:bg-slate-100 text-slate-600 rounded disabled:opacity-30 cursor-pointer"
                                  title="বিভাগ উপরে নিন"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMoveSection(secIndex, "down")}
                                  disabled={secIndex === sections.length - 1}
                                  className="p-1 hover:bg-slate-100 text-slate-600 rounded disabled:opacity-30 cursor-pointer"
                                  title="বিভাগ নিচে নিন"
                                >
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveSection(section.id)}
                                  className="p-1 hover:bg-red-50 text-red-600 rounded cursor-pointer"
                                  title="বিভাগ মুছে ফেলুন"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Section Name & Target Marks Inputs */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <div className="sm:col-span-2">
                                <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                                  বিভাগের শিরোনাম (Section Title) *
                                </label>
                                <input
                                  type="text"
                                  value={section.name}
                                  onChange={(e) => handleUpdateSection(section.id, "name", e.target.value)}
                                  placeholder="যেমন: ক-বিভাগ: কুরআন ও হাদিস / القسم الأول"
                                  className="w-full text-xs font-bold p-1.5 bg-slate-50 border border-slate-300 rounded focus:ring-1 focus:ring-emerald-500"
                                  dir="auto"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                                  বিভাগের বরাদ্দকৃত নম্বর *
                                </label>
                                <input
                                  type="number"
                                  value={section.targetMarks}
                                  onChange={(e) => handleUpdateSection(section.id, "targetMarks", Number(e.target.value))}
                                  className="w-full text-xs font-bold p-1.5 bg-slate-50 border border-slate-300 rounded focus:ring-1 focus:ring-emerald-500"
                                />
                              </div>
                            </div>

                            {/* Conditional Instruction & Preset Chips */}
                            <div>
                              <label className="block text-[10px] font-bold text-slate-600 mb-0.5 flex items-center justify-between">
                                <span>শর্তযুক্ত নির্দেশনা (Conditional Instruction) *</span>
                                <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1">
                                  <Sparkles className="w-3 h-3" /> প্রিসেট বেছে নিন
                                </span>
                              </label>
                              <input
                                type="text"
                                value={section.instruction}
                                onChange={(e) => handleUpdateSection(section.id, "instruction", e.target.value)}
                                placeholder="যেমন: যেকোনো ৫টি প্রশ্নের উত্তর দাও / ১ নং প্রশ্নসহ যেকোনো ৪টি লিখ..."
                                className="w-full text-xs p-1.5 bg-slate-50 border border-slate-300 rounded focus:ring-1 focus:ring-emerald-500 font-medium text-slate-800"
                                dir="auto"
                              />

                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {INSTRUCTION_PRESETS.slice(0, 6).map((preset, pIdx) => (
                                  <button
                                    key={pIdx}
                                    type="button"
                                    onClick={() => handleUpdateSection(section.id, "instruction", preset)}
                                    className="text-[10px] bg-slate-100 hover:bg-emerald-100 hover:text-emerald-800 text-slate-700 px-2 py-0.5 rounded border border-slate-200 transition cursor-pointer font-medium"
                                  >
                                    {preset}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Questions in this section */}
                            <div className="space-y-3 pt-2">
                              {section.questions.length === 0 ? (
                                <div className="text-center p-4 border border-dashed border-slate-300 rounded-lg text-slate-400 text-xs">
                                  বাম পাশের তালিকা থেকে প্রশ্ন নির্বাচন করে এই বিভাগে যোগ করুন।
                                </div>
                              ) : (
                                section.questions.map((q, qIndex) => {
                                  const isRTL = getQuestionDir(q.question_text) === "rtl";
                                  const questionDisplayIndex = numberingScheme === "continuous" 
                                    ? questionOffset + qIndex 
                                    : qIndex;

                                   return (
                                    <div 
                                      key={`${q.id}-${qIndex}`} 
                                      className="group relative p-2.5 rounded-lg bg-slate-50 border border-slate-200 hover:border-emerald-400 transition"
                                    >
                                      <SpecializedQuestionView
                                        question={q}
                                        index={questionDisplayIndex}
                                        isRTL={isRTL}
                                        formatNumber={formatQuestionNumber}
                                        isPrint={false}
                                      />

                                      {/* Visible card bottom bar with quick Swap action */}
                                      <div className="mt-2 pt-1.5 border-t border-slate-200/70 flex items-center justify-between text-xs">
                                        <span className="text-[11px] text-slate-500 font-medium">
                                          প্রশ্ন নং {formatQuestionNumber(questionDisplayIndex, isRTL)} • {toBengaliNumerals(q.marks || 10)} নম্বর
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => handleOpenSwapModal(q, section.name)}
                                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-blue-700 bg-blue-50/90 hover:bg-blue-100 hover:text-blue-900 border border-blue-200/90 rounded-md transition cursor-pointer"
                                        >
                                          <ArrowLeftRight className="w-3.5 h-3.5 text-blue-600" />
                                          <span>বিকল্প প্রশ্ন দিয়ে পরিবর্তন (Swap)</span>
                                        </button>
                                      </div>

                                      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1.5 absolute right-2 top-2 bg-white/95 backdrop-blur-sm p-1 rounded-md shadow-sm border border-slate-200 z-10">
                                        <button
                                          type="button"
                                          onClick={() => handleOpenSwapModal(q, section.name)}
                                          className="p-1 px-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded flex items-center gap-1 text-[10px] font-bold border border-blue-200 cursor-pointer transition shadow-2xs"
                                          title="প্রশ্নব্যাংকের বিকল্প প্রশ্ন দিয়ে পরিবর্তন (Swap) করুন"
                                        >
                                          <ArrowLeftRight className="w-3 h-3 text-blue-600" />
                                          <span>সোয়াপ</span>
                                        </button>

                                        {sections.length > 1 && (
                                          <select
                                            value={section.id}
                                            onChange={(e) => handleMoveQuestionBetweenSections(q.id, section.id, e.target.value)}
                                            className="text-[10px] p-0.5 border border-slate-300 rounded bg-white text-slate-700 outline-none"
                                            title="অন্য বিভাগে স্থানান্তর করুন"
                                          >
                                            {sections.map(s => (
                                              <option key={s.id} value={s.id}>
                                                স্থানান্তর: {s.name.split(":")[0] || s.name}
                                              </option>
                                            ))}
                                          </select>
                                        )}

                                        <button
                                          type="button"
                                          onClick={() => handleMoveQuestionInSec(section.id, qIndex, "up")}
                                          disabled={qIndex === 0}
                                          className="p-1 hover:bg-slate-100 text-slate-600 rounded disabled:opacity-30 cursor-pointer"
                                          title="উপরে নিন"
                                        >
                                          <ArrowUp className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleMoveQuestionInSec(section.id, qIndex, "down")}
                                          disabled={qIndex === section.questions.length - 1}
                                          className="p-1 hover:bg-slate-100 text-slate-600 rounded disabled:opacity-30 cursor-pointer"
                                          title="নিচে নিন"
                                        >
                                          <ArrowDown className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveQuestionFromSec(section.id, q.id)}
                                          className="p-1 hover:bg-red-50 text-red-600 rounded cursor-pointer"
                                          title="বাদ দিন"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
                        {unsectionedQuestions.length === 0 ? (
                          <div className="text-center p-8 text-slate-400 text-xs">
                            বাম পাশের প্রশ্নব্যাংক থেকে প্রশ্ন নির্বাচন করে যোগ করুন।
                          </div>
                        ) : (
                          unsectionedQuestions.map((q, idx) => {
                            const isRTL = getQuestionDir(q.question_text) === "rtl";
                            return (
                              <div key={`${q.id}-${idx}`} className="group relative p-2.5 rounded-lg bg-slate-50 border border-slate-200 hover:border-emerald-400 transition">
                                <SpecializedQuestionView
                                  question={q}
                                  index={idx}
                                  isRTL={isRTL}
                                  formatNumber={formatQuestionNumber}
                                  isPrint={false}
                                />

                                {/* Card bottom bar with quick Swap action */}
                                <div className="mt-2 pt-1.5 border-t border-slate-200/70 flex items-center justify-between text-xs">
                                  <span className="text-[11px] text-slate-500 font-medium">
                                    প্রশ্ন নং {formatQuestionNumber(idx, isRTL)} • {toBengaliNumerals(q.marks || 10)} নম্বর
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenSwapModal(q)}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-blue-700 bg-blue-50/90 hover:bg-blue-100 hover:text-blue-900 border border-blue-200/90 rounded-md transition cursor-pointer"
                                  >
                                    <ArrowLeftRight className="w-3.5 h-3.5 text-blue-600" />
                                    <span>বিকল্প প্রশ্ন দিয়ে পরিবর্তন (Swap)</span>
                                  </button>
                                </div>

                                <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1.5 absolute right-2 top-2 bg-white/95 backdrop-blur-sm p-1 rounded-md shadow-sm border border-slate-200 z-10">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenSwapModal(q)}
                                    className="p-1 px-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded flex items-center gap-1 text-[10px] font-bold border border-blue-200 cursor-pointer transition shadow-2xs"
                                    title="প্রশ্নব্যাংকের বিকল্প প্রশ্ন দিয়ে পরিবর্তন (Swap) করুন"
                                  >
                                    <ArrowLeftRight className="w-3 h-3 text-blue-600" />
                                    <span>সোয়াপ</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (idx === 0) return;
                                      const newQ = [...unsectionedQuestions];
                                      const temp = newQ[idx - 1];
                                      newQ[idx - 1] = newQ[idx];
                                      newQ[idx] = temp;
                                      setUnsectionedQuestions(newQ);
                                    }}
                                    disabled={idx === 0}
                                    className="p-1 text-slate-500 hover:bg-slate-200 rounded disabled:opacity-30"
                                    title="উপরে নিন"
                                  >
                                    <ArrowUp className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (idx === unsectionedQuestions.length - 1) return;
                                      const newQ = [...unsectionedQuestions];
                                      const temp = newQ[idx + 1];
                                      newQ[idx + 1] = newQ[idx];
                                      newQ[idx] = temp;
                                      setUnsectionedQuestions(newQ);
                                    }}
                                    disabled={idx === unsectionedQuestions.length - 1}
                                    className="p-1 text-slate-500 hover:bg-slate-200 rounded disabled:opacity-30"
                                    title="নিচে নিন"
                                  >
                                    <ArrowDown className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleQuestion(q)}
                                    className="p-1 text-red-500 hover:bg-red-50 rounded"
                                    title="বাদ দিন"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 2: Design Templates & Print Configurations */}
                {activeTab === "design" && (
                  <div className="space-y-5">
                    {/* 1. Two-Column Compact Paper Layout */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Columns className="w-4 h-4 text-emerald-600" />
                          <h4 className="text-sm font-bold text-slate-900">২-কলাম কমপ্যাক্ট লেআউট (Two-Column Paper)</h4>
                        </div>
                        <span className="text-[11px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                          খরচ সাশ্রয়ী কওমি ফরম্যাট
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        কাগজ ও প্রিন্ট খরচ সাশ্রয় করতে কওমি মাদ্রাসার চিরচেনা ২-কলাম স্ট্যান্ডার্ড প্রশ্নপত্র ফরম্যাট নির্বাচন করুন।
                      </p>

                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <button
                          type="button"
                          onClick={() => setColumnLayout("2_column")}
                          className={`p-3 rounded-lg border-2 text-left transition cursor-pointer flex flex-col justify-between ${
                            columnLayout === "2_column"
                              ? "border-emerald-600 bg-emerald-50/50"
                              : "border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="font-extrabold text-xs text-slate-900 flex items-center gap-1.5">
                              <Columns className="w-4 h-4 text-emerald-600" />
                              ২-কলাম কমপ্যাক্ট ফরম্যাট
                            </span>
                            {columnLayout === "2_column" && <Check className="w-4 h-4 text-emerald-600" />}
                          </div>
                          <span className="text-[11px] text-slate-500">
                            কাগজ ও প্রিন্টিং খরচ ৫০% সাশ্রয় করে
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setColumnLayout("1_column")}
                          className={`p-3 rounded-lg border-2 text-left transition cursor-pointer flex flex-col justify-between ${
                            columnLayout === "1_column"
                              ? "border-emerald-600 bg-emerald-50/50"
                              : "border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="font-extrabold text-xs text-slate-900 flex items-center gap-1.5">
                              <LayoutTemplate className="w-4 h-4 text-slate-600" />
                              ১-কলাম স্ট্যান্ডার্ড (ফুল উইডথ)
                            </span>
                            {columnLayout === "1_column" && <Check className="w-4 h-4 text-emerald-600" />}
                          </div>
                          <span className="text-[11px] text-slate-500">
                            খোলামেলা পূর্ণ পৃষ্ঠাব্যাপী প্রশ্নপত্র
                          </span>
                        </button>
                      </div>

                      {columnLayout === "2_column" && (
                        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                          <label className="text-xs font-bold text-slate-700">কলামের মধ্যবর্তী ডিভাইডার রেখা:</label>
                          <div className="flex items-center gap-1">
                            {(["solid", "dashed", "double", "none"] as ColumnDivider[]).map((divider) => (
                              <button
                                key={divider}
                                type="button"
                                onClick={() => setColumnDivider(divider)}
                                className={`px-2.5 py-1 text-xs font-semibold rounded border transition cursor-pointer ${
                                  columnDivider === divider
                                    ? "bg-emerald-600 text-white border-emerald-600"
                                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                                }`}
                              >
                                {divider === "solid" ? "সলিড রেখা" :
                                 divider === "dashed" ? "ড্যাশড রেখা" :
                                 divider === "double" ? "ডাবল রেখা" : "ফাঁকা (None)"}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 2. Islamic Header & Calligraphy */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-emerald-600" />
                          <h4 className="text-sm font-bold text-slate-900">ইসলামিক হেডার ও ক্যালিগ্রাফি (Calligraphy)</h4>
                        </div>
                        <span className="text-[11px] bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded-full">
                          আরবি অলঙ্করণ
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {[
                          { id: "ornate_frame", label: "অলংকৃত ফ্রেম বিসমিল্লাহ", sample: "﴿ بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ ﴾" },
                          { id: "bismillah_hamd", label: "বিসমিল্লাহ + দরূদ ও হামদ", sample: "بِسْمِ اللهِ • نَحْمَدُهُ وَنُصَلِّيْ..." },
                          { id: "thuluth_classic", label: "সুলুস ক্লাসিক ক্যালিগ্রাফি", sample: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ" },
                          { id: "riqa_simple", label: "সরল নসখ বিসমিল্লাহ", sample: "بسم الله الرحمن الرحيم" },
                          { id: "none", label: "কোনো ক্যালিগ্রাফি নয় (ফাঁকা)", sample: "—" },
                        ].map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setCalligraphyStyle(item.id as CalligraphyStyle)}
                            className={`p-2.5 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between ${
                              calligraphyStyle === item.id
                                ? "border-emerald-600 bg-emerald-50/50"
                                : "border-slate-200 hover:border-slate-300"
                            }`}
                          >
                            <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                              <span>{item.label}</span>
                              {calligraphyStyle === item.id && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                            </div>
                            <div className="font-amiri text-xs text-slate-700 mt-1 truncate" dir="rtl">
                              {item.sample}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 3. Madrasa Monogram / Logo Settings */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ImageIcon className="w-4 h-4 text-emerald-600" />
                          <h4 className="text-sm font-bold text-slate-900">মাদ্রাসার নিজস্ব মনোগ্রাম / লোগো (Monogram / Logo)</h4>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                          <input
                            type="checkbox"
                            checked={showLogo}
                            onChange={(e) => setShowLogo(e.target.checked)}
                            className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                          />
                          <span>লোগো প্রদর্শন</span>
                        </label>
                      </div>

                      {showLogo && (
                        <div className="space-y-3 pt-1">
                          {/* Logo Position & Size */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-bold text-slate-700 mb-1">লোগোর অবস্থান (Position)</label>
                              <select
                                value={logoPosition}
                                onChange={(e) => setLogoPosition(e.target.value as LogoPosition)}
                                className="w-full p-2 border border-slate-300 rounded-lg text-xs font-semibold bg-white"
                              >
                                <option value="left">বামে (Left Align)</option>
                                <option value="center_top">মাঝে সবার উপরে (Center Top)</option>
                                <option value="right">ডানে (Right Align)</option>
                                <option value="dual">উভয় পাশে (Dual Crests)</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-xs font-bold text-slate-700 mb-1">লোগোর আকার (Size)</label>
                              <div className="flex items-center gap-2">
                                {(["sm", "md", "lg"] as ("sm" | "md" | "lg")[]).map((size) => (
                                  <button
                                    key={size}
                                    type="button"
                                    onClick={() => setLogoSize(size)}
                                    className={`flex-1 py-1.5 text-xs font-bold rounded border transition cursor-pointer ${
                                      logoSize === size
                                        ? "bg-emerald-600 text-white border-emerald-600"
                                        : "bg-white text-slate-700 border-slate-200"
                                    }`}
                                  >
                                    {size === "sm" ? "ছোট" : size === "md" ? "মাঝারি" : "বড়"}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Logo File Upload or URL */}
                          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-xs font-bold text-slate-800">মনোগ্রাম ইমেজ ফাইল / লিংক:</span>
                              {logoUrl && (
                                <button
                                  type="button"
                                  onClick={() => setLogoUrl("")}
                                  className="text-[11px] text-red-600 hover:underline cursor-pointer"
                                >
                                  রিসেট করে সিল ব্যবহার করুন
                                </button>
                              )}
                            </div>

                            <div className="flex flex-col sm:flex-row items-center gap-2">
                              <label className="flex items-center justify-center gap-2 px-3 py-2 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition cursor-pointer text-xs font-bold text-slate-800 shadow-xs shrink-0 w-full sm:w-auto">
                                <Upload className="w-3.5 h-3.5 text-emerald-600" />
                                <span>কম্পিউটার/মোবাইল থেকে আপলোড</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={handleLogoUpload}
                                  className="hidden"
                                />
                              </label>

                              <input
                                type="text"
                                value={logoUrl}
                                onChange={(e) => setLogoUrl(e.target.value)}
                                placeholder="বা অনলাইন ছবির URL পেস্ট করুন..."
                                className="flex-1 p-2 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:ring-1 focus:ring-emerald-500 w-full"
                              />
                            </div>
                            <p className="text-[10px] text-slate-500">
                              * কোনো কাস্টম ছবি আপলোড না থাকলে স্বয়ংক্রিয়ভাবে মাদ্রাসার ঐতিহ্যবাহী গোল্ডেন-ব্ল্যাক সিল/ক্রেস্ট প্রদর্শিত হবে।
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 4. Islamic Marginal Borders & Frames */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <LayoutTemplate className="w-4 h-4 text-emerald-600" />
                          <h4 className="text-sm font-bold text-slate-900">ইসলামিক বর্ডার / মার্জিনাল ফ্রেম (Paper Border)</h4>
                        </div>
                        <span className="text-[11px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                          প্রথাগত কওমি ফ্রেম
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        প্রশ্নপত্রের চারদিকে ঐতিহ্যবাহী মার্জিনাল ফ্রেম বা ডাবল বর্ডার যোগ করার অপশন।
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        {[
                          { id: "double_classic", label: "ঐতিহ্যবাহী ডাবল বর্ডার (কওমি ক্লাসিক)", desc: "বোর্ড ও মাদ্রাসার সবচেয়ে মানানসই ডাবল লাইন" },
                          { id: "islamic_corner", label: "ইসলামিক কর্নার ফ্রেম (۞ চিহ্ন সহ)", desc: "চার কোণে জ্যামিতিক অলঙ্করণ সহ মার্জিন" },
                          { id: "decorative_vintage", label: "ভিন্টেজ কিতাব ডাবল ফ্রেম", desc: "ভেতরে ড্যাশড ও বাইরে সলিড ডাবল ফ্রেম" },
                          { id: "simple_box", label: "ক্লিন সিঙ্গেল বক্স ফ্রেম", desc: "আধুনিক ও পরিপাটি একক রেখা ফ্রেম" },
                          { id: "none", label: "কোনো বর্ডার নেই (স্বাভাবিক মার্জিন)", desc: "বর্ডার ছাড়া খোলা মার্জিন" },
                        ].map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setBorderStyle(item.id as BorderStyle)}
                            className={`p-2.5 rounded-lg border text-left transition cursor-pointer flex flex-col justify-between ${
                              borderStyle === item.id
                                ? "border-emerald-600 bg-emerald-50/50"
                                : "border-slate-200 hover:border-slate-300"
                            }`}
                          >
                            <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                              <span>{item.label}</span>
                              {borderStyle === item.id && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                            </div>
                            <span className="text-[11px] text-slate-500 mt-0.5">{item.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 5. Paper Size & Page Configuration */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-emerald-600" />
                          <h4 className="text-sm font-bold text-slate-900">কাগজের সাইজ ও ওরিয়েন্টেশন (Paper Size)</h4>
                        </div>
                        <span className="text-[11px] bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded-full">
                          A4 / Legal / Folio
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        {/* Paper Size selector */}
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">কাগজের সাইজ নির্বাচন</label>
                          <div className="space-y-1.5">
                            {[
                              { id: "a4", title: "A4 সাইজ (210 × 297 mm)", desc: "দৈনন্দিন ও স্ট্যান্ডার্ড পরীক্ষা" },
                              { id: "legal", title: "লিগ্যাল সাইজ (Legal 8.5 × 14 in)", desc: "কওমি মাদ্রাসার দীর্ঘ প্রশ্নপত্রের প্রধান পছন্দ" },
                              { id: "folio", title: "ফোলিও সাইজ (Folio 8.5 × 13 in)", desc: "লিথো প্রেস ও মাদ্রাসার সনাতন সাইজ" },
                            ].map((ps) => (
                              <button
                                key={ps.id}
                                type="button"
                                onClick={() => setPaperSize(ps.id as PaperSize)}
                                className={`w-full p-2 rounded-lg border text-left transition cursor-pointer flex items-center justify-between ${
                                  paperSize === ps.id
                                    ? "border-emerald-600 bg-emerald-50/50"
                                    : "border-slate-200 hover:border-slate-300"
                                }`}
                              >
                                <div>
                                  <div className="text-xs font-bold text-slate-900">{ps.title}</div>
                                  <div className="text-[10px] text-slate-500">{ps.desc}</div>
                                </div>
                                {paperSize === ps.id && <Check className="w-4 h-4 text-emerald-600" />}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Orientation & Spacing */}
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">পৃষ্ঠার দিক (Orientation)</label>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => setPaperOrientation("portrait")}
                                className={`p-2 rounded-lg border text-center transition cursor-pointer text-xs font-bold ${
                                  paperOrientation === "portrait"
                                    ? "border-emerald-600 bg-emerald-50 text-emerald-900"
                                    : "border-slate-200 text-slate-700 hover:bg-slate-50"
                                }`}
                              >
                                ↕️ লম্বালম্বি (Portrait)
                              </button>
                              <button
                                type="button"
                                onClick={() => setPaperOrientation("landscape")}
                                className={`p-2 rounded-lg border text-center transition cursor-pointer text-xs font-bold ${
                                  paperOrientation === "landscape"
                                    ? "border-emerald-600 bg-emerald-50 text-emerald-900"
                                    : "border-slate-200 text-slate-700 hover:bg-slate-50"
                                }`}
                              >
                                ↔️ আড়াআড়ি (Landscape)
                              </button>
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">স্পেসিং মোড</label>
                            <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer text-xs font-medium text-slate-800">
                              <input
                                type="checkbox"
                                checked={compactSpacing}
                                onChange={(e) => setCompactSpacing(e.target.checked)}
                                className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                              />
                              <span>কমপ্যাক্ট স্পেসিং (কাগজ সাশ্রয়ে ঘন টেক্সট বিন্যাস)</span>
                            </label>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">ফন্ট ও আরবি স্ক্রিপ্ট</label>
                            <select
                              value={selectedFont}
                              onChange={(e) => setSelectedFont(e.target.value)}
                              className="w-full p-2 border border-slate-300 rounded-lg text-xs font-semibold bg-white"
                            >
                              <option value="font-solaiman">সোলাইমান লিপি (SolaimanLipi - স্ট্যান্ডার্ড)</option>
                              <option value="font-shorif">শরীফ শিশির (ShorifShishir)</option>
                              <option value="font-hindsiliguri">হিন্দ শিলিগুড়ি (Hind Siliguri)</option>
                              <option value="font-amiri">আমিরি নসখ (Amiri Quranic)</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 3: Live Sheet Preview */}
                {activeTab === "preview" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-slate-200">
                      <div className="text-xs font-bold text-slate-800 flex items-center gap-2">
                        <Eye className="w-4 h-4 text-emerald-600" />
                        <span>প্রিন্ট শিট লাইভ প্রিভিউ ({paperSize.toUpperCase()} • {columnLayout === "2_column" ? "২-কলাম" : "১-কলাম"})</span>
                      </div>
                      <button
                        type="button"
                        onClick={handlePrint}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>এখনই প্রিন্ট করুন</span>
                      </button>
                    </div>

                    {/* Paper Preview Canvas */}
                    <div className="bg-slate-300 p-4 sm:p-6 rounded-xl overflow-x-auto">
                      <div className={`mx-auto bg-white shadow-2xl rounded-sm ${selectedFont} ${
                        paperSize === "legal" ? "max-w-2xl min-h-[900px]" : "max-w-xl min-h-[750px]"
                      }`}>
                        <PaperFrameWrapper borderStyle={borderStyle}>
                          <MadrasaPaperHeader
                            customMadrasaName={customMadrasaName}
                            examName={examName}
                            selectedClassName={selectedClassName}
                            selectedSubjectName={selectedSubjectName}
                            examTime={examTime}
                            totalMarks={totalMarks}
                            showLogo={showLogo}
                            logoUrl={logoUrl}
                            logoPosition={logoPosition}
                            logoSize={logoSize}
                            calligraphyStyle={calligraphyStyle}
                            paperInstructions={paperInstructions}
                            toBengaliNumerals={toBengaliNumerals}
                          />

                          {/* Paper Body: 1-Column or 2-Column */}
                          <div className={`${columnClasses} ${dividerClasses}`}>
                            {isSectioned ? (
                              sections.map((section, secIndex) => {
                                let questionOffset = 0;
                                if (numberingScheme === "continuous") {
                                  for (let i = 0; i < secIndex; i++) {
                                    questionOffset += sections[i].questions.length;
                                  }
                                }

                                return (
                                  <div key={section.id} className="mb-4">
                                    <div className="qawmi-section-header text-center border-y-2 border-black py-1 my-2">
                                      <div className="font-extrabold text-sm text-black" dir="auto">
                                        【 {section.name} 】 {section.targetMarks ? `(পূর্ণমান: ${toBengaliNumerals(section.targetMarks)})` : ""}
                                      </div>
                                      {section.instruction && (
                                        <div className="text-[11px] font-semibold mt-0.5 italic text-black" dir="auto">
                                          [{section.instruction}]
                                        </div>
                                      )}
                                    </div>

                                    {section.questions.map((q, qIndex) => {
                                      const isRTL = getQuestionDir(q.question_text) === "rtl";
                                      const questionDisplayIndex = numberingScheme === "continuous" 
                                        ? questionOffset + qIndex 
                                        : qIndex;

                                      return (
                                        <div key={`${q.id}-${qIndex}`} className="qawmi-question-item relative group/live">
                                          <SpecializedQuestionView
                                            question={q}
                                            index={questionDisplayIndex}
                                            isRTL={isRTL}
                                            formatNumber={formatQuestionNumber}
                                            isPrint={true}
                                          />
                                          <div className="opacity-0 group-hover/live:opacity-100 transition-opacity absolute right-0 -top-2 print:hidden flex items-center gap-1 z-20 bg-white/95 backdrop-blur-xs shadow-xs px-2 py-0.5 rounded-full border border-blue-300">
                                            <button
                                              type="button"
                                              onClick={() => handleOpenSwapModal(q, section.name)}
                                              className="text-[10px] font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1 cursor-pointer"
                                              title="বিকল্প প্রশ্ন দিয়ে পরিবর্তন (Swap) করুন"
                                            >
                                              <ArrowLeftRight className="w-3 h-3 text-blue-600" />
                                              <span>সোয়াপ</span>
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              })
                            ) : (
                              unsectionedQuestions.map((q, idx) => {
                                const isRTL = getQuestionDir(q.question_text) === "rtl";
                                return (
                                  <div key={idx} className="qawmi-question-item relative group/live">
                                    <SpecializedQuestionView
                                      question={q}
                                      index={idx}
                                      isRTL={isRTL}
                                      formatNumber={formatQuestionNumber}
                                      isPrint={true}
                                    />
                                    <div className="opacity-0 group-hover/live:opacity-100 transition-opacity absolute right-0 -top-2 print:hidden flex items-center gap-1 z-20 bg-white/95 backdrop-blur-xs shadow-xs px-2 py-0.5 rounded-full border border-blue-300">
                                      <button
                                        type="button"
                                        onClick={() => handleOpenSwapModal(q)}
                                        className="text-[10px] font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1 cursor-pointer"
                                        title="বিকল্প প্রশ্ন দিয়ে পরিবর্তন (Swap) করুন"
                                      >
                                        <ArrowLeftRight className="w-3 h-3 text-blue-600" />
                                        <span>সোয়াপ</span>
                                      </button>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </PaperFrameWrapper>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white p-12 text-center rounded-xl shadow-sm border border-slate-200">
            <FileSignature className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-700">শ্রেণি ও বিষয় নির্বাচন করুন</h3>
            <p className="text-slate-500 text-sm mt-1">উপরে শ্রেণি এবং বিষয় নির্বাচন করলে বিভাগভিত্তিক প্রশ্নপত্র প্রস্তুত ও কাস্টমাইজ করা যাবে।</p>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* Printable Layout: Visible ONLY when printing (window.print())            */}
      {/* ========================================================================= */}
      <div 
        id="exam-paper-print-view" 
        className={`hidden print:block print:w-full print:bg-white print:text-black print:p-0 print:m-0 ${selectedFont}`}
      >
        <PaperFrameWrapper borderStyle={borderStyle} className="w-full">
          <MadrasaPaperHeader
            customMadrasaName={customMadrasaName}
            examName={examName}
            selectedClassName={selectedClassName}
            selectedSubjectName={selectedSubjectName}
            examTime={examTime}
            totalMarks={totalMarks}
            showLogo={showLogo}
            logoUrl={logoUrl}
            logoPosition={logoPosition}
            logoSize={logoSize}
            calligraphyStyle={calligraphyStyle}
            paperInstructions={paperInstructions}
            toBengaliNumerals={toBengaliNumerals}
          />

          {/* Section Wise Question Paper Output with 1-Column or 2-Column */}
          <div className={`${columnClasses} ${dividerClasses}`}>
            {isSectioned ? (
              sections.map((section, secIndex) => {
                let questionOffset = 0;
                if (numberingScheme === "continuous") {
                  for (let i = 0; i < secIndex; i++) {
                    questionOffset += sections[i].questions.length;
                  }
                }

                return (
                  <div key={section.id} className="mb-4">
                    {/* Section Header Ornamentation */}
                    <div className="qawmi-section-header text-center border-y-2 border-black py-1 my-2.5">
                      <div className="font-extrabold text-base" dir="auto">
                        【 {section.name} 】 {section.targetMarks ? `(পূর্ণমান: ${toBengaliNumerals(section.targetMarks)})` : ""}
                      </div>
                      {section.instruction && (
                        <div className="text-xs font-semibold mt-0.5 italic" dir="auto">
                          [{section.instruction}]
                        </div>
                      )}
                    </div>

                    {/* Section Questions */}
                    {section.questions.map((q, qIndex) => {
                      const isRTL = getQuestionDir(q.question_text) === "rtl";
                      const questionDisplayIndex = numberingScheme === "continuous" 
                        ? questionOffset + qIndex 
                        : qIndex;

                      return (
                        <div key={`${q.id}-${qIndex}`} className="qawmi-question-item">
                          <SpecializedQuestionView
                            question={q}
                            index={questionDisplayIndex}
                            isRTL={isRTL}
                            formatNumber={formatQuestionNumber}
                            isPrint={true}
                          />
                        </div>
                      );
                    })}
                  </div>
                );
              })
            ) : (
              /* Unsectioned Standard Output */
              unsectionedQuestions.map((q, idx) => {
                const isRTL = getQuestionDir(q.question_text) === "rtl";
                return (
                  <div key={idx} className="qawmi-question-item">
                    <SpecializedQuestionView
                      question={q}
                      index={idx}
                      isRTL={isRTL}
                      formatNumber={formatQuestionNumber}
                      isPrint={true}
                    />
                  </div>
                );
              })
            )}
          </div>
        </PaperFrameWrapper>
      </div>

      {/* 1-Click Smart Auto-Paper Blueprint Modal */}
      <AutoPaperBlueprintModal
        isOpen={isAutoBlueprintModalOpen}
        onClose={() => setIsAutoBlueprintModalOpen(false)}
        onGenerate={(bp: AutoPaperBlueprint) => executeBlueprintGeneration(bp, availableQuestions)}
        currentSubjectName={subjects.find(s => s.id === subjectId)?.name || ""}
        currentClassName={classes.find(c => c.id === classId)?.name || ""}
        totalAvailableQuestions={availableQuestions.length}
      />

      {/* Question Swap Modal */}
      {swapTargetQuestion && (
        <QuestionSwapModal
          isOpen={isSwapModalOpen}
          onClose={() => {
            setIsSwapModalOpen(false);
            setSwapTargetQuestion(null);
          }}
          targetQuestion={swapTargetQuestion}
          targetSectionName={swapTargetSectionName}
          availableQuestions={availableQuestions}
          currentlyUsedQuestionIds={currentlyUsedQuestionIds}
          onSwap={(oldId: string, newQ: any) => handleSwapQuestion(oldId, newQ)}
          onQuickAddAndSwap={handleQuickAddAndSwap}
        />
      )}

      {/* Clone From Past Papers Modal */}
      <CloneFromPastModal
        isOpen={isCloneFromPastModalOpen}
        onClose={() => setIsCloneFromPastModalOpen(false)}
        currentExamId={examId}
        currentClassId={classId}
        currentSubjectId={subjectId}
        classes={classes}
        subjects={subjects}
        onApplyPastPaper={handleApplyPastPaper}
      />
    </div>
  );
}
