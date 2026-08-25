"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  ArrowLeft, BookOpen, Layers, PlusCircle, Trash2, 
  RefreshCw, AlertCircle, CheckCircle2, BookmarkCheck, ArrowRight
} from "lucide-react";
import { assignSubjectToClass, removeSubjectFromClass } from "@/app/actions/class_subjects";

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

interface ClassSubjectsManagerProps {
  classId: string;
  className: string;
  classDescription: string | null;
  initialAllSubjects: SubjectItem[];
  initialAssignedSubjects: AssignedSubjectItem[];
}

export default function ClassSubjectsManager({
  classId,
  className,
  classDescription,
  initialAllSubjects,
  initialAssignedSubjects,
}: ClassSubjectsManagerProps) {
  const [assigned, setAssigned] = useState<AssignedSubjectItem[]>(initialAssignedSubjects || []);
  const [allSubjects, setAllSubjects] = useState<SubjectItem[]>(initialAllSubjects || []);
  
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Derive unassigned subjects list
  const unassignedSubjects = allSubjects.filter(
    (sub) => !assigned.some((as) => as.subject_id === sub.id)
  );

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubjectId) {
      setToast({ type: "error", message: "অনুগ্রহ করে একটি বিষয়/কিতাব নির্বাচন করুন" });
      return;
    }

    const subToAssign = allSubjects.find((s) => s.id === selectedSubjectId);
    if (!subToAssign) return;

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

    try {
      const res = await assignSubjectToClass(classId, subToAssign.id);
      if (res.error) {
        // Rollback
        setAssigned((prev) => prev.filter((item) => item.id !== tempId));
        setToast({ type: "error", message: res.error });
      } else {
        setToast({
          type: "success",
          message: `"${subToAssign.name}" বিষয়টি সফলভাবে ${className} জামাতে বরাদ্দ করা হয়েছে!`,
        });
      }
    } catch (err: any) {
      setAssigned((prev) => prev.filter((item) => item.id !== tempId));
      setToast({ type: "error", message: err.message || "বিষয় বরাদ্দ করতে সমস্যা হয়েছে।" });
    } finally {
      setIsPending(false);
    }
  };

  const handleRemove = async (assignedItem: AssignedSubjectItem) => {
    const subName = assignedItem.subjects?.name || "বিষয়টি";
    if (!confirm(`আপনি কি নিশ্চিত যে "${subName}" বিষয়টিকে ${className} জামাত থেকে বাদ দিতে চান?`)) {
      return;
    }

    setDeletingId(assignedItem.id);
    setToast(null);

    // Optimistic removal
    const previousAssigned = [...assigned];
    setAssigned((prev) => prev.filter((item) => item.id !== assignedItem.id));

    try {
      const res = await removeSubjectFromClass(assignedItem.id, classId);
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
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              {classDescription ? `${classDescription} • ` : ""}এই জামাতের জন্য নির্ধারিত বিষয়সমূহ নির্বাচন ও রুটিনে ব্যবহারের জন্য প্রস্তুত করুন।
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
                  বরাদ্দকৃত বিষয়সমূহ
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
                    return (
                      <li
                        key={item.id}
                        className="flex justify-between items-center p-4 sm:px-6 hover:bg-slate-50/60 transition gap-4"
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
