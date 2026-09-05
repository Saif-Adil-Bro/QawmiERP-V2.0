import React from "react";
import { CalligraphyStyle, BorderStyle, LogoPosition } from "@/lib/examPaperTemplates";

interface CalligraphyHeaderProps {
  style: CalligraphyStyle;
}

export function IslamicCalligraphyHeader({ style }: CalligraphyHeaderProps) {
  if (style === "none") return null;

  if (style === "ornate_frame") {
    return (
      <div className="flex items-center justify-center gap-3 my-2 select-none" dir="rtl">
        {/* Left Arabesque Flourish */}
        <div className="hidden sm:flex items-center text-slate-700">
          <svg className="w-12 h-4 text-black" viewBox="0 0 100 24" fill="currentColor">
            <path d="M0,12 Q25,0 50,12 T100,12" stroke="currentColor" strokeWidth="1.5" fill="none" />
            <circle cx="50" cy="12" r="3" fill="currentColor" />
            <circle cx="85" cy="12" r="2" fill="currentColor" />
          </svg>
          <span className="text-sm">✤</span>
        </div>

        {/* Center Calligraphy with Ornate Brackets */}
        <div className="px-4 py-0.5 border-y border-black font-amiri font-bold text-lg sm:text-xl tracking-wide text-black text-center">
          <span className="text-sm font-normal text-slate-700 ml-1">﴿</span>
          <span>بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</span>
          <span className="text-sm font-normal text-slate-700 mr-1">﴾</span>
        </div>

        {/* Right Arabesque Flourish */}
        <div className="hidden sm:flex items-center text-slate-700">
          <span className="text-sm">✤</span>
          <svg className="w-12 h-4 text-black transform rotate-180" viewBox="0 0 100 24" fill="currentColor">
            <path d="M0,12 Q25,0 50,12 T100,12" stroke="currentColor" strokeWidth="1.5" fill="none" />
            <circle cx="50" cy="12" r="3" fill="currentColor" />
            <circle cx="85" cy="12" r="2" fill="currentColor" />
          </svg>
        </div>
      </div>
    );
  }

  if (style === "bismillah_hamd") {
    return (
      <div className="text-center my-2 select-none space-y-0.5" dir="rtl">
        <div className="font-amiri font-bold text-lg sm:text-xl text-black">
          بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيْمِ
        </div>
        <div className="font-amiri text-xs sm:text-sm text-slate-800 font-semibold">
          نَحْمَدُهُ وَنُصَلِّيْ عَلَىٰ رَسُوْلِهِ الْكَرِيْمِ
        </div>
        <div className="w-36 mx-auto border-b border-black pt-0.5"></div>
      </div>
    );
  }

  if (style === "thuluth_classic") {
    return (
      <div className="text-center my-2 select-none" dir="rtl">
        <div className="font-amiri font-extrabold text-xl sm:text-2xl text-black inline-block px-6 py-0.5 border-b-2 border-black">
          بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
        </div>
      </div>
    );
  }

  // riqa_simple
  return (
    <div className="text-center my-1.5 font-amiri text-base font-semibold text-black select-none" dir="rtl">
      بسم الله الرحمن الرحيم
    </div>
  );
}

interface PaperFrameWrapperProps {
  borderStyle: BorderStyle;
  children: React.ReactNode;
  className?: string;
}

export function PaperFrameWrapper({ borderStyle, children, className = "" }: PaperFrameWrapperProps) {
  if (borderStyle === "none") {
    return <div className={`p-4 sm:p-6 ${className}`}>{children}</div>;
  }

  if (borderStyle === "simple_box") {
    return (
      <div className={`border-2 border-black p-4 sm:p-6 m-1 ${className}`}>
        {children}
      </div>
    );
  }

  if (borderStyle === "double_classic") {
    return (
      <div className={`border-[3px] border-black p-1 bg-white m-0.5 ${className}`}>
        <div className="border border-black p-4 sm:p-5 h-full">
          {children}
        </div>
      </div>
    );
  }

  if (borderStyle === "islamic_corner") {
    return (
      <div className={`relative border-2 border-black p-1 bg-white m-0.5 ${className}`}>
        {/* Four Corner Ornaments */}
        <div className="absolute top-1.5 left-1.5 text-black font-bold text-xs select-none pointer-events-none">
          ۞
        </div>
        <div className="absolute top-1.5 right-1.5 text-black font-bold text-xs select-none pointer-events-none">
          ۞
        </div>
        <div className="absolute bottom-1.5 left-1.5 text-black font-bold text-xs select-none pointer-events-none">
          ۞
        </div>
        <div className="absolute bottom-1.5 right-1.5 text-black font-bold text-xs select-none pointer-events-none">
          ۞
        </div>

        <div className="border border-black p-4 sm:p-5 h-full relative">
          {children}
        </div>
      </div>
    );
  }

  if (borderStyle === "decorative_vintage") {
    return (
      <div className={`relative border-[4px] border-double border-black p-2 bg-white m-0.5 ${className}`}>
        <div className="border border-dashed border-black p-4 sm:p-5 h-full">
          {children}
        </div>
      </div>
    );
  }

  return <div className={`p-4 sm:p-6 ${className}`}>{children}</div>;
}

