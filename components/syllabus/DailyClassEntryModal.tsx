"use client";

import { useState, useEffect } from "react";
import {
  X,
  BookOpen,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  RotateCcw,
  Sparkles,
  Users,
  Check,
  Ban,
  FileText,
  Loader2,
} from "lucide-react";
import {
  Syllabus,
  ClassType,
  CancellationReason,
  StudentEvaluation,
  DailyClassRecord,
} from "@/lib/syllabus";
import { recordDailyClassAction } from "@/app/actions/syllabus";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  syllabuses: Syllabus[];
  classes: any[];
  subjects: any[];
  teachers: any[];
  initialClassId?: string;
  initialSubjectId?: string;
  initialTeacherId?: string;
  existingRecord?: DailyClassRecord | null;
  onSuccess?: () => void;
}

export default function DailyClassEntryModal({
  isOpen,
  onClose,
  syllabuses,
  classes,
  subjects,
  teachers,
  initialClassId,
  initialSubjectId,
  initialTeacherId,
  existingRecord,
  onSuccess,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [date, setDate] = useState(
    existingRecord?.date || new Date().toISOString().split("T")[0]
  );
  const [classId, setClassId] = useState(
    existingRecord?.class_id || initialClassId || (classes[0]?.id || "")
  );
  const [subjectId, setSubjectId] = useState(
    existingRecord?.subject_id || initialSubjectId || (subjects[0]?.id || "")
  );
  const [teacherId, setTeacherId] = useState(
    existingRecord?.teacher_id || initialTeacherId || (teachers[0]?.id || "")
  );

  const [classType, setClassType] = useState<ClassType>(
    existingRecord?.class_type || "NEW_LESSON"
  );
  const [cancellationReason, setCancellationReason] = useState<CancellationReason>(
    existingRecord?.cancellation_reason || "INSTITUTIONAL_PROGRAM"
  );
  const [cancellationNotes, setCancellationNotes] = useState(
    existingRecord?.cancellation_notes || ""
  );

  const [newTopicIds, setNewTopicIds] = useState<string[]>(
    existingRecord?.new_topic_ids || []
  );
  const [newTopicProgress, setNewTopicProgress] = useState<Record<string, number>>(
    existingRecord?.new_topic_progress || {}
  );
  const [revisionTopicIds, setRevisionTopicIds] = useState<string[]>(
    existingRecord?.revision_topic_ids || []
  );

  const [pageFrom, setPageFrom] = useState(existingRecord?.page_from || "");
  const [pageTo, setPageTo] = useState(existingRecord?.page_to || "");
  const [notes, setNotes] = useState(existingRecord?.notes || "");

  // Match corresponding syllabus
  const matchedSyllabus = syllabuses.find(
    (s) =>
      s.class_id === classId &&
      (s.subject_id === subjectId ||
        (s.subject_name && subjects.find((sub) => sub.id === subjectId)?.name === s.subject_name))
  );

  // All topics of this syllabus
  const allSyllabusTopics: Array<{
    id: string;
    name: string;
    chapterName: string;
    progress: number;
    status: string;
    revisionCount: number;
  }> = [];

  if (matchedSyllabus) {
    for (const ch of matchedSyllabus.chapters || []) {
      for (const t of ch.topics || []) {
        allSyllabusTopics.push({
          id: t.id,
          name: t.name,
          chapterName: ch.name,
          progress: t.progress_percentage || 0,
          status: t.status,
          revisionCount: t.revision_count || 0,
        });
      }
    }
  }

  const completedOrInProgressTopics = allSyllabusTopics.filter(
    (t) => t.progress > 0 || t.status === "COMPLETED"
  );

  if (!isOpen) return null;

  const toggleNewTopic = (tId: string) => {
    if (newTopicIds.includes(tId)) {
      setNewTopicIds(newTopicIds.filter((id) => id !== tId));
      const nextP = { ...newTopicProgress };
      delete nextP[tId];
      setNewTopicProgress(nextP);
    } else {
      setNewTopicIds([...newTopicIds, tId]);
      setNewTopicProgress({ ...newTopicProgress, [tId]: 100 });
    }
  };

  const toggleRevisionTopic = (tId: string) => {
    if (revisionTopicIds.includes(tId)) {
      setRevisionTopicIds(revisionTopicIds.filter((id) => id !== tId));
    } else {
      setRevisionTopicIds([...revisionTopicIds, tId]);
    }
  };

  const setTopicProgressVal = (tId: string, val: number) => {
    setNewTopicProgress({ ...newTopicProgress, [tId]: val });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const selectedClass = classes.find((c) => c.id === classId);
    const selectedSubject = subjects.find((s) => s.id === subjectId);
    const selectedTeacher = teachers.find((t) => t.id === teacherId);

    const subName = selectedSubject?.name || matchedSyllabus?.subject_name || "কিতাবাত ও দরস";
    const teacherName = selectedTeacher
      ? `${selectedTeacher.first_name || ""} ${selectedTeacher.last_name || ""}`.trim()
      : "";

    if (classType !== "NO_ACADEMIC_CLASS" && newTopicIds.length === 0 && revisionTopicIds.length === 0) {
      setError("দয়া করে অন্তত একটি নতুন পাঠ অথবা রিভিশন টপিক নির্বাচন করুন।");
      return;
    }

    setLoading(true);

    try {
      const newTopicNames = newTopicIds
        .map((id) => allSyllabusTopics.find((t) => t.id === id)?.name || "")
        .filter(Boolean);

      const revTopicNames = revisionTopicIds
        .map((id) => allSyllabusTopics.find((t) => t.id === id)?.name || "")
        .filter(Boolean);

      const res = await recordDailyClassAction({
        record_id: existingRecord?.id,
        syllabus_id: matchedSyllabus?.id,
        date,
        class_id: classId,
        class_name: selectedClass?.name || "অনির্ধারিত জামাত",
        subject_id: subjectId,
        subject_name: subName,
        teacher_id: teacherId || undefined,
        teacher_name: teacherName || undefined,
        class_type: classType,
        cancellation_reason: classType === "NO_ACADEMIC_CLASS" ? cancellationReason : undefined,
        cancellation_notes: classType === "NO_ACADEMIC_CLASS" ? cancellationNotes : undefined,
        new_topic_ids: newTopicIds,
        new_topic_names: newTopicNames,
        new_topic_progress: newTopicProgress,
        revision_topic_ids: revisionTopicIds,
        revision_topic_names: revTopicNames,
        page_from: pageFrom,
        page_to: pageTo,
        notes,
      });

      if (!res.success) {
        throw new Error(res.error || "রেকর্ড সংরক্ষণ ব্যর্থ হয়েছে");
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "ত্রুটি হয়েছে। পুনরায় চেষ্টা করুন।");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-emerald-700 text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/10 rounded-xl">
              <BookOpen className="w-5 h-5 text-emerald-200" />
            </div>
            <div>
              <h2 className="text-lg font-bold">
                {existingRecord ? "দৈনিক ক্লাস রেকর্ড সম্পাদনা" : "আজকের ক্লাস ও পাঠদান রেকর্ড"}
              </h2>
              <p className="text-xs text-emerald-100">
                আজকের পড়া, রিভিশন ও সিলেবাস অগ্রগতি অটো-সিঙ্ক করুন
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Core Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">তারিখ *</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full text-sm px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">জামাত / শ্রেণি *</label>
              <select
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                className="w-full text-sm px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">কিতাব / বিষয় *</label>
              <select
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="w-full text-sm px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">শিক্ষক / উস্তাদ</label>
              <select
                value={teacherId}
                onChange={(e) => setTeacherId(e.target.value)}
                className="w-full text-sm px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">-- শিক্ষক --</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.first_name} {t.last_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Class Type Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-2">আজকের ক্লাসের ধরন (Class Type) *</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {[
                { id: "NEW_LESSON", label: "নতুন পড়া", sub: "New Lesson", color: "emerald" },
                { id: "REVISION", label: "রিভিশন", sub: "Revision", color: "amber" },
                { id: "NEW_AND_REVISION", label: "নতুন + রিভিশন", sub: "Both", color: "blue" },
                { id: "PRACTICE", label: "অনুশীলন", sub: "Exercise", color: "indigo" },
                { id: "ASSESSMENT", label: "মূল্যায়ন / পরীক্ষা", sub: "Test", color: "purple" },
                { id: "NO_ACADEMIC_CLASS", label: "ক্লাস হয়নি", sub: "Cancelled", color: "rose" },
              ].map((item) => {
                const isSelected = classType === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setClassType(item.id as ClassType)}
                    className={`p-2.5 rounded-xl border text-center transition-all ${
                      isSelected
                        ? "border-emerald-600 bg-emerald-50 text-emerald-900 shadow-xs ring-2 ring-emerald-500/20 font-bold"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <div className="text-xs">{item.label}</div>
                    <div className="text-[10px] text-slate-400 font-normal">{item.sub}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* If No Academic Class */}
          {classType === "NO_ACADEMIC_CLASS" ? (
            <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl space-y-3">
              <div className="flex items-center gap-2 text-rose-800 font-bold text-xs sm:text-sm">
                <Ban className="w-4 h-4" />
                <span>ক্লাস অনুষ্ঠিত না হওয়ার কারণ</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-rose-900 mb-1">কারণ নির্ধারণ করুন</label>
                  <select
                    value={cancellationReason}
                    onChange={(e) => setCancellationReason(e.target.value as CancellationReason)}
                    className="w-full text-xs px-3 py-2 bg-white border border-rose-300 rounded-lg focus:outline-none"
                  >
                    <option value="TEACHER_ABSENT">শিক্ষক অনুপস্থিত (Teacher Absent)</option>
                    <option value="INSTITUTIONAL_PROGRAM">মাদরাসার বিশেষ অনুষ্ঠান / মাহফিল</option>
                    <option value="HOLIDAY">নির্ধারিত ছুটি / অবকাশ</option>
                    <option value="EXAM">পরীক্ষা কার্যক্রম</option>
                    <option value="EMERGENCY">জরুরি / প্রতিকূল আবহাওয়া</option>
                    <option value="OTHER">অন্যান্য কারণ</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-rose-900 mb-1">বিস্তারিত নোট</label>
                  <input
                    type="text"
                    placeholder="নোট লিখুন (যেমন: মাদরাসার বার্ষিক মাহফিল উপলক্ষে বন্ধ ছিল)"
                    value={cancellationNotes}
                    onChange={(e) => setCancellationNotes(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-white border border-rose-300 rounded-lg focus:outline-none"
                  />
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Syllabus Linking Info */}
              {!matchedSyllabus ? (
                <div className="p-3.5 bg-amber-50 text-amber-800 text-xs rounded-xl border border-amber-200 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">সতর্কতা:</span> এই জামাত ও বিষয়ের কোনো নির্দিষ্ট সিলেবাস পাওয়া
                    যায়নি। তবে আপনি দরস ডায়েরি ও পৃষ্ঠা নম্বর রেকর্ড করতে পারবেন। পরবর্তীতে সিলেবাস তালিকা থেকে
                    সিলেবাস যুক্ত করতে পারেন।
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* NEW LESSON SECTION */}
                  {(classType === "NEW_LESSON" ||
                    classType === "NEW_AND_REVISION" ||
                    classType === "PRACTICE" ||
                    classType === "ASSESSMENT") && (
                    <div className="bg-emerald-50/40 border border-emerald-200 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs sm:text-sm">
                          <Sparkles className="w-4 h-4 text-emerald-600" />
                          <span>আজকের নতুন পড়া (Select Syllabus Topic)</span>
                        </div>
                        <span className="text-[11px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md font-semibold">
                          সিলেবাস প্রগ্রেস আপডেট হবে
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-500">
                        সিলেবাস থেকে আজ যে টপিক পড়ানো হয়েছে তা টিক দিন। আংশিক পড়ানো হলে শতকরা হার নির্বাচন করুন।
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                        {allSyllabusTopics.map((top) => {
                          const isChecked = newTopicIds.includes(top.id);
                          const currP = newTopicProgress[top.id] !== undefined ? newTopicProgress[top.id] : 100;

                          return (
                            <div
                              key={top.id}
                              className={`p-2.5 rounded-lg border flex flex-col justify-between transition-all ${
                                isChecked
                                  ? "bg-white border-emerald-500 shadow-xs ring-1 ring-emerald-500"
                                  : "bg-white/80 border-slate-200 hover:bg-white"
                              }`}
                            >
                              <div className="flex items-start gap-2">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleNewTopic(top.id)}
                                  className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-semibold text-slate-900 leading-tight">
                                    {top.name}
                                  </div>
                                  <div className="text-[10px] text-slate-400 mt-0.5">
                                    অধ্যায়: {top.chapterName} • বর্তমান: {top.progress}%
                                  </div>
                                </div>
                              </div>

                              {isChecked && (
                                <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                                  <span className="text-slate-500 font-medium">আজকের পাঠ অগ্রগতি:</span>
                                  <div className="flex items-center gap-1">
                                    {[50, 75, 100].map((pct) => (
                                      <button
                                        key={pct}
                                        type="button"
                                        onClick={() => setTopicProgressVal(top.id, pct)}
                                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                          currP === pct
                                            ? "bg-emerald-600 text-white"
                                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                        }`}
                                      >
                                        {pct}%
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* REVISION SECTION */}
                  {(classType === "REVISION" || classType === "NEW_AND_REVISION") && (
                    <div className="bg-amber-50/40 border border-amber-200 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-amber-900 font-bold text-xs sm:text-sm">
                          <RotateCcw className="w-4 h-4 text-amber-600" />
                          <span>রিভিশন করা পাঠ (Previous Topics for Revision)</span>
                        </div>
                        <span className="text-[11px] text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md font-semibold">
                          রিভিশন সংখ্যা বৃদ্ধি পাবে (সিলেবাস % অপরিবর্তিত)
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-500">
                        পূর্ববর্তী যে সমস্ত টপিক রিভিশন করা হয়েছে সেগুলো সিলেক্ট করুন। একাধিক টপিক নির্বাচন সম্ভব।
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                        {allSyllabusTopics.map((top) => {
                          const isChecked = revisionTopicIds.includes(top.id);
                          return (
                            <label
                              key={top.id}
                              className={`p-2 rounded-lg border flex items-center gap-2 cursor-pointer transition-all ${
                                isChecked
                                  ? "bg-white border-amber-500 shadow-xs ring-1 ring-amber-500"
                                  : "bg-white/80 border-slate-200 hover:bg-white"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleRevisionTopic(top.id)}
                                className="rounded text-amber-600 focus:ring-amber-500 h-4 w-4"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-semibold text-slate-900 leading-tight">
                                  {top.name}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  রিভিশন হয়েছে: {top.revisionCount} বার
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Pages & Remarks */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">পৃষ্ঠা / ছবক হতে</label>
                  <input
                    type="text"
                    placeholder="যেমন: ১২ বা কিতাবুচ্ছালাত"
                    value={pageFrom}
                    onChange={(e) => setPageFrom(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">পৃষ্ঠা পর্যন্ত</label>
                  <input
                    type="text"
                    placeholder="যেমন: ১৫"
                    value={pageTo}
                    onChange={(e) => setPageTo(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">দরস মন্তব্য / নোট</label>
                  <input
                    type="text"
                    placeholder="যেমন: আলোচনা সুন্দর হয়েছে"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none"
                  />
                </div>
              </div>

              {/* Attendance & Hajira Note */}
              <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl flex items-center justify-between text-xs text-blue-900">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>
                    হাজিরা মডিউলের সাথে সংযুক্ত: আজকের উপস্থিত শিক্ষার্থীদের পড়া স্বয়ংক্রিয়ভাবে সংরক্ষিত হবে
                    এবং অনুপস্থিত শিক্ষার্থীদের ফলো-আপ তালিকায় রাখা হবে।
                  </span>
                </div>
              </div>
            </>
          )}

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
            >
              বাতিল
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>সংরক্ষণ হচ্ছে...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{existingRecord ? "হালনাগাদ করুন" : "ক্লাস রেকর্ড সংরক্ষণ করুন"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
