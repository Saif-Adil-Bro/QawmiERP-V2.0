"use client";

import { useState } from "react";
import {
  Send,
  Calendar,
  CheckCircle2,
  AlertCircle,
  FileText,
  Clock,
  User,
  X,
  Plus,
} from "lucide-react";
import { toBanglaNumber } from "@/lib/numberToBangla";

interface Props {
  students: any[];
  userProfile: any;
}

export default function LeaveClient({ students, userProfile }: Props) {
  const [selectedStudentId, setSelectedStudentId] = useState(students[0]?.id || "");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [reason, setReason] = useState("");
  const [leaveType, setLeaveType] = useState("অসুস্থতাজনিত ছুটি");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [applications, setApplications] = useState<any[]>([
    {
      id: "leave-1",
      student_name: students[0] ? `${students[0].first_name} ${students[0].last_name}` : "শিক্ষার্থী",
      type: "পারিবারিক ছুটি",
      start_date: "2026-08-20",
      end_date: "2026-08-22",
      reason: "পারিবারিক জরুরি অনুষ্ঠানে উপস্থিতির জন্য ছুটি প্রদান আবশ্যক।",
      status: "Approved",
      applied_at: "2026-08-19",
    },
  ]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;

    setIsSubmitting(true);
    const selectedStudent = students.find((s) => s.id === selectedStudentId);

    setTimeout(() => {
      const newApp = {
        id: `leave-${Date.now()}`,
        student_name: selectedStudent ? `${selectedStudent.first_name} ${selectedStudent.last_name}` : "শিক্ষার্থী",
        type: leaveType,
        start_date: startDate,
        end_date: endDate,
        reason: reason,
        status: "Pending",
        applied_at: new Date().toISOString().split("T")[0],
      };

      setApplications((prev) => [newApp, ...prev]);
      setReason("");
      setIsSubmitting(false);
      setSuccessMsg("আপনার ছুটির আবেদন মাদরাসা প্রশাসনে সফলভাবে জমা হয়েছে!");
      setTimeout(() => setSuccessMsg(""), 5000);
    }, 600);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-rose-50 text-rose-700 rounded-xl">
              <Send className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">ছুটির আবেদন ও বার্তা প্রেরণ</h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            সন্তানের ছুটির আবেদন সরাসরি মাদরাসা মুহতামিম ও শ্রেণি শিক্ষকের নিকট প্রেরণ করুন।
          </p>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 flex items-center justify-between shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="text-sm font-semibold">{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg("")} className="p-1 hover:bg-emerald-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Application Form */}
        <div className="lg:col-span-1 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
          <h3 className="font-bold text-slate-900 text-base mb-4 flex items-center gap-2">
            <Plus className="w-4 h-4 text-rose-600" />
            <span>নতুন ছুটির আবেদন তৈরি করুন</span>
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            {students.length > 0 && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  শিক্ষার্থী নির্বাচন <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm bg-white focus:ring-2 focus:ring-slate-900 focus:outline-none"
                >
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.first_name} {s.last_name} (রোল: {s.roll_number || s.student_id || "-"})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                ছুটির ধরন <span className="text-red-500">*</span>
              </label>
              <select
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm bg-white focus:ring-2 focus:ring-slate-900 focus:outline-none"
              >
                <option value="অসুস্থতাজনিত ছুটি">অসুস্থতাজনিত ছুটি (Medical Leave)</option>
                <option value="পারিবারিক ছুটি">পারিবারিক জরুরি ছুটি (Family Reason)</option>
                <option value="জরুরি প্রয়োজন">জরুরি ব্যক্তিগত ছুটি (Emergency Leave)</option>
                <option value="অন্যান্য কারণ">অন্যান্য কারণ (Other)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">শুরুর তারিখ</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-slate-900 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">শেষের তারিখ</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-slate-900 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                ছুটির সুস্পষ্ট কারণ ও বিবরণ <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={4}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="ছুটি চাওয়ার কারণ বিস্তারিতভাবে লিখুন..."
                required
                className="w-full p-3 border border-slate-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-slate-900 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-md transition disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{isSubmitting ? "জমা হচ্ছে..." : "আবেদন জমা দিন"}</span>
            </button>
          </form>
        </div>

        {/* Applications List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">পূর্ববর্তী ছুটির আবেদন ও স্ট্যাটাস</h3>
            <span className="text-xs text-slate-500 font-medium">{toBanglaNumber(applications.length)} টি আবেদন</span>
          </div>

          <div className="space-y-3">
            {applications.map((app) => (
              <div
                key={app.id}
                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <div>
                    <span className="text-xs font-bold text-slate-900">{app.student_name}</span>
                    <span className="text-xs text-slate-500 ml-2">({app.type})</span>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                      app.status === "Approved"
                        ? "bg-emerald-100 text-emerald-800"
                        : app.status === "Rejected"
                        ? "bg-red-100 text-red-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {app.status === "Approved" ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <Clock className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {app.status === "Approved" ? "অনুমোদিত (Approved)" : "অপেক্ষমাণ (Pending Review)"}
                    </span>
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">{app.reason}</p>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 pt-1">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>ছুটির মেয়াদ: {new Date(app.start_date).toLocaleDateString("bn-BD")} হতে {new Date(app.end_date).toLocaleDateString("bn-BD")}</span>
                  </span>
                  <span>আবেদনের তারিখ: {new Date(app.applied_at).toLocaleDateString("bn-BD")}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
