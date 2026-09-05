"use client";

import { useState, useEffect, useMemo } from "react";
import {
  BookOpen,
  Calendar,
  Clock,
  CheckCircle2,
  ExternalLink,
  FileImage,
  User,
  Users,
  Maximize2,
  X,
  CheckCircle,
  HelpCircle,
  PhoneCall,
  Sparkles,
} from "lucide-react";
import { AssignmentItem, ASSIGNMENT_TYPE_MAP } from "@/lib/assignmentTypes";
import { toBanglaNumber } from "@/lib/numberToBangla";

interface ParentAssignmentsClientProps {
  students: any[];
  initialAssignments: AssignmentItem[];
  selectedStudentId?: string;
}

export default function ParentAssignmentsClient({
  students,
  initialAssignments,
  selectedStudentId,
}: ParentAssignmentsClientProps) {
  // Current selected student
  const [activeStudentId, setActiveStudentId] = useState<string>(
    selectedStudentId || students[0]?.id || ""
  );

  const [activeTab, setActiveTab] = useState<string>("ALL");
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // Parent completed tracking in localStorage
  const [parentCheckedIds, setParentCheckedIds] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("qawmi_parent_completed_assignments");
      if (stored) {
        setParentCheckedIds(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
  }, []);

  const toggleParentCheck = (id: string) => {
    const updated = parentCheckedIds.includes(id)
      ? parentCheckedIds.filter((item) => item !== id)
      : [...parentCheckedIds, id];
    setParentCheckedIds(updated);
    try {
      localStorage.setItem("qawmi_parent_completed_assignments", JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  const currentStudent = useMemo(() => {
    return students.find((s) => s.id === activeStudentId) || students[0];
  }, [students, activeStudentId]);

  // Filter assignments for current student
  const studentAssignments = useMemo(() => {
    if (!currentStudent) return [];
    const studentClassId = currentStudent.class_id;

    return initialAssignments.filter((a) => {
      if (a.status === "ARCHIVED") return false;
      // Class-wide
      if (a.target_type === "CLASS" && a.class_id === studentClassId) return true;
      // Specific to this student
      if (a.target_type === "STUDENT" && a.student_id === currentStudent.id) return true;
      return false;
    });
  }, [initialAssignments, currentStudent]);

  // Filter by tab
  const todayStr = new Date().toISOString().split("T")[0];
  const filteredAssignments = useMemo(() => {
    return studentAssignments.filter((a) => {
      if (activeTab === "TODAY") {
        return a.type === "TODAY_LESSON" || a.assigned_date === todayStr;
      }
      if (activeTab === "TOMORROW") {
        return a.type === "TOMORROW_LESSON";
      }
      if (activeTab === "HOMEWORK") {
        return a.type === "HOMEWORK" || a.type === "MEMORIZATION";
      }
      return true;
    });
  }, [studentAssignments, activeTab, todayStr]);

  const todayCount = studentAssignments.filter(
    (a) => a.type === "TODAY_LESSON" || a.assigned_date === todayStr
  ).length;
  const tomorrowCount = studentAssignments.filter((a) => a.type === "TOMORROW_LESSON").length;
  const homeworkCount = studentAssignments.filter(
    (a) => a.type === "HOMEWORK" || a.type === "MEMORIZATION"
  ).length;

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "TODAY_LESSON":
        return {
          bg: "bg-emerald-100 text-emerald-900 border-emerald-300",
          label: "আজকের পড়া",
        };
      case "TOMORROW_LESSON":
        return {
          bg: "bg-blue-100 text-blue-900 border-blue-300",
          label: "আগামীকালের পড়া",
        };
      case "HOMEWORK":
        return {
          bg: "bg-amber-100 text-amber-900 border-amber-300",
          label: "হোমওয়ার্ক / বাড়ির কাজ",
        };
      case "MEMORIZATION":
        return {
          bg: "bg-purple-100 text-purple-900 border-purple-300",
          label: "হিফজ সবক ও মুখস্থ",
        };
      default:
        return {
          bg: "bg-slate-100 text-slate-800 border-slate-300",
          label: "সাধারণ অ্যাসাইনমেন্ট",
        };
    }
  };

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-800 to-teal-900 rounded-3xl p-5 sm:p-6 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/15 rounded-full text-xs font-semibold text-emerald-100 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
              <span>অভিভাবক পোর্টাল • দৈনিক পাঠ ও হোমওয়ার্ক</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight">
              দৈনিক পড়া ও অ্যাসাইনমেন্ট ডায়েরি
            </h1>
            <p className="text-xs sm:text-sm text-emerald-100/90 mt-1 max-w-xl">
              উস্তাদদের দেওয়া আজকের সবক, আগামীকালের পড়া এবং বইয়ের পৃষ্ঠা দেখে সন্তানকে বাসায় তদারকি করুন।
            </p>
          </div>

          {/* Child Switcher if multiple */}
          {students.length > 1 && (
            <div className="bg-white/10 p-2 rounded-2xl border border-white/20">
              <span className="block text-[11px] font-bold text-emerald-200 mb-1.5 px-1">
                সন্তান নির্বাচন করুন:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {students.map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => setActiveStudentId(st.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      activeStudentId === st.id
                        ? "bg-white text-emerald-900 shadow-sm"
                        : "bg-black/20 text-white hover:bg-black/30"
                    }`}
                  >
                    {st.first_name} {st.last_name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Selected Child Info Strip */}
      {currentStudent && (
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center shrink-0">
              {currentStudent.photo_url ? (
                <img
                  src={currentStudent.photo_url}
                  alt=""
                  className="w-full h-full object-cover rounded-xl"
                />
              ) : (
                <User className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="font-bold text-slate-900 text-sm">
                {currentStudent.first_name} {currentStudent.last_name}
              </div>
              <div className="text-slate-500 text-xs">
                জামাত:{" "}
                <strong className="text-slate-700">
                  {currentStudent.classes?.name || currentStudent.class_name || "হিফজ"}
                </strong>{" "}
                {currentStudent.roll_number && (
                  <span>• রোল: {toBanglaNumber(currentStudent.roll_number)}</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 rounded-lg font-bold text-xs border border-emerald-200">
              মোট বরাদ্দকৃত পাঠ: {toBanglaNumber(studentAssignments.length)} টি
            </span>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("ALL")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer border ${
            activeTab === "ALL"
              ? "bg-slate-900 text-white border-slate-900 shadow-xs"
              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
          }`}
        >
          সকল পড়া ({toBanglaNumber(studentAssignments.length)})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("TODAY")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer border ${
            activeTab === "TODAY"
              ? "bg-emerald-700 text-white border-emerald-700 shadow-xs"
              : "bg-white text-emerald-800 border-emerald-200 hover:bg-emerald-50"
          }`}
        >
          আজকের পড়া ({toBanglaNumber(todayCount)})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("TOMORROW")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer border ${
            activeTab === "TOMORROW"
              ? "bg-blue-700 text-white border-blue-700 shadow-xs"
              : "bg-white text-blue-800 border-blue-200 hover:bg-blue-50"
          }`}
        >
          আগামীকালের পড়া ({toBanglaNumber(tomorrowCount)})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("HOMEWORK")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer border ${
            activeTab === "HOMEWORK"
              ? "bg-amber-700 text-white border-amber-700 shadow-xs"
              : "bg-white text-amber-800 border-amber-200 hover:bg-amber-50"
          }`}
        >
          হোমওয়ার্ক ও হিফজ ({toBanglaNumber(homeworkCount)})
        </button>
      </div>

      {/* Assignments List */}
      {filteredAssignments.length > 0 ? (
        <div className="space-y-4">
          {filteredAssignments.map((assignment) => {
            const badge = getTypeBadge(assignment.type);
            const isChecked = parentCheckedIds.includes(assignment.id);

            return (
              <div
                key={assignment.id}
                className={`bg-white rounded-2xl border p-4 sm:p-6 shadow-xs transition hover:shadow-md ${
                  isChecked ? "border-emerald-300 bg-emerald-50/20" : "border-slate-200"
                }`}
              >
                {/* Top Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold border ${badge.bg}`}
                    >
                      {badge.label}
                    </span>

                    {assignment.subject_name && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        {assignment.subject_name}
                      </span>
                    )}

                    {assignment.target_type === "STUDENT" ? (
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-200">
                        আপনার সন্তানের জন্য বিশেষ পড়া
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-50 text-slate-500 border border-slate-200">
                        পুরো জামাতের পড়া
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>তারিখ: <strong className="text-slate-800">{assignment.assigned_date}</strong></span>
                  </div>
                </div>

                {/* Lesson Title */}
                <h3 className="text-lg font-bold text-slate-900 mb-2 leading-snug">
                  {assignment.title}
                </h3>

                {/* Lesson Instructions & Details */}
                <div className="p-4 bg-slate-50 rounded-2xl text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-line border border-slate-100 mb-4 font-normal">
                  {assignment.description}
                </div>

                {/* Book Page Images (iili.io / imgbb cloud integration) */}
                {assignment.image_urls && assignment.image_urls.length > 0 && (
                  <div className="mb-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <FileImage className="w-4 h-4 text-emerald-600" />
                        <span>বইয়ের পৃষ্ঠার ছবি (বড় করে পড়তে ছবিতে ক্লিক করুন):</span>
                      </span>
                      <span className="text-[11px] text-slate-400 font-medium">
                        {toBanglaNumber(assignment.image_urls.length)} টি পৃষ্ঠা
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {assignment.image_urls.map((imgUrl, idx) => (
                        <div
                          key={idx}
                          onClick={() => setLightboxImage(imgUrl)}
                          className="group relative aspect-4/3 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 cursor-pointer shadow-2xs hover:shadow-md transition"
                        >
                          <img
                            src={imgUrl}
                            alt={`পড়ার পৃষ্ঠা ${idx + 1}`}
                            className="w-full h-full object-cover transition group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white gap-1 text-xs font-semibold">
                            <Maximize2 className="w-4 h-4" />
                            <span>বড় করুন</span>
                          </div>
                          <span className="absolute bottom-1.5 left-1.5 bg-black/75 text-white text-[10px] px-2 py-0.5 rounded font-medium">
                            পৃষ্ঠা {idx + 1}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Footer Strip: Teacher info & Guardian checklist */}
                <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex flex-wrap items-center gap-3 text-slate-500">
                    <div>
                      উস্তাদ: <strong className="text-slate-800">{assignment.teacher_name}</strong>
                    </div>

                    {assignment.due_date && (
                      <div className="flex items-center gap-1 text-amber-800 font-semibold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                        <Clock className="w-3.5 h-3.5" />
                        <span>পড়া ধরা হবে: {assignment.due_date}</span>
                      </div>
                    )}
                  </div>

                  {/* Parent Completion Checkbox Toggle */}
                  <button
                    type="button"
                    onClick={() => toggleParentCheck(assignment.id)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                      isChecked
                        ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300"
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isChecked ? "পড়া সম্পন্ন হয়েছে ✓" : "বাসায় পড়া আদায় হয়েছে (মার্ক করুন)"}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-400 space-y-3">
          <BookOpen className="w-12 h-12 mx-auto text-slate-300" />
          <h3 className="text-base font-bold text-slate-700">কোনো পড়া বা অ্যাসাইনমেন্ট নেই</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            এই ক্যাটাগরিতে বর্তমানে কোনো নির্ধারিত পাঠ নেই। শিক্ষক নতুন পড়া প্রদান করলে এখানে দেখতে পাবেন।
          </p>
        </div>
      )}

      {/* Full Page / Image Lightbox for Zoomed Reading */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-xs"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="relative max-w-4xl w-full max-h-[94vh] bg-slate-900 rounded-3xl overflow-hidden shadow-2xl flex flex-col items-center p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between p-3 text-white text-xs border-b border-slate-800">
              <span className="font-bold flex items-center gap-1.5">
                <FileImage className="w-4 h-4 text-emerald-400" />
                <span>বইয়ের পৃষ্ঠার পরিষ্কার ছবি (জুম করে পড়ুন)</span>
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={lightboxImage}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-white font-bold flex items-center gap-1 text-xs transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>আসল রেজুলিউশনে খুলুন</span>
                </a>
                <button
                  type="button"
                  onClick={() => setLightboxImage(null)}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="overflow-auto max-h-[82vh] w-full p-2 flex items-center justify-center">
              <img
                src={lightboxImage}
                alt="বড় পড়া প্রিভিউ"
                className="max-h-[80vh] w-auto object-contain rounded-xl shadow-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
