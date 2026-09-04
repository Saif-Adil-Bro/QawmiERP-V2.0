"use client";

import { useState } from "react";
import Link from "next/link";
import {
  GraduationCap,
  Plus,
  Search,
  Filter,
  Printer,
  CheckCircle2,
  AlertCircle,
  Edit,
  Trash2,
  Archive,
  ArrowUpDown,
  Download,
  Eye,
  Award,
  BookOpen,
  UserCheck,
  Sparkles,
  ExternalLink,
  ChevronDown,
  X,
  Phone,
  Calendar,
  Layers,
} from "lucide-react";
import { toBanglaNumber } from "@/lib/numberToBangla";
import { AdmissionApplication, ADMISSION_STATUS_MAP } from "@/lib/admissions";
import {
  submitAdmissionApplication,
  updateAdmissionApplication,
  evaluateAdmissionTest,
  autoRankMeritList,
  confirmAdmissionToStudent,
  bulkConfirmAdmissions,
  deleteAdmissionApplication,
  archiveAdmissionApplication,
  approveAdmissionSchedule,
} from "@/app/actions/admissions";
import { getNextClassRoll } from "@/app/actions/students";

interface AdmissionsClientProps {
  initialApplications: AdmissionApplication[];
  classes: any[];
}

export default function AdmissionsClient({
  initialApplications,
  classes,
}: AdmissionsClientProps) {
  const [applications, setApplications] = useState<AdmissionApplication[]>(initialApplications);
  const [activeTab, setActiveTab] = useState<"all" | "evaluation" | "confirmed">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showEvalModal, setShowEvalModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showTabulationModal, setShowTabulationModal] = useState(false);
  const [showMeritModal, setShowMeritModal] = useState(false);
  const [selectedApp, setSelectedApp] = useState<AdmissionApplication | null>(null);

  // Form States
  const [formData, setFormData] = useState<any>({
    applicant_name_bn: "",
    applicant_name_en: "",
    date_of_birth: "",
    gender: "MALE",
    blood_group: "",
    birth_reg_no: "",
    father_name: "",
    father_occupation: "",
    mother_name: "",
    guardian_name: "",
    guardian_relation: "পিতা",
    guardian_phone: "",
    emergency_phone: "",
    present_address: "",
    permanent_address: "",
    target_class_id: classes[0]?.id || "",
    target_class_name: classes[0]?.name || "",
    residential_status: "আবাসিক",
    previous_institution: "",
    previous_class_or_para: "",
    department_category: "general",
    hifz_para_memorized: "",
    hifz_tajweed_quality: "উত্তম",
    kitab_previous_kitab: "",
    kitab_previous_grade: "মুমতাজ (১ম বিভাগ)",
  });

  // Schedule / Admit Approval Form
  const [scheduleData, setScheduleData] = useState({
    exam_date: "২০২৬-০৫-১৫",
    exam_time: "সকাল ০৯:৩০ ঘটিকা",
    venue: "মাদরাসা কেন্দ্রীয় ক্যাম্পাস ও অডিটোরিয়াম",
    room_no: "১০১ (একাডেমিক ভবন)",
  });

  // Evaluation Form
  const [evalData, setEvalData] = useState({
    written_marks: 0,
    oral_marks: 0,
    quran_tilawat_marks: 0,
    evaluated_by: "",
    remarks: "",
    pass_cutoff: 50,
  });

  // Confirm Student Form
  const [confirmData, setConfirmData] = useState({
    assignedClassId: "",
    assignedRoll: "",
    remarks: "",
  });

  // Filtered List
  const filteredApps = applications.filter((app) => {
    if (activeTab === "evaluation") {
      if (app.status === "CONFIRMED") return false;
    }
    if (activeTab === "confirmed") {
      if (app.status !== "CONFIRMED") return false;
    }

    if (classFilter !== "all" && app.target_class_id !== classFilter) {
      return false;
    }
    if (statusFilter !== "all" && app.status !== statusFilter) {
      return false;
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      return (
        app.applicant_name_bn.toLowerCase().includes(q) ||
        app.applicant_name_en.toLowerCase().includes(q) ||
        app.application_no.toLowerCase().includes(q) ||
        app.roll_number.toLowerCase().includes(q) ||
        app.guardian_phone.includes(q) ||
        app.father_name.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Stats calculation
  const totalApps = applications.length;
  const admitIssuedCount = applications.filter((a) => a.status === "ADMIT_ISSUED" || a.status === "PENDING").length;
  const meritSelectedCount = applications.filter((a) => a.status === "MERIT_SELECTED").length;
  const confirmedCount = applications.filter((a) => a.status === "CONFIRMED").length;

  const showNotification = (type: "success" | "error", text: string) => {
    setFeedbackMessage({ type, text });
    setTimeout(() => setFeedbackMessage(null), 5000);
  };

  // Handlers
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const res = await submitAdmissionApplication(formData);
    setIsLoading(false);

    if (res.error) {
      showNotification("error", res.error);
    } else if (res.application) {
      setApplications([res.application, ...applications]);
      setShowCreateModal(false);
      showNotification(
        "success",
        `নতুন আবেদন ও প্রবেশপত্র তৈরি হয়েছে! আবেদন নং: ${res.application.application_no}, রোল: ${res.application.roll_number}`
      );
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp) return;
    setIsLoading(true);
    const res = await updateAdmissionApplication(selectedApp.id, formData);
    setIsLoading(false);

    if (res.error) {
      showNotification("error", res.error);
    } else if (res.application) {
      setApplications(applications.map((a) => (a.id === selectedApp.id ? res.application! : a)));
      setShowEditModal(false);
      showNotification("success", "আবেদনের তথ্য সফলভাবে হালনাগাদ করা হয়েছে।");
    }
  };

  const handleEvalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp) return;
    setIsLoading(true);
    const res = await evaluateAdmissionTest(selectedApp.id, evalData);
    setIsLoading(false);

    if (res.error) {
      showNotification("error", res.error);
    } else if (res.application) {
      setApplications(applications.map((a) => (a.id === selectedApp.id ? res.application! : a)));
      setShowEvalModal(false);
      showNotification(
        "success",
        `নম্বর এন্ট্রি সংরক্ষিত হয়েছে! মোট প্রাপ্ত নম্বর: ${toBanglaNumber(
          res.application.test_evaluation?.total_marks || 0
        )} (${res.application.status === "MERIT_SELECTED" ? "মেধাতালিকায় নির্বাচিত" : "বাতিল"})`
      );
    }
  };

  const handleAutoRank = async () => {
    if (!confirm("আপনি কি প্রাপ্ত নম্বরের ভিত্তিতে স্বয়ংক্রিয়ভাবে মেধা তালিকা তৈরি করতে চান?")) return;
    setIsLoading(true);
    const res = await autoRankMeritList(classFilter);
    setIsLoading(false);

    if (res.error) {
      showNotification("error", res.error);
    } else {
      showNotification("success", `মোট ${toBanglaNumber(res.count || 0)} জন শিক্ষার্থীর মেধা স্থান সফলভাবে নির্ধারিত হয়েছে!`);
      // Update local state sorted
      const updated = [...applications].sort((a, b) => {
        const rankA = a.test_evaluation?.merit_position || 9999;
        const rankB = b.test_evaluation?.merit_position || 9999;
        return rankA - rankB;
      });
      setApplications(updated);
    }
  };

  const handleConfirmAdmissionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp) return;
    setIsLoading(true);
    const res = await confirmAdmissionToStudent({
      admissionId: selectedApp.id,
      assignedClassId: confirmData.assignedClassId,
      assignedRoll: confirmData.assignedRoll,
    });
    setIsLoading(false);

    if (res.error) {
      showNotification("error", res.error);
    } else {
      setApplications(
        applications.map((a) =>
          a.id === selectedApp.id
            ? {
                ...a,
                status: "CONFIRMED",
                confirmed_student_id: res.student?.id,
                assigned_permanent_roll: confirmData.assignedRoll,
              }
            : a
        )
      );
      setShowConfirmModal(false);
      showNotification("success", res.message || "ভর্তি সফলভাবে নিশ্চিত হয়েছে এবং শিক্ষার্থী তালিকায় যুক্ত হয়েছে!");
    }
  };

  const handleBulkConfirm = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`আপনি কি নির্বাচিত ${toBanglaNumber(selectedIds.length)} জন শিক্ষার্থীর ভর্তি নিশ্চিত করতে চান?`)) return;
    setIsLoading(true);
    const res = await bulkConfirmAdmissions(selectedIds);
    setIsLoading(false);

    if (res.error) {
      showNotification("error", res.error);
    } else {
      showNotification("success", `মোট ${toBanglaNumber(res.confirmedCount || 0)} জন শিক্ষার্থীর ভর্তি নিশ্চিত হয়েছে!`);
      setApplications(
        applications.map((a) => (selectedIds.includes(a.id) ? { ...a, status: "CONFIRMED" } : a))
      );
      setSelectedIds([]);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`আপনি কি নিশ্চিত যে "${name}"-এর আবেদনটি মুছে ফেলতে চান?`)) return;
    setIsLoading(true);
    const res = await deleteAdmissionApplication(id);
    setIsLoading(false);
    if (res.error) {
      showNotification("error", res.error);
    } else {
      setApplications(applications.filter((a) => a.id !== id));
      showNotification("success", "আবেদন মুছে ফেলা হয়েছে।");
    }
  };

  const openEdit = (app: AdmissionApplication) => {
    setSelectedApp(app);
    setFormData({
      applicant_name_bn: app.applicant_name_bn,
      applicant_name_en: app.applicant_name_en,
      date_of_birth: app.date_of_birth,
      gender: app.gender,
      blood_group: app.blood_group || "",
      birth_reg_no: app.birth_reg_no || "",
      father_name: app.father_name,
      father_occupation: app.father_occupation || "",
      mother_name: app.mother_name || "",
      guardian_name: app.guardian_name,
      guardian_relation: app.guardian_relation || "পিতা",
      guardian_phone: app.guardian_phone,
      emergency_phone: app.emergency_phone || "",
      present_address: app.present_address,
      permanent_address: app.permanent_address || "",
      target_class_id: app.target_class_id,
      target_class_name: app.target_class_name,
      residential_status: app.residential_status,
      previous_institution: app.previous_institution || "",
      previous_class_or_para: app.previous_class_or_para || "",
    });
    setShowEditModal(true);
  };

  const openEvaluation = (app: AdmissionApplication) => {
    setSelectedApp(app);
    setEvalData({
      written_marks: app.test_evaluation?.written_marks || 0,
      oral_marks: app.test_evaluation?.oral_marks || 0,
      quran_tilawat_marks: app.test_evaluation?.quran_tilawat_marks || 0,
      evaluated_by: app.test_evaluation?.evaluated_by || "",
      remarks: app.test_evaluation?.remarks || "",
      pass_cutoff: 50,
    });
    setShowEvalModal(true);
  };

  const handleApproveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp) return;
    setIsLoading(true);
    const res = await approveAdmissionSchedule(selectedApp.id, scheduleData);
    setIsLoading(false);

    if (res.error) {
      showNotification("error", res.error);
    } else if (res.application) {
      setApplications(applications.map((a) => (a.id === selectedApp.id ? res.application! : a)));
      setShowScheduleModal(false);
      showNotification("success", `প্রবেশপত্র ও পরীক্ষার শিডিউল অনুমোদিত হয়েছে! রোল: ${res.application.roll_number}`);
    }
  };

  const openScheduleModal = (app: AdmissionApplication) => {
    setSelectedApp(app);
    setScheduleData({
      exam_date: app.exam_schedule?.exam_date || "২০২৬-০৫-১৫",
      exam_time: app.exam_schedule?.exam_time || "সকাল ০৯:৩০ ঘটিকা",
      venue: app.exam_schedule?.venue || "মাদরাসা কেন্দ্রীয় ক্যাম্পাস ও অডিটোরিয়াম",
      room_no: app.exam_schedule?.room_no || "১০১ (একাডেমিক ভবন)",
    });
    setShowScheduleModal(true);
  };

  const openConfirm = async (app: AdmissionApplication) => {
    setSelectedApp(app);
    // Dynamic next roll from database
    const rollRes = await getNextClassRoll(app.target_class_id);
    setConfirmData({
      assignedClassId: app.target_class_id,
      assignedRoll: rollRes.nextRoll || "১",
      remarks: "",
    });
    setShowConfirmModal(true);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Toast Notification */}
      {feedbackMessage && (
        <div
          className={`p-4 rounded-xl text-sm font-semibold flex items-center justify-between shadow-lg transition-all ${
            feedbackMessage.type === "success"
              ? "bg-emerald-600 text-white"
              : "bg-rose-600 text-white"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMessage.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
          <button onClick={() => setFeedbackMessage(null)} className="cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header & Quick Action Hub */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <GraduationCap className="w-7 h-7 text-emerald-600" />
            <span>অনলাইন ভর্তি ও এন্ট্রি টেস্ট মূল্যায়ন</span>
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm">
            নতুন শিক্ষাবর্ষে অনলাইনে ভর্তি আবেদন, প্রবেশপত্র ইস্যু, এন্ট্রি টেস্ট মূল্যায়ন ও মেধাভিত্তিক স্থায়ী ভর্তি
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admission"
            target="_blank"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold shadow-xs transition"
          >
            <ExternalLink className="w-4 h-4 text-emerald-600" />
            <span>পাবলিক আবেদন পেজ</span>
          </Link>

          <button
            onClick={() => {
              setFormData({
                applicant_name_bn: "",
                applicant_name_en: "",
                date_of_birth: "",
                gender: "MALE",
                blood_group: "",
                birth_reg_no: "",
                father_name: "",
                father_occupation: "",
                mother_name: "",
                guardian_name: "",
                guardian_relation: "পিতা",
                guardian_phone: "",
                emergency_phone: "",
                present_address: "",
                permanent_address: "",
                target_class_id: classes[0]?.id || "",
                target_class_name: classes[0]?.name || "",
                residential_status: "আবাসিক",
                previous_institution: "",
                previous_class_or_para: "",
              });
              setShowCreateModal(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ নতুন ভর্তি আবেদন</span>
          </button>
        </div>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4.5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>মোট আবেদনপত্র</span>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2 font-mono">
            {toBanglaNumber(totalApps)}
          </p>
          <span className="text-[11px] text-slate-400">নতুন শিক্ষাবর্ষ</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4.5 shadow-xs">
          <div className="flex items-center justify-between text-amber-700 text-xs font-semibold">
            <span>প্রবেশপত্র ইস্যু</span>
            <Printer className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-amber-700 mt-2 font-mono">
            {toBanglaNumber(admitIssuedCount)}
          </p>
          <span className="text-[11px] text-slate-400">পরীক্ষার অপেক্ষায়</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4.5 shadow-xs">
          <div className="flex items-center justify-between text-indigo-700 text-xs font-semibold">
            <span>মেধাতালিকায় নির্বাচিত</span>
            <Award className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-2xl font-bold text-indigo-700 mt-2 font-mono">
            {toBanglaNumber(meritSelectedCount)}
          </p>
          <span className="text-[11px] text-slate-400">উত্তীর্ণ ও ভর্তির যোগ্য</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4.5 shadow-xs">
          <div className="flex items-center justify-between text-emerald-700 text-xs font-semibold">
            <span>ভর্তি নিশ্চিত হয়েছে</span>
            <UserCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-emerald-700 mt-2 font-mono">
            {toBanglaNumber(confirmedCount)}
          </p>
          <span className="text-[11px] text-slate-400">ছাত্র তালিকায় অন্তর্ভুক্ত</span>
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap border-b border-slate-200 px-4 pt-3 gap-2 bg-slate-50/50">
          <button
            onClick={() => setActiveTab("all")}
            className={`pb-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition flex items-center gap-2 ${
              activeTab === "all"
                ? "border-emerald-600 text-emerald-800"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>সকল আবেদনপত্র ({toBanglaNumber(totalApps)})</span>
          </button>
          <button
            onClick={() => setActiveTab("evaluation")}
            className={`pb-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition flex items-center gap-2 ${
              activeTab === "evaluation"
                ? "border-emerald-600 text-emerald-800"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Award className="w-4 h-4" />
            <span>এন্ট্রি টেস্ট মূল্যায়ন ও মেধা তালিকা</span>
          </button>
          <button
            onClick={() => setActiveTab("confirmed")}
            className={`pb-3 px-4 text-xs sm:text-sm font-bold border-b-2 transition flex items-center gap-2 ${
              activeTab === "confirmed"
                ? "border-emerald-600 text-emerald-800"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>ভর্তি নিশ্চিতকৃত শিক্ষার্থী ({toBanglaNumber(confirmedCount)})</span>
          </button>
        </div>

        {/* Toolbar: Search, Filters & Bulk actions */}
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-white">
          <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
            {/* Search Input */}
            <div className="relative flex-1 max-w-xs">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="নাম, আবেদন নং, রোল বা মোবাইল খুঁজুন..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Class Filter */}
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-xl text-xs sm:text-sm bg-white text-slate-700"
            >
              <option value="all">সকল জামাত</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-xl text-xs sm:text-sm bg-white text-slate-700"
            >
              <option value="all">সকল অবস্থা</option>
              <option value="PENDING">অপেক্ষমান / পর্যালোচনায়</option>
              <option value="ADMIT_ISSUED">প্রবেশপত্র ইস্যু</option>
              <option value="MERIT_SELECTED">মেধাতালিকায় নির্বাচিত</option>
              <option value="WAITING_LIST">অপেক্ষমান তালিকা</option>
              <option value="CONFIRMED">ভর্তি নিশ্চিত</option>
              <option value="REJECTED">বাতিল</option>
            </select>
          </div>

          {/* Action Tools */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowTabulationModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              title="ভর্তি পরীক্ষার দিন শিক্ষকদের মার্কস এন্ট্রির জন্য প্রিন্টযোগ্য ট্যাবুলেশন শিট"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              <span>পরীক্ষক শিট</span>
            </button>

            <button
              onClick={() => setShowMeritModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              title="নোটিশ বোর্ডের জন্য চূড়ান্ত মেধা তালিকা প্রিন্ট"
            >
              <Award className="w-3.5 h-3.5 text-indigo-600" />
              <span>মেধা তালিকা শিট</span>
            </button>

            {activeTab === "evaluation" && (
              <button
                onClick={handleAutoRank}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>স্বয়ংক্রিয় মেধা ক্রম নির্ধারণ</span>
              </button>
            )}

            {selectedIds.length > 0 && (
              <button
                onClick={handleBulkConfirm}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>নির্বাচিতদের ভর্তি নিশ্চিত করুন ({toBanglaNumber(selectedIds.length)})</span>
              </button>
            )}
          </div>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="p-3.5 w-8">
                  <input
                    type="checkbox"
                    checked={
                      filteredApps.length > 0 &&
                      filteredApps.every((a) => selectedIds.includes(a.id))
                    }
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedIds(filteredApps.map((a) => a.id));
                      } else {
                        setSelectedIds([]);
                      }
                    }}
                    className="rounded text-emerald-600"
                  />
                </th>
                <th className="p-3.5">আবেদন নং ও পরীক্ষার রোল</th>
                <th className="p-3.5">শিক্ষার্থীর নাম ও পিতা</th>
                <th className="p-3.5">জামাত ও ধরন</th>
                <th className="p-3.5">অভিভাবকের মোবাইল</th>
                {activeTab === "evaluation" ? (
                  <>
                    <th className="p-3.5 text-center">লিখিত / মৌখিক / তিলাওয়াত</th>
                    <th className="p-3.5 text-center">মোট নম্বর ও মেধা স্থান</th>
                  </>
                ) : (
                  <th className="p-3.5">বর্তমান অবস্থা</th>
                )}
                <th className="p-3.5 text-right">কার্যক্রম (Actions)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredApps.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="text-sm font-semibold">কোনো ভর্তি আবেদন পাওয়া যায়নি</p>
                    <p className="text-xs">নতুন আবেদন যুক্ত করতে "+ নতুন ভর্তি আবেদন" বাটনে ক্লিক করুন</p>
                  </td>
                </tr>
              ) : (
                filteredApps.map((app) => (
                  <tr key={app.id} className="hover:bg-slate-50/70 transition">
                    <td className="p-3.5">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(app.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds([...selectedIds, app.id]);
                          } else {
                            setSelectedIds(selectedIds.filter((id) => id !== app.id));
                          }
                        }}
                        className="rounded text-emerald-600"
                      />
                    </td>
                    <td className="p-3.5">
                      <span className="font-mono font-bold text-slate-900 block text-xs">
                        {app.application_no}
                      </span>
                      <span className="font-mono text-[11px] font-extrabold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200 inline-block mt-0.5">
                        রোল: {app.roll_number}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900">{app.applicant_name_bn}</div>
                      <div className="text-xs text-slate-500">পিতা: {app.father_name}</div>
                    </td>
                    <td className="p-3.5">
                      <div className="font-semibold text-slate-800">{app.target_class_name}</div>
                      <span className="text-[11px] text-slate-500">{app.residential_status}</span>
                    </td>
                    <td className="p-3.5">
                      <div className="font-mono font-medium text-slate-800">{app.guardian_phone}</div>
                      <span className="text-[11px] text-slate-500">{app.present_address.substring(0, 20)}...</span>
                    </td>

                    {activeTab === "evaluation" ? (
                      <>
                        <td className="p-3.5 text-center">
                          <div className="font-mono text-xs font-semibold">
                            {toBanglaNumber(app.test_evaluation?.written_marks || 0)} /{" "}
                            {toBanglaNumber(app.test_evaluation?.oral_marks || 0)} /{" "}
                            {toBanglaNumber(app.test_evaluation?.quran_tilawat_marks || 0)}
                          </div>
                          <span className="text-[10px] text-slate-400">লিখিত / মৌখিক / তিলাওয়াত</span>
                        </td>
                        <td className="p-3.5 text-center">
                          <div className="font-bold text-sm text-slate-900">
                            {toBanglaNumber(app.test_evaluation?.total_marks || 0)}/১০০
                          </div>
                          {app.test_evaluation?.merit_position ? (
                            <span className="inline-block px-2 py-0.5 bg-amber-100 text-amber-800 font-extrabold text-[11px] rounded-full mt-0.5">
                              মেধা স্থান: {toBanglaNumber(app.test_evaluation.merit_position)}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400">-</span>
                          )}
                        </td>
                      </>
                    ) : (
                      <td className="p-3.5">
                        {app.status === "CONFIRMED" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-800 font-bold text-xs rounded-full">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>ভর্তি নিশ্চিত</span>
                          </span>
                        ) : app.status === "MERIT_SELECTED" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-100 text-indigo-800 font-bold text-xs rounded-full">
                            <Award className="w-3.5 h-3.5" />
                            <span>মেধাতালিকায় উত্তীর্ণ</span>
                          </span>
                        ) : app.status === "REJECTED" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-100 text-rose-800 font-bold text-xs rounded-full">
                            <span>বাতিল</span>
                          </span>
                        ) : app.status === "PENDING" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-900 font-bold text-xs rounded-full">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                            <span>অপেক্ষমান আবেদন</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-800 font-bold text-xs rounded-full">
                            <span>প্রবেশপত্র ইস্যু</span>
                          </span>
                        )}
                      </td>
                    )}

                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Approve Schedule for Pending/Issued */}
                        {app.status !== "CONFIRMED" && (
                          <button
                            onClick={() => openScheduleModal(app)}
                            title="পরীক্ষার শিডিউল ও প্রবেশপত্র অনুমোদন"
                            className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition cursor-pointer"
                          >
                            <Calendar className="w-4 h-4" />
                          </button>
                        )}

                        {/* Print Admit Card */}
                        <Link
                          href={`/admission/card/${app.id}`}
                          target="_blank"
                          title="প্রবেশপত্র প্রিন্ট"
                          className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                        >
                          <Printer className="w-4 h-4" />
                        </Link>

                        {/* Evaluate Marks */}
                        <button
                          onClick={() => openEvaluation(app)}
                          title="এন্ট্রি টেস্ট নম্বর ইনপুট"
                          className="p-1.5 text-slate-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                        >
                          <Award className="w-4 h-4" />
                        </button>

                        {/* Confirm to Student if not yet confirmed */}
                        {app.status !== "CONFIRMED" && (
                          <button
                            onClick={() => openConfirm(app)}
                            title="ভর্তি নিশ্চিতকরণ ও শিক্ষার্থী আইডি প্রদান"
                            className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                          >
                            <UserCheck className="w-4 h-4" />
                          </button>
                        )}

                        {/* Edit Button */}
                        <button
                          onClick={() => openEdit(app)}
                          title="সম্পাদনা করুন"
                          className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                        >
                          <Edit className="w-4 h-4" />
                        </button>

                        {/* Delete Button */}
                        <button
                          onClick={() => handleDelete(app.id, app.applicant_name_bn)}
                          title="মুছে ফেলুন"
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: Create / New Admission Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-600" />
                <span>+ নতুন ভর্তি আবেদন দাখিল করুন (অফিস এন্ট্রি)</span>
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    শিক্ষার্থীর নাম (বাংলায়) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="মুহাম্মদ তাহমিদ হাসান"
                    value={formData.applicant_name_bn}
                    onChange={(e) => setFormData({ ...formData, applicant_name_bn: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    শিক্ষার্থীর নাম (English)
                  </label>
                  <input
                    type="text"
                    placeholder="MUHAMMAD TAHMID HASAN"
                    value={formData.applicant_name_en}
                    onChange={(e) => setFormData({ ...formData, applicant_name_en: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ভর্তির জামাত <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.target_class_id}
                    onChange={(e) => {
                      const sel = classes.find((c) => c.id === e.target.value);
                      setFormData({
                        ...formData,
                        target_class_id: e.target.value,
                        target_class_name: sel?.name || "",
                      });
                    }}
                    className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    আবাসিক অবস্থা <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.residential_status}
                    onChange={(e) =>
                      setFormData({ ...formData, residential_status: e.target.value as any })
                    }
                    className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    <option value="আবাসিক">আবাসিক</option>
                    <option value="অনাবাসিক">অনাবাসিক</option>
                    <option value="ডে-কেয়ার">ডে-কেয়ার</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    পিতার নাম <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.father_name}
                    onChange={(e) => setFormData({ ...formData, father_name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    অভিভাবকের মোবাইল <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="017XXXXXXXX"
                    value={formData.guardian_phone}
                    onChange={(e) => setFormData({ ...formData, guardian_phone: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    জন্ম তারিখ <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.date_of_birth}
                    onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    বর্তমান ঠিকানা <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="গ্রাম, থানা, জেলা"
                    value={formData.present_address}
                    onChange={(e) => setFormData({ ...formData, present_address: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border rounded-xl text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs cursor-pointer"
                >
                  {isLoading ? "সংরক্ষণ হচ্ছে..." : "আবেদন দাখিল ও রোল ইস্যু করুন"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Edit Application Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Edit className="w-5 h-5 text-blue-600" />
                <span>ভর্তি আবেদন তথ্য সম্পাদনা করুন</span>
              </h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    শিক্ষার্থীর নাম (বাংলায়)
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.applicant_name_bn}
                    onChange={(e) => setFormData({ ...formData, applicant_name_bn: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    পিতার নাম
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.father_name}
                    onChange={(e) => setFormData({ ...formData, father_name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    অভিভাবকের মোবাইল নম্বর
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.guardian_phone}
                    onChange={(e) => setFormData({ ...formData, guardian_phone: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    আবাসিক অবস্থা
                  </label>
                  <select
                    value={formData.residential_status}
                    onChange={(e) =>
                      setFormData({ ...formData, residential_status: e.target.value as any })
                    }
                    className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 bg-white"
                  >
                    <option value="আবাসিক">আবাসিক</option>
                    <option value="অনাবাসিক">অনাবাসিক</option>
                    <option value="ডে-কেয়ার">ডে-কেয়ার</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border rounded-xl text-xs sm:text-sm font-semibold text-slate-600"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs cursor-pointer"
                >
                  {isLoading ? "হালনাগাদ হচ্ছে..." : "তথ্য হালনাগাদ করুন"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Evaluation / Test Marks Input */}
      {showEvalModal && selectedApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Award className="w-5 h-5 text-indigo-600" />
                  <span>ভর্তি পরীক্ষা মূল্যায়ন ও নম্বর এন্ট্রি</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  শিক্ষার্থী: {selectedApp.applicant_name_bn} • রোল: {selectedApp.roll_number}
                </p>
              </div>
              <button
                onClick={() => setShowEvalModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEvalSubmit} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    লিখিত পরীক্ষা (৫০)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={evalData.written_marks}
                    onChange={(e) =>
                      setEvalData({ ...evalData, written_marks: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 border rounded-xl text-center text-base font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    মৌখিক পরীক্ষা (৩০)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={evalData.oral_marks}
                    onChange={(e) =>
                      setEvalData({ ...evalData, oral_marks: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 border rounded-xl text-center text-base font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    কুরআন তিলাওয়াত (২০)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    value={evalData.quran_tilawat_marks}
                    onChange={(e) =>
                      setEvalData({ ...evalData, quran_tilawat_marks: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 border rounded-xl text-center text-base font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Total Calculation Display */}
              <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs text-indigo-700 font-semibold block">সর্বমোট প্রাপ্ত নম্বর (১০০ এর মধ্যে):</span>
                  <span className="text-xs text-indigo-500">পাস নম্বর: ৫০</span>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-indigo-900 font-mono">
                    {toBanglaNumber(
                      (evalData.written_marks || 0) +
                        (evalData.oral_marks || 0) +
                        (evalData.quran_tilawat_marks || 0)
                    )}
                  </span>
                  <span className="text-xs text-slate-500 font-bold block">
                    {(evalData.written_marks || 0) +
                      (evalData.oral_marks || 0) +
                      (evalData.quran_tilawat_marks || 0) >=
                    50 ? (
                      <span className="text-emerald-700 font-extrabold">উত্তীর্ণ (পাস)</span>
                    ) : (
                      <span className="text-rose-600 font-bold">অনুপযুক্ত</span>
                    )}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  মূল্যায়নকারী পরীক্ষকের নাম
                </label>
                <input
                  type="text"
                  placeholder="যেমন: মাওলানা ক্বারী ইলিয়াস আহমদ"
                  value={evalData.evaluated_by}
                  onChange={(e) => setEvalData({ ...evalData, evaluated_by: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  মন্তব্য
                </label>
                <input
                  type="text"
                  placeholder="তেলাওয়াত সুন্দর, উচ্চারণ পরিষ্কার"
                  value={evalData.remarks}
                  onChange={(e) => setEvalData({ ...evalData, remarks: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowEvalModal(false)}
                  className="px-4 py-2 border rounded-xl text-xs sm:text-sm font-semibold text-slate-600"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs cursor-pointer"
                >
                  {isLoading ? "সংরক্ষণ হচ্ছে..." : "নম্বর সংরক্ষণ করুন"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Confirm Admission to Student Record */}
      {showConfirmModal && selectedApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-emerald-600" />
                  <span>ভর্তি নিশ্চিতকরণ ও আইডি প্রদান</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  শিক্ষার্থীকে স্থায়ী রেজিস্টারে অন্তর্ভুক্ত করুন
                </p>
              </div>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl space-y-1 text-xs">
              <p className="font-bold text-emerald-900">
                শিক্ষার্থী: {selectedApp.applicant_name_bn}
              </p>
              <p className="text-emerald-700">পিতা: {selectedApp.father_name}</p>
              <p className="text-emerald-700">মোবাইল: {selectedApp.guardian_phone}</p>
              {selectedApp.test_evaluation && (
                <p className="font-semibold text-emerald-800 pt-1 border-t border-emerald-200">
                  পরীক্ষায় প্রাপ্ত নম্বর: {toBanglaNumber(selectedApp.test_evaluation.total_marks || 0)}/১০০
                  {selectedApp.test_evaluation.merit_position && ` • মেধা ক্রম: ${toBanglaNumber(selectedApp.test_evaluation.merit_position)}`}
                </p>
              )}
            </div>

            <form onSubmit={handleConfirmAdmissionSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  চূড়ান্ত নির্ধারিত জামাত <span className="text-rose-500">*</span>
                </label>
                <select
                  value={confirmData.assignedClassId}
                  onChange={(e) => setConfirmData({ ...confirmData, assignedClassId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  শ্রেণি রোল নম্বর (স্থায়ী ক্লাস রোল) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="যেমন: ১০১"
                  value={confirmData.assignedRoll}
                  onChange={(e) => setConfirmData({ ...confirmData, assignedRoll: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl text-sm font-mono font-bold focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="px-4 py-2 border rounded-xl text-xs sm:text-sm font-semibold text-slate-600"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs cursor-pointer"
                >
                  {isLoading ? "নিশ্চিত করা হচ্ছে..." : "ভর্তি নিশ্চিত করুন"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: Schedule & Admit Card Approval Modal */}
      {showScheduleModal && selectedApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-amber-600" />
                  <span>পরীক্ষার শিডিউল ও প্রবেশপত্র অনুমোদন</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  আবেদনকারীর জন্য ভর্তি পরীক্ষার তারিখ, সময় ও স্থান নির্ধারণ
                </p>
              </div>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl space-y-1 text-xs">
              <p className="font-bold text-amber-950">
                শিক্ষার্থী: {selectedApp.applicant_name_bn}
              </p>
              <p className="text-amber-800">আবেদন নং: {selectedApp.application_no} • জামাত: {selectedApp.target_class_name}</p>
              <p className="text-amber-800">বর্তমান স্ট্যাটাস: {ADMISSION_STATUS_MAP[selectedApp.status]?.labelBn || selectedApp.status}</p>
            </div>

            <form onSubmit={handleApproveSchedule} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  পরীক্ষার তারিখ <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="যেমন: ২০২৬-০৫-১৫"
                  value={scheduleData.exam_date}
                  onChange={(e) => setScheduleData({ ...scheduleData, exam_date: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  পরীক্ষার সময় <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="যেমন: সকাল ০৯:৩০ ঘটিকা"
                  value={scheduleData.exam_time}
                  onChange={(e) => setScheduleData({ ...scheduleData, exam_time: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  পরীক্ষা কেন্দ্র / ভেন্যু <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="যেমন: মাদরাসা কেন্দ্রীয় ক্যাম্পাস ও অডিটোরিয়াম"
                  value={scheduleData.venue}
                  onChange={(e) => setScheduleData({ ...scheduleData, venue: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  কক্ষ নম্বর (Room No)
                </label>
                <input
                  type="text"
                  placeholder="যেমন: ১০১ (একাডেমিক ভবন)"
                  value={scheduleData.room_no}
                  onChange={(e) => setScheduleData({ ...scheduleData, room_no: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="px-4 py-2 border rounded-xl text-xs sm:text-sm font-semibold text-slate-600"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs cursor-pointer"
                >
                  {isLoading ? "অনুমোদন হচ্ছে..." : "শিডিউল ও প্রবেশপত্র অনুমোদন করুন"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: Tabulation Sheet / Examiner Marks Entry Sheet Print Modal */}
      {showTabulationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 space-y-5 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b pb-3 print:hidden">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Printer className="w-5 h-5 text-emerald-600" />
                  <span>পরীক্ষক মূল্যায়ন ও ট্যাবুলেশন শিট (Examiner Tabulation Sheet)</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  ভর্তি পরীক্ষার দিন পরীক্ষকদের হাতে দেওয়ার মতো প্রিন্ট কপি
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>প্রিন্ট করুন</span>
                </button>
                <button
                  onClick={() => setShowTabulationModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Content Area */}
            <div className="border border-slate-300 p-6 rounded-xl bg-white space-y-4 print:border-none print:p-0">
              <div className="text-center border-b pb-3 space-y-1">
                <h2 className="text-xl font-black text-slate-900">কওমি মাদরাসা শিক্ষা বোর্ড ও ভর্তি পরীক্ষা</h2>
                <p className="text-sm font-bold text-slate-700">ভর্তি পরীক্ষা — পরীক্ষক মূল্যায়ন ও ট্যাবুলেশন শিট</p>
                <div className="flex items-center justify-center gap-6 text-xs text-slate-600 pt-1 font-semibold">
                  <span>জামাত: {classFilter === "all" ? "সকল জামাত" : classes.find((c) => c.id === classFilter)?.name}</span>
                  <span>মোট পরীক্ষার্থী: {toBanglaNumber(filteredApps.length)} জন</span>
                  <span>তারিখ: ...........................</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse border border-slate-300">
                  <thead className="bg-slate-100 font-bold text-slate-800">
                    <tr>
                      <th className="border border-slate-300 p-2 text-center w-10">ক্রম</th>
                      <th className="border border-slate-300 p-2 text-center w-24">রোল নম্বর</th>
                      <th className="border border-slate-300 p-2">আবেদনকারীর নাম</th>
                      <th className="border border-slate-300 p-2">পিতার নাম</th>
                      <th className="border border-slate-300 p-2 text-center">আবেদনকৃত জামাত</th>
                      <th className="border border-slate-300 p-2 text-center w-16">লিখিত (৪০)</th>
                      <th className="border border-slate-300 p-2 text-center w-16">মৌখিক (৩০)</th>
                      <th className="border border-slate-300 p-2 text-center w-16">তিলাওয়াত (৩০)</th>
                      <th className="border border-slate-300 p-2 text-center w-16">মোট (১০০)</th>
                      <th className="border border-slate-300 p-2 text-center w-24">স্বাক্ষর ও মন্তব্য</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredApps.map((app, idx) => (
                      <tr key={app.id} className="border-b border-slate-200">
                        <td className="border border-slate-300 p-2 text-center font-mono">{toBanglaNumber(idx + 1)}</td>
                        <td className="border border-slate-300 p-2 text-center font-mono font-bold">{app.roll_number}</td>
                        <td className="border border-slate-300 p-2 font-bold text-slate-900">{app.applicant_name_bn}</td>
                        <td className="border border-slate-300 p-2 text-slate-700">{app.father_name}</td>
                        <td className="border border-slate-300 p-2 text-center">{app.target_class_name}</td>
                        <td className="border border-slate-300 p-2 text-center font-mono">
                          {app.test_evaluation?.written_marks ? toBanglaNumber(app.test_evaluation.written_marks) : ""}
                        </td>
                        <td className="border border-slate-300 p-2 text-center font-mono">
                          {app.test_evaluation?.oral_marks ? toBanglaNumber(app.test_evaluation.oral_marks) : ""}
                        </td>
                        <td className="border border-slate-300 p-2 text-center font-mono">
                          {app.test_evaluation?.quran_tilawat_marks ? toBanglaNumber(app.test_evaluation.quran_tilawat_marks) : ""}
                        </td>
                        <td className="border border-slate-300 p-2 text-center font-mono font-bold">
                          {app.test_evaluation?.total_marks ? toBanglaNumber(app.test_evaluation.total_marks) : ""}
                        </td>
                        <td className="border border-slate-300 p-2 text-center text-[10px] text-slate-400">
                          {app.test_evaluation?.evaluated_by || ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="pt-8 flex items-center justify-between text-xs text-slate-700 font-semibold">
                <div>
                  <div className="border-t border-slate-400 pt-1 w-36 text-center">প্রধান পরীক্ষকের স্বাক্ষর</div>
                </div>
                <div>
                  <div className="border-t border-slate-400 pt-1 w-36 text-center">নাজেমে তা'লীমাত (শিক্ষা সচিব)</div>
                </div>
                <div>
                  <div className="border-t border-slate-400 pt-1 w-36 text-center">মুহতামিম / প্রিন্সিপাল</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 7: Merit List Notice Board Sheet Print Modal */}
      {showMeritModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 space-y-5 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b pb-3 print:hidden">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Award className="w-5 h-5 text-indigo-600" />
                  <span>চূড়ান্ত মেধা তালিকা শিট (Notice Board Merit List)</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  নোটিশ বোর্ড ও ভর্তির ফলাফলের জন্য অফিসিয়াল প্রিন্ট কপি
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>প্রিন্ট করুন</span>
                </button>
                <button
                  onClick={() => setShowMeritModal(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Content Area */}
            <div className="border border-slate-300 p-6 rounded-xl bg-white space-y-4 print:border-none print:p-0">
              <div className="text-center border-b pb-3 space-y-1">
                <h2 className="text-xl font-black text-slate-900">ভর্তি পরীক্ষা — ফলাফল ও মেধা তালিকা</h2>
                <p className="text-sm font-bold text-indigo-700">নতুন শিক্ষাবর্ষে ভর্তির জন্য নির্বাচিত শিক্ষার্থীদের তালিকা</p>
                <div className="flex items-center justify-center gap-6 text-xs text-slate-600 pt-1 font-semibold">
                  <span>জামাত: {classFilter === "all" ? "সকল জামাত" : classes.find((c) => c.id === classFilter)?.name}</span>
                  <span>প্রকাশের তারিখ: {new Date().toLocaleDateString("bn-BD")}</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse border border-slate-300">
                  <thead className="bg-indigo-50 font-bold text-indigo-950">
                    <tr>
                      <th className="border border-slate-300 p-2 text-center w-16">মেধা ক্রম</th>
                      <th className="border border-slate-300 p-2 text-center w-24">পরীক্ষার রোল</th>
                      <th className="border border-slate-300 p-2">আবেদনকারীর নাম</th>
                      <th className="border border-slate-300 p-2">পিতার নাম</th>
                      <th className="border border-slate-300 p-2 text-center">জামাত</th>
                      <th className="border border-slate-300 p-2 text-center w-20">প্রাপ্ত নম্বর (১০০)</th>
                      <th className="border border-slate-300 p-2 text-center w-28">বর্তমান স্ট্যাটাস</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredApps
                      .slice()
                      .sort((a, b) => {
                        const rankA = a.test_evaluation?.merit_position || 9999;
                        const rankB = b.test_evaluation?.merit_position || 9999;
                        return rankA - rankB;
                      })
                      .map((app, idx) => (
                        <tr key={app.id} className="border-b border-slate-200">
                          <td className="border border-slate-300 p-2 text-center font-bold text-indigo-900">
                            {app.test_evaluation?.merit_position ? (
                              <span className="px-2 py-0.5 bg-indigo-100 rounded-md">
                                {toBanglaNumber(app.test_evaluation.merit_position)}
                              </span>
                            ) : (
                              toBanglaNumber(idx + 1)
                            )}
                          </td>
                          <td className="border border-slate-300 p-2 text-center font-mono font-bold">{app.roll_number}</td>
                          <td className="border border-slate-300 p-2 font-bold text-slate-900">{app.applicant_name_bn}</td>
                          <td className="border border-slate-300 p-2 text-slate-700">{app.father_name}</td>
                          <td className="border border-slate-300 p-2 text-center">{app.target_class_name}</td>
                          <td className="border border-slate-300 p-2 text-center font-mono font-bold">
                            {toBanglaNumber(app.test_evaluation?.total_marks || 0)}
                          </td>
                          <td className="border border-slate-300 p-2 text-center font-semibold">
                            {app.status === "CONFIRMED" ? (
                              <span className="text-emerald-700">ভর্তি নিশ্চিত</span>
                            ) : app.status === "MERIT_SELECTED" ? (
                              <span className="text-indigo-700 font-bold">উত্তীর্ণ (মেধাতালিকা)</span>
                            ) : app.status === "WAITING_LIST" ? (
                              <span className="text-amber-700">অপেক্ষমান</span>
                            ) : app.status === "REJECTED" ? (
                              <span className="text-rose-600">অনুপযুক্ত</span>
                            ) : (
                              <span className="text-slate-600">মূল্যায়নাধীন</span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              <div className="pt-8 flex items-center justify-between text-xs text-slate-700 font-semibold">
                <div>
                  <div className="border-t border-slate-400 pt-1 w-36 text-center">নাজেমে তা'লীমাত</div>
                </div>
                <div>
                  <div className="border-t border-slate-400 pt-1 w-36 text-center">মুহতামিম</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
