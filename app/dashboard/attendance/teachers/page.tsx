"use client";

import { useState, useEffect } from "react";
import { getTeachersForAttendance, saveTeacherAttendance } from "@/app/actions/attendance";
import { checkHolidayForDate } from "@/app/actions/holidays";
import { format } from "date-fns";
import { Check, X, Clock, UserMinus, ArrowLeft, CalendarDays, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { toBanglaNumber } from "@/lib/numberToBangla";

export default function TeacherAttendancePage() {
  const [date, setDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [holidayInfo, setHolidayInfo] = useState<{ isHoliday: boolean; isWeekend: boolean; holiday: any; dayName?: string } | null>(null);

  useEffect(() => {
    async function checkDateHoliday() {
      try {
        const info = await checkHolidayForDate(date);
        setHolidayInfo(info);
      } catch (err) {
        console.error("Holiday check failed:", err);
      }
    }
    checkDateHoliday();
  }, [date]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const data = await getTeachersForAttendance(date);
        setTeachers(data || []);
      } catch (err) {
        console.error("getTeachersForAttendance failed:", err);
      } finally {
        setLoading(false);
      }
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
    try {
      const attendanceData = teachers.map(t => ({
        teacher_id: t.id,
        status: t.status,
      }));
      
      const result = await saveTeacherAttendance(date, attendanceData);
      
      if (result?.error) {
        setMessage({ type: 'error', text: result.error });
      } else {
        setMessage({ type: 'success', text: 'স্টাফদের হাজিরা সফলভাবে সেভ করা হয়েছে!' });
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (err) {
      console.error("saveTeacherAttendance failed:", err);
      setMessage({
        type: 'error',
        text: 'একটি অপ্রত্যাশিত সমস্যা হয়েছে। সম্ভবত নতুন আপডেট ডিপ্লয় হয়েছে — অনুগ্রহ করে পেজ রিফ্রেশ করে আবার চেষ্টা করুন।',
      });
    } finally {
      setSaving(false);
    }
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

      {/* Holiday / Weekend Notice Banner */}
      {holidayInfo && (holidayInfo.isHoliday || holidayInfo.isWeekend) && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-100 text-amber-800 rounded-xl shrink-0">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-amber-900">
                  {holidayInfo.isHoliday ? "📌 নির্ধারিত ছুটি:" : "🌴 সাপ্তাহিক বন্ধ:"}
                </span>
                <span className="text-xs font-extrabold text-amber-950 underline decoration-amber-400">
                  {holidayInfo.isHoliday ? holidayInfo.holiday?.title : `${holidayInfo.dayName || "ছুটির দিন"} সাপ্তাহিক বন্ধ`}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  অটো-সেভ সক্রিয়
                </span>
              </div>
              <p className="text-[11px] text-amber-800 mt-1">
                {holidayInfo.isHoliday
                  ? `মেয়াদ: ${holidayInfo.holiday?.start_date} হতে ${holidayInfo.holiday?.end_date} পর্যন্ত (${toBanglaNumber(holidayInfo.holiday?.total_days || 1)} দিন)। ছুটির দিনের সকল স্টাফদের হাজিরা স্বয়ংক্রিয়ভাবে "ছুটি (Leave)" হিসেবে সংরক্ষিত হয়েছে।`
                  : `মাদরাসার নির্ধারিত সাপ্তাহিক ছুটির দিন (${holidayInfo.dayName || ""})। স্টাফদের হাজিরা স্বয়ংক্রিয়ভাবে "ছুটি (Leave)" হিসেবে সংরক্ষিত হয়েছে।`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setTeachers(prev => prev.map(t => ({ ...t, status: 'Leave' })))}
              className="px-3 py-1.5 text-xs font-bold bg-amber-200/80 hover:bg-amber-300 text-amber-900 rounded-xl transition flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              সকল স্টাফকে "ছুটি (Leave)" মার্ক করুন
            </button>
            <Link
              href="/dashboard/attendance/holidays"
              className="px-3 py-1.5 text-xs font-medium text-amber-900 underline hover:text-amber-950"
            >
              ছুটির তালিকা
            </Link>
          </div>
        </div>
      )}

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
