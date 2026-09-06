"use client";

import React, { useState, useRef } from "react";
import { 
  FileSpreadsheet, 
  Upload, 
  FileText, 
  X, 
  Sparkles, 
  Check, 
  Trash2, 
  Plus, 
  AlertCircle, 
  Loader2, 
  Download, 
  BookOpen, 
  Layers,
  ArrowRight,
  Info
} from "lucide-react";
import * as XLSX from "xlsx";
import { bulkSaveQuestions } from "@/app/actions/questions";
import { toBengaliNumerals, isArabicText } from "@/lib/utils";

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  classes: any[];
  subjects: any[];
  onSuccess: (count: number) => void;
  defaultClassId?: string;
  defaultSubjectId?: string;
}

interface ParsedQuestionItem {
  id: string;
  question_text: string;
  question_type: string;
  marks: number;
  chapter: string;
  difficulty: "easy" | "medium" | "hard";
  options?: any;
  isValid: boolean;
}

export default function BulkImportModal({
  isOpen,
  onClose,
  classes,
  subjects,
  onSuccess,
  defaultClassId = "",
  defaultSubjectId = "",
}: BulkImportModalProps) {
  const [activeTab, setActiveTab] = useState<"paste" | "excel">("paste");
  
  // Global settings to apply to all imported questions
  const [selectedClassId, setSelectedClassId] = useState(defaultClassId);
  const [selectedSubjectId, setSelectedSubjectId] = useState(defaultSubjectId);
  const [globalChapter, setGlobalChapter] = useState("");
  const [globalDifficulty, setGlobalDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [globalMarks, setGlobalMarks] = useState<number>(10);
  const [globalType, setGlobalType] = useState<string>("Broad");

  // Raw text input for pasting
  const [rawText, setRawText] = useState("");
  const [parseDelimiter, setParseDelimiter] = useState<"auto" | "numbered" | "line" | "double_line">("auto");

  // Parsed questions table for preview & editing
  const [parsedQuestions, setParsedQuestions] = useState<ParsedQuestionItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Preset chapter suggestions based on common Qawmi kithabs
  const commonQawmiChapters = [
    "كتاب الإيمان والعقيدة (ঈমান ও আকীদা)",
    "كتاب الطهارة (পবিত্রতা)",
    "كتاب الصلاة (নামাজ)",
    "كتاب الزكاة (যাকাত)",
    "كتاب الصوم (রোজা)",
    "كتاب الحج (হজ)",
    "كتاب النكاح والطلاق (বিবাহ ও তালাক)",
    "كتاب البيوع والمعاملات (ব্যবসা ও লেনদেন)",
    "باب العوامل والمفاعيل (নাহু)",
    "علم الصرف والإعلال (ছরফ)",
    "أصول الحديث والتفسير (উসূলে হাদীস ও তাফসীর)",
    "ديوان الحماسة والمتنبي (আদব ও বালাগাত)"
  ];

  // Helper parser for pasted text
  const handleParseText = () => {
    if (!rawText.trim()) {
      setErrorMessage("অনুগ্রহ করে কিছু টেক্সট পেস্ট করুন।");
      return;
    }
    setErrorMessage("");

    const text = rawText.trim();
    let rawItems: string[] = [];

    if (parseDelimiter === "line") {
      rawItems = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
    } else if (parseDelimiter === "double_line") {
      rawItems = text.split(/\n\s*\n/).map(l => l.trim()).filter(l => l.length > 0);
    } else {
      // Auto or numbered list parsing
      // Handles: 1. 2. or ১. ২. or ১) ২) or ১/ ২/ or ١. ٢. or - or * or [১]
      const numberedRegex = /(?:^|\n)(?:\d+|[\u09E6-\u09EF]+|[\u0660-\u0669]+|[ক-ঙ])[\.\)\/\-]\s+/g;
      
      const parts = text.split(/(?:^|\n)(?=(?:\d+|[\u09E6-\u09EF]+|[\u0660-\u0669]+|[ক-ঙ])[\.\)\/\-]\s+)/g);
      if (parts.length > 1) {
        rawItems = parts.map(p => p.trim()).filter(p => p.length > 0);
      } else {
        // Fallback: Split by double newline or single newline if double newline produces 1 item
        const doubleLines = text.split(/\n\s*\n/).map(l => l.trim()).filter(l => l.length > 0);
        if (doubleLines.length > 1) {
          rawItems = doubleLines;
        } else {
          rawItems = text.split("\n").map(l => l.trim()).filter(l => l.length > 0);
        }
      }
    }

    const items: ParsedQuestionItem[] = rawItems.map((raw, idx) => {
      // Clean leading numbering like "১. ", "1. ", "١. "
      let cleanedText = raw.replace(/^(?:\d+|[\u09E6-\u09EF]+|[\u0660-\u0669]+|[ক-ঙ])[\.\)\/\-]\s*/, "").trim();
      
      // Auto-detect question type if hints exist
      let detectedType = globalType;
      let detectedMarks = globalMarks;
      let detectedDifficulty: "easy" | "medium" | "hard" = globalDifficulty;
      let detectedChapter = globalChapter;

      // Detect [ইবারত/এরাব/Irab]
      if (/إعراب|ইবারত|এরাব|হরকত|তারকীব/i.test(cleanedText)) {
        detectedType = "Irab";
      } else if (/تحقيق|ছরফ|তাহকীক|সিগাহ|মাদ্দা/i.test(cleanedText)) {
        detectedType = "Tahqeeq";
      } else if (/شعر|নযম|শের|শ্লোক|কবিতা|বায়েত/i.test(cleanedText)) {
        detectedType = "Sher";
      } else if (/مسألة|সুরতহাল|মাসআলা|ফতোয়া/i.test(cleanedText)) {
        detectedType = "Masala";
      } else if (cleanedText.length < 60 && !cleanedText.includes("\n")) {
        detectedType = "Short";
        detectedMarks = 5;
      }

      // Check if marks are embedded like "(১০)", "[10]"
      const marksMatch = cleanedText.match(/[\(\[\{](\d+|[\u09E6-\u09EF]+)[\)\]\}]\s*$/);
      if (marksMatch) {
        const numStr = marksMatch[1];
        // Convert bengali digits if present
        const parsedNum = parseInt(numStr.replace(/[০-৯]/g, d => "০১২৩৪৫৬৭৮৯".indexOf(d).toString()), 10);
        if (!isNaN(parsedNum) && parsedNum > 0) {
          detectedMarks = parsedNum;
        }
      }

      return {
        id: `parsed-${Date.now()}-${idx}`,
        question_text: cleanedText,
        question_type: detectedType,
        marks: detectedMarks,
        chapter: detectedChapter,
        difficulty: detectedDifficulty,
        isValid: cleanedText.length > 2,
      };
    });

    setParsedQuestions(items);
  };

  // Excel / CSV File parser using XLSX
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage("");
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const data: any[] = XLSX.utils.sheet_to_json(ws, { header: 1 });

        if (!data || data.length < 1) {
          setErrorMessage("এক্সেল ফাইলে কোনো ডাটা পাওয়া যায়নি।");
          return;
        }

        // Check if first row is header
        let startIndex = 0;
        const firstRow = data[0] || [];
        const isHeader = firstRow.some((cell: any) => 
          typeof cell === "string" && /question|প্রশ্ন|text|marks|নম্বর|type|ধরণ|chapter|অধ্যায়|বাব|difficulty|মান/i.test(cell)
        );

        if (isHeader) {
          startIndex = 1;
        }

        const items: ParsedQuestionItem[] = [];

        for (let i = startIndex; i < data.length; i++) {
          const row = data[i];
          if (!row || row.length === 0) continue;

          // Expecting columns:
          // Col 0: Question Text (required)
          // Col 1: Type (optional, default Broad)
          // Col 2: Marks (optional, default 10)
          // Col 3: Chapter / Bab (optional)
          // Col 4: Difficulty (easy/medium/hard) (optional)
          const qText = String(row[0] || "").trim();
          if (!qText) continue;

          const qTypeRaw = String(row[1] || "").trim();
          let qType = globalType;
          if (/irab|ইবারত|এরাব/i.test(qTypeRaw)) qType = "Irab";
          else if (/tahqeeq|তাহকীক|ছরফ/i.test(qTypeRaw)) qType = "Tahqeeq";
          else if (/sher|শের|নযম/i.test(qTypeRaw)) qType = "Sher";
          else if (/masala|মাসআলা/i.test(qTypeRaw)) qType = "Masala";
          else if (/short|সংক্ষিপ্ত/i.test(qTypeRaw)) qType = "Short";
          else if (/mcq|বহুনির্বাচনী/i.test(qTypeRaw)) qType = "MCQ";
          else if (/broad|রচনামূলক/i.test(qTypeRaw)) qType = "Broad";

          const marksVal = Number(row[2]) || globalMarks || 10;
          const chapterVal = String(row[3] || globalChapter || "").trim();
          
          const diffRaw = String(row[4] || "").toLowerCase().trim();
          let difficultyVal: "easy" | "medium" | "hard" = globalDifficulty;
          if (/easy|সহজ/i.test(diffRaw)) difficultyVal = "easy";
          else if (/hard|কঠিন/i.test(diffRaw)) difficultyVal = "hard";
          else if (/medium|মধ্যম/i.test(diffRaw)) difficultyVal = "medium";

          items.push({
            id: `excel-${Date.now()}-${i}`,
            question_text: qText,
            question_type: qType,
            marks: marksVal,
            chapter: chapterVal,
            difficulty: difficultyVal,
            isValid: qText.length > 2,
          });
        }

        if (items.length === 0) {
          setErrorMessage("এক্সেল ফাইল থেকে কোনো উপযুক্ত প্রশ্ন সনাক্ত করা যায়নি।");
          return;
        }

        setParsedQuestions(items);
      } catch (err: any) {
        console.error("Excel parse error:", err);
        setErrorMessage("এক্সেল ফাইল পার্স করার সময় সমস্যা হয়েছে: " + (err.message || ""));
      }
    };

    reader.readAsBinaryString(file);
  };

  // Download Sample Excel Template
  const handleDownloadSampleExcel = () => {
    const sampleData = [
      ["প্রশ্নের বিবরণ (Question Text)", "ধরণ (Type: Broad/Short/Irab/Tahqeeq/Sher/Masala)", "নম্বর (Marks)", "অধ্যায় / বাব (Chapter)", "ডিফিকাল্টি (easy/medium/hard)"],
      ["ইলমে হাদীসের পরিভাষায় ‘মুতাওয়াতির’ ও ‘খবরে ওয়াহিদ’-এর পরিচয় দাও।", "Broad", 10, "مقدمة علم الحديث (উসূলে হাদীস)", "hard"],
      ["‘মুদাল্লাস’ হাদীস কাকে বলে? তাদুলীসের দুটি কারণ লেখ।", "Short", 5, "مقدمة علم الحديث (উসূলে হাদীস)", "medium"],
      ["أعرب الكلمات التي تحتها خط في العبارة الآتية مع الضبط بالشكل", "Irab", 10, "إعراب الحديث (এরাব)", "hard"],
      ["حقق الكلمات الآتية: يَنْصُرُونَ، اِسْتَغْفَرَ", "Tahqeeq", 5, "علم الصرف والإعلال (ছরফ)", "medium"],
      ["সাহু সিজদা ওয়াজিব হওয়ার তিনটি কারণ সংক্ষেপে লেখ।", "Short", 5, "كتاب الصلاة (নামাজ)", "easy"],
      ["বায়য়ে সহীহ ও বায়য়ে ফাসিদ-এর মধ্যকার পার্থক্য ব্যাখ্যা কর।", "Broad", 10, "كتاب البيوع (ব্যবসা ও লেনদেন)", "medium"]
    ];

    const ws = XLSX.utils.aoa_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Questions");
    XLSX.writeFile(wb, "Qawmi_Question_Bank_Template.xlsx");
  };

  // Update specific question in parsed list
  const handleUpdateItem = (id: string, updates: Partial<ParsedQuestionItem>) => {
    setParsedQuestions(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const handleRemoveItem = (id: string) => {
    setParsedQuestions(prev => prev.filter(item => item.id !== id));
  };

  const handleAddItem = () => {
    setParsedQuestions(prev => [
      ...prev,
      {
        id: `manual-${Date.now()}`,
        question_text: "",
        question_type: globalType,
        marks: globalMarks,
        chapter: globalChapter,
        difficulty: globalDifficulty,
        isValid: false,
      }
    ]);
  };

  // Bulk Apply Settings to all parsed items
  const handleApplyGlobalToAll = () => {
    setParsedQuestions(prev => prev.map(item => ({
      ...item,
      chapter: globalChapter || item.chapter,
      difficulty: globalDifficulty || item.difficulty,
      marks: globalMarks || item.marks,
      question_type: globalType || item.question_type,
    })));
  };

  // Submit all parsed questions to database
  const handleSaveAll = async () => {
    if (!selectedClassId) {
      setErrorMessage("অনুগ্রহ করে শ্রেণি / জামাত নির্বাচন করুন।");
      return;
    }
    if (!selectedSubjectId) {
      setErrorMessage("অনুগ্রহ করে বিষয় নির্বাচন করুন।");
      return;
    }

    const validQuestions = parsedQuestions.filter(q => q.question_text.trim().length > 0);
    if (validQuestions.length === 0) {
      setErrorMessage("সংরক্ষণ করার মতো কোনো প্রশ্ন তালিকায় নেই।");
      return;
    }

    setIsSaving(true);
    setErrorMessage("");

    try {
      const payload = validQuestions.map(q => {
        const isRTL = isArabicText(q.question_text);
        let optionsObj: any = {
          chapter: q.chapter.trim(),
          difficulty: q.difficulty,
          is_rtl: isRTL
        };

        if (q.question_type === "Irab") {
          optionsObj.irab_text = q.question_text;
        }

        return {
          class_id: selectedClassId,
          subject_id: selectedSubjectId,
          question_type: q.question_type,
          question_text: q.question_text.trim(),
          marks: Number(q.marks) || 10,
          chapter: q.chapter.trim(),
          difficulty: q.difficulty,
          options: optionsObj,
        };
      });

      const res = await bulkSaveQuestions(payload);
      if (res?.error) {
        setErrorMessage(res.error);
      } else {
        setSuccessMessage(`সফলভাবে ${res.count || payload.length} টি প্রশ্ন প্রশ্নব্যাংকে সংরক্ষণ করা হয়েছে!`);
        setTimeout(() => {
          onSuccess(res.count || payload.length);
          onClose();
        }, 1200);
      }
    } catch (err: any) {
      console.error("Bulk save failed:", err);
      setErrorMessage("প্রশ্ন সংরক্ষণের সময় ত্রুটি ঘটেছে: " + (err.message || ""));
    } finally {
      setIsSaving(false);
    }
  };

  const totalCalculatedMarks = parsedQuestions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full my-6 flex flex-col max-h-[92vh] border border-slate-200 animate-in fade-in zoom-in duration-150">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white rounded-t-2xl flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-600 rounded-xl">
              <FileSpreadsheet className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <span>বাল্ক ইমপোর্ট ও কিতাবের অধ্যায় ট্যাগিং</span>
                <span className="bg-emerald-500/20 text-emerald-300 text-xs px-2.5 py-0.5 rounded-full border border-emerald-500/40">
                  Bulk Import & Chapter Tagging
                </span>
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                একসাথে অনেক প্রশ্ন পেস্ট করুন অথবা এক্সেল ফাইল থেকে এক ক্লিকে প্রশ্নব্যাংকে যোগ করুন
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          
          {/* Target Class & Subject Selector */}
          <div className="bg-emerald-50/70 border border-emerald-200 p-4 rounded-xl">
            <div className="flex items-center gap-2 text-emerald-950 font-bold text-sm mb-3">
              <BookOpen className="w-4 h-4 text-emerald-700" />
              <span>১. টার্গেট শ্রেণি ও বিষয় নির্বাচন করুন (Target Class & Subject)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  শ্রেণি / জামাত *
                </label>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="">-- শ্রেণি নির্বাচন করুন --</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  বিষয় / কিতাব *
                </label>
                <select
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  <option value="">-- বিষয় নির্বাচন করুন --</option>
                  {subjects.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Global Tagging & Metadata Presets */}
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-slate-600" />
                <span>২. কিতাবের বাব/অধ্যায় ও ডিফিকাল্টি ডিফল্ট মান (Global Defaults)</span>
              </span>
              {parsedQuestions.length > 0 && (
                <button
                  type="button"
                  onClick={handleApplyGlobalToAll}
                  className="text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-white border border-emerald-300 px-3 py-1 rounded-lg shadow-2xs hover:bg-emerald-50 transition cursor-pointer"
                >
                  নিচের সকল প্রশ্নে প্রয়োগ করুন
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              {/* Bab / Chapter */}
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  কিতাবের বাব / অধ্যায় (Bab / Chapter Tag)
                </label>
                <input
                  type="text"
                  list="qawmi-chapters"
                  value={globalChapter}
                  onChange={(e) => setGlobalChapter(e.target.value)}
                  placeholder="যেমন: كتاب الصلاة বা باب العوامل..."
                  className="w-full p-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none font-medium"
                />
                <datalist id="qawmi-chapters">
                  {commonQawmiChapters.map((ch, idx) => (
                    <option key={idx} value={ch} />
                  ))}
                </datalist>
              </div>

              {/* Difficulty Level */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  ডিফিকাল্টি স্তর (Difficulty)
                </label>
                <select
                  value={globalDifficulty}
                  onChange={(e) => setGlobalDifficulty(e.target.value as any)}
                  className="w-full p-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none font-semibold"
                >
                  <option value="easy">🟢 সহজ (Easy)</option>
                  <option value="medium">🟡 মধ্যম (Medium)</option>
                  <option value="hard">🔴 কঠিন (Hard)</option>
                </select>
              </div>

              {/* Default Marks */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  ডিফল্ট নম্বর (Marks)
                </label>
                <input
                  type="number"
                  min="1"
                  value={globalMarks}
                  onChange={(e) => setGlobalMarks(Number(e.target.value))}
                  className="w-full p-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none font-semibold"
                />
              </div>
            </div>
          </div>

          {/* Import Method Tabs: Text Paste or Excel Upload */}
          <div className="border-b border-slate-200 flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("paste")}
              className={`pb-2.5 px-4 font-bold text-sm border-b-2 transition flex items-center gap-2 cursor-pointer ${
                activeTab === "paste"
                  ? "border-emerald-600 text-emerald-700"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>একসাথে টেক্সট পেস্ট (Bulk Text Paste)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("excel")}
              className={`pb-2.5 px-4 font-bold text-sm border-b-2 transition flex items-center gap-2 cursor-pointer ${
                activeTab === "excel"
                  ? "border-emerald-600 text-emerald-700"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>এক্সেল / CSV আপলোড (.xlsx, .csv)</span>
            </button>
          </div>

          {/* TAB 1: Paste Text */}
          {activeTab === "paste" && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs text-slate-600">
                  <span>বিভাজন পদ্ধতি:</span>
                  <select
                    value={parseDelimiter}
                    onChange={(e) => setParseDelimiter(e.target.value as any)}
                    className="p-1.5 border border-slate-300 rounded-md bg-white text-xs font-semibold outline-none"
                  >
                    <option value="auto">অটো ডিটেকশন (১., ২. বা ক., খ.)</option>
                    <option value="line">প্রতি লাইন ১টি প্রশ্ন (One per line)</option>
                    <option value="double_line">ডাবল এন্টার / ফাঁকা লাইন (Paragraph)</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setRawText(
                      `১. ইলমে হাদীসের পরিভাষায় ‘মুতাওয়াতির’ ও ‘খবরে ওয়াহিদ’-এর পরিচয় ও হুকুম বিস্তারিত আলোচনা কর। (১০)\n২. ‘মুদাল্লাস’ হাদীস কাকে বলে? তাদুলীসের প্রধান দুটি কারণ উল্লেখ কর। (৫)\n৩. সাহু সিজদার ওয়াজিব হওয়ার তিনটি কারণ সংক্ষেপে লেখ। (৫)\n৪. اعرب ما تحته خط في العبارة الآتية: إِنَّمَا يَخْشَى اللَّهَ مِنْ عِبَادِهِ الْعُلَمَاءُ (১০)\n৫. حقق الكلمات الآتية: يَنْصُرُونَ، اِسْتَغْفَرَ، تُسَبِّحُونَ (৫)`
                    );
                  }}
                  className="text-xs text-emerald-700 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>নমুনা টেক্সট লোড করুন</span>
                </button>
              </div>

              <textarea
                rows={6}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="এখানে কিতাবের প্রশ্নগুলো পেস্ট করুন...&#10;যেমন:&#10;১. ইলমে হাদীসের পরিভাষায় ‘মুতাওয়াতির’ বলতে কী বোঝায়? (১০)&#10;২. ‘মুদাল্লাস’ হাদীসের হুকুম কী? (৫)&#10;৩. اعرب ما تحته خط في العبارة..."
                className="w-full p-3.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-solaiman leading-relaxed"
              />

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleParseText}
                  className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>টেক্সট পার্স করুন এবং প্রিভিউ দেখুন</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: Excel / CSV File Upload */}
          {activeTab === "excel" && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-emerald-300 bg-emerald-50/40 rounded-2xl p-8 text-center flex flex-col items-center justify-center">
                <div className="p-3 bg-emerald-100 rounded-full mb-3 text-emerald-700">
                  <Upload className="w-8 h-8" />
                </div>
                <h4 className="font-bold text-slate-800 text-sm mb-1">
                  এক্সেল (.xlsx, .xls) বা CSV ফাইল আপলোড করুন
                </h4>
                <p className="text-xs text-slate-500 max-w-md mb-4">
                  আপনার কম্পিউটারে তৈরি করা কিতাবের প্রশ্নের তালিকা এক ক্লিকেই প্রশ্নব্যাংকে ইমপোর্ট করুন
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    <span>ফাইল সিলেক্ট করুন</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadSampleExcel}
                    className="px-4 py-2.5 bg-white border border-emerald-300 text-emerald-800 text-xs font-bold rounded-xl shadow-2xs hover:bg-emerald-50 transition cursor-pointer flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>নমুনা এক্সেল টেমপ্লেট ডাউনলোড</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* PARSED PREVIEW & EDIT TABLE */}
          {parsedQuestions.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-100 p-3 rounded-xl">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-slate-800 text-sm">
                    সনাক্তকৃত প্রশ্ন: <span className="text-emerald-700 font-extrabold">{toBengaliNumerals(parsedQuestions.length)}</span> টি
                  </span>
                  <span className="text-slate-300 font-bold">|</span>
                  <span className="font-bold text-slate-800 text-sm">
                    মোট নম্বর: <span className="text-emerald-700 font-extrabold">{toBengaliNumerals(totalCalculatedMarks)}</span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5 text-emerald-600" />
                  <span>+ নতুন রো যোগ করুন</span>
                </button>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-200/80 text-slate-700 font-bold sticky top-0 z-10">
                    <tr>
                      <th className="p-2.5 w-10 text-center">#</th>
                      <th className="p-2.5 w-2/5">প্রশ্নের টেক্সট (Question Text)</th>
                      <th className="p-2.5 w-32">ধরণ (Type)</th>
                      <th className="p-2.5 w-36">বাব / অধ্যায় (Chapter)</th>
                      <th className="p-2.5 w-28">ডিফিকাল্টি</th>
                      <th className="p-2.5 w-16 text-center">মান</th>
                      <th className="p-2.5 w-10 text-center">মুছুন</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {parsedQuestions.map((item, idx) => {
                      const isArabic = isArabicText(item.question_text);
                      return (
                        <tr key={item.id} className="hover:bg-slate-50">
                          <td className="p-2 text-center font-bold text-slate-400">
                            {idx + 1}
                          </td>
                          <td className="p-2">
                            <textarea
                              rows={2}
                              dir={isArabic ? "rtl" : "auto"}
                              value={item.question_text}
                              onChange={(e) => handleUpdateItem(item.id, { question_text: e.target.value })}
                              className={`w-full p-2 border border-slate-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-emerald-500 bg-white ${
                                isArabic ? "font-amiri text-right text-sm" : "font-solaiman"
                              }`}
                            />
                          </td>
                          <td className="p-2">
                            <select
                              value={item.question_type}
                              onChange={(e) => handleUpdateItem(item.id, { question_type: e.target.value })}
                              className="w-full p-1.5 border border-slate-200 rounded-lg text-xs bg-white font-medium"
                            >
                              <option value="Broad">রচনামূলক (Broad)</option>
                              <option value="Short">সংক্ষিপ্ত (Short)</option>
                              <option value="Irab">إعراب (এরাব)</option>
                              <option value="Tahqeeq">تحقيق (তাহকীক)</option>
                              <option value="Sher">شعر (শের)</option>
                              <option value="Masala">مسألة (মাসআলা)</option>
                              <option value="MCQ">MCQ</option>
                            </select>
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={item.chapter}
                              onChange={(e) => handleUpdateItem(item.id, { chapter: e.target.value })}
                              placeholder="অধ্যায় নাম..."
                              className="w-full p-1.5 border border-slate-200 rounded-lg text-xs bg-white"
                            />
                          </td>
                          <td className="p-2">
                            <select
                              value={item.difficulty}
                              onChange={(e) => handleUpdateItem(item.id, { difficulty: e.target.value as any })}
                              className={`w-full p-1.5 border rounded-lg text-xs font-bold ${
                                item.difficulty === "easy" 
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                                  : item.difficulty === "hard"
                                  ? "bg-rose-50 text-rose-800 border-rose-300"
                                  : "bg-amber-50 text-amber-800 border-amber-300"
                              }`}
                            >
                              <option value="easy">সহজ (Easy)</option>
                              <option value="medium">মধ্যম (Med)</option>
                              <option value="hard">কঠিন (Hard)</option>
                            </select>
                          </td>
                          <td className="p-2 text-center">
                            <input
                              type="number"
                              min="1"
                              value={item.marks}
                              onChange={(e) => handleUpdateItem(item.id, { marks: Number(e.target.value) })}
                              className="w-14 p-1.5 border border-slate-200 rounded-lg text-center text-xs font-bold bg-white"
                            />
                          </td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Feedback Messages */}
          {errorMessage && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 font-bold flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 rounded-b-2xl flex flex-wrap items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:text-slate-900 text-xs font-bold border border-slate-300 rounded-xl hover:bg-slate-100 transition cursor-pointer"
          >
            বন্ধ করুন (Cancel)
          </button>

          <div className="flex items-center gap-3">
            {parsedQuestions.length > 0 && (
              <span className="text-xs text-slate-600 font-medium hidden sm:inline">
                মোট {toBengaliNumerals(parsedQuestions.length)} টি প্রশ্ন প্রস্তুত
              </span>
            )}
            <button
              type="button"
              disabled={isSaving || parsedQuestions.length === 0}
              onClick={handleSaveAll}
              className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-2 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>প্রশ্নব্যাংকে সংরক্ষণ হচ্ছে...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>প্রশ্নব্যাংকে বাল্ক সেভ করুন ({toBengaliNumerals(parsedQuestions.length)})</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
