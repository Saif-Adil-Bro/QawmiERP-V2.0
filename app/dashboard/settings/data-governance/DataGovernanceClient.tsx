"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ExamFreezeList } from "@/app/actions/exams";
import {
  toggleAccountingPeriodLock,
  toggleAcademicSessionLock,
} from "@/app/actions/locks";
import {
  getMetadataMigrationStatus,
  runMetadataToTablesMigration,
  type MetadataMigrationStatus,
} from "@/app/actions/metadata-migration";
import type { AccountingPeriodRecord } from "@/lib/lock-guards";
import ExamLockToggle from "@/app/dashboard/exams/ExamLockToggle";
import { toBanglaNumber } from "@/lib/numberToBangla";
import { useStepUpAction } from "@/components/security/useStepUpAction";
import {
  Lock,
  Unlock,
  Calendar,
  BookOpen,
  Database,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Play,
  Layers,
  MessageSquare,
} from "lucide-react";

const BANGLA_MONTHS = [
  "জানুয়ারি",
  "ফেব্রুয়ারি",
  "মার্চ",
  "এপ্রিল",
  "মে",
  "জুন",
  "জুলাই",
  "আগস্ট",
  "সেপ্টেম্বর",
  "অক্টোবর",
  "নভেম্বর",
  "ডিসেম্বর",
];

interface DataGovernanceClientProps {
  initialTab: "accounting" | "exams" | "migration";
  initialPeriods: AccountingPeriodRecord[];
  periodsStorage: "sql" | "fallback";
  examList: ExamFreezeList;
  initialSessions: any[];
  initialMigrationStatus: MetadataMigrationStatus;
  canManageLocks: boolean;
}

function getDhakaYearMonth(): { year: number; month: number } {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Dhaka",
      year: "numeric",
      month: "2-digit",
    }).formatToParts(new Date());
    const y = Number(parts.find((p) => p.type === "year")?.value || 2026);
    const m = Number(parts.find((p) => p.type === "month")?.value || 1);
    return { year: y, month: m };
  } catch {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  }
}

function buildRecentMonths(count = 12) {
  const { year, month } = getDhakaYearMonth();
  const list: {
    periodKey: string;
    label: string;
    startDate: string;
    endDate: string;
  }[] = [];

  for (let i = 0; i < count; i++) {
    let m = month - i;
    let y = year;
    while (m <= 0) {
      m += 12;
      y -= 1;
    }
    const mm = String(m).padStart(2, "0");
    const lastDay = new Date(y, m, 0).getDate();
    const dd = String(lastDay).padStart(2, "0");
    list.push({
      periodKey: `${y}-${mm}`,
      label: `${BANGLA_MONTHS[m - 1]} ${toBanglaNumber(y)}`,
      startDate: `${y}-${mm}-01`,
      endDate: `${y}-${mm}-${dd}`,
    });
  }
  return list;
}

function buildAnnualPeriods() {
  const { year } = getDhakaYearMonth();
  return [year, year - 1, year - 2].map((y) => ({
    periodKey: `FY-${y}`,
    label: `অর্থবছর ${toBanglaNumber(y)} (বার্ষিক)`,
    startDate: `${y}-01-01`,
    endDate: `${y}-12-31`,
  }));
}

