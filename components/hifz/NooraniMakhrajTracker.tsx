"use client";

import { useState, useTransition } from "react";
import {
  NOORANI_TAKHTIS,
  MAKHRAJ_LIST,
  StudentNooraniProgress,
} from "@/lib/noorani-utils";
import { saveStudentNooraniProgress } from "@/app/actions/noorani";
import { BookOpen, CheckCircle2, AlertCircle, Sparkles, Award, ChevronDown, ChevronUp } from "lucide-react";
import { toBanglaNumber } from "@/lib/numberToBangla";

interface Props {
  studentId: string;
  studentName: string;
  initialProgress: StudentNooraniProgress;
}

export default function NooraniMakhrajTracker({
  studentId,
  studentName,
  initialProgress,
}: Props) {
  const [progress, setProgress] = useState<StudentNooraniProgress>(initialProgress);
  const [isOpen, setIsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<"takhti" | "makhraj">("takhti");
  const [notes, setNotes] = useState(initialProgress.teacherNotes || "");
  const [isPending, startTransition] = useTransition();
  const [saveSuccess, setSaveSuccess] = useState(false);

  const completedCount = progress.completedTakhtis.length;
  const percentage = Math.round((completedCount / NOORANI_TAKHTIS.length) * 100);

  const handleTakhtiToggle = (takhtiId: number) => {
    const isCompleted = progress.completedTakhtis.includes(takhtiId);
    let newCompleted: number[];
    if (isCompleted) {
      newCompleted = progress.completedTakhtis.filter((id) => id !== takhtiId);
    } else {
      newCompleted = [...progress.completedTakhtis, takhtiId];
    }

    const newCurrent = Math.max(...newCompleted, takhtiId);
    const updated: StudentNooraniProgress = {
      ...progress,
      currentTakhtiId: newCurrent > 0 ? newCurrent : 1,
      completedTakhtis: newCompleted,
      evaluationStatus:
        newCompleted.length === NOORANI_TAKHTIS.length
          ? "READY_FOR_QURAN"
          : newCompleted.length > 15
          ? "EXCELLENT"
          : newCompleted.length > 5
          ? "PROGRESSING"
          : "BEGINNER",
    };

    setProgress(updated);
    saveData(updated);
  };

  const handleMakhrajToggle = (makhrajId: number) => {
    const hasWeakness = progress.makhrajWeaknesses.includes(makhrajId);
    let newWeaknesses: number[];
    if (hasWeakness) {
      newWeaknesses = progress.makhrajWeaknesses.filter((id) => id !== makhrajId);
    } else {
      newWeaknesses = [...progress.makhrajWeaknesses, makhrajId];
    }

    const updated: StudentNooraniProgress = {
      ...progress,
      makhrajWeaknesses: newWeaknesses,
    };

    setProgress(updated);
    saveData(updated);
  };

  const saveData = (dataToSave: StudentNooraniProgress) => {
    startTransition(async () => {
      const res = await saveStudentNooraniProgress(studentId, {
        ...dataToSave,
        teacherNotes: notes,
      });
      if (res.success && res.data) {
        setProgress(res.data);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
      }
    });
  };

  const currentTakhtiObj =
    NOORANI_TAKHTIS.find((t) => t.id === progress.currentTakhtiId) || NOORANI_TAKHTIS[0];

  return (
    <div className="bg-white rounded-2xl shadow-xs border border-emerald-100 overflow-hidden">
      {/* Header Bar */}
      <div className="bg-gradient-to-r from-emerald-800 to-teal-900 text-white p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-md border border-white/15">
            <BookOpen className="w-6 h-6 text-emerald-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold">নূরানী কায়দা ও মাখরাজ ট্র্যাকার</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">
                ২৭ তখতি ও ১৭ মাখরাজ
              </span>
            </div>
            <p className="text-xs text-emerald-100/80 mt-0.5">
              {studentName}-এর কায়দা সবক ও তাজবীদ অগ্রগতি
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {saveSuccess && (
            <span className="text-xs bg-emerald-500 text-white px-2.5 py-1 rounded-full font-bold animate-in fade-in">
              ✓ সংরক্ষিত হয়েছে
            </span>
          )}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
            title="সংকোচন বা সম্প্রসারণ করুন"
          >
            {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="p-4 sm:p-6 space-y-6">
          {/* Progress Overview Bar */}
          <div className="bg-emerald-50/60 rounded-xl p-4 border border-emerald-100">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-700">বর্তমান অবস্থান:</span>
                <span className="text-sm font-black text-emerald-800">
                  তখতি নং {toBanglaNumber(progress.currentTakhtiId)}: {currentTakhtiObj.title}
                </span>
              </div>
              <div className="text-xs font-bold text-emerald-900">
                সমাপ্ত: {toBanglaNumber(completedCount)} / {toBanglaNumber(27)} ({toBanglaNumber(percentage)}%)
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
              <div
                className="bg-emerald-600 h-3 rounded-full transition-all duration-300"
                style={{ width: `${percentage}%` }}
              />
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-2">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>উদাহরণ: </span>
                <span className="font-arabic font-bold text-emerald-950 text-sm">
                  {currentTakhtiObj.arabicExample}
                </span>
              </div>
              <span
                className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                  progress.evaluationStatus === "READY_FOR_QURAN"
                    ? "bg-purple-100 text-purple-800 border border-purple-200"
                    : progress.evaluationStatus === "EXCELLENT"
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                    : progress.evaluationStatus === "PROGRESSING"
                    ? "bg-blue-100 text-blue-800 border border-blue-200"
                    : "bg-slate-100 text-slate-700 border border-slate-200"
                }`}
              >
                {progress.evaluationStatus === "READY_FOR_QURAN"
                  ? "🌟 নাজেরা কুরআন উপযোগী"
                  : progress.evaluationStatus === "EXCELLENT"
                  ? "চমৎকার অগ্রগতি"
                  : progress.evaluationStatus === "PROGRESSING"
                  ? "অগ্রগতিশীল"
                  : "প্রারম্ভিক পর্যায়"}
              </span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => setActiveTab("takhti")}
              className={`pb-2.5 px-4 text-sm font-bold border-b-2 transition flex items-center gap-2 ${
                activeTab === "takhti"
                  ? "border-emerald-600 text-emerald-800"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>নূরানী ২৭ তখতি চেকলিস্ট</span>
              <span className="text-xs bg-slate-100 px-2 py-0.5 rounded-full">
                {toBanglaNumber(completedCount)}/২৭
              </span>
            </button>
            <button
              onClick={() => setActiveTab("makhraj")}
              className={`pb-2.5 px-4 text-sm font-bold border-b-2 transition flex items-center gap-2 ${
                activeTab === "makhraj"
                  ? "border-emerald-600 text-emerald-800"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <AlertCircle className="w-4 h-4" />
              <span>১৭ মাখরাজ ও তাজবীদ সংশোধন</span>
              {progress.makhrajWeaknesses.length > 0 && (
                <span className="text-xs bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full font-bold">
                  {toBanglaNumber(progress.makhrajWeaknesses.length)} টি মশক প্রয়োজন
                </span>
              )}
            </button>
          </div>

          {/* Tab 1: 27 Takhtis Grid */}
          {activeTab === "takhti" && (
            <div className="space-y-4">
              <p className="text-xs text-slate-500">
                যে তখতিগুলোর সবক ও পরীক্ষা নেওয়া হয়েছে, সেগুলোতে ক্লিক করে টিক দিন। স্বয়ংক্রিয়ভাবে প্রগ্রেস আপডেট হবে।
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-[380px] overflow-y-auto pr-1">
                {NOORANI_TAKHTIS.map((takhti) => {
                  const isDone = progress.completedTakhtis.includes(takhti.id);
                  const isCurrent = progress.currentTakhtiId === takhti.id;

                  return (
                    <div
                      key={takhti.id}
                      onClick={() => handleTakhtiToggle(takhti.id)}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition select-none ${
                        isDone
                          ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                          : isCurrent
                          ? "bg-amber-50 border-amber-300 text-amber-900 shadow-xs"
                          : "bg-white border-slate-200 hover:border-slate-300 text-slate-800"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                          তখতি {takhti.numberBangla}
                        </span>
                        {isDone ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : isCurrent ? (
                          <span className="text-[10px] bg-amber-200 text-amber-900 font-bold px-1.5 py-0.5 rounded">
                            চলমান
                          </span>
                        ) : null}
                      </div>

                      <h4 className="font-bold text-xs sm:text-sm line-clamp-1">{takhti.title}</h4>
                      <div className="text-xs font-arabic font-bold text-slate-700 mt-1">
                        {takhti.arabicExample}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tab 2: 17 Makharij Weakness Checklist */}
          {activeTab === "makhraj" && (
            <div className="space-y-4">
              <p className="text-xs text-slate-500">
                যে মাখরাজ বা হরফে শিক্ষার্থীর উচ্চারণে সমস্যা আছে, সেটিতে ক্লিক করে চিহ্নিত করুন। এটি অভিভাবক ও শিক্ষক দুজনকেই বাচ্চার দুর্বলতা কাটিয়ে উঠতে সহায়তা করবে।
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto pr-1">
                {MAKHRAJ_LIST.map((makhraj) => {
                  const isWeak = progress.makhrajWeaknesses.includes(makhraj.id);

                  return (
                    <div
                      key={makhraj.id}
                      onClick={() => handleMakhrajToggle(makhraj.id)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition select-none flex items-start gap-3 ${
                        isWeak
                          ? "bg-rose-50/70 border-rose-300 text-rose-950"
                          : "bg-white border-slate-200 hover:border-emerald-200 text-slate-800"
                      }`}
                    >
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                          isWeak ? "bg-rose-600 text-white" : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {makhraj.numberBangla}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <h4 className="font-bold text-xs sm:text-sm truncate">{makhraj.name}</h4>
                          <span className="text-xs font-arabic font-bold text-emerald-800 shrink-0">
                            {makhraj.lettersArabic}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-2">
                          {makhraj.description}
                        </p>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-[10px] text-slate-400">{makhraj.organ}</span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isWeak
                                ? "bg-rose-200 text-rose-800"
                                : "bg-emerald-50 text-emerald-700"
                            }`}
                          >
                            {isWeak ? "⚠️ মশক দরকার" : "✓ সহীহ হয়েছে"}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Teacher's Note & Quick Save */}
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-3">
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="শিক্ষকের মন্তব্য বা বিশেষ পরামর্শ লিখুন (যেমন: 'যাল ও ছা হরফে নরম শব্দ করতে হবে')..."
              className="flex-1 min-w-[200px] text-xs px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
            <button
              onClick={() => saveData(progress)}
              disabled={isPending}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold transition disabled:opacity-50 cursor-pointer"
            >
              {isPending ? "সংরক্ষণ হচ্ছে..." : "অগ্রগতি সংরক্ষণ করুন"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
