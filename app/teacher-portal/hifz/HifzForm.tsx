"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Save, CheckCircle2, AlertCircle } from "lucide-react";

export default function HifzForm({ classes, students, existingLogs, currentDate, currentClassId, teacherId }: any) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  
  const [hifzState, setHifzState] = useState<Record<string, any>>(() => {
    const initialState: Record<string, any> = {};
    students.forEach((s: any) => {
      const existing = existingLogs.find((l: any) => l.student_id === s.id);
      initialState[s.id] = {
        sabak_para: existing?.sabak_para || '',
        saboki_para: existing?.saboki_para || '',
        amukhta_para: existing?.amukhta_para || '',
        performance_rating: existing?.performance_rating || 'Good',
        notes: existing?.notes || ''
      };
    });
    return initialState;
  });

  const handleClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    router.push(`/teacher-portal/hifz?class_id=${e.target.value}&date=${currentDate}`);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    router.push(`/teacher-portal/hifz?class_id=${currentClassId}&date=${e.target.value}`);
  };

  const handleChange = (studentId: string, field: string, value: string) => {
    setHifzState(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], [field]: value }
    }));
  };

  const saveLogs = async () => {
    setLoading(true);
    setMessage("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // We might not have a teacherId if the user role is not perfectly mapped.
      // We will handle it by just skipping teacherId if null, though the schema allows it to be null.

      const recordsToUpsert = students.map((s: any) => {
        const existing = existingLogs.find((l: any) => l.student_id === s.id);
        const state = hifzState[s.id];
        return {
          id: existing?.id,
          student_id: s.id,
          teacher_id: teacherId || null,
          log_date: currentDate,
          sabak_para: state.sabak_para,
          saboki_para: state.saboki_para,
          amukhta_para: state.amukhta_para,
          performance_rating: state.performance_rating,
          notes: state.notes,
        };
      }).map((r: any) => {
         if (!r.id) delete r.id; 
         return r;
      });

      const { error } = await supabase.from("hifz_logs").upsert(recordsToUpsert, { onConflict: "student_id, log_date" });

      if (error) {
        // Fallback for upsert failure without constraint
        for (const record of recordsToUpsert) {
            const { error: matchErr, data: existing } = await supabase.from("hifz_logs").select("id").eq("student_id", record.student_id).eq("log_date", record.log_date).maybeSingle();
            if (existing) {
                await supabase.from("hifz_logs").update(record).eq("id", existing.id);
            } else {
                await supabase.from("hifz_logs").insert([record]);
            }
        }
      }

      setMessage("Hifz logs saved successfully!");
      router.refresh();
    } catch (err: any) {
      console.error(err);
      setMessage("Failed to save Hifz logs.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 md:space-x-6">
        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-700 mb-1">Select Class</label>
          <select value={currentClassId} onChange={handleClassChange} className="w-full p-2 border border-slate-300 rounded-md bg-slate-50 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none">
            {classes.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
          <input type="date" value={currentDate} onChange={handleDateChange} className="w-full p-2 border border-slate-300 rounded-md bg-slate-50 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Student</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Sabak (Para/Surah)</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Saboki</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Amukhta</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Rating</th>
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
                      type="text" 
                      placeholder="e.g. Para 30" 
                      className="w-full text-sm p-1.5 border border-slate-200 rounded-md focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                      value={hifzState[s.id]?.sabak_para || ''}
                      onChange={(e) => handleChange(s.id, 'sabak_para', e.target.value)}
                    />
                  </td>
                  <td className="px-6 py-4">
                    <input 
                      type="text" 
                      className="w-full text-sm p-1.5 border border-slate-200 rounded-md focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                      value={hifzState[s.id]?.saboki_para || ''}
                      onChange={(e) => handleChange(s.id, 'saboki_para', e.target.value)}
                    />
                  </td>
                  <td className="px-6 py-4">
                    <input 
                      type="text" 
                      className="w-full text-sm p-1.5 border border-slate-200 rounded-md focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                      value={hifzState[s.id]?.amukhta_para || ''}
                      onChange={(e) => handleChange(s.id, 'amukhta_para', e.target.value)}
                    />
                  </td>
                  <td className="px-6 py-4">
                    <select 
                      className="w-full text-sm p-1.5 border border-slate-200 rounded-md focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none bg-white"
                      value={hifzState[s.id]?.performance_rating || 'Good'}
                      onChange={(e) => handleChange(s.id, 'performance_rating', e.target.value)}
                    >
                      <option value="Excellent">Excellent</option>
                      <option value="Good">Good</option>
                      <option value="Average">Average</option>
                      <option value="Poor">Poor</option>
                    </select>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
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
            onClick={saveLogs}
            disabled={loading || students.length === 0}
            className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-md shadow-sm transition disabled:opacity-50"
          >
            <Save className="w-4 h-4 mr-2" />
            {loading ? "Saving..." : "Save Hifz Logs"}
          </button>
        </div>
      </div>
    </div>
  );
}
