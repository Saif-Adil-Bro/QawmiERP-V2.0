"use client";

import { useState } from "react";
import {
  BookOpen,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Users,
  Target,
  CalendarDays,
  Printer,
  ChevronRight,
  TrendingUp,
  RefreshCw,
  Plus,
} from "lucide-react";
import { Syllabus, DailyClassRecord, SyllabusIntelligenceMetrics, SyllabusTopic } from "@/lib/syllabus";
import DailyClassEntryModal from "@/components/syllabus/DailyClassEntryModal";
import TopicRevisionHistoryModal from "@/components/syllabus/TopicRevisionHistoryModal";
import StudentAbsentFollowupModal from "@/components/syllabus/StudentAbsentFollowupModal";
import SyllabusPrintReport from "@/components/syllabus/SyllabusPrintReport";
import { getSyllabusDashboardData } from "@/app/actions/syllabus";

interface Props {
  initialData: {
    overallProgress: number;
    onTrackCount: number;
    atRiskCount: number;
    behindCount: number;
    completedCount: number;
    totalTopics: number;
    completedTopics: number;
    remainingTopics: number;
    remainingWorkingDays: number;
    allMetrics: SyllabusIntelligenceMetrics[];
    syllabuses: Syllabus[];
    dailyClasses: DailyClassRecord[];
    todayActivity: any;
    classes: any[];
    subjects: any[];
    teachers: any[];
    routines: any[];
    holidays: any[];
    currentUser: any;
  };
}

