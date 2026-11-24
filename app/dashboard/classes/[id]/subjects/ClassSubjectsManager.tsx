"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { 
  ArrowLeft, BookOpen, Layers, PlusCircle, Trash2, 
  RefreshCw, AlertCircle, CheckCircle2, BookmarkCheck, ArrowRight, UserCheck
} from "lucide-react";
import { assignSubjectToClass, removeSubjectFromClass } from "@/app/actions/class_subjects";
import { setClassSubjectTeacher } from "@/app/actions/teacher_subjects";
import type { AvailableTeacher } from "@/app/actions/classes";

interface SubjectItem {
  id: string;
  name: string;
  code?: string | null;
  description?: string | null;
}

interface AssignedSubjectItem {
  id: string;
  class_id: string;
  subject_id: string;
  subjects: SubjectItem | null;
}

interface TeacherSubjectMapItem {
  id: string;
  teacher_id: string;
  class_id: string;
  subject_id: string;
  teachers?: {
    id: string;
    first_name?: string;
    last_name?: string;
    designation?: string;
  } | null;
}

interface ClassSubjectsManagerProps {
  classId: string;
  className: string;
  classDescription: string | null;
  classTeacherName?: string | null;
  initialAllSubjects: SubjectItem[];
  initialAssignedSubjects: AssignedSubjectItem[];
  availableTeachers?: AvailableTeacher[];
  initialTeacherSubjects?: TeacherSubjectMapItem[];
}

