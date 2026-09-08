"use client";

import { useState, useMemo, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Save,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  Search,
  Star,
  User,
  Phone,
  Loader2,
} from "lucide-react";
import { toBanglaNumber } from "@/lib/numberToBangla";

export default function HifzForm({
  classes,
  students,
  existingLogs,
  currentDate,
  currentClassId,
  teacherId,
  madrasaId,
}: any) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isChangingClass, startClassTransition] = useTransition();
  const [selectedClassId, setSelectedClassId] = useState(currentClassId);

  useEffect(() => {
    setSelectedClassId(currentClassId);
  }, [currentClassId]);

  const [hifzState, setHifzState] = useState<Record<string, any>>(() => {
    const initialState: Record<string, any> = {};
    students.forEach((s: any) => {
      const existing = existingLogs.find((l: any) => l.student_id === s.id);
      initialState[s.id] = {
        sabak_para: existing?.sabak_para || existing?.para_number || "",
        saboki_para: existing?.saboki_para || existing?.sabqi || "",
        amukhta_para: existing?.amukhta_para || existing?.manzil || "",
        performance_rating: existing?.performance_rating || existing?.performance || "মুমতাজ (Excellent)",
        remarks: existing?.remarks || existing?.notes || "",
      };
    });
    return initialState;
  });

  useEffect(() => {
    const initialState: Record<string, any> = {};
    students.forEach((s: any) => {
      const existing = existingLogs.find((l: any) => l.student_id === s.id);
      initialState[s.id] = {
        sabak_para: existing?.sabak_para || existing?.para_number || "",
        saboki_para: existing?.saboki_para || existing?.sabqi || "",
        amukhta_para: existing?.amukhta_para || existing?.manzil || "",
        performance_rating: existing?.performance_rating || existing?.performance || "মুমতাজ (Excellent)",
        remarks: existing?.remarks || existing?.notes || "",
      };
    });
    setHifzState(initialState);
  }, [students, existingLogs]);

  const handleClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newClassId = e.target.value;
    setSelectedClassId(newClassId);
    startClassTransition(() => {
      router.push(
        `/teacher-portal/hifz?class_id=${newClassId}&date=${currentDate}`
      );
    });
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    startClassTransition(() => {
      router.push(
        `/teacher-portal/hifz?class_id=${selectedClassId || currentClassId}&date=${newDate}`
      );
    });
  };

  const handleChange = (studentId: string, field: string, value: string) => {
    setHifzState((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], [field]: value },
    }));
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

  const saveLogs = async () => {
    setLoading(true);
    setMessage("");

    try {
      const parsePara = (val: any) => {
        if (!val) return null;
        const num = parseInt(String(val).trim(), 10);
        return isNaN(num) ? null : num;
      };

      const recordsToSave = students.map((s: any) => {
        const state = hifzState[s.id] || {};
        const existing = existingLogs.find((l: any) => l.student_id === s.id);

        return {
          student_id: s.id,
          teacher_id: teacherId || null,
          existing_id: existing?.id || null,
          sabak_para: parsePara(state.sabak_para),
          saboki_para: parsePara(state.saboki_para),
          amukhta_para: parsePara(state.amukhta_para),
          performance_rating: state.performance_rating || "মুমতাজ (Excellent)",
          notes: state.remarks || null,
        };
      });

      const res = await fetch("/api/teacher/save-hifz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          madrasa_id: madrasaId,
          current_class_id: currentClassId,
          current_date: currentDate,
          records: recordsToSave,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "সংরক্ষণ ব্যর্থ হয়েছে");
      }

      setMessage("আজকের হিফজ সবক ও আমুখতা রেকর্ড সফলভাবে সংরক্ষিত হয়েছে!");
      setTimeout(() => setMessage(""), 4000);
      router.refresh();
    } catch (err: any) {
      console.error(err);
      setMessage("সবক রেকর্ড সংরক্ষণে ত্রুটি ঘটেছে।");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Control Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700">
                হিফজ জামাত / গ্রুপ নির্বাচন করুন <span className="text-teal-600">*</span>
              </label>
              {isChangingClass && (
                <span className="flex items-center gap-1 text-[11px] text-teal-700 font-medium">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>লোড হচ্ছে...</span>
                </span>
              )}
            </div>
            <select
              value={selectedClassId || currentClassId}
              onChange={handleClassChange}
              disabled={isChangingClass}
              className="w-full p-2.5 sm:p-3 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold bg-white focus:ring-2 focus:ring-teal-600 focus:outline-none disabled:opacity-60"
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
              সবক গ্রহণের তারিখ <span className="text-teal-600">*</span>
            </label>
            <input
              type="date"
              value={currentDate}
              onChange={handleDateChange}
              className="w-full p-2.5 sm:p-3 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-teal-600 focus:outline-none"
            />
          </div>
        </div>

        {/* Search */}
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
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-teal-600 focus:outline-none"
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

      {/* LIST OF STUDENTS (Mobile Cards + Desktop Table) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Desktop Table */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="px-4 py-3.5">শিক্ষার্থী</th>
                <th className="px-4 py-3.5">সবক (নতুন পাঠ)</th>
                <th className="px-4 py-3.5">সবকি (পারা পেছনে)</th>
                <th className="px-4 py-3.5">আমুখতা (দাওর)</th>
                <th className="px-4 py-3.5">পারফরম্যান্স রেটিং</th>
                <th className="px-4 py-3.5">উস্তাদের মন্তব্য</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredStudents.length > 0 ? (
                filteredStudents.map((s: any) => {
                  const state = hifzState[s.id] || {};
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/60 transition">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden border border-teal-200 shadow-2xs">
                            {s.photo_url ? (
                              <img src={s.photo_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span>{s.first_name?.[0] || "শ"}</span>
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">{s.first_name} {s.last_name}</div>
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                              <span>রোল: <strong className="text-slate-700">{toBanglaNumber(s.roll_number || "-")}</strong></span>
                              <span>•</span>
                              <span className="font-mono">আইডি: {s.student_id || s.id?.slice(0, 6)}</span>
                              {s.phone && (
                                <>
                                  <span>•</span>
                                  <a href={`tel:${s.phone}`} className="text-teal-700 hover:underline inline-flex items-center gap-0.5 font-mono">
                                    <Phone className="w-2.5 h-2.5" />
                                    <span>{s.phone}</span>
                                  </a>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <input
                          type="text"
                          placeholder="পারা / সূরা / আয়াত..."
                          value={state.sabak_para || ""}
                          onChange={(e) => handleChange(s.id, "sabak_para", e.target.value)}
                          className="w-full text-xs p-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-600 focus:outline-none"
                        />
                      </td>

                      <td className="px-4 py-3.5">
                        <input
                          type="text"
                          placeholder="সবকি পারা / পৃষ্ঠা..."
                          value={state.saboki_para || ""}
                          onChange={(e) => handleChange(s.id, "saboki_para", e.target.value)}
                          className="w-full text-xs p-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-600 focus:outline-none"
                        />
                      </td>

                      <td className="px-4 py-3.5">
                        <input
                          type="text"
                          placeholder="আমুখতা দাওর..."
                          value={state.amukhta_para || ""}
                          onChange={(e) => handleChange(s.id, "amukhta_para", e.target.value)}
                          className="w-full text-xs p-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-600 focus:outline-none"
                        />
                      </td>

                      <td className="px-4 py-3.5">
                        <select
                          value={state.performance_rating || "মুমতাজ (Excellent)"}
                          onChange={(e) => handleChange(s.id, "performance_rating", e.target.value)}
                          className="w-full text-xs p-2 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-teal-600 focus:outline-none font-semibold"
                        >
                          <option value="মুমতাজ (Excellent)">মুমতাজ (Excellent)</option>
                          <option value="জায়্যিদ জিদ্দান (Very Good)">জায়্যিদ জিদ্দান (Very Good)</option>
                          <option value="জায়্যিদ (Good)">জায়্যিদ (Good)</option>
                          <option value="মাকবুল (Pass)">মাকবুল (Pass)</option>
                          <option value="দুর্বল (Needs Improvement)">দুর্বল (Needs Improvement)</option>
                        </select>
                      </td>

                      <td className="px-4 py-3.5">
                        <input
                          type="text"
                          placeholder="মন্তব্য..."
                          value={state.remarks || ""}
                          onChange={(e) => handleChange(s.id, "remarks", e.target.value)}
                          className="w-full text-xs p-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-600 focus:outline-none"
                        />
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400 text-sm">
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
            filteredStudents.map((s: any) => {
              const state = hifzState[s.id] || {};
              return (
                <div key={s.id} className="p-4 space-y-3 bg-white">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden border border-teal-200">
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
                              <a href={`tel:${s.phone}`} className="text-teal-700 hover:underline inline-flex items-center gap-0.5">
                                <Phone className="w-2.5 h-2.5" />
                                <span>{s.phone}</span>
                              </a>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded-lg shrink-0">
                      রোল: {toBanglaNumber(s.roll_number || "-")}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-teal-800 uppercase mb-1">সবক (নতুন পাঠ)</label>
                      <input
                        type="text"
                        placeholder="পারা / পৃষ্ঠা..."
                        value={state.sabak_para || ""}
                        onChange={(e) => handleChange(s.id, "sabak_para", e.target.value)}
                        className="w-full text-xs p-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-600 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-emerald-800 uppercase mb-1">সবকি (পারা পেছনে)</label>
                      <input
                        type="text"
                        placeholder="সবকি পৃষ্ঠা..."
                        value={state.saboki_para || ""}
                        onChange={(e) => handleChange(s.id, "saboki_para", e.target.value)}
                        className="w-full text-xs p-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-600 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-blue-800 uppercase mb-1">আমুখতা (দাওর)</label>
                      <input
                        type="text"
                        placeholder="আমুখতা দাওর..."
                        value={state.amukhta_para || ""}
                        onChange={(e) => handleChange(s.id, "amukhta_para", e.target.value)}
                        className="w-full text-xs p-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">মূল্যায়ন রেটিং</label>
                      <select
                        value={state.performance_rating || "মুমতাজ (Excellent)"}
                        onChange={(e) => handleChange(s.id, "performance_rating", e.target.value)}
                        className="w-full text-xs p-2 border border-slate-200 rounded-xl bg-white font-semibold"
                      >
                        <option value="মুমতাজ (Excellent)">মুমতাজ (Excellent)</option>
                        <option value="জায়্যিদ জিদ্দান (Very Good)">জায়্যিদ জিদ্দান (Very Good)</option>
                        <option value="জায়্যিদ (Good)">জায়্যিদ (Good)</option>
                        <option value="মাকবুল (Pass)">মাকবুল (Pass)</option>
                        <option value="দুর্বল (Needs Improvement)">দুর্বল (Needs Improvement)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">উস্তাদের মন্তব্য</label>
                      <input
                        type="text"
                        placeholder="মন্তব্য লিখুন..."
                        value={state.remarks || ""}
                        onChange={(e) => handleChange(s.id, "remarks", e.target.value)}
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

        {/* Bottom Save Bar */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500 font-medium">
            মোট হিফজ শিক্ষার্থী: <strong>{toBanglaNumber(students.length)}</strong> জন
          </div>

          <button
            type="button"
            onClick={saveLogs}
            disabled={loading || students.length === 0}
            className="px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{loading ? "সংরক্ষণ হচ্ছে..." : "সবক রেকর্ড সংরক্ষণ করুন"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
