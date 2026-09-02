"use client";

import React, { useState } from "react";
import {
  StaffMember,
  StaffCategory,
  StaffDepartment,
  StaffDesignation,
  StaffStatus,
  STAFF_STATUS_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  LEAVE_TYPE_LABELS,
} from "@/lib/staff-management";
import {
  promoteStaffMember,
  transferStaffMember,
  changeStaffStatus,
  submitStaffLeaveRequest,
  reviewStaffLeaveRequest,
  processSalaryPayment,
  addStaffDocument,
  deleteStaffDocument,
  generateStaffIdCard,
} from "@/app/actions/staff";
import {
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Briefcase,
  DollarSign,
  FileText,
  Award,
  Layers,
  ShieldCheck,
  Clock,
  ChevronRight,
  TrendingUp,
  ArrowRightLeft,
  AlertTriangle,
  Plus,
  Trash2,
  Download,
  Printer,
  Edit,
  CheckCircle,
  XCircle,
  QrCode,
  FileBadge,
  Building,
} from "lucide-react";
import StaffFormModal from "./StaffFormModal";
import StaffIdCardModal from "./StaffIdCardModal";
import StaffCertificateGeneratorModal from "./StaffCertificateGeneratorModal";
import { toBanglaNumber } from "@/lib/numberToBangla";

interface StaffProfileViewProps {
  staff: StaffMember;
  categories?: StaffCategory[];
  departments?: StaffDepartment[];
  designations?: StaffDesignation[];
  madrasaInfo?: any;
  madrasaName?: string;
  onRefresh: () => void;
}

