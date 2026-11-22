"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BookOpen,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Printer,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import type { HifzBundle } from "@/lib/hifz-utils";
import {
  computeKhatmiProgress,
  computePeriodHifzReport,
  computeSabqiParaProgress,
  MUSHAF_TOTAL_PAGES,
  PERIOD_LABELS_BN,
  type HifzReportPeriod,
  type MushafParaProgress,
  type ParaRevisionRating,
  type ParaRevisionRecord,
} from "@/lib/hifz-mushaf";
import { saveParaRevisionAction } from "@/app/actions/hifz";
import { toBanglaNumber } from "@/lib/numberToBangla";
import { toDhakaDateString } from "@/lib/date-utils";

const PERIOD_KEYS: HifzReportPeriod[] = [
  "this_week",
  "this_month",
  "last_month",
  "this_year",
  "last_year",
  "all",
];

const RATING_LABELS: Record<ParaRevisionRating, string> = {
  perfect: "নির্ভুল (মুমতাজ)",
  good: "ভালো (জায়্যিদ)",
  needs_repeat: "পুনরায় রিভিশন প্রয়োজন",
};

interface LiveStudentHifzReportProps {
  studentId: string;
  studentName: string;
  rollNumber?: string | null;
  bundle: HifzBundle;
  initialRevisions?: Record<number, ParaRevisionRecord>;
  canEditRevision?: boolean;
}

