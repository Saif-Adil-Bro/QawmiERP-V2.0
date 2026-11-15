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
  DEFAULT_GRADE_RULES,
  GRADE_PRESETS,
  resolveGradeRule,
  getGradeBadgeClass,
} from "@/lib/exam-grading";
import { saveExamGradeScale } from "@/app/actions/exams";
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

export default function GradingScaleClient({ initialRules }: { initialRules: GradeRule[] }) {
  const [rules, setRules] = useState<GradeRule[]>(initialRules);
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
      const res = await saveExamGradeScale(rules);
      if (res.error) {
        setStatusMsg({ type: "error", text: res.error });
      } else {
        if (res.rules) setRules(res.rules);
        setStatusMsg({
          type: "success",
          text: "গ্রেড স্কেল সফলভাবে সংরক্ষণ হয়েছে! এখন অ্যাডমিন, শিক্ষক ও অভিভাবক পোর্টালে এই নিয়মে গ্রেড হিসাব হবে।",
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
              <span>পরীক্ষার মার্ক গ্রেড সেটিংস (Grade Scale)</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              মাদ্রাসার নিজস্ব নিয়ম অনুযায়ী শতকরা নম্বর, গ্রেড/বিভাগ এবং GPA পয়েন্ট নির্ধারণ করুন। এটি ফলাফল, মার্কশিট, মেধা তালিকা, শিক্ষক ও অভিভাবক পোর্টালে স্বয়ংক্রিয়ভাবে প্রযোজ্য হবে।
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
          <span>{saving ? "সংরক্ষণ হচ্ছে..." : "গ্রেড স্কেল সেভ করুন"}</span>
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
