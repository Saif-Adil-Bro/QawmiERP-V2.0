"use client";

import { useState, useEffect, useMemo } from "react";
import { getStudentsForAttendance, saveAttendance } from "@/app/actions/attendance";
import { getClasses } from "@/app/actions/students";
import { checkHolidayForDate } from "@/app/actions/holidays";
import { format } from "date-fns";
import { Check, X, Clock, UserMinus, ArrowLeft, CheckCircle2, XCircle, Users, Search, Save, CalendarDays, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { toBanglaNumber } from "@/lib/numberToBangla";

export default function AttendancePage() {
  const [date, setDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [classId, setClassId] = useState<string>("All");
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
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
    async function loadClasses() {
      try {
        const cls = await getClasses();
        setClasses(cls || []);
      } catch (err) {
        console.error("loadClasses failed:", err);
      }
    }
    loadClasses();
  }, []);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const data = await getStudentsForAttendance(date, classId);
        setStudents(data || []);
      } catch (err) {
        console.error("getStudentsForAttendance failed:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [date, classId]);

  const handleStatusChange = (studentId: string, status: string) => {
    setStudents(prev => 
      prev.map(s => s.id === studentId ? { ...s, status } : s)
    );
  };

  const handleMarkAll = (status: "Present" | "Absent" | "Late" | "Leave") => {
    setStudents(prev => prev.map(s => ({ ...s, status })));
  };

  const stats = useMemo(() => {
    const total = students.length;
    const present = students.filter(s => s.status === 'Present').length;
    const absent = students.filter(s => s.status === 'Absent').length;
    const late = students.filter(s => s.status === 'Late').length;
    const leave = students.filter(s => s.status === 'Leave').length;
    return { total, present, absent, late, leave };
  }, [students]);

  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const q = searchQuery.toLowerCase().trim();
    return students.filter(s => {
      const name = `${s.first_name || ''} ${s.last_name || ''}`.toLowerCase();
      const roll = (s.roll_number || '').toString().toLowerCase();
      return name.includes(q) || roll.includes(q);
    });
  }, [students, searchQuery]);

  const getStudentClassName = (student: any) => {
    if (!student.classes) return 'N/A';
    if (Array.isArray(student.classes)) return student.classes[0]?.name || 'N/A';
    return student.classes.name || 'N/A';
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const attendanceData = students.map(s => ({
        student_id: s.id,
        status: s.status,
      }));
      
      const result = await saveAttendance(date, attendanceData);
      
      if (result?.error) {
        setMessage({ type: 'error', text: result.error });
      } else {
        setMessage({ type: 'success', text: 'হাজিরা সফলভাবে সংরক্ষণ করা হয়েছে!' });
        setTimeout(() => setMessage(null), 3500);
      }
    } catch (err) {
      console.error("saveAttendance failed:", err);
      setMessage({
        type: 'error',
        text: 'একটি অপ্রত্যাশিত সমস্যা হয়েছে। অনুগ্রহ করে পেজ রিফ্রেশ করে আবার চেষ্টা করুন।',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center space-x-4">
          <Link
            href="/dashboard/attendance"
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">শিক্ষার্থী দৈনিক হাজিরা</h1>
            <p className="text-slate-500 text-sm">ক্লাসভিত্তিক শিক্ষার্থীদের দৈনিক উপস্থিতির রেকর্ড ও সংরক্ষণ</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <div className="flex items-center space-x-2 bg-white border border-slate-200 rounded-xl px-3.5 py-2 shadow-xs w-full sm:w-auto">
            <label htmlFor="class_id" className="text-xs font-bold text-slate-600">ক্লাস:</label>
            <select
              id="class_id"
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="border-none focus:outline-none text-xs font-semibold text-slate-800 bg-transparent"
            >
              <option value="All">সকল ক্লাস</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2 bg-white border border-slate-200 rounded-xl px-3.5 py-2 shadow-xs w-full sm:w-auto">
            <label htmlFor="date" className="text-xs font-bold text-slate-600">তারিখ:</label>
            <input 
              type="date" 
              id="date" 
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="border-none focus:outline-none text-xs font-semibold text-slate-800"
            />
          </div>
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
                  {holidayInfo.isHoliday ? "📌 নির্ধারিত একাডেমিক ছুটি:" : "🌴 সাপ্তাহিক ছুটি:"}
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
                  ? `মেয়াদ: ${holidayInfo.holiday?.start_date} হতে ${holidayInfo.holiday?.end_date} পর্যন্ত (${toBanglaNumber(holidayInfo.holiday?.total_days || 1)} দিন)। ছুটির দিনের সকল শিক্ষার্থীর হাজিরা স্বয়ংক্রিয়ভাবে "ছুটি (Leave)" হিসেবে সংরক্ষিত হয়েছে।`
                  : `মাদরাসার নির্ধারিত সাপ্তাহিক বন্ধের দিন (${holidayInfo.dayName || ""})। শিক্ষার্থীদের হাজিরা স্বয়ংক্রিয়ভাবে "ছুটি (Leave)" হিসেবে সংরক্ষিত হয়েছে।`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleMarkAll("Leave")}
              className="px-3 py-1.5 text-xs font-bold bg-amber-200/80 hover:bg-amber-300 text-amber-900 rounded-xl transition flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              সকলকে "ছুটি (Leave)" মার্ক করুন
            </button>
            <Link
              href="/dashboard/attendance/holidays"
              className="px-3 py-1.5 text-xs font-medium text-amber-900 underline hover:text-amber-950"
            >
              ছুটির তালিকা দেখুন
            </Link>
          </div>
        </div>
      )}

      {message && (
        <div className={`p-4 rounded-xl text-sm font-semibold flex items-center justify-between shadow-xs ${message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
          <span>{message.text}</span>
          <button type="button" onClick={() => setMessage(null)} className="text-xs underline cursor-pointer">বন্ধ করুন</button>
        </div>
      )}

      {/* KPI Stats & Bulk Action Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-slate-500 font-semibold">মোট শিক্ষার্থী</div>
          <div className="text-xl font-bold text-slate-900 mt-1">{stats.total}</div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-emerald-600 font-semibold">উপস্থিত</div>
          <div className="text-xl font-bold text-emerald-700 mt-1">{stats.present}</div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-rose-600 font-semibold">অনুপস্থিত</div>
          <div className="text-xl font-bold text-rose-700 mt-1">{stats.absent}</div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs text-amber-600 font-semibold">বিলম্ব (Late)</div>
          <div className="text-xl font-bold text-amber-700 mt-1">{stats.late}</div>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs col-span-2 sm:col-span-1">
          <div className="text-xs text-blue-600 font-semibold">ছুটি (Leave)</div>
          <div className="text-xl font-bold text-blue-700 mt-1">{stats.leave}</div>
        </div>
      </div>

      {/* Bulk Action Controls */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="শিক্ষার্থীর নাম বা রোল দিয়ে খুঁজুন..."
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-bold text-slate-500 mr-1 hidden sm:inline">বাল্ক অ্যাকশন:</span>
          <button
            type="button"
            onClick={() => handleMarkAll("Present")}
            className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition"
            title="সকলকে উপস্থিত মার্ক করুন"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>সবাই উপস্থিত</span>
          </button>

          <button
            type="button"
            onClick={() => handleMarkAll("Absent")}
            className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition"
            title="সকলকে অনুপস্থিত মার্ক করুন"
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>সবাই অনুপস্থিত</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 font-medium">শিক্ষার্থী লোড হচ্ছে...</div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-12 text-center text-slate-500 font-medium">কোনো শিক্ষার্থী পাওয়া যায়নি।</div>
        ) : (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50/80 text-slate-700 border-b border-slate-200/80">
                  <tr>
                    <th className="px-6 py-3.5 font-bold text-xs">রোল নম্বর</th>
                    <th className="px-6 py-3.5 font-bold text-xs">নাম</th>
                    <th className="px-6 py-3.5 font-bold text-xs">ক্লাস</th>
                    <th className="px-6 py-3.5 font-bold text-xs text-right">স্ট্যাটাস</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.map((student) => (
                    <tr key={student.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-6 py-3.5 font-mono font-bold text-slate-900">{student.roll_number || '-'}</td>
                      <td className="px-6 py-3.5 font-bold text-slate-900">
                        {student.first_name} {student.last_name}
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800">
                          {getStudentClassName(student)}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <div className="inline-flex rounded-xl shadow-xs border border-slate-200 overflow-hidden" role="group">
                          <button 
                            type="button" 
                            onClick={() => handleStatusChange(student.id, 'Present')}
                            className={`px-3 py-1.5 text-xs font-bold transition cursor-pointer ${student.status === 'Present' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
                          >
                            উপস্থিত
                          </button>
                          <button 
                            type="button" 
                            onClick={() => handleStatusChange(student.id, 'Late')}
                            className={`px-3 py-1.5 text-xs font-bold border-l border-r border-slate-200 transition cursor-pointer ${student.status === 'Late' ? 'bg-amber-500 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
                          >
                            দেরি
                          </button>
                          <button 
                            type="button" 
                            onClick={() => handleStatusChange(student.id, 'Leave')}
                            className={`px-3 py-1.5 text-xs font-bold border-r border-slate-200 transition cursor-pointer ${student.status === 'Leave' ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
                          >
                            ছুটি
                          </button>
                          <button 
                            type="button" 
                            onClick={() => handleStatusChange(student.id, 'Absent')}
                            className={`px-3 py-1.5 text-xs font-bold transition cursor-pointer ${student.status === 'Absent' ? 'bg-rose-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
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
            
            <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                মোট <span className="font-bold text-slate-800">{filteredStudents.length}</span> জন শিক্ষার্থীর হাজিরা তালিকা
              </div>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || students.length === 0}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm disabled:opacity-50 transition flex items-center gap-2 shadow-xs cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? "সংরক্ষণ হচ্ছে..." : "হাজিরা সংরক্ষণ করুন"}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

