"use client";

import { useState } from "react";
import { 
  X, Printer, Copy, Award, Clock, BookOpen, Layers, 
  CheckCircle2, Download, Sparkles, Building2, Tag 
} from "lucide-react";
import SpecializedQuestionView from "./SpecializedQuestionView";
import { IslamicCalligraphyHeader, PaperFrameWrapper, MadrasaPaperHeader } from "./IslamicPaperDecorations";

interface ArchivedPaperPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  paper: any;
  madrasa?: any;
  onCloneClick?: (paper: any) => void;
}

function toBengaliNumerals(num: number): string {
  const digits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return num.toString().split("").map(d => digits[parseInt(d)] || d).join("");
}

export default function ArchivedPaperPreviewModal({
  isOpen,
  onClose,
  paper,
  madrasa,
  onCloneClick,
}: ArchivedPaperPreviewModalProps) {
  if (!isOpen || !paper) return null;

  const qData = paper.questions || {};
  const isSectioned = Boolean(qData.is_sectioned && Array.isArray(qData.sections));
  const sections = isSectioned ? qData.sections : [];
  const unsectioned = Array.isArray(qData) ? qData : Array.isArray(qData.questions) ? qData.questions : [];

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto animate-fadeIn print:p-0 print:bg-white print:fixed-none">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[95vh] print:max-h-none print:shadow-none print:border-none print:rounded-none">
        {/* Top Control Bar (Hidden on Print) */}
        <div className="bg-slate-900 text-white p-4 px-6 flex items-center justify-between shrink-0 print:hidden">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/10 rounded-lg text-indigo-300">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">
                {paper.title || paper.exam?.title} — প্রিভিউ ও প্রিন্ট
              </h2>
              <p className="text-xs text-slate-300">
                {paper.class?.name} • {paper.subject?.name} • শিক্ষাবর্ষ: {paper.academic_year || paper.exam?.year || "২০২৬"}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {onCloneClick && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onCloneClick(paper);
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              >
                <Copy className="w-4 h-4" />
                <span>ক্লোন / ডুপ্লিকেট</span>
              </button>
            )}
            <button
              type="button"
              onClick={handlePrint}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
            >
              <Printer className="w-4 h-4" />
              <span>প্রিন্ট করুন</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Paper Document Preview Area */}
        <div className="p-4 sm:p-8 overflow-y-auto flex-1 bg-slate-100 print:p-0 print:bg-white font-serif">
          <div className="max-w-[210mm] mx-auto bg-white p-6 sm:p-10 shadow-lg border border-slate-300 rounded-sm print:shadow-none print:border-none print:p-4 print:max-w-none">
            {/* Islamic Calligraphy Bismillah */}
            <div className="text-center mb-3">
              <span className="font-arabic text-xl sm:text-2xl text-slate-800 tracking-wider">
                بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
              </span>
            </div>

            {/* Header / Madrasa Info */}
            <div className="text-center border-b-2 border-slate-800 pb-3 mb-4">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-wide font-sans">
                {madrasa?.name || "জামিয়া ইসলামিয়া আরাবিয়া"}
              </h1>
              <p className="text-xs text-slate-600 font-sans mt-0.5">
                {madrasa?.address || "ঢাকা, বাংলাদেশ"}
              </p>
              <div className="mt-2 inline-block bg-slate-900 text-white px-4 py-1 rounded-full text-xs font-bold font-sans tracking-wide">
                {paper.title || paper.exam_name || paper.exam?.title || "বার্ষিক পরীক্ষা"}
              </div>

              {/* Metadata Grid */}
              <div className="grid grid-cols-3 text-xs font-semibold text-slate-800 mt-3 pt-2 border-t border-slate-200 font-sans">
                <div className="text-left">
                  জামাত: <span className="font-bold">{paper.class?.name || "—"}</span>
                </div>
                <div className="text-center">
                  বিষয়: <span className="font-bold">{paper.subject?.name || "—"}</span>
                </div>
                <div className="text-right">
                  সময়: <span className="font-bold">{paper.exam_time || "২ ঘণ্টা ৩০ মিনিট"}</span>
                </div>
                <div className="text-left mt-1">
                  শিক্ষাবর্ষ: <span className="font-bold">{paper.academic_year || paper.exam?.year || "২০২৬"}</span>
                </div>
                <div className="text-center mt-1">
                  অবস্থা: <span className="font-bold text-emerald-700">সংরক্ষিত আর্কাইভ</span>
                </div>
                <div className="text-right mt-1">
                  পূর্ণমান: <span className="font-bold text-indigo-700">{toBengaliNumerals(paper.total_marks || 100)}</span>
                </div>
              </div>
            </div>

            {/* Paper Instructions */}
            <div className="text-xs text-slate-700 italic text-center mb-5 font-sans bg-slate-50 py-1.5 border-y border-dashed border-slate-300">
              [ দ্রষ্টব্য: সকল প্রশ্নের উত্তর দেওয়া আবশ্যক। ডান পাশের সংখ্যা প্রশ্নের পূর্ণমান জ্ঞাপক। ]
            </div>

            {/* Questions Body */}
            <div className="space-y-6">
              {isSectioned ? (
                sections.map((section: any, sIdx: number) => (
                  <div key={section.id || sIdx} className="space-y-3">
                    {/* Section Header */}
                    <div className="flex items-center justify-between border-b border-slate-400 pb-1">
                      <h3 className="font-bold text-sm sm:text-base text-slate-900 font-sans">
                        {section.name}
                      </h3>
                      {section.targetMarks && (
                        <span className="text-xs font-bold text-slate-700 font-sans">
                          (মান: {toBengaliNumerals(section.targetMarks)})
                        </span>
                      )}
                    </div>
                    {section.instruction && (
                      <p className="text-xs text-slate-600 italic font-sans">
                        {section.instruction}
                      </p>
                    )}

                    {/* Questions in section */}
                    <div className="space-y-3 pl-2 sm:pl-3">
                      {(section.questions || []).map((q: any, qIdx: number) => (
                        <div key={q.id || qIdx} className="border-b border-slate-100 pb-2.5 last:border-0">
                          <SpecializedQuestionView
                            question={q}
                            index={qIdx}
                            isPrint={true}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="space-y-3">
                  {unsectioned.map((q: any, qIdx: number) => (
                    <div key={q.id || qIdx} className="border-b border-slate-100 pb-2.5 last:border-0">
                      <SpecializedQuestionView
                        question={q}
                        index={qIdx}
                        isPrint={true}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer Signatures */}
            <div className="mt-12 pt-8 border-t border-slate-300 grid grid-cols-2 text-xs font-sans font-semibold text-slate-700">
              <div className="text-center">
                <div className="w-36 border-t border-slate-500 mx-auto pt-1">প্রশ্নকর্তার স্বাক্ষর</div>
              </div>
              <div className="text-center">
                <div className="w-36 border-t border-slate-500 mx-auto pt-1">নাযেমে তা'লীমাতের স্বাক্ষর</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
