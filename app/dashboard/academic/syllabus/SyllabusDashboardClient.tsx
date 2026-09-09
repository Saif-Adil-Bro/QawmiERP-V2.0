"use client";

import { useState } from "react";
import {
  BookOpen,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  TrendingUp,
  RotateCcw,
  Users,
  Search,
  Filter,
  Plus,
  Edit,
  Trash2,
  Eye,
  Printer,
  ChevronDown,
  Sparkles,
  Layers,
  FileText,
  User,
  ArrowRight,
  RefreshCw,
  Ban,
  CalendarDays,
  Target,
  Book,
  Calculator,
} from "lucide-react";
import {
  Syllabus,
  DailyClassRecord,
  SyllabusIntelligenceMetrics,
  SyllabusTopic,
  ClassType,
  AcademicWorkingDayCalculator,
} from "@/lib/syllabus";
import SyllabusFormModal from "@/components/syllabus/SyllabusFormModal";
import DailyClassEntryModal from "@/components/syllabus/DailyClassEntryModal";
import TopicRevisionHistoryModal from "@/components/syllabus/TopicRevisionHistoryModal";
import StudentAbsentFollowupModal from "@/components/syllabus/StudentAbsentFollowupModal";
import SyllabusPrintReport from "@/components/syllabus/SyllabusPrintReport";
import {
  deleteSyllabusAction,
  deleteDailyClassRecordAction,
  getSyllabusDashboardData,
} from "@/app/actions/syllabus";

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
    allSyllabuses: Syllabus[];
    dailyClasses: DailyClassRecord[];
    todayActivity: any;
    classes: any[];
    subjects: any[];
    teachers: any[];
    routines: any[];
    holidays: any[];
    currentUser: any;
    madrasaName?: string;
    madrasa?: any;
  };
}