export default function DataGovernanceClient({
  initialTab,
  initialPeriods,
  periodsStorage,
  examList,
  initialSessions,
  initialMigrationStatus,
  canManageLocks,
}: DataGovernanceClientProps) {
  const [activeTab, setActiveTab] = useState<"accounting" | "exams" | "migration">(
    initialTab
  );
  const { runWithStepUp, stepUpModal } = useStepUpAction();
  const [periods, setPeriods] = useState<AccountingPeriodRecord[]>(initialPeriods);
  const router = useRouter();
  const [refreshingExams, startExamRefresh] = useTransition();
  const refreshExams = () => startExamRefresh(() => router.refresh());
  const [sessions, setSessions] = useState<any[]>(initialSessions);
  const [migrationStatus, setMigrationStatus] =
    useState<MetadataMigrationStatus>(initialMigrationStatus);

  // Modal state for Accounting Period / Session lock
  const [lockModal, setLockModal] = useState<{
    kind: "period" | "session";
    id: string;
    periodType?: "MONTHLY" | "ANNUAL" | "SESSION";
    label: string;
    startDate?: string;
    endDate?: string;
    shouldLock: boolean;
  } | null>(null);
  const [reasonInput, setReasonInput] = useState("");
  const [submittingLock, setSubmittingLock] = useState(false);
  const [banner, setBanner] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Migration state
  const [runningMigration, setRunningMigration] = useState(false);
  const [refreshingMigration, setRefreshingMigration] = useState(false);
  const [migrationResult, setMigrationResult] = useState<{
    staffLeaves: number;
    examSettings: number;
    madrasaSettings: number;
    accountingPeriods: number;
    auditLogs: number;
  } | null>(null);

  const recentMonths = useMemo(() => buildRecentMonths(12), []);
  const annualYears = useMemo(() => buildAnnualPeriods(), []);

  const periodMap = useMemo(() => {
    const map = new Map<string, AccountingPeriodRecord>();
    for (const p of periods) {
      map.set(p.period_key, p);
    }
    return map;
  }, [periods]);

  const lockedPeriodsCount = useMemo(
    () => periods.filter((p) => p.is_locked).length,
    [periods]
  );
  // Use the current server snapshot, including revalidation after a lock change.
  const lockedExamsCount = examList.ok ? examList.exams.filter((e) => e.is_locked).length : null;

  const openPeriodModal = (
    item: {
      periodKey: string;
      label: string;
      startDate: string;
      endDate: string;
    },
    periodType: "MONTHLY" | "ANNUAL",
    shouldLock: boolean
  ) => {
    setLockModal({
      kind: "period",
      id: item.periodKey,
      periodType,
      label: item.label,
      startDate: item.startDate,
      endDate: item.endDate,
      shouldLock,
    });
    setReasonInput(
      shouldLock ? "অডিট ও মাসিক/বার্ষিক হিসাব ক্লোজিং সম্পন্ন" : ""
    );
    setBanner(null);
  };

  const openSessionModal = (session: any, shouldLock: boolean) => {
    setLockModal({
      kind: "session",
      id: session.id,
      label: session.name || session.id,
      shouldLock,
    });
    setReasonInput(
      shouldLock ? "শিক্ষাবর্ষ ক্লোজিং ও ডেটা ফ্রিজ" : ""
    );
    setBanner(null);
  };

  const handleConfirmLockModal = async () => {
    if (!lockModal) return;
    setSubmittingLock(true);
    setBanner(null);
    try {
      if (lockModal.kind === "period") {
        const res = await runWithStepUp(
          () =>
            toggleAccountingPeriodLock({
              periodKey: lockModal.id,
              periodType: lockModal.periodType || "MONTHLY",
              label: lockModal.label,
              startDate: lockModal.startDate || "",
              endDate: lockModal.endDate || "",
              shouldLock: lockModal.shouldLock,
              reason: reasonInput.trim(),
            }),
          {
            actionLabel: lockModal.shouldLock
              ? "হিসাব পিরিয়ড লক"
              : "হিসাব পিরিয়ড আনলক",
            actionScope: "accounting_period.unlock",
          }
        );
        if (res.error) {
          setBanner({ type: "error", text: res.error });
        } else {
          if (res.period) {
            setPeriods((prev) => {
              const filtered = prev.filter(
                (p) => p.period_key !== res.period!.period_key
              );
              return [res.period!, ...filtered];
            });
          }
          setLockModal(null);
          setBanner({
            type: "success",
            text: lockModal.shouldLock
              ? `"${lockModal.label}" সফলভাবে লক/ফ্রিজ করা হয়েছে।`
              : `"${lockModal.label}" সফলভাবে আনলক করা হয়েছে।`,
          });
        }
      } else {
        const res = await runWithStepUp(
          () =>
            toggleAcademicSessionLock(
              lockModal.id,
              lockModal.shouldLock,
              reasonInput.trim()
            ),
          {
            actionLabel: lockModal.shouldLock
              ? "শিক্ষাবর্ষ লক"
              : "শিক্ষাবর্ষ আনলক",
            actionScope: "academic_session.unlock",
          }
        );
        if (res.error) {
          setBanner({ type: "error", text: res.error });
        } else {
          setSessions((prev) =>
            prev.map((s) =>
              s.id === lockModal.id
                ? {
                    ...s,
                    is_locked: lockModal.shouldLock,
                    lock_reason: lockModal.shouldLock
                      ? reasonInput.trim() || "শিক্ষাবর্ষ লক করা হয়েছে"
                      : null,
                  }
                : s
            )
          );
          setLockModal(null);
          setBanner({
            type: "success",
            text: lockModal.shouldLock
              ? `শিক্ষাবর্ষ "${lockModal.label}" সফলভাবে লক করা হয়েছে।`
              : `শিক্ষাবর্ষ "${lockModal.label}" সফলভাবে আনলক করা হয়েছে।`,
          });
        }
      }
    } catch (err: any) {
      setBanner({
        type: "error",
        text: err?.message || "অপারেশনটি সম্পন্ন করতে সমস্যা হয়েছে।",
      });
    } finally {
      setSubmittingLock(false);
    }
  };

  const handleRefreshMigrationStatus = async () => {
    setRefreshingMigration(true);
    try {
      const updated = await getMetadataMigrationStatus();
      setMigrationStatus(updated);
    } finally {
      setRefreshingMigration(false);
    }
  };

  const handleRunMigration = async () => {
    setRunningMigration(true);
    setBanner(null);
    setMigrationResult(null);
    try {
      const res = await runMetadataToTablesMigration();
      if (!res.success) {
        setBanner({
          type: "error",
          text: res.error || "মাইগ্রেশন ব্যর্থ হয়েছে।",
        });
      } else {
        setMigrationResult(res.migrated);
        const total =
          res.migrated.staffLeaves +
          res.migrated.examSettings +
          res.migrated.madrasaSettings +
          res.migrated.accountingPeriods +
          res.migrated.auditLogs;
        setBanner({
          type: "success",
          text: `মাইগ্রেশন সফলভাবে সম্পন্ন হয়েছে! মোট ${toBanglaNumber(total)} টি রেকর্ড রিলেশনাল SQL টেবিলে ব্যাকফিল করা হয়েছে।`,
        });
        await handleRefreshMigrationStatus();
      }
    } catch (err: any) {
      setBanner({
        type: "error",
        text: err?.message || "মাইগ্রেশন চালাতে ত্রুটি হয়েছে।",
      });
    } finally {
      setRunningMigration(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Permission Banner if not privileged */}
      {!canManageLocks && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 text-xs text-amber-900">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">রিড-অনলি ভিউ (সীমিত অনুমতি)</p>
            <p className="mt-0.5">
              ডাটা লক/আনলক এবং SQL মাইগ্রেশন পরিচালনা করার ক্ষমতা কেবল{" "}
              <strong>মুহতামিম (Muhtamim)</strong>, <strong>অ্যাডমিন (Admin)</strong>{" "}
              অথবা <strong>সুপার অ্যাডমিন (Super Admin)</strong> রোলের জন্য সংরক্ষিত।
            </p>
          </div>
        </div>
      )}

      {/* Feedback Banner */}
      {banner && (
        <div
          className={`p-4 rounded-2xl border text-xs font-medium flex items-center gap-2.5 ${
            banner.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-rose-50 border-rose-200 text-rose-900"
          }`}
        >
          {banner.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{banner.text}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="bg-white p-1.5 rounded-2xl border border-slate-200 shadow-2xs inline-flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => setActiveTab("accounting")}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition flex items-center gap-2 ${
            activeTab === "accounting"
              ? "bg-slate-900 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>হিসাব পিরিয়ড লক</span>
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
              activeTab === "accounting"
                ? "bg-rose-500 text-white"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {toBanglaNumber(lockedPeriodsCount)}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (activeTab !== "exams") {
              setActiveTab("exams");
              refreshExams();
            }
          }}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition flex items-center gap-2 ${
            activeTab === "exams"
              ? "bg-slate-900 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>পরীক্ষা ও সেশন ফ্রিজ</span>
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
              activeTab === "exams"
                ? "bg-rose-500 text-white"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {refreshingExams || lockedExamsCount === null ? "—" : toBanglaNumber(lockedExamsCount)}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("migration")}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition flex items-center gap-2 ${
            activeTab === "migration"
              ? "bg-slate-900 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Database className="w-4 h-4" />
          <span>SQL মাইগ্রেশন ও স্ট্যাটাস</span>
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
              migrationStatus.readyForMigration
                ? "bg-emerald-500 text-white"
                : "bg-amber-500 text-white"
            }`}
          >
            {migrationStatus.readyForMigration ? "SQL OK" : "Setup"}
          </span>
        </button>
      </div>

      {/* ==================================================================== */}
      {/* TAB 1: ACCOUNTING PERIOD LOCKS                                       */}
      {/* ==================================================================== */}
      {activeTab === "accounting" && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  বার্ষিক অর্থবছর লক (Annual Fiscal Year Freeze)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  কোনো অর্থবছর লক করলে সেই বছরের কোনো তারিখে নতুন খরচ এন্ট্রি, এডিট, ডিলিট বা ফি কালেকশন/বাতিল সম্পূর্ণ ব্লক থাকবে।
                </p>
              </div>
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 self-start">
                স্টোরেজ: {periodsStorage === "sql" ? "PostgreSQL Table" : "Metadata Fallback"}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {annualYears.map((item) => {
                const rec = periodMap.get(item.periodKey);
                const isLocked = Boolean(rec?.is_locked);
                return (
                  <div
                    key={item.periodKey}
                    className={`rounded-2xl border p-4 flex flex-col justify-between gap-3 transition ${
                      isLocked
                        ? "bg-rose-50/70 border-rose-200"
                        : "bg-slate-50/60 border-slate-200"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-sm text-slate-900">
                          {item.label}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            isLocked
                              ? "bg-rose-100 text-rose-800 border-rose-300"
                              : "bg-emerald-100 text-emerald-800 border-emerald-300"
                          }`}
                        >
                          {isLocked ? (
                            <>
                              <Lock className="w-3 h-3" /> লকড
                            </>
                          ) : (
                            <>
                              <Unlock className="w-3 h-3" /> উন্মুক্ত
                            </>
                          )}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 font-mono">
                        {item.startDate} → {item.endDate}
                      </p>
                      {isLocked && rec?.lock_reason && (
                        <p className="text-[11px] text-rose-700 mt-2">
                          কারণ: {rec.lock_reason}
                          {rec.locked_by_name ? ` (${rec.locked_by_name})` : ""}
                        </p>
                      )}
                    </div>

                    {canManageLocks && (
                      <button
                        type="button"
                        onClick={() => openPeriodModal(item, "ANNUAL", !isLocked)}
                        className={`w-full py-2 px-3 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
                          isLocked
                            ? "bg-white border border-amber-300 text-amber-800 hover:bg-amber-50"
                            : "bg-rose-600 text-white hover:bg-rose-700"
                        }`}
                      >
                        {isLocked ? (
                          <>
                            <Unlock className="w-3.5 h-3.5" /> আনলক করুন
                          </>
                        ) : (
                          <>
                            <Lock className="w-3.5 h-3.5" /> বছর লক করুন
                          </>
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Monthly Accounting Periods */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                মাসিক হিসাব পিরিয়ড লক (Monthly Closing Lock — সর্বশেষ ১২ মাস)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                মাস শেষে হিসাব মিলিয়ে মাসিক পিরিয়ড লক করে দিলে পিছনের তারিখে (Backdated) কোনো আর্থিক পরিবর্তন করা যাবে না।
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {recentMonths.map((item) => {
                const rec = periodMap.get(item.periodKey);
                const isLocked = Boolean(rec?.is_locked);
                return (
                  <div
                    key={item.periodKey}
                    className={`rounded-xl border p-3.5 flex flex-col justify-between gap-2.5 ${
                      isLocked
                        ? "bg-rose-50/70 border-rose-200"
                        : "bg-white border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-sm text-slate-800">
                          {item.label}
                        </span>
                        {isLocked ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
                            <Lock className="w-3 h-3" /> লকড
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                            উন্মুক্ত
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                        {item.startDate} → {item.endDate}
                      </p>
                      {isLocked && rec?.locked_by_name && (
                        <p className="text-[11px] text-rose-700 mt-1.5 line-clamp-2">
                          {rec.locked_by_name}
                          {rec.lock_reason ? ` • ${rec.lock_reason}` : ""}
                        </p>
                      )}
                    </div>

                    {canManageLocks && (
                      <button
                        type="button"
                        onClick={() => openPeriodModal(item, "MONTHLY", !isLocked)}
                        className={`w-full py-1.5 px-2.5 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 border ${
                          isLocked
                            ? "bg-white border-amber-300 text-amber-800 hover:bg-amber-50"
                            : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200"
                        }`}
                      >
                        {isLocked ? (
                          <>
                            <Unlock className="w-3.5 h-3.5" /> আনলক
                          </>
                        ) : (
                          <>
                            <Lock className="w-3.5 h-3.5" /> মাস লক করুন
                          </>
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: EXAMS & ACADEMIC SESSIONS FREEZE                              */}
      {/* ==================================================================== */}
      {activeTab === "exams" && (
        <div className="space-y-6">
          {/* Exams Freeze Table */}
          <div aria-busy={refreshingExams} className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  পরীক্ষার নম্বর ফ্রিজ (Exam Marks Freeze)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  ফ্রিজ করা পরীক্ষায় নম্বর এন্ট্রি, বিষয় পরিবর্তন, বা পরীক্ষা ডিলিট সার্ভার-সাইডে সম্পূর্ণ ব্লক থাকে।
                </p>
              </div>
              <div className="flex items-center gap-3">
                {examList.ok && !refreshingExams && (
                  <span className="text-xs font-semibold text-slate-500">
                    মোট {toBanglaNumber(examList.exams.length)} টি পরীক্ষা
                  </span>
                )}
                <button
                  type="button"
                  onClick={refreshExams}
                  disabled={refreshingExams}
                  aria-label="পরীক্ষার তালিকা আবার পড়ুন"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold hover:bg-slate-50 disabled:opacity-50"
                >
                  <RefreshCw className={`size-3.5 ${refreshingExams ? "animate-spin" : ""}`} /> আবার পড়ুন
                </button>
              </div>
            </div>

            {refreshingExams ? (
              <p role="status" className="p-8 text-center text-sm text-slate-500">পরীক্ষার তালিকা পড়া হচ্ছে…</p>
            ) : !examList.ok ? (
              <p role="alert" className="p-8 text-center text-sm text-rose-700">
                {examList.reason === "forbidden" ? "পরীক্ষার তালিকা পড়ার অনুমতি পাওয়া যায়নি।" : "পরীক্ষার তালিকা পড়া যায়নি। আবার চেষ্টা করুন।"}
              </p>
            ) : examList.exams.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-500">এই অ্যাকাউন্টে কোনো পরীক্ষা দেখা যাচ্ছে না।</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {examList.exams.map((exam) => (
                  <div
                    key={exam.id}
                    className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70"
                  >
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-slate-900">
                          {exam.title}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs font-bold">
                          {exam.year}
                        </span>
                        {exam.is_published && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                            প্রকাশিত
                          </span>
                        )}
                      </div>
                      {exam.is_locked && (
                        <p className="text-xs text-rose-700 mt-1">
                          {exam.lock_reason || "নম্বর ফ্রিজ করা আছে"}
                          {exam.locked_by_name ? ` • লক করেছেন: ${exam.locked_by_name}` : ""}
                        </p>
                      )}
                    </div>

                    <ExamLockToggle
                      examId={exam.id}
                      examTitle={`${exam.title} (${exam.year})`}
                      initialLocked={Boolean(exam.is_locked)}
                      lockedByName={exam.locked_by_name}
                      lockedAt={exam.locked_at}
                      lockReason={exam.lock_reason}
                      canManageLocks={canManageLocks}
                      size="compact"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Academic Sessions Lock */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
              <h2 className="text-base font-bold text-slate-900">
                শিক্ষাবর্ষ / সেশন লক (Academic Session Lock)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                পুরনো শিক্ষাবর্ষ সমাপ্ত হলে লক করে রাখুন যাতে ঐ সেশনের একাডেমিক রেকর্ড সুরক্ষিত থাকে।
              </p>
            </div>

            {sessions.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                কোনো শিক্ষাবর্ষ তৈরি করা হয়নি।
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {sessions.map((session) => {
                  const isLocked = Boolean(session.is_locked);
                  return (
                    <div
                      key={session.id}
                      className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70"
                    >
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-slate-900">
                            {session.name}
                          </span>
                          {session.is_current && (
                            <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold">
                              বর্তমান সেশন
                            </span>
                          )}
                          {isLocked && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold">
                              <Lock className="w-3 h-3" /> লকড
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 font-mono">
                          {session.start_date || "—"} → {session.end_date || "—"}
                        </p>
                        {isLocked && session.lock_reason && (
                          <p className="text-xs text-rose-700 mt-0.5">
                            কারণ: {session.lock_reason}
                          </p>
                        )}
                      </div>

                      {canManageLocks && (
                        <button
                          type="button"
                          onClick={() => openSessionModal(session, !isLocked)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition inline-flex items-center gap-1.5 border self-start sm:self-auto ${
                            isLocked
                              ? "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
                              : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200"
                          }`}
                        >
                          {isLocked ? (
                            <>
                              <Unlock className="w-3.5 h-3.5" /> আনলক করুন
                            </>
                          ) : (
                            <>
                              <Lock className="w-3.5 h-3.5" /> সেশন লক করুন
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 3: METADATA -> SQL TABLES MIGRATION                              */}
      {/* ==================================================================== */}
      {activeTab === "migration" && (
        <div className="space-y-5">
          {/* Status Overview Banner */}
          <div
            className={`rounded-2xl border p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
              migrationStatus.readyForMigration
                ? "bg-emerald-50/70 border-emerald-200"
                : "bg-amber-50/80 border-amber-200"
            }`}
          >
            <div className="flex items-start gap-3">
              {migrationStatus.readyForMigration ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <h2 className="text-base font-bold text-slate-900">
                  {migrationStatus.readyForMigration
                    ? "সকল রিলেশনাল SQL টেবিল প্রস্তুত আছে!"
                    : "প্রথমে Supabase SQL Editor-এ মাইগ্রেশন স্ক্রিপ্ট রান করুন"}
                </h2>
                <p className="text-xs text-slate-700 leading-relaxed">
                  {migrationStatus.readyForMigration
                    ? "এখন নিচের বাটনে ক্লিক করে পুরনো madrasas.metadata JSON থেকে স্টাফ ছুটির আবেদন, পরীক্ষার গ্রেডিং ও সেটিংস, অডিট কনফিগ এবং পূর্বের অডিট লগসমূহ নিরাপদে SQL টেবিলে ব্যাকফিল করুন। এটি সম্পূর্ণ Idempotent — একাধিকবার চালালেও ডুপ্লিকেট হবে না।"
                    : "রিপোজিটরির রুট ফোল্ডারে থাকা supabase_phase_c_core_erp_migration.sql ফাইলটি আপনার Supabase Dashboard → SQL Editor-এ পেস্ট করে Run করুন। এরপর নিচের 'স্ট্যাটাস রিফ্রেশ' বাটনে ক্লিক করে মাইগ্রেশন চালান।"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleRefreshMigrationStatus}
                disabled={refreshingMigration}
                className="px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold inline-flex items-center gap-1.5 transition"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${
                    refreshingMigration ? "animate-spin" : ""
                  }`}
                />
                <span>স্ট্যাটাস রিফ্রেশ</span>
              </button>

              {canManageLocks && (
                <button
                  type="button"
                  onClick={handleRunMigration}
                  disabled={
                    runningMigration || !migrationStatus.readyForMigration
                  }
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {runningMigration ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>মাইগ্রেশন চলছে...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      <span>মাইগ্রেশন চালান (Backfill Now)</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Migration Result Summary */}
          {migrationResult && (
            <div className="bg-white rounded-2xl border border-emerald-200 p-4 grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
              <div className="p-2.5 rounded-xl bg-emerald-50">
                <div className="text-lg font-bold text-emerald-700">
                  {toBanglaNumber(migrationResult.staffLeaves)}
                </div>
                <div className="text-[11px] text-slate-600">ছুটির আবেদন</div>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-50">
                <div className="text-lg font-bold text-emerald-700">
                  {toBanglaNumber(migrationResult.examSettings)}
                </div>
                <div className="text-[11px] text-slate-600">পরীক্ষার সেটিংস</div>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-50">
                <div className="text-lg font-bold text-emerald-700">
                  {toBanglaNumber(migrationResult.madrasaSettings)}
                </div>
                <div className="text-[11px] text-slate-600">মাদরাসা কনফিগ</div>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-50">
                <div className="text-lg font-bold text-emerald-700">
                  {toBanglaNumber(migrationResult.accountingPeriods)}
                </div>
                <div className="text-[11px] text-slate-600">হিসাব পিরিয়ড</div>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-50">
                <div className="text-lg font-bold text-emerald-700">
                  {toBanglaNumber(migrationResult.auditLogs)}
                </div>
                <div className="text-[11px] text-slate-600">অডিট লগ</div>
              </div>
            </div>
          )}

          {/* Table Health Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {migrationStatus.tables.map((t) => (
              <div
                key={t.table}
                className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      {t.labelBn}
                    </h3>
                    <code className="text-[11px] font-mono text-indigo-600">
                      public.{t.table}
                    </code>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      t.exists
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-rose-50 text-rose-700 border-rose-200"
                    }`}
                  >
                    {t.exists ? "SQL Ready" : "টেবিল নেই"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                    <div className="text-[10px] text-slate-500">SQL রো সংখ্যা</div>
                    <div className="text-lg font-bold text-slate-900 mt-0.5">
                      {toBanglaNumber(t.sqlRowCount)}
                    </div>
                  </div>
                  <div className="bg-amber-50/60 rounded-xl p-2.5 border border-amber-100">
                    <div className="text-[10px] text-amber-700">পুরনো JSON আইটেম</div>
                    <div className="text-lg font-bold text-amber-800 mt-0.5">
                      {toBanglaNumber(t.legacyJsonCount)}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Exams Lock Column Probe Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    পরীক্ষার ফ্রিজ কলাম (Exam Lock)
                  </h3>
                  <code className="text-[11px] font-mono text-indigo-600">
                    public.exams.is_locked
                  </code>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    migrationStatus.examLockColumnExists
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-rose-50 text-rose-700 border-rose-200"
                  }`}
                >
                  {migrationStatus.examLockColumnExists ? "SQL Ready" : "কলাম নেই"}
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                <Layers className="w-3.5 h-3.5 inline mr-1 text-slate-400" />
                {migrationStatus.examLockColumnExists
                  ? "exams ও academic_sessions টেবিলে লক কলাম যুক্ত হয়েছে।"
                  : "মাইগ্রেশন SQL চালালে exams ও academic_sessions টেবিলে is_locked কলাম যুক্ত হবে।"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* LOCK / UNLOCK CONFIRMATION MODAL                                     */}
      {/* ==================================================================== */}
      {lockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-start gap-3">
              <div
                className={`p-3 rounded-xl shrink-0 ${
                  lockModal.shouldLock
                    ? "bg-rose-50 text-rose-600"
                    : "bg-amber-50 text-amber-600"
                }`}
              >
                {lockModal.shouldLock ? (
                  <Lock className="w-6 h-6" />
                ) : (
                  <Unlock className="w-6 h-6" />
                )}
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {lockModal.shouldLock
                    ? `${lockModal.label} — লক/ফ্রিজ করুন`
                    : `${lockModal.label} — আনলক করুন`}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {lockModal.shouldLock
                    ? "লক করার পর এই সময়কালের সকল পরিবর্তন সার্ভার-সাইডে ব্লক থাকবে।"
                    : "আনলক করার পর পুনরায় ডেটা এন্ট্রি/সংশোধন করা যাবে এবং এটি CRITICAL অডিট লগে সংরক্ষিত হবে।"}
                </p>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                {lockModal.shouldLock ? "লক করার কারণ" : "আনলক করার কারণ"}
              </label>
              <textarea
                rows={2}
                value={reasonInput}
                onChange={(e) => setReasonInput(e.target.value)}
                placeholder="সুনির্দিষ্ট কারণ লিখুন..."
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setLockModal(null)}
                disabled={submittingLock}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={handleConfirmLockModal}
                disabled={submittingLock}
                className={`px-5 py-2 text-xs font-semibold rounded-xl text-white transition flex items-center gap-1.5 shadow-sm ${
                  lockModal.shouldLock
                    ? "bg-rose-600 hover:bg-rose-700"
                    : "bg-amber-600 hover:bg-amber-700"
                }`}
              >
                {submittingLock ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    প্রক্রিয়াধীন...
                  </>
                ) : lockModal.shouldLock ? (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    হ্যাঁ, লক করুন
                  </>
                ) : (
                  <>
                    <Unlock className="w-3.5 h-3.5" />
                    হ্যাঁ, আনলক করুন
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {stepUpModal}
    </div>
  );
}
