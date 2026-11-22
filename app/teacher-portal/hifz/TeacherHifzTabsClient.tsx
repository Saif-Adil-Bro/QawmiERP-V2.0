"use client";

import React, { useMemo, useState, useTransition } from "react";
import {
  BookOpen,
  Calendar,
  Sparkles,
  UserCog,
  Plus,
  Minus,
  CheckCircle2,
  AlertTriangle,
  Award,
  Users,
  Save,
  Search,
  ArrowUpRight,
  WifiOff,
} from "lucide-react";
import { toBanglaNumber } from "@/lib/numberToBangla";
import {
  addSpecialSabinaSessionAction,
  completeSpecialSabinaAction,
  createSpecialSabinaAction,
  saveDailyHifzUpgradeLogAction,
  saveWeeklySabinaAction,
  upsertHifzStudentProfileAction,
} from "@/app/actions/hifz-upgrade";
import {
  buildParaBreakdown,
  classifyParaMistakeStatus,
  expandParaRange,
  LISTENING_MODE_LABELS_BN,
  summarizeParaBreakdown,
  type HifzCategory,
  type HifzSpecialSabinaRecord,
  type HifzStudentProfile,
  type HifzWeeklySabinaRecord,
  type SabinaListeningMode,
} from "@/lib/hifz-upgrade-utils";
import { enqueueOfflineOutbox } from "@/lib/portal-sync";
import { useNetworkSync } from "@/hooks/useNetworkSync";

interface StudentRow {
  id: string;
  first_name: string;
  last_name?: string;
  roll_number?: string | number;
  class_id?: string;
}

interface Props {
  students: StudentRow[];
  teacherId?: string;
  dateStr: string;
  initialProfiles: Record<string, HifzStudentProfile>;
  initialWeeklySabinas: HifzWeeklySabinaRecord[];
  initialSpecialSabinas: HifzSpecialSabinaRecord[];
  legacyFormNode?: React.ReactNode;
}

type TabKey = "daily" | "thursday" | "special" | "profile";

function getStudentFullName(s?: StudentRow | null): string {
  if (!s) return "শিক্ষার্থী";
  return `${s.first_name || ""} ${s.last_name || ""}`.trim() || "শিক্ষার্থী";
}

