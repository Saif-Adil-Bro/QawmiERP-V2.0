"use client";

import { toDhakaDateString } from "@/lib/date-utils";
import { useState, useEffect } from "react";
import { getExamSubjects, saveExamSubjects, updateExamDetails, getExamEvaluationSettings } from "@/app/actions/exams";
import { useExamLock } from "@/hooks/useExamLock";
import { getClassSubjects } from "@/app/actions/class_subjects";
import { Plus, Trash2, Save, Calendar, Sparkles, CheckCircle2, AlertCircle, ShieldCheck, Layers, ChevronDown, ChevronUp } from "lucide-react";
import {
  type ExamSubjectSubPart,
  SUBPART_PRESETS,
  makeSubPartKey,
  sumSubPartMaxMarks,
} from "@/lib/exam-subparts";

function getDynamicStatusInfo(startDate: string, endDate: string) {
  if (!startDate) {
    return {
      type: "Upcoming",
      label: "আসন্ন (Upcoming)",
      description: "শুরুর তারিখ ও শেষের তারিখের ওপর ভিত্তি করে অবস্থা স্বয়ংক্রিয়ভাবে হিসাব করা হবে।",
      badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
      dotClass: "bg-blue-500",
      isPulsing: false,
    };
  }

  let todayStr: string;
  try {
    todayStr = new Intl.DateTimeFormat('en-CA', { 
      timeZone: 'Asia/Dhaka', 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    }).format(new Date());
  } catch {
    todayStr = toDhakaDateString();
  }

  const sStr = startDate.split('T')[0];
  const eStr = endDate ? endDate.split('T')[0] : sStr;

  if (todayStr < sStr) {
    return {
      type: "Upcoming",
      label: "আসন্ন (Upcoming)",
      description: "পরীক্ষার তারিখ নির্ধারিত রয়েছে, নির্ধারিত দিনে পরীক্ষা শুরু হবে।",
      badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
      dotClass: "bg-blue-500",
      isPulsing: false,
    };
  } else if (todayStr >= sStr && todayStr <= eStr) {
    return {
      type: "Ongoing",
      label: "চলমান (Ongoing)",
      description: "আজকের তারিখ শুরু ও শেষ তারিখের মধ্যে হওয়ায় পরীক্ষাটি বর্তমানে চলমান।",
      badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
      dotClass: "bg-amber-500",
      isPulsing: true,
    };
  } else {
    return {
      type: "Completed",
      label: "সম্পন্ন (Completed)",
      description: "পরীক্ষার সময়সীমা অতিক্রান্ত হয়েছে, পরীক্ষা সফলভাবে সম্পন্ন।",
      badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
      dotClass: "bg-emerald-500",
      isPulsing: false,
    };
  }
}