interface HeaderWithLogoProps {
  customMadrasaName: string;
  examName: string;
  selectedClassName: string;
  selectedSubjectName: string;
  examTime: string;
  totalMarks: number;
  showLogo: boolean;
  logoUrl: string;
  logoPosition: LogoPosition;
  logoSize: "sm" | "md" | "lg";
  calligraphyStyle: CalligraphyStyle;
  paperInstructions: string;
  toBengaliNumerals: (n: number) => string;
}

export function MadrasaPaperHeader({
  customMadrasaName,
  examName,
  selectedClassName,
  selectedSubjectName,
  examTime,
  totalMarks,
  showLogo,
  logoUrl,
  logoPosition,
  logoSize,
  calligraphyStyle,
  paperInstructions,
  toBengaliNumerals,
}: HeaderWithLogoProps) {
  const sizeClasses = {
    sm: "w-12 h-12",
    md: "w-16 h-16",
    lg: "w-20 h-20",
  };

  const renderLogo = () => {
    if (!showLogo) return null;
    if (logoUrl) {
      return (
        <img
          src={logoUrl}
          alt="Madrasa Monogram"
          className={`${sizeClasses[logoSize]} object-contain shrink-0 mx-auto rounded-full border border-black/20 p-0.5`}
        />
      );
    }
    // Authentic Islamic Madrasa Monogram Crest SVG Placeholder if no URL uploaded
    return (
      <div
        className={`${sizeClasses[logoSize]} shrink-0 mx-auto flex items-center justify-center border-2 border-black rounded-full bg-slate-50 text-black p-1 shadow-xs`}
        title="মাদ্রাসার মনোগ্রাম"
      >
        <svg viewBox="0 0 100 100" className="w-full h-full" fill="currentColor">
          <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="3" />
          <circle cx="50" cy="50" r="41" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3,2" />
          {/* Open Quran / Minaret Icon */}
          <path d="M50 20 L58 35 L50 48 L42 35 Z" fill="currentColor" />
          <path d="M30 65 Q50 50 70 65 L72 68 Q50 55 28 68 Z" fill="currentColor" />
          <path d="M32 70 Q50 57 68 70 L70 73 Q50 62 30 73 Z" fill="currentColor" />
          <line x1="50" y1="52" x2="50" y2="72" stroke="currentColor" strokeWidth="2" />
        </svg>
      </div>
    );
  };

  return (
    <div className="border-b-2 border-black pb-2 mb-4">
      {/* Top Center Calligraphy */}
      <IslamicCalligraphyHeader style={calligraphyStyle} />

      {/* Madrasa Title & Logos Layout */}
      {logoPosition === "center_top" && showLogo && (
        <div className="text-center mb-1">{renderLogo()}</div>
      )}

      <div className="flex items-center justify-between gap-3">
        {/* Left Side Logo */}
        {(logoPosition === "left" || logoPosition === "dual") && showLogo && (
          <div className="shrink-0">{renderLogo()}</div>
        )}

        {/* Center Madrasa & Exam Names */}
        <div className="flex-1 text-center">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-black" dir="auto">
            {customMadrasaName}
          </h1>
          {examName && (
            <h2 className="text-lg sm:text-xl font-bold text-black mt-0.5" dir="auto">
              {examName}
            </h2>
          )}
        </div>

        {/* Right Side Logo */}
        {(logoPosition === "right" || logoPosition === "dual") && showLogo && (
          <div className="shrink-0">{renderLogo()}</div>
        )}
      </div>

      {/* Meta Bar: Class, Subject, Time, Total Marks */}
      <div className="mt-3 pt-1.5 border-t border-black text-xs sm:text-sm font-bold text-black space-y-1">
        <div className="flex justify-between items-center px-1">
          <span>শ্রেণি / জামাত: {selectedClassName || "—"}</span>
          <span>বিষয়: {selectedSubjectName || "—"}</span>
        </div>
        <div className="flex justify-between items-center px-1 border-t border-dotted border-black pt-1">
          <span>সময়: {examTime || "—"}</span>
          <span>পূর্ণমান: {toBengaliNumerals(totalMarks)}</span>
        </div>
      </div>

      {/* Paper Instructions */}
      {paperInstructions && (
        <div
          className="text-center text-xs text-black mt-2 italic border-t border-b border-dashed border-black/60 py-1 font-medium"
          dir="auto"
        >
          [{paperInstructions}]
        </div>
      )}
    </div>
  );
}
