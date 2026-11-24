"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ShieldAlert,
  AlertTriangle,
  ScanSearch,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  Clock,
  X,
} from "lucide-react";
import type { FinancialAnomalyRecord } from "@/lib/anomaly-detection-service";
import {
  resolveFinancialAnomalyAction,
  runFinancialAnomalyScanAction,
  getFinancialAnomaliesAction,
} from "@/app/actions/anomalies";
import { formatBanglaCurrency, toBanglaNumber } from "@/lib/numberToBangla";

interface AnomaliesDashboardClientProps {
  initialAnomalies: FinancialAnomalyRecord[];
  initialError?: string;
}

const ANOMALY_TYPE_LABELS: Record<string, string> = {
  BAZAR_SPIKE: "বোর্ডিং বাজার স্পাইক",
  EXPENSE_SPIKE: "সাধারণ খরচ স্পাইক",
  DUPLICATE_VOUCHER: "ডুপ্লিকেট ভাউচার",
  EXCESSIVE_WAIVER: "অতিরিক্ত ফি মওকুফ",
  PAYMENT_VOID_SPIKE: "পেমেন্ট বাতিল স্পাইক",
  NEGATIVE_FUND_BALANCE: "ঋণাত্মক ফান্ড ব্যালেন্স",
  FEE_AGREEMENT_MISMATCH: "চুক্তিবদ্ধ বনাম ধার্য ফি অমিল",
  MISSING_STUDENT_INVOICE: "ইনভয়েসহীন শিক্ষার্থী",
  DUE_CALCULATION_MISMATCH: "বকেয়া হিসাব অমিল",
};

const STATUS_LABELS: Record<string, string> = {
  OPEN: "খোলা (Open)",
  INVESTIGATING: "তদন্তাধীন",
  RESOLVED: "সমাধান হয়েছে",
  DISMISSED: "বাতিল করা হয়েছে",
};