type SetupProps = { examId: string; exam: any; classes: any[] };
export default function ExamSetupClient(props: SetupProps) {
  const [classId, setClassId] = useState("");
  const {readOnly, unavailable, observeFailure} = useExamLock(props.examId, props.exam.is_locked);
  return <>
    {readOnly && <p role="status" className="mb-4 rounded-lg bg-amber-50 p-3 text-amber-900">
      {unavailable ? "লক অবস্থা যাচাই করা যায়নি।" : "পরীক্ষাটি লক করা আছে।"} তারিখ, মূল্যায়ন নীতি ও বিষয় শুধু দেখা যাবে।
    </p>}
    <SetupForm key={`${props.examId}:${props.exam.is_locked}:${readOnly}`} {...props} classId={classId} setClassId={setClassId} readOnly={readOnly} observeFailure={observeFailure} />
  </>;
}
function SetupForm({examId, exam, classes, classId, setClassId, readOnly, observeFailure}: SetupProps & {
  classId: string; setClassId: (id: string) => void; readOnly: boolean; observeFailure: (code: unknown) => void;
}) {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [subjectError, setSubjectError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failPolicy, setFailPolicy] = useState("compulsory_subject_fail");

  // Exam Date State
  const [startDate, setStartDate] = useState(exam?.start_date?.split('T')[0] || "");
  const [endDate, setEndDate] = useState(exam?.end_date?.split('T')[0] || exam?.effective_end_date?.split('T')[0] || "");
  const [savingDate, setSavingDate] = useState(false);
  const [dateSuccess, setDateSuccess] = useState(false);

  useEffect(() => {
    async function loadGlobalSettings() {
      const settings = await getExamEvaluationSettings(examId);
      if (settings?.fail_policy) {
        setFailPolicy(settings.fail_policy);
      }
    }
    loadGlobalSettings();
  }, [examId]);

  const statusInfo = getDynamicStatusInfo(startDate, endDate);

  const handleSaveDates = async () => {
    if (readOnly) return;
    setSavingDate(true);
    setDateSuccess(false);
    const res = await updateExamDetails(examId, {
      title: exam?.title,
      year: exam?.year,
      start_date: startDate || null,
      end_date: endDate || null
    });
    setSavingDate(false);
    if (res?.error) {
      if ("code" in res) observeFailure(res.code);
      alert("Error: " + res.error);
    } else {
      setDateSuccess(true);
      setTimeout(() => setDateSuccess(false), 3000);
    }
  };

  useEffect(() => {
    let active = true;
    setSubjects([]);
    setLoading(!!classId);
    setSubjectError(false);
    if (classId) void (async () => {
      try {
        const data = await getExamSubjects(examId, classId);
        if (!active) return;
        if (data.length || readOnly) { setSubjects(data); return; }
        const defaults = await getClassSubjects(classId);
        if (active) setSubjects((defaults.length ? defaults : [{}]).map((cs: any) => ({
          subject_name: cs.subjects?.name || "", total_marks: 100, pass_marks: 33, is_compulsory: true, exam_type: "Written",
        })));
      } catch { if (active) setSubjectError(true); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [classId, examId, readOnly]);

  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const handleAddSubject = () => {
    setSubjects([...subjects, { subject_name: "", total_marks: 100, pass_marks: 33, is_compulsory: true, exam_type: "Written", sub_parts: [] }]);
  };

  const handleRemoveSubject = (index: number) => {
    const newSubjects = [...subjects];
    newSubjects.splice(index, 1);
    setSubjects(newSubjects);
    if (expandedIdx === index) setExpandedIdx(null);
  };

  const handleChange = (index: number, field: string, value: any) => {
    const newSubjects = [...subjects];
    newSubjects[index] = { ...newSubjects[index], [field]: value };
    setSubjects(newSubjects);
  };

  const updateSubjectSubParts = (index: number, nextParts: ExamSubjectSubPart[]) => {
    const newSubjects = [...subjects];
    const sub = { ...newSubjects[index], sub_parts: nextParts };
    if (nextParts.length > 0) {
      sub.total_marks = sumSubPartMaxMarks(nextParts);
    }
    newSubjects[index] = sub;
    setSubjects(newSubjects);
  };

  const handleAddSubPart = (index: number, preset?: { key: string; name: string; defaultMarks: number }) => {
    const current: ExamSubjectSubPart[] = Array.isArray(subjects[index]?.sub_parts)
      ? [...subjects[index].sub_parts]
      : [];
    const used = new Set(current.map((p) => p.key));
    const name = preset ? preset.name : "";
    const key = preset && !used.has(preset.key)
      ? preset.key
      : makeSubPartKey(name || `part_${current.length + 1}`, current.length, used);
    const maxMarks = preset ? preset.defaultMarks : 20;
    updateSubjectSubParts(index, [...current, { key, name, max_marks: maxMarks }]);
    setExpandedIdx(index);
  };

  const handleSubPartFieldChange = (
    subIndex: number,
    partIndex: number,
    field: "name" | "max_marks",
    value: string | number
  ) => {
    const current: ExamSubjectSubPart[] = Array.isArray(subjects[subIndex]?.sub_parts)
      ? [...subjects[subIndex].sub_parts]
      : [];
    if (!current[partIndex]) return;
    current[partIndex] = {
      ...current[partIndex],
      [field]: field === "max_marks" ? Number(value) || 0 : String(value),
    };
    updateSubjectSubParts(subIndex, current);
  };

  const handleRemoveSubPart = (subIndex: number, partIndex: number) => {
    const current: ExamSubjectSubPart[] = Array.isArray(subjects[subIndex]?.sub_parts)
      ? [...subjects[subIndex].sub_parts]
      : [];
    current.splice(partIndex, 1);
    updateSubjectSubParts(subIndex, current);
  };

  const handleSave = async () => {
    if (readOnly) return;
    if (!classId) return alert("দয়া করে ক্লাস নির্বাচন করুন");

    for (const sub of subjects) {
      if (!sub.subject_name) return alert("সব বিষয়ের নাম দিতে হবে");
      const parts: ExamSubjectSubPart[] = Array.isArray(sub.sub_parts) ? sub.sub_parts : [];
      if (parts.some((p) => !String(p.name || "").trim() || !(Number(p.max_marks) > 0))) {
        return alert(`"${sub.subject_name}" বিষয়ের সব উপবিভাগের নাম ও সঠিক পূর্ণমান দিন।`);
      }
    }
    
    setSaving(true);
    try {
      const res = await saveExamSubjects(examId, classId, subjects, failPolicy);
      if (res?.error) {
        if ("code" in res) observeFailure(res.code);
        alert("Error: " + res.error);
      } else {
        alert("সফলভাবে সেভ হয়েছে!");
      }
    } catch (err) {
      console.error("saveExamSubjects failed:", err);
      alert("একটি অপ্রত্যাশিত সমস্যা হয়েছে। সম্ভবত নতুন আপডেট ডিপ্লয় হয়েছে — অনুগ্রহ করে পেজ রিফ্রেশ করে আবার চেষ্টা করুন।");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Exam Date & Automatic Status Card */}
      <fieldset disabled={readOnly} className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
          <div>
            <h3 className="font-bold text-slate-800 text-base">পরীক্ষার তারিখ ও স্বয়ংক্রিয় অবস্থা</h3>
            <p className="text-xs text-slate-500">শুরুর তারিখ ও শেষের তারিখ পরিবর্তন করলে অবস্থা নিজে থেকেই আপডেট হবে</p>
          </div>

          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${statusInfo.badgeClass}`}>
            <span className="relative flex h-2 w-2 mr-1.5">
              {statusInfo.isPulsing && (
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${statusInfo.dotClass}`}></span>
              )}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${statusInfo.dotClass}`}></span>
            </span>
            {statusInfo.label}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>শুরুর তারিখ (Start Date)</span>
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-emerald-600 outline-none bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>শেষের তারিখ (End Date)</span>
            </label>
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-emerald-600 outline-none bg-white"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-slate-500 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
            <span>{statusInfo.description}</span>
          </p>

          {!readOnly && <button
            onClick={handleSaveDates}
            disabled={savingDate}
            className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-xs font-bold transition shadow-xs disabled:opacity-50 cursor-pointer"
          >
            {savingDate ? "সেভ হচ্ছে..." : dateSuccess ? "আপডেট সম্পন্ন!" : "তারিখ আপডেট করুন"}
            {dateSuccess && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
          </button>}
        </div>
      </fieldset>

      {/* Global Evaluation & Fail Policy Card */}
      <fieldset disabled={readOnly} className="p-5 bg-emerald-50/60 border border-emerald-200/80 rounded-xl space-y-3">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-bold text-slate-900 text-sm">ফলাফল ও ফেল নির্ধারণ নীতি (Evaluation & Fail Rule)</h3>
            <p className="text-xs text-slate-600 mt-0.5">
              কোনো ছাত্র কোনো বিষয়ে পরীক্ষা না দিলে বা নম্বর না পেলে স্বয়ংক্রিয়ভাবে ০ গণনা করা হবে এবং মোট নম্বরে ওই বিষয় যুক্ত থাকবে।
            </p>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className={`flex items-start p-3 rounded-lg border text-xs cursor-pointer transition ${
                failPolicy === "compulsory_subject_fail" 
                  ? "bg-white border-emerald-600 ring-2 ring-emerald-500/20 shadow-xs" 
                  : "bg-white/70 border-slate-200 hover:bg-white"
              }`}>
                <input
                  type="radio"
                  name="failPolicy"
                  value="compulsory_subject_fail"
                  checked={failPolicy === "compulsory_subject_fail"}
                  onChange={(e) => setFailPolicy(e.target.value)}
                  className="mt-0.5 mr-2 text-emerald-600 focus:ring-emerald-500"
                />
                <div>
                  <span className="font-bold text-slate-900 block">আবশ্যক বিষয়ে ফেল = মোট ফেল</span>
                  <span className="text-slate-500 text-[11px] block mt-0.5">আবশ্যক কোনো বিষয়ে পাস নম্বরের কম পেলে সামগ্রিক ফল রাসিব (Fail) হবে।</span>
                </div>
              </label>

              <label className={`flex items-start p-3 rounded-lg border text-xs cursor-pointer transition ${
                failPolicy === "any_subject_fail" 
                  ? "bg-white border-emerald-600 ring-2 ring-emerald-500/20 shadow-xs" 
                  : "bg-white/70 border-slate-200 hover:bg-white"
              }`}>
                <input
                  type="radio"
                  name="failPolicy"
                  value="any_subject_fail"
                  checked={failPolicy === "any_subject_fail"}
                  onChange={(e) => setFailPolicy(e.target.value)}
                  className="mt-0.5 mr-2 text-emerald-600 focus:ring-emerald-500"
                />
                <div>
                  <span className="font-bold text-slate-900 block">যেকোনো বিষয়ে ফেল = মোট ফেল</span>
                  <span className="text-slate-500 text-[11px] block mt-0.5">যেকোনো একটি বিষয়ে পাস নম্বরের নিচে পেলে সামগ্রিক ফল রাসিব হবে।</span>
                </div>
              </label>

              <label className={`flex items-start p-3 rounded-lg border text-xs cursor-pointer transition ${
                failPolicy === "percentage_only" 
                  ? "bg-white border-emerald-600 ring-2 ring-emerald-500/20 shadow-xs" 
                  : "bg-white/70 border-slate-200 hover:bg-white"
              }`}>
                <input
                  type="radio"
                  name="failPolicy"
                  value="percentage_only"
                  checked={failPolicy === "percentage_only"}
                  onChange={(e) => setFailPolicy(e.target.value)}
                  className="mt-0.5 mr-2 text-emerald-600 focus:ring-emerald-500"
                />
                <div>
                  <span className="font-bold text-slate-900 block">শুধুমাত্র শতকরা হার ভিত্তিক</span>
                  <span className="text-slate-500 text-[11px] block mt-0.5">বিষয়ের ওপর নির্ভর না করে মোট প্রাপ্ত নম্বরের শতকরা হারে গ্রেড আসবে।</span>
                </div>
              </label>
            </div>
          </div>
        </div>
      </fieldset>

      {/* Class Selector for Subject Setup */}
      <div className="max-w-md">
        <label className="block text-sm font-bold text-slate-800 mb-1.5">ক্লাস / জামাত নির্বাচন করুন (বিষয় সেটআপের জন্য)</label>
        <select
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
          className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600 transition bg-white text-sm font-medium text-slate-800"
        >
          <option value="">ক্লাস নির্বাচন করুন...</option>
          {classes.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {classId && (
        <fieldset disabled={readOnly} className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">বিষয়ের তালিকা ও মান বণ্টন</h3>
              <p className="text-xs text-slate-500 mt-0.5">প্রতিটি বিষয়ের মোট নম্বর, পাস নম্বর ও আবশ্যক কিনা তা নির্ধারণ করুন</p>
            </div>
            {!readOnly && <button
              onClick={handleAddSubject}
              className="flex items-center space-x-1 text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 px-3.5 py-2 rounded-lg transition border border-emerald-200 cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>নতুন বিষয় যোগ করুন</span>
            </button>}
          </div>

          {subjectError ? <p role="alert">বিষয়ের তালিকা পড়া যায়নি। জামাতটি আবার নির্বাচন করুন।</p> : loading ? (
            <div className="py-8 text-center text-slate-500">লোড হচ্ছে...</div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-xs bg-white">
              <table className="w-full text-left text-sm whitespace-nowrap min-w-[700px]">
                <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 font-bold text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">বিষয়ের নাম</th>
                    <th className="px-4 py-3 w-28">মোট নম্বর</th>
                    <th className="px-4 py-3 w-28">পাস নম্বর</th>
                    <th className="px-4 py-3 w-36 text-center">আবশ্যক বিষয়?</th>
                    <th className="px-4 py-3 w-40">পরীক্ষার ধরন</th>
                    <th className="px-4 py-3 w-40 text-center">উপবিভাগ (ঐচ্ছিক)</th>
                    <th className="px-4 py-3 w-16 text-center">মুছুন</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {subjects.map((sub, idx) => {
                    const subParts: ExamSubjectSubPart[] = Array.isArray(sub.sub_parts)
                      ? sub.sub_parts
                      : [];
                    const isExpanded = expandedIdx === idx;
                    return (
                      <>
                        <tr key={`row-${idx}`} className="hover:bg-slate-50/60 transition">
                          <td className="px-4 py-2.5">
                            <input
                              type="text"
                              value={sub.subject_name}
                              onChange={(e) => handleChange(idx, 'subject_name', e.target.value)}
                              placeholder="যেমন: মাসায়েল / কুরআন"
                              className="w-full px-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-emerald-600 outline-none font-medium"
                            />
                            {subParts.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {subParts.map((p) => (
                                  <span
                                    key={p.key}
                                    className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200"
                                  >
                                    {p.name || "উপবিভাগ"} ({p.max_marks})
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <input
                              type="number"
                              value={sub.total_marks}
                              disabled={subParts.length > 0}
                              onChange={(e) => handleChange(idx, 'total_marks', parseInt(e.target.value) || 0)}
                              title={subParts.length > 0 ? "উপবিভাগগুলোর পূর্ণমানের যোগফল" : "মোট নম্বর"}
                              className="w-full px-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-emerald-600 outline-none text-center font-bold disabled:bg-slate-100 disabled:text-slate-600"
                            />
                          </td>
                          <td className="px-4 py-2.5">
                            <input
                              type="number"
                              value={sub.pass_marks}
                              onChange={(e) => handleChange(idx, 'pass_marks', parseInt(e.target.value) || 0)}
                              className="w-full px-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-emerald-600 outline-none text-center font-bold"
                            />
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleChange(idx, 'is_compulsory', !sub.is_compulsory)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition cursor-pointer border ${
                                sub.is_compulsory !== false
                                  ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                  : "bg-slate-100 text-slate-600 border-slate-300"
                              }`}
                            >
                              {sub.is_compulsory !== false ? (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                                  <span>আবশ্যক</span>
                                </>
                              ) : (
                                <span>ঐচ্ছিক</span>
                              )}
                            </button>
                          </td>
                          <td className="px-4 py-2.5">
                            <select
                              value={sub.exam_type}
                              onChange={(e) => handleChange(idx, 'exam_type', e.target.value)}
                              className="w-full px-3 py-1.5 text-xs font-semibold border rounded-lg focus:ring-2 focus:ring-emerald-600 outline-none bg-white"
                            >
                              <option value="Written">লিখিত (Written)</option>
                              <option value="Oral">মৌখিক (Oral)</option>
                              <option value="Practical">প্রাক্টিক্যাল (Practical)</option>
                            </select>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                                subParts.length > 0
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
                                  : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50"
                              }`}
                            >
                              <Layers className="w-3.5 h-3.5" />
                              <span>
                                {subParts.length > 0
                                  ? `${subParts.length}টি উপবিভাগ`
                                  : "+ উপবিভাগ"}
                              </span>
                              {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            {!readOnly && <button
                              onClick={() => handleRemoveSubject(idx)}
                              className="text-red-500 hover:bg-red-50 p-1.5 rounded-md transition cursor-pointer"
                              title="মুছুন"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr key={`sub-${idx}`} className="bg-emerald-50/40">
                            <td colSpan={7} className="px-5 py-4 whitespace-normal">
                              <div className="space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div>
                                    <div className="text-xs font-bold text-emerald-950">
                                      "{sub.subject_name || "বিষয়"}" — উপবিভাগ ও নম্বর বণ্টন
                                    </div>
                                    <p className="text-[11px] text-slate-600">
                                      উপবিভাগ যুক্ত করলে নম্বর এন্ট্রিতে কেবল এই ঘরগুলো দেখাবে এবং এদের যোগফলই হবে মোট নম্বর। কোনো উপবিভাগ না রাখলে শুধু একটি মোট নম্বরের ঘর দেখাবে।
                                    </p>
                                  </div>
                                  {!readOnly && (
                                    <button
                                      type="button"
                                      onClick={() => handleAddSubPart(idx)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition cursor-pointer"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                      কাস্টম উপবিভাগ
                                    </button>
                                  )}
                                </div>

                                {!readOnly && (
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="text-[11px] font-semibold text-slate-500">কুইক প্রিসেট:</span>
                                    {SUBPART_PRESETS.map((preset) => (
                                      <button
                                        key={preset.key}
                                        type="button"
                                        onClick={() => handleAddSubPart(idx, preset)}
                                        className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-white border border-emerald-200 text-emerald-800 hover:bg-emerald-100 transition cursor-pointer"
                                      >
                                        + {preset.name} ({preset.defaultMarks})
                                      </button>
                                    ))}
                                  </div>
                                )}

                                {subParts.length > 0 ? (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                    {subParts.map((part, pIdx) => (
                                      <div
                                        key={`${part.key}-${pIdx}`}
                                        className="flex items-center gap-2 bg-white p-2 rounded-lg border border-emerald-200/80 shadow-2xs"
                                      >
                                        <input
                                          type="text"
                                          value={part.name}
                                          onChange={(e) =>
                                            handleSubPartFieldChange(idx, pIdx, "name", e.target.value)
                                          }
                                          placeholder="উপবিভাগের নাম (যেমন: লিখিত)"
                                          className="flex-1 min-w-0 px-2.5 py-1 text-xs font-semibold border border-slate-300 rounded-md focus:ring-1 focus:ring-emerald-600 outline-none"
                                        />
                                        <input
                                          type="number"
                                          min={1}
                                          value={part.max_marks}
                                          onChange={(e) =>
                                            handleSubPartFieldChange(idx, pIdx, "max_marks", e.target.value)
                                          }
                                          placeholder="পূর্ণমান"
                                          className="w-20 px-2 py-1 text-xs font-bold text-center border border-slate-300 rounded-md focus:ring-1 focus:ring-emerald-600 outline-none"
                                        />
                                        {!readOnly && (
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveSubPart(idx, pIdx)}
                                            className="p-1 text-rose-500 hover:bg-rose-50 rounded-md cursor-pointer"
                                            title="উপবিভাগ মুছুন"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-xs text-slate-500 italic bg-white/70 border border-dashed border-slate-300 rounded-lg p-3">
                                    কোনো উপবিভাগ যুক্ত নেই — নম্বর এন্ট্রির সময় শুধুমাত্র একটি "প্রাপ্ত নম্বর" ঘর দেখাবে।
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                  {subjects.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500 text-sm">
                        কোনো বিষয় যোগ করা হয়নি।
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end pt-4">
            {!readOnly && <button
              onClick={handleSave}
              disabled={saving || loading || subjectError || subjects.length === 0}
              className="flex items-center space-x-2 bg-emerald-700 text-white px-6 py-2.5 rounded-lg hover:bg-emerald-800 transition disabled:opacity-50 font-bold shadow-sm cursor-pointer text-sm"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? "সেভ হচ্ছে..." : "বিষয় ও নিয়মাবলী সেভ করুন"}</span>
            </button>}
          </div>
        </fieldset>
      )}
    </div>
  );
}
