"use client";

import { useState, useEffect } from "react";
import { getStudentReportCard } from "@/app/actions/exams";
import { FileText, Printer, CheckCircle2 } from "lucide-react";
import { getMadrasaProfileWithLogo } from "@/app/actions/tenant";
import PrintLetterpad from "@/app/components/PrintLetterpad";
import ExamPublishToggle from "@/app/dashboard/exams/ExamPublishToggle";
import { toBanglaNumber } from "@/lib/numberToBangla";

export default function ExamResultsClient({ 
  examId, 
  classes, 
  examTitle, 
  examYear,
  madrasaInfo,
  initialPublished = false,
  publishedAt,
  publishedBy,
  publishNote
}: { 
  examId: string, 
  classes: { id: string, name: string }[],
  examTitle: string,
  examYear: string,
  madrasaInfo?: any,
  initialPublished?: boolean,
  publishedAt?: string | null,
  publishedBy?: string | null,
  publishNote?: string | null
}) {
  const [classId, setClassId] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
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

  const loadResults = async () => {
    setLoading(true);
    const data = await getStudentReportCard(examId, classId || undefined);
    // Sort by percentage descending
    const sortedData = data.sort((a, b) => Number(b.percentage) - Number(a.percentage));
    setResults(sortedData);
    setLoading(false);
  };

  const handlePrint = () => {
    window.print();
  };
  
  const selectedClassName = classes.find(c => c.id === classId)?.name || '';

  // Extract all unique subjects
  const allSubjects = new Set<string>();
  results.forEach(student => {
    student.marks?.forEach((m: any) => {
      if (m.subject_name) allSubjects.add(m.subject_name);
    });
  });
  const subjectList = Array.from(allSubjects);

  return (
    <div className="space-y-6">
      {/* Result Publication Status & Controls */}
      <ExamPublishToggle
        examId={examId}
        initialPublished={initialPublished}
        publishedAt={publishedAt}
        publishedBy={publishedBy}
        publishNote={publishNote}
      />

      {/* Screen Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-end bg-slate-50 p-4 rounded-xl border border-slate-200/80 print:hidden shadow-sm">
        <div className="w-full sm:w-1/3">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            জামাত / ক্লাস নির্বাচন (ঐচ্ছিক)
          </label>
          <select 
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 transition bg-white font-medium text-slate-800"
          >
            <option value="">সব ক্লাস (সম্মিলিত ফলাফল)</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="w-full sm:w-auto flex space-x-3">
          <button 
            onClick={loadResults}
            disabled={loading}
            className="px-5 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 disabled:opacity-50 transition text-sm font-bold shadow-sm cursor-pointer"
          >
            {loading ? "ফলাফল লোড হচ্ছে..." : "ফলাফল দেখুন"}
          </button>
          
          <button 
            onClick={handlePrint}
            disabled={results.length === 0}
            className="flex items-center space-x-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 transition font-bold text-sm disabled:opacity-50 bg-white shadow-sm cursor-pointer"
          >
            <Printer className="w-4 h-4 text-emerald-700" />
            <span>প্রিন্ট / PDF</span>
          </button>
        </div>
      </div>

      {/* Official Print Sheet with Letterpad */}
      <PrintLetterpad 
        madrasaInfo={profileAndLogo?.madrasa || madrasaInfo} 
        logoUrl={profileAndLogo?.logoUrl}
        title={`পরীক্ষার ফলাফল - ${examTitle}`}
        defaultOrientation="landscape"
      >
        <div className="mb-4 text-center border-b border-slate-200 pb-2.5">
          <h2 className="text-lg sm:text-xl print:text-base font-bold text-slate-900 leading-tight">
            {examTitle} - {toBanglaNumber(examYear)}
          </h2>
          <h3 className="text-sm sm:text-base print:text-xs font-bold text-emerald-800 mt-0.5">
            পরীক্ষার সমন্বিত ফলাফল ও মার্কশিট তালিকা (Tabulation Sheet)
          </h3>
          {selectedClassName ? (
            <p className="text-slate-700 font-bold text-xs print:text-[10px] mt-1 bg-slate-100 inline-block px-3 py-0.5 rounded-full border border-slate-200">
              শ্রেণী: {selectedClassName}
            </p>
          ) : (
            <p className="text-slate-500 font-semibold text-xs print:text-[10px] mt-1">
              (সকল জামাত)
            </p>
          )}
        </div>

        {results.length > 0 ? (
          <div className="w-full overflow-x-auto print:overflow-visible">
            <table className="w-full text-center border-collapse border border-slate-500 print:border-slate-700 text-xs print:text-[10px] leading-tight">
              <thead className="bg-slate-100 print:bg-slate-100 text-slate-800 font-bold border-b border-slate-500 print:border-slate-700">
                <tr>
                  <th className="px-1.5 py-1.5 print:px-1 print:py-1 border border-slate-400 print:border-slate-600 w-10 shrink-0">
                    মেধা<br />স্থান
                  </th>
                  <th className="px-1.5 py-1.5 print:px-1 print:py-1 border border-slate-400 print:border-slate-600 w-10 shrink-0">
                    রোল
                  </th>
                  <th className="px-2 py-1.5 print:px-1.5 print:py-1 border border-slate-400 print:border-slate-600 text-left min-w-[110px]">
                    শিক্ষার্থীর নাম
                  </th>
                  {!classId && (
                    <th className="px-1.5 py-1.5 print:px-1 print:py-1 border border-slate-400 print:border-slate-600 min-w-[60px]">
                      জামাত
                    </th>
                  )}
                  {subjectList.map(sub => (
                    <th key={sub} className="px-1.5 py-1.5 print:px-1 print:py-1 border border-slate-400 print:border-slate-600 text-center font-semibold">
                      {sub}
                    </th>
                  ))}
                  <th className="px-1.5 py-1.5 print:px-1 print:py-1 border border-slate-400 print:border-slate-600 text-center font-bold min-w-[60px]">
                    মোট প্রাপ্ত
                  </th>
                  <th className="px-1.5 py-1.5 print:px-1 print:py-1 border border-slate-400 print:border-slate-600 text-center font-bold min-w-[45px]">
                    শতকরা
                  </th>
                  <th className="px-1.5 py-1.5 print:px-1 print:py-1 border border-slate-400 print:border-slate-600 text-center font-bold min-w-[55px]">
                    বিভাগ
                  </th>
                  <th className="px-1.5 py-1.5 print:px-1 print:py-1 border border-slate-400 print:border-slate-600 text-center font-bold min-w-[45px]">
                    জিপিএ
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300 text-slate-800">
                {results.map((student, index) => {
                  const gpaVal = student.percentage >= 80 ? '৫.০০' :
                    student.percentage >= 70 ? '৪.০০' :
                    student.percentage >= 60 ? '৩.৫০' :
                    student.percentage >= 50 ? '৩.০০' :
                    student.percentage >= 40 ? '২.০০' :
                    student.percentage >= 33 ? '১.০০' : '০.০০';

                  return (
                    <tr key={student.id} className="hover:bg-slate-50/70 transition print:hover:bg-transparent print:break-inside-avoid">
                      <td className="px-1.5 py-1.5 print:px-1 print:py-1 font-bold text-slate-900 border border-slate-300 print:border-slate-500">
                        {toBanglaNumber(index + 1)}
                      </td>
                      <td className="px-1.5 py-1.5 print:px-1 print:py-1 font-medium border border-slate-300 print:border-slate-500">
                        {student.roll_number ? toBanglaNumber(student.roll_number) : '-'}
                      </td>
                      <td className="px-2 py-1.5 print:px-1.5 print:py-1 font-bold text-slate-900 text-left border border-slate-300 print:border-slate-500">
                        {student.first_name} {student.last_name || ''}
                      </td>
                      {!classId && (
                        <td className="px-1.5 py-1.5 print:px-1 print:py-1 border border-slate-300 print:border-slate-500">
                          {student.class_name}
                        </td>
                      )}
                      {subjectList.map(sub => {
                        const markObj = student.marks?.find((m: any) => m.subject_name === sub);
                        const markVal = markObj ? markObj.marks_obtained : null;
                        return (
                          <td key={sub} className="px-1.5 py-1.5 print:px-1 print:py-1 text-center font-medium border border-slate-300 print:border-slate-500">
                            {markVal !== null && markVal !== undefined ? toBanglaNumber(markVal) : '-'}
                          </td>
                        );
                      })}
                      <td className="px-1.5 py-1.5 print:px-1 print:py-1 text-center font-bold text-slate-900 border border-slate-300 print:border-slate-500">
                        {toBanglaNumber(student.totalObtained)} <span className="text-[10px] text-slate-500 font-normal">/ {toBanglaNumber(student.totalMax)}</span>
                      </td>
                      <td className="px-1.5 py-1.5 print:px-1 print:py-1 text-center font-semibold border border-slate-300 print:border-slate-500">
                        {toBanglaNumber(student.percentage)}%
                      </td>
                      <td className="px-1.5 py-1.5 print:px-1 print:py-1 text-center font-bold border border-slate-300 print:border-slate-500">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] print:text-[10px] print:p-0 print:border-none print:text-black ${
                          student.percentage >= 80 ? 'bg-emerald-100 text-emerald-800' :
                          student.percentage >= 60 ? 'bg-blue-100 text-blue-800' :
                          student.percentage >= 45 ? 'bg-amber-100 text-amber-800' :
                          student.percentage >= 33 ? 'bg-slate-100 text-slate-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {student.grade}
                        </span>
                      </td>
                      <td className="px-1.5 py-1.5 print:px-1 print:py-1 text-center font-bold text-emerald-800 print:text-black border border-slate-300 print:border-slate-500">
                        {gpaVal}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Official Signatures for Tabulation Sheet */}
            <div className="mt-8 pt-6 border-t border-slate-200 hidden print:grid grid-cols-4 gap-4 text-center text-[10px] text-slate-700">
              <div>
                <div className="border-t border-slate-400 mx-auto w-28 pt-1"></div>
                <p className="font-bold">প্রস্তুতকারক</p>
              </div>
              <div>
                <div className="border-t border-slate-400 mx-auto w-28 pt-1"></div>
                <p className="font-bold">যাচাইকারী</p>
              </div>
              <div>
                <div className="border-t border-slate-400 mx-auto w-28 pt-1"></div>
                <p className="font-bold">পরীক্ষা নিয়ন্ত্রক</p>
              </div>
              <div>
                <div className="border-t border-slate-400 mx-auto w-28 pt-1"></div>
                <p className="font-bold">মুহতামিম / অধ্যক্ষ</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-slate-500">
            {classId === "" ? "ফলাফল দেখতে ক্লাস নির্বাচন করে 'ফলাফল দেখুন' বাটনে চাপ দিন।" : "এই শ্রেণীর জন্য কোনো ফলাফল পাওয়া যায়নি।"}
          </div>
        )}
      </PrintLetterpad>
    </div>
  );
}
