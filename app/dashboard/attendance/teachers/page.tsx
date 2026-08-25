"use client";

import { useState, useEffect } from "react";
import { getTeachersForAttendance, saveTeacherAttendance } from "@/app/actions/attendance";
import { format } from "date-fns";
import { Check, X, Clock, UserMinus, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function TeacherAttendancePage() {
  const [date, setDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const data = await getTeachersForAttendance(date);
      setTeachers(data);
      setLoading(false);
    }
    loadData();
  }, [date]);

  const handleStatusChange = (teacherId: string, status: string) => {
    setTeachers(prev => 
      prev.map(t => t.id === teacherId ? { ...t, status } : t)
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    const attendanceData = teachers.map(t => ({
      teacher_id: t.id,
      status: t.status,
    }));
    
    const result = await saveTeacherAttendance(date, attendanceData);
    
    if (result.error) {
      setMessage({ type: 'error', text: result.error });
    } else {
      setMessage({ type: 'success', text: 'স্টাফদের হাজিরা সফলভাবে সেভ করা হয়েছে!' });
      setTimeout(() => setMessage(null), 3000);
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Link
          href="/dashboard/attendance"
          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">স্টাফ হাজিরা</h1>
          <p className="text-slate-500 text-sm">শিক্ষক এবং স্টাফদের দৈনিক হাজিরা এন্ট্রি</p>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-md text-sm font-medium ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex flex-col sm:flex-row gap-4 items-end mb-6">
          <div className="w-full sm:w-auto">
            <label className="block text-sm font-medium text-slate-700 mb-1">তারিখ</label>
            <input 
              type="date" 
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
            />
          </div>
          <div className="ml-auto w-full sm:w-auto flex space-x-3">
            <button 
              onClick={() => {
                setTeachers(prev => prev.map(t => ({ ...t, status: 'Present' })));
              }}
              className="w-full sm:w-auto px-4 py-2 border border-slate-300 rounded-md text-slate-700 hover:bg-slate-50 transition text-sm font-medium"
            >
              সবাই উপস্থিত
            </button>
            <button 
              onClick={handleSave}
              disabled={saving || loading || teachers.length === 0}
              className="w-full sm:w-auto px-4 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800 disabled:opacity-50 transition text-sm font-medium"
            >
              {saving ? "সেভ হচ্ছে..." : "হাজিরা সেভ করুন"}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-500">ডাটা লোড হচ্ছে...</div>
        ) : teachers.length === 0 ? (
          <div className="py-12 text-center text-slate-500">কোনো স্টাফ পাওয়া যায়নি।</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-700 font-medium border-b">
                <tr>
                  <th className="px-6 py-3">নাম</th>
                  <th className="px-6 py-3">পদবী</th>
                  <th className="px-6 py-3 text-center">হাজিরার অবস্থা</th>
                </tr>
              </thead>
              <tbody className="divide-y text-slate-600">
                {teachers.map((teacher) => (
                  <tr key={teacher.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-6 py-4 font-medium text-slate-900">
                      {teacher.first_name} {teacher.last_name}
                    </td>
                    <td className="px-6 py-4">{teacher.designation || '-'}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center space-x-2">
                        <button
                          onClick={() => handleStatusChange(teacher.id, 'Present')}
                          className={`p-2 rounded-md border flex items-center justify-center transition-all ${
                            teacher.status === 'Present' 
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm' 
                              : 'bg-white border-slate-200 text-slate-400 hover:border-emerald-300 hover:text-emerald-600'
                          }`}
                          title="উপস্থিত"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleStatusChange(teacher.id, 'Absent')}
                          className={`p-2 rounded-md border flex items-center justify-center transition-all ${
                            teacher.status === 'Absent' 
                              ? 'bg-red-50 border-red-200 text-red-700 shadow-sm' 
                              : 'bg-white border-slate-200 text-slate-400 hover:border-red-300 hover:text-red-600'
                          }`}
                          title="অনুপস্থিত"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleStatusChange(teacher.id, 'Late')}
                          className={`p-2 rounded-md border flex items-center justify-center transition-all ${
                            teacher.status === 'Late' 
                              ? 'bg-amber-50 border-amber-200 text-amber-700 shadow-sm' 
                              : 'bg-white border-slate-200 text-slate-400 hover:border-amber-300 hover:text-amber-600'
                          }`}
                          title="দেরি"
                        >
                          <Clock className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleStatusChange(teacher.id, 'Leave')}
                          className={`p-2 rounded-md border flex items-center justify-center transition-all ${
                            teacher.status === 'Leave' 
                              ? 'bg-purple-50 border-purple-200 text-purple-700 shadow-sm' 
                              : 'bg-white border-slate-200 text-slate-400 hover:border-purple-300 hover:text-purple-600'
                          }`}
                          title="ছুটি"
                        >
                          <UserMinus className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
