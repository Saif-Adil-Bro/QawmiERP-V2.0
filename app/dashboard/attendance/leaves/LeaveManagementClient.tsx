"use client";

import React, { useState, useMemo } from "react";
import {
  CalendarDays,
  GraduationCap,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Clock3,
  Search,
  Filter,
  Plus,
  Trash2,
  Edit2,
  ShieldCheck,
  Phone,
  PhoneCall,
  MessageCircle,
  FileText,
  Printer,
  ChevronRight,
  AlertCircle,
  Sparkles,
  Calendar,
  Layers,
  ArrowRight,
  X,
  Loader2,
  Check,
} from "lucide-react";
import { toBanglaNumber } from "@/lib/numberToBangla";
import { parsePhoneContact } from "@/lib/utils";
import {
  StudentLeaveApplication,
  TeacherLeaveApplication,
  submitStudentLeaveRequest,
  submitTeacherLeaveRequest,
  reviewStudentLeaveRequest,
  reviewTeacherLeaveRequest,
  deleteLeaveApplication,
} from "@/app/actions/leaves";

interface Props {
  initialStudentLeaves: StudentLeaveApplication[];
  initialTeacherLeaves: TeacherLeaveApplication[];
  students: any[];
  teachers: any[];
  classes: any[];
}

export default function LeaveManagementClient({
  initialStudentLeaves,
  initialTeacherLeaves,
  students,
  teachers,
  classes,
}: Props) {
  // State
  const [activeTab, setActiveTab] = useState<"students" | "teachers">("students");
  const [studentLeaves, setStudentLeaves] = useState<StudentLeaveApplication[]>(initialStudentLeaves);
  const [teacherLeaves, setTeacherLeaves] = useState<TeacherLeaveApplication[]>(initialTeacherLeaves);

  // Filters
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("ALL");
  const [classFilter, setClassFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createType, setCreateType] = useState<"STUDENT" | "TEACHER">("STUDENT");

  // Review / Approval Modal
  const [reviewItem, setReviewItem] = useState<{
    type: "STUDENT" | "TEACHER";
    item: StudentLeaveApplication | TeacherLeaveApplication;
  } | null>(null);

  // Review Form state
  const [reviewStatus, setReviewStatus] = useState<"APPROVED" | "REJECTED">("APPROVED");
  const [reviewStartDate, setReviewStartDate] = useState("");
  const [reviewEndDate, setReviewEndDate] = useState("");
  const [reviewRemarks, setReviewRemarks] = useState("");

  // Create Form State
  const [newTargetId, setNewTargetId] = useState("");
  const [newLeaveType, setNewLeaveType] = useState("অসুস্থতাজনিত ছুটি");
  const [newStartDate, setNewStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [newEndDate, setNewEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [newReason, setNewReason] = useState("");
  const [newGuardianName, setNewGuardianName] = useState("");
  const [newGuardianPhone, setNewGuardianPhone] = useState("");

  // Submitting / Feedback
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const showFeedback = (type: "success" | "error", text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 5000);
  };

  // Helper to open review modal
  const handleOpenReview = (
    type: "STUDENT" | "TEACHER",
    item: StudentLeaveApplication | TeacherLeaveApplication,
    defaultStatus: "APPROVED" | "REJECTED" = "APPROVED"
  ) => {
    setReviewItem({ type, item });
    setReviewStatus(defaultStatus);
    setReviewStartDate(item.approved_start_date || item.start_date);
    setReviewEndDate(item.approved_end_date || item.end_date);
    setReviewRemarks(item.admin_remarks || (defaultStatus === "APPROVED" ? "ছুটি মঞ্জুর করা হলো।" : "আবেদনটি বাতিল করা হলো।"));
  };

  // Submit Review
  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewItem) return;

    setSubmitting(true);
    try {
      if (reviewItem.type === "STUDENT") {
        const res = await reviewStudentLeaveRequest({
          requestId: reviewItem.item.id,
          status: reviewStatus,
          startDate: reviewStartDate,
          endDate: reviewEndDate,
          adminRemarks: reviewRemarks,
        });

        if (res.error) {
          showFeedback("error", res.error);
        } else {
          setStudentLeaves((prev) =>
            prev.map((l) => (l.id === reviewItem.item.id ? (res.application as StudentLeaveApplication) : l))
          );
          showFeedback("success", res.message || "ছুটি পর্যালোচনা সফল হয়েছে!");
          setReviewItem(null);
        }
      } else {
        const res = await reviewTeacherLeaveRequest({
          requestId: reviewItem.item.id,
          status: reviewStatus,
          startDate: reviewStartDate,
          endDate: reviewEndDate,
          adminRemarks: reviewRemarks,
        });

        if (res.error) {
          showFeedback("error", res.error);
        } else {
          setTeacherLeaves((prev) =>
            prev.map((l) => (l.id === reviewItem.item.id ? (res.application as TeacherLeaveApplication) : l))
          );
          showFeedback("success", res.message || "শিক্ষকের ছুটি পর্যালোচনা সফল হয়েছে!");
          setReviewItem(null);
        }
      }
    } catch (err: any) {
      showFeedback("error", err?.message || "প্রক্রিয়াকরণে সমস্যা হয়েছে।");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Delete
  const handleDelete = async (id: string, type: "STUDENT" | "TEACHER") => {
    if (!confirm("আপনি কি নিশ্চিতভাবে এই ছুটির আবেদনটি মুছে ফেলতে চান?")) return;

    try {
      const res = await deleteLeaveApplication(id, type);
      if (res.error) {
        showFeedback("error", res.error);
      } else {
        if (type === "STUDENT") {
          setStudentLeaves((prev) => prev.filter((l) => l.id !== id));
        } else {
          setTeacherLeaves((prev) => prev.filter((l) => l.id !== id));
        }
        showFeedback("success", "আবেদন সফলভাবে মুছে ফেলা হয়েছে।");
      }
    } catch (err: any) {
      showFeedback("error", err?.message || "মুছে ফেলতে ব্যর্থ হয়েছে।");
    }
  };

  // Handle Create Application
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTargetId) {
      showFeedback("error", createType === "STUDENT" ? "অনুগ্রহ করে শিক্ষার্থী নির্বাচন করুন।" : "অনুগ্রহ করে শিক্ষক নির্বাচন করুন।");
      return;
    }
    if (!newReason.trim()) {
      showFeedback("error", "অনুগ্রহ করে ছুটির কারণ লিখুন।");
      return;
    }

    setSubmitting(true);
    try {
      if (createType === "STUDENT") {
        const res = await submitStudentLeaveRequest({
          studentId: newTargetId,
          leaveType: newLeaveType,
          startDate: newStartDate,
          endDate: newEndDate,
          reason: newReason,
          guardianName: newGuardianName,
          guardianPhone: newGuardianPhone,
          source: "ADMIN",
        });

        if (res.error) {
          showFeedback("error", res.error);
        } else if (res.application) {
          setStudentLeaves((prev) => [res.application!, ...prev]);
          showFeedback("success", "শিক্ষার্থীর ছুটির আবেদন সফলভাবে তৈরি করা হয়েছে!");
          setIsCreateOpen(false);
          resetCreateForm();
        }
      } else {
        const res = await submitTeacherLeaveRequest({
          teacherId: newTargetId,
          leaveType: (newLeaveType === "অসুস্থতাজনিত ছুটি" ? "SICK" : newLeaveType === "নৈমিত্তিক ছুটি" ? "CASUAL" : "OTHER") as any,
          leaveTypeNameBn: newLeaveType,
          startDate: newStartDate,
          endDate: newEndDate,
          reason: newReason,
          source: "ADMIN",
        });

        if (res.error) {
          showFeedback("error", res.error);
        } else if (res.application) {
          setTeacherLeaves((prev) => [res.application!, ...prev]);
          showFeedback("success", "শিক্ষক/স্টাফের ছুটির আবেদন সফলভাবে তৈরি করা হয়েছে!");
          setIsCreateOpen(false);
          resetCreateForm();
        }
      }
    } catch (err: any) {
      showFeedback("error", err?.message || "আবেদন তৈরি করতে সমস্যা হয়েছে।");
    } finally {
      setSubmitting(false);
    }
  };

  const resetCreateForm = () => {
    setNewTargetId("");
    setNewReason("");
    setNewGuardianName("");
    setNewGuardianPhone("");
    setNewStartDate(new Date().toISOString().split("T")[0]);
    setNewEndDate(new Date().toISOString().split("T")[0]);
  };

  // Quick Prompt for missing phone
  const handlePromptPhone = (phoneStr: string, currentItem: any) => {
    const input = prompt("অভিভাবক/শিক্ষকের ফোন নম্বর লিখুন (যেমন: 01712345678):", phoneStr || "");
    if (!input) return;
    const { whatsappUrl, telUrl } = parsePhoneContact(input);
    if (confirm("হোয়াটসঅ্যাপে মেসেজ পাঠাতে চান? (Cancel চাপলে ফোন কল হবে)")) {
      window.open(whatsappUrl, "_blank");
    } else {
      window.location.href = telUrl;
    }
  };

  // Filtered Student Leaves
  const filteredStudentLeaves = useMemo(() => {
    return studentLeaves.filter((l) => {
      if (statusFilter !== "ALL" && l.status !== statusFilter) return false;
      if (classFilter !== "ALL" && l.class_name !== classFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchName = l.student_name?.toLowerCase().includes(q);
        const matchRoll = l.student_roll?.includes(q);
        const matchPhone = l.guardian_phone?.includes(q);
        const matchReason = l.reason?.toLowerCase().includes(q);
        if (!matchName && !matchRoll && !matchPhone && !matchReason) return false;
      }
      return true;
    });
  }, [studentLeaves, statusFilter, classFilter, searchQuery]);

  // Filtered Teacher Leaves
  const filteredTeacherLeaves = useMemo(() => {
    return teacherLeaves.filter((l) => {
      if (statusFilter !== "ALL" && l.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchName = l.teacher_name?.toLowerCase().includes(q);
        const matchPhone = l.phone?.includes(q);
        const matchReason = l.reason?.toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchReason) return false;
      }
      return true;
    });
  }, [teacherLeaves, statusFilter, searchQuery]);

  // Counts
  const pendingStudentLeavesCount = studentLeaves.filter((l) => l.status === "PENDING").length;
  const pendingTeacherLeavesCount = teacherLeaves.filter((l) => l.status === "PENDING").length;

  const currentList = activeTab === "students" ? filteredStudentLeaves : filteredTeacherLeaves;

  const totalCount = activeTab === "students" ? studentLeaves.length : teacherLeaves.length;
  const pendingCount = activeTab === "students" ? pendingStudentLeavesCount : pendingTeacherLeavesCount;
  const approvedCount = (activeTab === "students" ? studentLeaves : teacherLeaves).filter((l) => l.status === "APPROVED").length;
  const rejectedCount = (activeTab === "students" ? studentLeaves : teacherLeaves).filter((l) => l.status === "REJECTED").length;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-sm font-semibold shadow-md transition ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-900 border-emerald-300"
              : "bg-rose-50 text-rose-900 border-rose-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-800 text-xs font-bold mb-2">
            <CalendarDays className="w-3.5 h-3.5" />
            হাজিরা ও ছুটি মডিউল
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            ছুটির দরখাস্ত ও অনুমোদন ব্যবস্থাপনা (Leave Applications)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            শিক্ষার্থী ও শিক্ষকদের ছুটির আবেদন পর্যালোচনা, সময়সীমা নির্ধারণ, মন্তব্য এবং হাজিরায় স্বয়ংক্রিয় সিঙ্ক।
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setCreateType(activeTab === "students" ? "STUDENT" : "TEACHER");
              setIsCreateOpen(true);
            }}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            নতুন ছুটির দরখাস্ত তৈরি করুন
          </button>
        </div>
      </div>

      {/* Primary Tabs: Students vs Teachers */}
      <div className="flex border-b border-slate-200 bg-white px-3 pt-2 rounded-2xl border shadow-2xs">
        <button
          onClick={() => {
            setActiveTab("students");
            setStatusFilter("ALL");
          }}
          className={`flex items-center gap-2 px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition -mb-px cursor-pointer ${
            activeTab === "students"
              ? "border-blue-600 text-blue-700 bg-blue-50/50 rounded-t-xl"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          <span>ছাত্রদের ছুটির দরখাস্ত</span>
          {pendingStudentLeavesCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500 text-white animate-pulse">
              {toBanglaNumber(pendingStudentLeavesCount)} অপেক্ষমান
            </span>
          )}
        </button>

        <button
          onClick={() => {
            setActiveTab("teachers");
            setStatusFilter("ALL");
          }}
          className={`flex items-center gap-2 px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition -mb-px cursor-pointer ${
            activeTab === "teachers"
              ? "border-emerald-600 text-emerald-700 bg-emerald-50/50 rounded-t-xl"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>শিক্ষক ও স্টাফদের ছুটির দরখাস্ত</span>
          {pendingTeacherLeavesCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500 text-white animate-pulse">
              {toBanglaNumber(pendingTeacherLeavesCount)} অপেক্ষমান
            </span>
          )}
        </button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div
          onClick={() => setStatusFilter("ALL")}
          className={`p-4 rounded-2xl border transition cursor-pointer ${
            statusFilter === "ALL" ? "bg-blue-50/80 border-blue-300 ring-2 ring-blue-500/20" : "bg-white border-slate-200"
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>মোট দরখাস্ত</span>
            <FileText className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
            {toBanglaNumber(totalCount)}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">সর্বমোট আবেদনপত্র</p>
        </div>

        <div
          onClick={() => setStatusFilter("PENDING")}
          className={`p-4 rounded-2xl border transition cursor-pointer ${
            statusFilter === "PENDING"
              ? "bg-amber-50/80 border-amber-300 ring-2 ring-amber-500/20"
              : "bg-white border-slate-200"
          }`}
        >
          <div className="flex items-center justify-between text-amber-700 text-xs font-semibold">
            <span>অপেক্ষমান (Pending)</span>
            <Clock3 className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-amber-800 mt-1">
            {toBanglaNumber(pendingCount)}
          </div>
          <p className="text-[11px] text-amber-700 mt-0.5">সিদ্ধান্ত নেওয়া প্রয়োজন</p>
        </div>

        <div
          onClick={() => setStatusFilter("APPROVED")}
          className={`p-4 rounded-2xl border transition cursor-pointer ${
            statusFilter === "APPROVED"
              ? "bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-500/20"
              : "bg-white border-slate-200"
          }`}
        >
          <div className="flex items-center justify-between text-emerald-700 text-xs font-semibold">
            <span>অনুমোদিত (হাজিরা সিঙ্কড)</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-emerald-800 mt-1">
            {toBanglaNumber(approvedCount)}
          </div>
          <p className="text-[11px] text-emerald-700 mt-0.5">হাজিরায় "ছুটি" হিসেবে সংরক্ষিত</p>
        </div>

        <div
          onClick={() => setStatusFilter("REJECTED")}
          className={`p-4 rounded-2xl border transition cursor-pointer ${
            statusFilter === "REJECTED"
              ? "bg-rose-50/80 border-rose-300 ring-2 ring-rose-500/20"
              : "bg-white border-slate-200"
          }`}
        >
          <div className="flex items-center justify-between text-rose-700 text-xs font-semibold">
            <span>বাতিলকৃত (Rejected)</span>
            <XCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-rose-800 mt-1">
            {toBanglaNumber(rejectedCount)}
          </div>
          <p className="text-[11px] text-rose-700 mt-0.5">মঞ্জুর করা হয়নি</p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setStatusFilter("ALL")}
              className={`px-3 py-1.5 rounded-lg transition ${
                statusFilter === "ALL" ? "bg-white text-slate-800 shadow-2xs" : "text-slate-500"
              }`}
            >
              সকল
            </button>
            <button
              onClick={() => setStatusFilter("PENDING")}
              className={`px-3 py-1.5 rounded-lg transition ${
                statusFilter === "PENDING" ? "bg-amber-500 text-white shadow-2xs" : "text-slate-500"
              }`}
            >
              অপেক্ষমান
            </button>
            <button
              onClick={() => setStatusFilter("APPROVED")}
              className={`px-3 py-1.5 rounded-lg transition ${
                statusFilter === "APPROVED" ? "bg-emerald-600 text-white shadow-2xs" : "text-slate-500"
              }`}
            >
              অনুমোদিত
            </button>
            <button
              onClick={() => setStatusFilter("REJECTED")}
              className={`px-3 py-1.5 rounded-lg transition ${
                statusFilter === "REJECTED" ? "bg-rose-600 text-white shadow-2xs" : "text-slate-500"
              }`}
            >
              বাতিল
            </button>
          </div>

          {/* Class Filter (only for students) */}
          {activeTab === "students" && (
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-700"
            >
              <option value="ALL">সকল জামাত</option>
              {classes.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Search */}
        <div className="relative min-w-[260px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="নাম, রোল, ফোন বা কারণ খুঁজুন..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50/50"
          />
        </div>
      </div>

      {/* Applications List */}
      {currentList.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <CalendarDays className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-700">কোনো ছুটির আবেদন পাওয়া যায়নি</h3>
          <p className="text-xs text-slate-400 mt-1">
            {statusFilter !== "ALL"
              ? "নির্বাচিত ফিল্টারে কোনো রেকর্ড নেই।"
              : "এখনো কোনো ছুটির আবেদন জমা পড়েনি। নতুন আবেদন তৈরি করতে উপরের বাটনে চাপ দিন।"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {currentList.map((item: any) => {
            const isStudent = activeTab === "students";
            const personName = isStudent ? item.student_name : item.teacher_name;
            const subtitle = isStudent
              ? `${item.class_name ? `জামাত: ${item.class_name}` : ""} ${item.student_roll ? `(রোল: ${item.student_roll})` : ""}`.trim()
              : item.designation || "শিক্ষক";

            // Safe Phone parsing (Bengali numerals + English numerals + fallback lookup)
            const rawPhone = isStudent
              ? item.guardian_phone || students.find((s) => s.id === item.student_id)?.parent_phone || students.find((s) => s.id === item.student_id)?.phone || ""
              : item.phone || teachers.find((t) => t.id === item.teacher_id)?.phone || "";

            const { cleanDigits, whatsappUrl, telUrl, displayFormatted } = parsePhoneContact(rawPhone);

            const isModifiedDates =
              item.approved_start_date &&
              item.approved_end_date &&
              (item.approved_start_date !== item.start_date || item.approved_end_date !== item.end_date);

            const displayStartDate = item.approved_start_date || item.start_date;
            const displayEndDate = item.approved_end_date || item.end_date;
            const displayTotalDays = item.approved_total_days || item.total_days;

            return (
              <div
                key={item.id}
                id={`leave-item-${item.id}`}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition"
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  {/* Left: Info */}
                  <div className="space-y-2 flex-1">
                    {/* Badges Bar */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs px-2.5 py-0.5 rounded-md font-bold bg-blue-100 text-blue-800 border border-blue-200">
                        {item.leave_type || item.leave_type_name_bn || "ছুটি"}
                      </span>

                      {/* Status Badge */}
                      {item.status === "APPROVED" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          অনুমোদিত (হাজিরা সিঙ্কড ✓)
                        </span>
                      )}
                      {item.status === "REJECTED" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                          <XCircle className="w-3.5 h-3.5 text-rose-600" />
                          বাতিলকৃত
                        </span>
                      )}
                      {item.status === "PENDING" && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          <Clock3 className="w-3.5 h-3.5 text-amber-600" />
                          অপেক্ষমান
                        </span>
                      )}

                      <span className="text-xs text-slate-400">
                        আবেদনের সময়: {new Date(item.created_at).toLocaleDateString("bn-BD")}
                      </span>
                    </div>

                    {/* Applicant Title */}
                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                        {personName}
                        {subtitle && (
                          <span className="text-xs font-normal text-slate-500">
                            • {subtitle}
                          </span>
                        )}
                      </h3>
                    </div>

                    {/* Duration Info Card */}
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center gap-3 text-xs text-slate-700">
                      <div className="flex items-center gap-1.5 font-semibold">
                        <Calendar className="w-4 h-4 text-blue-600" />
                        <span>ছুটির মেয়াদ:</span>
                        <strong className="text-slate-900">{displayStartDate} হতে {displayEndDate}</strong>
                        <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold text-[11px]">
                          {toBanglaNumber(displayTotalDays)} দিন
                        </span>
                      </div>

                      {isModifiedDates && (
                        <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          (এডমিন কর্তৃক সময়সীমা সংশোধিত; মূল আবেদন ছিল: {item.start_date} হতে {item.end_date})
                        </span>
                      )}
                    </div>

                    {/* Reason text */}
                    <div className="text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                      <strong className="text-slate-800 font-semibold">ছুটির কারণ: </strong>
                      {item.reason}
                    </div>

                    {/* Admin Remarks & Response Note */}
                    {item.admin_remarks && (
                      <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200 text-emerald-950 text-xs">
                        <div className="flex items-center gap-1.5 font-bold text-emerald-800 mb-1">
                          <ShieldCheck className="w-4 h-4 text-emerald-600" />
                          প্রশাসনিক মন্তব্য ও সিদ্ধান্ত ({item.reviewed_by || "মুহতামিম/প্রশাসন"}):
                        </div>
                        <p className="font-medium leading-relaxed">{item.admin_remarks}</p>
                      </div>
                    )}
                  </div>

                  {/* Right: Contact & Action Controls */}
                  <div className="w-full md:w-64 shrink-0 bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col justify-between space-y-3">
                    <div className="space-y-1.5 text-xs">
                      <div className="font-bold text-slate-800 flex items-center gap-1.5">
                        {isStudent ? <Users className="w-3.5 h-3.5 text-slate-500" /> : <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />}
                        {isStudent ? (item.guardian_name || "সম্মানিত অভিভাবক") : "শিক্ষক / কর্মকর্তা"}
                      </div>

                      {/* Phone Display */}
                      <div className="text-slate-700 font-mono font-bold flex items-center gap-1 text-xs">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{displayFormatted || rawPhone || "ফোন নম্বর নেই"}</span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-2 border-t border-slate-200 flex flex-col gap-2">
                      {/* 1. Review / Approve / Change Duration Button */}
                      <button
                        type="button"
                        onClick={() => handleOpenReview(isStudent ? "STUDENT" : "TEACHER", item, item.status === "PENDING" ? "APPROVED" : item.status)}
                        className="w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        {item.status === "PENDING"
                          ? "অনুমোদন ও সময়সীমা নির্ধারণ"
                          : "সময়সীমা ও মন্তব্য পরিবর্তন"}
                      </button>

                      {/* 2. Disapprove / Reject if Pending */}
                      {item.status === "PENDING" && (
                        <button
                          type="button"
                          onClick={() => handleOpenReview(isStudent ? "STUDENT" : "TEACHER", item, "REJECTED")}
                          className="w-full py-1.5 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5 text-rose-600" />
                          বাতিল / প্রত্যাখ্যান করুন
                        </button>
                      )}

                      {/* 3. WhatsApp and Call Buttons (Fully functional with Bengali numerals support) */}
                      <div className="grid grid-cols-2 gap-2">
                        {cleanDigits ? (
                          <a
                            href={whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="py-1.5 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center justify-center gap-1 transition shadow-2xs"
                            title="হোয়াটসঅ্যাপে মেসেজ পাঠান"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            WhatsApp
                          </a>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handlePromptPhone(rawPhone, item)}
                            className="py-1.5 px-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-[11px] flex items-center justify-center gap-1 transition"
                            title="ফোন নম্বর যুক্ত করে WhatsApp করুন"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            WhatsApp
                          </button>
                        )}

                        {cleanDigits ? (
                          <a
                            href={telUrl}
                            className="py-1.5 px-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] flex items-center justify-center gap-1 transition shadow-2xs"
                          >
                            <PhoneCall className="w-3.5 h-3.5" />
                            কল করুন
                          </a>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handlePromptPhone(rawPhone, item)}
                            className="py-1.5 px-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-300 font-bold text-[11px] flex items-center justify-center gap-1 transition"
                            title="ফোন নম্বর যুক্ত করে কল করুন"
                          >
                            <PhoneCall className="w-3.5 h-3.5" />
                            কল করুন
                          </button>
                        )}
                      </div>

                      {/* 4. Delete Record */}
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id, isStudent ? "STUDENT" : "TEACHER")}
                        className="w-full py-1 text-slate-400 hover:text-rose-600 text-[11px] flex items-center justify-center gap-1 transition cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        আবেদন মুছে ফেলুন
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Review / Approval Modal */}
      {reviewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4 my-8">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-700">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">
                    ছুটির আবেদন পর্যালোচনা ও অনুমোদন
                  </h3>
                  <p className="text-xs text-slate-500">
                    {reviewItem.type === "STUDENT"
                      ? (reviewItem.item as StudentLeaveApplication).student_name
                      : (reviewItem.item as TeacherLeaveApplication).teacher_name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setReviewItem(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitReview} className="space-y-4 text-xs sm:text-sm">
              {/* Decision Toggle */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">অনুমোদনের সিদ্ধান্ত:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setReviewStatus("APPROVED")}
                    className={`py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-2 border transition cursor-pointer ${
                      reviewStatus === "APPROVED"
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    অনুমোদন করুন (Approved)
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewStatus("REJECTED")}
                    className={`py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-2 border transition cursor-pointer ${
                      reviewStatus === "REJECTED"
                        ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <XCircle className="w-4 h-4" />
                    বাতিল / প্রত্যাখ্যান (Reject)
                  </button>
                </div>
              </div>

              {/* Date Modification Notice & Inputs */}
              {reviewStatus === "APPROVED" && (
                <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900">
                    <CalendarDays className="w-4 h-4 text-blue-600" />
                    ছুটির অনুমোদিত সময়সীমা নির্ধারণ (প্রয়োজনে পরিবর্তন করুন):
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        শুরুর তারিখ
                      </label>
                      <input
                        type="date"
                        value={reviewStartDate}
                        onChange={(e) => setReviewStartDate(e.target.value)}
                        required
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        শেষের তারিখ
                      </label>
                      <input
                        type="date"
                        value={reviewEndDate}
                        onChange={(e) => setReviewEndDate(e.target.value)}
                        required
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white font-mono"
                      />
                    </div>
                  </div>

                  <div className="text-[11px] text-emerald-800 bg-emerald-100/70 p-2 rounded-lg flex items-center gap-1.5 font-medium">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    অনুমোদন বাটনে চাপার সাথে সাথে এই মেয়াদের সকল দিনের জন্য হাজিরা টেবিলে স্বয়ংক্রিয়ভাবে <strong>"ছুটি (Leave)"</strong> সেভ হয়ে যাবে।
                  </div>
                </div>
              )}

              {/* Admin Remarks / Comments */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  প্রশাসনিক মন্তব্য / শর্তাবলী:
                </label>
                <textarea
                  rows={3}
                  value={reviewRemarks}
                  onChange={(e) => setReviewRemarks(e.target.value)}
                  placeholder="যেমন: ৩ দিনের ছুটি মঞ্জুর করা হলো। এরপর অনুপস্থিত থাকলে জরিমানা প্রযোজ্য..."
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReviewItem(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  ফিরে যান
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`px-5 py-2 text-xs font-bold text-white rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                    reviewStatus === "APPROVED"
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : "bg-rose-600 hover:bg-rose-700"
                  }`}
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {reviewStatus === "APPROVED"
                    ? "অনুমোদন করুন ও হাজিরা সিঙ্ক করুন"
                    : "বাতিল হিসেবে সংরক্ষণ করুন"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create New Application Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4 my-8">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-700">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">
                    নতুন ছুটির দরখাস্ত প্রেরণ
                  </h3>
                  <p className="text-xs text-slate-500">
                    ছাত্র অথবা শিক্ষকের ছুটির আবেদন তৈরি ও সিস্টেমে অন্তর্ভুক্ত করুন
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs sm:text-sm">
              {/* Type Switch */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">ছুটির আবেদনকারী:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCreateType("STUDENT");
                      setNewTargetId("");
                    }}
                    className={`py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-2 border transition cursor-pointer ${
                      createType === "STUDENT"
                        ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                        : "bg-white text-slate-700 border-slate-200"
                    }`}
                  >
                    <GraduationCap className="w-4 h-4" />
                    শিক্ষার্থী (Student)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCreateType("TEACHER");
                      setNewTargetId("");
                    }}
                    className={`py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-2 border transition cursor-pointer ${
                      createType === "TEACHER"
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                        : "bg-white text-slate-700 border-slate-200"
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    শিক্ষক / স্টাফ (Teacher)
                  </button>
                </div>
              </div>

              {/* Target Selection */}
              {createType === "STUDENT" ? (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">শিক্ষার্থী নির্বাচন করুন *</label>
                  <select
                    value={newTargetId}
                    onChange={(e) => {
                      setNewTargetId(e.target.value);
                      const s = students.find((st) => st.id === e.target.value);
                      if (s) {
                        setNewGuardianPhone(s.parent_phone || s.phone || "");
                      }
                    }}
                    required
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- শিক্ষার্থী বাছাই করুন --</option>
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.first_name} {s.last_name} {s.roll_number ? `(রোল: ${s.roll_number})` : ""} - {s.class_name || ""}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">শিক্ষক / স্টাফ নির্বাচন করুন *</label>
                  <select
                    value={newTargetId}
                    onChange={(e) => setNewTargetId(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- শিক্ষক বাছাই করুন --</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.first_name} {t.last_name} ({t.designation || "শিক্ষক"})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Leave Type */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">ছুটির ধরণ:</label>
                <select
                  value={newLeaveType}
                  onChange={(e) => setNewLeaveType(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="অসুস্থতাজনিত ছুটি">অসুস্থতাজনিত ছুটি (Medical / Sick Leave)</option>
                  <option value="পারিবারিক জরুরি ছুটি">পারিবারিক জরুরি ছুটি (Family Emergency)</option>
                  <option value="নৈমিত্তিক ছুটি">নৈমিত্তিক ছুটি (Casual Leave)</option>
                  <option value="জরুরি সফর">জরুরি সফর (Travel / Official)</option>
                  <option value="অন্যান্য ছুটি">অন্যান্য ছুটি</option>
                </select>
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">শুরুর তারিখ</label>
                  <input
                    type="date"
                    value={newStartDate}
                    onChange={(e) => setNewStartDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">শেষের তারিখ</label>
                  <input
                    type="date"
                    value={newEndDate}
                    onChange={(e) => setNewEndDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 font-mono"
                  />
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">ছুটির কারণ ও বিস্তারিত *</label>
                <textarea
                  rows={3}
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  placeholder="ছুটির কারণ বিস্তারিত লিখুন..."
                  required
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  আবেদন জমা দিন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
