"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Save, CheckCircle2, AlertCircle } from "lucide-react";

export default function AttendanceForm({ classes, students, existingAttendance, currentDate, currentClassId }: any) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  
  const [attendanceState, setAttendanceState] = useState<Record<string, { status: string, notes: string }>>(() => {
    const initialState: Record<string, { status: string, notes: string }> = {};
    students.forEach((s: any) => {
      const existing = existingAttendance.find((a: any) => a.student_id === s.id);
      initialState[s.id] = {
        status: existing?.status || 'Present',
        notes: existing?.notes || ''
      };
    });
    return initialState;
  });

  const handleClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    router.push(`/teacher-portal/attendance?class_id=${e.target.value}&date=${currentDate}`);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    router.push(`/teacher-portal/attendance?class_id=${currentClassId}&date=${e.target.value}`);
  };

  const handleStatusChange = (studentId: string, status: string) => {
    setAttendanceState(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], status }
    }));
  };

  const handleNotesChange = (studentId: string, notes: string) => {
    setAttendanceState(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], notes }
    }));
  };

  const saveAttendance = async () => {
    setLoading(true);
    setMessage("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: userData } = await supabase.from("users").select("madrasa_id").eq("id", user.id).single();
      const madrasaId = userData?.madrasa_id;

      // Upsert records
      const recordsToUpsert = students.map((s: any) => {
        const existing = existingAttendance.find((a: any) => a.student_id === s.id);
        const state = attendanceState[s.id];
        return {
          id: existing?.id, // if undefined, it creates a new record in supabase if primary key is not provided (wait, we need to let supabase generate UUID if undefined)
          madrasa_id: madrasaId,
          student_id: s.id,
          class_id: currentClassId,
          date: currentDate,
          status: state.status,
          notes: state.notes,
        };
      }).map((r: any) => {
         if (!r.id) delete r.id; // ensure no undefined id is sent
         return r;
      });

      const { error } = await supabase.from("attendance").upsert(recordsToUpsert, { onConflict: "student_id, date" });

      if (error) {
        // Upsert on multiple columns might require a unique constraint. If it doesn't exist, we might need to delete existing and insert.
        // Let's do delete and insert to be safe if no unique constraint on (student_id, date) exists.
        await supabase.from("attendance").delete().eq("class_id", currentClassId).eq("date", currentDate);
        const { error: insertError } = await supabase.from("attendance").insert(recordsToUpsert);
        if (insertError) throw insertError;
      }

      setMessage("Attendance saved successfully!");
      router.refresh();
    } catch (err: any) {
      console.error(err);
      setMessage("Failed to save attendance.");
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
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Roll</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Notes (Optional)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {students.length > 0 ? students.map((s: any) => (
                <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-sm text-slate-600 font-medium">{s.roll_number || '-'}</td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-800">{s.first_name} {s.last_name}</td>
                  <td className="px-6 py-4">
                    <div className="flex space-x-2">
                      {['Present', 'Absent', 'Late'].map((status) => (
                        <button
                          key={status}
                          onClick={() => handleStatusChange(s.id, status)}
                          className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                            attendanceState[s.id]?.status === status 
                              ? (status === 'Present' ? 'bg-green-100 border-green-200 text-green-800' : 
                                 status === 'Absent' ? 'bg-red-100 border-red-200 text-red-800' : 
                                 'bg-amber-100 border-amber-200 text-amber-800')
                              : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                          }`}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <input 
                      type="text" 
                      placeholder="Reason for absence..." 
                      className="w-full text-sm border-b border-slate-200 pb-1 focus:border-indigo-500 outline-none bg-transparent"
                      value={attendanceState[s.id]?.notes || ''}
                      onChange={(e) => handleNotesChange(s.id, e.target.value)}
                    />
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
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
            onClick={saveAttendance}
            disabled={loading || students.length === 0}
            className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-md shadow-sm transition disabled:opacity-50"
          >
            <Save className="w-4 h-4 mr-2" />
            {loading ? "Saving..." : "Save Attendance"}
          </button>
        </div>
      </div>
    </div>
  );
}
