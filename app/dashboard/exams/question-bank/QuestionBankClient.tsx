"use client";

import { useState } from "react";
import { saveQuestion, deleteQuestion } from "@/app/actions/questions";
import { Plus, Trash2, Loader2, Save } from "lucide-react";

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
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition flex items-center space-x-2 w-full md:w-auto justify-center"
        >
          <Plus className="w-4 h-4" />
          <span>Add Question</span>
        </button>
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
    </div>
  );
}
