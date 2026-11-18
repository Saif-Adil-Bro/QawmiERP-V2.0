"use client";

import React, { useMemo, useRef, useState, useTransition } from "react";
import {
  BarChart,
  Bar,
  ComposedChart,
  Line,
  LineChart,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  BarChart3,
  CalendarClock,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  GraduationCap,
  HeartHandshake,
  Loader2,
  Play,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Send,
  SlidersHorizontal,
  Trash2,
  TrendingUp,
  Utensils,
  Wallet,
  X,
} from "lucide-react";
import {
  deleteCustomReportDefinitionAction,
  deleteDigestScheduleAction,
  generateDigestNowAction,
  getDigestSchedulesAction,
  getExecutiveBiDashboardDataAction,
  getSavedCustomReportsAction,
  runCustomBiReportAction,
  saveCustomReportDefinitionAction,
  saveDigestScheduleAction,
  type SavedCustomReport,
} from "@/app/actions/bi";
import type {
  BiCustomDataset,
  CustomReportResult,
  ExecutiveBiSnapshot,
} from "@/lib/bi/executive-bi-service";
import type { DigestScheduleRecord } from "@/lib/bi/digest-generator";
import { formatBanglaCurrency, toBanglaNumber } from "@/lib/numberToBangla";

interface ExecutiveBiClientProps {
  initialSnapshot: ExecutiveBiSnapshot | null;
  initialError?: string | null;
  initialSavedReports: SavedCustomReport[];
  initialSchedules: DigestScheduleRecord[];
  sessions: { id: string; name: string }[];
}

const DATASET_OPTIONS: {
  value: BiCustomDataset;
  label: string;
  groups: { value: string; label: string }[];
}[] = [
  {
    value: "fees",
    label: "শিক্ষার্থী ফি ও বকেয়া (Fees)",
    groups: [
      { value: "class_name", label: "জামাত / শ্রেণি" },
      { value: "fee_type_name", label: "ফি-এর ধরন" },
      { value: "billing_period", label: "বিলিং মাস" },
      { value: "status", label: "অবস্থা (Status)" },
      { value: "session_id", label: "শিক্ষাবর্ষ (Session)" },
    ],
  },
  {
    value: "fee_payments",
    label: "ফি আদায় ও রসিদ (Payments)",
    groups: [
      { value: "payment_method", label: "পেমেন্ট মাধ্যম" },
      { value: "class_name", label: "জামাত / শ্রেণি" },
      { value: "payment_month", label: "আদায়ের মাস" },
      { value: "status", label: "অবস্থা" },
    ],
  },
  {
    value: "boarding",
    label: "বোর্ডিং বাজার খরচ (Boarding)",
    groups: [
      { value: "month_key", label: "মাস অনুযায়ী" },
      { value: "expense_date", label: "তারিখ অনুযায়ী" },
    ],
  },
  {
    value: "donations",
    label: "দান ও অনুদান (Donations)",
    groups: [
      { value: "donation_type", label: "দানের ধরন" },
      { value: "donation_month", label: "মাস অনুযায়ী" },
    ],
  },
  {
    value: "funds",
    label: "যাকাত ও বিশেষ ফান্ড (Funds)",
    groups: [
      { value: "category", label: "ক্যাটাগরি" },
      { value: "is_active", label: "সক্রিয়তা" },
    ],
  },
  {
    value: "exams",
    label: "পরীক্ষার ফলাফল (Exams)",
    groups: [
      { value: "exam_title", label: "পরীক্ষার নাম" },
      { value: "exam_year", label: "পরীক্ষার সাল" },
      { value: "subject_name", label: "বিষয়" },
    ],
  },
  {
    value: "students",
    label: "শিক্ষার্থী পরিসংখ্যান (Students)",
    groups: [
      { value: "class_name", label: "জামাত / শ্রেণি" },
      { value: "status", label: "অবস্থা" },
    ],
  },
];

const PIE_COLORS = ["#059669", "#0284c7", "#d97706", "#7c3aed", "#e11d48", "#0d9488"];

function CurrencyTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white/95 p-3 text-xs shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
      <p className="mb-1.5 border-b border-slate-100 pb-1 font-bold text-slate-900 dark:border-slate-800 dark:text-slate-100">
        {label}
      </p>
      <div className="space-y-1">
        {payload.map((entry: any, idx: number) => (
          <div key={idx} className="flex items-center justify-between gap-4">
            <span className="font-medium" style={{ color: entry.color }}>
              {entry.name}:
            </span>
            <span className="font-bold tabular-nums text-slate-900 dark:text-slate-100">
              {String(entry.name || "").includes("%") || String(entry.dataKey || "").includes("pct")
                ? `${toBanglaNumber(entry.value ?? 0)}%`
                : `৳ ${formatBanglaCurrency(Number(entry.value ?? 0))}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ExecutiveBiClient({
  initialSnapshot,
  initialError,
  initialSavedReports,
  initialSchedules,
  sessions,
}: ExecutiveBiClientProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "custom" | "digests">("overview");
  const [snapshot, setSnapshot] = useState<ExecutiveBiSnapshot | null>(initialSnapshot);
  const [months, setMonths] = useState<number>(initialSnapshot?.months || 6);
  const [sessionId, setSessionId] = useState<string>(initialSnapshot?.sessionId || "");
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(
    initialError ? { type: "err", text: initialError } : null
  );
  const [isPending, startTransition] = useTransition();

  // Custom Report Builder state
  const [savedReports, setSavedReports] = useState<SavedCustomReport[]>(initialSavedReports);
  const [dataset, setDataset] = useState<BiCustomDataset>("fees");
  const [groupBy, setGroupBy] = useState<string>("class_name");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [limit, setLimit] = useState<number>(50);
  const [reportName, setReportName] = useState<string>("");
  const [customResult, setCustomResult] = useState<CustomReportResult | null>(null);

  // Digest Schedules state
  const [schedules, setSchedules] = useState<DigestScheduleRecord[]>(initialSchedules);
  const [schedName, setSchedName] = useState<string>("");
  const [schedFreq, setSchedFreq] = useState<"weekly" | "monthly">("weekly");
  const [schedDayOfWeek, setSchedDayOfWeek] = useState<number>(5);
  const [schedDayOfMonth, setSchedDayOfMonth] = useState<number>(1);
  const [schedFormat, setSchedFormat] = useState<"html" | "xlsx">("html");
  const [schedRecipients, setSchedRecipients] = useState<string>("");
  const [schedEnabled, setSchedEnabled] = useState<boolean>(true);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const previewIframeRef = useRef<HTMLIFrameElement | null>(null);

  const selectedDatasetConfig = useMemo(
    () => DATASET_OPTIONS.find((d) => d.value === dataset) || DATASET_OPTIONS[0],
    [dataset]
  );

  const reloadOverview = (nextMonths = months, nextSession = sessionId) => {
    setFeedback(null);
    startTransition(async () => {
      const res = await getExecutiveBiDashboardDataAction({
        months: nextMonths,
        sessionId: nextSession || null,
      });
      if (res.error) {
        setFeedback({ type: "err", text: res.error });
      } else if (res.snapshot) {
        setSnapshot(res.snapshot);
      }
    });
  };

  const handleDatasetChange = (nextDataset: BiCustomDataset) => {
    setDataset(nextDataset);
    const cfg = DATASET_OPTIONS.find((d) => d.value === nextDataset);
    if (cfg && cfg.groups.length > 0) {
      setGroupBy(cfg.groups[0].value);
    }
  };

  const handleRunCustomReport = (override?: {
    dataset?: BiCustomDataset;
    groupBy?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
  }) => {
    setFeedback(null);
    startTransition(async () => {
      const res = await runCustomBiReportAction({
        dataset: override?.dataset ?? dataset,
        groupBy: override?.groupBy ?? groupBy,
        dateFrom: (override?.dateFrom ?? dateFrom) || undefined,
        dateTo: (override?.dateTo ?? dateTo) || undefined,
        sessionId: sessionId || undefined,
        limit: override?.limit ?? limit,
      });
      if (res.error) {
        setFeedback({ type: "err", text: res.error });
      } else if (res.result) {
        setCustomResult(res.result);
      }
    });
  };

  const handleSaveCustomReport = () => {
    if (!reportName.trim()) {
      setFeedback({ type: "err", text: "সংরক্ষণের জন্য রিপোর্টের নাম লিখুন।" });
      return;
    }
    setFeedback(null);
    startTransition(async () => {
      const res = await saveCustomReportDefinitionAction({
        name: reportName.trim(),
        dataset,
        groupBy,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        limit,
      });
      if (res.error) {
        setFeedback({ type: "err", text: res.error });
      } else {
        setReportName("");
        setFeedback({ type: "ok", text: "কাস্টম রিপোর্ট কনফিগারেশন সংরক্ষিত হয়েছে।" });
        const listRes = await getSavedCustomReportsAction();
        setSavedReports(listRes.reports || []);
      }
    });
  };

  const handleDeleteSavedReport = (id: string) => {
    setFeedback(null);
    startTransition(async () => {
      const res = await deleteCustomReportDefinitionAction(id);
      if (res.error) {
        setFeedback({ type: "err", text: res.error });
      } else {
        const listRes = await getSavedCustomReportsAction();
        setSavedReports(listRes.reports || []);
      }
    });
  };

  const handleSaveSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!schedName.trim()) {
      setFeedback({ type: "err", text: "ডাইজেস্ট শিডিউলের নাম আবশ্যক।" });
      return;
    }
    setFeedback(null);
    startTransition(async () => {
      const recipients = schedRecipients
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await saveDigestScheduleAction({
        name: schedName.trim(),
        frequency: schedFreq,
        day_of_week: schedDayOfWeek,
        day_of_month: schedDayOfMonth,
        format: schedFormat,
        recipients,
        is_enabled: schedEnabled,
      });
      if (res.error) {
        setFeedback({ type: "err", text: res.error });
      } else {
        setSchedName("");
        setSchedRecipients("");
        setFeedback({ type: "ok", text: "ডাইজেস্ট শিডিউল সফলভাবে সংরক্ষিত হয়েছে।" });
        const listRes = await getDigestSchedulesAction();
        setSchedules(listRes.schedules || []);
      }
    });
  };

  const handleToggleSchedule = (sched: DigestScheduleRecord) => {
    setFeedback(null);
    startTransition(async () => {
      const res = await saveDigestScheduleAction({
        id: sched.id,
        schedule_key: sched.schedule_key,
        name: sched.name || "নির্বাহী ডাইজেস্ট",
        frequency: sched.frequency === "monthly" ? "monthly" : "weekly",
        day_of_week: sched.day_of_week ?? 5,
        day_of_month: sched.day_of_month ?? 1,
        format: sched.format === "xlsx" ? "xlsx" : "html",
        recipients: sched.recipients || [],
        is_enabled: !sched.is_enabled,
      });
      if (res.error) {
        setFeedback({ type: "err", text: res.error });
      } else {
        const listRes = await getDigestSchedulesAction();
        setSchedules(listRes.schedules || []);
      }
    });
  };

  const handleDeleteSchedule = (id: string) => {
    setFeedback(null);
    startTransition(async () => {
      const res = await deleteDigestScheduleAction(id);
      if (res.error) {
        setFeedback({ type: "err", text: res.error });
      } else {
        const listRes = await getDigestSchedulesAction();
        setSchedules(listRes.schedules || []);
      }
    });
  };

  const handleGenerateAdhoc = (format: "html" | "xlsx", sendNotification = false) => {
    setFeedback(null);
    startTransition(async () => {
      const res = await generateDigestNowAction({ format, sendNotification });
      if (res.error) {
        setFeedback({ type: "err", text: res.error });
        return;
      }

      if (format === "html" && res.html) {
        setPreviewHtml(res.html);
        setFeedback({
          type: "ok",
          text: `A4 বাংলা ডাইজেস্ট প্রস্তুত হয়েছে (Ref: ${res.exportId})${
            sendNotification ? " এবং নোটিফিকেশন পাঠানো হয়েছে।" : "।"
          }`,
        });
      } else if (format === "xlsx" && res.xlsxBase64) {
        try {
          const byteChars = atob(res.xlsxBase64);
          const byteNumbers = new Array(byteChars.length);
          for (let i = 0; i < byteChars.length; i++) {
            byteNumbers[i] = byteChars.charCodeAt(i);
          }
          const blob = new Blob([new Uint8Array(byteNumbers)], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = res.filename || `executive-bi-digest-${res.exportId}.xlsx`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          URL.revokeObjectURL(url);
          setFeedback({
            type: "ok",
            text: `ওয়াটারমার্কড XLSX ডাউনলোড শুরু হয়েছে (Ref: ${res.exportId})।`,
          });
        } catch {
          setFeedback({ type: "err", text: "XLSX ফাইল ডাউনলোড করতে সমস্যা হয়েছে।" });
        }
      }
    });
  };

  const handlePrintPreview = () => {
    const win = previewIframeRef.current?.contentWindow;
    if (win) {
      win.focus();
      win.print();
    }
  };

  const summary = snapshot?.summary;
  const boardingData = snapshot?.boarding || [];
  const fundData = snapshot?.funds || [];
  const donationData = snapshot?.donationsByType || [];
  const classDueData = snapshot?.classFeeDues || [];
  const examData = snapshot?.sessionExamComparison || [];

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header & Global Filters */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
              <BarChart3 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              নির্বাহী বিআই (Executive BI) ও ডাইজেস্ট ড্যাশবোর্ড
            </h1>
            {snapshot?.source && (
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                উৎস: {snapshot.source === "rpc" ? "RPC" : snapshot.source === "mv" ? "MV" : "Live"}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            বোর্ডিং খরচ, যাকাত ও ফান্ড, জামাতভিত্তিক বকেয়া, পরীক্ষার ফলাফল তুলনা এবং শিডিউলড A4 ডাইজেস্ট
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900">
            <Filter className="h-4 w-4 text-slate-400" />
            <select
              aria-label="সময়কাল"
              value={months}
              onChange={(e) => {
                const next = Number(e.target.value);
                setMonths(next);
                reloadOverview(next, sessionId);
              }}
              className="bg-transparent text-slate-800 outline-none dark:text-slate-200"
            >
              <option value={3}>বিগত ৩ মাস</option>
              <option value={6}>বিগত ৬ মাস</option>
              <option value={12}>বিগত ১২ মাস</option>
              <option value={24}>বিগত ২৪ মাস</option>
            </select>
          </div>

          <select
            aria-label="শিক্ষাবর্ষ ফিল্টার"
            value={sessionId}
            onChange={(e) => {
              const next = e.target.value;
              setSessionId(next);
              reloadOverview(months, next);
            }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <option value="">সকল শিক্ষাবর্ষ</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => reloadOverview()}
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
            রিফ্রেশ
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            feedback.type === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
            activeTab === "overview"
              ? "bg-emerald-600 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
        >
          <TrendingUp className="h-4 w-4" />
          ওভারভিউ ও চার্ট
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("custom")}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
            activeTab === "custom"
              ? "bg-emerald-600 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
        >
          <SlidersHorizontal className="h-4 w-4" />
          কাস্টম রিপোর্ট বিল্ডার
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("digests")}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
            activeTab === "digests"
              ? "bg-emerald-600 text-white shadow-sm"
              : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          }`}
        >
          <CalendarClock className="h-4 w-4" />
          শিডিউলড ডাইজেস্ট ({toBanglaNumber(schedules.length)})
        </button>
      </div>

      {/* TAB 1: OVERVIEW & 4 BI PILLARS */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  মোট ফি আদায়
                </span>
                <Wallet className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
                ৳ {formatBanglaCurrency(summary?.totalFeeCollections ?? 0)}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                মোট প্রদেয়: ৳ {formatBanglaCurrency(summary?.totalFeePayable ?? 0)}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  মোট বকেয়া ও অনুপাত
                </span>
                <BarChart3 className="h-5 w-5 text-rose-600 dark:text-rose-400" />
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
                ৳ {formatBanglaCurrency(summary?.totalFeeDue ?? 0)}
              </p>
              <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                বকেয়া হার: {toBanglaNumber(summary?.overallDueRatioPct ?? 0)}%
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  বোর্ডিং গড় মাথাপিছু খরচ
                </span>
                <Utensils className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
                ৳ {formatBanglaCurrency(summary?.avgPerCapitaBazarCost ?? 0)}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                মোট বাজার: ৳ {formatBanglaCurrency(summary?.totalBazarExpense ?? 0)}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  যাকাত ও ফান্ড স্থিতি
                </span>
                <HeartHandshake className="h-5 w-5 text-sky-600 dark:text-sky-400" />
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
                ৳ {formatBanglaCurrency(summary?.totalFundBalance ?? 0)}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                মোট দান: ৳ {formatBanglaCurrency(summary?.totalDonations ?? 0)}
              </p>
            </div>
          </div>

          {/* 4 BI Pillar Charts */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Pillar 1: Boarding Per-Capita Bazar Cost vs Fee Income */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-4">
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  ১. বোর্ডিং মাথাপিছু বাজার খরচ বনাম বোর্ডিং ফি আয়
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  মাসিক বাজার ব্যয়, বোর্ডিং ফি আয় ও মাথাপিছু গড় ব্যয়ের তুলনা
                </p>
              </div>
              <div className="h-72">
                {boardingData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={[...boardingData].reverse()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} />
                      <XAxis dataKey="month_key" tick={{ fill: "#64748b", fontSize: 11 }} />
                      <YAxis
                        tick={{ fill: "#64748b", fontSize: 11 }}
                        tickFormatter={(v) => `৳${toBanglaNumber(v)}`}
                      />
                      <RechartsTooltip content={<CurrencyTooltip />} />
                      <Legend wrapperStyle={{ fontSize: "12px" }} />
                      <Bar
                        dataKey="total_bazar_expense"
                        name="বাজার খরচ"
                        fill="#f43f5e"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="boarding_fee_income"
                        name="বোর্ডিং ফি আয়"
                        fill="#10b981"
                        radius={[4, 4, 0, 0]}
                      />
                      <Line
                        type="monotone"
                        dataKey="per_capita_bazar_cost"
                        name="মাথাপিছু খরচ"
                        stroke="#f59e0b"
                        strokeWidth={2.5}
                        dot={{ r: 3 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-slate-400">
                    কোনো বোর্ডিং ডেটা পাওয়া যায়নি
                  </div>
                )}
              </div>
            </div>

            {/* Pillar 2: Zakat & Special Fund Health */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-4">
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  ২. যাকাত ও বিশেষ ফান্ডের স্বাস্থ্য
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  ফান্ডভিত্তিক লক্ষ্যমাত্রা বনাম বর্তমান স্থিতি ও অনুদানের বিভাজন
                </p>
              </div>
              <div className="grid h-72 grid-cols-1 gap-3 sm:grid-cols-5">
                <div className="sm:col-span-3 h-full">
                  {fundData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={fundData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} />
                        <XAxis dataKey="fund_name" tick={{ fill: "#64748b", fontSize: 11 }} />
                        <YAxis
                          tick={{ fill: "#64748b", fontSize: 11 }}
                          tickFormatter={(v) => `৳${toBanglaNumber(v)}`}
                        />
                        <RechartsTooltip content={<CurrencyTooltip />} />
                        <Legend wrapperStyle={{ fontSize: "11px" }} />
                        <Bar
                          dataKey="target_amount"
                          name="লক্ষ্যমাত্রা"
                          fill="#94a3b8"
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          dataKey="current_balance"
                          name="বর্তমান স্থিতি"
                          fill="#0284c7"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-slate-400">
                      কোনো ফান্ড ডেটা পাওয়া যায়নি
                    </div>
                  )}
                </div>
                <div className="sm:col-span-2 h-full">
                  {donationData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={donationData}
                          dataKey="total_amount"
                          nameKey="donation_type"
                          cx="50%"
                          cy="50%"
                          innerRadius={36}
                          outerRadius={62}
                          paddingAngle={3}
                        >
                          {donationData.map((_, idx) => (
                            <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip content={<CurrencyTooltip />} />
                        <Legend wrapperStyle={{ fontSize: "11px" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-center text-xs text-slate-400">
                      অনুদানের ধরন অনুযায়ী কোনো তথ্য নেই
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Pillar 3: Class/Jamat Fee Due Ratio */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-4">
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  ৩. জামাতভিত্তিক ফি আদায় ও বকেয়া অনুপাত
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  প্রতিটি জামাতের আদায়কৃত ও বকেয়া ফির তুলনামূলক চিত্র
                </p>
              </div>
              <div className="h-72">
                {classDueData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={classDueData.slice(0, 10)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} />
                      <XAxis dataKey="class_name" tick={{ fill: "#64748b", fontSize: 11 }} />
                      <YAxis
                        tick={{ fill: "#64748b", fontSize: 11 }}
                        tickFormatter={(v) => `৳${toBanglaNumber(v)}`}
                      />
                      <RechartsTooltip content={<CurrencyTooltip />} />
                      <Legend wrapperStyle={{ fontSize: "12px" }} />
                      <Bar
                        dataKey="total_paid"
                        name="আদায়কৃত"
                        stackId="a"
                        fill="#10b981"
                      />
                      <Bar
                        dataKey="total_due"
                        name="বকেয়া"
                        stackId="a"
                        fill="#f43f5e"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-slate-400">
                    কোনো জামাতভিত্তিক ফি তথ্য পাওয়া যায়নি
                  </div>
                )}
              </div>
            </div>

            {/* Pillar 4: Session-to-Session Exam Results Comparison */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    ৪. সেশন-টু-সেশন ও পরীক্ষাভিত্তিক ফলাফল তুলনা
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    পরীক্ষা অনুযায়ী গড় নম্বর (%) এবং পাসের হার (%)
                  </p>
                </div>
                <GraduationCap className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="h-72">
                {examData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={examData.slice(0, 12)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.2} />
                      <XAxis dataKey="exam_title" tick={{ fill: "#64748b", fontSize: 11 }} />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fill: "#64748b", fontSize: 11 }}
                        tickFormatter={(v) => `${toBanglaNumber(v)}%`}
                      />
                      <RechartsTooltip content={<CurrencyTooltip />} />
                      <Legend wrapperStyle={{ fontSize: "12px" }} />
                      <Line
                        type="monotone"
                        dataKey="avg_percentage"
                        name="গড় নম্বর (%)"
                        stroke="#0284c7"
                        strokeWidth={2.5}
                        dot={{ r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="pass_rate_pct"
                        name="পাসের হার (%)"
                        stroke="#10b981"
                        strokeWidth={2.5}
                        dot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-slate-400">
                    কোনো পরীক্ষার ফলাফল পাওয়া যায়নি
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CUSTOM REPORT BUILDER */}
      {activeTab === "custom" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              কাস্টম রিপোর্ট কনফিগারেশন
            </h2>

            <div className="space-y-3 text-sm">
              <div>
                <label className="mb-1 block font-medium text-slate-700 dark:text-slate-300">
                  ডেটাসেট নির্বাচন করুন
                </label>
                <select
                  value={dataset}
                  onChange={(e) => handleDatasetChange(e.target.value as BiCustomDataset)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  {DATASET_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block font-medium text-slate-700 dark:text-slate-300">
                  গ্রুপিং (Group By)
                </label>
                <select
                  value={groupBy}
                  onChange={(e) => setGroupBy(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  {selectedDatasetConfig.groups.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                    শুরুর তারিখ
                  </label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                    শেষ তারিখ
                  </label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  সর্বোচ্চ সারি (Limit)
                </label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value) || 50)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <button
                type="button"
                onClick={() => handleRunCustomReport()}
                disabled={isPending}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                রিপোর্ট চালান
              </button>

              <div className="border-t border-slate-200 pt-3 dark:border-slate-800">
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  রিপোর্ট সংরক্ষণ করুন
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="যেমন: মাসিক জামাত বকেয়া"
                    value={reportName}
                    onChange={(e) => setReportName(e.target.value)}
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={handleSaveCustomReport}
                    disabled={isPending}
                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-600 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
                  >
                    <Save className="h-3.5 w-3.5" />
                    সংরক্ষণ
                  </button>
                </div>
              </div>
            </div>

            {/* Saved Reports List */}
            {savedReports.length > 0 && (
              <div className="border-t border-slate-200 pt-3 dark:border-slate-800">
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                  সংরক্ষিত রিপোর্ট ({toBanglaNumber(savedReports.length)})
                </h3>
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {savedReports.map((rep) => (
                    <div
                      key={rep.id}
                      className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-xs dark:border-slate-800"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setDataset(rep.dataset);
                          setGroupBy(rep.groupBy);
                          setDateFrom(rep.dateFrom || "");
                          setDateTo(rep.dateTo || "");
                          setLimit(rep.limit || 50);
                          handleRunCustomReport({
                            dataset: rep.dataset,
                            groupBy: rep.groupBy,
                            dateFrom: rep.dateFrom || "",
                            dateTo: rep.dateTo || "",
                            limit: rep.limit || 50,
                          });
                        }}
                        className="text-left font-semibold text-slate-800 hover:text-emerald-600 dark:text-slate-200"
                      >
                        {rep.name}
                        <span className="block text-[11px] font-normal text-slate-500">
                          {rep.dataset} · {rep.groupBy}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSavedReport(rep.id)}
                        className="p-1 text-slate-400 hover:text-rose-600"
                        aria-label="মুছুন"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Custom Report Results Table */}
          <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  রিপোর্টের ফলাফল
                </h2>
                {customResult && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    মোট সারি: {toBanglaNumber(customResult.totalRows)} · মোট এন্ট্রি:{" "}
                    {toBanglaNumber(customResult.summary.totalCount)}
                  </p>
                )}
              </div>
            </div>

            {customResult ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-bold text-slate-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300">
                      <th className="px-3 py-2.5">গ্রুপ ({customResult.groupBy})</th>
                      <th className="px-3 py-2.5 text-right">সংখ্যা</th>
                      <th className="px-3 py-2.5 text-right">মোট পরিমাণ</th>
                      <th className="px-3 py-2.5 text-right">আদায়</th>
                      <th className="px-3 py-2.5 text-right">বকেয়া</th>
                      <th className="px-3 py-2.5 text-right">গড়</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {customResult.rows.length > 0 ? (
                      customResult.rows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                          <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-200">
                            {row.groupKey}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {toBanglaNumber(row.count)}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold tabular-nums">
                            ৳ {formatBanglaCurrency(row.totalAmount)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                            ৳ {formatBanglaCurrency(row.paidAmount ?? 0)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-rose-600 dark:text-rose-400">
                            ৳ {formatBanglaCurrency(row.dueAmount ?? 0)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            ৳ {formatBanglaCurrency(row.avgAmount)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          নির্বাচিত ফিল্টারে কোনো তথ্য পাওয়া যায়নি
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {customResult.rows.length > 0 && (
                    <tfoot>
                      <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold dark:border-slate-700 dark:bg-slate-800/60">
                        <td className="px-3 py-2">সর্বমোট</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {toBanglaNumber(customResult.summary.totalCount)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          ৳ {formatBanglaCurrency(customResult.summary.totalAmount)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                          ৳ {formatBanglaCurrency(customResult.summary.paidAmount)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-rose-600 dark:text-rose-400">
                          ৳ {formatBanglaCurrency(customResult.summary.dueAmount)}
                        </td>
                        <td className="px-3 py-2 text-right">—</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            ) : (
              <div className="flex h-64 flex-col items-center justify-center text-center text-slate-400">
                <SlidersHorizontal className="mb-2 h-8 w-8 opacity-50" />
                <p className="text-sm">বাম পাশ থেকে ডেটাসেট ও গ্রুপিং নির্বাচন করে &ldquo;রিপোর্ট চালান&rdquo; বাটনে ক্লিক করুন।</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: SCHEDULED DIGEST REPORTS */}
      {activeTab === "digests" && (
        <div className="space-y-6">
          {/* Ad-hoc Digest Generation Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
            <div>
              <h2 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                তাৎক্ষণিক নির্বাহী বিআই ডাইজেস্ট তৈরি করুন
              </h2>
              <p className="text-xs text-emerald-700 dark:text-emerald-400">
                অডিট ওয়াটারমার্কসহ A4 প্রিন্ট-রেডি বাংলা HTML অথবা Excel (.xlsx) ডাউনলোড করুন
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleGenerateAdhoc("html", false)}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                <FileText className="h-4 w-4" />
                A4 বাংলা প্রিভিউ
              </button>
              <button
                type="button"
                onClick={() => handleGenerateAdhoc("xlsx", false)}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600 bg-white px-3.5 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:bg-slate-900 dark:text-emerald-300"
              >
                <FileSpreadsheet className="h-4 w-4" />
                XLSX ডাউনলোড
              </button>
              <button
                type="button"
                onClick={() => handleGenerateAdhoc("html", true)}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 rounded-lg border border-sky-600 bg-white px-3.5 py-2 text-xs font-semibold text-sky-700 hover:bg-sky-50 disabled:opacity-50 dark:bg-slate-900 dark:text-sky-300"
              >
                <Send className="h-4 w-4" />
                ডাইজেস্ট পাঠান
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Create Schedule Form */}
            <form
              onSubmit={handleSaveSchedule}
              className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <h3 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100">
                <Plus className="h-4 w-4 text-emerald-600" />
                নতুন ডাইজেস্ট শিডিউল
              </h3>

              <div className="space-y-3 text-sm">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                    শিডিউলের নাম
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="যেমন: সাপ্তাহিক মুহতামিম রিপোর্ট"
                    value={schedName}
                    onChange={(e) => setSchedName(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                      সময়সূচি
                    </label>
                    <select
                      value={schedFreq}
                      onChange={(e) => setSchedFreq(e.target.value as "weekly" | "monthly")}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    >
                      <option value="weekly">সাপ্তাহিক</option>
                      <option value="monthly">মাসিক</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                      ফরম্যাট
                    </label>
                    <select
                      value={schedFormat}
                      onChange={(e) => setSchedFormat(e.target.value as "html" | "xlsx")}
                      className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    >
                      <option value="html">A4 HTML / PDF</option>
                      <option value="xlsx">Excel (.xlsx)</option>
                    </select>
                  </div>
                </div>

                {schedFreq === "weekly" ? (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                      সপ্তাহের দিন
                    </label>
                    <select
                      value={schedDayOfWeek}
                      onChange={(e) => setSchedDayOfWeek(Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    >
                      <option value={5}>শুক্রবার</option>
                      <option value={6}>শনিবার</option>
                      <option value={0}>রবিবার</option>
                      <option value={1}>সোমবার</option>
                      <option value={2}>মঙ্গলবার</option>
                      <option value={3}>বুধবার</option>
                      <option value={4}>বৃহস্পতিবার</option>
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                      মাসের তারিখ (১–২৮)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={28}
                      value={schedDayOfMonth}
                      onChange={(e) => setSchedDayOfMonth(Number(e.target.value) || 1)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                    প্রাপক (কমা দিয়ে ইমেইল বা ফোন)
                  </label>
                  <input
                    type="text"
                    placeholder="muhtamim@madrasa.org, 01712345678"
                    value={schedRecipients}
                    onChange={(e) => setSchedRecipients(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={schedEnabled}
                    onChange={(e) => setSchedEnabled(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600"
                  />
                  শিডিউল সক্রিয় রাখুন
                </label>

                <button
                  type="submit"
                  disabled={isPending}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  শিডিউল সংরক্ষণ করুন
                </button>
              </div>
            </form>

            {/* Schedules List */}
            <div className="lg:col-span-2 space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                সংরক্ষিত ডাইজেস্ট শিডিউল
              </h3>

              {schedules.length > 0 ? (
                <div className="space-y-3">
                  {schedules.map((sched) => (
                    <div
                      key={sched.id}
                      className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-slate-100">
                            {sched.name || sched.schedule_key}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              sched.is_enabled
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                            }`}
                          >
                            {sched.is_enabled ? "সক্রিয়" : "বন্ধ"}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {sched.frequency === "monthly" ? "মাসিক" : "সাপ্তাহিক"} · ফরম্যাট:{" "}
                          {(sched.format || "html").toUpperCase()} · প্রাপক:{" "}
                          {sched.recipients?.length
                            ? sched.recipients.join(", ")
                            : "অ্যাডমিন ইন-অ্যাপ"}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <a
                          href={`/api/bi/digest/${sched.id}?format=html`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          A4 প্রিভিউ
                        </a>
                        <a
                          href={`/api/bi/digest/${sched.id}?format=xlsx`}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          <Download className="h-3.5 w-3.5" />
                          XLSX
                        </a>
                        <button
                          type="button"
                          onClick={() => handleToggleSchedule(sched)}
                          className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          {sched.is_enabled ? "বন্ধ করুন" : "চালু করুন"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSchedule(sched.id)}
                          className="rounded-lg border border-rose-200 p-1.5 text-rose-600 hover:bg-rose-50 dark:border-rose-900/50 dark:hover:bg-rose-950/30"
                          aria-label="মুছুন"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex h-44 items-center justify-center text-sm text-slate-400">
                  এখনো কোনো ডাইজেস্ট শিডিউল তৈরি করা হয়নি
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* A4 HTML Preview Modal */}
      {previewHtml && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs">
          <div className="flex h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-slate-100">
                A4 বাংলা নির্বাহী বিআই ডাইজেস্ট প্রিভিউ
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrintPreview}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  <Printer className="h-3.5 w-3.5" />
                  প্রিন্ট / PDF সেভ
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewHtml(null)}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                  aria-label="বন্ধ করুন"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <iframe
              ref={previewIframeRef}
              title="A4 Digest Preview"
              srcDoc={previewHtml}
              className="h-full w-full bg-white"
            />
          </div>
        </div>
      )}
    </div>
  );
}
