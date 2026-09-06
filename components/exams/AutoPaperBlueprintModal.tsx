"use client";

import React, { useState } from "react";
import { 
  Sparkles, 
  X, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Sliders, 
  BookOpen, 
  Clock, 
  HelpCircle,
  AlertTriangle,
  BookmarkPlus
} from "lucide-react";
import { 
  AutoPaperBlueprint, 
  BlueprintCategoryItem, 
  BlueprintCategoryType, 
  BUILT_IN_BLUEPRINTS, 
  CATEGORY_LABELS 
} from "@/lib/autoPaperEngine";
import { toBengaliNumerals } from "@/lib/utils";

interface AutoPaperBlueprintModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (blueprint: AutoPaperBlueprint) => void;
  currentSubjectName?: string;
  currentClassName?: string;
  totalAvailableQuestions: number;
}

export default function AutoPaperBlueprintModal({
  isOpen,
  onClose,
  onGenerate,
  currentSubjectName = "",
  currentClassName = "",
  totalAvailableQuestions = 0,
}: AutoPaperBlueprintModalProps) {
  // Start with standard Qawmi 100 preset as default
  const [selectedPresetId, setSelectedPresetId] = useState<string>("standard_qawmi_100");
  const [blueprint, setBlueprint] = useState<AutoPaperBlueprint>(() => {
    return JSON.parse(JSON.stringify(BUILT_IN_BLUEPRINTS[0]));
  });

  if (!isOpen) return null;

  const handleSelectPreset = (preset: AutoPaperBlueprint) => {
    setSelectedPresetId(preset.id);
    setBlueprint(JSON.parse(JSON.stringify(preset)));
  };

  const handleUpdateItem = (index: number, updates: Partial<BlueprintCategoryItem>) => {
    setBlueprint(prev => {
      const items = [...prev.items];
      const item = { ...items[index], ...updates };
      // Recalculate total marks for item
      if (updates.count !== undefined || updates.marksPerQuestion !== undefined) {
        item.totalMarks = Math.round((item.count || 0) * (item.marksPerQuestion || 0));
      }
      items[index] = item;
      return { ...prev, items };
    });
  };

  const handleAddItem = () => {
    const nextIdx = blueprint.items.length + 1;
    const newItem: BlueprintCategoryItem = {
      id: `custom-item-${Date.now()}`,
      category: "broad",
      label: "নতুন ক্যাটাগরি",
      count: 2,
      marksPerQuestion: 10,
      totalMarks: 20,
      sectionName: `${String.fromCharCode(2453 + nextIdx - 1)}-বিভাগ`,
      instruction: "সকল প্রশ্নের উত্তর দেওয়া আবশ্যক।",
    };
    setBlueprint(prev => ({
      ...prev,
      items: [...prev.items, newItem],
    }));
  };

  const handleRemoveItem = (index: number) => {
    if (blueprint.items.length <= 1) {
      alert("কমপক্ষে একটি প্রশ্নের ক্যাটাগরি থাকতে হবে!");
      return;
    }
    setBlueprint(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  // Calculate sum of blueprint items marks
  const totalBlueprintMarks = blueprint.items.reduce((sum, it) => sum + (it.totalMarks || 0), 0);
  const totalQuestionsRequested = blueprint.items.reduce((sum, it) => sum + (it.count || 0), 0);
  const isMarksBalanced = totalBlueprintMarks === blueprint.totalMarks;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto print:hidden animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 text-white p-5 sm:p-6 flex items-start justify-between relative shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
              <Sparkles className="w-6 h-6 text-emerald-300 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-bold font-solaiman tracking-wide">
                  ১-ক্লিকে অটো প্রশ্নপত্র জেনারেটর
                </h2>
                <span className="bg-emerald-500/30 text-emerald-200 border border-emerald-400/40 text-xs px-2.5 py-0.5 rounded-full font-medium">
                  Smart Blueprint
                </span>
              </div>
              <p className="text-emerald-100/80 text-xs sm:text-sm mt-1">
                শিক্ষকের ব্লুপ্রিন্ট অনুযায়ী প্রশ্নব্যাংক থেকে স্বয়ংক্রিয়ভাবে ব্যালান্সড প্রশ্নপত্র প্রস্তুতকরণ
                {currentSubjectName ? ` • ${currentSubjectName}` : ""}
                {currentClassName ? ` (${currentClassName})` : ""}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/70 hover:text-white hover:bg-white/15 rounded-full transition cursor-pointer"
            title="বন্ধ করুন"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-slate-50/50">
          
          {/* Preset Blueprint Selectors */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
              জনপ্রিয় কওমি ব্লুপ্রিন্ট টেমপ্লেট নির্বাচন করুন (১-ক্লিক প্রিসেট)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {BUILT_IN_BLUEPRINTS.map(preset => {
                const isSelected = selectedPresetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className={`text-left p-3.5 rounded-xl border transition-all relative cursor-pointer ${
                      isSelected
                        ? "bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs"
                        : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/80"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="font-bold text-sm text-slate-800 font-solaiman">
                        {preset.name}
                      </h4>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        isSelected ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"
                      }`}>
                        {toBengaliNumerals(preset.totalMarks)} নম্বর
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed font-solaiman">
                      {preset.description}
                    </p>
                    {isSelected && (
                      <div className="absolute top-2 right-2 flex items-center text-emerald-600">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Blueprint Meta: Target Marks, Exam Time, Section Mode */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                কাঙ্ক্ষিত মোট নম্বর (Target Marks)
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={blueprint.totalMarks}
                  onChange={(e) => setBlueprint(prev => ({ ...prev, totalMarks: Number(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                  min="10"
                  max="500"
                />
                <span className="absolute right-3 top-2 text-xs font-semibold text-slate-400">নম্বর</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                পরীক্ষার সময় (Exam Duration)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={blueprint.time}
                  onChange={(e) => setBlueprint(prev => ({ ...prev, time: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="৩ ঘণ্টা"
                />
                <Clock className="w-4 h-4 absolute right-3 top-2.5 text-slate-400" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                লেআউট মোড (Layout Style)
              </label>
              <div className="flex items-center gap-2 mt-1.5">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={blueprint.isSectioned}
                    onChange={(e) => setBlueprint(prev => ({ ...prev, isSectioned: e.target.checked }))}
                    className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                  />
                  <span>বিভাগভিত্তিক সাজান (ক, খ, গ ইত্যাদি)</span>
                </label>
              </div>
            </div>
          </div>

          {/* Blueprint Category Items Configuration */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-bold text-slate-800 text-base font-solaiman flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-emerald-600" />
                  <span>প্রশ্নের ব্লুপ্রিন্ট তালিকা ও মান বণ্টন</span>
                </h3>
                <p className="text-xs text-slate-500">
                  নিচে ব্লুপ্রিন্টের প্রতিটি ক্যাটাগরি, প্রশ্নের সংখ্যা ও নম্বর সমন্বয় করুন
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddItem}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg border border-emerald-200 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ নতুন ক্যাটাগরি যোগ করুন</span>
              </button>
            </div>

            <div className="space-y-3">
              {blueprint.items.map((item, idx) => {
                const catMeta = CATEGORY_LABELS[item.category] || CATEGORY_LABELS.any;
                return (
                  <div
                    key={item.id || idx}
                    className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                      {/* 1. Category selector */}
                      <div className="sm:col-span-4">
                        <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                          প্রশ্নের ধরণ (Question Type)
                        </label>
                        <select
                          value={item.category}
                          onChange={(e) => handleUpdateItem(idx, { 
                            category: e.target.value as BlueprintCategoryType,
                            label: CATEGORY_LABELS[e.target.value as BlueprintCategoryType]?.name || "প্রশ্ন"
                          })}
                          className="w-full px-2.5 py-1.5 text-xs sm:text-sm border border-slate-300 rounded-lg bg-white font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                        >
                          <option value="broad">📝 রচনামূলক প্রশ্ন (Broad)</option>
                          <option value="short">✍️ সংক্ষিপ্ত প্রশ্ন (Short)</option>
                          <option value="irab_tahqeeq">📜 এরাব ও তাহকীক (إعراب وتحقيق)</option>
                          <option value="translation">📖 অনুবাদ ও তরজমা (ترجمة)</option>
                          <option value="masala">⚖️ ফিকহি মাসআলা (مسألة فقهية)</option>
                          <option value="sher">✒️ নযম ও শের (شعر وتوضيح)</option>
                          <option value="mcq">🔘 বহুনির্বাচনী (MCQ)</option>
                          <option value="any">🔹 যেকোনো সাধারণ প্রশ্ন</option>
                        </select>
                      </div>

                      {/* 2. Questions count */}
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                          প্রশ্নের সংখ্যা
                        </label>
                        <div className="flex items-center">
                          <input
                            type="number"
                            value={item.count}
                            onChange={(e) => handleUpdateItem(idx, { count: Math.max(1, Number(e.target.value) || 1) })}
                            className="w-full px-2.5 py-1.5 text-xs sm:text-sm border border-slate-300 rounded-lg text-center font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                            min="1"
                            max="50"
                          />
                          <span className="ml-1 text-xs text-slate-500">টি</span>
                        </div>
                      </div>

                      {/* 3. Marks per question */}
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                          প্রতিটির মান
                        </label>
                        <div className="flex items-center">
                          <input
                            type="number"
                            step="0.5"
                            value={item.marksPerQuestion}
                            onChange={(e) => handleUpdateItem(idx, { marksPerQuestion: Math.max(0.5, Number(e.target.value) || 1) })}
                            className="w-full px-2.5 py-1.5 text-xs sm:text-sm border border-slate-300 rounded-lg text-center font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                            min="0.5"
                            max="100"
                          />
                          <span className="ml-1 text-xs text-slate-500">নম্বর</span>
                        </div>
                      </div>

                      {/* 4. Total marks for this category */}
                      <div className="sm:col-span-3 flex items-center justify-between sm:justify-start gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                            মোট নম্বর
                          </label>
                          <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs sm:text-sm font-extrabold text-emerald-800 text-center">
                            {toBengaliNumerals(item.totalMarks)} নম্বর
                          </div>
                        </div>

                        {/* Section name badge / input if sectioned */}
                        {blueprint.isSectioned && (
                          <div className="flex-1">
                            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                              বিভাগ নাম
                            </label>
                            <input
                              type="text"
                              value={item.sectionName || ""}
                              onChange={(e) => handleUpdateItem(idx, { sectionName: e.target.value })}
                              placeholder="ক-বিভাগ"
                              className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg text-slate-700 outline-none"
                            />
                          </div>
                        )}
                      </div>

                      {/* 5. Delete button */}
                      <div className="sm:col-span-1 text-right sm:text-center pt-1">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          title="এই ক্যাটাগরি বাদ দিন"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Instruction input */}
                    <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-slate-500 shrink-0">নির্দেশনা:</span>
                      <input
                        type="text"
                        value={item.instruction || ""}
                        onChange={(e) => handleUpdateItem(idx, { instruction: e.target.value })}
                        placeholder="যেমন: যেকোনো ৪টি প্রশ্নের উত্তর দাও।"
                        className="w-full px-2 py-1 text-xs border border-slate-200 rounded-md text-slate-600 focus:border-emerald-500 outline-none bg-slate-50/50"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Blueprint Balance Indicator & Question Bank Status */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-slate-800">
                  ব্লুপ্রিন্ট মোট নম্বর:
                </span>
                <span className={`text-base font-extrabold px-3 py-0.5 rounded-full border ${
                  isMarksBalanced 
                    ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                    : "bg-amber-100 text-amber-800 border-amber-300"
                }`}>
                  {toBengaliNumerals(totalBlueprintMarks)} / {toBengaliNumerals(blueprint.totalMarks)} নম্বর
                </span>
                {isMarksBalanced ? (
                  <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> পূর্ণাঙ্গ ব্যালান্সড
                  </span>
                ) : (
                  <span className="text-xs font-semibold text-amber-600 flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" /> 
                    {totalBlueprintMarks > blueprint.totalMarks 
                      ? `${toBengaliNumerals(totalBlueprintMarks - blueprint.totalMarks)} নম্বর বেশি` 
                      : `${toBengaliNumerals(blueprint.totalMarks - totalBlueprintMarks)} নম্বর কম`}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                মোট নির্বাচিত প্রশ্ন সংখ্যা: <span className="font-bold text-slate-700">{toBengaliNumerals(totalQuestionsRequested)} টি</span> | প্রশ্নব্যাংকে মোট প্রশ্ন আছে: <span className="font-bold text-slate-700">{toBengaliNumerals(totalAvailableQuestions)} টি</span>
              </p>
            </div>

            {totalAvailableQuestions < totalQuestionsRequested && (
              <div className="text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  প্রশ্নব্যাংকে প্রশ্নের ঘাটতি থাকলে সিস্টেম অটো-স্যাম্পল দিয়ে ব্যালান্স করবে।
                </span>
              </div>
            )}
          </div>

        </div>

        {/* Modal Footer */}
        <div className="bg-slate-100/90 border-t border-slate-200 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 font-medium">
            💡 জেনারেট হওয়ার পর যেকোনো প্রশ্ন এক ক্লিকে বদলানো (Swap) বা এডিট করতে পারবেন।
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition cursor-pointer"
            >
              বাতিল
            </button>
            <button
              type="button"
              onClick={() => onGenerate(blueprint)}
              className="px-6 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer transform active:scale-98"
            >
              <Sparkles className="w-4 h-4" />
              <span>১-ক্লিকে প্রশ্নপত্র তৈরি করুন</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