export default function StaffProfileView({
  staff,
  categories = [],
  departments = [],
  designations = [],
  madrasaInfo,
  madrasaName = "দারুল উলুম কওমিয়া মাদ্রাসা",
  onRefresh,
}: StaffProfileViewProps) {
  const [activeTab, setActiveTab] = useState<
    | "overview"
    | "employment"
    | "attendance"
    | "leave"
    | "salary"
    | "documents"
    | "responsibilities"
    | "idcard"
    | "certificates"
    | "audit"
  >("overview");

  // Modals state
  const [showEditModal, setShowEditModal] = useState(false);
  const [showIdCardModal, setShowIdCardModal] = useState(false);
  const [showCertModal, setShowCertModal] = useState(false);

  // Promotion / Transfer / Status modals
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState<any | null>(null);
  const [showDocModal, setShowDocModal] = useState(false);

  // Promotion Form State
  const [promoteDesignation, setPromoteDesignation] = useState(staff.employment.designation);
  const [promoteSalary, setPromoteSalary] = useState(staff.salary.basic_salary);
  const [promoteDate, setPromoteDate] = useState(new Date().toISOString().split("T")[0]);
  const [promoteReason, setPromoteReason] = useState("");
  const [isPromoting, setIsPromoting] = useState(false);

  // Transfer Form State
  const [transferDeptId, setTransferDeptId] = useState(staff.employment.department_id);
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split("T")[0]);
  const [transferReason, setTransferReason] = useState("");
  const [isTransferring, setIsTransferring] = useState(false);

  // Status Change State
  const [newStatus, setNewStatus] = useState<StaffStatus>(staff.employment.status);
  const [statusDate, setStatusDate] = useState(new Date().toISOString().split("T")[0]);
  const [statusReason, setStatusReason] = useState("");
  const [isChangingStatus, setIsChangingStatus] = useState(false);

  // Leave Form State
  const [leaveType, setLeaveType] = useState<any>("CASUAL");
  const [leaveStart, setLeaveStart] = useState(new Date().toISOString().split("T")[0]);
  const [leaveEnd, setLeaveEnd] = useState(new Date().toISOString().split("T")[0]);
  const [leaveDays, setLeaveDays] = useState(1);
  const [leaveReason, setLeaveReason] = useState("");
  const [isSubmittingLeave, setIsSubmittingLeave] = useState(false);

  // Payment Form State
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [paymentTxRef, setPaymentTxRef] = useState("");
  const [paymentRemarks, setPaymentRemarks] = useState("");
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Document Upload State
  const [docTitle, setDocTitle] = useState("");
  const [docType, setDocType] = useState<any>("NID");
  const [docUrl, setDocUrl] = useState("");
  const [docExpiry, setDocExpiry] = useState("");
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);

  const statusConfig = STAFF_STATUS_LABELS[staff.employment.status] || STAFF_STATUS_LABELS.ACTIVE;

  // Handlers
  const handlePromoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPromoting(true);
    const res = await promoteStaffMember({
      staffId: staff.id,
      newDesignation: promoteDesignation,
      newSalary: Number(promoteSalary),
      effectiveDate: promoteDate,
      reason: promoteReason || "নিয়মিত পদোন্নতি",
    });
    setIsPromoting(false);
    if (res.success) {
      setShowPromoteModal(false);
      onRefresh();
    } else {
      alert(res.error);
    }
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsTransferring(true);
    const deptObj = departments.find((d) => d.id === transferDeptId);
    const res = await transferStaffMember({
      staffId: staff.id,
      newDepartmentId: transferDeptId,
      newDepartmentName: deptObj?.name || "বিভাগ",
      effectiveDate: transferDate,
      reason: transferReason || "প্রশাসনিক স্থানান্তর",
    });
    setIsTransferring(false);
    if (res.success) {
      setShowTransferModal(false);
      onRefresh();
    } else {
      alert(res.error);
    }
  };

  const handleStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsChangingStatus(true);
    const res = await changeStaffStatus({
      staffId: staff.id,
      status: newStatus,
      effectiveDate: statusDate,
      reason: statusReason || "প্রশাসনিক সিদ্ধান্ত",
    });
    setIsChangingStatus(false);
    if (res.success) {
      setShowStatusModal(false);
      onRefresh();
    } else {
      alert(res.error);
    }
  };

  const handleLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingLeave(true);
    const res = await submitStaffLeaveRequest({
      staffId: staff.id,
      leaveType,
      leaveTypeNameBn: LEAVE_TYPE_LABELS[leaveType] || "ছুটি",
      startDate: leaveStart,
      endDate: leaveEnd,
      totalDays: Number(leaveDays),
      reason: leaveReason || "ব্যক্তিগত ছুটির আবেদন",
    });
    setIsSubmittingLeave(false);
    if (res.success) {
      setShowLeaveModal(false);
      onRefresh();
    } else {
      alert(res.error);
    }
  };

  const handleProcessPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showPayModal) return;
    setIsProcessingPayment(true);
    const res = await processSalaryPayment({
      recordId: showPayModal.id,
      paymentMethod,
      transactionRef: paymentTxRef,
      remarks: paymentRemarks,
    });
    setIsProcessingPayment(false);
    if (res.success) {
      setShowPayModal(null);
      onRefresh();
    } else {
      alert(res.error);
    }
  };

  const handleAddDocSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docTitle || !docUrl) {
      alert("শিরোনাম এবং ফাইলের লিঙ্ক দেওয়া আবশ্যক।");
      return;
    }
    setIsUploadingDoc(true);
    const res = await addStaffDocument({
      staffId: staff.id,
      title: docTitle,
      documentType: docType,
      fileUrl: docUrl,
      expiryDate: docExpiry || undefined,
    });
    setIsUploadingDoc(false);
    if (res.success) {
      setShowDocModal(false);
      setDocTitle("");
      setDocUrl("");
      onRefresh();
    } else {
      alert(res.error);
    }
  };

  const handleDeleteDoc = async (docId: string) => {
    if (!confirm("আপনি কি নিশ্চিত যে আপনি এই ডকুমেন্টটি মুছে ফেলতে চান?")) return;
    const res = await deleteStaffDocument(staff.id, docId);
    if (res.success) {
      onRefresh();
    } else {
      alert(res.error);
    }
  };

  const handleReissueIdCard = async () => {
    if (!confirm("আপনি কি নতুন ডিজিটাল আইডি কার্ড রি-ইস্যু করতে চান?")) return;
    const res = await generateStaffIdCard(staff.id);
    if (res.success) {
      alert("আইডি কার্ড সফলভাবে রি-ইস্যু করা হয়েছে।");
      onRefresh();
    } else {
      alert(res.error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-2xl border-2 border-emerald-500 overflow-hidden bg-slate-50 flex items-center justify-center text-slate-400 font-bold text-2xl shrink-0 shadow-xs">
              {staff.personal.photo_url ? (
                <img
                  src={staff.personal.photo_url}
                  alt={staff.personal.first_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{staff.personal.first_name.charAt(0)}</span>
              )}
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                  {staff.personal.full_name_bn || `${staff.personal.first_name} ${staff.personal.last_name}`}
                </h1>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}
                >
                  {statusConfig.label}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                  {staff.staff_id_code}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-600">
                <span className="font-semibold text-emerald-800 flex items-center gap-1">
                  <Briefcase className="w-3.5 h-3.5" />
                  {staff.employment.designation}
                </span>
                <span className="text-slate-400">•</span>
                <span className="text-slate-600 flex items-center gap-1">
                  <Building className="w-3.5 h-3.5" />
                  {staff.employment.department_name}
                </span>
                <span className="text-slate-400">•</span>
                <span className="text-slate-500 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  যোগদান: {toBanglaNumber(staff.employment.joining_date)}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-emerald-600" />
                  {staff.contact.phone || "ফোন নেই"}
                </span>
                {staff.contact.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    {staff.contact.email}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <button
              onClick={() => setShowEditModal(true)}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Edit className="w-3.5 h-3.5" />
              <span>সম্পাদনা</span>
            </button>

            <button
              onClick={() => setShowIdCardModal(true)}
              className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border border-indigo-200"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>ডিজিটাল আইডি</span>
            </button>

            <button
              onClick={() => setShowCertModal(true)}
              className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border border-emerald-200"
            >
              <FileBadge className="w-3.5 h-3.5" />
              <span>সনদ ও নিয়োগপত্র</span>
            </button>

            <button
              onClick={() => setShowStatusModal(true)}
              className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border border-amber-200"
            >
              <span>স্ট্যাটাস পরিবর্তন</span>
            </button>
          </div>
        </div>
      </div>

      {/* Profile Tabs Navigation */}
      <div className="flex items-center gap-1 bg-white p-2 rounded-2xl shadow-xs border border-slate-200/80 overflow-x-auto text-xs font-semibold">
        <button
          onClick={() => setActiveTab("overview")}
          className={`px-3.5 py-2 rounded-xl transition whitespace-nowrap cursor-pointer ${
            activeTab === "overview" ? "bg-emerald-700 text-white shadow-xs" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          সারসংক্ষেপ
        </button>
        <button
          onClick={() => setActiveTab("employment")}
          className={`px-3.5 py-2 rounded-xl transition whitespace-nowrap cursor-pointer ${
            activeTab === "employment" ? "bg-emerald-700 text-white shadow-xs" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          কর্মসংস্থান ও পদোন্নতি
        </button>
        <button
          onClick={() => setActiveTab("salary")}
          className={`px-3.5 py-2 rounded-xl transition whitespace-nowrap cursor-pointer ${
            activeTab === "salary" ? "bg-emerald-700 text-white shadow-xs" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          বেতন ও পারিশ্রমিক
        </button>
        <button
          onClick={() => setActiveTab("leave")}
          className={`px-3.5 py-2 rounded-xl transition whitespace-nowrap cursor-pointer ${
            activeTab === "leave" ? "bg-emerald-700 text-white shadow-xs" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          ছুটি ব্যবস্থাপনা
        </button>
        <button
          onClick={() => setActiveTab("documents")}
          className={`px-3.5 py-2 rounded-xl transition whitespace-nowrap cursor-pointer ${
            activeTab === "documents" ? "bg-emerald-700 text-white shadow-xs" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          কাগজপত্র ও সনদ ({staff.documents?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab("responsibilities")}
          className={`px-3.5 py-2 rounded-xl transition whitespace-nowrap cursor-pointer ${
            activeTab === "responsibilities" ? "bg-emerald-700 text-white shadow-xs" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          দায়িত্ব ও ক্লাস
        </button>
        <button
          onClick={() => setActiveTab("idcard")}
          className={`px-3.5 py-2 rounded-xl transition whitespace-nowrap cursor-pointer ${
            activeTab === "idcard" ? "bg-emerald-700 text-white shadow-xs" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          ডিজিটাল আইডি
        </button>
        <button
          onClick={() => setActiveTab("audit")}
          className={`px-3.5 py-2 rounded-xl transition whitespace-nowrap cursor-pointer ${
            activeTab === "audit" ? "bg-emerald-700 text-white shadow-xs" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          কার্যক্রম ইতিহাস
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Personal & Contact */}
          <div className="space-y-6 lg:col-span-2">
            {/* Personal Details Card */}
            <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/80 space-y-4">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
                <User className="w-4 h-4 text-emerald-700" />
                <span>ব্যক্তিগত তথ্যাবলী (Personal Information)</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">পিতার নাম</span>
                  <span className="font-semibold text-slate-800">{staff.personal.father_name || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">মাতার নাম</span>
                  <span className="font-semibold text-slate-800">{staff.personal.mother_name || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">স্ত্রী/স্বামীর নাম</span>
                  <span className="font-semibold text-slate-800">{staff.personal.spouse_name || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">জন্ম তারিখ</span>
                  <span className="font-semibold text-slate-800">
                    {staff.personal.date_of_birth ? toBanglaNumber(staff.personal.date_of_birth) : "—"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">লিঙ্গ</span>
                  <span className="font-semibold text-slate-800">
                    {staff.personal.gender === "FEMALE" ? "মহিলা" : "পুরুষ"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">রক্তের গ্রুপ</span>
                  <span className="font-bold text-rose-600">{staff.personal.blood_group || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">জাতীয় পরিচয়পত্র / পাসপোর্ট নং</span>
                  <span className="font-mono font-semibold text-slate-800">{staff.personal.nid_number || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">বৈবাহিক অবস্থা</span>
                  <span className="font-semibold text-slate-800">
                    {staff.personal.marital_status === "MARRIED" ? "বিবাহিত" : "অবিবাহিত"}
                  </span>
                </div>
              </div>
            </div>

            {/* Academic Info Card */}
            <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/80 space-y-4">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
                <Award className="w-4 h-4 text-emerald-700" />
                <span>শিক্ষাগত যোগ্যতা ও সনদ (Academic & Qualifications)</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">সর্বোচ্চ যোগ্যতা</span>
                  <span className="font-semibold text-slate-800">{staff.academic?.highest_qualification || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">প্রতিষ্ঠান / বোর্ড</span>
                  <span className="font-semibold text-slate-800">{staff.academic?.madrasa_or_university || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">সনদ ও প্রাপ্ত বিভাগ</span>
                  <span className="font-semibold text-slate-800">{staff.academic?.degree_or_sanad || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">হিফজুল কুরআন</span>
                  <span className="font-semibold text-emerald-700">
                    {staff.academic?.hifz_completed ? "হ্যাঁ (হাফেজে কুরআন)" : "না"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">বিশেষত্ব</span>
                  <span className="font-semibold text-slate-800">{staff.academic?.specialization || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">ক্বিরাআত সনদ</span>
                  <span className="font-semibold text-slate-800">{staff.academic?.qiraat_degree || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">পূর্ববর্তী অভিজ্ঞতা</span>
                  <span className="font-semibold text-slate-800">
                    {staff.academic?.teaching_experience_years ? `${toBanglaNumber(staff.academic.teaching_experience_years.toString())} বছর` : "—"}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">পূর্ববর্তী প্রতিষ্ঠান</span>
                  <span className="font-semibold text-slate-800">{staff.academic?.previous_institution || "—"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Contact, Emergency & Salary Summary */}
          <div className="space-y-6">
            {/* Contact & Address Card */}
            <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/80 space-y-4">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-700" />
                <span>যোগাযোগ ও ঠিকানা</span>
              </h3>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">প্রধান মোবাইল নম্বর</span>
                  <span className="font-bold text-slate-800 text-sm">{staff.contact.phone || "—"}</span>
                </div>
                {staff.contact.alt_phone && (
                  <div>
                    <span className="text-slate-400 block text-[11px]">বিকল্প ফোন</span>
                    <span className="font-semibold text-slate-800">{staff.contact.alt_phone}</span>
                  </div>
                )}
                {staff.contact.email && (
                  <div>
                    <span className="text-slate-400 block text-[11px]">ইমেইল</span>
                    <span className="font-semibold text-slate-800">{staff.contact.email}</span>
                  </div>
                )}
                <div>
                  <span className="text-slate-400 block text-[11px]">বর্তমান ঠিকানা</span>
                  <span className="text-slate-700 leading-snug block">{staff.contact.present_address || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">স্থায়ী ঠিকানা</span>
                  <span className="text-slate-700 leading-snug block">{staff.contact.permanent_address || "—"}</span>
                </div>
              </div>

              {/* Emergency Contact */}
              <div className="p-3.5 bg-rose-50 rounded-xl border border-rose-200/70 text-xs space-y-1">
                <span className="font-bold text-rose-900 block text-[11px]">জরুরি যোগাযোগ:</span>
                <p className="font-semibold text-slate-800">
                  {staff.contact.emergency_contact_name || "—"} ({staff.contact.emergency_contact_relation || "অভিভাবক"})
                </p>
                <p className="text-rose-700 font-bold">{staff.contact.emergency_contact_phone || "—"}</p>
              </div>
            </div>

            {/* Quick Salary Card */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-6 shadow-xs space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>মাসিক বেতন কাঠামো</span>
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <span className="text-xs text-slate-400">সর্বমোট নেট বেতন</span>
                <h3 className="text-2xl font-bold text-emerald-400">
                  ৳{toBanglaNumber(staff.salary.net_salary.toString())}
                </h3>
              </div>
              <div className="text-[11px] text-slate-300 border-t border-slate-700 pt-2 flex justify-between">
                <span>মূল বেতন: ৳{toBanglaNumber(staff.salary.basic_salary.toString())}</span>
                <span>মাধ্যম: {staff.salary.payment_method || "CASH"}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: EMPLOYMENT & PROMOTION HISTORY */}
      {activeTab === "employment" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80">
            <div>
              <h3 className="text-sm font-bold text-slate-800">কর্মসংস্থান ও পদোন্নতি ব্যবস্থাপনা</h3>
              <p className="text-xs text-slate-500">পদবী পরিবর্তন, বিভাগ স্থানান্তর ও চাকরির ইতিহাস রেকর্ড</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPromoteModal(true)}
                className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>পদোন্নতি দিন (Promote)</span>
              </button>
              <button
                onClick={() => setShowTransferModal(true)}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>বিভাগ বদলি (Transfer)</span>
              </button>
            </div>
          </div>

          {/* Timeline of History */}
          <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/80 space-y-4">
            <h4 className="text-sm font-bold text-slate-900">ইতিহাস ও ট্র্যাক রেকর্ড (Employment Timeline)</h4>

            <div className="space-y-4 pt-2">
              {(staff.employment_history || []).map((hist, idx) => (
                <div key={hist.id || idx} className="flex items-start gap-3 border-l-2 border-emerald-600 pl-4 py-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-600 -ml-[21px] mt-1 ring-4 ring-white" />
                  <div className="flex-1 space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">
                        {hist.type === "JOINED" && "মাদ্রাসায় যোগদান"}
                        {hist.type === "PROMOTION" && "পদোন্নতি (Promotion)"}
                        {hist.type === "TRANSFER" && "বিভাগ বদলি (Department Transfer)"}
                        {hist.type === "STATUS_CHANGE" && "স্ট্যাটাস পরিবর্তন"}
                        {hist.type === "RESIGNATION" && "ইস্তফা প্রদান (Resignation)"}
                        {hist.type === "TERMINATION" && "অব্যাহতি (Termination)"}
                        {hist.type === "REACTIVATED" && "পুনরায় সক্রিয়"}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono">
                        কার্যকর: {toBanglaNumber(hist.effective_date)}
                      </span>
                    </div>

                    <p className="text-slate-700">
                      {hist.new_designation && <span className="font-semibold text-emerald-800">{hist.new_designation}</span>}
                      {hist.new_department && <span className="text-slate-500"> • বিভাগ: {hist.new_department}</span>}
                    </p>

                    {hist.reason && <p className="text-slate-500 italic text-[11px]">কারণ: {hist.reason}</p>}
                    <p className="text-[10px] text-slate-400">নথিভুক্ত করেছেন: {hist.changed_by || "অ্যাডমিন"}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SALARY & PAYROLL */}
      {activeTab === "salary" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 space-y-1">
              <span className="text-xs text-slate-500">মূল বেতন (Basic Salary)</span>
              <h3 className="text-xl font-bold text-slate-800">
                ৳{toBanglaNumber(staff.salary.basic_salary.toString())}
              </h3>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 space-y-1">
              <span className="text-xs text-slate-500">মোট মাসিক ভাতা (Allowances)</span>
              <h3 className="text-xl font-bold text-emerald-700">
                +৳{toBanglaNumber(Object.values(staff.salary.allowances || {}).reduce((s, a) => s + Number(a || 0), 0).toString())}
              </h3>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 space-y-1">
              <span className="text-xs text-slate-500">মোট মাসিক কর্তন (Deductions)</span>
              <h3 className="text-xl font-bold text-rose-600">
                -৳{toBanglaNumber(Object.values(staff.salary.deductions || {}).reduce((s, d) => s + Number(d || 0), 0).toString())}
              </h3>
            </div>
          </div>

          {/* Salary Breakdown Table */}
          <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/80 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900">বর্তমান বেতন কাঠামোর বিবরণ</h4>
              <button
                onClick={() => setShowEditModal(true)}
                className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold cursor-pointer"
              >
                কাঠামো পরিবর্তন করুন →
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs pt-2">
              <div className="space-y-2">
                <span className="font-bold text-emerald-900 block pb-1 border-b border-emerald-100">ভাতাসমূহ:</span>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-600">বাড়ি ভাড়া ভাতা</span>
                  <span className="font-semibold">৳{toBanglaNumber((staff.salary.allowances?.housing || 0).toString())}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-600">খাবার ভাতা</span>
                  <span className="font-semibold">৳{toBanglaNumber((staff.salary.allowances?.food || 0).toString())}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-600">যাতায়াত ভাতা</span>
                  <span className="font-semibold">৳{toBanglaNumber((staff.salary.allowances?.transport || 0).toString())}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-600">চিকিৎসা ও অন্যান্য</span>
                  <span className="font-semibold">৳{toBanglaNumber((staff.salary.allowances?.medical || 0).toString())}</span>
                </div>
              </div>

              <div className="space-y-2">
                <span className="font-bold text-rose-900 block pb-1 border-b border-rose-100">কর্তনসমূহ:</span>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-600">অগ্রিম গ্রহণ (Advance)</span>
                  <span className="font-semibold text-rose-600">৳{toBanglaNumber((staff.salary.deductions?.advance || 0).toString())}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-600">ঋণ কিস্তি (Loan)</span>
                  <span className="font-semibold text-rose-600">৳{toBanglaNumber((staff.salary.deductions?.loan || 0).toString())}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-600">অনুপস্থিতি কর্তন</span>
                  <span className="font-semibold text-rose-600">৳{toBanglaNumber((staff.salary.deductions?.absence || 0).toString())}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-600">অন্যান্য কর্তন</span>
                  <span className="font-semibold text-rose-600">৳{toBanglaNumber((staff.salary.deductions?.other || 0).toString())}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: LEAVE MANAGEMENT */}
      {activeTab === "leave" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80">
            <div>
              <h3 className="text-sm font-bold text-slate-800">ছুটি ও ছুটির আবেদন</h3>
              <p className="text-xs text-slate-500">ছুটির ব্যালেন্স ও অনুমোদন হিসেব</p>
            </div>
            <button
              onClick={() => setShowLeaveModal(true)}
              className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>ছুটির আবেদন দাখিল করুন</span>
            </button>
          </div>

          {/* Leave Balances Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 space-y-2">
              <span className="text-xs font-bold text-slate-800">নৈমিত্তিক ছুটি (Casual)</span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold text-emerald-700">
                  {toBanglaNumber((staff.leave_balance?.casual_allocated || 10) - (staff.leave_balance?.casual_used || 0))} দিন
                </span>
                <span className="text-xs text-slate-400">
                  ব্যবহৃত: {toBanglaNumber(staff.leave_balance?.casual_used || 0)} / {toBanglaNumber(staff.leave_balance?.casual_allocated || 10)}
                </span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 space-y-2">
              <span className="text-xs font-bold text-slate-800">চিকিৎসা ছুটি (Sick Leave)</span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold text-blue-700">
                  {toBanglaNumber((staff.leave_balance?.sick_allocated || 14) - (staff.leave_balance?.sick_used || 0))} দিন
                </span>
                <span className="text-xs text-slate-400">
                  ব্যবহৃত: {toBanglaNumber(staff.leave_balance?.sick_used || 0)} / {toBanglaNumber(staff.leave_balance?.sick_allocated || 14)}
                </span>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 space-y-2">
              <span className="text-xs font-bold text-slate-800">বার্ষিক ছুটি (Annual Leave)</span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold text-purple-700">
                  {toBanglaNumber((staff.leave_balance?.annual_allocated || 20) - (staff.leave_balance?.annual_used || 0))} দিন
                </span>
                <span className="text-xs text-slate-400">
                  ব্যবহৃত: {toBanglaNumber(staff.leave_balance?.annual_used || 0)} / {toBanglaNumber(staff.leave_balance?.annual_allocated || 20)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: DOCUMENTS & FILES */}
      {activeTab === "documents" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80">
            <div>
              <h3 className="text-sm font-bold text-slate-800">কাগজপত্র, সনদ ও ডকুমেন্টস</h3>
              <p className="text-xs text-slate-500">এনআইডি, শিক্ষাগত সনদ, চুক্তিপত্র ও ফাইল আপলোড</p>
            </div>
            <button
              onClick={() => setShowDocModal(true)}
              className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>নতুন ডকুমেন্ট যুক্ত করুন</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {(staff.documents || []).length === 0 ? (
              <div className="col-span-full bg-white p-12 rounded-2xl text-center border border-slate-200/80 space-y-2">
                <FileText className="w-8 h-8 text-slate-300 mx-auto" />
                <h4 className="text-sm font-bold text-slate-700">কোনো ডকুমেন্ট যুক্ত করা হয়নি</h4>
                <p className="text-xs text-slate-500">উপরে 'নতুন ডকুমেন্ট যুক্ত করুন' বাটনে ক্লিক করে ফাইল যোগ করুন।</p>
              </div>
            ) : (
              (staff.documents || []).map((doc) => (
                <div key={doc.id} className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200/80 space-y-3 flex flex-col justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                        {doc.document_type}
                      </span>
                      <button
                        onClick={() => handleDeleteDoc(doc.id)}
                        className="text-slate-400 hover:text-rose-600 transition cursor-pointer p-1"
                        title="মুছে ফেলুন"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <h4 className="font-bold text-slate-900 text-xs line-clamp-1">{doc.title}</h4>
                    {doc.expiry_date && (
                      <p className="text-[11px] text-amber-700 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        মেয়াদ: {toBanglaNumber(doc.expiry_date)}
                      </p>
                    )}
                  </div>

                  <a
                    href={doc.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2 bg-slate-50 hover:bg-emerald-50 text-emerald-800 text-xs font-semibold rounded-xl border border-slate-200 flex items-center justify-center gap-1.5 transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>ডকুমেন্ট দেখুন / ডাউনলোড</span>
                  </a>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 6: RESPONSIBILITIES & SUBJECTS */}
      {activeTab === "responsibilities" && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/80 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-700" />
              <span>নিযুক্ত অতিরিক্ত দায়িত্বসমূহ (Assigned Roles & Responsibilities)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1">
              {(staff.responsibilities || []).length === 0 ? (
                <p className="text-xs text-slate-500">কোনো অতিরিক্ত দায়িত্ব নির্ধারিত নেই।</p>
              ) : (
                (staff.responsibilities || []).map((resp, i) => (
                  <div key={i} className="flex items-center gap-2 p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-950">
                    <CheckCircle className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>{resp}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: DIGITAL ID CARD */}
      {activeTab === "idcard" && (
        <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/80 text-center space-y-4">
          <div className="max-w-md mx-auto space-y-2">
            <ShieldCheck className="w-10 h-10 text-emerald-700 mx-auto" />
            <h3 className="text-base font-bold text-slate-800">ডিজিটাল স্টাফ আইডি কার্ড ও কিউআর সিস্টেম</h3>
            <p className="text-xs text-slate-500">
              অফিসিয়াল স্মার্ট আইডি কার্ড দেখতে ও প্রিন্ট করতে নিচের বাটনে ক্লিক করুন।
            </p>
            <div className="pt-2 flex justify-center gap-3">
              <button
                onClick={() => setShowIdCardModal(true)}
                className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-xl text-xs flex items-center gap-2 transition shadow-xs cursor-pointer"
              >
                <QrCode className="w-4 h-4" />
                <span>আইডি কার্ড প্রিভিউ ও প্রিন্ট</span>
              </button>
              <button
                onClick={handleReissueIdCard}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-xl text-xs transition cursor-pointer"
              >
                পুনরায় ইস্যু করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 8: AUDIT LOG */}
      {activeTab === "audit" && (
        <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/80 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-700" />
            <span>কার্যক্রম ও অডিট লগ (Activity & Audit History)</span>
          </h3>

          <div className="space-y-3 pt-2">
            {(staff.audit_logs || []).length === 0 ? (
              <p className="text-xs text-slate-500">কোনো কার্যক্রম পাওয়া যায়নি।</p>
            ) : (
              (staff.audit_logs || []).map((log) => (
                <div key={log.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 text-xs flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="font-bold text-slate-800 block">{log.action}</span>
                    <span className="text-slate-600 text-[11px]">{log.details}</span>
                  </div>
                  <div className="text-right text-[10px] text-slate-400">
                    <span className="block">{log.user_email || "অ্যাডমিন"}</span>
                    <span>{log.created_at.split("T")[0]}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* MODALS */}
      {showEditModal && (
        <StaffFormModal
          staff={staff}
          categories={categories}
          departments={departments}
          designations={designations}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            setShowEditModal(false);
            onRefresh();
          }}
        />
      )}

      {showIdCardModal && (
        <StaffIdCardModal
          staff={staff}
          madrasaInfo={madrasaInfo}
          madrasaName={madrasaInfo?.name || madrasaName}
          madrasaPhone={madrasaInfo?.phone}
          madrasaAddress={madrasaInfo?.address}
          onClose={() => setShowIdCardModal(false)}
        />
      )}

      {showCertModal && (
        <StaffCertificateGeneratorModal
          staff={staff}
          madrasaInfo={madrasaInfo}
          madrasaName={madrasaInfo?.name || madrasaName}
          madrasaPhone={madrasaInfo?.phone}
          madrasaAddress={madrasaInfo?.address}
          onClose={() => setShowCertModal(false)}
        />
      )}

      {/* Promotion Modal */}
      {showPromoteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-sm text-slate-800">পদোন্নতি প্রদান (Staff Promotion)</h3>
              <button onClick={() => setShowPromoteModal(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePromoteSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">নতুন পদবী (New Designation)</label>
                <input
                  type="text"
                  required
                  value={promoteDesignation}
                  onChange={(e) => setPromoteDesignation(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">সংশোধিত মূল বেতন (Basic Salary ৳)</label>
                <input
                  type="number"
                  min={0}
                  value={promoteSalary}
                  onChange={(e) => setPromoteSalary(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">কার্যকরের তারিখ</label>
                <input
                  type="date"
                  value={promoteDate}
                  onChange={(e) => setPromoteDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">পদোন্নতির কারণ ও মন্তব্য</label>
                <textarea
                  rows={2}
                  value={promoteReason}
                  onChange={(e) => setPromoteReason(e.target.value)}
                  placeholder="যেমন: বিশেষ কর্মদক্ষতার কারণে..."
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPromoteModal(false)}
                  className="px-4 py-2 bg-slate-100 rounded-xl font-semibold text-slate-700"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isPromoting}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-semibold shadow-xs"
                >
                  {isPromoting ? "সংরক্ষণ হচ্ছে..." : "পদোন্নতি নিশ্চিত করুন"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Status Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-sm text-slate-800">স্ট্যাটাস পরিবর্তন (Change Status)</h3>
              <button onClick={() => setShowStatusModal(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleStatusSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">নতুন স্ট্যাটাস</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as StaffStatus)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                >
                  {Object.entries(STAFF_STATUS_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold block mb-1">কার্যকরের তারিখ</label>
                <input
                  type="date"
                  value={statusDate}
                  onChange={(e) => setStatusDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">কারণ / বিবরণ</label>
                <textarea
                  rows={2}
                  required
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  placeholder="স্ট্যাটাস পরিবর্তনের যৌক্তিক কারণ..."
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowStatusModal(false)}
                  className="px-4 py-2 bg-slate-100 rounded-xl font-semibold text-slate-700"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isChangingStatus}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-semibold shadow-xs"
                >
                  {isChangingStatus ? "সংরক্ষণ হচ্ছে..." : "স্ট্যাটাস পরিবর্তন করুন"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Document Upload Modal */}
      {showDocModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-sm text-slate-800">নতুন ডকুমেন্ট যুক্ত করুন</h3>
              <button onClick={() => setShowDocModal(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddDocSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">ডকুমেন্টের শিরোনাম</label>
                <input
                  type="text"
                  required
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  placeholder="উদা: জাতীয় পরিচয়পত্র স্ক্যান কপি"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">ডকুমেন্টের ধরন</label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                >
                  <option value="NID">জাতীয় পরিচয়পত্র (NID)</option>
                  <option value="CERTIFICATE">শিক্ষাগত সনদপত্র</option>
                  <option value="EXPERIENCE">অভিজ্ঞতা সনদ</option>
                  <option value="APPOINTMENT_LETTER">নিয়োগপত্র</option>
                  <option value="CONTRACT">চুক্তিপত্র</option>
                  <option value="PHOTO">ছবি</option>
                  <option value="OTHER">অন্যান্য</option>
                </select>
              </div>

              <div>
                <label className="font-semibold block mb-1">ফাইলের লিঙ্ক / URL</label>
                <input
                  type="text"
                  required
                  value={docUrl}
                  onChange={(e) => setDocUrl(e.target.value)}
                  placeholder="https://... অথবা ড্রাইভ লিঙ্ক"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">মেয়াদ উত্তীর্ণের তারিখ (যদি থাকে)</label>
                <input
                  type="date"
                  value={docExpiry}
                  onChange={(e) => setDocExpiry(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDocModal(false)}
                  className="px-4 py-2 bg-slate-100 rounded-xl font-semibold text-slate-700"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isUploadingDoc}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-semibold shadow-xs"
                >
                  {isUploadingDoc ? "সংরক্ষণ হচ্ছে..." : "ডকুমেন্ট সংরক্ষণ করুন"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
