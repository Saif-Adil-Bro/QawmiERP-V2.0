"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  RotateCcw,
  Save,
  Sparkles,
  Loader2,
  SlidersHorizontal,
} from "lucide-react";
import {
  GradeRule,
  GradeBadgeColor,
  ExamGradingConfig,
  GradeCalculationMode,
  HighestMarksScope,
  DEFAULT_GRADE_RULES,
  DEFAULT_GRADING_CONFIG,
  GRADE_PRESETS,
  resolveGradeRule,
  getGradeBadgeClass,
} from "@/lib/exam-grading";
import { saveExamGradingConfig } from "@/app/actions/exams";
import { toBanglaNumber } from "@/lib/numberToBangla";

const COLOR_OPTIONS: { value: GradeBadgeColor; label: string }[] = [
  { value: "emerald", label: "সবুজ (Emerald)" },
  { value: "blue", label: "নীল (Blue)" },
  { value: "indigo", label: "ইন্ডিগো (Indigo)" },
  { value: "amber", label: "সোনালি (Amber)" },
  { value: "orange", label: "কমলা (Orange)" },
  { value: "purple", label: "বেগুনি (Purple)" },
  { value: "slate", label: "ধূসর (Slate)" },
  { value: "red", label: "লাল (Red)" },
];

export default function GradingScaleClient({ 
  initialConfig,
  initialRules 
}: { 
  initialConfig?: ExamGradingConfig;
  initialRules?: GradeRule[];
}) {
  const [calculationMode, setCalculationMode] = useState<GradeCalculationMode>(
    initialConfig?.calculationMode || "subject_gpa"
  );
  const [highestMarksScope, setHighestMarksScope] = useState<HighestMarksScope>(
    initialConfig?.highestMarksScope || "class"
  );
  const [rules, setRules] = useState<GradeRule[]>(
    initialConfig?.rules || initialRules || DEFAULT_GRADE_RULES
  );
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [previewMarks, setPreviewMarks] = useState<string>("75");

  const handleRuleChange = (idx: number, field: keyof GradeRule, value: any) => {
    setRules((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        return { ...r, [field]: value };
      })
    );
  };

  const handleAddRule = () => {
    setRules((prev) => [
      ...prev,
      {
        id: `grade_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        label: "নতুন গ্রেড",
        minPercentage: 40,
        gpa: 2.0,
        color: "slate",
        isFail: false,
      },
    ]);
  };

  const handleRemoveRule = (idx: number) => {
    if (rules.length <= 2) {
      setStatusMsg({ type: "error", text: "কমপক্ষে ২টি গ্রেড ধাপ থাকতে হবে।" });
      return;
    }
    setRules((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleApplyPreset = (presetRules: GradeRule[]) => {
    setRules(presetRules.map((r) => ({ ...r })));
    setStatusMsg(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setStatusMsg(null);
    try {
      const res = await saveExamGradingConfig({
        calculationMode,
        highestMarksScope,
        rules
      });
      if (res.error) {
        setStatusMsg({ type: "error", text: res.error });
      } else {
        if (res.config) {
          setCalculationMode(res.config.calculationMode);
          setHighestMarksScope(res.config.highestMarksScope);
          setRules(res.config.rules);
        }
        setStatusMsg({
          type: "success",
          text: "গ্রেড ও রেজাল্ট সেটিংস সফলভাবে সংরক্ষণ হয়েছে! এখন স্বতন্ত্র মার্কশিট ও পোর্টালে এই নিয়মে গ্রেড ও সর্বোচ্চ নম্বর হিসাব হবে।",
        });
      }
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err?.message || "সংরক্ষণ করতে সমস্যা হয়েছে।" });
    } finally {
      setSaving(false);
    }
  };

  const previewPct = Math.max(0, Math.min(100, Number(previewMarks) || 0));
  const previewResult = resolveGradeRule(previewPct, rules);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-start gap-3">
          <Link
            href="/dashboard/exams"
            className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition shrink-0 mt-0.5"
            title="পরীক্ষা তালিকায় ফিরুন"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Award className="w-6 h-6 text-emerald-600" />
              <span>পরীক্ষার মার্ক গ্রেড ও রেজাল্ট সেটিংস</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              মাদ্রাসার নিজস্ব নিয়ম অনুযায়ী গ্রেড হিসাব পদ্ধতি (গড় শতকরা বনাম বিষয়ভিত্তিক GPA), সর্বোচ্চ নম্বর স্কেল এবং কাস্টম গ্রেড স্কেল নির্ধারণ করুন।
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-60 shrink-0 cursor-pointer"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>{saving ? "সংরক্ষণ হচ্ছে..." : "সেটিংস সংরক্ষণ করুন"}</span>
        </button>
      </div>

      {statusMsg && (
        <div
          className={`p-4 rounded-xl border flex items-start gap-3 text-sm font-medium ${
            statusMsg.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          {statusMsg.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Grade Calculation Mode & Highest Marks Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Grade Calculation Mode Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-bold text-slate-800">গ্রেড সিস্টেম নির্ধারণ পদ্ধতি</h2>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            স্বতন্ত্র মার্কশিট ও রেজাল্টে গ্রেড কি প্রতি বিষয়ের আলাদা গ্রেড ও জিপিএ থেকে আসবে, নাকি সর্বমোট নম্বরের গড় শতকরা থেকে আসবে?
          </p>

          <div className="space-y-2 pt-1">
            <label
              onClick={() => setCalculationMode("subject_gpa")}
              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                calculationMode === "subject_gpa"
                  ? "border-emerald-500 bg-emerald-50/40 text-slate-900"
                  : "border-slate-200 hover:bg-slate-50 text-slate-700"
              }`}
            >
              <input
                type="radio"
                name="calc_mode"
                checked={calculationMode === "subject_gpa"}
                onChange={() => setCalculationMode("subject_gpa")}
                className="mt-1 accent-emerald-600 w-4 h-4"
              />
              <div>
                <div className="text-xs font-bold flex items-center gap-1.5">
                  <span>প্রতি সাবজেক্ট অনুযায়ী (Subject-wise Grade & GPA)</span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">প্রস্তাবিত</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                  মার্কশিটে প্রতিটি বিষয়ের পাশে আলাদা গ্রেড ও পয়েন্ট থাকবে। সব বিষয়ের জিপিএ গড়ের ভিত্তিতে চূড়ান্ত প্রাপ্ত বিভাগ ও মেধা স্থান নির্ধারিত হবে।
                </p>
              </div>
            </label>

            <label
              onClick={() => setCalculationMode("average_percentage")}
              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                calculationMode === "average_percentage"
                  ? "border-emerald-500 bg-emerald-50/40 text-slate-900"
                  : "border-slate-200 hover:bg-slate-50 text-slate-700"
              }`}
            >
              <input
                type="radio"
                name="calc_mode"
                checked={calculationMode === "average_percentage"}
                onChange={() => setCalculationMode("average_percentage")}
                className="mt-1 accent-emerald-600 w-4 h-4"
              />
              <div>
                <div className="text-xs font-bold">
                  গড় শতকরা অনুযায়ী (Overall Average Percentage)
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                  সব বিষয়ের মোট প্রাপ্ত নম্বরকে সর্বমোট দিয়ে ভাগ করে সামগ্রিক শতকরা (%) থেকে সরাসরি একটি চূড়ান্ত বিভাগ (যেমন: মুমতাজ বা ১ম বিভাগ) দেওয়া হবে।
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Highest Marks Scope Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-bold text-slate-800">সর্বোচ্চ নম্বর (Highest Marks) নির্ধারণের পরিধি</h2>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">
            স্বতন্ত্র রেজাল্ট শিটে প্রতিটি বিষয়ের প্রাপ্ত নম্বরের পূর্বে প্রদর্শিত "সর্বোচ্চ নম্বর" কার ভিত্তিতে গণনা হবে?
          </p>

          <div className="space-y-2 pt-1">
            <label
              onClick={() => setHighestMarksScope("class")}
              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                highestMarksScope === "class"
                  ? "border-blue-500 bg-blue-50/40 text-slate-900"
                  : "border-slate-200 hover:bg-slate-50 text-slate-700"
              }`}
            >
              <input
                type="radio"
                name="highest_scope"
                checked={highestMarksScope === "class"}
                onChange={() => setHighestMarksScope("class")}
                className="mt-1 accent-blue-600 w-4 h-4"
              />
              <div>
                <div className="text-xs font-bold flex items-center gap-1.5">
                  <span>শ্রেণি / জামাত অনুযায়ী (Class-wise Highest)</span>
                  <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-bold">প্রস্তাবিত</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                  শুধুমাত্র ওই শ্রেণি বা জামাতের শিক্ষার্থীদের মধ্যে ওই বিষয়ে যে ছাত্রটি সর্বোচ্চ নম্বর পেয়েছে, সেই নম্বরটি শো করবে।
                </p>
              </div>
            </label>

            <label
              onClick={() => setHighestMarksScope("exam")}
              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                highestMarksScope === "exam"
                  ? "border-blue-500 bg-blue-50/40 text-slate-900"
                  : "border-slate-200 hover:bg-slate-50 text-slate-700"
              }`}
            >
              <input
                type="radio"
                name="highest_scope"
                checked={highestMarksScope === "exam"}
                onChange={() => setHighestMarksScope("exam")}
                className="mt-1 accent-blue-600 w-4 h-4"
              />
              <div>
                <div className="text-xs font-bold">
                  পুরো পরীক্ষার ভিত্তিতে (Overall Exam Highest)
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                  সমগ্র পরীক্ষার সব বিভাগ ও শ্রেণির ভেতর যে ছাত্রটি ওই বিষয়ে সর্বোচ্চ নম্বর পেয়েছে, তা শো করবে।
                </p>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* Presets */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>প্রস্তুতকৃত টেমপ্লেট (Quick Presets)</span>
          </h2>
          <button
            type="button"
            onClick={() => handleApplyPreset(DEFAULT_GRADE_RULES)}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>ডিফল্টে রিসেট</span>
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {GRADE_PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() => handleApplyPreset(preset.rules)}
              className="text-left p-3.5 rounded-xl border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/40 transition cursor-pointer"
            >
              <div className="font-bold text-slate-900 text-xs sm:text-sm">{preset.name}</div>
              <div className="text-[11px] text-slate-500 mt-1 leading-relaxed">{preset.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Rules Editor */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-slate-600" />
            <h2 className="font-bold text-slate-800 text-sm sm:text-base">কাস্টম গ্রেড ধাপসমূহ</h2>
          </div>
          <button
            type="button"
            onClick={handleAddRule}
            className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>নতুন গ্রেড ধাপ যোগ করুন</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50 text-[11px] font-bold text-slate-500 uppercase">
                <th className="py-3 px-4">গ্রেড / বিভাগের নাম</th>
                <th className="py-3 px-3 w-36">সর্বনিম্ন %</th>
                <th className="py-3 px-3 w-32">GPA পয়েন্ট</th>
                <th className="py-3 px-3 w-40">ব্যাজ রঙ</th>
                <th className="py-3 px-3 w-28 text-center">ফেল ধাপ?</th>
                <th className="py-3 px-3 w-40">প্রিভিউ ব্যাজ</th>
                <th className="py-3 px-3 w-16 text-center">মুছুন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {rules.map((rule, idx) => (
                <tr key={rule.id || idx} className="hover:bg-slate-50/60 transition">
                  <td className="py-2.5 px-4">
                    <input
                      type="text"
                      value={rule.label}
                      onChange={(e) => handleRuleChange(idx, "label", e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                      placeholder="যেমন: মুমতাজ (A+)"
                    />
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="relative">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        value={rule.minPercentage}
                        onChange={(e) => handleRuleChange(idx, "minPercentage", Number(e.target.value))}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <input
                      type="number"
                      min={0}
                      max={5}
                      step={0.1}
                      value={rule.gpa}
                      onChange={(e) => handleRuleChange(idx, "gpa", Number(e.target.value))}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                    />
                  </td>
                  <td className="py-2.5 px-3">
                    <select
                      value={rule.color}
                      onChange={(e) => handleRuleChange(idx, "color", e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                    >
                      {COLOR_OPTIONS.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <input
                      type="checkbox"
                      checked={Boolean(rule.isFail)}
                      onChange={(e) => handleRuleChange(idx, "isFail", e.target.checked)}
                      className="w-4 h-4 accent-rose-600 rounded cursor-pointer"
                      title="অকৃতকার্য বা ফেল গ্রেড হলে টিক দিন"
                    />
                  </td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${getGradeBadgeClass(
                        rule.color
                      )}`}
                    >
                      {rule.label || "গ্রেড"}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveRule(idx)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                      title="মুছুন"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Live Simulator */}
      <div className="bg-slate-900 text-white p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider">লাইভ টেস্ট সিমুলেটর</div>
          <div className="text-sm text-slate-300 mt-0.5">
            শতকরা নম্বর দিয়ে পরীক্ষা করে দেখুন কোন গ্রেড ও GPA আসে:
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700">
            <span className="text-xs text-slate-400">নম্বর (%):</span>
            <input
              type="number"
              min={0}
              max={100}
              value={previewMarks}
              onChange={(e) => setPreviewMarks(e.target.value)}
              className="w-16 bg-transparent text-white font-bold text-sm focus:outline-none text-center"
            />
          </div>
          <span
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${getGradeBadgeClass(
              previewResult.color
            )}`}
          >
            {previewResult.label} • GPA {toBanglaNumber(previewResult.gpa.toFixed(1))}
          </span>
        </div>
      </div>
    </div>
  );
}
