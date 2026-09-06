"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { 
  PenTool, 
  FileText, 
  Printer, 
  IdCard, 
  Trophy, 
  Settings, 
  FileSignature, 
  Edit3, 
  Trash2, 
  Search, 
  Calendar, 
  AlertTriangle, 
  CheckCircle2, 
  X, 
  Sparkles,
  Loader2
} from "lucide-react";
import ExamPublishToggle from "./ExamPublishToggle";
import { updateExamDetails, deleteExam } from "@/app/actions/exams";
import { useRouter } from "next/navigation";

interface ExamItem {
  id: string;
  title: string;
  year: string;
  start_date?: string | null;
  end_date?: string | null;
  status: string;
  dynamic_status?: string;
  dynamic_status_bangla?: string;
  is_published?: boolean;
  published_at?: string | null;
  published_by?: string | null;
  publish_note?: string | null;
  effective_start_date?: string | null;
  effective_end_date?: string | null;
  routine_count?: number;
  last_routine_date?: string | null;
}

function getDynamicStatusInfo(startDate: string, endDate: string) {
  if (!startDate) {
    return {
      type: "Upcoming",
      label: "আসন্ন",
      badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
      dotClass: "bg-blue-500",
      isPulsing: false,
    };
  }

  let todayStr: string;
  try {
    todayStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Dhaka",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    todayStr = new Date().toISOString().split("T")[0];
  }

  const sStr = startDate.split("T")[0];
  const eStr = endDate ? endDate.split("T")[0] : sStr;

  if (todayStr < sStr) {
    return {
      type: "Upcoming",
      label: "আসন্ন",
      badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
      dotClass: "bg-blue-500",
      isPulsing: false,
    };
  } else if (todayStr >= sStr && todayStr <= eStr) {
    return {
      type: "Ongoing",
      label: "চলমান",
      badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
      dotClass: "bg-amber-500",
      isPulsing: true,
    };
  } else {
    return {
      type: "Completed",
      label: "সম্পন্ন",
      badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
      dotClass: "bg-emerald-500",
      isPulsing: false,
    };
  }
}

