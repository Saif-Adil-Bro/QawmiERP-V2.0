"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ShieldAlert,
  RefreshCw,
  Search,
  Filter,
  ArrowLeft,
  PhoneCall,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Users,
  BookOpen,
  Wallet,
  UserCheck,
  X,
  Send,
} from "lucide-react";
import type {
  EarlyWarningSummary,
  InterventionStatus,
  RiskDistribution,
  RiskLevel,
  StudentRiskScoreRecord,
} from "@/lib/early-warning";
import {
  recalculateEarlyWarningAction,
  updateRiskInterventionAction,
} from "@/app/actions/early-warning";
import { toBanglaNumber } from "@/lib/numberToBangla";

interface EarlyWarningDashboardClientProps {
  initialSummary: EarlyWarningSummary;
  initialScores: StudentRiskScoreRecord[];
}

const RISK_META: Record<
  RiskLevel,
  { label: string; badgeClass: string; barClass: string }
> = {
  CRITICAL: {
    label: "অতি-উচ্চ (Critical)",
    badgeClass:
      "bg-rose-600 text-white dark:bg-rose-500/90",
    barClass: "bg-rose-600",
  },
  HIGH: {
    label: "উচ্চ (High)",
    badgeClass:
      "bg-orange-500 text-white dark:bg-orange-500/90",
    barClass: "bg-orange-500",
  },
  MEDIUM: {
    label: "মাঝারি (Medium)",
    badgeClass:
      "bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-700/60",
    barClass: "bg-amber-500",
  },
  LOW: {
    label: "কম (Low)",
    badgeClass:
      "bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-700/60",
    barClass: "bg-emerald-500",
  },
};

const INTERVENTION_OPTIONS: { value: InterventionStatus; label: string }[] = [
  { value: "PENDING", label: "অপেক্ষমাণ (Pending)" },
  { value: "CONTACTED", label: "অভিভাবককে জানানো হয়েছে" },
  { value: "IN_PROGRESS", label: "তদারকি চলমান (In Progress)" },
  { value: "RESOLVED", label: "সমাধান হয়েছে (Resolved)" },
  { value: "DISMISSED", label: "বাতিল (Dismissed)" },
];

