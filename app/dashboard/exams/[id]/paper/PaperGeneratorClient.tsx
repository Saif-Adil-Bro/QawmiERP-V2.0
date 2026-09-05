"use client";

import { useState, useEffect } from "react";
import { getExamPaper, saveExamPaper } from "@/app/actions/questions";
import { Plus, Trash2, Printer, Loader2, Save, FileSignature, CheckCircle2, Globe, Building2, BookOpen, Clock, Award, ArrowUp, ArrowDown } from "lucide-react";
import SpecializedQuestionView, { getQuestionTypeBadge } from "@/components/exams/SpecializedQuestionView";

// Helper function to detect Arabic script in text
function isArabicText(text: string): boolean {
  if (!text) return false;
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
}

function toBengaliNumerals(num: number): string {
  const digits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return num.toString().split("").map(d => digits[parseInt(d)] || d).join("");
}

function toArabicNumerals(num: number): string {
  const digits = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  return num.toString().split("").map(d => digits[parseInt(d)] || d).join("");
}

export default function PaperGeneratorClient({
  examId,
  classes,
  subjects,
  questions,
  exam,
  madrasa
}: {
  examId: string;
  classes: any[];
  subjects: any[];
  questions: any[];
  exam: any;
  madrasa: any;
}) {
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [customMadrasaName, setCustomMadrasaName] = useState(madrasa?.name || "মাদ্রাসাতুল মুসলিমীন");
  const [paperTitle, setPaperTitle] = useState("বার্ষিক পরীক্ষা - ২০২৬");
  const [examName, setExamName] = useState(exam?.title || "");
  const [examTime, setExamTime] = useState("২ ঘণ্টা ৩০ মিনিট");
  const [totalMarks, setTotalMarks] = useState(100);
  const [paperInstructions, setPaperInstructions] = useState("সকল প্রশ্নের উত্তর দেওয়া আবশ্যক। ডান পাশের সংখ্যা পূর্ণমান জ্ঞাপক।");
  const [selectedQuestions, setSelectedQuestions] = useState<any[]>([]);
  const [selectedFont, setSelectedFont] = useState("font-solaiman");
  const [textDirectionMode, setTextDirectionMode] = useState<"auto" | "rtl" | "ltr">("auto");
  const [arabicNumbering, setArabicNumbering] = useState<"auto" | "bengali" | "arabic" | "english">("auto");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Available questions for selected class and subject
  const availableQuestions = questions.filter(
    (q) => q.class_id === classId && q.subject_id === subjectId
  );

  useEffect(() => {
    if (classId && subjectId) {
      loadPaper();
    } else {
      setSelectedQuestions([]);
    }
  }, [classId, subjectId]);

  const loadPaper = async () => {
    setLoading(true);
    const paper = await getExamPaper(examId, classId, subjectId);
    if (paper) {
      setPaperTitle(paper.title);
      setTotalMarks(paper.total_marks);
      setExamName(paper.exam_name || exam.title || "");
      setExamTime(paper.exam_time || "");
      setSelectedQuestions(paper.questions || []);
    } else {
      setPaperTitle(`${exam.title} - প্রশ্নপত্র`);
      setTotalMarks(100);
      setExamName(exam.title || "");
      setExamTime("২ ঘণ্টা ৩০ মিনিট");
      setSelectedQuestions([]);
    }
    setLoading(false);
  };

  const handleToggleQuestion = (question: any) => {
    const isSelected = selectedQuestions.some((q) => q.id === question.id);
    if (isSelected) {
      setSelectedQuestions(selectedQuestions.filter((q) => q.id !== question.id));
    } else {
      setSelectedQuestions([...selectedQuestions, question]);
    }
  };

  const moveQuestionUp = (index: number) => {
    if (index === 0) return;
    const newQuestions = [...selectedQuestions];
    const temp = newQuestions[index - 1];
    newQuestions[index - 1] = newQuestions[index];
    newQuestions[index] = temp;
    setSelectedQuestions(newQuestions);
  };

  const moveQuestionDown = (index: number) => {
    if (index === selectedQuestions.length - 1) return;
    const newQuestions = [...selectedQuestions];
    const temp = newQuestions[index + 1];
    newQuestions[index + 1] = newQuestions[index];
    newQuestions[index] = temp;
    setSelectedQuestions(newQuestions);
  };

  const currentTotalMarks = selectedQuestions.reduce((sum, q) => sum + (q.marks || 0), 0);

  const handleSave = async () => {
    if (!classId || !subjectId) {
      alert("অনুগ্রহ করে প্রথমে ক্লাস এবং বিষয় নির্বাচন করুন।");
      return;
    }
    if (selectedQuestions.length === 0) {
      alert("অনুগ্রহ করে অন্তত একটি প্রশ্ন নির্বাচন করুন।");
      return;
    }
    setSaving(true);
    try {
      const result = await saveExamPaper({
        exam_id: examId,
        class_id: classId,
        subject_id: subjectId,
        title: paperTitle,
        total_marks: totalMarks,
        exam_time: examTime,
        exam_name: examName,
        questions: selectedQuestions
      });
      if (result?.error) {
        alert(result.error);
      } else {
        alert("প্রশ্নপত্রটি সফলভাবে সংরক্ষণ করা হয়েছে!");
      }
    } catch (err) {
      console.error("saveExamPaper failed:", err);
      alert("একটি অপ্রত্যাশিত সমস্যা হয়েছে। সম্ভবত নতুন আপডেট ডিপ্লয় হয়েছে — অনুগ্রহ করে পেজ রিফ্রেশ করে আবার চেষ্টা করুন।");
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getQuestionDir = (text: string): "rtl" | "ltr" => {
    if (textDirectionMode === "rtl") return "rtl";
    if (textDirectionMode === "ltr") return "ltr";
    return isArabicText(text) ? "rtl" : "ltr";
  };

  const formatQuestionNumber = (idx: number, isRTL: boolean): string => {
    const num = idx + 1;
    if (arabicNumbering === "arabic" || (isRTL && arabicNumbering === "auto")) {
      return `${toArabicNumerals(num)}.`;
    }
    if (arabicNumbering === "english") {
      return `${num}.`;
    }
    return `${toBengaliNumerals(num)}.`;
  };

  const getOptionLabel = (idx: number, isRTL: boolean): string => {
    if (isRTL) {
      const arabicLetters = ["(أ)", "(ب)", "(ج)", "(د)", "(هـ)"];
      return arabicLetters[idx] || `(${idx + 1})`;
    }
    const bengaliLetters = ["(ক)", "(খ)", "(গ)", "(ঘ)", "(ঙ)"];
    return bengaliLetters[idx] || `(${idx + 1})`;
  };

  const selectedClassName = classes.find((c) => c.id === classId)?.name || "";
  const selectedSubjectName = subjects.find((s) => s.id === subjectId)?.name || "";

  return (
    <div>
      {/* Interactive Layout: Hidden when printing */}
      <div className="space-y-6 print:hidden">
        {/* Filters & Actions */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 justify-between items-end">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full md:w-1/2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">শ্রেণি / জামাত (Class)</label>
              <select
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none text-sm text-slate-800 bg-white"
              >
                <option value="">শ্রেণি নির্বাচন করুন</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">বিষয় (Subject)</label>
              <select
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 outline-none text-sm text-slate-800 bg-white"
              >
                <option value="">বিষয় নির্বাচন করুন</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex space-x-2 w-full md:w-auto">
            <button
              onClick={handleSave}
              disabled={saving || loading || !classId || !subjectId}
              className="flex items-center space-x-2 px-4 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition disabled:opacity-50 flex-1 md:flex-none justify-center cursor-pointer font-semibold text-sm shadow-sm"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>প্রশ্নপত্র সংরক্ষণ</span>
            </button>
            <button
              onClick={handlePrint}
              disabled={selectedQuestions.length === 0}
              className="flex items-center space-x-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50 flex-1 md:flex-none justify-center cursor-pointer font-semibold text-sm shadow-sm"
            >
              <Printer className="w-4 h-4" />
              <span>প্রিন্ট প্রশ্নপত্র</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-slate-900" />
          </div>
        ) : classId && subjectId ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Side: Question Bank Selection */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-[650px]">
              <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center shrink-0">
                <h3 className="font-bold text-slate-800">প্রশ্ন ব্যাংক থেকে নির্বাচন করুন</h3>
                <span className="text-xs bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full font-bold">
                  {availableQuestions.length}টি প্রশ্ন উপলব্ধ
                </span>
              </div>
              <div className="p-4 overflow-y-auto flex-1 space-y-3">
                {availableQuestions.map((q) => {
                  const isSelected = selectedQuestions.some((sq) => sq.id === q.id);
                  const isRTL = isArabicText(q.question_text);
                  return (
                    <div
                      key={q.id}
                      onClick={() => handleToggleQuestion(q)}
                      className={`p-3 rounded-lg border cursor-pointer transition ${
                        isSelected 
                          ? "border-emerald-500 bg-emerald-50/50 shadow-xs" 
                          : "border-slate-200 hover:border-slate-400 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center space-x-2">
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                          {(() => {
                            const badge = getQuestionTypeBadge(q.question_type);
                            return (
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${badge.color}`}>
                                {badge.label}
                              </span>
                            );
                          })()}
                          {q.options?.has_or && (
                            <span className="text-[10px] font-bold text-orange-800 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200">
                              + বা (أو)
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-bold text-slate-600">{toBengaliNumerals(q.marks)} Marks</span>
                      </div>
                      <SpecializedQuestionView question={q} hideMarks={true} isPrint={false} />
                    </div>
                  );
                })}
                {availableQuestions.length === 0 && (
                  <div className="text-center p-8 text-slate-500 text-sm">
                    এই শ্রেণি ও বিষয়ের কোনো প্রশ্ন প্রশ্নব্যাংকে পাওয়া যায়নি।
                  </div>
                )}
              </div>
            </div>

            {/* Right Side: Paper Preview & Customizer */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-[650px]">
              <div className="p-4 border-b border-slate-200 bg-slate-50 shrink-0">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-bold text-slate-800 flex items-center gap-1.5">
                    <FileSignature className="w-4 h-4 text-emerald-600" /> 
                    প্রশ্নপত্র প্রিভিউ ও সেটিংস
                  </h3>
                  <div className={`text-xs font-bold px-2.5 py-1 rounded-full ${currentTotalMarks > totalMarks ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-800'}`}>
                    মোট নম্বর: {toBengaliNumerals(currentTotalMarks)} / {toBengaliNumerals(totalMarks)}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">মাদরাসার নাম</label>
                    <input
                      type="text"
                      value={customMadrasaName}
                      onChange={(e) => setCustomMadrasaName(e.target.value)}
                      className="p-1.5 border border-slate-300 rounded-md outline-none text-xs w-full text-slate-800 bg-white"
                      placeholder="মাদরাসার নাম"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">পরীক্ষার নাম</label>
                    <input
                      type="text"
                      value={examName}
                      onChange={(e) => setExamName(e.target.value)}
                      className="p-1.5 border border-slate-300 rounded-md outline-none text-xs w-full text-slate-800 bg-white"
                      placeholder="উদা: ১ম সাময়িক পরীক্ষা ২০২৬"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">সময়</label>
                    <input
                      type="text"
                      value={examTime}
                      onChange={(e) => setExamTime(e.target.value)}
                      className="p-1.5 border border-slate-300 rounded-md outline-none text-xs w-full text-slate-800 bg-white"
                      placeholder="২ ঘণ্টা ৩০ মিনিট"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">পূর্ণমান</label>
                    <input
                      type="number"
                      value={totalMarks}
                      onChange={(e) => setTotalMarks(Number(e.target.value))}
                      className="p-1.5 border border-slate-300 rounded-md outline-none text-xs w-full text-slate-800 bg-white"
                    />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">নির্দেশনা (ঐচ্ছিক)</label>
                  <input
                    type="text"
                    value={paperInstructions}
                    onChange={(e) => setPaperInstructions(e.target.value)}
                    className="p-1.5 border border-slate-300 rounded-md outline-none text-xs w-full text-slate-800 bg-white"
                    placeholder="উদা: সকল প্রশ্নের উত্তর দেওয়া আবশ্যক..."
                  />
                </div>
              </div>
              
              <div className="p-6 overflow-y-auto flex-1 bg-slate-100">
                <div className={`bg-white p-6 shadow-md rounded-lg border border-slate-300 min-h-full ${selectedFont}`}>
                  <div className="text-center border-b-2 border-slate-800 pb-3 mb-6">
                    <div className="font-amiri text-sm text-slate-700 mb-1" dir="rtl">
                      بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيْمِ
                    </div>
                    <h1 className="text-xl font-bold mb-1 text-slate-900" dir="auto">{customMadrasaName}</h1>
                    {examName && <h2 className="text-md font-bold mb-0.5 text-slate-800" dir="auto">{examName}</h2>}
                    <div className="flex justify-between text-xs mt-3 pt-2 border-t border-slate-300 font-bold text-slate-700">
                      <span>শ্রেণি: {selectedClassName}</span>
                      <span>বিষয়: {selectedSubjectName}</span>
                    </div>
                    <div className="flex justify-between text-xs mt-1 font-bold text-slate-700">
                      <span>সময়: {examTime}</span>
                      <span>পূর্ণমান: {toBengaliNumerals(totalMarks)}</span>
                    </div>
                  </div>
                  
                  {paperInstructions && (
                    <div className="text-center text-xs text-slate-600 mb-6 italic border-t border-b border-dashed border-slate-300 py-2" dir="auto">
                      [{paperInstructions}]
                    </div>
                  )}

                  <div className="space-y-5">
                    {selectedQuestions.length === 0 ? (
                      <div className="text-center p-8 text-slate-400 italic">
                        বাম পাশের তালিকা থেকে প্রশ্ন নির্বাচন করে এখানে যোগ করুন।
                      </div>
                    ) : (
                      selectedQuestions.map((q, idx) => {
                        const isRTL = getQuestionDir(q.question_text) === "rtl";
                        return (
                          <div key={`${q.id || idx}-${idx}`} className="group relative p-2 rounded-lg hover:bg-slate-50 transition border border-transparent hover:border-slate-200">
                            <SpecializedQuestionView
                              question={q}
                              index={idx}
                              isRTL={isRTL}
                              formatNumber={formatQuestionNumber}
                              isPrint={false}
                            />
                            {/* Hover Controls */}
                            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 absolute right-2 top-2 bg-white/95 backdrop-blur-sm p-1 rounded-md shadow-sm border border-slate-200 z-10">
                              <button
                                type="button"
                                onClick={() => moveQuestionUp(idx)}
                                disabled={idx === 0}
                                className="p-1 text-slate-500 hover:bg-slate-200 rounded transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                title="উপরে নিন"
                              >
                                <ArrowUp className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveQuestionDown(idx)}
                                disabled={idx === selectedQuestions.length - 1}
                                className="p-1 text-slate-500 hover:bg-slate-200 rounded transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                title="নিচে নিন"
                              >
                                <ArrowDown className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleQuestion(q)}
                                className="p-1 text-red-500 hover:bg-red-50 rounded transition cursor-pointer"
                                title="প্রশ্নপত্র থেকে বাদ দিন"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white p-12 text-center rounded-xl shadow-sm border border-slate-200">
            <FileSignature className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-700">শ্রেণি ও বিষয় নির্বাচন করুন</h3>
            <p className="text-slate-500 text-sm mt-1">উপরে শ্রেণি এবং বিষয় নির্বাচন করলে প্রশ্নপত্র প্রস্তুত ও কাস্টমাইজ করা যাবে।</p>
          </div>
        )}
      </div>

      {/* Printable Layout: Visible ONLY when printing */}
      <div 
        id="exam-paper-print-view" 
        className={`hidden print:block print:w-full print:bg-white print:text-black print:p-0 print:m-0 ${selectedFont}`}
      >
        <div className="p-4 max-w-4xl mx-auto text-black bg-white">
          <div className="text-center border-b-2 border-black pb-3 mb-6">
            <div className="font-amiri text-base mb-1" dir="rtl">
              بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيْمِ
            </div>
            <h1 className="text-3xl font-extrabold mb-1" dir="auto">{customMadrasaName}</h1>
            {examName && <h2 className="text-xl font-bold mb-1" dir="auto">{examName}</h2>}
            
            <div className="flex justify-between text-sm mt-4 pt-2 border-t border-black font-bold px-2">
              <span>শ্রেণি: {selectedClassName}</span>
              <span>বিষয়: {selectedSubjectName}</span>
            </div>
            <div className="flex justify-between text-sm mt-1 font-bold px-2">
              <span>সময়: {examTime}</span>
              <span>পূর্ণমান: {toBengaliNumerals(totalMarks)}</span>
            </div>
          </div>

          {paperInstructions && (
            <div className="text-center text-xs mb-6 italic border-t border-b border-dashed border-gray-400 py-1.5" dir="auto">
              [{paperInstructions}]
            </div>
          )}

          <div className="space-y-6 px-2">
            {selectedQuestions.map((q, idx) => {
              const isRTL = getQuestionDir(q.question_text) === "rtl";
              return (
                <div key={idx} className="break-inside-avoid">
                  <SpecializedQuestionView
                    question={q}
                    index={idx}
                    isRTL={isRTL}
                    formatNumber={formatQuestionNumber}
                    isPrint={true}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          body * {
            visibility: hidden !important;
          }
          #exam-paper-print-view, #exam-paper-print-view * {
            visibility: visible !important;
          }
          #exam-paper-print-view {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            display: block !important;
            background: white !important;
            padding: 10mm 15mm !important;
          }
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
        }
      `}</style>
    </div>
  );
}
