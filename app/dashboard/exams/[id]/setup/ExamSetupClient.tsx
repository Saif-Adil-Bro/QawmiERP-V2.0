"use client";

import { useState, useEffect } from "react";
import { getExamSubjects, saveExamSubjects } from "@/app/actions/exams";
import { Plus, Trash2, Save } from "lucide-react";

export default function ExamSetupClient({ examId, classes }: { examId: string, classes: any[] }) {
  const [classId, setClassId] = useState("");
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (classId) {
      loadSubjects();
    } else {
      setSubjects([]);
    }
  }, [classId]);

  const loadSubjects = async () => {
    setLoading(true);
    const data = await getExamSubjects(examId, classId);
    if (data && data.length > 0) {
      setSubjects(data);
    } else {
      setSubjects([{ subject_name: "", total_marks: 100, pass_marks: 33, exam_type: "Written" }]);
    }
    setLoading(false);
  };

  const handleAddSubject = () => {
    setSubjects([...subjects, { subject_name: "", total_marks: 100, pass_marks: 33, exam_type: "Written" }]);
  };

  const handleRemoveSubject = (index: number) => {
    const newSubjects = [...subjects];
    newSubjects.splice(index, 1);
    setSubjects(newSubjects);
  };

  const handleChange = (index: number, field: string, value: string | number) => {
    const newSubjects = [...subjects];
    newSubjects[index][field] = value;
    setSubjects(newSubjects);
  };

  const handleSave = async () => {
    if (!classId) return alert("দয়া করে ক্লাস নির্বাচন করুন");
    
    for (const sub of subjects) {
      if (!sub.subject_name) return alert("সব বিষয়ের নাম দিতে হবে");
    }
    
    setSaving(true);
    const res = await saveExamSubjects(examId, classId, subjects);
    setSaving(false);
    
    if (res?.error) {
      alert("Error: " + res.error);
    } else {
      alert("সফলভাবে সেভ হয়েছে!");
    }
  };

  return (
    <div className="space-y-6">
      <div className="max-w-md">
        <label className="block text-sm font-medium text-slate-700 mb-1">ক্লাস নির্বাচন করুন</label>
        <select
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
          className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 transition bg-white"
        >
          <option value="">নির্বাচন করুন...</option>
          {classes.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {classId && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <h3 className="text-lg font-medium text-slate-800">বিষয়ের তালিকা ও মান বণ্টন</h3>
            <button
              onClick={handleAddSubject}
              className="flex items-center space-x-1 text-sm bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-md transition border border-indigo-200"
            >
              <Plus className="w-4 h-4" />
              <span>নতুন বিষয়</span>
            </button>
          </div>

          {loading ? (
            <div className="py-8 text-center text-slate-500">লোড হচ্ছে...</div>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap min-w-[600px]">
                <thead className="bg-slate-50 text-slate-700 border-b">
                  <tr>
                    <th className="px-4 py-3 font-medium">বিষয়ের নাম</th>
                    <th className="px-4 py-3 font-medium w-24">মোট নম্বর</th>
                    <th className="px-4 py-3 font-medium w-24">পাস নম্বর</th>
                    <th className="px-4 py-3 font-medium w-36">পরীক্ষার ধরন</th>
                    <th className="px-4 py-3 font-medium w-16 text-center">মুছুন</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {subjects.map((sub, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={sub.subject_name}
                          onChange={(e) => handleChange(idx, 'subject_name', e.target.value)}
                          placeholder="যেমন: কুরআন মাজীদ"
                          className="w-full px-3 py-1.5 border rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          value={sub.total_marks}
                          onChange={(e) => handleChange(idx, 'total_marks', parseInt(e.target.value))}
                          className="w-full px-3 py-1.5 border rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          value={sub.pass_marks}
                          onChange={(e) => handleChange(idx, 'pass_marks', parseInt(e.target.value))}
                          className="w-full px-3 py-1.5 border rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <select
                          value={sub.exam_type}
                          onChange={(e) => handleChange(idx, 'exam_type', e.target.value)}
                          className="w-full px-3 py-1.5 border rounded focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                        >
                          <option value="Written">লিখিত (Written)</option>
                          <option value="Oral">মৌখিক (Oral)</option>
                          <option value="Practical">প্রাক্টিক্যাল (Practical)</option>
                        </select>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <button
                          onClick={() => handleRemoveSubject(idx)}
                          className="text-red-500 hover:bg-red-50 p-1.5 rounded-md transition"
                          title="মুছুন"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {subjects.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                        কোনো বিষয় যোগ করা হয়নি।
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end pt-4">
            <button
              onClick={handleSave}
              disabled={saving || subjects.length === 0}
              className="flex items-center space-x-2 bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 transition disabled:opacity-50 font-medium shadow-sm"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? "সেভ হচ্ছে..." : "সেভ করুন"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
