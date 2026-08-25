"use client";

import { useState, useEffect } from "react";
import { getStudentReportCard } from "@/app/actions/exams";
import { FileText, Trophy } from "lucide-react";
import { getMadrasaProfileWithLogo } from "@/app/actions/tenant";
import PrintLetterpad from "@/app/components/PrintLetterpad";

export default function MeritListClient({ 
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
  madrasaInfo?: any
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
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { size: portrait; margin: 1cm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}} />
      <div className="flex flex-col sm:flex-row gap-4 items-end bg-indigo-50 p-4 rounded-lg border border-indigo-100 print:hidden">
        <div className="w-full sm:w-1/4">
          <label className="block text-sm font-medium text-indigo-900 mb-1">ক্লাস (ঐচ্ছিক)</label>
          <select 
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="w-full px-3 py-2 border border-indigo-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition bg-white"
          >
            <option value="">সব ক্লাস</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="w-full sm:w-1/4">
          <label className="block text-sm font-medium text-indigo-900 mb-1">কতজনের তালিকা?</label>
          <select 
            value={topCount}
            onChange={(e) => setTopCount(Number(e.target.value))}
            className="w-full px-3 py-2 border border-indigo-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition bg-white"
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
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 transition text-sm font-medium"
          >
            {loading ? "খুঁজছি..." : "তালিকা তৈরি করুন"}
          </button>
          
          <button 
            onClick={handlePrint}
            disabled={filteredResults.length === 0}
            className="flex items-center space-x-2 px-4 py-2 border border-indigo-300 text-indigo-700 rounded-md hover:bg-indigo-100 transition font-medium text-sm disabled:opacity-50 bg-white"
          >
            <FileText className="w-4 h-4" />
            <span>প্রিন্ট</span>
          </button>
        </div>
      </div>

      <PrintLetterpad madrasaInfo={profileAndLogo?.madrasa || madrasaInfo} logoUrl={profileAndLogo?.logoUrl}>
        <div className="mb-6 text-center border-b border-slate-100 pb-4">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800">{examTitle} - {examYear}</h2>
          <h3 className="text-base sm:text-lg font-bold text-indigo-700 mt-1 flex items-center justify-center space-x-2">
            <span>মেধাতালিকা (শীর্ষ {topCount} জন)</span>
          </h3>
          {selectedClassName && <p className="text-slate-500 font-semibold text-xs mt-1.5 bg-slate-50 inline-block px-3 py-1 rounded-full border border-slate-100">শ্রেণী: {selectedClassName}</p>}
        </div>

        {filteredResults.length > 0 && (
          <div className="overflow-x-auto border rounded-xl print:border-none print:rounded-none">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-indigo-50 text-indigo-900 font-medium border-b print:bg-slate-100 print:border-b-2 print:border-slate-800">
                <tr>
                  <th className="px-4 py-3 text-center print:border print:border-slate-300 w-24">মেধা স্থান</th>
                  <th className="px-4 py-3 print:border print:border-slate-300">শিক্ষার্থীর নাম</th>
                  <th className="px-4 py-3 print:border print:border-slate-300">রোল</th>
                  {!classId && <th className="px-4 py-3 print:border print:border-slate-300">ক্লাস</th>}
                  <th className="px-4 py-3 text-center print:border print:border-slate-300">সর্বমোট নম্বর</th>
                  <th className="px-4 py-3 text-center print:border print:border-slate-300">প্রাপ্ত নম্বর</th>
                  <th className="px-4 py-3 text-center print:border print:border-slate-300">শতকরা</th>
                  <th className="px-4 py-3 text-center print:border print:border-slate-300">জিপিএ</th>
                  <th className="px-4 py-3 text-center print:border print:border-slate-300">বিভাগ</th>
                </tr>
              </thead>
              <tbody className="divide-y text-slate-600 print:divide-slate-300">
                {filteredResults.map((student, index) => {
                  const isFirst = index === 0;
                  const isSecond = index === 1;
                  const isThird = index === 2;
                  
                  let positionStyle = "text-slate-900";
                  if (isFirst) positionStyle = "text-amber-500 font-extrabold";
                  else if (isSecond) positionStyle = "text-slate-400 font-extrabold";
                  else if (isThird) positionStyle = "text-amber-700 font-extrabold";
                  
                  return (
                  <tr key={student.id} className="hover:bg-slate-50 transition print:hover:bg-white">
                    <td className={`px-4 py-3 text-center text-lg ${positionStyle} print:border print:border-slate-300 flex items-center justify-center space-x-1`}>
                      {index < 3 && <Trophy className="w-4 h-4 print:hidden" />}
                      <span>{index + 1}</span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900 print:border print:border-slate-300">
                      {student.first_name} {student.last_name}
                    </td>
                    <td className="px-4 py-3 print:border print:border-slate-300">{student.roll_number || '-'}</td>
                    {!classId && <td className="px-4 py-3 print:border print:border-slate-300">{student.class_name}</td>}
                    <td className="px-4 py-3 text-center print:border print:border-slate-300">{student.totalMax}</td>
                    <td className="px-4 py-3 text-center font-bold text-indigo-700 print:border print:border-slate-300">{student.totalObtained}</td>
                    <td className="px-4 py-3 text-center font-medium print:border print:border-slate-300">{student.percentage}%</td>
                    <td className="px-4 py-3 text-center font-bold text-slate-800 print:border print:border-slate-300">
                      {
                        student.percentage >= 80 ? '5.00' :
                        student.percentage >= 70 ? '4.00' :
                        student.percentage >= 60 ? '3.50' :
                        student.percentage >= 50 ? '3.00' :
                        student.percentage >= 40 ? '2.00' :
                        student.percentage >= 33 ? '1.00' : '0.00'
                      }
                    </td>
                    <td className="px-4 py-3 text-center print:border print:border-slate-300">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium print:border-none print:p-0 print:text-black ${
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
                )})}
              </tbody>
            </table>
          </div>
        )}
      </PrintLetterpad>
      
      {!loading && filteredResults.length === 0 && (classId !== "" || results.length > 0 === false && loading === false) && (
        <div className="text-center py-12 text-slate-500">
          কোনো ফলাফল পাওয়া যায়নি।
        </div>
      )}
    </div>
  );
}