export default function TeacherSyllabusClient({ initialData }: Props) {
  const [data, setData] = useState(initialData);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Selected syllabus for deep dive
  const [selectedSyllabusId, setSelectedSyllabusId] = useState<string>(
    data.syllabuses[0]?.id || ""
  );

  // Modals
  const [isDailyClassModalOpen, setIsDailyClassModalOpen] = useState(false);
  const [isRevisionHistoryOpen, setIsRevisionHistoryOpen] = useState(false);
  const [selectedRevisionTopic, setSelectedRevisionTopic] = useState<SyllabusTopic | null>(null);

  const [isAbsentFollowupOpen, setIsAbsentFollowupOpen] = useState(false);
  const [selectedAbsentTopic, setSelectedAbsentTopic] = useState<SyllabusTopic | null>(null);

  const [isPrintOpen, setIsPrintOpen] = useState(false);

  const refreshData = async () => {
    setIsRefreshing(true);
    try {
      const res = await getSyllabusDashboardData(data.currentUser?.id);
      if (res.success && res.data) {
        setData(res.data as any);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsRefreshing(false);
    }
  };

  const currentMetrics =
    data.allMetrics.find((m) => m.syllabus_id === selectedSyllabusId) || data.allMetrics[0];
  const currentSyllabus =
    data.syllabuses.find((s) => s.id === currentMetrics?.syllabus_id) || data.syllabuses[0];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900">
                আমার কিতাব ও সিলেবাস ট্র্যাকার
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                দরস অগ্রগতি, রিভিশন বকেয়া ও কর্মদিবস ভিত্তিক গতি বিশ্লেষণ
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={refreshData}
            disabled={isRefreshing}
            className="p-2 text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors disabled:opacity-50"
            title="রিফ্রেশ করুন"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={() => setIsDailyClassModalOpen(true)}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 shadow-xs transition-colors"
          >
            <Sparkles className="w-4 h-4 text-emerald-200" />
            <span>+ আজকের পাঠ / ক্লাস রেকর্ড করুন</span>
          </button>
        </div>
      </div>

      {/* Kitab Selector Bar if multiple */}
      {data.syllabuses.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-xs text-slate-500 font-semibold whitespace-nowrap pl-1">
            আপনার কিতাবসমূহ:
          </span>
          {data.syllabuses.map((s) => {
            const isSel = s.id === (currentSyllabus?.id || selectedSyllabusId);
            return (
              <button
                key={s.id}
                onClick={() => setSelectedSyllabusId(s.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  isSel
                    ? "bg-emerald-700 text-white shadow-xs"
                    : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span>{s.subject_name}</span>
                <span className={`text-[10px] ${isSel ? "text-emerald-200" : "text-slate-400"}`}>
                  ({s.class_name})
                </span>
              </button>
            );
          })}
        </div>
      )}

      {currentMetrics && currentSyllabus && (
        <>
          {/* ======================================================== */}
          {/* PROMINENT "আপনার হাতে বাকি" (HAND-REMAINING CARD)         */}
          {/* ======================================================== */}
          <div className="bg-gradient-to-br from-emerald-900 via-slate-900 to-slate-950 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden">
            {/* Ambient pattern */}
            <div className="absolute right-0 top-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 space-y-6">
              {/* Header inside card */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-white/10 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-xs font-bold">
                      {currentSyllabus.class_name}
                    </span>
                    <span className="text-xs text-slate-300">
                      সেশন: {currentSyllabus.academic_year || "১৪৪৭-৪৮ হিজরি"}
                    </span>
                  </div>
                  <h2 className="text-2xl font-black text-white mt-1">
                    {currentSyllabus.subject_name}
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold ${
                      currentMetrics.status === "COMPLETED"
                        ? "bg-emerald-500 text-white"
                        : currentMetrics.status === "ON_TRACK"
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                        : currentMetrics.status === "AT_RISK"
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                        : "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                    }`}
                  >
                    {currentMetrics.status_label}
                  </span>

                  <button
                    onClick={() => setIsPrintOpen(true)}
                    className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-xs transition-colors"
                    title="রিপোর্ট প্রিন্ট"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* 4 Core Intelligence Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* 1. Remaining Working Days */}
                <div className="bg-white/5 backdrop-blur-xs border border-white/10 rounded-xl p-4">
                  <div className="flex items-center gap-1.5 text-xs text-emerald-300 font-semibold mb-1">
                    <CalendarDays className="w-4 h-4" />
                    <span>হাতে বাকি কর্মদিবস</span>
                  </div>
                  <div className="text-3xl font-black text-white">
                    {currentMetrics.remaining_working_days}{" "}
                    <span className="text-sm font-normal text-slate-400">দিন</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    শুক্রবার ও নির্ধারিত ছুটি বাদে
                  </div>
                </div>

                {/* 2. Remaining Topics */}
                <div className="bg-white/5 backdrop-blur-xs border border-white/10 rounded-xl p-4">
                  <div className="flex items-center gap-1.5 text-xs text-emerald-300 font-semibold mb-1">
                    <Target className="w-4 h-4" />
                    <span>বাকি পড়া (Topics)</span>
                  </div>
                  <div className="text-3xl font-black text-white">
                    {currentMetrics.remaining_topics}{" "}
                    <span className="text-sm font-normal text-slate-400">টপিক</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    মোট: {currentMetrics.total_topics} | সম্পন্ন: {currentMetrics.completed_topics}
                  </div>
                </div>

                {/* 3. Pace Comparison */}
                <div className="bg-white/5 backdrop-blur-xs border border-white/10 rounded-xl p-4">
                  <div className="flex items-center gap-1.5 text-xs text-emerald-300 font-semibold mb-1">
                    <TrendingUp className="w-4 h-4" />
                    <span>প্রয়োজনীয় দৈনিক গতি</span>
                  </div>
                  <div className="text-3xl font-black text-amber-300">
                    {currentMetrics.required_pace_per_day}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    বর্তমান গতি: {currentMetrics.current_pace_per_day} টপিক/দিন
                  </div>
                </div>

                {/* 4. Forecast Date */}
                <div className="bg-white/5 backdrop-blur-xs border border-white/10 rounded-xl p-4">
                  <div className="flex items-center gap-1.5 text-xs text-emerald-300 font-semibold mb-1">
                    <Clock className="w-4 h-4" />
                    <span>সম্ভাব্য সমাপ্তি তারিখ</span>
                  </div>
                  <div className="text-xl font-bold font-mono text-white mt-1">
                    {currentMetrics.forecast_completion_date}
                  </div>
                  <div className="text-[11px] text-emerald-300 mt-1">
                    {currentMetrics.forecast_label}
                  </div>
                </div>
              </div>

              {/* Targets Strip */}
              <div className="bg-emerald-950/40 border border-emerald-500/20 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="flex items-start gap-2">
                  <span className="text-emerald-400 font-bold">• আজকের লক্ষ্য:</span>
                  <span className="text-slate-200">{currentMetrics.today_target_label}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-emerald-400 font-bold">• সাপ্তাহিক লক্ষ্য:</span>
                  <span className="text-slate-200">{currentMetrics.weekly_target_label}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Chapters & Topics Tree */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-emerald-700" />
                <h3 className="text-base font-bold text-slate-900">
                  অধ্যায় ও পাঠ্যসূচি তালিকা ({currentSyllabus.chapters.length}টি অধ্যায়)
                </h3>
              </div>
              <button
                onClick={() => setIsDailyClassModalOpen(true)}
                className="px-3.5 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 rounded-lg text-xs font-bold flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>পড়া এন্ট্রি করুন</span>
              </button>
            </div>

            <div className="space-y-4">
              {currentSyllabus.chapters.map((ch, chIdx) => (
                <div
                  key={ch.id || chIdx}
                  className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs"
                >
                  <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 font-bold text-xs sm:text-sm text-slate-800 flex items-center justify-between">
                    <span>
                      অধ্যায় {chIdx + 1}: {ch.name}
                    </span>
                    <span className="text-xs text-slate-500 font-normal">
                      {ch.topics.length}টি টপিক
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {ch.topics.map((t, tIdx) => {
                      const isCompleted = t.status === "COMPLETED";
                      const absentCount = (t.absent_followup || []).filter(
                        (f) => !f.is_makeup_done
                      ).length;

                      return (
                        <div
                          key={t.id || tIdx}
                          className="p-3.5 hover:bg-slate-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 transition-colors"
                        >
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-slate-400">
                                {chIdx + 1}.{tIdx + 1}
                              </span>
                              <span className="text-xs sm:text-sm font-bold text-slate-900">
                                {t.name}
                              </span>
                              {isCompleted && (
                                <span className="px-2 py-0.2 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold">
                                  সম্পন্ন ({t.initial_completed_date})
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 pl-6">
                              <span>অগ্রগতি: {t.progress_percentage || 0}%</span>
                              <span>•</span>
                              <span>রিভিশন হয়েছে: {t.revision_count || 0} বার</span>
                              {t.last_revised_date && (
                                <>
                                  <span>•</span>
                                  <span>সর্বশেষ: {t.last_revised_date}</span>
                                </>
                              )}
                              {absentCount > 0 && (
                                <>
                                  <span>•</span>
                                  <span className="text-rose-600 font-bold">
                                    {absentCount} জন অনুপস্থিত ছাত্রের মেকআপ বাকি
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 pl-6 sm:pl-0">
                            {t.revision_count > 0 && (
                              <button
                                onClick={() => {
                                  setSelectedRevisionTopic(t);
                                  setIsRevisionHistoryOpen(true);
                                }}
                                className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                              >
                                রিভিশন লগ
                              </button>
                            )}

                            {absentCount > 0 && (
                              <button
                                onClick={() => {
                                  setSelectedAbsentTopic(t);
                                  setIsAbsentFollowupOpen(true);
                                }}
                                className="px-2.5 py-1 text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 rounded-md transition-colors"
                              >
                                মেকআপ ছাত্র ({absentCount})
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* MODALS */}
      <DailyClassEntryModal
        isOpen={isDailyClassModalOpen}
        onClose={() => setIsDailyClassModalOpen(false)}
        syllabuses={data.syllabuses}
        classes={data.classes}
        subjects={data.subjects}
        teachers={data.teachers}
        initialClassId={currentSyllabus?.class_id}
        initialSubjectId={currentSyllabus?.subject_id}
        initialTeacherId={data.currentUser?.id}
        onSuccess={refreshData}
      />

      <TopicRevisionHistoryModal
        isOpen={isRevisionHistoryOpen}
        onClose={() => {
          setIsRevisionHistoryOpen(false);
          setSelectedRevisionTopic(null);
        }}
        topic={selectedRevisionTopic}
        subjectName={currentSyllabus?.subject_name}
        classNameStr={currentSyllabus?.class_name}
      />

      <StudentAbsentFollowupModal
        isOpen={isAbsentFollowupOpen}
        onClose={() => {
          setIsAbsentFollowupOpen(false);
          setSelectedAbsentTopic(null);
        }}
        syllabusId={currentSyllabus?.id || ""}
        topic={selectedAbsentTopic}
        subjectName={currentSyllabus?.subject_name}
        onSuccess={refreshData}
      />

      <SyllabusPrintReport
        isOpen={isPrintOpen}
        onClose={() => setIsPrintOpen(false)}
        metrics={currentMetrics}
        syllabus={currentSyllabus}
      />
    </div>
  );
}
