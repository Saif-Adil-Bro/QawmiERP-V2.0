"use client";

import { useState, useEffect } from "react";
import { getStudentReportCard } from "@/app/actions/exams";
import { Printer, Type, Award, User, CheckCircle, GraduationCap, Sparkles, LayoutGrid } from "lucide-react";
import { getMadrasaProfileWithLogo } from "@/app/actions/tenant";
import { toBanglaNumber } from "@/lib/numberToBangla";
import { sortStudentsByRoll } from "@/lib/student-utils";
import ExamPublishToggle from "@/app/dashboard/exams/ExamPublishToggle";
import KidsVisualReportCard from "@/components/exams/KidsVisualReportCard";

export default function ReportCardsClient({ 
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
  examId: string; 
  classes: { id: string; name: string }[];
  examTitle: string;
  examYear: string;
  madrasaInfo: any;
  initialPublished?: boolean;
  publishedAt?: string | null;
  publishedBy?: string | null;
  publishNote?: string | null;
}) {
  const [classId, setClassId] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string>("all");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [profileAndLogo, setProfileAndLogo] = useState<any>(null);
  const [banglaFont, setBanglaFont] = useState("font-solaiman");
  const [cardStyle, setCardStyle] = useState<"standard" | "kids">("standard");
  const [pageLayout, setPageLayout] = useState<"2-per-page" | "1-per-page">("2-per-page");

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
    // Sort by roll number naturally (১, ২, ৩... ১০, ১১) for consistent printing and listing
    const rollSorted = sortStudentsByRoll(data);
    setResults(rollSorted);
    setLoading(false);
  };

  const handlePrint = () => {
    window.print();
  };

  const filteredResults = selectedStudentId === "all" 
    ? results 
    : results.filter(r => r.id === selectedStudentId);

  const activeMadrasa = profileAndLogo?.madrasa || madrasaInfo;
  const madrasaName = activeMadrasa?.name || "কওমি মাদ্রাসা";
  const madrasaAddress = activeMadrasa?.address || "";
  const establishedYear = activeMadrasa?.established_year || "";
  const regNo = activeMadrasa?.registration_no || activeMadrasa?.reg_no || "";
  const logoUrl = profileAndLogo?.logoUrl || activeMadrasa?.logo_url;
  const principalSignUrl = profileAndLogo?.signatureUrl || activeMadrasa?.principal_signature_url;
  const principalName = profileAndLogo?.principalName || activeMadrasa?.principal_name || "মুহতামিম / প্রিন্সিপাল";

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

      {/* Control Header for Screen */}
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

        {results.length > 0 && (
          <div className="w-full md:w-1/4">
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">শিক্ষার্থী নির্বাচন</label>
            <select 
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 transition bg-white text-sm font-medium"
            >
              <option value="all">সকল শিক্ষার্থী (মোট {results.length} জন)</option>
              {results.map((s, idx) => (
                <option key={s.id} value={s.id}>
                  রোল {s.roll_number || idx + 1}: {s.first_name} {s.last_name}
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

          <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 shadow-xs">
            <LayoutGrid className="w-4 h-4 text-indigo-600 shrink-0" />
            <select 
              value={pageLayout} 
              onChange={(e) => setPageLayout(e.target.value as any)}
              className="text-xs font-bold text-slate-800 bg-transparent focus:outline-none"
            >
              <option value="2-per-page">২টি প্রতি A4 পেজ (অর্ধেক পাতা)</option>
              <option value="1-per-page">১টি প্রতি A4 পেজ (পূর্ণ পাতা)</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 shadow-xs">
            <Award className="w-4 h-4 text-amber-500 shrink-0" />
            <select 
              value={cardStyle} 
              onChange={(e) => setCardStyle(e.target.value as any)}
              className="text-xs font-bold text-slate-800 bg-transparent focus:outline-none"
            >
              <option value="standard">স্টাইল: ক্লাসিক্যাল মার্কশিট</option>
              <option value="kids">স্টাইল: শিশু-বান্ধব / নূরানী প্রগ্রেস রিপোর্ট 🌟</option>
            </select>
          </div>

          <button 
            onClick={loadResults}
            disabled={loading || !classId}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 transition text-sm font-semibold shadow-xs"
          >
            {loading ? "তৈরি হচ্ছে..." : "মার্কশিট লোড করুন"}
          </button>
          
          <button 
            onClick={handlePrint}
            disabled={filteredResults.length === 0}
            className="flex items-center space-x-2 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold text-sm disabled:opacity-50 shadow-xs"
          >
            <Printer className="w-4 h-4" />
            <span>প্রিন্ট / PDF ডাউনলোড</span>
          </button>
        </div>
      </div>

      {!loading && results.length === 0 && classId !== "" && (
        <div className="text-center py-12 text-slate-500 bg-white rounded-xl border border-dashed p-8 print:hidden">
          ফলাফল পেতে প্রথমে 'মার্কশিট লোড করুন' বাটনে ক্লিক করুন।
        </div>
      )}

      {/* Scoped @page reset for exact A4 2-per-page printing (zero browser margins/headers) */}
      {cardStyle !== "kids" && pageLayout === "2-per-page" && (
        <style
          dangerouslySetInnerHTML={{
            __html: `
              @media print {
                @page {
                  size: A4 portrait;
                  margin: 0 !important;
                }
                html, body {
                  margin: 0 !important;
                  padding: 0 !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
              }
            `,
          }}
        />
      )}

      {/* Screen Info Banner */}
      {results.length > 0 && (
        <div className="print:hidden flex justify-between items-center bg-blue-50 border border-blue-200 p-3 rounded-lg text-blue-900 text-sm font-medium">
          <span>মোট {results.length} জন শিক্ষার্থীর মার্কশিট প্রস্তুত রয়েছে।</span>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700 transition text-xs font-semibold shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            প্রিন্ট ভিউ দেখুন
          </button>
        </div>
      )}

      {/* PRINT & 2-UP A4 PREVIEW VIEW */}
      <div className={`${cardStyle !== "kids" && pageLayout === "2-per-page" && filteredResults.length > 0 ? "a4-preview-wrapper" : "hidden print:block"} print:w-full ${banglaFont}`}>
        {cardStyle === "kids" ? (
          filteredResults.map((student) => {
            const meritRank = results.findIndex(r => r.id === student.id) + 1;
            return (
              <div key={student.id} className="break-after-page mb-8 print:mb-0">
                <KidsVisualReportCard
                  student={student}
                  examTitle={examTitle}
                  examYear={examYear}
                  madrasaName={madrasaName}
                  madrasaAddress={madrasaAddress}
                  logoUrl={logoUrl}
                  principalName={principalName}
                  principalSignUrl={principalSignUrl}
                  meritRank={meritRank}
                  banglaFont={banglaFont}
                />
              </div>
            );
          })
        ) : pageLayout === "2-per-page" ? (
          // Chunk results into pairs of 2 for exact 210mm x 297mm A4 pages (two 210mm x 148.5mm slots with 10mm padding)
          Array.from({ length: Math.ceil(filteredResults.length / 2) }, (_, pageIndex) => {
            const pair = filteredResults.slice(pageIndex * 2, pageIndex * 2 + 2);
            return (
              <div key={`marksheet-page-${pageIndex}`} className="a4-page text-slate-900 font-sans">
                {/* Center Cutting Guide at exact 148.5mm vertical midpoint */}
                <div className="a4-cut-line" aria-hidden="true" />
                {pair.map((student) => {
                  const meritRank = results.findIndex(r => r.id === student.id) + 1;
                  return (
                    <div key={student.id} className="a4-page-slot">
                      <div className="border border-slate-900 rounded-lg p-2.5 w-full h-full flex flex-col justify-between relative bg-white overflow-hidden">
                        <div>
                          {/* Compact Header */}
                          <div className="flex items-center justify-between border-b border-slate-900 pb-1 mb-1">
                              <div className="flex items-center gap-2">
                                {logoUrl ? (
                                  <img 
                                    src={logoUrl} 
                                    alt="Logo" 
                                    className="w-10 h-10 object-contain rounded-full border border-slate-200 p-0.5 shrink-0" 
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <div className="w-10 h-10 bg-emerald-50 rounded-full border border-emerald-700 flex items-center justify-center shrink-0">
                                    <GraduationCap className="w-6 h-6 text-emerald-800" />
                                  </div>
                                )}
                                <div>
                                  <span className="text-[9px] uppercase font-bold text-slate-500 block leading-tight">
                                    স্থাপিত: {toBanglaNumber(establishedYear)} ইং | রেজি: {toBanglaNumber(regNo)}
                                  </span>
                                  <h1 className="text-lg font-black text-slate-950 leading-tight">{madrasaName}</h1>
                                  <p className="text-[10px] text-slate-700 font-medium leading-tight">{madrasaAddress}</p>
                                </div>
                              </div>
                              <div className="text-right text-[10px] font-semibold text-slate-700 shrink-0">
                                <p>সারক নং: মা/প্র/{toBanglaNumber(examYear)}/</p>
                                <p>তারিখ: {toBanglaNumber(new Date().toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' }))}</p>
                              </div>
                            </div>

                            {/* Title Badge */}
                            <div className="text-center my-1">
                              <span className="inline-block bg-slate-900 text-white px-4 py-0.5 rounded-full font-black text-xs uppercase tracking-wider">
                                প্রোগ্রেস রিপোর্ট / মার্কশিট
                              </span>
                              <p className="text-xs font-bold text-slate-800 mt-0.5">{examTitle} - {toBanglaNumber(examYear)}</p>
                            </div>

                            {/* Student Details Grid */}
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 my-1.5 p-2 bg-slate-50 rounded border border-slate-300 text-xs">
                              <div className="flex">
                                <span className="font-bold text-slate-700 w-24">ছাত্রের নাম:</span>
                                <span className="font-black text-slate-950 flex-1 truncate">{student.first_name} {student.last_name}</span>
                              </div>
                              <div className="flex">
                                <span className="font-bold text-slate-700 w-24">শ্রেণি / জামাত:</span>
                                <span className="font-black text-slate-950 flex-1">{student.class_name || 'N/A'}</span>
                              </div>
                              <div className="flex">
                                <span className="font-bold text-slate-700 w-24">রোল নম্বর:</span>
                                <span className="font-black text-slate-950 flex-1">{toBanglaNumber(student.roll_number || '১')}</span>
                              </div>
                              <div className="flex">
                                <span className="font-bold text-slate-700 w-24">মেধা স্থান:</span>
                                <span className="font-black text-blue-900 flex-1">{toBanglaNumber(meritRank)} তম</span>
                              </div>
                            </div>

                            {/* Marks Table */}
                            <table className="w-full text-left border-collapse my-1 text-[11px]">
                              <thead>
                                <tr className="bg-slate-200">
                                  <th className="border border-slate-900 px-2 py-0.5 text-center font-black text-slate-950 w-8">ক্র. নং</th>
                                  <th className="border border-slate-900 px-2 py-0.5 font-black text-slate-950">বিষয়ের নাম</th>
                                  <th className="border border-slate-900 px-1.5 py-0.5 text-center font-black text-slate-950 w-16">পূর্ণ নম্বর</th>
                                  <th className="border border-slate-900 px-1.5 py-0.5 text-center font-black text-blue-900 bg-blue-50/60 w-16" title="ওই বিষয়ে সর্বোচ্চ নম্বর">সর্বোচ্চ</th>
                                  <th className="border border-slate-900 px-1.5 py-0.5 text-center font-black text-slate-950 w-16">প্রাপ্ত নম্বর</th>
                                  {student.grading_mode !== "average_percentage" && (
                                    <th className="border border-slate-900 px-1.5 py-0.5 text-center font-black text-slate-950 w-20">গ্রেড / বিভাগ</th>
                                  )}
                                </tr>
                              </thead>
                              <tbody>
                                {student.marks && student.marks.length > 0 ? (
                                  student.marks.map((m: any, i: number) => (
                                    <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                                      <td className="border border-slate-800 px-2 py-0.5 text-center font-bold text-slate-800">{toBanglaNumber(i + 1)}</td>
                                      <td className="border border-slate-800 px-2 py-0.5 font-bold text-slate-950">{m.subject_name}</td>
                                      <td className="border border-slate-800 px-1.5 py-0.5 text-center text-slate-800">{toBanglaNumber(m.total_marks || 100)}</td>
                                      <td className="border border-slate-800 px-1.5 py-0.5 text-center font-semibold text-blue-900 bg-blue-50/30">
                                        {toBanglaNumber(m.highest_marks !== undefined ? m.highest_marks : (m.marks_obtained || 0))}
                                      </td>
                                      <td className="border border-slate-800 px-1.5 py-0.5 text-center font-black text-slate-950">{toBanglaNumber(m.marks_obtained || 0)}</td>
                                      {student.grading_mode !== "average_percentage" && (
                                        <td className="border border-slate-800 px-1.5 py-0.5 text-center font-bold text-slate-900 text-[10px]">
                                          {m.grade || "-"}
                                        </td>
                                      )}
                                    </tr>
                                  ))
                                ) : (
                                  <tr>
                                    <td colSpan={student.grading_mode !== "average_percentage" ? 6 : 5} className="border border-slate-800 px-2 py-2 text-center text-slate-500 italic">
                                      কোনো বিষয়ের নম্বর যুক্ত করা হয়নি
                                    </td>
                                  </tr>
                                )}
                                
                                {/* Total Row */}
                                <tr className="bg-slate-100 font-black">
                                  <td colSpan={2} className="border border-slate-900 px-2 py-0.5 text-right uppercase text-slate-950 font-black text-[11px]">
                                    সর্বমোট:
                                  </td>
                                  <td className="border border-slate-900 px-1.5 py-0.5 text-center text-slate-950 font-black">
                                    {toBanglaNumber(student.totalMax)}
                                  </td>
                                  <td className="border border-slate-900 px-1.5 py-0.5 text-center text-slate-400 font-normal">
                                    -
                                  </td>
                                  <td className="border border-slate-900 px-1.5 py-0.5 text-center text-slate-950 font-black text-xs">
                                    {toBanglaNumber(student.totalObtained)}
                                  </td>
                                  {student.grading_mode !== "average_percentage" && (
                                    <td className="border border-slate-900 px-1.5 py-0.5 text-center text-slate-950 font-black text-[10px]">
                                      GPA {toBanglaNumber(student.gpa || "০.০০")}
                                    </td>
                                  )}
                                </tr>
                              </tbody>
                            </table>

                            {/* Final Grade & Percentage Summary */}
                            <div className="grid grid-cols-2 gap-2 bg-slate-100 border border-slate-900 p-1.5 rounded text-xs my-1">
                              <div className="flex items-center">
                                <span className="font-bold text-slate-800">প্রাপ্ত বিভাগ:</span>
                                <span className="font-black text-slate-950 ml-1.5 bg-white px-2 py-0.5 rounded border border-slate-300">
                                  {student.grade}
                                </span>
                              </div>
                              <div className="flex items-center justify-end">
                                <span className="font-bold text-slate-800">শতকরা:</span>
                                <span className="font-black text-slate-950 ml-1.5 bg-white px-2 py-0.5 rounded border border-slate-300">
                                  {toBanglaNumber(student.percentage)}%
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Footer Signatures */}
                          <div className="mt-2 pt-1 border-t border-slate-300">
                            <div className="flex justify-between items-end">
                              <div className="text-center w-28">
                                <div className="border-t border-slate-900 pt-0.5">
                                  <p className="font-bold text-slate-900 text-[10px]">শ্রেণী শিক্ষকের স্বাক্ষর</p>
                                </div>
                              </div>
                              
                              <div className="text-center w-28">
                                <div className="border-t border-slate-900 pt-0.5">
                                  <p className="font-bold text-slate-900 text-[10px]">পরীক্ষা নিয়ন্ত্রক</p>
                                </div>
                              </div>

                              <div className="text-center w-32">
                                {principalSignUrl ? (
                                  <div className="h-6 flex items-center justify-center mb-0.5">
                                    <img 
                                      src={principalSignUrl} 
                                      alt="Principal Signature" 
                                      className="max-h-full max-w-[90px] object-contain"
                                      referrerPolicy="no-referrer"
                                    />
                                  </div>
                                ) : (
                                  <div className="h-4"></div>
                                )}
                                <div className="border-t border-slate-900 pt-0.5">
                                  <p className="font-bold text-slate-900 text-[10px] truncate">
                                    {principalName}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>

                        </div>
                      </div>
                  );
                })}
              </div>
            );
          })
        ) : (
          filteredResults.map((student) => {
            const meritRank = results.findIndex(r => r.id === student.id) + 1;
            return (
              <div key={student.id} className="a4-marksheet-sheet bg-white text-slate-900 font-sans">
                <div className="border-2 border-slate-900 rounded-xl p-5 h-full flex flex-col justify-between relative">
                  
                  {/* Header Section */}
                  <div>
                    <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3 mb-3">
                      <div className="flex items-center gap-3">
                        {logoUrl ? (
                          <img 
                            src={logoUrl} 
                            alt="Logo" 
                            className="w-14 h-14 object-contain rounded-full border border-slate-200 p-0.5" 
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-14 h-14 bg-emerald-50 rounded-full border-2 border-emerald-700 flex items-center justify-center">
                            <GraduationCap className="w-8 h-8 text-emerald-800" />
                          </div>
                        )}
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-500">স্থাপিত: {toBanglaNumber(establishedYear)} ইং | রেজি: {toBanglaNumber(regNo)}</span>
                          <h1 className="text-2xl font-black text-slate-950 leading-tight">{madrasaName}</h1>
                          <p className="text-xs text-slate-700 font-medium">{madrasaAddress}</p>
                        </div>
                      </div>
                      <div className="text-right text-[11px] font-semibold text-slate-700">
                        <p>সারক নং: মা/প্র/{toBanglaNumber(examYear)}/</p>
                        <p>তারিখ: {toBanglaNumber(new Date().toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' }))}</p>
                      </div>
                    </div>

                    {/* Title Badge */}
                    <div className="text-center my-2">
                      <span className="inline-block bg-slate-900 text-white px-6 py-1 rounded-full font-black text-sm uppercase tracking-wider">
                        প্রোগ্রেস রিপোর্ট / মার্কশিট
                      </span>
                      <p className="text-sm font-bold text-slate-800 mt-1">{examTitle} - {toBanglaNumber(examYear)}</p>
                    </div>

                    {/* Student Details Grid */}
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2 my-3 p-3 bg-slate-50 rounded-lg border border-slate-300 text-xs sm:text-sm">
                      <div className="flex">
                        <span className="font-bold text-slate-700 w-28">ছাত্রের নাম:</span>
                        <span className="font-black text-slate-950 flex-1">{student.first_name} {student.last_name}</span>
                      </div>
                      <div className="flex">
                        <span className="font-bold text-slate-700 w-28">শ্রেণি / জামাত:</span>
                        <span className="font-black text-slate-950 flex-1">{student.class_name || 'N/A'}</span>
                      </div>
                      <div className="flex">
                        <span className="font-bold text-slate-700 w-28">রোল নম্বর:</span>
                        <span className="font-black text-slate-950 flex-1">{toBanglaNumber(student.roll_number || '১')}</span>
                      </div>
                      <div className="flex">
                        <span className="font-bold text-slate-700 w-28">মেধা স্থান (Merit):</span>
                        <span className="font-black text-blue-900 flex-1">{toBanglaNumber(meritRank)} তম</span>
                      </div>
                    </div>

                    {/* Marks Table */}
                    <table className="w-full text-left border-collapse my-3 text-xs">
                      <thead>
                        <tr className="bg-slate-200">
                          <th className="border border-slate-900 px-3 py-1.5 text-center font-black text-slate-950 w-10">ক্র. নং</th>
                          <th className="border border-slate-900 px-3 py-1.5 font-black text-slate-950">বিষয়ের নাম</th>
                          <th className="border border-slate-900 px-3 py-1.5 text-center font-black text-slate-950 w-20">পূর্ণ নম্বর</th>
                          <th className="border border-slate-900 px-3 py-1.5 text-center font-black text-blue-900 bg-blue-50/60 w-20" title="ওই বিষয়ে সর্বোচ্চ নম্বর">সর্বোচ্চ</th>
                          <th className="border border-slate-900 px-3 py-1.5 text-center font-black text-slate-950 w-24">প্রাপ্ত নম্বর</th>
                          {student.grading_mode !== "average_percentage" && (
                            <th className="border border-slate-900 px-3 py-1.5 text-center font-black text-slate-950 w-28">গ্রেড / বিভাগ</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {student.marks && student.marks.length > 0 ? (
                          student.marks.map((m: any, i: number) => (
                            <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                              <td className="border border-slate-800 px-3 py-1 text-center font-bold text-slate-800">{toBanglaNumber(i + 1)}</td>
                              <td className="border border-slate-800 px-3 py-1 font-bold text-slate-950">{m.subject_name}</td>
                              <td className="border border-slate-800 px-3 py-1 text-center text-slate-800">{toBanglaNumber(m.total_marks || 100)}</td>
                              <td className="border border-slate-800 px-3 py-1 text-center font-semibold text-blue-900 bg-blue-50/30">
                                {toBanglaNumber(m.highest_marks !== undefined ? m.highest_marks : (m.marks_obtained || 0))}
                              </td>
                              <td className="border border-slate-800 px-3 py-1 text-center font-black text-slate-950 text-sm">{toBanglaNumber(m.marks_obtained || 0)}</td>
                              {student.grading_mode !== "average_percentage" && (
                                <td className="border border-slate-800 px-3 py-1 text-center font-bold text-slate-900">
                                  {m.grade || "-"}
                                </td>
                              )}
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={student.grading_mode !== "average_percentage" ? 6 : 5} className="border border-slate-800 px-3 py-3 text-center text-slate-500 font-medium italic">
                              কোনো বিষয়ের নম্বর যুক্ত করা হয়নি
                            </td>
                          </tr>
                        )}
                        
                        {/* Total Row */}
                        <tr className="bg-slate-100 font-black">
                          <td colSpan={2} className="border border-slate-900 px-3 py-1.5 text-right uppercase text-slate-950 font-black text-xs">
                            সর্বমোট:
                          </td>
                          <td className="border border-slate-900 px-3 py-1.5 text-center text-slate-950 font-black">
                            {toBanglaNumber(student.totalMax)}
                          </td>
                          <td className="border border-slate-900 px-3 py-1.5 text-center text-slate-400 font-normal">
                            -
                          </td>
                          <td className="border border-slate-900 px-3 py-1.5 text-center text-slate-950 font-black text-sm">
                            {toBanglaNumber(student.totalObtained)}
                          </td>
                          {student.grading_mode !== "average_percentage" && (
                            <td className="border border-slate-900 px-3 py-1.5 text-center text-slate-950 font-black">
                              GPA {toBanglaNumber(student.gpa || "০.০০")}
                            </td>
                          )}
                        </tr>
                      </tbody>
                    </table>

                    {/* Final Grade & Percentage Summary */}
                    <div className="grid grid-cols-2 gap-4 bg-slate-100 border border-slate-900 p-2.5 rounded-lg text-xs sm:text-sm my-2">
                      <div className="flex items-center">
                        <span className="font-bold text-slate-800">প্রাপ্ত বিভাগ (Grade):</span>
                        <span className="font-black text-slate-950 text-sm ml-2 bg-white px-2.5 py-0.5 rounded border border-slate-300">
                          {student.grade}
                        </span>
                      </div>
                      <div className="flex items-center justify-end">
                        <span className="font-bold text-slate-800">শতকরা (Percentage):</span>
                        <span className="font-black text-slate-950 text-sm ml-2 bg-white px-2.5 py-0.5 rounded border border-slate-300">
                          {toBanglaNumber(student.percentage)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Footer Signatures */}
                  <div className="mt-4 pt-3 border-t border-slate-200">
                    <div className="flex justify-between items-end">
                      <div className="text-center w-36">
                        <div className="border-t-2 border-slate-900 pt-1">
                          <p className="font-bold text-slate-900 text-[11px]">শ্রেণী শিক্ষকের স্বাক্ষর</p>
                        </div>
                      </div>
                      
                      <div className="text-center w-36">
                        <div className="border-t-2 border-slate-900 pt-1">
                          <p className="font-bold text-slate-900 text-[11px]">পরীক্ষা নিয়ন্ত্রক</p>
                        </div>
                      </div>

                      <div className="text-center w-40">
                        {principalSignUrl ? (
                          <div className="h-9 flex items-center justify-center mb-0.5">
                            <img 
                              src={principalSignUrl} 
                              alt="Principal Signature" 
                              className="max-h-full max-w-[110px] object-contain"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        ) : (
                          <div className="h-6"></div>
                        )}
                        <div className="border-t-2 border-slate-900 pt-1">
                          <p className="font-bold text-slate-900 text-[11px]">
                            {principalName}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Screen Preview (for Kids / 1-per-page mode; 2-per-page already renders accurate A4 preview above) */}
      {results.length > 0 && (cardStyle === "kids" || pageLayout === "1-per-page") && (
        <div className="print:hidden space-y-4">
          {cardStyle === "kids" ? (
            <div className="space-y-6">
              {filteredResults.map((student) => {
                const meritRank = results.findIndex(r => r.id === student.id) + 1;
                return (
                  <KidsVisualReportCard
                    key={student.id}
                    student={student}
                    examTitle={examTitle}
                    examYear={examYear}
                    madrasaName={madrasaName}
                    madrasaAddress={madrasaAddress}
                    logoUrl={logoUrl}
                    principalName={principalName}
                    principalSignUrl={principalSignUrl}
                    meritRank={meritRank}
                    banglaFont={banglaFont}
                  />
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredResults.map((student, index) => {
                const meritRank = results.findIndex(r => r.id === student.id) + 1;
                return (
                  <div key={student.id} className="bg-white border border-slate-200 p-5 rounded-xl shadow-xs hover:shadow-md transition flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-bold text-slate-900 text-base">
                            {student.first_name} {student.last_name}
                          </h3>
                          <p className="text-xs text-slate-500 font-medium mt-0.5">ক্লাস: {student.class_name}</p>
                        </div>
                        <span className="bg-slate-100 text-slate-800 text-xs px-2.5 py-1 rounded-full font-bold">
                          রোল: {toBanglaNumber(student.roll_number || '১')}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-lg mb-3">
                        <div>
                          <span className="text-slate-500 block">মেধা স্থান:</span>
                          <span className="font-bold text-slate-900 text-sm">{toBanglaNumber(meritRank)} তম</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">প্রাপ্ত বিভাগ:</span>
                          <span className={`font-bold text-sm ${student.is_failed || student.grade.includes('রাসিব') ? 'text-red-700' : 'text-emerald-700'}`}>
                            {student.grade}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">প্রাপ্ত নম্বর:</span>
                          <span className="font-bold text-slate-900">{toBanglaNumber(student.totalObtained)} / {toBanglaNumber(student.totalMax)}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">শতকরা:</span>
                          <span className="font-bold text-blue-700">{toBanglaNumber(student.percentage)}%</span>
                        </div>
                      </div>

                      {student.fail_reason && (
                        <div className="mb-3 px-2.5 py-1.5 bg-red-50 border border-red-200 rounded-lg text-[11px] text-red-700 font-semibold flex items-center justify-between">
                          <span>কারণ: {student.fail_reason}</span>
                        </div>
                      )}

                      <div className="space-y-1">
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">বিষয়ভিত্তিক নম্বর:</p>
                        {student.marks && student.marks.length > 0 ? (
                          student.marks.map((m: any, i: number) => (
                            <div key={i} className="flex justify-between text-xs py-1 border-b border-slate-100 last:border-none">
                              <div className="flex items-center gap-1.5 truncate max-w-[170px]">
                                <span className="text-slate-700 font-medium truncate" title={m.subject_name}>{m.subject_name}</span>
                                {m.is_compulsory && (
                                  <span className="text-[10px] text-slate-400 bg-slate-100 px-1 rounded">আবশ্যক</span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-blue-700 bg-blue-50 px-1 rounded font-medium" title="ওই বিষয়ে সর্বোচ্চ নম্বর">
                                  সর্বোচ্চ: {toBanglaNumber(m.highest_marks !== undefined ? m.highest_marks : (m.marks_obtained || 0))}
                                </span>
                                <span className={`font-bold ${m.is_failed ? 'text-red-600' : 'text-slate-900'}`}>
                                  {toBanglaNumber(m.marks_obtained)} / {toBanglaNumber(m.total_marks)}
                                </span>
                                {student.grading_mode !== "average_percentage" && m.grade && (
                                  <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-1 rounded">
                                    {m.grade}
                                  </span>
                                )}
                                {m.is_failed && (
                                  <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1 rounded">ফেল</span>
                                )}
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-slate-400 italic">কোনো নম্বর যুক্ত করা হয়নি</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
