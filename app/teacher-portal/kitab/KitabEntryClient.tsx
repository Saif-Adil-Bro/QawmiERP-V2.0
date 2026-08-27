"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Save,
  CheckCircle2,
  AlertCircle,
  FileText,
  Search,
  BookOpen,
  Calendar,
} from "lucide-react";
import { toBanglaNumber } from "@/lib/numberToBangla";

interface Props {
  classes: any[];
  students: any[];
  existingLogs: any[];
  currentClassId: string;
  currentDate: string;
  teacherId?: string;
  madrasaId?: string;
}

export default function KitabEntryClient({
  classes,
  students,
  existingLogs,
  currentClassId,
  currentDate,
  teacherId,
  madrasaId,
}: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Default subject/kitab for whole class entry or per student
  const [subjectName, setSubjectName] = useState("মিশকাত শরীফ");
  const [chapterName, setChapterName] = useState("");
  const [pageNumber, setPageNumber] = useState("");

  const [kitabState, setKitabState] = useState<Record<string, any>>(() => {
    const initialState: Record<string, any> = {};
    students.forEach((s) => {
      const existing = existingLogs.find((l) => l.student_id === s.id);
      initialState[s.id] = {
        subject_name: existing?.subject_name || existing?.kitab_name || "মিশকাত শরীফ",
        chapter_name: existing?.chapter_name || existing?.bab || "",
        page_number: existing?.page_number || "",
        teacher_remarks: existing?.teacher_remarks || existing?.remarks || "",
        attendance_status: existing?.status || "Present",
      };
    });
    return initialState;
  });

  const handleClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    router.push(`/teacher-portal/kitab?class_id=${e.target.value}&date=${currentDate}`);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    router.push(`/teacher-portal/kitab?class_id=${currentClassId}&date=${e.target.value}`);
  };

  const handleChange = (studentId: string, field: string, value: string) => {
    setKitabState((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], [field]: value },
    }));
  };

  // Quick batch apply lesson to all students in this class
  const applyLessonToAll = () => {
    setKitabState((prev) => {
      const next = { ...prev };
      students.forEach((s) => {
        next[s.id] = {
          ...next[s.id],
          subject_name: subjectName,
          chapter_name: chapterName,
          page_number: pageNumber,
        };
      });
      return next;
    });
    setMessage("সকল শিক্ষার্থীর জন্য কিতাব পাঠ আপডেট করা হয়েছে! সংরক্ষণে ক্লিক করুন।");
    setTimeout(() => setMessage(""), 4000);
  };

  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const q = searchQuery.toLowerCase();
    return students.filter(
      (s) =>
        s.first_name?.toLowerCase().includes(q) ||
        s.last_name?.toLowerCase().includes(q) ||
        String(s.roll_number || "").includes(q)
    );
  }, [students, searchQuery]);

  const saveKitabLogs = async () => {
    setLoading(true);
    setMessage("");

    try {
      const recordsToUpsert = students.map((s) => {
        const state = kitabState[s.id] || {};
        const existing = existingLogs.find((l) => l.student_id === s.id);

        return {
          id: existing?.id,
          student_id: s.id,
          class_id: currentClassId,
          teacher_id: teacherId || null,
          madrasa_id: madrasaId,
          date: currentDate,
          subject_name: state.subject_name || subjectName,
          kitab_name: state.subject_name || subjectName,
          chapter_name: state.chapter_name || chapterName,
          bab: state.chapter_name || chapterName,
          page_number: state.page_number || pageNumber,
          teacher_remarks: state.teacher_remarks,
          status: state.attendance_status || "Present",
        };
      }).map((r) => {
        if (!r.id) delete r.id;
        return r;
      });

      const { error } = await supabase
        .from("kitab_logs")
        .upsert(recordsToUpsert, { onConflict: "student_id, date, subject_name" });

      if (error) {
        for (const record of recordsToUpsert) {
          const { data: existing } = await supabase
            .from("kitab_logs")
            .select("id")
            .eq("student_id", record.student_id)
            .eq("date", record.date)
            .maybeSingle();

          if (existing) {
            await supabase.from("kitab_logs").update(record).eq("id", existing.id);
          } else {
            await supabase.from("kitab_logs").insert([record]);
          }
        }
      }

      setMessage("আজকের কিতাব পাঠ ও দরস ডায়েরি সফলভাবে সংরক্ষিত হয়েছে!");
      setTimeout(() => setMessage(""), 4000);
      router.refresh();
    } catch (err: any) {
      console.error(err);
      setMessage("কিতাব রেকর্ড সংরক্ষণে সমস্যা হয়েছে।");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
              <FileText className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">কিতাবাত ও দরস পাঠ ডায়েরি</h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            কিতাব বিভাগের শিক্ষার্থীদের দৈনিক পঠিত কিতাব, বাব ও পৃষ্ঠা নম্বর আপডেট করুন।
          </p>
        </div>
      </div>

      {/* Class & Quick Fill Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              জামাত / কিতাব বিভাগ <span className="text-indigo-600">*</span>
            </label>
            <select
              value={currentClassId}
              onChange={handleClassChange}
              className="w-full p-2.5 sm:p-3 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold bg-white focus:ring-2 focus:ring-indigo-600 focus:outline-none"
            >
              {classes.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              পাঠদানের তারিখ <span className="text-indigo-600">*</span>
            </label>
            <input
              type="date"
              value={currentDate}
              onChange={handleDateChange}
              className="w-full p-2.5 sm:p-3 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-indigo-600 focus:outline-none"
            />
          </div>
        </div>

        {/* Quick Batch Lesson Set */}
        <div className="p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-xl space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-900">একত্রে পুরো জামাতের পাঠ নির্ধারণ (Quick Batch Apply):</span>
            <button
              type="button"
              onClick={applyLessonToAll}
              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition"
            >
              সবাইকে প্রযোজ্য করুন
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              type="text"
              placeholder="কিতাবের নাম (যেমন: হেদায়া)"
              value={subjectName}
              onChange={(e) => setSubjectName(e.target.value)}
              className="text-xs p-2 border border-indigo-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-600 focus:outline-none"
            />
            <input
              type="text"
              placeholder="অধ্যায় / বাব (যেমন: কিতাবুস সালাত)"
              value={chapterName}
              onChange={(e) => setChapterName(e.target.value)}
              className="text-xs p-2 border border-indigo-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-600 focus:outline-none"
            />
            <input
              type="text"
              placeholder="পৃষ্ঠা / হাদিস নং (যেমন: পৃ. ১২৫)"
              value={pageNumber}
              onChange={(e) => setPageNumber(e.target.value)}
              className="text-xs p-2 border border-indigo-200 rounded-lg bg-white focus:ring-2 focus:ring-indigo-600 focus:outline-none"
            />
          </div>
        </div>

        {/* Search */}
        <div className="relative pt-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="শিক্ষার্থীর নাম বা রোল লিখে খুঁজুন..."
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-600 focus:outline-none"
          />
        </div>
      </div>

      {/* Message Notification */}
      {message && (
        <div
          className={`p-4 rounded-2xl text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-xs ${
            message.includes("সফল") || message.includes("আপডেট")
              ? "bg-emerald-50 text-emerald-900 border border-emerald-300"
              : "bg-red-50 text-red-900 border border-red-300"
          }`}
        >
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* Students List Table / Cards */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="px-4 py-3.5">শিক্ষার্থী</th>
                <th className="px-4 py-3.5">কিতাবের নাম</th>
                <th className="px-4 py-3.5">অধ্যায় / বাব</th>
                <th className="px-4 py-3.5">পৃষ্ঠা নম্বর</th>
                <th className="px-4 py-3.5">শিক্ষক মন্তব্য</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredStudents.length > 0 ? (
                filteredStudents.map((s) => {
                  const state = kitabState[s.id] || {};
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/60 transition">
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-900">{s.first_name} {s.last_name}</div>
                        <div className="text-xs text-slate-500">রোল: {toBanglaNumber(s.roll_number || "-")}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <input
                          type="text"
                          value={state.subject_name || ""}
                          onChange={(e) => handleChange(s.id, "subject_name", e.target.value)}
                          className="w-full text-xs p-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                        />
                      </td>
                      <td className="px-4 py-3.5">
                        <input
                          type="text"
                          value={state.chapter_name || ""}
                          onChange={(e) => handleChange(s.id, "chapter_name", e.target.value)}
                          className="w-full text-xs p-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                        />
                      </td>
                      <td className="px-4 py-3.5">
                        <input
                          type="text"
                          value={state.page_number || ""}
                          onChange={(e) => handleChange(s.id, "page_number", e.target.value)}
                          className="w-full text-xs p-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                        />
                      </td>
                      <td className="px-4 py-3.5">
                        <input
                          type="text"
                          placeholder="মন্তব্য লিখুন..."
                          value={state.teacher_remarks || ""}
                          onChange={(e) => handleChange(s.id, "teacher_remarks", e.target.value)}
                          className="w-full text-xs p-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                        />
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-slate-400 text-sm">
                    কোন শিক্ষার্থী পাওয়া যায়নি।
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="lg:hidden divide-y divide-slate-100">
          {filteredStudents.length > 0 ? (
            filteredStudents.map((s) => {
              const state = kitabState[s.id] || {};
              return (
                <div key={s.id} className="p-4 space-y-2.5 bg-white">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <strong className="text-sm text-slate-900">{s.first_name} {s.last_name}</strong>
                    <span className="text-xs font-bold text-indigo-800 bg-indigo-50 px-2.5 py-0.5 rounded-lg">
                      রোল: {toBanglaNumber(s.roll_number || "-")}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">কিতাবের নাম</label>
                      <input
                        type="text"
                        value={state.subject_name || ""}
                        onChange={(e) => handleChange(s.id, "subject_name", e.target.value)}
                        className="w-full text-xs p-2 border border-slate-200 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">অধ্যায় / বাব</label>
                      <input
                        type="text"
                        value={state.chapter_name || ""}
                        onChange={(e) => handleChange(s.id, "chapter_name", e.target.value)}
                        className="w-full text-xs p-2 border border-slate-200 rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">পৃষ্ঠা নম্বর</label>
                      <input
                        type="text"
                        value={state.page_number || ""}
                        onChange={(e) => handleChange(s.id, "page_number", e.target.value)}
                        className="w-full text-xs p-2 border border-slate-200 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">মন্তব্য</label>
                      <input
                        type="text"
                        placeholder="মন্তব্য..."
                        value={state.teacher_remarks || ""}
                        onChange={(e) => handleChange(s.id, "teacher_remarks", e.target.value)}
                        className="w-full text-xs p-2 border border-slate-200 rounded-xl"
                      />
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center text-slate-400 text-xs">কোন শিক্ষার্থী পাওয়া যায়নি।</div>
          )}
        </div>

        {/* Save Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500 font-medium">
            মোট শিক্ষার্থী: <strong>{toBanglaNumber(students.length)}</strong> জন
          </div>

          <button
            type="button"
            onClick={saveKitabLogs}
            disabled={loading || students.length === 0}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{loading ? "সংরক্ষণ হচ্ছে..." : "কিতাবাত ডায়েরি সংরক্ষণ করুন"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