function StepperCounter({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 px-3 py-2">
      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - 1))}
          className="w-9 h-9 min-h-[36px] rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 cursor-pointer"
          aria-label="কমান"
        >
          <Minus className="w-4 h-4" />
        </button>
        <span className="w-7 text-center text-sm font-extrabold text-slate-900 dark:text-white tabular-nums">
          {toBanglaNumber(value)}
        </span>
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          className="w-9 h-9 min-h-[36px] rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 cursor-pointer"
          aria-label="বাড়ান"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default function TeacherHifzTabsClient({
  students,
  teacherId,
  dateStr,
  initialProfiles,
  initialWeeklySabinas,
  initialSpecialSabinas,
}: Props) {
  const { isOnline } = useNetworkSync("teacher");
  const [activeTab, setActiveTab] = useState<TabKey>("daily");
  const [profiles, setProfiles] = useState<Record<string, HifzStudentProfile>>(initialProfiles);
  const [weeklySabinas, setWeeklySabinas] = useState<HifzWeeklySabinaRecord[]>(initialWeeklySabinas);
  const [specialSabinas, setSpecialSabinas] = useState<HifzSpecialSabinaRecord[]>(initialSpecialSabinas);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  // ---- TAB 1: DAILY ENTRY STATE ----
  const [categoryFilter, setCategoryFilter] = useState<"all" | HifzCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string>(students[0]?.id || "");

  // Sabqi inputs
  const [sabakPara, setSabakPara] = useState<number>(1);
  const [sabakPageFrom, setSabakPageFrom] = useState<number>(1);
  const [sabakPageTo, setSabakPageTo] = useState<number>(2);
  const [sabakMistakes, setSabakMistakes] = useState<number>(0);
  const [sabokiPara, setSabokiPara] = useState<number>(1);
  const [satSabakMistakes, setSatSabakMistakes] = useState<number>(0);
  const [amukhtaPara, setAmukhtaPara] = useState<number>(1);
  const [amukhtaAmount, setAmukhtaAmount] = useState<string>("১ পারা");
  const [amukhtaMistakes, setAmukhtaMistakes] = useState<number>(0);

  // Khatmi dual-session inputs
  const [morningDone, setMorningDone] = useState<boolean>(true);
  const [morningParaFrom, setMorningParaFrom] = useState<number>(1);
  const [morningParaTo, setMorningParaTo] = useState<number>(2);
  const [morningPages, setMorningPages] = useState<number>(20);
  const [morningMistakes, setMorningMistakes] = useState<number>(0);
  const [afternoonDone, setAfternoonDone] = useState<boolean>(false);
  const [afternoonParaFrom, setAfternoonParaFrom] = useState<number>(3);
  const [afternoonParaTo, setAfternoonParaTo] = useState<number>(4);
  const [afternoonPages, setAfternoonPages] = useState<number>(20);
  const [afternoonMistakes, setAfternoonMistakes] = useState<number>(0);

  const [rating, setRating] = useState<string>("Good");
  const [teacherRemark, setTeacherRemark] = useState<string>("");

  // ---- TAB 2: THURSDAY WEEKLY SABINA STATE ----
  const [sabinaStudentId, setSabinaStudentId] = useState<string>(students[0]?.id || "");
  const [sabinaPartnerId, setSabinaPartnerId] = useState<string>("");
  const [sabinaFromPara, setSabinaFromPara] = useState<number>(1);
  const [sabinaToPara, setSabinaToPara] = useState<number>(5);
  const [sabinaMistakesByPara, setSabinaMistakesByPara] = useState<Record<number, number>>({});
  const [sabinaRemarks, setSabinaRemarks] = useState<string>("");

  // ---- TAB 3: SPECIAL MULTI-MODE SABINA STATE ----
  const [specialTitle, setSpecialTitle] = useState<string>("");
  const [specialDays, setSpecialDays] = useState<number>(3);
  const [specialMode, setSpecialMode] = useState<SabinaListeningMode>("one_to_one");
  const [selectedSpecialId, setSelectedSpecialId] = useState<string>(
    initialSpecialSabinas[0]?.id || ""
  );
  const [sittingLabel, setSittingLabel] = useState<string>("ফজর পর");
  const [sittingReciterId, setSittingReciterId] = useState<string>(students[0]?.id || "");
  const [sittingListenerIds, setSittingListenerIds] = useState<string[]>([]);
  const [sittingParaFrom, setSittingParaFrom] = useState<number>(1);
  const [sittingParaTo, setSittingParaTo] = useState<number>(3);
  const [sittingMistakes, setSittingMistakes] = useState<Record<number, number>>({});

  // ---- TAB 4: PROFILE & 30-PARA SETUP STATE ----
  const [profileStudentId, setProfileStudentId] = useState<string>(students[0]?.id || "");

  const studentById = useMemo(() => {
    const map = new Map<string, StudentRow>();
    for (const s of students) map.set(s.id, s);
    return map;
  }, [students]);

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return students.filter((s) => {
      const cat: HifzCategory = profiles[s.id]?.hifz_category || "sabqi";
      if (categoryFilter !== "all" && cat !== categoryFilter) return false;
      if (q) {
        const hay = `${s.first_name} ${s.last_name || ""} ${s.roll_number || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [students, profiles, categoryFilter, searchQuery]);

  const selectedProfile = profiles[selectedStudentId];
  const activeCategory: HifzCategory = selectedProfile?.hifz_category || "sabqi";
  const khatamDoneCount = selectedProfile?.current_khatam_paras_done?.length || 0;
  const totalKhatams = selectedProfile?.total_khatams_completed || 0;

  const sabinaLiveBreakdown = useMemo(
    () => buildParaBreakdown(sabinaFromPara, sabinaToPara, sabinaMistakesByPara),
    [sabinaFromPara, sabinaToPara, sabinaMistakesByPara]
  );
  const sabinaLiveSummary = useMemo(
    () => summarizeParaBreakdown(sabinaLiveBreakdown),
    [sabinaLiveBreakdown]
  );

  const activeProfileTarget = profiles[profileStudentId] || {
    student_id: profileStudentId,
    madrasa_id: "",
    hifz_category: "sabqi" as HifzCategory,
    previously_memorized_paras: [],
    total_khatams_completed: 0,
    current_khatam_paras_done: [],
    default_sabina_partner_id: null,
  };

  // ---- HANDLERS ----
  const handleSaveDailyEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId) return;
    setFeedback(null);

    const payload = {
      student_id: selectedStudentId,
      teacher_id: teacherId || null,
      log_date: dateStr,
      student_category: activeCategory,
      sabak_para: sabakPara,
      sabak_page_from: sabakPageFrom,
      sabak_page_to: sabakPageTo,
      sabak_mistakes: sabakMistakes,
      saboki_para: sabokiPara,
      sat_sabak_mistakes: satSabakMistakes,
      amukhta_para: amukhtaPara,
      amukhta_amount: amukhtaAmount,
      amukhta_mistakes: amukhtaMistakes,
      morning_session_done: morningDone,
      morning_para_from: morningParaFrom,
      morning_para_to: morningParaTo,
      morning_pages: morningPages,
      morning_mistakes: morningMistakes,
      afternoon_session_done: afternoonDone,
      afternoon_para_from: afternoonParaFrom,
      afternoon_para_to: afternoonParaTo,
      afternoon_pages: afternoonPages,
      afternoon_mistakes: afternoonMistakes,
      performance_rating: rating,
      teacher_remark: teacherRemark,
    };

    startTransition(async () => {
      if (!isOnline) {
        await enqueueOfflineOutbox({
          portal: "teacher",
          actionType: "hifz",
          endpoint: "/api/teacher/save-hifz",
          method: "POST",
          payload,
        });
        setFeedback({
          type: "ok",
          text: "অফলাইন মোডে লোকাল আউটবক্সে সেভ হয়েছে — ইন্টারনেট এলেই স্বয়ংক্রিয়ভাবে সিঙ্ক হবে।",
        });
        return;
      }

      const res: any = await saveDailyHifzUpgradeLogAction(payload);
      if (res?.error) {
        setFeedback({ type: "err", text: res.error });
      } else {
        if (res?.profile) {
          setProfiles((prev) => ({ ...prev, [selectedStudentId]: res.profile }));
        }
        setFeedback({
          type: "ok",
          text: res?.khatamJustCompleted
            ? "মাশাআল্লাহ! ৩০ পারা পূর্ণ হয়ে ১টি নতুন খতম সম্পন্ন হয়েছে এবং এন্ট্রি সেভ হয়েছে।"
            : "দৈনিক হিফজ এন্ট্রি সফলভাবে সংরক্ষিত হয়েছে!",
        });
        setTeacherRemark("");
      }
    });
  };

  const handlePromoteToKhatmi = () => {
    if (!selectedStudentId) return;
    setFeedback(null);
    startTransition(async () => {
      const res: any = await upsertHifzStudentProfileAction(selectedStudentId, {
        hifz_category: "khatmi",
      });
      if (res?.error) {
        setFeedback({ type: "err", text: res.error });
      } else if (res?.profile) {
        setProfiles((prev) => ({ ...prev, [selectedStudentId]: res.profile }));
        setFeedback({
          type: "ok",
          text: "শিক্ষার্থীকে সফলভাবে খতমী (Khatmi) স্তরে উন্নীত করা হয়েছে!",
        });
      }
    });
  };

  const handleSaveWeeklySabina = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sabinaStudentId) return;
    setFeedback(null);

    startTransition(async () => {
      const st = studentById.get(sabinaStudentId);
      const partner = sabinaPartnerId ? studentById.get(sabinaPartnerId) : null;
      const res: any = await saveWeeklySabinaAction({
        sabina_date: dateStr,
        student_id: sabinaStudentId,
        student_name: getStudentFullName(st),
        listener_student_id: sabinaPartnerId || null,
        listener_student_name: partner ? getStudentFullName(partner) : null,
        verified_by_teacher_id: teacherId || null,
        assigned_para_from: sabinaFromPara,
        assigned_para_to: sabinaToPara,
        mistakes_by_para: sabinaMistakesByPara,
        remarks: sabinaRemarks,
      });

      if (res?.error) {
        setFeedback({ type: "err", text: res.error });
      } else if (res?.record) {
        setWeeklySabinas((prev) => [res.record, ...prev]);
        setSabinaMistakesByPara({});
        setSabinaRemarks("");
        setFeedback({
          type: "ok",
          text: "বৃহস্পতিবারের সাপ্তাহিক সবিনা সফলভাবে সংরক্ষিত হয়েছে!",
        });
      }
    });
  };

  const handleCreateSpecialSabina = (e: React.FormEvent) => {
    e.preventDefault();
    if (!specialTitle.trim()) return;
    setFeedback(null);
    startTransition(async () => {
      const res: any = await createSpecialSabinaAction({
        title: specialTitle.trim(),
        duration_days: specialDays,
        start_date: dateStr,
        listening_mode: specialMode,
      });
      if (res?.error) {
        setFeedback({ type: "err", text: res.error });
      } else if (res?.record) {
        setSpecialSabinas((prev) => [res.record, ...prev]);
        setSelectedSpecialId(res.record.id);
        setSpecialTitle("");
        setFeedback({ type: "ok", text: `বিশেষ সবিনা "${res.record.title}" চালু হয়েছে!` });
      }
    });
  };

  const handleAddSpecialSitting = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSpecialId || !sittingReciterId) return;
    setFeedback(null);
    startTransition(async () => {
      const reciter = studentById.get(sittingReciterId);
      const listenerNames = sittingListenerIds.map((id) =>
        getStudentFullName(studentById.get(id))
      );
      const res: any = await addSpecialSabinaSessionAction(selectedSpecialId, {
        session_label: sittingLabel,
        reciter_id: sittingReciterId,
        reciter_name: getStudentFullName(reciter),
        listener_ids: sittingListenerIds,
        listener_names: listenerNames,
        para_from: sittingParaFrom,
        para_to: sittingParaTo,
        mistakes_by_para: sittingMistakes,
      });
      if (res?.error) {
        setFeedback({ type: "err", text: res.error });
      } else if (res?.session_logs) {
        setSpecialSabinas((prev) =>
          prev.map((item) =>
            item.id === selectedSpecialId
              ? { ...item, session_logs: res.session_logs }
              : item
          )
        );
        setSittingMistakes({});
        setFeedback({ type: "ok", text: "বিশেষ সবিনার বৈঠক লগ সংরক্ষিত হয়েছে!" });
      }
    });
  };

  const handleTogglePreMemorizedPara = (para: number) => {
    if (!profileStudentId) return;
    const currentSet = new Set(activeProfileTarget.previously_memorized_paras || []);
    if (currentSet.has(para)) currentSet.delete(para);
    else currentSet.add(para);
    const nextList = Array.from(currentSet).sort((a, b) => a - b);

    setProfiles((prev) => ({
      ...prev,
      [profileStudentId]: {
        ...activeProfileTarget,
        previously_memorized_paras: nextList,
      },
    }));

    startTransition(async () => {
      const res: any = await upsertHifzStudentProfileAction(profileStudentId, {
        previously_memorized_paras: nextList,
      });
      if (res?.error) setFeedback({ type: "err", text: res.error });
    });
  };

  const handleProfileMetaSave = (updates: {
    hifz_category?: HifzCategory;
    default_sabina_partner_id?: string | null;
  }) => {
    if (!profileStudentId) return;
    startTransition(async () => {
      const res: any = await upsertHifzStudentProfileAction(profileStudentId, updates);
      if (res?.error) {
        setFeedback({ type: "err", text: res.error });
      } else if (res?.profile) {
        setProfiles((prev) => ({ ...prev, [profileStudentId]: res.profile }));
        setFeedback({ type: "ok", text: "শিক্ষার্থীর হিফজ প্রোফাইল আপডেট হয়েছে!" });
      }
    });
  };

  const activeSpecialEvent = specialSabinas.find((s) => s.id === selectedSpecialId) || specialSabinas[0];

  return (
    <div className="space-y-5">
      {/* 4 Mobile-Friendly Tabs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        {(
          [
            { key: "daily", label: "দৈনিক সবক ও খতমী", icon: BookOpen },
            { key: "thursday", label: "বৃহস্পতিবারের সবিনা", icon: Calendar },
            { key: "special", label: "বিশেষ সবিনা (Multi)", icon: Sparkles },
            { key: "profile", label: "প্রোফাইল ও ৩০ পারা", icon: UserCog },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setActiveTab(tab.key);
                setFeedback(null);
              }}
              className={`min-h-[44px] px-3 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                isActive
                  ? "bg-teal-600 text-white shadow-xs"
                  : "bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 hover:bg-slate-100"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Offline Notice */}
      {!isOnline && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-900 flex items-center gap-2">
          <WifiOff className="w-4 h-4 shrink-0" />
          <span>আপনি অফলাইনে আছেন — দৈনিক এন্ট্রি লোকাল আউটবক্সে সেভ হবে এবং অনলাইন হলে অটো-সিঙ্ক হবে।</span>
        </div>
      )}

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`rounded-xl border px-4 py-3 text-xs sm:text-sm font-semibold flex items-center gap-2 ${
            feedback.type === "ok"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-rose-50 border-rose-200 text-rose-900"
          }`}
        >
          {feedback.type === "ok" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* ===================== TAB 1: DAILY SABQI & KHATMI ENTRY ===================== */}
      {activeTab === "daily" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Student Selector Column */}
          <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
            <div className="flex items-center gap-1.5">
              {(
                [
                  { key: "all", label: "সবাই" },
                  { key: "sabqi", label: "সবকী" },
                  { key: "khatmi", label: "খতমী" },
                ] as const
              ).map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setCategoryFilter(f.key)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                    categoryFilter === f.key
                      ? "bg-slate-900 text-white dark:bg-teal-600"
                      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="নাম বা রোল দিয়ে খুঁজুন..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
            </div>

            <div className="max-h-[420px] overflow-y-auto space-y-1.5 pr-1">
              {filteredStudents.map((s) => {
                const cat: HifzCategory = profiles[s.id]?.hifz_category || "sabqi";
                const selected = s.id === selectedStudentId;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedStudentId(s.id)}
                    className={`w-full text-left p-3 rounded-xl border transition flex items-center justify-between gap-2 cursor-pointer ${
                      selected
                        ? "border-teal-500 bg-teal-50/70 dark:bg-teal-950/50"
                        : "border-slate-200/70 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                        {getStudentFullName(s)}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        রোল: {toBanglaNumber(s.roll_number || "-")}
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                        cat === "khatmi"
                          ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                          : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                      }`}
                    >
                      {cat === "khatmi" ? "খতমী" : "সবকী"}
                    </span>
                  </button>
                );
              })}
              {filteredStudents.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-6">কোনো শিক্ষার্থী পাওয়া যায়নি</p>
              )}
            </div>
          </div>

          {/* Dynamic Entry Form Column */}
          <form
            onSubmit={handleSaveDailyEntry}
            className="lg:col-span-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                  {getStudentFullName(studentById.get(selectedStudentId))}
                </h2>
                <p className="text-xs text-slate-500">
                  স্তর:{" "}
                  <strong className="text-teal-700 dark:text-teal-400">
                    {activeCategory === "khatmi" ? "খতমী (Khatmi দাওর)" : "সবকী (Sabqi — ৩ স্তর)"}
                  </strong>
                </p>
              </div>

              {activeCategory === "sabqi" && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={handlePromoteToKhatmi}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold cursor-pointer"
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  খতমী স্তরে উন্নীত করুন
                </button>
              )}
            </div>

            {activeCategory === "sabqi" ? (
              <div className="space-y-4">
                {/* 1. নতুন সবক */}
                <div className="rounded-xl border border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20 p-4 space-y-3">
                  <div className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                    ১. নতুন সবক (Sabak)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">পারা (১-৩০)</label>
                      <input
                        type="number"
                        min={1}
                        max={30}
                        value={sabakPara}
                        onChange={(e) => setSabakPara(Number(e.target.value) || 1)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">পৃষ্ঠা হতে</label>
                      <input
                        type="number"
                        min={1}
                        max={25}
                        value={sabakPageFrom}
                        onChange={(e) => setSabakPageFrom(Number(e.target.value) || 1)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">পৃষ্ঠা পর্যন্ত</label>
                      <input
                        type="number"
                        min={1}
                        max={25}
                        value={sabakPageTo}
                        onChange={(e) => setSabakPageTo(Number(e.target.value) || 1)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-bold"
                      />
                    </div>
                  </div>
                  <StepperCounter label="নতুন সবকের ভুল" value={sabakMistakes} onChange={setSabakMistakes} />
                </div>

                {/* 2. সাতসবক */}
                <div className="rounded-xl border border-blue-200/80 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20 p-4 space-y-3">
                  <div className="text-xs font-bold text-blue-800 dark:text-blue-300">
                    ২. সাতসবক (Sat Sabak)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">পারা</label>
                      <input
                        type="number"
                        min={1}
                        max={30}
                        value={sabokiPara}
                        onChange={(e) => setSabokiPara(Number(e.target.value) || 1)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-bold"
                      />
                    </div>
                    <StepperCounter label="সাতসবকের ভুল" value={satSabakMistakes} onChange={setSatSabakMistakes} />
                  </div>
                </div>

                {/* 3. আমুখতা */}
                <div className="rounded-xl border border-amber-200/80 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 p-4 space-y-3">
                  <div className="text-xs font-bold text-amber-800 dark:text-amber-300">
                    ৩. আমুখতা (Amukhta)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">পারা</label>
                      <input
                        type="number"
                        min={1}
                        max={30}
                        value={amukhtaPara}
                        onChange={(e) => setAmukhtaPara(Number(e.target.value) || 1)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">পরিমাণ (যেমন: ১ পারা)</label>
                      <input
                        type="text"
                        value={amukhtaAmount}
                        onChange={(e) => setAmukhtaAmount(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm"
                      />
                    </div>
                  </div>
                  <StepperCounter label="আমুখতার ভুল" value={amukhtaMistakes} onChange={setAmukhtaMistakes} />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Live Khatam Progress Bar */}
                <div className="rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-indigo-900 dark:text-indigo-200">
                    <span className="flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-indigo-600" />
                      চলমান খতম: {toBanglaNumber(totalKhatams + 1)}ম খতম — {toBanglaNumber(khatamDoneCount)}/৩০ পারা সম্পন্ন
                    </span>
                    <span>সম্পন্ন খতম: {toBanglaNumber(totalKhatams)} বার</span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-indigo-200/80 dark:bg-indigo-900 overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 transition-all"
                      style={{ width: `${Math.min(100, Math.round((khatamDoneCount / 30) * 100))}%` }}
                    />
                  </div>
                </div>

                {/* Morning Session */}
                <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 p-4 space-y-3">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
                      সকালের সেশন (Morning Session)
                    </span>
                    <input
                      type="checkbox"
                      checked={morningDone}
                      onChange={(e) => setMorningDone(e.target.checked)}
                      className="w-5 h-5 accent-emerald-600"
                    />
                  </label>
                  {morningDone && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">পারা হতে</label>
                        <input
                          type="number"
                          min={1}
                          max={30}
                          value={morningParaFrom}
                          onChange={(e) => setMorningParaFrom(Number(e.target.value) || 1)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">পারা পর্যন্ত</label>
                        <input
                          type="number"
                          min={1}
                          max={30}
                          value={morningParaTo}
                          onChange={(e) => setMorningParaTo(Number(e.target.value) || 1)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">মোট পৃষ্ঠা</label>
                        <input
                          type="number"
                          min={0}
                          value={morningPages}
                          onChange={(e) => setMorningPages(Number(e.target.value) || 0)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold"
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <StepperCounter label="সকালের সেশনের ভুল" value={morningMistakes} onChange={setMorningMistakes} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Afternoon Session */}
                <div className="rounded-xl border border-amber-200 dark:border-amber-800 p-4 space-y-3">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-sm font-bold text-amber-800 dark:text-amber-300">
                      দুপুর/বিকেলের সেশন (Afternoon Session)
                    </span>
                    <input
                      type="checkbox"
                      checked={afternoonDone}
                      onChange={(e) => setAfternoonDone(e.target.checked)}
                      className="w-5 h-5 accent-amber-600"
                    />
                  </label>
                  {afternoonDone && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">পারা হতে</label>
                        <input
                          type="number"
                          min={1}
                          max={30}
                          value={afternoonParaFrom}
                          onChange={(e) => setAfternoonParaFrom(Number(e.target.value) || 1)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">পারা পর্যন্ত</label>
                        <input
                          type="number"
                          min={1}
                          max={30}
                          value={afternoonParaTo}
                          onChange={(e) => setAfternoonParaTo(Number(e.target.value) || 1)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-600 block mb-1">মোট পৃষ্ঠা</label>
                        <input
                          type="number"
                          min={0}
                          value={afternoonPages}
                          onChange={(e) => setAfternoonPages(Number(e.target.value) || 0)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold"
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <StepperCounter label="বিকেলের সেশনের ভুল" value={afternoonMistakes} onChange={setAfternoonMistakes} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Rating & Remark */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">সার্বিক মান</label>
                <select
                  value={rating}
                  onChange={(e) => setRating(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold"
                >
                  <option value="Excellent">মুমতায (অসাধারণ)</option>
                  <option value="Good">জায়্যিদ (উত্তম)</option>
                  <option value="Average">মাকবুল (চলনসই)</option>
                  <option value="Poor">দুর্বল (পুনরায় পড়া জরুরি)</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-slate-700 block mb-1">উস্তাদের মন্তব্য</label>
                <input
                  type="text"
                  value={teacherRemark}
                  onChange={(e) => setTeacherRemark(e.target.value)}
                  placeholder="যেমন: তাজবীদ সুন্দর ছিল / মাখরাজে মনোযোগ দিতে হবে"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending || !selectedStudentId}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              {isPending ? "সংরক্ষণ হচ্ছে..." : "দৈনিক হিফজ এন্ট্রি সংরক্ষণ করুন"}
            </button>
          </form>
        </div>
      )}

      {/* ===================== TAB 2: THURSDAY WEEKLY SABINA ===================== */}
      {activeTab === "thursday" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <form
            onSubmit={handleSaveWeeklySabina}
            className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4"
          >
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-teal-600" />
              বৃহস্পতিবারের সাপ্তাহিক সাথী-সবিনা এন্ট্রি
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">পাঠকারী শিক্ষার্থী</label>
                <select
                  value={sabinaStudentId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSabinaStudentId(id);
                    const defPartner = profiles[id]?.default_sabina_partner_id || "";
                    if (defPartner) setSabinaPartnerId(defPartner);
                  }}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm"
                >
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {getStudentFullName(s)} (রোল {toBanglaNumber(s.roll_number || "-")})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">শ্রোতা সাথী (বা উস্তাদ)</label>
                <select
                  value={sabinaPartnerId}
                  onChange={(e) => setSabinaPartnerId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm"
                >
                  <option value="">সরাসরি উস্তাদ শুনেছেন</option>
                  {students
                    .filter((s) => s.id !== sabinaStudentId)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {getStudentFullName(s)} (রোল {toBanglaNumber(s.roll_number || "-")})
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">নির্ধারিত পারা (হতে)</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={sabinaFromPara}
                  onChange={(e) => setSabinaFromPara(Number(e.target.value) || 1)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">নির্ধারিত পারা (পর্যন্ত)</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={sabinaToPara}
                  onChange={(e) => setSabinaToPara(Number(e.target.value) || 1)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold"
                />
              </div>
            </div>

            {/* Auto-generated Para-by-Para Rows */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-700">
                পারা-ভিত্তিক ভুল কাউন্টার ({toBanglaNumber(sabinaLiveBreakdown.length)} পারা)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[300px] overflow-y-auto pr-1">
                {sabinaLiveBreakdown.map((item) => {
                  const statusBadge =
                    item.status === "perfect"
                      ? { text: "নির্ভুল", cls: "bg-emerald-100 text-emerald-800 border-emerald-200" }
                      : item.status === "good"
                      ? { text: "উত্তম", cls: "bg-blue-100 text-blue-800 border-blue-200" }
                      : { text: "দুর্বল / পুনরায়", cls: "bg-rose-100 text-rose-800 border-rose-200" };

                  return (
                    <div
                      key={item.para}
                      className="rounded-xl border border-slate-200 p-2.5 flex items-center justify-between gap-2 bg-slate-50/70"
                    >
                      <div>
                        <div className="text-xs font-extrabold text-slate-900">
                          পারা {toBanglaNumber(item.para)}
                        </div>
                        <span
                          className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusBadge.cls}`}
                        >
                          {statusBadge.text}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setSabinaMistakesByPara((prev) => ({
                              ...prev,
                              [item.para]: Math.max(0, (prev[item.para] || 0) - 1),
                            }))
                          }
                          className="w-8 h-8 rounded-lg border bg-white flex items-center justify-center cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-6 text-center text-sm font-extrabold">
                          {toBanglaNumber(item.mistakes)}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setSabinaMistakesByPara((prev) => ({
                              ...prev,
                              [item.para]: (prev[item.para] || 0) + 1,
                            }))
                          }
                          className="w-8 h-8 rounded-lg border bg-white flex items-center justify-center cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Auto-Generated Summary Card */}
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 text-xs space-y-1.5">
              <div className="font-bold text-slate-800">অটো-সামারি:</div>
              <div className="flex flex-wrap gap-2">
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                  নির্ভুল পারা: {sabinaLiveSummary.perfectParas.length ? sabinaLiveSummary.perfectParas.map((p) => toBanglaNumber(p)).join(", ") : "নেই"}
                </span>
                <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold">
                  সামান্য ভুল: {sabinaLiveSummary.goodParas.length ? sabinaLiveSummary.goodParas.map((p) => toBanglaNumber(p)).join(", ") : "নেই"}
                </span>
                <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold">
                  অধিক ভুল (পুনরায়): {sabinaLiveSummary.weakParas.length ? sabinaLiveSummary.weakParas.map((p) => toBanglaNumber(p)).join(", ") : "নেই"}
                </span>
              </div>
            </div>

            <input
              type="text"
              value={sabinaRemarks}
              onChange={(e) => setSabinaRemarks(e.target.value)}
              placeholder="মন্তব্য (ঐচ্ছিক)..."
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm"
            />

            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold inline-flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              {isPending ? "সংরক্ষণ হচ্ছে..." : "বৃহস্পতিবারের সবিনা সংরক্ষণ করুন"}
            </button>
          </form>

          {/* Recent Thursday Sabinas */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              সাম্প্রতিক বৃহস্পতিবারের সবিনা ({toBanglaNumber(weeklySabinas.length)}টি)
            </h3>
            <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
              {weeklySabinas.slice(0, 15).map((sab) => {
                const stName =
                  sab.student_name || getStudentFullName(studentById.get(sab.student_id));
                const weak = (sab.para_breakdown || []).filter((b) => b.status === "weak");
                return (
                  <div
                    key={sab.id}
                    className="rounded-xl border border-slate-200 p-3 space-y-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">{stName}</span>
                      <span className="text-[11px] font-mono text-slate-500">{sab.sabina_date}</span>
                    </div>
                    <div className="text-slate-600">
                      পারা {toBanglaNumber(sab.assigned_para_from)}–{toBanglaNumber(sab.assigned_para_to)} • মোট ভুল: <strong>{toBanglaNumber(sab.total_mistakes)}</strong>
                    </div>
                    {weak.length > 0 && (
                      <div className="text-[11px] text-rose-700 font-semibold">
                        দুর্বল পারা: {weak.map((w) => toBanglaNumber(w.para)).join(", ")}
                      </div>
                    )}
                  </div>
                );
              })}
              {weeklySabinas.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-8">এখনও কোনো সবিনা রেকর্ড নেই</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================== TAB 3: SPECIAL MULTI-MODE SABINA ===================== */}
      {activeTab === "special" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Create Event */}
          <form
            onSubmit={handleCreateSpecialSabina}
            className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3"
          >
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              নতুন বিশেষ সবিনা ইভেন্ট তৈরি
            </h2>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">শিরোনাম</label>
              <input
                type="text"
                required
                value={specialTitle}
                onChange={(e) => setSpecialTitle(e.target.value)}
                placeholder="যেমন: রমজান পূর্ব ৩ দিনব্যাপী খতম সবিনা"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">মেয়াদ (দিন)</label>
                <select
                  value={specialDays}
                  onChange={(e) => setSpecialDays(Number(e.target.value))}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white"
                >
                  <option value={1}>১ দিন</option>
                  <option value={3}>৩ দিন</option>
                  <option value={7}>৭ দিন</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">সবিনার ধরন</label>
                <select
                  value={specialMode}
                  onChange={(e) => setSpecialMode(e.target.value as SabinaListeningMode)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white"
                >
                  <option value="one_to_one">জোড়ায় (One-to-One)</option>
                  <option value="group_to_group">গ্রুপ বনাম গ্রুপ</option>
                  <option value="one_to_many">প্যানেল শ্রবণ (One-to-Many)</option>
                </select>
              </div>
            </div>
            <button
              type="submit"
              disabled={isPending}
              className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold cursor-pointer"
            >
              বিশেষ সবিনা চালু করুন
            </button>

            <div className="pt-3 border-t border-slate-100 space-y-2">
              <div className="text-xs font-bold text-slate-600">ইভেন্ট তালিকা</div>
              {specialSabinas.map((ev) => (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => setSelectedSpecialId(ev.id)}
                  className={`w-full text-left p-3 rounded-xl border text-xs transition cursor-pointer ${
                    activeSpecialEvent?.id === ev.id
                      ? "border-purple-500 bg-purple-50/70"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-900">{ev.title}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        ev.status === "ongoing"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {ev.status === "ongoing" ? "চলমান" : "সম্পন্ন"}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {LISTENING_MODE_LABELS_BN[ev.listening_mode]} • {toBanglaNumber(ev.duration_days)} দিন
                  </div>
                </button>
              ))}
            </div>
          </form>

          {/* Sitting Logs */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            {activeSpecialEvent ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">
                      {activeSpecialEvent.title}
                    </h3>
                    <p className="text-xs text-purple-700 font-semibold">
                      মোড: {LISTENING_MODE_LABELS_BN[activeSpecialEvent.listening_mode]}
                    </p>
                  </div>
                  {activeSpecialEvent.status === "ongoing" && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() =>
                        startTransition(async () => {
                          await completeSpecialSabinaAction(activeSpecialEvent.id);
                          setSpecialSabinas((prev) =>
                            prev.map((s) =>
                              s.id === activeSpecialEvent.id
                                ? { ...s, status: "completed" }
                                : s
                            )
                          );
                        })
                      }
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold cursor-pointer"
                    >
                      সম্পন্ন ঘোষণা করুন
                    </button>
                  )}
                </div>

                <form onSubmit={handleAddSpecialSitting} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">বৈঠক (Sitting)</label>
                      <select
                        value={sittingLabel}
                        onChange={(e) => setSittingLabel(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm"
                      >
                        <option value="ফজর পর">ফজর পর</option>
                        <option value="যোহর পর">যোহর পর</option>
                        <option value="আসর পর">আসর পর</option>
                        <option value="মাগরিব পর">মাগরিব পর</option>
                        <option value="এশা পর">এশা পর</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">পাঠকারী (Reciter)</label>
                      <select
                        value={sittingReciterId}
                        onChange={(e) => setSittingReciterId(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm"
                      >
                        {students.map((s) => (
                          <option key={s.id} value={s.id}>
                            {getStudentFullName(s)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">পারা হতে</label>
                      <input
                        type="number"
                        min={1}
                        max={30}
                        value={sittingParaFrom}
                        onChange={(e) => setSittingParaFrom(Number(e.target.value) || 1)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">পারা পর্যন্ত</label>
                      <input
                        type="number"
                        min={1}
                        max={30}
                        value={sittingParaTo}
                        onChange={(e) => setSittingParaTo(Number(e.target.value) || 1)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-bold"
                      />
                    </div>
                  </div>

                  {/* Multi-listener chips */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      শ্রোতা / প্যানেল নির্বাচন করুন (একাধিক সিলেক্ট করা যাবে)
                    </label>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 rounded-xl border border-slate-200 bg-slate-50">
                      {students
                        .filter((s) => s.id !== sittingReciterId)
                        .map((s) => {
                          const checked = sittingListenerIds.includes(s.id);
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() =>
                                setSittingListenerIds((prev) =>
                                  checked ? prev.filter((id) => id !== s.id) : [...prev, s.id]
                                )
                              }
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer ${
                                checked
                                  ? "bg-purple-600 text-white border-purple-600"
                                  : "bg-white text-slate-700 border-slate-200"
                              }`}
                            >
                              {getStudentFullName(s)}
                            </button>
                          );
                        })}
                    </div>
                  </div>

                  {/* Para mistakes */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {expandParaRange(sittingParaFrom, sittingParaTo).map((p) => (
                      <StepperCounter
                        key={p}
                        label={`পারা ${toBanglaNumber(p)} ভুল`}
                        value={sittingMistakes[p] || 0}
                        onChange={(val) =>
                          setSittingMistakes((prev) => ({ ...prev, [p]: val }))
                        }
                      />
                    ))}
                  </div>

                  <button
                    type="submit"
                    disabled={isPending}
                    className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold cursor-pointer"
                  >
                    বৈঠক লগ যুক্ত করুন
                  </button>
                </form>

                {/* Recorded Sittings */}
                <div className="space-y-2 pt-3 border-t border-slate-100">
                  {(activeSpecialEvent.session_logs || []).map((log) => (
                    <div
                      key={log.id}
                      className="rounded-xl border border-slate-200 p-3 text-xs flex flex-wrap items-center justify-between gap-2"
                    >
                      <div>
                        <span className="font-bold text-purple-700">{log.session_label}</span> •{" "}
                        <strong>{log.reciter_name || "শিক্ষার্থী"}</strong> (পারা{" "}
                        {toBanglaNumber(log.para_from)}–{toBanglaNumber(log.para_to)})
                        {log.listener_names && log.listener_names.length > 0 && (
                          <div className="text-[11px] text-slate-500">
                            শ্রোতা: {log.listener_names.join(", ")}
                          </div>
                        )}
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 font-bold text-slate-700">
                        মোট ভুল: {toBanglaNumber(log.total_mistakes)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-xs text-slate-400 text-center py-12">
                বাম পাশ থেকে নতুন বিশেষ সবিনা ইভেন্ট তৈরি করুন
              </p>
            )}
          </div>
        </div>
      )}

      {/* ===================== TAB 4: STUDENT PROFILE & 30-PARA SETUP ===================== */}
      {activeTab === "profile" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">শিক্ষার্থী নির্বাচন</label>
              <select
                value={profileStudentId}
                onChange={(e) => setProfileStudentId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold"
              >
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {getStudentFullName(s)} (রোল {toBanglaNumber(s.roll_number || "-")})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">হিফজ স্তর</label>
              <select
                value={activeProfileTarget.hifz_category}
                onChange={(e) =>
                  handleProfileMetaSave({ hifz_category: e.target.value as HifzCategory })
                }
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold"
              >
                <option value="sabqi">সবকী (Sabqi)</option>
                <option value="khatmi">খতমী (Khatmi)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                বৃহস্পতিবারের নির্ধারিত সাথী
              </label>
              <select
                value={activeProfileTarget.default_sabina_partner_id || ""}
                onChange={(e) =>
                  handleProfileMetaSave({ default_sabina_partner_id: e.target.value || null })
                }
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm"
              >
                <option value="">নির্ধারিত নেই</option>
                {students
                  .filter((s) => s.id !== profileStudentId)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {getStudentFullName(s)}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                ভর্তির পূর্বে মুখস্থকৃত পারা (Previously Memorized Paras)
              </h3>
              <span className="text-xs font-bold text-teal-700">
                নির্বাচিত: {toBanglaNumber(activeProfileTarget.previously_memorized_paras.length)}/৩০ পারা
              </span>
            </div>
            <p className="text-xs text-slate-500">
              যেকোনো পারায় ট্যাপ করে নতুন ভর্তিকৃত শিক্ষার্থীর পূর্বের মুখস্থকৃত পারা টগল করুন।
            </p>

            <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-10 gap-2">
              {Array.from({ length: 30 }, (_, i) => i + 1).map((para) => {
                const isPre = activeProfileTarget.previously_memorized_paras.includes(para);
                return (
                  <button
                    key={para}
                    type="button"
                    onClick={() => handleTogglePreMemorizedPara(para)}
                    className={`min-h-[44px] rounded-xl border text-xs font-extrabold transition cursor-pointer ${
                      isPre
                        ? "bg-teal-600 text-white border-teal-700 shadow-xs"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    পারা {toBanglaNumber(para)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
