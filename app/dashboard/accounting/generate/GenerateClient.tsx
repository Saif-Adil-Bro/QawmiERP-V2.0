"use client";

import { useState } from "react";
import { AcademicSession } from "@/lib/sessions";
import { FeeType, HIJRI_MONTHS, GREGORIAN_MONTHS } from "@/lib/fee-management";
import { generateMonthlyFees } from "@/app/actions/fee-management";
import {
  Calendar,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";

interface GenerateClientProps {
  sessions: AcademicSession[];
  classes: any[];
  feeTypes: FeeType[];
}

export default function GenerateClient({
  sessions = [],
  classes = [],
  feeTypes = [],
}: GenerateClientProps) {
  const currentYear = new Date().getFullYear();
  const currentMonthIdx = new Date().getMonth();

  const [sessionId, setSessionId] = useState<string>(
    sessions?.find((s) => s.is_current)?.id || sessions?.[0]?.id || ""
  );
  const [calendarType, setCalendarType] = useState<"HIJRI" | "GREGORIAN">("GREGORIAN");
  const [monthName, setMonthName] = useState<string>(
    GREGORIAN_MONTHS[currentMonthIdx]?.name || GREGORIAN_MONTHS[0]?.name || "জানুয়ারি (January)"
  );
  const [year, setYear] = useState<string>(currentYear.toString());
  const [classId, setClassId] = useState<string>("ALL");
  const [selectedFeeTypeIds, setSelectedFeeTypeIds] = useState<string[]>(
    (feeTypes || []).filter((f) => f.frequency === "MONTHLY" || f.code === "MONTHLY").map((f) => f.id)
  );

  const [dueDate, setDueDate] = useState<string>(
    new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success?: boolean;
    generatedCount?: number;
    skippedCount?: number;
    message?: string;
    error?: string;
  } | null>(null);

  const handleToggleFeeType = (id: string) => {
    if (selectedFeeTypeIds.includes(id)) {
      setSelectedFeeTypeIds(selectedFeeTypeIds.filter((item) => item !== id));
    } else {
      setSelectedFeeTypeIds([...selectedFeeTypeIds, id]);
    }
  };

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

    const res = await generateMonthlyFees({
      sessionId,
      billingPeriod,
      monthName,
      year,
      classId,
      feeTypeIds: selectedFeeTypeIds,
      dueDate,
    });

    setLoading(false);
    setResult(res);
  };

  return (
    <div className="space-y-6">
      {/* Result Alert */}
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
                {result.success ? "ফি চার্জ সফলভাবে সম্পন্ন হয়েছে!" : "ত্রুটি ঘটেছে"}
              </h3>
              <p className="text-xs sm:text-sm font-medium">{result.message || result.error}</p>

              {result.success && (
                <div className="flex flex-wrap items-center gap-3 pt-3">
                  <Link
                    href="/dashboard/accounting/due"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition"
                  >
                    <span>বকেয়া তালিকা দেখুন</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>

                  <Link
                    href="/dashboard/accounting/fees/new"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white text-slate-800 border border-slate-300 rounded-xl text-xs font-bold hover:bg-slate-50 transition"
                  >
                    <span>ফি আদায় শুরু করুন</span>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Generator Card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
        <div className="border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-bold text-slate-900">মাসিক চার্জ কনফিগারেশন</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            সংশ্লিষ্ট শিক্ষাবর্ষের সকল সক্রিয় শিক্ষার্থীর প্রোফাইলে স্বয়ংক্রিয়ভাবে উক্ত মাসের ইনভয়েস যুক্ত হবে। কোনো শিক্ষার্থীর ইতিপূর্বে জেনারেট হয়ে থাকলে তা ডুপ্লিকেট হবে না।
          </p>
        </div>

        <form onSubmit={handleGenerate} className="space-y-6 text-xs sm:text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Session */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700">
                শিক্ষাবর্ষ (Session) <span className="text-red-500">*</span>
              </label>
              <select
                value={sessionId}
                onChange={(e) => setSessionId(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white font-medium"
              >
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.academic_year}) {s.is_current ? "⭐ বর্তমান" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Class */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700">
                টার্গেট জামাত / শ্রেণি <span className="text-red-500">*</span>
              </label>
              <select
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white font-medium"
              >
                <option value="ALL">সকল জামাত (All Classes)</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Calendar Type */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700">ক্যালেন্ডার মোড</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCalendarType("GREGORIAN");
                    setMonthName(GREGORIAN_MONTHS[currentMonthIdx].name);
                  }}
                  className={`flex-1 py-2 rounded-xl font-bold text-xs transition cursor-pointer border ${
                    calendarType === "GREGORIAN"
                      ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  ইংরেজি ক্যালেন্ডার
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCalendarType("HIJRI");
                    setMonthName(HIJRI_MONTHS[0].name);
                  }}
                  className={`flex-1 py-2 rounded-xl font-bold text-xs transition cursor-pointer border ${
                    calendarType === "HIJRI"
                      ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  হিজরি ক্যালেন্ডার
                </button>
              </div>
            </div>

            {/* Month Selection */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700">
                মাসের নাম <span className="text-red-500">*</span>
              </label>
              <select
                value={monthName}
                onChange={(e) => setMonthName(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white font-medium"
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
              <label className="font-bold text-slate-700">বছর / শিক্ষাবর্ষের সন</label>
              <input
                type="text"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="যেমন: 2026 বা 1447"
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 font-medium"
              />
            </div>

            {/* Due Date */}
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700">পরিশোধের শেষ তারিখ (Due Date)</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white font-medium"
              />
            </div>
          </div>

          {/* Fee Types to include */}
          <div className="space-y-3 pt-2">
            <label className="font-bold text-slate-800 block">
              উক্ত মাসে অন্তর্ভুক্তির জন্য ফি'র খাতসমূহ নির্বাচন করুন:
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {feeTypes.map((ft) => {
                const isSelected = selectedFeeTypeIds.includes(ft.id);
                return (
                  <button
                    key={ft.id}
                    type="button"
                    onClick={() => handleToggleFeeType(ft.id)}
                    className={`p-3 rounded-2xl border text-left flex items-center justify-between transition cursor-pointer ${
                      isSelected
                        ? "bg-emerald-50/80 border-emerald-300 text-emerald-950 shadow-2xs"
                        : "bg-slate-50/60 border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <div>
                      <span className="font-bold block text-xs sm:text-sm">{ft.name}</span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        ডিফল্ট: ৳{ft.default_amount}
                      </span>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                        isSelected
                          ? "bg-emerald-600 border-emerald-600 text-white"
                          : "border-slate-300 bg-white"
                      }`}
                    >
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Duplicate protection reassurance */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center gap-3 text-xs text-slate-600">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>
              <strong>নিরাপত্তা গার্ড:</strong> সিস্টেমে স্বয়ংক্রিয় ডুপ্লিকেট চেকার সক্রিয় রয়েছে। ইতিমধ্যে ফি জেনারেট হয়ে থাকা শিক্ষার্থীদের জন্য পুনরায় নতুন করে ইনভয়েস তৈরি হবে না।
            </span>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold shadow-sm transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 text-sm active:scale-99"
            >
              {loading ? (
                <span>ফি জেনারেট হচ্ছে, অনুগ্রহ করে অপেক্ষা করুন...</span>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span>মাসিক ফি ইনভয়েস জেনারেট করুন</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