export default function ClassSubjectsManager({
  classId,
  className,
  classDescription,
  classTeacherName,
  initialAllSubjects,
  initialAssignedSubjects,
  availableTeachers = [],
  initialTeacherSubjects = [],
}: ClassSubjectsManagerProps) {
  const [assigned, setAssigned] = useState<AssignedSubjectItem[]>(initialAssignedSubjects || []);
  const [allSubjects] = useState<SubjectItem[]>(initialAllSubjects || []);
  const [subjectTeachers, setSubjectTeachers] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const row of initialTeacherSubjects || []) {
      if (row.subject_id && row.teacher_id) {
        map[row.subject_id] = row.teacher_id;
      }
    }
    return map;
  });
  
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [savingTeacherForSubject, setSavingTeacherForSubject] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const pendingRef = useRef(false);

  const setSaveGuardActive = (active: boolean) => {
    pendingRef.current = active;
    if (typeof window !== "undefined") {
      if (active) {
        window.onbeforeunload = (e: BeforeUnloadEvent) => {
          e.preventDefault();
          e.returnValue = "বিষয় বণ্টন সেভ হচ্ছে। এখনই পেজ রিলোড করবেন না।";
          return "বিষয় বণ্টন সেভ হচ্ছে। এখনই পেজ রিলোড করবেন না।";
        };
      } else {
        window.onbeforeunload = null;
      }
    }
  };

  // R1 (B25) ফিক্স: মাউন্ট থাকাকালীন সবসময় সক্রিয় গার্ড (pendingRef দিয়ে তাৎক্ষণিক চেক)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!pendingRef.current) return;
      e.preventDefault();
      e.returnValue = "বিষয় বণ্টন সেভ হচ্ছে। এখনই পেজ রিলোড করবেন না।";
      return "বিষয় বণ্টন সেভ হচ্ছে। এখনই পেজ রিলোড করবেন না।";
    };
    const handleClickCapture = (e: MouseEvent) => {
      if (!pendingRef.current) return;
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest?.("a[href]");
      if (anchor) {
        e.preventDefault();
        e.stopPropagation();
        setToast({
          type: "error",
          message: "বিষয় বণ্টন সেভ হচ্ছে — অনুগ্রহ করে সেভ শেষ হওয়া পর্যন্ত কয়েক সেকেন্ড অপেক্ষা করুন।",
        });
      }
    };
    const handleKeyDownCapture = (e: KeyboardEvent) => {
      if (!pendingRef.current) return;
      const isReloadKey =
        e.key === "F5" ||
        ((e.ctrlKey || e.metaKey) && (e.key === "r" || e.key === "R"));
      if (isReloadKey) {
        e.preventDefault();
        e.stopPropagation();
        setToast({
          type: "error",
          message: "বিষয় বণ্টন সেভ হচ্ছে — সেভ শেষ না হওয়া পর্যন্ত পেজ রিলোড করা যাবে না।",
        });
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload, { capture: true });
    window.addEventListener("click", handleClickCapture, { capture: true });
    window.addEventListener("keydown", handleKeyDownCapture, { capture: true });
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload, { capture: true });
      window.removeEventListener("click", handleClickCapture, { capture: true });
      window.removeEventListener("keydown", handleKeyDownCapture, { capture: true });
      window.onbeforeunload = null;
    };
  }, []);

  // Derive unassigned subjects list
  const unassignedSubjects = allSubjects.filter(
    (sub) => !assigned.some((as) => as.subject_id === sub.id)
  );

  const handleTeacherChange = async (subjectId: string, teacherId: string, subjectName: string) => {
    const prevTeacherId = subjectTeachers[subjectId] || "";
    setSubjectTeachers((prev) => ({ ...prev, [subjectId]: teacherId }));
    setSavingTeacherForSubject(subjectId);
    setSaveGuardActive(true);
    setToast(null);
    try {
      const res = await setClassSubjectTeacher(classId, subjectId, teacherId || null);
      if (res?.error) {
        setSubjectTeachers((prev) => ({ ...prev, [subjectId]: prevTeacherId }));
        setToast({ type: "error", message: res.error });
      } else {
        const resolvedId = res?.teacherId || teacherId || "";
        setSubjectTeachers((prev) => ({ ...prev, [subjectId]: resolvedId }));
        const teacherObj = availableTeachers.find((t) => t.id === teacherId || t.id === resolvedId);
        setToast({
          type: "success",
          message: teacherId
            ? `"${subjectName}" বিষয়ের জন্য শিক্ষক (${teacherObj?.name || "ওস্তাদ"}) নির্ধারণ করা হয়েছে!`
            : `"${subjectName}" বিষয়ের শিক্ষক বরাদ্দ সরানো হয়েছে।`,
        });
      }
    } catch (err: any) {
      setSubjectTeachers((prev) => ({ ...prev, [subjectId]: prevTeacherId }));
      setToast({ type: "error", message: err.message || "বিষয় শিক্ষক নির্ধারণ করতে সমস্যা হয়েছে।" });
    } finally {
      setSavingTeacherForSubject(null);
      setSaveGuardActive(false);
    }
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubjectId) {
      setToast({ type: "error", message: "অনুগ্রহ করে একটি বিষয়/কিতাব নির্বাচন করুন" });
      return;
    }

    const subToAssign = allSubjects.find((s) => s.id === selectedSubjectId);
    if (!subToAssign) return;

    const teacherToAssign = selectedTeacherId;

    setSaveGuardActive(true);
    setIsPending(true);
    setToast(null);

    // Optimistic item
    const tempId = "temp-" + Date.now();
    const newAssignedItem: AssignedSubjectItem = {
      id: tempId,
      class_id: classId,
      subject_id: subToAssign.id,
      subjects: subToAssign,
    };

    // Apply optimistic update
    setAssigned((prev) => [...prev, newAssignedItem]);
    setSelectedSubjectId("");
    setSelectedTeacherId("");

    try {
      const res = await assignSubjectToClass(classId, subToAssign.id);
      if (res.error) {
        // Rollback
        setAssigned((prev) => prev.filter((item) => item.id !== tempId));
        setToast({ type: "error", message: res.error });
      } else {
        // Update temp item with actual DB id and data
        if (res.item?.id) {
          setAssigned((prev) =>
            prev.map((item) =>
              item.id === tempId
                ? {
                    ...item,
                    id: res.item.id,
                    subjects: res.item.subjects || subToAssign,
                  }
                : item
            )
          );
        }
        if (teacherToAssign) {
          const tRes = await setClassSubjectTeacher(classId, subToAssign.id, teacherToAssign);
          if (!tRes?.error) {
            setSubjectTeachers((prev) => ({
              ...prev,
              [subToAssign.id]: tRes?.teacherId || teacherToAssign,
            }));
          }
        }
        setToast({
          type: "success",
          message: `"${subToAssign.name}" বিষয়টি সফলভাবে ${className} জামাতে বরাদ্দ করা হয়েছে!`,
        });
      }
    } catch (err: any) {
      setAssigned((prev) => prev.filter((item) => item.id !== tempId));
      setToast({ type: "error", message: err.message || "বিষয় বরাদ্দ করতে সমস্যা হয়েছে।" });
    } finally {
      setSaveGuardActive(false);
      setIsPending(false);
    }
  };

  const handleRemove = async (assignedItem: AssignedSubjectItem) => {
    const subName = assignedItem.subjects?.name || "বিষয়টি";
    if (!confirm(`আপনি কি নিশ্চিত যে "${subName}" বিষয়টিকে ${className} জামাত থেকে বাদ দিতে চান?`)) {
      return;
    }

    setSaveGuardActive(true);
    setDeletingId(assignedItem.id);
    setToast(null);

    // Optimistic removal
    const previousAssigned = [...assigned];
    setAssigned((prev) => prev.filter((item) => item.id !== assignedItem.id));

    try {
      const res = await removeSubjectFromClass(assignedItem.id, classId, assignedItem.subject_id);
      if (res.error) {
        // Rollback
        setAssigned(previousAssigned);
        setToast({ type: "error", message: res.error });
      } else {
        setToast({
          type: "success",
          message: `"${subName}" বিষয়টি জামাত থেকে সফলভাবে অপসারিত হয়েছে।`,
        });
      }
    } catch (err: any) {
      setAssigned(previousAssigned);
      setToast({ type: "error", message: err.message || "মুছে ফেলতে সমস্যা হয়েছে।" });
    } finally {
      setSaveGuardActive(false);
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Header Card */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <Link
            href="/dashboard/classes"
            className="p-2.5 hover:bg-slate-100 rounded-xl transition text-slate-600 border border-slate-200 shadow-2xs flex items-center justify-center shrink-0"
            title="জামাত তালিকায় ফিরে যান"
          >
            <ArrowLeft className="w-5 h-5 text-slate-700" />
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900">জামাতে বিষয় ও কিতাব বরাদ্দকরণ</h1>
              <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                {className}
              </span>
              {classTeacherName && (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-teal-100 text-teal-900 border border-teal-300 flex items-center gap-1">
                  👨‍🏫 শ্রেণি জিম্মাদার: {classTeacherName}
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              {classDescription ? `${classDescription} • ` : ""}এই জামাতের জন্য নির্ধারিত বিষয়সমূহ নির্বাচন ও বিষয়ভিত্তিক শিক্ষক নির্ধারণ করুন।
            </p>
          </div>
        </div>

        <Link
          href="/dashboard/subjects"
          className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 px-3.5 py-2 rounded-xl border border-indigo-200 transition self-start sm:self-auto shrink-0"
        >
          <span>মাদরাসার বিষয় তালিকা</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Active Save Progress Banner (R1 / B25) */}
      {(isPending || deletingId || savingTeacherForSubject) && (
        <div
          role="status"
          aria-live="assertive"
          className="p-4 rounded-2xl border border-amber-300 bg-amber-50 text-amber-900 flex items-center gap-3 shadow-xs font-semibold text-xs sm:text-sm"
        >
          <RefreshCw className="w-5 h-5 text-amber-600 animate-spin shrink-0" />
          <span>
            বিষয় বণ্টন ডেটাবেজে সেভ হচ্ছে... অনুগ্রহ করে এই পেজ রিলোড বা বন্ধ করবেন না।
          </span>
        </div>
      )}

      {/* Toast Alert */}
      {toast && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between gap-3 shadow-xs animate-fade-in ${
            toast.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-rose-50 text-rose-800 border-rose-200"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {toast.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span className="text-xs sm:text-sm font-semibold">{toast.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-xs font-bold px-2 py-1 rounded hover:bg-black/5"
          >
            বন্ধ করুন
          </button>
        </div>
      )}

      {/* Grid: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left 2 Cols: Assigned Subjects List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-600" />
                <h2 className="font-bold text-slate-800 text-sm sm:text-base">
                  বরাদ্দকৃত বিষয়সমূহ ও বিষয়-শিক্ষক
                </h2>
              </div>
              <span className="text-xs font-bold text-slate-600 bg-white px-3 py-1 rounded-lg border border-slate-200">
                মোট বরাদ্দ: {assigned.length}টি
              </span>
            </div>

            <div className="p-0">
              {assigned.length === 0 ? (
                <div className="p-12 text-center text-slate-500 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-700 text-sm">এই জামাতে এখনও কোনো বিষয় বরাদ্দ করা হয়নি।</p>
                    <p className="text-xs text-slate-400 mt-1">ডানপাশের ড্রপডাউন থেকে বিষয় সিলেক্ট করে "বিষয় বরাদ্দ নিশ্চিত করুন" বাটনে ক্লিক করুন।</p>
                  </div>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {assigned.map((item, index) => {
                    const sub = item.subjects;
                    const isDeleting = deletingId === item.id;
                    const isSavingTeacher = savingTeacherForSubject === item.subject_id;
                    const currentTeacherId = subjectTeachers[item.subject_id] || "";
                    return (
                      <li
                        key={item.id}
                        className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-4 sm:px-6 hover:bg-slate-50/60 transition gap-3"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <span className="w-7 h-7 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-black flex items-center justify-center border border-emerald-200 shrink-0">
                            {index + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 text-sm sm:text-base truncate">
                              {sub?.name || "অজানা বিষয়"}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 mt-0.5">
                              {sub?.code && (
                                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200">
                                  কোড: {sub.code}
                                </span>
                              )}
                              {sub?.description && (
                                <span className="text-xs text-slate-500 truncate">
                                  {sub.description}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 self-end sm:self-auto">
                          <div className="flex items-center gap-1.5">
                            <UserCheck className="w-4 h-4 text-emerald-600 shrink-0 hidden sm:inline" />
                            <select
                              value={currentTeacherId}
                              disabled={isSavingTeacher || isDeleting}
                              onChange={(e) =>
                                handleTeacherChange(
                                  item.subject_id,
                                  e.target.value,
                                  sub?.name || "বিষয়"
                                )
                              }
                              aria-label={`${sub?.name || "বিষয়"} এর শিক্ষক নির্বাচন`}
                              className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none max-w-[210px]"
                            >
                              <option value="">-- বিষয় শিক্ষক নির্বাচন --</option>
                              {availableTeachers.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.name} {t.designation ? `(${t.designation})` : ""}
                                </option>
                              ))}
                            </select>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemove(item)}
                            disabled={isDeleting}
                            className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition disabled:opacity-50 cursor-pointer shrink-0 border border-transparent hover:border-rose-200"
                            title="বিষয়টি এই জামাত থেকে বাদ দিন"
                          >
                            {isDeleting ? (
                              <RefreshCw className="w-4 h-4 animate-spin text-rose-500" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Right 1 Col: Assign New Subject Box */}
        <div>
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 sm:p-6 sticky top-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <BookmarkCheck className="w-5 h-5 text-emerald-600" />
              <h2 className="font-bold text-slate-900 text-base">নতুন বিষয় বরাদ্দ করুন</h2>
            </div>

            <form onSubmit={handleAssign} className="space-y-4">
              {unassignedSubjects.length === 0 ? (
                <div className="text-xs text-slate-500 bg-slate-50 p-4 rounded-xl border border-slate-200 text-center space-y-2">
                  <p className="font-bold text-slate-700">সকল বিষয় বরাদ্দকৃত</p>
                  <p>মাদরাসায় বিদ্যমান সকল বিষয় ইতিমধ্যেই এই জামাতে বরাদ্দ করা হয়েছে।</p>
                  <Link
                    href="/dashboard/subjects"
                    className="inline-block text-xs font-bold text-indigo-600 hover:underline pt-1"
                  >
                    + নতুন বিষয় যোগ করতে এখানে ক্লিক করুন
                  </Link>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      বিষয় / কিতাব নির্বাচন করুন
                    </label>
                    <select
                      value={selectedSubjectId}
                      onChange={(e) => setSelectedSubjectId(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-white text-slate-800 text-sm font-medium"
                      required
                    >
                      <option value="" disabled>-- বিষয় নির্বাচন করুন --</option>
                      {unassignedSubjects.map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.name} {sub.code ? `(${sub.code})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      বিষয় শিক্ষক নির্বাচন করুন (ঐচ্ছিক)
                    </label>
                    <select
                      value={selectedTeacherId}
                      onChange={(e) => setSelectedTeacherId(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-white text-slate-800 text-sm font-medium"
                    >
                      <option value="">-- পরবর্তীতে নির্ধারণ করুন --</option>
                      {availableTeachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} {t.designation ? `(${t.designation})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={isPending || !selectedSubjectId}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-all shadow-xs disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isPending ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>বরাদ্দ করা হচ্ছে...</span>
                      </>
                    ) : (
                      <>
                        <PlusCircle className="w-4 h-4" />
                        <span>বিষয় বরাদ্দ নিশ্চিত করুন</span>
                      </>
                    )}
                  </button>
                </>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
