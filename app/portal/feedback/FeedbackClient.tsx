"use client";

import React, { useState } from "react";
import {
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
} from "lucide-react";
import { toBanglaNumber } from "@/lib/numberToBangla";
import type { ParentFeedbackItem } from "@/app/actions/parent-communication-types";
import {
  createParentFeedback,
  deleteParentFeedback,
} from "@/app/actions/parent-communication";

interface Props {
  students: any[];
  userProfile: any;
  initialFeedbacks: ParentFeedbackItem[];
}

export default function FeedbackClient({
  students = [],
  userProfile,
  initialFeedbacks = [],
}: Props) {
  const [feedbacks, setFeedbacks] = useState<ParentFeedbackItem[]>(initialFeedbacks);
  const [activeTab, setActiveTab] = useState<"ALL" | "SUGGESTION" | "COMPLAINT" | "APPOINTMENT" | "RESOLVED">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form states
  const [selectedStudentId, setSelectedStudentId] = useState(students[0]?.id || "");
  const [actionType, setActionType] = useState<"SUGGESTION" | "COMPLAINT" | "APPOINTMENT" | "GENERAL">("SUGGESTION");
  const [category, setCategory] = useState("পড়াশোনা ও হিফজ");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState<"Normal" | "Important" | "Urgent">("Normal");
  const [targetPerson, setTargetPerson] = useState("মুহতামিম সাহেব");
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [guardianName, setGuardianName] = useState(userProfile?.full_name || "সম্মানিত অভিভাবক");
  const [guardianPhone, setGuardianPhone] = useState(userProfile?.phone || "");

  // Selected feedback for viewing detail
  const [viewDetailItem, setViewDetailItem] = useState<ParentFeedbackItem | null>(null);

  // Filtered feedbacks
  const filteredList = feedbacks.filter((item) => {
    if (activeTab === "RESOLVED" && item.status !== "RESOLVED") return false;
    if (activeTab !== "ALL" && activeTab !== "RESOLVED" && item.action_type !== activeTab) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchSubject = item.subject?.toLowerCase().includes(q);
      const matchDesc = item.description?.toLowerCase().includes(q);
      const matchStudent = item.student_name?.toLowerCase().includes(q);
      const matchCategory = item.category?.toLowerCase().includes(q);
      if (!matchSubject && !matchDesc && !matchStudent && !matchCategory) return false;
    }
    return true;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) {
      setStatusMsg({ type: "error", text: "আবেদনের বিষয় এবং বিস্তারিত বিবরণ আবশ্যক।" });
      return;
    }

    setIsSubmitting(true);
    setStatusMsg(null);

    const selStudent = students.find((s) => s.id === selectedStudentId);

    const res = await createParentFeedback({
      action_type: actionType,
      category,
      subject,
      description,
      student_id: selectedStudentId || undefined,
      student_name: selStudent ? `${selStudent.first_name || ""} ${selStudent.last_name || ""}`.trim() : undefined,
      student_roll: selStudent?.roll_number ? String(selStudent.roll_number) : undefined,
      class_name: selStudent?.class_name || selStudent?.classes?.name,
      guardian_name: guardianName || "সম্মানিত অভিভাবক",
      guardian_phone: guardianPhone,
      urgency,
      target_person: targetPerson,
      preferred_date: actionType === "APPOINTMENT" ? preferredDate : undefined,
      preferred_time: actionType === "APPOINTMENT" ? preferredTime : undefined,
    });

    setIsSubmitting(false);

    if (res.error) {
      setStatusMsg({ type: "error", text: res.error });
    } else {
      setStatusMsg({ type: "success", text: "আপনার আবেদনটি সফলভাবে মাদরাসা কর্তৃপক্ষের নিকট প্রেরণ করা হয়েছে।" });
      setIsModalOpen(false);

      // Optimistically add to UI list
      const newItem: ParentFeedbackItem = {
        id: res.id || `fb-${Date.now()}`,
        madrasa_id: "",
        action_type: actionType,
        type_bangla:
          actionType === "COMPLAINT"
            ? "অভিযোগ"
            : actionType === "SUGGESTION"
            ? "পরামর্শ"
            : actionType === "APPOINTMENT"
            ? "সাক্ষাতকার"
            : "সাধারণ আবেদন",
        category,
        subject,
        description,
        student_id: selectedStudentId,
        student_name: selStudent ? `${selStudent.first_name || ""} ${selStudent.last_name || ""}`.trim() : "শিক্ষার্থী",
        student_roll: selStudent?.roll_number ? String(selStudent.roll_number) : "",
        class_name: selStudent?.class_name || selStudent?.classes?.name || "",
        guardian_name: guardianName,
        guardian_phone: guardianPhone,
        urgency,
        urgency_bangla: urgency === "Urgent" ? "অতি জরুরি" : urgency === "Important" ? "জরুরি" : "সাধারণ",
        target_person: targetPerson,
        preferred_date: preferredDate,
        preferred_time: preferredTime,
        status: "PENDING",
        status_bangla: "অপেক্ষমান",
        created_at: new Date().toISOString(),
      };
      setFeedbacks([newItem, ...feedbacks]);

      // Reset form
      setSubject("");
      setDescription("");
      setPreferredDate("");
      setPreferredTime("");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("আপনি কি নিশ্চিতভাবে এই আবেদনটি মুছে ফেলতে চান?")) return;
    const res = await deleteParentFeedback(id);
    if (!res.error) {
      setFeedbacks((prev) => prev.filter((f) => f.id !== id));
      if (viewDetailItem?.id === id) setViewDetailItem(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "RESOLVED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            সমাধানকৃত
          </span>
        );
      case "IN_REVIEW":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300">
            <Clock className="w-3.5 h-3.5 text-blue-600" />
            পর্যালোচনাধীন
          </span>
        );
      case "CLOSED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
            সম্পন্ন / সমাপ্ত
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <Clock3 className="w-3.5 h-3.5 text-amber-600" />
            অপেক্ষমান
          </span>
        );
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "COMPLAINT":
        return <span className="text-xs px-2.5 py-0.5 rounded-md font-semibold bg-rose-50 text-rose-700 border border-rose-200">অভিযোগ</span>;
      case "APPOINTMENT":
        return <span className="text-xs px-2.5 py-0.5 rounded-md font-semibold bg-purple-50 text-purple-700 border border-purple-200">সাক্ষাতকার</span>;
      case "SUGGESTION":
        return <span className="text-xs px-2.5 py-0.5 rounded-md font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">পরামর্শ</span>;
      default:
        return <span className="text-xs px-2.5 py-0.5 rounded-md font-semibold bg-slate-100 text-slate-700 border border-slate-200">সাধারণ আবেদন</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-emerald-200 text-xs font-semibold mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              অভিভাবক সরাসরি যোগাযোগ ও স্বচ্ছতা পোর্টাল
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              অভিযোগ, পরামর্শ ও শিক্ষক সাক্ষাতকার
            </h1>
            <p className="text-sm sm:text-base text-emerald-100/90 mt-1 max-w-2xl">
              মাদরাসা কর্তৃপক্ষ বা মুহতামিম সাহেবের নিকট সরাসরি মতামত প্রদান করুন, কোনো অভিযোগ থাকলে জানান অথবা সাক্ষাতকারের জন্য অ্যাপয়েন্টমেন্ট গ্রহণ করুন।
            </p>
          </div>

          <button
            id="btn-create-feedback"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow-md hover:shadow-lg transition cursor-pointer self-start md:self-auto shrink-0"
          >
            <MessageSquarePlus className="w-5 h-5" />
            + নতুন তৈরি করুন
          </button>
        </div>
      </div>

      {/* Alert message */}
      {statusMsg && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between border ${
            statusMsg.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-rose-50 text-rose-800 border-rose-200"
          }`}
        >
          <div className="flex items-center gap-3">
            {statusMsg.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <p className="text-sm font-semibold">{statusMsg.text}</p>
          </div>
          <button onClick={() => setStatusMsg(null)} className="text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Navigation Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { key: "ALL", label: "সকল আবেদন", count: feedbacks.length },
            { key: "SUGGESTION", label: "পরামর্শ", count: feedbacks.filter((f) => f.action_type === "SUGGESTION").length },
            { key: "COMPLAINT", label: "অভিযোগ", count: feedbacks.filter((f) => f.action_type === "COMPLAINT").length },
            { key: "APPOINTMENT", label: "সাক্ষাতকার", count: feedbacks.filter((f) => f.action_type === "APPOINTMENT").length },
            { key: "RESOLVED", label: "সমাধানকৃত", count: feedbacks.filter((f) => f.status === "RESOLVED").length },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold whitespace-nowrap transition cursor-pointer ${
                activeTab === tab.key
                  ? "bg-emerald-700 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {tab.label}{" "}
              <span
                className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${
                  activeTab === tab.key ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                }`}
              >
                {toBanglaNumber(tab.count)}
              </span>
            </button>
          ))}
        </div>

        <div className="relative min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="বিষয় বা বিবরণ খুঁজুন..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Feedback List */}
      {filteredList.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
          <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <HelpCircle className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">কোনো আবেদন পাওয়া যায়নি</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            আপনার কোনো অভিযোগ, পরামর্শ বা শিক্ষক সাক্ষাতকার থাকলে &quot;+ নতুন তৈরি করুন&quot; বোতামে ক্লিক করে আবেদন জমা দিন।
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-700 text-white font-bold hover:bg-emerald-800 transition"
          >
            <MessageSquarePlus className="w-4 h-4" />
            নতুন আবেদন জমা দিন
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredList.map((item) => (
            <div
              key={item.id}
              id={`feedback-card-${item.id}`}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {getTypeBadge(item.action_type)}
                    <span className="text-xs px-2.5 py-0.5 rounded-md font-medium bg-slate-100 text-slate-600">
                      {item.category}
                    </span>
                    {item.urgency === "Urgent" && (
                      <span className="text-xs px-2 py-0.5 rounded-md font-bold bg-rose-100 text-rose-700">
                        জরুরি
                      </span>
                    )}
                  </div>
                  {getStatusBadge(item.status)}
                </div>

                <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug mb-2">
                  {item.subject}
                </h3>

                <p className="text-xs sm:text-sm text-slate-600 line-clamp-3 leading-relaxed mb-4">
                  {item.description}
                </p>

                {item.action_type === "APPOINTMENT" && (item.preferred_date || item.target_person) && (
                  <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-100 text-purple-900 text-xs flex flex-wrap items-center gap-4 mb-3">
                    {item.target_person && (
                      <span className="flex items-center gap-1 font-semibold">
                        <User className="w-3.5 h-3.5 text-purple-600" />
                        উদ্দেশ্য: {item.target_person}
                      </span>
                    )}
                    {item.preferred_date && (
                      <span className="flex items-center gap-1 font-semibold">
                        <Calendar className="w-3.5 h-3.5 text-purple-600" />
                        তারিখ: {item.preferred_date} {item.preferred_time && `(${item.preferred_time})`}
                      </span>
                    )}
                  </div>
                )}

                {/* Official Response Box if resolved */}
                {item.official_response && (
                  <div className="mt-3 p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200 text-emerald-950">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 mb-1">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      মাদরাসা কর্তৃপক্ষের উত্তর ({item.responded_by || "প্রশাসন"}):
                    </div>
                    <p className="text-xs sm:text-sm text-emerald-900 leading-relaxed font-medium">
                      {item.official_response}
                    </p>
                  </div>
                )}
              </div>

              {/* Card Footer */}
              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <div className="flex items-center gap-2">
                  <span>তারিখ: {new Date(item.created_at).toLocaleDateString("bn-BD")}</span>
                  {item.student_name && (
                    <>
                      <span>•</span>
                      <span className="font-semibold text-slate-700">{item.student_name}</span>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setViewDetailItem(item)}
                    className="px-3 py-1.5 rounded-lg font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 transition"
                  >
                    বিস্তারিত
                  </button>
                  {item.status === "PENDING" && (
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition"
                      title="মুছে ফেলুন"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: New Feedback / Complaint / Appointment */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <MessageSquarePlus className="w-5 h-5 text-emerald-600" />
                  নতুন আবেদন ও মতামত প্রদান
                </h3>
                <p className="text-xs text-slate-500">সরাসরি মাদরাসা প্রশাসন ও শিক্ষকের নিকট পৌঁছাবে</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
              {/* Action Type */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">আবেদনের ধরন নির্বাচন করুন *</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: "SUGGESTION", label: "পরামর্শ", desc: "উন্নয়নমূলক মতামত" },
                    { key: "COMPLAINT", label: "অভিযোগ", desc: "কোনো সমস্যা" },
                    { key: "APPOINTMENT", label: "সাক্ষাতকার", desc: "মুহতামিম/শিক্ষক" },
                  ].map((t) => (
                    <button
                      type="button"
                      key={t.key}
                      onClick={() => setActionType(t.key as any)}
                      className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                        actionType === t.key
                          ? "border-emerald-600 bg-emerald-50 text-emerald-950 font-bold ring-2 ring-emerald-400/30"
                          : "border-slate-200 hover:bg-slate-50 text-slate-700 font-medium"
                      }`}
                    >
                      <div className="text-xs font-bold">{t.label}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{t.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Student Selector */}
              {students.length > 0 && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">সংশ্লিষ্ট শিক্ষার্থী (যদি থাকে)</label>
                  <select
                    value={selectedStudentId}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500 font-medium text-slate-800"
                  >
                    <option value="">সাধারণ মাদরাসা সংক্রান্ত (নির্দিষ্ট ছাত্র নেই)</option>
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.first_name} {s.last_name} (রোল: {s.roll_number || "১"} - {s.class_name || s.classes?.name || "জামাত"})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">ক্যাটেগরি *</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="পড়াশোনা ও হিফজ">পড়াশোনা ও হিফজ সবক</option>
                    <option value="বোর্ডিং ও খাবার">বোর্ডিং, খাবার ও আবাসন</option>
                    <option value="স্বাস্থ্য ও আচরণ">স্বাস্থ্য ও ছাত্রের আচরণ</option>
                    <option value="ফি ও হিসাব">ফি ও পেমেন্ট সংক্রান্ত</option>
                    <option value="ছুটি ও হাজিরা">ছুটি ও হাজিরা</option>
                    <option value="অন্যান্য">অন্যান্য সাধারণ বিষয়</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">জরুরি মাত্রা</label>
                  <select
                    value={urgency}
                    onChange={(e) => setUrgency(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="Normal">সাধারণ</option>
                    <option value="Important">জরুরি</option>
                    <option value="Urgent">অতি জরুরি</option>
                  </select>
                </div>
              </div>

              {/* Appointment Specific Fields */}
              {actionType === "APPOINTMENT" && (
                <div className="p-3.5 rounded-xl bg-purple-50/60 border border-purple-200 space-y-3">
                  <div className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-purple-600" />
                    সাক্ষাতকারের বিস্তারিত সময় নির্ধারণ
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-purple-800 mb-0.5">কার সাথে সাক্ষাত?</label>
                      <select
                        value={targetPerson}
                        onChange={(e) => setTargetPerson(e.target.value)}
                        className="w-full px-2 py-1.5 text-xs rounded-lg border border-purple-200 bg-white"
                      >
                        <option value="মুহতামিম সাহেব">মুহতামিম সাহেব</option>
                        <option value="শ্রেণি শিক্ষক">শ্রেণি শিক্ষক</option>
                        <option value="হিফজ উস্তাদ">হিফজ উস্তাদ</option>
                        <option value="নাজেমে তালিমাত">নাজেমে তালিমাত</option>
                        <option value="হিসাবরক্ষক">হিসাবরক্ষক</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-purple-800 mb-0.5">কাঙ্ক্ষিত তারিখ</label>
                      <input
                        type="date"
                        value={preferredDate}
                        onChange={(e) => setPreferredDate(e.target.value)}
                        className="w-full px-2 py-1.5 text-xs rounded-lg border border-purple-200 bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-purple-800 mb-0.5">সম্ভাব্য সময়</label>
                      <input
                        type="time"
                        value={preferredTime}
                        onChange={(e) => setPreferredTime(e.target.value)}
                        className="w-full px-2 py-1.5 text-xs rounded-lg border border-purple-200 bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Subject */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">বিষয় / শিরোনাম *</label>
                <input
                  type="text"
                  required
                  placeholder="সংক্ষেপে মূল বিষয়টি লিখুন..."
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">বিস্তারিত বিবরণ *</label>
                <textarea
                  required
                  rows={4}
                  placeholder="আপনার বক্তব্য বা সমস্যা স্পষ্ট করে তুলে ধরুন..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-emerald-500 leading-relaxed font-medium"
                />
              </div>

              {/* Contact Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">আপনার নাম</label>
                  <input
                    type="text"
                    value={guardianName}
                    onChange={(e) => setGuardianName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">যোগাযোগের ফোন নম্বর</label>
                  <input
                    type="text"
                    placeholder="০১XXXXXXXXX"
                    value={guardianPhone}
                    onChange={(e) => setGuardianPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200"
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold transition cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold transition flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                >
                  {isSubmitting ? (
                    "জমা হচ্ছে..."
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      আবেদন জমা দিন
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: View Full Details */}
      {viewDetailItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-start justify-between pb-4 border-b border-slate-100 mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  {getTypeBadge(viewDetailItem.action_type)}
                  {getStatusBadge(viewDetailItem.status)}
                </div>
                <h3 className="text-lg font-bold text-slate-900">{viewDetailItem.subject}</h3>
              </div>
              <button
                onClick={() => setViewDetailItem(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs sm:text-sm">
              <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-xl">
                <div>
                  <span className="text-slate-500">ক্যাটেগরি:</span>{" "}
                  <span className="font-bold text-slate-800">{viewDetailItem.category}</span>
                </div>
                <div>
                  <span className="text-slate-500">জরুরি মাত্রা:</span>{" "}
                  <span className="font-bold text-slate-800">{viewDetailItem.urgency_bangla}</span>
                </div>
                <div>
                  <span className="text-slate-500">শিক্ষার্থী:</span>{" "}
                  <span className="font-bold text-slate-800">{viewDetailItem.student_name || "প্রযোজ্য নয়"}</span>
                </div>
                <div>
                  <span className="text-slate-500">তারিখ:</span>{" "}
                  <span className="font-bold text-slate-800">
                    {new Date(viewDetailItem.created_at).toLocaleDateString("bn-BD")}
                  </span>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-700 mb-1">আবেদনের পূর্ণ বিবরণ:</h4>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 leading-relaxed whitespace-pre-wrap font-medium">
                  {viewDetailItem.description}
                </div>
              </div>

              {viewDetailItem.official_response ? (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 mb-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    মাদরাসা কর্তৃপক্ষের সমাধান ও মতামত:
                  </div>
                  <p className="text-slate-900 leading-relaxed font-medium">
                    {viewDetailItem.official_response}
                  </p>
                  <div className="mt-2 pt-2 border-t border-emerald-200/60 flex items-center justify-between text-[11px] text-emerald-700 font-semibold">
                    <span>প্রদানকারী: {viewDetailItem.responded_by || "মাদরাসা প্রশাসন"}</span>
                    {viewDetailItem.responded_at && (
                      <span>সময়: {new Date(viewDetailItem.responded_at).toLocaleDateString("bn-BD")}</span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                  <Clock3 className="w-4 h-4 shrink-0" />
                  কর্তৃপক্ষ এখনো এই আবেদনে পদক্ষেপ গ্রহণ করেনি। পর্যালোচনার পর এখানে সমাধান দৃশ্যমান হবে।
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setViewDetailItem(null)}
                  className="px-5 py-2 rounded-xl bg-slate-800 text-white font-bold hover:bg-slate-700 transition"
                >
                  বন্ধ করুন
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
