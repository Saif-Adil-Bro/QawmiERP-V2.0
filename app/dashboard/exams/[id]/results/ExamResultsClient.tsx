"use client";

import { useState, useEffect } from "react";
import { getStudentReportCard } from "@/app/actions/exams";
import { FileText } from "lucide-react";
import { getMadrasaProfileWithLogo } from "@/app/actions/tenant";
import PrintLetterpad from "@/app/components/PrintLetterpad";

export default function ExamResultsClient({ 
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
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { size: landscape; margin: 1cm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}} />
      <div className="flex flex-col sm:flex-row gap-4 items-end bg-slate-50 p-4 rounded-lg border border-slate-100 print:hidden">
        <div className="w-full sm:w-1/3">
          <label className="block text-sm font-medium text-slate-700 mb-1">ক্লাস (ঐচ্ছিক)</label>
          <select 
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 transition bg-white"
          >
            <option value="">সব ক্লাস</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="w-full sm:w-auto flex space-x-3">
          <button 
            onClick={loadResults}
            disabled={loading}
            className="px-4 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800 disabled:opacity-50 transition text-sm font-medium"
          >
            {loading ? "খুঁজছি..." : "ফলাফল দেখুন"}
          </button>
          
          <button 
            onClick={handlePrint}
            disabled={results.length === 0}
            className="flex items-center space-x-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 transition font-medium text-sm disabled:opacity-50 bg-white"
          >
            <FileText className="w-4 h-4" />
            <span>প্রিন্ট</span>
          </button>
        </div>
      </div>

      <PrintLetterpad madrasaInfo={profileAndLogo?.madrasa || madrasaInfo} logoUrl={profileAndLogo?.logoUrl}>
        <div className="mb-6 text-center border-b border-slate-100 pb-4">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800">{examTitle} - {examYear}</h2>
          <h3 className="text-base sm:text-lg font-bold text-indigo-700 mt-1">
            পরীক্ষার ফলাফল ও মার্কশিট তালিকা
          </h3>
          {selectedClassName && <p className="text-slate-500 font-semibold text-xs mt-1.5 bg-slate-50 inline-block px-3 py-1 rounded-full border border-slate-100">শ্রেণী: {selectedClassName}</p>}
        </div>

        {results.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b print:bg-white print:border-b-2 print:border-black">
                <tr>
                  <th className="px-4 py-3 print:border print:border-slate-300">মেধা স্থান</th>
                  <th className="px-4 py-3 print:border print:border-slate-300">রোল</th>
                  <th className="px-4 py-3 print:border print:border-slate-300">নাম</th>
                  {!classId && <th className="px-4 py-3 print:border print:border-slate-300">ক্লাস</th>}
                  {subjectList.map(sub => (
                    <th key={sub} className="px-4 py-3 text-center print:border print:border-slate-300 whitespace-nowrap">{sub}</th>
                  ))}
                  <th className="px-4 py-3 text-center print:border print:border-slate-300">মোট প্রাপ্ত</th>
                  <th className="px-4 py-3 text-center print:border print:border-slate-300">শতকরা</th>
                  <th className="px-4 py-3 text-center print:border print:border-slate-300">বিভাগ</th>
                  <th className="px-4 py-3 text-center print:border print:border-slate-300">জিপিএ (GPA)</th>
                </tr>
              </thead>
              <tbody className="divide-y text-slate-600">
                {results.map((student, index) => (
                  <tr key={student.id} className="hover:bg-slate-50/50 transition print:hover:bg-white">
                    <td className="px-4 py-3 text-center font-bold text-slate-900 print:border print:border-slate-300">{index + 1}</td>
                    <td className="px-4 py-3 print:border print:border-slate-300">{student.roll_number || '-'}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900 print:border print:border-slate-300 whitespace-nowrap">
                      {student.first_name} {student.last_name}
                    </td>
                    {!classId && <td className="px-4 py-3 print:border print:border-slate-300">{student.class_name}</td>}
                    {subjectList.map(sub => {
                      const markObj = student.marks?.find((m: any) => m.subject_name === sub);
                      return (
                        <td key={sub} className="px-4 py-3 text-center print:border print:border-slate-300">
                          {markObj ? markObj.marks_obtained : '-'}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-center font-semibold text-slate-800 print:border print:border-slate-300">{student.totalObtained} / {student.totalMax}</td>
                    <td className="px-4 py-3 text-center print:border print:border-slate-300">{student.percentage}%</td>
                    <td className="px-4 py-3 text-center font-medium print:border print:border-slate-300">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold print:border-none print:p-0 print:text-black ${
                        student.percentage >= 80 ? 'bg-emerald-100 text-emerald-800' :
                        student.percentage >= 60 ? 'bg-blue-100 text-blue-800' :
                        student.percentage >= 45 ? 'bg-amber-100 text-amber-800' :
                        student.percentage >= 33 ? 'bg-slate-100 text-slate-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {student.grade}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-indigo-700 print:border print:border-slate-300">
                      {
                        student.percentage >= 80 ? '5.00' :
                        student.percentage >= 70 ? '4.00' :
                        student.percentage >= 60 ? '3.50' :
                        student.percentage >= 50 ? '3.00' :
                        student.percentage >= 40 ? '2.00' :
                        student.percentage >= 33 ? '1.00' : '0.00'
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-slate-500">
            {classId === "" ? "ফলাফল দেখতে প্রথমে ক্লাস নির্বাচন করে 'ফলাফল দেখুন' বাটনে চাপ দিন।" : "কোনো ফলাফল পাওয়া যায়নি।"}
          </div>
        )}
      </PrintLetterpad>
    </div>
  );
}
