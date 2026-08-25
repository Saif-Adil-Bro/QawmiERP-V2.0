"use client";

import { useState, useRef } from "react";
import { saveExamRoutine, deleteExamRoutine } from "@/app/actions/exam-routines";
import { Plus, Trash2, Printer, Megaphone, Loader2 } from "lucide-react";

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
  const [newStartTime, setNewStartTime] = useState("");
  const [newEndTime, setNewEndTime] = useState("");
  const [newRoom, setNewRoom] = useState("");

  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredRoutines = classIdFilter 
    ? routines.filter(r => r.class_id === classIdFilter) 
    : routines;

  const handleAdd = async () => {
    if (!newClassId || !newSubjectId || !newDate || !newStartTime || !newEndTime) {
      alert("Please fill all required fields");
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
      room_number: newRoom
    });
    if (result.error) {
      alert(result.error);
    } else {
      setNewSubjectId("");
      setNewDate("");
      setNewStartTime("");
      setNewEndTime("");
      setNewRoom("");
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this routine entry?")) return;
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
    alert("Notice publishing logic can be implemented using the /actions/notices API");
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
          <h2 className="text-lg font-semibold text-slate-800">রুটিন এন্ট্রি (Routine Entry)</h2>
          
          <div className="flex space-x-2">
            <button
              onClick={handlePrint}
              className="flex items-center space-x-2 px-3 py-2 bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200 transition"
            >
              <Printer className="w-4 h-4" />
              <span>Print/PDF</span>
            </button>
            <button
              onClick={handlePublishNotice}
              className="flex items-center space-x-2 px-3 py-2 bg-indigo-50 text-indigo-700 rounded-md hover:bg-indigo-100 transition"
            >
              <Megaphone className="w-4 h-4" />
              <span>Publish Notice</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-4">
          <div className="md:col-span-1">
            <label className="block text-sm font-medium text-slate-700 mb-1">Class</label>
            <select
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
          <div className="md:col-span-1">
            <label className="block text-sm font-medium text-slate-700 mb-1">Subject</label>
            <select
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
          <div className="md:col-span-1">
            <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-500 outline-none"
            />
          </div>
          <div className="md:col-span-1">
            <label className="block text-sm font-medium text-slate-700 mb-1">Start Time</label>
            <input
              type="time"
              value={newStartTime}
              onChange={(e) => setNewStartTime(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-500 outline-none"
            />
          </div>
          <div className="md:col-span-1">
            <label className="block text-sm font-medium text-slate-700 mb-1">End Time</label>
            <input
              type="time"
              value={newEndTime}
              onChange={(e) => setNewEndTime(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-500 outline-none"
            />
          </div>
          <div className="md:col-span-1 flex flex-col justify-end">
            <button
              onClick={handleAdd}
              disabled={saving}
              className="w-full flex items-center justify-center space-x-2 bg-slate-900 text-white p-2 rounded-md hover:bg-slate-800 transition disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              <span>Add</span>
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <h3 className="font-semibold text-slate-800">Routine Filter</h3>
          <select
            value={classIdFilter}
            onChange={(e) => setClassIdFilter(e.target.value)}
            className="p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-slate-500 outline-none text-sm"
          >
            <option value="">All Classes</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-500 font-medium border-b">
              <tr>
                <th className="px-6 py-3">Date</th>
                <th className="px-6 py-3">Time</th>
                <th className="px-6 py-3">Class</th>
                <th className="px-6 py-3">Subject</th>
                <th className="px-6 py-3">Room</th>
                <th className="px-6 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRoutines.map((routine) => (
                <tr key={routine.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">{routine.exam_date}</td>
                  <td className="px-6 py-4">{routine.start_time} - {routine.end_time}</td>
                  <td className="px-6 py-4">{routine.class?.name}</td>
                  <td className="px-6 py-4">{routine.subject?.name}</td>
                  <td className="px-6 py-4">{routine.room_number || '-'}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleDelete(routine.id)}
                      disabled={deletingId === routine.id}
                      className="text-red-500 hover:bg-red-50 p-2 rounded-md transition disabled:opacity-50"
                    >
                      {deletingId === routine.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </td>
                </tr>
              ))}
              {filteredRoutines.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                    No routine records found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Print Layout */}
      <div className="hidden">
        <div ref={printRef} className="p-8 max-w-4xl mx-auto text-slate-900" style={{ fontFamily: 'sans-serif' }}>
          <div className="text-center mb-8 border-b-2 border-slate-900 pb-6">
            <h1 className="text-3xl font-bold mb-2">{madrasa?.name || 'Madrasa'}</h1>
            <p className="text-slate-600 mb-1">{madrasa?.address || ''}</p>
            <h2 className="text-2xl font-bold mt-4 underline">Exam Routine: {exam.title} ({exam.year})</h2>
            {classIdFilter && (
              <h3 className="text-xl font-semibold mt-2">Class: {classes.find(c => c.id === classIdFilter)?.name}</h3>
            )}
          </div>

          <table className="w-full border-collapse border border-slate-400">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-400 px-4 py-2 text-left">Date</th>
                <th className="border border-slate-400 px-4 py-2 text-left">Time</th>
                {!classIdFilter && <th className="border border-slate-400 px-4 py-2 text-left">Class</th>}
                <th className="border border-slate-400 px-4 py-2 text-left">Subject</th>
                <th className="border border-slate-400 px-4 py-2 text-left">Room</th>
              </tr>
            </thead>
            <tbody>
              {filteredRoutines.map((routine) => (
                <tr key={routine.id}>
                  <td className="border border-slate-400 px-4 py-2">{routine.exam_date}</td>
                  <td className="border border-slate-400 px-4 py-2">{routine.start_time} - {routine.end_time}</td>
                  {!classIdFilter && <td className="border border-slate-400 px-4 py-2">{routine.class?.name}</td>}
                  <td className="border border-slate-400 px-4 py-2">{routine.subject?.name}</td>
                  <td className="border border-slate-400 px-4 py-2">{routine.room_number || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
