"use client";

import React from "react";
import { 
  toArabicNumerals, 
  toBengaliNumerals, 
  isArabicText 
} from "@/lib/utils";
import { BookOpen, Sparkles, Scale, Scroll, HelpCircle } from "lucide-react";

export interface QuestionOptions {
  // Common & Or / বিকল্প
  has_or?: boolean;
  or_text?: string;
  or_type?: string;
  or_irab_text?: string;
  or_verses?: Array<{ first: string; second: string }>;
  or_tahqeeq_words?: string[];
  or_scenario?: string;

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
  sub_questions?: string[];

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

export default function SpecializedQuestionView({
  question,
  index,
  isRTL = false,
  formatNumber,
  isPrint = false,
  hideMarks = false,
}: SpecializedQuestionViewProps) {
  const options: QuestionOptions = Array.isArray(question.options)
    ? { mcq_options: question.options }
    : (question.options || {});

  const qType = question.question_type;
  const autoRTL = isRTL || isArabicText(question.question_text);

  const renderOptionLabel = (idx: number, isArabic: boolean) => {
    if (isArabic) {
      const letters = ["(أ)", "(ب)", "(ج)", "(د)", "(هـ)"];
      return letters[idx] || `(${idx + 1})`;
    }
    const bnLetters = ["(ক)", "(খ)", "(গ)", "(ঘ)", "(ঙ)"];
    return bnLetters[idx] || `(${idx + 1})`;
  };

  return (
    <div className={`specialized-question-container ${autoRTL ? "font-amiri text-right" : "font-solaiman text-left"}`}>
      {/* 1. Main Question Prompt Header */}
      <div className="flex justify-between items-start gap-3">
        <div className="flex-1">
          <p
            className={`font-semibold text-slate-900 ${
              autoRTL
                ? "text-lg sm:text-xl leading-[2.2] tracking-wide font-amiri"
                : "text-base sm:text-lg leading-relaxed"
            }`}
            dir={autoRTL ? "rtl" : "auto"}
          >
            {typeof index === "number" && (
              <span className={`font-bold text-slate-900 inline-block ${autoRTL ? "ml-2" : "mr-2"}`}>
                {formatNumber ? formatNumber(index, autoRTL) : `${index + 1}.`}
              </span>
            )}
            <span>{question.question_text}</span>
          </p>
        </div>

        {!hideMarks && question.marks !== undefined && (
          <div className="shrink-0 pt-0.5">
            <span
              className={`font-bold text-slate-800 text-xs sm:text-sm px-2 py-0.5 bg-slate-100 print:bg-transparent rounded border border-slate-300 print:border-black ${
                autoRTL ? "font-amiri" : ""
              }`}
            >
              [{autoRTL ? toArabicNumerals(question.marks) : toBengaliNumerals(question.marks)}]
            </span>
          </div>
        )}
      </div>

      {/* 2. Specialized Content based on Type */}

      {/* --- A. إعراب العبارة (Irab & Harkat) --- */}
      {(qType === "Irab" || qType === "إعراب العبارة" || options.irab_text) && options.irab_text && (
        <div
          dir="rtl"
          className="my-3 p-3.5 sm:p-4 rounded-lg bg-amber-50/50 border border-amber-300/80 print:bg-transparent print:border-black print:p-3 print:my-2 shadow-xs"
        >
          <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-amber-200 print:border-black print:pb-1">
            <span className="text-xs font-bold text-amber-900 print:text-black flex items-center gap-1 font-amiri">
              <Scroll className="w-3.5 h-3.5 print:hidden" />
              <span>العبارة المطلوب إعرابها وضبطها:</span>
            </span>
            <span className="text-[11px] text-amber-700 print:text-black italic font-solaiman">
              (ইবারতে হরকত ও চিহ্নিত অংশের তারকীব)
            </span>
          </div>
          <div
            className="text-xl sm:text-2xl leading-[2.5] font-amiri text-slate-950 font-medium tracking-wide text-right px-1"
          >
            {options.irab_text}
          </div>
          {options.target_words && (
            <div className="mt-2.5 pt-2 border-t border-dashed border-amber-300 print:border-black text-xs text-amber-900 print:text-black font-solaiman flex items-center gap-2">
              <span className="font-bold">চিহ্নিত শব্দসমূহ / الكلمات المحددة:</span>
              <span className="font-amiri font-bold text-sm bg-white print:bg-transparent px-2 py-0.5 rounded border border-amber-200 print:border-black">
                {options.target_words}
              </span>
            </div>
          )}
        </div>
      )}

      {/* --- B. تحقيق الكلمات (Tahqeeq & Sarf Table) --- */}
      {(qType === "Tahqeeq" || qType === "تحقيق الكلمات" || (options.tahqeeq_words && options.tahqeeq_words.length > 0)) && (
        <div className="my-3 print:my-2 overflow-x-auto">
          <table
            dir="rtl"
            className="w-full border-collapse border border-slate-300 print:border-black text-center text-xs sm:text-sm font-amiri bg-white print:bg-transparent"
          >
            <thead>
              <tr className="bg-slate-100 print:bg-gray-100 text-slate-900 font-bold border-b border-slate-300 print:border-black">
                <th className="border border-slate-300 print:border-black px-2 py-1.5 w-24">
                  الكلمة <span className="font-solaiman text-[10px] text-slate-500 print:text-black block">(শব্দ)</span>
                </th>
                <th className="border border-slate-300 print:border-black px-2 py-1.5 w-28">
                  الصيغة <span className="font-solaiman text-[10px] text-slate-500 print:text-black block">(সীগাহ)</span>
                </th>
                <th className="border border-slate-300 print:border-black px-2 py-1.5 w-28">
                  البحث <span className="font-solaiman text-[10px] text-slate-500 print:text-black block">(বাহাছ)</span>
                </th>
                <th className="border border-slate-300 print:border-black px-2 py-1.5 w-24">
                  الباب <span className="font-solaiman text-[10px] text-slate-500 print:text-black block">(বাব)</span>
                </th>
                <th className="border border-slate-300 print:border-black px-2 py-1.5 w-28">
                  المصدر <span className="font-solaiman text-[10px] text-slate-500 print:text-black block">(মাছদার)</span>
                </th>
                <th className="border border-slate-300 print:border-black px-2 py-1.5 w-24">
                  المادة <span className="font-solaiman text-[10px] text-slate-500 print:text-black block">(মাদ্দা)</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {(options.tahqeeq_words || ["يَنْصُرُونَ", "اِسْتَغْفَرَ"]).map((word, wIdx) => (
                <tr key={wIdx} className="border-b border-slate-300 print:border-black">
                  <td className="border border-slate-300 print:border-black px-2 py-2 font-bold text-base sm:text-lg bg-slate-50/50 print:bg-transparent">
                    {word}
                  </td>
                  <td className="border border-slate-300 print:border-black px-2 py-2 text-slate-300 print:text-transparent">
                    ..................
                  </td>
                  <td className="border border-slate-300 print:border-black px-2 py-2 text-slate-300 print:text-transparent">
                    ..................
                  </td>
                  <td className="border border-slate-300 print:border-black px-2 py-2 text-slate-300 print:text-transparent">
                    ..................
                  </td>
                  <td className="border border-slate-300 print:border-black px-2 py-2 text-slate-300 print:text-transparent">
                    ..................
                  </td>
                  <td className="border border-slate-300 print:border-black px-2 py-2 text-slate-300 print:text-transparent">
                    ..................
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* --- C. شعر وتوضيح (Poetry & Verses) --- */}
      {(qType === "Sher" || qType === "شعر وتوضيح" || (options.verses && options.verses.length > 0)) && (
        <div
          dir="rtl"
          className="my-3 p-3.5 rounded-lg bg-purple-50/40 border border-purple-200 print:bg-transparent print:border-black print:p-2 print:my-2"
        >
          {options.poet_name && (
            <div className="text-left font-solaiman text-xs text-purple-700 print:text-black mb-1 italic">
              কবি: {options.poet_name}
            </div>
          )}
          <div className="space-y-2.5">
            {(options.verses || [{ first: "إذا غامَرْتَ في شَرَفٍ مَرُومِ", second: "فَلا تَقْنَعْ بما دونَ النّجومِ" }]).map((verse, vIdx) => (
              <div
                key={vIdx}
                className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6 py-1.5 px-3 border-y border-dashed border-purple-200 print:border-black text-center font-amiri text-lg sm:text-xl leading-loose font-medium"
              >
                <div className="sm:border-l sm:border-purple-200 print:sm:border-black sm:pl-3">
                  {verse.first}
                </div>
                <div className="sm:pr-3">
                  {verse.second}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- D. مسألة فقهية (Fiqh Mas'ala & Scenario) --- */}
      {(qType === "Masala" || qType === "مسألة فقهية" || options.scenario) && options.scenario && (
        <div
          className="my-3 p-3.5 rounded-lg bg-emerald-50/50 border border-emerald-200 print:bg-transparent print:border-black print:p-2.5 print:my-2"
        >
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900 print:text-black mb-1.5">
            <Scale className="w-3.5 h-3.5 print:hidden" />
            <span className="font-amiri text-sm">صورت حال / সুরতহাল (প্রেক্ষাপট):</span>
          </div>
          <p
            dir="auto"
            className="text-sm sm:text-base leading-relaxed text-slate-800 print:text-black font-solaiman italic bg-white print:bg-transparent p-2.5 rounded border border-emerald-100 print:border-black"
          >
            &ldquo;{options.scenario}&rdquo;
          </p>

          {options.sub_questions && options.sub_questions.length > 0 && (
            <div className="mt-2.5 space-y-1">
              <span className="text-xs font-bold text-emerald-900 print:text-black block">
                জিজ্ঞাসিত প্রশ্নাবলি:
              </span>
              <ul className="list-disc list-inside text-xs sm:text-sm text-slate-700 print:text-black space-y-0.5">
                {options.sub_questions.map((subQ, sIdx) => (
                  <li key={sIdx}>{subQ}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* --- E. বহুনির্বাচনী অপশন (MCQ Options) --- */}
      {qType === "MCQ" && (options.mcq_options || Array.isArray(question.options)) && (
        <div
          dir={autoRTL ? "rtl" : "auto"}
          className={`grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 ${
            autoRTL ? "pr-4 sm:pr-6 text-base leading-loose font-amiri" : "pl-4 sm:pl-6 text-xs sm:text-sm font-solaiman"
          }`}
        >
          {(options.mcq_options || question.options || []).map((opt: string, i: number) => (
            <div key={i} className="flex items-center gap-1.5 text-slate-800 print:text-black">
              <span className="font-bold text-slate-700 print:text-black">
                {renderOptionLabel(i, autoRTL)}
              </span>
              <span>{opt}</span>
            </div>
          ))}
        </div>
      )}

      {/* 3. অথবা / বা / বা / বিকল্প প্রশ্ন (Or / أو) */}
      {options.has_or && options.or_text && (
        <div className="mt-4 pt-2 border-t border-dashed border-slate-300 print:border-black">
          {/* Centered Decorative 'Or / অথবা / أو' Badge */}
          <div className="flex items-center justify-center my-2">
            <div className="h-[1px] bg-slate-300 print:bg-black flex-1 max-w-[80px]" />
            <span
              className="mx-3 px-3 py-0.5 rounded-full bg-slate-100 print:bg-transparent border border-slate-300 print:border-black text-xs sm:text-sm font-extrabold text-slate-800 print:text-black tracking-wider"
              dir="rtl"
            >
              — أو / অথবা —
            </span>
            <div className="h-[1px] bg-slate-300 print:bg-black flex-1 max-w-[80px]" />
          </div>

          {/* Alternative Question Body */}
          <div className={`p-2 rounded-lg ${isArabicText(options.or_text) ? "font-amiri text-right" : "font-solaiman text-left"}`}>
            <p
              className={`font-semibold text-slate-900 print:text-black ${
                isArabicText(options.or_text)
                  ? "text-lg sm:text-xl leading-[2.2] font-amiri"
                  : "text-base sm:text-lg leading-relaxed"
              }`}
              dir={isArabicText(options.or_text) ? "rtl" : "auto"}
            >
              {options.or_text}
            </p>

            {/* If Or has its own Irab Text */}
            {options.or_irab_text && (
              <div
                dir="rtl"
                className="my-2 p-3 rounded-lg bg-amber-50/40 border border-amber-300 print:bg-transparent print:border-black text-lg sm:text-xl font-amiri leading-[2.4] text-right font-medium"
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
                    className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-center font-amiri text-lg leading-loose"
                  >
                    <div>{verse.first}</div>
                    <div>{verse.second}</div>
                  </div>
                ))}
              </div>
            )}

            {/* If Or has its own scenario */}
            {options.or_scenario && (
              <div className="my-2 p-2.5 rounded bg-emerald-50/40 border border-emerald-200 print:bg-transparent print:border-black text-xs sm:text-sm font-solaiman italic">
                &ldquo;{options.or_scenario}&rdquo;
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
