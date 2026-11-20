"use client";

import React, { useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Award,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  Trophy,
  Sparkles,
} from "lucide-react";
import { toBanglaNumber } from "@/lib/numberToBangla";
import {
  computeStudentExamSummary,
  toBanglaOrdinal,
  type ExamGradingConfig,
  type StudentExamSummary,
  type MeritPositionResult,
} from "@/lib/exam-grading";
import { seedPortalOfflineCache } from "@/lib/portal-sync";
import { useOfflinePortalSnapshot } from "@/hooks/useOfflinePortalData";

interface PortalExamsClientProps {
  students: any[];
  child: any;
  enrichedExams: any[];
  selectedExamId: string | null;
  currentExam: any | null;
  isCurrentExamPublished: boolean;
  rawResults: any[];
  summary: StudentExamSummary;
  merit: MeritPositionResult;
  gradingConfig: ExamGradingConfig;
}

export default function PortalExamsClient({
  students,
  child,
  enrichedExams,
  selectedExamId,
  currentExam,
  isCurrentExamPublished,
  rawResults,
  summary,
  merit,
  gradingConfig,
}: PortalExamsClientProps) {
  const offlineSnapshot = useOfflinePortalSnapshot();

  // Seed Dexie IndexedDB silently for offline access
  useEffect(() => {
    if (!child?.id) return;
    const summaryRecord =
      isCurrentExamPublished && selectedExamId
        ? [
            {
              id: `${child.id}_${selectedExamId}`,
              student_id: child.id,
              exam_id: selectedExamId,
              exam_title: currentExam?.title || currentExam?.name || "সাময়িক পরীক্ষা",
              exam_year: currentExam?.year || null,
              has_marks: summary.hasMarks,
              grade_label: summary.gradeLabel,
              gpa: summary.gpa,
              percentage: summary.percentage,
              total_obtained: summary.totalObtained,
              total_max: summary.totalMax,
              is_passed: summary.isPassed,
              status_label: summary.statusLabel,
              merit_position: merit.meritPosition,
              merit_label: merit.formattedPosition,
              total_candidates: merit.totalCandidates,
              updated_at: new Date().toISOString(),
            },
          ]
        : [];

    seedPortalOfflineCache("student", {
      exams: enrichedExams,
      examResults: rawResults,
      examSummaries: summaryRecord,
    });
  }, [
    child?.id,
    enrichedExams,
    rawResults,
    isCurrentExamPublished,
    selectedExamId,
    currentExam,
    summary,
    merit,
  ]);

  // Offline fallback if server results empty but local Dexie has rows
  const effectiveSummary = useMemo(() => {
    if (summary.hasMarks) return summary;
    if (!selectedExamId || !offlineSnapshot?.examResults?.length) return summary;
    const cachedRows = offlineSnapshot.examResults.filter(
      (r: any) =>
        (!child?.id || r.student_id === child.id) &&
        (!selectedExamId || r.exam_id === selectedExamId)
    );
    if (cachedRows.length === 0) return summary;
    return computeStudentExamSummary(cachedRows, gradingConfig);
  }, [summary, selectedExamId, offlineSnapshot?.examResults, child?.id, gradingConfig]);

  const effectiveMerit: MeritPositionResult = useMemo(() => {
    if (merit.meritPosition !== null || merit.totalCandidates > 0) return merit;
    const cached = (offlineSnapshot?.examSummaries || []).find(
      (s: any) =>
        (!child?.id || s.student_id === child.id) &&
        (!selectedExamId || s.exam_id === selectedExamId)
    ) as any;
    if (!cached) return merit;
    return {
      meritPosition: cached.merit_position ?? null,
      totalCandidates: Number(cached.total_candidates || 0),
      formattedPosition:
        cached.merit_label ||
        (cached.merit_position ? toBanglaOrdinal(cached.merit_position) : "অপ্রযোজ্য"),
    };
  }, [merit, offlineSnapshot?.examSummaries, child?.id, selectedExamId]);

  const className =
    (Array.isArray(child?.classes) ? child.classes[0]?.name : child?.classes?.name) ||
    child?.class_name ||
    "";

  return (
    <div className="space-y-5 sm:space-y-6 w-full max-w-full overflow-x-hidden">
      {/* Header with Child Switcher */}
      <div className="bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          {child.photo_url ? (
            <img
              src={child.photo_url}
              alt=""
              className="w-12 h-12 rounded-xl object-cover border border-purple-200 shrink-0 shadow-2xs"
            />
          ) : (
            <div className="p-2.5 bg-purple-50 text-purple-700 rounded-xl shrink-0">
              <Award className="w-5 h-5" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-bold text-slate-900">
              পরীক্ষা ও ফলাফল বিবরণী
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>
                শিক্ষার্থী:{" "}
                <strong className="text-slate-800">
                  {child.first_name} {child.last_name}
                </strong>
              </span>
              {(child.student_id || child.student_id_formatted) && (
                <span className="font-mono bg-purple-50 text-purple-700 px-2 py-0.5 rounded text-xs border border-purple-200 font-bold">
                  আইডি: {child.student_id || child.student_id_formatted}
                </span>
              )}
              <span>(রোল: {toBanglaNumber(child.roll_number || "-")})</span>
              {className && <span>• জামাত: {className}</span>}
            </p>
          </div>
        </div>

        {students.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            {students.map((s: any) => (
              <Link
                key={s.id}
                href={`/portal/exams?student_id=${s.id}${
                  selectedExamId ? `&exam_id=${selectedExamId}` : ""
                }`}
                className={`min-h-[44px] sm:min-h-0 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 shrink-0 ${
                  s.id === child.id
                    ? "bg-purple-700 text-white shadow-xs"
                    : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                }`}
              >
                <span>
                  {s.first_name} {s.last_name}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Exam Selector Tabs */}
      {enrichedExams.length > 0 ? (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {enrichedExams.map((exam: any) => (
            <Link
              key={exam.id}
              href={`/portal/exams?student_id=${child.id}&exam_id=${exam.id}`}
              className={`min-h-[44px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition flex items-center gap-2 shrink-0 ${
                exam.id === selectedExamId
                  ? "bg-purple-700 text-white shadow-xs"
                  : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              <span>
                {exam.title || exam.name}
                {exam.year ? ` (${toBanglaNumber(exam.year)})` : ""}
              </span>
              {exam.is_published ? (
                <span className="w-2 h-2 rounded-full bg-emerald-400" title="ফলাফল প্রকাশিত" />
              ) : (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">
                  প্রক্রিয়াধীন
                </span>
              )}
            </Link>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-500">
          এখনো কোনো পরীক্ষার তথ্য যুক্ত করা হয়নি।
        </div>
      )}

      {/* Unpublished State */}
      {enrichedExams.length > 0 && !isCurrentExamPublished ? (
        <div className="bg-white rounded-3xl border border-amber-200 p-6 sm:p-8 text-center space-y-4 shadow-xs">
          <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto">
            <Clock className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto space-y-2">
            <h3 className="text-lg font-bold text-slate-800">
              {currentExam?.title || "পরীক্ষার"} ফলাফল এখনো প্রকাশিত হয়নি
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
              উস্তাদদের নম্বর মূল্যায়ন ও নিরীক্ষণ চলছে। মাদরাসা কর্তৃপক্ষ ফলাফল আনুষ্ঠানিকভাবে প্রকাশ করলেই এখানে সম্পূর্ণ মার্কশিট, জিপিএ ও মেধাস্থান দেখা যাবে।
            </p>
            {currentExam?.publish_note && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 mt-3 text-left">
                <strong>কর্তৃপক্ষের নোটিশ:</strong> {currentExam.publish_note}
              </div>
            )}
          </div>
        </div>
      ) : enrichedExams.length > 0 ? (
        <>
          {/* Overall Performance Summary Card with Merit Position, GPA, Pass/Fail */}
          <div className="bg-gradient-to-br from-purple-950 via-slate-900 to-indigo-950 text-white rounded-3xl p-5 sm:p-6 shadow-md border border-purple-900/60 space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className="text-xs font-bold text-purple-300 tracking-wide">
                    সামগ্রিক পরীক্ষার মূল্যায়ন
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/40 font-bold">
                    <Sparkles className="w-3 h-3" />
                    প্রকাশিত ফলাফল
                  </span>
                </div>
                <h2 className="text-lg sm:text-2xl font-bold break-words">
                  {currentExam?.title || "সাময়িক পরীক্ষার ফলাফল"}
                </h2>
                {effectiveSummary.hasMarks ? (
                  <p className="text-xs sm:text-sm text-purple-200 mt-1">
                    মোট প্রাপ্ত নম্বর:{" "}
                    <strong className="text-white">
                      {toBanglaNumber(effectiveSummary.totalObtained)} /{" "}
                      {toBanglaNumber(effectiveSummary.totalMax)}
                    </strong>{" "}
                    ({toBanglaNumber(effectiveSummary.percentage)}%)
                  </p>
                ) : (
                  <p className="text-xs text-purple-200 mt-1">
                    এই পরীক্ষায় এখনো বিষয়ভিত্তিক নম্বর এন্ট্রি হয়নি।
                  </p>
                )}
              </div>

              {effectiveSummary.hasMarks && (
                <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl border self-start md:self-center shrink-0 bg-white/10 border-white/20">
                  {effectiveSummary.isPassed ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                  )}
                  <div>
                    <span className="text-[10px] text-purple-200 block font-semibold">
                      ফলাফলের অবস্থা
                    </span>
                    <span
                      className={`text-sm sm:text-base font-black ${
                        effectiveSummary.isPassed ? "text-emerald-300" : "text-rose-300"
                      }`}
                    >
                      {effectiveSummary.statusLabel}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* 4 Key Academic Metrics Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
              <div className="p-3.5 bg-white/10 backdrop-blur-xs border border-white/15 rounded-2xl">
                <span className="text-[11px] text-purple-200 font-semibold block">
                  প্রাপ্ত বিভাগ / গ্রেড
                </span>
                <span className="text-base sm:text-lg font-extrabold text-amber-300 block mt-0.5 break-words">
                  {effectiveSummary.hasMarks ? effectiveSummary.gradeLabel : "অনির্ধারিত"}
                </span>
              </div>

              <div className="p-3.5 bg-white/10 backdrop-blur-xs border border-white/15 rounded-2xl">
                <span className="text-[11px] text-purple-200 font-semibold block">
                  জিপিএ (GPA)
                </span>
                <span className="text-base sm:text-lg font-extrabold text-white block mt-0.5">
                  {effectiveSummary.hasMarks
                    ? toBanglaNumber(effectiveSummary.gpa.toFixed(2))
                    : "অপ্রযোজ্য"}
                </span>
              </div>

              <div className="p-3.5 bg-amber-400/15 backdrop-blur-xs border border-amber-300/35 rounded-2xl">
                <span className="text-[11px] text-amber-200 font-semibold flex items-center gap-1">
                  <Trophy className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                  <span>মেধাস্থান</span>
                </span>
                <span className="text-base sm:text-lg font-black text-amber-300 block mt-0.5">
                  {effectiveSummary.hasMarks ? effectiveMerit.formattedPosition : "অপ্রযোজ্য"}
                </span>
                {effectiveSummary.hasMarks && effectiveMerit.totalCandidates > 0 && (
                  <span className="text-[10px] text-amber-100/80 block mt-0.5">
                    মোট {toBanglaNumber(effectiveMerit.totalCandidates)} জন পরীক্ষার্থীর মধ্যে
                  </span>
                )}
              </div>

              <div className="p-3.5 bg-white/10 backdrop-blur-xs border border-white/15 rounded-2xl">
                <span className="text-[11px] text-purple-200 font-semibold block">
                  মোট বিষয় ও শতকরা
                </span>
                <span className="text-base sm:text-lg font-extrabold text-white block mt-0.5">
                  {effectiveSummary.hasMarks
                    ? `${toBanglaNumber(effectiveSummary.subjectCount)} বিষয় • ${toBanglaNumber(
                        effectiveSummary.percentage
                      )}%`
                    : "০ বিষয়"}
                </span>
              </div>
            </div>
          </div>

          {/* Subject-wise Marksheet: Mobile Stacked Cards + Desktop Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-4 h-4 text-purple-600 shrink-0" />
                <h3 className="font-bold text-slate-900 text-sm sm:text-base truncate">
                  বিষয়ভিত্তিক নম্বর ও গ্রেড বিবরণী
                </h3>
              </div>
              {effectiveSummary.hasMarks && (
                <span className="text-xs font-bold text-slate-500 shrink-0">
                  মোট {toBanglaNumber(effectiveSummary.subjectCount)}টি বিষয়
                </span>
              )}
            </div>

            {effectiveSummary.subjects.length > 0 ? (
              <>
                {/* Mobile Stacked Cards (< 768px) */}
                <div className="md:hidden divide-y divide-slate-100">
                  {effectiveSummary.subjects.map((sub) => (
                    <div key={sub.id} className="p-4 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="font-bold text-slate-900 text-sm break-words">
                            {sub.subjectName}
                          </h4>
                          <p className="text-xs text-slate-500 mt-0.5">
                            প্রাপ্ত নম্বর:{" "}
                            <strong className="text-slate-900">
                              {toBanglaNumber(sub.marksObtained)}
                            </strong>{" "}
                            / {toBanglaNumber(sub.totalMarks)} ({toBanglaNumber(sub.percentage)}%)
                          </p>
                        </div>
                        <span
                          className={`inline-block px-2.5 py-1 rounded-lg text-[11px] font-bold border shrink-0 ${sub.badgeClass}`}
                        >
                          {sub.gradeLabel}
                        </span>
                      </div>

                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            sub.isFailed ? "bg-rose-500" : "bg-purple-600"
                          }`}
                          style={{ width: `${Math.min(100, sub.percentage)}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                        <span>জিপিএ: {toBanglaNumber(sub.gpa.toFixed(2))}</span>
                        <span
                          className={`font-bold ${
                            sub.isFailed ? "text-rose-600" : "text-emerald-600"
                          }`}
                        >
                          {sub.isFailed ? "অকৃতকার্য" : "উত্তীর্ণ"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table (>= 768px) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 tracking-wider">
                        <th className="px-4 py-3.5">বিষয়ের নাম</th>
                        <th className="px-4 py-3.5">পূর্ণমান</th>
                        <th className="px-4 py-3.5">প্রাপ্ত নম্বর</th>
                        <th className="px-4 py-3.5">শতকরা হার</th>
                        <th className="px-4 py-3.5">জিপিএ</th>
                        <th className="px-4 py-3.5 text-right">গ্রেড / বিভাগ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {effectiveSummary.subjects.map((sub) => (
                        <tr key={sub.id} className="hover:bg-slate-50/60 transition">
                          <td className="px-4 py-3 font-bold text-slate-800">{sub.subjectName}</td>
                          <td className="px-4 py-3 text-slate-600 text-xs sm:text-sm">
                            {toBanglaNumber(sub.totalMarks)}
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-900 text-sm">
                            {toBanglaNumber(sub.marksObtained)}
                          </td>
                          <td className="px-4 py-3 text-slate-600 text-xs sm:text-sm">
                            {toBanglaNumber(sub.percentage)}%
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-700 text-xs sm:text-sm">
                            {toBanglaNumber(sub.gpa.toFixed(2))}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span
                              className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold border ${sub.badgeClass}`}
                            >
                              {sub.gradeLabel}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="text-center py-10 px-4 text-slate-400 text-sm">
                এই শিক্ষার্থীর কোনো বিষয়ের নম্বর এন্ট্রি পাওয়া যায়নি।
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
