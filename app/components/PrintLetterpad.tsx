"use client";

import React, { useState, useEffect } from "react";
import { 
  Settings, Check, Printer, FileText, Sliders, ChevronDown, 
  MapPin, Phone, Calendar, GraduationCap, Heart, HelpCircle
} from "lucide-react";

interface MadrasaInfo {
  id?: string;
  name?: string;
  address?: string;
  phone?: string;
  contact_phone?: string;
  established_year?: string;
  registration_no?: string;
  reg_no?: string;
  principal_name?: string;
  principal_signature_url?: string;
  signature_url?: string;
  slogan?: string;
}

interface PrintLetterpadProps {
  children: React.ReactNode;
  madrasaInfo?: MadrasaInfo;
  logoUrl?: string;
  title?: string;
}

const quotes = [
  {
    arabic: "وَقُلْ رَبِّ زِدْنِي عِلْمًا",
    bengali: "বলুন, হে আমার পালনকর্তা! আমার জ্ঞান বৃদ্ধি করুন।",
    source: "সূরা ত্বহা: ১১৪"
  },
  {
    arabic: "يَرْفَعِ اللَّهُ الَّذِينَ آمَنُوا مِنْكُمْ وَالَّذِينَ أُوتُوا الْعِلْمَ دَرَجَاتٍ",
    bengali: "তোমাদের মধ্যে যারা ঈমান এনেছে এবং যাদের জ্ঞান দান করা হয়েছে, আল্লাহ তাদের মর্যাদা উচ্চ করে দেবেন।",
    source: "সূরা আল-মুজাদালাহ: ১১"
  },
  {
    arabic: "قُلْ هَلْ يَسْتَوِي الَّذِينَ يَعْلَمُونَ وَالَّذِينَ لَا يَعْلَمُونَ",
    bengali: "বলুন, যারা জানে এবং যারা জানে না তারা কি সমান হতে পারে?",
    source: "সূরা যুমার: ৯"
  },
  {
    arabic: "مَنْ سَلَكَ طَرِيقًا يَلْتَمِسُ فِيهِ عِلْمًا سَهَّلَ اللَّهُ لَهُ بِهِ طَرِيقًا إِلَى الْجَنَّةِ",
    bengali: "যে ব্যক্তি জ্ঞান অর্জনের কোনো পথ অবলম্বন করে, আল্লাহ তার জন্য জান্নাতের পথ সুগম করে দেন।",
    source: "সহীহ মুসলিম (আল-হাদিস)"
  },
  {
    arabic: "خَيْرُكُمْ مَنْ تَعَلَّمَ الْقُرْآنَ وَعَلَّمَهُ",
    bengali: "তোমাদের মধ্যে সেই ব্যক্তি সর্বোত্তম, যে নিজে কুরআন শিক্ষা করে এবং অন্যকে শিক্ষা দেয়।",
    source: "সহীহ বুখারী (আল-হাদিস)"
  },
  {
    arabic: "طَلَبُ الْعِلْمِ فَرِيضَةٌ عَلَى كُلِّ مُسْلِمٍ",
    bengali: "জ্ঞান অর্জন করা প্রত্যেক মুসলমানের জন্য ফরজ।",
    source: "সুনানে ইবনে মাজাহ (আল-হাদিস)"
  }
];

const themes = [
  { id: "green", name: "ঐতিহ্যবাহী সবুজ (Green)", border: "border-emerald-600", text: "text-emerald-700", bg: "bg-emerald-50", line: "bg-emerald-600", lightText: "text-emerald-600/80" },
  { id: "gold", name: "ক্যালিগ্রাফি গোল্ড (Gold)", border: "border-amber-600", text: "text-amber-800", bg: "bg-amber-50/50", line: "bg-amber-600", lightText: "text-amber-700/80" },
  { id: "slate", name: "অফিসিয়াল ব্ল্যাক (Slate)", border: "border-slate-700", text: "text-slate-800", bg: "bg-slate-50", line: "bg-slate-700", lightText: "text-slate-600/80" }
];

const fontOptions = [
  { id: "font-solaiman", name: "সোলাইমানলিপি (SolaimanLipi - প্রমিত)" },
  { id: "font-shorif", name: "শরীফ শিশির (Shorif Shishir)" },
  { id: "font-hindsiliguri", name: "হিন্দ শিলিগুড়ি (Hind Siliguri)" },
  { id: "font-amiri", name: "আমিরী আরবি (Amiri Arabic)" },
  { id: "font-shahrazad", name: "শেহরেযাদ আরবি (Scheherazade New)" }
];

