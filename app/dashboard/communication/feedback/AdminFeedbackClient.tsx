"use client";

import React, { useState } from "react";
import {
  MessageSquare,
  MessageSquarePlus,
  Send,
  Calendar,
  Clock,
  User,
  CheckCircle2,
  AlertCircle,
  Clock3,
  Search,
  Filter,
  Trash2,
  Edit2,
  ShieldCheck,
  ChevronRight,
  Phone,
  HelpCircle,
  Sparkles,
  Layers,
  X,
  PhoneCall,
  ExternalLink,
  MessageCircle,
} from "lucide-react";
import { toBanglaNumber } from "@/lib/numberToBangla";
import type { ParentFeedbackItem } from "@/app/actions/parent-communication-types";
import {
  createParentFeedback,
  updateParentFeedbackStatus,
  deleteParentFeedback,
} from "@/app/actions/parent-communication";

interface Props {
  initialFeedbacks: ParentFeedbackItem[];
  students: any[];
  classes: any[];
}

export default function AdminFeedbackClient({
  initialFeedbacks = [],
  students = [],
  classes = [],
}: Props) {
  const [feedbacks, setFeedbacks] = useState<ParentFeedbackItem[]>(initialFeedbacks);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [respondItem, setRespondItem] = useState<ParentFeedbackItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [alertMsg, setAlertMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Respond modal state
  const [newStatus, setNewStatus] = useState<"PENDING" | "IN_REVIEW" | "RESOLVED" | "CLOSED">("RESOLVED");
  const [officialResponse, setOfficialResponse] = useState("");
  const [respondedBy, setRespondedBy] = useState("মুহতামিম সাহেব");
  const [notifyViaSMS, setNotifyViaSMS] = useState(true);

  // New feedback manual entry form
  const [manualStudentId, setManualStudentId] = useState("");
  const [manualType, setManualType] = useState<"SUGGESTION" | "COMPLAINT" | "APPOINTMENT" | "GENERAL">("COMPLAINT");
  const [manualCategory, setManualCategory] = useState("পড়াশোনা ও হিফজ");
  const [manualSubject, setManualSubject] = useState("");
  const [manualDescription, setManualDescription] = useState("");
  const [manualGuardianName, setManualGuardianName] = useState("");
  const [manualGuardianPhone, setManualGuardianPhone] = useState("");
  const [manualUrgency, setManualUrgency] = useState<"Normal" | "Important" | "Urgent">("Normal");

  // Calculate statistics
  const totalCount = feedbacks.length;
  const pendingCount = feedbacks.filter((f) => f.status === "PENDING").length;
  const inReviewCount = feedbacks.filter((f) => f.status === "IN_REVIEW").length;
  const resolvedCount = feedbacks.filter((f) => f.status === "RESOLVED").length;

  // Filtered feedbacks
  const filteredList = feedbacks.filter((item) => {
    if (statusFilter !== "ALL" && item.status !== statusFilter) return false;
    if (typeFilter !== "ALL" && item.action_type !== typeFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchSubject = item.subject?.toLowerCase().includes(q);
      const matchDesc = item.description?.toLowerCase().includes(q);
      const matchStudent = item.student_name?.toLowerCase().includes(q);
      const matchGuardian = item.guardian_name?.toLowerCase().includes(q);
      const matchPhone = item.guardian_phone?.toLowerCase().includes(q);
      if (!matchSubject && !matchDesc && !matchStudent && !matchGuardian && !matchPhone) return false;
    }
    return true;
  });

  const handleOpenRespond = (item: ParentFeedbackItem) => {
    setRespondItem(item);
    setNewStatus(item.status === "PENDING" ? "RESOLVED" : item.status);
    setOfficialResponse(item.official_response || "");
    setRespondedBy(item.responded_by || "মুহতামিম সাহেব");
  };

  const handleSaveResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!respondItem) return;

    setIsSubmitting(true);
    const res = await updateParentFeedbackStatus({
      id: respondItem.id,
      status: newStatus,
      official_response: officialResponse,
      responded_by: respondedBy,
      notifyViaSMS: notifyViaSMS,
    });

    setIsSubmitting(false);

    if (res.error) {
      setAlertMsg({ type: "error", text: res.error });
    } else {
      setAlertMsg({ type: "success", text: "অভিযোগ/পরামর্শের সমাধান সফলভাবে আপডেট করা হয়েছে!" });
      setFeedbacks((prev) =>
        prev.map((f) =>
          f.id === respondItem.id
            ? {
                ...f,
                status: newStatus,
                official_response: officialResponse,
                responded_by: respondedBy,
                responded_at: new Date().toISOString(),
              }
            : f
        )
      );
      setRespondItem(null);
    }
  };

  const handleCreateManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualSubject.trim() || !manualDescription.trim()) {
      setAlertMsg({ type: "error", text: "বিষয় এবং বিবরণ পূরণ করুন" });
      return;
    }

    setIsSubmitting(true);
    const selStudent = students.find((s) => s.id === manualStudentId);

    const res = await createParentFeedback({
      action_type: manualType,
      category: manualCategory,
      subject: manualSubject,
      description: manualDescription,
      student_id: manualStudentId || undefined,
      student_name: selStudent ? `${selStudent.first_name || ""} ${selStudent.last_name || ""}`.trim() : undefined,
      student_roll: selStudent?.roll_number ? String(selStudent.roll_number) : undefined,
      class_name: selStudent?.class_name || selStudent?.classes?.name,
      guardian_name: manualGuardianName || "অফিস এন্ট্রি",
      guardian_phone: manualGuardianPhone || selStudent?.parent_phone || "",
      urgency: manualUrgency,
    });

    setIsSubmitting(false);

    if (res.error) {
      setAlertMsg({ type: "error", text: res.error });
    } else {
      setAlertMsg({ type: "success", text: "নতুন অভিযোগ/পরামর্শ সফলভাবে যোগ করা হয়েছে!" });
      setIsCreateModalOpen(false);

      const newItem: ParentFeedbackItem = {
        id: res.id || `fb-${Date.now()}`,
        madrasa_id: "",
        action_type: manualType,
        type_bangla: manualType === "COMPLAINT" ? "অভিযোগ" : manualType === "SUGGESTION" ? "পরামর্শ" : "সাক্ষাতকার",
        category: manualCategory,
        subject: manualSubject,
        description: manualDescription,
        student_id: manualStudentId,
        student_name: selStudent ? `${selStudent.first_name} ${selStudent.last_name}` : "শিক্ষার্থী",
        student_roll: selStudent?.roll_number ? String(selStudent.roll_number) : "",
        guardian_name: manualGuardianName || "অফিস এন্ট্রি",
        guardian_phone: manualGuardianPhone || "",
        urgency: manualUrgency,
        urgency_bangla: manualUrgency === "Urgent" ? "অতি জরুরি" : "সাধারণ",
        status: "PENDING",
        status_bangla: "অপেক্ষমান",
        created_at: new Date().toISOString(),
      };
      setFeedbacks([newItem, ...feedbacks]);

      // Reset
      setManualSubject("");
      setManualDescription("");
      setManualGuardianName("");
      setManualGuardianPhone("");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("আপনি কি নিশ্চিতভাবে এই রেকর্ডটি মুছে ফেলতে চান?")) return;
    const res = await deleteParentFeedback(id);
    if (!res.error) {
      setFeedbacks((prev) => prev.filter((f) => f.id !== id));
      setAlertMsg({ type: "success", text: "রেকর্ড মুছে ফেলা হয়েছে" });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "RESOLVED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            সমাধানকৃত
          </span>
        );
      case "IN_REVIEW":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300">
            <Clock className="w-3.5 h-3.5 text-blue-600" />
            পর্যালোচনাধীন
          </span>
        );
      case "CLOSED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
            সম্পন্ন
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <Clock3 className="w-3.5 h-3.5 text-amber-600" />
            অপেক্ষমান
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold mb-2">
            <MessageSquare className="w-3.5 h-3.5" />
            অভিভাবক সংশ্লিষ্টতা ও প্রতিক্রিয়া ব্যবস্থাপনা
          </div>
          <h1 className="text-2xl font-bold text-slate-800">
            অভিভাবক অভিযোগ ও পরামর্শ বক্স (Feedback & Appointments)
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            অভিভাবকদের প্রেরিত সকল পরামর্শ, অভিযোগ ও মুহতামিম সাক্ষাতকার আবেদন পর্যালোচনা ও সমাধান করুন
          </p>
        </div>

        <button
          id="btn-admin-new-feedback"
          onClick={() => setIsCreateModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition shadow-sm cursor-pointer shrink-0"
        >
          <MessageSquarePlus className="w-4 h-4" />
          + নতুন তৈরি করুন
        </button>
      </div>

      {/* Stats Counter Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => setStatusFilter("ALL")}
          className={`p-4 rounded-xl border transition cursor-pointer ${
            statusFilter === "ALL" ? "bg-indigo-50/50 border-indigo-300 ring-2 ring-indigo-200" : "bg-white border-slate-200 hover:border-slate-300"
          }`}
        >
          <div className="text-xs font-semibold text-slate-500">মোট আবেদন</div>
          <div className="text-2xl font-bold text-slate-800 mt-1">{toBanglaNumber(totalCount)}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">অভিযোগ, পরামর্শ ও সাক্ষাতকার</div>
        </div>

        <div
          onClick={() => setStatusFilter("PENDING")}
          className={`p-4 rounded-xl border transition cursor-pointer ${
            statusFilter === "PENDING" ? "bg-amber-50/50 border-amber-300 ring-2 ring-amber-200" : "bg-white border-slate-200 hover:border-slate-300"
          }`}
        >
          <div className="text-xs font-semibold text-amber-700 flex items-center justify-between">
            <span>নতুন অপেক্ষমান</span>
            <Clock3 className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-800 mt-1">{toBanglaNumber(pendingCount)}</div>
          <div className="text-[11px] text-amber-600 mt-0.5">দ্রুত পদক্ষেপ প্রয়োজন</div>
        </div>

        <div
          onClick={() => setStatusFilter("IN_REVIEW")}
          className={`p-4 rounded-xl border transition cursor-pointer ${
            statusFilter === "IN_REVIEW" ? "bg-blue-50/50 border-blue-300 ring-2 ring-blue-200" : "bg-white border-slate-200 hover:border-slate-300"
          }`}
        >
          <div className="text-xs font-semibold text-blue-700 flex items-center justify-between">
            <span>পর্যালোচনাধীন</span>
            <Clock className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-blue-800 mt-1">{toBanglaNumber(inReviewCount)}</div>
          <div className="text-[11px] text-blue-600 mt-0.5">শিক্ষক/মুহতামিম বিবেচনাধীন</div>
        </div>

        <div
          onClick={() => setStatusFilter("RESOLVED")}
          className={`p-4 rounded-xl border transition cursor-pointer ${
            statusFilter === "RESOLVED" ? "bg-emerald-50/50 border-emerald-300 ring-2 ring-emerald-200" : "bg-white border-slate-200 hover:border-slate-300"
          }`}
        >
          <div className="text-xs font-semibold text-emerald-700 flex items-center justify-between">
            <span>সমাধানকৃত</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-800 mt-1">{toBanglaNumber(resolvedCount)}</div>
          <div className="text-[11px] text-emerald-600 mt-0.5">উত্তর দেওয়া সম্পন্ন</div>
        </div>
      </div>

      {/* Alert message */}
      {alertMsg && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between border ${
            alertMsg.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-rose-50 text-rose-800 border-rose-200"
          }`}
        >
          <div className="flex items-center gap-3">
            {alertMsg.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <p className="text-sm font-semibold">{alertMsg.text}</p>
          </div>
          <button onClick={() => setAlertMsg(null)} className="text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filters & Search Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs sm:text-sm font-semibold rounded-lg border border-slate-200 bg-slate-50 text-slate-700 focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">সকল স্ট্যাটাস</option>
            <option value="PENDING">অপেক্ষমান (Pending)</option>
            <option value="IN_REVIEW">পর্যালোচনাধীন (In Review)</option>
            <option value="RESOLVED">সমাধানকৃত (Resolved)</option>
            <option value="CLOSED">সম্পন্ন (Closed)</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 text-xs sm:text-sm font-semibold rounded-lg border border-slate-200 bg-slate-50 text-slate-700 focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">সকল ধরন</option>
            <option value="COMPLAINT">অভিযোগ (Complaint)</option>
            <option value="SUGGESTION">পরামর্শ (Suggestion)</option>
            <option value="APPOINTMENT">সাক্ষাতকার (Appointment)</option>
            <option value="GENERAL">সাধারণ আবেদন</option>
          </select>
        </div>

        <div className="relative min-w-[280px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="ছাত্রের নাম, অভিভাবক, ফোন বা বিষয়..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Feedback List Table/Cards */}
      {filteredList.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-700">কোনো রেকর্ড পাওয়া যায়নি</h3>
          <p className="text-xs text-slate-400 mt-1">নির্বাচিত ফিল্টারে কোনো অভিযোগ বা পরামর্শ বিদ্যমান নেই।</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredList.map((item) => {
            const cleanPhone = item.guardian_phone?.replace(/[^0-9]/g, "");
            const whatsappIntl = cleanPhone?.startsWith("88") ? cleanPhone : `88${cleanPhone}`;
            const whatsappLink = cleanPhone ? `https://wa.me/${whatsappIntl}` : "";

            return (
              <div
                key={item.id}
                id={`admin-fb-item-${item.id}`}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition"
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  {/* Left Main Content */}
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-md font-bold ${
                          item.action_type === "COMPLAINT"
                            ? "bg-rose-100 text-rose-800 border border-rose-200"
                            : item.action_type === "APPOINTMENT"
                            ? "bg-purple-100 text-purple-800 border border-purple-200"
                            : "bg-indigo-100 text-indigo-800 border border-indigo-200"
                        }`}
                      >
                        {item.type_bangla}
                      </span>

                      <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">
                        {item.category}
                      </span>

                      {item.urgency === "Urgent" && (
                        <span className="text-xs px-2 py-0.5 rounded-md bg-rose-500 text-white font-bold">
                          জরুরি
                        </span>
                      )}

                      {getStatusBadge(item.status)}

                      <span className="text-xs text-slate-400">
                        {new Date(item.created_at).toLocaleString("bn-BD")}
                      </span>
                    </div>

                    <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                      {item.subject}
                    </h3>

                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                      {item.description}
                    </p>

                    {/* Appointment info */}
                    {item.action_type === "APPOINTMENT" && (item.preferred_date || item.target_person) && (
                      <div className="p-3 rounded-xl bg-purple-50/70 border border-purple-200 text-purple-950 text-xs flex flex-wrap items-center gap-4">
                        <span className="font-bold flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-purple-600" />
                          কার সাথে সাক্ষাৎ: {item.target_person || "মুহতামিম সাহেব"}
                        </span>
                        {item.preferred_date && (
                          <span className="font-semibold flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-purple-600" />
                            কাঙ্ক্ষিত তারিখ: {item.preferred_date} {item.preferred_time && `(${item.preferred_time})`}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Official response note if present */}
                    {item.official_response && (
                      <div className="mt-3 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 mb-1">
                          <ShieldCheck className="w-4 h-4 text-emerald-600" />
                          গৃহীত পদক্ষেপ ও সমাধান ({item.responded_by || "প্রশাসন"}):
                        </div>
                        <p className="text-xs sm:text-sm text-emerald-900 leading-relaxed font-medium">
                          {item.official_response}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Right Side: Guardian & Quick Action Controls */}
                  <div className="w-full md:w-64 shrink-0 bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col justify-between space-y-3">
                    <div className="space-y-1.5 text-xs">
                      <div className="font-bold text-slate-800 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-500" />
                        {item.guardian_name || "সম্মানিত অভিভাবক"}
                      </div>
                      {item.student_name && (
                        <div className="text-slate-600">
                          ছাত্র: <span className="font-semibold text-slate-900">{item.student_name}</span>{" "}
                          {item.student_roll && `(রোল: ${item.student_roll})`}
                        </div>
                      )}
                      {item.class_name && (
                        <div className="text-slate-500">জামাত: {item.class_name}</div>
                      )}
                      {item.guardian_phone && (
                        <div className="text-slate-700 font-mono font-bold flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          {item.guardian_phone}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="pt-2 border-t border-slate-200 flex flex-col gap-2">
                      <button
                        onClick={() => handleOpenRespond(item)}
                        className="w-full py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        {item.status === "RESOLVED" ? "উত্তর সম্পাদনা করুন" : "সমাধান ও উত্তর দিন"}
                      </button>

                      <div className="grid grid-cols-2 gap-2">
                        {whatsappLink ? (
                          <a
                            href={whatsappLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="py-1.5 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center justify-center gap-1 transition"
                            title="হোয়াটসঅ্যাপে মেসেজ পাঠান"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            WhatsApp
                          </a>
                        ) : (
                          <button
                            disabled
                            className="py-1.5 px-2 rounded-lg bg-slate-200 text-slate-400 text-[11px] font-bold"
                          >
                            WhatsApp
                          </button>
                        )}

                        {cleanPhone ? (
                          <a
                            href={`tel:${cleanPhone}`}
                            className="py-1.5 px-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] flex items-center justify-center gap-1 transition"
                          >
                            <PhoneCall className="w-3.5 h-3.5" />
                            কল করুন
                          </a>
                        ) : (
                          <button
                            disabled
                            className="py-1.5 px-2 rounded-lg bg-slate-200 text-slate-400 text-[11px] font-bold"
                          >
                            কল করুন
                          </button>
                        )}
                      </div>

                      <button
                        onClick={() => handleDelete(item.id)}
                        className="w-full py-1 text-slate-400 hover:text-rose-600 text-[11px] flex items-center justify-center gap-1 transition"
                      >
                        <Trash2 className="w-3 h-3" />
                        রেকর্ড মুছে ফেলুন
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Respond / Resolve Feedback */}
      {respondItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-600" />
                  আবেদনের সমাধান ও প্রতিক্রিয়া প্রদান
                </h3>
                <p className="text-xs text-slate-500">অভিভাবক: {respondItem.guardian_name} | {respondItem.subject}</p>
              </div>
              <button
                onClick={() => setRespondItem(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveResponse} className="space-y-4 text-xs sm:text-sm">
              <div>
                <label className="block font-bold text-slate-700 mb-1">স্ট্যাটাস নির্ধারণ করুন *</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-bold focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="IN_REVIEW">পর্যালোচনাধীন (In Review)</option>
                  <option value="RESOLVED">সমাধানকৃত (Resolved)</option>
                  <option value="CLOSED">সম্পন্ন / সমাপ্ত (Closed)</option>
                  <option value="PENDING">অপেক্ষমান (Pending)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">প্রতিক্রিয়া প্রদানকারী *</label>
                <input
                  type="text"
                  required
                  value={respondedBy}
                  onChange={(e) => setRespondedBy(e.target.value)}
                  placeholder="যেমন: মুহতামিম সাহেব / নাজেমে তালিমাত"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">কর্তৃপক্ষের মন্তব্য ও গৃহীত পদক্ষেপ *</label>
                <textarea
                  required
                  rows={4}
                  value={officialResponse}
                  onChange={(e) => setOfficialResponse(e.target.value)}
                  placeholder="অভিভাবকের বিষয়টি কিভাবে সমাধান করা হয়েছে বা কি পদক্ষেপ নেওয়া হয়েছে তা লিখুন..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-medium focus:ring-2 focus:ring-indigo-500 leading-relaxed"
                />
              </div>

              {respondItem.guardian_phone && (
                <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="font-bold text-indigo-900 text-xs">অভিভাবককে স্বয়ংক্রিয় এসএমএস পাঠান</div>
                    <div className="text-[11px] text-indigo-700">নম্বর: {respondItem.guardian_phone}</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifyViaSMS}
                    onChange={(e) => setNotifyViaSMS(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setRespondItem(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? "সংরক্ষণ হচ্ছে..." : "সমাধান সম্পন্ন করুন"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Manual New Entry (+ নতুন তৈরি করুন) */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <MessageSquarePlus className="w-5 h-5 text-indigo-600" />
                  নতুন অভিযোগ/পরামর্শ এন্ট্রি (অফিস কপি)
                </h3>
                <p className="text-xs text-slate-500">অভিভাবক সরাসরি অফিসে এসে অভিযোগ বা পরামর্শ জানালে এন্ট্রি নিন</p>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateManual} className="space-y-3.5 text-xs sm:text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">ধরন *</label>
                  <select
                    value={manualType}
                    onChange={(e) => setManualType(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-bold"
                  >
                    <option value="COMPLAINT">অভিযোগ (Complaint)</option>
                    <option value="SUGGESTION">পরামর্শ (Suggestion)</option>
                    <option value="APPOINTMENT">সাক্ষাতকার (Appointment)</option>
                    <option value="GENERAL">সাধারণ আবেদন</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">ক্যাটেগরি</label>
                  <select
                    value={manualCategory}
                    onChange={(e) => setManualCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-medium"
                  >
                    <option value="পড়াশোনা ও হিফজ">পড়াশোনা ও হিফজ সবক</option>
                    <option value="বোর্ডিং ও খাবার">বোর্ডিং ও খাবার</option>
                    <option value="স্বাস্থ্য ও আচরণ">স্বাস্থ্য ও আচরণ</option>
                    <option value="ফি ও হিসাব">ফি ও হিসাব</option>
                    <option value="অন্যান্য">অন্যান্য</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">শিক্ষার্থী নির্বাচন (ঐচ্ছিক)</label>
                <select
                  value={manualStudentId}
                  onChange={(e) => setManualStudentId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-medium"
                >
                  <option value="">সাধারণ মাদরাসা সংক্রান্ত</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.first_name} {s.last_name} (রোল: {s.roll_number || "১"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">বিষয় / শিরোনাম *</label>
                <input
                  type="text"
                  required
                  value={manualSubject}
                  onChange={(e) => setManualSubject(e.target.value)}
                  placeholder="মূল বক্তব্য লিখুন..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">বিস্তারিত বিবরণ *</label>
                <textarea
                  required
                  rows={3}
                  value={manualDescription}
                  onChange={(e) => setManualDescription(e.target.value)}
                  placeholder="অভিযোগ বা পরামর্শের পূর্ণ বিবরণ..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">অভিভাবকের নাম</label>
                  <input
                    type="text"
                    value={manualGuardianName}
                    onChange={(e) => setManualGuardianName(e.target.value)}
                    placeholder="নাম..."
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">অভিভাবকের মোবাইল</label>
                  <input
                    type="text"
                    value={manualGuardianPhone}
                    onChange={(e) => setManualGuardianPhone(e.target.value)}
                    placeholder="০১XXXXXXXXX"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ করুন"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