export default function AnomaliesDashboardClient({
  initialAnomalies,
  initialError,
}: AnomaliesDashboardClientProps) {
  const [anomalies, setAnomalies] =
    useState<FinancialAnomalyRecord[]>(initialAnomalies);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");
  const [isScanning, setIsScanning] = useState(false);
  const [lastCheckSummaries, setLastCheckSummaries] = useState<
    Array<{
      key: string;
      label: string;
      scannedCount: number;
      detectedCount: number;
      scope: string;
    }>
  >([]);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(initialError ? { type: "error", text: initialError } : null);

  // Resolution modal state
  const [activeAnomaly, setActiveAnomaly] =
    useState<FinancialAnomalyRecord | null>(null);
  const [targetStatus, setTargetStatus] = useState<
    "INVESTIGATING" | "RESOLVED" | "DISMISSED"
  >("RESOLVED");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const stats = useMemo(() => {
    const open = anomalies.filter((a) => a.status === "OPEN").length;
    const critical = anomalies.filter(
      (a) => a.severity === "CRITICAL" && a.status !== "RESOLVED" && a.status !== "DISMISSED"
    ).length;
    const resolved = anomalies.filter((a) => a.status === "RESOLVED").length;
    return { total: anomalies.length, open, critical, resolved };
  }, [anomalies]);

  const filtered = useMemo(() => {
    return anomalies.filter((a) => {
      if (statusFilter !== "ALL" && a.status !== statusFilter) return false;
      if (severityFilter !== "ALL" && a.severity !== severityFilter)
        return false;
      return true;
    });
  }, [anomalies, statusFilter, severityFilter]);

  const handleRunScan = async () => {
    setIsScanning(true);
    setFeedback(null);
    try {
      const res = await runFinancialAnomalyScanAction(60);
      if (!res.ok || !res.result) {
        setFeedback({
          type: "error",
          text: res.error || "অ্যানোমালি স্ক্যান ব্যর্থ হয়েছে।",
        });
      } else {
        setLastCheckSummaries(res.result.checkSummaries || []);
        const listRes = await getFinancialAnomaliesAction({ limit: 200 });
        if (listRes.ok) {
          setAnomalies(listRes.anomalies);
        }
        setFeedback({
          type: "success",
          text: `স্ক্যান সম্পন্ন: ${toBanglaNumber(
            res.result.detectedCount
          )}টি অসঙ্গতি শনাক্ত হয়েছে (${toBanglaNumber(
            res.result.newlyCreatedCount
          )}টি নতুন, ${toBanglaNumber(
            res.result.deduplicatedCount
          )}টি পূর্বের খোলা অ্যালার্ট)।`,
        });
      }
    } catch {
      setFeedback({
        type: "error",
        text: "সার্ভারের সাথে সংযোগ করতে সমস্যা হয়েছে।",
      });
    } finally {
      setIsScanning(false);
    }
  };

  const openResolveModal = (
    anom: FinancialAnomalyRecord,
    defaultStatus: "INVESTIGATING" | "RESOLVED" | "DISMISSED"
  ) => {
    setActiveAnomaly(anom);
    setTargetStatus(defaultStatus);
    setResolutionNotes(anom.resolution_notes || "");
  };

  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAnomaly) return;
    setIsSaving(true);
    setFeedback(null);
    try {
      const res = await resolveFinancialAnomalyAction({
        anomalyId: activeAnomaly.id,
        status: targetStatus,
        resolutionNotes,
      });
      if (!res.ok) {
        setFeedback({
          type: "error",
          text: res.error || "অবস্থা আপডেট ব্যর্থ হয়েছে।",
        });
      } else {
        setAnomalies((prev) =>
          prev.map((item) =>
            item.id === activeAnomaly.id
              ? {
                  ...item,
                  status: targetStatus,
                  resolution_notes: resolutionNotes,
                  resolved_at: new Date().toISOString(),
                }
              : item
          )
        );
        setFeedback({
          type: "success",
          text: "অ্যানোমালি স্ট্যাটাস আপডেট এবং অডিট লগে সংরক্ষণ করা হয়েছে।",
        });
        setActiveAnomaly(null);
      }
    } catch {
      setFeedback({
        type: "error",
        text: "সংরক্ষণ করতে সমস্যা হয়েছে।",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
            <ScanSearch className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1 hover:text-amber-600 dark:hover:text-amber-400 transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>ড্যাশবোর্ড</span>
              </Link>
              <span>/</span>
              <span>হিসাব ও অডিট</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100">
              আর্থিক ও বোর্ডিং অসঙ্গতি মনিটর (Anomaly Detection)
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5">
              স্ক্যান পরিধি (৯টি যাচাই): বাজার ও সাধারণ খরচ স্পাইক, ডুপ্লিকেট ভাউচার, অতিরিক্ত ফি মওকুফ, পেমেন্ট বাতিল স্পাইক, ঋণাত্মক ফান্ড ব্যালেন্স, চুক্তিবদ্ধ বনাম ধার্য ফি অমিল, ইনভয়েসহীন সক্রিয় শিক্ষার্থী এবং বকেয়া হিসাব যাচাই
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleRunScan}
          disabled={isScanning}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-sm font-bold shadow-xs transition shrink-0"
        >
          <Search className={`w-4 h-4 ${isScanning ? "animate-spin" : ""}`} />
          <span>{isScanning ? "স্ক্যান চলছে..." : "নতুন স্ক্যান চালান"}</span>
        </button>
      </div>

      {lastCheckSummaries.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              সর্বশেষ স্ক্যানের যাচাইকৃত রেকর্ড ও পরিধি
            </h2>
            <span className="text-xs text-slate-500">
              মোট {toBanglaNumber(lastCheckSummaries.length)}টি যাচাই সম্পন্ন
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {lastCheckSummaries.map((cs) => (
              <div
                key={cs.key}
                className={`p-3 rounded-xl border text-xs flex flex-col justify-between gap-1 ${
                  cs.detectedCount > 0
                    ? "bg-rose-50/60 border-rose-200 dark:bg-rose-950/30 dark:border-rose-800"
                    : "bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-800 dark:text-slate-100">
                    {cs.label}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full font-bold font-mono text-[11px] ${
                      cs.detectedCount > 0
                        ? "bg-rose-600 text-white"
                        : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200"
                    }`}
                  >
                    {toBanglaNumber(cs.detectedCount)}টি অসঙ্গতি
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <span>{cs.scope}</span>
                  <span className="font-mono font-semibold">
                    যাচাই: {toBanglaNumber(cs.scannedCount)} রেকর্ড
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            মোট শনাক্তকৃত অসঙ্গতি
          </span>
          <p className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1.5">
            {toBanglaNumber(stats.total)}
          </p>
        </div>

        <div className="bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs font-bold text-amber-700 dark:text-amber-300">
            <span>খোলা অ্যালার্ট (Open)</span>
            <Clock className="w-4 h-4" />
          </div>
          <p className="text-2xl font-black text-amber-700 dark:text-amber-300 mt-1.5">
            {toBanglaNumber(stats.open)}
          </p>
        </div>

        <div className="bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs font-bold text-rose-700 dark:text-rose-300">
            <span>জরুরি (Critical)</span>
            <ShieldAlert className="w-4 h-4" />
          </div>
          <p className="text-2xl font-black text-rose-700 dark:text-rose-300 mt-1.5">
            {toBanglaNumber(stats.critical)}
          </p>
        </div>

        <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs font-bold text-emerald-700 dark:text-emerald-300">
            <span>সমাধানকৃত</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <p className="text-2xl font-black text-emerald-700 dark:text-emerald-300 mt-1.5">
            {toBanglaNumber(stats.resolved)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400">
          <Filter className="w-4 h-4" />
          <span>ফিল্টার:</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-semibold text-slate-800 dark:text-slate-200"
          >
            <option value="ALL">সকল অবস্থা</option>
            <option value="OPEN">খোলা (Open)</option>
            <option value="INVESTIGATING">তদন্তাধীন</option>
            <option value="RESOLVED">সমাধান হয়েছে</option>
            <option value="DISMISSED">বাতিল</option>
          </select>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-semibold text-slate-800 dark:text-slate-200"
          >
            <option value="ALL">সকল তীব্রতা</option>
            <option value="CRITICAL">জরুরি (Critical)</option>
            <option value="WARNING">সতর্কতা (Warning)</option>
          </select>
        </div>
      </div>

      {/* Anomalies List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center">
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
              কোনো অসঙ্গতি রেকর্ড পাওয়া যায়নি। &ldquo;নতুন স্ক্যান চালান&rdquo; বাটনে ক্লিক করে সর্বশেষ হিসাব যাচাই করুন।
            </p>
          </div>
        ) : (
          filtered.map((anom) => {
            const isCritical = anom.severity === "CRITICAL";
            const typeLabel =
              ANOMALY_TYPE_LABELS[anom.anomaly_type] || anom.anomaly_type;
            const statusLabel = STATUS_LABELS[anom.status] || anom.status;

            return (
              <div
                key={anom.id}
                className={`bg-white dark:bg-slate-900 rounded-2xl border p-4 sm:p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                  isCritical
                    ? "border-rose-300 dark:border-rose-800/70"
                    : "border-amber-200 dark:border-slate-800"
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      isCritical
                        ? "bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300"
                        : "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300"
                    }`}
                  >
                    {isCritical ? (
                      <ShieldAlert className="w-5 h-5" />
                    ) : (
                      <AlertTriangle className="w-5 h-5" />
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                          isCritical
                            ? "bg-rose-600 text-white"
                            : "bg-amber-500 text-white"
                        }`}
                      >
                        {isCritical ? "CRITICAL" : "WARNING"}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold">
                        {typeLabel}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 text-xs font-semibold">
                        {statusLabel}
                      </span>
                      {anom.detected_date && (
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          তারিখ: {anom.detected_date}
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                      {anom.title}
                    </h3>

                    {anom.description && (
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        {anom.description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400 pt-0.5">
                      {anom.metric_value !== null &&
                        anom.metric_value !== undefined && (
                          <span>
                            বর্তমান মান:{" "}
                            <strong className="text-slate-800 dark:text-slate-200">
                              {anom.anomaly_type === "PAYMENT_VOID_SPIKE"
                                ? toBanglaNumber(anom.metric_value)
                                : formatBanglaCurrency(anom.metric_value)}
                            </strong>
                          </span>
                        )}
                      {anom.baseline_value !== null &&
                        anom.baseline_value !== undefined && (
                          <span>
                            বেসলাইন গড়/সীমা:{" "}
                            <strong className="text-slate-800 dark:text-slate-200">
                              {anom.anomaly_type === "PAYMENT_VOID_SPIKE"
                                ? toBanglaNumber(anom.baseline_value)
                                : formatBanglaCurrency(anom.baseline_value)}
                            </strong>
                          </span>
                        )}
                      {anom.z_score !== null && anom.z_score !== undefined && (
                        <span>
                          Z-Score:{" "}
                          <strong className="text-rose-600 dark:text-rose-400">
                            {toBanglaNumber(anom.z_score)}
                          </strong>
                        </span>
                      )}
                    </div>

                    {anom.resolution_notes && (
                      <p className="text-xs text-emerald-700 dark:text-emerald-400 italic">
                        সমাধান নোট: {anom.resolution_notes}
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800">
                  {anom.status !== "RESOLVED" && (
                    <button
                      type="button"
                      onClick={() => openResolveModal(anom, "RESOLVED")}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>সমাধান করুন</span>
                    </button>
                  )}
                  {anom.status === "OPEN" && (
                    <button
                      type="button"
                      onClick={() => openResolveModal(anom, "DISMISSED")}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>বাতিল</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Resolution Modal */}
      {activeAnomaly && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
                  অসঙ্গতি পর্যালোচনা ও সমাধান
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {activeAnomaly.title}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveAnomaly(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleResolveSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  নতুন অবস্থা
                </label>
                <select
                  value={targetStatus}
                  onChange={(e) =>
                    setTargetStatus(
                      e.target.value as
                        | "INVESTIGATING"
                        | "RESOLVED"
                        | "DISMISSED"
                    )
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100"
                >
                  <option value="INVESTIGATING">তদন্তাধীন (Investigating)</option>
                  <option value="RESOLVED">সমাধান হয়েছে (Resolved)</option>
                  <option value="DISMISSED">বাতিল / মিথ্যা সতর্কতা (Dismissed)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  তদন্ত ও সমাধান নোট
                </label>
                <textarea
                  rows={3}
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="যেমন: মূল ভাউচার যাচাই করে ডুপ্লিকেট এন্ট্রি বাতিল করা হয়েছে..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveAnomaly(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-bold transition"
                >
                  {isSaving ? "সংরক্ষণ হচ্ছে..." : "নিশ্চিত করুন"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