export default function ExamListClient({ initialExams }: { initialExams: ExamItem[] }) {
  const router = useRouter();
  const [exams, setExams] = useState<ExamItem[]>(initialExams);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  // Edit Modal State
  const [editingExam, setEditingExam] = useState<ExamItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editYear, setEditYear] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [isCustomTitle, setIsCustomTitle] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");

  // Delete Modal State
  const [deletingExam, setDeletingExam] = useState<ExamItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Years for filter and edit
  const currentYear = new Date().getFullYear();
  const yearsList = Array.from(new Set(exams.map((e) => e.year).concat([currentYear.toString()]))).sort().reverse();
  const yearOptions = Array.from({ length: 5 }, (_, i) => (currentYear - 2 + i).toString());

  // Filtered exams
  const filteredExams = exams.filter((exam) => {
    const matchesSearch =
      exam.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exam.year.includes(searchQuery);
    const matchesYear = selectedYear === "all" || exam.year === selectedYear;
    const matchesStatus =
      selectedStatus === "all" ||
      (selectedStatus === "published" && exam.is_published) ||
      (selectedStatus === "unpublished" && !exam.is_published) ||
      exam.dynamic_status?.toLowerCase() === selectedStatus.toLowerCase();

    return matchesSearch && matchesYear && matchesStatus;
  });

  // Open Edit Modal
  const handleOpenEdit = (exam: ExamItem) => {
    setEditingExam(exam);
    setEditTitle(exam.title);
    setEditYear(exam.year);
    setEditStartDate(exam.start_date ? exam.start_date.split("T")[0] : "");
    setEditEndDate(exam.end_date ? exam.end_date.split("T")[0] : "");
    const presetTitles = [
      "ছামাহি (Quarterly)",
      "শশমাহি (Half-Yearly)",
      "সালানা (Annual)",
      "মাসিক পরীক্ষা (Monthly Test)",
    ];
    setIsCustomTitle(!presetTitles.includes(exam.title));
    setEditError("");
  };

  // Submit Edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExam) return;

    if (!editTitle.trim() || !editYear.trim()) {
      setEditError("পরীক্ষার নাম এবং বছর আবশ্যক।");
      return;
    }

    setSavingEdit(true);
    setEditError("");

    try {
      const res = await updateExamDetails(editingExam.id, {
        title: editTitle.trim(),
        year: editYear.trim(),
        start_date: editStartDate || null,
        end_date: editEndDate || null,
      });

      if (res?.error) {
        setEditError(res.error);
        setSavingEdit(false);
        return;
      }

      // Update local state
      const computed = getDynamicStatusInfo(editStartDate, editEndDate);
      setExams((prev) =>
        prev.map((item) =>
          item.id === editingExam.id
            ? {
                ...item,
                title: editTitle.trim(),
                year: editYear.trim(),
                start_date: editStartDate || null,
                end_date: editEndDate || null,
                effective_start_date: editStartDate || item.effective_start_date,
                effective_end_date: editEndDate || item.effective_end_date,
                dynamic_status: computed.type,
                dynamic_status_bangla: computed.label,
              }
            : item
        )
      );

      setEditingExam(null);
      router.refresh();
    } catch (err: any) {
      setEditError(err.message || "সংরক্ষণে সমস্যা হয়েছে।");
    } finally {
      setSavingEdit(false);
    }
  };

  // Open Delete Modal
  const handleOpenDelete = (exam: ExamItem) => {
    setDeletingExam(exam);
    setDeleteError("");
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!deletingExam) return;

    setIsDeleting(true);
    setDeleteError("");

    try {
      const res = await deleteExam(deletingExam.id);
      if (res?.error) {
        setDeleteError(res.error);
        setIsDeleting(false);
        return;
      }

      // Remove from local state
      setExams((prev) => prev.filter((item) => item.id !== deletingExam.id));
      setDeletingExam(null);
      router.refresh();
    } catch (err: any) {
      setDeleteError(err.message || "মুছে ফেলতে সমস্যা হয়েছে।");
    } finally {
      setIsDeleting(false);
    }
  };

  const statusPreview = getDynamicStatusInfo(editStartDate, editEndDate);

  return (
    <div className="space-y-4">
      {/* Search & Filter Controls */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="পরীক্ষার নাম বা বছর দিয়ে খুঁজুন..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 transition"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="px-3 py-2 text-xs sm:text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900"
          >
            <option value="all">সকল বছর</option>
            {yearsList.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 text-xs sm:text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900"
          >
            <option value="all">সকল অবস্থা</option>
            <option value="upcoming">আসন্ন (Upcoming)</option>
            <option value="ongoing">চলমান (Ongoing)</option>
            <option value="completed">সম্পন্ন (Completed)</option>
            <option value="published">ফলাফল প্রকাশিত</option>
            <option value="unpublished">ফলাফল অপ্রকাশিত</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        {filteredExams.length === 0 ? (
          <div className="p-12 text-center">
            <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600 font-medium">কোনো পরীক্ষা পাওয়া যায়নি</p>
            <p className="text-xs text-slate-400 mt-1">
              ফিল্টার পরিবর্তন করুন অথবা নতুন পরীক্ষা তৈরি করুন।
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">পরীক্ষার নাম</th>
                  <th className="px-4 py-3.5">বছর</th>
                  <th className="px-5 py-3.5">তারিখ ও সময়সূচি</th>
                  <th className="px-5 py-3.5">অবস্থা (Status)</th>
                  <th className="px-5 py-3.5 text-center">ব্যবস্থাপনা (Manage)</th>
                  <th className="px-5 py-3.5 text-right">একাডেমিক কার্যক্রম</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredExams.map((exam) => {
                  const startDateStr = exam.effective_start_date || exam.start_date;
                  const endDateStr = exam.effective_end_date || exam.last_routine_date;
                  const hasDifferentEndDate =
                    endDateStr && startDateStr && endDateStr !== startDateStr;

                  return (
                    <tr key={exam.id} className="hover:bg-slate-50/70 transition group">
                      {/* Exam Title */}
                      <td className="px-5 py-4">
                        <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                          <span>{exam.title}</span>
                        </div>
                        {exam.routine_count && exam.routine_count > 0 ? (
                          <div className="text-xs text-slate-500 mt-0.5 font-medium flex items-center gap-1">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                            <span>{exam.routine_count} টি বিষয়ের রুটিন নির্ধারিত</span>
                          </div>
                        ) : (
                          <div className="text-xs text-slate-400 mt-0.5">রুটিন এন্ট্রি বাকি</div>
                        )}
                      </td>

                      {/* Year */}
                      <td className="px-4 py-4 font-bold text-slate-700">
                        <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded text-xs">
                          {exam.year}
                        </span>
                      </td>

                      {/* Dates */}
                      <td className="px-5 py-4">
                        {startDateStr ? (
                          <div>
                            <div className="text-slate-800 font-semibold text-xs sm:text-sm">
                              {format(new Date(startDateStr), "dd MMM, yyyy")}
                              {hasDifferentEndDate &&
                                ` — ${format(new Date(endDateStr), "dd MMM, yyyy")}`}
                            </div>
                            {hasDifferentEndDate && (
                              <div className="text-[11px] text-indigo-600 mt-0.5">
                                রুটিনের শেষ দিন: {format(new Date(endDateStr), "dd MMM")}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs italic">তারিখ নির্ধারিত নেই</span>
                        )}
                      </td>

                      {/* Status & Publish */}
                      <td className="px-5 py-4">
                        <div className="space-y-1.5">
                          <div>
                            {exam.dynamic_status === "Ongoing" ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                <span className="relative flex h-2 w-2 mr-1.5">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                                </span>
                                চলমান
                              </span>
                            ) : exam.dynamic_status === "Completed" ? (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
                                সম্পন্ন
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5"></span>
                                আসন্ন
                              </span>
                            )}
                          </div>
                          <div>
                            <ExamPublishToggle
                              examId={exam.id}
                              initialPublished={Boolean(exam.is_published)}
                              publishedAt={exam.published_at}
                              publishedBy={exam.published_by}
                              publishNote={exam.publish_note}
                              size="compact"
                            />
                          </div>
                        </div>
                      </td>

                      {/* EDIT & DELETE MANAGEMENT ACTIONS */}
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-center gap-1.5 bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                          {/* EDIT BUTTON */}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(exam)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-blue-700 bg-white hover:bg-blue-50 border border-blue-200 hover:border-blue-300 rounded-md transition cursor-pointer shadow-2xs"
                            title="পরীক্ষার তথ্য সম্পাদনা (Edit Exam)"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                            <span>সম্পাদনা</span>
                          </button>

                          {/* DELETE BUTTON */}
                          <button
                            type="button"
                            onClick={() => handleOpenDelete(exam)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-red-700 bg-white hover:bg-red-50 border border-red-200 hover:border-red-300 rounded-md transition cursor-pointer shadow-2xs"
                            title="পরীক্ষাটি মুছে ফেলুন (Delete Exam)"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-600" />
                            <span>মুছুন</span>
                          </button>
                        </div>
                      </td>

                      {/* ACADEMIC ACTIONS */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end flex-wrap gap-1">
                          <Link
                            href={`/dashboard/exams/${exam.id}/setup`}
                            className="p-1.5 text-orange-600 hover:bg-orange-50 rounded-md transition border border-transparent hover:border-orange-200"
                            title="পরীক্ষা সেটআপ ও বিষয় তালিকা (Setup)"
                          >
                            <Settings className="w-4 h-4" />
                          </Link>
                          <Link
                            href={`/dashboard/exams/${exam.id}/routine`}
                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-md transition border border-transparent hover:border-indigo-200"
                            title="পরীক্ষার রুটিন (Routine)"
                          >
                            <FileText className="w-4 h-4" />
                          </Link>
                          <Link
                            href={`/dashboard/exams/${exam.id}/paper`}
                            className="p-1.5 text-violet-600 hover:bg-violet-50 rounded-md transition border border-transparent hover:border-violet-200"
                            title="প্রশ্নপত্র জেনারেটর (Question Paper)"
                          >
                            <FileSignature className="w-4 h-4" />
                          </Link>
                          <Link
                            href={`/dashboard/exams/${exam.id}/admit-cards`}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition border border-transparent hover:border-blue-200"
                            title="প্রবেশপত্র (Admit Cards)"
                          >
                            <IdCard className="w-4 h-4" />
                          </Link>
                          <Link
                            href={`/dashboard/exams/${exam.id}/marks`}
                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-md transition border border-transparent hover:border-indigo-200"
                            title="নম্বর এন্ট্রি (Marks Entry)"
                          >
                            <PenTool className="w-4 h-4" />
                          </Link>
                          <Link
                            href={`/dashboard/exams/${exam.id}/results`}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-md transition border border-transparent hover:border-emerald-200"
                            title="ফলাফল ও টেবুলেশন শিট (Results & Tabulation)"
                          >
                            <FileText className="w-4 h-4" />
                          </Link>
                          <Link
                            href={`/dashboard/exams/${exam.id}/report-cards`}
                            className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-md transition border border-transparent hover:border-slate-200"
                            title="স্বতন্ত্র মার্কশিট (Report Cards)"
                          >
                            <Printer className="w-4 h-4" />
                          </Link>
                          <Link
                            href={`/dashboard/exams/${exam.id}/merit-list`}
                            className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-md transition border border-transparent hover:border-amber-200"
                            title="মেধাতালিকা (Merit List)"
                          >
                            <Trophy className="w-4 h-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* EDIT EXAM MODAL                                                           */}
      {/* ========================================================================= */}
      {editingExam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Edit3 className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-base">পরীক্ষা সম্পাদনা (Edit Exam)</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingExam(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              {editError && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              {/* Exam Title Preset or Custom */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  পরীক্ষার নাম <span className="text-red-500">*</span>
                </label>
                <select
                  value={isCustomTitle ? "custom" : editTitle}
                  onChange={(e) => {
                    if (e.target.value === "custom") {
                      setIsCustomTitle(true);
                      setEditTitle("");
                    } else {
                      setIsCustomTitle(false);
                      setEditTitle(e.target.value);
                    }
                  }}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                >
                  <option value="ছামাহি (Quarterly)">ছামাহি (Quarterly)</option>
                  <option value="শশমাহি (Half-Yearly)">শশমাহি (Half-Yearly)</option>
                  <option value="সালানা (Annual)">সালানা (Annual)</option>
                  <option value="মাসিক পরীক্ষা (Monthly Test)">মাসিক পরীক্ষা (Monthly Test)</option>
                  <option value="custom">অন্যান্য / কাস্টম নাম লিখুন...</option>
                </select>

                {isCustomTitle && (
                  <input
                    type="text"
                    placeholder="কাস্টম পরীক্ষার নাম লিখুন..."
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    required
                    className="w-full mt-2 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                )}
              </div>

              {/* Year */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  শিক্ষাবর্ষ (Year) <span className="text-red-500">*</span>
                </label>
                <select
                  value={editYear}
                  onChange={(e) => setEditYear(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              {/* Dates Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span>শুরুর তারিখ</span>
                  </label>
                  <input
                    type="date"
                    value={editStartDate}
                    onChange={(e) => setEditStartDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span>শেষের তারিখ</span>
                  </label>
                  <input
                    type="date"
                    value={editEndDate}
                    min={editStartDate || undefined}
                    onChange={(e) => setEditEndDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>

              {/* Dynamic Status Preview */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-600 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                    হিসাবকৃত অবস্থা:
                  </span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${statusPreview.badgeClass}`}
                  >
                    <span
                      className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${statusPreview.dotClass}`}
                    ></span>
                    {statusPreview.label}
                  </span>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingExam(null)}
                  disabled={savingEdit}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  {savingEdit ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>সংরক্ষণ হচ্ছে...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>পরিবর্তন সংরক্ষণ করুন</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DELETE CONFIRMATION MODAL                                                 */}
      {/* ========================================================================= */}
      {deletingExam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-red-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-6 text-center space-y-3">
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-lg text-slate-900">
                পরীক্ষাটি মুছে ফেলতে চান?
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                আপনি <strong className="text-slate-900">"{deletingExam.title}" ({deletingExam.year})</strong> পরীক্ষাটি মুছে ফেলতে যাচ্ছেন। এর ফলে এই পরীক্ষার রুটিন, বিষয় তালিকা ও সংরক্ষিত নম্বরগুলো মুছে যেতে পারে।
              </p>

              {deleteError && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200 text-left">
                  {deleteError}
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingExam(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition"
              >
                বাতিল করুন
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-5 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg transition flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>মুছে ফেলা হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>হ্যাঁ, নিশ্চিত ডিলিট করুন</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
