"use client";

import React from "react";
import { 
  toArabicNumerals, 
  toBengaliNumerals, 
  isArabicText 
} from "@/lib/utils";
import { Scroll, Scale, Columns, Layers } from "lucide-react";

export interface SubQuestionItem {
  text: string;
  marks?: number;
  label?: string;
}

export interface QuestionOptions {
  // Common & Or / বিকল্প
  has_or?: boolean;
  or_text?: string;
  or_type?: string;
  or_irab_text?: string;
  or_verses?: Array<{ first: string; second: string }>;
  or_tahqeeq_words?: string[];
  or_scenario?: string;
  or_sub_questions?: Array<string | SubQuestionItem>;

  // Sub-questions (ক, খ, গ... বা أ، ب، ج...)
  sub_questions?: Array<string | SubQuestionItem>;

  // إعراب العبارة
  irab_text?: string;
  target_words?: string; // words/phrases to highlight or parse

  // تحقيق الكلمات
  tahqeeq_words?: string[];

  // شعر وتوضيح
  verses?: Array<{ first: string; second: string }>;
  poet_name?: string;

  // مسألة فقهية
  scenario?: string;

  // MCQ
  mcq_options?: string[];
  [key: string]: any;
}

interface SpecializedQuestionViewProps {
  question: {
    id?: string;
    question_type: string;
    question_text: string;
    marks?: number;
    options?: QuestionOptions | any;
  };
  index?: number;
  isRTL?: boolean;
  formatNumber?: (idx: number, isRTL: boolean) => string;
  isPrint?: boolean;
  hideMarks?: boolean;
  fontFamilyClass?: string;
}

export function getQuestionTypeBadge(type: string) {
  switch (type) {
    case "Irab":
    case "irab":
    case "إعراب العبارة":
      return { label: "إعراب العبارة (এরাব ও তারকীব)", color: "bg-amber-100 text-amber-800 border-amber-300" };
    case "Tahqeeq":
    case "tahqeeq":
    case "تحقيق الكلمات":
      return { label: "تحقيق الكلمات (তাহকীক ও ছরফ)", color: "bg-blue-100 text-blue-800 border-blue-300" };
    case "Sher":
    case "sher":
    case "شعر وتوضيح":
      return { label: "شعر وتوضيح (নযম ও শের)", color: "bg-purple-100 text-purple-800 border-purple-300" };
    case "Masala":
    case "masala":
    case "مسألة فقهية":
      return { label: "مسألة فقهية (ফিকহি মাসআলা)", color: "bg-emerald-100 text-emerald-800 border-emerald-300" };
    case "MCQ":
      return { label: "বহুনির্বাচনী (MCQ)", color: "bg-cyan-100 text-cyan-800 border-cyan-300" };
    case "Short":
      return { label: "সংক্ষিপ্ত প্রশ্ন (Short)", color: "bg-slate-100 text-slate-800 border-slate-300" };
    case "Broad":
    default:
      return { label: "রচনামূলক প্রশ্ন (Broad)", color: "bg-indigo-100 text-indigo-800 border-indigo-300" };
  }
}

export function getDifficultyBadge(diff?: string) {
  const d = (diff || "medium").toLowerCase();
  switch (d) {
    case "easy":
    case "সহজ":
      return { label: "সহজ (Easy)", color: "bg-emerald-100 text-emerald-800 border-emerald-300 ring-emerald-500/20" };
    case "hard":
    case "কঠিন":
      return { label: "কঠিন (Hard)", color: "bg-rose-100 text-rose-800 border-rose-300 ring-rose-500/20" };
    case "medium":
    case "মধ্যম":
    default:
      return { label: "মধ্যম (Medium)", color: "bg-amber-100 text-amber-800 border-amber-300 ring-amber-500/20" };
  }
}

export const ARABIC_SUB_LETTERS = ["(أ)", "(ب)", "(ج)", "(د)", "(هـ)", "(و)", "(ز)", "(ح)", "(ط)", "(ي)"];
export const BENGALI_SUB_LETTERS = ["(ক)", "(খ)", "(গ)", "(ঘ)", "(ঙ)", "(চ)", "(ছ)", "(জ)", "(ঝ)", "(ঞ)"];

export function getSubQuestionLabel(idx: number, isArabic: boolean): string {
  if (isArabic) {
    return ARABIC_SUB_LETTERS[idx] || `(${toArabicNumerals(idx + 1)})`;
  }
  return BENGALI_SUB_LETTERS[idx] || `(${toBengaliNumerals(idx + 1)})`;
}

