"use client";

import { useState } from "react";
import Link from "next/link";
import {
  TrendingDown,
  UserX,
  PhoneCall,
  Sparkles,
  ChevronRight,
  ShieldAlert,
  MessageSquare,
  ArrowDownRight,
  CheckCircle2,
  Activity,
} from "lucide-react";
import {
  EarlyWarningSummary,
  InterventionStatus,
  RiskLevel,
} from "@/lib/early-warning";
import { toBanglaNumber } from "@/lib/numberToBangla";

interface EarlyWarningWidgetProps {
  initialData: EarlyWarningSummary;
  isTeacherView?: boolean;
}

const RISK_LEVEL_BADGE: Record<
  RiskLevel,
  { label: string; className: string }
> = {
  CRITICAL: {
    label: "অতি-উচ্চ ঝুঁকি",
    className:
      "bg-rose-600 text-white dark:bg-rose-500/90 dark:text-white",
  },
  HIGH: {
    label: "উচ্চ ঝুঁকি",
    className:
      "bg-orange-500 text-white dark:bg-orange-500/85 dark:text-white",
  },
  MEDIUM: {
    label: "মাঝারি ঝুঁকি",
    className:
      "bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-700/60",
  },
  LOW: {
    label: "কম ঝুঁকি",
    className:
      "bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-700/60",
  },
};

const INTERVENTION_LABEL: Record<InterventionStatus, string> = {
  PENDING: "অপেক্ষমাণ",
  CONTACTED: "যোগাযোগ হয়েছে",
  IN_PROGRESS: "চলমান",
  RESOLVED: "সমাধান হয়েছে",
  DISMISSED: "বাতিল",
};

