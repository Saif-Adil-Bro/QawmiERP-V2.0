"use client";

import { useState, useRef, useEffect } from "react";
import { getExamPaper, saveExamPaper } from "@/app/actions/questions";
import { Plus, Trash2, Printer, Loader2, Save, FileSignature, CheckCircle2 } from "lucide-react";

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
  const [paperTitle, setPaperTitle] = useState("Final Exam Paper");
  const [examName, setExamName] = useState("");
  const [examTime, setExamTime] = useState("");
  const [totalMarks, setTotalMarks] = useState(100);
  const [selectedQuestions, setSelectedQuestions] = useState<any[]>([]);
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
      setPaperTitle(`${exam.title} - Question Paper`);
      setTotalMarks(100);
      setExamName(exam.title || "");
      setExamTime("");
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
    if (result.error) {
      alert(result.error);
    } else {
      alert("প্রশ্নপত্রটি সফলভাবে সংরক্ষণ করা হয়েছে!");
    }
    setSaving(false);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div>
      {/* Interactive Layout: Hidden when printing */}
      <div className="space-y-6 print:hidden">
        {/* Filters & Actions */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 justify-between items-end">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full md:w-1/2">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">শ্রেণি (Class)</label>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none text-sm text-slate-700 bg-white"
            >
              <option value="">শ্রেণি নির্বাচন করুন</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">বিষয় (Subject)</label>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none text-sm text-slate-700 bg-white"
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
            className="flex items-center space-x-2 px-4 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800 transition disabled:opacity-50 flex-1 md:flex-none justify-center cursor-pointer font-medium text-sm"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>প্রশ্নপত্র সংরক্ষণ করুন</span>
          </button>
          <button
            onClick={handlePrint}
            disabled={selectedQuestions.length === 0}
            className="flex items-center space-x-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-md hover:bg-indigo-100 transition disabled:opacity-50 flex-1 md:flex-none justify-center cursor-pointer font-medium text-sm"
          >
            <Printer className="w-4 h-4" />
            <span>প্রিন্ট করুন / PDF</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      ) : classId && subjectId ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Side: Question Bank Selection */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-[600px]">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center shrink-0">
              <h3 className="font-bold text-slate-800">প্রশ্ন ব্যাংক (Question Bank)</h3>
              <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full font-medium">
                {availableQuestions.length}টি প্রশ্ন রয়েছে
              </span>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-3">
              {availableQuestions.map((q) => {
                const isSelected = selectedQuestions.some((sq) => sq.id === q.id);
                return (
                  <div
                    key={q.id}
                    onClick={() => handleToggleQuestion(q)}
                    className={`p-3 rounded-lg border cursor-pointer transition ${
                      isSelected 
                        ? "border-indigo-500 bg-indigo-50" 
                        : "border-slate-200 hover:border-indigo-300 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center space-x-2">
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-indigo-600" />}
                        <span className="text-xs font-medium px-2 py-1 bg-white border border-slate-200 rounded text-slate-600">
                          {q.question_type}
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-slate-500">{q.marks} Marks</span>
                    </div>
                    <p className="text-sm font-medium text-slate-800 text-start" dir="auto">{q.question_text}</p>
                    {q.question_type === "MCQ" && q.options && (
                      <div className="mt-2 text-xs text-slate-500 grid grid-cols-2 gap-1">
                        {q.options.map((opt: string, i: number) => (
                          <div key={i} dir="auto" className="text-start">• {opt}</div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {availableQuestions.length === 0 && (
                <div className="text-center p-8 text-slate-500 text-sm">
                  No questions found for this class and subject in the Question Bank.
                </div>
              )}
            </div>
          </div>

          {/* Right Side: Paper Preview */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-[600px]">
            <div className="p-4 border-b border-slate-200 bg-slate-50 shrink-0">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-1.5">
                  <FileSignature className="w-4 h-4 text-indigo-600" /> 
                  প্রশ্নপত্র প্রিভিউ (Paper Preview)
                </h3>
                <div className={`text-xs font-semibold px-2 py-1 rounded-full ${currentTotalMarks > totalMarks ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  নির্বাচিত মার্কস: {currentTotalMarks} / {totalMarks}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-1">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">পরীক্ষার নাম (উদা: ১ম সাময়িক / টেস্ট পরীক্ষা)</label>
                  <input
                    type="text"
                    value={examName}
                    onChange={(e) => setExamName(e.target.value)}
                    dir="auto"
                    className="p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none text-xs w-full text-slate-800 text-start"
                    placeholder="উদা: অর্ধবার্ষিক পরীক্ষা ২০২৬"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">প্রশ্নের শিরোনাম/বিষয় (উদা: আল-কুরআন ১ম পত্র)</label>
                  <input
                    type="text"
                    value={paperTitle}
                    onChange={(e) => setPaperTitle(e.target.value)}
                    dir="auto"
                    className="p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none text-xs w-full text-slate-800 text-start"
                    placeholder="উদা: আল-কুরআন"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">পরীক্ষার সময় (উদা: ২ ঘণ্টা ৩০ মিনিট)</label>
                  <input
                    type="text"
                    value={examTime}
                    onChange={(e) => setExamTime(e.target.value)}
                    dir="auto"
                    className="p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none text-xs w-full text-slate-800 text-start"
                    placeholder="উদা: ২ ঘণ্টা ৩০ মিনিট"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">পূর্ণমান / মোট নম্বর</label>
                  <input
                    type="number"
                    value={totalMarks}
                    onChange={(e) => setTotalMarks(Number(e.target.value))}
                    dir="auto"
                    className="p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 outline-none text-xs w-full text-slate-800 text-start"
                    placeholder="উদা: ১০০"
                  />
                </div>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 bg-slate-50">
              <div className="bg-white p-6 shadow-sm border border-slate-200 min-h-full" style={{ fontFamily: 'inherit' }}>
                <div className="text-center border-b-2 border-slate-800 pb-3 mb-6">
                  <h1 className="text-xl font-bold mb-1 text-slate-900" dir="auto">{madrasa?.name || 'Madrasa Name'}</h1>
                  {examName && <h2 className="text-md font-bold mb-0.5 text-slate-800" dir="auto">{examName}</h2>}
                  <h3 className="text-sm font-semibold text-slate-700" dir="auto">{paperTitle}</h3>
                  <div className="flex justify-between text-xs mt-4 font-medium text-slate-600">
                    <span>শ্রেণি: {classes.find((c) => c.id === classId)?.name}</span>
                    <span>বিষয়: {subjects.find((s) => s.id === subjectId)?.name}</span>
                  </div>
                  <div className="flex justify-between text-xs mt-1 font-medium text-slate-600">
                    <span>সময়: {examTime || "_________________"}</span>
                    <span>পূর্ণমান: {totalMarks}</span>
                  </div>
                </div>

                <div className="space-y-6">
                  {selectedQuestions.length === 0 ? (
                    <div className="text-center p-8 text-slate-400 italic">
                      Select questions from the left panel to add to this paper.
                    </div>
                  ) : (
                    selectedQuestions.map((q, idx) => (
                      <div key={idx} className="flex gap-4">
                        <div className="font-semibold">{idx + 1}.</div>
                        <div className="flex-1">
                          <div className="flex justify-between items-start">
                            <p className="font-medium text-slate-900 text-start" dir="auto">{q.question_text}</p>
                            <span className="text-sm font-semibold ml-4">[{q.marks}]</span>
                          </div>
                          {q.question_type === "MCQ" && q.options && (
                            <div className="grid grid-cols-2 gap-2 mt-3 ml-2">
                              {q.options.map((opt: string, i: number) => (
                                <div key={i} className="flex items-center text-sm text-start" dir="auto">
                                  <span className="mr-2 shrink-0">({String.fromCharCode(97 + i)})</span> <span>{opt}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white p-12 text-center rounded-xl shadow-sm border border-slate-200">
          <FileSignature className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-600">Select Class and Subject</h3>
          <p className="text-slate-400">Choose a class and subject above to start generating a question paper.</p>
        </div>
      )}
      </div>

      {/* Printable Layout: Visible ONLY when printing */}
      <div className="hidden print:block print:bg-white print:text-black print:p-0 print:m-0 w-full">
        <div className="p-8 max-w-4xl mx-auto text-black bg-white" style={{ fontFamily: 'inherit' }}>
          <div className="text-center border-b-[3px] border-black pb-4 mb-6">
            <h1 className="text-3xl font-bold mb-2" dir="auto">{madrasa?.name || 'Madrasa Name'}</h1>
            {madrasa?.address && <p className="text-base mb-2" dir="auto">{madrasa.address}</p>}
            {examName && <h2 className="text-2xl font-bold mb-1" dir="auto">{examName}</h2>}
            <h3 className="text-xl font-bold mb-2" dir="auto">{paperTitle}</h3>
            
            <div className="flex justify-between text-base mt-6 font-bold px-4">
              <span>শ্রেণি: {classes.find((c) => c.id === classId)?.name}</span>
              <span>বিষয়: {subjects.find((s) => s.id === subjectId)?.name}</span>
            </div>
            <div className="flex justify-between text-base mt-2 font-bold px-4">
              <span>সময়: {examTime || "__________________"}</span>
              <span>পূর্ণমান: {totalMarks}</span>
            </div>
          </div>

          <div className="space-y-6 px-4">
            {selectedQuestions.map((q, idx) => (
              <div key={idx} className="flex gap-4 break-inside-avoid">
                <div className="font-bold text-lg">{idx + 1}.</div>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <p className="text-lg leading-relaxed text-start" dir="auto">{q.question_text}</p>
                    <span className="text-base font-bold ml-4 shrink-0">[{q.marks}]</span>
                  </div>
                  {q.question_type === "MCQ" && q.options && (
                    <div className="grid grid-cols-2 gap-4 mt-4 ml-2">
                      {q.options.map((opt: string, i: number) => (
                        <div key={i} className="flex items-center text-base text-start" dir="auto">
                          <span className="mr-2 font-medium shrink-0">({String.fromCharCode(97 + i)})</span> <span>{opt}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
