"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Save, CheckCircle2, AlertCircle } from "lucide-react";

export default function ExamMarksForm({ exams, classes, students, existingMarks, currentExamId, currentClassId, currentSubject }: any) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  
  const [marksState, setMarksState] = useState<Record<string, { marks_obtained: string, total_marks: string }>>(() => {
    const initialState: Record<string, any> = {};
    students.forEach((s: any) => {
      const existing = existingMarks.find((m: any) => m.student_id === s.id);
      initialState[s.id] = {
        marks_obtained: existing?.marks_obtained?.toString() || '',
        total_marks: existing?.total_marks?.toString() || '100',
      };
    });
    return initialState;
  });

  const handleFilterChange = (key: string, value: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set(key, value);
    router.push(url.pathname + url.search);
  };

  const handleChange = (studentId: string, field: string, value: string) => {
    setMarksState(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], [field]: value }
    }));
  };

  const saveMarks = async () => {
    setLoading(true);
    setMessage("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const recordsToUpsert = students.map((s: any) => {
        const existing = existingMarks.find((m: any) => m.student_id === s.id);
        const state = marksState[s.id];
        
        // Skip if marks not entered
        if (state.marks_obtained === '') return null;

        return {
          id: existing?.id,
          student_id: s.id,
          exam_id: currentExamId,
          subject_name: currentSubject,
          marks_obtained: Number(state.marks_obtained),
          total_marks: Number(state.total_marks),
        };
      }).filter(Boolean).map((r: any) => {
         if (!r.id) delete r.id; 
         return r;
      });

      if (recordsToUpsert.length === 0) {
        setMessage("No marks entered to save.");
        setLoading(false);
        return;
      }

      const { error } = await supabase.from("exam_results").upsert(recordsToUpsert, { onConflict: "student_id, exam_id, subject_name" });

      if (error) {
         // Fallback manual update/insert if unique constraint missing
         for (const record of recordsToUpsert) {
            const { error: matchErr, data: existing } = await supabase.from("exam_results")
                .select("id")
                .eq("student_id", record.student_id)
                .eq("exam_id", record.exam_id)
                .eq("subject_name", record.subject_name)
                .maybeSingle();
            
            if (existing) {
                await supabase.from("exam_results").update(record).eq("id", existing.id);
            } else {
                await supabase.from("exam_results").insert([record]);
            }
        }
      }

      setMessage("Marks saved successfully!");
      router.refresh();
    } catch (err: any) {
      console.error(err);
      setMessage("Failed to save marks.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Select Exam</label>
          <select value={currentExamId} onChange={(e) => handleFilterChange('exam_id', e.target.value)} className="w-full p-2 border border-slate-300 rounded-md bg-slate-50 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none">
            {exams.map((e: any) => (
              <option key={e.id} value={e.id}>{e.title} ({e.year})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Select Class</label>
          <select value={currentClassId} onChange={(e) => handleFilterChange('class_id', e.target.value)} className="w-full p-2 border border-slate-300 rounded-md bg-slate-50 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none">
            {classes.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
          <input 
            type="text" 
            value={currentSubject} 
            onChange={(e) => handleFilterChange('subject_name', e.target.value)} 
            placeholder="e.g. Quran, Arabic"
            className="w-full p-2 border border-slate-300 rounded-md bg-slate-50 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" 
          />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider w-1/2">Student</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider w-1/4">Marks Obtained</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider w-1/4">Total Marks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {students.length > 0 ? students.map((s: any) => (
                <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold text-slate-800">{s.first_name} {s.last_name}</div>
                    <div className="text-xs text-slate-500">Roll: {s.roll_number || '-'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <input 
                      type="number" 
                      placeholder="Obtained" 
                      className="w-full text-sm p-1.5 border border-slate-200 rounded-md focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                      value={marksState[s.id]?.marks_obtained || ''}
                      onChange={(e) => handleChange(s.id, 'marks_obtained', e.target.value)}
                    />
                  </td>
                  <td className="px-6 py-4">
                    <input 
                      type="number" 
                      className="w-full text-sm p-1.5 border border-slate-200 rounded-md focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none bg-slate-50 text-slate-500"
                      value={marksState[s.id]?.total_marks || '100'}
                      onChange={(e) => handleChange(s.id, 'total_marks', e.target.value)}
                    />
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-slate-500">
                    No students found in this class.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="text-sm font-medium">
            {message && (
              <span className={`flex items-center ${message.includes("success") ? 'text-green-600' : 'text-red-600'}`}>
                {message.includes("success") ? <CheckCircle2 className="w-4 h-4 mr-2" /> : <AlertCircle className="w-4 h-4 mr-2" />}
                {message}
              </span>
            )}
          </div>
          <button 
            onClick={saveMarks}
            disabled={loading || students.length === 0}
            className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-md shadow-sm transition disabled:opacity-50"
          >
            <Save className="w-4 h-4 mr-2" />
            {loading ? "Saving..." : "Save Exam Marks"}
          </button>
        </div>
      </div>
    </div>
  );
}