export default function LiveStudentHifzReport({
  studentId,
  studentName,
  rollNumber,
  bundle,
  initialRevisions = {},
  canEditRevision = false,
}: LiveStudentHifzReportProps) {
  const router = useRouter();
  const [period, setPeriod] = useState<HifzReportPeriod>("this_month");
  const [revisions, setRevisions] = useState<Record<number, ParaRevisionRecord>>(
    initialRevisions,
  );
  const [editingPara, setEditingPara] = useState<MushafParaProgress | null>(null);
  const [formRevised, setFormRevised] = useState(true);
  const [formDate, setFormDate] = useState(toDhakaDateString());
  const [formMistakes, setFormMistakes] = useState(0);
  const [formRating, setFormRating] = useState<ParaRevisionRating>("good");
  const [formNotes, setFormNotes] = useState("");
  const [saveMessage, setSaveMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  const profile = useMemo(
    () => bundle.hifz_profiles.find((p) => p.student_id === studentId),
    [bundle.hifz_profiles, studentId],
  );
  const studentLogs = useMemo(
    () => bundle.hifz_logs.filter((l) => l.student_id === studentId),
    [bundle.hifz_logs, studentId],
  );
  const studentWeeklySabinas = useMemo(
    () => bundle.hifz_weekly_sabina.filter((w) => w.student_id === studentId),
    [bundle.hifz_weekly_sabina, studentId],
  );

  const isKhatmi = profile?.hifz_category === "khatmi";

  const sabqiSummary = useMemo(
    () =>
      computeSabqiParaProgress(
        profile,
        studentLogs,
        studentWeeklySabinas,
        revisions,
      ),
    [profile, studentLogs, studentWeeklySabinas, revisions],
  );

  const khatmiSummary = useMemo(
    () => computeKhatmiProgress(profile, studentLogs, studentWeeklySabinas),
    [profile, studentLogs, studentWeeklySabinas],
  );

  const periodReport = useMemo(
    () =>
      computePeriodHifzReport(
        profile,
        studentLogs,
        studentWeeklySabinas,
        period,
      ),
    [profile, studentLogs, studentWeeklySabinas, period],
  );

  const activeParas = isKhatmi ? khatmiSummary.paras : sabqiSummary.paras;

  const openRevisionModal = (cell: MushafParaProgress) => {
    if (!canEditRevision) return;
    const existing = cell.revision;
    setEditingPara(cell);
    setFormRevised(existing ? existing.revised : true);
    setFormDate(existing?.revision_date || toDhakaDateString());
    setFormMistakes(existing?.mistakes ?? 0);
    setFormRating(existing?.rating || "good");
    setFormNotes(existing?.notes || "");
    setSaveMessage(null);
  };

  const handleSaveRevision = () => {
    if (!editingPara) return;
    setSaveMessage(null);
    startTransition(async () => {
      const res = await saveParaRevisionAction(studentId, {
        para: editingPara.para,
        revised: formRevised,
        revision_date: formDate,
        mistakes: formMistakes,
        rating: formRating,
        notes: formNotes,
      });

      if (res.error) {
        setSaveMessage({ type: "error", text: res.error });
        return;
      }

      if (res.revision) {
        setRevisions((prev) => ({
          ...prev,
          [editingPara.para]: res.revision!,
        }));
      }
      setEditingPara(null);
      router.refresh();
    });
  };

  return (
    <div className="space-y-5 print:space-y-4">
      {/* Print-only A4 Header */}
      <div className="hidden print:block border-b-2 border-slate-800 pb-3 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              ব্যক্তিগত হিফজ প্রগ্রেস রিপোর্ট (৬১০ পৃষ্ঠা কওমী মুসহাফ)
            </h2>
            <p className="text-sm text-slate-700 mt-0.5">
              শিক্ষার্থী: <strong>{studentName}</strong> · রোল:{" "}
              <strong>{rollNumber ? toBanglaNumber(rollNumber) : "N/A"}</strong> · বিভাগ:{" "}
              <strong>{isKhatmi ? "খতমী (দাওর)" : "সবকী (চলমান হিফজ)"}</strong>
            </p>
          </div>
          <div className="text-right text-xs text-slate-600">
            <div>সময়কাল: {periodReport.periodLabel}</div>
            {periodReport.startDate && periodReport.endDate && (
              <div>
                {periodReport.startDate} হতে {periodReport.endDate}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Period Filter Toolbar + Print Button */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 mr-1">
            <Calendar className="w-4 h-4 text-emerald-600" />
            রিপোর্ট সময়কাল:
          </span>
          {PERIOD_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setPeriod(key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                period === key
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {PERIOD_LABELS_BN[key]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${
              isKhatmi
                ? "bg-indigo-50 text-indigo-800 border-indigo-200"
                : "bg-emerald-50 text-emerald-800 border-emerald-200"
            }`}
          >
            {isKhatmi ? "খতমী (দাওর / খতম)" : "সবকী (চলমান হিফজ)"}
          </span>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            A4 প্রিন্ট
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      {isKhatmi ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="bg-white rounded-2xl border border-indigo-200/80 p-4 shadow-xs">
            <div className="text-xs font-bold text-indigo-700">
              চলমান খতম অগ্রগতি (৬১০ পৃষ্ঠা)
            </div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-slate-900">
                {toBanglaNumber(khatmiSummary.currentCyclePercent)}%
              </span>
              <span className="text-xs font-semibold text-slate-500">
                ({toBanglaNumber(khatmiSummary.currentCyclePagesDone)}/
                {toBanglaNumber(MUSHAF_TOTAL_PAGES)} পৃষ্ঠা)
              </span>
            </div>
            <div className="mt-2 h-2 w-full rounded-full bg-indigo-100 overflow-hidden">
              <div
                className="h-full bg-indigo-600 rounded-full transition-all"
                style={{ width: `${khatmiSummary.currentCyclePercent}%` }}
              />
            </div>
            <div className="mt-1.5 text-[11px] font-semibold text-indigo-700">
              মোট সম্পন্ন খতম: {toBanglaNumber(khatmiSummary.totalKhatamsCompleted)} টি
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
            <div className="text-xs font-bold text-slate-500">
              শোনানো পৃষ্ঠা ({periodReport.periodLabel})
            </div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-slate-900">
                {toBanglaNumber(periodReport.khatmiPagesRecited)} পৃষ্ঠা
              </span>
            </div>
            <div className="mt-1 text-xs text-slate-500">
              প্রায় {toBanglaNumber(periodReport.khatmiEquivalentParas)} পারা ·{" "}
              {toBanglaNumber(periodReport.logsCount)} দিনের এন্ট্রি
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
            <div className="text-xs font-bold text-slate-500">
              চলমান খতমে পারা অবস্থান
            </div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-emerald-700">
                {toBanglaNumber(khatmiSummary.completedParasInCycle.length)}
              </span>
              <span className="text-xs font-semibold text-slate-500">
                সম্পন্ন · {toBanglaNumber(khatmiSummary.partialParasInCycle.length)} টি আংশিক
              </span>
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {khatmiSummary.partialParasInCycle.length > 0
                ? khatmiSummary.partialParasInCycle
                    .slice(0, 3)
                    .map(
                      (p) =>
                        `পারা ${toBanglaNumber(p.para)} (${toBanglaNumber(p.percent)}%)`,
                    )
                    .join(", ")
                : "আংশিক কোনো পারা নেই"}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
            <div className="text-xs font-bold text-slate-500">
              সবিনা ও ভুল ({periodReport.periodLabel})
            </div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-slate-900">
                {toBanglaNumber(periodReport.weeklySabinaCount)} সেশন
              </span>
            </div>
            <div className="mt-1 text-xs text-slate-500">
              নির্ভুল: {toBanglaNumber(periodReport.perfectParas.length)} · দুর্বল:{" "}
              {toBanglaNumber(periodReport.weakParas.length)} · ভুল:{" "}
              {toBanglaNumber(periodReport.totalMistakes)}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="bg-white rounded-2xl border border-emerald-200/80 p-4 shadow-xs">
            <div className="text-xs font-bold text-emerald-700">
              মোট হিফজ অগ্রগতি (৬১০ পৃষ্ঠা)
            </div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-slate-900">
                {toBanglaNumber(sabqiSummary.overallPercent)}%
              </span>
              <span className="text-xs font-semibold text-slate-500">
                ({toBanglaNumber(sabqiSummary.totalPagesDone)}/
                {toBanglaNumber(MUSHAF_TOTAL_PAGES)} পৃষ্ঠা)
              </span>
            </div>
            <div className="mt-2 h-2 w-full rounded-full bg-emerald-100 overflow-hidden">
              <div
                className="h-full bg-emerald-600 rounded-full transition-all"
                style={{ width: `${sabqiSummary.overallPercent}%` }}
              />
            </div>
            <div className="mt-1.5 text-[11px] font-semibold text-emerald-700">
              সম্পন্ন পারা: {toBanglaNumber(sabqiSummary.completedParasCount)} / ৩০ পারা
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-amber-200/80 p-4 shadow-xs">
            <div className="text-xs font-bold text-amber-800">
              রানিং পারা (অটো-ডিটেক্টেড)
            </div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-slate-900">
                {sabqiSummary.runningPara
                  ? `পারা ${toBanglaNumber(sabqiSummary.runningPara)}`
                  : "নির্ধারিত নয়"}
              </span>
              {sabqiSummary.runningPara && (
                <span className="text-xs font-bold text-amber-700">
                  {toBanglaNumber(sabqiSummary.runningParaPercent)}%
                </span>
              )}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {sabqiSummary.runningPara
                ? `১–${toBanglaNumber(sabqiSummary.runningParaPagesDone)} / ${toBanglaNumber(sabqiSummary.runningParaTotalPages)} পৃষ্ঠা সম্পন্ন`
                : "সবক এন্ট্রি হলে স্বয়ংক্রিয়ভাবে দেখাবে"}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
            <div className="text-xs font-bold text-slate-500">
              সবক ও আমুখতা ({periodReport.periodLabel})
            </div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-slate-900">
                {toBanglaNumber(periodReport.sabakPagesRead)} পৃষ্ঠা
              </span>
              <span className="text-xs font-semibold text-slate-500">সবক</span>
            </div>
            <div className="mt-1 text-xs text-slate-500">
              আমুখতা শোনানো: {toBanglaNumber(periodReport.amukhtaParasRecited.length)} টি পারা (
              {toBanglaNumber(periodReport.amukhtaSessionsCount)} সেশন)
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
            <div className="text-xs font-bold text-slate-500">
              রিভিশন ও সবিনা স্ট্যাটাস
            </div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span
                className={`text-2xl font-extrabold ${
                  sabqiSummary.pendingRevisionParas.length > 0
                    ? "text-rose-600"
                    : "text-emerald-700"
                }`}
              >
                {toBanglaNumber(sabqiSummary.pendingRevisionParas.length)} টি
              </span>
              <span className="text-xs font-semibold text-slate-500">
                পারা রিভিশন বাকি
              </span>
            </div>
            <div className="mt-1 text-xs text-slate-500">
              সবিনা: {toBanglaNumber(periodReport.weeklySabinaCount)} সেশন · মোট ভুল:{" "}
              {toBanglaNumber(periodReport.totalMistakes)}
            </div>
          </div>
        </div>
      )}

      {/* Pending Revision Banner (Sabqi only) */}
      {!isKhatmi && sabqiSummary.pendingRevisionParas.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-bold text-amber-900">
                নতুন সম্পন্ন পারার রিভিশন বাকি আছে
              </div>
              <p className="text-xs text-amber-800 mt-0.5">
                নিচের পারাগুলোর সবক শেষ হয়েছে, কিন্তু এখনো পূর্ণ পারা রিভিশন রেকর্ড করা হয়নি।
                {canEditRevision && " পারায় ক্লিক করে রিভিশন তথ্য সেভ করুন।"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {sabqiSummary.pendingRevisionParas.map((p) => {
              const cell = sabqiSummary.paras[p - 1];
              return (
                <button
                  key={p}
                  type="button"
                  disabled={!canEditRevision}
                  onClick={() => openRevisionModal(cell)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition ${
                    canEditRevision
                      ? "bg-white text-amber-900 border-amber-300 hover:bg-amber-100 cursor-pointer"
                      : "bg-white/70 text-amber-800 border-amber-200 cursor-default"
                  }`}
                >
                  পারা {toBanglaNumber(p)} · রিভিশন দিন
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 30-Para Qawmi Mushaf Live Grid */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-emerald-600" />
              ৩০ পারা কওমী মুসহাফ লাইভ প্রগ্রেস গ্রিড (৬১০ পৃষ্ঠা)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              পারা ১: ২১ পৃষ্ঠা · পারা ২–২৮: ২০ পৃষ্ঠা · পারা ২৯: ২৪ পৃষ্ঠা · পারা ৩০: ২৫ পৃষ্ঠা
            </p>
          </div>
          {canEditRevision && !isKhatmi && (
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg print:hidden">
              সম্পন্ন পারায় ক্লিক করে রিভিশন আপডেট করুন
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 print:grid-cols-6 gap-2.5">
          {activeParas.map((cell) => {
            const canClick =
              canEditRevision && !isKhatmi && cell.isCompleted && !cell.isPreMemorized;

            let cardClasses =
              "bg-slate-50/70 border-slate-200/80 text-slate-700";
            if (cell.isRunning) {
              cardClasses =
                "bg-amber-50/90 border-amber-300 ring-1 ring-amber-200 text-amber-950";
            } else if (cell.revisionPending) {
              cardClasses =
                "bg-rose-50/70 border-rose-300 text-rose-950";
            } else if (cell.isCompleted) {
              cardClasses = cell.isPreMemorized
                ? "bg-indigo-50/70 border-indigo-200 text-indigo-950"
                : "bg-emerald-50/80 border-emerald-200 text-emerald-950";
            }

            return (
              <div
                key={cell.para}
                onClick={canClick ? () => openRevisionModal(cell) : undefined}
                role={canClick ? "button" : undefined}
                tabIndex={canClick ? 0 : undefined}
                onKeyDown={
                  canClick
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openRevisionModal(cell);
                        }
                      }
                    : undefined
                }
                className={`rounded-xl border p-2.5 flex flex-col justify-between gap-1.5 transition ${cardClasses} ${
                  canClick ? "cursor-pointer hover:shadow-sm hover:-translate-y-0.5" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-extrabold">
                    পারা {toBanglaNumber(cell.para)}
                  </span>
                  <span className="text-[10px] font-semibold opacity-70">
                    {toBanglaNumber(cell.mushafStartPage)}–{toBanglaNumber(cell.mushafEndPage)}
                  </span>
                </div>

                <div>
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span>
                      {toBanglaNumber(cell.completedPages)}/{toBanglaNumber(cell.totalPages)} পৃ.
                    </span>
                    <span>{toBanglaNumber(cell.percent)}%</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-white/80 overflow-hidden border border-black/5">
                    <div
                      className={`h-full rounded-full transition-all ${
                        cell.isRunning
                          ? "bg-amber-500"
                          : cell.revisionPending
                            ? "bg-rose-500"
                            : cell.isPreMemorized
                              ? "bg-indigo-500"
                              : cell.isCompleted
                                ? "bg-emerald-600"
                                : "bg-slate-300"
                      }`}
                      style={{ width: `${cell.percent}%` }}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1 pt-0.5">
                  {cell.isRunning && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-200/80 text-amber-900">
                      {isKhatmi ? "আংশিক" : "চলমান সবক"}
                    </span>
                  )}
                  {!isKhatmi && cell.isPreMemorized && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800">
                      পূর্ব-মুখস্থ
                    </span>
                  )}
                  {!isKhatmi && cell.revisionPending && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">
                      রিভিশন বাকি
                    </span>
                  )}
                  {!isKhatmi && cell.isCompleted && !cell.isPreMemorized && cell.revision?.revised && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                      <CheckCircle2 className="w-2.5 h-2.5" />
                      রিভিশন ✓
                    </span>
                  )}
                  {isKhatmi && cell.isCompleted && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                      ১০০% সম্পন্ন
                    </span>
                  )}
                  {cell.latestSabinaStatus === "weak" && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-200/70 text-rose-900">
                      সবিনা দুর্বল
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Period Breakdown Cards: Amukhta & Weekly Sabina */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-600" />
            {periodReport.periodLabel}-এর সবক ও আমুখতা বিবরণ
          </h3>

          {!isKhatmi ? (
            <div className="space-y-3 text-xs">
              <div>
                <div className="font-bold text-slate-600 mb-1.5">
                  আমুখতা শোনানো পারাসমূহ ({toBanglaNumber(periodReport.amukhtaParasRecited.length)} টি):
                </div>
                {periodReport.amukhtaParasRecited.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {periodReport.amukhtaParasRecited.map((p) => (
                      <span
                        key={p}
                        className="px-2.5 py-1 rounded-lg font-bold bg-purple-50 text-purple-800 border border-purple-200"
                      >
                        পারা {toBanglaNumber(p)}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400">এই সময়কালে কোনো আমুখতা রেকর্ড পাওয়া যায়নি।</p>
                )}
              </div>

              <div>
                <div className="font-bold text-slate-600 mb-1.5">
                  সবক পঠিত পারা ({toBanglaNumber(periodReport.sabakParasTouched.length)} টি):
                </div>
                {periodReport.sabakParasTouched.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {periodReport.sabakParasTouched.map((p) => (
                      <span
                        key={p}
                        className="px-2.5 py-1 rounded-lg font-bold bg-emerald-50 text-emerald-800 border border-emerald-200"
                      >
                        পারা {toBanglaNumber(p)}
                        {periodReport.sabakParasCompletedInPeriod.includes(p)
                          ? " ✓ (সম্পন্ন)"
                          : ""}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400">এই সময়কালে কোনো সবক রেকর্ড পাওয়া যায়নি।</p>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2 text-xs text-slate-700">
              <p>
                মোট দাওর শোনানো:{" "}
                <strong>{toBanglaNumber(periodReport.khatmiPagesRecited)} পৃষ্ঠা</strong> (প্রায়{" "}
                <strong>{toBanglaNumber(periodReport.khatmiEquivalentParas)} পারা</strong>)
              </p>
              <p>
                এন্ট্রিকৃত দিন: <strong>{toBanglaNumber(periodReport.logsCount)} দিন</strong> · মোট
                ভুল: <strong>{toBanglaNumber(periodReport.totalMistakes)} টি</strong>
              </p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-teal-600" />
            {periodReport.periodLabel}-এর সাপ্তাহিক সবিনা (বৃহস্পতিবার)
          </h3>

          {periodReport.filteredWeeklySabinas.length > 0 ? (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {periodReport.filteredWeeklySabinas.map((w) => (
                <div
                  key={w.id}
                  className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <div className="font-bold text-slate-800">{w.sabina_date}</div>
                    <div className="text-slate-500 mt-0.5">
                      পারা:{" "}
                      {(w.para_breakdown || []).length > 0
                        ? w.para_breakdown.map((item) => toBanglaNumber(item.para)).join(", ")
                        : `${toBanglaNumber(w.assigned_para_from)}–${toBanglaNumber(w.assigned_para_to)}`}
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-lg font-bold bg-white border border-slate-200 text-slate-700">
                    ভুল: {toBanglaNumber(w.total_mistakes)} টি
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400">
              এই সময়কালে কোনো সাপ্তাহিক সবিনা রেকর্ড পাওয়া যায়নি।
            </p>
          )}
        </div>
      </div>

      {/* Para Revision Modal */}
      {editingPara && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-emerald-600" />
                  পারা {toBanglaNumber(editingPara.para)}-এর রিভিশন তথ্য
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  মোট {toBanglaNumber(editingPara.totalPages)} পৃষ্ঠা (মুসহাফ পৃ.{" "}
                  {toBanglaNumber(editingPara.mushafStartPage)}–
                  {toBanglaNumber(editingPara.mushafEndPage)})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingPara(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {saveMessage && (
                <div
                  className={`p-3 rounded-xl text-xs font-bold ${
                    saveMessage.type === "error"
                      ? "bg-rose-50 text-rose-700 border border-rose-200"
                      : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  }`}
                >
                  {saveMessage.text}
                </div>
              )}

              <label className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formRevised}
                  onChange={(e) => setFormRevised(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600"
                />
                <span className="text-sm font-bold text-emerald-950">
                  পূর্ণ পারার রিভিশন সম্পন্ন হয়েছে
                </span>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    রিভিশনের তারিখ
                  </label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ভুল / লোকমা সংখ্যা
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={200}
                    value={formMistakes}
                    onChange={(e) => setFormMistakes(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  রিভিশনের মান / মূল্যায়ন
                </label>
                <select
                  value={formRating}
                  onChange={(e) => setFormRating(e.target.value as ParaRevisionRating)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
                >
                  {(Object.keys(RATING_LABELS) as ParaRevisionRating[]).map((key) => (
                    <option key={key} value={key}>
                      {RATING_LABELS[key]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  উস্তাদের মন্তব্য (ঐচ্ছিক)
                </label>
                <textarea
                  rows={3}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="যেমন: প্রথম ১০ পৃষ্ঠা নির্ভুল, শেষের ৫ পৃষ্ঠা আরেকবার শোনাতে হবে..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingPara(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition"
              >
                বাতিল
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleSaveRevision}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition cursor-pointer"
              >
                {isPending ? "সংরক্ষণ হচ্ছে..." : "রিভিশন সংরক্ষণ করুন"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
