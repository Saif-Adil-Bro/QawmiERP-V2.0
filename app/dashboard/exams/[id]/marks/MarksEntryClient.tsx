"use client";

import { useState, useEffect, useMemo } from "react";
import { getExamResults, saveExamMarks, getExamSubjects } from "@/app/actions/exams";
import { getClassSubjects } from "@/app/actions/class_subjects";
import { Search, ArrowUpDown, CheckCircle, Clock } from "lucide-react";
import { toBanglaNumber } from "@/lib/numberToBangla";
import { sortStudentsByRoll } from "@/lib/student-utils";
import { useExamLock } from "@/hooks/useExamLock";
import ExamLockToggle from "../../ExamLockToggle";
import {
  type ExamSubjectSubPart,
  extractSubPartMarks,
  sanitizeSubParts,
  validateAndSumSubPartMarks,
} from "@/lib/exam-subparts";

interface MarksEntryClientProps {
  examId: string;
  examTitle?: string;
  classes: { id: string; name: string }[];
  initialLocked?: boolean;
  lockedByName?: string | null;
  lockedAt?: string | null;
  lockReason?: string | null;
  canManageLocks?: boolean;
}

export default function MarksEntryClient({
  examId,
  examTitle,
  classes,
  initialLocked = false,
  lockedByName = null,
  lockedAt = null,
  lockReason = null,
  canManageLocks = false,
}: MarksEntryClientProps) {
  const {readOnly: isLocked, unavailable, observe, observeFailure} = useExamLock(examId, initialLocked);
  const [classId, setClassId] = useState("");
  const [subjectName, setSubjectName] = useState("");
  const [saved, setSaved] = useState<any[]>([]);
  const [edited, setStudents] = useState<any[]>([]);
  const students = isLocked ? saved : edited;
  const [loadRequest, setLoadRequest] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [subjects, setSubjects] = useState<{ id: string, name: string }[]>([]);
  const [examSubjectsDetails, setExamSubjectsDetails] = useState<any[]>([]);

  // Filtering & Sorting states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "completed">("all");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const activeSubParts: ExamSubjectSubPart[] = useMemo(() => {
    const matched = examSubjectsDetails.find((s) => s.subject_name === subjectName);
    return sanitizeSubParts(matched?.sub_parts);
  }, [examSubjectsDetails, subjectName]);

  useEffect(() => {
    let active = true;
    setLoadRequest(0);
    setSaved([]);
    if (classId) {
      // Fetch both standard class subjects and exam-specific setup
      Promise.all([
        getClassSubjects(classId),
        getExamSubjects(examId, classId)
      ]).then(([classSubjData, examSubjData]) => {
        if (!active) return;
        let finalSubjects = [];
        if (examSubjData && examSubjData.length > 0) {
          finalSubjects = examSubjData.map((s: any) => ({ id: s.id, name: s.subject_name }));
          setExamSubjectsDetails(examSubjData);
        } else {
          finalSubjects = classSubjData.map((item: any) => ({ id: item.subjects?.id, name: item.subjects?.name }));
          setExamSubjectsDetails([]);
        }
        setSubjects(finalSubjects);
        setSubjectName("");
        setStudents([]);
      });
    } else {
      setSubjects([]);
      setExamSubjectsDetails([]);
      setSubjectName("");
      setStudents([]);
    }
    return () => { active = false; };
  }, [classId, examId]);

  useEffect(() => {
    if (!loadRequest || !classId || !subjectName) { setLoading(false); return; }
    let active = true;
    setLoading(true);
    setMessage(null);
    getExamResults(examId, classId, subjectName).then(data => {
      if (!active) return;
      const matchedSubject = examSubjectsDetails.find(s => s.subject_name === subjectName);
      const configured = matchedSubject?.total_marks;
      const subParts = sanitizeSubParts(matchedSubject?.sub_parts);
      const rows = data.map((student: any) => ({
        ...student,
        total_marks: student.total_marks ?? configured ?? 100,
        sub_part_marks: subParts.length
          ? extractSubPartMarks(student, subParts, student.sub_part_marks)
          : {},
      }));
      setSaved(rows);
      setStudents(configured != null ? rows.map(s => ({ ...s, total_marks: configured })) : rows);
    }).catch(() => { if (active) setMessage({type: "error", text: "নম্বর পড়া যায়নি। আবার চেষ্টা করুন।"}); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [examId, classId, subjectName, examSubjectsDetails, loadRequest, isLocked]);

  const handleMarksChange = (studentId: string, field: 'marks_obtained' | 'total_marks', value: string) => {
    if (isLocked) return;
    setStudents(prev => prev.map(s => s.id === studentId ? { ...s, [field]: value } : s));
  };

  const handleSubPartChange = (studentId: string, partKey: string, value: string) => {
    if (isLocked) return;
    setStudents(prev => prev.map(s => {
      if (s.id !== studentId) return s;
      const nextSubMarks = { ...(s.sub_part_marks || {}), [partKey]: value };
      const values = activeSubParts
        .map(p => nextSubMarks[p.key])
        .filter(v => v !== undefined && v !== null && v !== "");
      const sum = values.length
        ? String(Number(values.reduce((acc, v) => acc + (Number(v) || 0), 0).toFixed(2)))
        : "";
      return {
        ...s,
        sub_part_marks: nextSubMarks,
        marks_obtained: sum,
      };
    }));
  };

  const handleSave = async () => {
    if (isLocked) {
      setMessage({
        type: 'error',
        text: 'এই পরীক্ষাটি ফ্রিজ (লক) করা আছে। নম্বর পরিবর্তন করতে হলে মুহতামিম বা সুপার অ্যাডমিনকে আনলক করতে হবে।',
      });
      return;
    }
    setSaving(true);
    setMessage(null);

    // Validate sub-part max marks if sub-parts are configured
    if (activeSubParts.length > 0) {
      for (const s of students) {
        if (s.marks_obtained === '' || s.marks_obtained == null) continue;
        const check = validateAndSumSubPartMarks(activeSubParts, s.sub_part_marks);
        if (!check.valid) {
          setMessage({ type: 'error', text: `${s.first_name} ${s.last_name || ''}: ${check.error}` });
          setSaving(false);
          return;
        }
      }
    }

    // validation
    const invalid = students.some(s => s.marks_obtained !== '' && Number(s.marks_obtained) > Number(s.total_marks));
    if (invalid) {
      setMessage({ type: 'error', text: 'প্রাপ্ত নম্বর মোট নম্বরের চেয়ে বেশি হতে পারে না।' });
      setSaving(false);
      return;
    }

    const marksData = students
      .filter(s => s.marks_obtained !== '')
      .map(s => ({
        student_id: s.id,
        marks_obtained: Number(s.marks_obtained),
        total_marks: Number(s.total_marks || 100),
        ...(activeSubParts.length > 0
          ? { sub_part_marks: s.sub_part_marks || {} }
          : {
              written_marks: null,
              oral_marks: null,
              tutorial_marks: null,
              attendance_marks: null,
            }),
      }));

    if (marksData.length === 0) {
      setMessage({ type: 'error', text: 'অন্তত একজন শিক্ষার্থীর নম্বর এন্ট্রি করুন।' });
      setSaving(false);
      return;
    }

    try {
      const result = await saveExamMarks(examId, subjectName, marksData, classId);

      if (result?.error) {
        if ("code" in result) observeFailure(result.code);
        setMessage({ type: 'error', text: result.error });
      } else {
        setMessage({ type: 'success', text: 'নম্বর সফলভাবে সেভ করা হয়েছে!' });
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (err) {
      console.error("saveExamMarks failed:", err);
      setMessage({
        type: 'error',
        text: 'একটি অপ্রত্যাশিত সমস্যা হয়েছে। সম্ভবত নতুন আপডেট ডিপ্লয় হয়েছে — অনুগ্রহ করে পেজ রিফ্রেশ করে আবার চেষ্টা করুন।',
      });
    } finally {
      setSaving(false);
    }
  };

  const selectedClassName = classes.find(c => c.id === classId)?.name || '';

  // Stats counts
  const counts = useMemo(() => {
    let completed = 0;
    let pending = 0;
    for (const s of students) {
      if (s.marks_obtained !== '' && s.marks_obtained !== undefined && s.marks_obtained !== null) {
        completed++;
      } else {
        pending++;
      }
    }
    return { all: students.length, completed, pending };
  }, [students]);

  // Filtered & Sorted student list
  const filteredStudents = useMemo(() => {
    let list = [...students];

    // Status Filter
    if (statusFilter === "completed") {
      list = list.filter(s => s.marks_obtained !== '' && s.marks_obtained !== undefined && s.marks_obtained !== null);
    } else if (statusFilter === "pending") {
      list = list.filter(s => s.marks_obtained === '' || s.marks_obtained === undefined || s.marks_obtained === null);
    }

    // Search Query (name or roll)
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(s => {
        const fullName = `${s.first_name || ""} ${s.last_name || ""}`.toLowerCase();
        const rollStr = String(s.roll_number || "").toLowerCase();
        const bRoll = toBanglaNumber(s.roll_number || "");
        return fullName.includes(q) || rollStr.includes(q) || bRoll.includes(q);
      });
    }

    // Roll Sorting
    const sorted = sortStudentsByRoll(list);
    return sortOrder === "desc" ? sorted.reverse() : sorted;
  }, [students, statusFilter, searchQuery, sortOrder]);

  return (
    <div className="space-y-6">
      {unavailable ? <p role="status">পরীক্ষার লক অবস্থা যাচাই করা যায়নি। আপাতত নম্বর শুধু দেখা যাবে।</p> : <ExamLockToggle
        examId={examId}
        examTitle={examTitle}
        initialLocked={isLocked}
        lockedByName={lockedByName}
        lockedAt={lockedAt}
        lockReason={lockReason}
        canManageLocks={canManageLocks}
        size="full"
        onStatusChange={observe}
      />}

      {message && (
        <div className={`p-4 rounded-md text-sm font-medium ${message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          {message.text}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-4 items-end bg-slate-50 p-4 rounded-lg border border-slate-100">
        <div className="w-full sm:w-1/3">
          <label className="block text-sm font-medium text-slate-700 mb-1">ক্লাস</label>
          <select 
            value={classId}
            onChange={(e) => { setClassId(e.target.value); setSubjectName(""); setSaved([]); setStudents([]); setLoadRequest(0); }}
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 transition bg-white"
          >
            <option value="">নির্বাচন করুন</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="w-full sm:w-1/3">
          <label className="block text-sm font-medium text-slate-700 mb-1">বিষয়</label>
          <select 
            value={subjectName}
            onChange={(e) => { setSubjectName(e.target.value); setSaved([]); setStudents([]); setLoadRequest(0); }}
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900 transition bg-white"
            disabled={!classId}
          >
            <option value="">নির্বাচন করুন</option>
            {subjects.map(s => (
              <option key={s.id} value={s.name}>{s.name}</option>
            ))}
          </select>
        </div>

        <div className="w-full sm:w-1/3">
          <button 
            onClick={() => setLoadRequest(n => n + 1)}
            disabled={!classId || !subjectName || loading}
            className="w-full px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 transition disabled:opacity-50 font-medium shadow-sm"
          >
            {loading ? "খুঁজছি..." : "শিক্ষার্থী খুঁজুন"}
          </button>
        </div>
      </div>

      {students.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-slate-800 text-base">
                শিক্ষার্থীদের তালিকা ({selectedClassName} - {subjectName})
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                মোট: {toBanglaNumber(counts.all)} জন | সম্পন্ন: {toBanglaNumber(counts.completed)} জন | বাকি: {toBanglaNumber(counts.pending)} জন
              </p>
            </div>
            <button 
              onClick={handleSave}
              disabled={saving || loading || isLocked}
              className="px-4 py-2 bg-slate-900 text-white rounded-md hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm font-medium shrink-0 shadow-xs"
            >
              {isLocked ? "পরীক্ষা লকড (ফ্রিজ)" : saving ? "সেভ হচ্ছে..." : "সব সেভ করুন"}
            </button>
          </div>

          {/* Search, Status Filter & Roll Sort Controls */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="শিক্ষার্থীর নাম বা রোল লিখে খুঁজুন..."
                className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Status Filter Tabs */}
              <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setStatusFilter("all")}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                    statusFilter === "all"
                      ? "bg-slate-900 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  সকল ({toBanglaNumber(counts.all)})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("pending")}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1 ${
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
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1 ${
                    statusFilter === "completed"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <CheckCircle className="w-3 h-3" />
                  <span>সম্পন্ন ({toBanglaNumber(counts.completed)})</span>
                </button>
              </div>

              {/* Roll Sort Order Button */}
              <button
                type="button"
                onClick={() => setSortOrder(prev => prev === "asc" ? "desc" : "asc")}
                className="px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg hover:bg-slate-100 text-slate-700 flex items-center gap-1 shadow-2xs transition"
                title="রোল অনুযায়ী সাজান"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
                <span>রোল: {sortOrder === "asc" ? "১ → ১০" : "১০ → ১"}</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-700 font-medium border-b">
                <tr>
                  <th className="px-4 py-3">রোল</th>
                  <th className="px-4 py-3 min-w-[150px]">নাম</th>
                  <th className="px-4 py-3 w-28">মোট নম্বর</th>
                  {activeSubParts.map((part) => (
                    <th key={part.key} className="px-4 py-3 w-32 text-emerald-700">
                      {part.name}{" "}
                      <span className="text-xs font-normal text-slate-500">
                        ({toBanglaNumber(part.max_marks)})
                      </span>
                    </th>
                  ))}
                  <th className="px-4 py-3 w-32 font-bold">প্রাপ্ত নম্বর</th>
                </tr>
              </thead>
              <tbody className="divide-y text-slate-600 bg-white">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={4 + activeSubParts.length} className="px-4 py-8 text-center text-slate-400 text-sm italic">
                      কোনো শিক্ষার্থী পাওয়া যায়নি
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((student) => (
                    <tr key={student.id} className="hover:bg-slate-50/50 transition">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">
                        {toBanglaNumber(student.roll_number || '-')}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {student.first_name} {student.last_name}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={student.total_marks}
                          onChange={(e) => handleMarksChange(student.id, 'total_marks', e.target.value)}
                          disabled={loading || isLocked || !!examSubjectsDetails.length}
                          className="w-full px-2 py-1.5 border rounded focus:outline-none focus:ring-1 focus:ring-slate-900 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                          min="0"
                        />
                      </td>
                      {activeSubParts.map((part) => (
                        <td key={part.key} className="px-4 py-3">
                          <input
                            type="number"
                            value={student.sub_part_marks?.[part.key] ?? ""}
                            onChange={(e) => handleSubPartChange(student.id, part.key, e.target.value)}
                            disabled={loading || isLocked}
                            className="w-full px-2 py-1.5 border border-emerald-200 rounded focus:outline-none focus:ring-1 focus:ring-emerald-600 bg-emerald-50/30 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                            min="0"
                            max={part.max_marks}
                            step="0.01"
                            placeholder={`০–${toBanglaNumber(part.max_marks)}`}
                          />
                        </td>
                      ))}
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={student.marks_obtained}
                          onChange={(e) => handleMarksChange(student.id, 'marks_obtained', e.target.value)}
                          disabled={loading || isLocked || activeSubParts.length > 0}
                          className="w-full px-2 py-1.5 border-2 border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-900 font-bold bg-slate-50 disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                          min="0"
                          max={student.total_marks}
                          step="0.01"
                          placeholder="0"
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