export default function EarlyWarningWidget({
  initialData,
  isTeacherView = false,
}: EarlyWarningWidgetProps) {
  const [activeTab, setActiveTab] = useState<
    "ALL" | "COMPOSITE" | "ATTENDANCE" | "EXAM"
  >("ALL");
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);

  const {
    attendance_alerts = [],
    exam_drop_alerts = [],
    risk_scores = [],
    risk_distribution,
  } = initialData || {};

  const elevatedComposite = risk_scores.filter(
    (s) => s.risk_level === "CRITICAL" || s.risk_level === "HIGH"
  );
  const totalAlerts =
    (attendance_alerts?.length || 0) + (exam_drop_alerts?.length || 0);
  const hasAnyRiskData = totalAlerts > 0 || elevatedComposite.length > 0;

  if (!hasAnyRiskData) {
    return (
      <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-700 dark:text-emerald-400 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-emerald-950 dark:text-emerald-200 text-sm">
              আলহামদুলিল্লাহ! কোনো শিক্ষার্থী ঝুঁকিপূর্ণ তালিকায় নেই
            </h4>
            <p className="text-xs text-emerald-700 dark:text-emerald-400/90 mt-0.5">
              সব শিক্ষার্থীর হাজিরা, একাডেমিক অগ্রগতি ও ফি পরিশোধ সন্তোষজনক গতিতে চলছে।
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/analytics/early-warning"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition self-start sm:self-center shrink-0"
        >
          <span>বিস্তারিত ড্যাশবোর্ড</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    );
  }

  const handleCopyPhone = (phone: string) => {
    navigator.clipboard.writeText(phone);
    setCopiedPhone(phone);
    setTimeout(() => setCopiedPhone(null), 2500);
  };

  const displayCount = Math.max(totalAlerts, elevatedComposite.length);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-rose-200/80 dark:border-rose-900/60 shadow-md shadow-rose-950/5 overflow-hidden">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-rose-600 via-red-600 to-rose-700 text-white p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-white shrink-0">
            <ShieldAlert className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 text-rose-100 text-[11px] font-bold mb-1">
              <Sparkles className="w-3 h-3" />
              <span>AI স্মার্ট অ্যানালিটিক্স ও সতর্কতা (Early Warning)</span>
            </div>
            <h3 className="font-bold text-base sm:text-lg tracking-tight">
              {isTeacherView
                ? "আপনার ক্লাসের দুর্বল ও ড্রপআউট ঝুঁকিপূর্ণ শিক্ষার্থী"
                : "দুর্বল শিক্ষার্থী লাল সতর্কবার্তা (Early Warning System)"}
            </h3>
            <p className="text-xs text-rose-100/90 mt-0.5">
              হাজিরা, একাডেমিক অগ্রগতি ও ফি বকেয়ার সমন্বিত রিস্ক স্কোর এবং তাৎক্ষণিক সতর্কতা
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-center shrink-0">
          <span className="px-3 py-1 bg-white text-rose-700 rounded-full text-xs font-black shadow-xs">
            {toBanglaNumber(displayCount)} জন শিক্ষার্থী নজরে রাখা প্রয়োজন
          </span>
          <Link
            href="/dashboard/analytics/early-warning"
            className="inline-flex items-center gap-1 px-3 py-1 bg-rose-900/40 hover:bg-rose-900/60 border border-white/25 text-white rounded-full text-xs font-bold transition"
          >
            <span>পূর্ণ ড্যাশবোর্ড</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Risk Distribution Summary Pills */}
      {risk_distribution && risk_distribution.total > 0 && (
        <div className="bg-slate-50/90 dark:bg-slate-950/60 border-b border-rose-100 dark:border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-slate-600 dark:text-slate-400">
              সমন্বিত রিস্ক ডিস্ট্রিবিউশন:
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 font-bold">
              অতি-উচ্চ (Critical): {toBanglaNumber(risk_distribution.CRITICAL)}
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800/60 font-bold">
              উচ্চ (High): {toBanglaNumber(risk_distribution.HIGH)}
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 font-bold">
              মাঝারি (Medium): {toBanglaNumber(risk_distribution.MEDIUM)}
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 font-bold">
              কম (Low): {toBanglaNumber(risk_distribution.LOW)}
            </span>
          </div>
          <Link
            href="/dashboard/analytics/early-warning"
            className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline inline-flex items-center gap-1"
          >
            <span>ইন্টারভেনশন ট্র্যাকার</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="bg-rose-50/50 dark:bg-slate-800/50 border-b border-rose-100 dark:border-slate-800 px-4 py-2.5 flex items-center justify-between gap-2 overflow-x-auto text-xs">
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("ALL")}
            className={`px-3 py-1.5 rounded-lg font-bold transition ${
              activeTab === "ALL"
                ? "bg-rose-600 text-white shadow-xs"
                : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-rose-100/60 dark:hover:bg-slate-800 border border-rose-200/60 dark:border-slate-700"
            }`}
          >
            সব সতর্কবার্তা ({toBanglaNumber(totalAlerts)})
          </button>
          {risk_scores.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveTab("COMPOSITE")}
              className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
                activeTab === "COMPOSITE"
                  ? "bg-rose-600 text-white shadow-xs"
                  : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-rose-100/60 dark:hover:bg-slate-800 border border-rose-200/60 dark:border-slate-700"
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
              <span>কম্পোজিট রিস্ক ({toBanglaNumber(risk_scores.length)})</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveTab("ATTENDANCE")}
            className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
              activeTab === "ATTENDANCE"
                ? "bg-rose-600 text-white shadow-xs"
                : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-rose-100/60 dark:hover:bg-slate-800 border border-rose-200/60 dark:border-slate-700"
            }`}
          >
            <UserX className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
            <span>হাজিরা ড্রপ ({toBanglaNumber(attendance_alerts.length)})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("EXAM")}
            className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
              activeTab === "EXAM"
                ? "bg-rose-600 text-white shadow-xs"
                : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-rose-100/60 dark:hover:bg-slate-800 border border-rose-200/60 dark:border-slate-700"
            }`}
          >
            <TrendingDown className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
            <span>পরীক্ষার নম্বর হ্রাস ({toBanglaNumber(exam_drop_alerts.length)})</span>
          </button>
        </div>

        <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden md:inline">
          দৈনিক স্বয়ংক্রিয়ভাবে বিশ্লেষিত
        </span>
      </div>

      {/* Alert Cards List */}
      <div className="p-4 space-y-3">
        {/* Top Composite Risk Scores */}
        {(activeTab === "COMPOSITE" ||
          (activeTab === "ALL" && totalAlerts === 0)) &&
          risk_scores.slice(0, 6).map((rec, idx) => {
            const badge = RISK_LEVEL_BADGE[rec.risk_level] || RISK_LEVEL_BADGE.LOW;
            const intLabel =
              INTERVENTION_LABEL[rec.intervention_status] ||
              rec.intervention_status;
            return (
              <div
                key={`comp_${rec.student_id}_${idx}`}
                className="bg-white dark:bg-slate-900/90 rounded-xl border border-rose-200 dark:border-slate-700 p-3.5 sm:p-4 hover:border-rose-400 dark:hover:border-rose-700 transition shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 flex flex-col items-center justify-center shrink-0 font-black text-sm">
                    <span>{toBanglaNumber(Math.round(rec.composite_score))}</span>
                    <span className="text-[9px] font-semibold opacity-75">/১০০</span>
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {rec.student_name || "শিক্ষার্থী"}
                      </span>
                      {rec.roll_number && (
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold">
                          রোল: {toBanglaNumber(rec.roll_number)}
                        </span>
                      )}
                      {rec.class_name && (
                        <span className="px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 text-xs font-semibold">
                          {rec.class_name}
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black tracking-wide ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-semibold">
                        ইন্টারভেনশন: {intLabel}
                      </span>
                    </div>
                    {rec.factors && rec.factors.length > 0 && (
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        {rec.factors.slice(0, 2).join(" • ")}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href="/dashboard/analytics/early-warning"
                    className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-bold transition"
                  >
                    ব্যবস্থা নিন
                  </Link>
                </div>
              </div>
            );
          })}

        {/* Attendance Alerts */}
        {(activeTab === "ALL" || activeTab === "ATTENDANCE") &&
          attendance_alerts.map((alert, idx) => (
            <div
              key={`att_${alert.student_id}_${idx}`}
              className="bg-white dark:bg-slate-900/90 rounded-xl border border-rose-200 dark:border-rose-900/50 p-3.5 sm:p-4 hover:border-rose-400 dark:hover:border-rose-700 transition shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 flex items-center justify-center shrink-0 mt-0.5">
                  <UserX className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {alert.student_name}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold">
                      রোল: {toBanglaNumber(alert.roll_number || "---")}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 text-xs font-semibold">
                      {alert.class_name}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black tracking-wide">
                      পরপর {toBanglaNumber(alert.consecutive_absent_days)} দিন অনুপস্থিত
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    {alert.remarks ||
                      `সর্বশেষ অনুপস্থিতির তারিখ: ${alert.last_absent_dates.join(", ")}`}
                  </p>
                  {alert.last_present_date && (
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                      সর্বশেষ উপস্থিত ছিলেন: {alert.last_present_date}
                    </p>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800 shrink-0">
                {alert.parent_phone ? (
                  <>
                    <a
                      href={`tel:${alert.parent_phone}`}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                    >
                      <PhoneCall className="w-3.5 h-3.5" />
                      <span>অভিভাবককে কল ({alert.parent_phone})</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => handleCopyPhone(alert.parent_phone!)}
                      className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs transition"
                      title="নম্বর কপি করুন"
                    >
                      {copiedPhone === alert.parent_phone ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <MessageSquare className="w-4 h-4" />
                      )}
                    </button>
                  </>
                ) : (
                  <span className="text-xs text-slate-400 dark:text-slate-500 italic">
                    অভিভাবকের ফোন নম্বর নেই
                  </span>
                )}
              </div>
            </div>
          ))}

        {/* Exam Drops */}
        {(activeTab === "ALL" || activeTab === "EXAM") &&
          exam_drop_alerts.map((alert, idx) => (
            <div
              key={`exam_${alert.student_id}_${idx}`}
              className="bg-white dark:bg-slate-900/90 rounded-xl border border-amber-300 dark:border-amber-800/60 p-3.5 sm:p-4 hover:border-amber-500 dark:hover:border-amber-600 transition shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 flex items-center justify-center shrink-0 mt-0.5">
                  <TrendingDown className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {alert.student_name}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold">
                      রোল: {toBanglaNumber(alert.roll_number || "---")}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 text-xs font-semibold">
                      {alert.class_name}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-black tracking-wide flex items-center gap-1">
                      <ArrowDownRight className="w-3 h-3" />
                      <span>{toBanglaNumber(alert.drop_percentage)}% নম্বর ড্রপ করেছে!</span>
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-300 mt-1">
                    <span>
                      {alert.previous_exam_title}:{" "}
                      <strong className="text-emerald-700 dark:text-emerald-400 font-bold">
                        {toBanglaNumber(alert.previous_percentage)}%
                      </strong>
                    </span>
                    <span>➔</span>
                    <span>
                      {alert.current_exam_title}:{" "}
                      <strong className="text-rose-700 dark:text-rose-400 font-bold">
                        {toBanglaNumber(alert.current_percentage)}%
                      </strong>
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    শ্রেণি শিক্ষক কর্তৃক বিশেষ পাঠদান ও তাকরার তদারকি প্রয়োজন।
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800 shrink-0">
                {alert.parent_phone ? (
                  <a
                    href={`tel:${alert.parent_phone}`}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                    <span>অভিভাবককে কল ({alert.parent_phone})</span>
                  </a>
                ) : (
                  <span className="text-xs text-slate-400 dark:text-slate-500 italic">
                    অভিভাবকের ফোন নম্বর নেই
                  </span>
                )}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
