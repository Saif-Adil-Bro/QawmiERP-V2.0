"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  Save,
  Search,
  Users,
  CheckCheck,
  X,
  AlertCircle,
} from "lucide-react";
import { toBanglaNumber } from "@/lib/numberToBangla";

interface AttendanceFormProps {
  classes?: any[];
  students?: any[];
  existingAttendance?: any[];
  initialClasses?: any[];
  initialStudents?: any[];
  initialAttendance?: any[];
  currentClassId: string;
  currentDate: string;
  madrasaId?: string;
}

export default function AttendanceForm({
  classes,
  students,
  existingAttendance,
  initialClasses,
  initialStudents,
  initialAttendance,
  currentClassId,
  currentDate,
  madrasaId,
}: AttendanceFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const allStudents = students || initialStudents || [];
  const allClasses = classes || initialClasses || [];
  const allAttendance = existingAttendance || initialAttendance || [];

  // Map student attendance state
  const initialMap: Record<string, { status: string; notes: string }> = {};
  allStudents.forEach((student) => {
    const existing = allAttendance.find((a) => a.student_id === student.id);
    initialMap[student.id] = {
      status: existing ? existing.status : "Present",
      notes: existing ? existing.notes || "" : "",
    };
  });

  const [attendanceState, setAttendanceState] = useState<
    Record<string, { status: string; notes: string }>
  >(initialMap);

  const handleClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    router.push(
      `/teacher-portal/attendance?class_id=${e.target.value}&date=${currentDate}`
    );
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    router.push(
      `/teacher-portal/attendance?class_id=${currentClassId}&date=${e.target.value}`
    );
  };

  const handleStatusChange = (studentId: string, status: string) => {
    setAttendanceState((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        status,
      },
    }));
  };

  const handleNotesChange = (studentId: string, notes: string) => {
    setAttendanceState((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        notes,
      },
    }));
  };

  // Bulk actions
  const markAllStatus = (status: string) => {
    setAttendanceState((prev) => {
      const next = { ...prev };
      allStudents.forEach((s) => {
        next[s.id] = {
          ...next[s.id],
          status,
        };
      });
      return next;
    });
  };

  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return allStudents;
    const q = searchQuery.toLowerCase();
    return allStudents.filter(
      (s) =>
        s.first_name?.toLowerCase().includes(q) ||
        s.last_name?.toLowerCase().includes(q) ||
        String(s.roll_number || "").includes(q) ||
        String(s.student_id || "").toLowerCase().includes(q)
    );
  }, [allStudents, searchQuery]);

  // Save Attendance
  const saveAttendance = async () => {
    setLoading(true);
    setMessage("");

    try {
      const recordsToUpsert = allStudents.map((s) => {
        const currentRec = attendanceState[s.id] || { status: "Present", notes: "" };
        const existing = allAttendance.find((a) => a.student_id === s.id);

        return {
          id: existing ? existing.id : undefined,
          student_id: s.id,
          class_id: currentClassId,
          madrasa_id: madrasaId,
          date: currentDate,
          status: currentRec.status,
          notes: currentRec.notes,
        };
      });

      const res = await fetch("/api/attendance/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records: recordsToUpsert }),
      });

      if (!res.ok) {
        throw new Error("Failed to save attendance");
      }

      setMessage("আজকের হাজিরা সফলভাবে সংরক্ষিত হয়েছে!");
      setTimeout(() => setMessage(""), 4000);
      router.refresh();
    } catch (err: any) {
      setMessage("হাজিরা সংরক্ষণ করতে সমস্যা হয়েছে। অনুগ্রহ করে পুনরায় চেষ্টা করুন।");
    } finally {
      setLoading(false);
    }
  };

  const presentCount = Object.values(attendanceState).filter((a) => a.status === "Present").length;
  const absentCount = Object.values(attendanceState).filter((a) => a.status === "Absent").length;
  const lateCount = Object.values(attendanceState).filter((a) => a.status === "Late" || a.status === "Leave").length;

  return (
    <div className="space-y-5">
      {/* Control Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              জামাত / শ্রেণি নির্বাচন করুন <span className="text-emerald-600">*</span>
            </label>
            <select
              value={currentClassId}
              onChange={handleClassChange}
              className="w-full p-2.5 sm:p-3 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
            >
              {allClasses.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              হাজিরার তারিখ <span className="text-emerald-600">*</span>
            </label>
            <input
              type="date"
              value={currentDate}
              onChange={handleDateChange}
              className="w-full p-2.5 sm:p-3 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-emerald-600 focus:outline-none"
            />
          </div>
        </div>

        {/* Quick Stats & Bulk Actions */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">স্ট্যাটাস সামারি:</span>
            <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-800">
              উপস্থিত: {toBanglaNumber(presentCount)}
            </span>
            <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-red-100 text-red-800">
              অনুপস্থিত: {toBanglaNumber(absentCount)}
            </span>
            {lateCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-amber-100 text-amber-800">
                বিলম্ব/ছুটি: {toBanglaNumber(lateCount)}
              </span>
            )}
          </div>

          {/* Bulk Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => markAllStatus("Present")}
              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>সবাই উপস্থিত</span>
            </button>
            <button
              type="button"
              onClick={() => markAllStatus("Absent")}
              className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-800 border border-red-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
            >
              <X className="w-3.5 h-3.5" />
              <span>সবাই অনুপস্থিত</span>
            </button>
          </div>
        </div>

        {/* Search within class */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="শিক্ষার্থীর নাম বা রোল নম্বর দিয়ে খুঁজুন..."
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
          />
        </div>
      </div>

      {/* Save Notification Banner */}
      {message && (
        <div
          className={`p-4 rounded-2xl text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-xs ${
            message.includes("সফল")
              ? "bg-emerald-50 text-emerald-900 border border-emerald-300"
              : "bg-red-50 text-red-900 border border-red-300"
          }`}
        >
          {message.includes("সফল") ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          )}
          <span>{message}</span>
        </div>
      )}

      {/* STUDENT ATTENDANCE LIST (Mobile Card + Desktop Table) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="px-5 py-3.5">রোল</th>
                <th className="px-5 py-3.5">শিক্ষার্থীর নাম</th>
                <th className="px-5 py-3.5">হাজিরা স্ট্যাটাস</th>
                <th className="px-5 py-3.5">মন্তব্য / কারণ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredStudents.length > 0 ? (
                filteredStudents.map((s: any) => {
                  const state = attendanceState[s.id] || { status: "Present", notes: "" };

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/60 transition">
                      <td className="px-5 py-3.5 font-bold font-mono text-slate-800">
                        {toBanglaNumber(s.roll_number || s.student_id || "-")}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-slate-900">{s.first_name} {s.last_name}</div>
                        <div className="text-[11px] text-slate-400">আইডি: {s.student_id || s.id.slice(0, 8)}</div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5">
                          {[
                            { key: "Present", label: "উপস্থিত", color: "bg-emerald-600 text-white shadow-xs" },
                            { key: "Absent", label: "অনুপস্থিত", color: "bg-red-600 text-white shadow-xs" },
                            { key: "Late", label: "বিলম্ব", color: "bg-amber-600 text-white shadow-xs" },
                            { key: "Leave", label: "ছুটি", color: "bg-blue-600 text-white shadow-xs" },
                          ].map((st) => (
                            <button
                              key={st.key}
                              type="button"
                              onClick={() => handleStatusChange(s.id, st.key)}
                              className={`px-3 py-1 rounded-xl text-xs font-bold transition ${
                                state.status === st.key
                                  ? st.color
                                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                              }`}
                            >
                              {st.label}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <input
                          type="text"
                          placeholder="অনুপস্থিতি বা ছুটির কারণ..."
                          value={state.notes}
                          onChange={(e) => handleNotesChange(s.id, e.target.value)}
                          className="w-full text-xs p-2 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                        />
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={4} className="text-center py-10 text-slate-400 text-sm">
                    কোন শিক্ষার্থী পাওয়া যায়নি।
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards View */}
        <div className="md:hidden divide-y divide-slate-100">
          {filteredStudents.length > 0 ? (
            filteredStudents.map((s: any) => {
              const state = attendanceState[s.id] || { status: "Present", notes: "" };

              return (
                <div key={s.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md mr-2">
                        রোল: {toBanglaNumber(s.roll_number || "-")}
                      </span>
                      <strong className="text-sm text-slate-900">{s.first_name} {s.last_name}</strong>
                    </div>
                  </div>

                  {/* Status Toggle Buttons */}
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { key: "Present", label: "উপস্থিত", activeColor: "bg-emerald-600 text-white" },
                      { key: "Absent", label: "অনুপস্থিত", activeColor: "bg-red-600 text-white" },
                      { key: "Late", label: "বিলম্ব", activeColor: "bg-amber-600 text-white" },
                      { key: "Leave", label: "ছুটি", activeColor: "bg-blue-600 text-white" },
                    ].map((st) => (
                      <button
                        key={st.key}
                        type="button"
                        onClick={() => handleStatusChange(s.id, st.key)}
                        className={`py-2 text-center rounded-xl text-xs font-bold transition ${
                          state.status === st.key
                            ? `${st.activeColor} shadow-xs font-extrabold`
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>

                  {state.status !== "Present" && (
                    <input
                      type="text"
                      placeholder="মন্তব্য বা কারণ লিখুন..."
                      value={state.notes}
                      onChange={(e) => handleNotesChange(s.id, e.target.value)}
                      className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                    />
                  )}
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center text-slate-400 text-xs">কোন শিক্ষার্থী পাওয়া যায়নি।</div>
          )}
        </div>

        {/* Bottom Save Bar */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500 font-medium">
            মোট তালিকাভুক্ত শিক্ষার্থী: <strong>{toBanglaNumber(allStudents.length)}</strong> জন
          </div>

          <button
            type="button"
            onClick={saveAttendance}
            disabled={loading || allStudents.length === 0}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{loading ? "সংরক্ষণ হচ্ছে..." : "হাজিরা সংরক্ষণ করুন"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
