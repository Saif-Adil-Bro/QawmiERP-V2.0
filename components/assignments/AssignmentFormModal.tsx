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
} from "lucide-react";
import {
  AssignmentItem,
  AssignmentType,
  AssignmentTargetType,
  ASSIGNMENT_TYPE_MAP,
} from "@/lib/assignmentTypes";
import { saveAssignment } from "@/app/actions/assignments";
import { getStudents } from "@/app/actions/students";
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
    }
  }, [initialData, defaultClassId, classes]);

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
