"use client";

import { useState, useEffect } from "react";
import { getStudentReportCard } from "@/app/actions/exams";
import { FileText, Trophy, Printer } from "lucide-react";
import { getMadrasaProfileWithLogo } from "@/app/actions/tenant";
import PrintLetterpad from "@/app/components/PrintLetterpad";
import ExamPublishToggle from "@/app/dashboard/exams/ExamPublishToggle";
import { toBanglaNumber } from "@/lib/numberToBangla";

export default function MeritListClient({ 
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
  const [topCount, setTopCount] = useState<number>(10);
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
    
    // Sort by percentage descending, then total marks, then total max
    const sortedData = data.sort((a, b) => {
      if (b.percentage !== a.percentage) {
        return Number(b.percentage) - Number(a.percentage);
      }
      return Number(b.totalObtained) - Number(a.totalObtained);
    });

    setResults(sortedData);
    setLoading(false);
  };

  const handlePrint = () => {
    window.print();
  };
  
  const selectedClassName = classes.find(c => c.id === classId)?.name || '';
  const filteredResults = results.slice(0, topCount);

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

      <div className="flex flex-col sm:flex-row gap-4 items-end bg-slate-50 p-4 rounded-xl border border-slate-200/80 print:hidden shadow-sm">
        <div className="w-full sm:w-1/4">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            জামাত / ক্লাস (ঐচ্ছিক)
          </label>
          <select 
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 transition bg-white text-sm font-medium text-slate-800"
          >
            <option value="">সব ক্লাস (সম্মিলিত)</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="w-full sm:w-1/4">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            কতজনের তালিকা?
          </label>
          <select 
            value={topCount}
            onChange={(e) => setTopCount(Number(e.target.value))}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 transition bg-white text-sm font-medium text-slate-800"
          >
            <option value={5}>শীর্ষ ৫ জন</option>
            <option value={10}>শীর্ষ ১০ জন</option>
            <option value={20}>শীর্ষ ২০ জন</option>
            <option value={50}>শীর্ষ ৫০ জন</option>
            <option value={100}>শীর্ষ ১০০ জন</option>
          </select>
        </div>
        <div className="w-full sm:w-auto flex space-x-3">
          <button 
            onClick={loadResults}
            disabled={loading}
            className="px-5 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 disabled:opacity-50 transition text-sm font-bold shadow-sm cursor-pointer"
          >
            {loading ? "তৈরি হচ্ছে..." : "মেধাতালিকা দেখুন"}
          </button>
          
          <button 
            onClick={handlePrint}
            disabled={filteredResults.length === 0}
            className="flex items-center space-x-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 transition font-bold text-sm disabled:opacity-50 bg-white shadow-sm cursor-pointer"
          >
            <Printer className="w-4 h-4 text-emerald-700" />
            <span>প্রিন্ট / PDF</span>
          </button>
        </div>
      </div>

      <PrintLetterpad 
        madrasaInfo={profileAndLogo?.madrasa || madrasaInfo} 
        logoUrl={profileAndLogo?.logoUrl}
        title={`মেধাতালিকা - ${examTitle}`}
        defaultOrientation="portrait"
      >
        <div className="mb-4 text-center border-b border-slate-200 pb-2.5">
          <h2 className="text-lg sm:text-xl print:text-base font-bold text-slate-900 leading-tight">
            {examTitle} - {toBanglaNumber(examYear)}
          </h2>
          <h3 className="text-sm sm:text-base print:text-xs font-bold text-emerald-800 mt-0.5 flex items-center justify-center space-x-2">
            <span>পরীক্ষার অফিসিয়াল মেধাতালিকা (শীর্ষ {toBanglaNumber(topCount)} জন)</span>
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

        {filteredResults.length > 0 && (
          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full text-center border-collapse border border-slate-500 print:border-slate-700 text-xs print:text-[11px] leading-tight">
              <thead className="bg-slate-100 print:bg-slate-100 text-slate-800 font-bold border-b border-slate-500 print:border-slate-700">
                <tr>
                  <th className="px-2 py-2 print:px-1.5 print:py-1.5 border border-slate-400 print:border-slate-600 text-center w-14">
                    মেধা স্থান
                  </th>
                  <th className="px-2 py-2 print:px-1.5 print:py-1.5 border border-slate-400 print:border-slate-600 text-left min-w-[120px]">
                    শিক্ষার্থীর নাম
                  </th>
                  <th className="px-2 py-2 print:px-1.5 print:py-1.5 border border-slate-400 print:border-slate-600 w-14">
                    রোল
                  </th>
                  {!classId && (
                    <th className="px-2 py-2 print:px-1.5 print:py-1.5 border border-slate-400 print:border-slate-600">
                      জামাত
                    </th>
                  )}
                  <th className="px-2 py-2 print:px-1.5 print:py-1.5 border border-slate-400 print:border-slate-600 text-center">
                    সর্বমোট নম্বর
                  </th>
                  <th className="px-2 py-2 print:px-1.5 print:py-1.5 border border-slate-400 print:border-slate-600 text-center font-bold">
                    প্রাপ্ত নম্বর
                  </th>
                  <th className="px-2 py-2 print:px-1.5 print:py-1.5 border border-slate-400 print:border-slate-600 text-center">
                    শতকরা
                  </th>
                  <th className="px-2 py-2 print:px-1.5 print:py-1.5 border border-slate-400 print:border-slate-600 text-center">
                    জিপিএ
                  </th>
                  <th className="px-2 py-2 print:px-1.5 print:py-1.5 border border-slate-400 print:border-slate-600 text-center">
                    বিভাগ
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300 text-slate-800">
                {filteredResults.map((student, index) => {
                  const isFirst = index === 0;
                  const isSecond = index === 1;
                  const isThird = index === 2;
                  
                  let positionStyle = "text-slate-900";
                  if (isFirst) positionStyle = "text-amber-600 font-extrabold";
                  else if (isSecond) positionStyle = "text-slate-600 font-extrabold";
                  else if (isThird) positionStyle = "text-amber-800 font-extrabold";

                  const gpaVal = student.percentage >= 80 ? '৫.০০' :
                    student.percentage >= 70 ? '৪.০০' :
                    student.percentage >= 60 ? '৩.৫০' :
                    student.percentage >= 50 ? '৩.০০' :
                    student.percentage >= 40 ? '২.০০' :
                    student.percentage >= 33 ? '১.০০' : '০.০০';
                  
                  return (
                    <tr key={student.id} className="hover:bg-slate-50/70 transition print:hover:bg-transparent print:break-inside-avoid">
                      <td className={`px-2 py-1.5 print:px-1.5 print:py-1 text-center font-bold ${positionStyle} border border-slate-300 print:border-slate-500`}>
                        <div className="flex items-center justify-center space-x-1">
                          {index < 3 && <Trophy className="w-3.5 h-3.5 text-amber-500 print:hidden" />}
                          <span>{toBanglaNumber(index + 1)}</span>
                        </div>
                      </td>
                      <td className="px-2 py-1.5 print:px-1.5 print:py-1 font-bold text-slate-900 text-left border border-slate-300 print:border-slate-500">
                        {student.first_name} {student.last_name || ''}
                      </td>
                      <td className="px-2 py-1.5 print:px-1.5 print:py-1 font-medium border border-slate-300 print:border-slate-500">
                        {student.roll_number ? toBanglaNumber(student.roll_number) : '-'}
                      </td>
                      {!classId && (
                        <td className="px-2 py-1.5 print:px-1.5 print:py-1 border border-slate-300 print:border-slate-500">
                          {student.class_name}
                        </td>
                      )}
                      <td className="px-2 py-1.5 print:px-1.5 print:py-1 text-center border border-slate-300 print:border-slate-500">
                        {toBanglaNumber(student.totalMax)}
                      </td>
                      <td className="px-2 py-1.5 print:px-1.5 print:py-1 text-center font-bold text-emerald-800 print:text-black border border-slate-300 print:border-slate-500">
                        {toBanglaNumber(student.totalObtained)}
                      </td>
                      <td className="px-2 py-1.5 print:px-1.5 print:py-1 text-center font-medium border border-slate-300 print:border-slate-500">
                        {toBanglaNumber(student.percentage)}%
                      </td>
                      <td className="px-2 py-1.5 print:px-1.5 print:py-1 text-center font-bold text-slate-800 print:text-black border border-slate-300 print:border-slate-500">
                        {gpaVal}
                      </td>
                      <td className="px-2 py-1.5 print:px-1.5 print:py-1 text-center border border-slate-300 print:border-slate-500">
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
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Official Signatures for Merit List */}
            <div className="mt-8 pt-6 border-t border-slate-200 hidden print:grid grid-cols-3 gap-4 text-center text-[10px] text-slate-700">
              <div>
                <div className="border-t border-slate-400 mx-auto w-32 pt-1"></div>
                <p className="font-bold">যাচাইকারী</p>
              </div>
              <div>
                <div className="border-t border-slate-400 mx-auto w-32 pt-1"></div>
                <p className="font-bold">পরীক্ষা নিয়ন্ত্রক</p>
              </div>
              <div>
                <div className="border-t border-slate-400 mx-auto w-32 pt-1"></div>
                <p className="font-bold">মুহতামিম / অধ্যক্ষ</p>
              </div>
            </div>
          </div>
        )}
      </PrintLetterpad>
      
      {!loading && filteredResults.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          {classId === "" ? "মেধাতালিকা দেখতে 'মেধাতালিকা দেখুন' বাটনে চাপ দিন।" : "কোনো ফলাফল পাওয়া যায়নি।"}
        </div>
      )}
    </div>
  );
}