export default function PrintLetterpad({ children, madrasaInfo, logoUrl, title }: PrintLetterpadProps) {
  const [padEnabled, setPadEnabled] = useState(true);
  const [establishedYear, setEstablishedYear] = useState(madrasaInfo?.established_year || "২০০২");
  const [registrationNumber, setRegistrationNumber] = useState(madrasaInfo?.registration_no || madrasaInfo?.reg_no || "১২৪৫/বি");
  const [selectedQuoteIndex, setSelectedQuoteIndex] = useState(0);
  const [selectedThemeId, setSelectedThemeId] = useState("green");
  const [selectedFont, setSelectedFont] = useState("font-solaiman");
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const [isPanelExpanded, setIsPanelExpanded] = useState(true);
  const [memoNumber, setMemoNumber] = useState("মাপ্র/২০২৬/");
  const [currentDate, setCurrentDate] = useState("");

  // Load settings from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedPadEnabled = localStorage.getItem("pad_print_enabled");
      const savedEstYear = localStorage.getItem("pad_print_est_year");
      const savedRegNum = localStorage.getItem("pad_print_reg_num");
      const savedQuoteIdx = localStorage.getItem("pad_print_quote_idx");
      const savedTheme = localStorage.getItem("pad_print_theme");
      const savedFont = localStorage.getItem("pad_print_font");
      const savedOrientation = localStorage.getItem("pad_print_orientation");
      const savedMemo = localStorage.getItem("pad_print_memo");

      if (savedPadEnabled !== null) setPadEnabled(savedPadEnabled === "true");
      if (savedEstYear !== null) {
        setEstablishedYear(savedEstYear);
      } else if (madrasaInfo?.established_year) {
        setEstablishedYear(madrasaInfo.established_year);
      }
      if (savedRegNum !== null) {
        setRegistrationNumber(savedRegNum);
      } else if (madrasaInfo?.registration_no || madrasaInfo?.reg_no) {
        setRegistrationNumber(madrasaInfo.registration_no || madrasaInfo.reg_no || "");
      }
      if (savedQuoteIdx !== null) setSelectedQuoteIndex(parseInt(savedQuoteIdx, 10));
      if (savedTheme !== null) setSelectedThemeId(savedTheme);
      if (savedFont !== null) setSelectedFont(savedFont);
      if (savedOrientation === "portrait" || savedOrientation === "landscape") {
        setOrientation(savedOrientation);
      }
      if (savedMemo !== null) setMemoNumber(savedMemo);

      // Generate current date in Bengali
      const today = new Date();
      const options: Intl.DateTimeFormatOptions = { year: "numeric", month: "long", day: "numeric" };
      try {
        const banglaDate = today.toLocaleDateString("bn-BD", options);
        setCurrentDate(banglaDate);
      } catch (e) {
        // Fallback to formatted english
        setCurrentDate(today.toLocaleDateString());
      }
    }
  }, []);

  // Save changes to localStorage
  const handleTogglePad = (val: boolean) => {
    setPadEnabled(val);
    localStorage.setItem("pad_print_enabled", String(val));
  };

  const handleEstYearChange = (val: string) => {
    setEstablishedYear(val);
    localStorage.setItem("pad_print_est_year", val);
  };

  const handleRegNumberChange = (val: string) => {
    setRegistrationNumber(val);
    localStorage.setItem("pad_print_reg_num", val);
  };

  const handleQuoteChange = (idx: number) => {
    setSelectedQuoteIndex(idx);
    localStorage.setItem("pad_print_quote_idx", String(idx));
  };

  const handleThemeChange = (id: string) => {
    setSelectedThemeId(id);
    localStorage.setItem("pad_print_theme", id);
  };

  const handleFontChange = (fontClass: string) => {
    setSelectedFont(fontClass);
    localStorage.setItem("pad_print_font", fontClass);
  };

  const handleMemoChange = (val: string) => {
    setMemoNumber(val);
    localStorage.setItem("pad_print_memo", val);
  };

  const handleOrientationChange = (val: "portrait" | "landscape") => {
    setOrientation(val);
    localStorage.setItem("pad_print_orientation", val);
  };

  const currentTheme = themes.find(t => t.id === selectedThemeId) || themes[0];
  const activeQuote = quotes[selectedQuoteIndex] || quotes[0];

  const mName = madrasaInfo?.name || "আল-মাদরাসাতুল ইসলামিয়া";
  const mAddress = madrasaInfo?.address || "ঢাকা, বাংলাদেশ";
  const mPhone = madrasaInfo?.phone || madrasaInfo?.contact_phone || "০১XXXXXXXXX";

  // First letter of madrasa name for custom monogram logo
  const monogramLetter = mName.charAt(0);

  return (
    <div className="w-full relative">
      {/* Dynamic Print Page Orientation */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @media print {
            @page {
              size: A4 ${orientation};
              margin: 8mm;
            }
            .print-pad-container {
              width: 100% !important;
              max-width: 100% !important;
              margin: 0 auto !important;
              box-sizing: border-box !important;
            }
          }
        `
      }} />

      {/* 1. Print Controller Panel (Screen-only, floating or top bar) */}
      <div className="print:hidden mb-6 bg-white border border-slate-200/80 rounded-xl shadow-sm transition-all duration-200 overflow-hidden">
        <div 
          onClick={() => setIsPanelExpanded(!isPanelExpanded)}
          className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition"
        >
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${padEnabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm sm:text-base flex items-center gap-2">
                মাদরাসা লেটারপ্যাড প্রিন্ট সেটিংস (Official Pad)
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${padEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>
                  {padEnabled ? 'চালু আছে' : 'বন্ধ আছে'}
                </span>
              </h3>
              <p className="text-xs text-slate-500">রিপোর্ট প্রিন্ট করার জন্য মাদরাসার লেটারহেড ও হাদিস সম্বলিত প্যাড টগল করুন</p>
            </div>
          </div>
          <button className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg">
            <ChevronDown className={`w-5 h-5 transform transition-transform duration-200 ${isPanelExpanded ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Panel Expanded Controls */}
        <div className={`border-t border-slate-100 bg-slate-50/50 p-4 sm:p-6 space-y-6 ${isPanelExpanded ? 'block' : 'hidden'}`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {/* Toggle Switch */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">লেটারপ্যাড ব্যবহার</label>
              <div className="flex items-center space-x-3 bg-white p-3 rounded-lg border border-slate-200/60 shadow-inner">
                <input 
                  type="checkbox" 
                  id="toggle-pad"
                  checked={padEnabled}
                  onChange={(e) => handleTogglePad(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                />
                <label htmlFor="toggle-pad" className="text-sm font-semibold text-slate-700 cursor-pointer select-none">
                  প্যাড অন করে প্রিন্ট করুন
                </label>
              </div>
            </div>

            {/* Established Year */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">স্থাপিত বছর</label>
              <input 
                type="text" 
                value={establishedYear}
                onChange={(e) => handleEstYearChange(e.target.value)}
                placeholder="উদা: ২০০২ বা ২০০৫"
                className="w-full bg-white px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 transition font-medium text-slate-800"
              />
            </div>

            {/* Registration Number */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">নিবন্ধন নম্বর (রেজি নং)</label>
              <input 
                type="text" 
                value={registrationNumber}
                onChange={(e) => handleRegNumberChange(e.target.value)}
                placeholder="উদা: ১২৪৫/বি"
                className="w-full bg-white px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 transition font-medium text-slate-800"
              />
            </div>

            {/* Memo Number */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">স্মারক নম্বর প্রিফিক্স</label>
              <input 
                type="text" 
                value={memoNumber}
                onChange={(e) => handleMemoChange(e.target.value)}
                placeholder="উদা: মাপ্র/২০২৬/"
                className="w-full bg-white px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 transition font-medium text-slate-800"
              />
            </div>

            {/* Theme Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">প্যাড কালার থিম</label>
              <select
                value={selectedThemeId}
                onChange={(e) => handleThemeChange(e.target.value)}
                className="w-full bg-white px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 transition font-semibold text-slate-700"
              >
                {themes.map((theme) => (
                  <option key={theme.id} value={theme.id}>{theme.name}</option>
                ))}
              </select>
            </div>

            {/* Font Family Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">ডকুমেন্ট ফন্ট (Font Family)</label>
              <select
                value={selectedFont}
                onChange={(e) => handleFontChange(e.target.value)}
                className="w-full bg-white px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 transition font-semibold text-slate-700"
              >
                {fontOptions.map((font) => (
                  <option key={font.id} value={font.id}>{font.name}</option>
                ))}
              </select>
            </div>

            {/* Orientation Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">প্রিন্ট মোড (Orientation)</label>
              <select
                value={orientation}
                onChange={(e) => handleOrientationChange(e.target.value as "portrait" | "landscape")}
                className="w-full bg-white px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 transition font-semibold text-slate-700"
              >
                <option value="portrait">📄 পোর্ট্রেট (Portrait - লম্বালম্বি)</option>
                <option value="landscape">📜 ল্যান্ডস্কেপ (Landscape - আড়াআড়ি)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Main Printable Area Wrapper */}
      {/* If padEnabled is active, on print we insert the pad wrapper. We can also show it on screen if desired, or let it only render elegantly on paper.
          Let's render it on screen inside a clean border box so it acts as an authentic live preview! */}
      <div className={`relative ${selectedFont} ${padEnabled ? 'bg-white shadow-sm border border-slate-200 rounded-xl p-6 sm:p-10 print:p-0 print:border-none print:shadow-none print-pad-container' : ''}`}>
        
        {/* Dynamic Watermark in center (only shown if padEnabled) */}
        {padEnabled && (
          <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none select-none overflow-hidden">
            <div className={`w-[4in] h-[4in] rounded-full border-8 ${currentTheme.border} flex items-center justify-center`}>
              <span className="text-[140px] font-black tracking-widest">{monogramLetter}</span>
            </div>
          </div>
        )}

        {/* PRINT PAD HEADER */}
        {padEnabled && (
          <div className="w-full mb-6 print:mb-1.5 print:block relative shrink-0">
            {/* Top decorative bar */}
            <div className={`h-2.5 print:h-1.5 w-full ${currentTheme.line} rounded-t-sm mb-3 print:mb-1.5`}></div>
            
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 print:gap-1.5 border-b pb-3 print:pb-1.5 border-slate-200">
              
              {/* Left Column: Logo & Established */}
              <div className="flex items-center space-x-3 print:space-x-2 shrink-0">
                <div className={`w-16 h-16 print:w-10 print:h-10 rounded-full border-2 ${currentTheme.border} p-1 bg-white flex items-center justify-center shadow-sm relative shrink-0`}>
                  {logoUrl ? (
                    <img 
                      src={logoUrl} 
                      alt="Logo" 
                      className="w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className={`w-full h-full rounded-full ${currentTheme.bg} flex items-center justify-center`}>
                      <GraduationCap className={`w-8 h-8 print:w-5 print:h-5 ${currentTheme.text}`} />
                    </div>
                  )}
                </div>
                <div className="text-left leading-tight">
                  <span className={`text-[10px] print:text-[9px] uppercase font-bold tracking-wider ${currentTheme.lightText}`}>স্থাপিত: {establishedYear} ইং</span>
                  <div className={`text-[9px] print:text-[8px] font-bold text-slate-400 mt-0.5`}>রেজি নং: {registrationNumber}</div>
                </div>
              </div>

              {/* Center Column: Name and Address */}
              <div className="text-center flex-1 max-w-xl">
                <h1 className={`text-2xl sm:text-3xl print:text-lg font-extrabold tracking-wide ${currentTheme.text} mb-1 print:mb-0 text-center`}>
                  {mName}
                </h1>
                <p className="text-xs sm:text-sm print:text-[10px] text-slate-600 font-medium text-center line-clamp-1">
                  {mAddress}
                </p>
                <div className="flex items-center justify-center space-x-4 print:space-x-2 text-[10px] sm:text-xs print:text-[9px] text-slate-500 mt-1 flex-wrap">
                  <span className="flex items-center gap-1">
                    <Phone className="w-3 h-3 print:w-2.5 print:h-2.5 text-slate-400" />
                    {mPhone}
                  </span>
                  <span>|</span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 print:w-2.5 print:h-2.5 text-slate-400" />
                    {madrasaInfo?.address || "ঢাকা"}
                  </span>
                </div>
              </div>

              {/* Right Column: Dynamic Print Date & Memo Placeholder */}
              <div className="text-right shrink-0 min-w-[120px] leading-snug text-xs print:text-[10px] text-slate-500 border-l pl-4 print:pl-2 border-slate-100 hidden sm:block print:block">
                <div>স্মারক নং: <span className="font-semibold text-slate-800 font-mono">{memoNumber}</span></div>
                <div className="mt-0.5">তারিখ: <span className="font-semibold text-slate-800">{currentDate}</span></div>
              </div>
            </div>

            {/* Mobile View / Fallback print details */}
            <div className="sm:hidden print:hidden flex justify-between items-center text-[10px] text-slate-500 mt-2 border-b pb-2">
              <div>স্মারক: <span className="font-semibold text-slate-800">{memoNumber}</span></div>
              <div>তারিখ: <span className="font-semibold text-slate-800">{currentDate}</span></div>
            </div>
          </div>
        )}

        {/* REPORT CONTENT GOES HERE */}
        <div className={`relative z-10 w-full flex-1 ${padEnabled ? 'px-1 sm:px-2' : ''}`}>
          {children}
        </div>
      </div>
    </div>
  );
}
