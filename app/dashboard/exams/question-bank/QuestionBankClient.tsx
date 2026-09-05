"use client";

import { useState } from "react";
import { saveQuestion, deleteQuestion, updateQuestion } from "@/app/actions/questions";
import { Plus, Trash2, Loader2, Save, Printer, FileText, Type, X, Globe, Building2, BookOpen, Clock, Award, Check, Pencil, CheckSquare, RotateCcw, ArrowUp, ArrowDown, CheckCircle2, Sparkles, Scroll, Scale, HelpCircle, Columns, Layers } from "lucide-react";
import SpecializedQuestionView, { getQuestionTypeBadge } from "@/components/exams/SpecializedQuestionView";

// Helper function to detect Arabic script in text
function isArabicText(text: string): boolean {
  if (!text) return false;
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
}

// Convert numbers to Arabic-Indic or Bengali numerals
function toBengaliNumerals(num: number): string {
  const digits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return num.toString().split("").map(d => digits[parseInt(d)] || d).join("");
}

function toArabicNumerals(num: number): string {
  const digits = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  return num.toString().split("").map(d => digits[parseInt(d)] || d).join("");
}

export default function QuestionBankClient({
  classes,
  subjects,
  initialQuestions,
  madrasa
}: {
  classes: any[];
  subjects: any[];
  initialQuestions: any[];
  madrasa?: any;
}) {
  const [questions, setQuestions] = useState(initialQuestions);
  
  // Filter state
  const [classFilter, setClassFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  // Paper preview modal state & Header customization
  const [showPaperModal, setShowPaperModal] = useState(false);
  const [customMadrasaName, setCustomMadrasaName] = useState(madrasa?.name || "মাদ্রাসাতুল মুসলিমীন");
  const [customMadrasaAddress, setCustomMadrasaAddress] = useState(madrasa?.address || "");
  const [paperTitle, setPaperTitle] = useState("বার্ষিক পরীক্ষা - ২০২৬");
  const [paperClassName, setPaperClassName] = useState("");
  const [paperSubjectName, setPaperSubjectName] = useState("");
  const [paperTime, setPaperTime] = useState("২ ঘণ্টা ৩০ মিনিট");
  const [paperFullMarks, setPaperFullMarks] = useState("১০০");
  const [paperInstructions, setPaperInstructions] = useState("সকল প্রশ্নের উত্তর দেওয়া আবশ্যক। ডান পাশের সংখ্যা পূর্ণমান জ্ঞাপক।");
  
  // Typography & RTL Settings
  const [selectedFont, setSelectedFont] = useState("font-solaiman");
  const [selectedArabicFont, setSelectedArabicFont] = useState("font-amiri");
  const [textDirectionMode, setTextDirectionMode] = useState<"auto" | "rtl" | "ltr">("auto");
  const [arabicNumbering, setArabicNumbering] = useState<"auto" | "bengali" | "arabic" | "english">("auto");
  const [fontSizeClass, setFontSizeClass] = useState<"text-sm" | "text-base" | "text-lg">("text-base");

  // New question form state
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newClassId, setNewClassId] = useState("");
  const [newSubjectId, setNewSubjectId] = useState("");
  const [newType, setNewType] = useState("Broad");
  const [newText, setNewText] = useState("");
  const [newMarks, setNewMarks] = useState(10);
  const [newOptions, setNewOptions] = useState(["", "", "", ""]);
  const [newTextDirection, setNewTextDirection] = useState<"auto" | "rtl" | "ltr">("auto");
  
  // Specialized question fields:
  // 1. إعراب العبارة (Irab)
  const [newIrabText, setNewIrabText] = useState("");
  const [newTargetWords, setNewTargetWords] = useState("");

  // 2. تحقيق الكلمات (Tahqeeq)
  const [newTahqeeqWords, setNewTahqeeqWords] = useState<string[]>(["يَنْصُرُونَ", "اِسْتَغْفَرَ", "لَا تَقْنَطُوا"]);
  const [tahqeeqInput, setTahqeeqInput] = useState("");

  // 3. شعر وتوضيح (Sher / Poetry)
  const [newVerses, setNewVerses] = useState<Array<{ first: string; second: string }>>([
    { first: "إذا غامَرْتَ في شَرَفٍ مَرُومِ", second: "فَلا تَقْنَعْ بما دونَ النّجومِ" }
  ]);
  const [newPoetName, setNewPoetName] = useState("");

  // 4. مسألة فقهية (Masala / Fiqh)
  const [newScenario, setNewScenario] = useState("");
  const [newSubQuestions, setNewSubQuestions] = useState<string[]>([]);
  const [subQuestionInput, setSubQuestionInput] = useState("");

  // 5. અથવા / বিকল্প প্রশ্ন (Or / أو)
  const [newHasOr, setNewHasOr] = useState(false);
  const [newOrText, setNewOrText] = useState("");
  const [newOrIrabText, setNewOrIrabText] = useState("");
  const [newOrScenario, setNewOrScenario] = useState("");

  // Sample Loaders for 1-click test and setup
  const loadSampleIrab = () => {
    setNewText("أعرب الكلمات التي تحتها خط في العبارة الآتية مع الضبط بالشكل وبيان موقعها الإعرابي:");
    setNewIrabText("إِنَّمَا يَخْشَى اللَّهَ مِنْ عِبَادِهِ الْعُلَمَاءُ، وَإِنَّ الدِّينَ عِنْدَ اللَّهِ الْإِسْلَامُ، وَمَنْ يَبْتَغِ غَيْرَ الْإِسْلَامِ دِينًا فَلَنْ يُقْبَلَ مِنْهُ");
    setNewTargetWords("اللهَ، الْعُلَمَاءُ، دِينًا");
    setNewMarks(10);
    setNewTextDirection("rtl");
  };

  const loadSampleTahqeeq = () => {
    setNewText("حقق الكلمات الآتية ببيان الصيغة والبحث والباب والمصدر والمادة:");
    setNewTahqeeqWords(["يَنْصُرُونَ", "اِسْتَغْفَرَ", "تُسَبِّحُونَ", "مُسْتَقِيمٌ", "لَا تَقْنَطُوا"]);
    setNewMarks(10);
    setNewTextDirection("rtl");
  };

  const loadSampleSher = () => {
    setNewText("اشرح الأبيات الآتية شرحاً وافياً مع ترجمة المفردات وبيان المعنى الإجمالي:");
    setNewVerses([
      { first: "إذا غامَرْتَ في شَرَفٍ مَرُومِ", second: "فَلا تَقْنَعْ بما دونَ النّجومِ" },
      { first: "فَطَعْمُ المَوْتِ في أمْرٍ حَقِيرٍ", second: "كطَعْمِ المَوْتِ في أمْرٍ عَظِيمِ" }
    ]);
    setNewPoetName("أبو الطيب المتنبي");
    setNewMarks(10);
    setNewTextDirection("rtl");
  };

  const loadSampleMasala = () => {
    setNewText("নিম্নোক্ত সুরতহালের ফিকহি সমাধান ও দলিল বিস্তারিত লেখ:");
    setNewScenario("এক ব্যক্তি জোহরের চার রাকাত ফরজ নামাজ পড়ার সময় প্রথম বৈঠকে তাশাহহুদ না পড়ে ভুলবশত ৩য় রাকাতে দাঁড়িয়ে গেল এবং সুরা ফাতিহা পড়ে রুকুতে চলে গেল...");
    setNewSubQuestions([
      "১) এমতাবস্থায় সে কি পুনরায় প্রথম বৈঠকে ফিরে আসবে নাকি নামাজ চালিয়ে যাবে?",
      "২) এই অবস্থায় সাহু সিজদা কখন এবং কীভাবে আদায় করতে হবে? দলীলসহ ব্যাখ্যা কর।"
    ]);
    setNewMarks(10);
    setNewTextDirection("ltr");
  };

  const loadSampleOr = () => {
    setNewHasOr(true);
    setNewOrText("أو: أعرب ما تحته خط في الحديث الشريف الآتي: (إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى)");
    setNewOrIrabText("إِنَّمَا الأَعْمَالُ بِالنِّيَّاتِ وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى، فَمَنْ كَانَتْ هِجْرَتُهُ إِلَى اللَّهِ وَرَسُولِهِ فَهِجْرَتُهُ إِلَى اللَّهِ وَرَسُولِهِ");
  };

  const handleAddTahqeeqWord = () => {
    if (!tahqeeqInput.trim()) return;
    const words = tahqeeqInput.split(/[,،\s]+/).filter(w => w.trim().length > 0);
    setNewTahqeeqWords(prev => [...prev, ...words]);
    setTahqeeqInput("");
  };

  const handleRemoveTahqeeqWord = (index: number) => {
    setNewTahqeeqWords(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddVerseRow = () => {
    setNewVerses(prev => [...prev, { first: "", second: "" }]);
  };

  const handleRemoveVerseRow = (index: number) => {
    setNewVerses(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddSubQuestion = () => {
    if (!subQuestionInput.trim()) return;
    setNewSubQuestions(prev => [...prev, subQuestionInput.trim()]);
    setSubQuestionInput("");
  };

  const handleRemoveSubQuestion = (index: number) => {
    setNewSubQuestions(prev => prev.filter((_, i) => i !== index));
  };
  
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Selection state
  const [selectedQuestions, setSelectedQuestions] = useState<any[]>([]);

  const filteredQuestions = questions.filter(q => {
    if (classFilter && q.class_id !== classFilter) return false;
    if (subjectFilter && q.subject_id !== subjectFilter) return false;
    if (typeFilter && q.question_type !== typeFilter) return false;
    return true;
  });

  const toggleQuestionSelection = (question: any) => {
    const isSelected = selectedQuestions.some(q => q.id === question.id);
    if (isSelected) {
      setSelectedQuestions(selectedQuestions.filter(q => q.id !== question.id));
    } else {
      setSelectedQuestions([...selectedQuestions, question]);
    }
  };

  const handleSelectAllFiltered = () => {
    const newSelected = [...selectedQuestions];
    filteredQuestions.forEach(q => {
      if (!newSelected.some(sq => sq.id === q.id)) {
        newSelected.push(q);
      }
    });
    setSelectedQuestions(newSelected);
  };

  const handleDeselectAllFiltered = () => {
    const filteredIds = new Set(filteredQuestions.map(q => q.id));
    setSelectedQuestions(selectedQuestions.filter(q => !filteredIds.has(q.id)));
  };

  const moveQuestionUp = (index: number) => {
    if (index === 0) return;
    const newQuestions = [...selectedQuestions];
    const temp = newQuestions[index - 1];
    newQuestions[index - 1] = newQuestions[index];
    newQuestions[index] = temp;
    setSelectedQuestions(newQuestions);
  };

  const moveQuestionDown = (index: number) => {
    if (index === selectedQuestions.length - 1) return;
    const newQuestions = [...selectedQuestions];
    const temp = newQuestions[index + 1];
    newQuestions[index + 1] = newQuestions[index];
    newQuestions[index] = temp;
    setSelectedQuestions(newQuestions);
  };

  const totalSelectedMarks = selectedQuestions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0);

  const handleEditClick = (q: any) => {
    setIsAdding(true);
    setEditingId(q.id);
    setNewClassId(q.class_id);
    setNewSubjectId(q.subject_id);
    setNewType(q.question_type);
    setNewText(q.question_text);
    setNewMarks(q.marks || 10);
    
    const opts = q.options || {};
    if (Array.isArray(opts)) {
      setNewOptions([...opts, "", "", "", ""].slice(0, 4));
    } else {
      if (opts.mcq_options) {
        setNewOptions([...opts.mcq_options, "", "", "", ""].slice(0, 4));
      } else {
        setNewOptions(["", "", "", ""]);
      }
      setNewIrabText(opts.irab_text || "");
      setNewTargetWords(opts.target_words || "");
      setNewTahqeeqWords(opts.tahqeeq_words && opts.tahqeeq_words.length > 0 ? opts.tahqeeq_words : ["يَنْصُرُونَ", "اِسْتَغْفَرَ"]);
      setNewVerses(opts.verses && opts.verses.length > 0 ? opts.verses : [{ first: "", second: "" }]);
      setNewPoetName(opts.poet_name || "");
      setNewScenario(opts.scenario || "");
      setNewSubQuestions(opts.sub_questions || []);
      setNewHasOr(Boolean(opts.has_or));
      setNewOrText(opts.or_text || "");
      setNewOrIrabText(opts.or_irab_text || "");
      setNewOrScenario(opts.or_scenario || "");
    }

    setNewTextDirection(isArabicText(q.question_text) ? "rtl" : "auto");
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // When opening modal, update initial class & subject names based on active filters
  const handleOpenPaperModal = () => {
    const selectedClass = classes.find(c => c.id === classFilter);
    const selectedSubject = subjects.find(s => s.id === subjectFilter);
    
    if (selectedClass) {
      setPaperClassName(selectedClass.name);
    } else if (!paperClassName && classes.length > 0) {
      setPaperClassName(classes[0].name);
    }

    if (selectedSubject) {
      setPaperSubjectName(selectedSubject.name);
    } else if (!paperSubjectName && subjects.length > 0) {
      setPaperSubjectName(subjects[0].name);
    }

    setShowPaperModal(true);
  };

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassId || !newSubjectId || !newType || !newText) {
      alert("অনুগ্রহ করে সকল প্রয়োজনীয় তথ্য পূরণ করুন");
      return;
    }

    setSaving(true);
    let optionsData: any = null;

    if (newType === "MCQ") {
      const validOpts = newOptions.filter(o => o.trim() !== "");
      if (validOpts.length < 2) {
        alert("এমসিকিউ (MCQ) এর জন্য অন্তত ২টি অপশন প্রদান করুন");
        setSaving(false);
        return;
      }
      optionsData = { mcq_options: validOpts };
    } else if (newType === "Irab" || newType === "إعراب العبارة") {
      if (!newIrabText.trim()) {
        alert("অনুগ্রহ করে ইবারতের আরবি মূল টেক্সট (العبارة) প্রদান করুন");
        setSaving(false);
        return;
      }
      optionsData = {
        irab_text: newIrabText.trim(),
        target_words: newTargetWords.trim()
      };
    } else if (newType === "Tahqeeq" || newType === "تحقيق الكلمات") {
      if (newTahqeeqWords.length === 0) {
        alert("অনুগ্রহ করে অন্তত ১টি তাহকীক শব্দ যোগ করুন");
        setSaving(false);
        return;
      }
      optionsData = {
        tahqeeq_words: newTahqeeqWords
      };
    } else if (newType === "Sher" || newType === "شعر وتوضيح") {
      const validVerses = newVerses.filter(v => v.first.trim() || v.second.trim());
      if (validVerses.length === 0) {
        alert("অনুগ্রহ করে অন্তত ১টি শের/শ্লোক (মিসরা) প্রদান করুন");
        setSaving(false);
        return;
      }
      optionsData = {
        verses: validVerses,
        poet_name: newPoetName.trim()
      };
    } else if (newType === "Masala" || newType === "مسألة فقهية") {
      if (!newScenario.trim()) {
        alert("অনুগ্রহ করে ফিকহি সুরতহাল / বাস্তব ঘটনার বিবরণ প্রদান করুন");
        setSaving(false);
        return;
      }
      optionsData = {
        scenario: newScenario.trim(),
        sub_questions: newSubQuestions
      };
    }

    if (newHasOr && newOrText.trim()) {
      optionsData = {
        ...(optionsData || {}),
        has_or: true,
        or_text: newOrText.trim(),
        or_irab_text: newOrIrabText.trim() || undefined,
        or_scenario: newOrScenario.trim() || undefined
      };
    }

    const questionData = {
      class_id: newClassId,
      subject_id: newSubjectId,
      question_type: newType,
      question_text: newText,
      marks: Number(newMarks),
      options: optionsData
    };

    let result;
    try {
      if (editingId) {
        result = await updateQuestion(editingId, questionData);
      } else {
        result = await saveQuestion(questionData);
      }

      if (result?.error) {
        alert(result.error);
      } else {
        window.location.reload();
      }
    } catch (err) {
      console.error("save/update Question failed:", err);
      alert("একটি অপ্রত্যাশিত সমস্যা হয়েছে। সম্ভবত নতুন আপডেট ডিপ্লয় হয়েছে — অনুগ্রহ করে পেজ রিফ্রেশ করে আবার চেষ্টা করুন।");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("আপনি কি নিশ্চিতভাবে এই প্রশ্নটি মুছে ফেলতে চান?")) return;
    setDeletingId(id);
    try {
      const result = await deleteQuestion(id);
      if (!result?.error) {
        setQuestions(questions.filter(q => q.id !== id));
      } else {
        alert(result.error);
      }
    } catch (err) {
      console.error("deleteQuestion failed:", err);
      alert("একটি অপ্রত্যাশিত সমস্যা হয়েছে। সম্ভবত নতুন আপডেট ডিপ্লয় হয়েছে — অনুগ্রহ করে পেজ রিফ্রেশ করে আবার চেষ্টা করুন।");
    } finally {
      setDeletingId(null);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Helper to determine question direction
  const getQuestionDir = (text: string): "rtl" | "ltr" => {
    if (textDirectionMode === "rtl") return "rtl";
    if (textDirectionMode === "ltr") return "ltr";
    return isArabicText(text) ? "rtl" : "ltr";
  };

  // Format question number according to preference
  const formatQuestionNumber = (idx: number, isRTL: boolean): string => {
    const num = idx + 1;
    if (arabicNumbering === "arabic" || (isRTL && arabicNumbering !== "bengali")) {
      return `${toArabicNumerals(num)}.`;
    }
    if (arabicNumbering === "english") {
      return `${num}.`;
    }
    return `${toBengaliNumerals(num)}.`;
  };

  // Option labels for MCQ
  const getOptionLabel = (idx: number, isRTL: boolean): string => {
    if (isRTL) {
      const arabicLetters = ["(أ)", "(ب)", "(ج)", "(د)", "(هـ)"];
      return arabicLetters[idx] || `(${idx + 1})`;
    }
    const bengaliLetters = ["(ক)", "(খ)", "(গ)", "(ঘ)", "(ঙ)"];
    return bengaliLetters[idx] || `(${idx + 1})`;
  };

  return (
    <div className="space-y-6">
      {/* Filters & Actions */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 justify-between items-end print:hidden">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full md:w-3/4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">শ্রেণি / জামাত ফিল্টার</label>
            <select
              value={classFilter}
              onChange={(e) => {
                setClassFilter(e.target.value);
                const cl = classes.find(c => c.id === e.target.value);
                if (cl) setPaperClassName(cl.name);
              }}
              className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none text-sm bg-white"
            >
              <option value="">সকল শ্রেণি (All Classes)</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">বিষয় ফিল্টার</label>
            <select
              value={subjectFilter}
              onChange={(e) => {
                setSubjectFilter(e.target.value);
                const sub = subjects.find(s => s.id === e.target.value);
                if (sub) setPaperSubjectName(sub.name);
              }}
              className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none text-sm bg-white"
            >
              <option value="">সকল বিষয় (All Subjects)</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">প্রশ্নের ধরণ</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none text-sm bg-white font-medium"
            >
              <option value="">সকল ধরণ (All Types)</option>
              <option value="Broad">📝 রচনামূলক প্রশ্ন (Broad)</option>
              <option value="Short">✍️ সংক্ষিপ্ত প্রশ্ন (Short)</option>
              <option value="Irab">📜 إعراب العبارة (ইবারত ও এরাব)</option>
              <option value="Tahqeeq">🔍 تحقيق الكلمات (তাহকীক ও ছরফ)</option>
              <option value="Sher">📖 شعر وتوضيح (নযম ও শের)</option>
              <option value="Masala">⚖️ مسألة فقهية (ফিকহি মাসআলা)</option>
              <option value="MCQ">🔘 বহুনির্বাচনী (MCQ)</option>
            </select>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          <button
            onClick={handleOpenPaperModal}
            className="bg-emerald-600 text-white px-4 py-2.5 rounded-lg hover:bg-emerald-700 transition flex items-center justify-center space-x-2 text-sm font-semibold shadow-sm cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>প্রশ্নপত্র তৈরি ও প্রিন্ট ({toBengaliNumerals(selectedQuestions.length)})</span>
          </button>
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="bg-slate-900 text-white px-4 py-2.5 rounded-lg hover:bg-slate-800 transition flex items-center justify-center space-x-2 text-sm font-semibold shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>নতুন প্রশ্ন যুক্ত করুন</span>
          </button>
        </div>
      </div>

      {/* Selection Summary */}
      <div className="bg-emerald-50/90 border border-emerald-300 p-3.5 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs print:hidden">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 font-bold text-emerald-950 text-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>প্রশ্নপত্রে যোগ করা হয়েছে:</span>
            <span className="bg-emerald-600 text-white px-2.5 py-0.5 rounded-full text-xs font-extrabold shadow-xs">
              {toBengaliNumerals(selectedQuestions.length)} টি প্রশ্ন
            </span>
          </div>
          <span className="text-emerald-300 font-bold">|</span>
          <div className="font-bold text-slate-800 text-sm">
            মোট নম্বর: <span className="text-emerald-700 bg-white px-2 py-0.5 rounded border border-emerald-200">{toBengaliNumerals(totalSelectedMarks)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSelectAllFiltered}
            className="px-3 py-1.5 bg-white border border-emerald-300 text-emerald-800 rounded-lg hover:bg-emerald-100 font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs"
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>সব সিলেক্ট করুন</span>
          </button>
          <button
            type="button"
            onClick={handleDeselectAllFiltered}
            className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 font-bold transition cursor-pointer flex items-center gap-1.5 shadow-xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>সব আনচেক করুন</span>
          </button>
        </div>
      </div>

      {/* Add New Question Form */}
      {isAdding && (
        <div className="bg-slate-50 p-6 rounded-xl border border-slate-300 shadow-sm print:hidden">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              {editingId ? <Pencil className="w-5 h-5 text-emerald-600" /> : <Plus className="w-5 h-5 text-emerald-600" />}
              <span>{editingId ? "প্রশ্ন সম্পাদন (Edit Question)" : "নতুন প্রশ্ন সংযোজন (New Question)"}</span>
            </h3>
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-xs">
              <Globe className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-slate-600 font-medium">ভাষা/দিক:</span>
              <button
                type="button"
                onClick={() => setNewTextDirection("auto")}
                className={`px-2 py-0.5 rounded text-xs font-semibold ${newTextDirection === "auto" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
              >
                অটো
              </button>
              <button
                type="button"
                onClick={() => setNewTextDirection("rtl")}
                className={`px-2 py-0.5 rounded text-xs font-semibold ${newTextDirection === "rtl" ? "bg-emerald-700 text-white" : "text-slate-600 hover:bg-slate-100"}`}
              >
                العربية (RTL)
              </button>
              <button
                type="button"
                onClick={() => setNewTextDirection("ltr")}
                className={`px-2 py-0.5 rounded text-xs font-semibold ${newTextDirection === "ltr" ? "bg-slate-700 text-white" : "text-slate-600 hover:bg-slate-100"}`}
              >
                বাংলা/ইংরেজি
              </button>
            </div>
          </div>

          <form onSubmit={handleAddQuestion} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">শ্রেণি / জামাত *</label>
                <select
                  required
                  value={newClassId}
                  onChange={(e) => setNewClassId(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none text-sm bg-white"
                >
                  <option value="">শ্রেণি নির্বাচন করুন</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">বিষয় *</label>
                <select
                  required
                  value={newSubjectId}
                  onChange={(e) => setNewSubjectId(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none text-sm bg-white"
                >
                  <option value="">বিষয় নির্বাচন করুন</option>
                  {subjects.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">প্রশ্নের ধরণ *</label>
                <select
                  required
                  value={newType}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewType(val);
                    if (val === "Irab" && !newIrabText) loadSampleIrab();
                    else if (val === "Tahqeeq" && newTahqeeqWords.length === 0) loadSampleTahqeeq();
                    else if (val === "Sher" && (!newVerses[0]?.first)) loadSampleSher();
                    else if (val === "Masala" && !newScenario) loadSampleMasala();
                  }}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none text-sm bg-white font-medium"
                >
                  <option value="Broad">📝 রচনামূলক প্রশ্ন (Broad)</option>
                  <option value="Short">✍️ সংক্ষিপ্ত প্রশ্ন (Short)</option>
                  <option value="Irab">📜 إعراب العبارة (ইবারত ও এরাব লাগানো)</option>
                  <option value="Tahqeeq">🔍 تحقيق الكلمات (তাহকীক ও ছরফী বিশ্লেষণ)</option>
                  <option value="Sher">📖 شعر وتوضيح (নযম ও শেরের ব্যাখ্যা)</option>
                  <option value="Masala">⚖️ مسألة فقهية (ফিকহি মাসআলা ও সমাধান)</option>
                  <option value="MCQ">🔘 বহুনির্বাচনী (MCQ)</option>
                </select>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-semibold text-slate-700">প্রশ্নের মূল টেক্সট (Question Title / Instruction) *</label>
                {newType === "Irab" && (
                  <button type="button" onClick={loadSampleIrab} className="text-xs text-emerald-700 hover:underline font-semibold flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> নমুনা ইবারত প্রশ্ন লোড করুন
                  </button>
                )}
                {newType === "Tahqeeq" && (
                  <button type="button" onClick={loadSampleTahqeeq} className="text-xs text-emerald-700 hover:underline font-semibold flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> নমুনা তাহকীক প্রশ্ন লোড করুন
                  </button>
                )}
                {newType === "Sher" && (
                  <button type="button" onClick={loadSampleSher} className="text-xs text-emerald-700 hover:underline font-semibold flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> নমুনা শের প্রশ্ন লোড করুন
                  </button>
                )}
                {newType === "Masala" && (
                  <button type="button" onClick={loadSampleMasala} className="text-xs text-emerald-700 hover:underline font-semibold flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> নমুনা মাসআলা প্রশ্ন লোড করুন
                  </button>
                )}
              </div>
              <textarea
                required
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                rows={2}
                dir={newTextDirection === "rtl" ? "rtl" : (newTextDirection === "ltr" ? "ltr" : "auto")}
                className={`w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none bg-white text-base leading-relaxed ${
                  newTextDirection === "rtl" || isArabicText(newText) ? "font-amiri text-right text-lg leading-loose" : "font-solaiman text-left"
                }`}
                placeholder={newTextDirection === "rtl" ? "اكتب السؤال هنا..." : "প্রশ্নের মূল নির্দেশনা বা বিবরণ লিখুন..."}
              />
            </div>

            {/* 1. Specialized: إعراب العبارة (Irab) */}
            {newType === "Irab" && (
              <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                    <Scroll className="w-4 h-4 text-emerald-700" />
                    <span>العبارة المطلوب إعرابها (ইবারতের আরবি মূল পাঠ ও চিহ্নিত শব্দ)</span>
                  </span>
                  <span className="text-[11px] text-emerald-700 bg-white px-2 py-0.5 rounded border border-emerald-200">
                    আরবি হরকত/এরাব সমর্থিত
                  </span>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    সম্পূর্ণ আরবি ইবারত (Arabic Passage):
                  </label>
                  <textarea
                    rows={3}
                    dir="rtl"
                    value={newIrabText}
                    onChange={(e) => setNewIrabText(e.target.value)}
                    className="w-full p-3 font-amiri text-right text-xl leading-[2.2] bg-white border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none shadow-xs"
                    placeholder="اكتب هنا النص العربي كاملا مع التشكيل أو بدونه..."
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    চিহ্নিত বা উদ্দেশ্যকৃত শব্দসমূহ (Target Words for Irab - কমা বা স্পেস দিয়ে লিখুন):
                  </label>
                  <input
                    type="text"
                    dir="rtl"
                    value={newTargetWords}
                    onChange={(e) => setNewTargetWords(e.target.value)}
                    className="w-full p-2.5 font-amiri text-right text-base bg-white border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="مثال: اللهَ، الْعُلَمَاءُ، دِينًا"
                  />
                </div>
              </div>
            )}

            {/* 2. Specialized: تحقيق الكلمات (Tahqeeq) */}
            {newType === "Tahqeeq" && (
              <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-200 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                    <Columns className="w-4 h-4 text-blue-700" />
                    <span>تحقيق الكلمات (তাহকীক ও ছরফী বিশ্লেষণের জন্য শব্দ তালিকা ও ছক)</span>
                  </span>
                  <span className="text-[11px] text-blue-800 bg-white px-2 py-0.5 rounded border border-blue-200">
                    স্বয়ংক্রিয় ছক জেনারেটর
                  </span>
                </div>

                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    dir="rtl"
                    value={tahqeeqInput}
                    onChange={(e) => setTahqeeqInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddTahqeeqWord();
                      }
                    }}
                    placeholder="আরবি শব্দ লিখুন (যেমন: يَسْتَغْفِرُونَ) এবং এন্টার চাপুন..."
                    className="flex-1 p-2.5 font-amiri text-right text-base bg-white border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddTahqeeqWord}
                    className="px-4 py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-lg text-xs transition cursor-pointer shrink-0"
                  >
                    + শব্দ যোগ করুন
                  </button>
                </div>

                {/* Word Chips */}
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-xs font-semibold text-slate-600">যুক্ত শব্দসমূহ:</span>
                  {newTahqeeqWords.map((word, wIdx) => (
                    <span
                      key={wIdx}
                      dir="rtl"
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-blue-300 rounded-full font-amiri text-base text-blue-900 shadow-xs"
                    >
                      <span>{word}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTahqeeqWord(wIdx)}
                        className="text-red-500 hover:text-red-700 p-0.5 rounded-full hover:bg-red-50 cursor-pointer"
                        title="শব্দটি বাদ দিন"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {newTahqeeqWords.length === 0 && (
                    <span className="text-xs text-amber-700 italic">এখনো কোনো শব্দ যোগ করা হয়নি। উপরে লিখে যোগ করুন।</span>
                  )}
                </div>

                {/* Live mini table preview */}
                {newTahqeeqWords.length > 0 && (
                  <div className="bg-white p-3 rounded-lg border border-blue-200">
                    <span className="text-[11px] font-bold text-slate-600 block mb-2">পরীক্ষার খাতায়/প্রশ্নে যেভাবে ছক তৈরি হবে:</span>
                    <div className="overflow-x-auto">
                      <table className="w-full text-center text-xs border-collapse border border-slate-300" dir="rtl">
                        <thead className="bg-slate-100 font-amiri text-sm font-bold">
                          <tr>
                            <th className="border border-slate-300 p-1.5">الرقم</th>
                            <th className="border border-slate-300 p-1.5">الكلمة</th>
                            <th className="border border-slate-300 p-1.5">الصيغة</th>
                            <th className="border border-slate-300 p-1.5">البحث</th>
                            <th className="border border-slate-300 p-1.5">الباب</th>
                            <th className="border border-slate-300 p-1.5">المصدر</th>
                            <th className="border border-slate-300 p-1.5">المادة</th>
                          </tr>
                        </thead>
                        <tbody className="font-amiri text-sm">
                          {newTahqeeqWords.map((word, i) => (
                            <tr key={i}>
                              <td className="border border-slate-300 p-1 text-slate-500 font-sans">{i + 1}</td>
                              <td className="border border-slate-300 p-1 font-bold text-slate-900">{word}</td>
                              <td className="border border-slate-300 p-1 text-slate-400">---</td>
                              <td className="border border-slate-300 p-1 text-slate-400">---</td>
                              <td className="border border-slate-300 p-1 text-slate-400">---</td>
                              <td className="border border-slate-300 p-1 text-slate-400">---</td>
                              <td className="border border-slate-300 p-1 text-slate-400">---</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 3. Specialized: شعر وتوضيح (Sher / Poetry) */}
            {newType === "Sher" && (
              <div className="p-4 bg-purple-50/50 rounded-xl border border-purple-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-950 flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-purple-700" />
                    <span>شعر وتوضيح (নযম ও শেরের শ্লোক/বায়েতসমূহ)</span>
                  </span>
                  <div className="w-48">
                    <input
                      type="text"
                      dir="auto"
                      value={newPoetName}
                      onChange={(e) => setNewPoetName(e.target.value)}
                      placeholder="কবি / কিতাবের নাম (ঐচ্ছিক)"
                      className="w-full text-xs p-1.5 bg-white border border-purple-300 rounded-md outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-2.5">
                  {newVerses.map((verse, vIdx) => (
                    <div key={vIdx} className="bg-white p-2.5 rounded-lg border border-purple-200 flex items-center gap-2">
                      <span className="text-xs font-bold text-purple-800 w-6 text-center">{vIdx + 1}</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 flex-1">
                        <input
                          type="text"
                          dir="rtl"
                          value={verse.first}
                          onChange={(e) => {
                            const updated = [...newVerses];
                            updated[vIdx].first = e.target.value;
                            setNewVerses(updated);
                          }}
                          placeholder="المصرع الأول (প্রথম চরণ/মিসরা)"
                          className="p-2 font-amiri text-right text-base border border-slate-300 rounded-md focus:ring-1 focus:ring-purple-500 outline-none"
                        />
                        <input
                          type="text"
                          dir="rtl"
                          value={verse.second}
                          onChange={(e) => {
                            const updated = [...newVerses];
                            updated[vIdx].second = e.target.value;
                            setNewVerses(updated);
                          }}
                          placeholder="المصرع الثاني (দ্বিতীয় চরণ/মিসরা)"
                          className="p-2 font-amiri text-right text-base border border-slate-300 rounded-md focus:ring-1 focus:ring-purple-500 outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveVerseRow(vIdx)}
                        disabled={newVerses.length <= 1}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-30 cursor-pointer"
                        title="এই শ্লোক বাদ দিন"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleAddVerseRow}
                  className="px-3 py-1.5 bg-white border border-purple-300 text-purple-800 hover:bg-purple-100 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> + আরও একটি শের/শ্লোক যুক্ত করুন
                </button>
              </div>
            )}

            {/* 4. Specialized: مسألة فقهية (Masala / Fiqh) */}
            {newType === "Masala" && (
              <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                    <Scale className="w-4 h-4 text-amber-700" />
                    <span>مسألة فقهية (ফিকহি সুরতহাল / বাস্তব প্রেক্ষাপট ও সমাধান)</span>
                  </span>
                  <span className="text-[11px] text-amber-800 bg-white px-2 py-0.5 rounded border border-amber-200">
                    বাস্তবধর্মী সমাধান ফরম্যাট
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    সুরতহাল বা ঘটনার বিবরণ (Scenario Text):
                  </label>
                  <textarea
                    rows={3}
                    dir="auto"
                    value={newScenario}
                    onChange={(e) => setNewScenario(e.target.value)}
                    placeholder="বাস্তব সুরতহাল বা ঘটনার বিবরণ লিখুন..."
                    className="w-full p-3 text-sm bg-white border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none leading-relaxed"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-[11px] font-semibold text-slate-700">
                    নির্দিষ্ট ফিকহি প্রশ্ন বা সমাধান উপ-প্রশ্নসমূহ (Sub-questions):
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      dir="auto"
                      value={subQuestionInput}
                      onChange={(e) => setSubQuestionInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddSubQuestion();
                        }
                      }}
                      placeholder="উপ-প্রশ্ন লিখুন (যেমন: ১. এতে কি নামাজ ভেঙে যাবে?)..."
                      className="flex-1 p-2 text-xs bg-white border border-amber-300 rounded-lg outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddSubQuestion}
                      className="px-3 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-xs font-bold cursor-pointer shrink-0"
                    >
                      + যোগ করুন
                    </button>
                  </div>

                  {newSubQuestions.map((sq, sqIdx) => (
                    <div key={sqIdx} className="flex items-center justify-between bg-white px-3 py-1.5 rounded-md border border-amber-200 text-xs">
                      <span>{sq}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSubQuestion(sqIdx)}
                        className="text-red-500 hover:text-red-700 p-0.5 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 5. MCQ Options */}
            {newType === "MCQ" && (
              <div className="p-4 bg-white rounded-lg border border-slate-200 space-y-3">
                <label className="block text-xs font-bold text-slate-700">এমসিকিউ অপশনসমূহ (MCQ Options)</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {newOptions.map((opt, idx) => {
                    const optIsRTL = newTextDirection === "rtl" || isArabicText(opt);
                    return (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500 w-8 text-center shrink-0">
                          {getOptionLabel(idx, optIsRTL)}
                        </span>
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => {
                            const newOpts = [...newOptions];
                            newOpts[idx] = e.target.value;
                            setNewOptions(newOpts);
                          }}
                          dir={optIsRTL ? "rtl" : "auto"}
                          className={`w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-500 outline-none text-sm ${
                            optIsRTL ? "font-amiri text-right text-base" : "font-solaiman"
                          }`}
                          placeholder={`অপশন ${idx + 1}`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 6. Universal বিকল্প প্রশ্ন (অথবা / বা / أو) Section */}
            <div className="p-4 bg-orange-50/40 rounded-xl border border-orange-200 space-y-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={newHasOr}
                    onChange={(e) => setNewHasOr(e.target.checked)}
                    className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500 border-orange-300 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-orange-950">
                    বিকল্প প্রশ্ন (অথবা / বা / أو) যুক্ত করুন
                  </span>
                </label>
                {newHasOr && (
                  <button
                    type="button"
                    onClick={loadSampleOr}
                    className="text-xs text-orange-800 hover:underline font-semibold flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" /> নমুনা বিকল্প প্রশ্ন লোড করুন
                  </button>
                )}
              </div>

              {newHasOr && (
                <div className="space-y-2.5 pt-2 border-t border-orange-200">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      বিকল্প প্রশ্নের টেক্সট (Alternative Question Text) *
                    </label>
                    <textarea
                      rows={2}
                      dir="auto"
                      value={newOrText}
                      onChange={(e) => setNewOrText(e.target.value)}
                      placeholder="أو: বিকল্প প্রশ্নের টেক্সট এখানে লিখুন..."
                      className="w-full p-2.5 text-sm bg-white border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none leading-relaxed font-solaiman"
                    />
                  </div>
                  {newType === "Irab" && (
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        বিকল্প ইবারত (Alternative Arabic Passage - ঐচ্ছিক):
                      </label>
                      <textarea
                        rows={2}
                        dir="rtl"
                        value={newOrIrabText}
                        onChange={(e) => setNewOrIrabText(e.target.value)}
                        placeholder="বিকল্প ইবারত এখানে লিখুন..."
                        className="w-full p-2 font-amiri text-right text-base bg-white border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end justify-between">
              <div className="w-full sm:w-48">
                <label className="block text-xs font-semibold text-slate-700 mb-1">মান / মার্কস (Marks) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={newMarks}
                  onChange={(e) => setNewMarks(Number(e.target.value))}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none text-sm bg-white"
                />
              </div>

              <div className="flex space-x-3 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setIsAdding(false);
                    setEditingId(null);
                  }}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 transition text-sm font-medium"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center space-x-2 bg-slate-900 text-white px-5 py-2 rounded-lg hover:bg-slate-800 transition disabled:opacity-50 text-sm font-semibold shadow-sm cursor-pointer"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>{editingId ? "আপডেট করুন" : "প্রশ্ন সংরক্ষণ করুন"}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Questions List Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden print:hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="px-4 py-4 w-12 text-center">
                  <input
                    type="checkbox"
                    checked={filteredQuestions.length > 0 && filteredQuestions.every(q => selectedQuestions.some(sq => sq.id === q.id))}
                    onChange={(e) => {
                      if (e.target.checked) {
                        handleSelectAllFiltered();
                      } else {
                        handleDeselectAllFiltered();
                      }
                    }}
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 border-slate-400 cursor-pointer"
                    title="সকল দৃশ্যমান প্রশ্ন সিলেক্ট/আনচেক করুন"
                  />
                </th>
                <th className="px-4 py-4 w-1/2">প্রশ্নের বিবরণ</th>
                <th className="px-4 py-4">শ্রেণি ও বিষয়</th>
                <th className="px-4 py-4">ধরণ</th>
                <th className="px-4 py-4">নম্বর</th>
                <th className="px-4 py-4 text-right">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredQuestions.map((q, idx) => {
                const qIsArabic = isArabicText(q.question_text);
                const isSelected = selectedQuestions.some(sq => sq.id === q.id);
                return (
                  <tr key={q.id} className={`transition ${isSelected ? "bg-emerald-50/40 hover:bg-emerald-50/70" : "hover:bg-slate-50"}`}>
                    <td className="px-4 py-4 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleQuestionSelection(q)}
                        className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 border-slate-400 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-4">
                      <SpecializedQuestionView
                        question={q}
                        index={idx}
                        isPrint={false}
                        hideMarks={true}
                      />
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-bold text-slate-800">{q.class?.name || "শ্রেণি অনির্ধারিত"}</div>
                      <div className="text-xs text-slate-500 font-medium">{q.subject?.name || "বিষয় অনির্ধারিত"}</div>
                    </td>
                    <td className="px-4 py-4">
                      {(() => {
                        const badge = getQuestionTypeBadge(q.question_type);
                        return (
                          <div className="space-y-1">
                            <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-semibold border ${badge.color}`}>
                              {badge.label}
                            </span>
                            {q.options?.has_or && (
                              <span className="block text-[10px] font-bold text-orange-800 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200 w-fit">
                                + অথবা (أو) সহ
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-4 font-bold text-slate-800">
                      {toBengaliNumerals(q.marks || 0)}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEditClick(q)}
                          className="text-emerald-600 hover:bg-emerald-50 p-2 rounded-lg transition cursor-pointer"
                          title="প্রশ্ন সম্পাদনা করুন"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(q.id)}
                          disabled={deletingId === q.id}
                          className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition disabled:opacity-50 cursor-pointer"
                          title="প্রশ্ন মুছুন"
                        >
                          {deletingId === q.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredQuestions.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    কোনো প্রশ্ন পাওয়া যায়নি। উপরে &quot;নতুন প্রশ্ন যুক্ত করুন&quot; বাটনে ক্লিক করে প্রশ্ন যোগ করুন।
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* QUESTION PAPER CUSTOMIZATION MODAL (Screen Only) */}
      {/* ========================================================================= */}
      {showPaperModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:hidden">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden border border-slate-300">
            {/* Modal Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-lg">প্রশ্নপত্র কাস্টমাইজ, প্রিভিউ ও প্রিন্ট</h3>
              </div>
              <button 
                onClick={() => setShowPaperModal(false)}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-300 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Customization Controls */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 overflow-y-auto max-h-[30vh]">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {/* Madrasa Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-slate-500" />
                    <span>মাদরাসার নাম (ডাইনামিক)</span>
                  </label>
                  <input 
                    type="text" 
                    value={customMadrasaName} 
                    onChange={(e) => setCustomMadrasaName(e.target.value)}
                    placeholder="মাদরাসার নাম"
                    className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-semibold"
                  />
                </div>

                {/* Exam Title */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">পরীক্ষার নাম / শিরোনাম</label>
                  <input 
                    type="text" 
                    value={paperTitle} 
                    onChange={(e) => setPaperTitle(e.target.value)}
                    placeholder="বার্ষিক পরীক্ষা - ২০২৬"
                    className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Class Name (Requested by user!) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
                    <span>শ্রেণি / জামাত</span>
                  </label>
                  <input 
                    type="text" 
                    value={paperClassName} 
                    onChange={(e) => setPaperClassName(e.target.value)}
                    placeholder="উদা: তাইসীর / হিফজুল কুরআন"
                    className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-medium"
                  />
                </div>

                {/* Subject Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">বিষয় (Subject)</label>
                  <input 
                    type="text" 
                    value={paperSubjectName} 
                    onChange={(e) => setPaperSubjectName(e.target.value)}
                    placeholder="উদা: কুরআন / আরবি ১ম পত্র"
                    className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-medium"
                  />
                </div>

                {/* Exam Time */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>পরীক্ষার সময়</span>
                  </label>
                  <input 
                    type="text" 
                    value={paperTime} 
                    onChange={(e) => setPaperTime(e.target.value)}
                    placeholder="২ ঘণ্টা ৩০ মিনিট"
                    className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Full Marks */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <Award className="w-3.5 h-3.5 text-slate-500" />
                    <span>পূর্ণমান (Full Marks)</span>
                  </label>
                  <input 
                    type="text" 
                    value={paperFullMarks} 
                    onChange={(e) => setPaperFullMarks(e.target.value)}
                    placeholder="১০০"
                    className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Font Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <Type className="w-3.5 h-3.5 text-emerald-600" />
                    <span>ফন্ট স্টাইল</span>
                  </label>
                  <select 
                    value={selectedFont} 
                    onChange={(e) => setSelectedFont(e.target.value)}
                    className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-medium"
                  >
                    <option value="font-solaiman">বাংলা: সোলাইমান লিপি (ডিফল্ট)</option>
                    <option value="font-shorif">বাংলা: শরীফ শিশির</option>
                    <option value="font-hindsiliguri">বাংলা: হিন্দ শিলিগুড়ি</option>
                    <option value="font-amiri">আরবি: আল-আমিরী (Amiri)</option>
                    <option value="font-shahrazad">আরবি: শেহরেযাদ (Scheherazade)</option>
                  </select>
                </div>

                {/* Text Direction & Arabic Mode (Requested by user!) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <Globe className="w-3.5 h-3.5 text-blue-600" />
                    <span>আরবি RTL / লেখার মোড</span>
                  </label>
                  <select 
                    value={textDirectionMode} 
                    onChange={(e) => setTextDirectionMode(e.target.value as any)}
                    className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-medium text-slate-800"
                  >
                    <option value="auto">স্মার্ট অটো (আরবি হলে RTL, বাংলা LTR)</option>
                    <option value="rtl">সম্পূর্ণ আরবি প্রশ্নপত্র (Full RTL Mode)</option>
                    <option value="ltr">সাধারণ বাংলা মোড (LTR Mode)</option>
                  </select>
                </div>
              </div>
              
              <div className="mt-3">
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-slate-500" />
                  <span>নির্দেশনা (Instructions)</span>
                </label>
                <input 
                  type="text" 
                  value={paperInstructions} 
                  onChange={(e) => setPaperInstructions(e.target.value)}
                  placeholder="যেমন: সকল প্রশ্নের উত্তর দেওয়া আবশ্যক। ডান পাশের সংখ্যা পূর্ণমান জ্ঞাপক।"
                  className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Paper Live Preview Area */}
            <div className="p-6 overflow-y-auto flex-1 bg-slate-200 flex justify-center">
              <div 
                className={`bg-white p-8 sm:p-12 shadow-lg rounded-lg w-full max-w-3xl border border-slate-300 text-slate-900 ${selectedFont}`}
              >
                {/* Paper Header */}
                <div className="text-center border-b-2 border-slate-900 pb-4 mb-6">
                  {/* Bismillah / Top Calligraphy */}
                  <div className="font-amiri text-lg text-slate-800 mb-1 tracking-wider" dir="rtl">
                    بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيْمِ
                  </div>

                  {/* Dynamic Madrasa Name */}
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight" dir="auto">
                    {customMadrasaName}
                  </h1>
                  {customMadrasaAddress && (
                    <p className="text-xs text-slate-600 mt-0.5" dir="auto">{customMadrasaAddress}</p>
                  )}

                  {/* Exam Title */}
                  <h2 className="text-lg sm:text-xl font-bold text-slate-800 mt-2" dir="auto">
                    {paperTitle}
                  </h2>

                  {/* Class, Subject, Time, Full Marks Grid */}
                  <div className="mt-4 pt-3 border-t border-slate-400 space-y-1 text-sm font-bold text-slate-800">
                    <div className="flex justify-between items-center">
                      <span>শ্রেণি / জামাত: {paperClassName || "__________________"}</span>
                      <span>বিষয়: {paperSubjectName || "__________________"}</span>
                    </div>
                    <div className="flex justify-between items-center pt-1">
                      <span>সময়: {paperTime}</span>
                      <span>পূর্ণমান: {paperFullMarks}</span>
                    </div>
                  </div>

                  {/* Instructions */}
                  {paperInstructions && (
                    <div className="text-xs text-slate-600 mt-3 italic border-t border-dashed border-slate-300 pt-2" dir="auto">
                      [{paperInstructions}]
                    </div>
                  )}
                </div>

                {/* Questions Content */}
                <div className="space-y-6">
                  {selectedQuestions.map((q, idx) => {
                    const isRTL = getQuestionDir(q.question_text) === "rtl";
                    return (
                      <div 
                        key={`${q.id}-${idx}`} 
                        className="group relative border border-transparent hover:border-emerald-200 hover:bg-emerald-50/50 p-2 -mx-2 rounded-lg transition-all"
                      >
                        <SpecializedQuestionView
                          question={q}
                          index={idx}
                          isRTL={isRTL}
                          formatNumber={formatQuestionNumber}
                          isPrint={false}
                        />

                        {/* Hover Action Buttons */}
                        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 print:hidden absolute right-2 top-2 bg-white/95 backdrop-blur-sm p-1 rounded-md shadow-sm border border-emerald-200 z-10">
                          <button
                            type="button"
                            onClick={() => moveQuestionUp(idx)}
                            disabled={idx === 0}
                            className="p-1 text-slate-500 hover:bg-emerald-100 hover:text-emerald-700 rounded transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            title="উপরে নিন"
                          >
                            <ArrowUp className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveQuestionDown(idx)}
                            disabled={idx === selectedQuestions.length - 1}
                            className="p-1 text-slate-500 hover:bg-emerald-100 hover:text-emerald-700 rounded transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            title="নিচে নিন"
                          >
                            <ArrowDown className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleQuestionSelection(q)}
                            className="p-1 text-red-500 hover:bg-red-50 rounded transition cursor-pointer"
                            title="প্রশ্নপত্র থেকে বাদ দিন"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {selectedQuestions.length === 0 && (
                    <p className="text-center text-slate-500 py-12 italic">
                      কোনো প্রশ্ন নির্বাচন করা হয়নি। দয়া করে লিস্ট থেকে প্রশ্ন সিলেক্ট করুন।
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-white border-t border-slate-200 flex justify-between items-center">
              <div className="text-xs text-slate-500 font-medium">
                মোট প্রশ্ন সংখ্যা: <span className="font-bold text-slate-800">{selectedQuestions.length}</span> টি
              </div>
              <div className="flex space-x-3">
                <button 
                  onClick={() => setShowPaperModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition cursor-pointer"
                >
                  বন্ধ করুন
                </button>
                <button 
                  onClick={handlePrint}
                  className="flex items-center space-x-2 bg-emerald-600 text-white px-6 py-2 rounded-lg text-sm font-bold hover:bg-emerald-700 transition shadow-md cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>প্রিন্ট প্রশ্নপত্র</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DEDICATED PRINT CONTAINER (Rendered purely when window.print() is called) */}
      {/* ========================================================================= */}
      <div 
        id="question-paper-print" 
        className={`hidden print:block print:w-full print:bg-white print:text-black print:p-0 print:m-0 ${selectedFont}`}
      >
        <div className="max-w-4xl mx-auto p-4 bg-white text-black">
          {/* Header */}
          <div className="text-center border-b-2 border-black pb-3 mb-6">
            <div className="font-amiri text-base mb-1 tracking-wider" dir="rtl">
              بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيْمِ
            </div>
            <h1 className="text-3xl font-extrabold mb-1" dir="auto">
              {customMadrasaName}
            </h1>
            {customMadrasaAddress && (
              <p className="text-xs mb-1" dir="auto">{customMadrasaAddress}</p>
            )}
            <h2 className="text-xl font-bold mt-1" dir="auto">{paperTitle}</h2>
            
            <div className="mt-4 pt-2 border-t border-black space-y-1 text-sm font-bold">
              <div className="flex justify-between items-center px-2">
                <span>শ্রেণি / জামাত: {paperClassName || "__________________"}</span>
                <span>বিষয়: {paperSubjectName || "__________________"}</span>
              </div>
              <div className="flex justify-between items-center px-2 pt-1">
                <span>সময়: {paperTime}</span>
                <span>পূর্ণমান: {paperFullMarks}</span>
              </div>
            </div>

            {paperInstructions && (
              <div className="text-xs mt-2 italic border-t border-dashed border-gray-400 pt-1" dir="auto">
                [{paperInstructions}]
              </div>
            )}
          </div>

          {/* Question Items */}
          <div className="space-y-6 px-2">
            {selectedQuestions.map((q, idx) => {
              const isRTL = getQuestionDir(q.question_text) === "rtl";
              return (
                <div 
                  key={`${q.id}-${idx}`} 
                  className="break-inside-avoid"
                >
                  <SpecializedQuestionView
                    question={q}
                    index={idx}
                    isRTL={isRTL}
                    formatNumber={formatQuestionNumber}
                    isPrint={true}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Global Print Media Rules for Flawless Output */}
      <style jsx global>{`
        @media print {
          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            overflow: visible !important;
          }
          /* Hide all application dashboard elements and sidebars */
          body * {
            visibility: hidden !important;
          }
          /* Ensure print paper is 100% visible and takes full page */
          #question-paper-print, #question-paper-print * {
            visibility: visible !important;
          }
          #question-paper-print {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            display: block !important;
            background: white !important;
            padding: 10mm 15mm !important;
            margin: 0 !important;
          }
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
        }
      `}</style>
    </div>
  );
}