export default function SyllabusDashboardClient({ initialData }: Props) {
  const [data, setData] = useState(initialData);
  const [activeTab, setActiveTab] = useState<
    "syllabuses" | "today" | "analytics" | "revisions" | "teachers" | "absents" | "reports"
  >("syllabuses");

  // Filters
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSyllabus, setEditingSyllabus] = useState<Syllabus | null>(null);

  const [isDailyClassModalOpen, setIsDailyClassModalOpen] = useState(false);
  const [dailyClassClassId, setDailyClassClassId] = useState<string | undefined>(undefined);
  const [dailyClassSubjectId, setDailyClassSubjectId] = useState<string | undefined>(undefined);
  const [dailyClassTeacherId, setDailyClassTeacherId] = useState<string | undefined>(undefined);
  const [editingDailyRecord, setEditingDailyRecord] = useState<DailyClassRecord | null>(null);

  const [isRevisionHistoryOpen, setIsRevisionHistoryOpen] = useState(false);
  const [selectedRevisionTopic, setSelectedRevisionTopic] = useState<SyllabusTopic | null>(null);
  const [selectedRevisionSubName, setSelectedRevisionSubName] = useState<string>("");
  const [selectedRevisionClassName, setSelectedRevisionClassName] = useState<string>("");

  const [isAbsentFollowupOpen, setIsAbsentFollowupOpen] = useState(false);
  const [selectedAbsentTopic, setSelectedAbsentTopic] = useState<SyllabusTopic | null>(null);
  const [selectedAbsentSyllabusId, setSelectedAbsentSyllabusId] = useState<string>("");

  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const [selectedPrintMetrics, setSelectedPrintMetrics] = useState<SyllabusIntelligenceMetrics | null>(null);
  const [selectedPrintSyllabus, setSelectedPrintSyllabus] = useState<Syllabus | null>(null);

  const [isRefreshing, setIsRefreshing] = useState(false);

  // Interactive Book Syllabus Planner State
  const [calcBookName, setCalcBookName] = useState("নূরুল ঈযাহ (ফিকহ)");
  const [calcStartDate, setCalcStartDate] = useState("2026-04-15");
  const [calcEndDate, setCalcEndDate] = useState("2027-04-05");
  const [calcTotalPages, setCalcTotalPages] = useState<number | string>(320);
  const [calcStartPage, setCalcStartPage] = useState<number | string>(1);
  const [calcEndPage, setCalcEndPage] = useState<number | string>(320);

  const liveCalculatorResult = AcademicWorkingDayCalculator.calculateSmartSyllabusPlan({
    start_date: calcStartDate,
    end_date: calcEndDate,
    total_pages: Number(calcTotalPages) || 0,
    start_page: Number(calcStartPage) || 1,
    end_page: Number(calcEndPage) || Number(calcTotalPages) || 0,
    total_topics: 0,
  });

  const handleLaunchSyllabusWithPlan = () => {
    setEditingSyllabus({
      id: "",
      madrasa_id: "",
      class_id: data.classes[0]?.id || "",
      class_name: data.classes[0]?.name || "",
      subject_id: data.subjects[0]?.id || "",
      subject_name: calcBookName,
      book_name: calcBookName,
      total_pages: Number(calcTotalPages) || 0,
      start_page: Number(calcStartPage) || 1,
      end_page: Number(calcEndPage) || Number(calcTotalPages) || 0,
      current_page: Number(calcStartPage) || 1,
      planned_daily_pages: liveCalculatorResult.dailyPages,
      start_date: calcStartDate,
      end_date: calcEndDate,
      academic_year: "১৪৪৭-৪৮ হিজরি (২০২৬-২৭)",
      revision_interval_days: 7,
      status: "ACTIVE",
      chapters: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    setIsFormOpen(true);
  };

  // Refresh data
  const refreshData = async () => {
    setIsRefreshing(true);
    try {
      const res = await getSyllabusDashboardData();
      if (res.success && res.data) {
        setData(res.data as any);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Filtered Syllabuses & Metrics
  const filteredMetrics = data.allMetrics.filter((m) => {
    const syl = data.syllabuses.find((s) => s.id === m.syllabus_id);
    if (!syl) return false;

    if (selectedClassId && syl.class_id !== selectedClassId) return false;
    if (selectedSubjectId && syl.subject_id !== selectedSubjectId) return false;
    if (statusFilter && m.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchSub = (syl.subject_name || "").toLowerCase().includes(q);
      const matchCls = (syl.class_name || "").toLowerCase().includes(q);
      const matchTchr = (syl.teacher_name || "").toLowerCase().includes(q);
      if (!matchSub && !matchCls && !matchTchr) return false;
    }
    return true;
  });

  const handleDeleteSyllabus = async (id: string) => {
    if (!confirm("আপনি কি নিশ্চিত এই সিলেবাসটি মুছে ফেলতে চান?")) return;
    const res = await deleteSyllabusAction(id);
    if (res.success) {
      refreshData();
    } else {
      alert(res.error || "মুছে ফেলা ব্যর্থ হয়েছে");
    }
  };

  const handleDeleteDailyRecord = async (id: string) => {
    if (!confirm("আপনি কি নিশ্চিত এই ক্লাস রেকর্ডটি মুছে ফেলতে চান?")) return;
    const res = await deleteDailyClassRecordAction(id);
    if (res.success) {
      refreshData();
    } else {
      alert(res.error || "মুছে ফেলা ব্যর্থ হয়েছে");
    }
  };

  const openNewDailyClass = (clsId?: string, subId?: string, tchrId?: string) => {
    setEditingDailyRecord(null);
    setDailyClassClassId(clsId);
    setDailyClassSubjectId(subId);
    setDailyClassTeacherId(tchrId);
    setIsDailyClassModalOpen(true);
  };

  const openEditSyllabus = (s: Syllabus) => {
    setEditingSyllabus(s);
    setIsFormOpen(true);
  };

  const openPrint = (m: SyllabusIntelligenceMetrics) => {
    const s = data.syllabuses.find((syl) => syl.id === m.syllabus_id);
    if (!s) return;
    setSelectedPrintMetrics(m);
    setSelectedPrintSyllabus(s);
    setIsPrintOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Title Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900">
                সিলেবাস ও একাডেমিক অগ্রগতি গোয়েন্দা ট্র্যাকার
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                কওমি মাদরাসা সিলেবাস, দৈনিক দরস, রিভিশন ইন্টারভাল ও কর্মদিবস ভিত্তিক পূর্বাভাস ইঞ্জিন
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          <button
            onClick={refreshData}
            disabled={isRefreshing}
            className="p-2 text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors disabled:opacity-50"
            title="রিফ্রেশ করুন"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={() => openNewDailyClass()}
            className="px-4 py-2 bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-colors shadow-xs"
          >
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span>আজকের ক্লাস রেকর্ড করুন</span>
          </button>

          <button
            onClick={() => {
              setEditingSyllabus(null);
              setIsFormOpen(true);
            }}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>+ নতুন সিলেবাস তৈরি করুন</span>
          </button>
        </div>
      </div>

      {/* KPI Highlight Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Overall Progress */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold mb-1">
            <span>সামগ্রিক সিলেবাস অগ্রগতি</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">{data.overallProgress}%</span>
            <span className="text-xs text-slate-400 font-medium">সম্পন্ন</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2.5 overflow-hidden">
            <div
              className="bg-emerald-600 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${data.overallProgress}%` }}
            />
          </div>
        </div>

        {/* Remaining Working Days */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold mb-1">
            <span>হাতে বাকি কর্মদিবস</span>
            <CalendarDays className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-indigo-700">{data.remainingWorkingDays}</span>
            <span className="text-xs text-slate-400 font-medium">দিন (শুক্রবার ও ছুটি বাদে)</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            মোট টপিক: {data.totalTopics} | বাকি: {data.remainingTopics}
          </p>
        </div>

        {/* On Track */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold mb-1">
            <span>সময়মতো চলছে</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-700">{data.onTrackCount}</span>
            <span className="text-xs text-slate-400 font-medium">টি কিতাব</span>
          </div>
          <p className="text-[11px] text-emerald-600 font-semibold mt-2">
            সম্পূর্ণ সম্পন্ন: {data.completedCount}টি বিষয়
          </p>
        </div>

        {/* At Risk & Behind */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold mb-1">
            <span>ঝুঁকিতে / গতি বৃদ্ধি প্রয়োজন</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-600">
              {data.atRiskCount + data.behindCount}
            </span>
            <span className="text-xs text-slate-400 font-medium">টি কিতাব</span>
          </div>
          <p className="text-[11px] text-amber-700 font-semibold mt-2">
            পিছিয়ে আছে: {data.behindCount} | ঝুঁকিতে: {data.atRiskCount}
          </p>
        </div>

        {/* Today's Activity Pulse */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-xs text-slate-500 font-semibold mb-1">
            <span>আজকের ক্লাস ডায়েরি</span>
            <Clock className="w-4 h-4 text-purple-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-purple-700">
              {data.todayActivity.totalRecorded} / {data.todayActivity.totalScheduled}
            </span>
            <span className="text-xs text-slate-400 font-medium">রেকর্ড</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            নতুন পড়া: {data.todayActivity.newLessons} | রিভিশন: {data.todayActivity.revisions}
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-slate-200 bg-white rounded-xl px-2 shadow-xs">
        <div className="flex items-center gap-1 overflow-x-auto py-1 scrollbar-none">
          {[
            { id: "syllabuses", label: "সিলেবাস ও প্রগ্রেস তালিকা", count: data.syllabuses.length },
            {
              id: "today",
              label: "আজকের দরস ডায়েরি",
              alert: data.todayActivity.unrecorded?.length > 0,
            },
            { id: "analytics", label: "কর্মদিবস ও গতি অ্যানালিটিক্স" },
            { id: "revisions", label: "রিভিশন ট্র্যাকার ও বকেয়া" },
            { id: "teachers", label: "শিক্ষকভিত্তিক বিশ্লেষণ" },
            { id: "absents", label: "অনুপস্থিত শিক্ষার্থী মেকআপ" },
            { id: "reports", label: "প্রতিবেদন ও প্রিন্ট" },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3.5 py-2.5 text-xs sm:text-sm font-bold whitespace-nowrap rounded-lg transition-all flex items-center gap-2 ${
                  isActive
                    ? "bg-emerald-50 text-emerald-800 border-b-2 border-emerald-600 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      isActive ? "bg-emerald-200 text-emerald-900" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
                {tab.alert && (
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: SYLLABUSES LIST & DETAILED CRUD                   */}
      {/* ======================================================== */}
      {activeTab === "syllabuses" && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="কিতাব, বিষয় বা শিক্ষকের নাম দিয়ে খুঁজুন..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none"
              >
                <option value="">সকল জামাত</option>
                {data.classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                className="text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none"
              >
                <option value="">সকল কিতাব/বিষয়</option>
                {data.subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none"
              >
                <option value="">সকল অবস্থা (Status)</option>
                <option value="ON_TRACK">সময়মতো (On Track)</option>
                <option value="AT_RISK">ঝুঁকিপূর্ণ (At Risk)</option>
                <option value="BEHIND">পিছিয়ে আছে (Behind)</option>
                <option value="COMPLETED">সম্পন্ন (Completed)</option>
              </select>
            </div>

            <div className="text-xs text-slate-500 font-medium">
              মোট: <span className="font-bold text-slate-900">{filteredMetrics.length}টি</span> সিলেবাস পাওয়া গেছে
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMetrics.map((m) => {
              const syl = data.syllabuses.find((s) => s.id === m.syllabus_id);
              if (!syl) return null;

              return (
                <div
                  key={m.syllabus_id}
                  className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    {/* Header: Subject & Class & Book */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md">
                            {syl.class_name}
                          </span>
                          {(syl.book_name || m.book_name) && (syl.book_name || m.book_name) !== syl.subject_name && (
                            <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded-md">
                              📖 {syl.book_name || m.book_name}
                            </span>
                          )}
                        </div>
                        <h3 className="text-base font-bold text-slate-900 mt-1">
                          {syl.subject_name}
                        </h3>
                        {syl.teacher_name && (
                          <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                            <User className="w-3.5 h-3.5" />
                            <span>{syl.teacher_name}</span>
                          </div>
                        )}
                      </div>

                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold shrink-0 ${
                          m.status === "COMPLETED"
                            ? "bg-emerald-100 text-emerald-800"
                            : m.status === "ON_TRACK"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : m.status === "AT_RISK"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {m.status_label}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 font-medium">সিলেবাস অগ্রগতি:</span>
                        <span className="font-bold text-slate-900">{m.actual_progress_percentage}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            m.status === "COMPLETED"
                              ? "bg-emerald-500"
                              : m.status === "BEHIND"
                              ? "bg-rose-500"
                              : m.status === "AT_RISK"
                              ? "bg-amber-500"
                              : "bg-emerald-600"
                          }`}
                          style={{ width: `${m.actual_progress_percentage}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>সম্পন্ন: {m.completed_topics}/{m.total_topics} টপিক</span>
                        {m.total_pages ? (
                          <span className="font-mono text-emerald-700 font-semibold">
                            পৃষ্ঠা: {m.completed_pages || syl.current_page || 0}/{m.total_pages}
                          </span>
                        ) : (
                          <span>বাকি: {m.remaining_topics}টি</span>
                        )}
                      </div>
                    </div>

                    {/* Intelligence Metrics Strip */}
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-2 text-xs">
                      {m.target_pages_label && (
                        <div className="flex items-center justify-between text-emerald-800 font-semibold bg-emerald-50/70 px-2 py-1 rounded">
                          <span>দৈনিক পড়ার লক্ষ্য:</span>
                          <span className="font-bold font-mono">
                            {m.target_pages_label}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-slate-700">
                        <span>হাতে বাকি কর্মদিবস:</span>
                        <span className="font-bold text-indigo-700 font-mono">
                          {m.remaining_working_days} দিন
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-700">
                        <span>প্রয়োজনীয় গতি:</span>
                        <span className="font-bold text-slate-900 font-mono">
                          {m.required_pages_per_day ? `${m.required_pages_per_day} পৃষ্ঠা/দিন` : `${m.required_pace_per_day} টপিক/দিন`}
                        </span>
                      </div>
                      {m.fridays_count !== undefined && (
                        <div className="flex items-center justify-between text-slate-700">
                          <span>ছুটি সমন্বয়:</span>
                          <span className="font-mono text-slate-600 text-[11px]">
                            {m.fridays_count}টি শুক্র + {m.holidays_count}টি ছুটি বাদ
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-slate-700">
                        <span>রিভিশন সম্পন্ন:</span>
                        <span className="font-bold text-purple-700 font-mono">
                          {m.total_revisions_done} বার
                        </span>
                      </div>
                      {m.revision_due_count > 0 && (
                        <div className="text-[11px] text-amber-700 font-semibold bg-amber-50 p-1.5 rounded-md flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>{m.revision_due_count}টি টপিকের রিভিশন বকেয়া!</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() => openNewDailyClass(syl.class_id, syl.subject_id, syl.teacher_id)}
                      className="px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-1.5 transition-colors shadow-2xs"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>পড়া এন্ট্রি</span>
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openPrint(m)}
                        title="প্রিন্ট রিপোর্ট"
                        className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openEditSyllabus(syl)}
                        title="সম্পাদনা করুন"
                        className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteSyllabus(syl.id)}
                        title="মুছে ফেলুন"
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredMetrics.length === 0 && (
            <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-200">
              <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 text-sm font-semibold">কোনো সিলেবাস পাওয়া যায়নি।</p>
              <button
                onClick={() => {
                  setEditingSyllabus(null);
                  setIsFormOpen(true);
                }}
                className="mt-3 px-4 py-2 text-xs font-bold bg-emerald-600 text-white rounded-lg"
              >
                + নতুন সিলেবাস তৈরি করুন
              </button>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: TODAY'S ACADEMIC DIARY                            */}
      {/* ======================================================== */}
      {activeTab === "today" && (
        <div className="space-y-6">
          {/* Missed Log Warning Alert */}
          {data.todayActivity.unrecorded?.length > 0 && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 shadow-xs">
              <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <span>
                  আজকের রুটিন অনুযায়ী {data.todayActivity.unrecorded.length}টি ক্লাসের পাঠদান এখনও রেকর্ড করা হয়নি!
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-3">
                {data.todayActivity.unrecorded.map((r: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-2.5 bg-white border border-amber-200 rounded-lg flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-900">{r.classes?.name}</span>
                      <span className="text-slate-500 block">
                        {r.subjects?.name || "কিতাব"} • {r.teachers?.first_name || "উস্তাদ"}
                      </span>
                    </div>
                    <button
                      onClick={() =>
                        openNewDailyClass(r.class_id, r.subject_id, r.teacher_id)
                      }
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md font-bold text-[11px]"
                    >
                      লগ করুন
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Today's Stats Ribbon */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
              <div className="text-xs text-slate-500 font-semibold">আজকের শিডিউল</div>
              <div className="text-2xl font-black text-slate-900 mt-1">
                {data.todayActivity.totalScheduled}টি ক্লাস
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
              <div className="text-xs text-slate-500 font-semibold">নতুন পড়া পড়ানো হয়েছে</div>
              <div className="text-2xl font-black text-emerald-700 mt-1">
                {data.todayActivity.newLessons}টি ক্লাসে
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
              <div className="text-xs text-slate-500 font-semibold">রিভিশন সম্পন্ন</div>
              <div className="text-2xl font-black text-amber-700 mt-1">
                {data.todayActivity.revisions}টি ক্লাসে
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 text-center">
              <div className="text-xs text-slate-500 font-semibold">বাতিল / অনুষ্ঠান</div>
              <div className="text-2xl font-black text-rose-700 mt-1">
                {data.todayActivity.cancelled}টি ক্লাসে
              </div>
            </div>
          </div>

          {/* Daily Records History Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                <Clock className="w-4 h-4 text-emerald-600" />
                <span>সাম্প্রতিক দরস ও ক্লাস রেকর্ড লগ ({data.dailyClasses.length}টি এন্ট্রি)</span>
              </div>
              <button
                onClick={() => openNewDailyClass()}
                className="px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ এন্ট্রি করুন</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <th className="p-3">তারিখ</th>
                    <th className="p-3">জামাত ও বিষয়</th>
                    <th className="p-3">ক্লাসের ধরন</th>
                    <th className="p-3">আজকের পড়া / রিভিশন</th>
                    <th className="p-3">হাজিরা সামারি</th>
                    <th className="p-3">উস্তাদ</th>
                    <th className="p-3 text-right">অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.dailyClasses.slice(0, 50).map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-50/60">
                      <td className="p-3 font-mono text-slate-700 whitespace-nowrap">{rec.date}</td>
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{rec.subject_name}</div>
                        <div className="text-[11px] text-slate-500">{rec.class_name}</div>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            rec.class_type === "NEW_LESSON"
                              ? "bg-emerald-100 text-emerald-800"
                              : rec.class_type === "REVISION"
                              ? "bg-amber-100 text-amber-800"
                              : rec.class_type === "NEW_AND_REVISION"
                              ? "bg-blue-100 text-blue-800"
                              : rec.class_type === "NO_ACADEMIC_CLASS"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-purple-100 text-purple-800"
                          }`}
                        >
                          {rec.class_type === "NEW_LESSON"
                            ? "নতুন পাঠ"
                            : rec.class_type === "REVISION"
                            ? "রিভিশন"
                            : rec.class_type === "NEW_AND_REVISION"
                            ? "নতুন + রিভিশন"
                            : rec.class_type === "NO_ACADEMIC_CLASS"
                            ? "ক্লাস হয়নি"
                            : "অনুশীলন"}
                        </span>
                      </td>
                      <td className="p-3 max-w-xs">
                        {rec.class_type === "NO_ACADEMIC_CLASS" ? (
                          <div className="text-rose-700 font-semibold">
                            কারণ: {rec.cancellation_reason || "বিশেষ অনুষ্ঠান"}
                            {rec.cancellation_notes && ` (${rec.cancellation_notes})`}
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            {rec.new_topic_names && rec.new_topic_names.length > 0 && (
                              <div className="text-slate-800 font-medium">
                                <span className="text-emerald-700 font-bold">নতুন:</span>{" "}
                                {rec.new_topic_names.join(", ")}
                              </div>
                            )}
                            {rec.revision_topic_names && rec.revision_topic_names.length > 0 && (
                              <div className="text-slate-600">
                                <span className="text-amber-700 font-bold">রিভিশন:</span>{" "}
                                {rec.revision_topic_names.join(", ")}
                              </div>
                            )}
                            {rec.page_from && (
                              <div className="text-[11px] text-slate-400">
                                পৃষ্ঠা: {rec.page_from} {rec.page_to ? `হতে ${rec.page_to}` : ""}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {rec.student_attendance_summary ? (
                          <div className="text-[11px]">
                            <span className="text-emerald-700 font-semibold">
                              উপস্থিত: {rec.student_attendance_summary.present}
                            </span>{" "}
                            •{" "}
                            <span className="text-rose-600 font-semibold">
                              অনুপস্থিত: {rec.student_attendance_summary.absent}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="p-3 text-slate-600 whitespace-nowrap">
                        {rec.teacher_name || "—"}
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => handleDeleteDailyRecord(rec.id)}
                          className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                          title="রেকর্ড মুছুন"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: WORKING DAYS & PACE ANALYTICS                     */}
      {/* ======================================================== */}
      {activeTab === "analytics" && (
        <div className="space-y-6">
          {/* Interactive Smart Syllabus Book Calculator */}
          <div className="bg-gradient-to-br from-emerald-50/90 to-teal-50/50 border border-emerald-200/90 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-xs">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    কিতাব ও পৃষ্ঠা ভিত্তিক স্মার্ট সিলেবাস ক্যালকুলেটর (Smart Syllabus & Page Calculator)
                  </h3>
                  <p className="text-xs text-slate-600">
                    কিতাবের মোট পৃষ্ঠা, শুরু-শেষ পৃষ্ঠা এবং সময়কাল দিলে জুমাবার ও ছুটি স্বয়ংক্রিয় বাদ দিয়ে দৈনিক ও সাপ্তাহিক টার্গেট হিসাব
                  </p>
                </div>
              </div>

              <button
                onClick={handleLaunchSyllabusWithPlan}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>এই হিসাব দিয়ে নতুন সিলেবাস তৈরি করুন</span>
              </button>
            </div>

            {/* Inputs Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 bg-white p-4 rounded-xl border border-emerald-100 shadow-2xs">
              <div className="col-span-2 sm:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">কিতাবের নাম / বিষয়</label>
                <input
                  type="text"
                  value={calcBookName}
                  onChange={(e) => setCalcBookName(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">মোট পৃষ্ঠা সংখ্যা</label>
                <input
                  type="number"
                  min={1}
                  value={calcTotalPages}
                  onChange={(e) => {
                    setCalcTotalPages(e.target.value);
                    if (!calcEndPage || Number(calcEndPage) < Number(e.target.value)) setCalcEndPage(e.target.value);
                  }}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">শুরুর পৃষ্ঠা</label>
                <input
                  type="number"
                  min={1}
                  value={calcStartPage}
                  onChange={(e) => setCalcStartPage(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">শেষ পৃষ্ঠা</label>
                <input
                  type="number"
                  min={1}
                  value={calcEndPage}
                  onChange={(e) => setCalcEndPage(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">সিলেবাসের সময়কাল</label>
                <div className="flex items-center gap-1">
                  <input
                    type="date"
                    value={calcStartDate}
                    onChange={(e) => setCalcStartDate(e.target.value)}
                    className="w-full text-[10px] px-1 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono"
                  />
                  <span className="text-slate-400 text-xs">হতে</span>
                  <input
                    type="date"
                    value={calcEndDate}
                    onChange={(e) => setCalcEndDate(e.target.value)}
                    className="w-full text-[10px] px-1 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Live Calculation Results */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[11px] text-slate-500 block">ক্যালেন্ডার দিন:</span>
                <span className="font-bold text-slate-900 text-sm font-mono">
                  {liveCalculatorResult.workingDays.total_calendar_days} দিন
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">মোট নির্বাচিত সময়</span>
              </div>

              <div className="bg-white p-3 rounded-xl border border-amber-200 shadow-2xs">
                <span className="text-[11px] text-amber-800 block">সাপ্তাহিক ও বার্ষিক ছুটি:</span>
                <span className="font-bold text-amber-900 text-sm font-mono">
                  {liveCalculatorResult.workingDays.fridays_count + liveCalculatorResult.workingDays.holidays_count} দিন বাদ
                </span>
                <span className="text-[10px] text-amber-700 block mt-0.5">
                  ({liveCalculatorResult.workingDays.fridays_count} জুমাবার + {liveCalculatorResult.workingDays.holidays_count} ছুটি)
                </span>
              </div>

              <div className="bg-white p-3 rounded-xl border border-indigo-200 shadow-2xs">
                <span className="text-[11px] text-indigo-800 block">প্রকৃত পাঠদান কর্মদিবস:</span>
                <span className="font-bold text-indigo-900 text-sm font-mono">
                  {liveCalculatorResult.netTeachingDays} দিন
                </span>
                <span className="text-[10px] text-indigo-700 block mt-0.5">ছুটিহীন কার্যদিবস</span>
              </div>

              <div className="bg-white p-3 rounded-xl border border-emerald-300 shadow-2xs">
                <span className="text-[11px] text-emerald-800 block">দৈনিক পড়ার টার্গেট:</span>
                <span className="font-bold text-emerald-950 text-sm font-mono">
                  {liveCalculatorResult.dailyPages} পৃষ্ঠা / দিন
                </span>
                <span className="text-[10px] text-emerald-700 block mt-0.5">প্রতি কর্মদিবসের লক্ষ্য</span>
              </div>

              <div className="bg-white p-3 rounded-xl border border-emerald-300 shadow-2xs">
                <span className="text-[11px] text-emerald-800 block">সাপ্তাহিক পড়ার টার্গেট:</span>
                <span className="font-bold text-emerald-950 text-sm font-mono">
                  {liveCalculatorResult.weeklyPages} পৃষ্ঠা / সপ্তাহ
                </span>
                <span className="text-[10px] text-emerald-700 block mt-0.5">(৬ কর্মদিবস/সপ্তাহ)</span>
              </div>
            </div>

            <div className="text-xs text-slate-700 bg-white/80 p-2.5 rounded-lg border border-emerald-100 flex items-center justify-between">
              <div>
                💡 <strong>সারসংক্ষেপ:</strong> {liveCalculatorResult.summaryBengali}
              </div>
              <button
                onClick={handleLaunchSyllabusWithPlan}
                className="text-emerald-700 font-bold hover:underline shrink-0 text-xs flex items-center gap-1"
              >
                <span>ফর্ম ওপেন করুন</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Existing Syllabuses Forecast Intelligence Table */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              কর্মদিবস ও গতি ভিত্তিক সমাপ্তি পূর্বাভাস (Forecast Intelligence)
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              শুক্রবার (সাপ্তাহিক ছুটি) ও একাডেমিক ছুটির দিনগুলোকে স্বয়ংক্রিয়ভাবে বাদ দিয়ে প্রকৃত শিক্ষণ দিবস ও পৃষ্ঠাভিত্তিক গতি গণনা
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                    <th className="p-3">জামাত, বিষয় ও কিতাব</th>
                    <th className="p-3">অগ্রগতি (টপিক ও পৃষ্ঠা)</th>
                    <th className="p-3">হাতে বাকি কর্মদিবস</th>
                    <th className="p-3">ছুটি সমন্বয়</th>
                    <th className="p-3">দৈনিক টার্গেট</th>
                    <th className="p-3">সম্ভাব্য সমাপ্তি</th>
                    <th className="p-3">অবস্থা ও ক্যাচ-আপ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.allMetrics.map((m) => {
                    const syl = data.syllabuses.find((s) => s.id === m.syllabus_id);
                    if (!syl) return null;

                    return (
                      <tr key={m.syllabus_id} className="hover:bg-slate-50/60">
                        <td className="p-3">
                          <div className="font-bold text-slate-900">{syl.subject_name}</div>
                          <div className="text-[11px] text-slate-500">
                            {syl.class_name} • {syl.teacher_name}
                            {(syl.book_name || m.book_name) && (
                              <span className="text-indigo-600 font-semibold block">
                                📖 {syl.book_name || m.book_name}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">{m.actual_progress_percentage}%</span>
                            <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-emerald-600 h-1.5 rounded-full"
                                style={{ width: `${m.actual_progress_percentage}%` }}
                              />
                            </div>
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {m.completed_topics}/{m.total_topics} টপিক
                            {m.total_pages ? ` • পৃষ্ঠা ${m.completed_pages || 0}/${m.total_pages}` : ""}
                          </div>
                        </td>
                        <td className="p-3 font-mono font-bold text-indigo-700 whitespace-nowrap">
                          {m.remaining_working_days} দিন
                        </td>
                        <td className="p-3 whitespace-nowrap text-slate-600 text-[11px]">
                          {m.fridays_count}টি শুক্র + {m.holidays_count}টি ছুটি বাদ
                        </td>
                        <td className="p-3 font-mono font-bold text-emerald-700 whitespace-nowrap">
                          {m.target_pages_label || `${m.required_pace_per_day} টপিক/দিন`}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <div className="font-mono text-slate-800">{m.forecast_completion_date}</div>
                          <div className="text-[10px] text-slate-500">{m.forecast_label}</div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${
                                m.status === "COMPLETED"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : m.status === "ON_TRACK"
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : m.status === "AT_RISK"
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-rose-100 text-rose-800"
                              }`}
                            >
                              {m.status_label}
                            </span>
                            <span className="text-[11px] text-slate-600">{m.catch_up_target_label}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 4: REVISION INTELLIGENCE & GAP ALERTS                */}
      {/* ======================================================== */}
      {activeTab === "revisions" && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  রিভিশন ট্র্যাকার ও পুনরাবৃত্তি গোয়েন্দা অ্যালার্ট
                </h3>
                <p className="text-xs text-slate-500">
                  কোনো টপিক দীর্ঘদিন রিভিশন না হলে স্বয়ংক্রিয় সতর্কবার্তা ও রিভিশন শিডিউল
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {data.syllabuses.map((syl) => {
                const completedTopics: SyllabusTopic[] = [];
                for (const ch of syl.chapters || []) {
                  for (const t of ch.topics || []) {
                    if (t.progress_percentage > 0 || t.status === "COMPLETED") {
                      completedTopics.push(t);
                    }
                  }
                }

                if (completedTopics.length === 0) return null;

                return (
                  <div
                    key={syl.id}
                    className="border border-slate-200 rounded-xl overflow-hidden p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md">
                          {syl.class_name}
                        </span>
                        <span className="font-bold text-slate-900 text-sm ml-2">
                          {syl.subject_name}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500 font-medium">
                        রিভিশন ইন্টারভাল: {syl.revision_interval_days || 7} দিন পর পর
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {completedTopics.map((top) => {
                        const todayStr = new Date().toISOString().split("T")[0];
                        const lastDate = top.last_revised_date || top.initial_completed_date;
                        let gap = 0;
                        if (lastDate) {
                          gap = Math.floor(
                            (new Date(todayStr).getTime() - new Date(lastDate).getTime()) /
                              (1000 * 60 * 60 * 24)
                          );
                        }
                        const isOverdue = gap > (syl.revision_interval_days || 7);

                        return (
                          <div
                            key={top.id}
                            className={`p-3 rounded-lg border flex flex-col justify-between transition-all ${
                              isOverdue
                                ? "bg-amber-50/70 border-amber-300"
                                : "bg-slate-50/60 border-slate-200"
                            }`}
                          >
                            <div>
                              <div className="flex items-start justify-between gap-1">
                                <span className="font-bold text-xs text-slate-900 leading-tight">
                                  {top.name}
                                </span>
                                {isOverdue && (
                                  <span className="px-1.5 py-0.2 bg-amber-200 text-amber-900 rounded text-[9px] font-bold shrink-0">
                                    বকেয়া!
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                                <span>রিভিশন: {top.revision_count || 0} বার</span>
                                <span>{gap > 0 ? `${gap} দিন পূর্বে` : "আজকের পাঠ"}</span>
                              </div>
                            </div>

                            <div className="mt-2.5 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                              <button
                                onClick={() => {
                                  setSelectedRevisionTopic(top);
                                  setSelectedRevisionSubName(syl.subject_name);
                                  setSelectedRevisionClassName(syl.class_name);
                                  setIsRevisionHistoryOpen(true);
                                }}
                                className="text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
                              >
                                <Eye className="w-3 h-3" />
                                <span>লগ দেখুন</span>
                              </button>

                              <button
                                onClick={() =>
                                  openNewDailyClass(syl.class_id, syl.subject_id, syl.teacher_id)
                                }
                                className="px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white rounded font-bold text-[10px] flex items-center gap-1"
                              >
                                <RotateCcw className="w-2.5 h-2.5" />
                                <span>রিভিশন এন্ট্রি</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 5: TEACHER PERFORMANCE & COMPARISON                  */}
      {/* ======================================================== */}
      {activeTab === "teachers" && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <h3 className="text-base font-bold text-slate-900">
            শিক্ষক ও উস্তাদ ভিত্তিক সিলেবাস বাস্তবায়ন তুলনামূলক বিশ্লেষণ
          </h3>
          <p className="text-xs text-slate-500">
            শিক্ষকদের আওতাধীন কিতাবসমূহের গতি, নিয়মিত ক্লাস রেকর্ড ও রিভিশন সক্ষমতা
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <th className="p-3">উস্তাদ / শিক্ষক</th>
                  <th className="p-3">আওতাধীন কিতাবসমূহ</th>
                  <th className="p-3">গড় অগ্রগতি</th>
                  <th className="p-3">সম্পন্ন টপিক</th>
                  <th className="p-3">রিভিশন সেশন</th>
                  <th className="p-3">ক্লাস ডায়েরি রেকর্ড</th>
                  <th className="p-3">সার্বিক স্ট্যাটাস</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.teachers.map((tchr) => {
                  const tchrSyllabuses = data.syllabuses.filter((s) => s.teacher_id === tchr.id);
                  const tchrMetrics = data.allMetrics.filter((m) =>
                    tchrSyllabuses.some((s) => s.id === m.syllabus_id)
                  );

                  let sumProgress = 0;
                  let sumCompleted = 0;
                  let sumTotal = 0;
                  let sumRevisions = 0;

                  tchrMetrics.forEach((m) => {
                    sumProgress += m.actual_progress_percentage;
                    sumCompleted += m.completed_topics;
                    sumTotal += m.total_topics;
                    sumRevisions += m.total_revisions_done;
                  });

                  const avgProgress =
                    tchrMetrics.length > 0 ? Math.round(sumProgress / tchrMetrics.length) : 0;
                  const teacherRecordsCount = data.dailyClasses.filter(
                    (d) => d.teacher_id === tchr.id
                  ).length;

                  return (
                    <tr key={tchr.id} className="hover:bg-slate-50/60">
                      <td className="p-3">
                        <div className="font-bold text-slate-900">
                          {tchr.first_name} {tchr.last_name}
                        </div>
                        <div className="text-[11px] text-slate-400">{tchr.phone || "ফোন নেই"}</div>
                      </td>
                      <td className="p-3">
                        {tchrSyllabuses.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {tchrSyllabuses.map((s) => (
                              <span
                                key={s.id}
                                className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px]"
                              >
                                {s.subject_name} ({s.class_name})
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400">কোনো কিতাব নির্ধারিত নেই</span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className="font-bold text-slate-900">{avgProgress}%</span>
                      </td>
                      <td className="p-3 font-mono text-slate-700">
                        {sumCompleted} / {sumTotal}
                      </td>
                      <td className="p-3 font-mono font-bold text-amber-700">
                        {sumRevisions} বার
                      </td>
                      <td className="p-3 font-mono text-slate-700">
                        {teacherRecordsCount}টি রেকর্ড
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            avgProgress >= 50
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {avgProgress >= 50 ? "সন্তোষজনক" : "নিয়মিতকরণ প্রয়োজন"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 6: ABSENT STUDENTS MISSED LESSONS                    */}
      {/* ======================================================== */}
      {activeTab === "absents" && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                অনুপস্থিত শিক্ষার্থীদের মিসড পড়া ও মেকআপ ফলো-আপ
              </h3>
              <p className="text-xs text-slate-500">
                হাজিরা মডিউলের সাথে সংযুক্ত: যারা পাঠদানের দিন অনুপস্থিত ছিল তাদের মেকআপ লগ
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {data.syllabuses.map((syl) => {
              const topicsWithAbsent: SyllabusTopic[] = [];
              for (const ch of syl.chapters || []) {
                for (const t of ch.topics || []) {
                  if (t.absent_followup && t.absent_followup.length > 0) {
                    topicsWithAbsent.push(t);
                  }
                }
              }

              if (topicsWithAbsent.length === 0) return null;

              return (
                <div key={syl.id} className="border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-sm">
                      {syl.subject_name} ({syl.class_name})
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      উস্তাদ: {syl.teacher_name || "অনির্ধারিত"}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {topicsWithAbsent.map((top) => {
                      const pendingCount = (top.absent_followup || []).filter(
                        (f) => !f.is_makeup_done
                      ).length;

                      return (
                        <div
                          key={top.id}
                          className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between"
                        >
                          <div>
                            <div className="font-bold text-xs text-slate-900">{top.name}</div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              অনুপস্থিত: {top.absent_followup?.length} জন | বকেয়া:{" "}
                              <span className="font-bold text-rose-600">{pendingCount} জন</span>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              setSelectedAbsentTopic(top);
                              setSelectedAbsentSyllabusId(syl.id);
                              setIsAbsentFollowupOpen(true);
                            }}
                            className="px-3 py-1 bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 rounded-lg text-xs font-bold transition-colors"
                          >
                            ফলো-আপ করুন
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 7: REPORTS & PRINT EXPORT                            */}
      {/* ======================================================== */}
      {activeTab === "reports" && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                একাডেমিক রিপোর্ট, অভিভাবক চিঠি ও প্রিন্ট এক্সপোর্ট
              </h3>
              <p className="text-xs text-slate-500">
                যে কোনো কিতাব বা জামাতের পূর্ণাঙ্গ অগ্রগতি শীট একক ক্লিকে প্রিন্ট বা PDF হিসেবে সংরক্ষণ করুন
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {data.allMetrics.map((m) => {
              const syl = data.syllabuses.find((s) => s.id === m.syllabus_id);
              if (!syl) return null;

              return (
                <div
                  key={m.syllabus_id}
                  className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between hover:bg-slate-100/70 transition-colors"
                >
                  <div>
                    <div className="text-xs text-slate-500 font-semibold">{syl.class_name}</div>
                    <div className="text-sm font-bold text-slate-900">{syl.subject_name}</div>
                    <div className="text-xs text-emerald-700 font-semibold mt-1">
                      অগ্রগতি: {m.actual_progress_percentage}% ({m.status_label})
                    </div>
                  </div>
                  <button
                    onClick={() => openPrint(m)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>প্রিন্ট ভিউ</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODALS */}
      <SyllabusFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingSyllabus(null);
        }}
        syllabus={editingSyllabus}
        classes={data.classes}
        subjects={data.subjects}
        teachers={data.teachers}
        onSuccess={refreshData}
      />

      <DailyClassEntryModal
        isOpen={isDailyClassModalOpen}
        onClose={() => {
          setIsDailyClassModalOpen(false);
          setEditingDailyRecord(null);
        }}
        syllabuses={data.syllabuses}
        classes={data.classes}
        subjects={data.subjects}
        teachers={data.teachers}
        initialClassId={dailyClassClassId}
        initialSubjectId={dailyClassSubjectId}
        initialTeacherId={dailyClassTeacherId}
        existingRecord={editingDailyRecord}
        onSuccess={refreshData}
      />

      <TopicRevisionHistoryModal
        isOpen={isRevisionHistoryOpen}
        onClose={() => {
          setIsRevisionHistoryOpen(false);
          setSelectedRevisionTopic(null);
        }}
        topic={selectedRevisionTopic}
        subjectName={selectedRevisionSubName}
        classNameStr={selectedRevisionClassName}
      />

      <StudentAbsentFollowupModal
        isOpen={isAbsentFollowupOpen}
        onClose={() => {
          setIsAbsentFollowupOpen(false);
          setSelectedAbsentTopic(null);
        }}
        syllabusId={selectedAbsentSyllabusId}
        topic={selectedAbsentTopic}
        subjectName={data.syllabuses.find((s) => s.id === selectedAbsentSyllabusId)?.subject_name}
        onSuccess={refreshData}
      />

      <SyllabusPrintReport
        isOpen={isPrintOpen}
        onClose={() => {
          setIsPrintOpen(false);
          setSelectedPrintMetrics(null);
          setSelectedPrintSyllabus(null);
        }}
        metrics={selectedPrintMetrics}
        syllabus={selectedPrintSyllabus}
        madrasaName={data.madrasaName || initialData.madrasaName || data.madrasa?.name || initialData.madrasa?.name || "কওমি মাদরাসা"}
        madrasaAddress={(data as any).madrasaAddress || (initialData as any).madrasaAddress || data.madrasa?.address || initialData.madrasa?.address || ""}
      />
    </div>
  );
}
