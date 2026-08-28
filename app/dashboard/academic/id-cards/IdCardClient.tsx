"use client";

import { useState } from "react";
import PrintButton from "@/app/components/PrintButton";
import { IdCard, Palette, LayoutTemplate, Sliders, FileText, Settings, Plus, Trash2, Type, Printer, RotateCcw } from "lucide-react";
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

function chunkArray<T>(array: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

export default function IdCardClient({ 
  users, 
  userType, 
  madrasaInfo 
}: { 
  users: any[]; 
  userType: string; 
  madrasaInfo?: { name: string; address: string; phone: string } 
}) {
  const [template, setTemplate] = useState("modern");
  const [themeColor, setThemeColor] = useState("blue");
  const [cardSide, setCardSide] = useState<"front" | "back" | "both">("both");
  const [banglaFont, setBanglaFont] = useState("font-solaiman");
  
  // Customization States for sizes and spacing (calibrated for standard CR80 2.125" x 3.375" ID card)
  const [titleFontSize, setTitleFontSize] = useState(11); // px
  const [addressFontSize, setAddressFontSize] = useState(8.5); // px
  const [nameFontSize, setNameFontSize] = useState(12.5); // px
  const [detailsFontSize, setDetailsFontSize] = useState(9.5); // px
  const [detailsGap, setDetailsGap] = useState(3); // px gap between rows
  const [backFontSize, setBackFontSize] = useState(7.5); // px
  const [backLineGap, setBackLineGap] = useState(3); // px gap between instruction items
  const [showEditor, setShowEditor] = useState(false); // Toggle customization editor

  const resetToDefaultSizes = () => {
    setTitleFontSize(11);
    setAddressFontSize(8.5);
    setNameFontSize(12.5);
    setDetailsFontSize(9.5);
    setDetailsGap(3);
    setBackFontSize(7.5);
    setBackLineGap(3);
  };

  const handlePrint = () => {
    const printableElement = document.getElementById("printable-id-card-sheet");
    if (!printableElement) {
      window.print();
      return;
    }

    const existing = document.getElementById("temp-print-frame");
    if (existing) existing.remove();

    const clone = printableElement.cloneNode(true) as HTMLElement;
    clone.id = "temp-print-frame";
    clone.classList.remove("hidden");
    clone.classList.add("block");
    document.body.appendChild(clone);
    document.body.classList.add("is-printing-now");

    setTimeout(() => {
      window.print();
      setTimeout(() => {
        document.body.classList.remove("is-printing-now");
        const temp = document.getElementById("temp-print-frame");
        if (temp) temp.remove();
      }, 500);
    }, 150);
  };

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

  const colors: Record<string, { bg: string; text: string; border: string; light: string }> = {
    blue: { bg: "bg-blue-700", text: "text-blue-700", border: "border-blue-700", light: "bg-blue-50 text-blue-700" },
    emerald: { bg: "bg-emerald-700", text: "text-emerald-700", border: "border-emerald-700", light: "bg-emerald-50 text-emerald-700" },
    indigo: { bg: "bg-indigo-700", text: "text-indigo-700", border: "border-indigo-700", light: "bg-indigo-50 text-indigo-700" },
    rose: { bg: "bg-rose-700", text: "text-rose-700", border: "border-rose-700", light: "bg-rose-50 text-rose-700" },
    slate: { bg: "bg-slate-800", text: "text-slate-800", border: "border-slate-800", light: "bg-slate-100 text-slate-800" },
  };

  const currentTheme = colors[themeColor] || colors.blue;

  // Flatten cards according to side selection
  const allCardsList = users.flatMap((user) => {
    const cards: { type: "front" | "back"; user: any }[] = [];
    if (cardSide === "front" || cardSide === "both") {
      cards.push({ type: "front", user });
    }
    if (cardSide === "back" || cardSide === "both") {
      cards.push({ type: "back", user });
    }
    return cards;
  });

  // Group for Print into A4 sheets with 8 cards per page
  const printPages = chunkArray(allCardsList, 8);

  const renderCard = ({ type, user }: { type: "front" | "back"; user: any }, idx: number) => {
    const studentId = getStudentIdNumber(user, users);
    const studentIdBn = convertToBanglaNumber(studentId);

    return (
      <div 
        key={`${user.id}-${type}-${idx}`} 
        className="print:break-inside-avoid bg-white shadow-xs rounded-xl overflow-hidden shrink-0 border border-slate-300"
        style={{ width: '2.125in', height: '3.375in', boxSizing: 'border-box' }}
      >
        {type === "front" ? (
          <>
            {template === 'modern' && (
              <div className="w-full h-full flex flex-col justify-between relative bg-white">
                <div className={`h-[82px] ${currentTheme.bg} text-white flex flex-col items-center justify-start pt-2 px-2 text-center`}>
                  <h3 className="font-bold leading-tight tracking-wider line-clamp-1" style={{ fontSize: `${titleFontSize}px` }}>{madrasaInfo?.name || "QawmiERP"}</h3>
                  <p className="opacity-90 mt-0.5 leading-snug line-clamp-2 max-w-[1.8in]" style={{ fontSize: `${addressFontSize}px` }}>{madrasaInfo?.address || "মাদরাসা ম্যানেজমেন্ট"}</p>
                </div>
                
                <div className="flex-1 flex flex-col items-center px-3 pt-8 relative">
                  <div className="absolute -top-7 bg-slate-200 w-14 h-14 rounded-full border-2 border-white shadow-sm flex items-center justify-center overflow-hidden">
                    {user.photo_url ? (
                      <img 
                        src={getDirectPhotoUrl(user.photo_url)} 
                        alt="Photo" 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <IdCard className="w-7 h-7 text-slate-400" />
                    )}
                  </div>
                  <h4 className="font-bold text-slate-800 mt-1 text-center leading-tight line-clamp-1" style={{ fontSize: `${nameFontSize}px` }}>
                    {userType === 'Student' ? `${user.first_name} ${user.last_name}` : user.name}
                  </h4>
                  <span className={`${currentTheme.light} text-[8px] px-2 py-0.5 rounded-full font-bold mt-0.5 uppercase`}>
                    {userType === 'Student' ? 'Student' : 'Teacher / Staff'}
                  </span>
                  
                  <div className="w-full mt-2 flex flex-col" style={{ gap: `${detailsGap}px` }}>
                    {userType === 'Student' ? (
                      <>
                        <div className="flex justify-between border-b border-slate-100 pb-0.5 text-[10px]" style={{ fontSize: `${detailsFontSize}px` }}>
                          <span className="text-slate-500">ID No:</span>
                          <span className="font-bold text-blue-700">{studentIdBn}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-100 pb-0.5 text-[10px]" style={{ fontSize: `${detailsFontSize}px` }}>
                          <span className="text-slate-500">Roll:</span>
                          <span className="font-semibold text-slate-800">{user.roll_number || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-100 pb-0.5 text-[10px]" style={{ fontSize: `${detailsFontSize}px` }}>
                          <span className="text-slate-500">Class:</span>
                          <span className="font-semibold text-slate-800 line-clamp-1">{user.classes?.name || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-100 pb-0.5 text-[10px]" style={{ fontSize: `${detailsFontSize}px` }}>
                          <span className="text-slate-500">Blood:</span>
                          <span className="font-semibold text-red-600">{user.blood_group || '-'}</span>
                        </div>
                        <div className="flex justify-between pb-0.5 text-[10px]" style={{ fontSize: `${detailsFontSize}px` }}>
                          <span className="text-slate-500">Phone:</span>
                          <span className="font-semibold text-slate-800">{user.parent_phone || 'N/A'}</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex justify-between border-b border-slate-100 pb-0.5 text-[10px]" style={{ fontSize: `${detailsFontSize}px` }}>
                          <span className="text-slate-500">Role:</span>
                          <span className="font-semibold text-slate-800 line-clamp-1">{user.designation || 'Teacher'}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-100 pb-0.5 text-[10px]" style={{ fontSize: `${detailsFontSize}px` }}>
                          <span className="text-slate-500">Phone:</span>
                          <span className="font-semibold text-slate-800">{user.phone || 'N/A'}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div className={`h-6 ${currentTheme.bg} text-white flex items-center justify-center text-[9px] font-semibold tracking-wider`}>
                  Authority Signature
                </div>
              </div>
            )}

            {template === 'classic' && (
              <div className={`w-full h-full border-2 ${currentTheme.border} overflow-hidden relative bg-white flex flex-col justify-between`}>
                <div className="flex items-center justify-between p-2 border-b border-slate-200">
                  <div className="w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center">
                    <IdCard className={`w-4 h-4 ${currentTheme.text}`} />
                  </div>
                  <div className="text-right">
                    <h3 className={`font-bold ${currentTheme.text} uppercase leading-tight line-clamp-1`} style={{ fontSize: `${titleFontSize}px` }}>{madrasaInfo?.name || "QawmiERP"}</h3>
                    <p className="text-slate-500 uppercase leading-none line-clamp-1" style={{ fontSize: `${addressFontSize}px` }}>{madrasaInfo?.address || "Identity Card"}</p>
                  </div>
                </div>
                
                <div className="flex-1 flex flex-col px-2.5 py-1.5 justify-between">
                  <div className="flex gap-2 items-start">
                    <div className="bg-slate-100 w-11 h-13 border border-slate-300 shrink-0 flex items-center justify-center overflow-hidden">
                      {user.photo_url ? (
                        <img 
                          src={getDirectPhotoUrl(user.photo_url)} 
                          alt="Photo" 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <span className="text-[7px] text-slate-400">Photo</span>
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 leading-tight line-clamp-1" style={{ fontSize: `${nameFontSize}px` }}>
                        {userType === 'Student' ? `${user.first_name} ${user.last_name}` : user.name}
                      </h4>
                      <p className={`font-bold ${currentTheme.text} uppercase text-[8px]`}>
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
                        <p style={{ fontSize: `${detailsFontSize}px` }}><span className="font-bold text-slate-600">ID No:</span> {user.id?.substring(0,6)}</p>
                        <p style={{ fontSize: `${detailsFontSize}px` }}><span className="font-bold text-slate-600">Contact:</span> {user.phone}</p>
                      </>
                    )}
                  </div>
                  
                  <div className="mt-auto flex justify-between items-end pt-1">
                    <div className="text-center">
                      <div className="w-10 border-b border-slate-800 mb-0.5"></div>
                      <p className="text-[7px]">Holder</p>
                    </div>
                    <div className="text-center">
                      <div className="w-10 border-b border-slate-800 mb-0.5"></div>
                      <p className="text-[7px]">Authority</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {template === 'minimal' && (
              <div className="w-full h-full border border-slate-200 overflow-hidden relative bg-white flex flex-col p-3 justify-between">
                <div>
                  <h3 className={`font-black text-center tracking-widest uppercase ${currentTheme.text} leading-tight line-clamp-1`} style={{ fontSize: `${titleFontSize}px` }}>{madrasaInfo?.name || "QawmiERP"}</h3>
                  <p className="text-center text-slate-500 leading-snug line-clamp-1" style={{ fontSize: `${addressFontSize}px` }}>{madrasaInfo?.address}</p>
                  <div className="w-full border-b-2 border-slate-100 my-1.5"></div>
                </div>
                
                <div className="flex-1 flex flex-col items-center justify-center">
                  <div className="bg-slate-100 w-13 h-13 rounded-full mb-1.5 flex items-center justify-center overflow-hidden">
                    {user.photo_url ? (
                      <img 
                        src={getDirectPhotoUrl(user.photo_url)} 
                        alt="Photo" 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <IdCard className={`w-6 h-6 ${currentTheme.text} opacity-50`} />
                    )}
                  </div>
                  <h4 className="font-bold text-slate-800 text-center uppercase tracking-wide leading-tight line-clamp-1" style={{ fontSize: `${nameFontSize}px` }}>
                    {userType === 'Student' ? `${user.first_name} ${user.last_name}` : user.name}
                  </h4>
                  <div className={`w-8 h-0.5 ${currentTheme.bg} my-1`}></div>
                  
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
                        <p style={{ fontSize: `${detailsFontSize}px` }}>ID: {user.id?.substring(0,8)}</p>
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
              <div className="w-full h-full relative bg-white flex flex-col p-2.5 justify-between">
                <div className="text-center">
                  <h4 className={`text-[9px] font-bold ${currentTheme.text} mb-1 border-b pb-0.5 border-slate-100`}>নির্দেশনাবলী</h4>
                  <ul className="text-slate-600 text-left list-disc pl-3.5 leading-tight flex flex-col" style={{ gap: `${backLineGap}px` }}>
                    {customInstructions.map((inst, index) => inst.trim() && (
                      <li key={index} style={{ fontSize: `${backFontSize}px` }}>{inst}</li>
                    ))}
                  </ul>
                </div>
                
                <div className="mt-1 flex flex-col" style={{ gap: `${backLineGap}px` }}>
                  <div className="border-t border-slate-100 pt-1 text-slate-500 text-center leading-tight" style={{ fontSize: `${backFontSize}px` }}>
                    <p className="font-semibold text-slate-700 line-clamp-1" style={{ fontSize: `${backFontSize + 1}px` }}>{madrasaInfo?.name}</p>
                    <p className="line-clamp-1">{madrasaInfo?.address}</p>
                    {madrasaInfo?.phone && <p>ফোন: {madrasaInfo?.phone}</p>}
                  </div>
                  
                  {/* Barcode representation */}
                  <div className="flex flex-col items-center gap-0.5">
                    <div className="flex justify-center items-center gap-[1px] h-4 bg-white px-1.5 py-0.5 border border-slate-200 rounded">
                      {[1, 2, 1, 3, 1, 2, 1, 4, 1, 2, 3, 1, 2, 1, 2].map((w, i) => (
                        <div key={i} className="h-full bg-slate-800" style={{ width: `${w}px` }}></div>
                      ))}
                    </div>
                    <span className="text-[6px] font-mono text-slate-400 tracking-widest leading-none">
                      {userType === 'Student' ? `*STD-${studentId}*` : `*TCH-${user.id?.substring(0, 4)}*`}
                    </span>
                  </div>

                  {/* Issuer Sign */}
                  <div className="flex flex-col items-center">
                    <div className="w-12 border-b border-dashed border-slate-300 h-1"></div>
                    <span className="text-[7px] text-slate-400 font-semibold mt-0.5">কর্তৃপক্ষের স্বাক্ষর</span>
                  </div>
                </div>
              </div>
            )}

            {template === 'classic' && (
              <div className={`w-full h-full border-2 ${currentTheme.border} relative bg-white flex flex-col p-2.5 justify-between`}>
                <div className="text-center">
                  <h3 className={`font-bold ${currentTheme.text} border-b pb-0.5 ${currentTheme.border} mb-1 line-clamp-1`} style={{ fontSize: `${backFontSize + 2}px` }}>
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
                  
                  {/* Barcode */}
                  <div className="flex flex-col items-center gap-0.5 pt-0.5">
                    <div className="flex justify-center items-center gap-[1px] h-3 bg-white px-2 py-0.5 border border-slate-200">
                      {[1, 1, 2, 1, 3, 1, 1, 2, 1, 2, 1, 3, 1].map((w, i) => (
                        <div key={i} className="h-full bg-slate-800" style={{ width: `${w}px` }}></div>
                      ))}
                    </div>
                    <span className="text-[5px] font-mono text-slate-400 leading-none">
                      {userType === 'Student' ? `ID: ${studentIdBn}` : `ID: ${user.id?.substring(0, 4)}`}
                    </span>
                  </div>

                  <div className="flex justify-between items-end pt-1 text-[7px] text-slate-500">
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
              <div className="w-full h-full border border-slate-200 relative bg-white flex flex-col p-2.5 justify-between text-center">
                <div>
                  <h3 className="font-bold tracking-wider uppercase text-slate-800 line-clamp-1" style={{ fontSize: `${backFontSize + 2}px` }}>{madrasaInfo?.name}</h3>
                  <div className="w-full border-b border-slate-100 my-1"></div>
                  
                  <p className="font-bold text-slate-700 mb-0.5" style={{ fontSize: `${backFontSize + 1}px` }}>TERMS & CONDITIONS</p>
                  <p className="text-slate-500 text-left leading-normal" style={{ fontSize: `${backFontSize}px` }}>
                    {termsAndConditions}
                  </p>
                </div>

                <div className="flex flex-col" style={{ gap: `${backLineGap}px` }}>
                  <div className="text-slate-500 border-t border-slate-100 pt-1 leading-relaxed" style={{ fontSize: `${backFontSize}px` }}>
                    <p className="font-semibold line-clamp-1">{madrasaInfo?.address}</p>
                    {madrasaInfo?.phone && <p>Phone: {madrasaInfo?.phone}</p>}
                  </div>

                  {/* Barcode */}
                  <div className="flex flex-col items-center gap-0.5">
                    <div className="flex justify-center items-center gap-[1px] h-3">
                      {[1, 2, 1, 1, 2, 1, 3, 1, 1, 2, 1, 1, 2].map((w, i) => (
                        <div key={i} className="h-full bg-slate-900" style={{ width: `${w}px` }}></div>
                      ))}
                    </div>
                    <span className="text-[5px] font-mono text-slate-400 leading-none">
                      {userType === 'Student' ? `ID-${studentId}` : `STAFF-${user.id?.substring(0, 4)}`}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl border shadow-xs p-6 print:border-none print:shadow-none print:p-0">
      {/* Top Toolbar */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 print:hidden gap-4">
        <h2 className="text-base font-bold text-slate-800">
          সর্বমোট {users.length} জনের আইডি কার্ড ({allCardsList.length} টি কার্ড ভিউ)
        </h2>
        
        <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
          <div className="flex items-center gap-1.5">
            <LayoutTemplate className="w-4 h-4 text-slate-500" />
            <select 
              value={template} 
              onChange={(e) => setTemplate(e.target.value)}
              className="text-xs bg-white border border-slate-200 rounded-md p-1.5 text-slate-700 font-medium"
            >
              <option value="modern">মডার্ন ডিজাইন</option>
              <option value="classic">ক্লাসিক ডিজাইন</option>
              <option value="minimal">মিনিমাল ডিজাইন</option>
            </select>
          </div>
          
          <div className="flex items-center gap-1.5">
            <Palette className="w-4 h-4 text-slate-500" />
            <select 
              value={themeColor} 
              onChange={(e) => setThemeColor(e.target.value)}
              className="text-xs bg-white border border-slate-200 rounded-md p-1.5 text-slate-700 font-medium"
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
              className="text-xs bg-white border border-slate-200 rounded-md p-1.5 text-slate-700 font-medium"
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
              className="text-xs bg-white border border-slate-200 rounded-md p-1.5 text-slate-700 font-medium"
            >
              <option value="both">সামনে ও পিছনে (Both)</option>
              <option value="front">শুধুমাত্র সামনে (Front)</option>
              <option value="back">শুধুমাত্র পিছনে (Back)</option>
            </select>
          </div>

          <button 
            onClick={() => setShowEditor(!showEditor)}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md border transition-colors ${showEditor ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
          >
            <Settings className="w-3.5 h-3.5" />
            {showEditor ? 'এডিটর বন্ধ' : 'ফন্ট ও সাইজ এডিটর'}
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 rounded-md text-xs font-semibold shadow-xs transition"
          >
            <Printer className="w-3.5 h-3.5" />
            A4 পেজে প্রিন্ট করুন
          </button>
        </div>
      </div>

      {/* Editor Drawer */}
      {showEditor && (
        <div className="mb-8 p-5 bg-slate-50 border border-slate-200 rounded-xl print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-2 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-blue-600" />
              <h3 className="font-bold text-slate-800 text-sm">
                কার্ড কাস্টমাইজেশন টুলস (Card Customization Editor)
              </h3>
            </div>
            
            <button
              onClick={resetToDefaultSizes}
              className="flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-lg transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              ডিফল্ট সাইজে রিসেট
            </button>
          </div>

          <div className="mb-4 bg-blue-50/80 border border-blue-200 p-3 rounded-lg text-xs text-blue-800 leading-relaxed">
            💡 <strong>প্রিন্ট টিপস:</strong> আইডি কার্ডের আকার নির্দিষ্ট (২.১২৫" × ৩.৩৭৫")। ফন্ট সাইজ বেশি বড় করলে (যেমন নাম ১৫px বা বিবরণী ১২px এর বেশি) প্রিন্ট প্রভিউতে কার্ডের বাইরে চলে যেতে পারে। সব সময় <strong>ডিফল্ট সাইজ</strong> ব্যবহার করা সবচেয়ে পারফেক্ট।
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 space-y-4">
              <h4 className="font-semibold text-xs text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Sliders className="w-3.5 h-3.5" /> লেখা ও ফন্টের সাইজ এডজাস্টমেন্ট
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3.5 text-xs">
                <div className="space-y-1.5">
                  <div className="flex justify-between font-medium text-slate-700">
                    <span>মাদরাসার নাম:</span>
                    <span className="font-mono text-blue-600 font-bold">{titleFontSize}px</span>
                  </div>
                  <input 
                    type="range" min="8" max="14" step="0.5"
                    value={titleFontSize} 
                    onChange={(e) => setTitleFontSize(Number(e.target.value))}
                    className="w-full accent-blue-600"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between font-medium text-slate-700">
                    <span>ঠিকানা সাইজ:</span>
                    <span className="font-mono text-blue-600 font-bold">{addressFontSize}px</span>
                  </div>
                  <input 
                    type="range" min="6" max="11" step="0.5"
                    value={addressFontSize} 
                    onChange={(e) => setAddressFontSize(Number(e.target.value))}
                    className="w-full accent-blue-600"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between font-medium text-slate-700">
                    <span>শিক্ষার্থী/শিক্ষকের নাম:</span>
                    <span className="font-mono text-blue-600 font-bold">{nameFontSize}px</span>
                  </div>
                  <input 
                    type="range" min="9" max="15" step="0.5"
                    value={nameFontSize} 
                    onChange={(e) => setNameFontSize(Number(e.target.value))}
                    className="w-full accent-blue-600"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between font-medium text-slate-700">
                    <span>বিবরণীর ফন্ট:</span>
                    <span className="font-mono text-blue-600 font-bold">{detailsFontSize}px</span>
                  </div>
                  <input 
                    type="range" min="7.5" max="12" step="0.5"
                    value={detailsFontSize} 
                    onChange={(e) => setDetailsFontSize(Number(e.target.value))}
                    className="w-full accent-blue-600"
                  />
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 space-y-4">
              <h4 className="font-semibold text-xs text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <FileText className="w-3.5 h-3.5" /> কার্ডের পিছনের নির্দেশনাবলী
              </h4>

              {template === 'minimal' ? (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600 block">Terms & Conditions:</label>
                  <textarea
                    rows={4}
                    value={termsAndConditions}
                    onChange={(e) => setTermsAndConditions(e.target.value)}
                    className="w-full p-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                        className="flex-1 p-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const updated = customInstructions.filter((_, i) => i !== index);
                          setCustomInstructions(updated);
                        }}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  
                  <button
                    type="button"
                    onClick={() => setCustomInstructions([...customInstructions, ""])}
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

      {/* Screen Preview Grid */}
      <div className={`print:hidden grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 justify-items-center ${banglaFont}`}>
        {allCardsList.map((cardItem, idx) => renderCard(cardItem, idx))}
      </div>

      {/* Print View: Structured into precise A4 Sheets with 8 cards per page */}
      <div id="printable-id-card-sheet" className={`hidden print:block print:w-full ${banglaFont}`}>
        {printPages.map((pageCards, pageIndex) => (
          <div key={pageIndex} className="a4-id-card-sheet bg-white">
            {pageCards.map((cardItem, idx) => renderCard(cardItem, pageIndex * 8 + idx))}
          </div>
        ))}
      </div>
    </div>
  );
}
