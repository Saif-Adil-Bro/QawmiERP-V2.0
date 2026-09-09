"use client";

import { useState, useEffect } from "react";
import {
  X,
  BookOpen,
  Send,
  Calendar,
  Users,
  User,
  FileText,
  AlertCircle,
  Loader2,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  Layers,
  ChevronDown,
  ChevronUp,
  BookmarkCheck,
  CheckSquare,
  Square,
} from "lucide-react";
import {
  AssignmentItem,
  AssignmentType,
  AssignmentTargetType,
  ASSIGNMENT_TYPE_MAP,
} from "@/lib/assignmentTypes";
import { saveAssignment } from "@/app/actions/assignments";
import { getStudents } from "@/app/actions/students";
import { getSyllabusesForClassAction } from "@/app/actions/syllabus";
import { Syllabus, SyllabusTopic } from "@/lib/syllabus";
import { toBanglaNumber } from "@/lib/numberToBangla";
import AssignmentImageUploader from "./AssignmentImageUploader";

interface AssignmentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  classes: any[];
  initialData?: AssignmentItem | null;
  defaultClassId?: string;
  defaultTeacherName?: string;
}

export default function AssignmentFormModal({
  isOpen,
  onClose,
  onSaved,
  classes,
  initialData,
  defaultClassId,
  defaultTeacherName,
}: AssignmentFormModalProps) {
  const [title, setTitle] = useState(initialData?.title || "");
  const [type, setType] = useState<AssignmentType>(initialData?.type || "TODAY_LESSON");
  const [targetType, setTargetType] = useState<AssignmentTargetType>(
    initialData?.target_type || "CLASS"
  );
  const [classId, setClassId] = useState(
    initialData?.class_id || defaultClassId || classes[0]?.id || ""
  );
  const [studentId, setStudentId] = useState(initialData?.student_id || "");
  const [subjectName, setSubjectName] = useState(initialData?.subject_name || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [imageUrls, setImageUrls] = useState<string[]>(initialData?.image_urls || []);
  const [assignedDate, setAssignedDate] = useState(
    initialData?.assigned_date || new Date().toISOString().split("T")[0]
  );
  const [dueDate, setDueDate] = useState(
    initialData?.due_date || new Date().toISOString().split("T")[0]
  );

  const [classStudents, setClassStudents] = useState<any[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Syllabus Auto-Sync States
  const [syncToSyllabus, setSyncToSyllabus] = useState(true);
  const [classSyllabuses, setClassSyllabuses] = useState<Syllabus[]>([]);
  const [loadingSyllabuses, setLoadingSyllabuses] = useState(false);
  const [selectedSyllabusId, setSelectedSyllabusId] = useState<string>(
    initialData?.syllabus_id || ""
  );
  const [selectedChapterId, setSelectedChapterId] = useState<string>("");
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>([]);
  const [pageFrom, setPageFrom] = useState<string>(initialData?.page_from || "");
  const [pageTo, setPageTo] = useState<string>(initialData?.page_to || "");
  const [progressType, setProgressType] = useState<"NEW_LESSON" | "REVISION" | "ASSESSMENT">(
    initialData?.type === "EXAM_REVISION" ? "REVISION" : "NEW_LESSON"
  );
  const [showTopicsPicker, setShowTopicsPicker] = useState(false);

  // Update form fields when initialData changes
  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title);
      setType(initialData.type);
      setTargetType(initialData.target_type);
      setClassId(initialData.class_id);
      setStudentId(initialData.student_id || "");
      setSubjectName(initialData.subject_name || "");
      setDescription(initialData.description);
      setImageUrls(initialData.image_urls || []);
      setAssignedDate(initialData.assigned_date);
      setDueDate(initialData.due_date || initialData.assigned_date);
      setSelectedSyllabusId(initialData.syllabus_id || "");
      setPageFrom(initialData.page_from || "");
      setPageTo(initialData.page_to || "");
      setSyncToSyllabus(initialData.is_syllabus_synced !== false);
    } else {
      setTitle("");
      setType("TODAY_LESSON");
      setTargetType("CLASS");
      setClassId(defaultClassId || classes[0]?.id || "");
      setStudentId("");
      setSubjectName("");
      setDescription("");
      setImageUrls([]);
      const today = new Date().toISOString().split("T")[0];
      setAssignedDate(today);
      setDueDate(today);
      setSelectedSyllabusId("");
      setSelectedChapterId("");
      setSelectedTopicIds([]);
      setPageFrom("");
      setPageTo("");
      setSyncToSyllabus(true);
    }
  }, [initialData, defaultClassId, classes]);

  // Fetch syllabuses for current class
  useEffect(() => {
    if (!classId) return;

    let isMounted = true;
    async function fetchSyllabuses() {
      try {
        setLoadingSyllabuses(true);
        const res = await getSyllabusesForClassAction(classId);
        if (isMounted && res.success && res.syllabuses) {
          setClassSyllabuses(res.syllabuses);

          if (initialData?.syllabus_id) {
            setSelectedSyllabusId(initialData.syllabus_id);
          } else if (res.syllabuses.length > 0) {
            // Find syllabus matching subjectName or auto-select first
            const matched = res.syllabuses.find(
              (s) =>
                (s.book_name && subjectName && s.book_name.trim().toLowerCase() === subjectName.trim().toLowerCase()) ||
                (s.subject_name && subjectName && s.subject_name.trim().toLowerCase() === subjectName.trim().toLowerCase())
            );
            if (matched) {
              setSelectedSyllabusId(matched.id);
            }
          }
        }
      } catch (err) {
        console.warn("Could not load syllabuses:", err);
      } finally {
        if (isMounted) setLoadingSyllabuses(false);
      }
    }

    fetchSyllabuses();
    return () => {
      isMounted = false;
    };
  }, [classId]);

  // Handler when user selects a syllabus
  const handleSelectSyllabus = (sId: string) => {
    setSelectedSyllabusId(sId);
    const target = classSyllabuses.find((s) => s.id === sId);
    if (target) {
      setSubjectName(target.book_name || target.subject_name || "");
      if (target.current_page && (!pageFrom || pageFrom === "0")) {
        setPageFrom(String(target.current_page + 1));
      }
      setSelectedChapterId("");
      setSelectedTopicIds([]);
    }
  };

  const activeSyllabus = classSyllabuses.find((s) => s.id === selectedSyllabusId);

  // Load students for chosen class when targeting specific student
  useEffect(() => {
    if (!classId) return;

    let isMounted = true;
    async function fetchStudents() {
      try {
        setLoadingStudents(true);
        const allStudents = await getStudents();
        if (isMounted && allStudents) {
          const filtered = allStudents.filter((s: any) => s.class_id === classId);
          setClassStudents(filtered);
        }
      } catch (err) {
        console.warn("Could not load class students:", err);
      } finally {
        if (isMounted) setLoadingStudents(false);
      }
    }

    fetchStudents();
    return () => {
      isMounted = false;
    };
  }, [classId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !classId) {
      setErrorMsg("অনুগ্রহ করে শিরোনাম, জামাত এবং পড়ার বিবরণ পূরণ করুন।");
      return;
    }

    if (targetType === "STUDENT" && !studentId) {
      setErrorMsg("অনুগ্রহ করে নির্দিষ্ট শিক্ষার্থী নির্বাচন করুন।");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");

    try {
      const selectedClass = classes.find((c) => c.id === classId);
      const selectedStudent = classStudents.find((s) => s.id === studentId);

      const res = await saveAssignment({
        id: initialData?.id,
        title: title.trim(),
        type,
        target_type: targetType,
        class_id: classId,
        class_name: selectedClass?.name || "জামাত",
        student_id: targetType === "STUDENT" ? studentId : null,
        student_name:
          targetType === "STUDENT"
            ? `${selectedStudent?.first_name || ""} ${selectedStudent?.last_name || ""}`.trim() ||
              "শিক্ষার্থী"
            : null,
        student_roll: targetType === "STUDENT" ? selectedStudent?.roll_number : null,
        subject_name: subjectName.trim(),
        description: description.trim(),
        image_urls: imageUrls,
        assigned_date: assignedDate,
        due_date: dueDate || null,
        teacher_name: defaultTeacherName,
        // Syllabus Auto-Sync Payload
        sync_to_syllabus: syncToSyllabus,
        syllabus_id: selectedSyllabusId || undefined,
        chapter_id: selectedChapterId || undefined,
        selected_topic_ids: selectedTopicIds,
        page_from: pageFrom.trim() || undefined,
        page_to: pageTo.trim() || undefined,
        progress_type: progressType,
      });

      if (res && res.success) {
        onSaved();
        onClose();
      } else {
        setErrorMsg(res?.error || "অ্যাসাইনমেন্ট সংরক্ষণে সমস্যা হয়েছে।");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "ত্রুটি হয়েছে।");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-2xl w-full my-auto overflow-hidden animate-in fade-in zoom-in-95 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                {initialData ? "অ্যাসাইনমেন্ট সম্পাদনা করুন" : "নতুন দৈনিক পড়া বা অ্যাসাইনমেন্ট পাঠান"}
              </h2>
              <p className="text-xs text-slate-500">
                ক্লাসের সকল অথবা নির্দিষ্ট শিক্ষার্থী এবং তাদের অভিভাবকদের কাছে পাঠানো হবে
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Type Selector Tabs */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              পড়ার ধরন (Type) <span className="text-emerald-600">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(Object.keys(ASSIGNMENT_TYPE_MAP) as AssignmentType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition text-center cursor-pointer ${
                    type === t
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {ASSIGNMENT_TYPE_MAP[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Jamat and Target Mode */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Jamat / Class */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                জামাত / শ্রেণি <span className="text-emerald-600">*</span>
              </label>
              <select
                value={classId}
                onChange={(e) => {
                  setClassId(e.target.value);
                  setStudentId("");
                }}
                required
                className="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Target Mode: Class or Student */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                প্রাপক (কাদের জন্য) <span className="text-emerald-600">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTargetType("CLASS")}
                  className={`p-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    targetType === "CLASS"
                      ? "bg-emerald-50 text-emerald-800 border-emerald-300 ring-2 ring-emerald-600/20"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>পুরো জামাত</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTargetType("STUDENT")}
                  className={`p-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    targetType === "STUDENT"
                      ? "bg-emerald-50 text-emerald-800 border-emerald-300 ring-2 ring-emerald-600/20"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <User className="w-4 h-4" />
                  <span>নির্দিষ্ট ছাত্র</span>
                </button>
              </div>
            </div>
          </div>

          {/* Specific student picker if targetType === 'STUDENT' */}
          {targetType === "STUDENT" && (
            <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-2xl space-y-2 animate-in fade-in">
              <label className="block text-xs font-bold text-amber-900">
                নির্দিষ্ট শিক্ষার্থী নির্বাচন করুন <span className="text-rose-600">*</span>
              </label>
              {loadingStudents ? (
                <div className="text-xs text-amber-700 flex items-center gap-2 py-1">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>জামাতের ছাত্রদের তালিকা লোড হচ্ছে...</span>
                </div>
              ) : classStudents.length > 0 ? (
                <select
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  required
                  className="w-full p-2.5 bg-white border border-amber-300 rounded-xl text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                >
                  <option value="">-- শিক্ষার্থী নির্বাচন করুন --</option>
                  {classStudents.map((s) => (
                    <option key={s.id} value={s.id}>
                      রোল: {s.roll_number || "নাই"} - {s.first_name} {s.last_name}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-amber-800">
                  এই জামাতে কোনো নিবন্ধিত শিক্ষার্থী পাওয়া যায়নি। অনুগ্রহ করে অন্য জামাত নির্বাচন করুন।
                </p>
              )}
            </div>
          )}

          {/* Title & Subject */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                পড়া বা পাঠের শিরোনাম <span className="text-emerald-600">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="যেমন: সূরা মুলক ১-১০ আয়াত হিফজ"
                className="w-full p-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                কিতাব / বিষয় (Subject)
              </label>
              <input
                type="text"
                value={subjectName}
                onChange={(e) => setSubjectName(e.target.value)}
                placeholder="যেমন: হিফজুল কুরআন, নূরানী, ছরফ, ফিকহ"
                className="w-full p-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Syllabus Auto-Sync Card */}
          <div className="rounded-2xl border border-emerald-200/90 bg-emerald-50/40 p-3.5 sm:p-4 space-y-3 shadow-xs">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <div className="p-2 bg-emerald-100 text-emerald-800 rounded-xl shrink-0 mt-0.5">
                  <RefreshCw className={`w-4 h-4 ${syncToSyllabus ? "text-emerald-700" : "text-slate-400"}`} />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs sm:text-sm font-bold text-slate-900">
                      সিলেবাস প্রোগ্রেসে অটো-সিঙ্ক (Auto-Sync)
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] border border-emerald-300">
                      অটোমেটেড সিঙ্ক
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                    এই পাঠ সাবমিট করার সাথে সাথে সিলেবাসের পৃষ্ঠা ও অগ্রগতি স্বয়ংক্রিয়ভাবে আপডেট হবে
                  </p>
                </div>
              </div>

              {/* Toggle Switch */}
              <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                <input
                  type="checkbox"
                  checked={syncToSyllabus}
                  onChange={(e) => setSyncToSyllabus(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600 shadow-xs"></div>
              </label>
            </div>

            {syncToSyllabus && (
              <div className="pt-3 border-t border-emerald-100 space-y-3 animate-in fade-in">
                {/* Syllabus selection */}
                {loadingSyllabuses ? (
                  <div className="flex items-center gap-2 text-xs text-slate-500 py-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                    <span>সিলেবাস তালিকা লোড হচ্ছে...</span>
                  </div>
                ) : classSyllabuses.length > 0 ? (
                  <div className="space-y-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        সংযুক্ত কিতাব / সিলেবাস নির্বাচন করুন
                      </label>
                      <select
                        value={selectedSyllabusId}
                        onChange={(e) => handleSelectSyllabus(e.target.value)}
                        className="w-full p-2 bg-white border border-emerald-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                      >
                        <option value="">-- কিতাব / সিলেবাস নির্বাচন করুন --</option>
                        {classSyllabuses.map((s) => {
                          const currP = s.current_page || 0;
                          const totP = s.total_pages || 1;
                          const pct = Math.min(100, Math.round((currP / totP) * 100));
                          return (
                            <option key={s.id} value={s.id}>
                              📖 {s.book_name || s.subject_name} (বর্তমান পৃষ্ঠা: {toBanglaNumber(currP)} / {toBanglaNumber(totP)} • {toBanglaNumber(pct)}%)
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    {activeSyllabus && (
                      <div className="p-3 bg-white/90 border border-emerald-200 rounded-xl text-xs space-y-2">
                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                          <span>
                            বর্তমান কিতাবের পৃষ্ঠা:{" "}
                            <span className="text-emerald-700 font-extrabold">
                              {toBanglaNumber(activeSyllabus.current_page || 0)}
                            </span>{" "}
                            / {toBanglaNumber(activeSyllabus.total_pages || 0)}
                          </span>
                          <span className="text-emerald-700 font-bold">
                            মোট অগ্রগতি: {toBanglaNumber(Math.min(100, Math.round(((activeSyllabus.current_page || 0) / (activeSyllabus.total_pages || 1)) * 100)))}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-emerald-600 h-full rounded-full transition-all"
                            style={{
                              width: `${Math.min(100, Math.round(((activeSyllabus.current_page || 0) / (activeSyllabus.total_pages || 1)) * 100))}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">এই জামাতে এখনও ডিজিটাল সিলেবাস যুক্ত করা নেই।</p>
                      <p className="text-[11px] text-amber-700 mt-0.5">
                        তবে আপনি বিষয় ও পৃষ্ঠা নম্বর উল্লেখ করলে তা সরাসরি দৈনিক পাঠের রেকর্ডে ও কিতাব লগে সংরক্ষিত হয়ে থাকবে।
                      </p>
                    </div>
                  </div>
                )}

                {/* Page range and Progress Type */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      পাঠ্য পৃষ্ঠা শুরু (From)
                    </label>
                    <input
                      type="text"
                      value={pageFrom}
                      onChange={(e) => setPageFrom(e.target.value)}
                      placeholder="যেমন: ১৫"
                      className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      পাঠ্য পৃষ্ঠা শেষ (To)
                    </label>
                    <input
                      type="text"
                      value={pageTo}
                      onChange={(e) => setPageTo(e.target.value)}
                      placeholder="যেমন: ২০"
                      className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      সিলেবাসে প্রভাব
                    </label>
                    <select
                      value={progressType}
                      onChange={(e) => setProgressType(e.target.value as any)}
                      className="w-full p-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                    >
                      <option value="NEW_LESSON">নতুন দরস (প্রোগ্রেস বাড়াবে)</option>
                      <option value="REVISION">দোহরানো / রিভিশন (রিভিশন সংখ্যা)</option>
                      <option value="ASSESSMENT">মূল্যায়ন / পরীক্ষা</option>
                    </select>
                  </div>
                </div>

                {/* Topics from syllabus (collapsible) */}
                {activeSyllabus && activeSyllabus.chapters && activeSyllabus.chapters.length > 0 && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setShowTopicsPicker(!showTopicsPicker)}
                      className="w-full py-2 px-3 bg-white border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center justify-between hover:bg-emerald-50/50 transition cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        <BookmarkCheck className="w-4 h-4 text-emerald-600" />
                        <span>সিলেবাসের পাঠ্য বিষয় / টপিক নির্বাচন ({toBanglaNumber(selectedTopicIds.length)} টি নির্বাচিত)</span>
                      </span>
                      {showTopicsPicker ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    {showTopicsPicker && (
                      <div className="mt-2 p-3 bg-white border border-slate-200 rounded-xl max-h-48 overflow-y-auto space-y-3 animate-in fade-in">
                        {activeSyllabus.chapters.map((ch) => (
                          <div key={ch.id} className="space-y-1.5">
                            <div className="text-[11px] font-bold text-slate-700 border-b border-slate-100 pb-0.5">
                              {ch.name}
                            </div>
                            <div className="space-y-1 pl-1">
                              {(ch.topics || []).map((tp) => {
                                const isChecked = selectedTopicIds.includes(tp.id);
                                return (
                                  <div
                                    key={tp.id}
                                    className="flex items-center justify-between p-1.5 hover:bg-slate-50 rounded-lg text-xs"
                                  >
                                    <label className="flex items-center gap-2 cursor-pointer flex-1 mr-2">
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {
                                          if (isChecked) {
                                            setSelectedTopicIds(selectedTopicIds.filter((id) => id !== tp.id));
                                          } else {
                                            setSelectedTopicIds([...selectedTopicIds, tp.id]);
                                            setSelectedChapterId(ch.id);
                                          }
                                        }}
                                        className="rounded text-emerald-600 focus:ring-emerald-500"
                                      />
                                      <span className="text-slate-800 font-medium">{tp.name}</span>
                                    </label>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <span
                                        className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                                          tp.status === "COMPLETED"
                                            ? "bg-emerald-100 text-emerald-800"
                                            : tp.status === "IN_PROGRESS"
                                            ? "bg-blue-100 text-blue-800"
                                            : "bg-slate-100 text-slate-600"
                                        }`}
                                      >
                                        {tp.status === "COMPLETED"
                                          ? "সম্পন্ন"
                                          : tp.status === "IN_PROGRESS"
                                          ? "চলমান"
                                          : "বাকি"}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setTitle(tp.name);
                                        }}
                                        title="এই টপিকটিকে পড়ার শিরোনাম হিসেবে সেট করুন"
                                        className="text-[10px] text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-1.5 py-0.5 rounded transition cursor-pointer font-bold"
                                      >
                                        শিরোনামে নিন
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                প্রদানের তারিখ (Assigned Date)
              </label>
              <input
                type="date"
                required
                value={assignedDate}
                onChange={(e) => setAssignedDate(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                জমাদান / পড়া শোনার শেষ তারিখ (Due Date)
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-emerald-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Detailed Instructions / Text */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              পড়ার বিস্তারিত বিবরণ / নির্দেশনা <span className="text-emerald-600">*</span>
            </label>
            <textarea
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="পৃষ্ঠা নং, আয়াত নম্বর, পড়ার নিয়ম বা বাড়ি থেকে লিখে আনার বিস্তারিত নির্দেশনা..."
              className="w-full p-2.5 border border-slate-300 rounded-xl text-xs sm:text-sm leading-relaxed focus:ring-2 focus:ring-emerald-600 focus:outline-none"
            />
          </div>

          {/* Multi-Image Uploader (iili.io / imgbb cloud integration) */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
            <AssignmentImageUploader
              images={imageUrls}
              onChange={(urls) => setImageUrls(urls)}
              maxImages={6}
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              বাতিল
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span>{submitting ? "সংরক্ষণ হচ্ছে..." : initialData ? "হালনাগাদ করুন" : "পাঠিয়ে দিন"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
