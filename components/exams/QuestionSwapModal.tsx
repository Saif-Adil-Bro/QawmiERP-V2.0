"use client";

import React, { useState, useMemo } from "react";
import { 
  ArrowLeftRight, 
  X, 
  Search, 
  Check, 
  Filter, 
  Sparkles, 
  BookOpen, 
  AlertCircle,
  Plus
} from "lucide-react";
import { toBengaliNumerals, toArabicNumerals } from "@/lib/utils";
import { getQuestionTypeBadge } from "./SpecializedQuestionView";
import { findAlternativeQuestions } from "@/lib/autoPaperEngine";

interface QuestionSwapModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetQuestion: any;
  targetSectionName?: string;
  availableQuestions: any[];
  currentlyUsedQuestionIds: Set<string>;
  onSwap: (oldQuestionId: string, newQuestion: any) => void;
  onQuickAddAndSwap?: (newQuestionData: any) => Promise<void>;
}

export default function QuestionSwapModal({
  isOpen,
  onClose,
  targetQuestion,
  targetSectionName,
  availableQuestions,
  currentlyUsedQuestionIds,
  onSwap,
  onQuickAddAndSwap,
}: QuestionSwapModalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "same_type" | "same_marks">("all");
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  // Quick Add Question State
  const [newText, setNewText] = useState("");
  const [newType, setNewType] = useState(targetQuestion?.question_type || "Broad");
  const [newMarks, setNewMarks] = useState(targetQuestion?.marks || 10);
  const [quickAdding, setQuickAdding] = useState(false);

  const alternatives = useMemo(() => {
    if (!targetQuestion) return [];
    return findAlternativeQuestions(targetQuestion, availableQuestions, currentlyUsedQuestionIds);
  }, [targetQuestion, availableQuestions, currentlyUsedQuestionIds]);

  const filteredCandidates = useMemo(() => {
    if (!targetQuestion) return [];

    let list = alternatives;

    // Filter tabs
    if (filterMode === "same_type") {
      const targetType = (targetQuestion.question_type || "").toLowerCase();
      list = list.filter(item => (item.question.question_type || "").toLowerCase() === targetType);
    } else if (filterMode === "same_marks") {
      const targetMarks = targetQuestion.marks || 0;
      list = list.filter(item => (item.question.marks || 0) === targetMarks);
    }

    // Search query
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(item => 
        (item.question.question_text || "").toLowerCase().includes(q) ||
        (item.question.options?.irab_text || "").toLowerCase().includes(q) ||
        (item.question.options?.scenario || "").toLowerCase().includes(q)
      );
    }

    return list;
  }, [alternatives, targetQuestion, filterMode, searchTerm]);

  if (!isOpen || !targetQuestion) return null;

  const currentBadge = getQuestionTypeBadge(targetQuestion.question_type);

  const handleQuickAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newText.trim()) {
      alert("অনুগ্রহ করে প্রশ্নের বিবরণ লিখুন!");
      return;
    }
    if (onQuickAddAndSwap) {
      setQuickAdding(true);
      try {
        await onQuickAddAndSwap({
          question_text: newText.trim(),
          question_type: newType,
          marks: Number(newMarks),
          options: {},
        });
        onClose();
      } catch (err) {
        console.error("Quick add failed:", err);
      } finally {
        setQuickAdding(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto print:hidden animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-800 to-slate-900 text-white p-4 sm:p-5 flex items-start justify-between relative shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
              <ArrowLeftRight className="w-5 h-5 text-blue-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold font-solaiman">
                  বিকল্প প্রশ্ন নির্বাচন ও সোয়াপ (Question Swap)
                </h2>
              </div>
              <p className="text-blue-100/80 text-xs mt-0.5">
                বর্তমান প্রশ্নের স্থানে প্রশ্নব্যাংক থেকে অন্য একটি উপযুক্ত প্রশ্ন প্রতিস্থাপন করুন
                {targetSectionName ? ` • ${targetSectionName}` : ""}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/70 hover:text-white hover:bg-white/15 rounded-full transition cursor-pointer"
            title="বন্ধ করুন"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Question Preview Card */}
        <div className="bg-blue-50/70 border-b border-blue-200/80 p-4 shrink-0">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-blue-600" />
              বর্তমান প্রশ্ন (যা পরিবর্তন করা হবে):
            </span>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold border ${currentBadge.color}`}>
                {currentBadge.label}
              </span>
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-200/80 text-blue-900">
                {toBengaliNumerals(targetQuestion.marks || 0)} নম্বর
              </span>
            </div>
          </div>
          <p className="text-sm font-semibold text-slate-800 line-clamp-2 font-solaiman leading-relaxed">
            {targetQuestion.question_text}
          </p>
          {targetQuestion.options?.irab_text && (
            <p className="text-xs font-amiri text-slate-700 mt-1 line-clamp-1 bg-white/70 p-1.5 rounded border border-blue-100" dir="rtl">
              {targetQuestion.options.irab_text}
            </p>
          )}
        </div>

        {/* Search and Filters */}
        <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="বিকল্প প্রশ্ন খুঁজুন (শব্দ বা বিষয়)..."
              className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm border border-slate-300 rounded-lg bg-white text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setFilterMode("all")}
              className={`px-2.5 py-1.5 rounded-lg border transition cursor-pointer ${
                filterMode === "all"
                  ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                  : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100"
              }`}
            >
              সকল বিকল্প ({toBengaliNumerals(alternatives.length)})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode("same_type")}
              className={`px-2.5 py-1.5 rounded-lg border transition cursor-pointer ${
                filterMode === "same_type"
                  ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                  : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100"
              }`}
            >
              একই ধরণ
            </button>
            <button
              type="button"
              onClick={() => setFilterMode("same_marks")}
              className={`px-2.5 py-1.5 rounded-lg border transition cursor-pointer ${
                filterMode === "same_marks"
                  ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                  : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100"
              }`}
            >
              সমান নম্বর ({toBengaliNumerals(targetQuestion.marks || 0)})
            </button>
          </div>
        </div>

        {/* Candidate Questions List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
          
          {filteredCandidates.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-xl border border-dashed border-slate-300 p-6">
              <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700 mb-1">
                কোনো বিকল্প প্রশ্ন পাওয়া যায়নি
              </p>
              <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
                প্রশ্নব্যাংকে এই বিষয়ের আর কোনো অব্যবহৃত প্রশ্ন নেই অথবা ফিল্টারে মেলেনি। আপনি সরাসরি একটি নতুন প্রশ্ন লিখে সোয়াপ করতে পারেন।
              </p>
              <button
                type="button"
                onClick={() => setShowQuickAdd(true)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 px-3.5 py-2 rounded-lg border border-blue-200 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ নতুন প্রশ্ন লিখে সোয়াপ করুন</span>
              </button>
            </div>
          ) : (
            filteredCandidates.map(({ question: cand, matchReason }) => {
              const badge = getQuestionTypeBadge(cand.question_type);
              return (
                <div
                  key={cand.id}
                  className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 hover:border-blue-400 hover:shadow-md transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 group"
                >
                  <div className="flex-1 space-y-1.5 pr-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold border ${badge.color}`}>
                        {badge.label}
                      </span>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                        {toBengaliNumerals(cand.marks || 0)} নম্বর
                      </span>
                      {matchReason && (
                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          {matchReason}
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-slate-900 font-semibold font-solaiman leading-relaxed">
                      {cand.question_text}
                    </p>

                    {/* Specialized details snippet */}
                    {cand.options?.irab_text && (
                      <p className="text-xs font-amiri text-slate-700 line-clamp-1 bg-slate-50 p-1.5 rounded border border-slate-200" dir="rtl">
                        {cand.options.irab_text}
                      </p>
                    )}
                    {cand.options?.tahqeeq_words && cand.options.tahqeeq_words.length > 0 && (
                      <p className="text-xs font-amiri text-blue-800 line-clamp-1" dir="rtl">
                        الكلمات: {cand.options.tahqeeq_words.join("، ")}
                      </p>
                    )}
                  </div>

                  <div className="shrink-0 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 flex justify-end">
                    <button
                      type="button"
                      onClick={() => onSwap(targetQuestion.id, cand)}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition transform active:scale-95 cursor-pointer"
                    >
                      <ArrowLeftRight className="w-3.5 h-3.5" />
                      <span>সোয়াপ করুন</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}

          {/* Quick Add Custom Replacement Accordion */}
          <div className="mt-4 pt-4 border-t border-slate-200">
            {!showQuickAdd ? (
              <button
                type="button"
                onClick={() => setShowQuickAdd(true)}
                className="w-full py-2.5 border border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50/50 rounded-xl text-xs font-bold text-slate-600 hover:text-blue-700 flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>প্রশ্নব্যাংকে মিলছে না? সরাসরি একটি নতুন প্রশ্ন লিখে সোয়াপ করুন</span>
              </button>
            ) : (
              <form onSubmit={handleQuickAddSubmit} className="bg-white p-4 rounded-xl border border-blue-300 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    <span>নতুন প্রশ্ন লিখে তাৎক্ষণিক সোয়াপ</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowQuickAdd(false)}
                    className="text-xs text-slate-400 hover:text-slate-600"
                  >
                    বাতিল
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      প্রশ্নের ধরণ
                    </label>
                    <select
                      value={newType}
                      onChange={(e) => setNewType(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="Broad">রচনামূলক প্রশ্ন (Broad)</option>
                      <option value="Short">সংক্ষিপ্ত প্রশ্ন (Short)</option>
                      <option value="Irab">إعراب العبارة (এরাব ও তারকীব)</option>
                      <option value="Tahqeeq">تحقيق الكلمات (তাহকীক ও ছরফ)</option>
                      <option value="Masala">مسألة فقهية (ফিকহি মাসআলা)</option>
                      <option value="Sher">شعر وتوضيح (নযম ও শের)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      নম্বর
                    </label>
                    <input
                      type="number"
                      value={newMarks}
                      onChange={(e) => setNewMarks(Number(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg font-bold text-center"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    প্রশ্নের বিবরণ (Question Text)
                  </label>
                  <textarea
                    rows={2}
                    value={newText}
                    onChange={(e) => setNewText(e.target.value)}
                    placeholder="প্রশ্নের মূল বক্তব্য লিখুন..."
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="submit"
                    disabled={quickAdding}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{quickAdding ? "সংরক্ষণ হচ্ছে..." : "তৈরি ও সোয়াপ সম্পন্ন করুন"}</span>
                  </button>
                </div>
              </form>
            )}
          </div>

        </div>

        {/* Modal Footer */}
        <div className="bg-slate-100 border-t border-slate-200 p-3.5 flex justify-between items-center shrink-0">
          <span className="text-xs text-slate-500">
            মোট অব্যবহৃত বিকল্প প্রশ্ন: <span className="font-bold text-slate-700">{toBengaliNumerals(alternatives.length)} টি</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition cursor-pointer"
          >
            বন্ধ করুন
          </button>
        </div>

      </div>
    </div>
  );
}
