"use client";

import { useState, useEffect } from "react";
import { getStudentReportCard } from "@/app/actions/exams";
import { FileText, Printer, Type } from "lucide-react";
import { getMadrasaProfileWithLogo } from "@/app/actions/tenant";
import PrintLetterpad from "@/app/components/PrintLetterpad";

export default function ReportCardsClient({ 
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
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [profileAndLogo, setProfileAndLogo] = useState<any>(null);
  const [banglaFont, setBanglaFont] = useState("font-solaiman");

  useEffect(() => {
    async function load() {
      const res = await getMadrasaProfileWithLogo();
      if (res) {
        setProfileAndLogo(res);
      }
    }
    load();
  }, []);

  const loadResults = async () => {
    if (!classId) return;
    setLoading(true);
    const data = await getStudentReportCard(examId, classId);
    // Sort by percentage descending to figure out merit position
    const sortedData = data.sort((a, b) => Number(b.percentage) - Number(a.percentage));
    setResults(sortedData);
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
        <div className="w-full sm:w-auto flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-md px-2 py-1.5 shadow-xs">
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
            onClick={loadResults}
            disabled={loading || !classId}
            className="px-4 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800 disabled:opacity-50 transition text-sm font-medium"
          >
            {loading ? "তৈরি হচ্ছে..." : "মার্কশিট তৈরি করুন"}
          </button>
          
          <button 
            onClick={handlePrint}
            disabled={results.length === 0}
            className="flex items-center space-x-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 transition font-medium text-sm disabled:opacity-50 bg-white"
          >
            <Printer className="w-4 h-4" />
            <span>প্রিন্ট করুন</span>
          </button>
        </div>
      </div>

      {!loading && results.length === 0 && classId !== "" && (
        <div className="text-center py-12 text-slate-500 print:hidden">
          ফলাফল পেতে প্রথমে 'মার্কশিট তৈরি করুন' বাটনে ক্লিক করুন।
        </div>
      )}

      {/* Print View: One report card per page */}
      <div className={`hidden print:block print:w-full ${banglaFont}`}>
        {results.map((student, index) => (
          <div key={student.id} className="marksheet-page-item print:w-full print:break-inside-avoid print:break-after-page last:print:break-after-auto">
            <PrintLetterpad madrasaInfo={profileAndLogo?.madrasa || madrasaInfo} logoUrl={profileAndLogo?.logoUrl}>
              <div className="border-2 border-slate-800 p-4 rounded-xl relative bg-white print:break-inside-avoid">
                {/* Header */}
                <div className="text-center border-b border-slate-800 pb-2 mb-3 relative">
                  <div className="inline-block bg-slate-800 text-white px-5 py-1 rounded-full font-bold text-sm uppercase tracking-wider">
                    প্রোগ্রেস রিপোর্ট / মার্কশিট
                  </div>
                  
                  <p className="text-slate-800 font-bold text-sm mt-1.5">{examTitle} - {examYear}</p>
                </div>

                {/* Student Info */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 mb-3 text-xs sm:text-sm">
                  <div className="flex border-b border-dashed border-slate-300 pb-0.5">
                    <span className="font-bold text-slate-700 w-24">ছাত্রের নাম:</span>
                    <span className="font-black text-slate-900 flex-1">{student.first_name} {student.last_name}</span>
                  </div>
                  <div className="flex border-b border-dashed border-slate-300 pb-0.5">
                    <span className="font-bold text-slate-700 w-24">ক্লাস:</span>
                    <span className="font-black text-slate-900 flex-1">{student.class_name}</span>
                  </div>
                  <div className="flex border-b border-dashed border-slate-300 pb-0.5">
                    <span className="font-bold text-slate-700 w-24">রোল নম্বর:</span>
                    <span className="font-black text-slate-900 flex-1">{student.roll_number || 'N/A'}</span>
                  </div>
                  <div className="flex border-b border-dashed border-slate-300 pb-0.5">
                    <span className="font-bold text-slate-700 w-24">মেধাস্থান:</span>
                    <span className="font-black text-slate-900 flex-1">{index + 1}</span>
                  </div>
                </div>

                {/* Marks Table */}
                <table className="w-full text-left border-collapse mb-3 text-xs">
                  <thead>
                    <tr>
                      <th className="border border-slate-800 px-3 py-1.5 bg-slate-100 font-bold text-slate-950 text-center w-12">ক্র.নং</th>
                      <th className="border border-slate-800 px-3 py-1.5 bg-slate-100 font-bold text-slate-950">বিষয়ের নাম</th>
                      <th className="border border-slate-800 px-3 py-1.5 bg-slate-100 font-bold text-slate-950 text-center w-24">পূর্ণ নম্বর</th>
                      <th className="border border-slate-800 px-3 py-1.5 bg-slate-100 font-bold text-slate-950 text-center w-24">প্রাপ্ত নম্বর</th>
                    </tr>
                  </thead>
                  <tbody>
                    {student.marks?.map((markRow: any, i: number) => (
                      <tr key={i}>
                        <td className="border border-slate-800 px-3 py-1 text-center text-slate-800 font-medium">{i + 1}</td>
                        <td className="border border-slate-800 px-3 py-1 font-bold text-slate-950">{markRow.subject_name}</td>
                        <td className="border border-slate-800 px-3 py-1 text-center text-slate-800">{markRow.total_marks}</td>
                        <td className="border border-slate-800 px-3 py-1 text-center font-bold text-slate-950">{markRow.marks_obtained}</td>
                      </tr>
                    ))}
                    {/* Total Row */}
                    <tr className="bg-slate-50">
                      <td colSpan={2} className="border border-slate-800 px-3 py-1.5 text-right font-black text-slate-950 uppercase">সর্বমোট:</td>
                      <td className="border border-slate-800 px-3 py-1.5 text-center font-black text-slate-950">{student.totalMax}</td>
                      <td className="border border-slate-800 px-3 py-1.5 text-center font-black text-slate-950 text-base">{student.totalObtained}</td>
                    </tr>
                  </tbody>
                </table>

                {/* Final Grade / Result */}
                <div className="flex justify-between items-center bg-slate-50 border border-slate-800 p-2.5 rounded-lg mb-4 text-xs sm:text-sm">
                  <div>
                    <span className="font-bold text-slate-800">প্রাপ্ত বিভাগ (Grade): </span>
                    <span className="font-black text-slate-950 text-base ml-1">{student.grade}</span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-800">শতকরা (Percentage): </span>
                    <span className="font-black text-slate-950 text-base ml-1">{student.percentage}%</span>
                  </div>
                </div>

                {/* Signatures */}
                <div className="flex justify-between items-end mt-4 pt-2">
                  <div className="text-center w-36 border-t border-slate-800 pt-1">
                    <p className="font-bold text-slate-900 text-[11px]">শ্রেণী শিক্ষকের স্বাক্ষর</p>
                  </div>
                  <div className="text-center w-36 border-t border-slate-800 pt-1">
                    <p className="font-bold text-slate-900 text-[11px]">পরীক্ষা নিয়ন্ত্রক</p>
                  </div>
                  <div className="text-center w-36">
                    {profileAndLogo?.signatureUrl && (
                      <div className="h-7 flex items-center justify-center mb-0.5">
                        <img 
                          src={profileAndLogo.signatureUrl} 
                          alt="Principal Signature" 
                          className="max-h-full max-w-[100px] object-contain"
                        />
                      </div>
                    )}
                    <div className="border-t border-slate-800 pt-1">
                      <p className="font-bold text-slate-900 text-[11px]">
                        {profileAndLogo?.principalName || "মুহতামিম / প্রিন্সিপাল"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </PrintLetterpad>
          </div>
        ))}
      </div>

      {/* Screen Preview */}
      {results.length > 0 && (
        <div className="print:hidden space-y-4">
          <p className="text-sm text-slate-500 font-medium mb-4">মোট {results.length} জন ছাত্রের মার্কশিট তৈরি হয়েছে। প্রিন্ট করতে উপরের 'প্রিন্ট করুন' বাটনে ক্লিক করুন।</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {results.map((student, index) => (
              <div key={student.id} className="bg-white border p-4 rounded-lg shadow-sm hover:shadow-md transition">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-slate-900 truncate" title={`${student.first_name} ${student.last_name}`}>
                    {student.first_name} {student.last_name}
                  </h3>
                  <span className="bg-slate-100 text-slate-800 text-xs px-2 py-1 rounded font-bold">
                    রোল: {student.roll_number || '-'}
                  </span>
                </div>
                <div className="text-sm text-slate-600 space-y-1 mb-4 border-b pb-3">
                  <p>মেধাস্থান: <span className="font-bold text-slate-900">{index + 1}</span></p>
                  <p>বিভাগ: <span className="font-bold text-slate-900">{student.grade}</span></p>
                  <p>মোট নম্বর: <span className="font-bold text-slate-900">{student.totalObtained} / {student.totalMax}</span></p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-500 uppercase">বিষয়ভিত্তিক নম্বর:</p>
                  {student.marks?.map((m: any, i: number) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-slate-700 truncate w-24" title={m.subject_name}>{m.subject_name}</span>
                      <span className="font-medium">{m.marks_obtained}/{m.total_marks}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
