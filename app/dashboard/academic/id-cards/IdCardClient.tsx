"use client";

import { useState } from "react";
import PrintButton from "@/app/components/PrintButton";
import { IdCard, Palette, LayoutTemplate, Sliders, FileText, Settings, Sparkles, Plus, Trash2, Type } from "lucide-react";
import { getStudentIdNumber, convertToBanglaNumber } from "@/lib/student-utils";


const getDirectPhotoUrl = (url: string | null | undefined): string | undefined => {
  if (!url) return undefined;
  let fetchUrl = url.trim();
  if (fetchUrl.includes("drive.google.com")) {
    const fileDMatch = fetchUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    const idMatch = fetchUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    const dMatch = fetchUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
    
    const fileId = (fileDMatch && fileDMatch[1]) || (idMatch && idMatch[1]) || (dMatch && dMatch[1]);
    if (fileId) {
      return `https://drive.google.com/uc?export=download&id=${fileId}`;
    }
  }
  return fetchUrl;
};

export default function IdCardClient({ users, userType, madrasaInfo }: { users: any[], userType: string, madrasaInfo?: {name: string, address: string, phone: string} }) {
  const [template, setTemplate] = useState("modern");
  const [themeColor, setThemeColor] = useState("blue");
  const [cardSide, setCardSide] = useState<"front" | "back" | "both">("both");
  const [banglaFont, setBanglaFont] = useState("font-solaiman");
  const [arabicFont, setArabicFont] = useState("font-amiri");
  
  // Customization States for sizes and spacing
  const [titleFontSize, setTitleFontSize] = useState(12); // px
  const [addressFontSize, setAddressFontSize] = useState(9); // px
  const [nameFontSize, setNameFontSize] = useState(14); // px
  const [detailsFontSize, setDetailsFontSize] = useState(11); // px
  const [detailsGap, setDetailsGap] = useState(4); // px gap between rows
  const [backFontSize, setBackFontSize] = useState(8); // px
  const [backLineGap, setBackLineGap] = useState(4); // px gap between instruction items
  const [showEditor, setShowEditor] = useState(true); // Toggle customization editor

  // Custom instruction text (Bengali)
  const [customInstructions, setCustomInstructions] = useState<string[]>([
    "মাদরাসায় অবস্থানকালীন সময়ে কার্ডটি পরিধান করা বাধ্যতামূলক।",
    "এই কার্ডটি মাদরাসার সম্পত্তি এবং এটি হস্তান্তরযোগ্য নয়।",
    "কার্ড হারিয়ে গেলে কর্তৃপক্ষকে অবিলম্বে অবহিত করতে হবে।",
    "কার্ডটি পাওয়া গেলে নিচের ঠিকানায় ফেরত দিন।"
  ]);

  // English Terms and Conditions (for minimal template back side)
  const [termsAndConditions, setTermsAndConditions] = useState<string>(
    "This identity card is issued by the authority. It is non-transferable and must be returned if found. Under all circumstances, the holder is subject to institution's rules."
  );

  if (!users || users.length === 0) {
    return (
      <div className="bg-white p-8 text-center rounded-xl border border-dashed">
        <p className="text-slate-500">কোনো তথ্য পাওয়া যায়নি</p>
      </div>
    );
  }

  const colors: Record<string, { bg: string, text: string, border: string, light: string }> = {
    blue: { bg: "bg-blue-700", text: "text-blue-700", border: "border-blue-700", light: "bg-blue-50 text-blue-700" },
    emerald: { bg: "bg-emerald-700", text: "text-emerald-700", border: "border-emerald-700", light: "bg-emerald-50 text-emerald-700" },
    indigo: { bg: "bg-indigo-700", text: "text-indigo-700", border: "border-indigo-700", light: "bg-indigo-50 text-indigo-700" },
    rose: { bg: "bg-rose-700", text: "text-rose-700", border: "border-rose-700", light: "bg-rose-50 text-rose-700" },
    slate: { bg: "bg-slate-800", text: "text-slate-800", border: "border-slate-800", light: "bg-slate-100 text-slate-800" },
  };

  const currentTheme = colors[themeColor] || colors.blue;

  return (
    <div className="bg-white rounded-xl border shadow-sm p-6 print:border-none print:shadow-none print:p-0">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 print:hidden gap-4">
        <h2 className="text-lg font-bold text-slate-800">সর্বমোট {users.length} জনের আইডি কার্ড পাওয়া গেছে</h2>
        
        <div className="flex flex-wrap items-center gap-4 bg-slate-50 p-2 rounded-lg border">
          <div className="flex items-center gap-2">
            <LayoutTemplate className="w-4 h-4 text-slate-500" />
            <select 
              value={template} 
              onChange={(e) => setTemplate(e.target.value)}
              className="text-sm bg-white border border-slate-200 rounded p-1 text-slate-700 font-medium"
            >
              <option value="modern">মডার্ন ডিজাইন</option>
              <option value="classic">ক্লাসিক ডিজাইন</option>
              <option value="minimal">মিনিমাল ডিজাইন</option>
            </select>
          </div>
          
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-slate-500" />
            <select 
              value={themeColor} 
              onChange={(e) => setThemeColor(e.target.value)}
              className="text-sm bg-white border border-slate-200 rounded p-1 text-slate-700 font-medium"
            >
              <option value="blue">নীল (Blue)</option>
              <option value="emerald">সবুজ (Emerald)</option>
              <option value="indigo">ইন্ডিগো (Indigo)</option>
              <option value="rose">লাল (Rose)</option>
              <option value="slate">কালো (Dark)</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <Type className="w-4 h-4 text-slate-500" />
            <select 
              value={banglaFont} 
              onChange={(e) => setBanglaFont(e.target.value)}
              className="text-sm bg-white border border-slate-200 rounded p-1 text-slate-700 font-medium"
            >
              <option value="font-solaiman">বাংলা: সোলাইমান লিপি</option>
              <option value="font-shorif">বাংলা: শরীফ শিশির</option>
              <option value="font-hindsiliguri">বাংলা: হিন্দ শিলিগুড়ি</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500">সাইড:</span>
            <select 
              value={cardSide} 
              onChange={(e) => setCardSide(e.target.value as any)}
              className="text-sm bg-white border border-slate-200 rounded p-1 text-slate-700 font-medium"
            >
              <option value="both">সামনে ও পিছনে (Both)</option>
              <option value="front">শুধুমাত্র সামনে (Front)</option>
              <option value="back">শুধুমাত্র পিছনে (Back)</option>
            </select>
          </div>

          <button 
            onClick={() => setShowEditor(!showEditor)}
            className={`flex items-center gap-1.5 text-sm font-semibold px-2.5 py-1 rounded border transition-colors ${showEditor ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
          >
            <Settings className="w-3.5 h-3.5" />
            {showEditor ? 'এডিটর বন্ধ করুন' : 'কার্ড এডিটর'}
          </button>

          <PrintButton targetId="id-cards-print-area" fileName="id-cards.pdf" />
        </div>
      </div>

      {showEditor && (
        <div className="mb-8 p-5 bg-slate-50 border border-slate-200 rounded-xl print:hidden animate-in fade-in duration-200">
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-200">
            <Settings className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-slate-800 text-sm md:text-base flex items-center gap-1.5">
              কার্ড কাস্টমাইজেশন টুলস (Card Customization Editor)
              <span className="text-[10px] font-normal text-slate-500 bg-slate-200/60 px-2 py-0.5 rounded">রিয়েল-টাইম প্রিভিউ</span>
            </h3>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Font and spacing adjustments */}
            <div className="lg:col-span-7 space-y-4">
              <h4 className="font-semibold text-xs text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Sliders className="w-3.5 h-3.5" /> লেখা ও ফন্টের সাইজ এডজাস্টমেন্ট (Font Size & Spacing)
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3.5 text-xs">
                {/* Madrasa Name Size */}
                <div className="space-y-1.5">
                  <div className="flex justify-between font-medium text-slate-700">
                    <span>মাদরাসার নাম সাইজ (Madrasa Name):</span>
                    <span className="font-mono text-blue-600 font-bold">{titleFontSize}px</span>
                  </div>
                  <input 
                    type="range" min="8" max="18" step="0.5"
                    value={titleFontSize} 
                    onChange={(e) => setTitleFontSize(Number(e.target.value))}
                    className="w-full accent-blue-600"
                  />
                </div>

                {/* Address Size */}
                <div className="space-y-1.5">
                  <div className="flex justify-between font-medium text-slate-700">
                    <span>মাদরাসার ঠিকানা সাইজ (Address):</span>
                    <span className="font-mono text-blue-600 font-bold">{addressFontSize}px</span>
                  </div>
                  <input 
                    type="range" min="6" max="14" step="0.5"
                    value={addressFontSize} 
                    onChange={(e) => setAddressFontSize(Number(e.target.value))}
                    className="w-full accent-blue-600"
                  />
                </div>

                {/* User Name Size */}
                <div className="space-y-1.5">
                  <div className="flex justify-between font-medium text-slate-700">
                    <span>শিক্ষার্থী/শিক্ষকের নাম সাইজ (Name):</span>
                    <span className="font-mono text-blue-600 font-bold">{nameFontSize}px</span>
                  </div>
                  <input 
                    type="range" min="10" max="20" step="0.5"
                    value={nameFontSize} 
                    onChange={(e) => setNameFontSize(Number(e.target.value))}
                    className="w-full accent-blue-600"
                  />
                </div>

                {/* Details Size */}
                <div className="space-y-1.5">
                  <div className="flex justify-between font-medium text-slate-700">
                    <span>তথ্য বা বিবরণীর সাইজ (Details Font):</span>
                    <span className="font-mono text-blue-600 font-bold">{detailsFontSize}px</span>
                  </div>
                  <input 
                    type="range" min="8" max="14" step="0.5"
                    value={detailsFontSize} 
                    onChange={(e) => setDetailsFontSize(Number(e.target.value))}
                    className="w-full accent-blue-600"
                  />
                </div>

                {/* Details Gap */}
                <div className="space-y-1.5">
                  <div className="flex justify-between font-medium text-slate-700">
                    <span>তথ্য লাইনের মাঝে ফাকা (Row Spacing):</span>
                    <span className="font-mono text-blue-600 font-bold">{detailsGap}px</span>
                  </div>
                  <input 
                    type="range" min="1" max="12" step="1"
                    value={detailsGap} 
                    onChange={(e) => setDetailsGap(Number(e.target.value))}
                    className="w-full accent-blue-600"
                  />
                </div>

                {/* Back side Font Size */}
                <div className="space-y-1.5">
                  <div className="flex justify-between font-medium text-slate-700">
                    <span>নির্দেশনাবলী ফন্ট সাইজ (Back Text):</span>
                    <span className="font-mono text-blue-600 font-bold">{backFontSize}px</span>
                  </div>
                  <input 
                    type="range" min="6" max="12" step="0.5"
                    value={backFontSize} 
                    onChange={(e) => setBackFontSize(Number(e.target.value))}
                    className="w-full accent-blue-600"
                  />
                </div>

                {/* Back Line Gap */}
                <div className="space-y-1.5 md:col-span-2">
                  <div className="flex justify-between font-medium text-slate-700">
                    <span>নির্দেশনাবলী লাইনের মাঝের ফাকা (Back Row Spacing):</span>
                    <span className="font-mono text-blue-600 font-bold">{backLineGap}px</span>
                  </div>
                  <input 
                    type="range" min="1" max="10" step="1"
                    value={backLineGap} 
                    onChange={(e) => setBackLineGap(Number(e.target.value))}
                    className="w-full accent-blue-600"
                  />
                </div>
              </div>
            </div>

            {/* Instruction editor */}
            <div className="lg:col-span-5 space-y-4">
              <h4 className="font-semibold text-xs text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <FileText className="w-3.5 h-3.5" /> কার্ডের পিছনের নির্দেশনাবলী এডিট করুন
              </h4>

              {template === 'minimal' ? (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600 block">Terms & Conditions (English/Bengali):</label>
                  <textarea
                    rows={4}
                    value={termsAndConditions}
                    onChange={(e) => setTermsAndConditions(e.target.value)}
                    className="w-full p-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="মিনিমাল কার্ডের পিছনের লেখা..."
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  {customInstructions.map((inst, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <span className="text-xs font-bold text-slate-400 w-4 shrink-0">{index + 1}.</span>
                      <input 
                        type="text"
                        value={inst}
                        onChange={(e) => {
                          const updated = [...customInstructions];
                          updated[index] = e.target.value;
                          setCustomInstructions(updated);
                        }}
                        className="flex-1 p-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-start"
                        placeholder={`নির্দেশনা নং ${index + 1}`}
                        dir="auto"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const updated = customInstructions.filter((_, i) => i !== index);
                          setCustomInstructions(updated);
                        }}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition shrink-0"
                        title="মুছে ফেলুন"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  
                  <button
                    type="button"
                    onClick={() => {
                      setCustomInstructions([...customInstructions, ""]);
                    }}
                    className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2.5 py-1.5 rounded-lg border border-dashed border-blue-200 w-full justify-center transition mt-2"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    নতুন নির্দেশনা যোগ করুন
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div id="id-cards-print-area" className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 print:flex print:flex-wrap print:justify-center print:gap-x-4 print:gap-y-6 ${banglaFont}`}>
        {users.flatMap((user) => {
          const cards = [];
          if (cardSide === "front" || cardSide === "both") {
            cards.push({ type: "front", user });
          }
          if (cardSide === "back" || cardSide === "both") {
            cards.push({ type: "back", user });
          }
          return cards;
        }).map(({ type, user }, idx) => {
          const studentId = getStudentIdNumber(user, users);
          const studentIdBn = convertToBanglaNumber(studentId);
          return (
            <div key={`${user.id}-${type}-${idx}`} className="mx-auto print:break-inside-avoid" style={{ width: '2.125in', height: '3.375in' }}>
              {type === "front" ? (
                <>
                  {template === 'modern' && (
                  <div className="w-full h-full border border-slate-300 rounded-xl overflow-hidden shadow-sm relative bg-white flex flex-col">
                    <div className={`h-[82px] ${currentTheme.bg} text-white flex flex-col items-center justify-start pt-2.5 px-2 text-center`}>
                      <h3 className="font-bold leading-tight tracking-wider line-clamp-1" style={{ fontSize: `${titleFontSize}px` }}>{madrasaInfo?.name || "QawmiERP"}</h3>
                      <p className="opacity-90 mt-0.5 leading-snug line-clamp-2 max-w-[1.8in]" style={{ fontSize: `${addressFontSize}px` }}>{madrasaInfo?.address || "মাদরাসা ম্যানেজমেন্ট"}</p>
                    </div>
                    
                    <div className="flex-1 flex flex-col items-center px-4 pt-10 relative">
                      <div className="absolute -top-8 bg-slate-200 w-16 h-16 rounded-full border-[3px] border-white shadow-sm flex items-center justify-center overflow-hidden">
                        {user.photo_url ? (
                          <img 
                            src={getDirectPhotoUrl(user.photo_url)} 
                            alt="Photo" 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <IdCard className="w-8 h-8 text-slate-400" />
                        )}
                      </div>
                      <h4 className="font-bold text-slate-800 mt-1 text-center leading-tight" style={{ fontSize: `${nameFontSize}px` }}>
                        {userType === 'Student' ? `${user.first_name} ${user.last_name}` : user.name}
                      </h4>
                      <span className={`${currentTheme.light} text-[9px] px-2 py-0.5 rounded-full font-bold mt-1 uppercase`}>
                        {userType === 'Student' ? 'Student' : 'Teacher / Staff'}
                      </span>
                      
                      <div className="w-full mt-3 flex flex-col" style={{ gap: `${detailsGap}px` }}>
                        {userType === 'Student' ? (
                          <>
                            <div className="flex justify-between border-b border-slate-100 pb-0.5" style={{ fontSize: `${detailsFontSize}px` }}>
                              <span className="text-slate-500">ID No:</span>
                              <span className="font-bold text-blue-700">{studentIdBn}</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-100 pb-0.5" style={{ fontSize: `${detailsFontSize}px` }}>
                              <span className="text-slate-500">Roll:</span>
                              <span className="font-semibold text-slate-800">{user.roll_number || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-100 pb-0.5" style={{ fontSize: `${detailsFontSize}px` }}>
                              <span className="text-slate-500">Class:</span>
                              <span className="font-semibold text-slate-800">{user.classes?.name || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-100 pb-0.5" style={{ fontSize: `${detailsFontSize}px` }}>
                              <span className="text-slate-500">Blood:</span>
                              <span className="font-semibold text-red-600">{user.blood_group || '-'}</span>
                            </div>
                            <div className="flex justify-between pb-0.5" style={{ fontSize: `${detailsFontSize}px` }}>
                              <span className="text-slate-500">Phone:</span>
                              <span className="font-semibold text-slate-800">{user.parent_phone || 'N/A'}</span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex justify-between border-b border-slate-100 pb-0.5" style={{ fontSize: `${detailsFontSize}px` }}>
                              <span className="text-slate-500">Role:</span>
                              <span className="font-semibold text-slate-800">{user.designation || 'Teacher'}</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-100 pb-0.5" style={{ fontSize: `${detailsFontSize}px` }}>
                              <span className="text-slate-500">Phone:</span>
                              <span className="font-semibold text-slate-800">{user.phone || 'N/A'}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    <div className={`h-8 ${currentTheme.bg} text-white flex items-center justify-center text-[10px]`}>
                      Issuer Signature
                    </div>
                  </div>
                )}

                {template === 'classic' && (
                  <div className={`w-full h-full border-2 ${currentTheme.border} rounded-lg overflow-hidden relative bg-white flex flex-col`}>
                    <div className="flex items-center justify-between p-3 border-b border-slate-200">
                       <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center">
                         <IdCard className={`w-4 h-4 ${currentTheme.text}`} />
                       </div>
                       <div className="text-right">
                         <h3 className={`font-bold ${currentTheme.text} uppercase leading-tight`} style={{ fontSize: `${titleFontSize}px` }}>{madrasaInfo?.name || "QawmiERP"}</h3>
                         <p className="text-slate-500 uppercase leading-none" style={{ fontSize: `${addressFontSize}px` }}>{madrasaInfo?.address || "Identity Card"}</p>
                       </div>
                    </div>
                    
                    <div className="flex-1 flex flex-col px-3 py-2 justify-between">
                      <div className="flex gap-2 items-start mb-2">
                        <div className="bg-slate-100 w-12 h-14 border border-slate-300 flex-shrink-0 flex items-center justify-center overflow-hidden">
                           {user.photo_url ? (
                             <img 
                               src={getDirectPhotoUrl(user.photo_url)} 
                               alt="Photo" 
                               className="w-full h-full object-cover"
                               referrerPolicy="no-referrer"
                             />
                           ) : (
                             <span className="text-[8px] text-slate-400">Photo</span>
                           )}
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 leading-tight" style={{ fontSize: `${nameFontSize}px` }}>
                            {userType === 'Student' ? `${user.first_name} ${user.last_name}` : user.name}
                          </h4>
                          <p className={`font-bold ${currentTheme.text} uppercase text-[9px]`}>
                            {userType === 'Student' ? 'Student' : user.designation || 'Teacher / Staff'}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex flex-col mt-1" style={{ gap: `${detailsGap}px` }}>
                        {userType === 'Student' && (
                          <>
                            <p style={{ fontSize: `${detailsFontSize}px` }}><span className="font-bold text-slate-600">ID No:</span> <span className="font-bold text-blue-700">{studentIdBn}</span></p>
                            <p style={{ fontSize: `${detailsFontSize}px` }}><span className="font-bold text-slate-600">Roll No:</span> {user.roll_number}</p>
                            <p style={{ fontSize: `${detailsFontSize}px` }}><span className="font-bold text-slate-600">Class:</span> {user.classes?.name}</p>
                            <p style={{ fontSize: `${detailsFontSize}px` }}><span className="font-bold text-slate-600">Blood Grp:</span> <span className="text-red-600 font-bold">{user.blood_group || '-'}</span></p>
                            <p style={{ fontSize: `${detailsFontSize}px` }}><span className="font-bold text-slate-600">Contact:</span> {user.parent_phone}</p>
                          </>
                        )}
                        {userType !== 'Student' && (
                          <>
                            <p style={{ fontSize: `${detailsFontSize}px` }}><span className="font-bold text-slate-600">ID No:</span> {user.id.substring(0,6)}</p>
                            <p style={{ fontSize: `${detailsFontSize}px` }}><span className="font-bold text-slate-600">Contact:</span> {user.phone}</p>
                          </>
                        )}
                      </div>
                      
                      <div className="mt-auto flex justify-between items-end pt-2">
                         <div className="text-center">
                           <div className="w-12 border-b border-slate-800 mb-0.5"></div>
                           <p className="text-[8px]">Holder</p>
                         </div>
                         <div className="text-center">
                           <div className="w-12 border-b border-slate-800 mb-0.5"></div>
                           <p className="text-[8px]">Authority</p>
                         </div>
                      </div>
                    </div>
                  </div>
                )}

                {template === 'minimal' && (
                  <div className="w-full h-full border border-slate-200 rounded-sm overflow-hidden relative bg-white flex flex-col p-4">
                    <h3 className={`font-black text-center tracking-widest uppercase ${currentTheme.text} leading-tight`} style={{ fontSize: `${titleFontSize}px` }}>{madrasaInfo?.name || "QawmiERP"}</h3>
                    <p className="text-center text-slate-500 leading-snug" style={{ fontSize: `${addressFontSize}px` }}>{madrasaInfo?.address}</p>
                    <div className="w-full border-b-2 border-slate-100 my-2"></div>
                    
                    <div className="flex-1 flex flex-col items-center justify-center">
                      <div className="bg-slate-100 w-16 h-16 rounded-full mb-3 flex items-center justify-center overflow-hidden">
                         {user.photo_url ? (
                           <img 
                             src={getDirectPhotoUrl(user.photo_url)} 
                             alt="Photo" 
                             className="w-full h-full object-cover"
                             referrerPolicy="no-referrer"
                           />
                         ) : (
                           <IdCard className={`w-8 h-8 ${currentTheme.text} opacity-50`} />
                         )}
                      </div>
                      <h4 className="font-bold text-slate-800 text-center uppercase tracking-wide leading-tight" style={{ fontSize: `${nameFontSize}px` }}>
                        {userType === 'Student' ? `${user.first_name} ${user.last_name}` : user.name}
                      </h4>
                      <div className={`w-8 h-0.5 ${currentTheme.bg} my-2`}></div>
                      
                      <div className="text-center text-slate-500 flex flex-col" style={{ gap: `${detailsGap}px` }}>
                        {userType === 'Student' ? (
                          <>
                            <p className="uppercase font-semibold tracking-wider text-slate-700" style={{ fontSize: `${detailsFontSize}px` }}>{user.classes?.name}</p>
                            <p style={{ fontSize: `${detailsFontSize}px` }}><span className="font-bold">ID No:</span> <span className="font-bold text-blue-700">{studentIdBn}</span></p>
                            <p style={{ fontSize: `${detailsFontSize}px` }}>Roll: {user.roll_number}</p>
                            <p style={{ fontSize: `${detailsFontSize}px` }}>Blood: {user.blood_group || 'N/A'}</p>
                          </>
                        ) : (
                          <>
                            <p className="uppercase font-semibold tracking-wider text-slate-700" style={{ fontSize: `${detailsFontSize}px` }}>{user.designation || 'Teacher'}</p>
                            <p style={{ fontSize: `${detailsFontSize}px` }}>ID: {user.id.substring(0,8)}</p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* Back Side of the Card */
              <>
                {template === 'modern' && (
                  <div className="w-full h-full border border-slate-300 rounded-xl overflow-hidden shadow-sm relative bg-white flex flex-col p-3 justify-between">
                    <div className="text-center">
                      <h4 className={`text-[10px] font-bold ${currentTheme.text} mb-1 border-b pb-1 border-slate-100`}>নির্দেশনাবলী</h4>
                      <ul className="text-slate-600 text-left list-disc pl-3.5 leading-tight flex flex-col" style={{ gap: `${backLineGap}px` }}>
                        {customInstructions.map((inst, index) => inst.trim() && (
                          <li key={index} style={{ fontSize: `${backFontSize}px` }}>{inst}</li>
                        ))}
                      </ul>
                    </div>
                    
                    <div className="mt-1" style={{ gap: `${backLineGap}px`, display: 'flex', flexDirection: 'column' }}>
                      <div className="border-t border-slate-100 pt-1 text-slate-500 text-center leading-tight" style={{ fontSize: `${backFontSize}px` }}>
                        <p className="font-semibold text-slate-700" style={{ fontSize: `${backFontSize + 1}px` }}>{madrasaInfo?.name}</p>
                        <p className="line-clamp-1">{madrasaInfo?.address}</p>
                        {madrasaInfo?.phone && <p>ফোন: {madrasaInfo?.phone}</p>}
                      </div>
                      
                      {/* Barcode representation */}
                      <div className="flex flex-col items-center gap-0.5">
                        <div className="flex justify-center items-center gap-[1px] h-5 bg-white px-1.5 py-0.5 border border-slate-200 rounded">
                          {[1, 2, 1, 3, 1, 2, 1, 4, 1, 2, 3, 1, 2, 1, 2].map((w, i) => (
                            <div key={i} className="h-full bg-slate-800" style={{ width: `${w}px` }}></div>
                          ))}
                        </div>
                        <span className="text-[6px] font-mono text-slate-400 tracking-widest leading-none">
                          {userType === 'Student' ? `*STD-${studentId}*` : `*TCH-${user.id.substring(0, 4)}*`}
                        </span>
                      </div>

                      {/* Issuer Sign */}
                      <div className="flex flex-col items-center">
                        <div className="w-14 border-b border-dashed border-slate-300 h-2"></div>
                        <span className="text-[7px] text-slate-400 font-semibold mt-0.5">কর্তৃপক্ষের স্বাক্ষর</span>
                      </div>
                    </div>
                  </div>
                )}

                {template === 'classic' && (
                  <div className={`w-full h-full border-2 ${currentTheme.border} rounded-lg overflow-hidden relative bg-white flex flex-col p-3 justify-between`}>
                    <div className="text-center">
                      <h3 className={`font-bold ${currentTheme.text} border-b pb-1 ${currentTheme.border} mb-1.5`} style={{ fontSize: `${backFontSize + 2}px` }}>
                        {madrasaInfo?.name || "QawmiERP"}
                      </h3>
                      <h4 className="font-bold text-slate-700 mb-0.5" style={{ fontSize: `${backFontSize + 1}px` }}>কার্ড ব্যবহারের নিয়মাবলী</h4>
                      <ul className="text-slate-600 text-left list-decimal pl-3 leading-snug flex flex-col" style={{ gap: `${backLineGap}px` }}>
                        {customInstructions.map((inst, index) => inst.trim() && (
                          <li key={index} style={{ fontSize: `${backFontSize}px` }}>{inst}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="text-center mt-1 flex flex-col" style={{ gap: `${backLineGap}px` }}>
                      <p className="text-slate-500 line-clamp-1 leading-snug" style={{ fontSize: `${backFontSize}px` }}>ঠিকানা: {madrasaInfo?.address}</p>
                      {madrasaInfo?.phone && <p className="text-slate-500 leading-none" style={{ fontSize: `${backFontSize}px` }}>ফোন: {madrasaInfo?.phone}</p>}
                      
                      {/* Mock Barcode */}
                      <div className="flex flex-col items-center gap-0.5 pt-0.5">
                        <div className="flex justify-center items-center gap-[1px] h-4 bg-white px-2 py-0.5 border border-slate-200">
                          {[1, 1, 2, 1, 3, 1, 1, 2, 1, 2, 1, 3, 1].map((w, i) => (
                            <div key={i} className="h-full bg-slate-800" style={{ width: `${w}px` }}></div>
                          ))}
                        </div>
                        <span className="text-[5px] font-mono text-slate-400 leading-none">
                          {userType === 'Student' ? `ID: ${studentIdBn}` : `ID: ${user.id.substring(0, 4)}`}
                        </span>
                      </div>

                      <div className="flex justify-between items-end pt-1.5 text-[7px] text-slate-500">
                        <div className="text-center flex-1">
                          <div className="w-8 border-b border-slate-300 mx-auto"></div>
                          <p className="mt-0.5 text-[6px]">কার্ডধারী</p>
                        </div>
                        <div className="text-center flex-1">
                          <div className="w-8 border-b border-slate-300 mx-auto"></div>
                          <p className="mt-0.5 text-[6px]">অনুমোদনকারী</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {template === 'minimal' && (
                  <div className="w-full h-full border border-slate-200 rounded-sm overflow-hidden relative bg-white flex flex-col p-3 justify-between text-center">
                    <div>
                      <h3 className="font-bold tracking-wider uppercase text-slate-800" style={{ fontSize: `${backFontSize + 2}px` }}>{madrasaInfo?.name}</h3>
                      <div className="w-full border-b border-slate-100 my-1.5"></div>
                      
                      <p className="font-bold text-slate-700 mb-0.5" style={{ fontSize: `${backFontSize + 1}px` }}>TERMS & CONDITIONS</p>
                      <p className="text-slate-500 text-left leading-normal" style={{ fontSize: `${backFontSize}px` }}>
                        {termsAndConditions}
                      </p>
                    </div>

                    <div className="flex flex-col" style={{ gap: `${backLineGap}px` }}>
                      <div className="text-slate-500 border-t border-slate-100 pt-1.5 leading-relaxed" style={{ fontSize: `${backFontSize}px` }}>
                        <p className="font-semibold">{madrasaInfo?.address}</p>
                        {madrasaInfo?.phone && <p>Phone: {madrasaInfo?.phone}</p>}
                      </div>

                      {/* Barcode */}
                      <div className="flex flex-col items-center gap-0.5">
                        <div className="flex justify-center items-center gap-[1px] h-4">
                          {[1, 2, 1, 1, 2, 1, 3, 1, 1, 2, 1, 1, 2].map((w, i) => (
                            <div key={i} className="h-full bg-slate-900" style={{ width: `${w}px` }}></div>
                          ))}
                        </div>
                        <span className="text-[5px] font-mono text-slate-400 leading-none">
                          {userType === 'Student' ? `ID-${studentId}` : `STAFF-${user.id.substring(0, 4)}`}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
