"use client";

import { useState, useEffect, useTransition } from "react";
import {
  StudentCertificate,
  CertificateTypeConfig,
  CertificateTemplateConfig,
  CertificateAuditLog,
} from "@/lib/certificates";
import {
  issueStudentCertificate,
  bulkGenerateCertificates,
  approveCertificate,
  revokeCertificate,
  reissueCertificate,
  getCertificatesData,
} from "@/app/actions/certificates";
import CertificateDocumentView from "@/app/components/CertificateDocumentView";
import {
  Award,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Printer,
  Eye,
  X,
  FileText,
  Users,
  ShieldCheck,
  History,
  Check,
  Send,
  Sparkles,
} from "lucide-react";

interface CertificateClientProps {
  selectedStudent: any;
  certificateType: string;
  madrasaInfo: any;
  students: any[];
  classes: any[];
  exams: any[];
  initialStudentId?: string;
  initialCertData: {
    certificates: StudentCertificate[];
    types: CertificateTypeConfig[];
    templates: CertificateTemplateConfig[];
    auditLogs: CertificateAuditLog[];
    stats: { total: number; issued: number; pending: number; revoked: number; reissued: number };
  };
}

export default function CertificateClient({
  selectedStudent,
  certificateType,
  madrasaInfo,
  students,
  classes,
  exams,
  initialStudentId,
  initialCertData,
}: CertificateClientProps) {
  const [activeTab, setActiveTab] = useState<"list" | "create" | "bulk" | "audit">("list");
  const [isPending, startTransition] = useTransition();

  // Master State
  const [certData, setCertData] = useState(initialCertData);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState("ALL");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("ALL");

  // Selected for View / Print Modal
  const [viewingCert, setViewingCert] = useState<StudentCertificate | null>(null);

  // Revoke Modal State
  const [revokingCert, setRevokingCert] = useState<StudentCertificate | null>(null);
  const [revokeReason, setRevokeReason] = useState("");

  // Reissue Modal State
  const [reissuingCert, setReissuingCert] = useState<StudentCertificate | null>(null);
  const [reissueReason, setReissueReason] = useState("");

  // Single Issue Form State
  const [formStudentId, setFormStudentId] = useState(initialStudentId || selectedStudent?.id || (students[0]?.id || ""));
  const [studentSearchText, setStudentSearchText] = useState("");

  // Sync initial student if students array loaded after mount
  useEffect(() => {
    if (!formStudentId && students && students.length > 0) {
      setFormStudentId(students[0].id);
    }
  }, [students, formStudentId]);
  const [formTypeId, setFormTypeId] = useState(certificateType || certData.types[0]?.id || "char_cert");
  const [formTemplateId, setFormTemplateId] = useState(certData.templates[0]?.id || "classic");
  const [formPurpose, setFormPurpose] = useState("উচ্চশিক্ষা / চাকরি / অফিশিয়াল প্রয়োজন");
  const [formStatement, setFormStatement] = useState("");
  const [formIssueDate, setFormIssueDate] = useState(new Date().toISOString().split("T")[0]);
  const [formExpiryDate, setFormExpiryDate] = useState("");

  // Custom Category Fields
  const [formDuesStatus, setFormDuesStatus] = useState<"CLEARED" | "HAS_DUES">("CLEARED");
  const [formDuesAmount, setFormDuesAmount] = useState<number>(0);
  const [formConductGrade, setFormConductGrade] = useState("উত্তম");
  const [formReasonForLeaving, setFormReasonForLeaving] = useState("পড়াশোনা সমাপ্তি");
  const [formLastAttendance, setFormLastAttendance] = useState(new Date().toISOString().split("T")[0]);

  // Exam Result
  const [formExamTitle, setFormExamTitle] = useState("");
  const [formGpa, setFormGpa] = useState("5.00");
  const [formGrade, setFormGrade] = useState("A+");
  const [formPosition, setFormPosition] = useState("১ম");

  // Signatures
  const [formMohtamim, setFormMohtamim] = useState(true);
  const [formPrincipal, setFormPrincipal] = useState(true);
  const [formTeacher, setFormTeacher] = useState(true);
  const [formSeal, setFormSeal] = useState(true);

  // Bulk Generator Form State
  const [bulkClassId, setBulkClassId] = useState(classes[0]?.id || "ALL");
  const [bulkTypeId, setBulkTypeId] = useState(certData.types[0]?.id || "char_cert");
  const [bulkTemplateId, setBulkTemplateId] = useState("classic");
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);

  // Refresh certificates list from server
  const refreshData = async () => {
    const fresh = await getCertificatesData();
    setCertData(fresh);
  };

  // Selected Student Details for Form
  const currentStudentObj = students.find((s) => s.id === formStudentId) || selectedStudent;
  const currentTypeObj = certData.types.find((t) => t.id === formTypeId) || certData.types[0];

  // Handle Single Issue Form Submit
  const handleIssueSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formStudentId) {
      alert("অনুগ্রহ করে একজন শিক্ষার্থী নির্বাচন করুন।");
      return;
    }

    startTransition(async () => {
      const res = await issueStudentCertificate({
        student_id: formStudentId,
        certificate_type_id: formTypeId,
        template_id: formTemplateId,
        purpose: formPurpose,
        additional_statement: formStatement,
        issue_date: formIssueDate,
        expiry_date: formExpiryDate || undefined,
        dues_status: formDuesStatus,
        dues_amount: formDuesAmount,
        conduct_grade: formConductGrade,
        reason_for_leaving: formReasonForLeaving,
        last_attendance_date: formLastAttendance,
        exam_result: formExamTitle
          ? {
              exam_title: formExamTitle,
              gpa: formGpa,
              grade: formGrade,
              position: formPosition,
            }
          : undefined,
        mohtamim_signature: formMohtamim,
        principal_signature: formPrincipal,
        teacher_signature: formTeacher,
        show_seal: formSeal,
      });

      if (res.error) {
        alert(res.error);
      } else if (res.certificate) {
        await refreshData();
        setViewingCert(res.certificate);
        setActiveTab("list");
      }
    });
  };

  // Handle Bulk Generate Submit
  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await bulkGenerateCertificates({
        class_id: bulkClassId,
        certificate_type_id: bulkTypeId,
        template_id: bulkTemplateId,
        issue_date: formIssueDate,
      });

      if (res.error) {
        alert(res.error);
      } else {
        setBulkMessage(`সফলভাবে ${res.count} টি নতুন সনদপত্র তৈরি করা হয়েছে!`);
        await refreshData();
      }
    });
  };

  // Handle Approve Action
  const handleApprove = async (certId: string) => {
    startTransition(async () => {
      const res = await approveCertificate(certId);
      if (res.error) {
        alert(res.error);
      } else {
        await refreshData();
      }
    });
  };

  // Handle Revoke Submit
  const handleRevokeSubmit = async () => {
    if (!revokingCert) return;
    startTransition(async () => {
      const res = await revokeCertificate(revokingCert.id, revokeReason);
      if (res.error) {
        alert(res.error);
      } else {
        setRevokingCert(null);
        setRevokeReason("");
        await refreshData();
      }
    });
  };

  // Handle Reissue Submit
  const handleReissueSubmit = async () => {
    if (!reissuingCert) return;
    startTransition(async () => {
      const res = await reissueCertificate(reissuingCert.id, reissueReason);
      if (res.error) {
        alert(res.error);
      } else if (res.newCertificate) {
        setReissuingCert(null);
        setReissueReason("");
        await refreshData();
        setViewingCert(res.newCertificate);
      }
    });
  };

  // Filtered Certificates
  const filteredCerts = certData.certificates.filter((c) => {
    if (selectedTypeFilter !== "ALL" && c.certificate_type_id !== selectedTypeFilter) return false;
    if (selectedStatusFilter !== "ALL" && c.status !== selectedStatusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        c.certificate_number.toLowerCase().includes(q) ||
        c.snapshot.student_name.toLowerCase().includes(q) ||
        c.snapshot.student_id_code.toLowerCase().includes(q) ||
        c.snapshot.roll_number?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Overview KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-3xl border border-slate-200/90 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider">সর্বমোট সনদ</span>
          <span className="text-xl sm:text-2xl font-black text-slate-900">{certData.stats.total}</span>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-emerald-200/80 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-emerald-600 block uppercase tracking-wider">সচল ও ইস্যুকৃত</span>
          <span className="text-xl sm:text-2xl font-black text-emerald-700">{certData.stats.issued}</span>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-amber-200/80 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-amber-600 block uppercase tracking-wider">অপেক্ষমাণ (Pending)</span>
          <span className="text-xl sm:text-2xl font-black text-amber-700">{certData.stats.pending}</span>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-rose-200/80 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-rose-600 block uppercase tracking-wider">বাতিলকৃত (Revoked)</span>
          <span className="text-xl sm:text-2xl font-black text-rose-700">{certData.stats.revoked}</span>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-blue-200/80 shadow-2xs space-y-1 col-span-2 sm:col-span-1">
          <span className="text-[11px] font-bold text-blue-600 block uppercase tracking-wider">রি-ইস্যুকৃত</span>
          <span className="text-xl sm:text-2xl font-black text-blue-700">{certData.stats.reissued}</span>
        </div>
      </div>

      {/* Primary Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2 overflow-x-auto gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("list")}
            className={`px-4 py-2 rounded-2xl text-xs sm:text-sm font-bold transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === "list"
                ? "bg-slate-900 text-white shadow-2xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>ইস্যুকৃত সনদের তালিকা ({filteredCerts.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("create")}
            className={`px-4 py-2 rounded-2xl text-xs sm:text-sm font-bold transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === "create"
                ? "bg-emerald-600 text-white shadow-2xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>+ নতুন সনদ জেনারেট</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("bulk")}
            className={`px-4 py-2 rounded-2xl text-xs sm:text-sm font-bold transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === "bulk"
                ? "bg-slate-900 text-white shadow-2xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>বাল্ক একযোগে জেনারেট</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("audit")}
            className={`px-4 py-2 rounded-2xl text-xs sm:text-sm font-bold transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === "audit"
                ? "bg-slate-900 text-white shadow-2xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <History className="w-4 h-4" />
            <span>অডিট লগ ({certData.auditLogs.length})</span>
          </button>
        </div>
      </div>

      {/* TAB 1: ISSUED CERTIFICATES LIST */}
      {activeTab === "list" && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200/90 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="সনদ নম্বর, শিক্ষার্থীর নাম বা রোল দিয়ে খুঁজুন..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedTypeFilter}
                onChange={(e) => setSelectedTypeFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700"
              >
                <option value="ALL">সকল সনদের ধরন</option>
                {certData.types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title_bn}
                  </option>
                ))}
              </select>

              <select
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700"
              >
                <option value="ALL">সকল স্ট্যাটাস</option>
                <option value="ISSUED">ISSUED (সচল)</option>
                <option value="PENDING_APPROVAL">PENDING_APPROVAL (অপেক্ষমাণ)</option>
                <option value="REVOKED">REVOKED (বাতিল)</option>
                <option value="REISSUED">REISSUED (রি-ইস্যুকৃত)</option>
              </select>
            </div>
          </div>

          {/* Table of Certificates */}
          {filteredCerts.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/90 shadow-2xs space-y-3">
              <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-3xl flex items-center justify-center mx-auto">
                <FileText className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-800">কোনো সনদপত্র রেকর্ড পাওয়া যায়নি</h3>
              <p className="text-xs text-slate-500">
                নতুন একটি সনদপত্র জেনারেট করতে উপরের "+ নতুন সনদ জেনারেট" বাটনে ক্লিক করুন।
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="p-4">সনদ নম্বর</th>
                      <th className="p-4">শিক্ষার্থীর নাম ও আইডি</th>
                      <th className="p-4">সনদের ধরন</th>
                      <th className="p-4">জামাত ও রোল</th>
                      <th className="p-4">ইস্যুর তারিখ</th>
                      <th className="p-4">স্ট্যাটাস</th>
                      <th className="p-4 text-right">অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                    {filteredCerts.map((cert) => {
                      const isIssued = cert.status === "ISSUED";
                      const isPendingApp = cert.status === "PENDING_APPROVAL" || cert.status === "DRAFT";
                      const isRev = cert.status === "REVOKED" || cert.status === "VOIDED";

                      return (
                        <tr key={cert.id} className="hover:bg-slate-50/80 transition">
                          <td className="p-4 font-mono font-bold text-slate-900">{cert.certificate_number}</td>
                          <td className="p-4">
                            <p className="font-bold text-slate-900">{cert.snapshot.student_name}</p>
                            <p className="text-[11px] text-slate-400 font-mono">{cert.snapshot.student_id_code}</p>
                          </td>
                          <td className="p-4 font-semibold text-emerald-800">{cert.certificate_type_title}</td>
                          <td className="p-4 text-xs">
                            {cert.snapshot.class_name} (রোল: {cert.snapshot.roll_number || "—"})
                          </td>
                          <td className="p-4 text-xs font-mono">{cert.issue_date}</td>
                          <td className="p-4">
                            <span
                              className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                isIssued
                                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                  : isPendingApp
                                  ? "bg-amber-100 text-amber-800 border border-amber-300"
                                  : "bg-rose-100 text-rose-800 border border-rose-300"
                              }`}
                            >
                              {cert.status}
                            </span>
                          </td>
                          <td className="p-4 text-right space-x-1">
                            {/* View / Print */}
                            <button
                              type="button"
                              onClick={() => setViewingCert(cert)}
                              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>দেখুন</span>
                            </button>

                            {/* Approve if pending */}
                            {isPendingApp && (
                              <button
                                type="button"
                                onClick={() => handleApprove(cert.id)}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition inline-flex items-center gap-1 cursor-pointer"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>অনুমোদন</span>
                              </button>
                            )}

                            {/* Reissue */}
                            {isIssued && (
                              <button
                                type="button"
                                onClick={() => setReissuingCert(cert)}
                                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition inline-flex items-center gap-1 cursor-pointer"
                              >
                                <RefreshCw className="w-3 h-3" />
                                <span>রি-ইস্যু</span>
                              </button>
                            )}

                            {/* Revoke */}
                            {isIssued && (
                              <button
                                type="button"
                                onClick={() => setRevokingCert(cert)}
                                className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl transition inline-flex items-center gap-1 cursor-pointer"
                              >
                                <XCircle className="w-3 h-3" />
                                <span>বাতিল</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SINGLE CERTIFICATE GENERATOR FORM */}
      {activeTab === "create" && (
        <form
          onSubmit={handleIssueSubmit}
          className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/90 shadow-2xs space-y-6"
        >
          <div className="border-b border-slate-200 pb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-600" />
                <span>নতুন অফিশিয়াল সনদপত্র জেনারেট করুন</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                শিক্ষার্থী ডাটাবেজ থেকে সরাসরি তথ্য নিয়ে অটো-পপুলেটেড অফিস সনদ তৈরি
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Step 1: Select Student */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 block">
                  ১. শিক্ষার্থী নির্বাচন করুন * ({students.length} জন ডাটাবেজে রয়েছে)
                </label>
              </div>

              {/* Search Filter Box */}
              <input
                type="text"
                placeholder="শিক্ষার্থীর নাম, পিতা, রোল বা আইডি দিয়ে ফিল্টার..."
                value={studentSearchText}
                onChange={(e) => setStudentSearchText(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />

              <select
                value={formStudentId}
                onChange={(e) => setFormStudentId(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                required
              >
                <option value="">-- শিক্ষার্থী সিলেক্ট করুন --</option>
                {students
                  .filter((s) => {
                    if (!studentSearchText.trim()) return true;
                    const q = studentSearchText.toLowerCase();
                    const name = `${s.first_name || ""} ${s.last_name || ""}`.toLowerCase();
                    const roll = (s.roll_number || "").toString().toLowerCase();
                    const father = (s.father_name || "").toLowerCase();
                    const className = (s.classes?.name || "").toLowerCase();
                    return name.includes(q) || roll.includes(q) || father.includes(q) || className.includes(q);
                  })
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.first_name} {s.last_name || ""} {s.classes?.name ? `(${s.classes.name})` : ""} - রোল: {s.roll_number || "—"} - পিতা: {s.father_name || "—"}
                    </option>
                  ))}
              </select>

              {currentStudentObj && (
                <div className="p-3 bg-emerald-50/60 rounded-2xl border border-emerald-200/80 text-xs space-y-1 text-emerald-900">
                  <p>
                    <strong>নির্বাচিত শিক্ষার্থী:</strong> {currentStudentObj.first_name} {currentStudentObj.last_name || ""}
                  </p>
                  <p>
                    <strong>পিতার নাম:</strong> {currentStudentObj.father_name || "—"} | <strong>রোল:</strong>{" "}
                    {currentStudentObj.roll_number || "—"} | <strong>শ্রেণি/জামাত:</strong> {currentStudentObj.classes?.name || "—"}
                  </p>
                </div>
              )}
            </div>

            {/* Step 2: Select Document Type */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">২. সনদের ধরন ও ক্যাটাগরি *</label>
              <select
                value={formTypeId}
                onChange={(e) => setFormTypeId(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-bold text-emerald-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                required
              >
                {certData.types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title_bn} ({t.title_en || t.category})
                  </option>
                ))}
              </select>

              {currentTypeObj && (
                <p className="text-[11px] text-slate-500 font-medium">{currentTypeObj.body_template}</p>
              )}
            </div>

            {/* Step 3: Template Layout */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">৩. ডিজাইন ও টেমপ্লেট *</label>
              <select
                value={formTemplateId}
                onChange={(e) => setFormTemplateId(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold text-slate-800"
              >
                {certData.templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name} ({tpl.orientation === "landscape" ? "ল্যান্ডস্কেপ" : "পোর্ট্রেট"})
                  </option>
                ))}
              </select>
            </div>

            {/* Step 4: Issue Date */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">৪. অফিশিয়াল ইস্যুর তারিখ *</label>
              <input
                type="date"
                value={formIssueDate}
                onChange={(e) => setFormIssueDate(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold text-slate-800"
                required
              />
            </div>
          </div>

          {/* Conditional Category Specific Fields (TC / Conduct / Result) */}
          {(currentTypeObj?.category === "TRANSFER" || currentTypeObj?.category === "LEAVING") && (
            <div className="p-4 bg-amber-50/70 rounded-2xl border border-amber-200/80 space-y-4">
              <h3 className="font-bold text-amber-900 text-xs sm:text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-700" />
                <span>ছাড়পত্র / টিসি (Transfer Certificate) স্পেশাল ফিল্ডস</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="font-bold text-amber-900 block mb-1">বকেয়া অবস্থা (Dues Status)</label>
                  <select
                    value={formDuesStatus}
                    onChange={(e: any) => setFormDuesStatus(e.target.value)}
                    className="w-full p-2 bg-white border border-amber-200 rounded-xl font-bold text-slate-800"
                  >
                    <option value="CLEARED">পরিশোধিত (Cleared)</option>
                    <option value="HAS_DUES">বকেয়া রয়েছে (Has Dues)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-amber-900 block mb-1">আচরণ মান (Conduct Grade)</label>
                  <input
                    type="text"
                    value={formConductGrade}
                    onChange={(e) => setFormConductGrade(e.target.value)}
                    className="w-full p-2 bg-white border border-amber-200 rounded-xl font-medium text-slate-800"
                    placeholder="উত্তম / সন্তোষজনক"
                  />
                </div>

                <div>
                  <label className="font-bold text-amber-900 block mb-1">মাদরাসা ত্যাগের কারণ</label>
                  <input
                    type="text"
                    value={formReasonForLeaving}
                    onChange={(e) => setFormReasonForLeaving(e.target.value)}
                    className="w-full p-2 bg-white border border-amber-200 rounded-xl font-medium text-slate-800"
                    placeholder="পড়াশোনা সমাপ্তি / স্বইচ্ছায়"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Statement Override text */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 block">
              সনদের মূল বক্তব্য কাস্টমাইজেশন (Dynamic Placeholder Supported)
            </label>
            <textarea
              rows={3}
              value={formStatement}
              onChange={(e) => setFormStatement(e.target.value)}
              placeholder="ডিফল্ট বক্তব্যে অতিরিক্ত কিছু যোগ করতে চাইলে এখানে লিখুন..."
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
            <p className="text-[10px] text-slate-400">
              সাপোর্টেড প্লেসহোল্ডার: &#123;&#123;student_name&#125;&#125;, &#123;&#123;father_name&#125;&#125;, &#123;&#123;class_name&#125;&#125;, &#123;&#123;roll&#125;&#125;, &#123;&#123;session_name&#125;&#125;
            </p>
          </div>

          {/* Signature & Seal Toggles */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
            <p className="font-bold text-xs text-slate-800">স্বাক্ষর ও অফিসিয়াল সিল সিলেকশন:</p>
            <div className="flex flex-wrap items-center gap-6 text-xs font-bold text-slate-700">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formMohtamim}
                  onChange={(e) => setFormMohtamim(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>মুহতামিম / অধ্যক্ষের স্বাক্ষর</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formTeacher}
                  onChange={(e) => setFormTeacher(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>শ্রেণি শিক্ষকের স্বাক্ষর</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formSeal}
                  onChange={(e) => setFormSeal(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>অফিসিয়াল সিল ও কিউআর প্রদর্শন</span>
              </label>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={isPending}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Award className="w-4 h-4" />
              <span>{isPending ? "জেনারেট হচ্ছে..." : "সনদপত্র তৈরি ও ইস্যু করুন"}</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 3: BULK GENERATOR */}
      {activeTab === "bulk" && (
        <form
          onSubmit={handleBulkSubmit}
          className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/90 shadow-2xs space-y-6"
        >
          <div className="border-b border-slate-200 pb-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-600" />
              <span>এক ক্লিকে পুরো ক্লাসের সকল শিক্ষার্থীর সনদ জেনারেট</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              নির্দিষ্ট ক্লাসের সকল শিক্ষার্থীর জন্য চারিত্রিক বা প্রশংসাপত্র একসাথে তৈরি করুন
            </p>
          </div>

          {bulkMessage && (
            <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl text-xs font-bold text-emerald-900 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{bulkMessage}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">ক্লাস / জামাত ফিল্টার</label>
              <select
                value={bulkClassId}
                onChange={(e) => setBulkClassId(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold text-slate-800"
              >
                <option value="ALL">সকল ক্লাসের শিক্ষার্থী</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">সনদের ধরন</label>
              <select
                value={bulkTypeId}
                onChange={(e) => setBulkTypeId(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-bold text-emerald-900"
              >
                {certData.types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title_bn}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 block">লেআউট টেমপ্লেট</label>
              <select
                value={bulkTemplateId}
                onChange={(e) => setBulkTemplateId(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold text-slate-800"
              >
                {certData.templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={isPending}
              className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Users className="w-4 h-4 text-emerald-400" />
              <span>{isPending ? "প্রসেসিং হচ্ছে..." : "একযোগে তৈরি করুন"}</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 4: AUDIT LOGS */}
      {activeTab === "audit" && (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs p-6 space-y-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-3">
            <History className="w-5 h-5 text-emerald-600" />
            <span>সনদপত্র ইস্যু ও পরিবর্তনের অডিট ইতিহাস</span>
          </h2>

          <div className="divide-y divide-slate-100 text-xs">
            {certData.auditLogs.length === 0 ? (
              <p className="py-8 text-center text-slate-400">এখনো কোনো অডিট লগ রেকর্ড নেই।</p>
            ) : (
              certData.auditLogs.map((log) => (
                <div key={log.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <div>
                    <span className="font-bold text-slate-900">{log.user_name}</span>
                    <span className="text-slate-500 font-normal"> — {log.details}</span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {new Date(log.created_at).toLocaleString("bn-BD")}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* View & Print Certificate Modal */}
      {viewingCert && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-100 rounded-3xl max-w-4xl w-full max-h-[92vh] overflow-y-auto p-4 sm:p-6 space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-emerald-600" />
                <h2 className="font-bold text-slate-900 text-sm sm:text-base">
                  {viewingCert.certificate_type_title} ({viewingCert.certificate_number})
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setViewingCert(null)}
                className="p-2 bg-white hover:bg-slate-200 text-slate-700 rounded-full transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <CertificateDocumentView certificate={viewingCert} />
          </div>
        </div>
      )}

      {/* Revoke Modal */}
      {revokingCert && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="font-bold text-rose-900 text-base flex items-center gap-2">
              <XCircle className="w-5 h-5 text-rose-600" />
              <span>সনদপত্র বাতিল (Revoke) নিশ্চিতকরণ</span>
            </h3>
            <p className="text-xs text-slate-600">
              সনদ নম্বর <strong>{revokingCert.certificate_number}</strong> ({revokingCert.snapshot.student_name}) বাতিল করা হলে অনলাইন কিউআর কোডে এটি অকার্যকর দেখাবে।
            </p>

            <textarea
              rows={3}
              placeholder="বাতিল করার সুনির্দিষ্ট কারণ লিখুন..."
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium focus:outline-none"
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRevokingCert(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
              >
                বাতিল করুন
              </button>
              <button
                type="button"
                onClick={handleRevokeSubmit}
                disabled={isPending}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl"
              >
                {isPending ? "বাতিল হচ্ছে..." : "কনফার্ম বাতিল"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reissue Modal */}
      {reissuingCert && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-emerald-600" />
              <span>সনদপত্র রি-ইস্যু (Re-issue) নিশ্চিতকরণ</span>
            </h3>
            <p className="text-xs text-slate-600">
              পুরানো সনদটি (<strong>{reissuingCert.certificate_number}</strong>) স্বয়ংক্রিয়ভাবে বাতিল হয়ে একটি নতুন সনদ নম্বর দিয়ে প্রতিস্থাপিত হবে।
            </p>

            <textarea
              rows={3}
              placeholder="রি-ইস্যু করার কারণ (যেমন: ভুল সংশোধন / হারিয়ে যাওয়া)..."
              value={reissueReason}
              onChange={(e) => setReissueReason(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium focus:outline-none"
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReissuingCert(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
              >
                ফিরে যান
              </button>
              <button
                type="button"
                onClick={handleReissueSubmit}
                disabled={isPending}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl"
              >
                {isPending ? "রি-ইস্যু হচ্ছে..." : "নতুন রি-ইস্যু করুন"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
