"use client";
import { postTeacherEntry, TeacherEntryError } from "@/lib/portal-sync";
import { usePortalOwner } from "@/hooks/useOfflinePortalData";

import { useState, useMemo, useEffect, useLayoutEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, CheckCircle2, LockKeyhole, Search, Phone, Loader2, ArrowUpDown, Clock } from "lucide-react";
import { toBanglaNumber } from "@/lib/numberToBangla";
import { sortStudentsByRoll } from "@/lib/student-utils";
import { resolveGradeRule, getGradeBadgeClass, type GradeRule } from "@/lib/exam-grading";
import FrozenDraftNotice from "./FrozenDraftNotice";
import { useExamLock } from "@/hooks/useExamLock";
import { MarkField, parts, type Part, type Mark, type SavedMark } from "./MarkField";
import {
  type ExamSubjectSubPart,
  extractSubPartMarks,
  sanitizeSubParts,
  validateAndSumSubPartMarks,
} from "@/lib/exam-subparts";

type Student = {
  id: string;
  first_name: string;
  last_name: string;
  roll_number?: string;
  student_id?: string;
  student_id_formatted?: string;
  photo_url?: string;
  phone?: string;
};
type Subject = {
  subject_name: string;
  total_marks?: number | string;
  pass_marks?: number | string;
  sub_parts?: ExamSubjectSubPart[];
};
type Props = {
  exams: { id: string; title: string; year?: string }[];
  locked: boolean | null;
  classes: { id: string; name: string }[];
  students: Student[];
  existingMarks: SavedMark[];
  currentExamId: string;
  currentClassId: string;
  currentSubject: string;
  madrasaId: string;
  subjects: Subject[];
  subject?: Subject;
  gradeRules?: GradeRule[];
};

