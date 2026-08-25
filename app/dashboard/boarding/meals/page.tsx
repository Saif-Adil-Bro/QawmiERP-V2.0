"use client";

import { useState, useEffect } from "react";
import { getStudentsForMeals, saveMealEntries } from "@/app/actions/boarding";
import { getClasses } from "@/app/actions/students";
import { format } from "date-fns";
import { ArrowLeft, Check, X, Utensils, UtensilsCrossed, CalendarDays, Layers } from "lucide-react";
import Link from "next/link";

export default function DailyMealsPage() {
  const [date, setDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [classId, setClassId] = useState<string>("All");
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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
      const data = await getStudentsForMeals(date, classId);
      setStudents(data);
      setLoading(false);
    }
    loadData();
  }, [date, classId]);

  const handleStatusChange = (studentId: string, meal_status: "On" | "Off") => {
    setStudents(prev =>
      prev.map(s => (s.id === studentId ? { ...s, meal_status } : s))
    );
  };

  const handleBulkSet = (meal_status: "On" | "Off") => {
    setStudents(prev =>
      prev.map(s => ({ ...s, meal_status }))
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    const mealData = students.map(s => ({
      student_id: s.id,
      meal_status: s.meal_status as "On" | "Off"
    }));

    const result = await saveMealEntries(date, mealData);

    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({ type: "success", text: "মিলের বিবরণ সফলভাবে সেভ করা হয়েছে!" });
      setTimeout(() => setMessage(null), 3000);
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      {/* Header and Filters */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center space-x-4">
          <Link
            href="/dashboard/boarding"
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition"
            id="back_to_boarding"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">দৈনিক মিল এন্ট্রি (Daily Meal Entry)</h1>
            <p className="text-slate-500 text-sm">ছাত্রদের দৈনিক খাবার বা মিলের হিসাব চালু বা বন্ধ করুন</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <div className="flex items-center space-x-2 bg-white border rounded-md px-3 py-2 shadow-sm w-full sm:w-auto">
            <Layers className="w-4 h-4 text-slate-400" />
            <label htmlFor="class_id" className="text-sm font-medium text-slate-600">ক্লাস:</label>
            <select
              id="class_id"
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="border-none focus:outline-none focus:ring-0 text-sm font-medium text-slate-800 bg-transparent cursor-pointer"
            >
              <option value="All">সব ক্লাস</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2 bg-white border rounded-md px-3 py-2 shadow-sm w-full sm:w-auto">
            <CalendarDays className="w-4 h-4 text-slate-400" />
            <label htmlFor="date" className="text-sm font-medium text-slate-600">তারিখ:</label>
            <input
              type="date"
              id="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="border-none focus:outline-none focus:ring-0 text-sm font-medium text-slate-800 cursor-pointer"
            />
          </div>
        </div>
      </div>

      {message && (
        <div
          className={`p-4 rounded-md text-sm font-medium ${
            message.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
          }`}
          id="message_alert"
        >
          {message.text}
        </div>
      )}

      {/* Bulk actions & Main List */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="p-4 bg-slate-50/50 border-b flex flex-wrap justify-between items-center gap-4">
          <span className="text-sm font-semibold text-slate-700">
            মোট ছাত্র সংখ্যা: <span className="text-indigo-600 font-bold">{students.length}</span> জন
          </span>
          <div className="flex space-x-2">
            <button
              onClick={() => handleBulkSet("On")}
              type="button"
              className="inline-flex items-center px-3 py-1.5 border border-orange-200 text-xs font-semibold rounded-md text-orange-700 bg-orange-50 hover:bg-orange-100 transition"
              id="btn_bulk_on"
            >
              <Utensils className="w-3.5 h-3.5 mr-1" />
              সবার মিল চালু
            </button>
            <button
              onClick={() => handleBulkSet("Off")}
              type="button"
              className="inline-flex items-center px-3 py-1.5 border border-red-200 text-xs font-semibold rounded-md text-red-700 bg-red-50 hover:bg-red-100 transition"
              id="btn_bulk_off"
            >
              <UtensilsCrossed className="w-3.5 h-3.5 mr-1" />
              সবার মিল বন্ধ
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center space-y-2">
            <div className="w-8 h-8 border-4 border-slate-300 border-t-orange-600 rounded-full animate-spin"></div>
            <span>শিক্ষার্থী লোড হচ্ছে...</span>
          </div>
        ) : students.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            কোনো শিক্ষার্থী পাওয়া যায়নি। প্রথমে মাদ্রাসায় শিক্ষার্থী যুক্ত করুন।
          </div>
        ) : (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-slate-700 border-b">
                  <tr>
                    <th className="px-6 py-4 font-medium text-center w-24">রোল নম্বর</th>
                    <th className="px-6 py-4 font-medium">নাম</th>
                    <th className="px-6 py-4 font-medium">ক্লাস</th>
                    <th className="px-6 py-4 font-medium text-right w-64">মিল স্ট্যাটাস (Meal Status)</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {students.map((student) => (
                    <tr key={student.id} className="hover:bg-slate-50/50 transition">
                      <td className="px-6 py-4 font-medium text-slate-900 text-center">{student.roll_number || "-"}</td>
                      <td className="px-6 py-4 font-semibold text-slate-900">
                        {student.first_name} {student.last_name}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                          {student.class_name || "N/A"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="inline-flex rounded-md shadow-sm" role="group">
                          <button
                            type="button"
                            onClick={() => handleStatusChange(student.id, "On")}
                            className={`px-4 py-2 text-xs font-bold border rounded-l-md transition flex items-center ${
                              student.meal_status === "On"
                                ? "bg-orange-600 text-white border-orange-600 shadow-sm"
                                : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                            }`}
                          >
                            <Utensils className="w-3.5 h-3.5 mr-1.5" />
                            মিল চালু (ON)
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStatusChange(student.id, "Off")}
                            className={`px-4 py-2 text-xs font-bold border-t border-b border-r rounded-r-md transition flex items-center ${
                              student.meal_status === "Off"
                                ? "bg-red-600 text-white border-red-600 shadow-sm"
                                : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                            }`}
                          >
                            <UtensilsCrossed className="w-3.5 h-3.5 mr-1.5" />
                            বন্ধ (OFF)
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
                className="bg-slate-900 text-white px-6 py-2.5 rounded-md hover:bg-slate-800 disabled:opacity-50 font-semibold transition shadow-sm"
                id="btn_save_meals"
              >
                {saving ? "সেভ হচ্ছে..." : "মিলের হিসাব সেভ করুন"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