export default function SpecializedQuestionView({
  question,
  index,
  isRTL = false,
  formatNumber,
  isPrint = false,
  hideMarks = false,
  fontFamilyClass,
}: SpecializedQuestionViewProps) {
  const options: QuestionOptions = Array.isArray(question.options)
    ? { mcq_options: question.options }
    : (question.options || {});

  const qType = question.question_type;
  const isTextArabic = isArabicText(question.question_text) || isArabicText(options.irab_text || "");
  const autoRTL = isRTL || isTextArabic;

  const fontClass = fontFamilyClass || (autoRTL ? "font-amiri" : "font-solaiman");

  const renderSubQuestions = (subList: Array<string | SubQuestionItem>, isArabicMode: boolean) => {
    if (!subList || subList.length === 0) return null;

    return (
      <div 
        className={`mt-2.5 space-y-2 ${isArabicMode ? "pr-2 sm:pr-4" : "pl-2 sm:pl-4"}`}
        dir={isArabicMode ? "rtl" : "ltr"}
      >
        {subList.map((item, sIdx) => {
          let text = typeof item === "string" ? item : item.text;
          const subMarks = typeof item === "object" ? item.marks : undefined;
          const defaultLabel = getSubQuestionLabel(sIdx, isArabicMode);
          
          // Check if text already starts with a label like (ক), (খ), (أ), (ب), ক., أ., etc.
          const hasPrefix = isArabicMode
            ? /^\s*(\([أ-ي0-9٠-٩]+\)|[أ-ي0-9٠-٩]+[\.\-\:])/i.test(text)
            : /^\s*(\([ক-ঞ0-9০-৯]+\)|[ক-ঞ0-9০-৯]+[\.\-\:])/i.test(text);

          return (
            <div 
              key={sIdx} 
              className={`flex items-start justify-between gap-2 py-0.5 text-slate-900 ${
                isArabicMode ? "text-base sm:text-lg leading-[2.1]" : "text-sm sm:text-base leading-relaxed"
              }`}
            >
              <div className="flex-1 flex items-start gap-1.5">
                {!hasPrefix && (
                  <span className={`font-bold shrink-0 text-slate-950 ${isArabicMode ? "text-lg ml-1" : "mr-1"}`}>
                    {defaultLabel}
                  </span>
                )}
                <span className="font-medium">{text}</span>
              </div>
              {subMarks !== undefined && subMarks > 0 && !hideMarks && (
                <span className="shrink-0 font-bold text-xs sm:text-sm px-1.5 py-0.2 bg-slate-100 print:bg-transparent rounded border border-slate-300 print:border-black">
                  [{isArabicMode ? toArabicNumerals(subMarks) : toBengaliNumerals(subMarks)}]
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div 
      className={`specialized-question-container ${autoRTL ? "text-right" : "text-left"} ${fontFamilyClass ? fontFamilyClass : ""}`}
      dir={autoRTL ? "rtl" : "ltr"}
    >
      {/* 1. Main Question Prompt Header */}
      <div 
        className="flex justify-between items-start gap-3"
        dir={autoRTL ? "rtl" : "ltr"}
      >
        <div className="flex-1">
          <p
            className={`font-semibold text-slate-950 ${
              autoRTL
                ? "text-lg sm:text-xl leading-[2.2] tracking-wide"
                : "text-base sm:text-lg leading-relaxed"
            }`}
            dir={autoRTL ? "rtl" : "ltr"}
          >
            {typeof index === "number" && (
              <span className={`font-bold text-slate-950 inline-block ${autoRTL ? "ml-2" : "mr-2"}`}>
                {formatNumber ? formatNumber(index, autoRTL) : (autoRTL ? `${toArabicNumerals(index + 1)}.` : `${index + 1}.`)}
              </span>
            )}
            <span>{question.question_text}</span>
          </p>
        </div>

        {!hideMarks && question.marks !== undefined && (
          <div className="shrink-0 pt-0.5">
            <span
              className="font-bold text-slate-900 text-xs sm:text-sm px-2 py-0.5 bg-slate-100 print:bg-transparent rounded border border-slate-300 print:border-black"
            >
              [{autoRTL ? toArabicNumerals(question.marks) : toBengaliNumerals(question.marks)}]
            </span>
          </div>
        )}
      </div>

      {/* General / Multi-part Sub-Questions (ক, খ... বা أ، ب...) outside of Masala if present */}
      {options.sub_questions && options.sub_questions.length > 0 && qType !== "Masala" && qType !== "مسألة فقهية" && (
        renderSubQuestions(options.sub_questions, autoRTL)
      )}

      {/* 2. Specialized Content based on Type */}

      {/* --- A. إعراب العبارة (Irab & Harkat) --- */}
      {(qType === "Irab" || qType === "إعراب العبارة" || options.irab_text) && options.irab_text && (
        <div
          dir={autoRTL ? "rtl" : "ltr"}
          className="my-2.5 py-2 px-3 bg-slate-50/50 print:bg-transparent border-r-4 border-slate-700 print:border-black rounded-r"
        >
          <div className="flex items-center justify-between pb-1 mb-1.5 border-b border-slate-200 print:border-black">
            <span className={`text-xs font-bold text-slate-800 print:text-black flex items-center gap-1`}>
              <Scroll className="w-3.5 h-3.5 print:hidden" />
              <span>{autoRTL ? "العبارة المطلوب ضبطها وإعرابها:" : "ইবারতে হরকত ও চিহ্নিত অংশের তারকীব:"}</span>
            </span>
          </div>
          <div
            dir="rtl"
            className="text-xl sm:text-2xl leading-[2.5] text-slate-950 font-medium tracking-wide text-right px-1"
          >
            {options.irab_text}
          </div>
          {options.target_words && (
            <div className={`mt-2 pt-1.5 border-t border-dashed border-slate-300 print:border-black text-xs text-slate-900 print:text-black flex items-center gap-2 ${autoRTL ? "text-sm text-right" : ""}`}>
              <span className="font-bold">{autoRTL ? "الكلمات المحددة للإعراب:" : "চিহ্নিত শব্দসমূহ:"}</span>
              <span className="font-bold text-base px-2 py-0.5 underline decoration-slate-400">
                {options.target_words}
              </span>
            </div>
          )}
        </div>
      )}

      {/* --- B. تحقيق الكلمات (Tahqeeq & Sarf) --- */}
      {(qType === "Tahqeeq" || qType === "تحقيق الكلمات" || (options.tahqeeq_words && options.tahqeeq_words.length > 0)) && (
        <div className="my-2.5 print:my-1.5">
          <div className="flex flex-wrap items-center gap-2 text-sm sm:text-base py-1">
            <span className="font-bold text-slate-900 print:text-black text-xs sm:text-sm">
              {autoRTL ? "الكلمات:" : "শব্দসমূহ:"}
            </span>
            {(options.tahqeeq_words || ["يَنْصُرُونَ", "اِسْتَغْفَرَ", "تُسَبِّحُونَ"]).map((word: string, wIdx: number) => (
              <span
                key={wIdx}
                dir="rtl"
                className="inline-flex items-center gap-1 font-bold text-base sm:text-lg px-2.5 py-0.5 bg-slate-100/80 print:bg-transparent rounded border border-slate-300 print:border-black"
              >
                <span className="text-xs text-slate-500 print:text-black font-normal">
                  ({autoRTL ? toArabicNumerals(wIdx + 1) : toBengaliNumerals(wIdx + 1)})
                </span>
                <span>{word}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* --- C. شعر وتوضيح (Poetry & Verses) --- */}
      {(qType === "Sher" || qType === "شعر وتوضيح" || (options.verses && options.verses.length > 0)) && (
        <div
          dir={autoRTL ? "rtl" : "ltr"}
          className="my-2.5 py-1.5 px-3 bg-slate-50/40 print:bg-transparent border-y border-dashed border-slate-300 print:border-black"
        >
          {options.poet_name && (
            <div className={`mb-1 italic text-slate-700 print:text-black ${autoRTL ? "text-right text-sm" : "text-left text-xs"}`}>
              {autoRTL ? `الشاعر: ${options.poet_name}` : `কবি: ${options.poet_name}`}
            </div>
          )}
          <div className="space-y-2">
            {(options.verses || [{ first: "إذا غامَرْتَ في شَرَفٍ مَرُومِ", second: "فَلا تَقْنَعْ بما دونَ النّجومِ" }]).map((verse: any, vIdx: number) => (
              <div
                key={vIdx}
                dir="rtl"
                className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 py-1 text-center text-lg sm:text-xl leading-loose font-medium"
              >
                <span className="text-right">{verse.first}</span>
                <span className="text-sm text-slate-400 print:text-black select-none px-2">⁂</span>
                <span className="text-left">{verse.second}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- D. مسألة فقهية (Fiqh Mas'ala & Scenario) --- */}
      {(qType === "Masala" || qType === "مسألة فقهية" || options.scenario) && options.scenario && (
        <div
          className="my-2.5 py-2 px-3 bg-slate-50/50 print:bg-transparent border-l-4 border-slate-700 print:border-black rounded-l"
        >
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 print:text-black mb-1">
            <Scale className="w-3.5 h-3.5 print:hidden" />
            <span className={autoRTL ? "text-sm" : ""}>
              {autoRTL ? "صورة المسألة الواقعية:" : "সুরতহাল (প্রেক্ষাপট):"}
            </span>
          </div>
          <p
            dir={autoRTL ? "rtl" : "ltr"}
            className={`text-sm sm:text-base leading-relaxed text-slate-900 print:text-black italic ${
              autoRTL ? "text-lg leading-loose text-right" : ""
            }`}
          >
            &ldquo;{options.scenario}&rdquo;
          </p>

          {options.sub_questions && options.sub_questions.length > 0 && (
            <div className="mt-2 space-y-1">
              <span className={`text-xs font-bold text-slate-800 print:text-black block ${autoRTL ? "text-sm text-right" : ""}`}>
                {autoRTL ? "الأسئلة والمسائل المطلوبة:" : "জিজ্ঞাসিত প্রশ্নাবলি:"}
              </span>
              {renderSubQuestions(options.sub_questions, autoRTL)}
            </div>
          )}
        </div>
      )}

      {/* --- E. বহুনির্বাচনী অপশন (MCQ Options) --- */}
      {qType === "MCQ" && (options.mcq_options || Array.isArray(question.options)) && (
        <div
          dir={autoRTL ? "rtl" : "ltr"}
          className={`grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 ${
            autoRTL ? "pr-4 sm:pr-6 text-base leading-loose" : "pl-4 sm:pl-6 text-xs sm:text-sm"
          }`}
        >
          {(options.mcq_options || question.options || []).map((opt: string, i: number) => (
            <div key={i} className="flex items-center gap-1.5 text-slate-900 print:text-black">
              <span className="font-bold text-slate-950 print:text-black">
                {getSubQuestionLabel(i, autoRTL)}
              </span>
              <span>{opt}</span>
            </div>
          ))}
        </div>
      )}

      {/* 3. অথবা / বিকল্প প্রশ্ন (Or / أو) — Strictly separated by language */}
      {options.has_or && options.or_text && (
        <div className="mt-4 pt-2 border-t border-dashed border-slate-300 print:border-black">
          {/* Centered Decorative 'Or' Badge: Strict Pure Arabic '— أو —' vs Pure Bengali '— অথবা —' */}
          <div className="flex items-center justify-center my-2">
            <div className="h-[1px] bg-slate-300 print:bg-black flex-1 max-w-[80px]" />
            <span
              className={`mx-3 px-3 py-0.5 rounded-full bg-slate-100 print:bg-transparent border border-slate-300 print:border-black font-extrabold text-slate-900 print:text-black tracking-wider ${
                autoRTL || isArabicText(options.or_text) ? "text-sm sm:text-base" : "text-xs sm:text-sm"
              }`}
              dir={autoRTL || isArabicText(options.or_text) ? "rtl" : "ltr"}
            >
              {autoRTL || isArabicText(options.or_text) ? "— أو —" : "— অথবা —"}
            </span>
            <div className="h-[1px] bg-slate-300 print:bg-black flex-1 max-w-[80px]" />
          </div>

          {/* Alternative Question Body */}
          <div className={`p-2 rounded-lg ${(autoRTL || isArabicText(options.or_text)) ? "text-right" : "text-left"}`}>
            <p
              className={`font-semibold text-slate-950 print:text-black ${
                (autoRTL || isArabicText(options.or_text))
                  ? "text-lg sm:text-xl leading-[2.2]"
                  : "text-base sm:text-lg leading-relaxed"
              }`}
              dir={(autoRTL || isArabicText(options.or_text)) ? "rtl" : "ltr"}
            >
              {options.or_text}
            </p>

            {/* If Or has its own sub-questions */}
            {options.or_sub_questions && options.or_sub_questions.length > 0 && (
              renderSubQuestions(options.or_sub_questions, autoRTL || isArabicText(options.or_text))
            )}

            {/* If Or has its own Irab Text */}
            {options.or_irab_text && (
              <div
                dir="rtl"
                className="my-2 p-3 rounded-lg bg-amber-50/40 border border-amber-300 print:bg-transparent print:border-black text-lg sm:text-xl leading-[2.4] text-right font-medium"
              >
                {options.or_irab_text}
              </div>
            )}

            {/* If Or has its own verses */}
            {options.or_verses && options.or_verses.length > 0 && (
              <div
                dir="rtl"
                className="my-2 p-3 rounded-lg bg-purple-50/30 border border-purple-200 print:bg-transparent print:border-black space-y-1.5"
              >
                {options.or_verses.map((verse, ovIdx) => (
                  <div
                    key={ovIdx}
                    className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-center text-lg leading-loose"
                  >
                    <div>{verse.first}</div>
                    <div>{verse.second}</div>
                  </div>
                ))}
              </div>
            )}

            {/* If Or has its own scenario */}
            {options.or_scenario && (
              <div 
                dir={(autoRTL || isArabicText(options.or_scenario)) ? "rtl" : "ltr"}
                className={`my-2 p-2.5 rounded bg-emerald-50/40 border border-emerald-200 print:bg-transparent print:border-black text-xs sm:text-sm italic ${
                  (autoRTL || isArabicText(options.or_scenario)) ? "text-base" : ""
                }`}
              >
                &ldquo;{options.or_scenario}&rdquo;
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

