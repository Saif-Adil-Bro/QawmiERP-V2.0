"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Calendar,
  Plus,
  Edit,
  Archive,
  ArchiveRestore,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Users,
  GraduationCap,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Check,
  X,
  Loader2,
  Clock,
  RefreshCw,
} from "lucide-react";
import { AcademicSession } from "@/lib/sessions";
import {
  createAcademicSession,
  updateAcademicSession,
  setCurrentAcademicSession,
  archiveAcademicSession,
  unarchiveAcademicSession,
  deleteAcademicSession,
  syncExistingStudentsWithCurrentSession,
} from "@/app/actions/sessions";
import { useSession } from "@/components/sessions/SessionContext";

interface SessionsClientProps {
  initialSessions: AcademicSession[];
  studentCounts: Record<string, number>;
}

export default function SessionsClient({
  initialSessions,
  studentCounts,
}: SessionsClientProps) {
  const router = useRouter();
  const { refreshSessions, changeSelectedSession } = useSession();

  const [sessions, setSessions] = useState<AcademicSession[]>(initialSessions);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const [selectedSession, setSelectedSession] = useState<AcademicSession | null>(null);

  // Form states for Create/Edit
  const [formName, setFormName] = useState("");
  const [formAcademicYear, setFormAcademicYear] = useState("");
  const [formHijriYear, setFormHijriYear] = useState("");
  const [formStartDate, setFormStartDate] = useState("");
  const [formEndDate, setFormEndDate] = useState("");
  const [formIsCurrent, setFormIsCurrent] = useState(false);
  const [formDescription, setFormDescription] = useState("");
  const [formError, setFormError] = useState("");

  const currentSession = sessions.find((s) => s.is_current) || sessions[0];
  const previousSessions = sessions.filter((s) => s.id !== currentSession?.id);

  const showFeedback = (type: "success" | "error", text: string) => {
    setFeedback({ type, text });
    setTimeout(() => setFeedback(null), 5000);
  };

  // Open Create Modal with default suggestions
  const handleOpenCreate = () => {
    setFormError("");
    setFormName("১৪৪৮-৪৯ হিজরি");
    setFormAcademicYear("২০২৭-২৮");
    setFormHijriYear("১৪৪৮-৪৯");
    setFormStartDate("2027-04-10");
    setFormEndDate("2028-03-30");
    setFormIsCurrent(false);
    setFormDescription("");
    setCreateModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (session: AcademicSession) => {
    setSelectedSession(session);
    setFormError("");
    setFormName(session.name);
    setFormAcademicYear(session.academic_year);
    setFormHijriYear(session.hijri_year || session.name);
    setFormStartDate(session.start_date || "");
    setFormEndDate(session.end_date || "");
    setFormIsCurrent(session.is_current);
    setFormDescription(session.description || "");
    setEditModalOpen(true);
  };

  // Open Archive Modal
  const handleOpenArchive = (session: AcademicSession) => {
    setSelectedSession(session);
    setArchiveModalOpen(true);
  };

  // Open Delete Modal
  const handleOpenDelete = (session: AcademicSession) => {
    setSelectedSession(session);
    setDeleteModalOpen(true);
  };

  // Submit Create Session
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setLoading(true);

    const formData = new FormData();
    formData.append("name", formName);
    formData.append("academic_year", formAcademicYear);
    formData.append("hijri_year", formHijriYear);
    formData.append("start_date", formStartDate);
    formData.append("end_date", formEndDate);
    formData.append("is_current", formIsCurrent ? "true" : "false");
    formData.append("description", formDescription);

    const res = await createAcademicSession(null, formData);
    setLoading(false);

    if (res.error) {
      setFormError(res.error);
    } else {
      setCreateModalOpen(false);
      showFeedback("success", `"${formName}" সফলভাবে তৈরি হয়েছে!`);
      await refreshSessions();
      router.refresh();
    }
  };

  // Submit Edit Session
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSession) return;
    setFormError("");
    setLoading(true);

    const formData = new FormData();
    formData.append("id", selectedSession.id);
    formData.append("name", formName);
    formData.append("academic_year", formAcademicYear);
    formData.append("hijri_year", formHijriYear);
    formData.append("start_date", formStartDate);
    formData.append("end_date", formEndDate);
    formData.append("is_current", formIsCurrent ? "true" : "false");
    formData.append("status", selectedSession.status);
    formData.append("description", formDescription);

    const res = await updateAcademicSession(null, formData);
    setLoading(false);

    if (res.error) {
      setFormError(res.error);
    } else {
      setEditModalOpen(false);
      showFeedback("success", `"${formName}" সফলভাবে আপডেট হয়েছে!`);
      await refreshSessions();
      router.refresh();
    }
  };

  // Set Current Session
  const handleSetCurrent = async (session: AcademicSession) => {
    setLoading(true);
    const res = await setCurrentAcademicSession(session.id);
    setLoading(false);

    if (res.error) {
      showFeedback("error", res.error);
    } else {
      showFeedback("success", res.message || `"${session.name}" বর্তমান সেশন হিসেবে সেট করা হয়েছে।`);
      await changeSelectedSession(session.id);
      await refreshSessions();
      router.refresh();
    }
  };

  // Archive Session
  const handleArchiveConfirm = async () => {
    if (!selectedSession) return;
    setLoading(true);
    const res = await archiveAcademicSession(selectedSession.id);
    setLoading(false);
    setArchiveModalOpen(false);

    if (res.error) {
      showFeedback("error", res.error);
    } else {
      showFeedback("success", res.message || `"${selectedSession.name}" আর্কাইভ করা হয়েছে।`);
      await refreshSessions();
      router.refresh();
    }
  };

  // Unarchive Session
  const handleUnarchive = async (session: AcademicSession) => {
    setLoading(true);
    const res = await unarchiveAcademicSession(session.id);
    setLoading(false);

    if (res.error) {
      showFeedback("error", res.error);
    } else {
      showFeedback("success", res.message || `"${session.name}" সক্রিয় করা হয়েছে।`);
      await refreshSessions();
      router.refresh();
    }
  };

  // Delete Session
  const handleDeleteConfirm = async () => {
    if (!selectedSession) return;
    setLoading(true);
    const res = await deleteAcademicSession(selectedSession.id);
    setLoading(false);
    setDeleteModalOpen(false);

    if (res.error) {
      showFeedback("error", res.error);
    } else {
      showFeedback("success", res.message || "শিক্ষাবর্ষটি মুছে ফেলা হয়েছে।");
      await refreshSessions();
      router.refresh();
    }
  };

  // Sync unlinked students
  const handleSyncStudents = async () => {
    setLoading(true);
    const res = await syncExistingStudentsWithCurrentSession();
    setLoading(false);

    if (res.error) {
      showFeedback("error", res.error);
    } else {
      showFeedback("success", res.message || "শিক্ষার্থীদের ডাটা সিঙ্ক সম্পন্ন হয়েছে।");
      router.refresh();
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-3 ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
              : "bg-rose-50 text-rose-900 border border-rose-200"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span className="text-sm font-medium">{feedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">শিক্ষাবর্ষ</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            শিক্ষাবর্ষ পরিচালনা ও বর্তমান সেশন নির্বাচন করুন
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleSyncStudents}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-semibold rounded-xl transition cursor-pointer disabled:opacity-50"
            title="বর্তমান সেশনে অনিবন্ধিত শিক্ষার্থীদের সিঙ্ক করুন"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span>ডাটা সিঙ্ক</span>
          </button>

          <Link
            href="/dashboard/students/promotion"
            className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs sm:text-sm font-semibold rounded-xl border border-emerald-200 transition"
          >
            <GraduationCap className="w-4 h-4 text-emerald-600" />
            <span>শিক্ষার্থী প্রমোশন</span>
          </Link>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold rounded-xl transition shadow-2xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ নতুন শিক্ষাবর্ষ</span>
          </button>
        </div>
      </div>

      {/* Prominent Current Session Card */}
      {currentSession && (
        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-900 via-slate-900 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-lg border border-emerald-700/40">
          {/* Background subtle art glow */}
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/20 border border-emerald-400/30 rounded-full text-emerald-300 text-xs font-bold tracking-wide">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
                <span>বর্তমান শিক্ষাবর্ষ (CURRENT ACTIVE SESSION)</span>
              </div>

              <div>
                <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
                  {currentSession.name}
                </h2>
                <p className="text-emerald-200/90 text-sm sm:text-base font-medium mt-1">
                  {currentSession.academic_year} শিক্ষাবর্ষ • হিজরি: {currentSession.hijri_year}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 pt-1">
                <div className="flex items-center gap-1.5 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>
                    শুরু: <strong>{currentSession.start_date || "০১ শাওয়াল"}</strong>
                  </span>
                  <span>—</span>
                  <span>
                    শেষ: <strong>{currentSession.end_date || "৩০ রমজান"}</strong>
                  </span>
                </div>

                <div className="flex items-center gap-1.5 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
                  <Users className="w-3.5 h-3.5 text-emerald-400" />
                  <span>
                    মোট শিক্ষার্থী:{" "}
                    <strong>{studentCounts[currentSession.id] ?? "সিঙ্ককৃত"}</strong>
                  </span>
                </div>
              </div>

              {currentSession.description && (
                <p className="text-xs text-slate-400 italic">{currentSession.description}</p>
              )}
            </div>

            <div className="flex flex-wrap md:flex-col gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => handleOpenEdit(currentSession)}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white text-slate-900 hover:bg-slate-100 text-xs sm:text-sm font-bold rounded-xl transition shadow cursor-pointer"
              >
                <Edit className="w-4 h-4 text-emerald-700" />
                <span>সম্পাদনা করুন</span>
              </button>

              <Link
                href="/dashboard/students/promotion"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold rounded-xl transition shadow cursor-pointer"
              >
                <GraduationCap className="w-4 h-4" />
                <span>প্রমোশন পরিচালনা</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Previous / Other Sessions Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Archive className="w-5 h-5 text-slate-500" />
            <span>অন্যান্য ও পূর্ববর্তী শিক্ষাবর্ষ ({previousSessions.length})</span>
          </h3>
        </div>

        {previousSessions.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-300 p-6 text-slate-500">
            <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="font-semibold text-slate-700">কোনো পূর্ববর্তী শিক্ষাবর্ষ পাওয়া যায়নি</p>
            <p className="text-xs text-slate-400 mt-1">
              নতুন বছর শুরু হলে "+ নতুন শিক্ষাবর্ষ" বাটনে ক্লিক করে নতুন সেশন তৈরি করুন।
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {previousSessions.map((session) => {
              const isArchived = session.status === "ARCHIVED";
              const count = studentCounts[session.id] ?? 0;

              return (
                <div
                  key={session.id}
                  className={`bg-white rounded-2xl p-5 border transition-all hover:shadow-md flex flex-col justify-between ${
                    isArchived
                      ? "border-slate-200 bg-slate-50/50"
                      : "border-slate-200"
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-bold text-slate-900">{session.name}</h4>
                          {isArchived ? (
                            <span className="px-2 py-0.5 bg-slate-200 text-slate-700 text-[10px] font-bold rounded-md uppercase">
                              সংরক্ষিত / ARCHIVED
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-md uppercase">
                              সক্রিয় / ACTIVE
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {session.academic_year} শিক্ষাবর্ষ • {session.hijri_year}
                        </p>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(session)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                          title="সম্পাদনা করুন"
                        >
                          <Edit className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenDelete(session)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="মুছে ফেলুন"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-white p-3 rounded-xl border border-slate-100">
                      <div>
                        <span className="text-slate-400 block text-[11px]">মেয়াদকাল:</span>
                        <span className="font-medium text-slate-800 truncate block">
                          {session.start_date || "-"} থেকে {session.end_date || "-"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">শিক্ষার্থী সংখ্যা:</span>
                        <span className="font-bold text-emerald-700">{count} জন</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-4 mt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleSetCurrent(session)}
                      disabled={loading}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>বর্তমান সেশন করুন</span>
                    </button>

                    {isArchived ? (
                      <button
                        type="button"
                        onClick={() => handleUnarchive(session)}
                        disabled={loading}
                        className="inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900 font-medium cursor-pointer"
                      >
                        <ArchiveRestore className="w-3.5 h-3.5" />
                        <span>পুনরায় সক্রিয় করুন</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleOpenArchive(session)}
                        disabled={loading}
                        className="inline-flex items-center gap-1 text-xs text-amber-700 hover:text-amber-800 font-medium cursor-pointer"
                      >
                        <Archive className="w-3.5 h-3.5" />
                        <span>Archive করুন</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* CREATE SESSION MODAL */}
      {/* ========================================================================= */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
              <div>
                <h3 className="text-xl font-bold text-slate-900">নতুন শিক্ষাবর্ষ তৈরি করুন</h3>
                <p className="text-xs text-slate-500 mt-0.5">নতুন শিক্ষাবর্ষের তথ্য প্রদান করুন</p>
              </div>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl mb-4">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  শিক্ষাবর্ষের নাম <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="যেমন: ১৪৪৮-৪৯ হিজরি"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Academic Year (ইংরেজি) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="যেমন: ২০২৭-২৮"
                    value={formAcademicYear}
                    onChange={(e) => setFormAcademicYear(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Hijri Year (হিজরি সন)
                  </label>
                  <input
                    type="text"
                    placeholder="যেমন: ১৪৪৮-৪৯"
                    value={formHijriYear}
                    onChange={(e) => setFormHijriYear(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    শুরুর তারিখ <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    শেষের তারিখ <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-3 p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsCurrent}
                    onChange={(e) => setFormIsCurrent(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-emerald-950 block">এটিকে বর্তমান শিক্ষাবর্ষ করুন</span>
                    <span className="text-slate-500">
                      সিস্টেমের সকল রানিং শিক্ষার্থী ও উপস্থিতি এই সেশনে গণনা করা হবে
                    </span>
                  </div>
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  বিবরণ / নোট (ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  placeholder="যেমন: নিয়মিত শিক্ষাবর্ষ"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>সংরক্ষণ করুন</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* EDIT SESSION MODAL */}
      {/* ========================================================================= */}
      {editModalOpen && selectedSession && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
              <div>
                <h3 className="text-xl font-bold text-slate-900">শিক্ষাবর্ষ সম্পাদনা</h3>
                <p className="text-xs text-slate-500 mt-0.5">{selectedSession.name} এর তথ্য পরিবর্তন করুন</p>
              </div>
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl mb-4">
                {formError}
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  শিক্ষাবর্ষের নাম <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Academic Year (ইংরেজি) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formAcademicYear}
                    onChange={(e) => setFormAcademicYear(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Hijri Year (হিজরি সন)
                  </label>
                  <input
                    type="text"
                    value={formHijriYear}
                    onChange={(e) => setFormHijriYear(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    শুরুর তারিখ <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    শেষের তারিখ <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsCurrent}
                    onChange={(e) => setFormIsCurrent(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
                  />
                  <div className="text-xs">
                    <span className="font-bold text-slate-900 block">বর্তমান শিক্ষাবর্ষ হিসেবে নির্ধারণ করুন</span>
                    <span className="text-slate-500">অন্যান্য সেশন স্বয়ংক্রিয়ভাবে অ-বর্তমান হয়ে যাবে</span>
                  </div>
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  বিবরণ / নোট
                </label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>আপডেট করুন</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ARCHIVE CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {archiveModalOpen && selectedSession && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mb-4">
              <Archive className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-slate-900">শিক্ষাবর্ষ আর্কাইভ নিশ্চিতকরণ</h3>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">
              এই শিক্ষাবর্ষ <strong>({selectedSession.name})</strong> Archive করলে এটি আর Current হিসেবে ব্যবহার করা যাবে না। তবে এর সকল শিক্ষার্থী, ফলাফল, হাজিরা ও অর্থনৈতিক তথ্য সম্পূর্ণ সংরক্ষিত থাকবে।
            </p>

            <div className="flex items-center justify-end gap-3 pt-6 mt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setArchiveModalOpen(false)}
                className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={handleArchiveConfirm}
                disabled={loading}
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition cursor-pointer disabled:opacity-50"
              >
                Archive করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DELETE CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {deleteModalOpen && selectedSession && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-slate-900">শিক্ষাবর্ষ মুছে ফেলার সতর্কতা</h3>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">
              আপনি কি নিশ্চিতভাবে <strong>"{selectedSession.name}"</strong> মুছে ফেলতে চান?
            </p>
            <p className="text-xs text-rose-600 mt-2 bg-rose-50 p-2.5 rounded-lg border border-rose-100">
              সতর্কতা: যদি এতে শিক্ষার্থীদের কোনো পূর্ববর্তী ডাটা থাকে, তবে ডাটা সংরক্ষণের জন্য মুছে ফেলার পরিবর্তে "Archive" করা বাধ্যতামূলক।
            </p>

            <div className="flex items-center justify-end gap-3 pt-6 mt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={loading}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition cursor-pointer disabled:opacity-50"
              >
                মুছে ফেলুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
