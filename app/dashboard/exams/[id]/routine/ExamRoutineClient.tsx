"use client";

import { useState, useRef } from "react";
import { saveExamRoutine, deleteExamRoutine, publishExamRoutineNotice } from "@/app/actions/exam-routines";
import { Plus, Trash2, Printer, Megaphone, Loader2, Calendar, Clock, DoorOpen, CheckCircle, X, AlertCircle } from "lucide-react";
import Link from "next/link";

const DAYS_BANGLA = [
  "রবিবার",
  "সোমবার",
  "মঙ্গলবার",
  "বুধবার",
  "বৃহস্পতিবার",
  "শুক্রবার",
  "শনিবার"
];

function getBanglaDay(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return "";
  return DAYS_BANGLA[d.getDay()] || "";
}

function formatTime12h(timeStr: string): string {
  if (!timeStr) return "";
  const parts = timeStr.split(":");
  if (parts.length < 2) return timeStr;
  let h = parseInt(parts[0], 10);
  const m = parts[1];
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  const hStr = h < 10 ? `0${h}` : `${h}`;
  return `${hStr}:${m} ${ampm}`;
}

export default function ExamRoutineClient({ 
  examId, 
  classes,
  subjects,
  routines,
  exam,
  madrasa
}: { 
  examId: string, 
  classes: any[],
  subjects: any[],
  routines: any[],
  exam: any,
  madrasa: any
}) {
  const [classIdFilter, setClassIdFilter] = useState("");
  
  // For new routine entry
  const [newClassId, setNewClassId] = useState("");
  const [newSubjectId, setNewSubjectId] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newStartTime, setNewStartTime] = useState("09:30");
  const [newEndTime, setNewEndTime] = useState("12:00");
  const [newRoom, setNewRoom] = useState("");

  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Notice publishing modal state
  const [isNoticeModalOpen, setIsNoticeModalOpen] = useState(false);
  const [noticeAudience, setNoticeAudience] = useState("All");
  const [noticeCustomNote, setNoticeCustomNote] = useState("");
  const [publishingNotice, setPublishingNotice] = useState(false);
  const [noticePublishSuccess, setNoticePublishSuccess] = useState(false);
  const [noticeErrorMessage, setNoticeErrorMessage] = useState("");

  const filteredRoutines = classIdFilter 
    ? routines.filter(r => r.class_id === classIdFilter) 
    : routines;

  const currentDayName = getBanglaDay(newDate);

  const handleAdd = async () => {
    if (!newClassId || !newSubjectId || !newDate || !newStartTime || !newEndTime) {
      alert("দয়া করে জামাত, বিষয়, তারিখ এবং পরীক্ষার শুরুর ও শেষের সময় পূরণ করুন।");
      return;
    }
    setSaving(true);
    const result = await saveExamRoutine({
      exam_id: examId,
      class_id: newClassId,
      subject_id: newSubjectId,
      exam_date: newDate,
      start_time: newStartTime,
      end_time: newEndTime,
      room_number: newRoom.trim()
    });
    if (result.error) {
      alert(result.error);
    } else {
      setNewSubjectId("");
      setNewRoom("");
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("আপনি কি নিশ্চিত যে এই রুটিন এন্ট্রিটি মুছে ফেলতে চান?")) return;
    setDeletingId(id);
    await deleteExamRoutine(id, examId);
    setDeletingId(null);
  };

  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (printRef.current) {
      const originalContents = document.body.innerHTML;
      const printContents = printRef.current.innerHTML;
      document.body.innerHTML = printContents;
      window.print();
      document.body.innerHTML = originalContents;
      window.location.reload();
    }
  };

  const handlePublishNotice = async () => {
    if (routines.length === 0) {
      alert("নোটিশ প্রকাশ করার জন্য আগে অন্তত একটি বিষয়ের রুটিন এন্ট্রি করুন।");
      return;
    }
    setPublishingNotice(true);
    setNoticeErrorMessage("");
    const res = await publishExamRoutineNotice(examId, {
      target_audience: noticeAudience,
      custom_note: noticeCustomNote,
    });
    setPublishingNotice(false);

    if (res.error) {
      setNoticeErrorMessage(res.error);
    } else {
      setNoticePublishSuccess(true);
    }
  };

  return (
    <div className="space-y-6">
      {/* Routine Entry Card */}
      <div className="bg-white p-6 rounded-xl shadow-xs border border-slate-200">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h2 className="text-lg font-bold text-slate-800">পরীক্ষার রুটিন ও সময়সূচি এন্ট্রি</h2>
            <p className="text-xs text-slate-500 mt-0.5">তারিখ নির্বাচন করলে স্বয়ংক্রিয়ভাবে বারের নাম যুক্ত হবে এবং রুম নম্বর নির্ধারণ করা যাবে</p>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="flex items-center space-x-2 px-3.5 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition text-sm font-medium cursor-pointer"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span>প্রিন্ট / PDF</span>
            </button>
            <button
              onClick={() => {
                setNoticePublishSuccess(false);
                setNoticeErrorMessage("");
                setIsNoticeModalOpen(true);
              }}
              className="flex items-center space-x-2 px-3.5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm font-medium shadow-xs cursor-pointer"
            >
              <Megaphone className="w-4 h-4" />
              <span>নোটিশ প্রকাশ করুন</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 mb-3">
          {/* Class selector */}
          <div className="lg:col-span-1">
            <label className="block text-xs font-semibold text-slate-700 mb-1">জামাত (Class) *</label>
            <select
              value={newClassId}
              onChange={(e) => setNewClassId(e.target.value)}
              className="w-full p-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
            >
              <option value="">জামাত নির্বাচন করুন</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Subject selector */}
          <div className="lg:col-span-1">
            <label className="block text-xs font-semibold text-slate-700 mb-1">বিষয় (Subject) *</label>
            <select
              value={newSubjectId}
              onChange={(e) => setNewSubjectId(e.target.value)}
              className="w-full p-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
            >
              <option value="">বিষয় নির্বাচন করুন</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Date selector with dynamic Day display */}
          <div className="lg:col-span-1">
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-semibold text-slate-700">তারিখ (Date) *</label>
              {currentDayName && (
                <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-200">
                  {currentDayName}
                </span>
              )}
            </div>
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="w-full p-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          {/* Start Time */}
          <div className="lg:col-span-1">
            <label className="block text-xs font-semibold text-slate-700 mb-1">শুরুর সময় (Start) *</label>
            <input
              type="time"
              value={newStartTime}
              onChange={(e) => setNewStartTime(e.target.value)}
              className="w-full p-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          {/* End Time */}
          <div className="lg:col-span-1">
            <label className="block text-xs font-semibold text-slate-700 mb-1">শেষের সময় (End) *</label>
            <input
              type="time"
              value={newEndTime}
              onChange={(e) => setNewEndTime(e.target.value)}
              className="w-full p-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          {/* Room Number */}
          <div className="lg:col-span-1">
            <label className="block text-xs font-semibold text-slate-700 mb-1">রুম / কক্ষ নং</label>
            <input
              type="text"
              value={newRoom}
              onChange={(e) => setNewRoom(e.target.value)}
              placeholder="যেমন: ১০১, হল রুম"
              className="w-full p-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
        </div>

        {/* Add Button Row */}
        <div className="flex justify-between items-center pt-2 border-t border-slate-100 mt-3">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            {newDate && (
              <span className="inline-flex items-center gap-1 text-slate-700 bg-slate-100 px-2 py-1 rounded-md">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                <span>নির্বাচিত বার: <strong>{currentDayName || "অনির্ধারিত"}</strong></span>
              </span>
            )}
            {newStartTime && newEndTime && (
              <span className="inline-flex items-center gap-1 text-slate-700 bg-slate-100 px-2 py-1 rounded-md">
                <Clock className="w-3.5 h-3.5 text-emerald-600" />
                <span>সময়: {formatTime12h(newStartTime)} - {formatTime12h(newEndTime)}</span>
              </span>
            )}
          </div>

          <button
            onClick={handleAdd}
            disabled={saving}
            className="flex items-center space-x-2 bg-slate-900 text-white px-5 py-2 rounded-lg hover:bg-slate-800 transition disabled:opacity-50 text-sm font-medium shadow-xs cursor-pointer"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            <span>রুটিন যুক্ত করুন</span>
          </button>
        </div>
      </div>

      {/* Routine List Card */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-800">পরীক্ষার সময়সূচি তালিকা</h3>
            <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-bold">
              মোট: {filteredRoutines.length} টি
            </span>
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <span className="text-xs text-slate-500 whitespace-nowrap">জামাত ফিল্টার:</span>
            <select
              value={classIdFilter}
              onChange={(e) => setClassIdFilter(e.target.value)}
              className="p-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-xs bg-white"
            >
              <option value="">সকল জামাত (All Classes)</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/80 text-slate-600 font-semibold border-b text-xs uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">তারিখ ও বার (Date & Day)</th>
                <th className="px-5 py-3.5">সময় (Time)</th>
                <th className="px-5 py-3.5">জামাত (Class)</th>
                <th className="px-5 py-3.5">বিষয় (Subject)</th>
                <th className="px-5 py-3.5">রুম / কক্ষ নং (Room)</th>
                <th className="px-5 py-3.5 text-right">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
              {filteredRoutines.map((routine) => {
                const dayName = getBanglaDay(routine.exam_date);
                return (
                  <tr key={routine.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-slate-800">{routine.exam_date}</div>
                      {dayName && (
                        <div className="inline-block mt-0.5 text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                          {dayName}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5 font-medium text-slate-700 whitespace-nowrap">
                      {formatTime12h(routine.start_time)} - {formatTime12h(routine.end_time)}
                    </td>
                    <td className="px-5 py-3.5 font-bold text-slate-800">
                      {routine.class?.name || "-"}
                    </td>
                    <td className="px-5 py-3.5 font-bold text-indigo-950">
                      {routine.subject?.name || "-"}
                    </td>
                    <td className="px-5 py-3.5">
                      {routine.room_number ? (
                        <span className="inline-flex items-center gap-1 font-medium bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded-md border border-emerald-200">
                          <DoorOpen className="w-3.5 h-3.5" />
                          <span>কক্ষ: {routine.room_number}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 font-mono">-</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => handleDelete(routine.id)}
                        disabled={deletingId === routine.id}
                        className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition disabled:opacity-50 cursor-pointer"
                        title="রুটিন মুছে ফেলুন"
                      >
                        {deletingId === routine.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredRoutines.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-slate-400">
                    কোনো রুটিন এন্ট্রি পাওয়া যায়নি। উপরের ফর্ম থেকে বিষয়ভিত্তিক রুটিন যুক্ত করুন।
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Notice Publish Modal */}
      {isNoticeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 relative animate-in fade-in zoom-in duration-150 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsNoticeModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-indigo-100 text-indigo-700 rounded-xl">
                <Megaphone className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">নোটিশ বোর্ডে রুটিন প্রকাশ</h3>
                <p className="text-xs text-slate-500">মাদরাসা নোটিশ বোর্ডে রুটিন ও সময়সূচি স্বয়ংক্রিয়ভাবে পাবলিশ করুন</p>
              </div>
            </div>

            {noticePublishSuccess ? (
              <div className="space-y-4 py-4 text-center">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-800">নোটিশ সফলভাবে প্রকাশিত হয়েছে!</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    শিক্ষক, ছাত্র ও অভিভাবকগণ নোটিশ বোর্ডে এবং পোর্টালে এই সময়সূচি দেখতে পারবেন।
                  </p>
                </div>

                <div className="flex justify-center gap-3 pt-2">
                  <Link
                    href="/dashboard/communication/notices"
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition"
                  >
                    নোটিশ বোর্ডে দেখুন
                  </Link>
                  <button
                    onClick={() => setIsNoticeModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-200 transition cursor-pointer"
                  >
                    বন্ধ করুন
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {noticeErrorMessage && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs text-red-700">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{noticeErrorMessage}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">নোটিশের শিরোনাম</label>
                  <input
                    type="text"
                    readOnly
                    value={`${exam.title} (${exam.year}) - পরীক্ষার চূড়ান্ত রুটিন ও সময়সূচি`}
                    className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-semibold cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">প্রাপক (কাদের জন্য)</label>
                  <select
                    value={noticeAudience}
                    onChange={(e) => setNoticeAudience(e.target.value)}
                    className="w-full p-2.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-medium"
                  >
                    <option value="All">সকলের জন্য (All Students, Parents & Teachers)</option>
                    <option value="Students">শুধু ছাত্রদের জন্য (Students Only)</option>
                    <option value="Teachers">শুধু শিক্ষকদের জন্য (Teachers Only)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">বিশেষ নির্দেশনা বা নোট (ঐচ্ছিক)</label>
                  <textarea
                    rows={3}
                    value={noticeCustomNote}
                    onChange={(e) => setNoticeCustomNote(e.target.value)}
                    placeholder="যেমন: পরীক্ষার দিন সকাল ৯:১৫ মিনিটের মধ্যে উপস্থিত হতে হবে। প্রবেশপত্র ছাড়া কাউকে পরীক্ষায় বসতে দেওয়া হবে না।"
                    className="w-full p-2.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-[11px] text-slate-600">
                  <span className="font-bold text-slate-700 block mb-1">📋 নোটিশে যা সংযুক্ত থাকবে:</span>
                  <ul className="list-disc pl-4 space-y-0.5">
                    <li>মোট <strong>{routines.length}</strong> টি বিষয়ের সম্পূর্ণ তারিখ, বার, সময় ও কক্ষ তালিকা</li>
                    <li>প্রতিটি বিষয়ের জামাত ও সময়সূচি</li>
                  </ul>
                </div>

                <div className="flex justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsNoticeModalOpen(false)}
                    className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-100 transition cursor-pointer"
                  >
                    বাতিল
                  </button>
                  <button
                    type="button"
                    onClick={handlePublishNotice}
                    disabled={publishingNotice || routines.length === 0}
                    className="flex items-center space-x-2 px-5 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition disabled:opacity-50 shadow-xs cursor-pointer"
                  >
                    {publishingNotice ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>প্রকাশ হচ্ছে...</span>
                      </>
                    ) : (
                      <>
                        <Megaphone className="w-3.5 h-3.5" />
                        <span>নোটিশ প্রকাশ নিশ্চিত করুন</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Print Layout */}
      <div className="hidden">
        <div ref={printRef} className="p-8 max-w-4xl mx-auto text-slate-900" style={{ fontFamily: 'sans-serif' }}>
          <div className="text-center mb-6 border-b-2 border-slate-900 pb-5">
            <h1 className="text-2xl font-bold mb-1">{madrasa?.name || 'আলহাজ্ব আবুল হোসেন হাফিজিয়া মাদ্রাসা'}</h1>
            {madrasa?.address && <p className="text-xs text-slate-600 mb-1">{madrasa.address}</p>}
            <h2 className="text-xl font-bold mt-3 underline uppercase tracking-wide">
              Exam Routine: {exam.title} ({exam.year})
            </h2>
            {classIdFilter && (
              <h3 className="text-base font-semibold mt-1">Class: {classes.find(c => c.id === classIdFilter)?.name}</h3>
            )}
          </div>

          <table className="w-full border-collapse border border-slate-400 text-sm">
            <thead>
              <tr className="bg-slate-100 font-bold">
                <th className="border border-slate-400 px-3 py-2 text-left">Date & Day</th>
                <th className="border border-slate-400 px-3 py-2 text-left">Time</th>
                {!classIdFilter && <th className="border border-slate-400 px-3 py-2 text-left">Class</th>}
                <th className="border border-slate-400 px-3 py-2 text-left">Subject</th>
                <th className="border border-slate-400 px-3 py-2 text-left">Room</th>
              </tr>
            </thead>
            <tbody>
              {filteredRoutines.map((routine) => {
                const dayName = getBanglaDay(routine.exam_date);
                const dateWithDay = dayName ? `${routine.exam_date} (${dayName})` : routine.exam_date;
                return (
                  <tr key={routine.id}>
                    <td className="border border-slate-400 px-3 py-2 font-medium">{dateWithDay}</td>
                    <td className="border border-slate-400 px-3 py-2 whitespace-nowrap">
                      {formatTime12h(routine.start_time)} - {formatTime12h(routine.end_time)}
                    </td>
                    {!classIdFilter && <td className="border border-slate-400 px-3 py-2 font-bold">{routine.class?.name || '-'}</td>}
                    <td className="border border-slate-400 px-3 py-2">{routine.subject?.name || '-'}</td>
                    <td className="border border-slate-400 px-3 py-2 font-medium">{routine.room_number || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="mt-12 flex justify-between items-center text-xs pt-8">
            <div className="border-t border-slate-500 pt-1 text-center w-40">
              নাযেমে তা'লীমাত / পরীক্ষা নিয়ন্ত্রক
            </div>
            <div className="border-t border-slate-500 pt-1 text-center w-40">
              মুহতামিম / অধ্যক্ষ
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