export default function EarlyWarningDashboardClient({
  initialSummary,
  initialScores,
}: EarlyWarningDashboardClientProps) {
  const [scores, setScores] = useState<StudentRiskScoreRecord[]>(initialScores);
  const [summary, setSummary] = useState<EarlyWarningSummary>(initialSummary);
  const [selectedClass, setSelectedClass] = useState<string>("ALL");
  const [selectedRisk, setSelectedRisk] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Intervention Modal State
  const [editingStudent, setEditingStudent] =
    useState<StudentRiskScoreRecord | null>(null);
  const [intStatus, setIntStatus] = useState<InterventionStatus>("IN_PROGRESS");
  const [intNotes, setIntNotes] = useState<string>("");
  const [notifyGuardian, setNotifyGuardian] = useState<boolean>(false);
  const [isSavingInt, setIsSavingInt] = useState<boolean>(false);

  const classOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of scores) {
      if (s.class_id && s.class_name) {
        map.set(s.class_id, s.class_name);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [scores]);

  const distribution: RiskDistribution = useMemo(() => {
    if (scores.length > 0) {
      return {
        CRITICAL: scores.filter((s) => s.risk_level === "CRITICAL").length,
        HIGH: scores.filter((s) => s.risk_level === "HIGH").length,
        MEDIUM: scores.filter((s) => s.risk_level === "MEDIUM").length,
        LOW: scores.filter((s) => s.risk_level === "LOW").length,
        total: scores.length,
      };
    }
    return (
      summary.risk_distribution || {
        CRITICAL: 0,
        HIGH: 0,
        MEDIUM: 0,
        LOW: 0,
        total: 0,
      }
    );
  }, [scores, summary.risk_distribution]);

  const filteredScores = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return scores.filter((s) => {
      if (selectedClass !== "ALL" && s.class_id !== selectedClass) return false;
      if (selectedRisk !== "ALL" && s.risk_level !== selectedRisk) return false;
      if (q) {
        const hay = `${s.student_name || ""} ${s.roll_number || ""} ${
          s.class_name || ""
        }`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [scores, selectedClass, selectedRisk, searchQuery]);

  const handleRecalculate = async () => {
    setIsRecalculating(true);
    setFeedback(null);
    try {
      const res = await recalculateEarlyWarningAction(
        selectedClass !== "ALL" ? selectedClass : undefined
      );
      if (!res.ok || !res.data) {
        setFeedback({
          type: "error",
          text: res.error || "পুনরায় বিশ্লেষণ ব্যর্থ হয়েছে।",
        });
      } else {
        setSummary(res.data);
        if (res.data.risk_scores) {
          setScores(res.data.risk_scores);
        }
        setFeedback({
          type: "success",
          text: `মোট ${toBanglaNumber(
            res.data.risk_scores?.length || 0
          )} জন শিক্ষার্থীর ঝুঁকি স্কোর সফলভাবে পুনরায় বিশ্লেষণ করা হয়েছে।`,
        });
      }
    } catch {
      setFeedback({
        type: "error",
        text: "সার্ভারের সাথে সংযোগ করতে সমস্যা হয়েছে।",
      });
    } finally {
      setIsRecalculating(false);
    }
  };

  const openInterventionModal = (rec: StudentRiskScoreRecord) => {
    setEditingStudent(rec);
    setIntStatus(rec.intervention_status || "PENDING");
    setIntNotes(rec.intervention_notes || "");
    setNotifyGuardian(false);
  };

  const handleSaveIntervention = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    setIsSavingInt(true);
    setFeedback(null);
    try {
      const res = await updateRiskInterventionAction({
        studentId: editingStudent.student_id,
        status: intStatus,
        notes: intNotes,
        notifyGuardian,
      });
      if (!res.ok) {
        setFeedback({
          type: "error",
          text: res.error || "ইন্টারভেনশন আপডেট ব্যর্থ হয়েছে।",
        });
      } else {
        setScores((prev) =>
          prev.map((item) =>
            item.student_id === editingStudent.student_id
              ? {
                  ...item,
                  intervention_status: intStatus,
                  intervention_notes: intNotes,
                  intervened_at: new Date().toISOString(),
                }
              : item
          )
        );
        setFeedback({
          type: "success",
          text: `ইন্টারভেনশন আপডেট সম্পন্ন হয়েছে${
            res.notificationSent ? " এবং অভিভাবককে নোটিফিকেশন পাঠানো হয়েছে।" : "।"
          }`,
        });
        setEditingStudent(null);
      }
    } catch {
      setFeedback({
        type: "error",
        text: "ইন্টারভেনশন সংরক্ষণ করতে সমস্যা হয়েছে।",
      });
    } finally {
      setIsSavingInt(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1 hover:text-rose-600 dark:hover:text-rose-400 transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>ড্যাশবোর্ড</span>
              </Link>
              <span>/</span>
              <span>অ্যানালিটিক্স ও আর্লি ওয়ার্নিং</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">
              AI আর্লি ওয়ার্নিং ও ড্রপআউট ঝুঁকি বিশ্লেষণ
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5">
              হাজিরা (৪০%), একাডেমিক/হিফজ/কিতাব/নূরানী অগ্রগতি (৩০%) ও ফি বকেয়া (৩০%) এর সমন্বিত ০–১০০ রিস্ক স্কোর
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleRecalculate}
          disabled={isRecalculating}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-sm font-bold shadow-xs transition shrink-0"
        >
          <RefreshCw
            className={`w-4 h-4 ${isRecalculating ? "animate-spin" : ""}`}
          />
          <span>
            {isRecalculating ? "বিশ্লেষণ চলছে..." : "পুনরায় বিশ্লেষণ করুন"}
          </span>
        </button>
      </div>

      {/* Feedback Toast */}
      {feedback && (
        <div
          className={`rounded-xl px-4 py-3 text-sm font-semibold flex items-center justify-between border ${
            feedback.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800"
              : "bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-800"
          }`}
        >
          <span>{feedback.text}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="p-1 opacity-70 hover:opacity-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Risk Distribution KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>মোট বিশ্লেষিত শিক্ষার্থী</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-2">
            {toBanglaNumber(distribution.total)}
          </p>
        </div>

        <div className="bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs font-bold text-rose-700 dark:text-rose-300">
            <span>অতি-উচ্চ (Critical)</span>
            <AlertTriangle className="w-4 h-4" />
          </div>
          <p className="text-2xl font-black text-rose-700 dark:text-rose-300 mt-2">
            {toBanglaNumber(distribution.CRITICAL)}
          </p>
        </div>

        <div className="bg-orange-50/70 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900/60 rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs font-bold text-orange-700 dark:text-orange-300">
            <span>উচ্চ (High)</span>
            <ShieldAlert className="w-4 h-4" />
          </div>
          <p className="text-2xl font-black text-orange-700 dark:text-orange-300 mt-2">
            {toBanglaNumber(distribution.HIGH)}
          </p>
        </div>

        <div className="bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs font-bold text-amber-700 dark:text-amber-300">
            <span>মাঝারি (Medium)</span>
            <Clock className="w-4 h-4" />
          </div>
          <p className="text-2xl font-black text-amber-700 dark:text-amber-300 mt-2">
            {toBanglaNumber(distribution.MEDIUM)}
          </p>
        </div>

        <div className="col-span-2 lg:col-span-1 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs font-bold text-emerald-700 dark:text-emerald-300">
            <span>কম ঝুঁকি (Low)</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-2">
            {toBanglaNumber(distribution.LOW)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="শিক্ষার্থীর নাম, রোল বা জামাত খুঁজুন..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <Filter className="w-3.5 h-3.5" />
            <span>ফিল্টার:</span>
          </div>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-semibold text-slate-800 dark:text-slate-200"
          >
            <option value="ALL">সকল জামাত</option>
            {classOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={selectedRisk}
            onChange={(e) => setSelectedRisk(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-semibold text-slate-800 dark:text-slate-200"
          >
            <option value="ALL">সকল ঝুঁকি স্তর</option>
            <option value="CRITICAL">অতি-উচ্চ (Critical)</option>
            <option value="HIGH">উচ্চ (High)</option>
            <option value="MEDIUM">মাঝারি (Medium)</option>
            <option value="LOW">কম (Low)</option>
          </select>
        </div>
      </div>

      {/* Student Risk List */}
      <div className="space-y-3">
        {filteredScores.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center">
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
              নির্বাচিত ফিল্টারে কোনো শিক্ষার্থীর রিস্ক রেকর্ড পাওয়া যায়নি। &ldquo;পুনরায় বিশ্লেষণ করুন&rdquo; বাটনে ক্লিক করে সর্বশেষ স্কোর তৈরি করুন।
            </p>
          </div>
        ) : (
          filteredScores.map((rec) => {
            const meta = RISK_META[rec.risk_level] || RISK_META.LOW;
            const intOpt = INTERVENTION_OPTIONS.find(
              (o) => o.value === rec.intervention_status
            );
            return (
              <div
                key={rec.student_id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs hover:border-rose-300 dark:hover:border-rose-800 transition"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex flex-col items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700">
                      <span className="text-lg font-black text-slate-900 dark:text-slate-100">
                        {toBanglaNumber(Math.round(rec.composite_score))}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                        / ১০০
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                          {rec.student_name || "শিক্ষার্থী"}
                        </h3>
                        {rec.roll_number && (
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold">
                            রোল: {toBanglaNumber(rec.roll_number)}
                          </span>
                        )}
                        {rec.class_name && (
                          <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 text-xs font-semibold">
                            {rec.class_name}
                          </span>
                        )}
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${meta.badgeClass}`}
                        >
                          {meta.label}
                        </span>
                      </div>

                      {/* Sub-scores */}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          <UserCheck className="w-3.5 h-3.5 text-rose-500" />
                          হাজিরা ঝুঁকি: {toBanglaNumber(rec.attendance_score)}/৪০
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <BookOpen className="w-3.5 h-3.5 text-amber-500" />
                          একাডেমিক ঝুঁকি: {toBanglaNumber(rec.academic_score)}/৩০
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Wallet className="w-3.5 h-3.5 text-indigo-500" />
                          ফি বকেয়া ঝুঁকি: {toBanglaNumber(rec.fee_score)}/৩০
                        </span>
                      </div>

                      {/* Factors */}
                      {rec.factors && rec.factors.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {rec.factors.map((f, idx) => (
                            <span
                              key={idx}
                              className="px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs"
                            >
                              {f}
                            </span>
                          ))}
                        </div>
                      )}

                      {rec.intervention_notes && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                          নোট: {rec.intervention_notes}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right Actions */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800">
                    <span className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold">
                      অবস্থা: {intOpt?.label || rec.intervention_status}
                    </span>
                    {rec.parent_phone && (
                      <a
                        href={`tel:${rec.parent_phone}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition"
                      >
                        <PhoneCall className="w-3.5 h-3.5" />
                        <span>{rec.parent_phone}</span>
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => openInterventionModal(rec)}
                      className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition"
                    >
                      ইন্টারভেনশন আপডেট
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Intervention Tracker Modal */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                  ইন্টারভেনশন ট্র্যাকার
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {editingStudent.student_name} ({editingStudent.class_name || "সাধারণ জামাত"})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingStudent(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveIntervention} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  ইন্টারভেনশন অবস্থা
                </label>
                <select
                  value={intStatus}
                  onChange={(e) =>
                    setIntStatus(e.target.value as InterventionStatus)
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100"
                >
                  {INTERVENTION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  তদারকি নোট / গৃহীত পদক্ষেপ
                </label>
                <textarea
                  rows={3}
                  value={intNotes}
                  onChange={(e) => setIntNotes(e.target.value)}
                  placeholder="যেমন: অভিভাবকের সাথে ফোনে কথা হয়েছে, আগামী শনিবার মাদরাসায় আসবেন..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100"
                />
              </div>

              <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifyGuardian}
                  onChange={(e) => setNotifyGuardian(e.target.checked)}
                  className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  অভিভাবককে স্বয়ংক্রিয় সতর্কবার্তা নোটিফিকেশন (SMS/WhatsApp) পাঠান
                </span>
              </label>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isSavingInt}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-xs font-bold transition"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSavingInt ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ করুন"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
