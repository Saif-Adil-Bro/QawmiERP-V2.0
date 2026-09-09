"use client";

import { useState } from "react";
import {
  X,
  Plus,
  Trash2,
  BookOpen,
  Calendar,
  Layers,
  FileText,
  User,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Syllabus, SyllabusChapter, SyllabusTopic } from "@/lib/syllabus";
import { saveSyllabusAction } from "@/app/actions/syllabus";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  syllabus?: Syllabus | null;
  classes: any[];
  subjects: any[];
  teachers: any[];
  onSuccess?: () => void;
}

export default function SyllabusFormModal({
  isOpen,
  onClose,
  syllabus,
  classes,
  subjects,
  teachers,
  onSuccess,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [classId, setClassId] = useState(syllabus?.class_id || (classes[0]?.id || ""));
  const [subjectId, setSubjectId] = useState(syllabus?.subject_id || (subjects[0]?.id || ""));
  const [subjectName, setSubjectName] = useState(syllabus?.subject_name || (subjects[0]?.name || ""));
  const [teacherId, setTeacherId] = useState(syllabus?.teacher_id || (teachers[0]?.id || ""));
  const [academicYear, setAcademicYear] = useState(syllabus?.academic_year || "১৪৪৭-৪৮ হিজরি (২০২৬-২৭)");
  const [startDate, setStartDate] = useState(syllabus?.start_date || "2026-04-15");
  const [endDate, setEndDate] = useState(syllabus?.end_date || "2027-04-05");
  const [revisionInterval, setRevisionInterval] = useState(syllabus?.revision_interval_days || 7);

  const [chapters, setChapters] = useState<SyllabusChapter[]>(
    syllabus?.chapters && syllabus.chapters.length > 0
      ? JSON.parse(JSON.stringify(syllabus.chapters))
      : [
          {
            id: `ch_${Date.now()}_1`,
            name: "প্রথম অধ্যায় / বাব",
            order: 1,
            topics: [
              {
                id: `top_${Date.now()}_1`,
                name: "প্রাথমিক আলোচনা ও সংজ্ঞা",
                estimated_periods: 3,
                progress_percentage: 0,
                status: "NOT_STARTED",
                revision_count: 0,
                revision_history: [],
              },
            ],
          },
        ]
  );

  if (!isOpen) return null;

  const handleClassChange = (cId: string) => {
    setClassId(cId);
  };

  const handleSubjectChange = (sId: string) => {
    setSubjectId(sId);
    const sub = subjects.find((s) => s.id === sId);
    if (sub) setSubjectName(sub.name);
  };

  const addChapter = () => {
    const newChapter: SyllabusChapter = {
      id: `ch_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      name: `অধ্যায় ${chapters.length + 1}`,
      order: chapters.length + 1,
      topics: [
        {
          id: `top_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
          name: "নতুন পাঠ / টপিক",
          estimated_periods: 3,
          progress_percentage: 0,
          status: "NOT_STARTED",
          revision_count: 0,
          revision_history: [],
        },
      ],
    };
    setChapters([...chapters, newChapter]);
  };

  const removeChapter = (chIndex: number) => {
    if (chapters.length <= 1) {
      alert("কমপক্ষে একটি অধ্যায় থাকা আবশ্যক।");
      return;
    }
    const updated = chapters.filter((_, idx) => idx !== chIndex);
    setChapters(updated);
  };

  const updateChapterName = (chIndex: number, name: string) => {
    const updated = [...chapters];
    updated[chIndex].name = name;
    setChapters(updated);
  };

  const addTopic = (chIndex: number) => {
    const updated = [...chapters];
    const newTopic: SyllabusTopic = {
      id: `top_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      name: `টপিক ${updated[chIndex].topics.length + 1}`,
      estimated_periods: 3,
      progress_percentage: 0,
      status: "NOT_STARTED",
      revision_count: 0,
      revision_history: [],
    };
    updated[chIndex].topics.push(newTopic);
    setChapters(updated);
  };

  const removeTopic = (chIndex: number, tIndex: number) => {
    const updated = [...chapters];
    if (updated[chIndex].topics.length <= 1) {
      alert("প্রতিটি অধ্যায়ে কমপক্ষে একটি টপিক থাকা আবশ্যক।");
      return;
    }
    updated[chIndex].topics = updated[chIndex].topics.filter((_, idx) => idx !== tIndex);
    setChapters(updated);
  };

  const updateTopicField = (chIndex: number, tIndex: number, field: keyof SyllabusTopic, value: any) => {
    const updated = [...chapters];
    (updated[chIndex].topics[tIndex] as any)[field] = value;
    setChapters(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!subjectName.trim()) {
      setError("বিষয়ের নাম আবশ্যক।");
      return;
    }

    const selectedClass = classes.find((c) => c.id === classId);
    const selectedTeacher = teachers.find((t) => t.id === teacherId);
    const teacherFullName = selectedTeacher
      ? `${selectedTeacher.first_name || ""} ${selectedTeacher.last_name || ""}`.trim()
      : "";

    setLoading(true);

    try {
      const payload: Partial<Syllabus> = {
        id: syllabus?.id,
        class_id: classId,
        class_name: selectedClass?.name || "অনির্ধারিত জামাত",
        subject_id: subjectId,
        subject_name: subjectName,
        teacher_id: teacherId || undefined,
        teacher_name: teacherFullName || undefined,
        academic_year: academicYear,
        start_date: startDate,
        end_date: endDate,
        revision_interval_days: Number(revisionInterval) || 7,
        chapters,
      };

      const res = await saveSyllabusAction(payload);
      if (!res.success) {
        throw new Error(res.error || "সংরক্ষণ ব্যর্থ হয়েছে");
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
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {syllabus ? "সিলেবাস সম্পাদনা করুন" : "+ নতুন সিলেবাস ও পাঠ পরিকল্পনা তৈরি"}
              </h2>
              <p className="text-xs text-slate-500">
                জামাত, কিতাব/বিষয় ও অধ্যায়ভিত্তিক টপিক নির্ধারণ করুন
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Core Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 bg-slate-50/60 p-4 rounded-xl border border-slate-200">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">জামাত / শ্রেণি *</label>
              <select
                value={classId}
                onChange={(e) => handleClassChange(e.target.value)}
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
              <div className="space-y-1">
                <select
                  value={subjectId}
                  onChange={(e) => handleSubjectChange(e.target.value)}
                  className="w-full text-sm px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">-- বিষয় নির্বাচন করুন --</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.code ? `(${s.code})` : ""}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="অথবা কিতাবের কাস্টম নাম লিখুন"
                  value={subjectName}
                  onChange={(e) => setSubjectName(e.target.value)}
                  className="w-full text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">দায়িত্বপ্রাপ্ত উস্তাদ / শিক্ষক</label>
              <select
                value={teacherId}
                onChange={(e) => setTeacherId(e.target.value)}
                className="w-full text-sm px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">-- শিক্ষক নির্ধারণ করুন --</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.first_name} {t.last_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">শিক্ষাবর্ষ / সেশন</label>
              <input
                type="text"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                className="w-full text-sm px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">সিলেবাস শুরুর তারিখ *</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full text-sm px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">সিলেবাস সমাপ্তির তারিখ *</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full text-sm px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">রিভিশন ইন্টারভাল (দিন)</label>
              <select
                value={revisionInterval}
                onChange={(e) => setRevisionInterval(Number(e.target.value))}
                className="w-full text-sm px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value={3}>৩ দিন পর পর রিভিশন</option>
                <option value={7}>৭ দিন পর পর (সাপ্তাহিক রিভিশন)</option>
                <option value={14}>১৪ দিন পর পর (পাক্ষিক রিভিশন)</option>
                <option value={30}>৩০ দিন পর পর (মাসিক রিভিশন)</option>
              </select>
            </div>
          </div>

          {/* Chapters & Topics Structure */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  অধ্যায় ও পাঠ্য টপিক তালিকা ({chapters.length}টি অধ্যায়)
                </h3>
              </div>
              <button
                type="button"
                onClick={addChapter}
                className="px-3 py-1.5 text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl hover:bg-indigo-100 flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>+ নতুন অধ্যায় যোগ করুন</span>
              </button>
            </div>

            <div className="space-y-4">
              {chapters.map((ch, chIdx) => (
                <div
                  key={ch.id || chIdx}
                  className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center shrink-0">
                      {chIdx + 1}
                    </span>
                    <input
                      type="text"
                      placeholder="অধ্যায়ের নাম লিখুন (যেমন: اسم বা কিতাবুত্তাহারাত)"
                      value={ch.name}
                      onChange={(e) => updateChapterName(chIdx, e.target.value)}
                      className="flex-1 text-sm font-semibold px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => removeChapter(chIdx)}
                      className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                      title="অধ্যায় মুছুন"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Topics List */}
                  <div className="pl-9 space-y-2">
                    {ch.topics.map((top, topIdx) => (
                      <div key={top.id || topIdx} className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 font-mono w-5">
                          {chIdx + 1}.{topIdx + 1}
                        </span>
                        <input
                          type="text"
                          placeholder="টপিক / পাঠের নাম (যেমন: اسم کی اقسام)"
                          value={top.name}
                          onChange={(e) => updateTopicField(chIdx, topIdx, "name", e.target.value)}
                          className="flex-1 text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          required
                        />
                        <div className="flex items-center gap-1 shrink-0">
                          <input
                            type="number"
                            min={1}
                            max={50}
                            title="আনুমানিক ক্লাস সংখ্যা (Period)"
                            value={top.estimated_periods || 3}
                            onChange={(e) =>
                              updateTopicField(chIdx, topIdx, "estimated_periods", Number(e.target.value))
                            }
                            className="w-14 text-xs px-2 py-1.5 border border-slate-200 rounded-lg text-center"
                          />
                          <span className="text-[10px] text-slate-400">পিরিয়ড</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeTopic(chIdx, topIdx)}
                          className="p-1 text-slate-400 hover:text-red-600 rounded-md transition-colors"
                          title="টপিক মুছুন"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() => addTopic(chIdx)}
                      className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 mt-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ টপিক যোগ করুন</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

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
                  <span>{syllabus ? "হালনাগাদ করুন" : "সিলেবাস সংরক্ষণ করুন"}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
