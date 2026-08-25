"use client";

import { useState } from "react";
import { saveQuestion, deleteQuestion } from "@/app/actions/questions";
import { Plus, Trash2, Loader2, Save, Printer, FileText, Type, X } from "lucide-react";

export default function QuestionBankClient({
  classes,
  subjects,
  initialQuestions
}: {
  classes: any[];
  subjects: any[];
  initialQuestions: any[];
}) {
  const [questions, setQuestions] = useState(initialQuestions);
  
  // Filter state
  const [classFilter, setClassFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  // Paper preview modal state
  const [showPaperModal, setShowPaperModal] = useState(false);
  const [paperTitle, setPaperTitle] = useState("বার্ষিক পরীক্ষা - ২০২৬");
  const [paperTime, setPaperTime] = useState("২ ঘণ্টা ৩০ মিনিট");
  const [paperFullMarks, setPaperFullMarks] = useState("১০০");
  const [banglaFont, setBanglaFont] = useState("font-solaiman");
  const [arabicFont, setArabicFont] = useState("font-amiri");

  // New question form state
  const [isAdding, setIsAdding] = useState(false);
  const [newClassId, setNewClassId] = useState("");
  const [newSubjectId, setNewSubjectId] = useState("");
  const [newType, setNewType] = useState("Broad");
  const [newText, setNewText] = useState("");
  const [newMarks, setNewMarks] = useState(10);
  const [newOptions, setNewOptions] = useState(["", "", "", ""]);
  
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredQuestions = questions.filter(q => {
    if (classFilter && q.class_id !== classFilter) return false;
    if (subjectFilter && q.subject_id !== subjectFilter) return false;
    if (typeFilter && q.question_type !== typeFilter) return false;
    return true;
  });

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassId || !newSubjectId || !newType || !newText) {
      alert("Please fill all required fields");
      return;
    }

    setSaving(true);
    let optionsData = null;
    if (newType === "MCQ") {
      optionsData = newOptions.filter(o => o.trim() !== "");
      if (optionsData.length < 2) {
        alert("Please provide at least 2 options for MCQ");
        setSaving(false);
        return;
      }
    }

    const result = await saveQuestion({
      class_id: newClassId,
      subject_id: newSubjectId,
      question_type: newType,
      question_text: newText,
      marks: Number(newMarks),
      options: optionsData
    });

    if (result.error) {
      alert(result.error);
    } else {
      // Optimistic update would require fetching again or we can just reload
      window.location.reload();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this question?")) return;
    setDeletingId(id);
    const result = await deleteQuestion(id);
    if (!result.error) {
      setQuestions(questions.filter(q => q.id !== id));
    }
    setDeletingId(null);
  };

  return (
    <div className="space-y-6">
      {/* Filters & Actions */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 justify-between items-end">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full md:w-3/4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Class</label>
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-500 outline-none text-sm"
            >
              <option value="">All Classes</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Subject</label>
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-500 outline-none text-sm"
            >
              <option value="">All Subjects</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Question Type</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-500 outline-none text-sm"
            >
              <option value="">All Types</option>
              <option value="MCQ">MCQ</option>
              <option value="Short">Short Question</option>
              <option value="Broad">Broad Question</option>
            </select>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          <button
            onClick={() => setShowPaperModal(true)}
            className="bg-emerald-600 text-white px-4 py-2 rounded-md hover:bg-emerald-700 transition flex items-center justify-center space-x-2 text-sm font-medium"
          >
            <Printer className="w-4 h-4" />
            <span>প্রশ্নপত্র তৈরি ও প্রিন্ট</span>
          </button>
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition flex items-center justify-center space-x-2 text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            <span>নতুন প্রশ্ন যুক্ত করুন</span>
          </button>
        </div>
      </div>

      {/* Add New Question Form */}
      {isAdding && (
        <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">New Question Entry</h3>
          <form onSubmit={handleAddQuestion} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Class *</label>
                <select
                  required
                  value={newClassId}
                  onChange={(e) => setNewClassId(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-500 outline-none"
                >
                  <option value="">Select Class</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Subject *</label>
                <select
                  required
                  value={newSubjectId}
                  onChange={(e) => setNewSubjectId(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-500 outline-none"
                >
                  <option value="">Select Subject</option>
                  {subjects.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Type *</label>
                <select
                  required
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-500 outline-none"
                >
                  <option value="MCQ">MCQ</option>
                  <option value="Short">Short Question</option>
                  <option value="Broad">Broad Question</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Question Text *</label>
              <textarea
                required
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                rows={3}
                dir="auto"
                className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-500 outline-none text-start"
                placeholder="Enter the question here..."
              />
            </div>

            {newType === "MCQ" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-4 rounded-md border border-slate-200">
                <div className="col-span-full">
                  <label className="block text-sm font-medium text-slate-700">MCQ Options</label>
                </div>
                {newOptions.map((opt, idx) => (
                  <div key={idx}>
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => {
                        const newOpts = [...newOptions];
                        newOpts[idx] = e.target.value;
                        setNewOptions(newOpts);
                      }}
                      dir="auto"
                      className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-500 outline-none text-start"
                      placeholder={`Option ${idx + 1}`}
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="w-full md:w-1/3">
              <label className="block text-sm font-medium text-slate-700 mb-1">Marks *</label>
              <input
                type="number"
                required
                min="1"
                value={newMarks}
                onChange={(e) => setNewMarks(Number(e.target.value))}
                className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-500 outline-none"
              />
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center space-x-2 bg-slate-900 text-white px-4 py-2 rounded-md hover:bg-slate-800 transition disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>Save Question</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Questions List */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b">
              <tr>
                <th className="px-6 py-4 w-1/2">Question</th>
                <th className="px-6 py-4">Class & Subject</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Marks</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredQuestions.map((q) => (
                <tr key={q.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <p className="font-medium text-slate-800 mb-1 text-start" dir="auto">{q.question_text}</p>
                    {q.question_type === "MCQ" && q.options && (
                      <ul className="list-disc list-inside text-xs text-slate-500 grid grid-cols-2 gap-1 mt-2">
                        {q.options.map((opt: string, i: number) => (
                          <li key={i} dir="auto" className="text-start">{opt}</li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-700">{q.class?.name}</div>
                    <div className="text-xs text-slate-500">{q.subject?.name}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-block px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs">
                      {q.question_type}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-700">{q.marks}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleDelete(q.id)}
                      disabled={deletingId === q.id}
                      className="text-red-500 hover:bg-red-50 p-2 rounded-md transition disabled:opacity-50"
                    >
                      {deletingId === q.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </td>
                </tr>
              ))}
              {filteredQuestions.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    কোনো প্রশ্ন পাওয়া যায়নি। নতুন প্রশ্ন যুক্ত করুন। (No questions found)
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Question Paper Preview Modal */}
      {showPaperModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto print:hidden">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-lg">প্রশ্নপত্র কাস্টমাইজ ও প্রিন্ট</h3>
              </div>
              <button 
                onClick={() => setShowPaperModal(false)}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-300 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Controls */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">পরীক্ষার শিরোনাম</label>
                <input 
                  type="text" 
                  value={paperTitle} 
                  onChange={(e) => setPaperTitle(e.target.value)}
                  className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">সময়</label>
                <input 
                  type="text" 
                  value={paperTime} 
                  onChange={(e) => setPaperTime(e.target.value)}
                  className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">পূর্ণমান</label>
                <input 
                  type="text" 
                  value={paperFullMarks} 
                  onChange={(e) => setPaperFullMarks(e.target.value)}
                  className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1">
                  <Type className="w-3.5 h-3.5 text-emerald-600" />
                  <span>বাংলা ফন্ট</span>
                </label>
                <select 
                  value={banglaFont} 
                  onChange={(e) => setBanglaFont(e.target.value)}
                  className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-medium"
                >
                  <option value="font-solaiman">সোলাইমান লিপি (ডিফল্ট)</option>
                  <option value="font-shorif">শরীফ শিশির</option>
                  <option value="font-hindsiliguri">হিন্দ শিলিগুড়ি</option>
                </select>
              </div>
            </div>

            {/* Paper Live Preview */}
            <div className="p-6 overflow-y-auto flex-1 bg-slate-200 flex justify-center">
              <div 
                id="question-paper-print" 
                className={`bg-white p-8 shadow-md rounded-lg w-full max-w-3xl border border-slate-300 ${banglaFont}`}
              >
                {/* Paper Header */}
                <div className="text-center border-b-2 border-slate-800 pb-4 mb-6">
                  <h1 className="text-2xl font-bold text-slate-900">জামিয়া কাসেমিয়া মাদরাসা</h1>
                  <h2 className="text-lg font-bold text-slate-800 mt-1">{paperTitle}</h2>
                  <div className="flex justify-between items-center text-sm font-semibold text-slate-700 mt-3 pt-2 border-t border-slate-300">
                    <span>বিষয়: {subjects.find(s => s.id === subjectFilter)?.name || "সকল বিষয়"}</span>
                    <span>সময়: {paperTime}</span>
                    <span>পূর্ণমান: {paperFullMarks}</span>
                  </div>
                </div>

                {/* Question List */}
                <div className="space-y-6">
                  {filteredQuestions.map((q, idx) => (
                    <div key={q.id} className="space-y-1">
                      <div className="flex justify-between items-start">
                        <p className="font-semibold text-slate-900 text-start text-base" dir="auto">
                          {idx + 1}. {q.question_text}
                        </p>
                        <span className="font-bold text-slate-700 text-sm shrink-0 ml-2">[{q.marks}]</span>
                      </div>
                      {q.question_type === "MCQ" && q.options && (
                        <div className="grid grid-cols-2 gap-2 pl-6 mt-2 text-sm text-slate-800">
                          {q.options.map((opt: string, i: number) => (
                            <div key={i} dir="auto" className="text-start">
                              ({String.fromCharCode(2453 + i)}) {opt}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {filteredQuestions.length === 0 && (
                    <p className="text-center text-slate-500 py-8">কোনো প্রশ্ন নির্বাচন করা হয়নি।</p>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-white border-t border-slate-200 flex justify-end space-x-3">
              <button 
                onClick={() => setShowPaperModal(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition"
              >
                বন্ধ করুন
              </button>
              <button 
                onClick={() => window.print()}
                className="flex items-center space-x-2 bg-emerald-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-emerald-700 transition shadow-sm"
              >
                <Printer className="w-4 h-4" />
                <span>প্রিন্ট প্রশ্নপত্র</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Area for CSS @media print */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * {
            visibility: hidden;
          }
          #question-paper-print, #question-paper-print * {
            visibility: visible;
          }
          #question-paper-print {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            border: none !important;
            box-shadow: none !important;
            padding: 20px !important;
          }
        }
      `}} />
    </div>
  );
}
