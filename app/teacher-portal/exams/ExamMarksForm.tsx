"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Save,
  CheckCircle2,
  AlertCircle,
  Award,
  Search,
  BookOpen,
  Phone,
} from "lucide-react";
import { toBanglaNumber } from "@/lib/numberToBangla";

export default function ExamMarksForm({
  exams,
  classes,
  students,
  existingMarks,
  currentExamId,
  currentClassId,
  currentSubject,
  madrasaId,
}: any) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [subjectInput, setSubjectInput] = useState(currentSubject || "কুরআন মাজীদ");

  useEffect(() => {
    setSubjectInput(currentSubject || "কুরআন মাজীদ");
  }, [currentSubject]);

  const [marksState, setMarksState] = useState<
    Record<string, { marks_obtained: string; total_marks: string }>
  >(() => {
    const initialState: Record<string, any> = {};
    students.forEach((s: any) => {
      const existing = existingMarks.find((m: any) => m.student_id === s.id);
      initialState[s.id] = {
        marks_obtained: existing?.marks_obtained?.toString() || "",
        total_marks: existing?.total_marks?.toString() || "100",
      };
    });
    return initialState;
  });

  useEffect(() => {
    const initialState: Record<string, any> = {};
    students.forEach((s: any) => {
      const existing = existingMarks.find((m: any) => m.student_id === s.id);
      initialState[s.id] = {
        marks_obtained: existing?.marks_obtained?.toString() || "",
        total_marks: existing?.total_marks?.toString() || "100",
      };
    });
    setMarksState(initialState);
  }, [students, existingMarks]);

  const handleFilterChange = (key: string, value: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set(key, value);
    router.push(url.pathname + url.search);
  };

  const handleChange = (studentId: string, field: string, value: string) => {
    setMarksState((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], [field]: value },
    }));
  };

  const getGradeInfo = (obtained: number, total: number) => {
    if (!total || isNaN(obtained)) return { grade: "-", color: "text-slate-400" };
    const pct = (obtained / total) * 100;
    if (pct >= 80) return { grade: "A+ (মুমতাজ)", color: "text-emerald-700 bg-emerald-50 border-emerald-200" };
    if (pct >= 70) return { grade: "A (জায়্যিদ জিদ্দান)", color: "text-blue-700 bg-blue-50 border-blue-200" };
    if (pct >= 60) return { grade: "A- (জায়্যিদ)", color: "text-indigo-700 bg-indigo-50 border-indigo-200" };
    if (pct >= 50) return { grade: "B (মাকবুল)", color: "text-amber-700 bg-amber-50 border-amber-200" };
    if (pct >= 33) return { grade: "C (উত্তীর্ণ)", color: "text-orange-700 bg-orange-50 border-orange-200" };
    return { grade: "F (অনুত্তীর্ণ)", color: "text-red-700 bg-red-50 border-red-200" };
  };

  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const q = searchQuery.toLowerCase();
    return students.filter(
      (s: any) =>
        s.first_name?.toLowerCase().includes(q) ||
        s.last_name?.toLowerCase().includes(q) ||
        String(s.roll_number || "").includes(q)
    );
  }, [students, searchQuery]);

  const saveMarks = async () => {
    setLoading(true);
    setMessage("");
    try {
      const recordsToUpsert = students
        .map((s: any) => {
          const existing = existingMarks.find((m: any) => m.student_id === s.id);
          const state = marksState[s.id];

          if (state.marks_obtained === "") return null;

          return {
            id: existing?.id,
            madrasa_id: madrasaId,
            student_id: s.id,
            class_id: currentClassId || null,
            exam_id: currentExamId,
            subject_name: currentSubject,
            marks_obtained: Number(state.marks_obtained),
            total_marks: Number(state.total_marks),
          };
        })
        .filter(Boolean)
        .map((r: any) => {
          if (!r.id) delete r.id;
          return r;
        });

      if (recordsToUpsert.length === 0) {
        setMessage("কোন নম্বর ইনপুট দেওয়া হয়নি।");
        setLoading(false);
        return;
      }

      const { error } = await supabase
        .from("exam_results")
        .upsert(recordsToUpsert, { onConflict: "student_id, exam_id, subject_name" });

      if (error) {
        for (const record of recordsToUpsert) {
          const { data: existing } = await supabase
            .from("exam_results")
            .select("id")
            .eq("student_id", record.student_id)
            .eq("exam_id", record.exam_id)
            .eq("subject_name", record.subject_name)
            .maybeSingle();

          if (existing) {
            await supabase.from("exam_results").update(record).eq("id", existing.id);
          } else {
            await supabase.from("exam_results").insert([record]);
          }
        }
      }

      setMessage("পরীক্ষার নম্বর ও গ্রেড সফলভাবে সংরক্ষিত হয়েছে!");
      setTimeout(() => setMessage(""), 4000);
      router.refresh();
    } catch (err: any) {
      console.error(err);
      setMessage("নম্বর সংরক্ষণ করতে সমস্যা হয়েছে।");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Selection Control Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              পরীক্ষা নির্বাচন করুন <span className="text-purple-600">*</span>
            </label>
            <select
              value={currentExamId}
              onChange={(e) => handleFilterChange("exam_id", e.target.value)}
              className="w-full p-2.5 sm:p-3 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold bg-white focus:ring-2 focus:ring-purple-600 focus:outline-none"
            >
              {exams.map((e: any) => (
                <option key={e.id} value={e.id}>
                  {e.name || e.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              জামাত / শ্রেণি <span className="text-purple-600">*</span>
            </label>
            <select
              value={currentClassId}
              onChange={(e) => handleFilterChange("class_id", e.target.value)}
              className="w-full p-2.5 sm:p-3 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold bg-white focus:ring-2 focus:ring-purple-600 focus:outline-none"
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
              বিষয়ের নাম <span className="text-purple-600">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                list="popular-subjects"
                value={subjectInput}
                onChange={(e) => setSubjectInput(e.target.value)}
                onBlur={() => {
                  if (subjectInput.trim() && subjectInput !== currentSubject) {
                    handleFilterChange("subject_name", subjectInput.trim());
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (subjectInput.trim() && subjectInput !== currentSubject) {
                      handleFilterChange("subject_name", subjectInput.trim());
                    }
                  }
                }}
                placeholder="যেমন: কুরআন মাজীদ, হাদিস, আরবি"
                className="w-full p-2.5 sm:p-3 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-purple-600 focus:outline-none"
              />
              <datalist id="popular-subjects">
                <option value="কুরআন মাজীদ" />
                <option value="হিফজ" />
                <option value="হাদিস শরীফ" />
                <option value="ফিকহ" />
                <option value="নাহব ও সরফ" />
                <option value="আকাইদ" />
                <option value="তাফসীর" />
                <option value="বাংলা" />
                <option value="গণিত" />
                <option value="ইংরেজি" />
              </datalist>
              {subjectInput !== currentSubject && (
                <button
                  type="button"
                  onClick={() => handleFilterChange("subject_name", subjectInput.trim())}
                  className="px-3 py-1 bg-purple-600 text-white rounded-xl text-xs font-bold shrink-0 hover:bg-purple-700 transition"
                >
                  প্রয়োগ
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Student Search */}
        <div className="relative pt-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
            placeholder="শিক্ষার্থীর নাম বা রোল লিখে সার্চ করুন..."
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-purple-600 focus:outline-none"
          />
        </div>
      </div>

      {/* Message Banner */}
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

      {/* Marks List (Mobile Cards + Desktop Table) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="px-5 py-3.5">রোল</th>
                <th className="px-5 py-3.5">শিক্ষার্থীর নাম</th>
                <th className="px-5 py-3.5">পূর্ণমান</th>
                <th className="px-5 py-3.5">প্রাপ্ত নম্বর</th>
                <th className="px-5 py-3.5 text-right">লাইভ গ্রেড</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredStudents.length > 0 ? (
                filteredStudents.map((s: any) => {
                  const state = marksState[s.id] || { marks_obtained: "", total_marks: "100" };
                  const obtNum = parseFloat(state.marks_obtained);
                  const totNum = parseFloat(state.total_marks) || 100;
                  const gradeInfo = getGradeInfo(obtNum, totNum);

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/60 transition">
                      <td className="px-5 py-3.5 font-bold font-mono text-slate-800">
                        {toBanglaNumber(s.roll_number || s.student_id || "-")}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden border border-purple-200 shadow-2xs">
                            {s.photo_url ? (
                              <img src={s.photo_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span>{s.first_name?.[0] || "শ"}</span>
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">{s.first_name} {s.last_name}</div>
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                              <span className="font-mono">আইডি: {s.student_id || s.id?.slice(0, 6)}</span>
                              {s.phone && (
                                <>
                                  <span>•</span>
                                  <a href={`tel:${s.phone}`} className="text-purple-700 hover:underline inline-flex items-center gap-0.5 font-mono">
                                    <Phone className="w-2.5 h-2.5" />
                                    <span>{s.phone}</span>
                                  </a>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <input
                          type="number"
                          value={state.total_marks}
                          onChange={(e) => handleChange(s.id, "total_marks", e.target.value)}
                          className="w-24 text-xs p-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-600 focus:outline-none"
                        />
                      </td>
                      <td className="px-5 py-3.5">
                        <input
                          type="number"
                          placeholder="প্রাপ্ত নম্বর..."
                          value={state.marks_obtained}
                          onChange={(e) => handleChange(s.id, "marks_obtained", e.target.value)}
                          className="w-32 text-xs p-2 font-bold text-purple-900 border border-purple-200 bg-purple-50/40 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-600 focus:outline-none"
                        />
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {state.marks_obtained !== "" && (
                          <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold border ${gradeInfo.color}`}>
                            {gradeInfo.grade}
                          </span>
                        )}
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
        <div className="md:hidden divide-y divide-slate-100">
          {filteredStudents.length > 0 ? (
            filteredStudents.map((s: any) => {
              const state = marksState[s.id] || { marks_obtained: "", total_marks: "100" };
              const obtNum = parseFloat(state.marks_obtained);
              const totNum = parseFloat(state.total_marks) || 100;
              const gradeInfo = getGradeInfo(obtNum, totNum);

              return (
                <div key={s.id} className="p-4 space-y-3 bg-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden border border-purple-200">
                        {s.photo_url ? (
                          <img src={s.photo_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span>{s.first_name?.[0] || "শ"}</span>
                        )}
                      </div>
                      <div>
                        <strong className="text-sm text-slate-900 leading-tight block">{s.first_name} {s.last_name}</strong>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono mt-0.5">
                          <span>আইডি: {s.student_id || s.id.slice(0, 6)}</span>
                          {s.phone && (
                            <>
                              <span>•</span>
                              <a href={`tel:${s.phone}`} className="text-purple-700 hover:underline inline-flex items-center gap-0.5">
                                <Phone className="w-2.5 h-2.5" />
                                <span>{s.phone}</span>
                              </a>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-purple-800 bg-purple-50 px-2.5 py-0.5 rounded-lg shrink-0">
                      রোল: {toBanglaNumber(s.roll_number || "-")}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">পূর্ণমান</label>
                      <input
                        type="number"
                        value={state.total_marks}
                        onChange={(e) => handleChange(s.id, "total_marks", e.target.value)}
                        className="w-full text-xs p-2 border border-slate-200 rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-purple-800 uppercase mb-1">প্রাপ্ত নম্বর</label>
                      <input
                        type="number"
                        placeholder="নম্বর লিখুন..."
                        value={state.marks_obtained}
                        onChange={(e) => handleChange(s.id, "marks_obtained", e.target.value)}
                        className="w-full text-xs p-2 font-bold text-purple-900 border border-purple-300 bg-purple-50/40 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-600"
                      />
                    </div>
                  </div>

                  {state.marks_obtained !== "" && (
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs text-slate-500">গ্রেড বিভাগ:</span>
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${gradeInfo.color}`}>
                        {gradeInfo.grade}
                      </span>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center text-slate-400 text-xs">কোন শিক্ষার্থী পাওয়া যায়নি।</div>
          )}
        </div>

        {/* Save Bar */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500 font-medium">
            মোট পরীক্ষার্থী: <strong>{toBanglaNumber(students.length)}</strong> জন
          </div>

          <button
            type="button"
            onClick={saveMarks}
            disabled={loading || students.length === 0}
            className="px-5 py-2.5 bg-purple-700 hover:bg-purple-800 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{loading ? "সংরক্ষণ হচ্ছে..." : "নম্বর সংরক্ষণ করুন"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