export default function ExamMarksForm({
  exams,
  locked,
  classes,
  students,
  existingMarks,
  currentExamId,
  currentClassId,
  currentSubject,
  madrasaId,
  subjects,
  subject,
  gradeRules,
}: Props) {
  const router = useRouter();
  const syncOwner = usePortalOwner();
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "success" | "queued" | "error"; text: string } | null>(null);
  const { readOnly, unavailable, observeFailure } = useExamLock(currentExamId, locked);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "completed">("all");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [drafts, setDrafts] = useState<Record<string, Mark>>({});
  const activeSubParts = useMemo(() => sanitizeSubParts(subject?.sub_parts), [subject?.sub_parts]);
  const writable = useRef(false);
  useLayoutEffect(() => {
    writable.current = !!currentSubject && !readOnly && !isPending;
    return () => {
      writable.current = false;
    };
  }, [currentSubject, readOnly, isPending]);
  useEffect(() => {
    if (readOnly && !unavailable) setDrafts({});
  }, [readOnly, unavailable]);

  // The saved snapshot and the edit buffer are separate. A freeze must never display a
  // local draft as if it were a saved grade. A routine refresh must not wipe other edits.
  const saved = useMemo(
    () => new Map<string, SavedMark>(existingMarks.map((m) => [m.student_id, m])),
    [existingMarks],
  );
  const marksState = useMemo(() => {
    const result: Record<string, Mark> = {};
    for (const s of students) {
      const row = saved.get(s.id);
      const keys = parts.filter((k) => row?.[k] != null);
      const mark: Mark = {
        marks_obtained: String(row?.marks_obtained ?? ""),
        total_marks: String((readOnly ? row?.total_marks : null) ?? subject?.total_marks ?? 100),
        sub_part_marks: activeSubParts.length
          ? extractSubPartMarks(row, activeSubParts, row?.sub_part_marks as Record<string, number> | null)
          : undefined,
        components: !activeSubParts.length && keys.length
          ? Object.fromEntries(keys.map((k) => [k, String(row![k])]))
          : undefined,
      };
      result[s.id] = (!readOnly && drafts[s.id]) || mark;
    }
    return result;
  }, [students, saved, readOnly, subject, drafts, activeSubParts]);

  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(window.location.search);
    if (key !== "subject_name") params.delete("subject_name");
    params.set(key, value);
    startTransition(() => {
      router.push(`/teacher-portal/exams?${params.toString()}`);
    });
  };

  const handleChange = (id: string, field: Part | "marks_obtained", value: string) => {
    if (!writable.current || loading) return;
    setMessage(null);
    setDrafts((prev) => {
      const next = { ...(prev[id] ?? marksState[id]) };
      if (field === "marks_obtained") next.marks_obtained = value;
      else {
        next.components = { ...next.components, [field]: value };
        const values = Object.values(next.components).filter((v) => v !== "");
        next.marks_obtained = values.length
          ? String(Number(values.reduce((n, v) => n + Number(v), 0).toFixed(2)))
          : "";
      }
      return { ...prev, [id]: next };
    });
  };

  const handleSubPartChange = (id: string, partKey: string, value: string) => {
    if (!writable.current || loading) return;
    setMessage(null);
    setDrafts((prev) => {
      const base = prev[id] ?? marksState[id];
      const nextSubMarks = { ...(base.sub_part_marks || {}), [partKey]: value };
      const values = activeSubParts
        .map((p) => nextSubMarks[p.key])
        .filter((v) => v !== undefined && v !== null && v !== "");
      const sum = values.length
        ? String(Number(values.reduce((n, v) => n + Number(v), 0).toFixed(2)))
        : "";
      return {
        ...prev,
        [id]: {
          ...base,
          sub_part_marks: nextSubMarks,
          marks_obtained: sum,
        },
      };
    });
  };

  const markField = (id: string) => (
    <MarkField
      mark={marksState[id]}
      subParts={activeSubParts}
      readOnly={readOnly}
      disabled={loading || isPending}
      change={(k, v) => handleChange(id, k, v)}
      changeSubPart={(partKey, v) => handleSubPartChange(id, partKey, v)}
    />
  );

  const getGradeInfo = (obtained: number, total: number) => {
    if (!total || isNaN(obtained)) return { grade: "-", color: "text-slate-400" };
    const pct = (obtained / total) * 100;
    const rule = resolveGradeRule(pct, gradeRules, obtained < Number(subject?.pass_marks ?? 33));
    return {
      grade: rule.label,
      color: getGradeBadgeClass(rule.color),
    };
  };

  const counts = useMemo(() => {
    let completed = 0;
    let pending = 0;
    (students || []).forEach((s) => {
      const state = marksState[s.id];
      if (
        state &&
        state.marks_obtained !== "" &&
        state.marks_obtained !== undefined &&
        state.marks_obtained !== null
      ) {
        completed++;
      } else {
        pending++;
      }
    });
    return { all: (students || []).length, completed, pending };
  }, [students, marksState]);

  const filteredStudents = useMemo(() => {
    let list = students ? [...students] : [];

    // Status Filter
    if (statusFilter === "completed") {
      list = list.filter((s) => {
        const state = marksState[s.id];
        return (
          state &&
          state.marks_obtained !== "" &&
          state.marks_obtained !== undefined &&
          state.marks_obtained !== null
        );
      });
    } else if (statusFilter === "pending") {
      list = list.filter((s) => {
        const state = marksState[s.id];
        return (
          !state ||
          state.marks_obtained === "" ||
          state.marks_obtained === undefined ||
          state.marks_obtained === null
        );
      });
    }

    // Search Query (name or roll)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (s) =>
          s.first_name?.toLowerCase().includes(q) ||
          s.last_name?.toLowerCase().includes(q) ||
          String(s.roll_number || "").includes(q) ||
          toBanglaNumber(s.roll_number || "").includes(q),
      );
    }

    // Roll Sorting
    const sorted = sortStudentsByRoll(list);
    return sortOrder === "desc" ? sorted.reverse() : sorted;
  }, [students, searchQuery, statusFilter, sortOrder, marksState]);

  const saveMarks = async () => {
    if (!writable.current || loading) return;
    setLoading(true);
    setMessage(null);
    try {
      const records = students
        .filter((s) => drafts[s.id])
        .map((s) => {
          const mark = drafts[s.id];
          const obtained = Number(mark.marks_obtained),
            total = Number(mark.total_marks);
          if (activeSubParts.length > 0) {
            const check = validateAndSumSubPartMarks(activeSubParts, mark.sub_part_marks);
            if (!check.valid) {
              throw new Error(`${s.first_name} ${s.last_name || ""}: ${check.error}`);
            }
          }
          if (
            mark.marks_obtained === "" ||
            !Number.isFinite(obtained) ||
            obtained < 0 ||
            obtained > total ||
            Object.values(mark.components ?? {}).some((v) => !Number.isFinite(Number(v)) || Number(v) < 0)
          )
            throw new Error("প্রাপ্ত নম্বর শূন্য থেকে পূর্ণমানের মধ্যে লিখুন।");
          return {
            student_id: s.id,
            marks_obtained: obtained,
            total_marks: total,
            ...(activeSubParts.length > 0
              ? { sub_part_marks: mark.sub_part_marks || {} }
              : {
                  written_marks: null,
                  oral_marks: null,
                  tutorial_marks: null,
                  attendance_marks: null,
                }),
          };
        });
      if (!records.length) return;
      const payload = {
        exam_id: currentExamId,
        class_id: currentClassId,
        subject_name: currentSubject,
        madrasa_id: madrasaId,
        records,
      };
      const result = await postTeacherEntry("exam_marks", payload, syncOwner, () => {
        if (!writable.current) throw new Error("নম্বর এন্ট্রি বন্ধ আছে।");
      });
      setMessage(
        result.offlineQueued
          ? { type: "queued", text: "নম্বর অফলাইন সারিতে আছে; এখনও সার্ভারে সংরক্ষিত হয়নি।" }
          : { type: "success", text: "পরীক্ষার নম্বর সংরক্ষিত হয়েছে।" },
      );
      if (!result.offlineQueued) {
        startTransition(() => {
          setDrafts({});
          router.refresh();
        });
      }
    } catch (err) {
      if (err instanceof TeacherEntryError) observeFailure(err.code);
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "নম্বর সংরক্ষণ করতে সমস্যা হয়েছে।",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Pending Transition Loading Indicator */}
      {isPending && (
        <div className="flex items-center gap-2 p-3 bg-purple-50 text-purple-800 rounded-xl border border-purple-200 text-xs sm:text-sm font-medium animate-pulse">
          <Loader2 className="w-4 h-4 animate-spin shrink-0 text-purple-700" />
          <span>ডেটা লোড হচ্ছে, অনুগ্রহ করে অপেক্ষা করুন...</span>
        </div>
      )}

      {/* Selection Control Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              পরীক্ষা নির্বাচন করুন <span className="text-purple-600">*</span>
            </label>
            <select
              aria-label="পরীক্ষা নির্বাচন করুন"
              value={currentExamId}
              disabled={isPending || loading}
              onChange={(e) => handleFilterChange("exam_id", e.target.value)}
              className="w-full p-2.5 sm:p-3 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold bg-white focus:ring-2 focus:ring-purple-600 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
            >
              {!currentExamId && <option value="">{exams.length ? "পরীক্ষা নির্বাচন করুন" : "কোনো পরীক্ষা পাওয়া যায়নি"}</option>}
              {exams.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title} {e.year ? `(${toBanglaNumber(e.year)})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              জামাত / শ্রেণি <span className="text-purple-600">*</span>
            </label>
            <select
              aria-label="জামাত নির্বাচন করুন"
              value={currentClassId}
              disabled={isPending || loading}
              onChange={(e) => handleFilterChange("class_id", e.target.value)}
              className="w-full p-2.5 sm:p-3 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold bg-white focus:ring-2 focus:ring-purple-600 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
            >
              {!currentClassId && <option value="">{classes.length ? "জামাত নির্বাচন করুন" : "কোনো জামাত পাওয়া যায়নি"}</option>}
              {classes.map((c) => (
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
              <select aria-label="বিষয় নির্বাচন করুন" value={currentSubject} disabled={isPending || loading} className="w-full p-2.5 border rounded-xl" onChange={e=>handleFilterChange('subject_name',e.target.value)}>
                <option value="">বিষয় নির্বাচন করুন</option>
                {subjects.map((d)=><option key={d.subject_name} value={d.subject_name}>{d.subject_name}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Student Search, Status Filter & Sort Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
          <div className="relative flex-1">
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

          <div className="flex items-center gap-2 flex-wrap">
            {/* Status Filter Pills */}
            <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                  statusFilter === "all"
                    ? "bg-purple-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                সকল ({toBanglaNumber(counts.all)})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("pending")}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 ${
                  statusFilter === "pending"
                    ? "bg-amber-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Clock className="w-3 h-3" />
                <span>বাকি ({toBanglaNumber(counts.pending)})</span>
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("completed")}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1 ${
                  statusFilter === "completed"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <CheckCircle2 className="w-3 h-3" />
                <span>সম্পন্ন ({toBanglaNumber(counts.completed)})</span>
              </button>
            </div>

            {/* Sort Toggle Button */}
            <button
              type="button"
              onClick={() => setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
              className="px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-700 flex items-center gap-1 shadow-2xs transition"
              title="রোল অনুযায়ী সাজান"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
              <span>রোল: {sortOrder === "asc" ? "১ → ১০" : "১০ → ১"}</span>
            </button>
          </div>
        </div>
      </div>

      {currentExamId && currentClassId && !subjects.length && <p role="status" className="text-sm text-slate-600">
        এই পরীক্ষায় এই জামাতের কোনো বিষয় আপনার জন্য বরাদ্দ নেই।
      </p>}
      <FrozenDraftNotice owner={syncOwner} exam={currentExamId} group={currentClassId} subject={currentSubject} />
      {currentExamId && readOnly && (
        <div role="status" className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
          <LockKeyhole aria-hidden className="size-5 shrink-0" />
          {unavailable ? "পরীক্ষার লক অবস্থা যাচাই করা যায়নি। আপাতত শুধু সংরক্ষিত নম্বর দেখতে পারবেন।"
            : "পরীক্ষাটি লক করা আছে। সংরক্ষিত নম্বর ও গ্রেড শুধু দেখা যাবে।"}
        </div>
      )}
      {message && !readOnly && (
        <p role="status" className={`p-4 rounded-xl text-sm font-semibold ${message.type === "success" ? "bg-emerald-50 text-emerald-900" : message.type === "queued" ? "bg-amber-50 text-amber-900" : "bg-red-50 text-red-900"}`}>
          {message.text}
        </p>
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
                <th className="px-5 py-3.5 text-right">গ্রেড</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredStudents.length > 0 ? (
                filteredStudents.map((s) => {
                  const state = marksState[s.id];
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
                              <span className="font-mono">আইডি: {toBanglaNumber(s.student_id_formatted || s.student_id || "—")}</span>
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
                        <span className="font-medium text-slate-700">{toBanglaNumber(state.total_marks)}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        {markField(s.id)}
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
            filteredStudents.map((s) => {
              const state = marksState[s.id];
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
                          <span>আইডি: {toBanglaNumber(s.student_id_formatted || s.student_id || "—")}</span>
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
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">পূর্ণমান</label>
                      <span className="font-medium text-slate-700">{toBanglaNumber(state.total_marks)}</span>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-purple-800 mb-1">প্রাপ্ত নম্বর</label>
                      {markField(s.id)}
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
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-slate-500 font-medium">
            মোট পরীক্ষার্থী: <strong>{toBanglaNumber(students.length)}</strong> জন
          </div>

          {!readOnly && currentSubject && <button
            type="button"
            onClick={saveMarks}
            disabled={loading || isPending || !Object.keys(drafts).length}
            className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 bg-purple-700 hover:bg-purple-800 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{loading ? "সংরক্ষণ হচ্ছে..." : "নম্বর সংরক্ষণ করুন"}</span>
          </button>}
        </div>
      </div>
    </div>
  );
}
