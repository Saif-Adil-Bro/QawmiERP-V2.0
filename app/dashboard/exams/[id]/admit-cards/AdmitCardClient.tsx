"use client";

import { useState, useEffect } from "react";
import { getStudentsByClass } from "@/app/actions/exams";
import { Printer, User, Type, GraduationCap } from "lucide-react";
import { getMadrasaProfileWithLogo } from "@/app/actions/tenant";
import { toBanglaNumber } from "@/lib/numberToBangla";

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

// Helper to chunk array for A4 pages
function chunkArray<T>(array: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

export default function AdmitCardClient({ 
  examId, 
  classes, 
  examTitle, 
  examYear,
  madrasaInfo
}: { 
  examId: string; 
  classes: { id: string; name: string }[];
  examTitle: string;
  examYear: string;
  madrasaInfo: any;
}) {
  const [classId, setClassId] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string>("all");
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [banglaFont, setBanglaFont] = useState("font-solaiman");
  const [profileAndLogo, setProfileAndLogo] = useState<any>(null);

  useEffect(() => {
    async function load() {
      const res = await getMadrasaProfileWithLogo();
      if (res) {
        setProfileAndLogo(res);
      }
    }
    load();
  }, []);

  const selectedClassName = classes.find(c => c.id === classId)?.name || '';

  const loadStudents = async () => {
    if (!classId) return;
    setLoading(true);
    const data = await getStudentsByClass(classId);
    setStudents(data);
    setLoading(false);
  };

  const handlePrint = () => {
    window.print();
  };

  const filteredStudents = selectedStudentId === "all"
    ? students
    : students.filter(s => s.id === selectedStudentId);

  // Group into pages of 2 admit cards per A4 page
  const studentPages = chunkArray(filteredStudents, 2);

  const activeMadrasa = profileAndLogo?.madrasa || madrasaInfo;
  const madrasaName = activeMadrasa?.name || 'মাদরাসাতুল মুসলিমীন';
  const madrasaAddress = activeMadrasa?.address || 'ঢাকা, বাংলাদেশ';
  const logoUrl = profileAndLogo?.logoUrl || activeMadrasa?.logo_url;
  const principalSignUrl = profileAndLogo?.signatureUrl || activeMadrasa?.principal_signature_url;
  const principalName = profileAndLogo?.principalName || activeMadrasa?.principal_name || 'মুহতামিম / প্রিন্সিপাল';

  return (
    <div className="space-y-6">
      {/* Filter & Controls Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-end bg-slate-50 p-4 rounded-xl border border-slate-200 print:hidden shadow-xs">
        <div className="w-full md:w-1/4">
          <label className="block text-xs font-bold text-slate-600 uppercase mb-1">ক্লাস নির্বাচন করুন</label>
          <select 
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value);
              setSelectedStudentId("all");
            }}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 transition bg-white text-sm font-medium"
          >
            <option value="">ক্লাস নির্বাচন করুন...</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {students.length > 0 && (
          <div className="w-full md:w-1/4">
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">শিক্ষার্থী নির্বাচন</label>
            <select 
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 transition bg-white text-sm font-medium"
            >
              <option value="all">সকল শিক্ষার্থী (মোট {students.length} জন)</option>
              {students.map((s, idx) => (
                <option key={s.id} value={s.id}>
                  রোল {toBanglaNumber(s.roll_number || idx + 1)}: {s.first_name} {s.last_name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="w-full md:w-auto flex flex-wrap items-center gap-3 ml-auto">
          <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 shadow-xs">
            <Type className="w-4 h-4 text-slate-500 shrink-0" />
            <select 
              value={banglaFont} 
              onChange={(e) => setBanglaFont(e.target.value)}
              className="text-xs font-medium text-slate-700 bg-transparent focus:outline-none"
            >
              <option value="font-solaiman">বাংলা: সোলাইমান লিপি</option>
              <option value="font-shorif">বাংলা: শরীফ শিশির</option>
              <option value="font-hindsiliguri">বাংলা: হিন্দ শিলিগুড়ি</option>
            </select>
          </div>

          <button 
            onClick={loadStudents}
            disabled={loading || !classId}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 transition text-sm font-semibold shadow-xs"
          >
            {loading ? "তৈরি হচ্ছে..." : "প্রবেশপত্র লোড করুন"}
          </button>
          
          <button 
            onClick={handlePrint}
            disabled={filteredStudents.length === 0}
            className="flex items-center space-x-2 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold text-sm disabled:opacity-50 shadow-xs"
          >
            <Printer className="w-4 h-4" />
            <span>প্রিন্ট / PDF ডাউনলোড</span>
          </button>
        </div>
      </div>

      {!loading && students.length === 0 && classId !== "" && (
        <div className="text-center py-12 text-slate-500 bg-white rounded-xl border border-dashed p-8 print:hidden">
          প্রবেশপত্র পেতে প্রথমে 'প্রবেশপত্র লোড করুন' বাটনে ক্লিক করুন।
        </div>
      )}

      {/* Screen Preview */}
      {students.length > 0 && (
        <div className="print:hidden space-y-4">
          <div className="flex justify-between items-center bg-blue-50 border border-blue-200 p-3 rounded-lg text-blue-900 text-sm font-medium">
            <span>মোট {filteredStudents.length} জন শিক্ষার্থীর প্রবেশপত্র প্রস্তুত রয়েছে (প্রতি পাতায় ২টি করে প্রবেশপত্র প্রিন্ট হবে)।</span>
            <button 
              onClick={handlePrint}
              className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700 transition text-xs font-semibold shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              প্রিন্ট ভিউ
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredStudents.map((student) => (
              <div key={student.id} className="border-2 border-slate-800 p-5 rounded-xl bg-white shadow-xs">
                <div className="text-center border-b pb-2 mb-3">
                  <h3 className="font-bold text-slate-900 text-base">{madrasaName}</h3>
                  <p className="text-xs text-slate-500">{madrasaAddress}</p>
                  <span className="inline-block bg-slate-900 text-white px-3 py-0.5 rounded-full text-xs font-bold mt-1">
                    প্রবেশপত্র (Admit Card)
                  </span>
                  <p className="text-xs font-semibold text-slate-700 mt-0.5">{examTitle} - {toBanglaNumber(examYear)}</p>
                </div>
                
                <div className="flex gap-4 items-center">
                  <div className="w-20 h-24 border border-slate-300 rounded bg-slate-50 flex items-center justify-center overflow-hidden shrink-0">
                    {student.photo_url ? (
                      <img 
                        src={getDirectPhotoUrl(student.photo_url)} 
                        alt="Photo" 
                        className="w-full h-full object-cover" 
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <User className="w-8 h-8 text-slate-300" />
                    )}
                  </div>
                  <div className="space-y-1 text-xs flex-1">
                    <p><span className="text-slate-500 font-medium">নাম:</span> <span className="font-bold text-slate-900 text-sm">{student.first_name} {student.last_name}</span></p>
                    <p><span className="text-slate-500 font-medium">ক্লাস:</span> <span className="font-semibold text-slate-800">{selectedClassName}</span></p>
                    <p><span className="text-slate-500 font-medium">রোল:</span> <span className="font-bold text-blue-700">{toBanglaNumber(student.roll_number || '১')}</span></p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PRINT VIEW: Exactly 2 admit cards per A4 page sheet */}
      <div className={`hidden print:block print:w-full ${banglaFont}`}>
        {studentPages.map((pageStudents, pageIdx) => (
          <div key={pageIdx} className="a4-admit-card-sheet bg-white">
            {pageStudents.map((student, cardIdx) => (
              <div 
                key={student.id} 
                className="border-2 border-slate-900 rounded-xl p-6 bg-white flex flex-col justify-between"
                style={{ minHeight: '125mm', maxHeight: '132mm', boxSizing: 'border-box' }}
              >
                {/* Header */}
                <div className="text-center border-b-2 border-slate-900 pb-3 mb-3 relative">
                  <div className="flex items-center justify-center gap-3">
                    {logoUrl ? (
                      <img 
                        src={logoUrl} 
                        alt="Logo" 
                        className="w-12 h-12 object-contain rounded-full border border-slate-300 p-0.5" 
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-emerald-50 rounded-full border border-emerald-700 flex items-center justify-center">
                        <GraduationCap className="w-6 h-6 text-emerald-800" />
                      </div>
                    )}
                    <div>
                      <h2 className="text-xl font-black text-slate-950 leading-tight">{madrasaName}</h2>
                      <p className="text-[11px] text-slate-600 font-medium">{madrasaAddress}</p>
                    </div>
                  </div>
                  
                  <div className="mt-2 inline-block bg-slate-900 text-white px-5 py-0.5 rounded-full font-black tracking-wider uppercase text-xs">
                    প্রবেশপত্র (Admit Card)
                  </div>
                  
                  <p className="text-slate-900 font-bold text-xs mt-1">{examTitle} - {toBanglaNumber(examYear)}</p>
                </div>

                {/* Body Details */}
                <div className="flex gap-6 items-center flex-1 my-2">
                  {/* Photo Frame */}
                  <div className="w-24 h-28 border-2 border-slate-400 rounded-md flex items-center justify-center bg-slate-50 relative shrink-0 overflow-hidden">
                    {student.photo_url ? (
                      <img 
                        src={getDirectPhotoUrl(student.photo_url)} 
                        alt="Photo" 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex flex-col items-center">
                        <User className="w-10 h-10 text-slate-300" />
                        <span className="text-[8px] font-bold text-slate-400 mt-1">ছবি</span>
                      </div>
                    )}
                  </div>

                  {/* Student Attributes */}
                  <div className="flex-1 space-y-2 text-xs">
                    <div className="flex border-b border-dashed border-slate-300 pb-1">
                      <span className="font-bold text-slate-600 w-28">ছাত্রের নাম:</span>
                      <span className="font-black text-slate-950 text-sm">{student.first_name} {student.last_name}</span>
                    </div>
                    <div className="flex border-b border-dashed border-slate-300 pb-1">
                      <span className="font-bold text-slate-600 w-28">শ্রেণি / জামাত:</span>
                      <span className="font-black text-slate-900">{selectedClassName}</span>
                    </div>
                    <div className="flex border-b border-dashed border-slate-300 pb-1">
                      <span className="font-bold text-slate-600 w-28">রোল নম্বর:</span>
                      <span className="font-black text-blue-900">{toBanglaNumber(student.roll_number || '১')}</span>
                    </div>
                    <div className="flex border-b border-dashed border-slate-300 pb-1">
                      <span className="font-bold text-slate-600 w-28">মোবাইল / অভিভাবক:</span>
                      <span className="font-bold text-slate-800">{toBanglaNumber(student.parent_phone || student.phone || 'N/A')}</span>
                    </div>
                  </div>
                </div>

                {/* Signatures */}
                <div className="flex justify-between items-end pt-3 border-t border-slate-200 mt-auto">
                  <div className="w-36 text-center">
                    <div className="border-t-2 border-slate-900 pt-1 text-[10px] font-bold text-slate-900">
                      শ্রেণী শিক্ষকের স্বাক্ষর
                    </div>
                  </div>

                  <div className="w-36 text-center">
                    <div className="border-t-2 border-slate-900 pt-1 text-[10px] font-bold text-slate-900">
                      পরীক্ষা নিয়ন্ত্রক
                    </div>
                  </div>

                  <div className="w-36 text-center">
                    {principalSignUrl ? (
                      <div className="h-7 flex items-center justify-center mb-0.5">
                        <img 
                          src={principalSignUrl} 
                          alt="Principal Signature" 
                          className="max-h-full max-w-[90px] object-contain"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ) : (
                      <div className="h-5"></div>
                    )}
                    <div className="border-t-2 border-slate-900 pt-1 text-[10px] font-bold text-slate-900">
                      {principalName}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
