"use client";

import { useState } from "react";
import { AcademicSession } from "@/lib/sessions";
import { FeeType, HIJRI_MONTHS, GREGORIAN_MONTHS, FeeCategory, FeeFrequency } from "@/lib/fee-management";
import { generateMonthlyFees, saveFeeType, deleteFeeType } from "@/app/actions/fee-management";
import {
  Calendar,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  ArrowRight,
  ShieldCheck,
  Plus,
  Edit2,
  Trash2,
  X,
  RotateCcw,
  Sliders,
  DollarSign,
  Info,
  Check,
  Users,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface GenerateClientProps {
  sessions: AcademicSession[];
  classes: any[];
  feeTypes: FeeType[];
}

export default function GenerateClient({
  sessions = [],
  classes = [],
  feeTypes: initialFeeTypes = [],
}: GenerateClientProps) {
  const router = useRouter();
  const currentYear = new Date().getFullYear();
  const currentMonthIdx = new Date().getMonth();

  const [feeTypesList, setFeeTypesList] = useState<FeeType[]>(initialFeeTypes);
  const [sessionId, setSessionId] = useState<string>(
    sessions?.find((s) => s.is_current)?.id || sessions?.[0]?.id || ""
  );
  const [calendarType, setCalendarType] = useState<"HIJRI" | "GREGORIAN">("GREGORIAN");
  const [monthName, setMonthName] = useState<string>(
    GREGORIAN_MONTHS[currentMonthIdx]?.name || GREGORIAN_MONTHS[0]?.name || "জানুয়ারি (January)"
  );
  const [year, setYear] = useState<string>(currentYear.toString());
  const [classId, setClassId] = useState<string>("ALL");

  // Selected Fee Types
  const [selectedFeeTypeIds, setSelectedFeeTypeIds] = useState<string[]>(
    (initialFeeTypes || [])
      .filter((f) => f.frequency === "MONTHLY" || f.code === "MONTHLY")
      .map((f) => f.id)
  );

  // Custom amounts map { [feeTypeId: string]: number }
  const [customAmounts, setCustomAmounts] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    initialFeeTypes.forEach((ft) => {
      initial[ft.id] = ft.default_amount || 0;
    });
    return initial;
  });

  const [forceUpdate, setForceUpdate] = useState(false);
  const [dueDate, setDueDate] = useState<string>(
    new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success?: boolean;
    generatedCount?: number;
    skippedCount?: number;
    updatedCount?: number;
    message?: string;
    error?: string;
  } | null>(null);

  // Modal State for Add / Edit Fee Type
  const [showFeeTypeModal, setShowFeeTypeModal] = useState(false);
  const [modalMode, setModalMode] = useState<"ADD" | "EDIT">("ADD");
  const [editingFeeType, setEditingFeeType] = useState<Partial<FeeType>>({
    name: "",
    code: "",
    category: "ACADEMIC",
    frequency: "MONTHLY",
    default_amount: 500,
    is_active: true,
  });
  const [savingFeeType, setSavingFeeType] = useState(false);

  const handleToggleFeeType = (id: string) => {
    if (selectedFeeTypeIds.includes(id)) {
      setSelectedFeeTypeIds(selectedFeeTypeIds.filter((item) => item !== id));
    } else {
      setSelectedFeeTypeIds([...selectedFeeTypeIds, id]);
    }
  };

  const handleSelectAll = () => {
    setSelectedFeeTypeIds(feeTypesList.map((f) => f.id));
  };

  const handleSelectMonthlyOnly = () => {
    setSelectedFeeTypeIds(
      feeTypesList
        .filter((f) => f.frequency === "MONTHLY" || f.code === "MONTHLY")
        .map((f) => f.id)
    );
  };

  const handleDeselectAll = () => {
    setSelectedFeeTypeIds([]);
  };

  const handleAmountChange = (id: string, value: number) => {
    setCustomAmounts((prev) => ({
      ...prev,
      [id]: Math.max(0, value),
    }));
  };

  const handleAmountAdjust = (id: string, delta: number) => {
    const current = customAmounts[id] ?? feeTypesList.find((f) => f.id === id)?.default_amount ?? 0;
    handleAmountChange(id, current + delta);
  };

  const handleAmountReset = (id: string) => {
    const defaultAmt = feeTypesList.find((f) => f.id === id)?.default_amount ?? 0;
    handleAmountChange(id, defaultAmt);
  };

  // Calculate total projected per student
  const totalPerStudent = selectedFeeTypeIds.reduce((sum, id) => {
    const amt = customAmounts[id] ?? feeTypesList.find((f) => f.id === id)?.default_amount ?? 0;
    return sum + (Number(amt) || 0);
  }, 0);

  // Open Modal to Add
  const openAddModal = () => {
    setModalMode("ADD");
    setEditingFeeType({
      name: "",
      code: `FEE_${Date.now().toString().slice(-4)}`,
      category: "ACADEMIC",
      frequency: "MONTHLY",
      default_amount: 500,
      is_active: true,
    });
    setShowFeeTypeModal(true);
  };

  // Open Modal to Edit
  const openEditModal = (ft: FeeType, e: React.MouseEvent) => {
    e.stopPropagation();
    setModalMode("EDIT");
    setEditingFeeType({ ...ft });
    setShowFeeTypeModal(true);
  };

  // Delete Fee Type
  const handleDeleteFeeType = async (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`আপনি কি নিশ্চিত যে "${name}" ফি খাতটি মুছে ফেলতে চান?`)) return;

    try {
      const res = await deleteFeeType(id);
      if (res?.success) {
        setFeeTypesList((prev) => prev.filter((f) => f.id !== id));
        setSelectedFeeTypeIds((prev) => prev.filter((item) => item !== id));
      } else {
        alert(res?.error || "মুছে ফেলা সম্ভব হয়নি।");
      }
    } catch (err) {
      console.error("deleteFeeType failed:", err);
      alert("একটি অপ্রত্যাশিত সমস্যা হয়েছে। সম্ভবত নতুন আপডেট ডিপ্লয় হয়েছে — অনুগ্রহ করে পেজ রিফ্রেশ করে আবার চেষ্টা করুন।");
    }
  };

  // Save Fee Type (Add / Edit)
  const handleSaveFeeTypeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFeeType.name?.trim()) {
      alert("ফি খাতের নাম লিখুন।");
      return;
    }

    setSavingFeeType(true);
    try {
      const res = await saveFeeType(editingFeeType);

      if (res?.success) {
        setShowFeeTypeModal(false);
        // Update local state
        if (modalMode === "ADD") {
          const newId = `ft_${Date.now()}`;
          const newObj: FeeType = {
            id: newId,
            name: editingFeeType.name,
            code: editingFeeType.code || "CUSTOM",
            category: (editingFeeType.category as FeeCategory) || "OTHER",
            frequency: (editingFeeType.frequency as FeeFrequency) || "MONTHLY",
            default_amount: Number(editingFeeType.default_amount) || 0,
            is_active: true,
          };
          setFeeTypesList((prev) => [...prev, newObj]);
          setSelectedFeeTypeIds((prev) => [...prev, newId]);
          setCustomAmounts((prev) => ({ ...prev, [newId]: newObj.default_amount }));
        } else {
          setFeeTypesList((prev) =>
            prev.map((f) => (f.id === editingFeeType.id ? ({ ...f, ...editingFeeType } as FeeType) : f))
          );
          if (editingFeeType.id) {
            setCustomAmounts((prev) => ({
              ...prev,
              [editingFeeType.id!]: Number(editingFeeType.default_amount) || 0,
            }));
          }
        }
        router.refresh();
      } else {
        alert(res?.error || "সংরক্ষণ ব্যর্থ হয়েছে।");
      }
    } catch (err) {
      console.error("saveFeeType failed:", err);
      alert("একটি অপ্রত্যাশিত সমস্যা হয়েছে। সম্ভবত নতুন আপডেট ডিপ্লয় হয়েছে — অনুগ্রহ করে পেজ রিফ্রেশ করে আবার চেষ্টা করুন।");
    } finally {
      setSavingFeeType(false);
    }
  };

  // Generate Fees Submit
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId) {
      alert("অনুগ্রহ করে একটি শিক্ষাবর্ষ নির্বাচন করুন।");
      return;
    }

    if (selectedFeeTypeIds.length === 0) {
      alert("অন্তত একটি ফি'র খাত নির্বাচন করুন।");
      return;
    }

    setLoading(true);
    setResult(null);

    const billingPeriod = `${monthName} ${year}`;

    try {
      let res: any = null;
      try {
        const apiRes = await fetch("/api/fees/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            billingPeriod,
            monthName,
            year,
            classId,
            feeTypeIds: selectedFeeTypeIds,
            customAmounts,
            forceUpdate,
            dueDate,
          }),
        });
        if (apiRes.ok) {
          res = await apiRes.json();
        }
      } catch (e) {
        console.warn("API /api/fees/generate failed, falling back to server action", e);
      }

      if (!res) {
        res = await generateMonthlyFees({
          sessionId,
          billingPeriod,
          monthName,
          year,
          classId,
          feeTypeIds: selectedFeeTypeIds,
          customAmounts,
          forceUpdate,
          dueDate,
        });
      }

      setResult(res);

      if (res?.success) {
        router.refresh();
      }
    } catch (err: any) {
      console.error("generateMonthlyFees failed:", err);
      setResult({
        success: false,
        error: err?.message || "ফি জেনারেট সম্পন্ন করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Result Notification Card */}
      {result && (
        <div
          className={`p-5 rounded-2xl border shadow-xs animate-in fade-in duration-200 ${
            result.success
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-red-50 border-red-200 text-red-900"
          }`}
        >
          <div className="flex items-start gap-3">
            {result.success ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1 flex-1">
              <h3 className="font-bold text-base">
                {result.success ? "ফি জেনারেট সফল হয়েছে!" : "ত্রুটি ঘটেছে"}
              </h3>
              <p className="text-xs sm:text-sm font-medium">{result.message || result.error}</p>

              {result.success && (
                <div className="flex flex-wrap items-center gap-3 pt-3">
                  <Link
                    href="/dashboard/accounting/due"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition shadow-xs"
                  >
                    <span>বকেয়া তালিকা দেখুন</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>

                  <Link
                    href="/dashboard/accounting/fees/new"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-white text-slate-800 border border-slate-300 rounded-xl text-xs font-bold hover:bg-slate-50 transition shadow-xs"
                  >
                    <span>ফি আদায় করুন</span>
                  </Link>

                  <Link
                    href="/dashboard/accounting"
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 transition"
                  >
                    <span>হিসাব ড্যাশবোর্ড</span>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Generator Card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5 sm:p-7 space-y-6">
        <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
                <Sparkles className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">মাসিক চার্জ ও ইনভয়েস কনফিগারেশন</h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              নির্ধারিত শিক্ষাবর্ষ ও জামাতের সকল শিক্ষার্থীর অ্যাকাউন্টে স্বয়ংক্রিয়ভাবে উক্ত মাসের ইনভয়েস যুক্ত হবে।
            </p>
          </div>

          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer shrink-0 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            <span>+ নতুন ফি খাত যোগ করুন</span>
          </button>
        </div>

        <form onSubmit={handleGenerate} className="space-y-6 text-xs sm:text-sm">
          {/* Top Form Controls Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Session */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span>শিক্ষাবর্ষ (Session)</span> <span className="text-red-500">*</span>
              </label>
              <select
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white font-medium text-xs sm:text-sm"
              >
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.academic_year}) {s.is_current ? "⭐ বর্তমান" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Target Class */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-slate-400" />
                <span>টার্গেট জামাত / শ্রেণি</span> <span className="text-red-500">*</span>
              </label>
              <select
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white font-medium text-xs sm:text-sm"
              >
                <option value="ALL">সকল জামাত (All Classes)</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Due Date */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-slate-400" />
                <span>পরিশোধের শেষ তারিখ (Due Date)</span>
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white font-medium text-xs sm:text-sm"
              />
            </div>

            {/* Calendar Mode Toggle */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700">ক্যালেন্ডার মোড</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCalendarType("GREGORIAN");
                    setMonthName(GREGORIAN_MONTHS[currentMonthIdx]?.name || "জানুয়ারি (January)");
                  }}
                  className={`flex-1 py-2 rounded-xl font-bold text-xs transition cursor-pointer border ${
                    calendarType === "GREGORIAN"
                      ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  ইংরেজি
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCalendarType("HIJRI");
                    setMonthName(HIJRI_MONTHS[0]?.name || "মুহাররম (Muharram)");
                  }}
                  className={`flex-1 py-2 rounded-xl font-bold text-xs transition cursor-pointer border ${
                    calendarType === "HIJRI"
                      ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  হিজরি
                </button>
              </div>
            </div>

            {/* Month Name */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700">
                মাসের নাম <span className="text-red-500">*</span>
              </label>
              <select
                value={monthName}
                onChange={(e) => setMonthName(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white font-medium text-xs sm:text-sm"
              >
                {calendarType === "GREGORIAN"
                  ? GREGORIAN_MONTHS.map((m) => (
                      <option key={m.id} value={m.name}>
                        {m.name}
                      </option>
                    ))
                  : HIJRI_MONTHS.map((m) => (
                      <option key={m.id} value={m.name}>
                        {m.name}
                      </option>
                    ))}
              </select>
            </div>

            {/* Year */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700">সন / বছর</label>
              <input
                type="text"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="2026 বা 1447"
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white font-medium text-xs sm:text-sm"
              />
            </div>
          </div>

          {/* Fee Items Section with Quick Selectors and Inline Amount Edit */}
          <div className="space-y-3 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
              <div>
                <label className="font-bold text-slate-900 text-sm block">
                  ফি'র খাত নির্বাচন ও টাকার পরিমাণ নির্ধারণ:
                </label>
                <span className="text-slate-500 text-[11px]">
                  প্রয়োজনে নিচে সরাসরি টাকার পরিমাণ এডিট করতে পারবেন।
                </span>
              </div>

              {/* Quick Select Buttons */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={handleSelectMonthlyOnly}
                  className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-[11px] font-bold hover:bg-emerald-100 transition cursor-pointer"
                >
                  মাসিক ফিসমূহ
                </button>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="px-2.5 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[11px] font-bold hover:bg-slate-200 transition cursor-pointer"
                >
                  সব নির্বাচন
                </button>
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="px-2.5 py-1 bg-slate-50 text-slate-500 border border-slate-200 rounded-lg text-[11px] font-medium hover:bg-slate-100 transition cursor-pointer"
                >
                  ক্লিয়ার
                </button>
              </div>
            </div>

            {/* Fee Items Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {feeTypesList.map((ft) => {
                const isSelected = selectedFeeTypeIds.includes(ft.id);
                const currentAmount =
                  customAmounts[ft.id] !== undefined ? customAmounts[ft.id] : ft.default_amount || 0;
                const isModified = currentAmount !== ft.default_amount;

                return (
                  <div
                    key={ft.id}
                    className={`p-4 rounded-2xl border transition relative ${
                      isSelected
                        ? "bg-emerald-50/50 border-emerald-300 ring-1 ring-emerald-300 shadow-2xs"
                        : "bg-slate-50/40 border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      {/* Checkbox & Name */}
                      <label
                        className="flex items-start gap-3 cursor-pointer flex-1 select-none"
                        onClick={() => handleToggleFeeType(ft.id)}
                      >
                        <div
                          className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition ${
                            isSelected
                              ? "bg-emerald-600 border-emerald-600 text-white"
                              : "border-slate-300 bg-white"
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                        <div className="space-y-0.5 flex-1">
                          <span
                            className={`font-bold text-xs sm:text-sm block ${
                              isSelected ? "text-slate-900" : "text-slate-700"
                            }`}
                          >
                            {ft.name}
                          </span>
                          <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-500">
                            <span className="bg-slate-200/60 px-1.5 py-0.5 rounded text-[10px] font-mono">
                              {ft.frequency === "MONTHLY"
                                ? "মাসিক"
                                : ft.frequency === "ONETIME"
                                ? "এককালীন"
                                : ft.frequency === "TERM"
                                ? "সাময়িক"
                                : "বার্ষিক"}
                            </span>
                            <span>ডিফল্ট: ৳{ft.default_amount}</span>
                          </div>
                        </div>
                      </label>

                      {/* Edit / Delete Buttons */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => openEditModal(ft, e)}
                          title="ফি খাত সম্পাদনা"
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white rounded-lg transition border border-transparent hover:border-slate-200 cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {!ft.is_system && (
                          <button
                            type="button"
                            onClick={(e) => handleDeleteFeeType(ft.id, ft.name, e)}
                            title="মুছে ফেলুন"
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-white rounded-lg transition border border-transparent hover:border-red-100 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Inline Amount Customizer (shown when selected) */}
                    {isSelected && (
                      <div className="mt-3 pt-2.5 border-t border-emerald-200/70 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-xs text-slate-700 font-bold">
                          <span>ধার্যকৃত পরিমাণ:</span>
                          {isModified && (
                            <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-normal">
                              কাস্টম
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleAmountAdjust(ft.id, -100)}
                            className="w-6 h-6 rounded-md bg-white border border-slate-300 text-slate-700 font-bold flex items-center justify-center hover:bg-slate-100 text-xs cursor-pointer shadow-2xs"
                          >
                            -
                          </button>

                          <div className="relative">
                            <span className="absolute left-2 top-1.5 text-slate-400 text-xs">৳</span>
                            <input
                              type="number"
                              min="0"
                              step="50"
                              value={currentAmount}
                              onChange={(e) => handleAmountChange(ft.id, Number(e.target.value))}
                              className="w-24 pl-5 pr-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 font-mono text-right"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => handleAmountAdjust(ft.id, 100)}
                            className="w-6 h-6 rounded-md bg-white border border-slate-300 text-slate-700 font-bold flex items-center justify-center hover:bg-slate-100 text-xs cursor-pointer shadow-2xs"
                          >
                            +
                          </button>

                          {isModified && (
                            <button
                              type="button"
                              onClick={() => handleAmountReset(ft.id)}
                              title="ডিফল্ট পরিমাণে রিসেট করুন"
                              className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Realtime Summary & Force Update Option */}
          <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs sm:text-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-slate-400 text-[11px]">শিক্ষার্থী প্রতি মোট ধার্যকৃত অংক:</div>
                  <div className="text-xl font-black text-emerald-400 font-mono">
                    ৳{totalPerStudent.toLocaleString("bn-BD")}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs font-medium text-slate-300">
                <div>
                  নির্বাচিত খাত: <strong className="text-white">{selectedFeeTypeIds.length}</strong> টি
                </div>
                <div>
                  টার্গেট: <strong className="text-white">{classId === "ALL" ? "সকল জামাত" : "নির্দিষ্ট জামাত"}</strong>
                </div>
              </div>
            </div>

            {/* Force Overwrite Checkbox */}
            <div className="pt-2 border-t border-slate-800">
              <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={forceUpdate}
                  onChange={(e) => setForceUpdate(e.target.checked)}
                  className="rounded border-slate-700 text-emerald-600 focus:ring-emerald-500 mt-0.5"
                />
                <span>
                  <strong>ফোর্স আপডেট (Force Update):</strong> পূর্বে জেনারেট হয়ে থাকা অপরিশোধিত ইনভয়েসে সংশোধিত টাকার পরিমাণ ও নতুন ফি খাত স্বয়ংক্রিয়ভাবে আপডেট করুন।
                </span>
              </label>
            </div>
          </div>

          {/* Safety Guard Note */}
          <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-200/70 flex items-center gap-3 text-xs text-emerald-950">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>
              <strong>স্মার্ট সিকিউরিটি গার্ড:</strong> ইতিপূর্বে ফি পরিশোধ করে থাকলে কোনো ক্ষতি হবে না। শুধুমাত্র অপরিশোধিত বা নতুন ইনভয়েস যুক্ত হবে।
            </span>
          </div>

          {/* Submit Action Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || selectedFeeTypeIds.length === 0}
              className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold shadow-md hover:shadow-lg transition flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 text-sm active:scale-99"
            >
              {loading ? (
                <div className="flex items-center gap-2 text-emerald-400">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>ফি ইনভয়েস তৈরি হচ্ছে, অনুগ্রহ করে অপেক্ষা করুন...</span>
                </div>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 text-emerald-400" />
                  <span>{monthName} {year} - ফি ইনভয়েস জেনারেট করুন</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Add / Edit Fee Type Modal */}
      {showFeeTypeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900">
                {modalMode === "ADD" ? "+ নতুন ফি খাত যোগ করুন" : "ফি খাত সম্পাদনা করুন"}
              </h3>
              <button
                type="button"
                onClick={() => setShowFeeTypeModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveFeeTypeSubmit} className="space-y-4 text-xs sm:text-sm">
              {/* Fee Name */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700">
                  ফি'র নাম <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="যেমন: পিকনিক ফি বা বিদ্যুৎ ফি"
                  value={editingFeeType.name || ""}
                  onChange={(e) => setEditingFeeType({ ...editingFeeType, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 font-medium"
                />
              </div>

              {/* Default Amount */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700">
                  ডিফল্ট টাকার পরিমাণ (৳) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  placeholder="যেমন: 500"
                  value={editingFeeType.default_amount || ""}
                  onChange={(e) =>
                    setEditingFeeType({
                      ...editingFeeType,
                      default_amount: Number(e.target.value),
                    })
                  }
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 font-medium"
                />
              </div>

              {/* Frequency */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700">ধার্যের ধরন (Frequency)</label>
                <select
                  value={editingFeeType.frequency || "MONTHLY"}
                  onChange={(e) =>
                    setEditingFeeType({
                      ...editingFeeType,
                      frequency: e.target.value as FeeFrequency,
                    })
                  }
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 font-medium bg-white"
                >
                  <option value="MONTHLY">মাসিক (Monthly)</option>
                  <option value="ONETIME">এককালীন (One-time)</option>
                  <option value="TERM">সাময়িক / পরীক্ষা (Term)</option>
                  <option value="YEARLY">বার্ষিক (Yearly)</option>
                </select>
              </div>

              {/* Category */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700">বিভাগ / ক্যাটাগরি</label>
                <select
                  value={editingFeeType.category || "ACADEMIC"}
                  onChange={(e) =>
                    setEditingFeeType({
                      ...editingFeeType,
                      category: e.target.value as FeeCategory,
                    })
                  }
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 font-medium bg-white"
                >
                  <option value="ACADEMIC">একাডেমিক / শিক্ষা</option>
                  <option value="BOARDING">বোর্ডিং ও খাবার</option>
                  <option value="ADMINISTRATIVE">প্রশাসনিক</option>
                  <option value="OTHER">অন্যান্য / বিবিধ</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowFeeTypeModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold transition"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={savingFeeType}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold transition shadow-xs disabled:opacity-50"
                >
                  {savingFeeType ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ করুন"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
