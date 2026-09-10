"use client";

import { useState, useTransition } from "react";
import {
  CalendarDays,
  Clock,
  MapPin,
  User,
  BookOpen,
  PlusCircle,
  Trash2,
  Edit,
  Copy,
  Coffee,
  Sparkles,
  Sun,
  Moon,
  Check,
  AlertCircle,
  X,
  Layers,
  ArrowRight,
  ShieldAlert,
  Zap,
  RefreshCw,
  Eye,
  CalendarCheck,
  Flame,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  addRoutine,
  updateRoutine,
  deleteRoutine,
  copyDayRoutine,
  clearDayRoutines,
} from "@/app/actions/routine";
import {
  DAY_KEYS,
  DAY_TRANSLATIONS,
  COMMON_BREAKS,
  COMMON_CUSTOM_ACTIVITIES,
  parseRoutineItem,
  formatTimeString,
  RoutineItemType,
  ParsedRoutineItem,
} from "@/lib/routine-helper";
import { toBanglaNumber } from "@/lib/numberToBangla";

interface Props {
  classes: any[];
  subjects: any[];
  teachers: any[];
  routines: any[];
  initialClassId: string;
  initialType: string;
}

export default function RoutineBuilderClient({
  classes,
  subjects,
  teachers,
  routines: initialRoutines,
  initialClassId,
  initialType,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [selectedClassId, setSelectedClassId] = useState(initialClassId);
  const [selectedType, setSelectedType] = useState(initialType);
  const [activeDay, setActiveDay] = useState<string>("Saturday");

  // Form states for New Item
  const [itemType, setItemType] = useState<RoutineItemType>("SUBJECT");
  const [subjectId, setSubjectId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("09:00");
  const [roomNumber, setRoomNumber] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Edit Modal State
  const [editingItem, setEditingItem] = useState<ParsedRoutineItem | null>(null);
  const [editItemType, setEditItemType] = useState<RoutineItemType>("SUBJECT");
  const [editSubjectId, setEditSubjectId] = useState("");
  const [editTeacherId, setEditTeacherId] = useState("");
  const [editCustomTitle, setEditCustomTitle] = useState("");
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [editRoomNumber, setEditRoomNumber] = useState("");
  const [editDayOfWeek, setEditDayOfWeek] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  // Copy Modal State
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [copySourceDay, setCopySourceDay] = useState("Saturday");
  const [copyTargetDays, setCopyTargetDays] = useState<string[]>([
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
  ]);
  const [copyOverwrite, setCopyOverwrite] = useState(true);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  // Parse all routines
  const parsedRoutines = initialRoutines.map(parseRoutineItem);

  // Group by day_of_week
  const groupedRoutines = DAY_KEYS.reduce((acc, day) => {
    acc[day] = parsedRoutines.filter((r) => r.day_of_week === day);
    return acc;
  }, {} as Record<string, ParsedRoutineItem[]>);

  const currentClass = classes.find((c) => c.id === selectedClassId);

  // Quick preset time buttons
  const timePresets = [
    { start: "06:00", end: "07:30", label: "সকাল ৬:০০ - ৭:৩০ (সবক)" },
    { start: "08:00", end: "09:00", label: "১ম পিরিয়ড (৮:০০ - ৯:০০)" },
    { start: "09:00", end: "10:00", label: "২য় পিরিয়ড (৯:০০ - ১০:০০)" },
    { start: "10:00", end: "10:30", label: "নাস্তা বিরতি (১০:০০ - ১০:৩০)" },
    { start: "10:30", end: "11:30", label: "৩য় পিরিয়ড (১০:৩০ - ১১:৩০)" },
    { start: "11:30", end: "12:30", label: "৪র্থ পিরিয়ড (১১:৩০ - ১২:৩০)" },
    { start: "13:00", end: "14:30", label: "জোহর ও খাবার (১:০০ - ২:৩০)" },
    { start: "14:30", end: "15:30", label: "কায়লুলা/ঘুম (২:৩০ - ৩:৩০)" },
    { start: "16:45", end: "17:45", label: "খেলাধুলা (৪:৪৫ - ৫:৪৫)" },
    { start: "18:30", end: "20:30", label: "মুতালাআ/তাকরার (৬:৩০ - ৮:৩০)" },
    { start: "21:30", end: "22:30", label: "শয়ন/রাতের ঘুম (৯:৩০)" },
  ];

  // Quick filter switch
  const handleFilterChange = (classId: string, type: string) => {
    setSelectedClassId(classId);
    setSelectedType(type);
    router.push(`/dashboard/academic/routine/builder?class_id=${classId}&type=${type}`);
  };

  // Add Item Handler
  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const formData = new FormData();
    formData.append("class_id", selectedClassId);
    formData.append("routine_type", selectedType);
    formData.append("day_of_week", activeDay);
    formData.append("item_type", itemType);
    formData.append("start_time", startTime);
    formData.append("end_time", endTime);
    formData.append("subject_id", subjectId);
    formData.append("teacher_id", teacherId);
    formData.append("custom_title", customTitle);
    formData.append("room_number", roomNumber);

    startTransition(async () => {
      const res = await addRoutine(formData);
      if (res?.error) {
        setFormError(res.error);
      } else {
        setFormSuccess("রুটিনে সফলভাবে যোগ করা হয়েছে!");
        // Reset specific fields
        if (itemType === "SUBJECT") {
          setSubjectId("");
        } else if (itemType === "BREAK" || itemType === "CUSTOM") {
          setCustomTitle("");
        }
        router.refresh();
        setTimeout(() => setFormSuccess(null), 3000);
      }
    });
  };

  // Edit Item Handler
  const openEditModal = (item: ParsedRoutineItem) => {
    setEditingItem(item);
    setEditItemType(item.item_type);
    setEditDayOfWeek(item.day_of_week);
    setEditStartTime(item.start_time ? item.start_time.substring(0, 5) : "08:00");
    setEditEndTime(item.end_time ? item.end_time.substring(0, 5) : "09:00");
    setEditSubjectId(item.subject_id || "");
    setEditTeacherId(item.teacher_id || "");
    setEditCustomTitle(
      item.item_type !== "SUBJECT" ? item.display_title : ""
    );
    setEditRoomNumber(item.clean_room || "");
    setEditError(null);
  };

  const handleUpdateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setEditError(null);

    const formData = new FormData();
    formData.append("id", editingItem.id);
    formData.append("routine_type", selectedType);
    formData.append("day_of_week", editDayOfWeek);
    formData.append("item_type", editItemType);
    formData.append("start_time", editStartTime);
    formData.append("end_time", editEndTime);
    formData.append("subject_id", editSubjectId);
    formData.append("teacher_id", editTeacherId);
    formData.append("custom_title", editCustomTitle);
    formData.append("room_number", editRoomNumber);

    startTransition(async () => {
      const res = await updateRoutine(formData);
      if (res?.error) {
        setEditError(res.error);
      } else {
        setEditingItem(null);
        router.refresh();
      }
    });
  };

  // Delete Item Handler
  const handleDeleteItem = async (id: string, title: string) => {
    if (confirm(`আপনি কি "${title}" পিরিয়ডটি মুছে ফেলতে চান?`)) {
      startTransition(async () => {
        const res = await deleteRoutine(id);
        if (res?.error) {
          alert(res.error);
        } else {
          router.refresh();
        }
      });
    }
  };

  // Copy Day Routine Handler
  const handleCopySubmit = async () => {
    if (!selectedClassId) return;
    if (copyTargetDays.length === 0) {
      alert("অন্তত একটি গন্তব্য দিন নির্বাচন করুন।");
      return;
    }

    startTransition(async () => {
      const res = await copyDayRoutine({
        class_id: selectedClassId,
        routine_type: selectedType,
        from_day: copySourceDay,
        to_days: copyTargetDays,
        overwrite: copyOverwrite,
      });

      if (res?.error) {
        setCopyMessage(res.error);
      } else {
        setIsCopyModalOpen(false);
        alert(
          `সফলভাবে ${DAY_TRANSLATIONS[copySourceDay]} বারের রুটিন ${toBanglaNumber(
            copyTargetDays.length
          )} টি দিনে কপি করা হয়েছে!`
        );
        router.refresh();
      }
    });
  };

  // Set as Off-Day Handler
  const handleMarkDayAsOff = async (day: string) => {
    const defaultReason = day === "Friday" ? "সাপ্তাহিক জুমার ছুটি" : "ছুটির দিন";
    const note = prompt(`"${DAY_TRANSLATIONS[day]}" ছুটির দিনের বিবরণ দিন:`, defaultReason);
    if (note === null) return;

    const formData = new FormData();
    formData.append("class_id", selectedClassId);
    formData.append("routine_type", "OffDay");
    formData.append("day_of_week", day);
    formData.append("item_type", "OFFDAY");
    formData.append("start_time", "00:00");
    formData.append("end_time", "23:59");
    formData.append("custom_title", note || "সাপ্তাহিক ছুটি");

    startTransition(async () => {
      // Clear existing for this day first
      await clearDayRoutines({
        class_id: selectedClassId,
        routine_type: selectedType,
        day_of_week: day,
      });

      const res = await addRoutine(formData);
      if (res?.error) {
        alert(res.error);
      } else {
        router.refresh();
      }
    });
  };

  // Clear Day Routine
  const handleClearDay = async (day: string) => {
    if (confirm(`আপনি কি "${DAY_TRANSLATIONS[day]}" বারের সমস্ত রুটিন আইটেম মুছে ফেলতে চান?`)) {
      startTransition(async () => {
        const res = await clearDayRoutines({
          class_id: selectedClassId,
          routine_type: selectedType,
          day_of_week: day,
        });
        if (res?.error) {
          alert(res.error);
        } else {
          router.refresh();
        }
      });
    }
  };

  const activeDayRoutines = groupedRoutines[activeDay] || [];
  const isCurrentDayOff = activeDayRoutines.some((r) => r.item_type === "OFFDAY");

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Banner */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-2xl">
              <CalendarDays className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900">
                স্মার্ট রুটিন বিল্ডার (Routine Builder)
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                বিরতি, কাস্টম অ্যাক্টিভিটি, ১-ক্লিক রুটিন কপি এবং ছুটির দিনসহ পূর্ণাঙ্গ রুটিন তৈরি করুন
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setCopySourceDay(activeDay);
              setCopyMessage(null);
              setIsCopyModalOpen(true);
            }}
            className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition cursor-pointer shadow-2xs"
          >
            <Copy className="w-4 h-4" />
            <span>১-ক্লিকে রুটিন কপি করুন</span>
          </button>

          <Link
            href={`/dashboard/academic/routine?class_id=${selectedClassId}&type=${selectedType}`}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition shadow-xs"
          >
            <Eye className="w-4 h-4" />
            <span>প্রিন্ট ও ফুল ভিউ</span>
          </Link>
        </div>
      </div>

      {/* Class & Type Selector Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Class select */}
          <div className="flex items-center gap-2 flex-1 sm:flex-initial">
            <span className="text-xs font-bold text-slate-600 shrink-0">জামাত:</span>
            <select
              value={selectedClassId}
              onChange={(e) => handleFilterChange(e.target.value, selectedType)}
              className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs sm:text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Type Select */}
          <div className="flex items-center gap-2 flex-1 sm:flex-initial">
            <span className="text-xs font-bold text-slate-600 shrink-0">ধরন:</span>
            <select
              value={selectedType}
              onChange={(e) => handleFilterChange(selectedClassId, e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs sm:text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="Class">ক্লাস রুটিন (Class Routine)</option>
              <option value="Daily">দৈনিক / ২৪-ঘণ্টা আবাসিক রুটিন (Daily Routine)</option>
              <option value="Exam">পরীক্ষার রুটিন (Exam Routine)</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
          <span>
            বর্তমান জামাত: <strong className="text-slate-800">{currentClass?.name || "বাছাই করুন"}</strong>
          </span>
        </div>
      </div>

      {/* Weekday Tabs Bar */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-1.5 overflow-x-auto">
        {DAY_KEYS.map((day) => {
          const count = groupedRoutines[day]?.length || 0;
          const isOff = groupedRoutines[day]?.some((r) => r.item_type === "OFFDAY");
          const isActive = activeDay === day;

          return (
            <button
              key={day}
              type="button"
              onClick={() => setActiveDay(day)}
              className={`px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                isActive
                  ? "bg-indigo-600 text-white shadow-xs"
                  : isOff
                  ? "bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200"
                  : "bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200/60"
              }`}
            >
              <span>{DAY_TRANSLATIONS[day]}</span>
              {isOff ? (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold ${
                    isActive ? "bg-amber-400 text-slate-900" : "bg-amber-200 text-amber-900"
                  }`}
                >
                  ছুটি
                </span>
              ) : (
                <span
                  className={`text-[11px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                    isActive ? "bg-white/25 text-white" : "bg-slate-200/80 text-slate-700"
                  }`}
                >
                  {toBanglaNumber(count)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Grid: Form Left, Day Routine View Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Add New Period / Item Form */}
        <div className="lg:col-span-5 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
                <PlusCircle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  নতুন আইটেম / পিরিয়ড যুক্ত করুন
                </h2>
                <p className="text-xs text-slate-500">
                  দিন: <strong className="text-indigo-600">{DAY_TRANSLATIONS[activeDay]}</strong>
                </p>
              </div>
            </div>
          </div>

          {/* ITEM TYPE TOGGLE: 4 MODES */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              আইটেমের ধরন নির্বাচন করুন:
            </label>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-2xl">
              <button
                type="button"
                onClick={() => setItemType("SUBJECT")}
                className={`py-2 px-2 text-xs font-bold rounded-xl transition flex flex-col sm:flex-row items-center justify-center gap-1.5 cursor-pointer ${
                  itemType === "SUBJECT"
                    ? "bg-white text-indigo-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>পাঠ্য বিষয়</span>
              </button>

              <button
                type="button"
                onClick={() => setItemType("BREAK")}
                className={`py-2 px-2 text-xs font-bold rounded-xl transition flex flex-col sm:flex-row items-center justify-center gap-1.5 cursor-pointer ${
                  itemType === "BREAK"
                    ? "bg-white text-amber-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Coffee className="w-3.5 h-3.5 text-amber-600" />
                <span>বিরতি / খাবার</span>
              </button>

              <button
                type="button"
                onClick={() => setItemType("CUSTOM")}
                className={`py-2 px-2 text-xs font-bold rounded-xl transition flex flex-col sm:flex-row items-center justify-center gap-1.5 cursor-pointer ${
                  itemType === "CUSTOM"
                    ? "bg-white text-purple-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                <span>কাস্টম বিষয়</span>
              </button>
            </div>
          </div>

          <form onSubmit={handleAddItem} className="space-y-4">
            {formError && (
              <div className="p-3 bg-red-50 text-red-700 rounded-xl text-xs border border-red-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}
            {formSuccess && (
              <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-xs border border-emerald-200 flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" />
                <span>{formSuccess}</span>
              </div>
            )}

            {/* TIME INPUTS */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  শুরুর সময় (Start) *
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 font-mono text-sm font-semibold outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  শেষের সময় (End) *
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 font-mono text-sm font-semibold outline-none"
                />
              </div>
            </div>

            {/* QUICK TIME PRESETS */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-slate-500">কুইক টাইম স্লট:</span>
              </div>
              <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto p-1 bg-slate-50 rounded-xl border border-slate-200/60 text-[11px]">
                {timePresets.map((tp, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setStartTime(tp.start);
                      setEndTime(tp.end);
                    }}
                    className="px-2 py-1 bg-white hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 rounded-lg text-slate-700 font-medium transition cursor-pointer"
                  >
                    {tp.label}
                  </button>
                ))}
              </div>
            </div>

            {/* TYPE-SPECIFIC FIELDS */}
            {itemType === "SUBJECT" && (
              <div className="space-y-3 pt-1 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    বিষয় / কিতাব (Subject) *
                  </label>
                  <select
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm font-medium outline-none"
                  >
                    <option value="">-- বিষয় নির্বাচন করুন --</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.code ? `(${s.code})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    শিক্ষক / উস্তাদ (Teacher - ঐচ্ছিক)
                  </label>
                  <select
                    value={teacherId}
                    onChange={(e) => setTeacherId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm font-medium outline-none"
                  >
                    <option value="">-- শিক্ষক নির্বাচন করুন --</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.first_name} {t.last_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    রুম / ক্লাসরুম নম্বর (ঐচ্ছিক)
                  </label>
                  <input
                    type="text"
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                    placeholder="যেমন: ১০২ / দারুল উলূম হল"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm outline-none"
                  />
                </div>
              </div>
            )}

            {itemType === "BREAK" && (
              <div className="space-y-3 pt-1 border-t border-amber-100 bg-amber-50/40 p-3.5 rounded-2xl border">
                <div>
                  <label className="block text-xs font-bold text-amber-900 mb-1.5 flex items-center gap-1.5">
                    <Coffee className="w-4 h-4 text-amber-600" />
                    <span>প্রচলিত বিরতির নাম সিলেক্ট করুন অথবা লিখুন:</span>
                  </label>
                  <div className="flex flex-wrap gap-1.5 mb-2.5">
                    {COMMON_BREAKS.map((cb, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setCustomTitle(cb.label)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer border ${
                          customTitle === cb.label
                            ? "bg-amber-600 text-white border-amber-600"
                            : "bg-white text-amber-900 border-amber-200 hover:bg-amber-100"
                        }`}
                      >
                        {cb.label}
                      </button>
                    ))}
                  </div>

                  <input
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    required
                    placeholder="বিরতির নাম লিখুন (যেমন: নামাজের বিরতি)"
                    className="w-full px-3 py-2 border border-amber-300 rounded-xl bg-white focus:ring-2 focus:ring-amber-500 text-sm font-semibold outline-none text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-amber-900 mb-1">
                    স্থান / নোট (ঐচ্ছিক)
                  </label>
                  <input
                    type="text"
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                    placeholder="যেমন: মসজিদ / ডাইনিং হল"
                    className="w-full px-3 py-2 border border-amber-300 rounded-xl bg-white focus:ring-2 focus:ring-amber-500 text-sm outline-none"
                  />
                </div>
              </div>
            )}

            {itemType === "CUSTOM" && (
              <div className="space-y-3 pt-1 border-t border-purple-100 bg-purple-50/40 p-3.5 rounded-2xl border">
                <div>
                  <label className="block text-xs font-bold text-purple-900 mb-1.5 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-purple-600" />
                    <span>কাস্টম বিষয়ের তালিকা থেকে বাছাই করুন বা নাম লিখুন:</span>
                  </label>
                  <div className="flex flex-wrap gap-1.5 mb-2.5">
                    {COMMON_CUSTOM_ACTIVITIES.map((ca, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setCustomTitle(ca.label)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer border ${
                          customTitle === ca.label
                            ? "bg-purple-700 text-white border-purple-700"
                            : "bg-white text-purple-900 border-purple-200 hover:bg-purple-100"
                        }`}
                      >
                        {ca.label}
                      </button>
                    ))}
                  </div>

                  <input
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    required
                    placeholder="কাস্টম বিষয়ের নাম লিখুন (যেমন: খেলাধুলা / কায়লুলা / শয়ন)"
                    className="w-full px-3 py-2 border border-purple-300 rounded-xl bg-white focus:ring-2 focus:ring-purple-500 text-sm font-semibold outline-none text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-purple-900 mb-1">
                    স্থান / মাঠ / দায়িত্বশীল (ঐচ্ছিক)
                  </label>
                  <input
                    type="text"
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                    placeholder="যেমন: মাদরাসার মাঠ / শয়নকক্ষ"
                    className="w-full px-3 py-2 border border-purple-300 rounded-xl bg-white focus:ring-2 focus:ring-purple-500 text-sm outline-none"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl transition shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>সংরক্ষণ হচ্ছে...</span>
                </>
              ) : (
                <>
                  <PlusCircle className="w-4 h-4" />
                  <span>রুটিনে যুক্ত করুন</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* RIGHT COLUMN: Active Day Routine Cards & Manage Tools */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5">
            {/* Header for the Day */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-sm">
                  {DAY_TRANSLATIONS[activeDay].slice(0, 2)}
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <span>{DAY_TRANSLATIONS[activeDay]} বারের রুটিন</span>
                    {isCurrentDayOff && (
                      <span className="px-2.5 py-0.5 bg-rose-100 text-rose-700 text-xs rounded-full font-bold">
                        ছুটির দিন (Off Day)
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-slate-500">
                    জামাত: <strong className="text-slate-700">{currentClass?.name}</strong> • মোট আইটেম:{" "}
                    <strong>{toBanglaNumber(activeDayRoutines.length)}</strong> টি
                  </p>
                </div>
              </div>

              {/* Day Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleMarkDayAsOff(activeDay)}
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                  title="এই দিনটিকে ছুটির দিন ঘোষণা করুন"
                >
                  <Sun className="w-3.5 h-3.5" />
                  <span>ছুটির দিন (Off Day) সেট</span>
                </button>

                {activeDayRoutines.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleClearDay(activeDay)}
                    className="px-2.5 py-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold transition cursor-pointer"
                    title="দিনের সকল আইটেম মুছুন"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* ROUTINE ITEMS LIST FOR THE DAY */}
            {activeDayRoutines.length > 0 ? (
              <div className="space-y-3">
                {activeDayRoutines.map((item, idx) => {
                  const startTimeFmt = formatTimeString(item.start_time);
                  const endTimeFmt = formatTimeString(item.end_time);

                  if (item.item_type === "OFFDAY") {
                    return (
                      <div
                        key={item.id}
                        className="bg-rose-50/80 border border-rose-200 rounded-2xl p-4 flex items-center justify-between gap-3 text-rose-900"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-rose-100 text-rose-700 rounded-xl">
                            <Sun className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="font-bold text-sm text-rose-950 flex items-center gap-2">
                              <span>{item.display_title || "সাপ্তাহিক ছুটি"}</span>
                              <span className="text-[10px] bg-rose-200 text-rose-900 font-bold px-2 py-0.5 rounded-full">
                                OFF-DAY
                              </span>
                            </div>
                            <p className="text-xs text-rose-700 mt-0.5">
                              এই দিনে কোনো নির্ধারিত ক্লাস বা পরীক্ষার পিরিয়ড নেই।
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteItem(item.id, item.display_title)}
                          className="p-2 text-rose-500 hover:bg-rose-100 rounded-xl transition cursor-pointer"
                          title="ছুটি বাতিল করে সাধারণ ক্লাসে ফিরুন"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  }

                  if (item.item_type === "BREAK") {
                    return (
                      <div
                        key={item.id}
                        className="bg-amber-50/70 border border-amber-200/90 rounded-2xl p-3.5 flex items-center justify-between gap-3 hover:bg-amber-100/50 transition group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="bg-amber-200 text-amber-900 font-mono font-bold text-xs px-2.5 py-1.5 rounded-xl shrink-0">
                            {startTimeFmt} - {endTimeFmt}
                          </div>
                          <div className="p-2 bg-amber-100 text-amber-800 rounded-xl shrink-0">
                            <Coffee className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-sm text-amber-950 flex items-center gap-2">
                              <span className="truncate">{item.display_title}</span>
                              <span className="text-[10px] bg-amber-200/80 text-amber-900 font-bold px-1.5 py-0.2 rounded-md">
                                বিরতি
                              </span>
                            </div>
                            {item.clean_room && (
                              <div className="text-xs text-amber-800/80 flex items-center gap-1 mt-0.5">
                                <MapPin className="w-3 h-3" />
                                <span>{item.clean_room}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => openEditModal(item)}
                            className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-xl transition cursor-pointer"
                            title="সম্পাদনা করুন"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(item.id, item.display_title)}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-white rounded-xl transition cursor-pointer"
                            title="মুছে ফেলুন"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  }

                  if (item.item_type === "CUSTOM") {
                    return (
                      <div
                        key={item.id}
                        className="bg-purple-50/70 border border-purple-200/90 rounded-2xl p-3.5 flex items-center justify-between gap-3 hover:bg-purple-100/50 transition group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="bg-purple-200 text-purple-900 font-mono font-bold text-xs px-2.5 py-1.5 rounded-xl shrink-0">
                            {startTimeFmt} - {endTimeFmt}
                          </div>
                          <div className="p-2 bg-purple-100 text-purple-800 rounded-xl shrink-0">
                            <Sparkles className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-sm text-purple-950 flex items-center gap-2">
                              <span className="truncate">{item.display_title}</span>
                              <span className="text-[10px] bg-purple-200 text-purple-900 font-bold px-1.5 py-0.2 rounded-md">
                                কার্যক্রম
                              </span>
                            </div>
                            {item.clean_room && (
                              <div className="text-xs text-purple-800/80 flex items-center gap-1 mt-0.5">
                                <MapPin className="w-3 h-3" />
                                <span>{item.clean_room}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => openEditModal(item)}
                            className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-xl transition cursor-pointer"
                            title="সম্পাদনা করুন"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(item.id, item.display_title)}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-white rounded-xl transition cursor-pointer"
                            title="মুছে ফেলুন"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  }

                  // Default: SUBJECT
                  return (
                    <div
                      key={item.id}
                      className="bg-white border border-slate-200 rounded-2xl p-3.5 flex items-center justify-between gap-3 hover:border-indigo-200 hover:shadow-xs transition group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="bg-indigo-50 border border-indigo-100 text-indigo-700 font-mono font-bold text-xs px-2.5 py-1.5 rounded-xl shrink-0">
                          {startTimeFmt} - {endTimeFmt}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-sm text-slate-900 flex items-center gap-2">
                            <span className="truncate">{item.display_title}</span>
                          </div>
                          <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
                            {item.display_subtitle ? (
                              <span className="flex items-center gap-1 text-slate-600">
                                <User className="w-3 h-3 text-slate-400" />
                                <span>{item.display_subtitle}</span>
                              </span>
                            ) : (
                              <span className="text-slate-400">উস্তাদ নির্ধারিত নয়</span>
                            )}
                            {item.clean_room && (
                              <span className="flex items-center gap-1 text-slate-600">
                                <MapPin className="w-3 h-3 text-slate-400" />
                                <span>রুম: {item.clean_room}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => openEditModal(item)}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition cursor-pointer"
                          title="সম্পাদনা করুন"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(item.id, item.display_title)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                          title="মুছে ফেলুন"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 border-2 border-dashed rounded-3xl border-slate-200 space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <CalendarDays className="w-6 h-6" />
                </div>
                <p className="font-bold text-slate-700 text-sm">
                  {DAY_TRANSLATIONS[activeDay]} বারে এখনও কোনো পিরিয়ড যোগ করা হয়নি
                </p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  বামপাশের ফর্ম ব্যবহার করে পাঠ্য বিষয়, বিরতি বা কাস্টম অ্যাক্টিভিটি যোগ করুন অথবা ১-ক্লিকে অন্য দিনের রুটিন কপি করুন।
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 1-CLICK COPY ROUTINE MODAL */}
      {isCopyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-2xl">
                  <Copy className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900">
                    ১-ক্লিকে এক দিনের রুটিন অন্য দিনে কপি করুন
                  </h2>
                  <p className="text-xs text-slate-500">
                    জামাত: <strong className="text-slate-700">{currentClass?.name}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCopyModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {copyMessage && (
              <div className="p-3 bg-red-50 text-red-700 rounded-2xl text-xs border border-red-200">
                {copyMessage}
              </div>
            )}

            <div className="space-y-4 text-xs">
              {/* Source Day */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  যে দিনের রুটিন কপি করতে চান (Source Day):
                </label>
                <select
                  value={copySourceDay}
                  onChange={(e) => setCopySourceDay(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold text-slate-800 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {DAY_KEYS.map((day) => (
                    <option key={day} value={day}>
                      {DAY_TRANSLATIONS[day]} ({toBanglaNumber(groupedRoutines[day]?.length || 0)} টি আইটেম)
                    </option>
                  ))}
                </select>
              </div>

              {/* Target Days */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="font-bold text-slate-700">
                    যেসব দিনে পেস্ট / ডুপ্লিকেট হবে (Target Days):
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setCopyTargetDays(
                          DAY_KEYS.filter((d) => d !== copySourceDay && d !== "Friday")
                        )
                      }
                      className="text-indigo-600 font-bold hover:underline"
                    >
                      রবি-বৃহস্পতি সব
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() =>
                        setCopyTargetDays(DAY_KEYS.filter((d) => d !== copySourceDay))
                      }
                      className="text-indigo-600 font-bold hover:underline"
                    >
                      সব দিন
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {DAY_KEYS.map((day) => {
                    const isSrc = day === copySourceDay;
                    const isChecked = copyTargetDays.includes(day);

                    return (
                      <label
                        key={day}
                        className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer transition ${
                          isSrc
                            ? "bg-slate-100 border-slate-200 opacity-50 cursor-not-allowed"
                            : isChecked
                            ? "bg-indigo-50 border-indigo-300 text-indigo-900 font-bold"
                            : "bg-white border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          disabled={isSrc}
                          checked={isChecked && !isSrc}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setCopyTargetDays([...copyTargetDays, day]);
                            } else {
                              setCopyTargetDays(copyTargetDays.filter((d) => d !== day));
                            }
                          }}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>{DAY_TRANSLATIONS[day]}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Overwrite toggle */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-800 block">পূর্বের রুটিন মুছে প্রতিস্থাপন করুন</span>
                  <span className="text-[11px] text-slate-500">
                    টার্গেট দিনগুলোতে আগে থেকে থাকা রুটিন মুছে নতুন কপি প্রতিস্থাপিত হবে
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={copyOverwrite}
                  onChange={(e) => setCopyOverwrite(e.target.checked)}
                  className="rounded text-indigo-600 w-4 h-4 cursor-pointer"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsCopyModalOpen(false)}
                className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition text-xs"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={handleCopySubmit}
                disabled={isPending}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>কপি হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>কপি নিশ্চিত করুন</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT ITEM MODAL */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
                  <Edit className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-black text-slate-900">পিরিয়ড / আইটেম সম্পাদনা</h2>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateItem} className="space-y-4 text-xs">
              {editError && (
                <div className="p-3 bg-red-50 text-red-700 rounded-xl text-xs border border-red-200">
                  {editError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">বার (Day)</label>
                  <select
                    value={editDayOfWeek}
                    onChange={(e) => setEditDayOfWeek(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl font-bold"
                  >
                    {DAY_KEYS.map((day) => (
                      <option key={day} value={day}>
                        {DAY_TRANSLATIONS[day]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">ধরন (Type)</label>
                  <select
                    value={editItemType}
                    onChange={(e) => setEditItemType(e.target.value as RoutineItemType)}
                    className="w-full px-3 py-2 border rounded-xl font-bold"
                  >
                    <option value="SUBJECT">পাঠ্য বিষয় (Subject)</option>
                    <option value="BREAK">বিরতি / খাবার (Break)</option>
                    <option value="CUSTOM">কাস্টম কার্যক্রম (Custom Activity)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">শুরুর সময়</label>
                  <input
                    type="time"
                    value={editStartTime}
                    onChange={(e) => setEditStartTime(e.target.value)}
                    required
                    className="w-full px-3 py-2 border rounded-xl font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">শেষের সময়</label>
                  <input
                    type="time"
                    value={editEndTime}
                    onChange={(e) => setEditEndTime(e.target.value)}
                    required
                    className="w-full px-3 py-2 border rounded-xl font-mono font-bold"
                  />
                </div>
              </div>

              {editItemType === "SUBJECT" ? (
                <>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">বিষয় / কিতাব *</label>
                    <select
                      value={editSubjectId}
                      onChange={(e) => setEditSubjectId(e.target.value)}
                      required
                      className="w-full px-3 py-2 border rounded-xl"
                    >
                      <option value="">-- বিষয় নির্বাচন করুন --</option>
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">উস্তাদ / শিক্ষক</label>
                    <select
                      value={editTeacherId}
                      onChange={(e) => setEditTeacherId(e.target.value)}
                      className="w-full px-3 py-2 border rounded-xl"
                    >
                      <option value="">-- শিক্ষক নির্বাচন করুন --</option>
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.first_name} {t.last_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              ) : (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {editItemType === "BREAK" ? "বিরতির নাম" : "কাস্টম বিষয়ের নাম"} *
                  </label>
                  <input
                    type="text"
                    value={editCustomTitle}
                    onChange={(e) => setEditCustomTitle(e.target.value)}
                    required
                    className="w-full px-3 py-2 border rounded-xl font-bold"
                  />
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">রুম / স্থান (ঐচ্ছিক)</label>
                <input
                  type="text"
                  value={editRoomNumber}
                  onChange={(e) => setEditRoomNumber(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl font-bold transition shadow-xs cursor-pointer"
                >
                  {isPending ? "সংরক্ষণ হচ্ছে..." : "পরিবর্তন সংরক্ষণ করুন"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
