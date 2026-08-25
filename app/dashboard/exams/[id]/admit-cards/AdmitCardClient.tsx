"use client";

import { useState } from "react";
import { getStudentsByClass } from "@/app/actions/exams";
import { Printer, User } from "lucide-react";

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

export default function AdmitCardClient({ 
   examId, 
   classes, 
   examTitle, 
   examYear,
   madrasaInfo
 }: { 
   examId: string, 
   classes: { id: string, name: string }[],
  examTitle: string,
  examYear: string,
  madrasaInfo: any
}) {
  const [classId, setClassId] = useState("");
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row gap-4 items-end bg-slate-50 p-4 rounded-lg border border-slate-100 print:hidden">
        <div className="w-full sm:w-1/3">
          <label className="block text-sm font-medium text-slate-700 mb-1">ক্লাস নির্বাচন করুন</label>
          <select 
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 transition bg-white"
          >
            <option value="">ক্লাস নির্বাচন করুন...</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="w-full sm:w-auto flex space-x-3">
          <button 
            onClick={loadStudents}
            disabled={loading || !classId}
            className="px-4 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800 disabled:opacity-50 transition text-sm font-medium"
          >
            {loading ? "তৈরি হচ্ছে..." : "প্রবেশপত্র তৈরি করুন"}
          </button>
          
          <button 
            onClick={handlePrint}
            disabled={students.length === 0}
            className="flex items-center space-x-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 transition font-medium text-sm disabled:opacity-50 bg-white"
          >
            <Printer className="w-4 h-4" />
            <span>প্রিন্ট করুন</span>
          </button>
        </div>
      </div>

      {!loading && students.length === 0 && classId !== "" && (
        <div className="text-center py-12 text-slate-500 print:hidden">
          প্রবেশপত্র পেতে প্রথমে 'প্রবেশপত্র তৈরি করুন' বাটনে ক্লিক করুন।
        </div>
      )}

      {/* Screen Preview */}
      {students.length > 0 && (
        <div className="print:hidden space-y-4">
          <p className="text-sm text-slate-500 font-medium mb-4">মোট {students.length} জন ছাত্রের প্রবেশপত্র তৈরি হয়েছে। প্রিন্ট করতে উপরের 'প্রিন্ট করুন' বাটনে ক্লিক করুন।</p>
        </div>
      )}

      {/* Print View: Grid layout for admit cards */}
      <div className="hidden print:block print:w-full space-y-12">
        <div className="grid grid-cols-1 gap-12">
          {students.map((student, index) => (
            <div key={student.id} className="border-4 border-slate-800 p-8 rounded-xl break-inside-avoid relative h-[45vh] flex flex-col bg-white">
              {/* Header */}
              <div className="text-center border-b-2 border-slate-800 pb-4 mb-6">
                <h2 className="text-3xl font-bold text-slate-900">{madrasaInfo?.name || 'Qawmi Madrasa'}</h2>
                <p className="text-slate-700 font-medium text-lg mt-1">{madrasaInfo?.address || ''}</p>
                
                <div className="mt-4 inline-block bg-slate-800 text-white px-6 py-1.5 rounded-full font-bold tracking-wider uppercase text-lg">
                  প্রবেশপত্র (Admit Card)
                </div>
                
                <p className="text-slate-900 font-bold text-xl mt-3">{examTitle} - {examYear}</p>
              </div>

              {/* Body */}
              <div className="flex-1 flex gap-8">
                {/* Photo Placeholder */}
                <div className="w-32 h-32 border-2 border-slate-400 rounded-md flex items-center justify-center bg-slate-50 relative flex-shrink-0 mt-2 overflow-hidden">
                  {student.photo_url ? (
                    <img 
                      src={getDirectPhotoUrl(student.photo_url)} 
                      alt="Photo" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <>
                      <User className="w-12 h-12 text-slate-300" />
                      <span className="absolute bottom-2 text-xs font-bold text-slate-400">ছবি</span>
                    </>
                  )}
                </div>

                {/* Details */}
                <div className="flex-1 space-y-4 text-xl mt-2">
                  <div className="flex border-b border-dotted border-slate-400 pb-2">
                    <span className="font-semibold text-slate-700 w-36">ছাত্রের নাম:</span>
                    <span className="font-bold text-slate-900">{student.first_name} {student.last_name}</span>
                  </div>
                  <div className="flex border-b border-dotted border-slate-400 pb-2">
                    <span className="font-semibold text-slate-700 w-36">ক্লাস:</span>
                    <span className="font-bold text-slate-900">{selectedClassName}</span>
                  </div>
                  <div className="flex border-b border-dotted border-slate-400 pb-2">
                    <span className="font-semibold text-slate-700 w-36">রোল নম্বর:</span>
                    <span className="font-bold text-slate-900">{student.roll_number || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Signatures */}
              <div className="flex justify-between items-end mt-auto pt-6">
                <div className="w-48 text-center border-t-2 border-slate-800 pt-2 text-lg font-bold text-slate-900">
                  শ্রেণী শিক্ষকের স্বাক্ষর
                </div>
                <div className="w-48 text-center border-t-2 border-slate-800 pt-2 text-lg font-bold text-slate-900">
                  মুহতামিম / প্রিন্সিপাল
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
