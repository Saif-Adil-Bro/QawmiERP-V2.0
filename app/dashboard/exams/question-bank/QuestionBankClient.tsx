"use client";

import { useState } from "react";
import { saveQuestion, deleteQuestion, updateQuestion } from "@/app/actions/questions";
import { Plus, Trash2, Loader2, Save, Printer, FileText, Type, X, Globe, Building2, BookOpen, Clock, Award, Check, Pencil, CheckSquare, RotateCcw, ArrowUp, ArrowDown, CheckCircle2 } from "lucide-react";

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
    setNewOptions(q.options && q.options.length ? [...q.options, "", "", "", ""].slice(0, 4) : ["", "", "", ""]);
    setNewTextDirection("auto");
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
    let optionsData = null;
    if (newType === "MCQ") {
      optionsData = newOptions.filter(o => o.trim() !== "");
      if (optionsData.length < 2) {
        alert("এমসিকিউ (MCQ) এর জন্য অন্তত ২টি অপশন প্রদান করুন");
        setSaving(false);
        return;
      }
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
    if (editingId) {
      result = await updateQuestion(editingId, questionData);
    } else {
      result = await saveQuestion(questionData);
    }

    if (result.error) {
      alert(result.error);
    } else {
      window.location.reload();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("আপনি কি নিশ্চিতভাবে এই প্রশ্নটি মুছে ফেলতে চান?")) return;
    setDeletingId(id);
    const result = await deleteQuestion(id);
    if (!result.error) {
      setQuestions(questions.filter(q => q.id !== id));
    }
    setDeletingId(null);
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
              className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none text-sm bg-white"
            >
              <option value="">সকল ধরণ (All Types)</option>
              <option value="MCQ">বহুনির্বাচনী (MCQ)</option>
              <option value="Short">সংক্ষিপ্ত প্রশ্ন (Short)</option>
              <option value="Broad">রচনামূলক প্রশ্ন (Broad)</option>
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
                  onChange={(e) => setNewType(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none text-sm bg-white"
                >
                  <option value="Broad">রচনামূলক প্রশ্ন (Broad)</option>
                  <option value="Short">সংক্ষিপ্ত প্রশ্ন (Short)</option>
                  <option value="MCQ">বহুনির্বাচনী (MCQ)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">প্রশ্নের মূল টেক্সট (Question Text) *</label>
              <textarea
                required
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                rows={3}
                dir={newTextDirection === "rtl" ? "rtl" : (newTextDirection === "ltr" ? "ltr" : "auto")}
                className={`w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500 outline-none bg-white text-base leading-relaxed ${
                  newTextDirection === "rtl" || isArabicText(newText) ? "font-amiri text-right text-lg leading-loose" : "font-solaiman text-left"
                }`}
                placeholder={newTextDirection === "rtl" ? "اكتب السؤال هنا..." : "প্রশ্নের বিবরণ এখানে লিখুন (বাংলা বা আরবিতে)..."}
              />
            </div>

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
                      <div 
                        dir={qIsArabic ? "rtl" : "auto"}
                        className={`font-semibold text-slate-900 mb-1 ${
                          qIsArabic ? "font-amiri text-right text-lg leading-loose" : "font-solaiman text-left text-sm leading-relaxed"
                        }`}
                      >
                        <span className="font-bold text-slate-500 mr-2 ml-2">
                          {qIsArabic ? toArabicNumerals(idx + 1) : toBengaliNumerals(idx + 1)}.
                        </span>
                        {q.question_text}
                      </div>
                      {q.question_type === "MCQ" && q.options && (
                        <div 
                          dir={qIsArabic ? "rtl" : "auto"}
                          className={`grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-100 text-xs text-slate-600 ${
                            qIsArabic ? "font-amiri text-right text-sm" : ""
                          }`}
                        >
                          {q.options.map((opt: string, i: number) => (
                            <div key={i} className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-500">{getOptionLabel(i, qIsArabic)}</span>
                              <span>{opt}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-bold text-slate-800">{q.class?.name || "শ্রেণি অনির্ধারিত"}</div>
                      <div className="text-xs text-slate-500 font-medium">{q.subject?.name || "বিষয় অনির্ধারিত"}</div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-block px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-semibold">
                        {q.question_type === "MCQ" ? "বহুনির্বাচনী" : (q.question_type === "Short" ? "সংক্ষিপ্ত" : "রচনামূলক")}
                      </span>
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
                        dir={isRTL ? "rtl" : "ltr"}
                        className={`space-y-1.5 group relative ${isRTL ? "font-amiri text-right" : "text-left"} border border-transparent hover:border-emerald-200 hover:bg-emerald-50/50 p-2 -mx-2 rounded-lg transition-all`}
                      >
                        <div className="flex justify-between items-start gap-3">
                          <div className="flex-1">
                            <p 
                              className={`font-semibold text-slate-900 ${
                                isRTL 
                                  ? "text-xl leading-[2.2] tracking-wide font-amiri" 
                                  : "text-base leading-relaxed"
                              }`}
                            >
                              <span className={`font-bold text-slate-900 ml-1.5 mr-1.5 inline-block ${isRTL ? "font-amiri" : ""}`}>
                                {formatQuestionNumber(idx, isRTL)}
                              </span>
                              {q.question_text}
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className={`font-bold text-slate-800 text-sm px-2 py-0.5 bg-slate-100 rounded border border-slate-300 ${isRTL ? "font-amiri" : ""}`}>
                              [{isRTL ? toArabicNumerals(q.marks) : toBengaliNumerals(q.marks)}]
                            </span>
                            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 print:hidden absolute right-2 top-2 bg-white/90 backdrop-blur-sm p-1 rounded-md shadow-sm border border-emerald-100">
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
                        </div>

                        {/* MCQ Options */}
                        {q.question_type === "MCQ" && q.options && (
                          <div 
                            className={`grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 ${
                              isRTL ? "pr-6 text-base leading-loose" : "pl-6 text-sm"
                            }`}
                          >
                            {q.options.map((opt: string, i: number) => (
                              <div key={i} className="flex items-center gap-1.5 text-slate-800">
                                <span className="font-bold text-slate-700">{getOptionLabel(i, isRTL)}</span>
                                <span>{opt}</span>
                              </div>
                            ))}
                          </div>
                        )}
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
                  dir={isRTL ? "rtl" : "ltr"}
                  className={`break-inside-avoid space-y-1.5 ${isRTL ? "font-amiri text-right" : "text-left"}`}
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <p 
                        className={`font-semibold ${
                          isRTL 
                            ? "text-xl leading-[2.3] tracking-wide" 
                            : "text-base leading-relaxed"
                        }`}
                      >
                        <span className="font-bold ml-1.5 mr-1.5 inline-block">
                          {formatQuestionNumber(idx, isRTL)}
                        </span>
                        {q.question_text}
                      </p>
                    </div>
                    <span className="font-bold text-sm shrink-0 px-2 py-0.5 border border-black rounded">
                      [{isRTL ? toArabicNumerals(q.marks) : toBengaliNumerals(q.marks)}]
                    </span>
                  </div>

                  {/* MCQ Options in Print */}
                  {q.question_type === "MCQ" && q.options && (
                    <div 
                      className={`grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 ${
                        isRTL ? "pr-6 text-base leading-loose" : "pl-6 text-sm"
                      }`}
                    >
                      {q.options.map((opt: string, i: number) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <span className="font-bold">{getOptionLabel(i, isRTL)}</span>
                          <span>{opt}</span>
                        </div>
                      ))}
                    </div>
                  )}
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
