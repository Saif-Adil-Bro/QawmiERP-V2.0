"use client";

import { useActionState, useEffect } from "react";
import { createClass, AvailableTeacher } from "@/app/actions/classes";
import Link from "next/link";
import { ArrowLeft, BookOpen, Layers, ShieldCheck, UserCheck, Plus, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

export default function NewClassClient({ availableTeachers }: { availableTeachers: AvailableTeacher[] }) {
  const [state, formAction, isPending] = useActionState(createClass, null);
  const router = useRouter();

  useEffect(() => {
    if (state?.success) {
      router.push("/dashboard/classes");
    }
  }, [state, router]);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <Link
          href="/dashboard/classes"
          className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer"
          title="জামাত তালিকায় ফিরে যান"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
            <Layers className="w-6 h-6 text-emerald-600" />
            নতুন জামাত / শ্রেণি যোগ করুন
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            জামাতের নাম, শ্রেণি জিম্মাদার শিক্ষক নির্বাচন এবং ক্রম নির্ধারণ করুন
          </p>
        </div>
      </div>

      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200/80 shadow-xs">
        <form action={formAction} className="space-y-6">
          {state?.error && (
            <div className="p-4 bg-rose-50 text-rose-800 rounded-xl text-xs sm:text-sm border border-rose-200 font-medium animate-shake">
              {state.error}
            </div>
          )}

          {/* Class Name */}
          <div>
            <label className="block text-xs sm:text-sm font-bold text-slate-800 mb-1.5">
              জামাত / শ্রেণির নাম <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              required
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-slate-900 text-sm font-semibold transition"
              placeholder="যেমন: হিফজুল কুরআন, নাজেরা, মিজান, নাহবেমীর, শরহে বেকায়া, মিশকাত..."
            />
            <p className="text-[11px] text-slate-400 mt-1">
              কওমি নেসাবের স্তর অনুযায়ী জামাতের শুদ্ধ নাম লিখুন।
            </p>
          </div>

          {/* Class Teacher (শ্রেণি জিম্মাদার শিক্ষক) Selector */}
          <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-xl space-y-2">
            <label className="block text-xs sm:text-sm font-bold text-emerald-950 flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-emerald-600" />
              শ্রেণি জিম্মাদার শিক্ষক নির্বাচন (Class Teacher)
            </label>
            <select
              name="class_teacher_id"
              defaultValue=""
              className="w-full px-4 py-2.5 border border-emerald-200 rounded-xl bg-white text-slate-900 text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none transition"
            >
              <option value="NONE">-- কোনো জিম্মাদার শিক্ষক নির্ধারিত নয় (পরেও যুক্ত করা যাবে) --</option>
              {availableTeachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  👨‍🏫 {teacher.name} {teacher.designation ? `(${teacher.designation})` : ""} {teacher.staff_id_code ? `[ID: ${teacher.staff_id_code}]` : ""}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-emerald-800/80 leading-relaxed">
              💡 এই জামাতটির সার্বিক নজরদারি, দরস উপস্থিতি ও শৃঙ্খলা তদারকির দায়িত্বপ্রাপ্ত শিক্ষককে নির্বাচন করুন।
            </p>
          </div>

          {/* Sequence Number */}
          <div>
            <label className="block text-xs sm:text-sm font-bold text-slate-800 mb-1.5">
              জামাত ক্রমবিন্যাস নম্বর (Sequence / স্তর) <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              name="sequence"
              defaultValue="0"
              required
              min="0"
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-slate-900 font-mono font-bold text-sm transition"
              placeholder="0"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              ধারাবাহিক স্তর বিন্যাস: যেমন: ১ (নাজেরা), ২ (হিফজ), ৩ (মিজান), ৪ (নাহবেমীর)...। প্রমোশনের সময় ক্রমানুসারে পরবর্তী জামাতে স্থানান্তর হবে।
            </p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs sm:text-sm font-bold text-slate-800 mb-1.5">
              বিবরণ / সংক্ষিপ্ত নোট (ঐচ্ছিক)
            </label>
            <textarea
              name="description"
              rows={3}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-slate-900 text-sm transition"
              placeholder="জামাতের বিশেষ শর্তাবলি, ব্রাঞ্চ বা অতিরিক্ত তথ্য..."
            ></textarea>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Link
              href="/dashboard/classes"
              className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-bold text-xs sm:text-sm transition-colors cursor-pointer"
            >
              বাতিল
            </Link>
            <button
              type="submit"
              disabled={isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-colors disabled:opacity-50 shadow-xs flex items-center gap-2 cursor-pointer"
            >
              {isPending ? (
                <>সংরক্ষণ হচ্ছে...</>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>জামাত সংরক্ষণ করুন</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
