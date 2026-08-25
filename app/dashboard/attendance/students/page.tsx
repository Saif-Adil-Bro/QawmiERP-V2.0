"use client";

import { useState, useEffect } from "react";
import { getStudentsForAttendance, saveAttendance } from "@/app/actions/attendance";
import { getClasses } from "@/app/actions/students";
import { format } from "date-fns";
import { Check, X, Clock, UserMinus, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function AttendancePage() {
  const [date, setDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [classId, setClassId] = useState<string>("All");
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    async function loadClasses() {
      const cls = await getClasses();
      setClasses(cls);
    }
    loadClasses();
  }, []);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const data = await getStudentsForAttendance(date, classId);
      setStudents(data);
      setLoading(false);
    }
    loadData();
  }, [date, classId]);

  const handleStatusChange = (studentId: string, status: string) => {
    setStudents(prev => 
      prev.map(s => s.id === studentId ? { ...s, status } : s)
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    const attendanceData = students.map(s => ({
      student_id: s.id,
      status: s.status,
    }));
    
    const result = await saveAttendance(date, attendanceData);
    
    if (result.error) {
      setMessage({ type: 'error', text: result.error });
    } else {
      setMessage({ type: 'success', text: 'হাজিরা সফলভাবে সেভ করা হয়েছে!' });
      setTimeout(() => setMessage(null), 3000);
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center space-x-4">
          <Link
            href="/dashboard/attendance"
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">দৈনিক হাজিরা</h1>
            <p className="text-slate-500 text-sm">শিক্ষার্থীদের উপস্থিতির রেকর্ড পরিচালনা করুন</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex items-center space-x-2 bg-white border rounded-md px-3 py-2 shadow-sm w-full sm:w-auto">
            <label htmlFor="class_id" className="text-sm font-medium text-slate-600">ক্লাস:</label>
            <select
              id="class_id"
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="border-none focus:outline-none focus:ring-0 text-sm font-medium text-slate-800 bg-transparent"
            >
              <option value="All">সব ক্লাস</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2 bg-white border rounded-md px-3 py-2 shadow-sm w-full sm:w-auto">
            <label htmlFor="date" className="text-sm font-medium text-slate-600">তারিখ:</label>
            <input 
              type="date" 
              id="date" 
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="border-none focus:outline-none focus:ring-0 text-sm font-medium text-slate-800"
            />
          </div>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-md text-sm font-medium ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">শিক্ষার্থী লোড হচ্ছে...</div>
        ) : students.length === 0 ? (
          <div className="p-8 text-center text-slate-500">কোনো শিক্ষার্থী পাওয়া যায়নি। প্রথমে শিক্ষার্থী যুক্ত করুন।</div>
        ) : (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-slate-700 border-b">
                  <tr>
                    <th className="px-6 py-4 font-medium">রোল নম্বর</th>
                    <th className="px-6 py-4 font-medium">নাম</th>
                    <th className="px-6 py-4 font-medium">ক্লাস</th>
                    <th className="px-6 py-4 font-medium text-right">স্ট্যাটাস</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {students.map((student) => (
                    <tr key={student.id} className="hover:bg-slate-50/50 transition">
                      <td className="px-6 py-4 font-medium text-slate-900">{student.roll_number || '-'}</td>
                      <td className="px-6 py-4 font-medium text-slate-900">
                        {student.first_name} {student.last_name}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                          {student.classes?.name || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="inline-flex rounded-md shadow-sm" role="group">
                          <button 
                            type="button" 
                            onClick={() => handleStatusChange(student.id, 'Present')}
                            className={`px-3 py-1.5 text-xs font-medium border rounded-l-md transition ${student.status === 'Present' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}
                          >
                            উপস্থিত
                          </button>
                          <button 
                            type="button" 
                            onClick={() => handleStatusChange(student.id, 'Late')}
                            className={`px-3 py-1.5 text-xs font-medium border-t border-b border-r transition ${student.status === 'Late' ? 'bg-yellow-500 text-white border-yellow-500' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}
                          >
                            দেরি
                          </button>
                          <button 
                            type="button" 
                            onClick={() => handleStatusChange(student.id, 'Leave')}
                            className={`px-3 py-1.5 text-xs font-medium border-t border-b border-r transition ${student.status === 'Leave' ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}
                          >
                            ছুটি
                          </button>
                          <button 
                            type="button" 
                            onClick={() => handleStatusChange(student.id, 'Absent')}
                            className={`px-3 py-1.5 text-xs font-medium border-t border-b border-r rounded-r-md transition ${student.status === 'Absent' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}
                          >
                            অনুপস্থিত
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="p-6 border-t bg-slate-50 flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving || students.length === 0}
                className="bg-slate-900 text-white px-6 py-2 rounded-md hover:bg-slate-800 disabled:opacity-50 transition"
              >
                {saving ? "সেভ হচ্ছে..." : "হাজিরা সেভ করুন"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
